#!/usr/bin/env python3
"""Razer SensorFinder CLI: watch analog key depth and read/set per-key actuation.

Fallback for the web UI (web/index.html) when WebHID cannot reach the keyboard.
Requires `pip install hidapi`.

  python razer_sensorfinder.py list
  python razer_sensorfinder.py monitor [--csv log.csv] [--noise N]
  python razer_sensorfinder.py get-key [--key Win] [--profile 0|active]
  python razer_sensorfinder.py set-key --mm 3.0 [--key Win] [--profile 0|active]

The depth stream only flows in driver mode, i.e. while Razer Synapse is running.
Actuation set with `set-key` only matters while Synapse is NOT running.
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from dataclasses import dataclass, field

VENDOR_RAZER = 0x1532


@dataclass(frozen=True)
class Family:
    depth_report_id: int
    entry_size: int
    raw_max: int
    zero_mm: float  # threshold 0
    full_mm: float  # threshold 255
    range_mm: tuple[float, float]

    def raw_to_mm(self, raw: int) -> float:
        if self.entry_size == 2:
            return self.zero_mm + raw / 255 * (self.full_mm - self.zero_mm)
        return raw / 16380

    def threshold_to_mm(self, t: int) -> float:
        return self.zero_mm + t / 255 * (self.full_mm - self.zero_mm)

    def mm_to_threshold(self, mm: float) -> int:
        t = round((mm - self.zero_mm) / (self.full_mm - self.zero_mm) * 255)
        # V2 accepts 0; on V3 threshold 0 would mean "pressed at rest".
        return max(0 if self.entry_size == 2 else 1, min(255, t))


# V2: report 07, [fwID, depth:u8], 0..255 = 1.5..3.6 mm.
# V3: report 0B, [fwID, depth:u16 BE], 1638 = 0.1 mm; key-assignment threshold = high byte.
V2 = Family(0x07, 2, 0xFF, 1.5, 3.6, (1.5, 3.6))
V3 = Family(0x0B, 3, 0xFFFF, 0.0, 255 * 256 / 16380, (0.1, 4.0))

MODELS = {
    0x0266: ("Huntsman V2 Analog", V2),
    0x0282: ("Huntsman Mini Analog", V2),
    0x02A6: ("Huntsman V3 Pro", V3),
    0x02A7: ("Huntsman V3 Pro TKL", V3),
    0x02B0: ("Huntsman V3 Pro Mini", V3),
    0x02CF: ("Huntsman V3 Pro 8KHz", V3),
    0x02D0: ("Huntsman V3 Pro TKL 8KHz", V3),
    0x02D8: ("Huntsman Signature Edition", V3),
    0x02E5: ("Huntsman V3 TKL 8KHz", V3),
    0x02E6: ("Huntsman V3 Pro Low-profile TKL 8KHz", V3),
}

KEY_NAMES = {
    1: "`", 2: "1", 3: "2", 4: "3", 5: "4", 6: "5", 7: "6", 8: "7", 9: "8", 10: "9", 11: "0",
    12: "-", 13: "=", 14: "Yen", 15: "Backspace", 16: "Tab",
    17: "Q", 18: "W", 19: "E", 20: "R", 21: "T", 22: "Y", 23: "U", 24: "I", 25: "O", 26: "P",
    27: "[", 28: "]", 29: "\\", 30: "CapsLock",
    31: "A", 32: "S", 33: "D", 34: "F", 35: "G", 36: "H", 37: "J", 38: "K", 39: "L",
    40: ";", 41: "'", 42: "ISO#", 43: "Enter", 44: "LShift", 45: "ISO\\",
    46: "Z", 47: "X", 48: "C", 49: "V", 50: "B", 51: "N", 52: "M", 53: ",", 54: ".", 55: "/",
    56: "Ro", 57: "RShift", 58: "LCtrl", 59: "Fn", 60: "LAlt", 61: "Space", 62: "RAlt",
    64: "RCtrl", 75: "Insert", 76: "Delete", 79: "Left", 80: "Home", 81: "End", 83: "Up", 84: "Down",
    85: "PageUp", 86: "PageDown", 89: "Right", 90: "NumLock", 91: "Num7", 92: "Num4", 93: "Num1",
    95: "Num/", 96: "Num8", 97: "Num5", 98: "Num2", 99: "Num0", 100: "Num*", 101: "Num9",
    102: "Num6", 103: "Num3", 104: "Num.", 105: "Num-", 106: "Num+", 107: "Num=",
    108: "NumEnter", 110: "Esc", 112: "F1", 113: "F2", 114: "F3", 115: "F4", 116: "F5", 117: "F6",
    118: "F7", 119: "F8", 120: "F9", 121: "F10", 122: "F11", 123: "F12", 124: "PrtSc",
    125: "ScrollLock", 126: "Pause", 127: "Win", 129: "Menu", 150: "Muhenkan", 151: "Kana",
    152: "Hanja", 153: "Hangul", 154: "Henkan",
}
WIN_KEY = 127


def key_name(fw_id: int) -> str:
    return KEY_NAMES.get(fw_id, f"ID{fw_id}")


def key_id(name: str) -> int:
    if name.isdigit():
        return int(name)
    for fw_id, n in KEY_NAMES.items():
        if n.lower() == name.lower():
            return fw_id
    raise SystemExit(f"unknown key name: {name} (use a fwID number or one of: {', '.join(KEY_NAMES.values())})")


def parse_depth_report(family: Family, data: bytes) -> list[tuple[int, int]]:
    """Parse a depth payload (without report ID) into [(fwID, raw)]; empty = all released."""
    keys = []
    step = family.entry_size
    for i in range(0, len(data) - step + 1, step):
        fw_id = data[i]
        if fw_id == 0:
            break
        raw = data[i + 1] if step == 2 else (data[i + 1] << 8) | data[i + 2]
        keys.append((fw_id, raw))
    return keys


@dataclass
class Touch:
    key: int
    start: float
    peak: int = 0
    end: float | None = None


@dataclass
class Tracker:
    """Same semantics as DepthTracker in web/razer-protocol.js."""

    noise_floor: int = 0
    live: dict[int, int] = field(default_factory=dict)
    peaks: dict[int, int] = field(default_factory=dict)
    touches: dict[int, int] = field(default_factory=dict)
    open: dict[int, Touch] = field(default_factory=dict)

    def update(self, keys: list[tuple[int, int]], t: float) -> list[Touch]:
        seen = set()
        for fw_id, raw in keys:
            if raw <= self.noise_floor:
                continue
            seen.add(fw_id)
            self.live[fw_id] = raw
            self.peaks[fw_id] = max(self.peaks.get(fw_id, 0), raw)
            if fw_id not in self.open:
                self.open[fw_id] = Touch(fw_id, t)
                self.touches[fw_id] = self.touches.get(fw_id, 0) + 1
            self.open[fw_id].peak = max(self.open[fw_id].peak, raw)
        ended = []
        for fw_id in [k for k in self.open if k not in seen]:
            touch = self.open.pop(fw_id)
            touch.end = t
            self.live.pop(fw_id, None)
            ended.append(touch)
        return ended


# ---- control packets (90 bytes, sent as feature report 0 on interface 3) ----

PACKET_LEN = 90
TRANSACTION_ID = 0x1F
STATUS = {0: "new", 1: "busy", 2: "ok", 3: "fail", 4: "timeout", 5: "not supported"}


def build_packet(cls: int, cmd: int, size: int, args: bytes | list[int] = b"") -> bytes:
    p = bytearray(PACKET_LEN)
    p[1] = TRANSACTION_ID
    p[5] = size
    p[6] = cls
    p[7] = cmd
    p[8 : 8 + len(args)] = bytes(args)
    p[88] = crc(p)
    return bytes(p)


def crc(p: bytes | bytearray) -> int:
    c = 0
    for b in p[2:88]:
        c ^= b
    return c


def parse_reply(data: bytes, cls: int, cmd: int) -> tuple[int, bytes] | None:
    """Return (status, args) from a reply that may or may not start with the report ID."""
    for off in (0, 1):
        p = data[off : off + PACKET_LEN]
        if len(p) == PACKET_LEN and p[6] == cls and p[7] == cmd:
            return p[0], bytes(p[8:88])
    return None


@dataclass
class KeyAssignment:
    profile: int
    key: int
    layer: int
    thr_l: int  # actuation (press) point
    thr_h: int  # release point
    fn_id: int
    fn_data: bytes

    @classmethod
    def parse(cls, args: bytes) -> "KeyAssignment":
        profile, key, layer, thr_l, thr_h, fn_id, fn_size = args[:7]
        return cls(profile, key, layer, thr_l, thr_h, fn_id, bytes(args[7 : 7 + fn_size]))

    def to_args(self) -> bytes:
        return bytes([self.profile, self.key, self.layer, self.thr_l, self.thr_h, self.fn_id, len(self.fn_data)]) + self.fn_data

    def with_actuation(self, thr_l: int) -> "KeyAssignment":
        thr_h = self.thr_h if self.thr_h <= thr_l - 10 else max(0, thr_l - 10)
        return KeyAssignment(self.profile, self.key, self.layer, thr_l, thr_h, self.fn_id, self.fn_data)


# ---- device access ----


def _hid():
    try:
        import hid  # type: ignore
    except ImportError:
        raise SystemExit("hidapi is not installed: pip install hidapi")
    return hid


def find_keyboard(hid):
    infos = [d for d in hid.enumerate(VENDOR_RAZER, 0) if d["product_id"] in MODELS]
    if not infos:
        raise SystemExit("no supported Razer Huntsman analog keyboard found (run `list`)")
    return infos[0]["product_id"], [d for d in infos if d["product_id"] == infos[0]["product_id"]]


def open_path(hid, path):
    dev = hid.device()
    dev.open_path(path)
    return dev


class Control:
    def __init__(self, hid, interfaces):
        self.dev = None
        errors = []
        # Interface 3 is the control channel on every model; try it first.
        for info in sorted(interfaces, key=lambda d: d["interface_number"] != 3):
            if info["interface_number"] != 3:
                continue
            try:
                self.dev = open_path(hid, info["path"])
                break
            except OSError as e:
                errors.append(str(e))
        if self.dev is None:
            raise SystemExit(f"could not open the control interface (3): {errors}")

    def exchange(self, packet: bytes) -> bytes:
        cls, cmd = packet[6], packet[7]
        self.dev.send_feature_report(b"\x00" + packet)
        for i in range(20):
            time.sleep(0.005 if i == 0 else 0.02)
            reply = parse_reply(bytes(self.dev.get_feature_report(0, PACKET_LEN + 1)), cls, cmd)
            if reply is None:
                raise SystemExit("unexpected reply format")
            status, args = reply
            if status == 1:
                continue
            if status != 2:
                raise SystemExit(f"keyboard answered: {STATUS.get(status, hex(status))}")
            return args
        raise SystemExit("keyboard stayed busy")

    def active_profile(self) -> int:
        slot = self.exchange(build_packet(0x05, 0x84, 1))[0]
        if not 1 <= slot <= 6:
            raise SystemExit(f"unexpected active profile: {slot}")
        return slot

    def read_key(self, profile: int, key: int) -> KeyAssignment:
        a = KeyAssignment.parse(self.exchange(build_packet(0x02, 0x92, 80, [profile, key, 0])))
        if a.key != key:
            raise SystemExit("reply is for a different key")
        return a

    def write_key(self, a: KeyAssignment) -> None:
        self.exchange(build_packet(0x02, 0x12, 80, a.to_args()))


# ---- commands ----


def cmd_list(_args):
    hid = _hid()
    for d in hid.enumerate(VENDOR_RAZER, 0):
        model = MODELS.get(d["product_id"], ("?", None))[0]
        print(
            f"PID {d['product_id']:04X} {model:<36} if={d['interface_number']} "
            f"usage={d['usage_page']:04X}:{d['usage']:04X} {d['path']!r}"
        )


def cmd_monitor(args):
    hid = _hid()
    pid, interfaces = find_keyboard(hid)
    name, family = MODELS[pid]
    readers = []
    for info in interfaces:
        if info["interface_number"] != 1:
            continue
        try:
            dev = open_path(hid, info["path"])
            dev.set_nonblocking(True)
            readers.append(dev)
        except OSError:
            pass  # keyboard/mouse collections are owned by the OS
    if not readers:
        raise SystemExit("could not open the depth-stream interface (1)")
    print(f"Razer {name}: watching depth stream. Start Razer Synapse if nothing shows up. Ctrl+C to stop.")

    tracker = Tracker(noise_floor=args.noise)
    out = None
    if args.csv:
        out = csv.writer(open(args.csv, "w", newline="", encoding="utf-8-sig"))
        out.writerow(["start_s", "key", "fwID", "duration_ms", "peak_raw", "peak_mm"])
    t0 = time.perf_counter()
    try:
        while True:
            got = False
            for dev in readers:
                data = dev.read(64)
                if not data or data[0] != family.depth_report_id:
                    continue
                got = True
                t = time.perf_counter() - t0
                for touch in tracker.update(parse_depth_report(family, bytes(data[1:])), t):
                    dur = (touch.end - touch.start) * 1000
                    mm = family.raw_to_mm(touch.peak)
                    print(f"{touch.start:9.3f}s  {key_name(touch.key):<10} {dur:8.1f} ms  peak {touch.peak} (~{mm:.2f} mm)")
                    if out:
                        out.writerow([f"{touch.start:.3f}", key_name(touch.key), touch.key, f"{dur:.1f}", touch.peak, f"{mm:.3f}"])
            if not got:
                time.sleep(0.001)
    except KeyboardInterrupt:
        pass
    print("\nsummary (most touched first):")
    for fw_id in sorted(tracker.touches, key=lambda k: (-tracker.touches[k], -tracker.peaks[k])):
        peak = tracker.peaks[fw_id]
        print(f"  {key_name(fw_id):<10} touches {tracker.touches[fw_id]:4}  peak {peak} (~{family.raw_to_mm(peak):.2f} mm)")


def _control(args):
    hid = _hid()
    pid, interfaces = find_keyboard(hid)
    name, family = MODELS[pid]
    ctl = Control(hid, interfaces)
    profile = ctl.active_profile() if args.profile == "active" else 0
    return name, family, ctl, profile


def _describe(family: Family, a: KeyAssignment) -> str:
    where = "RAM" if a.profile == 0 else "flash slot"
    return (
        f"{key_name(a.key)} (fwID {a.key}) profile {a.profile} ({where}): "
        f"actuation {a.thr_l} (~{family.threshold_to_mm(a.thr_l):.2f} mm), "
        f"release {a.thr_h} (~{family.threshold_to_mm(a.thr_h):.2f} mm), fn {a.fn_id:02X} [{a.fn_data.hex(' ')}]"
    )


def cmd_get_key(args):
    _, family, ctl, profile = _control(args)
    print(_describe(family, ctl.read_key(profile, key_id(args.key))))


def cmd_set_key(args):
    name, family, ctl, profile = _control(args)
    lo, hi = family.range_mm
    if not lo <= args.mm <= hi:
        raise SystemExit(f"--mm must be within {lo}..{hi} for the {name}")
    key = key_id(args.key)
    if profile != 0 and not args.yes:
        if input(f"write to flash slot {profile}? [y/N] ").strip().lower() != "y":
            return
    before = ctl.read_key(profile, key)
    wanted = before.with_actuation(family.mm_to_threshold(args.mm))
    ctl.write_key(wanted)
    after = ctl.read_key(profile, key)
    print("before:", _describe(family, before))
    print("after: ", _describe(family, after))
    if after.thr_l != wanted.thr_l:
        print("warning: the keyboard did not keep the new value")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list", help="list Razer HID interfaces").set_defaults(func=cmd_list)
    m = sub.add_parser("monitor", help="watch the depth stream (needs Synapse running)")
    m.add_argument("--csv", help="write every touch to this CSV file")
    m.add_argument("--noise", type=int, default=0, help="ignore raw depth <= N")
    m.set_defaults(func=cmd_monitor)
    for name, func in (("get-key", cmd_get_key), ("set-key", cmd_set_key)):
        p = sub.add_parser(name, help=f"{name.split('-')[0]} one key's actuation point (close Synapse first)")
        p.add_argument("--key", default="Win", help="key name or fwID (default: Win)")
        p.add_argument("--profile", choices=["0", "active"], default="0", help="0 = RAM (default), active = flash slot")
        if name == "set-key":
            p.add_argument("--mm", type=float, required=True, help="new actuation point in mm")
            p.add_argument("--yes", action="store_true", help="do not ask before writing flash")
        p.set_defaults(func=func)
    args = ap.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    sys.exit(main())

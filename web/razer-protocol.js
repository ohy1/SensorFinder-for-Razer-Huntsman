/*
 * Razer Huntsman analog protocol helpers shared by the web UI and the Node tests.
 *
 * Protocol references (reverse-engineered by others, see README):
 *   - janeblower/easyrazer docs/en/devices/*  (depth stream, control packet, key assignment)
 *   - AnalogSense/JavaScript-SDK              (WebHID depth stream parsing)
 *   - cidious/razer-analog-linux              (report 07 parsing on Linux)
 *
 * Loaded as a classic <script> (works from file://) and as a CommonJS module in Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RazerProtocol = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VENDOR_RAZER = 0x1532;

  // Depth stream format and threshold scale per firmware family.
  //   v2: report 0x07, entries [fwID, depth:u8]; depth/threshold 0..255 = 1.5..3.6 mm.
  //   v3: report 0x0B, entries [fwID, depth:u16 BE]; 1638 = 0.1 mm, below 0.1 mm reads 0.
  //       Key-assignment thresholds (02:12/02:92) are the high byte of that u16.
  const FAMILIES = {
    v2: {
      depthReportId: 0x07,
      entrySize: 2,
      rawMax: 0xff,
      rawToMm: (raw) => 1.5 + (raw / 255) * 2.1,
      thresholdToMm: (t) => 1.5 + (t / 255) * 2.1,
      mmToThreshold: (mm) => clamp(Math.round(((mm - 1.5) / 2.1) * 255), 0, 255),
      thresholdRangeMm: [1.5, 3.6],
    },
    v3: {
      depthReportId: 0x0b,
      entrySize: 3,
      rawMax: 0xffff,
      rawToMm: (raw) => raw / 16380,
      thresholdToMm: (t) => (t * 256) / 16380,
      mmToThreshold: (mm) => clamp(Math.round((mm * 16380) / 256), 1, 255),
      thresholdRangeMm: [0.1, 4.0],
    },
  };

  const MODELS = {
    0x0266: { name: 'Huntsman V2 Analog', family: 'v2' },
    0x0282: { name: 'Huntsman Mini Analog', family: 'v2' },
    0x02a6: { name: 'Huntsman V3 Pro', family: 'v3' },
    0x02a7: { name: 'Huntsman V3 Pro TKL', family: 'v3' },
    0x02b0: { name: 'Huntsman V3 Pro Mini', family: 'v3' },
    0x02cf: { name: 'Huntsman V3 Pro 8KHz', family: 'v3' },
    0x02d0: { name: 'Huntsman V3 Pro TKL 8KHz', family: 'v3' },
    0x02d8: { name: 'Huntsman Signature Edition', family: 'v3' },
    0x02e5: { name: 'Huntsman V3 TKL 8KHz', family: 'v3' },
    0x02e6: { name: 'Huntsman V3 Pro Low-profile TKL 8KHz', family: 'v3' },
  };

  // fwID = AT-101 positional key number used by Razer firmware.
  const KEY_NAMES = {
    1: '`', 2: '1', 3: '2', 4: '3', 5: '4', 6: '5', 7: '6', 8: '7', 9: '8', 10: '9', 11: '0',
    12: '-', 13: '=', 14: '¥', 15: 'Backspace', 16: 'Tab',
    17: 'Q', 18: 'W', 19: 'E', 20: 'R', 21: 'T', 22: 'Y', 23: 'U', 24: 'I', 25: 'O', 26: 'P',
    27: '[', 28: ']', 29: '\\', 30: 'Caps Lock',
    31: 'A', 32: 'S', 33: 'D', 34: 'F', 35: 'G', 36: 'H', 37: 'J', 38: 'K', 39: 'L',
    40: ';', 41: "'", 42: 'ISO #', 43: 'Enter', 44: 'L Shift', 45: 'ISO \\',
    46: 'Z', 47: 'X', 48: 'C', 49: 'V', 50: 'B', 51: 'N', 52: 'M', 53: ',', 54: '.', 55: '/',
    56: 'Ro', 57: 'R Shift', 58: 'L Ctrl', 59: 'Fn', 60: 'L Alt', 61: 'Space', 62: 'R Alt',
    64: 'R Ctrl', 75: 'Insert', 76: 'Delete', 79: '←', 80: 'Home', 81: 'End', 83: '↑', 84: '↓',
    85: 'Page Up', 86: 'Page Down', 89: '→', 90: 'Num Lock', 91: 'Num 7', 92: 'Num 4', 93: 'Num 1',
    95: 'Num /', 96: 'Num 8', 97: 'Num 5', 98: 'Num 2', 99: 'Num 0', 100: 'Num *', 101: 'Num 9',
    102: 'Num 6', 103: 'Num 3', 104: 'Num .', 105: 'Num -', 106: 'Num +', 107: 'Num =',
    108: 'Num Enter', 110: 'Esc', 112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6',
    118: 'F7', 119: 'F8', 120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12', 124: 'PrtSc',
    125: 'Scroll Lock', 126: 'Pause', 127: 'Win', 129: 'Menu', 150: '무변환', 151: '가나',
    152: '한자', 153: '한/영', 154: '변환',
  };

  // Shorter captions for the keyboard map where the full name does not fit a 1u key.
  const SHORT_NAMES = {
    15: 'Bksp', 30: 'Caps', 85: 'PgUp', 86: 'PgDn', 90: 'Num', 108: 'Ent', 124: 'PrtSc', 125: 'ScrLk',
    75: 'Ins', 76: 'Del', 91: '7', 92: '4', 93: '1', 95: '/', 96: '8', 97: '5', 98: '2', 99: '0',
    100: '*', 101: '9', 102: '6', 103: '3', 104: '.', 105: '-', 106: '+',
  };

  const WIN_KEY = 127;

  function keyName(id) {
    return KEY_NAMES[id] || `ID ${id}`;
  }

  function shortKeyName(id) {
    return SHORT_NAMES[id] || keyName(id);
  }

  // Full-size ANSI layout: rows of [fwID, width, height?]; a null fwID is a gap.
  const LAYOUT_ROWS = [
    [[110, 1], [null, 1], [112, 1], [113, 1], [114, 1], [115, 1], [null, 0.5], [116, 1], [117, 1],
      [118, 1], [119, 1], [null, 0.5], [120, 1], [121, 1], [122, 1], [123, 1], [null, 0.25],
      [124, 1], [125, 1], [126, 1]],
    [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1],
      [12, 1], [13, 1], [15, 2], [null, 0.25], [75, 1], [80, 1], [85, 1], [null, 0.25],
      [90, 1], [95, 1], [100, 1], [105, 1]],
    [[16, 1.5], [17, 1], [18, 1], [19, 1], [20, 1], [21, 1], [22, 1], [23, 1], [24, 1], [25, 1],
      [26, 1], [27, 1], [28, 1], [29, 1.5], [null, 0.25], [76, 1], [81, 1], [86, 1], [null, 0.25],
      [91, 1], [96, 1], [101, 1], [106, 1, 2]],
    [[30, 1.75], [31, 1], [32, 1], [33, 1], [34, 1], [35, 1], [36, 1], [37, 1], [38, 1], [39, 1],
      [40, 1], [41, 1], [43, 2.25], [null, 3.5], [92, 1], [97, 1], [102, 1]],
    [[44, 2.25], [46, 1], [47, 1], [48, 1], [49, 1], [50, 1], [51, 1], [52, 1], [53, 1], [54, 1],
      [55, 1], [57, 2.75], [null, 1.25], [83, 1], [null, 1.25], [93, 1], [98, 1], [103, 1],
      [108, 1, 2]],
    [[58, 1.25], [127, 1.25], [60, 1.25], [61, 6.25], [62, 1.25], [59, 1.25], [129, 1.25],
      [64, 1.25], [null, 0.25], [79, 1], [84, 1], [89, 1], [null, 0.25], [99, 2], [104, 1]],
  ];
  // The function row sits a little apart from the rest, as on the real board.
  const ROW_Y = [0, 1.25, 2.25, 3.25, 4.25, 5.25];

  /** Absolute key rectangles in key units: [{id, x, y, w, h}]. */
  function layoutKeys() {
    const out = [];
    LAYOUT_ROWS.forEach((row, r) => {
      let x = 0;
      for (const [id, w, h] of row) {
        if (id !== null) out.push({ id, x, y: ROW_Y[r], w, h: h || 1 });
        x += w;
      }
    });
    return out;
  }

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function familyOf(productId, reportId) {
    const m = MODELS[productId];
    if (m) return m.family;
    // Unknown PID: guess from the report ID the device actually sends.
    if (reportId === FAMILIES.v2.depthReportId) return 'v2';
    if (reportId === FAMILIES.v3.depthReportId) return 'v3';
    return null;
  }

  /**
   * Parses one depth-stream input report payload (without the report ID byte).
   * Returns [{id, raw}] for every key currently past the firmware's report floor;
   * an empty list means every key is released.
   */
  function parseDepthReport(family, data) {
    const f = FAMILIES[family];
    const bytes = toBytes(data);
    const keys = [];
    for (let i = 0; i + f.entrySize <= bytes.length; i += f.entrySize) {
      const id = bytes[i];
      if (id === 0) break;
      const raw = f.entrySize === 2 ? bytes[i + 1] : (bytes[i + 1] << 8) | bytes[i + 2];
      keys.push({ id, raw });
    }
    return keys;
  }

  function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (typeof DataView !== 'undefined' && data instanceof DataView) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    return Uint8Array.from(data);
  }

  /**
   * Tracks per-key live depth, peaks and "touch" events (a key leaving rest and coming back).
   * A touch starts when raw > noiseFloor and ends when the key drops out of the stream
   * or falls to <= noiseFloor.
   */
  class DepthTracker {
    constructor({ noiseFloor = 0, maxEvents = 1000 } = {}) {
      this.noiseFloor = noiseFloor;
      this.maxEvents = maxEvents;
      this.reset();
    }

    reset() {
      this.live = new Map(); // id -> raw
      this.stats = new Map(); // id -> {peak, touches, totalMs, firstSeen, lastSeen}
      this.open = new Map(); // id -> {id, start, peak}
      this.events = []; // finished touches, newest last
      this.reports = 0;
    }

    /** Feeds one parsed report; `t` is a timestamp in ms. Returns ids whose touch just ended. */
    update(keys, t) {
      this.reports++;
      const seen = new Set();
      const ended = [];
      for (const { id, raw } of keys) {
        if (raw <= this.noiseFloor) continue;
        seen.add(id);
        this.live.set(id, raw);
        let s = this.stats.get(id);
        if (!s) {
          s = { peak: 0, touches: 0, totalMs: 0, firstSeen: t, lastSeen: t };
          this.stats.set(id, s);
        }
        s.peak = Math.max(s.peak, raw);
        s.lastSeen = t;
        let o = this.open.get(id);
        if (!o) {
          o = { id, start: t, peak: 0 };
          this.open.set(id, o);
          s.touches++;
        }
        o.peak = Math.max(o.peak, raw);
      }
      for (const id of [...this.open.keys()]) {
        if (!seen.has(id)) {
          this._close(id, t);
          ended.push(id);
        }
      }
      return ended;
    }

    _close(id, t) {
      const o = this.open.get(id);
      this.open.delete(id);
      this.live.delete(id);
      const ev = { id, start: o.start, end: t, durationMs: t - o.start, peak: o.peak };
      this.stats.get(id).totalMs += ev.durationMs;
      this.events.push(ev);
      if (this.events.length > this.maxEvents) this.events.shift();
    }

    /** Keys ranked by how often / how deep they were touched. */
    ranking() {
      return [...this.stats.entries()]
        .map(([id, s]) => ({ id, ...s, live: this.live.get(id) || 0 }))
        .sort((a, b) => b.touches - a.touches || b.peak - a.peak);
    }
  }

  // ---- Control channel: 90-byte feature report on the control interface (MI_03) ----

  const PACKET_LEN = 90;
  const STATUS = { 0: 'new', 1: 'busy', 2: 'ok', 3: 'fail', 4: 'timeout', 5: 'not supported' };
  const TRANSACTION_ID = 0x1f;

  function buildPacket(cls, cmd, size, args = [], tid = TRANSACTION_ID) {
    if (args.length > 80) throw new Error('args too long');
    const p = new Uint8Array(PACKET_LEN);
    p[1] = tid;
    p[5] = size;
    p[6] = cls;
    p[7] = cmd;
    p.set(args, 8);
    p[88] = crc(p);
    return p;
  }

  function crc(p) {
    let c = 0;
    for (let i = 2; i < 88; i++) c ^= p[i];
    return c;
  }

  /**
   * Parses a feature-report reply. Some stacks return the report ID byte first (91 bytes),
   * so the packet is located by the echoed command.
   */
  function parseReply(data, cls, cmd) {
    const bytes = toBytes(data);
    for (const off of [0, 1]) {
      const p = bytes.subarray(off, off + PACKET_LEN);
      if (p.length === PACKET_LEN && p[6] === cls && p[7] === cmd) {
        return {
          status: p[0],
          statusText: STATUS[p[0]] || `0x${p[0].toString(16)}`,
          size: p[5],
          args: p.slice(8, 88),
          crcOk: crc(p) === p[88],
        };
      }
    }
    return null;
  }

  // 02:92 get / 02:12 set key assignment: [profile, fwID, layer, thrL, thrH, fnId, fnSize, fnData...]
  // thrL = actuation (press) point, thrH = release point.
  const KEY_ASSIGNMENT = { cls: 0x02, get: 0x92, set: 0x12, size: 80 };
  const ACTIVE_PROFILE = { cls: 0x05, get: 0x84 };

  function getKeyAssignmentPacket(profile, key, layer = 0) {
    return buildPacket(KEY_ASSIGNMENT.cls, KEY_ASSIGNMENT.get, KEY_ASSIGNMENT.size, [profile, key, layer]);
  }

  function parseKeyAssignment(args) {
    const a = toBytes(args);
    if (a.length < 7) return null;
    const fnSize = a[6];
    return {
      profile: a[0], key: a[1], layer: a[2], thrL: a[3], thrH: a[4], fnId: a[5],
      fnData: Array.from(a.slice(7, 7 + fnSize)),
    };
  }

  function setKeyAssignmentPacket(a) {
    const args = [a.profile, a.key, a.layer, a.thrL, a.thrH, a.fnId, a.fnData.length, ...a.fnData];
    return buildPacket(KEY_ASSIGNMENT.cls, KEY_ASSIGNMENT.set, KEY_ASSIGNMENT.size, args);
  }

  /**
   * Returns a copy of `a` with a new actuation point. The release point keeps its value
   * unless it would no longer sit below the actuation point (V2 firmware wants >= 10 units).
   */
  function withActuation(a, thrL) {
    const out = { ...a, fnData: [...a.fnData], thrL };
    const gap = 10;
    if (out.thrH > thrL - gap) out.thrH = Math.max(0, thrL - gap);
    return out;
  }

  function hex(bytes) {
    return Array.from(toBytes(bytes), (b) => b.toString(16).padStart(2, '0')).join(' ');
  }

  return {
    VENDOR_RAZER, FAMILIES, MODELS, KEY_NAMES, WIN_KEY, LAYOUT_ROWS,
    keyName, shortKeyName, layoutKeys, familyOf, parseDepthReport, DepthTracker,
    PACKET_LEN, TRANSACTION_ID, KEY_ASSIGNMENT, ACTIVE_PROFILE, buildPacket, crc, parseReply,
    getKeyAssignmentPacket, parseKeyAssignment, setKeyAssignmentPacket, withActuation, hex,
  };
});

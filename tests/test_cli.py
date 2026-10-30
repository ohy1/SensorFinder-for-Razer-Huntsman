# Run with: python -m unittest discover tests
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "python"))

import sensorfinder as rs  # noqa: E402


class DepthTests(unittest.TestCase):
    def test_v2_pairs(self):
        self.assertEqual(rs.parse_depth_report(rs.V2, bytes([31, 0x40, 32, 2, 0, 0])), [(31, 0x40), (32, 2)])

    def test_v3_u16_be(self):
        data = bytes([127, 0x06, 0x66, 61, 0xFF, 0xF0]) + bytes(40)
        self.assertEqual(rs.parse_depth_report(rs.V3, data), [(127, 0x0666), (61, 0xFFF0)])
        self.assertAlmostEqual(rs.V3.raw_to_mm(0x0666), 0.1, places=3)

    def test_tracker(self):
        t = rs.Tracker()
        t.update([(127, 3)], 0.0)
        t.update([(127, 9)], 0.01)
        ended = t.update([], 0.03)
        self.assertEqual([(e.key, e.peak) for e in ended], [(127, 9)])
        self.assertAlmostEqual(ended[0].end - ended[0].start, 0.03)
        t.update([(127, 1)], 0.05)
        self.assertEqual(t.touches[127], 2)


class ControlTests(unittest.TestCase):
    def test_packet_matches_js(self):
        p = rs.build_packet(0x02, 0x92, 80, [0, 127, 0])
        self.assertEqual(len(p), 90)
        self.assertEqual(list(p[:11]), [0, 0x1F, 0, 0, 0, 80, 0x02, 0x92, 0, 127, 0])
        self.assertEqual(p[88], 80 ^ 0x02 ^ 0x92 ^ 127)

    def test_reply_and_assignment(self):
        reply = bytearray(rs.build_packet(0x02, 0x92, 80, [3, 0x1F, 0, 0x8F, 0x6F, 0x02, 0x02, 0x00, 0x04]))
        reply[0] = 2
        for data in (bytes(reply), b"\x00" + bytes(reply)):
            status, args = rs.parse_reply(data, 0x02, 0x92)
            self.assertEqual(status, 2)
            a = rs.KeyAssignment.parse(args)
            self.assertEqual((a.profile, a.key, a.thr_l, a.thr_h, a.fn_id, a.fn_data), (3, 31, 0x8F, 0x6F, 2, b"\x00\x04"))
            self.assertEqual(a.to_args(), bytes([3, 0x1F, 0, 0x8F, 0x6F, 0x02, 0x02, 0x00, 0x04]))

    def test_with_actuation(self):
        a = rs.KeyAssignment(0, 127, 0, 77, 150, 2, b"\x08\x00")
        b = a.with_actuation(rs.V3.mm_to_threshold(3.0))
        self.assertEqual((b.thr_l, b.thr_h, b.fn_data), (192, 150, b"\x08\x00"))
        self.assertEqual(a.with_actuation(100).thr_h, 90)
        v2 = rs.KeyAssignment(0, 31, 0, 0, 0, 2, b"\x00\x04")  # what Synapse stores on V2
        self.assertEqual(v2.with_actuation(61, None, 10, 5).thr_h, 5)
        with self.assertRaises(ValueError):
            v2.with_actuation(61, 4, 10, 5)
        c = a.with_actuation(rs.V3.mm_to_threshold(2.7), rs.V3.mm_to_threshold(2.5), rs.V3.min_release_gap)
        self.assertEqual((c.thr_l, c.thr_h), (173, 160))
        with self.assertRaises(ValueError):
            a.with_actuation(173, 170, rs.V3.min_release_gap)

    def test_scales_match_js(self):
        self.assertEqual(rs.V3.mm_to_threshold(1.2), 77)
        self.assertEqual(rs.V3.mm_to_threshold(4.0), 255)
        self.assertEqual(rs.V3.mm_to_threshold(0.0), 1)
        self.assertEqual(rs.V2.mm_to_threshold(2.4), 109)
        for tenth in range(1, 41):
            mm = tenth / 10
            self.assertEqual(round(rs.V3.threshold_to_mm(rs.V3.mm_to_threshold(mm)), 1), mm)

    def test_safety_allowlist(self):
        rng = rs.write_range(0x02CF)
        rs.check_packet(rs.build_packet(0x02, 0x92, 80, [0, 127, 0]), rs.V3)
        rs.check_packet(rs.build_packet(0x00, 0x84, 2), rs.V3)
        ok = rs.KeyAssignment(1, 127, 0, 173, 160, 2, b"\x08\x00")
        rs.check_packet(rs.build_packet(0x02, 0x12, 80, ok.to_args()), rs.V3, rng)
        with self.assertRaises(rs.SafetyError):  # writes need a known model
            rs.check_packet(rs.build_packet(0x02, 0x12, 80, ok.to_args()), rs.V3, None)
        for cls, cmd, args in [(0x00, 0x04, [1, 0]), (0xFE, 0x28, []), (0x06, 0x09, []), (0x0F, 0x02, [])]:
            with self.assertRaises(rs.SafetyError):
                rs.check_packet(rs.build_packet(cls, cmd, len(args), args), rs.V3)
        for bad in (rs.KeyAssignment(1, 127, 1, 173, 160, 2, b""), rs.KeyAssignment(7, 127, 0, 173, 160, 2, b""),
                    rs.KeyAssignment(1, 200, 0, 173, 160, 2, b""), rs.KeyAssignment(1, 127, 0, 173, 170, 2, b""),
                    rs.KeyAssignment(1, 127, 0, 3, 0, 2, b"")):
            with self.assertRaises(rs.SafetyError):
                rs.check_packet(rs.build_packet(0x02, 0x12, 80, bad.to_args()), rs.V3, rng)

    def test_write_ranges(self):
        self.assertEqual(rs.write_range(0x0266), (15, 250))
        self.assertEqual(rs.write_range(0x02CF), (6, 255))
        self.assertEqual(rs.write_range(0x02E6), (6, 179))  # 2.8 mm low-profile switches
        self.assertIsNone(rs.write_range(0x0999))
        for pid, lo, hi in ((0x0266, "1.62", "3.56"), (0x02CF, "0.1", "4.0"), (0x02E6, "0.1", "2.8")):
            _, fam, _ = rs.MODELS[pid]
            rng = rs.write_range(pid)
            self.assertEqual((rs.mm_bound(fam, rng, rng[0]), rs.mm_bound(fam, rng, rng[1])), (lo, hi))

    def test_key_lookup(self):
        self.assertEqual(rs.key_id("win"), 127)
        self.assertEqual(rs.key_id("127"), 127)
        for bad in ("300", "0", "nope"):
            with self.assertRaises(SystemExit):
                rs.key_id(bad)



class FakeHid:
    """Minimal stand-in for the hidapi module: one keyboard with a depth and a control interface."""

    def __init__(self, pid=0x02CF, mode=3, answer_mode=True, fail_after_write=False, extra=()):
        self.pid, self.mode, self.answer_mode, self.fail_after_write = pid, mode, answer_mode, fail_after_write
        self.store, self.writes, self.reports, self.write_paths = {}, [], [], []
        self.infos = [
            {"product_id": pid, "interface_number": 1, "usage_page": 0x01, "usage": 0x06, "path": b"kbd"},
            {"product_id": pid, "interface_number": 1, "usage_page": 0x01, "usage": 0x00, "path": b"depth"},
            {"product_id": pid, "interface_number": 3, "usage_page": 0x0C, "usage": 0x01, "path": b"ctl"},
            *extra,
        ]
        fake = self

        class Device:
            def open_path(self, path):
                self.path = path
                self.reply = None

            def set_nonblocking(self, v):
                pass

            def read(self, n):
                if self.path == b"kbd":
                    raise OSError("read error")  # Windows: OS-owned collection opened with no access
                return fake.reports.pop(0) if fake.reports else []

            def send_feature_report(self, data):
                p = bytearray(data[1:])
                cls, cmd = p[6], p[7]
                r = bytearray(p)
                r[0] = 2
                if (cls, cmd) == (0x00, 0x84):
                    if not fake.answer_mode:
                        self.reply = bytes(91)  # someone else's reply stays in the buffer
                        return len(data)
                    r[8] = fake.mode
                elif (cls, cmd) == (0x02, 0x92):
                    if fake.fail_after_write and fake.writes:
                        self.reply = bytes(91)
                        return len(data)
                    r[8:17] = bytes(fake.store.get((p[8], p[9]), [p[8], p[9], 0, 76, 70, 2, 2, 0, 4]))
                elif (cls, cmd) == (0x02, 0x12):
                    fake.writes.append(bytes(p[8:8 + 7 + p[14]]))
                    fake.write_paths.append(self.path)
                    fake.store[(p[8], p[9])] = list(p[8:8 + 7 + p[14]])
                self.reply = b"\x00" + bytes(r)
                return len(data)

            def get_feature_report(self, rid, n):
                return list(self.reply)

        self.device = Device

    def enumerate(self, vid, pid):
        return self.infos


class CliScenarioTests(unittest.TestCase):
    def run_cli(self, fake, argv, answers=(), sleep=lambda s: None, on_ask=lambda q: None):
        import builtins, io, contextlib, types
        answers = list(answers)

        def fake_input(q):
            on_ask(q)
            if not answers:
                raise EOFError
            return answers.pop(0)

        out = io.StringIO()
        old_hid, old_input, old_time = rs._hid, builtins.input, rs.time
        # Replace only the module's view of `time`, never the real time.sleep.
        rs._hid, builtins.input = (lambda: fake), fake_input
        rs.time = types.SimpleNamespace(sleep=sleep, perf_counter=old_time.perf_counter)
        code = 0
        try:
            with contextlib.redirect_stdout(out):
                rs.main(argv)
        except SystemExit as e:
            code = e.code
        finally:
            rs._hid, builtins.input, rs.time = old_hid, old_input, old_time
        return code, out.getvalue()

    def test_synapse_unknown_mode_still_asks(self):
        fake = FakeHid(answer_mode=False)
        code, out = self.run_cli(fake, ["set-key", "--mm", "2.0"], answers=["n"])
        self.assertIn("Could not read the device mode", out)
        self.assertEqual(code, "aborted, nothing written")
        self.assertEqual(fake.writes, [])

    def test_closed_stdin_means_no(self):
        fake = FakeHid(mode=3)
        code, _ = self.run_cli(fake, ["set-key", "--mm", "2.0"])
        self.assertEqual(code, "aborted, nothing written")
        self.assertEqual(fake.writes, [])

    def test_yes_still_prints_the_warning_and_writes(self):
        fake = FakeHid(mode=3)
        code, out = self.run_cli(fake, ["set-key", "--mm", "2.7", "--release-mm", "2.5", "--yes"])
        self.assertIn("appears to be running", out)
        self.assertEqual(code, 0)
        self.assertEqual(fake.writes[0][3:5], bytes([173, 160]))

    def test_before_values_printed_even_if_verify_fails(self):
        fake = FakeHid(mode=0, fail_after_write=True)
        code, out = self.run_cli(fake, ["set-key", "--mm", "2.7"])
        self.assertTrue(fake.writes)
        self.assertIn("before:", out)
        self.assertIn("--profile 0 --mm 1.19 --release-mm 1.09", out)
        self.assertIn("may already have been applied", out)
        self.assertNotEqual(code, 0)

    def test_low_profile_range(self):
        fake = FakeHid(pid=0x02E6, mode=0)
        code, _ = self.run_cli(fake, ["set-key", "--mm", "3.5"])
        self.assertIn("0.1..2.8", str(code))
        self.assertEqual(fake.writes, [])

    def test_out_of_range_is_refused_not_clamped(self):
        for argv in (["set-key", "--mm", "5.0"], ["set-key", "--mm", "1e308"], ["set-key", "--mm", "2", "--release-mm", "1e308"]):
            fake = FakeHid(mode=0)
            code, _ = self.run_cli(fake, argv)
            self.assertIsInstance(code, str, argv)
            self.assertEqual(fake.writes, [], argv)

    def test_v2_release_floor_message(self):
        fake = FakeHid(pid=0x0266, mode=0)
        code, _ = self.run_cli(fake, ["set-key", "--mm", "2.0", "--release-mm", "1.5"])
        self.assertIn("cannot be shallower than 1.54", str(code))
        fake = FakeHid(pid=0x0266, mode=0)
        code, out = self.run_cli(fake, ["set-key", "--mm", "1.62", "--release-mm", "1.54", "--yes"])
        self.assertEqual(code, 0, out)
        self.assertEqual(fake.writes[0][3:5], bytes([15, 5]))  # the floor itself is accepted

    def test_restore_command_round_trips_on_v2(self):
        for thr in range(256):
            self.assertEqual(rs.V2.mm_to_threshold(float(rs.mm_exact(rs.V2, thr))), thr)
            self.assertEqual(rs.V3.mm_to_threshold(float(rs.mm_exact(rs.V3, thr))) if thr else 1, thr if thr else 1)

    def test_slot_profile_is_explicit(self):
        fake = FakeHid(mode=0)
        code, out = self.run_cli(fake, ["set-key", "--mm", "2.7", "--profile", "2", "--yes"])
        self.assertEqual(code, 0, out)
        self.assertEqual(fake.writes[0][0], 2)
        self.assertIn("--profile 2 ", out)

    def test_unrestorable_original_asks(self):
        fake = FakeHid(mode=0)
        fake.store[(0, 127)] = [0, 127, 0, 76, 75, 2, 2, 0, 4]  # 1 unit apart: outside the release gap
        code, out = self.run_cli(fake, ["set-key", "--mm", "2.0"], answers=["n"])
        self.assertIn("cannot write these original values back", out)
        self.assertEqual(code, "aborted, nothing written")
        self.assertEqual(fake.writes, [])

    def test_v3_maximum_is_accepted(self):
        for pid, mm, thr in ((0x02CF, "4.0", 255), (0x02CF, "3.99", 255), (0x02CF, "0.1", 6), (0x02E6, "2.8", 179)):
            fake = FakeHid(pid=pid, mode=0)
            code, out = self.run_cli(fake, ["set-key", "--mm", mm, "--yes"])
            self.assertEqual(code, 0, (pid, mm, out))
            self.assertEqual(fake.writes[0][3], thr)
        for pid, mm in ((0x02CF, "4.01"), (0x02CF, "0.05"), (0x02E6, "2.81"), (0x0266, "3.57"), (0x0266, "1.6")):
            fake = FakeHid(pid=pid, mode=0)
            code, _ = self.run_cli(fake, ["set-key", "--mm", mm, "--yes"])
            self.assertIn("--mm must be within", str(code), (pid, mm))
            self.assertEqual(fake.writes, [])

    def test_tiny_release_on_v3_is_zero_not_a_crash(self):
        fake = FakeHid(mode=0)
        code, out = self.run_cli(fake, ["set-key", "--mm", "0.1", "--release-mm", "0.005", "--yes"])
        self.assertEqual(code, 0, out)
        self.assertEqual(fake.writes[0][3:5], bytes([6, 0]))

    def test_every_printed_restore_command_is_accepted(self):
        import re
        for pid in (0x0266, 0x02CF, 0x02E6):
            _, fam, _ = rs.MODELS[pid]
            rng = rs.write_range(pid)
            for thr_l in range(rng[0], rng[1] + 1, 7):
                for thr_h in sorted({fam.min_release, (fam.min_release + thr_l - fam.min_release_gap) // 2, thr_l - fam.min_release_gap}):
                    fake = FakeHid(pid=pid, mode=0)
                    fake.store[(0, 127)] = [0, 127, 0, thr_l, thr_h, 2, 2, 0, 4]
                    cmd = rs._restore_command(fam, rs.KeyAssignment(0, 127, 0, thr_l, thr_h, 2, b"\x00\x04"), pid)
                    argv = ["set-key"] + cmd.split(" set-key ", 1)[1].split()
                    fake.store[(0, 127)] = [0, 127, 0, 77 if thr_l != 77 else 78, 5, 2, 2, 0, 4]
                    code, out = self.run_cli(fake, argv + ["--yes"])
                    self.assertEqual(code, 0, (pid, thr_l, thr_h, cmd, out))
                    self.assertEqual(fake.writes[-1][3:5], bytes([thr_l, thr_h]), (pid, cmd))
        self.assertEqual(rs.mm_exact(rs.V2, 144), "2.686")  # 2.69 sits exactly on a half unit

    def test_unknown_mode_byte_asks(self):
        for mode in (1, 2):
            fake = FakeHid(mode=mode)
            code, out = self.run_cli(fake, ["set-key", "--mm", "2.0"], answers=["n"])
            self.assertIn("Could not read the device mode", out)
            self.assertEqual(fake.writes, [])

    def test_zero_original_asks_before_anything_else(self):
        fake = FakeHid(pid=0x0266, mode=0)
        fake.store[(1, 31)] = [1, 31, 0, 0, 0, 2, 2, 0, 4]  # what Synapse stores on V2
        code, out = self.run_cli(fake, ["set-key", "--key", "A", "--profile", "1", "--mm", "2.0"], answers=["n"])
        self.assertIn("cannot write these original values back", out)
        self.assertNotIn("flash slot", out.split("cannot write")[0].split("before:")[0])
        self.assertEqual(code, "aborted, nothing written")
        self.assertEqual(fake.writes, [])

    def test_changed_between_read_and_write_is_refused(self):
        fake = FakeHid(mode=3)
        code, out = self.run_cli(fake, ["set-key", "--mm", "2.0"], answers=["y"])
        self.assertEqual(code, 0, out)  # unchanged while asking: written

        fake = FakeHid(mode=3)

        def synapse_changes_it(q):
            fake.store[(0, 127)] = [0, 127, 0, 100, 90, 2, 2, 0, 4]

        code, out = self.run_cli(fake, ["set-key", "--mm", "2.0"], answers=["y"], on_ask=synapse_changes_it)
        self.assertIn("changed since it was read", str(code))
        self.assertEqual(fake.writes, [])

    def test_negative_release_is_refused(self):
        for pid in (0x02CF, 0x0266):
            fake = FakeHid(pid=pid, mode=0)
            code, _ = self.run_cli(fake, ["set-key", "--mm", "2.0", "--release-mm", "-0.1", "--yes"])
            self.assertIn("cannot be shallower than", str(code), hex(pid))
            self.assertEqual(fake.writes, [])
        fake = FakeHid(mode=0)
        code, out = self.run_cli(fake, ["set-key", "--mm", "2.0", "--release-mm", "0", "--yes"])
        self.assertEqual(code, 0, out)  # exactly 0 is a valid V3 release
        self.assertEqual(fake.writes[0][4], 0)

    def test_gap_error_names_the_actuation_written(self):
        code, _ = self.run_cli(FakeHid(mode=0), ["set-key", "--mm", "4.0", "--release-mm", "3.9", "--yes"])
        self.assertIn("3.99 mm as written", str(code))  # 4.0 is threshold 255 = 3.985 mm

    def test_halves_round_like_the_web_page(self):
        self.assertEqual(rs.V2.mm_to_units(2.69), 144.5)
        self.assertEqual(rs.V2.mm_to_threshold(2.69), 145)  # Math.round in the page gives 145 too
        self.assertEqual(rs.V2.mm_to_release(2.69), 145)

    def test_two_units_block_set_key(self):
        second = [{"product_id": 0x02CF, "interface_number": 1, "usage_page": 0x01, "usage": 0x00, "path": b"depth2"},
                  {"product_id": 0x02CF, "interface_number": 3, "usage_page": 0x0C, "usage": 0x01, "path": b"ctl2"}]
        fake = FakeHid(mode=0, extra=second)
        code, _ = self.run_cli(fake, ["set-key", "--mm", "2.0", "--yes"])
        self.assertIn("cannot tell them apart", str(code))
        self.assertEqual(fake.writes, [])
        code, out = self.run_cli(FakeHid(mode=0, extra=second), ["get-key"])
        self.assertEqual(code, 0, out)
        self.assertIn("two or more", out)

    def test_unknown_key_refused_before_anything(self):
        fake = FakeHid(mode=0)
        code, out = self.run_cli(fake, ["set-key", "--key", "63", "--mm", "2.0", "--yes"])
        self.assertIn("not a key this tool writes", str(code))
        self.assertNotIn("may already have been applied", out)
        self.assertNotIn("before:", out)
        self.assertEqual(fake.writes, [])

    def test_two_models_need_a_choice(self):
        other = [{"product_id": 0x02A7, "interface_number": 3, "usage_page": 0x0C, "usage": 0x01, "path": b"tkl-ctl"}]
        fake = FakeHid(mode=0, extra=other)
        code, _ = self.run_cli(fake, ["set-key", "--mm", "2.0", "--yes"])
        self.assertIn("choose one with --pid", str(code))
        self.assertEqual(fake.writes, [])
        fake = FakeHid(mode=0, extra=other)
        code, out = self.run_cli(fake, ["set-key", "--pid", "02CF", "--mm", "2.0", "--yes"])
        self.assertEqual(code, 0, out)
        self.assertIn("keyboard: Razer Huntsman V3 Pro 8KHz (PID 02CF)", out)
        self.assertIn("set-key --pid 02CF --key 127", out)  # the restore command names the model
        code, out = self.run_cli(FakeHid(mode=0, extra=other), ["get-key"])
        self.assertEqual(code, 0, out)
        self.assertIn("several Razer keyboards", out)
        # The model named by --pid gets the write, also when it is not the first one listed.
        fake = FakeHid(mode=0, extra=other)
        code, out = self.run_cli(fake, ["set-key", "--pid", "02A7", "--mm", "2.0", "--yes"])
        self.assertEqual(code, 0, out)
        self.assertEqual(fake.write_paths, [b"tkl-ctl"])
        self.assertIn("Huntsman V3 Pro TKL (PID 02A7)", out)

    def test_restore_command_names_the_script_as_run(self):
        import sys
        old_argv = sys.argv[0]
        try:
            sys.argv[0] = "python/sensorfinder.py"
            cmd = rs._restore_command(rs.V3, rs.KeyAssignment(1, 127, 0, 76, 70, 2, b""), 0x02CF)
        finally:
            sys.argv[0] = old_argv
        self.assertIn(" python/sensorfinder.py set-key --pid 02CF --key 127 --profile 1", cmd)

    def test_interpreter_runs_the_same_python(self):
        cases = [
            # (sys.executable, where its name resolves on PATH, windows, expected)
            ("/usr/bin/python3", "/usr/bin/python3", False, "python3"),
            ("/home/u/.venv/bin/python", "/usr/bin/python", False, "/home/u/.venv/bin/python"),  # venv by path
            ("/home/u/.venv/bin/python3", None, False, "/home/u/.venv/bin/python3"),
            ("/home/u/my env/bin/python", None, False, "'/home/u/my env/bin/python'"),
            ("C:\\Python312\\python.exe", "c:\\python312\\python.exe", True, "python"),
            ("C:\\Python312\\python.exe", None, True, "C:\\Python312\\python.exe"),  # started through py
            ("C:\\Program Files\\Python312\\python.exe", None, True, '"C:\\Program Files\\Python312\\python.exe"'),
            ("", None, False, "python"),
        ]
        for exe, found, windows, expected in cases:
            self.assertEqual(rs._interpreter(exe, found, windows), expected, exe)

    def test_nan_rejected(self):
        code, _ = self.run_cli(FakeHid(mode=0), ["set-key", "--mm", "2.0", "--release-mm", "nan"])
        self.assertIn("must be numbers", str(code))

    def test_monitor_skips_os_collections_and_flushes_csv(self):
        import os, tempfile
        fake = FakeHid()
        fake.reports = [[0x0B, 127, 0x40, 0x00] + [0] * 43, [0x0B] + [0] * 46]
        path = os.path.join(tempfile.mkdtemp(), "t.csv")
        calls = {"n": 0}

        def stop_after_reports(s):
            calls["n"] += 1
            if calls["n"] > 5:
                raise KeyboardInterrupt

        code, out = self.run_cli(fake, ["monitor", "--csv", path], sleep=stop_after_reports)
        self.assertEqual(code, 0, out)
        self.assertIn("Win", out)
        with open(path, encoding="utf-8-sig") as f:
            self.assertEqual(len(f.read().strip().splitlines()), 2)


if __name__ == "__main__":
    unittest.main()

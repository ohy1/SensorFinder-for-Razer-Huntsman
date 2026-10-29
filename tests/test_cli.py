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
        rs.check_packet(rs.build_packet(0x02, 0x92, 80, [0, 127, 0]), rs.V3)
        rs.check_packet(rs.build_packet(0x00, 0x84, 2), rs.V3)
        ok = rs.KeyAssignment(1, 127, 0, 173, 160, 2, b"\x08\x00")
        rs.check_packet(rs.build_packet(0x02, 0x12, 80, ok.to_args()), rs.V3)
        for cls, cmd, args in [(0x00, 0x04, [1, 0]), (0xFE, 0x28, []), (0x06, 0x09, []), (0x0F, 0x02, [])]:
            with self.assertRaises(rs.SafetyError):
                rs.check_packet(rs.build_packet(cls, cmd, len(args), args), rs.V3)
        for bad in (rs.KeyAssignment(1, 127, 1, 173, 160, 2, b""), rs.KeyAssignment(7, 127, 0, 173, 160, 2, b""),
                    rs.KeyAssignment(1, 200, 0, 173, 160, 2, b""), rs.KeyAssignment(1, 127, 0, 173, 170, 2, b"")):
            with self.assertRaises(rs.SafetyError):
                rs.check_packet(rs.build_packet(0x02, 0x12, 80, bad.to_args()), rs.V3)

    def test_key_lookup(self):
        self.assertEqual(rs.key_id("win"), 127)
        self.assertEqual(rs.key_id("127"), 127)


if __name__ == "__main__":
    unittest.main()

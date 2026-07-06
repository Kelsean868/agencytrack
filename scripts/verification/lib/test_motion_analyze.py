import unittest
import numpy as np
import motion_analyze as M


def solid(h, w, rgb):
    a = np.zeros((h, w, 3), dtype=np.int16)
    a[:, :] = rgb
    return a


class TestPrimitives(unittest.TestCase):
    def test_region_mean_delta_zero_for_identical(self):
        a = solid(10, 10, (100, 100, 100))
        self.assertEqual(M.region_mean_delta(a, a.copy(), {'x': 0, 'y': 0, 'width': 10, 'height': 10}), 0.0)

    def test_region_mean_delta_counts_change(self):
        a = solid(10, 10, (0, 0, 0))
        b = solid(10, 10, (10, 10, 10))
        self.assertAlmostEqual(M.region_mean_delta(a, b, {'x': 0, 'y': 0, 'width': 10, 'height': 10}), 10.0)

    def test_changed_fraction_region_only(self):
        a = solid(10, 10, (0, 0, 0))
        b = a.copy()
        b[0:5, :, :] = 200  # half changed
        pct = M.region_changed_fraction(a, b, {'x': 0, 'y': 0, 'width': 10, 'height': 10}, thr=20)
        self.assertAlmostEqual(pct, 50.0)

    def test_classify_beacon_green_red_neutral(self):
        box = {'x': 0, 'y': 0, 'width': 8, 'height': 6}
        self.assertEqual(M.classify_beacon(solid(6, 8, (0, 200, 0)), box), 'green')
        self.assertEqual(M.classify_beacon(solid(6, 8, (200, 0, 0)), box), 'red')
        self.assertEqual(M.classify_beacon(solid(6, 8, (0, 0, 0)), box), 'neutral')


class TestMetrics(unittest.TestCase):
    def _frames(self, popin=True):
        # 16 frames, 100x50 @ ~16.7ms/frame. Beacon strip = rows 0..5.
        # Content region = rows 6..49. green f2..f4 (animstart), red f5+ (animend
        # ~83.5ms). Content fades f2..f5. If popin: a big content block paints in
        # at f14 (~234ms) -> ~150ms AFTER animend, comfortably past the 100ms FAIL
        # threshold. If not: content is static after the fade -> gap ~0.
        box_beacon = {'x': 0, 'y': 0, 'width': 100, 'height': 6}
        box_content = {'x': 0, 'y': 6, 'width': 100, 'height': 44}
        frames, tMs = [], []
        for i in range(16):
            f = np.zeros((50, 100, 3), dtype=np.int16)
            if 2 <= i < 5:
                f[0:6, :, :] = (0, 200, 0)
            elif i >= 5:
                f[0:6, :, :] = (200, 0, 0)
            grey = min(120, (i - 2) * 40) if i >= 2 else 0
            f[6:50, :, :] = grey
            if popin and i >= 14:
                f[20:44, :, :] = 220   # late content block paints in
            frames.append(f)
            tMs.append(round(i * 16.7, 1))
        meta = {'role': 'agent', 'case': 'history', 'condition': 'cold',
                'declaredDurationMs': 320.0, 'beaconBox': box_beacon, 'contentBox': box_content,
                'frames': [{'index': i + 1, 'file': f'frame_{i + 1:05d}.jpg', 'tMs': tMs[i]} for i in range(16)]}
        return meta, frames

    def test_window_and_popin_recovered(self):
        meta, frames = self._frames(popin=True)
        m = M.compute_metrics(meta, frames)
        # animation window: green f2 (idx2, 33.4ms) -> red f5 (idx5, 83.5ms)
        self.assertAlmostEqual(m['animEndMs'], 83.5, places=1)
        # content still changing at f14 (~234ms) -> settle after animend -> gap >100ms
        self.assertGreater(m['popinGapMs'], 100.0)
        self.assertGreater(m['lateChangePct'], 5.0)
        self.assertEqual(m['verdict'], 'FAIL')

    def test_clean_transition_passes(self):
        meta, frames = self._frames(popin=False)
        m = M.compute_metrics(meta, frames)
        self.assertLessEqual(m['popinGapMs'], 40.0)
        self.assertEqual(m['verdict'], 'PASS')


if __name__ == '__main__':
    unittest.main()

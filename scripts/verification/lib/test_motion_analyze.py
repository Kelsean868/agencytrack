import os
import json
import tempfile
import unittest
import numpy as np
from PIL import Image as PILImage
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


class TestRun(unittest.TestCase):
    def _write_case(self, case_dir):
        os.makedirs(case_dir, exist_ok=True)
        meta = {'role': 'agent', 'case': 'history', 'condition': 'cold', 'targetLabel': 'History',
                'reducedMotion': False, 'declaredDurationMs': 320.0,
                'viewport': {'width': 100, 'height': 50},
                'beaconBox': {'x': 0, 'y': 0, 'width': 100, 'height': 6},
                'contentBox': {'x': 0, 'y': 6, 'width': 100, 'height': 44}, 'frames': [],
                'animation': {'startPerfMs': 0, 'endPerfMs': 83}, 'longTasks': []}
        for i in range(16):
            f = np.zeros((50, 100, 3), dtype=np.uint8)
            if 2 <= i < 5:
                f[0:6, :, :] = (0, 200, 0)
            elif i >= 5:
                f[0:6, :, :] = (200, 0, 0)
            if i >= 2:
                f[6:50, :, :] = min(120, (i - 2) * 40)
            if i >= 14:
                f[20:44, :, :] = 220
            name = f'frame_{i + 1:05d}.jpg'
            PILImage.fromarray(f, 'RGB').save(os.path.join(case_dir, name), quality=95)
            meta['frames'].append({'index': i + 1, 'file': name, 'tMs': round(i * 16.7, 1)})
        with open(os.path.join(case_dir, 'meta.json'), 'w') as fh:
            json.dump(meta, fh)

    def test_analyze_run_writes_summary(self):
        with tempfile.TemporaryDirectory() as run:
            self._write_case(os.path.join(run, 'agent', 'cold'))
            res = M.analyze_run(run)
            self.assertTrue(os.path.exists(os.path.join(run, 'summary.json')))
            self.assertTrue(os.path.exists(os.path.join(run, 'summary.md')))
            self.assertEqual(len(res['cases']), 1)
            self.assertEqual(res['cases'][0]['verdict'], 'FAIL')
            self.assertTrue(os.path.exists(os.path.join(run, 'agent', 'cold', 'case.json')))


class TestReducedMotion(unittest.TestCase):
    def _meta(self, n):
        return {'role': 'agent', 'case': 'x', 'condition': 'cold', 'reducedMotion': True,
                'beaconBox': {'x': 0, 'y': 0, 'width': 10, 'height': 6},
                'contentBox': {'x': 0, 'y': 6, 'width': 10, 'height': 4},
                'frames': [{'index': i + 1, 'file': f'f{i}', 'tMs': i * 16.0} for i in range(n)]}

    def test_reduced_motion_no_window_passes_even_with_content_change(self):
        # Beacon stays neutral (no animation), but content still loads/changes —
        # that is NOT a motion leak, so it must PASS.
        frames = []
        for i in range(5):
            f = np.zeros((10, 10, 3), dtype=np.int16)
            f[6:10, :, :] = i * 30  # content loading
            frames.append(f)
        m = M.compute_metrics(self._meta(5), frames)
        self.assertEqual(m['verdict'], 'PASS')

    def test_reduced_motion_window_detected_fails(self):
        # A screen-enter window leaked despite reduced motion -> FAIL.
        frames = []
        for i in range(5):
            f = np.zeros((10, 10, 3), dtype=np.int16)
            f[0:6, :, :] = (0, 200, 0) if i < 2 else (200, 0, 0)
            frames.append(f)
        m = M.compute_metrics(self._meta(5), frames)
        self.assertEqual(m['verdict'], 'FAIL')


if __name__ == '__main__':
    unittest.main()

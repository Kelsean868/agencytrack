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


if __name__ == '__main__':
    unittest.main()

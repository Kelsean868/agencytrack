import { describe, test, expect } from 'vitest';
import { POINTS_WEIGHTS } from '../../../lib/gamificationConfig';
import { DISPLAY_MAP } from '../MyPointsCard';

// Drift-guard: every POINTS_WEIGHTS key must have a DISPLAY_MAP entry with label + group.
// Purpose: the panel renders every scored activity; adding a weight without a display label
// would silently drop it from the UI. This test makes that fail CI instead.
describe('DISPLAY_MAP drift guard', () => {
  const weightKeys = Object.keys(POINTS_WEIGHTS);
  const validGroups = ['Prospect & connect', 'Advance', 'Close', 'Deliver & service'];

  test.each(weightKeys)('POINTS_WEIGHTS["%s"] has a DISPLAY_MAP entry', (key) => {
    expect(DISPLAY_MAP[key]).toBeDefined();
    expect(typeof DISPLAY_MAP[key].label).toBe('string');
    expect(DISPLAY_MAP[key].label.length).toBeGreaterThan(0);
    expect(validGroups).toContain(DISPLAY_MAP[key].group);
  });

  test('DISPLAY_MAP has no extra keys absent from POINTS_WEIGHTS', () => {
    for (const key of Object.keys(DISPLAY_MAP)) {
      expect(POINTS_WEIGHTS[key]).toBeDefined();
    }
  });
});

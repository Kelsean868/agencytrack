import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// ESM source under test
import {
  POINTS_WEIGHTS as esmWeights,
  LEVEL_THRESHOLDS as esmLevels,
  BADGE_DEFINITIONS as esmBadges,
  resolveLevel as esmResolveLevel,
} from '../gamificationConfig.js';

// CJS twin under test — loaded via createRequire so vitest interops the CJS module
const require = createRequire(import.meta.url);
const cjs = require('../../../functions/lib/gamificationConfig');

// ── POINTS_WEIGHTS ────────────────────────────────────────────────────────────

describe('ESM ≡ CJS — POINTS_WEIGHTS', () => {
  it('identical shape and values', () => {
    expect(cjs.POINTS_WEIGHTS).toEqual(esmWeights);
  });
});

// ── LEVEL_THRESHOLDS ──────────────────────────────────────────────────────────

describe('ESM ≡ CJS — LEVEL_THRESHOLDS', () => {
  it('identical array (length, order, every field)', () => {
    expect(cjs.LEVEL_THRESHOLDS).toEqual(esmLevels);
  });
});

// ── BADGE_DEFINITIONS ─────────────────────────────────────────────────────────

describe('ESM ≡ CJS — BADGE_DEFINITIONS', () => {
  it('identical array (9 badges, same key/label/description/trigger order)', () => {
    expect(cjs.BADGE_DEFINITIONS).toEqual(esmBadges);
  });

  it('every badge has key, label, description, trigger', () => {
    for (const b of esmBadges) {
      expect(b).toHaveProperty('key');
      expect(b).toHaveProperty('label');
      expect(b).toHaveProperty('description');
      expect(b).toHaveProperty('trigger');
    }
  });
});

// ── resolveLevel ──────────────────────────────────────────────────────────────

describe('ESM ≡ CJS — resolveLevel', () => {
  const cases = [
    { points: 0,    title: 'Rookie'    },
    { points: 99,   title: 'Rookie'    },
    { points: 100,  title: 'Associate' },
    { points: 249,  title: 'Associate' },
    { points: 250,  title: 'Pro'       },
    { points: 499,  title: 'Pro'       },
    { points: 500,  title: 'Elite'     },
    { points: 999,  title: 'Elite'     },
    { points: 1000, title: 'Legend'    },
    { points: 9999, title: 'Legend'    },
  ];

  cases.forEach(({ points, title }) => {
    it(`${points} pts → ${title} (ESM and CJS identical)`, () => {
      const esmResult = esmResolveLevel(points);
      const cjsResult = cjs.resolveLevel(points);
      expect(esmResult.title).toBe(title);
      expect(cjsResult).toEqual(esmResult);
    });
  });
});

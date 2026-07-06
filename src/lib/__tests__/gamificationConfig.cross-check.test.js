import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// ESM source under test
import {
  POINTS_WEIGHTS as esmWeights,
  LEVEL_THRESHOLDS as esmLevels,
  BADGE_DEFINITIONS as esmBadges,
  UNSCORED_FIELDS as esmUnscored,
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
  it('identical array (10 badges, same key/label/description/trigger order)', () => {
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

// ── UNSCORED_FIELDS ───────────────────────────────────────────────────────────

describe('ESM ≡ CJS — UNSCORED_FIELDS', () => {
  it('identical array (same key/reason order)', () => {
    expect(cjs.UNSCORED_FIELDS).toEqual(esmUnscored);
  });

  it('every entry has key and reason', () => {
    for (const f of esmUnscored) {
      expect(f).toHaveProperty('key');
      expect(f).toHaveProperty('reason');
    }
  });
});

// ── resolveLevel ──────────────────────────────────────────────────────────────

describe('ESM ≡ CJS — resolveLevel', () => {
  const cases = [
    { points: 0,    title: 'Rookie'    },
    { points: 499,  title: 'Rookie'    },
    { points: 500,  title: 'Associate' },
    { points: 1499, title: 'Associate' },
    { points: 1500, title: 'Pro'       },
    { points: 3499, title: 'Pro'       },
    { points: 3500, title: 'Elite'     },
    { points: 6999, title: 'Elite'     },
    { points: 7000, title: 'Legend'    },
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

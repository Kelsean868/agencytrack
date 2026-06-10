// Single source of truth for gamification weights, levels, and badge metadata.
// ESM twin — mirrors functions/lib/gamificationConfig.js (CJS).
// Drift guard: src/lib/__tests__/gamificationConfig.cross-check.test.js asserts deep equality.
//
// SYNC DISCIPLINE: any edit here must be mirrored in functions/lib/gamificationConfig.js
// and vice-versa. The vitest cross-check test CI-fails on drift.

export const POINTS_WEIGHTS = {
  dials:           1,   // referralCalls + followUpCalls + coldCalls + seminarTradeshowCalls (summed, then floored)
  f2fAttempts:     1,
  ffiConducted:    5,
  ciConducted:     10,
  applicationsSold: 25,
  apiPerThousand:  1,   // 1 pt per TTD 1,000 of apiSold (floor division)
};

export const LEVEL_THRESHOLDS = [
  { level: 1, threshold: 0,    title: 'Rookie'    },
  { level: 2, threshold: 100,  title: 'Associate' },
  { level: 3, threshold: 250,  title: 'Pro'       },
  { level: 4, threshold: 500,  title: 'Elite'     },
  { level: 5, threshold: 1000, title: 'Legend'    },
];

export const BADGE_DEFINITIONS = [
  { key: 'first_submission', label: 'First Steps',     description: 'Submitted your first weekly report',              trigger: 'Submit your first report'                    },
  { key: 'streak_4',         label: 'On a Roll',       description: '4 weeks in a row',                                trigger: '4 consecutive weekly reports'                },
  { key: 'streak_8',         label: 'Committed',       description: '8 weeks in a row',                                trigger: '8 consecutive weekly reports'                },
  { key: 'streak_13',        label: 'Quarter Strong',  description: '13 weeks in a row',                               trigger: '13 consecutive weekly reports'               },
  { key: 'top_apps_week',    label: 'Closer',          description: '5+ applications in a single week',                trigger: '5+ applications in one week'                 },
  { key: 'big_week',         label: 'Big Week',        description: 'TTD 20,000+ API in a single week',                trigger: 'TTD 20,000+ API in one week'                 },
  { key: 'century_dials',    label: 'Century',         description: '100+ dials in a single week',                     trigger: '100+ dials in one week'                      },
  { key: 'mdrt_qualified',   label: 'MDRT Qualified',  description: 'YTD API reached TTD 500,000',                     trigger: 'YTD API ≥ TTD 500,000'                      },
  { key: 'mdrt_pace',        label: 'MDRT Pace',       description: 'On track for MDRT (TTD 250,000 YTD by mid-year)', trigger: 'YTD API ≥ TTD 250,000 by week 26'           },
];

/**
 * Returns the level entry for the given cumulative point total.
 * Pure function — no Firestore, no side effects.
 */
export function resolveLevel(totalPoints) {
  return [...LEVEL_THRESHOLDS].reverse().find((l) => totalPoints >= l.threshold) ?? LEVEL_THRESHOLDS[0];
}

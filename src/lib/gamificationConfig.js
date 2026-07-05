// Single source of truth for gamification weights, levels, and badge metadata.
// ESM twin — mirrors functions/lib/gamificationConfig.js (CJS).
// Drift guard: src/lib/__tests__/gamificationConfig.cross-check.test.js asserts deep equality.
//
// SYNC DISCIPLINE: any edit here must be mirrored in functions/lib/gamificationConfig.js
// and vice-versa. The vitest cross-check test CI-fails on drift.

export const POINTS_WEIGHTS = {
  // ── Prospecting ──────────────────────────────────────────────────────────────
  dials:                     1,   // referralCalls + followUpCalls + coldCalls + seminarTradeshowCalls (summed then floored)
  prospectingLettersSent:    1,   // capped at 20/wk in computePoints via Math.min(value, 20)
  referralsObtained:         3,   // referral premium — pipeline quality
  otherNewNames:             1,   // namesFromColdCanvass + namesFromOther + namesFromSeminarsConducted + namesFromTradeshowsAttended
  seminarsConducted:         10,
  tradeshowsAttended:        5,
  // ── Advancing ────────────────────────────────────────────────────────────────
  f2fAttempts:               2,   // attempt (not f2fContacts which is a success ratio)
  appointmentsSet:           3,
  ffiConducted:              5,
  ciConducted:               10,
  // ── Closing ──────────────────────────────────────────────────────────────────
  applicationsSold:          25,
  apiPerThousand:            1,   // 1 pt per TTD 1,000 of apiSold (floor division)
  // ── Service ──────────────────────────────────────────────────────────────────
  serviceCalls:              1,   // the attempt (consistent with dial convention)
  policiesDelivered:         3,
  premiumCollectionMeetings: 3,
  annualReviews:             5,   // field key: annualReviews
  orphanReviews:             5,   // field key: orphanReviews
  orphansAdopted:            8,
  reinstatementsSubmitted:   10,  // field key: reinstatementsSubmitted
  reinstatedApiPerThousand:  1,   // 1 pt per TTD 1,000 of reinstatementAPI (floor division)
  policyChanges:             1,
};

export const LEVEL_THRESHOLDS = [
  // NOTE: provisional — tune against real pilot data after 4–6 weeks.
  { level: 1, threshold: 0,    title: 'Rookie'    },
  { level: 2, threshold: 500,  title: 'Associate' },
  { level: 3, threshold: 1500, title: 'Pro'       },
  { level: 4, threshold: 3500, title: 'Elite'     },
  { level: 5, threshold: 7000, title: 'Legend'    },
];

export const BADGE_DEFINITIONS = [
  { key: 'first_submission', label: 'First Steps',    description: 'Submitted your first weekly report',              trigger: 'Submit your first report'            },
  { key: 'streak_4',         label: 'On a Roll',      description: '4 weeks in a row',                                trigger: '4 consecutive weekly reports'        },
  { key: 'streak_8',         label: 'Committed',      description: '8 weeks in a row',                                trigger: '8 consecutive weekly reports'        },
  { key: 'streak_13',        label: 'Quarter Strong', description: '13 weeks in a row',                               trigger: '13 consecutive weekly reports'       },
  { key: 'top_apps_week',    label: 'Closer',         description: '5+ applications in a single week',                trigger: '5+ applications in one week'         },
  { key: 'big_week',         label: 'Big Week',       description: 'TTD 20,000+ API in a single week',                trigger: 'TTD 20,000+ API in one week'         },
  { key: 'century_dials',    label: 'Century',        description: '100+ dials in a single week',                     trigger: '100+ dials in one week'              },
  { key: 'mdrt_qualified',   label: 'MDRT Qualified', description: 'YTD API reached TTD 688,800',                     trigger: 'YTD API ≥ TTD 688,800'              },
  { key: 'mdrt_pace',        label: 'MDRT Pace',      description: 'On track for MDRT (TTD 250,000 YTD by mid-year)', trigger: 'YTD API ≥ TTD 250,000 by week 26'  },
];

// Submission fields deliberately not scored — exported for the future points
// panel (PR2) to display "not scored" labels accurately.
//
// KPI ratios measure success rates against scored attempts; scoring them
// separately would double-count and distort the prospecting-pipeline metrics.
// Exit processing (withdrawalsLoans, surrenders) is not incentivised.
export const UNSCORED_FIELDS = [
  { key: 'withdrawalsLoans', reason: 'exit processing — not incentivised' },
  { key: 'surrenders',       reason: 'exit processing — not incentivised' },
  { key: 'telContacts',      reason: 'KPI ratio (contacts / dials) — not scored as attempt' },
  { key: 'f2fContacts',      reason: 'KPI ratio (contacts / f2f attempts) — not scored' },
  { key: 'serviceContacts',  reason: 'KPI ratio — not scored as attempt' },
];

/**
 * Returns the level entry for the given cumulative point total.
 * Pure function — no Firestore, no side effects.
 */
export function resolveLevel(totalPoints) {
  return [...LEVEL_THRESHOLDS].reverse().find((l) => totalPoints >= l.threshold) ?? LEVEL_THRESHOLDS[0];
}

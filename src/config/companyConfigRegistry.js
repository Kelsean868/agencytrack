// companyConfigRegistry.js — Company Config settings REGISTRY (Run 5, Item 1B).
//
// Ports the STRUCTURE of the design prototype at
// docs/design-system/screens-v2/design_handoff_company_config/cc-proto-data.jsx
// into a production data module. The prototype's own default VALUES (Alicia
// Gopaul, TTD 9.60M, the fictional band/points/standards tables, the 5-flag
// list) are design-mockup fiction and are NOT used here — every `def` below
// traces to a real code constant (see the `source` citation on each item) or
// is explicitly `unbacked: true` with `def: null` when no such constant exists.
//
// Data only — no React, no Firebase. Plain ESM, importable directly by Vitest.
//
// item types (kept from the prototype's vocabulary, plus `awardsRuleset` —
// the one addition the mapping brief calls for, since Awards hosts the
// existing full-object awards editor rather than a registry-native table):
//   text | number | currency | seg | toggle | bands | standards | points |
//   milestones | textchips | upload | flag | awardsRuleset

export const CONFIG_GROUPS = [
  { g: 'Brand', keys: ['identity', 'org'] },
  { g: 'Standards', keys: ['targets', 'cadence', 'activity'] },
  { g: 'Recognition', keys: ['recognition', 'awards'] },
  { g: 'Operations', keys: ['financing', 'kiosk', 'policy'] },
  { g: 'Platform', keys: ['flags', 'data'] },
];

// Phase 1 ships first — everything else is designed ahead of its phase.
// `targets` ships in Phase 1 but renders READ-ONLY this run (see note on the
// section blurb below) — the effective-dating engine (slice 1.5) lands later.
export const PHASE1_SECTIONS = ['targets', 'activity', 'awards', 'flags'];

// ── activity: the 8 real manager-activity-standard keys ─────────────────────
// Source: src/services/managerActivityStandardsService.js:10-21 (NUMERIC_STANDARDS,
// BOOLEAN_STANDARDS, STANDARDS_ROLE_KEYS — all named exports, asserted in the
// parity test). "No standard set" behavior (missing doc/role → {}) is
// managerActivityStandardsService.js:32 (doc) and :40 (role).
//
// Human labels reused verbatim from src/components/admin/ActivityStandardsModal.jsx
// (the editor's own labels — more descriptive than the summary-row labels in
// the sibling ActivityStandardsPanel.jsx, which abbreviates e.g. "JFW").
const ACTIVITY_STANDARD_LABELS = {
  jfwCount: 'Joint Field Work (JFW)',
  oneOnOnesConducted: 'One-on-One Pipeline Reviews',
  namesSourced: 'Names Sourced',
  interviewsConducted: 'Initial Interviews Conducted',
  recruitsInFirstWeeks: 'New Recruits in First Weeks',
  trainingSessions: 'Training Sessions Delivered',
  unitMeetingHeld: 'Unit / Branch Meeting Held',
  dashboardReviewDone: 'Planning & Dashboard Review Done',
};

const ACTIVITY_STANDARD_NUMERIC_KEYS = [
  'jfwCount', 'oneOnOnesConducted', 'namesSourced',
  'interviewsConducted', 'recruitsInFirstWeeks', 'trainingSessions',
];
const ACTIVITY_STANDARD_BOOLEAN_KEYS = ['unitMeetingHeld', 'dashboardReviewDone'];
const ACTIVITY_STANDARD_KEYS = [...ACTIVITY_STANDARD_NUMERIC_KEYS, ...ACTIVITY_STANDARD_BOOLEAN_KEYS];

function activityStandardsItem(role, label) {
  return {
    id: `act.standards.${role}`,
    label: `Weekly standards — ${label}`,
    desc: 'The tenant default this manager role starts from — numeric weekly counts plus two weekly checklist items. Per-manager overrides live in the manager flow; this is the company-wide default.',
    type: 'standards',
    bare: true,
    def: null, // absence = "no standard set" for this role — the real code default (see citation).
    standardKeys: ACTIVITY_STANDARD_KEYS,
    standardLabels: ACTIVITY_STANDARD_LABELS,
    storage: { docId: 'managerActivityStandards', keyPath: role, mode: 'plain' },
    source: 'src/services/managerActivityStandardsService.js:10-21,32,40 + src/components/admin/ActivityStandardsModal.jsx:11-23',
  };
}

// ── recognition: the real 21-key points scale, in source order ─────────────
// Source: src/lib/gamificationConfig.js:8-34 (POINTS_WEIGHTS). Order and every
// value asserted verbatim (deep-equal) in the parity test.
const REC_POINTS = [
  { key: 'dials', pts: 1 },
  { key: 'prospectingLettersSent', pts: 1 },
  { key: 'referralsObtained', pts: 3 },
  { key: 'otherNewNames', pts: 1 },
  { key: 'seminarsConducted', pts: 10 },
  { key: 'tradeshowsAttended', pts: 5 },
  { key: 'f2fAttempts', pts: 2 },
  { key: 'appointmentsSet', pts: 3 },
  { key: 'ffiConducted', pts: 5 },
  { key: 'ciConducted', pts: 10 },
  { key: 'applicationsSold', pts: 25 },
  { key: 'apiPerThousand', pts: 1 },
  { key: 'serviceCalls', pts: 1 },
  { key: 'policiesDelivered', pts: 3 },
  { key: 'premiumCollectionMeetings', pts: 3 },
  { key: 'annualReviews', pts: 5 },
  { key: 'orphanReviews', pts: 5 },
  { key: 'orphansAdopted', pts: 8 },
  { key: 'reinstatementsSubmitted', pts: 10 },
  { key: 'reinstatedApiPerThousand', pts: 1 },
  { key: 'policyChanges', pts: 1 },
];

// Source: src/lib/gamificationConfig.js:36-43 (LEVEL_THRESHOLDS).
const REC_LEVELS = [
  { level: 1, threshold: 0, title: 'Rookie' },
  { level: 2, threshold: 500, title: 'Associate' },
  { level: 3, threshold: 1500, title: 'Pro' },
  { level: 4, threshold: 3500, title: 'Elite' },
  { level: 5, threshold: 7000, title: 'Legend' },
];

// ── Company Config sections ──────────────────────────────────────────────────
export const CONFIG_SECTIONS = {
  targets: {
    label: 'Targets & Minimums',
    blurb: 'The production floors every agent is measured against — by tenure band, plus the company-wide floor, pace-warning and below-floor thresholds. These drive AT FLOOR / BELOW flags on dashboards, Master Sheet and WARs. Editing lands with the effective-dating engine (slice 1.5) — values below are live and real, controls are read-only for now.',
    groups: [
      {
        title: 'TENURE-BAND MINIMUMS',
        sub: 'The real per-tenure-band annual API floors (config/companyMinimums.tenureApiFloors, defaults from tenureFloors.js). No weekly-floor derived column: the real weekly fallback is a flat TTD 4,800 (FLAT_WEEKLY_API_FALLBACK), not annual ÷ 48 — a per-band weekly derivation is not how the code works.',
        items: [
          {
            id: 'targets.bands',
            label: 'Tenure bands',
            desc: 'Annual API floor by months of service (months-of-service is computed from contractStartDate). Fallback for agents with no/invalid contractStartDate is a flat TTD 200,000 (FLAT_ANNUAL_API_FALLBACK), not a band lookup.',
            type: 'bands',
            bare: true,
            dated: true,
            sourceKeys: ['band0_lt12', 'band12_to_24', 'band25_to_36', 'band37_to_48', 'band49_to_60', 'band_gt60'],
            def: [
              { band: '0–11 mo', from: 0, to: 11, floor: 150000 },
              { band: '12–24 mo', from: 12, to: 24, floor: 200000 },
              { band: '25–36 mo', from: 25, to: 36, floor: 250000 },
              { band: '37–48 mo', from: 37, to: 48, floor: 300000 },
              { band: '49–60 mo', from: 49, to: 60, floor: 400000 },
              { band: '61+ mo', from: 61, to: null, floor: 500000 },
            ],
            source: 'src/utils/tenureFloors.js:16-27 (DEFAULT_TENURE_API_FLOORS + FLAT_WEEKLY_API_FALLBACK)',
          },
        ],
      },
      {
        title: 'CLUB & COMPANY THRESHOLDS',
        items: [
          {
            id: 'targets.floor',
            label: 'Company API floor',
            desc: 'The fallback annual production minimum used when a tenant has not stored config/companyMinimums.annualAPI.',
            type: 'currency',
            dated: true,
            def: 200000,
            source: 'src/services/goalsService.js:60',
          },
          {
            id: 'targets.annualApps',
            label: 'Company apps floor',
            desc: 'Applications a year every agent must commit to, in every tenure band (40, confirmed 27 Sep 2026). Read-only here: setCompanyMinimums (goalsService.js) never writes annualApps. The only writer is scripts/maintenance/set-company-minimum-apps.mjs.',
            type: 'number',
            def: 40,
            source: 'src/services/goalsService.js:62 (writer: scripts/maintenance/set-company-minimum-apps.mjs)',
          },
          {
            id: 'targets.persistencyFloor',
            // NAMING: the id says "floor", but the 90 default is the AWARD GATE
            // (PERS_GATE_PCT), not the at-risk floor (PERS_FLOOR_PCT = 80).
            // This field is a minimum on an agent's self-set persistency GOAL —
            // a third concept from either threshold. The id is load-bearing
            // (persisted config key), so the label carries the correction.
            label: 'Minimum persistency an agent may commit to',
            type: 'number',
            suffix: '%',
            def: 90,
            source: 'src/services/goalsService.js (getCompanyMinimums → persistency, defaults to PERS_GATE_PCT)',
          },
        ],
      },
      {
        title: 'PACE & WARNINGS',
        items: [
          {
            id: 'targets.pace',
            label: 'Pace-warning threshold',
            desc: 'Agents show as "Off pace" on the manager exceptions list when YTD API drops below this share of pro-rata expected pace against their tenure floor.',
            type: 'number',
            suffix: '%',
            def: 85,
            source: 'src/utils/managerExceptions.js:32 (FLOOR_PACE_WARN = 0.85)',
          },
          {
            id: 'targets.danger',
            label: 'Below-floor danger threshold',
            desc: 'Agents show as "Below floor" (danger) when YTD API drops below this share of pro-rata expected pace.',
            type: 'number',
            suffix: '%',
            def: 50,
            source: 'src/utils/managerExceptions.js:31 (FLOOR_PACE_DANGER = 0.5)',
          },
          {
            id: 'targets.onTrack',
            label: 'Game-plan on-track fraction',
            desc: 'Weekly Planner pace-vs-plan threshold — a metric reads "on-track" once actual reaches this share of the elapsed-days pace. A separate system from the manager exceptions pace thresholds above.',
            type: 'number',
            suffix: '%',
            def: 90,
            lock: 'soon',
            source: 'src/utils/planVariance.js:54 (PACE_ON_TRACK_FRACTION = 0.9)',
          },
          {
            id: 'targets.mdrt',
            label: 'MDRT threshold (industry)',
            desc: 'Mirrors the official MDRT requirement (premium method, T&T) in TTD · settled API. Pace and badge figures are applied by Cloud Functions, not this row.',
            type: 'currency',
            def: 688800,
            lock: 'soon',
            tier: 'TIER 2',
            source: 'src/config/mdrtThresholds/2026.js:5 (MDRT_THRESHOLDS_2026.mdrt)',
          },
        ],
      },
    ],
  },

  activity: {
    label: 'Activity Standards',
    blurb: 'The real weekly activity standards manager roles are held to — six numeric counts plus two checklist items, one set per role (unit / branch / sales manager). Live-wired: editing here writes to the same config/managerActivityStandards doc the existing admin panel uses.',
    groups: [
      {
        title: 'WEEKLY MANAGER STANDARDS',
        sub: 'One standards set per manager role. Missing = "no standard set" for that role (the real code default) — not a zero.',
        items: [
          activityStandardsItem('unit_manager', 'Unit Managers'),
          activityStandardsItem('branch_manager', 'Branch Managers'),
          activityStandardsItem('sales_manager', 'Sales Managers'),
        ],
      },
    ],
  },

  recognition: {
    label: 'Recognition & Gamification',
    blurb: 'How effort gets seen: the real 21-activity points scale behind streaks and the leaderboard, the 5 level thresholds, and every milestone set that fires a celebration moment. All read-only this run — every value shown is the real one the client and Cloud Functions apply today.',
    accent: 'gold',
    groups: [
      {
        title: 'POINTS SCALE',
        sub: 'What each captured activity is worth, in source order. Feeds streaks, the leaderboard and campaigns — production standing itself stays API-based.',
        items: [
          {
            id: 'rec.points',
            label: 'Points scale',
            desc: 'Applied by onSubmissionWrite as activity lands. Dual-copied ESM (src) / CJS (functions) — a cross-check test asserts the two never drift.',
            type: 'points',
            bare: true,
            lock: 'soon',
            tier: 'TIER 2',
            def: REC_POINTS,
            source: 'src/lib/gamificationConfig.js:8-34 (POINTS_WEIGHTS)',
          },
        ],
      },
      {
        title: 'LEVELS',
        items: [
          {
            id: 'rec.levels',
            label: 'Level thresholds',
            desc: 'Cumulative-point thresholds for the 5 gamification levels. Provisional — the source itself notes these are untuned pre-pilot values.',
            type: 'points',
            lock: 'soon',
            tier: 'TIER 2',
            def: REC_LEVELS,
            source: 'src/lib/gamificationConfig.js:36-43 (LEVEL_THRESHOLDS)',
          },
        ],
      },
      {
        title: 'STREAK MILESTONES',
        sub: 'Three independent milestone sets, one per surface — they are not the same numbers.',
        items: [
          {
            id: 'rec.milestones.filing',
            label: 'Weekly-filing streak milestones',
            desc: 'Consecutive weeks with a submitted weekly report.',
            type: 'milestones',
            lock: 'soon',
            def: [5, 10, 25, 52],
            source: 'src/lib/celebrations.js:37 (FILING_WEEKLY_STREAK_MILESTONES)',
          },
          {
            id: 'rec.milestones.daily',
            label: 'Daily Capture streak milestones',
            desc: 'Consecutive logged days within the current logging week (Daily Capture).',
            type: 'milestones',
            lock: 'soon',
            def: [5, 10, 20],
            source: 'src/lib/celebrations.js:27 (DAILY_STREAK_MILESTONES)',
          },
          {
            id: 'rec.milestones.goals',
            label: 'Goals weekly-target streak milestones',
            desc: 'Consecutive weeks clearing the weekly API target (Goals tab).',
            type: 'milestones',
            lock: 'soon',
            def: [4, 8, 12],
            source: 'src/lib/celebrations.js:31 (GOALS_WEEKLY_STREAK_MILESTONES)',
          },
          {
            id: 'rec.streakBadges',
            label: 'Leaderboard streak badge thresholds',
            desc: 'Weekly-submission streak badges (streak_4 / streak_8 / streak_13) awarded by the onSubmissionWrite Cloud Function. CF-authoritative — this value lives in functions/, not src/, so it cannot be asserted against an importable Vitest module.',
            type: 'milestones',
            lock: 'soon',
            tier: 'TIER 2',
            def: [4, 8, 13],
            source: 'functions/index.js:1485-1487',
          },
        ],
      },
      {
        title: 'CAMPAIGN PERSISTENCY GATE',
        sub: 'Multiplier bands scaling every PROJECTED campaign payout by the advisor’s persistency — display-only math in campaign standings and the campaign card; no owed/released/paid amount is ever written. The value shown is the share of the projected prize paid at that band. THESE FOUR BANDS APPLY ONLY TO A CAMPAIGN RUNNING THE DEFAULT gate mode (‘bands’). A campaign may instead declare a SINGLE THRESHOLD (campaign.persistencyGate = { mode: ‘binary’, threshold, basis }), which pays 100% at or above the threshold and disqualifies below it with nothing in between — the Christmas Campaign and Retreat 2026 is one. A campaign also chooses whether persistency is read as the average over the campaign period (the default) or as the single record for its final month. Both are set per campaign in the campaign form, so neither has a company-wide default to show here; so are tier ladders (API + apps minimums).',
        items: [
          {
            id: 'rec.gate.90',
            label: 'Persistency ≥90%',
            desc: 'Inclusive floor 90%. Full projected prize — the ×1.0 band applied by gateBandFor in standings. Applies to campaigns on gate mode ‘bands’ only.',
            type: 'text',
            def: '100%',
            mono: true,
            lock: 'soon',
            source: 'src/utils/campaignEngine.js:27 (PERSISTENCY_GATE_BANDS[0])',
          },
          {
            id: 'rec.gate.85',
            label: 'Persistency 85–89%',
            desc: 'Inclusive floor 85%. Half the projected prize (×0.5). Applies to campaigns on gate mode ‘bands’ only — a single-threshold campaign has no half band.',
            type: 'text',
            def: '50%',
            mono: true,
            lock: 'soon',
            source: 'src/utils/campaignEngine.js:28 (PERSISTENCY_GATE_BANDS[1])',
          },
          {
            id: 'rec.gate.80',
            label: 'Persistency 80–84%',
            desc: 'Inclusive floor 80%. A quarter of the projected prize (×0.25). Applies to campaigns on gate mode ‘bands’ only — a single-threshold campaign has no quarter band.',
            type: 'text',
            def: '25%',
            mono: true,
            lock: 'soon',
            source: 'src/utils/campaignEngine.js:29 (PERSISTENCY_GATE_BANDS[2])',
          },
          {
            id: 'rec.gate.dq',
            label: 'Persistency <80%',
            desc: 'Below the lowest band floor — projected payout ×0 (disqualified from the prize, still ranked in standings). Applies to campaigns on gate mode ‘bands’ only; a single-threshold campaign disqualifies at its own threshold instead.',
            type: 'text',
            def: 'DQ',
            mono: true,
            lock: 'soon',
            source: 'src/utils/campaignEngine.js:30 (PERSISTENCY_GATE_BANDS[3])',
          },
        ],
      },
    ],
  },

  awards: {
    label: 'Awards & Clubs',
    blurb: 'The real 2026 awards ruleset — Advisor of the Month, Quarterly, Persistency, Rookie, New Business, Centurion, Agent of the Year, MDRT, Club tiers, and every manager award. Awards shipped with full override plumbing first — the pattern the rest of config replicates.',
    accent: 'gold',
    groups: [
      {
        title: 'AWARD RULESET',
        sub: 'The complete ruleset object, hosted by the existing awards editor rather than a registry-native table.',
        items: [
          {
            id: 'aw.ruleset',
            label: 'Awards & clubs ruleset',
            desc: 'The full DEFAULT_RULESET_2026 object (every award group and club tier). Round-trip correctness is covered by awardsRulesetService’s own tests, not this registry’s parity test.',
            type: 'awardsRuleset',
            bare: true,
            dated: false,
            def: null,
            storage: { docId: 'awardsRuleset_2026', keyPath: '', mode: 'awards' },
            source: 'src/config/awardsRuleset/2026.js + src/services/awardsRulesetService.js',
          },
        ],
      },
      {
        title: 'SEASON & BASIS',
        items: [
          {
            id: 'aw.season',
            label: 'Award season',
            desc: 'The year-suffix convention (config/awardsRuleset_{year}) is the real seasoning mechanism today — there is no fiscal-year alternative wired up.',
            type: 'seg',
            options: ['Calendar year'],
            def: 'Calendar year',
            lock: 'soon',
            source: 'src/services/awardsRulesetService.js:6,104 (awardsRuleset_${year} doc path)',
          },
          {
            id: 'aw.basis',
            label: 'Qualification basis',
            desc: 'A product invariant, not a preference: every award/club threshold in the ruleset compares against settled API/apps (settledAPI / settledApps fields), never in-flight production.',
            lock: 'platform',
            value: 'SETTLED API ONLY',
            source: 'src/utils/awardsEngine.js:73-110 (settledAPI / settledApps usage)',
          },
        ],
      },
    ],
  },

  flags: {
    label: 'Feature Flags',
    blurb: 'Early features you can switch on for your whole tenant before they graduate into their own config sections. Fail-closed: any flag absent from your tenant reads as OFF, and a read error resolves to OFF too — a flag lookup can never block the app.',
    groups: [], // rendered specially, like the prototype.
  },

  // ── Future sections (designed ahead; no storage unless noted) ─────────────
  identity: {
    label: 'Identity & Branding',
    blurb: 'How AgencyTrack presents your company — marks, contact details and portal preferences. Designed ahead of its phase; nothing on this section writes yet.',
    groups: [
      {
        title: 'BRAND MARKS',
        items: [
          { id: 'id.logo', label: 'Organization logo', desc: 'PNG or SVG, square or wide. Used on the sidebar, reports and kiosk header.', type: 'upload', shape: 'wide', lock: 'soon', def: null, unbacked: true },
          { id: 'id.favicon', label: 'Fav icon', desc: 'Browser-tab mark — square, 64×64 or larger.', type: 'upload', shape: 'tile', lock: 'soon', def: null, unbacked: true },
        ],
      },
      {
        title: 'CONTACT INFO',
        items: [
          { id: 'id.name', label: 'Organization name', desc: 'The tenant’s display name at runtime — there is no code-level default to show here.', type: 'text', def: null, unbacked: true },
        ],
      },
      {
        title: 'SUPER ADMIN',
        items: [
          { id: 'id.adminemail', label: 'Super admin email', desc: 'The tenant owner. Changing it is an ownership transfer, not a config edit.', lock: 'platform', def: null, unbacked: true },
        ],
      },
      {
        title: 'PREFERENCES',
        items: [
          { id: 'id.namespace', label: 'Org namespace', desc: 'The tenant’s portal address segment — runtime value, no fixed code default.', lock: 'platform', def: null, unbacked: true },
          {
            id: 'id.dateformat',
            label: 'Date format',
            desc: 'No single display format exists to default from: formatDateDisplay renders dd-mm-yyyy while formatDateFriendly renders a full weekday/month spellout, used in different places today. Rather than pick one, this row is unbacked until a real single format is chosen.',
            type: 'seg',
            options: ['dd-mm-yyyy', 'Weekday, D Mon YYYY'],
            lock: 'soon',
            def: null,
            unbacked: true,
            source: 'src/utils/formatters.js:47-58 (formatDateDisplay, formatDateFriendly)',
          },
          {
            id: 'id.tz',
            label: 'Timezone & currency',
            desc: 'All timestamps render TT-local (permanent AST, no DST) and all money renders through formatCurrency’s TTD prefix.',
            lock: 'platform',
            value: 'AST · UTC−4 · TTD',
            source: 'src/utils/formatters.js:20-26 (formatCurrency TTD prefix); CLAUDE.md Trinidad AST note',
          },
        ],
      },
    ],
  },

  org: {
    label: 'Organization',
    blurb: 'Names and shape of your hierarchy. Branches and units themselves are managed under Branches & Units.',
    groups: [
      {
        title: 'CAREER LEVELS',
        items: [
          {
            id: 'org.levels',
            label: 'Career level names',
            desc: 'Career level is per-user free text today, entered at import/edit time (validated only for max length) — there is no company-wide level taxonomy or threshold table to default from.',
            type: 'textchips',
            lock: 'soon',
            def: [], // list-typed items must default to [], never null — see ConfigControls.jsx list-control hardening.
            unbacked: true,
            source: 'src/services/userImportService.js:190-197 (careerLevel free-text validation)',
          },
        ],
      },
    ],
  },

  cadence: {
    label: 'Reporting Cadence',
    blurb: 'The weekly rhythm — when reports open, close and chase. Values shown are the real week-start rule and the real cron schedule AgencyTrack runs today.',
    groups: [
      {
        title: 'WEEKLY RHYTHM',
        items: [
          {
            id: 'cad.weekstart',
            label: 'Week starts on',
            desc: 'Every weekly report’s weekStarting date is validated as a Sunday.',
            type: 'seg',
            options: ['Sunday'],
            def: 'Sunday',
            lock: 'soon',
            source: 'src/utils/validators.js:12-16 (validateSundayDate)',
          },
          {
            id: 'cad.wardue',
            label: 'Weekly report due',
            desc: 'The flagMissedDeadlines cron runs Monday 13:01 UTC = Monday 9:01 AM Trinidad time (permanent AST, no DST) — corrected from a stale "9:00 AM" assumption; the schedule string is \'1 13 * * 1\'. Changing this means editing and redeploying the Cloud Function, not a config write.',
            type: 'text',
            def: 'Monday 9:01 AM',
            mono: true,
            lock: 'soon',
            source: 'functions/index.js:1276-1277 (flagMissedDeadlines, schedule \'1 13 * * 1\', timeZone UTC)',
          },
        ],
      },
      {
        title: 'NUDGES',
        items: [
          {
            id: 'cad.nudges',
            label: 'Nudge schedule',
            desc: 'Two scheduled reminder Cloud Functions: sendSundayNudge (Sun 22:00 UTC = Sun 6:00 PM TT) and sendMondayNudge (Mon 11:00 UTC = Mon 7:00 AM TT). Redeploy-required to change.',
            type: 'text',
            def: 'Sun 6:00 PM · Mon 7:00 AM (TT)',
            mono: true,
            lock: 'soon',
            tier: 'TIER 2',
            source: 'functions/index.js:1200-1201 (sendSundayNudge \'0 22 * * 0\'), 1238-1239 (sendMondayNudge \'0 11 * * 1\')',
          },
        ],
      },
    ],
  },

  financing: {
    label: 'Financing Thresholds',
    blurb: 'Guardrails around financed business — the real 2026 Track K new-agent financing ruleset (contract-derived, product-owner confirmed for 2026).',
    groups: [
      {
        title: 'QUALIFICATION & BONUS RATES',
        items: [
          { id: 'fin.quarterlyGrossMin', label: 'Quarterly qualification gate', desc: 'Gross New Settled API required per quarter to qualify.', type: 'currency', def: 37500, lock: 'soon', source: 'src/config/financingRuleset/2026.js:16 (quarterlyGrossMin)' },
          { id: 'fin.persistencyY1', label: 'Persistency gate — Year 1', type: 'number', suffix: '%', ratio: true, def: 95, lock: 'soon', source: 'src/config/financingRuleset/2026.js:21 (persistencyY1 = 0.95)' },
          { id: 'fin.persistencyY2', label: 'Persistency gate — Year 2', type: 'number', suffix: '%', ratio: true, def: 90, lock: 'soon', source: 'src/config/financingRuleset/2026.js:22 (persistencyY2 = 0.90)' },
          { id: 'fin.consistencyRate', label: 'Consistency bonus rate', desc: 'Applied to Net New Settled API for Persistency, per quarter.', type: 'number', suffix: '%', ratio: true, def: 15, lock: 'soon', source: 'src/config/financingRuleset/2026.js:27 (consistencyRate = 0.15)' },
          { id: 'fin.productionRateY1', label: 'Production bonus rate — Year 1', type: 'number', suffix: '%', ratio: true, def: 15, lock: 'soon', source: 'src/config/financingRuleset/2026.js:28 (productionRateY1 = 0.15)' },
          { id: 'fin.productionRateY2', label: 'Production bonus rate — Year 2', type: 'number', suffix: '%', ratio: true, def: 20, lock: 'soon', source: 'src/config/financingRuleset/2026.js:29 (productionRateY2 = 0.20)' },
        ],
      },
    ],
  },

  kiosk: {
    label: 'Kiosk',
    blurb: 'The read-only branch lobby screen — what it shows and how fast it moves. Values reflect the real panel-rotation config.',
    groups: [
      {
        title: 'ROTATION',
        items: [
          {
            id: 'kio.rotation',
            label: 'Slide rotation',
            desc: 'Per-panel duration varies by panel (PANEL_DURATIONS) rather than one fixed number — shortest is Welcome (15s), longest is Agent of the Month (45s).',
            type: 'text',
            mono: true,
            def: 'Per panel · 15–45 s',
            lock: 'soon',
            source: 'src/lib/kiosk/kioskConfig.js:1-18 (PANEL_DURATIONS)',
          },
          {
            id: 'kio.poll',
            label: 'Idle data refresh',
            type: 'number',
            suffix: 'min',
            def: 5,
            lock: 'soon',
            source: 'src/lib/kiosk/kioskConfig.js:57 (POLL_INTERVAL_MS = 5 * 60 * 1000)',
          },
        ],
      },
    ],
  },

  policy: {
    label: 'Policy & Delivery',
    blurb: 'The clawback clock — real values from the CRO delivery-tracking rules.',
    groups: [
      {
        title: 'CLAWBACK CLOCK',
        sub: 'Days since a policy’s issue date (dateIssued) — commission is withheld/clawed back if not delivered within the clawback window.',
        items: [
          { id: 'pol.clawback', label: 'Clawback window', type: 'number', suffix: 'days', def: 30, lock: 'soon', source: 'src/utils/clawbackClock.js:22 (CLAWBACK_DAYS)' },
          { id: 'pol.atrisk', label: 'At-risk warning threshold', desc: 'Days-left at or below this (and ≥ 0) render the "at-risk" (warning) tone instead of "within".', type: 'number', suffix: 'days', def: 7, lock: 'soon', source: 'src/utils/clawbackClock.js:23 (AT_RISK_DAYS)' },
        ],
      },
    ],
  },

  data: {
    label: 'Data & Privacy',
    blurb: 'What leaves the system, and what never does.',
    groups: [
      {
        title: 'HARD GUARANTEES',
        items: [
          {
            id: 'dat.pii',
            label: 'Client PII on leaderboards',
            desc: 'Verified against the actual leaderboard-write shape: computeAndWriteLeaderboards only ever writes agentId, name, unitId, unitName, periodApi, apps, points, rank, rankWithinUnit, previousRank, previousRanks per entry, plus the doc-level computedAt, sources and skippedNoBranch. periodApi and apps are per-agent totals from the policy ledger; no policy, client name or policy number is copied. No phone/email/address/SSN field is written.',
            lock: 'platform',
            value: 'NEVER',
            source: 'functions/leaderboard/boardMetrics.js:222-234',
          },
          {
            id: 'dat.audit',
            label: 'Audit log retention',
            desc: 'A designed product principle from the Company Config handoff, not yet a live technical guarantee: today there is no separate audit-log collection at all (goalsService.js’s companyMinimums writer notes audit infrastructure is deferred to P11) — "FOREVER" describes stated intent, not an enforced retention policy.',
            lock: 'platform',
            value: 'FOREVER',
            source: 'docs/design-system/screens-v2/design_handoff_company_config/README.md:5-11 (Product principles)',
          },
        ],
      },
      {
        title: 'EXPORTS',
        items: [
          {
            id: 'dat.export',
            label: 'Branch, tenant admin & platform admin CSV export',
            desc: 'The real gate today is a hardcoded role check in ManagerDashboard’s topbar (branch_manager | tenant_admin | platform_admin) around the existing exportBranchCSV — unit managers and sales managers do not see the button. This is not yet a tenant-configurable toggle; the value shown reflects the current hardcoded state.',
            type: 'toggle',
            def: true,
            lock: 'soon',
            source: 'src/services/exportService.js:104-202 (exportBranchCSV) + src/components/dashboard/ManagerDashboard.jsx:489-497 (role gate)',
          },
        ],
      },
    ],
  },
};

// ── Feature flags — the 2 REAL allowlisted keys ─────────────────────────────
// Source: src/services/featureFlagsService.js:32-35 (FEATURE_FLAG_KEYS), mirrored
// in scripts/verification/vh/flag-toggle.cjs:26 (ALLOWED_FLAGS).
// `persistencyV2` was retired here (Persistency 24-Month Model brief, Slice P2,
// P-D6) — the memo did not adopt the v2 rolling-model preview's arithmetic, so
// the flag-gated shell it mounted is gone. `configService.js`'s
// `ALLOWED_FLAG_KEYS` (a separate write-gate allowlist, not this list)
// deliberately still contains `persistencyV2`: dropping it there would also
// require editing `firestore.rules`' `ccfgFlagKeysAllowed()` and
// `scripts/verification/vh/flag-toggle.cjs` to keep the triple-copy drift
// guard (`flagAllowlist.cross-check.test.js`) green, and this slice does not
// touch `firestore.rules`. The stale allowed-but-unreachable write path is
// harmless — no UI offers it now that this entry is gone.
export const CONFIG_FLAGS = [
  {
    id: 'flag.policyLedgerCampaignLens',
    key: 'policyLedgerCampaignLens',
    name: 'Policy Ledger campaign lens',
    desc: 'Adds the active campaign(s) to the agent Policy Ledger’s “Counts toward” award lens. Flag OFF ⇒ no campaign fetch and no campaign option; the month / quarter / annual / MDRT lens still shows.',
    storage: { docId: 'settings', keyPath: 'featureFlags.policyLedgerCampaignLens', mode: 'flag' },
    source: 'src/services/featureFlagsService.js:32-35 + src/components/agent/policyLedger/AwardLensPanel.jsx:34',
  },
  {
    id: 'flag.awardsProvenance',
    key: 'awardsProvenance',
    name: 'Awards provenance',
    desc: 'Shows the honest ledger-source chip and provenance drawer on Agent Awards (Policy Ledger vs. Confirmed Settlements). Flag OFF ⇒ chip and drawer panel absent.',
    storage: { docId: 'settings', keyPath: 'featureFlags.awardsProvenance', mode: 'flag' },
    source: 'src/services/featureFlagsService.js:32-35 + src/components/awards/AgentAwardsPanel.jsx:67',
  },
];

// ── Flat derivations (search + lookup), mirroring the prototype's shape ──────
export const ALL_ITEMS = [];
Object.entries(CONFIG_SECTIONS).forEach(([sectionKey, section]) => {
  section.groups.forEach((group) => {
    group.items.forEach((item) => {
      ALL_ITEMS.push({
        ...item,
        section: sectionKey,
        sectionLabel: section.label,
        group: group.title,
      });
    });
  });
});
CONFIG_FLAGS.forEach((f) => {
  ALL_ITEMS.push({
    id: f.id,
    label: f.name,
    desc: f.desc,
    type: 'flag',
    def: false,
    storage: f.storage,
    source: f.source,
    section: 'flags',
    sectionLabel: 'Feature Flags',
    group: 'FLAGS',
  });
});

export const ITEMS_BY_ID = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]));

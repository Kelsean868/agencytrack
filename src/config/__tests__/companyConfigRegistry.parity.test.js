// companyConfigRegistry.parity.test.js — asserts every backed default in the
// Company Config registry equals the REAL production constant it claims to
// mirror. Constants importable from src/ are asserted by deep-equal against
// the actual module; constants that live only in functions/ (Vitest cannot
// import CJS Cloud Functions modules cleanly) are asserted against a literal
// with a citation comment instead.

import { describe, it, expect } from 'vitest';
import {
  CONFIG_GROUPS,
  PHASE1_SECTIONS,
  CONFIG_SECTIONS,
  CONFIG_FLAGS,
  ALL_ITEMS,
  ITEMS_BY_ID,
} from '../companyConfigRegistry';

import { DEFAULT_TENURE_API_FLOORS } from '../../utils/tenureFloors';
import { PERS_GATE_PCT } from '../../lib/persistency/calculations';
import { FLOOR_PACE_DANGER, FLOOR_PACE_WARN } from '../../utils/managerExceptions';
import { PACE_ON_TRACK_FRACTION } from '../../utils/planVariance';
import { POINTS_WEIGHTS, LEVEL_THRESHOLDS } from '../../lib/gamificationConfig';
import {
  FILING_WEEKLY_STREAK_MILESTONES,
  DAILY_STREAK_MILESTONES,
  GOALS_WEEKLY_STREAK_MILESTONES,
} from '../../lib/celebrations';
import { DEFAULT_FINANCING_RULESET_2026 } from '../financingRuleset/2026';
import { MDRT_THRESHOLDS_2026 } from '../mdrtThresholds/2026';
import { CLAWBACK_DAYS, AT_RISK_DAYS } from '../../utils/clawbackClock';
import { PERSISTENCY_GATE_BANDS, GATE_BAND_RANGE_LABELS } from '../../utils/campaignEngine';
import { POLL_INTERVAL_MS } from '../../lib/kiosk/kioskConfig';
import { FEATURE_FLAG_KEYS } from '../../services/featureFlagsService';
import {
  NUMERIC_STANDARDS,
  BOOLEAN_STANDARDS,
  STANDARDS_ROLE_KEYS,
} from '../../services/managerActivityStandardsService';

describe('companyConfigRegistry — module shape', () => {
  it('exports the required top-level shape', () => {
    expect(Array.isArray(CONFIG_GROUPS)).toBe(true);
    expect(PHASE1_SECTIONS).toEqual(['targets', 'activity', 'awards', 'flags']);
    expect(typeof CONFIG_SECTIONS).toBe('object');
    expect(Array.isArray(CONFIG_FLAGS)).toBe(true);
    expect(Array.isArray(ALL_ITEMS)).toBe(true);
    expect(typeof ITEMS_BY_ID).toBe('object');
  });

  it('CONFIG_GROUPS matches the locked group/section map', () => {
    expect(CONFIG_GROUPS).toEqual([
      { g: 'Brand', keys: ['identity', 'org'] },
      { g: 'Standards', keys: ['targets', 'cadence', 'activity'] },
      { g: 'Recognition', keys: ['recognition', 'awards'] },
      { g: 'Operations', keys: ['financing', 'kiosk', 'policy'] },
      { g: 'Platform', keys: ['flags', 'data'] },
    ]);
  });

  it('every section referenced by CONFIG_GROUPS exists in CONFIG_SECTIONS', () => {
    const allKeys = CONFIG_GROUPS.flatMap((g) => g.keys);
    allKeys.forEach((key) => {
      expect(CONFIG_SECTIONS[key], `missing section "${key}"`).toBeTruthy();
    });
  });
});

describe('targets — tenure bands (src/utils/tenureFloors.js)', () => {
  it('matches DEFAULT_TENURE_API_FLOORS floor-for-floor, in sourceKeys order', () => {
    const item = ITEMS_BY_ID['targets.bands'];
    expect(item.sourceKeys).toEqual([
      'band0_lt12', 'band12_to_24', 'band25_to_36',
      'band37_to_48', 'band49_to_60', 'band_gt60',
    ]);
    item.def.forEach((row, i) => {
      const key = item.sourceKeys[i];
      expect(row.floor, `row ${i} (${key})`).toBe(DEFAULT_TENURE_API_FLOORS[key]);
    });
  });
});

describe('targets — company minimums (src/services/goalsService.js:60-62)', () => {
  // goalsService.getCompanyMinimums inlines these defaults (stored.annualAPI ?? 200000,
  // stored.annualApps ?? 42, stored.persistency ?? 90) rather than exporting named
  // constants, so this asserts against a literal citing the exact lines.
  it('targets.floor === 200000 (goalsService.js:60)', () => {
    expect(ITEMS_BY_ID['targets.floor'].def).toBe(200000);
  });
  it('targets.annualApps === 42 (goalsService.js:61)', () => {
    expect(ITEMS_BY_ID['targets.annualApps'].def).toBe(42);
  });
  // Line-number-free: goalsService's getCompanyMinimums now defaults this to
  // PERS_GATE_PCT, so the parity is against the constant, not a literal 90 that
  // could drift from it silently.
  it('targets.persistencyFloor === PERS_GATE_PCT (goalsService getCompanyMinimums default)', () => {
    expect(ITEMS_BY_ID['targets.persistencyFloor'].def).toBe(PERS_GATE_PCT);
  });
});

describe('targets — pace thresholds', () => {
  it('targets.pace matches FLOOR_PACE_WARN as a whole percent', () => {
    expect(ITEMS_BY_ID['targets.pace'].def).toBe(FLOOR_PACE_WARN * 100);
  });
  it('targets.danger matches FLOOR_PACE_DANGER as a whole percent', () => {
    expect(ITEMS_BY_ID['targets.danger'].def).toBe(FLOOR_PACE_DANGER * 100);
  });
  it('targets.onTrack matches PACE_ON_TRACK_FRACTION as a whole percent', () => {
    expect(ITEMS_BY_ID['targets.onTrack'].def).toBe(PACE_ON_TRACK_FRACTION * 100);
  });
  it('targets.mdrt matches MDRT_THRESHOLDS_2026.mdrt', () => {
    expect(ITEMS_BY_ID['targets.mdrt'].def).toBe(MDRT_THRESHOLDS_2026.mdrt);
  });
});

describe('activity — manager activity standards (src/services/managerActivityStandardsService.js)', () => {
  it('STANDARDS_ROLE_KEYS matches the three act.standards.<role> items', () => {
    STANDARDS_ROLE_KEYS.forEach((role) => {
      expect(ITEMS_BY_ID[`act.standards.${role}`], `missing act.standards.${role}`).toBeTruthy();
    });
  });

  it('each act.standards.<role> item carries all 8 real standard keys', () => {
    const expectedKeys = [...NUMERIC_STANDARDS, ...BOOLEAN_STANDARDS];
    STANDARDS_ROLE_KEYS.forEach((role) => {
      const item = ITEMS_BY_ID[`act.standards.${role}`];
      expect(item.standardKeys).toEqual(expectedKeys);
      expect(item.storage).toEqual({
        docId: 'managerActivityStandards',
        keyPath: role,
        mode: 'plain',
      });
      // Missing standard = "no standard set" (real default), not a fabricated value.
      expect(item.def).toBeNull();
    });
  });
});

describe('awards — ruleset item (src/config/awardsRuleset/2026.js)', () => {
  it('aw.ruleset defers its own value parity to awardsRulesetService’s tests', () => {
    const item = ITEMS_BY_ID['aw.ruleset'];
    expect(item.def).toBeNull();
    expect(item.storage).toEqual({ docId: 'awardsRuleset_2026', keyPath: '', mode: 'awards' });
  });

  it('aw.basis is the settled-only platform invariant', () => {
    const item = ITEMS_BY_ID['aw.basis'];
    expect(item.lock).toBe('platform');
    expect(item.value).toBe('SETTLED API ONLY');
  });
});

describe('flags — the 2 real allowlisted feature flags', () => {
  it('CONFIG_FLAGS keys match FEATURE_FLAG_KEYS exactly (same set)', () => {
    const configKeys = CONFIG_FLAGS.map((f) => f.key).sort();
    const realKeys = Object.values(FEATURE_FLAG_KEYS).sort();
    expect(configKeys).toEqual(realKeys);
  });

  it('each flag storage keyPath is featureFlags.<key> on the settings doc', () => {
    CONFIG_FLAGS.forEach((f) => {
      expect(f.storage).toEqual({
        docId: 'settings',
        keyPath: `featureFlags.${f.key}`,
        mode: 'flag',
      });
    });
  });
});

describe('recognition — points, levels, milestones', () => {
  it('rec.points matches POINTS_WEIGHTS exactly — same 21 keys, same values, same order', () => {
    const expected = Object.entries(POINTS_WEIGHTS).map(([key, pts]) => ({ key, pts }));
    expect(expected).toHaveLength(21);
    expect(ITEMS_BY_ID['rec.points'].def).toEqual(expected);
  });

  it('rec.levels matches LEVEL_THRESHOLDS exactly', () => {
    expect(ITEMS_BY_ID['rec.levels'].def).toEqual(LEVEL_THRESHOLDS);
  });

  it('rec.milestones.filing matches FILING_WEEKLY_STREAK_MILESTONES', () => {
    expect(ITEMS_BY_ID['rec.milestones.filing'].def).toEqual([...FILING_WEEKLY_STREAK_MILESTONES]);
  });
  it('rec.milestones.daily matches DAILY_STREAK_MILESTONES', () => {
    expect(ITEMS_BY_ID['rec.milestones.daily'].def).toEqual([...DAILY_STREAK_MILESTONES]);
  });
  it('rec.milestones.goals matches GOALS_WEEKLY_STREAK_MILESTONES', () => {
    expect(ITEMS_BY_ID['rec.milestones.goals'].def).toEqual([...GOALS_WEEKLY_STREAK_MILESTONES]);
  });

  // CF-only constant — functions/index.js:1485-1487 (addIfNew('streak_4') at
  // streak >= 4, streak_8 at >= 8, streak_13 at >= 13). Cannot import functions/
  // CJS from a Vitest src test, so this is a literal + citation.
  it('rec.streakBadges matches the CF streak-badge thresholds [4, 8, 13] (functions/index.js:1485-1487)', () => {
    expect(ITEMS_BY_ID['rec.streakBadges'].def).toEqual([4, 8, 13]);
  });
});

describe('recognition — campaign persistency gate (src/utils/campaignEngine.js)', () => {
  const GATE_ITEM_IDS = ['rec.gate.90', 'rec.gate.85', 'rec.gate.80', 'rec.gate.dq'];

  it('registers exactly one row per gate band, in band order', () => {
    expect(GATE_ITEM_IDS).toHaveLength(PERSISTENCY_GATE_BANDS.length);
    GATE_ITEM_IDS.forEach((id) => expect(ITEMS_BY_ID[id]).toBeDefined());
  });

  it('each row def is the real band payout label (the same label standings render)', () => {
    GATE_ITEM_IDS.forEach((id, i) => {
      expect(ITEMS_BY_ID[id].def).toBe(PERSISTENCY_GATE_BANDS[i].label);
    });
  });

  it('each row label carries the canonical range label for its band', () => {
    GATE_ITEM_IDS.forEach((id, i) => {
      expect(ITEMS_BY_ID[id].label).toBe(`Persistency ${GATE_BAND_RANGE_LABELS[i]}`);
    });
  });

  it('gate rows are read-only this run (lock: soon) — no write path exists for the gate', () => {
    GATE_ITEM_IDS.forEach((id) => {
      expect(ITEMS_BY_ID[id].lock).toBe('soon');
      expect(ITEMS_BY_ID[id].storage).toBeUndefined();
    });
  });
});

describe('financing — Track K 2026 ruleset (src/config/financingRuleset/2026.js)', () => {
  it('fin.quarterlyGrossMin matches quarterlyGrossMin', () => {
    expect(ITEMS_BY_ID['fin.quarterlyGrossMin'].def).toBe(DEFAULT_FINANCING_RULESET_2026.quarterlyGrossMin);
  });
  it('fin.persistencyY1 matches persistencyY1 as a whole percent', () => {
    expect(ITEMS_BY_ID['fin.persistencyY1'].def).toBe(DEFAULT_FINANCING_RULESET_2026.persistencyY1 * 100);
  });
  it('fin.persistencyY2 matches persistencyY2 as a whole percent', () => {
    expect(ITEMS_BY_ID['fin.persistencyY2'].def).toBe(DEFAULT_FINANCING_RULESET_2026.persistencyY2 * 100);
  });
  it('fin.consistencyRate matches consistencyRate as a whole percent', () => {
    expect(ITEMS_BY_ID['fin.consistencyRate'].def).toBe(DEFAULT_FINANCING_RULESET_2026.consistencyRate * 100);
  });
  it('fin.productionRateY1 matches productionRateY1 as a whole percent', () => {
    expect(ITEMS_BY_ID['fin.productionRateY1'].def).toBe(DEFAULT_FINANCING_RULESET_2026.productionRateY1 * 100);
  });
  it('fin.productionRateY2 matches productionRateY2 as a whole percent', () => {
    expect(ITEMS_BY_ID['fin.productionRateY2'].def).toBe(DEFAULT_FINANCING_RULESET_2026.productionRateY2 * 100);
  });
});

describe('kiosk — poll interval (src/lib/kiosk/kioskConfig.js:57)', () => {
  it('kio.poll matches POLL_INTERVAL_MS converted to minutes', () => {
    expect(ITEMS_BY_ID['kio.poll'].def).toBe(POLL_INTERVAL_MS / 60000);
  });
});

describe('policy — clawback clock (src/utils/clawbackClock.js:22-23)', () => {
  it('pol.clawback matches CLAWBACK_DAYS', () => {
    expect(ITEMS_BY_ID['pol.clawback'].def).toBe(CLAWBACK_DAYS);
  });
  it('pol.atrisk matches AT_RISK_DAYS', () => {
    expect(ITEMS_BY_ID['pol.atrisk'].def).toBe(AT_RISK_DAYS);
  });
});

describe('registry-wide invariants', () => {
  it('every non-platform item has either a source citation or is marked unbacked', () => {
    const offenders = ALL_ITEMS.filter(
      (item) => item.lock !== 'platform' && !item.source && item.unbacked !== true,
    );
    expect(offenders.map((i) => i.id)).toEqual([]);
  });

  it('every storage.docId is one of the three real config docs', () => {
    const allowed = new Set(['settings', 'managerActivityStandards', 'awardsRuleset_2026']);
    const offenders = ALL_ITEMS
      .filter((item) => item.storage)
      .filter((item) => !allowed.has(item.storage.docId));
    expect(offenders.map((i) => ({ id: i.id, docId: i.storage.docId }))).toEqual([]);
  });

  // Array-rendered list types — every list-consuming control in ConfigControls.jsx
  // (TextChips/MilestoneChips/BandsTable/PointsTable) calls value.map() and must
  // never receive `null`/`undefined`. 'standards' and 'awardsRuleset' are
  // deliberately excluded: 'standards' is a per-role object map (or unset — see
  // ActivityStandardsEditor's `value || {}` guard), and 'awardsRuleset' is a
  // bypass marker CompanyConfigSurface never actually renders through the
  // generic control dispatcher. Neither has array semantics.
  const ARRAY_LIST_TYPES = new Set(['textchips', 'milestones', 'bands', 'points']);

  it('unbacked items render as null (scalar) or [] (list-typed) — never a fabricated value', () => {
    const offenders = ALL_ITEMS.filter((item) => {
      if (item.unbacked !== true) return false;
      if (ARRAY_LIST_TYPES.has(item.type)) return !(Array.isArray(item.def) && item.def.length === 0);
      return item.def !== null;
    });
    expect(offenders.map((i) => i.id)).toEqual([]);
  });

  it('no array-rendered list-typed item has a null/undefined default (Run 5.1 org.levels crash)', () => {
    const offenders = ALL_ITEMS.filter(
      (item) => ARRAY_LIST_TYPES.has(item.type) && !Array.isArray(item.def),
    );
    expect(offenders.map((i) => ({ id: i.id, type: i.type, def: i.def }))).toEqual([]);
  });

  it('ALL_ITEMS and ITEMS_BY_ID stay in sync (no duplicate ids)', () => {
    expect(ALL_ITEMS.length).toBe(Object.keys(ITEMS_BY_ID).length);
  });
});

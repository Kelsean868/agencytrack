import { describe, it, expect } from 'vitest';
import {
  resolveTier,
  resolveTierProgress,
  accommodationLabel,
  ACCOMMODATION_LABELS,
  submissionTotals,
} from '../campaignEngine';

// ─── C2 · the level in reach, and one tier derivation for both surfaces ──────
//
// Item 6: progress must be measured against the level the advisor is working
// toward, never the ladder's ceiling. On live data the operator sits at
// TTD 73,946 — 27% of the way to Champion (275,000), the level that decides
// whether he travels at all — which a ceiling-based bar renders as 9% of
// Pioneer's 825,000, a level he has never been shown.
//
// Item 7: HomeV2's CampaignCard and the policy ledger's CampaignLensPanel read
// different collections. Their INPUTS may differ; their DERIVATION may not.

// Table 1 of the signed document, verbatim.
const TABLE_1 = [
  { level: 1, name: 'Champion', api: 275_000, apps: 35, cash: 7_000,  accommodation: 'shared' },
  { level: 2, name: 'VIP',      api: 375_000, apps: 35, cash: 20_000, accommodation: 'single' },
  { level: 3, name: 'Premier',  api: 475_000, apps: 35, cash: 30_000, accommodation: 'single' },
  { level: 4, name: 'Elite',    api: 675_000, apps: 35, cash: 52_000, accommodation: 'double' },
  { level: 5, name: 'Pioneer',  api: 825_000, apps: 35, cash: 70_000, accommodation: 'double' },
];

describe('C2 — resolveTierProgress: the operator today', () => {
  // The exact figures the live ledger carries, from
  // verification/campaign-lens-reproduces-count.mjs.
  const LIVE_API = 73_946.28;
  const LIVE_APPS = 3;

  it('reaches no tier and names Champion as the level in reach', () => {
    const p = resolveTierProgress(LIVE_API, LIVE_APPS, TABLE_1);
    expect(p.tierReached).toBeNull();
    expect(p.tierNext.name).toBe('Champion');
    expect(p.atTop).toBe(false);
  });

  it('measures progress against Champion, not Pioneer', () => {
    const p = resolveTierProgress(LIVE_API, LIVE_APPS, TABLE_1);
    expect(p.progressTarget.api).toBe(275_000);
    expect(p.progressTarget.apps).toBe(35);
    // The whole point: 27% of the level that matters, not 9% of one he has
    // never been shown.
    expect(Math.round((LIVE_API / p.progressTarget.api) * 100)).toBe(27);
    expect(Math.round((LIVE_API / 825_000) * 100)).toBe(9);
  });

  it('states both gaps, so the binding constraint is visible', () => {
    const p = resolveTierProgress(LIVE_API, LIVE_APPS, TABLE_1);
    expect(p.apiToGo).toBeCloseTo(201_053.72, 2);
    expect(p.appsToGo).toBe(32);
  });

  it('names the room the next level carries', () => {
    const p = resolveTierProgress(LIVE_API, LIVE_APPS, TABLE_1);
    expect(accommodationLabel(p.tierNext.accommodation)).toBe('Shared');
  });
});

describe('C2 — resolveTierProgress: climbing the ladder', () => {
  const at = (api, apps) => resolveTierProgress(api, apps, TABLE_1);

  it('exactly clearing Champion reaches Champion and points at VIP', () => {
    const p = at(275_000, 35);
    expect(p.tierReached.name).toBe('Champion');
    expect(p.tierNext.name).toBe('VIP');
    expect(p.apiToGo).toBe(100_000);
    expect(p.appsToGo).toBe(0);
  });

  it('clearing the API but not the apps reaches nothing — both minimums bind', () => {
    const p = at(900_000, 34);
    expect(p.tierReached).toBeNull();
    expect(p.tierNext.name).toBe('Champion');
    expect(p.apiToGo).toBe(0);      // API is already past Champion
    expect(p.appsToGo).toBe(1);     // applications are what is short
  });

  it('at Pioneer there is no next rung and progress is against Pioneer itself', () => {
    const p = at(900_000, 40);
    expect(p.tierReached.name).toBe('Pioneer');
    expect(p.tierNext).toBeNull();
    expect(p.atTop).toBe(true);
    expect(p.progressTarget.name).toBe('Pioneer');
    expect(p.apiToGo).toBe(0);
    expect(p.appsToGo).toBe(0);
  });

  it('mid-ladder points at exactly the next rung, never two rungs up', () => {
    expect(at(500_000, 35).tierReached.name).toBe('Premier');
    expect(at(500_000, 35).tierNext.name).toBe('Elite');
  });

  it('agrees with resolveTier on tierReached at every rung', () => {
    for (const [api, apps] of [[0, 0], [275_000, 35], [400_000, 35], [900_000, 40], [275_000, 34]]) {
      const direct = resolveTier(api, apps, TABLE_1);
      expect(resolveTierProgress(api, apps, TABLE_1).tierReached).toBe(direct);
    }
  });

  it('abstains cleanly on an empty or missing ladder', () => {
    for (const tiers of [[], null, undefined]) {
      const p = resolveTierProgress(100, 5, tiers);
      expect(p.tierReached).toBeNull();
      expect(p.tierNext).toBeNull();
      expect(p.progressTarget).toBeNull();
      expect(p.apiToGo).toBeNull();
      expect(p.appsToGo).toBeNull();
    }
  });

  it('never returns a negative gap', () => {
    const p = resolveTierProgress(10_000_000, 999, TABLE_1);
    expect(p.apiToGo).toBe(0);
    expect(p.appsToGo).toBe(0);
  });
});

describe('C2 — accommodation', () => {
  it('labels the three known values and nothing else', () => {
    expect(accommodationLabel('shared')).toBe('Shared');
    expect(accommodationLabel('single')).toBe('Single');
    expect(accommodationLabel('double')).toBe('Double');
    expect(Object.keys(ACCOMMODATION_LABELS)).toEqual(['shared', 'single', 'double']);
  });

  it('returns null rather than inventing a label', () => {
    expect(accommodationLabel(null)).toBeNull();
    expect(accommodationLabel(undefined)).toBeNull();
    expect(accommodationLabel('penthouse')).toBeNull();
    expect(accommodationLabel('')).toBeNull();
  });

  it('never affects qualification — resolveTier ignores it entirely', () => {
    const withRooms = TABLE_1;
    const without = TABLE_1.map(({ accommodation: _a, ...rest }) => rest);
    expect(resolveTier(400_000, 35, withRooms).name).toBe(resolveTier(400_000, 35, without).name);
  });
});

describe('C2 — submissionTotals (the shared adder)', () => {
  const sub = (apiSold, applicationsSold) => ({ apiSold, applicationsSold });

  it('totals API and apps across submissions', () => {
    const t = submissionTotals([sub(10_000, 3), sub(5_500, 2)]);
    expect(t.apiTotal).toBe(15_500);
    expect(t.appsTotal).toBe(5);
  });

  it('treats a missing or unparseable field as zero, never NaN', () => {
    const t = submissionTotals([sub(undefined, undefined), sub('abc', null), sub('7500', '2')]);
    expect(t.apiTotal).toBe(7_500);
    expect(t.appsTotal).toBe(2);
  });

  it('returns zeroes for an empty or non-array input', () => {
    for (const input of [[], null, undefined, 'nope']) {
      expect(submissionTotals(input)).toEqual({ apiTotal: 0, appsTotal: 0 });
    }
  });
});

describe('C2 item 7 — the two surfaces cannot drift', () => {
  // The surfaces read different collections, so their inputs differ. What must
  // NOT differ is the derivation: given the same pair of figures, both resolve
  // the same tier, because both call resolveTierProgress.
  it('the same figures resolve identically however they were obtained', () => {
    const fromSubmissions = submissionTotals([{ apiSold: 73_946.28, applicationsSold: 3 }]);
    const fromLedger = { apiTotal: 73_946.28, appsTotal: 3 };

    const a = resolveTierProgress(fromSubmissions.apiTotal, fromSubmissions.appsTotal, TABLE_1);
    const b = resolveTierProgress(fromLedger.apiTotal, fromLedger.appsTotal, TABLE_1);

    expect(a.tierReached).toBe(b.tierReached);
    expect(a.tierNext).toBe(b.tierNext);
    expect(a.progressTarget).toBe(b.progressTarget);
  });
});

import { describe, it, expect } from 'vitest';
import {
  FUNNEL_STATUS_OPTS,
  FUNNEL_STATUS_KEYS,
  exceptionToStatusKey,
  latestPersistency,
  buildStatusMap,
} from '../funnelStatus';
import { PERS_FLOOR } from '../../lib/persistency/calculations';
import { DEFAULT_TENURE_API_FLOORS } from '../tenureFloors';

// ── Fixture builders ────────────────────────────────────────────────────────
// `now` is pinned mid-year so the pro-rata pace fraction is a known constant:
// 2026-07-02 → 182 days elapsed of 365 → yearFraction = 182/365 ≈ 0.49863.
const NOW = new Date('2026-07-02T12:00:00Z');
const YEAR_FRAC = 182 / 365;

const COMPANY_MINS = { tenureApiFloors: DEFAULT_TENURE_API_FLOORS };

// A > 60-month agent → band_gt60 → 500,000 annual floor.
const VETERAN_START = '2018-01-15';
const VETERAN_FLOOR = DEFAULT_TENURE_API_FLOORS.band_gt60; // 500000
const VETERAN_PACE = VETERAN_FLOOR * YEAR_FRAC;            // ≈ 249,315

function agent(id, extra = {}) {
  return { id, role: 'agent', contractStartDate: VETERAN_START, ...extra };
}

// extractTotalProductionCredit is v2-first: it returns the stored
// `totalProductionCredit` field verbatim when present (extractFields.js:174).
function sub(agentId, weekStarting, api) {
  return { agentId, weekStarting, status: 'submitted', totalProductionCredit: api };
}

// Sanity-check the fixture's assumed credit extraction before relying on it.
describe('fixture sanity', () => {
  it('a single submission credits its full API (non-vacuous fixtures)', () => {
    const map = buildStatusMap({
      users: [agent('a1')],
      ytdSubs: [sub('a1', '2026-06-28', VETERAN_PACE * 2)],
      companyMins: COMPANY_MINS,
      now: NOW,
    });
    // Double the pace target must NOT be a pace exception — proves the fixture's
    // API actually reaches the derivation.
    expect(map.a1).toBe('ontrack');
  });
});

describe('FUNNEL_STATUS_OPTS', () => {
  it('carries the six mockup bands, in the mockup order', () => {
    expect(FUNNEL_STATUS_OPTS.map(([k]) => k)).toEqual([
      'ontrack', 'pace', 'quiet', 'report', 'persistency', 'floor',
    ]);
    expect(FUNNEL_STATUS_OPTS.map(([, l]) => l)).toEqual([
      'On track', 'Off pace', 'Gone quiet', 'Report late', 'Pers. ↓', 'Below floor',
    ]);
  });
});

describe('exceptionToStatusKey', () => {
  it('maps each shipped exception shape to its band', () => {
    expect(exceptionToStatusKey({ type: 'floor', kind: 'Below floor' })).toBe('floor');
    expect(exceptionToStatusKey({ type: 'pace', kind: 'Off pace' })).toBe('pace');
    expect(exceptionToStatusKey({ type: 'report', kind: 'No reports' })).toBe('quiet');
    expect(exceptionToStatusKey({ type: 'report', kind: 'Report late' })).toBe('report');
  });

  // NEGATIVE CONTROL — an unmapped shape must return null, never a default band.
  it('returns null for unknown types and unknown report kinds', () => {
    expect(exceptionToStatusKey(null)).toBeNull();
    expect(exceptionToStatusKey({ type: 'persistency' })).toBeNull();
    expect(exceptionToStatusKey({ type: 'report', kind: 'Some future kind' })).toBeNull();
  });
});

describe('latestPersistency', () => {
  it('returns the most recent month by (year, month), not array order', () => {
    const recs = [
      { year: 2026, month: 3, persistency: 0.95 },
      { year: 2026, month: 11, persistency: 0.61 },
      { year: 2025, month: 12, persistency: 0.99 },
    ];
    expect(latestPersistency(recs)).toBe(0.61);
  });

  it('crosses the year boundary correctly (Jan beats prior Dec)', () => {
    expect(latestPersistency([
      { year: 2025, month: 12, persistency: 0.50 },
      { year: 2026, month: 1, persistency: 0.97 },
    ])).toBe(0.97);
  });

  // NEGATIVE CONTROLS — absent/garbage never becomes a value.
  it('returns null for empty, non-array, and unusable records', () => {
    expect(latestPersistency([])).toBeNull();
    expect(latestPersistency(undefined)).toBeNull();
    expect(latestPersistency(null)).toBeNull();
    expect(latestPersistency([{ year: 'x', month: 2, persistency: 0.4 }])).toBeNull();
    expect(latestPersistency([{ year: 2026, month: 2 }])).toBeNull();
  });
});

describe('buildStatusMap — band boundaries (value-level)', () => {
  // deriveExceptions thresholds: ratio = ytdApi / (floor * yearFraction)
  //   ratio < 0.50 → 'floor' · ratio < 0.85 → 'pace' · else clean
  const week = '2026-06-28';

  function bandFor(ytdApi) {
    return buildStatusMap({
      users: [agent('a1')],
      ytdSubs: [sub('a1', week, ytdApi)],
      companyMins: COMPANY_MINS,
      now: NOW,
    }).a1;
  }

  it('below 50% of pro-rata pace → floor', () => {
    expect(bandFor(VETERAN_PACE * 0.40)).toBe('floor');
  });

  it('just under the 50% boundary is still floor; at 50% it is pace', () => {
    expect(bandFor(VETERAN_PACE * 0.499)).toBe('floor');
    expect(bandFor(VETERAN_PACE * 0.50)).toBe('pace');   // boundary is exclusive
  });

  it('between 50% and 85% → pace', () => {
    expect(bandFor(VETERAN_PACE * 0.70)).toBe('pace');
  });

  it('just under the 85% boundary is pace; at 85% it is clean', () => {
    expect(bandFor(VETERAN_PACE * 0.849)).toBe('pace');
    expect(bandFor(VETERAN_PACE * 0.85)).toBe('ontrack');
  });

  it('at or above 85% of pace → ontrack', () => {
    expect(bandFor(VETERAN_PACE * 1.20)).toBe('ontrack');
  });

  // NEGATIVE CONTROL — the tenure floor must actually drive the band. A rookie
  // (<12 months → 150,000 floor) clears with API that sinks a veteran.
  it('the SAME API bands differently by tenure band', () => {
    const rookiePace = DEFAULT_TENURE_API_FLOORS.band0_lt12 * YEAR_FRAC;
    const api = rookiePace * 0.95; // ≈ 71,020 — clean for a rookie
    const map = buildStatusMap({
      users: [
        agent('rookie', { contractStartDate: '2026-02-01' }),
        agent('vet'),
      ],
      ytdSubs: [sub('rookie', week, api), sub('vet', week, api)],
      companyMins: COMPANY_MINS,
      now: NOW,
    });
    expect(map.rookie).toBe('ontrack');
    expect(map.vet).toBe('floor'); // same money, ~29% of a veteran's pace
  });
});

describe('buildStatusMap — report bands', () => {
  it('an agent who has filed nothing while the branch has → quiet', () => {
    const map = buildStatusMap({
      users: [agent('filer'), agent('silent')],
      ytdSubs: [sub('filer', '2026-06-28', 400000)],
      companyMins: COMPANY_MINS,
      now: NOW,
    });
    expect(map.silent).toBe('quiet');
  });

  it('an on-pace agent who missed the latest branch week → report', () => {
    const map = buildStatusMap({
      users: [agent('current'), agent('late')],
      ytdSubs: [
        sub('current', '2026-06-28', 400000),
        sub('late', '2026-06-21', 400000), // on pace, but not the latest week
      ],
      companyMins: COMPANY_MINS,
      now: NOW,
    });
    expect(map.current).toBe('ontrack');
    expect(map.late).toBe('report');
  });

  // NEGATIVE CONTROL — with no branch activity at all there is no "latest week",
  // so nobody is flagged late for a week that never happened.
  it('no submissions anywhere → nobody is banded quiet or report', () => {
    const map = buildStatusMap({
      users: [agent('a1'), agent('a2')],
      ytdSubs: [],
      companyMins: COMPANY_MINS,
      now: NOW,
    });
    expect(map.a1).toBe('ontrack');
    expect(map.a2).toBe('ontrack');
  });
});

describe('buildStatusMap — persistency band', () => {
  const week = '2026-06-28';
  const clean = (id) => sub(id, week, 400000); // comfortably on pace

  it('latest persistency below PERS_FLOOR → persistency', () => {
    const map = buildStatusMap({
      users: [agent('a1')],
      ytdSubs: [clean('a1')],
      companyMins: COMPANY_MINS,
      persistencyByAgent: { a1: [{ year: 2026, month: 5, persistency: PERS_FLOOR - 0.01 }] },
      now: NOW,
    });
    expect(map.a1).toBe('persistency');
  });

  // Boundary: PERS_FLOOR itself is NOT below floor.
  it('persistency exactly at PERS_FLOOR is clean', () => {
    const map = buildStatusMap({
      users: [agent('a1')],
      ytdSubs: [clean('a1')],
      companyMins: COMPANY_MINS,
      persistencyByAgent: { a1: [{ year: 2026, month: 5, persistency: PERS_FLOOR }] },
      now: NOW,
    });
    expect(map.a1).toBe('ontrack');
  });

  // NEGATIVE CONTROL — an absent persistency reading is not a failing one.
  it('no persistency record leaves the agent ontrack', () => {
    const map = buildStatusMap({
      users: [agent('a1')],
      ytdSubs: [clean('a1')],
      companyMins: COMPANY_MINS,
      persistencyByAgent: { other: [{ year: 2026, month: 5, persistency: 0.10 }] },
      now: NOW,
    });
    expect(map.a1).toBe('ontrack');
  });

  it('a production band outranks a persistency band on the same agent', () => {
    const map = buildStatusMap({
      users: [agent('a1')],
      ytdSubs: [sub('a1', week, 1000)], // deep below floor
      companyMins: COMPANY_MINS,
      persistencyByAgent: { a1: [{ year: 2026, month: 5, persistency: 0.10 }] },
      now: NOW,
    });
    expect(map.a1).toBe('floor');
  });
});

describe('buildStatusMap — scope and shape', () => {
  it('only agents are banded; managers are absent from the map', () => {
    const map = buildStatusMap({
      users: [agent('a1'), { id: 'um1', role: 'unit_manager' }],
      ytdSubs: [sub('a1', '2026-06-28', 400000)],
      companyMins: COMPANY_MINS,
      now: NOW,
    });
    expect(map.a1).toBe('ontrack');
    expect('um1' in map).toBe(false);
  });

  it('scopeIds excludes out-of-scope agents entirely', () => {
    const map = buildStatusMap({
      users: [agent('in'), agent('out')],
      ytdSubs: [sub('in', '2026-06-28', 400000)],
      companyMins: COMPANY_MINS,
      scopeIds: new Set(['in']),
      now: NOW,
    });
    expect(map.in).toBe('ontrack');
    expect('out' in map).toBe(false);
  });

  it('every produced value is a declared band key', () => {
    const map = buildStatusMap({
      users: [agent('a'), agent('b'), agent('c')],
      ytdSubs: [sub('a', '2026-06-28', 400000), sub('b', '2026-06-21', 1000)],
      companyMins: COMPANY_MINS,
      persistencyByAgent: { a: [{ year: 2026, month: 5, persistency: 0.5 }] },
      now: NOW,
    });
    Object.values(map).forEach((v) => expect(FUNNEL_STATUS_KEYS).toContain(v));
  });

  it('empty input yields an empty map, not a throw', () => {
    expect(buildStatusMap()).toEqual({});
    expect(buildStatusMap({ users: [], ytdSubs: [] })).toEqual({});
  });
});

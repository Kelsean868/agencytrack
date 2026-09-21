import { describe, it, expect } from 'vitest';
import { computeAgentAwards } from '../awardsEngine';

// ─── C4 · Rule 10, award cash suppression ────────────────────────────────────
//
// "This campaign overrides all other campaigns and incentives in progress - no
// cash for Agent of the Month or Agent/Manager of the Quarter. Recognition
// only." (page 4 of the signed document.)
//
// The awards are STILL WON. Only the cash is withheld. Removing eligibility
// would erase the recognition the document explicitly keeps, so `eligible`,
// `inContention` and every criterion must be byte-identical with and without a
// flagged campaign — this file asserts exactly that.

const CHRISTMAS = {
  id: 'xmas26',
  name: 'Christmas Campaign and Retreat 2026',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  suppressesAwardCash: true,
};

const UNFLAGGED = { ...CHRISTMAS, id: 'other', name: 'Some other campaign', suppressesAwardCash: false };

const PROFILE = { monthsInIndustry: 40, monthsAtTatil: 40, isBdoDso: false };

/** Settlements big enough that the four advisor awards are genuinely eligible.
 *  `persistency` is a WHOLE-NUMBER percent here: ruleset persistGate is 90. */
const settlements = (periodKeys) => periodKeys.map((periodKey) => ({
  periodKey, settledAPI: 400_000, settledApps: 40, persistency: 97,
}));

const AWARD_IDS = ['advisor_month_api', 'advisor_month_apps', 'quarterly_api', 'quarterly_apps'];

function awardsAt(dateStr, campaigns) {
  // Q4 2026: October, November, December.
  const conf = settlements(['2026-10', '2026-11', '2026-12']);
  return computeAgentAwards(conf, [], PROFILE, dateStr, undefined, campaigns);
}

// computeAgentAwards already returns a flat map keyed by award id.
const byId = (result) => result ?? {};

describe('C4 — Rule 10 turns the prize string, and only the prize string', () => {
  const suppressed = byId(awardsAt('2026-11-15', [CHRISTMAS]));
  const normal = byId(awardsAt('2026-11-15', []));

  it('renders "Recognition only" naming the campaign, on a month inside the window', () => {
    for (const id of AWARD_IDS) {
      if (!suppressed[id]) continue;
      expect(suppressed[id].prize, id).toBe(
        'Recognition only — cash suspended by Christmas Campaign and Retreat 2026',
      );
    }
  });

  it('leaves eligibility, contention and criteria untouched — the award is still won', () => {
    for (const id of AWARD_IDS) {
      if (!suppressed[id] || !normal[id]) continue;
      expect(suppressed[id].eligible, `${id} eligible`).toBe(normal[id].eligible);
      expect(suppressed[id].inContention, `${id} inContention`).toBe(normal[id].inContention);
      expect(suppressed[id].criteria, `${id} criteria`).toEqual(normal[id].criteria);
      expect(suppressed[id].progressPercent, `${id} progress`).toBe(normal[id].progressPercent);
    }
  });

  it('all four awards are PRESENT and at least one eligible — otherwise this proves nothing', () => {
    // Guards the guard. Every other assertion in this file skips an award it
    // cannot find, so a wrong id would make the whole file pass vacuously —
    // which is exactly what happened on the first run of this test.
    for (const id of AWARD_IDS) expect(suppressed[id], `missing award: ${id}`).toBeTruthy();
    expect(AWARD_IDS.filter((id) => suppressed[id].eligible).length).toBeGreaterThan(0);
  });

  it('says why in the note, so the prize string is not the only explanation', () => {
    const withNote = AWARD_IDS.map((id) => suppressed[id]).filter(Boolean);
    expect(withNote.length).toBeGreaterThan(0);
    for (const a of withNote) {
      expect(a.note).toContain('Cash suspended by Christmas Campaign and Retreat 2026');
      expect(a.note).toContain('the award is still won');
    }
  });
});

describe('C4 — Rule 10 applies only where it should', () => {
  it('does NOT suppress a month outside the campaign window', () => {
    const before = byId(computeAgentAwards(
      settlements(['2026-04', '2026-05', '2026-06']), [], PROFILE, '2026-05-15', undefined, [CHRISTMAS],
    ));
    for (const id of AWARD_IDS) {
      if (!before[id]) continue;
      expect(before[id].prize, id).not.toContain('Recognition only');
    }
  });

  it('does NOT suppress when the campaign lacks the flag', () => {
    const unflagged = byId(awardsAt('2026-11-15', [UNFLAGGED]));
    for (const id of AWARD_IDS) {
      if (!unflagged[id]) continue;
      expect(unflagged[id].prize, id).not.toContain('Recognition only');
    }
  });

  it('is entirely inert when no campaigns are passed — every existing caller is unchanged', () => {
    const withArg = byId(awardsAt('2026-11-15', []));
    const withoutArg = byId(computeAgentAwards(
      settlements(['2026-10', '2026-11', '2026-12']), [], PROFILE, '2026-11-15',
    ));
    expect(withArg).toEqual(withoutArg);
  });

  it('suppresses a quarter that OVERLAPS the campaign at all', () => {
    // Q3 2026 is Jul-Sep; the campaign opens 1 July, so the quarter is in
    // progress during it and the override applies.
    const q3 = byId(computeAgentAwards(
      settlements(['2026-07', '2026-08', '2026-09']), [], PROFILE, '2026-08-15', undefined, [CHRISTMAS],
    ));
    for (const id of ['quarterly_api', 'quarterly_apps']) {
      if (!q3[id]) continue;
      expect(q3[id].prize, id).toContain('Recognition only');
    }
  });

  it('falls back to a generic name rather than printing undefined', () => {
    const nameless = byId(awardsAt('2026-11-15', [{ ...CHRISTMAS, name: undefined }]));
    for (const id of AWARD_IDS) {
      if (!nameless[id]) continue;
      expect(nameless[id].prize, id).toBe('Recognition only — cash suspended by the active campaign');
    }
  });
});

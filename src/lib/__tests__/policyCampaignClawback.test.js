import { describe, it, expect } from 'vitest';
import { deriveClawback, genuineExitDate, derivePolicyLens } from '../policyCampaignLens';

// ─── C4 · Rule 9 claw-back, ruling R7 ────────────────────────────────────────
//
// Rule 9: policies lapsed, terminated or not taken within three months after the
// campaign (by March 2027) trigger a recalculation of the category and a
// claw-back of the prize.
//
// R7.1 is the load-bearing rule and the first fixture below is the one that
// proves it. The live tenant holds 109 exited policies; 87 of them are lapses
// issued years before the campaign. They can never be clawed back at ANY date,
// because they never counted. A scan that reaches them has applied the DATE
// filter before the COUNTED filter — that is the defect, not the dates.

const CHRISTMAS = {
  id: 'xmas26',
  name: 'Christmas Campaign and Retreat 2026',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  clawbackUntil: '2027-03-31',
  structure: 'qualify',
  tiers: [{ level: 1, name: 'Champion', api: 275_000, apps: 35, cash: 7_000, accommodation: 'shared' }],
  credit: { incPppAppThreshold: 2400 },
};

const policy = (over = {}) => ({
  id: 'p', productLine: 'life', isSelfOrFamily: false,
  newBusinessType: 'nb_ordinary', proposedAPI: 36_000,
  status: 'settled', dateIssued: '2026-08-04', ownerName: 'A Client',
  ...over,
});

describe('C4 — the five exit fixtures (the C4 deliverable)', () => {
  // ── 1. THE IMPORTANT ONE. This is the live 87-policy case. ────────────────
  it('1 · NON-counted policy that lapsed INSIDE the window — the counted-gate keeps it out', () => {
    const old = policy({
      id: 'old', importSource: 'oipa_import',
      dateIssued: '2019-03-02',          // years before the campaign
      status: 'lapsed',
      dateLapsed: '2027-02-10',          // squarely inside (endDate, clawbackUntil]
    });
    const { risk, unassessable } = deriveClawback([old], CHRISTMAS);
    // It lapsed in the claw-back window. It is STILL not flagged, because it
    // never earned campaign credit to claw back.
    expect(risk).toEqual([]);
    expect(unassessable).toEqual([]);
  });

  it('1b · the same policy IS reached if the date filter runs first — the ordering is the defence', () => {
    // A deliberately wrong implementation, kept here so the ordering claim is
    // demonstrated rather than asserted. This is what R7.1 forbids.
    const old = policy({ dateIssued: '2019-03-02', status: 'lapsed', dateLapsed: '2027-02-10' });
    const exit = genuineExitDate(old);
    const dateFirstWouldFlag = exit.date > CHRISTMAS.endDate && exit.date <= CHRISTMAS.clawbackUntil;
    expect(dateFirstWouldFlag).toBe(true);                    // date-first: FLAGGED
    expect(deriveClawback([old], CHRISTMAS).risk).toEqual([]); // counted-first: not
  });

  // ── 2. Counted, lapsed inside the claw-back window. ──────────────────────
  it('2 · counted policy lapsed IN the window, keyed on dateLapsed', () => {
    const p = policy({ id: 'in', status: 'lapsed', dateLapsed: '2027-01-15' });
    const { risk } = deriveClawback([p], CHRISTMAS);
    expect(risk).toHaveLength(1);
    expect(risk[0].dateBasis).toBe('event');
    expect(risk[0].exitDate).toBe('2027-01-15');
    expect(risk[0].apps).toBe(1);
    expect(risk[0].api).toBe(36_000);
    expect(risk[0].reason).toBe(
      'Lapsed 2027-01-15, inside the claw-back window — Sales Admin will recalculate your level',
    );
  });

  // ── 3. Counted, lapsed AFTER the window closes. ──────────────────────────
  it('3 · counted policy lapsed AFTER the window — not flagged', () => {
    const p = policy({ id: 'late', status: 'lapsed', dateLapsed: '2027-04-01' }); // one day past
    const { risk, unassessable } = deriveClawback([p], CHRISTMAS);
    expect(risk).toEqual([]);
    expect(unassessable).toEqual([]);
  });

  it('3b · and a lapse on the boundary day itself IS inside — the window is inclusive of clawbackUntil', () => {
    const p = policy({ id: 'edge', status: 'lapsed', dateLapsed: '2027-03-31' });
    expect(deriveClawback([p], CHRISTMAS).risk).toHaveLength(1);
    // while endDate itself is NOT: that is still the campaign, not the claw-back.
    const onEnd = policy({ id: 'onEnd', status: 'lapsed', dateLapsed: '2026-12-31' });
    expect(deriveClawback([onEnd], CHRISTMAS).risk).toEqual([]);
  });

  // ── 4. NTU. Never taken up, so it never went in force. ──────────────────
  it('4 · NTU issued in the window — never settled, so it never counted', () => {
    const p = policy({
      id: 'ntu', status: 'ntu',
      statusAsOf: '2027-02-01',        // the export date. Plays no part.
      statusUpdatedAt: '2027-02-01',   // the recording stamp. Plays no part.
    });
    const { risk, unassessable } = deriveClawback([p], CHRISTMAS);
    // Rule 7 credits policies "in force as at 31 Dec 2026". An NTU was never
    // taken up, so it was never in force and earned nothing to claw back.
    // No date reasoning is involved — the two date-ish fields above are
    // present precisely to show they change nothing.
    expect(risk).toEqual([]);
    expect(unassessable).toEqual([]);
  });

  // ── 5. Counted lapse with NO exit date — the live imported-lapse shape. ──
  it('5 · counted policy exited with NO exit date — unassessable, not counted and not vanished', () => {
    const p = policy({
      id: 'nodate', status: 'lapsed', importSource: 'oipa_import',
      statusAsOf: '2027-01-20',        // the OIPA export date. MUST be ignored.
    });
    const { risk, unassessable } = deriveClawback([p], CHRISTMAS);
    expect(risk).toEqual([]);
    expect(unassessable).toHaveLength(1);
    expect(unassessable[0].dateBasis).toBe('none');
    expect(unassessable[0].reason).toBe(
      'Exit date not recorded — cannot assess, check with Sales Administration',
    );
    // Its credit is carried, so the advisor is told WHAT is unassessable.
    expect(unassessable[0].apps).toBe(1);
    expect(unassessable[0].api).toBe(36_000);
  });
});

describe('C4 — R7.2: statusAsOf is refused, in code and in behaviour', () => {
  it('genuineExitDate reads dateLapsed and nothing else', () => {
    expect(genuineExitDate({ dateLapsed: '2027-01-15' })).toEqual({
      date: '2027-01-15', basis: 'event', field: 'dateLapsed',
    });
    expect(genuineExitDate({ statusAsOf: '2027-01-15' })).toBeNull();
    expect(genuineExitDate({ statusUpdatedAt: '2027-01-15' })).toBeNull();
    expect(genuineExitDate({ statusDate: '2027-01-15' })).toBeNull();
    expect(genuineExitDate({})).toBeNull();
  });

  it('the December-export scenario flags NOTHING — the failure R7.2 exists to prevent', () => {
    // The shape of the live book after an export lands in, say, January 2027:
    // statusAsOf moves to the new export date on EVERY policy at once.
    const book = Array.from({ length: 87 }, (_, i) => policy({
      id: `old${i}`, importSource: 'oipa_import',
      dateIssued: '2019-03-02', status: 'lapsed',
      statusAsOf: '2027-01-20',
    }));
    const { risk, unassessable } = deriveClawback(book, CHRISTMAS);
    expect(risk).toEqual([]);
    // And they are not silently swept into the unassessable list either: they
    // never counted, so they are not the advisor's problem at all.
    expect(unassessable).toEqual([]);
  });
});

describe('C4 — what is and is not an exit', () => {
  it('a denied application is NOT a claw-back exit — it never went in force', () => {
    const p = policy({ id: 'den', status: 'denied', dateLapsed: '2027-02-01' });
    const { risk, unassessable } = deriveClawback([p], CHRISTMAS);
    expect(risk).toEqual([]);
    expect(unassessable).toEqual([]);
  });

  it('a still-settled policy is not an exit', () => {
    expect(deriveClawback([policy({ status: 'settled' })], CHRISTMAS).risk).toEqual([]);
  });

  it('a self/family policy never counted, so it can never be clawed back', () => {
    const p = policy({ id: 'self', isSelfOrFamily: true, status: 'lapsed', dateLapsed: '2027-01-15' });
    expect(deriveClawback([p], CHRISTMAS).risk).toEqual([]);
  });

  it('a zero-credit category (SPIA) never counted either', () => {
    const p = policy({ id: 'spia', newBusinessType: 'spia', status: 'lapsed', dateLapsed: '2027-01-15' });
    const { risk, unassessable } = deriveClawback([p], CHRISTMAS);
    expect(risk).toEqual([]);
    expect(unassessable).toEqual([]);
  });

  it('abstains entirely when the campaign declares no clawbackUntil', () => {
    const p = policy({ status: 'lapsed', dateLapsed: '2027-01-15' });
    expect(deriveClawback([p], { ...CHRISTMAS, clawbackUntil: null }))
      .toEqual({ risk: [], unassessable: [] });
  });

  it('abstains on a legacy campaign with no credit table', () => {
    const p = policy({ status: 'lapsed', dateLapsed: '2027-01-15' });
    const legacy = { ...CHRISTMAS, credit: undefined };
    expect(deriveClawback([p], legacy)).toEqual({ risk: [], unassessable: [] });
  });
});

describe('C4 — the lens exposes both lists', () => {
  it('surfaces clawbackRisk and clawbackUnassessable', () => {
    const lens = derivePolicyLens([
      policy({ id: 'in', status: 'lapsed', dateLapsed: '2027-01-15' }),
      policy({ id: 'nodate', status: 'lapsed' }),
      policy({ id: 'counted' }),
    ], CHRISTMAS, {});
    expect(lens.clawbackRisk).toHaveLength(1);
    expect(lens.clawbackUnassessable).toHaveLength(1);
    // The surviving counted policy is unaffected by either list.
    expect(lens.apps.current).toBe(1);
  });

  it('both lists are EMPTY arrays, not undefined, when there is nothing to report', () => {
    const lens = derivePolicyLens([policy({ id: 'counted' })], CHRISTMAS, {});
    expect(lens.clawbackRisk).toEqual([]);
    expect(lens.clawbackUnassessable).toEqual([]);
  });
});

describe('C4 — an exit on or before endDate is a RULE 7 exclusion, not a Rule 9 claw-back', () => {
  // The boundary this whole gate turns on. Rule 7 credits policies in force at
  // the close; Rule 9 claws back policies that exit AFTER it. A policy that
  // left on or before 31 Dec was simply never in force at the close — it earned
  // nothing, so there is nothing to recalculate.

  it('a lapse DURING the campaign is excluded, not flagged', () => {
    const during = policy({ id: 'during', status: 'lapsed', dateLapsed: '2026-11-02' });
    const { risk, unassessable } = deriveClawback([during], CHRISTMAS);
    expect(risk).toEqual([]);
    expect(unassessable).toEqual([]);
  });

  it('a lapse ON endDate itself is still a Rule 7 exclusion', () => {
    const onEnd = policy({ id: 'onEnd', status: 'lapsed', dateLapsed: '2026-12-31' });
    expect(deriveClawback([onEnd], CHRISTMAS)).toEqual({ risk: [], unassessable: [] });
  });

  it('one day later is a claw-back candidate — it was in force at the close', () => {
    const dayAfter = policy({ id: 'after', status: 'lapsed', dateLapsed: '2027-01-01' });
    const { risk } = deriveClawback([dayAfter], CHRISTMAS);
    expect(risk).toHaveLength(1);
    expect(risk[0].dateBasis).toBe('event');
  });

  it('the live in-window NTU is out by status alone, at ANY statusAsOf', () => {
    // Dn2F5Xxp9n4YxYPI3crL, the tenant's single in-window exit. The verdict
    // must not move when a future export rewrites statusAsOf, so all three
    // values are asserted to give the same answer.
    const base = {
      id: 'Dn2F5Xxp9n4YxYPI3crL', productLine: 'life', isSelfOrFamily: false,
      newBusinessType: 'nb_ordinary', proposedAPI: 36_000,
      status: 'ntu', dateIssued: '2026-07-25', importSource: 'oipa_import',
    };
    for (const statusAsOf of ['2026-09-15', '2027-01-20', null]) {
      const { risk, unassessable } = deriveClawback([{ ...base, statusAsOf }], CHRISTMAS);
      expect(risk, `statusAsOf=${statusAsOf}`).toEqual([]);
      expect(unassessable, `statusAsOf=${statusAsOf}`).toEqual([]);
    }
  });

  it('a lapse with no date still reaches unassessable — the list is not dead code', () => {
    // It WAS in force once, which an NTU never was. We simply cannot tell when
    // it left, so the screen says so rather than guessing either way.
    const noDate = policy({ id: 'nodate', status: 'lapsed', statusAsOf: '2026-09-15' });
    const { risk, unassessable } = deriveClawback([noDate], CHRISTMAS);
    expect(risk).toEqual([]);
    expect(unassessable).toHaveLength(1);
    expect(unassessable[0].dateBasis).toBe('none');
  });

  it('no verdict anywhere depends on statusAsOf', () => {
    // Sweeps the whole fixture set across three export dates. If any statusAsOf
    // value changed any outcome, this fails.
    const fixtures = [
      policy({ id: 'a', status: 'lapsed', dateLapsed: '2027-01-15' }),   // risk
      policy({ id: 'b', status: 'lapsed', dateLapsed: '2026-11-02' }),   // Rule 7 exclusion
      policy({ id: 'c', status: 'lapsed' }),                              // unassessable
      policy({ id: 'd', status: 'ntu' }),                                 // never counted
      policy({ id: 'e', status: 'lapsed', dateIssued: '2019-03-02', dateLapsed: '2027-02-10' }),
    ];
    const shape = (out) => ({
      risk: out.risk.map((r) => r.id).sort(),
      unassessable: out.unassessable.map((u) => u.id).sort(),
    });
    const baseline = shape(deriveClawback(fixtures, CHRISTMAS));
    for (const statusAsOf of ['2026-09-15', '2027-01-20', '2027-03-30']) {
      const moved = fixtures.map((f) => ({ ...f, statusAsOf }));
      expect(shape(deriveClawback(moved, CHRISTMAS)), `statusAsOf=${statusAsOf}`).toEqual(baseline);
    }
    expect(baseline).toEqual({ risk: ['a'], unassessable: ['c'] });
  });
});

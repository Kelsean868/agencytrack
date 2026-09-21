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

  // ── 4. Counted NTU. There is no NTU event date, ever. ────────────────────
  it('4 · counted NTU in the window — unassessable, never guessed', () => {
    const p = policy({
      id: 'ntu', status: 'ntu',
      statusAsOf: '2027-02-01',        // the export date. MUST be ignored.
      statusUpdatedAt: '2027-02-01',   // the recording stamp. MUST be ignored.
    });
    const { risk, unassessable } = deriveClawback([p], CHRISTMAS);
    expect(risk).toEqual([]);
    expect(unassessable).toHaveLength(1);
    expect(unassessable[0].dateBasis).toBe('none');
    expect(unassessable[0].reason).toBe(
      'Not-taken-up date is never recorded — cannot assess, check with Sales Administration',
    );
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

describe('C4 — survived-to-close: an exit already recorded BEFORE the campaign closed', () => {
  // The live in-window case. One NTU, issued 2026-07-25, already `ntu` in the
  // 2026-09-15 export — three months before the campaign closes. It was never
  // in force at 31 Dec, so it never earned credit and there is nothing to claw
  // back. This is what makes the live scan report 0 / 0.
  const liveNtu = policy({
    id: 'Dn2F5Xxp9n4YxYPI3crL',
    importSource: 'oipa_import',
    status: 'ntu',
    dateIssued: '2026-07-25',
    proposedAPI: 36_000,
    statusAsOf: '2026-09-15',
  });

  it('is in neither list — it never counted at the close', () => {
    const { risk, unassessable } = deriveClawback([liveNtu], CHRISTMAS);
    expect(risk).toEqual([]);
    expect(unassessable).toEqual([]);
  });

  it('FAILS SAFE when a later export moves statusAsOf past endDate', () => {
    // After an export lands in 2027 the field moves and the test stops firing.
    // The policy then falls to "cannot assess" — never to "you are being
    // clawed back", because no exit date was ever invented for it.
    const afterExport = { ...liveNtu, statusAsOf: '2027-02-01' };
    const { risk, unassessable } = deriveClawback([afterExport], CHRISTMAS);
    expect(risk).toEqual([]);
    expect(unassessable).toHaveLength(1);
    expect(unassessable[0].dateBasis).toBe('none');
  });

  it('does not suppress an exit recorded AFTER the campaign closed', () => {
    const exitedAfter = { ...liveNtu, statusAsOf: '2027-01-05' };
    expect(deriveClawback([exitedAfter], CHRISTMAS).unassessable).toHaveLength(1);
  });

  it('still uses dateLapsed when there is one — statusAsOf never becomes the exit date', () => {
    const lapsed = policy({
      id: 'both', status: 'lapsed',
      statusAsOf: '2027-01-05',   // export date, later than the real event
      dateLapsed: '2027-01-15',   // the real event date
    });
    const { risk } = deriveClawback([lapsed], CHRISTMAS);
    expect(risk).toHaveLength(1);
    expect(risk[0].exitDate).toBe('2027-01-15'); // not 2027-01-05
    expect(risk[0].dateBasis).toBe('event');
  });
});

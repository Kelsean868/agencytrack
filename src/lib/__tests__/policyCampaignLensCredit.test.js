import { describe, it, expect } from 'vitest';
import {
  creditFor,
  policyContribution,
  derivePolicyLens,
  ledgerExportDate,
  RULE_7_CREDIT_TABLE,
  DEFAULT_INC_PPP_APP_THRESHOLD,
} from '../policyCampaignLens';

// ─── C3 · the Rule 7 production-credit table and the settlement window ───────
//
// Page 3 of the signed Christmas Campaign and Retreat 2026 document sets out
// six production categories, and they do NOT all earn one application and 100%
// of API. Before this slice every counting policy did, which meant a Platinum
// Edge policy contributed its full API to a target it is worth nothing toward,
// and a replacement contributed its whole new API rather than the difference.
//
// The window test changed too (C-D10): eligibility is decided by `dateIssued`
// plus status plus self/family — NEVER by `importSource`.

const CHRISTMAS = {
  id: 'xmas26',
  name: 'Christmas Campaign and Retreat 2026',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  structure: 'qualify',
  tiers: [
    { level: 1, name: 'Champion', api: 275_000, apps: 35, cash: 7_000,  accommodation: 'shared' },
    { level: 5, name: 'Pioneer',  api: 825_000, apps: 35, cash: 70_000, accommodation: 'double' },
  ],
  credit: { table: RULE_7_CREDIT_TABLE, incPppAppThreshold: 2400 },
};

// A campaign authored before this slice — no `credit` key at all.
const LEGACY = {
  id: 'legacy',
  name: 'Legacy campaign',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  structure: 'qualify',
  tiers: [{ level: 1, name: 'Bronze', api: 100_000, apps: 10, cash: 1_000 }],
};

const policy = (over = {}) => ({
  id: 'p1',
  productLine: 'life',
  status: 'settled',
  isSelfOrFamily: false,
  newBusinessType: 'nb_ordinary',
  proposedAPI: 10_000,
  dateIssued: '2026-08-15',
  dateWritten: '2026-08-01',
  ...over,
});

describe('C3 — creditFor: the seven-row Rule 7 fixture table (the C3 deliverable)', () => {
  // [label, policy overrides, expected apps, expected api, expected reason fragment]
  const TABLE = [
    ['nb_ordinary',
      { newBusinessType: 'nb_ordinary', proposedAPI: 24_000 },
      1, 24_000, 'full application and API credit'],

    ['inc_ppp at or above the 2,400 threshold',
      { newBusinessType: 'inc_ppp', proposedAPI: 2_400 },
      1, 2_400, 'at or above the application threshold'],

    ['inc_ppp below the 2,400 threshold',
      { newBusinessType: 'inc_ppp', proposedAPI: 2_399.99 },
      0, 2_399.99, 'below the application threshold'],

    ['replacement with a recorded replaced API',
      { newBusinessType: 'replacement', proposedAPI: 18_000, replacedPolicyAPI: 11_000 },
      0, 7_000, 'API difference only'],

    ['replacement with replacedPolicyAPI: null — ABSTAINS, never assumes zero',
      { newBusinessType: 'replacement', proposedAPI: 18_000, replacedPolicyAPI: null },
      0, 0, 'Replaced API not recorded'],

    ['spia',
      { newBusinessType: 'spia', proposedAPI: 500_000 },
      0, 0, 'no application or API credit'],

    ['lumpsum',
      { newBusinessType: 'lumpsum', proposedAPI: 250_000 },
      0, 0, 'no application or API credit'],

    ['platinum_edge — one application, NO API',
      { newBusinessType: 'platinum_edge', proposedAPI: 40_000 },
      1, 0, 'counts as an application, no API credit'],

    ['unknown newBusinessType — abstains, never defaults to ordinary',
      { newBusinessType: 'some_new_product', proposedAPI: 99_000 },
      0, 0, 'Unclassified new-business type'],

    ['absent newBusinessType — abstains',
      { newBusinessType: undefined, proposedAPI: 99_000 },
      0, 0, 'Unclassified new-business type'],
  ];

  it.each(TABLE)('%s → %i app(s), API %s', (_label, over, apps, api, reasonFragment) => {
    const c = creditFor(policy(over), CHRISTMAS);
    expect(c.apps).toBe(apps);
    expect(c.api).toBeCloseTo(api, 2);
    expect(c.reason).toContain(reasonFragment);
  });

  it('a replacement whose new API is BELOW the replaced API credits 0, never a negative', () => {
    const c = creditFor(
      policy({ newBusinessType: 'replacement', proposedAPI: 5_000, replacedPolicyAPI: 9_000 }),
      CHRISTMAS,
    );
    expect(c.api).toBe(0);
    expect(c.apps).toBe(0);
  });

  it('a replacement with replacedPolicyAPI: 0 credits the FULL new API — 0 is a real answer', () => {
    const c = creditFor(
      policy({ newBusinessType: 'replacement', proposedAPI: 18_000, replacedPolicyAPI: 0 }),
      CHRISTMAS,
    );
    expect(c.api).toBe(18_000);
    expect(c.reason).toContain('API difference only');
  });

  it('honours a campaign-configured inc_ppp threshold over the 2,400 default', () => {
    const custom = { ...CHRISTMAS, credit: { table: RULE_7_CREDIT_TABLE, incPppAppThreshold: 5_000 } };
    expect(creditFor(policy({ newBusinessType: 'inc_ppp', proposedAPI: 3_000 }), custom).apps).toBe(0);
    expect(creditFor(policy({ newBusinessType: 'inc_ppp', proposedAPI: 5_000 }), custom).apps).toBe(1);
  });

  it('falls back to the 2,400 default when the threshold is missing or unparseable', () => {
    const noThreshold = { ...CHRISTMAS, credit: { table: RULE_7_CREDIT_TABLE } };
    expect(DEFAULT_INC_PPP_APP_THRESHOLD).toBe(2400);
    expect(creditFor(policy({ newBusinessType: 'inc_ppp', proposedAPI: 2_400 }), noThreshold).apps).toBe(1);
    expect(creditFor(policy({ newBusinessType: 'inc_ppp', proposedAPI: 2_399 }), noThreshold).apps).toBe(0);
  });

  it('returns null for a campaign with no credit table, so legacy callers fall back', () => {
    expect(creditFor(policy(), LEGACY)).toBeNull();
    expect(creditFor(policy(), {})).toBeNull();
  });
});

describe('C3 — the settlement window (C-D10)', () => {
  it('counts a policy issued INSIDE the window that is settled', () => {
    const c = policyContribution(policy({ dateIssued: '2026-08-15' }), CHRISTMAS);
    expect(c.state).toBe('counts');
    expect(c.apps).toBe(1);
  });

  it('counts an IMPORTED policy issued inside the window — origin is not the test', () => {
    const imported = policy({ importSource: 'oipa_import', dateIssued: '2026-08-15' });
    const c = policyContribution(imported, CHRISTMAS);
    expect(c.state).toBe('counts');
    expect(c.value).toBe(10_000);
  });

  it('excludes a policy issued BEFORE the campaign, however it got there', () => {
    const c = policyContribution(
      policy({ importSource: 'oipa_import', dateIssued: '2019-04-02' }),
      CHRISTMAS,
    );
    expect(c.state).toBe('excluded');
    expect(c.reason).toBe('Issued before the campaign');
  });

  it('excludes a policy issued AFTER the cut-off', () => {
    const c = policyContribution(policy({ dateIssued: '2027-01-04' }), CHRISTMAS);
    expect(c.state).toBe('excluded');
    expect(c.reason).toBe('Issued after cut-off');
  });

  it('the window test is on dateIssued, NOT dateSubmitted — Close of Business', () => {
    // Submitted inside the window, issued after it. The signed document is
    // explicit that submitted-but-not-issued does not count.
    const c = policyContribution(
      policy({ dateSubmitted: '2026-12-20', dateIssued: '2027-01-15' }),
      CHRISTMAS,
    );
    expect(c.state).toBe('excluded');
    expect(c.reason).toBe('Issued after cut-off');
  });

  it('excludes self/family before anything else (Rule 3)', () => {
    const c = policyContribution(policy({ isSelfOrFamily: true }), CHRISTMAS);
    expect(c.state).toBe('excluded');
    expect(c.reason).toBe('Self / family — excluded');
  });

  it('excludes a lapsed or NTU policy', () => {
    expect(policyContribution(policy({ status: 'ntu' }), CHRISTMAS).reason).toBe('Policy lapsed / closed');
    expect(policyContribution(policy({ status: 'lapsed' }), CHRISTMAS).reason).toBe('Policy lapsed / closed');
  });

  it('leaves a settled policy with no issue date excluded, and says why', () => {
    const c = policyContribution(policy({ dateIssued: null }), CHRISTMAS);
    expect(c.state).toBe('excluded');
    expect(c.reason).toBe('No issue date recorded');
  });

  it('keeps the pending bucket meaning what it meant: in flight, not banked', () => {
    const c = policyContribution(policy({ status: 'submitted', dateIssued: null }), CHRISTMAS);
    expect(c.state).toBe('pending');
    expect(c.reason).toBe('Awaiting settlement');
    // value/apps (what actually counted) are untouched by L0 — still 0.
    expect(c.value).toBe(0);
    expect(c.apps).toBe(0);
  });

  it('moves a zero-credit category (SPIA) to EXCLUDED with its own reason', () => {
    const c = policyContribution(policy({ newBusinessType: 'spia' }), CHRISTMAS);
    expect(c.state).toBe('excluded');
    expect(c.reason).toContain('no application or API credit');
  });

  it('keeps Platinum Edge COUNTING even though its API credit is zero', () => {
    const c = policyContribution(policy({ newBusinessType: 'platinum_edge' }), CHRISTMAS);
    expect(c.state).toBe('counts');
    expect(c.apps).toBe(1);
    expect(c.value).toBe(0);
  });
});

describe('C3 — a legacy campaign is unchanged', () => {
  it('still uses the SUBMISSION window and still credits 1 app / full API', () => {
    const p = policy({ dateSubmitted: '2026-08-04', dateIssued: '2027-05-05' });
    const c = policyContribution(p, LEGACY);
    expect(c.state).toBe('counts');
    expect(c.value).toBe(10_000);
    expect(c.apps).toBe(1);
  });

  it('still excludes on the submission window with its original wording', () => {
    const p = policy({ dateSubmitted: '2025-01-01', dateWritten: '2025-01-01' });
    expect(policyContribution(p, LEGACY).reason).toBe('Outside campaign window');
  });

  it('still credits a SPIA as ordinary business, because no table applies', () => {
    const p = policy({ newBusinessType: 'spia', dateSubmitted: '2026-08-04' });
    expect(policyContribution(p, LEGACY).state).toBe('counts');
  });
});

describe('C3 — derivePolicyLens sums apps and API separately', () => {
  const policies = [
    policy({ id: 'a', newBusinessType: 'nb_ordinary',   proposedAPI: 24_000 }),
    policy({ id: 'b', newBusinessType: 'platinum_edge', proposedAPI: 40_000 }),
    policy({ id: 'c', newBusinessType: 'inc_ppp',       proposedAPI: 2_400 }),
    policy({ id: 'd', newBusinessType: 'spia',          proposedAPI: 90_000 }),
  ];

  it('counts 3 applications and TTD 26,400 of API from these four policies', () => {
    const lens = derivePolicyLens(policies, CHRISTMAS, {});
    expect(lens.apps.current).toBe(3);   // ordinary + platinum edge + inc_ppp
    expect(lens.api.current).toBe(26_400); // 24,000 + 0 + 2,400; SPIA contributes nothing
  });

  // AMENDED BY C2 ITEM 6. C3 took both targets from the ladder's TOP tier
  // (Pioneer, 825,000). Pairing them was right — an apps figure from one level
  // beside an API figure from another is not a single goal — but the ceiling is
  // the wrong denominator for an agent-facing bar: it renders the operator's
  // TTD 73,946 as 9% of a level he has never been shown, when he is 27% of the
  // way to Champion, the level that decides whether he travels at all.
  //
  // Both targets now come from `tierNext` — still the same tier as each other,
  // but the one in reach. With nothing cleared, that is Champion.
  it('takes both targets from the tier IN REACH, not the ladder ceiling', () => {
    const lens = derivePolicyLens(policies, CHRISTMAS, {});
    expect(lens.tierReached).toBeNull();
    expect(lens.tierNext.name).toBe('Champion');
    expect(lens.api.target).toBe(275_000);
    expect(lens.apps.target).toBe(35);
    expect(lens.creditTableApplied).toBe(true);
  });

  it('moves the target up a rung once a level is cleared', () => {
    const cleared = [
      policy({ id: 'x', newBusinessType: 'nb_ordinary', proposedAPI: 300_000 }),
      ...Array.from({ length: 34 }, (_, i) => policy({ id: `y${i}`, newBusinessType: 'platinum_edge', proposedAPI: 0 })),
    ];
    const lens = derivePolicyLens(cleared, CHRISTMAS, {});
    expect(lens.apps.current).toBe(35);
    expect(lens.tierReached.name).toBe('Champion');
    expect(lens.tierNext.name).toBe('Pioneer'); // the only other tier in this fixture
    expect(lens.api.target).toBe(825_000);
  });

  it('a legacy campaign reports no apps target and flags no credit table', () => {
    const lens = derivePolicyLens(policies, LEGACY, {});
    expect(lens.creditTableApplied).toBe(false);
    expect(lens.apps.target).toBe(10);
  });
});

describe('C3 — the as-at export stamp (C-D11)', () => {
  it('reads the newest exportDate off the policies themselves', () => {
    expect(ledgerExportDate([
      { exportDate: '2026-06-30' },
      { exportDate: '2026-09-15' },
      { exportDate: '2026-08-31' },
    ])).toBe('2026-09-15');
  });

  it('returns null rather than inventing a date when none is carried', () => {
    expect(ledgerExportDate([{ id: 'a' }, { id: 'b' }])).toBeNull();
    expect(ledgerExportDate(null)).toBeNull();
    expect(ledgerExportDate([])).toBeNull();
  });

  it('surfaces the stamp on the lens', () => {
    const lens = derivePolicyLens([policy({ exportDate: '2026-09-15' })], CHRISTMAS, {});
    expect(lens.exportDate).toBe('2026-09-15');
  });
});

describe('C2 item 7 — CampaignCard and CampaignLensPanel derive from ONE call', () => {
  // The real assertion, against real policy shapes, in the place where it can
  // fail. CampaignCard used to total WEEKLY SUBMISSIONS; the panel totalled the
  // ledger. On the operator's live account those read 0 / 0 and
  // TTD 73,946.28 / 3 respectively, and both surfaces rendered a
  // distance-to-Champion line from their own number.
  //
  // Both now call derivePolicyLens on the same unfiltered array, so the figures
  // and the tier pair are the same object graph, not two computations that
  // happen to agree.

  // The shape the live ledger actually carries: imported, settled, in window.
  const imported = (id, api) => policy({
    id, importSource: 'oipa_import', newBusinessType: 'nb_ordinary',
    proposedAPI: api, status: 'settled', dateIssued: '2026-08-04',
  });

  const LEDGER = [
    imported('a', 1_946.28),
    imported('b', 36_000),
    imported('c', 36_000),
    // The two the live account carries that must NOT count.
    policy({ id: 'self', importSource: 'oipa_import', isSelfOrFamily: true, proposedAPI: 40_000 }),
    policy({ id: 'ntu', importSource: 'oipa_import', status: 'ntu', proposedAPI: 12_000 }),
    // And the historical book, which is excluded by DATE, not by origin.
    policy({ id: 'old', importSource: 'oipa_import', dateIssued: '2019-03-02', proposedAPI: 88_000 }),
  ];

  it('reproduces the live figures from the ledger: 3 apps, TTD 73,946.28', () => {
    const lens = derivePolicyLens(LEDGER, CHRISTMAS, {});
    expect(lens.apps.current).toBe(3);
    expect(lens.api.current).toBeCloseTo(73_946.28, 2);
  });

  it('names the same tier pair both surfaces render', () => {
    const lens = derivePolicyLens(LEDGER, CHRISTMAS, {});
    expect(lens.tierReached).toBeNull();
    expect(lens.tierNext.name).toBe('Champion');
  });

  it('an EMPTY array — what excludeImported would have produced — reads 0/0', () => {
    // Why the card is handed the UNFILTERED array. Every policy above is
    // imported, so the filtered view is empty and the card would have told the
    // advisor he has nothing. This is the defect in one assertion.
    const lens = derivePolicyLens([], CHRISTMAS, {});
    expect(lens.apps.current).toBe(0);
    expect(lens.api.current).toBe(0);
    expect(lens.tierNext.name).toBe('Champion');
  });

  it('credits Platinum Edge as an application with no API — a submissions total could not', () => {
    const withPE = [...LEDGER, policy({
      id: 'pe', importSource: 'oipa_import', newBusinessType: 'platinum_edge',
      proposedAPI: 40_000, status: 'settled', dateIssued: '2026-09-01',
    })];
    const lens = derivePolicyLens(withPE, CHRISTMAS, {});
    expect(lens.apps.current).toBe(4);
    expect(lens.api.current).toBeCloseTo(73_946.28, 2); // API unchanged
  });
});

// L0 — the two-layer ring's "pending" would-be credit, settlement-window
// (credit-table) path. NEW fields only — value/apps/state of every
// contribution (pending included) are unchanged from the assertions above.
describe('L0 — pendingValue / pendingApps (settlement-window path)', () => {
  it('a submitted ordinary policy in the window earns its would-be full credit as pendingValue/pendingApps', () => {
    const c = policyContribution(policy({ status: 'submitted', newBusinessType: 'nb_ordinary', proposedAPI: 24_000 }), CHRISTMAS);
    expect(c.state).toBe('pending');
    expect(c.pendingValue).toBe(24_000);
    expect(c.pendingApps).toBe(1);
    expect(c.value).toBe(0); // unchanged
    expect(c.apps).toBe(0); // unchanged
  });

  it('a submitted Platinum Edge earns pendingApps 1 / pendingValue 0, same as if it had settled', () => {
    const c = policyContribution(policy({ status: 'submitted', newBusinessType: 'platinum_edge', proposedAPI: 40_000 }), CHRISTMAS);
    expect(c.pendingApps).toBe(1);
    expect(c.pendingValue).toBe(0);
  });

  it('a submitted SPIA earns nothing pending either (0/0 under the same table)', () => {
    const c = policyContribution(policy({ status: 'submitted', newBusinessType: 'spia', proposedAPI: 90_000 }), CHRISTMAS);
    expect(c.pendingValue).toBe(0);
    expect(c.pendingApps).toBe(0);
  });

  it('a pending policy with no issue date still gets a would-be credit (creditFor does not need dateIssued)', () => {
    const c = policyContribution(policy({ status: 'submitted', dateIssued: null, newBusinessType: 'nb_ordinary', proposedAPI: 10_000 }), CHRISTMAS);
    expect(c.state).toBe('pending');
    expect(c.pendingValue).toBe(10_000);
    expect(c.pendingApps).toBe(1);
  });

  it('derivePolicyLens rolls pending contributions up into lens.pending, without touching lens.api/apps.current', () => {
    const policies = [
      policy({ id: 'settled', newBusinessType: 'nb_ordinary', proposedAPI: 24_000, status: 'settled' }),
      policy({ id: 'pend1', newBusinessType: 'nb_ordinary', proposedAPI: 36_000, status: 'submitted' }),
      policy({ id: 'pend2', newBusinessType: 'platinum_edge', proposedAPI: 5_000, status: 'rated' }),
    ];
    const lens = derivePolicyLens(policies, CHRISTMAS, {});
    expect(lens.api.current).toBe(24_000); // unaffected by pending
    expect(lens.apps.current).toBe(1);
    expect(lens.pending).toEqual({ api: 36_000, apps: 2, count: 2 }); // 36,000 + 0; 1 app + 1 app
  });

  it('a family/self policy contributes nothing to lens.pending (excluded before the pending branch runs)', () => {
    const policies = [
      policy({ id: 'fam', isSelfOrFamily: true, status: 'submitted', newBusinessType: 'nb_ordinary', proposedAPI: 50_000 }),
    ];
    const lens = derivePolicyLens(policies, CHRISTMAS, {});
    expect(lens.pending).toEqual({ api: 0, apps: 0, count: 0 });
  });
});

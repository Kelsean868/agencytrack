// R2-4 — "Policies in this campaign" grouping (docs/briefs/fr-round2-program.md § R2-4).
//
// The list classifies nothing itself: every row's group, credit and reason is
// the lens's own contribution for that policy. These tests pin (1) group
// membership per lens outcome, (2) totals parity with the campaign's own
// figures, and (3) the status-change lock matching the Policy ledger drawer.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { derivePolicyLens, policyContribution } from '../policyCampaignLens';
import { buildCampaignPolicyGroups } from '../campaignPolicyGroups';
import { LEGAL_AGENT_TRANSITIONS } from '../../constants/policyLifecycle';
import { CHRISTMAS, POLICIES } from './fixtures/awardLensFixtures';

const NOW = new Date('2026-09-26T12:00:00Z');

// A legacy (no credit table) campaign — the submission-window path.
const LEGACY = Object.freeze({
  id: 'legacy', name: 'Legacy campaign', startDate: '2026-07-01', endDate: '2026-12-31',
  structure: 'qualify', tiers: [{ level: 1, name: 'Bronze', api: 100_000, apps: 10 }],
});

function groupsFor(policies, campaign) {
  const lens = derivePolicyLens(policies, campaign, { now: NOW });
  return { lens, groups: buildCampaignPolicyGroups(lens, policies) };
}

const ids = (g) => g.rows.map((r) => r.id);

describe('buildCampaignPolicyGroups — group membership follows the lens', () => {
  it('credit (settlement-window) campaign: Counting / Waiting / Not counting with the lens reasons', () => {
    const { groups } = groupsFor(POLICIES, CHRISTMAS);
    expect(ids(groups.counting)).toEqual(['A', 'B', 'C']);
    expect(ids(groups.waiting)).toEqual(['D']);
    expect(ids(groups.notCounting)).toEqual(['F', 'G', 'H', 'I', 'M']);
    const reason = (id) => groups.notCounting.rows.find((r) => r.id === id).reason;
    expect(reason('F')).toBe('Policy lapsed / closed');
    expect(reason('G')).toBe('Self / family — excluded');
    expect(reason('H')).toBe('Issued before the campaign');
    expect(reason('I')).toBe('Issued before the campaign');
    expect(reason('M')).toBe('motor — excluded');
  });

  it('every row carries exactly the lens contribution for its policy (state → group, reason verbatim)', () => {
    const { lens, groups } = groupsFor(POLICIES, CHRISTMAS);
    const byGroup = { counts: groups.counting, pending: groups.waiting, excluded: groups.notCounting };
    for (const p of POLICIES) {
      const c = lens.contributions[p.id];
      const row = byGroup[c.state].rows.find((r) => r.id === p.id);
      expect(row, p.id).toBeTruthy();
      expect(row.reason).toBe(c.reason);
    }
  });

  it('legacy (submission-window) campaign: submitted = Waiting, written = Not counting, outside window excluded', () => {
    const policies = [
      { id: 'L1', status: 'settled', productLine: 'life', proposedAPI: 5000, dateSubmitted: '2026-08-01' },
      { id: 'L2', status: 'submitted', productLine: 'life', proposedAPI: 7000, dateSubmitted: '2026-08-05' },
      { id: 'L3', status: 'written', productLine: 'life', proposedAPI: 3000, dateWritten: '2026-08-06' },
      { id: 'L4', status: 'settled', productLine: 'life', proposedAPI: 9000, dateSubmitted: '2026-05-01' },
    ];
    const { groups } = groupsFor(policies, LEGACY);
    expect(ids(groups.counting)).toEqual(['L1']);
    expect(ids(groups.waiting)).toEqual(['L2']);
    expect(ids(groups.notCounting)).toEqual(['L3', 'L4']);
    expect(groups.notCounting.rows.find((r) => r.id === 'L3').reason).toBe('Not counting');
    expect(groups.notCounting.rows.find((r) => r.id === 'L4').reason).toBe('Outside campaign window');
  });

  it('shows the date the lens tested: Issued on a credit campaign, Submitted/Written on a legacy one', () => {
    const credit = groupsFor(POLICIES, CHRISTMAS).groups;
    expect(credit.counting.rows[0]).toMatchObject({ dateBasis: 'Issued', date: '2026-08-12' });
    expect(credit.waiting.rows[0]).toMatchObject({ dateBasis: 'Issued', date: null });
    const legacy = groupsFor([
      { id: 'S', status: 'submitted', productLine: 'life', proposedAPI: 1, dateWritten: '2026-08-01', dateSubmitted: '2026-08-03' },
      { id: 'W', status: 'written', productLine: 'life', proposedAPI: 1, dateWritten: '2026-08-02' },
    ], LEGACY).groups;
    expect(legacy.waiting.rows[0]).toMatchObject({ dateBasis: 'Submitted', date: '2026-08-03' });
    expect(legacy.notCounting.rows[0]).toMatchObject({ dateBasis: 'Written', date: '2026-08-02' });
  });

  it('rows carry client, policy number, status label and the policy API', () => {
    const { groups } = groupsFor(POLICIES, CHRISTMAS);
    expect(groups.counting.rows[0]).toMatchObject({
      client: 'Policyholder A', policyNumber: 'FX0002381', status: 'settled', statusLabel: 'Settled', policyApi: 24_600,
    });
  });

  it('returns null without a lens', () => {
    expect(buildCampaignPolicyGroups(null, POLICIES)).toBeNull();
  });
});

describe('buildCampaignPolicyGroups — totals parity with the campaign figures', () => {
  it('fixture book: Counting = lens api/apps current, Waiting = lens pending', () => {
    const { lens, groups } = groupsFor(POLICIES, CHRISTMAS);
    expect(groups.counting.api).toBe(lens.api.current);
    expect(groups.counting.apps).toBe(lens.apps.current);
    expect(groups.waiting.api).toBe(lens.pending.api);
    expect(groups.waiting.apps).toBe(lens.pending.apps);
    expect(groups.counting.rows.length).toBe(lens.counts.covered);
    expect(groups.waiting.rows.length).toBe(lens.pending.count);
    expect(groups.counting.rows.length + groups.waiting.rows.length).toBe(lens.counts.tracked);
    // Every policy lands in exactly one group.
    expect(groups.counting.rows.length + groups.waiting.rows.length + groups.notCounting.rows.length).toBe(POLICIES.length);
  });

  it('credit that is not the policy API (Platinum Edge, replacement) is what the Counting total sums', () => {
    const policies = [
      { id: 'PE', status: 'settled', productLine: 'life', newBusinessType: 'platinum_edge', settledAPI: 12_000, dateIssued: '2026-08-01' },
      { id: 'RP', status: 'settled', productLine: 'life', newBusinessType: 'replacement', settledAPI: 20_000, replacedPolicyAPI: 15_000, dateIssued: '2026-08-02' },
      { id: 'OR', status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary', settledAPI: 10_000.55, dateIssued: '2026-08-03' },
    ];
    const { lens, groups } = groupsFor(policies, CHRISTMAS);
    expect(groups.counting.api).toBe(lens.api.current);
    expect(groups.counting.apps).toBe(lens.apps.current);
    expect(groups.counting.api).toBeCloseTo(0 + 5_000 + 10_000.55, 2);
    expect(groups.counting.apps).toBe(2);
    const pe = groups.counting.rows.find((r) => r.id === 'PE');
    expect(pe).toMatchObject({ policyApi: 12_000, creditApi: 0, creditApps: 1 });
  });

  // Property: parity holds for ANY book. Two generators run together (see
  // docs/agents/test-and-lint-notes.md — diffuse generators hide defects): a
  // broad one, and a dense one where every policy is life, eligible, dated
  // inside the window and of a credit type whose credit differs from its API.
  const STATUSES = ['written', 'submitted', 'rated', 'postponed', 'settled', 'confirmed', 'lapsed', 'ntu', 'denied'];
  const TYPES = ['nb_ordinary', 'inc_ppp', 'replacement', 'spia', 'lumpsum', 'platinum_edge', undefined];
  const date = fc.constantFrom(null, '2026-05-01', '2026-07-01', '2026-08-15', '2026-12-31', '2027-01-04');
  const money = fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 2_000_000 }).map((c) => c / 100));
  const broad = fc.record({
    status: fc.constantFrom(...STATUSES),
    productLine: fc.constantFrom('life', 'life', 'motor'),
    isSelfOrFamily: fc.boolean(),
    newBusinessType: fc.constantFrom(...TYPES),
    proposedAPI: money,
    settledAPI: fc.option(money, { nil: undefined }),
    replacedPolicyAPI: fc.option(money, { nil: undefined }),
    dateIssued: date,
    dateSubmitted: date,
    dateWritten: date,
  });
  const dense = fc.record({
    status: fc.constantFrom('settled', 'confirmed', 'submitted', 'rated'),
    productLine: fc.constant('life'),
    isSelfOrFamily: fc.constant(false),
    newBusinessType: fc.constantFrom('replacement', 'platinum_edge', 'inc_ppp'),
    proposedAPI: money,
    settledAPI: money,
    replacedPolicyAPI: money,
    dateIssued: fc.constantFrom('2026-07-02', '2026-08-15', '2026-12-30'),
    dateSubmitted: fc.constantFrom('2026-07-02', '2026-08-15'),
    dateWritten: fc.constant('2026-07-01'),
  });
  const book = fc.array(fc.oneof(broad, dense), { maxLength: 25 })
    .map((rows) => rows.map((r, i) => ({ id: `p${i}`, ...r })));

  it.each([
    ['credit campaign', CHRISTMAS],
    ['legacy campaign', LEGACY],
  ])('property — %s: group totals always equal the lens figures', (_label, campaign) => {
    fc.assert(fc.property(book, (policies) => {
      const { lens, groups } = groupsFor(policies, campaign);
      expect(groups.counting.api).toBe(lens.api.current);
      expect(groups.counting.apps).toBe(lens.apps.current);
      expect(groups.waiting.api).toBe(lens.pending.api);
      expect(groups.waiting.apps).toBe(lens.pending.apps);
      expect(groups.counting.rows.length).toBe(lens.counts.covered);
      expect(groups.waiting.rows.length).toBe(lens.pending.count);
      expect(groups.counting.rows.length + groups.waiting.rows.length + groups.notCounting.rows.length)
        .toBe(policies.length);
      // Membership is the lens's own verdict for that policy.
      for (const r of groups.notCounting.rows) {
        expect(policyContribution(policies.find((p) => p.id === r.id), campaign).state).toBe('excluded');
      }
    }), { numRuns: 300 });
  });
});

describe('buildCampaignPolicyGroups — status change offered exactly when the ledger drawer offers one', () => {
  const HO = { statusSource: 'oipa_import' };
  it('head-office settled / lapsed / ntu / denied rows offer no status change', () => {
    const policies = ['settled', 'lapsed', 'ntu', 'denied'].map((status, i) => ({
      id: `ho${i}`, status, productLine: 'life', newBusinessType: 'nb_ordinary', settledAPI: 1000, dateIssued: '2026-08-01', ...HO,
    }));
    const { groups } = groupsFor(policies, CHRISTMAS);
    const rows = [...groups.counting.rows, ...groups.waiting.rows, ...groups.notCounting.rows];
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.headOffice, r.id).toBe(true);
      expect(r.canChangeStatus, r.id).toBe(false);
    }
  });

  it('matches LEGAL_AGENT_TRANSITIONS — the table the drawer builds its footer from — for every status', () => {
    const policies = Object.keys({ ...LEGAL_AGENT_TRANSITIONS, lapsed: [] }).map((status) => ({
      id: status, status, productLine: 'life', proposedAPI: 100, dateSubmitted: '2026-08-01',
    }));
    const { groups } = groupsFor(policies, LEGACY);
    const rows = [...groups.counting.rows, ...groups.waiting.rows, ...groups.notCounting.rows];
    for (const r of rows) {
      expect(r.canChangeStatus, r.id).toBe((LEGAL_AGENT_TRANSITIONS[r.id] ?? []).length > 0);
    }
    expect(rows.find((r) => r.id === 'submitted').canChangeStatus).toBe(true);
    expect(rows.find((r) => r.id === 'lapsed').canChangeStatus).toBe(false);
  });

  it('a head-office Pending (submitted) row stays changeable — the ledger drawer lets the agent move it too', () => {
    const { groups } = groupsFor([
      { id: 'hp', status: 'submitted', productLine: 'life', newBusinessType: 'nb_ordinary', proposedAPI: 5000, ...HO },
    ], CHRISTMAS);
    expect(groups.waiting.rows[0]).toMatchObject({ headOffice: true, canChangeStatus: true });
  });
});

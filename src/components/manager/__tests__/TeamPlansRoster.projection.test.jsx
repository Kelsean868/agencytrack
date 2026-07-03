// PR-GPM1 — Team Plans projection-contract tests (K9-style allow-list lock).
//
// Locks the SHOWN/PRIVATE boundary end-to-end: the REAL moneyNeedsService
// projection runs against a raw worksheet fixture stuffed with PRIVATE data
// (expense line items, sub-calculator internals, PAYE snapshot, audit fields)
// via a mocked firebase/firestore getDoc, and the roster + drawer render from
// it. SHOWN values must render; PRIVATE names/values must be ABSENT from
// innerHTML anywhere. permission-denied maps to a neutral "Not shared" row —
// never an error state. Falsifier (Rule 23): if any PRIVATE value appears in
// the projection or the DOM, or the allow-list key set widens, these fail.
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  authValue: { role: 'unit_manager', tenantId: 't1' },
  getTenantUsers: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));
vi.mock('../../../services/managerService', () => ({ getTenantUsers: (...a) => hoisted.getTenantUsers(...a) }));

// Mock ONLY the firestore transport — moneyNeedsService (projection + denied
// mapping) runs REAL, so these tests exercise the actual allow-list boundary.
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...segments) => ({ path: segments.join('/') }),
  getDoc: (...a) => hoisted.getDoc(...a),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-ts'),
}));

// Light stub for the reused coaching modal — assert it's invoked with the right
// props (esp. agentUnitId denorm) without mounting its heavy subtree.
vi.mock('../CoachingNotesModal', () => ({
  default: ({ agentId, agentName, agentUnitId, onClose }) => (
    <div data-testid="coaching-modal" data-agent-id={agentId} data-agent-unit-id={agentUnitId}>
      Coaching — {agentName}
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

import TeamPlansRoster from '../TeamPlansRoster';
import { projectSharedWorksheet, getSharedMoneyNeeds } from '../../../services/moneyNeedsService';

const YEAR = new Date().getFullYear();

// Raw worksheet: SHOWN aggregates + a household budget that must NEVER surface.
// Every PRIVATE value is unique so an innerHTML match is unambiguous.
const RAW_WORKSHEET = {
  year: YEAR,
  productLines: ['life', 'ah'],
  expenseGroups: {
    fixedExpenses: {
      lineItems: [{ id: 'seed-fe-1', label: 'Rent / Mortgage', frequency: 'M', amount: 2000, annualValue: 24000 }],
      subCalculatorRefs: [],
      groupAnnualTotal: 24000,
    },
    livingExpenses: {
      lineItems: [{ id: 'seed-le-3', label: 'Medical & pharmacy', frequency: 'M', amount: 625, annualValue: 7512 }],
      subCalculatorRefs: [],
      groupAnnualTotal: 7512,
    },
  },
  subCalculators: {
    loansDebt: { lineItems: [{ id: 'seed-ld-2', label: 'Sou-sou hand', amount: 3612 }], annualTotal: 3612 },
    carExpenses: { lineItems: [], withLoan: true, annualTotalPersonal: 9991, annualTotalBusiness: 20017 },
  },
  payeBracketsSnapshot: { bands: [{ upTo: 90000, rate: 0.25 }] },
  payeBracketsVersionId: 'default-2026',
  totalAnnualAfterTax: 187000,
  computedPAYE: 21300,
  totalAnnualPreTax: 208300,
  estimatedRenewalIncome: { life: 11000, ah: 2200, property: 990, motor: 440, total: 14630 },
  firstYearCommissionsRequired: 85400,
  firstYearCommissionsTargets: { life: 51240, ah: 17080, property: 8540, motor: 8541, total: 85401 },
  visibility: 'shared',
  shareWithSm: false,
  tenantId: 't1',
  uid: 'agent-a',
  createdBy: 'agent-a',
  updatedAt: { toDate: () => new Date(`${YEAR}-06-15T12:00:00Z`) },
  updatedBy: 'agent-a',
};

// Values/names that must never appear in a projection or the DOM.
const PRIVATE_MARKERS = [
  'Rent / Mortgage', '24,000', '24000',
  'Medical', '7,512', '7512',
  'Sou-sou', '3,612', '3612',
  '9,991', '20,017',
  'expenseGroups', 'subCalculators', 'payeBracketsSnapshot', 'shareWithSm',
];

const AGENT_A = { id: 'agent-a', name: 'A. Ali', role: 'agent', unitId: 'um-uid' };
const AGENT_B = { id: 'agent-b', name: 'B. Baker', role: 'agent', unitId: 'um-uid' };
const AGENT_C = { id: 'agent-c', name: 'C. Chan', role: 'agent', unitId: 'um-uid' };

const snapOf = (data) => ({ exists: () => true, id: String(YEAR), data: () => data });
const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.authValue = { role: 'unit_manager', tenantId: 't1' };
});

// ── Service layer: the allow-list itself ─────────────────────────────────────

describe('projectSharedWorksheet — allow-list projection', () => {
  it('emits EXACTLY the SHOWN key set — nothing else survives', () => {
    const p = projectSharedWorksheet(RAW_WORKSHEET);
    expect(Object.keys(p).sort()).toEqual([
      'computedPAYE',
      'estimatedRenewalIncome',
      'firstYearCommissionsRequired',
      'firstYearCommissionsTargets',
      'totalAnnualAfterTax',
      'totalAnnualPreTax',
      'updatedAt',
      'year',
    ]);
    // Targets are contract-restricted to the four lines (no `total`).
    expect(Object.keys(p.firstYearCommissionsTargets).sort()).toEqual(['ah', 'life', 'motor', 'property']);
    expect(p.firstYearCommissionsRequired).toBe(85400);
    expect(p.totalAnnualAfterTax).toBe(187000);
    expect(p.computedPAYE).toBe(21300);
    expect(p.estimatedRenewalIncome.total).toBe(14630);
  });

  it('serialized projection carries NO private value or field name', () => {
    const { updatedAt: _ts, ...serializable } = projectSharedWorksheet(RAW_WORKSHEET);
    const json = JSON.stringify(serializable);
    PRIVATE_MARKERS.forEach((marker) => expect(json).not.toContain(marker));
  });
});

describe('getSharedMoneyNeeds — denied → notShared mapping', () => {
  it('maps permission-denied to { notShared: true }, never an error', async () => {
    hoisted.getDoc.mockRejectedValueOnce(denied());
    await expect(getSharedMoneyNeeds('t1', 'agent-b', YEAR)).resolves.toEqual({ notShared: true });
  });

  it('maps a missing doc to { notShared: true } (indistinguishable by design)', async () => {
    hoisted.getDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(getSharedMoneyNeeds('t1', 'agent-b', YEAR)).resolves.toEqual({ notShared: true });
  });

  it('rethrows non-permission failures (roster partial-degrade handles them)', async () => {
    hoisted.getDoc.mockRejectedValueOnce(Object.assign(new Error('unavailable'), { code: 'unavailable' }));
    await expect(getSharedMoneyNeeds('t1', 'agent-a', YEAR)).rejects.toMatchObject({ code: 'unavailable' });
  });
});

// ── Component layer: SHOWN renders, PRIVATE absent from the DOM ──────────────

const getDocByAgent = (map) => (ref) => {
  const agentId = Object.keys(map).find((id) => ref.path.includes(`/${id}/`) || ref.path.includes(`users/${id}`));
  const entry = map[agentId];
  if (entry instanceof Error) return Promise.reject(entry);
  if (entry === undefined) return Promise.resolve({ exists: () => false });
  return Promise.resolve(snapOf(entry));
};

describe('TeamPlansRoster — projection contract in the DOM', () => {
  it('shared row shows headline SHOWN figures; not-shared row is neutral; PRIVATE absent everywhere', async () => {
    hoisted.getTenantUsers.mockResolvedValue([AGENT_A, AGENT_B, { id: 'um-1', name: 'U. Manager', role: 'unit_manager' }]);
    hoisted.getDoc.mockImplementation(getDocByAgent({ 'agent-a': RAW_WORKSHEET, 'agent-b': denied() }));

    const { container } = render(<TeamPlansRoster tenantId="t1" />);
    await waitFor(() => expect(screen.getByTestId('team-plans-row-agent-a')).toBeInTheDocument());

    // SHOWN headline on the shared row (TTD, exact seeded value).
    expect(screen.getByTestId('team-plans-fyc-agent-a')).toHaveTextContent('TTD 85,400');
    // Not-shared row: neutral state, no figures, no nudge copy.
    expect(screen.getByTestId('team-plans-notshared-agent-b')).toHaveTextContent(/not shared/i);
    expect(screen.queryByTestId('team-plans-view-agent-b')).not.toBeInTheDocument();
    // Summary counts only on a full read.
    expect(screen.getByTestId('team-plans-shared-count')).toHaveTextContent('1');

    // PRIVATE ABSENCE — the whole surface.
    const html = container.innerHTML;
    PRIVATE_MARKERS.forEach((marker) => expect(html).not.toContain(marker));
  });

  it('drawer renders the full SHOWN projection — and still no PRIVATE field', async () => {
    hoisted.getTenantUsers.mockResolvedValue([AGENT_A]);
    hoisted.getDoc.mockImplementation(getDocByAgent({ 'agent-a': RAW_WORKSHEET }));

    const { container } = render(<TeamPlansRoster tenantId="t1" />);
    await waitFor(() => expect(screen.getByTestId('team-plans-view-agent-a')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('team-plans-view-agent-a'));

    await waitFor(() => expect(screen.getByTestId('team-plans-drawer')).toBeInTheDocument());
    expect(screen.getByTestId('tpd-fyc-required')).toHaveTextContent('TTD 85,400');
    expect(screen.getByTestId('tpd-target-life')).toHaveTextContent('TTD 51,240');
    expect(screen.getByTestId('tpd-target-ah')).toHaveTextContent('TTD 17,080');
    expect(screen.getByTestId('tpd-target-property')).toHaveTextContent('TTD 8,540');
    expect(screen.getByTestId('tpd-target-motor')).toHaveTextContent('TTD 8,541');
    expect(screen.getByTestId('tpd-renewal-total')).toHaveTextContent('TTD 14,630');
    expect(screen.getByTestId('tpd-after-tax')).toHaveTextContent('TTD 187,000');
    expect(screen.getByTestId('tpd-paye')).toHaveTextContent('TTD 21,300');
    expect(screen.getByTestId('tpd-pre-tax')).toHaveTextContent('TTD 208,300');
    // DD-MM-YYYY date + worksheet year in the header.
    expect(screen.getByText(new RegExp(`updated 15-06-${YEAR}`))).toBeInTheDocument();

    // The targets `total` (85401, contract-excluded) must not render.
    expect(container.innerHTML).not.toContain('85,401');
    // PRIVATE ABSENCE — roster + open drawer together.
    const html = container.innerHTML;
    PRIVATE_MARKERS.forEach((marker) => expect(html).not.toContain(marker));
  });

  it('Coach from the drawer hands CoachingNotesModal the agentId + unitId denorm', async () => {
    hoisted.getTenantUsers.mockResolvedValue([AGENT_A]);
    hoisted.getDoc.mockImplementation(getDocByAgent({ 'agent-a': RAW_WORKSHEET }));

    render(<TeamPlansRoster tenantId="t1" />);
    await waitFor(() => expect(screen.getByTestId('team-plans-view-agent-a')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('team-plans-view-agent-a'));
    await waitFor(() => expect(screen.getByTestId('team-plans-drawer-coach')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('team-plans-drawer-coach'));

    const modal = await screen.findByTestId('coaching-modal');
    expect(modal).toHaveAttribute('data-agent-id', 'agent-a');
    expect(modal).toHaveAttribute('data-agent-unit-id', 'um-uid');
    // Drawer closed when coaching opens.
    expect(screen.queryByTestId('team-plans-drawer')).not.toBeInTheDocument();
  });

  it('partial fan-out failure → resolved rows only, summary suppressed', async () => {
    hoisted.getTenantUsers.mockResolvedValue([AGENT_A, AGENT_C]);
    hoisted.getDoc.mockImplementation(getDocByAgent({
      'agent-a': RAW_WORKSHEET,
      'agent-c': Object.assign(new Error('unavailable'), { code: 'unavailable' }),
    }));

    render(<TeamPlansRoster tenantId="t1" />);
    await waitFor(() => expect(screen.getByTestId('team-plans-partial')).toBeInTheDocument());
    expect(screen.getByTestId('team-plans-row-agent-a')).toBeInTheDocument();
    expect(screen.queryByTestId('team-plans-row-agent-c')).not.toBeInTheDocument();
    // Never an aggregate from a partial read.
    expect(screen.queryByTestId('team-plans-summary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('team-plans-shared-count')).not.toBeInTheDocument();
  });

  it('guards non-UM/BM roles (nav parity with the rules layer — no TA/PA surface)', async () => {
    hoisted.authValue = { role: 'tenant_admin', tenantId: 't1' };
    hoisted.getTenantUsers.mockResolvedValue([]);

    render(<TeamPlansRoster tenantId="t1" />);
    expect(screen.getByText(/unit and branch manager view/i)).toBeInTheDocument();
    expect(screen.queryByTestId('team-plans-table')).not.toBeInTheDocument();
  });
});

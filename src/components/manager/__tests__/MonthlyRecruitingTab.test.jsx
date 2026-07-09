// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

const DAY = 86_400_000;
const NOW = Date.now();

const hoisted = vi.hoisted(() => ({
  mockRole: 'branch_manager',
  mockGetBoard: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'bm1' },
    userProfile: { name: 'Branch Mgr', email: 'bm@test.com', branchId: 'branch-a' },
    role: hoisted.mockRole,
    tenantId: 'test-tenant',
  }),
}));

// Keep the real service (constants + isStalled + daysInStage) but stub the query.
vi.mock('../../../services/recruitingService', async (importActual) => {
  const actual = await importActual();
  return { ...actual, getCandidatesForBoard: (...a) => hoisted.mockGetBoard(...a) };
});

// The retained rollup + the two drawers are exercised by their own suites.
vi.mock('../MonthlyRecruitingRollup', () => ({ default: () => <div data-testid="rollup-stub" /> }));
vi.mock('../RecCandidateForm', () => ({ default: () => <div data-testid="form-stub" /> }));
vi.mock('../RecDrillDrawer', () => ({
  default: ({ candidate }) => <div data-testid="drill-stub">{candidate.name}</div>,
}));

import MonthlyRecruitingTab from '../MonthlyRecruitingTab';

const fixtures = () => [
  { id: 'c1', name: 'Sourced Sam',    stage: 'sourced',    status: 'active', ownerUid: 'bm1', ownerName: 'Branch Mgr', stageChangedAt: NOW - 2 * DAY },
  { id: 'c2', name: 'Stalled Steve',  stage: 'contacted',  status: 'active', ownerUid: 'um2', ownerName: 'Unit Two',   stageChangedAt: NOW - 15 * DAY },
  { id: 'c7', name: 'Edge Eddie',     stage: 'seminar',    status: 'active', ownerUid: 'bm1', ownerName: 'Branch Mgr', stageChangedAt: NOW - 14 * DAY },
  { id: 'c3', name: 'Offer Olga',     stage: 'offer',      status: 'active', ownerUid: 'bm1', ownerName: 'Branch Mgr', stageChangedAt: NOW - 3 * DAY },
  { id: 'c4', name: 'Licensing Lena', stage: 'licensing',  status: 'active', ownerUid: 'bm1', ownerName: 'Branch Mgr', stageChangedAt: NOW - 1 * DAY },
  { id: 'c5', name: 'Hired Hank',     stage: 'licensed',   status: 'active', ownerUid: 'bm1', ownerName: 'Branch Mgr', stageChangedAt: NOW - 5 * DAY, licensedAt: NOW - 5 * DAY },
  { id: 'c6', name: 'Archived Amy',   stage: 'contacted',  status: 'archived', ownerUid: 'bm1', ownerName: 'Branch Mgr', stageChangedAt: NOW - 30 * DAY },
];

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mockRole = 'branch_manager';
  hoisted.mockGetBoard.mockResolvedValue(fixtures());
});

describe('board rendering', () => {
  it('renders all 8 stage columns and one card per active candidate', async () => {
    render(<MonthlyRecruitingTab />);
    await flush();
    const board = screen.getByTestId('rec-board');
    // 8 stage columns (each a <section> with aria-label)
    expect(within(board).getAllByRole('region')).toHaveLength(8);
    // 6 active candidates (archived c6 excluded)
    expect(screen.getAllByTestId('rec-candidate-card')).toHaveLength(6);
    expect(screen.queryByText('Archived Amy')).not.toBeInTheDocument();
  });

  it('computes funnel counts from the active set', async () => {
    render(<MonthlyRecruitingTab />);
    await flush();
    expect(screen.getByTestId('rec-funnel-in')).toHaveTextContent('6');       // in pipeline (active)
    expect(screen.getByTestId('rec-funnel-near')).toHaveTextContent('2');     // offer + licensing
    expect(screen.getByTestId('rec-funnel-stalled')).toHaveTextContent('1');  // only the 15-day one
    expect(screen.getByTestId('rec-funnel-hired')).toHaveTextContent('1');    // licensed this year
  });

  it('applies the 14-day stalled boundary (strict >): 15d stalled, 14d not', async () => {
    render(<MonthlyRecruitingTab />);
    await flush();
    const stalledCard = screen.getByText('Stalled Steve').closest('button');
    expect(within(stalledCard).getByText(/15d stalled/i)).toBeInTheDocument();
    const edgeCard = screen.getByText('Edge Eddie').closest('button');
    expect(within(edgeCard).getByText(/14d in stage/i)).toBeInTheDocument();
    expect(within(edgeCard).queryByText(/stalled/i)).not.toBeInTheDocument();
  });

  it('opens the drill drawer when a card is clicked', async () => {
    render(<MonthlyRecruitingTab />);
    await flush();
    fireEvent.click(screen.getByText('Offer Olga'));
    expect(screen.getByTestId('drill-stub')).toHaveTextContent('Offer Olga');
  });
});

describe('owner filter chips (BM sees >1 owner)', () => {
  it('filters the board to a single owner', async () => {
    render(<MonthlyRecruitingTab />);
    await flush();
    // Two owners → chips shown
    fireEvent.click(screen.getByRole('button', { name: /^Unit Two$/ }));
    // Only um2's single candidate remains
    expect(screen.getAllByTestId('rec-candidate-card')).toHaveLength(1);
    expect(screen.getByText('Stalled Steve')).toBeInTheDocument();
    expect(screen.queryByText('Offer Olga')).not.toBeInTheDocument();
    expect(screen.getByTestId('rec-funnel-in')).toHaveTextContent('1');
  });
});

describe('four-states', () => {
  it('shows the actionable empty state with an add CTA', async () => {
    hoisted.mockGetBoard.mockResolvedValue([]);
    render(<MonthlyRecruitingTab />);
    await flush();
    expect(screen.getByTestId('rec-board-empty')).toBeInTheDocument();
    expect(screen.getByTestId('rec-empty-add')).toBeInTheDocument();
    expect(screen.queryByTestId('rec-board')).not.toBeInTheDocument();
  });

  it('shows an error state with Retry that reloads', async () => {
    hoisted.mockGetBoard.mockRejectedValueOnce(new Error('boom'));
    render(<MonthlyRecruitingTab />);
    await flush();
    expect(screen.getByTestId('rec-board-error')).toBeInTheDocument();
    // Retry → second call resolves with fixtures
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await flush();
    expect(screen.queryByTestId('rec-board-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('rec-board')).toBeInTheDocument();
  });

  it('shows a loading skeleton before data resolves', async () => {
    let resolve;
    hoisted.mockGetBoard.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<MonthlyRecruitingTab />);
    expect(screen.getByLabelText(/loading recruiting pipeline/i)).toBeInTheDocument();
    await act(async () => { resolve(fixtures()); await Promise.resolve(); });
  });
});

describe('add candidate', () => {
  it('opens the create form from the header button', async () => {
    render(<MonthlyRecruitingTab />);
    await flush();
    expect(screen.queryByTestId('form-stub')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('rec-add-candidate'));
    expect(screen.getByTestId('form-stub')).toBeInTheDocument();
  });
});

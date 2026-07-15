// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  onSnapshot: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((...args) => args),
  collection: vi.fn(() => ({ __mock: 'collection' })),
  orderBy: vi.fn(),
  where: vi.fn(),
  computeWeeklyChampions: vi.fn(() => ({})),
  getLastNSundays: vi.fn(() => ['2025-01-05', '2024-12-29']),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('firebase/firestore', () => ({
  onSnapshot: hoisted.onSnapshot,
  getDocs: hoisted.getDocs,
  query: hoisted.query,
  collection: hoisted.collection,
  orderBy: hoisted.orderBy,
  where: hoisted.where,
}));
vi.mock('../../../firebase', () => ({ db: { __mock: 'db' } }));
vi.mock('../../../utils/weeklyChampions', () => ({
  computeWeeklyChampions: hoisted.computeWeeklyChampions,
}));
vi.mock('../../../utils/dateHelpers', () => ({
  getLastNSundays: hoisted.getLastNSundays,
}));
vi.mock('../../ui/Avatar', () => ({
  default: ({ name }) => <span data-testid="avatar">{name}</span>,
}));
vi.mock('../../ui/StatusPill', () => ({
  default: ({ label }) => <span data-testid="status-pill">{label}</span>,
}));
vi.mock('../WeeklyChampionsBanner', () => ({
  default: () => <div data-testid="champions-banner" />,
}));

import Leaderboard from '../Leaderboard';

function makeSnap(docs) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d })) };
}

const AGENT_USER = { uid: 'u1' };

function setupDefaultMocks({ docs = [], userDocs = [] } = {}) {
  hoisted.onSnapshot.mockImplementation((_q, onNext) => {
    onNext(makeSnap(docs));
    return () => {};
  });
  hoisted.getDocs.mockResolvedValue(makeSnap(userDocs));
}

beforeEach(() => {
  vi.resetAllMocks();
  hoisted.useAuth.mockReturnValue({
    user: AGENT_USER,
    role: 'agent',
    tenantId: 'tenant1',
  });
  hoisted.getLastNSundays.mockReturnValue(['2025-01-05', '2024-12-29']);
  hoisted.computeWeeklyChampions.mockReturnValue({});
});

describe('Leaderboard', () => {
  it('shows skeleton loading state while onSnapshot has not fired', () => {
    hoisted.onSnapshot.mockImplementation(() => () => {});
    hoisted.getDocs.mockReturnValue(new Promise(() => {}));
    render(<Leaderboard />);
    const pulses = document.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThan(0);
  });

  it('shows error message when onSnapshot fires error callback', async () => {
    hoisted.onSnapshot.mockImplementation((_q, _onNext, onError) => {
      onError(new Error('permission denied'));
      return () => {};
    });
    hoisted.getDocs.mockResolvedValue(makeSnap([]));
    render(<Leaderboard />);
    await waitFor(() =>
      expect(screen.getByText(/Failed to load leaderboard/i)).toBeInTheDocument()
    );
  });

  it('error card renders role="alert" with a Retry affordance', async () => {
    hoisted.onSnapshot.mockImplementation((_q, _onNext, onError) => {
      onError(new Error('permission denied'));
      return () => {};
    });
    hoisted.getDocs.mockResolvedValue(makeSnap([]));
    render(<Leaderboard />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('clicking Retry tears down and re-subscribes the onSnapshot listener', async () => {
    hoisted.onSnapshot.mockImplementation((_q, _onNext, onError) => {
      onError(new Error('permission denied'));
      return () => {};
    });
    hoisted.getDocs.mockResolvedValue(makeSnap([]));
    render(<Leaderboard />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    expect(hoisted.onSnapshot).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(hoisted.onSnapshot).toHaveBeenCalledTimes(2));
  });

  it('Retry recovers to normal content once the re-subscription succeeds', async () => {
    let call = 0;
    hoisted.onSnapshot.mockImplementation((_q, onNext, onError) => {
      call += 1;
      if (call === 1) {
        onError(new Error('permission denied'));
      } else {
        onNext(makeSnap([
          { id: 'd1', userId: 'u1', agentName: 'Alice', points: 500, levelTitle: 'Elite', badges: [], isBranchManagerUnit: false },
        ]));
      }
      return () => {};
    });
    hoisted.getDocs.mockResolvedValue(makeSnap([]));
    render(<Leaderboard />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('shows empty state message when no docs', async () => {
    setupDefaultMocks({ docs: [], userDocs: [] });
    render(<Leaderboard />);
    await waitFor(() =>
      expect(screen.getByText(/No leaderboard data yet/i)).toBeInTheDocument()
    );
    expect(screen.getByTestId('champions-banner')).toBeInTheDocument();
  });

  it('agent view: shows rank card and competition rows', async () => {
    const docs = [
      { id: 'd1', userId: 'u1', agentName: 'Alice', points: 500, levelTitle: 'Elite', badges: [], isBranchManagerUnit: false },
      { id: 'd2', userId: 'u2', agentName: 'Bob',   points: 300, levelTitle: 'Pro',   badges: [], isBranchManagerUnit: false },
    ];
    setupDefaultMocks({ docs, userDocs: [] });
    render(<Leaderboard />);
    await waitFor(() => expect(screen.getByText('#1')).toBeInTheDocument());
    expect(screen.getByText('of 2 agents')).toBeInTheDocument();
    expect(screen.getAllByTestId('avatar').length).toBeGreaterThan(0);
  });

  it('manager view: does not show rank card, shows competition rows', async () => {
    hoisted.useAuth.mockReturnValue({
      user: { uid: 'mgr1' },
      role: 'unit_manager',
      tenantId: 'tenant1',
    });
    const docs = [
      { id: 'd1', userId: 'u1', agentName: 'Alice', points: 500, levelTitle: 'Elite', badges: [], isBranchManagerUnit: false },
    ];
    setupDefaultMocks({ docs, userDocs: [] });
    render(<Leaderboard />);
    await waitFor(() => expect(screen.getAllByTestId('avatar').length).toBeGreaterThan(0));
    expect(screen.queryByText(/Your Rank/i)).not.toBeInTheDocument();
  });

  it('manager view: shows branch unit section when isBranchManagerUnit entries exist', async () => {
    hoisted.useAuth.mockReturnValue({
      user: { uid: 'mgr1' },
      role: 'branch_manager',
      tenantId: 'tenant1',
    });
    const docs = [
      { id: 'd1', userId: 'u1', agentName: 'Alice', points: 500, levelTitle: 'Elite', badges: [], isBranchManagerUnit: false },
      { id: 'd2', userId: 'u2', agentName: 'BM Unit', points: 200, levelTitle: 'Pro', badges: [], isBranchManagerUnit: true },
    ];
    setupDefaultMocks({ docs, userDocs: [] });
    render(<Leaderboard />);
    await waitFor(() =>
      expect(screen.getByText(/Branch Unit — not in competition/i)).toBeInTheDocument()
    );
  });

  it('branch unit section hidden when all docs are competition entries', async () => {
    hoisted.useAuth.mockReturnValue({
      user: { uid: 'mgr1' },
      role: 'branch_manager',
      tenantId: 'tenant1',
    });
    const docs = [
      { id: 'd1', userId: 'u1', agentName: 'Alice', points: 500, levelTitle: 'Elite', badges: [], isBranchManagerUnit: false },
    ];
    setupDefaultMocks({ docs, userDocs: [] });
    render(<Leaderboard />);
    await waitFor(() => expect(screen.getAllByTestId('avatar').length).toBeGreaterThan(0));
    expect(screen.queryByText(/Branch Unit/i)).not.toBeInTheDocument();
  });

  it('badge count row shown when entry has badges', async () => {
    const docs = [
      { id: 'd1', userId: 'u1', agentName: 'Alice', points: 500, levelTitle: 'Elite', badges: ['a', 'b', 'c'], isBranchManagerUnit: false },
    ];
    setupDefaultMocks({ docs, userDocs: [] });
    render(<Leaderboard />);
    await waitFor(() => expect(screen.getByText('3 badges')).toBeInTheDocument());
  });

  it('singular "badge" label when entry has exactly one badge', async () => {
    const docs = [
      { id: 'd1', userId: 'u1', agentName: 'Alice', points: 500, levelTitle: 'Elite', badges: ['a'], isBranchManagerUnit: false },
    ];
    setupDefaultMocks({ docs, userDocs: [] });
    render(<Leaderboard />);
    await waitFor(() => expect(screen.getByText('1 badge')).toBeInTheDocument());
  });

  it('streak icon title shown for entry with weeklyStreak >= 4', async () => {
    const docs = [
      { id: 'd1', userId: 'u2', agentName: 'Carol', points: 400, levelTitle: 'Pro', badges: [], weeklyStreak: 5, isBranchManagerUnit: false },
    ];
    setupDefaultMocks({ docs, userDocs: [] });
    render(<Leaderboard />);
    await waitFor(() => {
      const flame = document.querySelector('[title="5-week streak"]');
      expect(flame).toBeInTheDocument();
    });
  });
});

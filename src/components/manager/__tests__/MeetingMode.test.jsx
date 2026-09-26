// Meeting Mode v2 — the phased run-of-show deck. Covers the dialog a11y
// contract (§4, preserved from item 0.2), the load gate / four-states, scene
// advance, and agenda-rail jump. Value-level scene-derivation tests live in
// MeetingMode.helpers.test.jsx.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { flushPendingEffects } from '../../../test-utils/flushPendingEffects';

const hoisted = vi.hoisted(() => ({
  authValue: { tenantId: 't1', role: 'branch_manager', branchId: 'b1', userProfile: { branchId: 'b1' } },
  getTenantUsers: vi.fn(),
  getAllYTDSubmissions: vi.fn(),
  getPersistencyMapForYear: vi.fn(),
  getCampaigns: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));
vi.mock('../../../services/managerService', () => ({
  getTenantUsers: (...a) => hoisted.getTenantUsers(...a),
  getAllYTDSubmissions: (...a) => hoisted.getAllYTDSubmissions(...a),
}));
vi.mock('../../../services/persistencyService', () => ({
  getPersistencyMapForYear: (...a) => hoisted.getPersistencyMapForYear(...a),
}));
vi.mock('../../../services/campaignService', () => ({
  getCampaigns: (...a) => hoisted.getCampaigns(...a),
}));

import MeetingMode from '../MeetingMode';

const SUBMISSIONS = [
  {
    agentId: 'agent-1', agentName: 'Alice Agent', status: 'submitted',
    weekStarting: '2026-06-28',
    callsMade: 70, telContacts: 45, appointmentsSet: 22,
    ffiConducted: 12, ciConducted: 11, applicationsSold: 4, livesSold: 4,
    apiSold: 24000, referralsObtained: 60, namesFromColdCanvass: 50,
  },
];

const USERS = [
  { id: 'agent-1', name: 'Alice Agent', role: 'agent', unitId: 'u1', photoURL: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getTenantUsers.mockResolvedValue(USERS);
  hoisted.getAllYTDSubmissions.mockResolvedValue(SUBMISSIONS);
  hoisted.getPersistencyMapForYear.mockResolvedValue({});
  hoisted.getCampaigns.mockResolvedValue([]);
});

async function renderLoaded(props = {}) {
  const utils = render(
    <MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={props.onClose ?? (() => {})} />
  );
  await waitFor(() => expect(screen.getByText(/Good morning, team/)).toBeInTheDocument());
  return utils;
}

describe('MeetingMode — dialog a11y (preserved 0.2 contract)', () => {
  it('exposes role=dialog + aria-modal=true + aria-label immediately', () => {
    render(<MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Meeting mode presentation');
  });

  it('calls onClose when the Exit button is clicked', () => {
    const onClose = vi.fn();
    render(<MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /exit meeting mode/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab from the last focusable element cycles back to the first (focus trap)', async () => {
    await renderLoaded();
    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(
      dialog.querySelectorAll(
        'button:not([disabled]):not([aria-hidden="true"]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);
    // SEVENTH MEMBER — found by the staleness predicate, not by a failure. This test
    // awaits the load and then dispatches synchronously, so it lands in the same
    // stale window as the four below: 6/150 iterations showed `win-gen1 captured
    // total=0 vs committed 8`. It has never FLAKED only because the transport handler
    // ignores 'Tab' (it branches on ArrowRight/ArrowLeft/Home/End/digits), so the
    // stale dispatch is inconsequential to what this test asserts.
    //
    // It takes the flush rather than `userEvent.keyboard('{Tab}')` because userEvent
    // performs real tab navigation and would move focus itself — which would stop this
    // test exercising the component's focus trap at all. Two idioms in this file is the
    // CLAUDE.md rule applied correctly, not an inconsistency: please do not "tidy" it.
    await flushPendingEffects();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('restores focus to the invoking element when Meeting Mode unmounts', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(
      <MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={() => {}} />
    );
    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});

describe('MeetingMode — run-of-show', () => {
  it('renders a loading skeleton before data resolves', () => {
    render(<MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={() => {}} />);
    expect(screen.getByRole('status', { name: /loading meeting data/i })).toBeInTheDocument();
  });

  it('opens on the opening scene after load', async () => {
    await renderLoaded();
    expect(screen.getByText(/Good morning, team/)).toBeInTheDocument();
    expect(screen.getAllByText(/Week of/).length).toBeGreaterThan(0);
  });

  // FLAKE FIX — stale keydown-handler closure, PROVEN by trace (PR #898, Phase 0).
  // `go` is a useCallback over [total] (MeetingMode.jsx:929-931) and the transport
  // listener re-subscribes on [go, total] (:936-949). Before data lands `model` is
  // null -> scenes [] -> total 0, so that handler clamps every advance to 0. A
  // SYNCHRONOUS `fireEvent.keyDown` arriving before the passive effect flushes is
  // served by it: 33/33 failing traces showed exactly one stale-served dispatch and
  // the deck resting at `target - 1`. The element then never arrives, which is why
  // no timeout change ever helped.
  //
  // `userEvent.keyboard` is async and act-wrapped, so the pending effect flushes
  // before the key is dispatched. These four tests model a USER driving the deck,
  // so its activeElement targeting is faithful rather than incidental — the key
  // still reaches the window listener by bubbling. (Contrast AgentPlannerPanel's
  // helpers, which dispatch at `document` on purpose; see the note there.)
  it('ArrowRight advances from opening to the branch scorecard', async () => {
    await renderLoaded();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByText(/Where the branch stands/)).toBeInTheDocument());
  });

  it('renders an error card with Retry when the users load fails', async () => {
    hoisted.getTenantUsers.mockRejectedValueOnce(new Error('nope'));
    render(<MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('agenda rail is shown on the agent scene and jumps when clicked', async () => {
    await renderLoaded();
    // opening(0) → branch → activity → production → funnel → agent(5): the rail
    // shows on the agent scene. Deck: opening, branch, activity, production,
    // funnel, agent, recognition, close (units/exceptions/celebrations/awards/
    // campaign skip — no data).
    for (let i = 0; i < 5; i += 1) await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByText(/This week's activity/i)).toBeInTheDocument());
    // The rail lists every scene; clicking "Branch scorecard" jumps back to it.
    fireEvent.click(screen.getByRole('button', { name: 'Branch scorecard' }));
    await waitFor(() => expect(screen.getByText(/Where the branch stands/)).toBeInTheDocument());
  });

  it('skip-logs the awards scene when nobody is within reach — deck lands on close at index 7', async () => {
    await renderLoaded();
    // Default fixture's YTD is the same tiny (apiSold=24000) week used for
    // `submissions` — nowhere near any award's in-contention floor, so
    // deriveDeck skips 'awards' and close is the 8th (index-7) scene.
    for (let i = 0; i < 7; i += 1) await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByText(/That's the room/)).toBeInTheDocument());
  });
});

describe('MeetingMode — awards within reach scene', () => {
  const YEAR = new Date().getFullYear(); // annual-only award math; year must match real "now"

  it('renders an in-reach award card once an agent crosses the 60% floor', async () => {
    const users = [{ id: 'agent-1', name: 'Alice Agent', role: 'agent', unitId: 'u1', photoURL: null }];
    const weekSub = SUBMISSIONS[0];
    // A large annual-only submission (MDRT: 344.4k inContention, 688.8k
    // threshold via mdrtAwardThresholds() — PR #MX — no apps/persistency
    // gate) pushes agent-1 to ~72.6% — comfortably over the 60% within-reach
    // floor and short of the 688.8k eligible threshold.
    const ytdSub = { agentId: 'agent-1', status: 'submitted', weekStarting: `${YEAR}-03-01`, apiSold: 500000, applicationsSold: 0 };
    hoisted.getTenantUsers.mockResolvedValue(users);
    hoisted.getAllYTDSubmissions.mockResolvedValue([ytdSub]);

    render(<MeetingMode submissions={[weekSub]} selectedWeek="2026-06-28" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Good morning, team/)).toBeInTheDocument());
    // opening(0) branch(1) activity(2) production(3) funnel(4) agent(5)
    // recognition(6) awards(7).
    for (let i = 0; i < 7; i += 1) await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByTestId('awards-within-reach-scene')).toBeInTheDocument());
    expect(screen.getByText('MDRT')).toBeInTheDocument();
    expect(screen.getByText('Alice Agent')).toBeInTheDocument();
    expect(screen.getAllByTestId('awards-reach-card')).toHaveLength(1);
  });
});

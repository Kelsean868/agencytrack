// Meeting Mode v2 — the phased run-of-show deck. Covers the dialog a11y
// contract (§4, preserved from item 0.2), the load gate / four-states, scene
// advance, and agenda-rail jump. Value-level scene-derivation tests live in
// MeetingMode.helpers.test.jsx.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

  it('ArrowRight advances from opening to the branch scorecard', async () => {
    await renderLoaded();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
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
    // opening(0) → branch → activity → production → agent(4): the rail shows on
    // the agent scene. Deck: opening, branch, activity, production, agent,
    // recognition, close (units/exceptions/celebrations/campaign skip — no data).
    for (let i = 0; i < 4; i += 1) fireEvent.keyDown(document, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByText(/This week's activity/i)).toBeInTheDocument());
    // The rail lists every scene; clicking "Branch scorecard" jumps back to it.
    fireEvent.click(screen.getByRole('button', { name: 'Branch scorecard' }));
    await waitFor(() => expect(screen.getByText(/Where the branch stands/)).toBeInTheDocument());
  });
});

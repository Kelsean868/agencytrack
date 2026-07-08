// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Hoisted mocks — applied before the SUT and its transitive imports run.
const hoisted = vi.hoisted(() => ({
  getWeeklySubmissions: vi.fn(),
  getTenantUsers:       vi.fn(),
  extractFields:        vi.fn(),
  computeRatios:        vi.fn(),
  extractTotalProductionCredit: vi.fn(),
}));

vi.mock('../../../services/managerService', () => ({
  getWeeklySubmissions: hoisted.getWeeklySubmissions,
  getTenantUsers:       hoisted.getTenantUsers,
}));

vi.mock('../../../utils/extractFields', () => ({
  extractFields:                hoisted.extractFields,
  computeRatios:                hoisted.computeRatios,
  extractTotalProductionCredit: hoisted.extractTotalProductionCredit,
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ tenantId: 't1' }),
}));

// Stub heavy children — not under test here.
vi.mock('../CoachingNotesModal', () => ({ default: () => null }));
vi.mock('../../submissions/SubmissionViewer', () => ({ default: () => null }));

import MasterSheet from '../MasterSheet';

const FIELDS = {
  prospectingTouches: 10, telContacts: 5, f2fContacts: 3, totalTelAttempts: 8,
  f2fAttempts: 4, qualifiedApproaches: 6, ffisScheduled: 3, ffiConducted: 2,
  solutionPresentations: 2, newCIBooked: 1, oldCIBooked: 1, ciConducted: 2,
  applicationsSold: 3, livesSold: 4, daysWorked: 5, weekendWorked: true,
  weekendApi: 500, targetAPI: 10000, policiesDelivered: 2, serviceContacts: 1,
  totalNewNames: 6, targetAppsSold: 4,
};

const SUB_SUBMITTED = {
  id: 'sub-1', agentId: 'agent-1', agentName: 'Active Agent', status: 'submitted',
};
const SUB_DRAFT = {
  id: 'sub-2', agentId: 'agent-2', agentName: 'Draft Agent', status: 'draft',
};

function setup(subs = [SUB_SUBMITTED, SUB_DRAFT]) {
  hoisted.getWeeklySubmissions.mockResolvedValue(subs);
  hoisted.getTenantUsers.mockResolvedValue([]);
  hoisted.extractFields.mockReturnValue(FIELDS);
  hoisted.computeRatios.mockReturnValue({ closingRatio: 50 });
  hoisted.extractTotalProductionCredit.mockReturnValue(8000);
}

describe('MasterSheet — §5 dense-table contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('renders agent rows once loaded', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    expect(screen.getByText('Draft Agent')).toBeInTheDocument();
  });

  it('renders a live footer count breakdown (submitted vs draft)', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    expect(screen.getByText(/2 submissions/)).toBeInTheDocument();
    expect(screen.getByText(/1 submitted/)).toBeInTheDocument();
    expect(screen.getByText(/1 draft/)).toBeInTheDocument();
  });

  it('header row is sticky top-0, and the sticky identity columns win both axes (z-30)', async () => {
    const { container } = render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    const headerCells = container.querySelectorAll('thead th');
    expect(headerCells.length).toBeGreaterThan(0);
    headerCells.forEach((th) => {
      expect(th.className).toContain('sticky');
      expect(th.className).toContain('top-0');
    });
    // First two columns (Agent, Status) are also sticky-left and must win
    // both axes — highest header z-index tier.
    expect(headerCells[0].className).toContain('left-0');
    expect(headerCells[0].className).toContain('z-30');
    expect(headerCells[1].className).toContain('left-[160px]');
    expect(headerCells[1].className).toContain('z-30');
  });

  it('the card-scoped scroll container has both vertical and horizontal scroll (never page-level)', async () => {
    const { container } = render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    const scrollContainer = container.querySelector('table').parentElement;
    expect(scrollContainer.className).toContain('overflow-x-auto');
    expect(scrollContainer.className).toContain('overflow-y-auto');
    expect(scrollContainer.className).toContain('max-h-');
  });

  it('numeric cells render right-aligned tabular-nums; identity/status columns stay left-aligned', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    // Days-worked is a numeric column (uses the existing testid convention).
    const daysCell = screen.getByTestId('days-worked-agent-1').closest('td');
    expect(daysCell.className).toContain('text-right');
    expect(daysCell.className).toContain('tabular-nums');
    // Agent name (identity column) stays left-aligned.
    const nameCell = screen.getByText('Active Agent').closest('td');
    expect(nameCell.className).toContain('text-left');
  });
});

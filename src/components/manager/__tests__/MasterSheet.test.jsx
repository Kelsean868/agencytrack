// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

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
    // First two columns (# rank, Agent) are also sticky-left and must win
    // both axes — highest header z-index tier. (1.6: rank pinned at left-0,
    // Agent at left-[48px]; Status now scrolls, matching the matrix mockup.)
    expect(headerCells[0].className).toContain('left-0');
    expect(headerCells[0].className).toContain('z-30');
    expect(headerCells[1].className).toContain('left-[48px]');
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

describe('MasterSheet — 1.6 control layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('column presets reveal a domain subset (value-level headers present/absent)', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());

    // Default "All" — every column visible.
    expect(screen.getByText('API (TTD)')).toBeInTheDocument();
    expect(screen.getByText('New Names')).toBeInTheDocument();

    // Recruiting — top-of-funnel only; API + New CI absent, New Names present.
    fireEvent.click(screen.getByRole('button', { name: 'Recruiting' }));
    expect(screen.getByText('New Names')).toBeInTheDocument();
    expect(screen.getByText('Prospect. Touches')).toBeInTheDocument();
    expect(screen.queryByText('API (TTD)')).not.toBeInTheDocument();
    expect(screen.queryByText('Sales')).not.toBeInTheDocument();

    // Production — API present; New Names + Prospecting absent.
    fireEvent.click(screen.getByRole('button', { name: 'Production' }));
    expect(screen.getByText('API (TTD)')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.queryByText('New Names')).not.toBeInTheDocument();
    expect(screen.queryByText('Prospect. Touches')).not.toBeInTheDocument();

    // Identity columns (# / Agent / Status) survive every preset.
    expect(screen.getByRole('columnheader', { name: 'Agent' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
  });

  it('"only exceptions" toggle filters rows to unsubmitted (draft) agents', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    expect(screen.getByText('Draft Agent')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: /only exceptions/i }));

    // Submitted agent drops out; the draft (exception) agent remains.
    await waitFor(() => expect(screen.queryByText('Active Agent')).not.toBeInTheDocument());
    expect(screen.getByText('Draft Agent')).toBeInTheDocument();
  });

  it('status pill renders Submitted / Draft distinctly per agent', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());
    // "Submitted" also appears as the reality-bar stat label; the row pill is the
    // one inside the submitted agent's row. "Draft" is unique to the pill.
    const activeRow = screen.getByText('Active Agent').closest('tr');
    expect(within(activeRow).getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('reality-bar stats compute from the loaded week (API total, submitted, filed, exceptions)', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());

    // 2 subs × 8000 credit = 16,000 week API (submitted-provenance / estimated).
    expect(screen.getByTestId('mastersheet-reality-weekapi').textContent).toMatch(/16,?000/);
    // 1 submitted of 2 filers.
    expect(screen.getByTestId('mastersheet-reality-submitted').textContent).toMatch(/1\s*\/\s*2/);
    // No roster loaded (users=[]) → filed falls back to filer count.
    expect(screen.getByTestId('mastersheet-reality-filed').textContent).toMatch(/2\s*\/\s*2/);
    // 1 draft (unfinished) → 1 exception.
    expect(screen.getByTestId('mastersheet-reality-exceptions').textContent.trim()).toBe('1');
    // Provenance badge present (submitted, not settled).
    expect(screen.getByText('Estimated')).toBeInTheDocument();
  });

  it('ranks rows by production credit (desc) with gold top-3 treatment', async () => {
    const subs = [
      { id: 's1', agentId: 'agent-1', agentName: 'Mid',  status: 'submitted' },
      { id: 's2', agentId: 'agent-2', agentName: 'Top',  status: 'submitted' },
      { id: 's3', agentId: 'agent-3', agentName: 'Low',  status: 'submitted' },
      { id: 's4', agentId: 'agent-4', agentName: 'Four', status: 'submitted' },
    ];
    const credit = { s1: 5000, s2: 9000, s3: 1000, s4: 3000 };
    hoisted.getWeeklySubmissions.mockResolvedValue(subs);
    hoisted.getTenantUsers.mockResolvedValue([]);
    hoisted.extractFields.mockReturnValue(FIELDS);
    hoisted.computeRatios.mockReturnValue({ closingRatio: 50 });
    hoisted.extractTotalProductionCredit.mockImplementation((s) => credit[s.id]);

    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await waitFor(() => expect(screen.getByText('Top')).toBeInTheDocument());

    // Highest credit ranks #1 and is gold; #4 is not gold.
    expect(screen.getByTestId('rank-agent-2').textContent).toBe('1'); // Top (9000)
    expect(screen.getByTestId('rank-agent-2').className).toContain('text-gold-ink');
    expect(screen.getByTestId('rank-agent-1').textContent).toBe('2'); // Mid (5000)
    expect(screen.getByTestId('rank-agent-4').textContent).toBe('3'); // Four (3000)
    expect(screen.getByTestId('rank-agent-3').textContent).toBe('4'); // Low (1000)
    expect(screen.getByTestId('rank-agent-3').className).toContain('text-ink-muted');
    expect(screen.getByTestId('rank-agent-3').className).not.toContain('text-gold-ink');
  });
});

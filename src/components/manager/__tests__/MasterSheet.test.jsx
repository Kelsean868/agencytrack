// @vitest-environment jsdom
//
// MasterSheet — FUNNEL edition. The 8-stage funnel table: collapsed-to-KPI
// default, per-stage expand, tri-state sort, RANK BY preset, pinned totals,
// carried-over reality bar / exceptions / rank. extractFields + funnelModel run
// for real against flat submission docs; only the service + auth layers mock.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  getWeeklySubmissions: vi.fn(),
  getTenantUsers:       vi.fn(),
}));

vi.mock('../../../services/managerService', () => ({
  getWeeklySubmissions: hoisted.getWeeklySubmissions,
  getTenantUsers:       hoisted.getTenantUsers,
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ tenantId: 't1', user: { uid: 'u1' } }),
}));
vi.mock('../CoachingNotesModal', () => ({ default: () => null }));
vi.mock('../../submissions/SubmissionViewer', () => ({ default: () => null }));

import MasterSheet from '../MasterSheet';

// Flat-schema submission (extractFields flat path). Active agent, submitted,
// TTD 12,500. Funnel expectations (computeFunnelRow):
//   pTot  = 10+2+40+15 = 67   caTot = (7+3)+25 = 35   cmTot = 45+12 = 57
//   qa=20  ffiCond=9  ciCond=8  api=12500  refTot=16  refs=8  newNames=8
const SUB_A = {
  id: 's-a', agentId: 'agent-1', agentName: 'Active Agent', status: 'submitted',
  totalProductionCredit: 12500,
  prospectingLettersSent: 10, seminarsConducted: 2, coldCalls: 40, referralCalls: 15,
  followUpCalls: 7, seminarTradeshowCalls: 3, f2fAttempts: 25,
  telContacts: 45, f2fContacts: 12, qualifiedApproaches: 20,
  ffisScheduled: 12, ffiConducted: 9,
  newCIBooked: 6, oldCIBooked: 4, ciConducted: 8,
  applicationsSold: 3, livesSold: 5,
  referralsObtained: 8, namesFromColdCanvass: 5, namesFromSeminarsConducted: 1,
  namesFromTradeshowsAttended: 0, namesFromOther: 2,
  serviceCalls: 99, daysWorked: 5,
};
const SUB_B = {
  id: 's-b', agentId: 'agent-2', agentName: 'Draft Agent', status: 'draft',
  totalProductionCredit: 3000,
  prospectingLettersSent: 2, seminarsConducted: 0, coldCalls: 10, referralCalls: 3,
  followUpCalls: 2, seminarTradeshowCalls: 0, f2fAttempts: 6,
  telContacts: 8, f2fContacts: 3, qualifiedApproaches: 4,
  ffisScheduled: 3, ffiConducted: 2,
  newCIBooked: 1, oldCIBooked: 0, ciConducted: 1,
  applicationsSold: 1, livesSold: 1,
  referralsObtained: 1, namesFromColdCanvass: 1, namesFromOther: 0,
  serviceCalls: 1, daysWorked: 3,
};

function setup(subs = [SUB_A, SUB_B]) {
  hoisted.getWeeklySubmissions.mockResolvedValue(subs);
  hoisted.getTenantUsers.mockResolvedValue([]);
}
const flushLoad = () => waitFor(() => expect(screen.getByText('Active Agent')).toBeInTheDocument());

describe('MasterSheet funnel — rows + reality bar', () => {
  beforeEach(() => { vi.clearAllMocks(); setup(); });

  it('renders agent rows once loaded', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    expect(screen.getByText('Draft Agent')).toBeInTheDocument();
  });

  it('reality bar computes from the loaded week', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    expect(screen.getByTestId('mastersheet-reality-weekapi').textContent).toMatch(/15,?500/); // 12500 + 3000
    expect(screen.getByTestId('mastersheet-reality-submitted').textContent).toMatch(/1\s*\/\s*2/);
    expect(screen.getByTestId('mastersheet-reality-filed').textContent).toMatch(/2\s*\/\s*2/);
    expect(screen.getByTestId('mastersheet-reality-exceptions').textContent.trim()).toBe('1');
    expect(screen.getByText('Estimated')).toBeInTheDocument();
  });

  it('ranks rows by production credit (desc), gold top-3', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    expect(screen.getByTestId('rank-agent-1').textContent).toBe('1');
    expect(screen.getByTestId('rank-agent-1').className).toContain('text-gold-ink');
    expect(screen.getByTestId('rank-agent-2').textContent).toBe('2');
  });

  it('IK footer reports FFI + CI Conducted across rows', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    // (9+8) + (2+1) = 20
    expect(screen.getByTestId('funnel-ik-footer').textContent).toMatch(/20 this week/i);
  });
});

describe('MasterSheet funnel — collapse / expand', () => {
  beforeEach(() => { vi.clearAllMocks(); setup(); });

  it('collapsed by default: KPI cells present, sub-column cells absent', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    // Prospecting KPI cell present for agent-1…
    expect(screen.getByTestId('fc-pTot-agent-1')).toBeInTheDocument();
    // …but its sub-columns are hidden while collapsed.
    expect(screen.queryByTestId('fc-letters-agent-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fc-canvass-agent-1')).not.toBeInTheDocument();
    // Header sub-column labels also hidden.
    expect(screen.queryByText('Letters/Em')).not.toBeInTheDocument();
  });

  it('expanding one stage reveals its sub-columns; neighbours stay collapsed', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    fireEvent.click(screen.getByRole('button', { name: /expand prospecting activities/i }));
    expect(screen.getByTestId('fc-letters-agent-1')).toBeInTheDocument();
    expect(screen.getByText('Letters/Em')).toBeInTheDocument();
    // Contact Attempts stays collapsed (only its KPI).
    expect(screen.queryByTestId('fc-telAtt-agent-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('fc-caTot-agent-1')).toBeInTheDocument();
  });

  it('VIEW "+ Details" expands every stage', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    fireEvent.click(screen.getByRole('button', { name: '+ Details' }));
    expect(screen.getByTestId('fc-letters-agent-1')).toBeInTheDocument();
    expect(screen.getByTestId('fc-telAtt-agent-1')).toBeInTheDocument();
    expect(screen.getByTestId('fc-ciNew-agent-1')).toBeInTheDocument();
    // VIEW "Totals" collapses back.
    fireEvent.click(screen.getByRole('button', { name: 'Totals' }));
    expect(screen.queryByTestId('fc-letters-agent-1')).not.toBeInTheDocument();
  });

  it('KPI value equals the sum of its expanded sub-columns AT VALUE LEVEL', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    fireEvent.click(screen.getByRole('button', { name: '+ Details' }));
    const val = (tid) => Number(screen.getByTestId(tid).getAttribute('data-value'));
    // ① Prospecting: 10 + 2 + 40 + 15 = 67
    expect(val('fc-letters-agent-1') + val('fc-seminars-agent-1') + val('fc-canvass-agent-1') + val('fc-refCalls-agent-1'))
      .toBe(val('fc-pTot-agent-1'));
    expect(val('fc-pTot-agent-1')).toBe(67);
    // ② Contact Attempts: (7+3) + 25 = 35
    expect(val('fc-telAtt-agent-1') + val('fc-f2fAtt-agent-1')).toBe(val('fc-caTot-agent-1'));
    expect(val('fc-caTot-agent-1')).toBe(35);
    // ⑧ Referrals Total is the canonical New Names (no double-count).
    expect(val('fc-refs-agent-1') + val('fc-newNames-agent-1')).toBe(val('fc-refTot-agent-1'));
    expect(val('fc-refTot-agent-1')).toBe(16);
  });
});

describe('MasterSheet funnel — sort, preset, exceptions', () => {
  beforeEach(() => { vi.clearAllMocks(); setup(); });

  it('tri-state KPI sort sets aria-sort and a dismissible chip; 3rd click resets', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    const apiBtn = screen.getByRole('button', { name: 'API · TTD' });
    const apiHeader = apiBtn.closest('th');
    fireEvent.click(apiBtn);
    expect(apiHeader).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByTestId('funnel-chips')).toHaveTextContent(/SORT · 07 API · TTD ↓/i);
    fireEvent.click(apiBtn);
    expect(apiHeader).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(apiBtn);
    expect(apiHeader).toHaveAttribute('aria-sort', 'none');
    expect(screen.queryByTestId('funnel-chips')).not.toBeInTheDocument();
  });

  it('sort chip × resets the sort', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    const apiBtn = screen.getByRole('button', { name: 'API · TTD' });
    fireEvent.click(apiBtn);
    fireEvent.click(screen.getByRole('button', { name: /clear sort/i }));
    expect(apiBtn.closest('th')).toHaveAttribute('aria-sort', 'none');
  });

  it('RANK BY New Names moves terminal emphasis + sorts by newNames', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    // Default terminal = API (fc-api present, fc-newNames collapsed).
    expect(screen.getByTestId('fc-api-agent-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New Names' }));
    // Preset pressed + sort chip on newNames.
    expect(screen.getByRole('button', { name: 'New Names' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('funnel-chips')).toHaveTextContent(/08 NEW NAMES ↓/i);
  });

  it('"Only exceptions" filters to the draft (unsubmitted) agent', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    fireEvent.click(screen.getByRole('switch', { name: /only exceptions/i }));
    await waitFor(() => expect(screen.queryByText('Active Agent')).not.toBeInTheDocument());
    expect(screen.getByText('Draft Agent')).toBeInTheDocument();
  });

  it('status pill renders Submitted / Draft per agent', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    const activeRow = screen.getByText('Active Agent').closest('tr');
    expect(within(activeRow).getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('pinned totals row sums each visible column (value level)', async () => {
    render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    fireEvent.click(screen.getByRole('button', { name: '+ Details' }));
    // pTot: 67 (A) + (2+0+10+3=15) (B) = 82
    expect(Number(screen.getByTestId('ftot-pTot').getAttribute('data-value'))).toBe(82);
  });
});

describe('MasterSheet funnel — table structure (sticky lead, both-axis scroll)', () => {
  beforeEach(() => { vi.clearAllMocks(); setup(); });

  it('scroll container scrolls both axes; header + lead columns are sticky', async () => {
    const { container } = render(<MasterSheet selectedWeek="2026-06-28" setSelectedWeek={() => {}} />);
    await flushLoad();
    const scroll = container.querySelector('table').parentElement;
    expect(scroll.className).toContain('overflow-x-auto');
    expect(scroll.className).toContain('overflow-y-auto');
    expect(scroll.className).toContain('max-h-');
    // Two header rows (group tier + sub tier).
    expect(container.querySelectorAll('thead tr')).toHaveLength(2);
    // Rank lead cell sticky-left.
    const rankTd = screen.getByTestId('rank-agent-1').closest('td');
    expect(rankTd.className).toContain('sticky');
    expect(rankTd.className).toContain('left-0');
  });
});

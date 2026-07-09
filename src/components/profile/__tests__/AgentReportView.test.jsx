import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Mock useCountUp → identity so hero/KPI numerals assert EXACTLY (established
// convention; the rAF count would otherwise show an intermediate value).
vi.mock('../../../hooks/useCountUp', () => ({
  useCountUp: (value) => value,
}));

import AgentReportView from '../AgentReportView';
import { deriveAgentReportModel, aggregateFields } from '../agentReportModel';
import {
  extractTotalProductionCredit,
  computeRatios,
  formatRatioValue,
} from '../../../utils/extractFields';
import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
} from '../../../lib/productionReport/computations';
import { formatCurrency } from '../../../utils/formatters';

// Fixed reference date so period windows are deterministic.
const NOW = new Date('2026-06-15T12:00:00Z');

// Two submitted weeks in 2026. `totalProductionCredit` deliberately DIFFERS from
// `apiSold` so a wrong (re-derived) path would produce a different number — the
// data-path constraint is falsifiable.
const SUBMISSIONS = [
  {
    id: 'a', status: 'submitted', weekStarting: '2026-03-10',
    totalProductionCredit: 10000, apiSold: 999,
    applicationsSold: 2, appsSold: 2,
    ciConducted: 4, ffiConducted: 6, appointmentsSet: 8,
    solutionPresentations: 5, qualifiedApproaches: 10,
    telContacts: 20, f2fContacts: 4, f2fAttempts: 6,
    referralCalls: 15, coldCalls: 10, followUpCalls: 5, seminarTradeshowCalls: 0,
    livesSold: 3, referralsObtained: 4,
  },
  {
    id: 'b', status: 'submitted', weekStarting: '2026-06-05',
    totalProductionCredit: 5000, apiSold: 111,
    applicationsSold: 1, appsSold: 1,
    ciConducted: 2, ffiConducted: 3, appointmentsSet: 4,
    solutionPresentations: 2, qualifiedApproaches: 5,
    telContacts: 12, f2fContacts: 2, f2fAttempts: 3,
    referralCalls: 8, coldCalls: 4, followUpCalls: 2, seminarTradeshowCalls: 0,
    livesSold: 1, referralsObtained: 2,
  },
];

const baseProps = {
  submissions: SUBMISSIONS,
  settlements: [],
  goals: { annualAPI: 500000 },
  persistency: [{ year: 2026, month: 5, persistency: 0.92 }],
  agentProfile: { contractStartDate: '2020-01-01' },
  displayName: 'Devin Lewis',
  roleLabel: 'Agent',
  now: NOW,
};

describe('AgentReportView — same-data-path constraint', () => {
  it('hero YTD API equals the sum via extractTotalProductionCredit (NOT apiSold)', () => {
    render(<AgentReportView layout="wide" {...baseProps} />);
    const expected = SUBMISSIONS.reduce((s, sub) => s + extractTotalProductionCredit(sub), 0);
    expect(expected).toBe(15000); // guards the fixture
    // A re-derivation from apiSold would be 1110 — proving the path matters.
    expect(SUBMISSIONS.reduce((s, sub) => s + sub.apiSold, 0)).toBe(1110);
    expect(screen.getByTestId('agent-report-hero-api')).toHaveTextContent(formatCurrency(expected));
  });

  it('period windows equal computeAgentTotals(filterSubmissionsByPeriod(...))', () => {
    render(<AgentReportView layout="wide" {...baseProps} />);
    const grid = screen.getByTestId('agent-report-windows');
    for (const period of ['week', 'mtd', 'quarter', 'ytd']) {
      const t = computeAgentTotals(filterSubmissionsByPeriod(SUBMISSIONS, period, NOW));
      // Each window's API string must be present in the grid.
      expect(grid).toHaveTextContent(formatCurrency(t.totalApi));
    }
    // YTD = 15000, MTD/Quarter = 5000, Week = 0 (values proven distinct).
    expect(computeAgentTotals(filterSubmissionsByPeriod(SUBMISSIONS, 'ytd', NOW)).totalApi).toBe(15000);
    expect(computeAgentTotals(filterSubmissionsByPeriod(SUBMISSIONS, 'week', NOW)).totalApi).toBe(0);
  });

  it('closing ratio equals computeRatios(aggregate).closingRatio', () => {
    render(<AgentReportView layout="wide" {...baseProps} />);
    const ytdSubs = filterSubmissionsByPeriod(SUBMISSIONS, 'ytd', NOW);
    const expectedRatios = computeRatios(aggregateFields(ytdSubs));
    // closingRatio = apps(3) / ciConducted(6) = 50%
    expect(expectedRatios.closingRatio).toBe(50);
    expect(screen.getByTestId('agent-report-ratio-closingRatio'))
      .toHaveTextContent(formatRatioValue('closingRatio', expectedRatios.closingRatio));
    // Hero closing-ratio stat matches the model's value.
    const model = deriveAgentReportModel({ ...baseProps, period: 'ytd', now: NOW });
    expect(model.closingRatio).toBe(50);
  });

  it('activity tiles read the extractFields aggregate (dials via totalTelAttempts)', () => {
    render(<AgentReportView layout="wide" {...baseProps} />);
    const agg = aggregateFields(filterSubmissionsByPeriod(SUBMISSIONS, 'ytd', NOW));
    // dials = totalTelAttempts = referral+cold+followUp+seminarTradeshow
    // A: 15+10+5+0=30, B: 8+4+2+0=14 → 44
    expect(agg.totalTelAttempts).toBe(44);
    expect(screen.getByTestId('agent-report-activity-dials')).toHaveTextContent('44');
  });
});

describe('AgentReportView — layouts & states', () => {
  it('renders the wide layout', () => {
    render(<AgentReportView layout="wide" {...baseProps} />);
    expect(screen.getByTestId('agent-report-wide')).toBeInTheDocument();
  });

  it('renders the narrow layout', () => {
    render(<AgentReportView layout="narrow" {...baseProps} />);
    expect(screen.getByTestId('agent-report-narrow')).toBeInTheDocument();
  });

  it('shows the loading skeleton when loading', () => {
    render(<AgentReportView layout="wide" {...baseProps} loading />);
    expect(screen.getByTestId('agent-report-loading')).toBeInTheDocument();
  });

  it('shows the error card + Retry, and Retry invokes onRetry', () => {
    const onRetry = vi.fn();
    render(<AgentReportView layout="wide" {...baseProps} error onRetry={onRetry} />);
    expect(screen.getByTestId('agent-report-error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the actionable empty state when there are no submitted reports', () => {
    render(<AgentReportView layout="wide" {...baseProps} submissions={[]} />);
    expect(screen.getByTestId('agent-report-empty')).toBeInTheDocument();
    expect(screen.getByText(/No reports yet/i)).toBeInTheDocument();
  });

  it('Download PDF button invokes the passed handler', () => {
    const onDownloadPDF = vi.fn();
    render(<AgentReportView layout="wide" {...baseProps} onDownloadPDF={onDownloadPDF} />);
    fireEvent.click(screen.getByTestId('agent-report-download'));
    expect(onDownloadPDF).toHaveBeenCalledTimes(1);
  });

  it('TimePeriodToggle switches the active period (activity header follows)', () => {
    render(<AgentReportView layout="wide" {...baseProps} />);
    // Default period = Year.
    const wide = screen.getByTestId('agent-report-wide');
    expect(within(wide).getByText(/Activity · Year/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Week' }));
    expect(within(wide).getByText(/Activity · Week/i)).toBeInTheDocument();
  });
});

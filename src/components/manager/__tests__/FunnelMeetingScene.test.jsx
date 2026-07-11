// FunnelMeetingScene — the Master Sheet funnel projected into Meeting Mode.
// Value-level tests: KPI == sub-column sums (through the real extractFields +
// funnelModel path), the exceptions cut reduces rows, live search filters, and
// collapse/expand reveals sub-columns. The column model is the shipped
// funnelModel — these tests prove the projection renderer reads it faithfully.
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FunnelMeetingScene from '../FunnelMeetingScene';

// Raw submission docs (flat v2 schema — the seed-fixtures.mjs subBody shape).
// STRONG mirrors the staging seed's strong week: Prospecting Total = 10+0+40+15
// = 65, Contact Attempts Total = (10+5)+25 = 40 (the same anchors the
// t1-master-sheet VH leg pins).
const STRONG = {
  agentId: 'a-strong', agentName: 'Strong Agent', status: 'submitted',
  version: 2, weekStarting: '2026-06-28', totalProductionCredit: 12500,
  newBusiness: { apps: 2, api: 12500 },
  prospectingLettersSent: 10, seminarsConducted: 0, coldCalls: 40, referralCalls: 15,
  followUpCalls: 10, seminarTradeshowCalls: 5, f2fAttempts: 25, f2fContacts: 15,
  telContacts: 45, qualifiedApproaches: 20,
  ffisScheduled: 12, ffiConducted: 10, newCIBooked: 6, oldCIBooked: 4, ciConducted: 10,
  livesSold: 2, referralsObtained: 8, namesFromColdCanvass: 5, namesFromOther: 2,
};
const DRAFT = {
  agentId: 'b-draft', agentName: 'Draft Agent', status: 'draft',
  version: 2, weekStarting: '2026-06-28', totalProductionCredit: 3000,
  newBusiness: { apps: 1, api: 3000 },
  prospectingLettersSent: 2, seminarsConducted: 0, coldCalls: 10, referralCalls: 3,
  followUpCalls: 2, seminarTradeshowCalls: 0, f2fAttempts: 6, f2fContacts: 3,
  telContacts: 8, qualifiedApproaches: 4,
  ffisScheduled: 3, ffiConducted: 2, newCIBooked: 1, oldCIBooked: 0, ciConducted: 1,
  livesSold: 1, referralsObtained: 1, namesFromColdCanvass: 1,
};

function renderScene(subs = [STRONG, DRAFT]) {
  return render(<FunnelMeetingScene submissions={subs} selectedWeek="2026-06-28" />);
}

const dv = (testid) => Number(screen.getByTestId(testid).getAttribute('data-value'));

describe('FunnelMeetingScene — projection render', () => {
  it('renders the projected sheet header + IK footer', () => {
    renderScene();
    expect(screen.getByText('The Master Sheet')).toBeInTheDocument();
    expect(screen.getByTestId('meeting-funnel-ik')).toHaveTextContent(/Interviews Kept/i);
  });

  it('defaults to TOTALS — KPI columns present, sub-columns hidden', () => {
    renderScene();
    // Prospecting KPI cell for the strong row is present…
    expect(screen.getByTestId('mfc-pTot-a-strong')).toBeInTheDocument();
    // …its sub-columns are collapsed away.
    expect(screen.queryByTestId('mfc-letters-a-strong')).toBeNull();
  });

  it('expanding a stage reveals sub-columns and the KPI equals their sum (value level)', () => {
    renderScene();
    fireEvent.click(screen.getByRole('button', { name: /expand prospecting activities/i }));
    const pTot = dv('mfc-pTot-a-strong');
    const pSum = dv('mfc-letters-a-strong') + dv('mfc-seminars-a-strong')
      + dv('mfc-canvass-a-strong') + dv('mfc-refCalls-a-strong');
    expect(pTot).toBe(pSum);
    expect(pTot).toBe(65); // seed strong-week anchor

    fireEvent.click(screen.getByRole('button', { name: /expand contact attempts/i }));
    const caTot = dv('mfc-caTot-a-strong');
    const caSum = dv('mfc-telAtt-a-strong') + dv('mfc-f2fAtt-a-strong');
    expect(caTot).toBe(caSum);
    expect(caTot).toBe(40); // seed strong-week anchor
  });

  it('the totals row sums the terminal API across displayed rows', () => {
    renderScene();
    // 12,500 (strong) + 3,000 (draft) = 15,500.
    expect(dv('mftot-api')).toBe(15500);
  });

  it('the exceptions cut reduces rows to only non-submitted (draft) filers', () => {
    renderScene();
    // Both rows present by default.
    expect(screen.getByTestId('mfrow-a-strong')).toBeInTheDocument();
    expect(screen.getByTestId('mfrow-b-draft')).toBeInTheDocument();
    // Toggle EXCEPTIONS → the submitted strong row drops, the draft row stays.
    fireEvent.click(screen.getByTestId('meeting-funnel-exceptions'));
    expect(screen.queryByTestId('mfrow-a-strong')).toBeNull();
    expect(screen.getByTestId('mfrow-b-draft')).toBeInTheDocument();
  });

  it('an all-submitted set reduces to an empty exceptions view', () => {
    renderScene([STRONG, { ...STRONG, agentId: 'a2', agentName: 'Second Agent' }]);
    fireEvent.click(screen.getByTestId('meeting-funnel-exceptions'));
    expect(screen.getByTestId('meeting-funnel-empty')).toBeInTheDocument();
  });

  it('live search filters rows by agent name', () => {
    renderScene();
    fireEvent.change(screen.getByLabelText('Search agent'), { target: { value: 'strong' } });
    expect(screen.getByTestId('mfrow-a-strong')).toBeInTheDocument();
    expect(screen.queryByTestId('mfrow-b-draft')).toBeNull();
  });

  it('tri-state header sort cycles desc → asc → default', () => {
    renderScene();
    const apiHeader = () => screen.getByRole('columnheader', { name: /API/i });
    // Default: API rank (strong rank 1, draft rank 2).
    expect(apiHeader()).toHaveAttribute('aria-sort', 'none');
    const btn = () => within(apiHeader()).getByRole('button');
    fireEvent.click(btn());
    expect(apiHeader()).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(btn());
    expect(apiHeader()).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(btn());
    expect(apiHeader()).toHaveAttribute('aria-sort', 'none');
  });
});

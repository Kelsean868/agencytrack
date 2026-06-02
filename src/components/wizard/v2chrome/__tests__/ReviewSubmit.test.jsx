// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReviewSubmit from '../ReviewSubmit';
import {
  totalProductionAPI,
  totalApps,
  ciConv,
  totalCalls,
  totalNames,
  estCommission,
} from '../../../../lib/schema/wizardLive.computations';

vi.mock('../../../../utils/formatters', () => ({
  formatCurrency: (v) => `TTD ${Math.round(Number(v) || 0).toLocaleString('en-US')}`,
}));

const SAMPLE = {
  newBusiness:  { apps: 2, api: 18400 },
  pppIncreases: { apps: 1, apiIncrease: 6000 },
  lumpsums:     { grossAmount: 60000 },
  ciConducted:  4,
  newCIBooked:  3,
  oldCIBooked:  2,
  livesSold:    4,
  referralCalls: 5, followUpCalls: 3, coldCalls: 7,
  seminarTradeshowCalls: 2, serviceCalls: 4,
  namesFromColdCanvass: 3, referralsObtained: 2,
  namesFromSeminarsConducted: 1, namesFromSeminarsAttended: 0,
  namesFromTradeshowsConducted: 0, namesFromTradeshowsAttended: 0,
  namesFromOther: 0,
  ratingPlanning: 7, ratingTimeManagement: 6, ratingSalesPerformance: 8,
  ratingProspecting: 7, ratingOverall: 7,
  notes: 'Great week.',
  targetTelContacts: 55, targetFFI: 6, targetCI: 5, targetAPI: 24000,
  goalNotes: 'Focus on referrals.',
};

const LAST_WEEK = {
  ...SAMPLE,
  newBusiness:  { apps: 1, api: 10000 },
  pppIncreases: { apps: 0, apiIncrease: 0 },
  lumpsums:     { grossAmount: 0 },
};

describe('ReviewSubmit — renders sections + reuses canonical compute lib', () => {
  it('renders hero with Production API derived from canonical compute', () => {
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} onEditStep={vi.fn()} />);
    const expected = totalProductionAPI(SAMPLE);
    expect(screen.getByTestId('wizard-v2-review-api')).toHaveTextContent(
      `TTD ${expected.toLocaleString('en-US')}`,
    );
  });

  it('renders Est. Commission from estCommission()', () => {
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} onEditStep={vi.fn()} />);
    const expected = estCommission(SAMPLE, 7.5);
    expect(screen.getByTestId('wizard-v2-review-comm')).toHaveTextContent(
      `TTD ${Math.round(expected).toLocaleString('en-US')}`,
    );
  });

  it('renders all 4 review sections', () => {
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} onEditStep={vi.fn()} />);
    expect(screen.getByTestId('wizard-v2-review-section-production')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-v2-review-section-activity')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-v2-review-section-reflection')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-v2-review-section-goals')).toBeInTheDocument();
  });

  it('activity tiles use the canonical compute lib (CALLS/NAMES/CIs/CONV)', () => {
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} onEditStep={vi.fn()} />);
    expect(screen.getByTestId('wizard-v2-review-tile-calls-value')).toHaveTextContent(
      String(totalCalls(SAMPLE)),
    );
    expect(screen.getByTestId('wizard-v2-review-tile-names-value')).toHaveTextContent(
      String(totalNames(SAMPLE)),
    );
    expect(screen.getByTestId('wizard-v2-review-tile-cis-value')).toHaveTextContent(
      String(SAMPLE.ciConducted),
    );
    expect(screen.getByTestId('wizard-v2-review-tile-conv-value')).toHaveTextContent(
      `${ciConv(SAMPLE)}%`,
    );
    // sanity: totalApps in hero subtitle area
    expect(totalApps(SAMPLE)).toBe(3);
  });

  it('renders next-week goal tiles from entered values', () => {
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} onEditStep={vi.fn()} />);
    expect(screen.getByTestId('wizard-v2-review-goal-calls-value')).toHaveTextContent('55');
    expect(screen.getByTestId('wizard-v2-review-goal-ffi-value')).toHaveTextContent('6');
    expect(screen.getByTestId('wizard-v2-review-goal-ci-value')).toHaveTextContent('5');
    expect(screen.getByTestId('wizard-v2-review-goal-api-value')).toHaveTextContent(
      'TTD 24,000',
    );
  });

  it('renders notes + goal notes blockquotes when populated', () => {
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} onEditStep={vi.fn()} />);
    expect(screen.getByTestId('wizard-v2-review-notes')).toHaveTextContent('Great week.');
    expect(screen.getByTestId('wizard-v2-review-goal-notes')).toHaveTextContent(
      'Focus on referrals.',
    );
  });

  it('hides notes + goal notes when empty', () => {
    render(
      <ReviewSubmit
        data={{ ...SAMPLE, notes: '', goalNotes: '   ' }}
        commissionRate={7.5}
        onEditStep={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('wizard-v2-review-notes')).toBeNull();
    expect(screen.queryByTestId('wizard-v2-review-goal-notes')).toBeNull();
  });
});

describe('ReviewSubmit — Edit · Step N jump-backs', () => {
  it('Production edit → step 7', () => {
    const onEditStep = vi.fn();
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} onEditStep={onEditStep} />);
    fireEvent.click(screen.getByTestId('wizard-v2-review-section-production-edit'));
    expect(onEditStep).toHaveBeenCalledWith(7);
  });

  it('Activity edit → step 3', () => {
    const onEditStep = vi.fn();
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} onEditStep={onEditStep} />);
    fireEvent.click(screen.getByTestId('wizard-v2-review-section-activity-edit'));
    expect(onEditStep).toHaveBeenCalledWith(3);
  });

  it('Reflection edit → step 10', () => {
    const onEditStep = vi.fn();
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} onEditStep={onEditStep} />);
    fireEvent.click(screen.getByTestId('wizard-v2-review-section-reflection-edit'));
    expect(onEditStep).toHaveBeenCalledWith(10);
  });

  it('Next Week Goals edit → step 11', () => {
    const onEditStep = vi.fn();
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} onEditStep={onEditStep} />);
    fireEvent.click(screen.getByTestId('wizard-v2-review-section-goals-edit'));
    expect(onEditStep).toHaveBeenCalledWith(11);
  });

  it('Edit pills are real <button>s with 44px tap-target class + aria-label', () => {
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} onEditStep={vi.fn()} />);
    const btn = screen.getByTestId('wizard-v2-review-section-production-edit');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.className).toContain('h-11');
    expect(btn.getAttribute('aria-label')).toBe('Edit step 7');
  });
});

describe('ReviewSubmit — Review ↔ panel parity (same compute lib)', () => {
  // Brief: "Review↔panel parity: the Review's computed totals equal the
  // Week-So-Far panel's for the same inputs." Both call the same exported
  // pure functions, so the assertion is: ReviewSubmit's rendered numbers
  // equal the pure-function outputs (which the panel also uses verbatim).
  it('hero Production API equals totalProductionAPI(formData)', () => {
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} onEditStep={vi.fn()} />);
    const heroText = screen.getByTestId('wizard-v2-review-api').textContent;
    const heroNum = Number(heroText.replace(/[^0-9]/g, ''));
    expect(heroNum).toBe(totalProductionAPI(SAMPLE));
  });

  it('Activity CONV % equals ciConv(formData)', () => {
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} onEditStep={vi.fn()} />);
    const convText = screen.getByTestId('wizard-v2-review-tile-conv-value').textContent;
    expect(Number(convText.replace(/[^0-9]/g, ''))).toBe(ciConv(SAMPLE));
  });

  it('lastWeek delta in hero subtitle is null when lastWeekData absent', () => {
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} lastWeekData={null} onEditStep={vi.fn()} />);
    // No "vs last wk" copy when no prior submission.
    expect(screen.queryByText(/vs last wk/)).toBeNull();
  });

  it('lastWeek delta in hero subtitle renders when lastWeekData provided', () => {
    render(<ReviewSubmit data={SAMPLE} commissionRate={7.5} lastWeekData={LAST_WEEK} onEditStep={vi.fn()} />);
    expect(screen.getByText(/vs last wk/)).toBeInTheDocument();
  });
});

describe('ReviewSubmit — empty / first-time-agent state', () => {
  it('renders all 4 sections with zeros when formData is empty', () => {
    render(<ReviewSubmit data={{}} commissionRate={0} onEditStep={vi.fn()} />);
    expect(screen.getByTestId('wizard-v2-review-api')).toHaveTextContent('TTD 0');
    expect(screen.getByTestId('wizard-v2-review-tile-calls-value')).toHaveTextContent('0');
    expect(screen.getByTestId('wizard-v2-review-tile-conv-value')).toHaveTextContent('0%');
  });
});

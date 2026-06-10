// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeekSoFarPanel from '../WeekSoFarPanel';

vi.mock('../../../../utils/formatters', () => ({
  formatCurrency: (v) => `TTD ${Math.round(Number(v) || 0).toLocaleString('en-US')}`,
}));

// Sample wizard formData matching the v2 shape.
const SAMPLE_FORM = {
  newBusiness:  { apps: 2, api: 18400 },
  pppIncreases: { apps: 1, apiIncrease: 6000 },
  lumpsums:     { grossAmount: 60000 },
  ciConducted: 4,
  referralCalls: 5, followUpCalls: 3, coldCalls: 7,
  seminarTradeshowCalls: 2, serviceCalls: 4,
  namesFromColdCanvass: 3, referralsObtained: 2,
  namesFromSeminarsConducted: 1, namesFromTradeshowsAttended: 0,
  namesFromOther: 0,
};

const LAST_WEEK_DOC = {
  newBusiness:  { apps: 1, api: 10000 },
  pppIncreases: { apps: 0, apiIncrease: 0 },
  lumpsums:     { grossAmount: 0 },
  ciConducted: 3,
  referralCalls: 2, followUpCalls: 2, coldCalls: 2,
  seminarTradeshowCalls: 1, serviceCalls: 1,
  namesFromColdCanvass: 1, referralsObtained: 1,
  namesFromSeminarsConducted: 0, namesFromTradeshowsAttended: 0,
  namesFromOther: 0,
};

// ─── Desktop variant ───────────────────────────────────────────────────────

describe('WeekSoFarPanel (desktop) — render + hero + scorecards + still-to-enter', () => {
  it('renders the "Your week so far" eyebrow + Live label', () => {
    render(<WeekSoFarPanel formData={SAMPLE_FORM} commissionRate={7.5} />);
    expect(screen.getByTestId('wizard-v2-week-so-far-eyebrow')).toHaveTextContent(/your week so far/i);
  });

  it('renders the live Production API value', () => {
    render(<WeekSoFarPanel formData={SAMPLE_FORM} commissionRate={7.5} />);
    // 18400 + 6000 + 60000*0.10 = 30400
    expect(screen.getByTestId('wizard-v2-week-so-far-api')).toHaveTextContent('TTD 30,400');
  });

  it('renders the Est. Comm value', () => {
    render(<WeekSoFarPanel formData={SAMPLE_FORM} commissionRate={7.5} />);
    // 18400 × 0.075 + 60000 × 0.005 = 1380 + 300 = 1680
    expect(screen.getByTestId('wizard-v2-week-so-far-comm')).toHaveTextContent('TTD 1,680');
  });

  it('renders all 4 scorecards with computed values', () => {
    render(<WeekSoFarPanel formData={SAMPLE_FORM} commissionRate={7.5} />);
    // APPS = 2 + 1 = 3
    expect(screen.getByTestId('wizard-v2-week-so-far-card-apps')).toHaveTextContent('3');
    // CONV = round(2/4 × 100) = 50%
    expect(screen.getByTestId('wizard-v2-week-so-far-card-conv')).toHaveTextContent('50%');
    // CALLS = 5+3+7+2+4 = 21
    expect(screen.getByTestId('wizard-v2-week-so-far-card-calls')).toHaveTextContent('21');
    // NAMES = 3+2+1+0+0+0+0 = 6
    expect(screen.getByTestId('wizard-v2-week-so-far-card-names')).toHaveTextContent('6');
  });

  it('renders still-to-enter hint with computed remaining steps', () => {
    render(<WeekSoFarPanel formData={SAMPLE_FORM} currentStep={5} totalSteps={12} />);
    expect(screen.getByTestId('wizard-v2-week-so-far-still-to-enter')).toHaveTextContent(/7 more steps/);
  });

  it('shows "Ready to submit." when currentStep equals totalSteps', () => {
    render(<WeekSoFarPanel formData={SAMPLE_FORM} currentStep={12} totalSteps={12} />);
    expect(screen.getByTestId('wizard-v2-week-so-far-still-to-enter')).toHaveTextContent(/ready to submit/i);
  });
});

// ─── Delta chip behavior ───────────────────────────────────────────────────

describe('WeekSoFarPanel — delta chip show/hide logic', () => {
  it('hides all delta chips when lastWeekData is null (first-week case)', () => {
    render(<WeekSoFarPanel formData={SAMPLE_FORM} lastWeekData={null} />);
    expect(screen.queryByTestId('wizard-v2-week-so-far-card-apps-delta')).toBeNull();
    expect(screen.queryByTestId('wizard-v2-week-so-far-card-conv-delta')).toBeNull();
    expect(screen.queryByTestId('wizard-v2-week-so-far-card-calls-delta')).toBeNull();
    expect(screen.queryByTestId('wizard-v2-week-so-far-card-names-delta')).toBeNull();
  });

  it('shows scorecard delta chips when lastWeek values are populated', () => {
    render(<WeekSoFarPanel formData={SAMPLE_FORM} lastWeekData={LAST_WEEK_DOC} />);
    // APPS live 3 vs last 1 → +2
    expect(screen.getByTestId('wizard-v2-week-so-far-card-apps-delta')).toHaveTextContent('+2');
    // CALLS live 21 vs last 8 → +13
    expect(screen.getByTestId('wizard-v2-week-so-far-card-calls-delta')).toHaveTextContent('+13');
  });

  it('CONV delta carries the "pp" (percentage points) suffix', () => {
    render(<WeekSoFarPanel formData={SAMPLE_FORM} lastWeekData={LAST_WEEK_DOC} />);
    // live 50 vs last 33 (1/3 ≈ 33%) → +17pp
    const conv = screen.getByTestId('wizard-v2-week-so-far-card-conv-delta');
    expect(conv.textContent).toMatch(/pp$/);
  });

  it('hides delta when live == lastWeek (Δ=0 suppression)', () => {
    // Build a lastWeek that yields the same numbers as SAMPLE_FORM.
    render(<WeekSoFarPanel formData={SAMPLE_FORM} lastWeekData={SAMPLE_FORM} />);
    expect(screen.queryByTestId('wizard-v2-week-so-far-card-apps-delta')).toBeNull();
  });
});

// ─── Mobile collapsed strip ────────────────────────────────────────────────

describe('WeekSoFarPanel (mobile) — collapsed strip', () => {
  it('renders the mobile container with the testid', () => {
    render(<WeekSoFarPanel formData={SAMPLE_FORM} variant="mobile" />);
    expect(screen.getByTestId('wizard-v2-week-so-far-mobile')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-v2-week-so-far-mobile-api')).toHaveTextContent('TTD 30,400');
  });

  it('does NOT render the desktop panel testid when variant="mobile"', () => {
    render(<WeekSoFarPanel formData={SAMPLE_FORM} variant="mobile" />);
    expect(screen.queryByTestId('wizard-v2-week-so-far')).toBeNull();
  });

  it('shows mobile delta chip when lastWeek API present', () => {
    render(<WeekSoFarPanel formData={SAMPLE_FORM} lastWeekData={LAST_WEEK_DOC} variant="mobile" />);
    // live 30400 vs last 10000 → +20400 (▲)
    expect(screen.getByTestId('wizard-v2-week-so-far-mobile-delta')).toHaveTextContent('▲');
  });
});

// ─── Empty / partial states ────────────────────────────────────────────────

describe('WeekSoFarPanel — empty/partial states', () => {
  it('renders TTD 0 when formData has no production fields', () => {
    render(<WeekSoFarPanel formData={{}} />);
    expect(screen.getByTestId('wizard-v2-week-so-far-api')).toHaveTextContent('TTD 0');
    expect(screen.getByTestId('wizard-v2-week-so-far-comm')).toHaveTextContent('TTD 0');
  });

  it('renders 0% CONV when ciConducted is 0', () => {
    render(<WeekSoFarPanel formData={{ newBusiness: { apps: 5 }, ciConducted: 0 }} />);
    expect(screen.getByTestId('wizard-v2-week-so-far-card-conv')).toHaveTextContent('0%');
  });
});

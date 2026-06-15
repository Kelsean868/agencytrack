import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MdrtTracker from '../MdrtTracker';
import { MDRT_THRESHOLDS_2026 } from '../../../config/mdrtThresholds/2026';

const { mdrt: MDRT, cot: COT, tot: TOT } = MDRT_THRESHOLDS_2026;
// MDRT = 688_800, COT = 2_066_400, TOT = 4_132_800

// ── Compute-correctness (value assertions) ────────────────────────────────────

describe('MdrtTracker — compute-correctness', () => {
  it('50% MDRT progress: 344,400 ytdAPI → 50% to MDRT, gap = 344,400', () => {
    const ytdAPI = MDRT / 2; // 344_400
    render(<MdrtTracker ytdTotals={{ api: ytdAPI }} loading={false} />);

    const pct = screen.getByTestId('mdrt-progress-mdrt');
    expect(pct.textContent).toBe('50%');

    const gap = screen.getByTestId('mdrt-gap-mdrt');
    // gap = 688,800 − 344,400 = 344,400 → formatCurrency renders with commas
    expect(gap.textContent).toMatch(/344[,.]?400/);
  });

  it('MDRT met, COT is nearest: ytdAPI = 688,800 → MDRT 100%, COT shows gap 1,377,600', () => {
    render(<MdrtTracker ytdTotals={{ api: MDRT }} loading={false} />);

    // MDRT tier met
    expect(screen.getByTestId('mdrt-progress-mdrt').textContent).toBe('100%');
    // No gap element for MDRT (met)
    expect(screen.queryByTestId('mdrt-gap-mdrt')).not.toBeInTheDocument();

    // COT is now the active target; gap = 2,066,400 − 688,800 = 1,377,600
    const cotGap = screen.getByTestId('mdrt-gap-cot');
    expect(cotGap.textContent).toMatch(/1[,.]?377[,.]?600/);
  });

  it('all three tiers met: ytdAPI ≥ TOT → no gap elements, no active-target badge', () => {
    render(<MdrtTracker ytdTotals={{ api: TOT }} loading={false} />);

    expect(screen.queryByTestId('mdrt-gap-mdrt')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mdrt-gap-cot')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mdrt-gap-tot')).not.toBeInTheDocument();
    expect(screen.queryByText(/active target/i)).not.toBeInTheDocument();
  });

  it('progress capped at 100% even when ytdAPI >> threshold', () => {
    render(<MdrtTracker ytdTotals={{ api: TOT * 2 }} loading={false} />);
    ['mdrt', 'cot', 'tot'].forEach((id) => {
      expect(screen.getByTestId(`mdrt-progress-${id}`).textContent).toBe('100%');
    });
  });
});

// ── Tier transitions ──────────────────────────────────────────────────────────

describe('MdrtTracker — tier transitions', () => {
  it('below MDRT: MDRT is active target', () => {
    render(<MdrtTracker ytdTotals={{ api: 100_000 }} loading={false} />);
    const mdrtRow = screen.getByTestId('mdrt-tier-mdrt');
    expect(mdrtRow.textContent).toMatch(/active target/i);
  });

  it('at exactly MDRT threshold: COT becomes active target', () => {
    render(<MdrtTracker ytdTotals={{ api: MDRT }} loading={false} />);
    const cotRow = screen.getByTestId('mdrt-tier-cot');
    expect(cotRow.textContent).toMatch(/active target/i);
    // MDRT row should show "Achieved" badge
    expect(screen.getByTestId('mdrt-tier-mdrt').textContent).toMatch(/achieved/i);
  });

  it('between MDRT and COT: COT is active target, MDRT shows achieved', () => {
    const ytdAPI = MDRT + 100_000; // 788,800
    render(<MdrtTracker ytdTotals={{ api: ytdAPI }} loading={false} />);
    expect(screen.getByTestId('mdrt-tier-cot').textContent).toMatch(/active target/i);
    expect(screen.getByTestId('mdrt-tier-mdrt').textContent).toMatch(/achieved/i);
  });

  it('at exactly COT threshold: TOT becomes active target', () => {
    render(<MdrtTracker ytdTotals={{ api: COT }} loading={false} />);
    expect(screen.getByTestId('mdrt-tier-tot').textContent).toMatch(/active target/i);
    expect(screen.getByTestId('mdrt-tier-cot').textContent).toMatch(/achieved/i);
    expect(screen.getByTestId('mdrt-tier-mdrt').textContent).toMatch(/achieved/i);
  });
});

// ── States ────────────────────────────────────────────────────────────────────

describe('MdrtTracker — states', () => {
  it('shows loading skeleton when loading=true', () => {
    render(<MdrtTracker ytdTotals={null} loading={true} />);
    expect(screen.getByTestId('mdrt-tracker-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('mdrt-tracker')).not.toBeInTheDocument();
  });

  it('shows no-production state when ytdAPI = 0', () => {
    render(<MdrtTracker ytdTotals={{ api: 0 }} loading={false} />);
    expect(screen.getByTestId('mdrt-tracker-no-production')).toBeInTheDocument();
    expect(screen.queryByTestId('mdrt-tracker')).not.toBeInTheDocument();
  });

  it('shows no-production state when ytdTotals is null', () => {
    render(<MdrtTracker ytdTotals={null} loading={false} />);
    expect(screen.getByTestId('mdrt-tracker-no-production')).toBeInTheDocument();
  });

  it('renders panel when ytdAPI > 0', () => {
    render(<MdrtTracker ytdTotals={{ api: 100_000 }} loading={false} />);
    expect(screen.getByTestId('mdrt-tracker')).toBeInTheDocument();
  });

  it('renders all three tier rows when panel is populated', () => {
    render(<MdrtTracker ytdTotals={{ api: 100_000 }} loading={false} />);
    expect(screen.getByTestId('mdrt-tier-mdrt')).toBeInTheDocument();
    expect(screen.getByTestId('mdrt-tier-cot')).toBeInTheDocument();
    expect(screen.getByTestId('mdrt-tier-tot')).toBeInTheDocument();
  });
});

// ── Role-agnostic ─────────────────────────────────────────────────────────────

describe('MdrtTracker — role-agnostic', () => {
  it('renders correctly with manager-shaped ytdTotals (extra fields present)', () => {
    // Manager's ytdTotals may carry extra keys — component only reads .api
    render(
      <MdrtTracker
        ytdTotals={{ api: 500_000, apps: 20, ffiConducted: 5 }}
        loading={false}
      />,
    );
    expect(screen.getByTestId('mdrt-tracker')).toBeInTheDocument();
    // 500,000 / 688,800 = 72.57% → rounds to 73%
    expect(screen.getByTestId('mdrt-progress-mdrt').textContent).toBe('73%');
  });
});

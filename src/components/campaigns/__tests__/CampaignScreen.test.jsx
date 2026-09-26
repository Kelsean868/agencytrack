// @vitest-environment jsdom
//
// R2 — the Campaign screen (CampaignHeroCard variant="screen").
// Fixture shared with R1 (CampaignHeroCompact.test.jsx): one settled policy
// worth TTD 73,946 of API against a Champion tier of 275,000 / 35 apps, 96
// days left to 31 Dec 2026 ("today" = 26 Sep 2026). A second, lapsed policy is
// added for the "below the gate" scenarios — the campaign lens (progress,
// tiers, pace) never counts it, so API/apps stay 73,946 / 1 in both fixtures;
// only the LEDGER-derived persistency projection (gateMonth) differs.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CampaignHeroCard from '../CampaignHeroCard';

const CAMPAIGN = {
  id: 'xmas26',
  name: 'Christmas Campaign & Retreat 2026',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  structure: 'qualify',
  persistencyGate: { mode: 'binary', basis: 'finalMonth', threshold: 90 },
  tiers: [
    { level: 1, name: 'Champion', api: 275_000, apps: 35, cash: 7_000, accommodation: 'shared' },
    { level: 2, name: 'VIP', api: 375_000, apps: 35, cash: 20_000, accommodation: 'shared' },
    { level: 5, name: 'Pioneer', api: 825_000, apps: 35, cash: 70_000, accommodation: 'double' },
  ],
};

const SETTLED = {
  id: 'p1', productLine: 'life', status: 'settled', isSelfOrFamily: false,
  newBusinessType: 'nb_ordinary', proposedAPI: 73_946, dateIssued: '2026-08-15',
  dateWritten: '2026-08-01', importSource: 'oipa_import', exportDate: '2026-09-15',
  isWritingAgent: true,
};
const LAPSED = {
  id: 'p2', productLine: 'life', status: 'lapsed', isSelfOrFamily: false,
  newBusinessType: 'nb_ordinary', proposedAPI: 12_000, dateIssued: '2026-08-20',
  dateWritten: '2026-08-05', importSource: 'oipa_import', exportDate: '2026-09-15',
  isWritingAgent: true, totalPremiumPaid: null,
};

// Projected Dec persistency ≈ 86.0% (below the 90% gate) — a lapse drags it down.
const BELOW_GATE_POLICIES = [SETTLED, LAPSED];
// No lapse → nothing to net off → projected persistency 100% (at/above gate).
const AT_GATE_POLICIES = [SETTLED];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-26T15:00:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CampaignHeroCard variant="screen"', () => {
  it('block 1 — progress: API, applications and persistency with "to go" copy', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={BELOW_GATE_POLICIES} persistencyRecords={[]} />);
    expect(screen.getByTestId('campaign-screen-progress-api')).toHaveTextContent('73.9K');
    expect(screen.getByTestId('campaign-screen-progress-api')).toHaveTextContent('275K');
    expect(screen.getByTestId('campaign-screen-progress-api')).toHaveTextContent('201.1K to go');
    expect(screen.getByTestId('campaign-screen-progress-apps')).toHaveTextContent('34 to go');
    expect(screen.getByTestId('campaign-screen-progress-persistency')).toHaveTextContent('Below the gate');
    expect(screen.getByTestId('campaign-screen-progress-persistency')).toHaveTextContent(/need 90% in Dec/);
    // Regression: a raw unrounded float ("86.0377446303493 of 100") must never
    // render — every number shown here is at most one decimal place.
    const persistencyText = screen.getByTestId('campaign-screen-progress-persistency').textContent;
    for (const m of persistencyText.matchAll(/\d+\.(\d+)/g)) {
      expect(m[1].length).toBeLessThanOrEqual(1);
    }
    expect(persistencyText).not.toMatch(/of 100\b/);
  });

  it('block 2 — what it takes: pace lines, reinstate line hidden at/above the gate', () => {
    const below = render(
      <CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={BELOW_GATE_POLICIES} persistencyRecords={[]} />,
    );
    expect(screen.getByTestId('campaign-screen-takes-api')).toHaveTextContent('14.7K');
    expect(screen.getByTestId('campaign-screen-takes-apps')).toHaveTextContent('2–3');
    expect(screen.getByTestId('campaign-screen-takes-reinstate')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-screen-takes-reinstate')).toHaveTextContent(/lifts persistency to 90%/);
    below.unmount();

    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={AT_GATE_POLICIES} persistencyRecords={[]} />);
    expect(screen.queryByTestId('campaign-screen-takes-reinstate')).toBeNull();
  });

  it('block 3 — persistency gate bar: tick at the gate threshold, projected value shown', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={BELOW_GATE_POLICIES} persistencyRecords={[]} />);
    const bar = screen.getByTestId('campaign-screen-gate-bar');
    const tick = bar.querySelector('[data-testid="campaign-screen-gate-bar-tick"]');
    // Gate 90 on an 80–95 scale → (90-80)/15 = 66.7% of the 300-wide viewBox.
    expect(Number(tick.getAttribute('x1'))).toBeCloseTo((66.667 / 100) * 300, 0);
    expect(screen.getByTestId('campaign-screen-gate-bar-value')).toHaveTextContent('86.0');
    expect(screen.getByText(/Judged on December/)).toBeInTheDocument();
  });

  it('block 3 — labels render as HTML outside the stretched SVG, never as SVG <text> (undistorted at any width)', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={BELOW_GATE_POLICIES} persistencyRecords={[]} />);
    const svg = screen.getByTestId('campaign-screen-gate-bar-svg');
    // The stretched SVG carries ONLY geometry — no <text> node at all, at any width.
    expect(svg.querySelectorAll('text')).toHaveLength(0);
    const valueLabel = screen.getByTestId('campaign-screen-gate-bar-value');
    expect(valueLabel.closest('svg')).toBeNull(); // real HTML, not inside the non-uniformly-scaled SVG
    expect(valueLabel.tagName).toBe('SPAN');
    // 86.0% on an 80–95 scale → (86.04-80)/15 ≈ 40.3%, rounded to the nearest
    // whole-percent Tailwind class (never an inline `style` with the raw float).
    expect(valueLabel.className).toMatch(/\bleft-\[40%\]/);
    const gateLabel = screen.getByText(/GATE 90/);
    expect(gateLabel.closest('svg')).toBeNull();
    // Gate 90 → 66.7%, rounded to the nearest whole percent.
    expect(gateLabel.className).toMatch(/\bleft-\[67%\]/);
  });

  it('block 3 — no fill/value drawn once persistency is unknown (no ledger data)', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={[]} persistencyRecords={[]} />);
    expect(screen.queryByTestId('campaign-screen-gate-bar-value')).toBeNull();
  });

  it('block 1 — pending (L0): faint arcs and "+x submitted" copy on API/Applications, persistency ring unchanged', () => {
    const withPending = [
      ...BELOW_GATE_POLICIES,
      { id: 'p3', productLine: 'life', status: 'submitted', isSelfOrFamily: false, newBusinessType: 'nb_ordinary', proposedAPI: 36_000, dateSubmitted: '2026-09-01' },
    ];
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={withPending} persistencyRecords={[]} />);
    const apiRow = screen.getByTestId('campaign-screen-progress-api');
    expect(apiRow.querySelector('[data-testid="donut-arc-pending"]')).toBeInTheDocument();
    expect(apiRow).toHaveTextContent('+36K submitted, waiting to settle');
    const appsRow = screen.getByTestId('campaign-screen-progress-apps');
    expect(appsRow.querySelector('[data-testid="donut-arc-pending"]')).toBeInTheDocument();
    expect(appsRow).toHaveTextContent('+1 submitted');
    // Persistency ring is untouched by L0 — no faint arc on it, ever.
    const persistencyRow = screen.getByTestId('campaign-screen-progress-persistency');
    expect(persistencyRow.querySelector('[data-testid="donut-arc-pending"]')).not.toBeInTheDocument();
    expect(screen.getByTestId('ring-legend')).toHaveTextContent('Settled — counts');
  });

  it('block 1 — no pending: no faint arcs anywhere in the progress block, legend hidden', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={AT_GATE_POLICIES} persistencyRecords={[]} />);
    expect(screen.getByTestId('campaign-screen-progress').querySelector('[data-testid="donut-arc-pending"]')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ring-legend')).not.toBeInTheDocument();
  });

  it('block 3 — the bar fills its column at any width (no aspect-ratio letterboxing)', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={BELOW_GATE_POLICIES} persistencyRecords={[]} />);
    expect(screen.getByTestId('campaign-screen-gate-bar-svg')).toHaveAttribute('preserveAspectRatio', 'none');
    // The distortion this guards against: labels live outside the stretched
    // SVG entirely, as plain HTML text (font-size in a real CSS unit, never
    // scaled by the SVG's own non-uniform viewBox transform).
    expect(screen.getByTestId('campaign-screen-gate-bar-value').tagName).toBe('SPAN');
  });

  it('block 3 — month-history row: derived (From HO · Confirm), estimate, projected — from #971\'s own outlook, not recomputed', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={BELOW_GATE_POLICIES} persistencyRecords={[]} />);
    const row = screen.getByTestId('campaign-screen-gate-month-history');
    expect(row).toBeInTheDocument();
    const derivedCol = screen.getByTestId('campaign-screen-gate-month-derived');
    expect(derivedCol).toHaveTextContent('Aug');
    expect(derivedCol).toHaveTextContent('86.0%'); // both fixture policies are Aug-issued, so the lapse counts here too
    // Aug 2026 predates the 24-month model's September cutover, so #971's own
    // `derived.confirmable` is false here — reusing that flag (never recomputing
    // it) means this column correctly shows no Confirm affordance for this month.
    expect(derivedCol).toHaveTextContent('From HO');
    expect(derivedCol).not.toHaveTextContent('Confirm');
    expect(screen.getByTestId('campaign-screen-gate-month-estimate')).toHaveTextContent('Sep');
    expect(screen.getByTestId('campaign-screen-gate-month-estimate')).toHaveTextContent('Estimate');
    const projectedCol = screen.getByTestId('campaign-screen-gate-month-projected');
    expect(projectedCol).toHaveTextContent('Dec');
    expect(projectedCol).toHaveTextContent('86.0%');
    expect(projectedCol).toHaveTextContent('Projected');
    // "Confirm" is inert text, never a control (self-confirm write path is P2d, out of scope).
    expect(screen.queryByRole('button', { name: /confirm/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /confirm/i })).toBeNull();
  });

  it('block 3 — month-history row shows "· Confirm" once the derived month is on the 24-month model', () => {
    vi.setSystemTime(new Date('2026-11-20T15:00:00Z')); // derived month → Sep 2026, confirmable
    const laterExport = BELOW_GATE_POLICIES.map((p) => ({ ...p, exportDate: '2026-10-15' }));
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={laterExport} persistencyRecords={[]} />);
    const derivedCol = screen.getByTestId('campaign-screen-gate-month-derived');
    expect(derivedCol).toHaveTextContent('Sep');
    expect(derivedCol).toHaveTextContent('From HO · Confirm');
  });

  it('block 4 — tier ladder: every tier, next tier highlighted, "You" row with progress, cash shown without "TTD" prefix', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={AT_GATE_POLICIES} persistencyRecords={[]} />);
    expect(screen.getByTestId('campaign-screen-tier-row-Champion')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-screen-tier-row-VIP')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-screen-tier-row-Pioneer')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-screen-tier-next-badge').closest('[data-testid^="campaign-screen-tier-row-"]'))
      .toHaveAttribute('data-testid', 'campaign-screen-tier-row-Champion');
    // The mockup's own cash column has no "TTD" — the header already says "cash in TTD".
    const pioneer = screen.getByTestId('campaign-screen-tier-row-Pioneer');
    expect(pioneer).toHaveTextContent('70,000');
    expect(pioneer).not.toHaveTextContent('TTD 70,000');
    expect(pioneer.querySelector('[title]')).toHaveAttribute('title', 'TTD 70,000');
    expect(screen.getByTestId('campaign-screen-you-row')).toHaveTextContent('27% of the way to Champion');
    // Singular "1 app", not "1 apps" — this fixture's lens has exactly one counted application.
    expect(screen.getByTestId('campaign-screen-you-row')).toHaveTextContent('1 app');
    expect(screen.getByTestId('campaign-screen-you-row')).not.toHaveTextContent('1 apps');
  });

  it('block 4 — desktop reflow: progress cards and what-it-takes cells switch to a 3-column grid at lg', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={BELOW_GATE_POLICIES} persistencyRecords={[]} />);
    expect(screen.getByTestId('campaign-screen-progress').className).toMatch(/lg:grid-cols-3/);
    expect(screen.getByTestId('campaign-screen-takes-api').parentElement.className).toMatch(/lg:grid-cols-3/);
  });

  it('block 5 — what-if card pairs its teal fill with dark:bg-primary-dark (CLAUDE.md D6)', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={AT_GATE_POLICIES} persistencyRecords={[]} />);
    const cls = screen.getByTestId('campaign-screen-whatif').className;
    expect(cls).toMatch(/\bbg-primary\b/);
    expect(cls).toMatch(/dark:bg-primary-dark\b/);
  });

  it('block 5 — what if: slider has a label, and the default pace projects Champion', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={AT_GATE_POLICIES} persistencyRecords={[]} />);
    const slider = screen.getByTestId('campaign-screen-whatif-slider');
    expect(slider).toHaveAttribute('type', 'range');
    expect(slider).toHaveAttribute('min', '5000');
    expect(slider).toHaveAttribute('max', '40000');
    expect(slider).toHaveAttribute('step', '1000');
    expect(screen.getByLabelText(/What if I write TTD/)).toBe(slider);

    fireEvent.change(slider, { target: { value: '20000' } });
    expect(screen.getByTestId('campaign-screen-whatif-result')).toHaveTextContent('Champion around 6 Dec 2026');
    expect(screen.getByTestId('campaign-screen-whatif-result')).toHaveTextContent(/VIP not reached by 31 Dec 2026 at this pace/);
  });

  it('block 6 — footer', () => {
    render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={AT_GATE_POLICIES} persistencyRecords={[]} />);
    expect(screen.getByTestId('campaign-screen-footer')).toHaveTextContent('An indication only. Executive Business Development decides.');
  });

  it('loading → skeleton; error → alert; no campaign → nothing', () => {
    const { unmount } = render(<CampaignHeroCard variant="screen" campaign={null} loading />);
    expect(screen.getByRole('status', { name: /Loading campaign progress/i })).toBeInTheDocument();
    unmount();
    const r2 = render(<CampaignHeroCard variant="screen" campaign={CAMPAIGN} policies={AT_GATE_POLICIES} error />);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t load your campaign progress/i);
    r2.unmount();
    const { container } = render(<CampaignHeroCard variant="screen" campaign={null} policies={AT_GATE_POLICIES} />);
    expect(container.firstChild).toBeNull();
  });
});

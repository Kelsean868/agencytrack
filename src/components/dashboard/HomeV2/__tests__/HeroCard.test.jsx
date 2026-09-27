// @vitest-environment jsdom
//
// HeroCard — Home redesign R1 block 2 (docs/briefs/home-campaign-redesign.md).
//
// The hero is one donut + one big number. Replaces the Track J item 23
// progress-bar/MDRT-marker coverage (that bar no longer exists); the hero-ledger
// H1 ledger-figure and R4 reconciliation-note assertions are kept, adjusted to
// the whole-TTD display.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import HeroCard from '../HeroCard';
import { MDRT_THRESHOLDS_2026 } from '../../../../config/mdrtThresholds/2026';
import { formatCurrency } from '../../../../utils/formatters';
import { deriveYearProduction } from '../../../../lib/ledgerProduction';

const MDRT = MDRT_THRESHOLDS_2026.mdrt;

// Force prefers-reduced-motion so the count-up hook and the donut both snap to
// their final values synchronously.
function mockMatchMedia(reduced) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query) => ({
      matches: reduced && query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  mockMatchMedia(true);
});

const production = (over = {}) => ({
  year: 2026,
  settled: { api: 87146.28, apps: 5, count: 5, fromHeadOffice: 5, selfConfirmed: 0 },
  submitted: { api: 123146.28, apps: 6, count: 6, datedByIssue: true, weekApi: 0 },
  weekly: { ytdApi: 30000, weekApi: 4800 },
  mismatch: { ytd: 30000 - 123146.28, week: 4800 },
  ...over,
});

describe('HeroCard — goal vs MDRT', () => {
  it('measures against MDRT when no personal goal is set, labelled OF MDRT', () => {
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} production={production()} />);
    const donut = screen.getByTestId('hero-donut');
    expect(donut).toHaveTextContent(`${Math.round((87146.28 / MDRT) * 100)}%`);
    expect(donut).toHaveTextContent('OF MDRT');
    expect(screen.getByTestId('hero-subline')).toHaveTextContent(`of ${MDRT.toLocaleString('en-TT')} MDRT`);
    // The goal IS MDRT, so there is no separate MDRT tick.
    expect(screen.queryByTestId('donut-tick')).not.toBeInTheDocument();
  });

  it('measures against the personal goal when set, labelled OF GOAL', () => {
    render(<HeroCard personalAnnualAPI={200000} onSubmit={() => {}} production={production()} />);
    const donut = screen.getByTestId('hero-donut');
    expect(donut).toHaveTextContent('44%');
    expect(donut).toHaveTextContent('OF GOAL');
    expect(screen.getByTestId('hero-subline')).toHaveTextContent('of 200,000 goal');
  });

  it('draws the MDRT point as a tick only when the goal is above MDRT', () => {
    const goal = MDRT * 2;
    const { unmount } = render(<HeroCard personalAnnualAPI={goal} onSubmit={() => {}} production={production()} />);
    const tick = screen.getByTestId('donut-tick');
    expect(tick.getAttribute('transform')).toBe('rotate(180 50 50)'); // MDRT is half the goal
    unmount();
    render(<HeroCard personalAnnualAPI={MDRT / 2} onSubmit={() => {}} production={production()} />);
    expect(screen.queryByTestId('donut-tick')).not.toBeInTheDocument();
  });
});

describe('HeroCard — big number and ledger figures', () => {
  it('shows whole TTD on the hero with the full value in the aria-label', () => {
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} production={production()} />);
    const big = screen.getByTestId('hero-settled-api');
    expect(big).toHaveTextContent('TTD87,146');
    expect(big).toHaveAttribute('aria-label', `Settled API ${formatCurrency(87146.28)}`);
  });

  it('shows settled apps, submitted API with the dated-by-issue marker, and submitted apps', () => {
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} production={production()} />);
    expect(screen.getByTestId('hero-settled-apps')).toHaveTextContent('5');
    expect(screen.getByTestId('hero-submitted-api')).toHaveTextContent('123,146');
    expect(screen.getByTestId('dated-by-issue')).toHaveTextContent(/dated by issue/i);
    expect(screen.getByTestId('hero-submitted-apps')).toHaveTextContent('6');
  });

  it('omits the marker when every submitted policy carries a real submit date', () => {
    const p = production();
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} production={{ ...p, submitted: { ...p.submitted, datedByIssue: false } }} />);
    expect(screen.queryByTestId('dated-by-issue')).not.toBeInTheDocument();
  });

  it('fires onSubmit from the in-hero (mobile) button', () => {
    const onSubmit = vi.fn();
    render(<HeroCard personalAnnualAPI={null} onSubmit={onSubmit} production={production()} />);
    fireEvent.click(screen.getByRole('button', { name: /submit weekly report/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('HeroCard — provenance (BUG-01 option B)', () => {
  const settledPolicy = (over) => ({
    productLine: 'life',
    status: 'settled',
    newBusinessType: 'nb_ordinary',
    proposedAPI: 10000,
    dateIssued: '2026-05-10',
    ...over,
  });

  it('3 oipa_import + 2 manual settled → "3 from head office · 2 self-confirmed"', () => {
    const policies = [
      settledPolicy({ id: 'a', statusSource: 'oipa_import' }),
      settledPolicy({ id: 'b', statusSource: 'oipa_import' }),
      settledPolicy({ id: 'c', statusSource: 'oipa_import' }),
      settledPolicy({ id: 'd', statusSource: 'agent' }),
      settledPolicy({ id: 'e', statusSource: 'manager' }),
    ];
    const prod = deriveYearProduction(policies, { year: 2026 });
    expect(prod.settled.count).toBe(5);
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} production={prod} />);
    expect(screen.getByTestId('hero-provenance')).toHaveTextContent('3 from head office · 2 self-confirmed');
  });

  it('hides the provenance line when nothing is settled', () => {
    const p = production({ settled: { api: 0, apps: 0, count: 0, fromHeadOffice: 0, selfConfirmed: 0 } });
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} production={p} />);
    expect(screen.queryByTestId('hero-provenance')).not.toBeInTheDocument();
  });
});

describe('HeroCard — R4 reconciliation note (unchanged behaviour)', () => {
  it('states both sides and flags a gap over TTD 1, with a link to the ledger form', () => {
    const onOpenLedgerCreate = vi.fn();
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} production={production()} onOpenLedgerCreate={onOpenLedgerCreate} />);
    expect(screen.getByTestId('ledger-reconciliation')).toHaveTextContent(
      `Weekly reports say you submitted ${formatCurrency(30000)} this year (${formatCurrency(4800)} this week). Your ledger shows ${formatCurrency(123146.28)}.`,
    );
    expect(screen.getByTestId('ledger-mismatch')).toHaveTextContent(formatCurrency(93146.28));
    fireEvent.click(screen.getByRole('button', { name: /add a policy to your ledger/i }));
    expect(onOpenLedgerCreate).toHaveBeenCalledTimes(1);
  });

  it('says the two match when they agree', () => {
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} production={production({ mismatch: { ytd: 0.5, week: 0 } })} />);
    expect(screen.getByTestId('ledger-match')).toHaveTextContent('Matches your weekly reports.');
  });
});

describe('HeroCard — pending (L0, two-layer ring)', () => {
  it('with pending: faint arc, "+x submitted" subline, and the legend with real values (FX item 2, matches C1)', () => {
    const p = production({ pending: { api: 36000, apps: 2, count: 2 } });
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} production={p} />);
    expect(screen.getByTestId('donut-arc-pending')).toBeInTheDocument();
    expect(screen.getByTestId('hero-pending-subline')).toHaveTextContent('+36K submitted');
    // Values, not the generic "counts / waiting to settle" copy — the SAME
    // figures already shown in the settled-API big number and the "Submitted
    // API" ledger figure above, never a new derivation.
    expect(screen.getByTestId('ring-legend')).toHaveTextContent('Settled 87,146');
    expect(screen.getByTestId('ring-legend')).toHaveTextContent('Submitted 123,146');
    expect(screen.getByTestId('hero-donut')).toHaveAttribute('aria-label', expect.stringContaining('waiting to settle'));
  });

  it('with no pending: no faint arc, no subline, no legend', () => {
    const p = production({ pending: { api: 0, apps: 0, count: 0 } });
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} production={p} />);
    expect(screen.queryByTestId('donut-arc-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hero-pending-subline')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ring-legend')).not.toBeInTheDocument();
  });

  it('a production fixture with no pending key at all (older shape) does not crash and shows no pending UI', () => {
    const p = production();
    delete p.pending;
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} production={p} />);
    expect(screen.queryByTestId('donut-arc-pending')).not.toBeInTheDocument();
  });
});

describe('HeroCard — loading / error / empty', () => {
  it('loading: a skeleton, no confident TTD 0, no donut value', () => {
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} pending />);
    expect(screen.getByTestId('hero-ledger-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-settled-api')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hero-donut')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hero-ledger-figures')).not.toBeInTheDocument();
  });

  it('error: an inline error with Retry', () => {
    const onRetry = vi.fn();
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} error onRetry={onRetry} />);
    expect(screen.getByTestId('hero-ledger-error')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-settled-api')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('empty ledger: a real zero from a loaded ledger renders as TTD 0 and 0%', () => {
    const p = production({ settled: { api: 0, apps: 0, count: 0, fromHeadOffice: 0, selfConfirmed: 0 } });
    render(<HeroCard personalAnnualAPI={null} onSubmit={() => {}} production={p} />);
    expect(screen.getByTestId('hero-settled-api')).toHaveTextContent('TTD0');
    expect(screen.getByTestId('hero-donut')).toHaveTextContent('0%');
  });
});

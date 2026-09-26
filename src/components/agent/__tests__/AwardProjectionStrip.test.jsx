import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AwardProjectionStrip from '../AwardProjectionStrip';
import { DEFAULT_RULESET_2026 as R } from '../../../config/awardsRuleset/2026';

function mkLines(lifeAPI) {
  return { life: { targetAPI: lifeAPI, enabled: true } };
}

// ── Null / zero guard ─────────────────────────────────────────────────────────

describe('AwardProjectionStrip — null guard', () => {
  it('renders nothing when lifeTargetAPI is 0', () => {
    const { container } = render(
      <AwardProjectionStrip lines={mkLines(0)} agentProfile={{}} ruleset={R} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when life line is missing', () => {
    const { container } = render(
      <AwardProjectionStrip lines={{}} agentProfile={{}} ruleset={R} />
    );
    expect(container.firstChild).toBeNull();
  });
});

// ── Strip renders ─────────────────────────────────────────────────────────────

describe('AwardProjectionStrip — renders', () => {
  it('renders the strip container when life API > 0', () => {
    render(<AwardProjectionStrip lines={mkLines(300000)} agentProfile={{}} ruleset={R} />);
    expect(screen.getByTestId('award-projection-strip')).toBeInTheDocument();
  });

  it('always shows persistency_silver and persistency_gold pills', () => {
    render(<AwardProjectionStrip lines={mkLines(300000)} agentProfile={{}} ruleset={R} />);
    expect(screen.getByTestId('award-pill-persistency_silver')).toBeInTheDocument();
    expect(screen.getByTestId('award-pill-persistency_gold')).toBeInTheDocument();
  });

  it('shows exactly one club pill', () => {
    render(<AwardProjectionStrip lines={mkLines(400000)} agentProfile={{}} ruleset={R} />);
    const pills = screen.getAllByTestId(/^award-pill-bronze_club|award-pill-silver_club|award-pill-gold_club/);
    expect(pills.length).toBe(1);
  });

  it('shows the Life API and estimated apps summary line', () => {
    render(<AwardProjectionStrip lines={mkLines(300000)} agentProfile={{}} ruleset={R} />);
    expect(screen.getByText(/Life:/)).toBeInTheDocument();
    expect(screen.getByText(/apps est\./)).toBeInTheDocument();
  });

  it('shows the persistency disclaimer footnote', () => {
    render(<AwardProjectionStrip lines={mkLines(300000)} agentProfile={{}} ruleset={R} />);
    expect(screen.getByText(/Assumes ≥90% persistency/)).toBeInTheDocument();
  });
});

// ── MDRT visibility ───────────────────────────────────────────────────────────

describe('AwardProjectionStrip — MDRT pill', () => {
  // MDRT in-contention floor is now 344,400 (mdrtAwardThresholds(), PR #MX),
  // not the ruleset's stale 250,000.
  it('absent when life API < 344.4k', () => {
    render(<AwardProjectionStrip lines={mkLines(200000)} agentProfile={{}} ruleset={R} />);
    expect(screen.queryByTestId('award-pill-mdrt')).not.toBeInTheDocument();
  });

  it('present when life API ≥ 344.4k', () => {
    render(<AwardProjectionStrip lines={mkLines(400000)} agentProfile={{}} ruleset={R} />);
    expect(screen.getByTestId('award-pill-mdrt')).toBeInTheDocument();
  });
});

// ── Experience-gated awards ───────────────────────────────────────────────────

describe('AwardProjectionStrip — Rookie pill', () => {
  it('absent when monthsInIndustry is not in agentProfile', () => {
    render(<AwardProjectionStrip lines={mkLines(400000)} agentProfile={{}} ruleset={R} />);
    expect(screen.queryByTestId('award-pill-rookie')).not.toBeInTheDocument();
  });

  it('absent when monthsInIndustry > 18', () => {
    render(
      <AwardProjectionStrip
        lines={mkLines(400000)}
        agentProfile={{ monthsInIndustry: 24 }}
        ruleset={R}
      />
    );
    expect(screen.queryByTestId('award-pill-rookie')).not.toBeInTheDocument();
  });

  it('present when monthsInIndustry ≤ 18', () => {
    render(
      <AwardProjectionStrip
        lines={mkLines(400000)}
        agentProfile={{ monthsInIndustry: 12 }}
        ruleset={R}
      />
    );
    expect(screen.getByTestId('award-pill-rookie')).toBeInTheDocument();
  });
});

describe('AwardProjectionStrip — Agent of the Year pill', () => {
  it('absent when life API < 500k', () => {
    render(<AwardProjectionStrip lines={mkLines(400000)} agentProfile={{}} ruleset={R} />);
    expect(screen.queryByTestId('award-pill-agent_of_year')).not.toBeInTheDocument();
  });

  it('absent when isBdoDso: true (even at 600k)', () => {
    render(
      <AwardProjectionStrip
        lines={mkLines(600000)}
        agentProfile={{ isBdoDso: true }}
        ruleset={R}
      />
    );
    expect(screen.queryByTestId('award-pill-agent_of_year')).not.toBeInTheDocument();
  });

  it('present when life API ≥ 500k and not BDO/DSO', () => {
    render(
      <AwardProjectionStrip
        lines={mkLines(600000)}
        agentProfile={{ isBdoDso: false }}
        ruleset={R}
      />
    );
    expect(screen.getByTestId('award-pill-agent_of_year')).toBeInTheDocument();
  });
});

// ── State aria-label ──────────────────────────────────────────────────────────

describe('AwardProjectionStrip — state aria-labels', () => {
  // MDRT reads the real MDRT line (688,800; in-contention 344,400) via
  // mdrtAwardThresholds() — PR #MX, not the ruleset's stale 500k/250k pair.
  it('MDRT pill shows in-contention aria-label at 400k', () => {
    render(<AwardProjectionStrip lines={mkLines(400000)} agentProfile={{}} ruleset={R} />);
    const pill = screen.getByTestId('award-pill-mdrt');
    // aria-label now carries the gap-to-next (2.5-copy): +TTD to reach on-track.
    expect(pill).toHaveAttribute('aria-label', 'MDRT: in-contention — TTD 288.8K to MDRT');
  });

  it('MDRT pill shows on-track aria-label at 688.8k', () => {
    render(<AwardProjectionStrip lines={mkLines(688800)} agentProfile={{}} ruleset={R} />);
    const pill = screen.getByTestId('award-pill-mdrt');
    expect(pill).toHaveAttribute('aria-label', 'MDRT: on-track');
  });
});

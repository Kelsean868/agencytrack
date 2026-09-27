// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import GapAnalysisPanel from '../GapAnalysisPanel';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseHierarchy = {
  personal:            { api: 100000, apps: 20 },
  unitTarget:          { api: 120000 },
  branchTarget:        { api: 150000 },
  salesManagerTarget:  { api: 200000 },
  companyFloor:        { api: 50000 },
};

// Commitment below the company floor — triggers warning / "below" GapNote
const belowFloorHierarchy = {
  personal:            { api: 30000 },
  unitTarget:          null,
  branchTarget:        null,
  salesManagerTarget:  null,
  companyFloor:        { api: 50000 },
};

// YTD meets the floor
const floorMetYtd = { api: 60000, apps: 12 };
const baseYtd     = { api: 25000, apps: 5  };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GapAnalysisPanel', () => {

  // ── State: loading ──────────────────────────────────────────────────────────
  it('renders loading skeleton when loading=true', () => {
    const { container } = render(
      <GapAnalysisPanel hierarchy={null} ytdTotals={null} loading={true} />
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-testid="gap-analysis-loading"]')).toBeInTheDocument();
  });

  // ── State: error ────────────────────────────────────────────────────────────
  it('renders honest error state with "Nothing\'s wrong with your plan" message', () => {
    render(
      <GapAnalysisPanel
        hierarchy={null}
        ytdTotals={null}
        loading={false}
        error="Failed to load goals"
      />
    );
    expect(screen.getByText(/Nothing.s wrong with your plan/i)).toBeInTheDocument();
    expect(screen.getByText('Failed to load goals')).toBeInTheDocument();
  });

  // ── State: empty (no hierarchy) ─────────────────────────────────────────────
  it('renders "No targets" when hierarchy is null', () => {
    render(
      <GapAnalysisPanel hierarchy={null} ytdTotals={baseYtd} loading={false} />
    );
    expect(screen.getByText(/No targets have been set/i)).toBeInTheDocument();
  });

  // ── State: empty (hierarchy present but no personal commitment) ─────────────
  it('renders "Build it in Game Plan" when hierarchy has no personal commitment', () => {
    const hierarchyNoPersonal = { ...baseHierarchy, personal: null };
    render(
      <GapAnalysisPanel hierarchy={hierarchyNoPersonal} ytdTotals={baseYtd} loading={false} />
    );
    expect(screen.getByText(/Build it in Game Plan/i)).toBeInTheDocument();
    expect(screen.getByText(/No commitment set yet/i)).toBeInTheDocument();
  });

  it('still renders Company Floor in no-commitment state', () => {
    const hierarchyNoPersonal = { ...baseHierarchy, personal: null };
    render(
      <GapAnalysisPanel hierarchy={hierarchyNoPersonal} ytdTotals={baseYtd} loading={false} />
    );
    expect(screen.getByTestId('floor-row')).toBeInTheDocument();
    expect(screen.getByText('Company Floor')).toBeInTheDocument();
  });

  // ── State: populated ────────────────────────────────────────────────────────
  it('renders CommitmentHero with personal API target when populated', () => {
    render(
      <GapAnalysisPanel hierarchy={baseHierarchy} ytdTotals={baseYtd} loading={false} />
    );
    const hero = screen.getByTestId('commitment-hero');
    expect(hero).toBeInTheDocument();
    // Scope text checks inside the hero to avoid collision with GapNote's "Your commitment is..."
    expect(within(hero).getByText('Your Commitment')).toBeInTheDocument();
    expect(within(hero).getByText(/Annual API target/i)).toBeInTheDocument();
  });

  it('renders OrgContextStrip with Unit / Branch / SM tiers', () => {
    render(
      <GapAnalysisPanel hierarchy={baseHierarchy} ytdTotals={baseYtd} loading={false} />
    );
    expect(screen.getByTestId('org-context-strip')).toBeInTheDocument();
    expect(screen.getByText(/Rolls up through/i)).toBeInTheDocument();
    expect(screen.getByText('Unit:')).toBeInTheDocument();
    expect(screen.getByText('Branch:')).toBeInTheDocument();
    expect(screen.getByText('SM:')).toBeInTheDocument();
  });

  it('hides OrgContextStrip when no org tiers are set', () => {
    const noOrgHierarchy = {
      personal:           { api: 100000 },
      unitTarget:         null,
      branchTarget:       null,
      salesManagerTarget: null,
      companyFloor:       { api: 50000 },
    };
    render(
      <GapAnalysisPanel hierarchy={noOrgHierarchy} ytdTotals={baseYtd} loading={false} />
    );
    expect(screen.queryByTestId('org-context-strip')).not.toBeInTheDocument();
  });

  it('renders Company Floor row in populated state', () => {
    render(
      <GapAnalysisPanel hierarchy={baseHierarchy} ytdTotals={baseYtd} loading={false} />
    );
    expect(screen.getByTestId('floor-row')).toBeInTheDocument();
    expect(screen.getByText('Company Floor')).toBeInTheDocument();
  });

  it('shows the company apps minimum beside the API minimum ("40 apps")', () => {
    const withApps = { ...baseHierarchy, companyFloor: { api: 500000, apps: 40 } };
    render(
      <GapAnalysisPanel
        hierarchy={withApps}
        ytdTotals={baseYtd}
        loading={false}
        contractStartDate="2020-01-01"
      />
    );
    expect(screen.getByText(/Company minimum \(5\+ yrs\)/)).toBeInTheDocument();
    expect(screen.getByTestId('floor-row-value')).toHaveTextContent(/^TTD 500,000 · 40 apps$/);
  });

  it('shows the apps minimum in the no-commitment state too', () => {
    const noPersonal = { ...baseHierarchy, personal: null, companyFloor: { api: 150000, apps: 40 } };
    render(<GapAnalysisPanel hierarchy={noPersonal} ytdTotals={baseYtd} loading={false} />);
    expect(screen.getByTestId('floor-row-value')).toHaveTextContent('40 apps');
  });

  it('omits the apps suffix when the hierarchy carries no apps minimum', () => {
    render(<GapAnalysisPanel hierarchy={baseHierarchy} ytdTotals={baseYtd} loading={false} />);
    expect(screen.getByTestId('floor-row-value')).not.toHaveTextContent(/apps/);
  });

  it('labels the floor row with the tenure band when contractStartDate is known', () => {
    render(
      <GapAnalysisPanel
        hierarchy={baseHierarchy}
        ytdTotals={baseYtd}
        loading={false}
        contractStartDate="2020-01-01"
      />
    );
    expect(screen.getByTestId('floor-row')).toBeInTheDocument();
    expect(screen.getByText(/Company minimum \(5\+ yrs\)/)).toBeInTheDocument();
    expect(screen.queryByText('Company Floor')).not.toBeInTheDocument();
  });

  // ── GapNote ─────────────────────────────────────────────────────────────────
  it('renders GapNote "above" when commitment exceeds company floor', () => {
    render(
      <GapAnalysisPanel hierarchy={baseHierarchy} ytdTotals={baseYtd} loading={false} />
    );
    const note = screen.getByTestId('gap-note');
    expect(note).toBeInTheDocument();
    expect(note.textContent).toMatch(/above/i);
    expect(note.textContent).not.toMatch(/below/i);
  });

  it('renders GapNote "below" when commitment is under the company floor', () => {
    render(
      <GapAnalysisPanel hierarchy={belowFloorHierarchy} ytdTotals={baseYtd} loading={false} />
    );
    const note = screen.getByTestId('gap-note');
    expect(note.textContent).toMatch(/below/i);
  });

  it('hides GapNote when no company floor is set', () => {
    const noFloor = { ...baseHierarchy, companyFloor: null };
    render(
      <GapAnalysisPanel hierarchy={noFloor} ytdTotals={baseYtd} loading={false} />
    );
    expect(screen.queryByTestId('gap-note')).not.toBeInTheDocument();
  });

  // ── Below-floor hero ────────────────────────────────────────────────────────
  it('renders CommitmentHero in warning tone when commitment is below floor', () => {
    render(
      <GapAnalysisPanel hierarchy={belowFloorHierarchy} ytdTotals={baseYtd} loading={false} />
    );
    const hero = screen.getByTestId('commitment-hero');
    // Warning tone applies bg-warning-tint class (below-floor path)
    expect(hero.className).toMatch(/warning/);
  });

  // ── Floor Met badge ─────────────────────────────────────────────────────────
  it('shows Met badge when YTD meets or exceeds company floor', () => {
    render(
      <GapAnalysisPanel hierarchy={baseHierarchy} ytdTotals={floorMetYtd} loading={false} />
    );
    expect(screen.getByText('Met')).toBeInTheDocument();
  });

  // ── Custom title ─────────────────────────────────────────────────────────────
  it('uses custom title prop', () => {
    render(
      <GapAnalysisPanel hierarchy={null} ytdTotals={null} loading={false} title="My Goals" />
    );
    expect(screen.getByText('My Goals')).toBeInTheDocument();
  });

  // ── Persistency metric row ────────────────────────────────────────────────────
  it('renders persistency metric row with formatted value when ytdPersistency is provided', () => {
    render(
      <GapAnalysisPanel
        hierarchy={baseHierarchy}
        ytdTotals={baseYtd}
        loading={false}
        ytdPersistency={0.923}
        persistencyFloor={90}
      />
    );
    const hero = screen.getByTestId('commitment-hero');
    expect(within(hero).getByText('92.3%')).toBeInTheDocument();
    expect(within(hero).getByText('Pst.')).toBeInTheDocument();
  });

  it('shows dash when ytdPersistency is null', () => {
    render(
      <GapAnalysisPanel
        hierarchy={baseHierarchy}
        ytdTotals={baseYtd}
        loading={false}
        ytdPersistency={null}
        persistencyFloor={90}
      />
    );
    const hero = screen.getByTestId('commitment-hero');
    expect(within(hero).getByText('—')).toBeInTheDocument();
  });

  it('flips hero to warning tone when persistency is below floor', () => {
    render(
      <GapAnalysisPanel
        hierarchy={baseHierarchy}
        ytdTotals={baseYtd}
        loading={false}
        ytdPersistency={0.82}
        persistencyFloor={90}
      />
    );
    const hero = screen.getByTestId('commitment-hero');
    expect(hero.className).toMatch(/warning/);
  });

  it('does not flip hero to warning when persistency meets the floor', () => {
    render(
      <GapAnalysisPanel
        hierarchy={baseHierarchy}
        ytdTotals={baseYtd}
        loading={false}
        ytdPersistency={0.92}
        persistencyFloor={90}
      />
    );
    const hero = screen.getByTestId('commitment-hero');
    expect(hero.className).not.toMatch(/warning/);
  });
});

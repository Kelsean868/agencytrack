// @vitest-environment jsdom
// PR-B2 — AgentPlanDrawer tabs, per-tab neutral states, plan-health render,
// and the dynamic focus-trap rework (enumerateFocusables).
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  getAgentYearPlan: vi.fn(),
  getAgentMonthlyPlan: vi.fn(),
  getAgentAnnualFloor: vi.fn(),
}));

vi.mock('../../../services/planReviewService', () => ({
  getAgentYearPlan: (...a) => hoisted.getAgentYearPlan(...a),
  getAgentMonthlyPlan: (...a) => hoisted.getAgentMonthlyPlan(...a),
  getAgentAnnualFloor: (...a) => hoisted.getAgentAnnualFloor(...a),
}));

import AgentPlanDrawer from '../AgentPlanDrawer';
import { enumerateFocusables } from '../../../utils/focusables';

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const ROW = {
  agentId: 'agent-a',
  agentName: 'Asha Persad',
  agentUnitId: 'um-1',
  shared: true,
  plan: {
    year: 2026,
    updatedAt: null,
    totalAnnualAfterTax: 200000,
    totalAnnualPreTax: 260000,
    computedPAYE: 60000,
    estimatedRenewalIncome: { life: 0, ah: 0, property: 0, motor: 0, total: 25000 },
    firstYearCommissionsRequired: 80000,
    firstYearCommissionsTargets: { life: 50000, ah: 10000, property: 12000, motor: 8000 },
  },
};

const YEAR_PLAN = {
  plan: {
    year: 2026,
    status: 'draft',
    updatedAt: null,
    lines: {
      life:    { targetAPI: 180000, pct: 60, derivedApps: 10, derivedCommission: 63000, enabled: true },
      ah:      { targetAPI: 60000,  pct: 20, derivedApps: 4,  derivedCommission: 15000, enabled: true },
      general: { targetAPI: 60000,  pct: 20, derivedApps: 0,  derivedCommission: 6000,  enabled: true },
    },
  },
};

const MONTHLY_PLAN = {
  plan: { year: 2026, status: 'draft', split: 'even', anchorAPI: 300000, targets: Array(12).fill(25000), updatedAt: null },
};

function renderDrawer(row = ROW) {
  return render(
    <AgentPlanDrawer row={row} tenantId="tenant-1" onClose={vi.fn()} onCoach={vi.fn()} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getAgentYearPlan.mockResolvedValue(YEAR_PLAN);
  hoisted.getAgentMonthlyPlan.mockResolvedValue(MONTHLY_PLAN);
  hoisted.getAgentAnnualFloor.mockResolvedValue(200000);
});

describe('AgentPlanDrawer — tab shell', () => {
  it('renders three tabs with Overview selected; GPM1 Overview content unchanged', async () => {
    renderDrawer();
    await flush();
    expect(screen.getByTestId('tpd-tab-overview').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('tpd-tab-year')).toBeInTheDocument();
    expect(screen.getByTestId('tpd-tab-monthly')).toBeInTheDocument();
    // GPM1 Overview testids intact
    expect(screen.getByTestId('team-plans-drawer-hero')).toBeInTheDocument();
    expect(screen.getByTestId('tpd-fyc-required')).toBeInTheDocument();
    expect(screen.getByTestId('team-plans-drawer-income')).toBeInTheDocument();
  });

  it('a stale fetch never overwrites the switched-to agent (loadSeq guard)', async () => {
    let resolveStale;
    hoisted.getAgentYearPlan.mockImplementationOnce(() => new Promise((r) => { resolveStale = r; }));
    const { rerender } = renderDrawer(); // agent-a fetch left pending
    rerender(
      <AgentPlanDrawer row={{ ...ROW, agentId: 'agent-b' }} tenantId="tenant-1" onClose={vi.fn()} onCoach={vi.fn()} />,
    );
    await flush(); // agent-b load resolves (default mocks → status Draft)
    await act(async () => { resolveStale({ plan: { ...YEAR_PLAN.plan, status: 'committed' } }); });
    fireEvent.click(screen.getByTestId('tpd-tab-year'));
    // Stale agent-a resolution (Committed) must NOT have overwritten agent-b (Draft).
    expect(screen.getByTestId('tpd-year-status').textContent).toBe('Draft');
  });

  it('fetches plans once on open (drawer-open contract, not per-tab)', async () => {
    renderDrawer();
    await flush();
    expect(hoisted.getAgentYearPlan).toHaveBeenCalledTimes(1);
    expect(hoisted.getAgentYearPlan).toHaveBeenCalledWith('tenant-1', 'agent-a', 2026);
    expect(hoisted.getAgentMonthlyPlan).toHaveBeenCalledTimes(1);
    expect(hoisted.getAgentAnnualFloor).toHaveBeenCalledTimes(1);
  });
});

describe('AgentPlanDrawer — Year Plan tab', () => {
  it('renders per-line targets + status badge + plan health', async () => {
    renderDrawer();
    await flush();
    fireEvent.click(screen.getByTestId('tpd-tab-year'));
    expect(screen.getByTestId('tpd-year-status').textContent).toBe('Draft');
    expect(screen.getByTestId('tpd-line-life-api').textContent).toContain('180,000');
    expect(screen.getByTestId('tpd-plan-health')).toBeInTheDocument();
    // all three checks green on this fixture (floor 200k vs plan 300k; 3 lines; comm 84k >= 80k)
    expect(screen.getByTestId('tpd-health-floor').getAttribute('data-ok')).toBe('true');
    expect(screen.getByTestId('tpd-health-mix').getAttribute('data-ok')).toBe('true');
    expect(screen.getByTestId('tpd-health-commit').getAttribute('data-ok')).toBe('true');
  });

  it('shows a RED floor check when the plan is below the tenure floor (Rule 23)', async () => {
    hoisted.getAgentAnnualFloor.mockResolvedValue(500000);
    renderDrawer();
    await flush();
    fireEvent.click(screen.getByTestId('tpd-tab-year'));
    expect(screen.getByTestId('tpd-health-floor').getAttribute('data-ok')).toBe('false');
  });

  it('omits the over-committed check entirely when the worksheet is not shared (conditional, silent)', async () => {
    renderDrawer({ ...ROW, shared: false });
    await flush();
    fireEvent.click(screen.getByTestId('tpd-tab-year'));
    expect(screen.getByTestId('tpd-plan-health')).toBeInTheDocument();
    expect(screen.queryByTestId('tpd-health-commit')).not.toBeInTheDocument();
  });

  it('permission-denied renders the NEUTRAL unavailable state, not an error', async () => {
    hoisted.getAgentYearPlan.mockResolvedValue({ unavailable: true });
    renderDrawer();
    await flush();
    fireEvent.click(screen.getByTestId('tpd-tab-year'));
    expect(screen.getByTestId('tpd-year-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('tpd-year-error')).not.toBeInTheDocument();
  });

  it('missing doc renders the neutral empty state', async () => {
    hoisted.getAgentYearPlan.mockResolvedValue({ empty: true });
    renderDrawer();
    await flush();
    fireEvent.click(screen.getByTestId('tpd-tab-year'));
    expect(screen.getByTestId('tpd-year-empty')).toBeInTheDocument();
  });
});

describe('AgentPlanDrawer — Monthly tab', () => {
  it('renders the 12-month grid + anchor + split badge', async () => {
    renderDrawer();
    await flush();
    fireEvent.click(screen.getByTestId('tpd-tab-monthly'));
    expect(screen.getByTestId('tpd-monthly-anchor').textContent).toContain('300,000');
    expect(screen.getByTestId('tpd-monthly-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tpd-month-0').textContent).toContain('25,000');
    expect(screen.getByTestId('tpd-month-11')).toBeInTheDocument();
  });

  it('denied renders neutral unavailable on the monthly tab', async () => {
    hoisted.getAgentMonthlyPlan.mockResolvedValue({ unavailable: true });
    renderDrawer();
    await flush();
    fireEvent.click(screen.getByTestId('tpd-tab-monthly'));
    expect(screen.getByTestId('tpd-monthly-unavailable')).toBeInTheDocument();
  });
});

describe('AgentPlanDrawer — dynamic focus trap', () => {
  it('enumerateFocusables excludes disabled and aria-hidden elements', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <button id="a">A</button>
      <button id="b" disabled>B</button>
      <button id="c" aria-hidden="true">C</button>
      <a id="d" href="#x">D</a>
      <span id="e" tabindex="-1">E</span>
      <span id="f" tabindex="0">F</span>
    `;
    const ids = enumerateFocusables(div).map((el) => el.id);
    expect(ids).toEqual(['a', 'd', 'f']);
  });

  it('regression: with exactly two focusables the cycle still works', () => {
    const div = document.createElement('div');
    div.innerHTML = '<button id="first">1</button><button id="last">2</button>';
    const els = enumerateFocusables(div);
    expect(els).toHaveLength(2);
    expect(els[0].id).toBe('first');
    expect(els[1].id).toBe('last');
  });

  it('Tab on the LAST drawer control wraps to the first (across N focusables)', async () => {
    renderDrawer();
    await flush();
    const coach = screen.getByTestId('team-plans-drawer-coach');
    const close = screen.getByLabelText('Close plan detail');
    act(() => coach.focus());
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
  });

  it('Shift+Tab on the FIRST control wraps to the last', async () => {
    renderDrawer();
    await flush();
    const close = screen.getByLabelText('Close plan detail');
    const coach = screen.getByTestId('team-plans-drawer-coach');
    act(() => close.focus());
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(coach);
  });

  it('tab buttons are inside the trap cycle (not just Close/Coach)', async () => {
    renderDrawer();
    await flush();
    const panel = screen.getByTestId('team-plans-drawer');
    const els = enumerateFocusables(panel);
    const ids = els.map((el) => el.getAttribute('data-testid') || el.getAttribute('aria-label'));
    expect(ids).toContain('tpd-tab-overview');
    expect(ids).toContain('tpd-tab-year');
    expect(ids).toContain('tpd-tab-monthly');
    expect(els.length).toBeGreaterThanOrEqual(5); // close + 3 tabs + coach
  });
});

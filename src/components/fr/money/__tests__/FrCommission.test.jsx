// @vitest-environment jsdom
//
// R2-7 — the FR Commission playground prints what the Nexus playground prints
// for the same actions (parity), keeps every save / scenario action, and is
// only rendered for look="fr".

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u1' },
    userProfile: { name: 'Test Agent', commissionRate: 35 },
  }),
}));
vi.mock('../../../../services/goalsService', () => ({
  setGoals: vi.fn().mockResolvedValue(undefined),
  // R2-3b: the tab loads saved assumptions on open; none saved here.
  getGoals: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../goals/CommissionPlayground/components/CashFlowChart', () => ({ default: () => null }));

const prefsMock = vi.hoisted(() => ({
  getUserPrefs: vi.fn(() => Promise.resolve(null)),
  setCommissionScenarios: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../../services/userPrefsService', () => ({
  getUserPrefs: (...a) => prefsMock.getUserPrefs(...a),
  setCommissionScenarios: (...a) => prefsMock.setCommissionScenarios(...a),
  COMMISSION_SCENARIO_CAP: 6,
}));

globalThis.ResizeObserver = class { observe() {}; unobserve() {}; disconnect() {} };

import { setGoals, getGoals } from '../../../../services/goalsService';
import CommissionPlayground from '../../../goals/CommissionPlayground';

const CHIPS = ['Annual', 'Semi', 'Quarter', 'Month', 'Week', 'Day'];
const HANDOFF_KEY = 'agencytrack-playground-income-goal';

function stubWidth(matches) {
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    matches, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
}

function renderPlayground(look, props = {}) {
  return render(
    <CommissionPlayground submissions={[]} agentId="a1" tenantId="t1" currentGoal={250000} look={look} {...props} />,
  );
}

/** R2-3b: wait until the saved assumptions have loaded (the inputs render). */
async function ready() {
  await waitFor(() => expect(screen.queryByTestId('commission-settings-loading')).toBeNull());
}

function chip(name) {
  return within(screen.getByRole('group', { name: 'View cadence' })).getByRole('button', { name });
}

function nexusLadder() {
  return screen.getAllByTestId('commission-ladder-stage').map((el) => el.querySelector('span:last-child').textContent);
}

function frColumn(col) {
  const table = screen.getByTestId('fr-commission-decomposition-table');
  return within(table).getAllByRole('row').slice(1).map((r) => {
    const cells = within(r).getAllByRole('cell');
    return col === 'year' ? cells[0].textContent : cells[1]?.textContent ?? null;
  });
}

// Same custom input set, addressed by each look's own labels.
const CUSTOM = [
  ['Tax Rate (%)', 'Tax rate (%)', 20],
  ['Renewal Income (TTD)', 'Renewal income, annual', 15000],
  ['Settlement Rate (%)', 'Settlement rate (%)', 80],
  ['Commission Rate (%)', 'Commission rate (%)', 40],
  ['Avg Policy API (TTD)', 'Average policy API', 9000],
  ['Persistency Rate (%)', 'Persistency rate (%)', 85],
  ['CIs per Sale', 'CIs per sale', 3],
  ['Calls per CI', 'Calls per CI', 4],
  ['Prospects per Call', 'Prospects per call', 1.5],
];
function applyCustom(look) {
  fireEvent.change(screen.getByTestId('income-goal-period'), { target: { value: 'monthly' } });
  fireEvent.change(screen.getByLabelText('Income Goal (TTD)'), { target: { value: '20000' } });
  for (const [nexus, fr, v] of CUSTOM) {
    fireEvent.change(screen.getByLabelText(look === 'fr' ? fr : nexus), { target: { value: String(v) } });
  }
}

beforeEach(() => {
  setGoals.mockClear();
  prefsMock.getUserPrefs.mockReset().mockImplementation(() => Promise.resolve(null));
  prefsMock.setCommissionScenarios.mockReset().mockImplementation(() => Promise.resolve());
  localStorage.removeItem(HANDOFF_KEY);
  stubWidth(true); // desktop
});
afterEach(() => {
  cleanup();
  localStorage.removeItem(HANDOFF_KEY);
});

describe('FR Commission playground — look switch', () => {
  it('no look → the Nexus card; look="fr" → the FR layout', async () => {
    renderPlayground(undefined);
    await ready();
    expect(screen.getByRole('tablist', { name: 'Commission Playground views' })).toBeInTheDocument();
    expect(screen.queryByTestId('fr-commission')).toBeNull();
    cleanup();
    renderPlayground('fr');
    await ready();
    expect(screen.getByTestId('fr-commission')).toHaveAttribute('data-layout', 'desktop');
    expect(screen.queryByRole('tablist', { name: 'Commission Playground views' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Goal decomposition' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('an unknown look throws instead of silently rendering Nexus', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderPlayground('neon')).toThrow(/unknown look "neon"/);
    spy.mockRestore();
  });
});

describe('FR Commission playground — Goal decomposition parity with Nexus', () => {
  it('default inputs: the Per-year column is the Annual ladder and each cadence column is that chip\'s ladder', async () => {
    renderPlayground('nexus');
    await ready();
    const nexus = {};
    for (const name of CHIPS) { fireEvent.click(chip(name)); nexus[name] = nexusLadder(); }
    cleanup();
    renderPlayground('fr');
    await ready();
    expect(frColumn('year')).toEqual(nexus.Annual);
    expect(frColumn('period').every((v) => v === null)).toBe(true);
    for (const name of CHIPS.slice(1)) {
      fireEvent.click(chip(name));
      expect(frColumn('year'), name).toEqual(nexus.Annual);
      expect(frColumn('period'), name).toEqual(nexus[name]);
    }
  });

  it('a custom input set (monthly income goal) prints the same figures', async () => {
    renderPlayground('nexus');
    await ready();
    applyCustom('nexus');
    fireEvent.click(chip('Annual'));
    const annual = nexusLadder();
    fireEvent.click(chip('Week'));
    const week = nexusLadder();
    cleanup();
    renderPlayground('fr');
    await ready();
    applyCustom('fr');
    fireEvent.click(chip('Week'));
    expect(frColumn('year')).toEqual(annual);
    expect(frColumn('period')).toEqual(week);
  });

  it('the Money Needs hand-off (pre-tax flag) prints the same figures', async () => {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify({ value: 180000, preTaxAlreadyApplied: true }));
    renderPlayground('nexus');
    await ready();
    const nexus = nexusLadder();
    cleanup();
    // R2-3b: the hand-off is applied once and removed — send it again.
    localStorage.setItem(HANDOFF_KEY, JSON.stringify({ value: 180000, preTaxAlreadyApplied: true }));
    renderPlayground('fr');
    await ready();
    expect(frColumn('year')).toEqual(nexus);
  });

  it('Save assumptions writes the same payload as Nexus', async () => {
    renderPlayground('nexus');
    await ready();
    applyCustom('nexus');
    fireEvent.click(screen.getByRole('button', { name: 'Save Assumptions' }));
    await waitFor(() => expect(setGoals).toHaveBeenCalledTimes(1));
    const nexusCall = setGoals.mock.calls[0];
    cleanup();
    setGoals.mockClear();
    renderPlayground('fr');
    await ready();
    applyCustom('fr');
    fireEvent.click(screen.getByTestId('commission-save-assumptions-btn'));
    await waitFor(() => expect(setGoals).toHaveBeenCalledTimes(1));
    expect(setGoals.mock.calls[0]).toEqual(nexusCall);
  });

  it('Save as my goals confirms, then writes the same payload as Nexus', async () => {
    renderPlayground('nexus');
    await ready();
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    const nexusConfirm = screen.getByTestId('commission-confirm-new').textContent;
    fireEvent.click(screen.getByTestId('commission-confirm-btn'));
    await waitFor(() => expect(setGoals).toHaveBeenCalledTimes(1));
    const nexusCall = setGoals.mock.calls[0];
    cleanup();
    setGoals.mockClear();
    renderPlayground('fr');
    await ready();
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    expect(setGoals).not.toHaveBeenCalled();
    expect(screen.getByTestId('commission-confirm-current').textContent).toBe('TTD 250,000');
    expect(screen.getByTestId('commission-confirm-new').textContent).toBe(nexusConfirm);
    fireEvent.click(screen.getByTestId('commission-confirm-btn'));
    await waitFor(() => expect(setGoals).toHaveBeenCalledTimes(1));
    expect(setGoals.mock.calls[0]).toEqual(nexusCall);
  });

  it('applying a saved scenario restores its inputs and cadence', async () => {
    prefsMock.getUserPrefs.mockImplementation(() => Promise.resolve({
      commissionScenarios: [{
        id: 'sc-1', label: 'Christmas push', savedAt: '2026-09-01T00:00:00.000Z', freqKey: 'weekly',
        inputs: { incomeGoal: 420000, taxRate: 30, renewalIncome: 5000, settlementRate: 85, commissionRate: 38, avgPolicyAPI: 10000 },
      }],
    }));
    renderPlayground('nexus');
    await ready();
    fireEvent.click(await screen.findByTestId('scenario-apply-sc-1'));
    const nexus = nexusLadder();
    cleanup();
    renderPlayground('fr');
    await ready();
    fireEvent.click(await screen.findByTestId('scenario-apply-sc-1'));
    expect(chip('Week')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Income Goal (TTD)').value).toBe('420000');
    expect(frColumn('period')).toEqual(nexus);
  });
});

describe("FR Commission playground — This month's target parity with Nexus", () => {
  function nexusModal() {
    const result = screen.getByText('API Required This Month').parentElement;
    const rows = within(result).getAllByRole('row').slice(1)
      .map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
    const insights = screen.queryByText('Insights')
      ? within(screen.getByText('Insights').closest('div').parentElement).getAllByRole('listitem').map((li) => li.textContent)
      : [];
    return { api: result.querySelector('p.text-3xl').textContent, rows, insights };
  }
  function frModal() {
    const rows = ['annual', 'semiAnnual', 'quarterly', 'monthly'].map((k) => {
      const row = screen.getByTestId(`fr-commission-mode-${k}`);
      return [within(row).getByRole('rowheader').textContent, ...within(row).getAllByRole('cell').map((c) => c.textContent)];
    });
    const box = screen.queryByTestId('fr-commission-insights');
    return {
      api: screen.getByTestId('fr-commission-required-api').textContent,
      rows,
      insights: box ? within(box).getAllByRole('listitem').map((li) => li.textContent) : [],
    };
  }
  function mixed(targetLabel) {
    fireEvent.change(screen.getByLabelText(targetLabel), { target: { value: '8000' } });
    fireEvent.change(screen.getByLabelText('Commission Rate (%)', { exact: false }), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Monthly mix percentage'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Quarterly mix percentage'), { target: { value: '20' } });
  }

  // Monthly 33 then Quarterly 50: the rebalance leaves Annual 33.5 % and
  // Monthly 16.5 %, so the Mix column only matches if both looks round alike.
  function uneven() {
    fireEvent.change(screen.getByLabelText('Monthly mix percentage'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Quarterly mix percentage'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Semi-Annual mix percentage'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Monthly mix percentage'), { target: { value: '33' } });
    fireEvent.change(screen.getByLabelText('Quarterly mix percentage'), { target: { value: '50' } });
  }

  it('defaults and a mixed split print the same API, rows and insights', async () => {
    renderPlayground('nexus');
    await ready();
    fireEvent.click(screen.getByRole('tab', { name: /modal targeting/i }));
    const nexusDefault = nexusModal();
    mixed('Target Commission (TTD)');
    const nexusMixed = nexusModal();
    uneven();
    const nexusUneven = nexusModal();
    cleanup();
    renderPlayground('fr');
    await ready();
    fireEvent.click(screen.getByRole('button', { name: "This month's target" }));
    expect(frModal()).toEqual(nexusDefault);
    mixed('I want this much commission this month');
    expect(frModal()).toEqual(nexusMixed);
    expect(nexusMixed.insights.length).toBeGreaterThan(0);
    uneven();
    expect(frModal()).toEqual(nexusUneven);
    // the uneven split must actually round (33.5 % → 34 %), or it tests nothing
    expect(nexusUneven.rows.map((r) => r[1])).toContain('34%');
  });

  it('the cash-flow table ends at the year total in the card title', async () => {
    renderPlayground('fr');
    await ready();
    fireEvent.click(screen.getByRole('button', { name: "This month's target" }));
    expect(screen.getByRole('heading', { name: /lands over the next 12 months/ }).textContent)
      .toBe('TTD 5,000 lands over the next 12 months');
    // All monthly: TTD 5,000 lands in month 1 and in each of the next 11.
    fireEvent.change(screen.getByLabelText('Monthly mix percentage'), { target: { value: '100' } });
    expect(screen.getByRole('heading', { name: /lands over the next 12 months/ }).textContent)
      .toBe('TTD 60,000 lands over the next 12 months');
  });
});

describe('FR Commission playground — phone', () => {
  it('pages the goal mode and keeps the saves outside the pager', async () => {
    stubWidth(false);
    renderPlayground('fr');
    await ready();
    const root = screen.getByTestId('fr-commission');
    expect(root).toHaveAttribute('data-layout', 'phone');
    expect(within(root).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Your numbers', 'Breakdown', 'Scenarios']);
    expect(within(root).getByRole('button', { name: 'Goal decomposition' })).toHaveAttribute('aria-pressed', 'true');
    const actions = screen.getByTestId('fr-commission-goal-actions');
    expect(actions.closest('[aria-hidden="true"]')).toBeNull();
  });
});

describe('FR Commission playground — a saved scenario with an unknown cadence', () => {
  it('shows it as Annual (as the Nexus ladder does) instead of crashing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    prefsMock.getUserPrefs.mockImplementation(() => Promise.resolve({
      commissionScenarios: [{ id: 'sc-x', label: 'Old', savedAt: '2026-01-01T00:00:00.000Z', freqKey: 'fortnight', inputs: {} }],
    }));
    renderPlayground('fr');
    await ready();
    fireEvent.click(await screen.findByTestId('scenario-apply-sc-x'));
    expect(screen.getByTestId('fr-commission-decomposition-table')).toBeInTheDocument();
    expect(frColumn('period').every((v) => v === null)).toBe(true);
    warn.mockRestore();
  });
});

describe('FR Commission playground — saved assumptions load back (R2-3b)', () => {
  it('shows the loading state first, then the saved values and a per-ratio history label', async () => {
    let resolve;
    getGoals.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const week = () => ({ status: 'submitted', ciConducted: 3, applicationsSold: 1, referralCalls: 4, followUpCalls: 3, coldCalls: 2 });
    renderPlayground('fr', { submissions: Array.from({ length: 10 }, week) });
    expect(screen.getByTestId('commission-settings-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('fr-commission-goal-inputs')).toBeNull();
    await waitFor(() => expect(typeof resolve).toBe('function'));
    resolve({ playgroundTaxRate: 20, playgroundCiToSaleRatio: 5 });
    await ready();
    expect(screen.getByLabelText('Tax rate (%)').value).toBe('20');
    expect(screen.getByLabelText('CIs per sale').value).toBe('5');
    const inputs = screen.getByTestId('fr-commission-goal-inputs');
    // The saved ratio has no history label; the unsaved one still does, with
    // the history value (9 calls per 3 CIs each week → 3).
    expect(within(inputs).getAllByText('From your history')).toHaveLength(1);
    const field = (label) => screen.getByLabelText(label).closest('div').parentElement;
    expect(within(field('CIs per sale')).queryByText('From your history')).toBeNull();
    expect(within(field('Calls per CI')).getByText('From your history')).toBeInTheDocument();
    expect(screen.getByLabelText('Calls per CI').value).toBe('3');
  });
});

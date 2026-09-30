// @vitest-environment jsdom
//
// R2-7 commit 1 — CHARACTERIZATION of the Commission playground BEFORE the FR
// port (brief docs/briefs/fr-round2-program.md § R2-7, ruling R-e).
//
// Pins what the Nexus playground computes and shows today for representative
// inputs: every view-cadence chip, a custom input set, the Money Needs hand-off,
// history-derived ratios, a saved scenario, both save payloads and the Modal
// Targeting tab. These tests must pass UNCHANGED after the port; an assertion
// edit is a brief §3 stop.

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
vi.mock('../components/CashFlowChart', () => ({ default: () => null }));

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

import { setGoals } from '../../../../services/goalsService';
import CommissionPlayground from '../index';

const HANDOFF_KEY = 'agencytrack-playground-income-goal';

function renderPlayground(props = {}) {
  return render(
    <CommissionPlayground submissions={[]} agentId="a1" tenantId="t1" currentGoal={250000} {...props} />,
  );
}

/** R2-3b: wait until the saved assumptions have loaded (the inputs render). */
async function ready() {
  await waitFor(() => expect(screen.queryByTestId('commission-settings-loading')).toBeNull());
}

/** Each ladder stage as "label = value". */
function ladder() {
  return screen.getAllByTestId('commission-ladder-stage').map((el) => {
    const label = el.querySelector('p').textContent;
    const value = el.querySelector('span:last-child').textContent;
    return `${label} = ${value}`;
  });
}

function setNum(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
}

function chip(name) {
  return within(screen.getByRole('group', { name: 'View cadence' })).getByRole('button', { name });
}

beforeEach(() => {
  setGoals.mockClear();
  prefsMock.getUserPrefs.mockReset().mockImplementation(() => Promise.resolve(null));
  prefsMock.setCommissionScenarios.mockReset().mockImplementation(() => Promise.resolve());
  localStorage.removeItem(HANDOFF_KEY);
});
afterEach(() => {
  cleanup();
  localStorage.removeItem(HANDOFF_KEY);
});

describe('Commission playground characterization — Goal Decomposition', () => {
  it('default inputs, every view-cadence chip', async () => {
    renderPlayground();
    await ready();
    const byChip = {};
    for (const name of ['Annual', 'Semi', 'Quarter', 'Month', 'Week', 'Day']) {
      fireEvent.click(chip(name));
      byChip[name] = ladder();
    }
    expect(byChip).toMatchInlineSnapshot(`
      {
        "Annual": [
          "Income goal = TTD 300,000",
          "1st-year commission = TTD 400,000",
          "API to write = TTD 1,269,840",
          "Apps = ~106",
          "Closing interviews = ~212",
          "Prospecting calls = ~529",
          "Prospects = ~1,058",
        ],
        "Day": [
          "Income goal = TTD 1,160",
          "1st-year commission = TTD 1,550",
          "API to write = TTD 4,920",
          "Apps = ~0",
          "Closing interviews = ~1",
          "Prospecting calls = ~2",
          "Prospects = ~4",
        ],
        "Month": [
          "Income goal = TTD 30,000",
          "1st-year commission = TTD 40,000",
          "API to write = TTD 126,980",
          "Apps = ~11",
          "Closing interviews = ~21",
          "Prospecting calls = ~53",
          "Prospects = ~106",
        ],
        "Quarter": [
          "Income goal = TTD 75,000",
          "1st-year commission = TTD 100,000",
          "API to write = TTD 317,460",
          "Apps = ~26",
          "Closing interviews = ~53",
          "Prospecting calls = ~132",
          "Prospects = ~265",
        ],
        "Semi": [
          "Income goal = TTD 150,000",
          "1st-year commission = TTD 200,000",
          "API to write = TTD 634,920",
          "Apps = ~53",
          "Closing interviews = ~106",
          "Prospecting calls = ~265",
          "Prospects = ~529",
        ],
        "Week": [
          "Income goal = TTD 6,980",
          "1st-year commission = TTD 9,300",
          "API to write = TTD 29,530",
          "Apps = ~2",
          "Closing interviews = ~5",
          "Prospecting calls = ~12",
          "Prospects = ~25",
        ],
      }
    `);
  });

  it('a custom input set (monthly income goal), Annual and Month chips', async () => {
    renderPlayground();
    await ready();
    fireEvent.change(screen.getByTestId('income-goal-period'), { target: { value: 'monthly' } });
    setNum('Income Goal (TTD)', 20000);
    setNum('Tax Rate (%)', 20);
    setNum('Renewal Income (TTD)', 15000);
    setNum('Settlement Rate (%)', 80);
    setNum('Commission Rate (%)', 40);
    setNum('Avg Policy API (TTD)', 9000);
    setNum('Persistency Rate (%)', 85);
    setNum('CIs per Sale', 3);
    setNum('Calls per CI', 4);
    setNum('Prospects per Call', 1.5);
    expect(screen.getByTestId('income-goal-conversion').textContent).toMatchInlineSnapshot(`"TTD 20,000 a month × 10 selling months = TTD 200,000 a year"`);
    fireEvent.click(chip('Annual'));
    const annual = ladder();
    fireEvent.click(chip('Month'));
    expect({ annual, month: ladder() }).toMatchInlineSnapshot(`
      {
        "annual": [
          "Income goal = TTD 200,000",
          "1st-year commission = TTD 235,000",
          "API to write = TTD 691,180",
          "Apps = ~77",
          "Closing interviews = ~230",
          "Prospecting calls = ~922",
          "Prospects = ~1,382",
        ],
        "month": [
          "Income goal = TTD 20,000",
          "1st-year commission = TTD 23,500",
          "API to write = TTD 69,120",
          "Apps = ~8",
          "Closing interviews = ~23",
          "Prospecting calls = ~92",
          "Prospects = ~138",
        ],
      }
    `);
  });

  it('Money Needs hand-off with the pre-tax flag', async () => {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify({ value: 180000, preTaxAlreadyApplied: true }));
    renderPlayground();
    await ready();
    expect(ladder()).toMatchInlineSnapshot(`
      [
        "Income goal = TTD 180,000",
        "1st-year commission = TTD 180,000",
        "API to write = TTD 571,430",
        "Apps = ~48",
        "Closing interviews = ~95",
        "Prospecting calls = ~238",
        "Prospects = ~476",
      ]
    `);
  });

  it('history-derived ratios (8+ submitted weeks)', async () => {
    const week = (i) => ({
      status: 'submitted', ciConducted: 3 + (i % 2), applicationsSold: 1,
      referralCalls: 4, followUpCalls: 3, coldCalls: 2, seminarTradeshowCalls: i % 3,
    });
    renderPlayground({ submissions: Array.from({ length: 10 }, (_, i) => week(i)) });
    await ready();
    expect({
      ci: screen.getByLabelText('CIs per Sale').value,
      calls: screen.getByLabelText('Calls per CI').value,
      banner: screen.getByText(/auto-populated from your last/).textContent,
      ladder: ladder(),
    }).toMatchInlineSnapshot(`
      {
        "banner": "CI-to-sale and prospecting call-to-CI ratios auto-populated from your last 10 weeks of data.",
        "calls": "2.83",
        "ci": "3.5",
        "ladder": [
          "Income goal = TTD 300,000",
          "1st-year commission = TTD 400,000",
          "API to write = TTD 1,269,840",
          "Apps = ~106",
          "Closing interviews = ~370",
          "Prospecting calls = ~1,048",
          "Prospects = ~2,096",
        ],
      }
    `);
  });

  it('applying a saved scenario restores its inputs and cadence', async () => {
    prefsMock.getUserPrefs.mockImplementation(() => Promise.resolve({
      commissionScenarios: [{
        id: 'sc-1', label: 'Christmas push', savedAt: '2026-09-01T00:00:00.000Z', freqKey: 'weekly',
        inputs: { incomeGoal: 420000, taxRate: 30, renewalIncome: 5000, settlementRate: 85, commissionRate: 38, avgPolicyAPI: 10000 },
      }],
    }));
    renderPlayground();
    await ready();
    fireEvent.click(await screen.findByTestId('scenario-apply-sc-1'));
    expect({
      amount: screen.getByLabelText('Income Goal (TTD)').value,
      period: screen.getByTestId('income-goal-period').value,
      weekPressed: chip('Week').getAttribute('aria-pressed'),
      ladder: ladder(),
    }).toMatchInlineSnapshot(`
      {
        "amount": "420000",
        "ladder": [
          "Income goal = TTD 9,770",
          "1st-year commission = TTD 13,840",
          "API to write = TTD 40,460",
          "Apps = ~4",
          "Closing interviews = ~8",
          "Prospecting calls = ~20",
          "Prospects = ~40",
        ],
        "period": "annual",
        "weekPressed": "true",
      }
    `);
  });

  it('Save Assumptions writes exactly these keys and values', async () => {
    renderPlayground();
    await ready();
    fireEvent.change(screen.getByTestId('income-goal-period'), { target: { value: 'weekly' } });
    setNum('Income Goal (TTD)', 7000);
    setNum('Settlement Rate (%)', 75);
    fireEvent.click(screen.getByRole('button', { name: 'Save Assumptions' }));
    await waitFor(() => expect(setGoals).toHaveBeenCalledTimes(1));
    expect(setGoals.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "t1",
        "a1",
        {
          "playgroundAvgPolicyAPI": 12000,
          "playgroundCiToSaleRatio": 2,
          "playgroundCommissionRate": 35,
          "playgroundDialsToCIRatio": 2.5,
          "playgroundIncomeGoal": 301000,
          "playgroundIncomeGoalPeriod": "weekly",
          "playgroundPersistencyRate": 90,
          "playgroundPreTaxAlreadyApplied": false,
          "playgroundProspectRatio": 2,
          "playgroundRenewalIncome": 0,
          "playgroundSettlementRate": 75,
          "playgroundTaxRate": 25,
        },
        "u1",
        "Test Agent",
      ]
    `);
  });

  it('Save as My Goals writes the computed API and applications after confirm', async () => {
    renderPlayground();
    await ready();
    fireEvent.click(screen.getByTestId('commission-save-goal-btn'));
    expect({
      current: screen.getByTestId('commission-confirm-current').textContent,
      next: screen.getByTestId('commission-confirm-new').textContent,
    }).toMatchInlineSnapshot(`
      {
        "current": "TTD 250,000",
        "next": "TTD 1,269,841",
      }
    `);
    fireEvent.click(screen.getByTestId('commission-confirm-btn'));
    await waitFor(() => expect(setGoals).toHaveBeenCalledTimes(1));
    expect(setGoals.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "t1",
        "a1",
        {
          "personalAnnualAPI": 1269841.2698412698,
          "personalAnnualApps": 105.82010582010582,
        },
        "u1",
        "Test Agent",
      ]
    `);
  });
});

describe('Commission playground characterization — Modal Targeting', () => {
  async function openModal() {
    renderPlayground();
    await ready();
    fireEvent.click(screen.getByRole('tab', { name: /modal targeting/i }));
  }
  function readModal() {
    const result = screen.getByText('API Required This Month').parentElement;
    const rows = within(result).getAllByRole('row').map((r) =>
      within(r).queryAllByRole('cell').map((c) => c.textContent).join(' | '),
    ).filter(Boolean);
    const insights = screen.queryByText('Insights')
      ? within(screen.getByText('Insights').closest('div').parentElement).getAllByRole('listitem').map((li) => li.textContent)
      : [];
    return { api: result.querySelector('p.text-3xl').textContent, rows, insights };
  }

  it('defaults (all annual, the profile commission rate)', async () => {
    await openModal();
    expect(readModal()).toMatchInlineSnapshot(`
      {
        "api": "TTD 14,300",
        "insights": [],
        "rows": [
          "Annual | 100% | TTD 14,290 | TTD 5,000",
          "Semi-Annual | 0% | TTD 0 | TTD 0",
          "Quarterly | 0% | TTD 0 | TTD 0",
          "Monthly | 0% | TTD 0 | TTD 0",
        ],
      }
    `);
  });

  it('target, rate and a mixed mode split', async () => {
    await openModal();
    fireEvent.change(screen.getByLabelText('Target Commission (TTD)'), { target: { value: '8000' } });
    fireEvent.change(screen.getByLabelText('Commission Rate (%)'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Monthly mix percentage'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Quarterly mix percentage'), { target: { value: '20' } });
    expect({
      sliders: ['Annual', 'Semi-Annual', 'Quarterly', 'Monthly'].map((m) => screen.getByLabelText(`${m} mix percentage`).value),
      ...readModal(),
    }).toMatchInlineSnapshot(`
      {
        "api": "TTD 41,400",
        "insights": [
          "Shift 10% Monthly → Annual to reduce required API by TTD 6,600.",
          "High monthly mix (40%) increases required API significantly. Offering annual or semi-annual where possible will lower the target.",
        ],
        "rows": [
          "Annual | 40% | TTD 16,550 | TTD 6,621",
          "Semi-Annual | 0% | TTD 0 | TTD 0",
          "Quarterly | 20% | TTD 8,280 | TTD 828",
          "Monthly | 40% | TTD 16,550 | TTD 552",
        ],
        "sliders": [
          "40",
          "0",
          "20",
          "40",
        ],
      }
    `);
  });
});

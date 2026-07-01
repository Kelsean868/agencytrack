// Track K · K9 — FinancingSelfView field-projection contract tests.
//
// Locks the SHOWN/PRIVATE boundary at the component layer: SHOWN values render,
// PRIVATE fields (adjustmentPct, suggestedFinancing, notes, audit metadata) are
// ABSENT from the DOM, managerFinancing is relabeled, and the not-financed empty
// state renders. Falsifier (Rule 23): if any PRIVATE value appears in the DOM,
// or a SHOWN value is missing/mis-valued, these fail.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import FinancingSelfView from '../FinancingSelfView';
import * as financingService from '../../../services/financingService';
import { getProjectedBonus } from '../../../lib/financingProjectedBonus';

// Keep the real labels / badge / deriveBasisSource; stub only the async reads.
vi.mock('../../../services/financingService', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    getFinancingTerms: vi.fn(),
    listFinancingMonths: vi.fn(),
    getFinancingReconciliation: vi.fn(),
  };
});
vi.mock('../../../lib/financingProjectedBonus', () => ({ getProjectedBonus: vi.fn() }));

const TENANT = 'tenant-1';
const UID = 'agent-1';

const TERMS = {
  id: UID,
  agentId: UID,
  tenantId: TENANT,
  financingStatus: 'on_financing',
  effectiveDate: '2026-01-05',
  agreedMonthlyFinancing: 5000,
  currentMonthlyFinancing: 4500,
  validatingAPI: 30000,
  // PRIVATE audit + suppressed history detail:
  createdBy: 'mgr-1',
  statusHistory: [
    {
      from: 'not_on_financing',
      to: 'on_financing',
      at: { toDate: () => new Date('2026-01-05T12:00:00Z') },
      byName: 'Jane Manager',
      role: 'branch_manager',
      note: 'secret manager note',
    },
  ],
};

const LEDGER = [
  {
    id: `${UID}_2026_02`,
    month: '2026_02',
    financingPaid: 4500,
    netCommission: 1200,
    bonusOffset: 600,
    validatingAPI: 30000,
    actualAPI: 25000,
    runningBalance: 9000,
    managerFinancing: 4200, // SHOWN, relabeled "Your draw"
    basisSource: 'settled-confirmed',
    // PRIVATE:
    adjustmentPct: 0.0667,
    suggestedFinancing: 3333,
    notes: 'internal statement note',
    source: 'manager_entry',
    enteredByName: 'Jane Manager',
  },
  {
    id: `${UID}_2026_03`,
    month: '2026_03',
    financingPaid: 0,
    netCommission: 800,
    bonusOffset: 0,
    runningBalance: -500, // surplus
    basisSource: 'settled-confirmed',
  },
];

const PROJECTED = {
  result: { gates: { grossGateMet: true, persistencyGateMet: false, qualified: false } },
  takeHome: { gross: 10000, tax: 2500, net: 7500, financingPortion: 3750, takeHome: 3750, isOwing: true },
  financingStatus: 'on_financing',
  yearInAgreement: 1,
  quarter: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  financingService.getFinancingReconciliation.mockResolvedValue(null);
});

describe('FinancingSelfView — empty states', () => {
  it('renders "not on financing" when no terms doc exists', async () => {
    financingService.getFinancingTerms.mockResolvedValue(null);
    render(<FinancingSelfView tenantId={TENANT} subjectUid={UID} />);
    expect(await screen.findByText(/not on financing/i)).toBeInTheDocument();
  });

  it('renders empty state when status is not_on_financing', async () => {
    financingService.getFinancingTerms.mockResolvedValue({ ...TERMS, financingStatus: 'not_on_financing' });
    render(<FinancingSelfView tenantId={TENANT} subjectUid={UID} />);
    expect(await screen.findByText(/not on financing/i)).toBeInTheDocument();
    // financed-only reads must NOT fire for a non-financed subject
    expect(financingService.listFinancingMonths).not.toHaveBeenCalled();
  });
});

describe('FinancingSelfView — SHOWN values', () => {
  beforeEach(() => {
    financingService.getFinancingTerms.mockResolvedValue(TERMS);
    financingService.listFinancingMonths.mockResolvedValue(LEDGER);
    getProjectedBonus.mockResolvedValue(PROJECTED);
  });

  it('renders terms, ledger balance, take-home and relabeled draw with exact values', async () => {
    render(<FinancingSelfView tenantId={TENANT} subjectUid={UID} />);
    expect((await screen.findByTestId('fsv-current-monthly')).textContent).toMatch(/4,500/);
    expect(screen.getByTestId('fsv-running-balance-2026_02').textContent).toMatch(/9,000/);
    expect(screen.getByTestId('fsv-running-balance-2026_03').textContent).toMatch(/surplus/i);
    expect(screen.getByTestId('fsv-takehome').textContent).toMatch(/3,750/);
    expect(screen.getByTestId('fsv-your-draw-2026_02').textContent).toMatch(/4,200/);
    // relabel: header "Your draw" present; manager-decision framing absent
    expect(screen.getByText(/your draw/i)).toBeInTheDocument();
    expect(screen.queryByText(/manager financing/i)).not.toBeInTheDocument();
  });
});

describe('FinancingSelfView — PRIVATE absence (falsifier)', () => {
  beforeEach(() => {
    financingService.getFinancingTerms.mockResolvedValue(TERMS);
    financingService.listFinancingMonths.mockResolvedValue(LEDGER);
    getProjectedBonus.mockResolvedValue(PROJECTED);
  });

  it('never renders adjustmentPct, suggestedFinancing, notes, or audit attribution', async () => {
    render(<FinancingSelfView tenantId={TENANT} subjectUid={UID} />);
    await screen.findByTestId('fsv-current-monthly');
    // suggestedFinancing 3333 (distinct from take-home 3,750)
    expect(screen.queryByText(/3,333/)).not.toBeInTheDocument();
    // adjustmentPct — the clause-5.3 trigger ratio, in any rendered form
    expect(screen.queryByText(/6\.67|0\.0667|6\.7%/)).not.toBeInTheDocument();
    // manager statement notes
    expect(screen.queryByText(/internal statement note/i)).not.toBeInTheDocument();
    // audit attribution (statusHistory byName + ledger enteredByName)
    expect(screen.queryByText(/Jane Manager/)).not.toBeInTheDocument();
    // suppressed status-history note
    expect(screen.queryByText(/secret manager note/i)).not.toBeInTheDocument();
  });
});

// Track K · K9 — FinancingSelfView field-projection contract tests.
//
// Locks the SHOWN/PRIVATE boundary at the component layer: SHOWN values render,
// PRIVATE fields (adjustmentPct, suggestedFinancing, notes, audit metadata) are
// ABSENT from the DOM, managerFinancing is relabeled, and the not-financed empty
// state renders. Falsifier (Rule 23): if any PRIVATE value appears in the DOM,
// or a SHOWN value is missing/mis-valued, these fail.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FinancingSelfView from '../FinancingSelfView';
import * as financingService from '../../../services/financingService';
import { getProjectedBonus } from '../../../lib/financingProjectedBonus';
import { getTodayTT } from '../../../utils/dateInputs';

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
    const { container } = render(<FinancingSelfView tenantId={TENANT} subjectUid={UID} />);
    await screen.findByTestId('fsv-current-monthly');
    const html = container.innerHTML;
    // suggestedFinancing 3333 (distinct from take-home 3,750)
    expect(screen.queryByText(/3,333/)).not.toBeInTheDocument();
    expect(html).not.toMatch(/3333|3,333/);
    // adjustmentPct — the clause-5.3 trigger ratio, in any rendered form
    expect(screen.queryByText(/6\.67|0\.0667|6\.7%/)).not.toBeInTheDocument();
    expect(html).not.toMatch(/0\.0667|6\.67/);
    // manager statement notes
    expect(screen.queryByText(/internal statement note/i)).not.toBeInTheDocument();
    expect(html).not.toMatch(/internal statement note/i);
    // audit attribution (statusHistory byName + ledger enteredByName)
    expect(screen.queryByText(/Jane Manager/)).not.toBeInTheDocument();
    expect(html).not.toMatch(/Jane Manager/);
    // suppressed status-history note — also guard non-text surfaces (attrs)
    expect(screen.queryByText(/secret manager note/i)).not.toBeInTheDocument();
    expect(html).not.toMatch(/secret manager note/i);
  });
});

describe('FinancingSelfView — reconciliation SHOWN path', () => {
  const RECON = {
    id: `${UID}_2026`,
    agentId: UID,
    tenantId: TENANT,
    year: 2026,
    totalFinancingDrawn: 9000,
    totalOffsets: 1800,
    closingBalance: 7200,
    waiverApplied: 1800,
    serviceMet: false,
    serviceMonths: 6,
    reconciledPosition: 7200,
    outcome: 'owing',
    surplusPaid: 0,
    garnishStarted: true,
    triggeredBy: 'auto_month12',
    // PRIVATE audit that must NOT render
    reconciledByName: 'Jane Manager',
  };

  beforeEach(() => {
    // post_financing_repayment ∈ RECONCILED_STATUSES → the view fetches recon.
    financingService.getFinancingTerms.mockResolvedValue({ ...TERMS, financingStatus: 'post_financing_repayment' });
    financingService.listFinancingMonths.mockResolvedValue(LEDGER);
    financingService.getFinancingReconciliation.mockResolvedValue(RECON);
    getProjectedBonus.mockResolvedValue({ ...PROJECTED, financingStatus: 'post_financing_repayment' });
  });

  it('renders reconciliation SHOWN figures and suppresses recon audit', async () => {
    const { container } = render(<FinancingSelfView tenantId={TENANT} subjectUid={UID} />);
    expect((await screen.findByTestId('fsv-recon-closing')).textContent).toMatch(/7,200/);
    expect(screen.getByTestId('fsv-recon-drawn').textContent).toMatch(/9,000/);
    expect(screen.getByTestId('fsv-recon-waiver').textContent).toMatch(/1,800/);
    // outcome 'owing' → its rendered label, not just presence
    expect(screen.getByTestId('fsv-recon-outcome').textContent).toMatch(/owing/i);
    // recon audit attribution + trigger metadata must not leak
    expect(container.innerHTML).not.toMatch(/Jane Manager/);
    expect(container.innerHTML).not.toMatch(/auto_month12/);
  });
});

// ── FIX 3 (FU financing-display-polish): single derived recon year ────────────
// The view no longer probes candidate years (which emitted benign permission-
// denied console noise on every financed-subject load). It reads ONE year —
// derived the same way FinancingReconciliationPanel derives it (the year of the
// LATEST entered ledger month, else the current TT year — the same year
// reconcileFinancing wrote the record under), tolerates ONLY the absent-doc
// permission-denied as "no recon", and rethrows anything else.
describe('FinancingSelfView — single derived reconciliation year', () => {
  beforeEach(() => {
    financingService.getFinancingTerms.mockResolvedValue({ ...TERMS, financingStatus: 'post_financing_repayment' });
    financingService.listFinancingMonths.mockResolvedValue(LEDGER);
    getProjectedBonus.mockResolvedValue({ ...PROJECTED, financingStatus: 'post_financing_repayment' });
  });

  it('reads exactly ONE reconciliation year, derived from the latest ledger month', async () => {
    financingService.getFinancingReconciliation.mockResolvedValue(null);
    render(<FinancingSelfView tenantId={TENANT} subjectUid={UID} />);
    await screen.findByTestId('fsv-current-monthly');
    expect(financingService.getFinancingReconciliation).toHaveBeenCalledTimes(1);
    // LEDGER's latest entered month is 2026_03 → year '2026'
    expect(financingService.getFinancingReconciliation).toHaveBeenCalledWith(TENANT, UID, '2026');
  });

  it('falls back to the current TT year when no ledger months exist', async () => {
    financingService.listFinancingMonths.mockResolvedValue([]);
    financingService.getFinancingReconciliation.mockResolvedValue(null);
    render(<FinancingSelfView tenantId={TENANT} subjectUid={UID} />);
    await screen.findByTestId('fsv-current-monthly');
    expect(financingService.getFinancingReconciliation).toHaveBeenCalledTimes(1);
    expect(financingService.getFinancingReconciliation).toHaveBeenCalledWith(TENANT, UID, getTodayTT().slice(0, 4));
  });

  it('tolerates the ABSENT-doc permission-denied as "no recon" (load-bearing — rules return permission-denied, not not-found, for a subject reading an absent year)', async () => {
    const denied = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    financingService.getFinancingReconciliation.mockRejectedValue(denied);
    render(<FinancingSelfView tenantId={TENANT} subjectUid={UID} />);
    // View is READY (not error): SHOWN values render, recon card simply absent.
    expect((await screen.findByTestId('fsv-current-monthly')).textContent).toMatch(/4,500/);
    expect(screen.queryByTestId('fsv-recon')).not.toBeInTheDocument();
    expect(screen.queryByText(/couldn't load your financing/i)).not.toBeInTheDocument();
  });

  it('REJECTS a non-permission failure — a genuine read error surfaces the error state instead of being swallowed as "no recon" (Rule 23 falsifier)', async () => {
    const genuine = Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' });
    financingService.getFinancingReconciliation.mockRejectedValue(genuine);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<FinancingSelfView tenantId={TENANT} subjectUid={UID} />);
      expect(await screen.findByText(/couldn't load your financing/i)).toBeInTheDocument();
      expect(screen.queryByTestId('fsv-current-monthly')).not.toBeInTheDocument();
      // the genuine error reached the outer catch (logged), not silently nulled —
      // value-level: the exact error object, not just "some console.error fired"
      expect(errSpy).toHaveBeenCalledWith('[FinancingSelfView] load failed', genuine);
    } finally {
      errSpy.mockRestore();
    }
  });

  it('§1 states contract — the error card has a wired Retry that re-invokes the same load path', async () => {
    financingService.getFinancingTerms.mockRejectedValueOnce(new Error('boom-terms'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<FinancingSelfView tenantId={TENANT} subjectUid={UID} />);
      const card = await screen.findByTestId('financing-self-view');
      expect(card).toHaveAttribute('role', 'alert');
      expect(financingService.getFinancingTerms).toHaveBeenCalledTimes(1);

      financingService.getFinancingTerms.mockResolvedValueOnce({ ...TERMS, financingStatus: 'not_on_financing' });
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => expect(screen.getByText(/not on financing/i)).toBeInTheDocument());
      expect(financingService.getFinancingTerms).toHaveBeenCalledTimes(2);
    } finally {
      errSpy.mockRestore();
    }
  });
});

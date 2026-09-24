// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../services/persistencyService', () => ({
  savePersistency: vi.fn(async () => ({})),
}));

import { savePersistency } from '../../../services/persistencyService';
import { buildPersistencyOutlook } from '../../../lib/persistency/persistencyOutlook';
import { deriveAll } from '../../../lib/persistency/calculations';
import PersistencyOutlookHero from '../PersistencyOutlookHero';
import ConfirmPersistencySheet from '../ConfirmPersistencySheet';
import CampaignHeroCard from '../../campaigns/CampaignHeroCard';

const EXPORT = '2026-09-15';
const imported = (policyNumber, dateIssued, status, api) => ({
  policyNumber, dateIssued, status, proposedAPI: api,
  isWritingAgent: true, importSource: 'oipa', exportDate: EXPORT, productLine: 'life',
});
// Same synthetic Kyron-shaped book as persistencyOutlook.test.js.
const BOOK = [
  imported('P-A1', '2024-09-10', 'settled', 82800.00),
  imported('P-A2', '2024-09-12', 'lapsed', 2682.00),
  imported('P-B1', '2024-11-10', 'settled', 21197.16),
  imported('P-B2', '2024-11-12', 'lapsed', 1182.36),
  imported('P-C1', '2025-06-10', 'settled', 161581.20),
  imported('P-C2', '2025-06-12', 'lapsed', 27014.52),
];
const GATE = { monthKey: '2026-12', threshold: 90 };
const outlookOf = (records = []) => buildPersistencyOutlook({
  policies: BOOK, records, today: '2026-09-23', gate: GATE,
  productionTarget: { name: 'Champion', api: 275000, current: 73946.28 },
});

const CAMPAIGN = {
  id: 'xmas26',
  name: 'Christmas Campaign and Retreat 2026',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  structure: 'qualify',
  persistencyGate: { mode: 'binary', basis: 'finalMonth', threshold: 90 },
  tiers: [{ level: 1, name: 'Champion', api: 275_000, apps: 35 }],
};

beforeEach(() => { savePersistency.mockClear(); });

describe('PersistencyOutlookHero', () => {
  it('shows Derived Aug 89.6% with Confirm, Estimated today 86.6%, Dec 85.7% and the gap sentence', () => {
    render(<PersistencyOutlookHero outlook={outlookOf()} canConfirm onConfirm={() => {}} />);
    expect(screen.getByTestId('persistency-outlook-derived').textContent).toContain('Derived · Aug 2026');
    expect(screen.getByTestId('persistency-outlook-derived-pct').textContent).toBe('89.6%');
    expect(screen.getByTestId('persistency-outlook-derived-pct').className).toContain('text-warning-ink');
    expect(screen.getByTestId('persistency-outlook-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-outlook-estimate-pct').textContent).toBe('86.6%');
    expect(screen.getByTestId('persistency-outlook-gate-pct').textContent).toBe('85.7%');
    const gap = screen.getByTestId('persistency-outlook-gap').textContent;
    expect(gap).toContain('TTD 81,549.48');
    expect(gap).toContain('31 Dec');
    expect(gap).toContain('TTD 8,154.95');
    expect(gap).toContain('Reaching Champion (TTD 275,000 settled) closes this gap by itself.');
    // Warning only — nothing here is a confirmed gate month.
    expect(document.body.innerHTML).not.toContain('text-danger-ink');
  });

  it('the info popover lists the 4 assumed-0 inputs, the rule and the export date', () => {
    render(<PersistencyOutlookHero outlook={outlookOf()} />);
    expect(screen.queryByTestId('persistency-outlook-assumptions')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('persistency-outlook-info'));
    expect(screen.getByTestId('assumptions-assumed-zero').textContent)
      .toContain('Decreases, Increases, Lumpsums (100%), Reinstatements');
    expect(screen.getByTestId('assumptions-rule').textContent).toContain('ignored');
    expect(screen.getByTestId('assumptions-export').textContent).toContain('15 Sep 2026 · 8 days ago');
  });

  it('renders the stale banner, the empty state and the error state', () => {
    const stale = buildPersistencyOutlook({ policies: BOOK, today: '2026-11-15' });
    const { rerender } = render(<PersistencyOutlookHero outlook={stale} />);
    expect(screen.getByTestId('persistency-outlook-stale').textContent).toContain('Estimate is getting stale');
    rerender(<PersistencyOutlookHero outlook={buildPersistencyOutlook({ policies: [], today: '2026-09-23' })} />);
    expect(screen.getByTestId('persistency-outlook-empty')).toBeInTheDocument();
    rerender(<PersistencyOutlookHero outlook={null} error="Boom" onRetry={() => {}} />);
    expect(screen.getByTestId('persistency-outlook-error').textContent).toContain('Boom');
  });
});

describe('ConfirmPersistencySheet — choice 1 writes ho_confirmed, then the gate prefers it', () => {
  it('blocks the save until every manual input is answered; zero is an answer', async () => {
    const derived = outlookOf().derived;
    render(
      <ConfirmPersistencySheet
        tenantId="t1" agentUid="u1" writerUid="u1" writerRole="agent"
        derived={derived} onClose={() => {}} onSaved={() => {}}
      />,
    );
    const button = screen.getByTestId('confirm-matches-button');
    expect(button).toBeDisabled();
    // August is on the legacy model: three manual inputs, no Decreases.
    expect(screen.queryByTestId('confirm-input-decreases')).not.toBeInTheDocument();
    for (const id of ['incPPPs', 'lumpsums100', 'reinstatements']) {
      fireEvent.change(screen.getByTestId(`confirm-input-${id}`), { target: { value: '0' } });
    }
    expect(screen.getByTestId('confirm-will-save').textContent).toContain('89.6%');
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    await waitFor(() => expect(savePersistency).toHaveBeenCalledTimes(1));

    const [tenantId, monthKey, agentUid, inputs, role, provenance] = savePersistency.mock.calls[0];
    expect([tenantId, monthKey, agentUid, role]).toEqual(['t1', '2026-08', 'u1', 'agent']);
    expect(inputs).toEqual({
      businessPlaced: 296457.24, notTakens: 0, lapses: 30878.88,
      incPPPs: 0, lumpsums100: 0, reinstatements: 0,
    });
    expect(provenance).toMatchObject({
      source: 'ho_confirmed',
      confirmedBy: 'u1',
      ledgerExportDate: '2026-09-15',
      ledgerWindowMonths: 24,
      annuityMissedPremiumRule: 'ignore',
      manualConfirmedBy: 'u1',
    });
    expect(typeof provenance.confirmedAt).toBe('string');

    // The record the service would store: the gate row now reads it as
    // confirmed, ahead of the derived month.
    const saved = {
      monthKey, ...inputs, ...deriveAll(inputs), ...provenance,
    };
    const after = outlookOf([saved]);
    expect(after.headline).toMatchObject({ kind: 'confirmed', monthKey: '2026-08', source: 'ho_confirmed' });

    render(<CampaignHeroCard campaign={CAMPAIGN} policies={BOOK} persistencyRecords={[saved]} />);
    const row = screen.getByTestId('campaign-hero-row-persistency');
    expect(row.textContent).toContain('89.6%');
    expect(row.textContent).toContain('confirmed');
  });
});

describe('CampaignHeroCard — outlook preview (R5)', () => {
  it('previews the derived August month at 89.6% in warning — never rounded up to a passing 90%', () => {
    render(<CampaignHeroCard campaign={CAMPAIGN} policies={BOOK} persistencyRecords={[]} />);
    const row = screen.getByTestId('campaign-hero-row-persistency');
    expect(row.textContent).toContain('89.6%');
    expect(row.textContent).toContain('derived');
    expect(row.textContent).toContain('Aug 2026');
    expect(screen.getByTestId('campaign-hero-persistency-bar-fill').className).toContain('bg-warning');
    expect(screen.getByTestId('campaign-hero-persistency-preview-note').className).toContain('text-warning-ink');
  });
});

/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import ScenePage from '../ScenePage';
import React, { useMemo, useState } from 'react';
import PersistencyTrendChart from '../../../persistency/PersistencyTrendChart';
import PersistencyOutlookHero from '../../../persistency/PersistencyOutlookHero';
import { buildPersistencyOutlook } from '../../../../lib/persistency/persistencyOutlook';
import { roundPersistencyPct } from '../../../../lib/persistency/persistencyRounding';

/**
 * R2-2 harness scenes: the agent Persistency tab's monthly trend as bars
 * (FR look: GateBars) and the always-visible annuity rule switch under the
 * headline figure. SAMPLE data only; names are placeholders.
 *
 * The trend sample deliberately includes 89.996 (prints "90.00%", at the gate)
 * and 89.994 (prints "89.99%", below it) so the 2-dp rule is visible on screen.
 */
const MONTH_KEYS = [
  '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
  '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
];
const FRACTIONS_A = [0.912, 0.908, 0.904, 0.89996, 0.891, 0.887, 0.89994, 0.879, 0.875, 0.871, 0.868, 0.866];
// Variant B: the last month climbs back over the gate (a big move, so the bar
// glides visibly across the gate line).
const FRACTIONS_B = [...FRACTIONS_A.slice(0, -1), 0.934];

const toRows = (fractions) => MONTH_KEYS.map((monthKey, i) => ({
  monthKey,
  pct: roundPersistencyPct(fractions[i] * 100),
}));

function Frame({ children, phone = false }) {
  return (
    <ScenePage as="div" className={phone ? 'mx-auto w-[390px] px-4 py-4' : 'mx-auto max-w-[900px] px-8 py-8'}>
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">FR harness · SAMPLE data</p>
      {children}
    </ScenePage>
  );
}

function TrendScene({ variant }) {
  const rows = useMemo(() => toRows(variant === 'B' ? FRACTIONS_B : FRACTIONS_A), [variant]);
  return (
    <Frame>
      <div className="card mt-3 flex flex-col gap-2" data-testid="persistency-trend-chart">
        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">Monthly trend</p>
        <PersistencyTrendChart data={rows} fr />
      </div>
    </Frame>
  );
}

const EXPORT = '2026-09-15';
const doc = (policyNumber, dateIssued, status, api, extra = {}) => ({
  policyNumber, dateIssued, status, proposedAPI: api,
  isWritingAgent: true, importSource: 'oipa', exportDate: EXPORT, productLine: 'life', ...extra,
});
const BOOK = [
  doc('P-A1', '2024-09-10', 'settled', 82800),
  doc('P-A2', '2024-09-12', 'lapsed', 2682),
  doc('P-B1', '2024-11-10', 'settled', 21197.16),
  doc('P-B2', '2024-11-12', 'lapsed', 1182.36),
  doc('P-C1', '2025-06-10', 'settled', 161581.2),
  doc('P-C2', '2025-06-12', 'lapsed', 27014.52),
  // A settled annuity that stopped paying: the rule switch moves the figure.
  doc('P-AN1', '2025-07-01', 'settled', 30000, { policyClass: 'annuity', paidToDate: '2026-05-01' }),
];

function HeroScene() {
  const [rule, setRule] = useState('ignore');
  const outlook = useMemo(() => buildPersistencyOutlook({
    policies: BOOK,
    records: [],
    today: '2026-09-23',
    annuityMissedPremiumRule: rule,
    gate: { monthKey: '2026-12', threshold: 90 },
  }), [rule]);
  return (
    <Frame>
      <div className="mt-3">
        <PersistencyOutlookHero outlook={outlook} annuityRule={rule} onAnnuityRuleChange={setRule} />
      </div>
    </Frame>
  );
}

export const PERSISTENCY_TAB_SCENES = [
  { id: 'r2-persistency-trend', title: 'Persistency tab · monthly trend bars', slice: 'R2-2', viewport: 'desktop,phone', hasVariants: true, render: TrendScene },
  { id: 'r2-persistency-hero', title: 'Persistency tab · hero with annuity switch', slice: 'R2-2', viewport: 'desktop,phone', render: HeroScene },
];

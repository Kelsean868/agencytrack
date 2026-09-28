/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import React, { useMemo } from 'react';
import FrMoneyView from '../../money/FrMoneyView';
import FrMoneyHeaderView from '../../money/FrMoneyHeaderView';
import useMinWidth from '../../../../hooks/useMinWidth';
import { settledByMonthFrom } from '../../../../lib/fr/todayModel';
import {
  paceModel, reinstatementPlan, moneyCards, persistencySeries, headerTiles,
} from '../../../../lib/fr/moneyModel';

/**
 * FR-3 harness scenes: the Money Overview and the Persistency header
 * (month bars + reinstatement planner), fed a SAMPLE ledger run through the
 * REAL model (reinstatementPlan → buildPersistencyOutlook → deriveFromLedger).
 *
 * The sample reproduces the canvas's persistency figures (DESKTOP3-MONEY.md):
 * Net Gross Settled TTD 210,975.24, lapses TTD 28,196.88 across the seven
 * canvas lapses → 86.6 %, gap TTD 7,099.36. Variant B settles one more policy
 * (TTD 60,000, Sep 2026: large enough that the persistency bar moves ~10px,
 * outside the glide probe's rounding band), so persistency, the pace line,
 * the figures and the bars move.
 * Names are placeholders, never real clients.
 */

const TODAY = '2026-09-20';
const pol = (n, status, api, dateIssued, ownerName) => ({
  // nb_ordinary: ordinary new business, full production credit (Rule 7 table);
  // without a type the ledger credits a policy TTD 0 ("Unclassified").
  id: n, policyNumber: n, status, proposedAPI: api, dateIssued, productLine: 'life', newBusinessType: 'nb_ordinary', ownerName,
});

// Settled policies in the 24-month window: 182,778.36 in all.
const SETTLED = [
  pol('P-1001', 'settled', 40000, '2025-03-14'),
  pol('P-1002', 'settled', 55632.08, '2025-08-02'),
  pol('P-1003', 'settled', 6000, '2026-02-11'),
  pol('P-1004', 'settled', 7200, '2026-04-22'),
  pol('P-1005', 'settled', 21600, '2026-07-09'),
  pol('P-1006', 'settled', 22346.28, '2026-08-18'),
  pol('P-1007', 'settled', 30000, '2026-09-04'),
];
// The seven canvas lapses still inside the window (28,196.88).
const LAPSES = [
  pol('P-0901', 'lapsed', 1182.36, '2024-10-28', '[Client A]'),
  pol('P-0902', 'lapsed', 2400.0, '2025-05-28', '[Client B]'),
  pol('P-0903', 'lapsed', 11996.64, '2025-08-14', '[Client C]'),
  pol('P-0904', 'lapsed', 4821.12, '2025-11-19', '[Client D]'),
  pol('P-0905', 'lapsed', 3617.64, '2025-11-11', '[Client E]'),
  pol('P-0906', 'lapsed', 2400.0, '2025-11-19', '[Client F]'),
  pol('P-0907', 'lapsed', 1779.12, '2025-11-20', '[Client G]'),
];
const RECORDS = [
  { monthKey: '2026-04', persistency: 0.912 },
  { monthKey: '2026-05', persistency: 0.903 },
  { monthKey: '2026-06', persistency: 0.894 },
  { monthKey: '2026-07', persistency: 0.881 },
  { monthKey: '2026-08', persistency: 0.872 },
];

function ledger(variant) {
  return variant === 'B'
    ? [...SETTLED, pol('P-1008', 'settled', 60000, '2026-09-12'), ...LAPSES]
    : [...SETTLED, ...LAPSES];
}

function build(variant) {
  const policies = ledger(variant);
  const settledByMonth = settledByMonthFrom(policies, 2026);
  const settled = Math.round(settledByMonth.reduce((s, m) => s + m.api, 0) * 100) / 100;
  const plan = reinstatementPlan({ policies, records: RECORDS, todayTT: TODAY });
  const pace = paceModel({ settledByMonth, year: 2026, currentMonth: 9, goal: 688800, isMdrt: true });
  const hierarchy = { companyFloor: { api: 500000, apps: 40 }, personal: null };
  return {
    plan,
    pace,
    settled,
    hierarchy,
    cards: moneyCards({
      hierarchy, settled, committedAnnualAPI: null, commissionEarned: 9420,
      moneyNeedAfterTax: null, plan, financingLabel: 'Not on financing',
    }),
  };
}

function Frame({ children }) {
  return (
    <main className="mx-auto max-w-[1180px] px-4 py-6 md:px-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">SAMPLE · harness</p>
      {children}
    </main>
  );
}

function MoneyScene({ variant }) {
  const d = useMemo(() => build(variant), [variant]);
  const wide = useMinWidth(768); // same switch as the FrMoney container
  const noop = () => {};
  const model = { pace: d.pace, plan: d.plan, cards: d.cards, settled: d.settled, goal: 688800, isMdrt: true, year: 2026, avgApi: 12000 };
  const campaign = (
    <div className="flex min-h-[180px] items-center justify-center rounded-[18px] border border-dashed border-border bg-card p-4 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">[existing campaign card (compact)]</p>
    </div>
  );
  return (
    <Frame>
      <FrMoneyView model={model} wide={wide} onRetry={noop} onNavigate={noop} slots={{ campaign }} />
    </Frame>
  );
}

function PersistencyHeaderScene({ variant }) {
  const d = useMemo(() => build(variant), [variant]);
  const series = persistencySeries({ records: RECORDS, estimate: d.plan?.estimate ?? null });
  return (
    <Frame>
      <FrMoneyHeaderView tab="persistency" tiles={headerTiles('persistency', { plan: d.plan })} series={series} plan={d.plan} />
    </Frame>
  );
}

function GoalsHeaderScene({ variant }) {
  const d = useMemo(() => build(variant), [variant]);
  const tiles = headerTiles('goals', { year: 2026, settled: d.settled, provenance: '3 from head office · 2 self-confirmed', hierarchy: d.hierarchy });
  return (
    <Frame>
      <FrMoneyHeaderView tab="goals" tiles={tiles} pace={d.pace} />
    </Frame>
  );
}

export const MONEY_SCENES = [
  { id: 'money', title: 'Money · Overview', slice: 'FR-3', viewport: 'desktop,tablet,phone', hasVariants: true, render: MoneyScene },
  { id: 'money-persistency', title: 'Money · Persistency header + planner', slice: 'FR-3', viewport: 'desktop,phone', hasVariants: true, render: PersistencyHeaderScene },
  { id: 'money-goals', title: 'Money · Goals header', slice: 'FR-3', viewport: 'desktop,phone', hasVariants: true, render: GoalsHeaderScene },
];

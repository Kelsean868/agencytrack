/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import React, { useMemo, useState } from 'react';
import FrMoneyHeaderView from '../../money/FrMoneyHeaderView';
import { reinstatementPlan, persistencySeries, headerTiles } from '../../../../lib/fr/moneyModel';

/**
 * FR-6 harness scene: the FR-3 Persistency header + planner with "Mark
 * reinstated" / "Withdraw" live on the rows, fed a SAMPLE ledger through the
 * REAL model (reinstatementPlan → buildPersistencyOutlook → deriveFromLedger).
 *
 * Two lapses start declared: [Client C] on 15 Sep 2026 (waiting for head
 * office) and [Client A] on 1 Jul 2026 (over 60 days, "Not confirmed by head
 * office"). The actions write to local state only — no Firebase. Names are
 * placeholders, never real clients.
 */

const TODAY = '2026-09-20';
const at = (ymd) => ({ toDate: () => new Date(`${ymd}T16:00:00Z`) });
const pol = (n, status, api, dateIssued, ownerName) => ({
  id: `doc-${n}`, agentId: 'agent-sample', policyNumber: n, status, proposedAPI: api, dateIssued,
  productLine: 'life', newBusinessType: 'nb_ordinary', ownerName,
});

// Same sample book as the FR-3 money scenes (86.6 % evidenced, gap TTD 7,099.36).
const BOOK = [
  pol('P-1001', 'settled', 40000, '2025-03-14'),
  pol('P-1002', 'settled', 55632.08, '2025-08-02'),
  pol('P-1003', 'settled', 6000, '2026-02-11'),
  pol('P-1004', 'settled', 7200, '2026-04-22'),
  pol('P-1005', 'settled', 21600, '2026-07-09'),
  pol('P-1006', 'settled', 22346.28, '2026-08-18'),
  pol('P-1007', 'settled', 30000, '2026-09-04'),
  pol('P-0901', 'lapsed', 1182.36, '2024-10-28', '[Client A]'),
  pol('P-0902', 'lapsed', 2400.0, '2025-05-28', '[Client B]'),
  pol('P-0903', 'lapsed', 11996.64, '2025-08-14', '[Client C]'),
  pol('P-0904', 'lapsed', 4821.12, '2025-11-19', '[Client D]'),
  pol('P-0905', 'lapsed', 3617.64, '2025-11-11', '[Client E]'),
  pol('P-0906', 'lapsed', 2400.0, '2025-11-19', '[Client F]'),
  pol('P-0907', 'lapsed', 1779.12, '2025-11-20', '[Client G]'),
];
const RECORDS = [
  { monthKey: '2026-06', persistency: 0.894 },
  { monthKey: '2026-07', persistency: 0.881 },
  { monthKey: '2026-08', persistency: 0.872 },
];
const START = {
  'doc-P-0903': { on: '2026-09-15', note: 'Receipt 4471' },
  'doc-P-0901': { on: '2026-07-01', note: null },
};

function Frame({ children }) {
  return (
    <main className="mx-auto max-w-[1180px] px-4 py-6 md:px-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">SAMPLE · harness</p>
      {children}
    </main>
  );
}

function DeclaredPlannerScene() {
  const [decl, setDecl] = useState(START);
  const policies = useMemo(() => BOOK.map((p) => (decl[p.id]
    ? { ...p, reinstatementDeclaredAt: at(decl[p.id].on), reinstatementDeclaredBy: p.agentId, ...(decl[p.id].note ? { reinstatementNote: decl[p.id].note } : {}) }
    : p)), [decl]);
  const plan = useMemo(() => reinstatementPlan({ policies, records: RECORDS, todayTT: TODAY }), [policies]);
  const series = persistencySeries({ records: RECORDS, estimate: plan?.estimate ?? null });
  const actions = {
    canAct: () => true,
    declare: (id, note) => setDecl((d) => ({ ...d, [id]: { on: TODAY, note: note || null } })),
    withdraw: (id) => setDecl((d) => { const next = { ...d }; delete next[id]; return next; }),
    busyId: null,
    errorFor: () => null,
  };
  return (
    <Frame>
      <FrMoneyHeaderView
        tab="persistency"
        tiles={headerTiles('persistency', { plan })}
        series={series}
        plan={plan}
        reinstateActions={actions}
      />
    </Frame>
  );
}

export const REINSTATEMENT_SCENES = [
  { id: 'money-persistency-declared', title: 'Money · Persistency planner with declared reinstatements', slice: 'FR-6', viewport: 'desktop,tablet,phone', render: DeclaredPlannerScene },
];

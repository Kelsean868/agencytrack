// Track K — FinancingTab container.
//
// Mounts the financing manager surface as sub-views under one tab (mirroring
// how settlements / persistency coexist in one area): the K1 Terms setup
// (FinancingTermsSetup), the K2 Monthly Ledger (MonthlyStatementEntry), the K5
// Proration override (FinancingProrationPanel), and the K4 Take-Home waterfall
// (TakeHomeWaterfallView). A segmented control switches between them. Each
// sub-view owns its own agent dropdown for now; a future LOW FU lifts the
// selection into this container.
import React, { useState } from 'react';
import FinancingTermsSetup from './FinancingTermsSetup';
import MonthlyStatementEntry from './MonthlyStatementEntry';
import FinancingProrationPanel from './FinancingProrationPanel';
import TakeHomeWaterfallView from './TakeHomeWaterfallView';
import FinancingReconciliationPanel from './FinancingReconciliationPanel';

const SUBVIEWS = [
  { id: 'terms',          label: 'Terms' },
  { id: 'ledger',         label: 'Monthly Ledger' },
  { id: 'proration',      label: 'Proration' },
  { id: 'takehome',       label: 'Take-Home' },
  { id: 'reconciliation', label: 'Reconciliation' },
];

export default function FinancingTab() {
  const [view, setView] = useState('terms');

  return (
    <div className="flex flex-col gap-5">
      <div
        className="inline-flex self-start rounded-lg border border-border bg-card-raised p-1 gap-1"
        role="tablist"
        aria-label="Financing views"
      >
        {SUBVIEWS.map((s) => {
          const active = view === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`financing-subview-${s.id}`}
              onClick={() => setView(s.id)}
              className={[
                'min-h-[44px] px-4 rounded-md text-sm font-semibold transition-colors',
                active ? 'bg-primary dark:bg-primary-dark text-white' : 'text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {view === 'terms'          && <FinancingTermsSetup />}
      {view === 'ledger'         && <MonthlyStatementEntry />}
      {view === 'proration'      && <FinancingProrationPanel />}
      {view === 'takehome'       && <TakeHomeWaterfallView />}
      {view === 'reconciliation' && <FinancingReconciliationPanel />}
    </div>
  );
}

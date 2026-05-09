import { useState, useMemo } from 'react';
import { formatCurrency } from '../../../../utils/formatters';
import ModeMixSlider from '../components/ModeMixSlider';
import CommissionBreakdownTable from '../components/CommissionBreakdownTable';
import CashFlowChart from '../components/CashFlowChart';
import InsightCard from '../components/InsightCard';
import { reverseCalc, modeBreakdown, cashFlowForecast } from '../utils/commissionMath';
import { DEFAULT_MODE_MIX } from '../utils/modeMixBalancer';

export default function ModalTargetingTab({ defaultCommissionRate = 35 }) {
  const [targetCommission, setTargetCommission] = useState(5000);
  const [commissionRate, setCommissionRate]     = useState(defaultCommissionRate);
  const [modeMix, setModeMix]                   = useState(DEFAULT_MODE_MIX);

  const totalApi = useMemo(
    () => reverseCalc({ targetCommission, modeMix, commissionRate }),
    [targetCommission, modeMix, commissionRate],
  );

  const breakdown = useMemo(
    () => modeBreakdown({ totalApi, modeMix, commissionRate }),
    [totalApi, modeMix, commissionRate],
  );

  const forecast = useMemo(
    () => cashFlowForecast({ totalApi, modeMix, commissionRate }),
    [totalApi, modeMix, commissionRate],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Panel 1 — Inputs */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Target</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-ink-muted" htmlFor="modal-target-commission">
              Target Commission (TTD)
            </label>
            <div className="flex items-center h-9 rounded-lg border border-border bg-[var(--color-surface)] overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
              <span className="text-xs text-ink-muted pl-2 pr-1 shrink-0">TTD</span>
              <input
                id="modal-target-commission"
                type="number"
                min={1}
                step={100}
                value={targetCommission}
                onChange={(e) => setTargetCommission(parseFloat(e.target.value) || 0)}
                className="flex-1 h-full px-2 text-sm text-ink focus:outline-none bg-transparent"
              />
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-ink-muted" htmlFor="modal-commission-rate">
              Commission Rate (%)
            </label>
            <div className="flex items-center h-9 rounded-lg border border-border bg-[var(--color-surface)] overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
              <input
                id="modal-commission-rate"
                type="number"
                min={1}
                max={100}
                step={1}
                value={commissionRate}
                onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                className="flex-1 h-full px-2 text-sm text-ink focus:outline-none bg-transparent"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Mode Mix</p>
          <ModeMixSlider modeMix={modeMix} onChange={setModeMix} />
        </div>
      </div>

      {/* Panel 2 — Result */}
      <div className="flex flex-col gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">API Required This Month</p>
        <p className="text-3xl font-bold text-ink tabular-nums">
          {totalApi > 0 ? formatCurrency(Math.round(totalApi / 100) * 100) : '—'}
        </p>
        <CommissionBreakdownTable breakdown={breakdown} />
      </div>

      {/* Panel 3 — 12-month cash flow + insights */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">12-Month Cash Flow</p>
        <CashFlowChart forecast={forecast} />
        <InsightCard
          totalApi={totalApi}
          modeMix={modeMix}
          commissionRate={commissionRate}
          targetCommission={targetCommission}
        />
      </div>
    </div>
  );
}

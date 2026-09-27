// Track K · K4 — take-home waterfall surface.
//
// Shows the projected gross→tax→net→financing→take-home breakdown for one agent's
// current agreement quarter. Projected state is the K4 deliverable; Actual is a
// placeholder pending K5/K6 settled data.
//
// Design authority: design_handoff_track_k/Track K Take-Home Waterfall - Component.html
// Colour rule: bg-primary always paired with dark:bg-primary-dark (D6).
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCallerScope } from '../../hooks/useCallerScope';
import { getTenantUsers } from '../../services/managerService';
import { getProjectedBonus } from '../../lib/financingProjectedBonus';
import { formatCurrency } from '../../utils/formatters';
import FinancingStatusBadge from './FinancingStatusBadge';

// ── Waterfall chart ──────────────────────────────────────────────────────────

const CHART_H = 180; // px — gross bar full height

function WaterfallBar({ heightPx, marginBottomPx = 0, variant, label, amountLabel }) {
  const variantClass = {
    gross:       'bg-ink',
    deductTax:   'border border-dashed border-danger/40 bg-danger/8',
    net:         'bg-ink-muted',
    deductFin:   'border border-dashed border-warning/50 bg-warning/10',
    takeOwing:   'bg-primary dark:bg-primary-dark shadow-md',
    takeClear:   'bg-success',
  }[variant] ?? 'bg-ink-muted';

  const amountClass = {
    gross:       'text-ink',
    deductTax:   'text-danger text-xs',
    net:         'text-ink-muted',
    deductFin:   'text-warning text-xs',
    takeOwing:   'text-primary font-bold text-sm',
    takeClear:   'text-success font-bold text-sm',
  }[variant] ?? 'text-ink-muted';

  return (
    <div className="flex flex-col items-center" style={{ flex: 1 }}>
      <div className="relative w-full" style={{ height: CHART_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div style={{ height: marginBottomPx }} />
        {heightPx > 0 && (
          <div
            className={`w-full rounded-t-md ${variantClass} relative`}
            style={{ height: heightPx }}
          >
            <span
              className={`absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] font-semibold ${amountClass}`}
            >
              {amountLabel}
            </span>
          </div>
        )}
      </div>
      <p className="mt-2 text-center font-mono text-[9px] font-semibold uppercase tracking-wider text-ink-muted leading-tight whitespace-pre-line">
        {label}
      </p>
    </div>
  );
}

function WaterfallChart({ takeHome }) {
  if (!takeHome || takeHome.gross === 0) {
    return (
      <div className="flex items-center justify-center h-28 rounded-xl border border-border bg-card-raised text-ink-muted text-sm">
        No projected bonus for this quarter.
      </div>
    );
  }
  const { gross, tax, net, financingPortion, takeHome: th, isOwing } = takeHome;
  const scale = (v) => Math.round((v / gross) * CHART_H);

  const grossH   = CHART_H;
  const taxH     = scale(tax);
  const netH     = scale(net);
  const finH     = scale(financingPortion);
  const takeH    = scale(th);

  // deduction bars float: their bottom aligns with the "landing" level
  const taxMB  = scale(net);   // tax bar sits above net level
  const finMB  = scale(th);    // financing bar sits above take-home level

  const fmt = (v) => formatCurrency(v, { compact: true }) ?? formatCurrency(v);

  return (
    <div className="flex gap-2 px-4 pb-2 pt-6" aria-label="Take-home waterfall chart" role="img">
      <WaterfallBar heightPx={grossH} variant="gross"
        label={'Gross\nbonus'} amountLabel={fmt(gross)} />
      <WaterfallBar heightPx={taxH} marginBottomPx={taxMB} variant="deductTax"
        label={'− Tax\n25%'} amountLabel={`− ${fmt(tax)}`} />
      <WaterfallBar heightPx={netH} variant="net"
        label={'Net\nafter-tax'} amountLabel={fmt(net)} />
      {isOwing
        ? <WaterfallBar heightPx={finH} marginBottomPx={finMB} variant="deductFin"
            label={'− 50%\nof net'} amountLabel={`− ${fmt(financingPortion)}`} />
        : <WaterfallBar heightPx={0} variant="deductFin"
            label={'no split'} amountLabel="− 0" />
      }
      <WaterfallBar heightPx={takeH} variant={isOwing ? 'takeOwing' : 'takeClear'}
        label={'Take-\nhome'} amountLabel={fmt(th)} />
    </div>
  );
}

// ── Result band ───────────────────────────────────────────────────────────────

function ResultBand({ takeHome }) {
  if (!takeHome) return null;
  const { gross, takeHome: th, isOwing } = takeHome;
  const pct = gross > 0 ? Math.round((th / gross) * 1000) / 10 : 0;
  const bannerClass = isOwing
    ? 'bg-warning/10 border-t border-warning/20 text-warning'
    : 'bg-success/10 border-t border-success/20 text-success';
  return (
    <div className={`flex items-center justify-between gap-4 px-4 py-3 rounded-b-xl ${bannerClass}`}>
      <p className="text-sm leading-snug max-w-[220px] text-pretty text-ink">
        {isOwing
          ? <><strong>50% of net goes to repayment.</strong> The remaining take-home is below.</>
          : <><strong>Debt cleared — full net take-home.</strong> No financing split.</>
        }
      </p>
      <div className="text-right shrink-0">
        <p className="font-display font-extrabold text-2xl tracking-tight leading-none">
          {formatCurrency(th)}
        </p>
        <p className="font-mono text-[10px] font-bold mt-1 text-ink-muted">
          {pct}% OF GROSS
        </p>
      </div>
    </div>
  );
}

// ── Spec table (accessible complement to the chart) ──────────────────────────

function BreakdownTable({ takeHome }) {
  if (!takeHome) return null;
  const { gross, tax, net, financingPortion, takeHome: th, isOwing } = takeHome;
  return (
    <table className="w-full text-sm border-separate border-spacing-0 rounded-xl overflow-hidden border border-border bg-card">
      <thead>
        <tr className="bg-card-raised">
          <th className="text-left py-2 px-4 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-border">
            Breakdown
          </th>
          <th className="text-right py-2 px-4 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-border">
            Amount (TTD)
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="py-2 px-4 font-semibold border-b border-border">Gross bonus</td>
          <td className="py-2 px-4 text-right font-mono border-b border-border">{formatCurrency(gross)}</td>
        </tr>
        <tr>
          <td className="py-2 px-4 font-semibold border-b border-border text-danger">
            − Tax (25%)
          </td>
          <td className="py-2 px-4 text-right font-mono border-b border-border text-danger">
            − {formatCurrency(tax)}
          </td>
        </tr>
        <tr className="bg-card-raised">
          <td className="py-2 px-4 font-semibold border-b border-border">Net after-tax</td>
          <td className="py-2 px-4 text-right font-mono border-b border-border">{formatCurrency(net)}</td>
        </tr>
        <tr>
          <td className={`py-2 px-4 font-semibold border-b border-border ${isOwing ? 'text-warning' : 'text-ink-muted'}`}>
            {isOwing ? '− 50% of net → financing' : '− Financing split'}
          </td>
          <td className={`py-2 px-4 text-right font-mono border-b border-border ${isOwing ? 'text-warning' : 'text-ink-muted'}`}>
            {isOwing ? `− ${formatCurrency(financingPortion)}` : '— 0'}
          </td>
        </tr>
        <tr className="bg-primary/5 dark:bg-primary-dark/5">
          <td className={`py-2 px-4 font-extrabold ${isOwing ? 'text-warning' : 'text-success'}`}>
            Take-home
          </td>
          <td className={`py-2 px-4 text-right font-mono font-extrabold text-base ${isOwing ? 'text-warning' : 'text-success'}`}>
            {formatCurrency(th)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MODE_PROJECTED = 'projected';
const MODE_ACTUAL    = 'actual';

export default function TakeHomeWaterfallView() {
  const { userProfile, role, tenantId } = useAuth();
  const readScope = useCallerScope(); // P2b: BM/UM reads carry the scoped where()

  const [agents, setAgents]         = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentsError, setAgentsError] = useState('');

  const [selectedAgent, setSelectedAgent] = useState('');
  const [mode, setMode]               = useState(MODE_PROJECTED);
  const [projection, setProjection]   = useState(null);
  const [loadingProj, setLoadingProj] = useState(false);
  const [projError, setProjError]     = useState('');

  // ── Load agent list ──────────────────────────────────────────────────────
  const loadAgents = useCallback(() => {
    if (!tenantId) return;
    setLoadingAgents(true);
    getTenantUsers(tenantId)
      .then((list) => setAgents(list ?? []))
      .catch((e) => { console.error(e); setAgentsError('Failed to load agents.'); })
      .finally(() => setLoadingAgents(false));
  }, [tenantId]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  // ── Load projection when agent is selected ───────────────────────────────
  // latest-request guard: rapid agent switches can produce stale resolutions;
  // `active` flag ensures only the last-requested result applies.
  useEffect(() => {
    if (!selectedAgent || !tenantId) { setProjection(null); return; }
    let active = true;
    setLoadingProj(true);
    setProjError('');
    getProjectedBonus(tenantId, selectedAgent, undefined, readScope)
      .then((out) => { if (active) setProjection(out); })
      .catch((e) => { if (active) { console.error(e); setProjError('Failed to load projection.'); } })
      .finally(() => { if (active) setLoadingProj(false); });
    return () => { active = false; };
  }, [tenantId, selectedAgent, readScope]);

  // ── Access guard (mirrors FinancingTermsSetup) ───────────────────────────
  if (userProfile && !['branch_manager', 'tenant_admin', 'sales_manager'].includes(role)) {
    return (
      <div className="p-4 rounded-xl border border-border bg-card-raised text-ink-muted text-sm">
        Take-Home Waterfall is available to branch managers and above.
      </div>
    );
  }

  const hasTerms = projection !== null;
  const noBonus  = hasTerms && (!projection.result || (projection.result.consistencyBonus + projection.result.productionBonus) === 0);

  return (
    <div className="flex flex-col gap-5">

      {/* ── Agent selector ── */}
      <div className="flex flex-col gap-1">
        <label htmlFor="waterfall-agent-select" className="text-sm font-semibold text-ink">
          Agent
        </label>
        {agentsError && (
          <p className="text-sm text-danger">{agentsError}</p>
        )}
        <select
          id="waterfall-agent-select"
          className="min-h-[44px] w-full max-w-sm rounded-lg border border-border bg-card px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          disabled={loadingAgents}
          aria-busy={loadingAgents}
        >
          <option value="">{loadingAgents ? 'Loading agents…' : '— Select agent —'}</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName ?? a.email ?? a.id}
            </option>
          ))}
        </select>
      </div>

      {/* ── No agent selected ── */}
      {!selectedAgent && (
        <p className="text-sm text-ink-muted">Select an agent to view their projected take-home waterfall.</p>
      )}

      {/* ── Agent selected: content ── */}
      {selectedAgent && (
        <div className="flex flex-col gap-4">

          {/* Projected / Actual toggle */}
          <div className="flex items-center gap-4 flex-wrap">
            <div
              className="inline-flex rounded-lg border border-border bg-card-raised p-1 gap-1"
              role="tablist"
              aria-label="Waterfall mode"
            >
              {[
                { id: MODE_PROJECTED, label: 'Projected' },
                { id: MODE_ACTUAL,    label: 'Actual' },
              ].map((m) => {
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={`waterfall-mode-${m.id}`}
                    onClick={() => setMode(m.id)}
                    className={[
                      'min-h-[44px] px-4 rounded-md text-sm font-semibold transition-colors',
                      active
                        ? 'bg-primary dark:bg-primary-dark text-white'
                        : 'text-ink-muted hover:text-ink',
                    ].join(' ')}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Status badge for selected agent */}
            {hasTerms && projection.financingStatus && (
              <FinancingStatusBadge status={projection.financingStatus} />
            )}
          </div>

          {/* Actual mode: placeholder */}
          {mode === MODE_ACTUAL && (
            <div className="flex items-center justify-center min-h-[120px] rounded-xl border border-border bg-card-raised text-ink-muted text-sm text-center px-6 py-8">
              <p>
                <strong className="text-ink">Actual data available after the quarter settles.</strong>
                <br />
                The actual take-home will appear here once the quarter's bonus is confirmed.
              </p>
            </div>
          )}

          {/* Projected mode */}
          {mode === MODE_PROJECTED && (
            <>
              {loadingProj && (
                <div className="flex items-center justify-center h-28 rounded-xl border border-border bg-card-raised text-ink-muted text-sm">
                  Loading projection…
                </div>
              )}

              {projError && (
                <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">
                  {projError}
                </div>
              )}

              {!loadingProj && !projError && !hasTerms && (
                <div className="p-4 rounded-xl border border-border bg-card-raised text-ink-muted text-sm">
                  No financing terms on file for this agent.
                </div>
              )}

              {!loadingProj && !projError && hasTerms && (
                <div
                  className={[
                    'rounded-xl border overflow-hidden',
                    projection.takeHome?.isOwing
                      ? 'border-warning/30'
                      : 'border-success/30',
                  ].join(' ')}
                  data-testid="takehome-waterfall"
                >
                  {/* Agreement position chip */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card-raised flex-wrap">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                      Year {projection.yearInAgreement} · Q{projection.quarter}
                    </span>
                    <span className="font-mono text-[10px] text-ink-muted">·</span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                      Projected
                    </span>
                    {noBonus && (
                      <span className="ml-1 font-mono text-[10px] text-ink-muted">
                        (qualification gate not met)
                      </span>
                    )}
                  </div>

                  {/* Bar chart */}
                  <div className="bg-card pt-2 pb-0">
                    <WaterfallChart takeHome={projection?.takeHome} />
                  </div>

                  {/* Result band */}
                  <ResultBand takeHome={projection?.takeHome} />
                </div>
              )}

              {/* Spec table */}
              {!loadingProj && !projError && hasTerms && projection.takeHome && (
                <BreakdownTable takeHome={projection.takeHome} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

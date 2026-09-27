// Track K · K9 — FinancingSelfView (read-only subject-facing financing view).
//
// The FIRST subject-facing surface over the financing data. A financed PERSON
// (agent OR financed unit-manager) sees THEIR OWN financing picture, numbers-only
// — statement facts + derived motivational figures — with ZERO manager-internals
// (risk verdicts, decision-provenance, audit metadata, the clause-5.3 trigger
// ratio). One component, two mounts (AgentDashboard + ManagerDashboard My
// Production), scoped to the caller's own uid.
//
// Read-only. Every read goes through service files with an explicit tenantId +
// the subject uid; K9 adds NO rules (the financing read arms were built
// subject-aware from K1 via canAccessOwn) and NO new data. "Financed" derives
// from financingTerms-doc existence + status — there is NO isFinanced flag and
// K9 invents none.
//
// FIELD PROJECTION CONTRACT (the spec — see the K9 kickoff brief §Phase 2):
//   • SHOWN: statement facts (balance/paid/commission/bonus-offset/validating/
//     actual/basis), terms (agreed/current/validating/effectiveDate/status), the
//     wind-down reconciliation figures, and the pure-derived take-home waterfall +
//     bonus gates + wind-down clocks.
//   • managerFinancing is RELABELED "Your draw" (strip the manager-decision framing).
//   • statusHistory is SPLIT — only { from, to, at } render; note/byName/role suppressed.
//   • PRIVATE fields (adjustmentPct, suggestedFinancing, notes, source, ALL audit
//     metadata) are ABSENT FROM THE DOM — never rendered, not CSS-hidden.
//   • The K7 miss/risk engine is never called and never rendered.
import React, { useState, useEffect, useCallback } from 'react';
import {
  getFinancingTerms,
  listFinancingMonths,
  getFinancingReconciliation,
  deriveBasisSource,
  BASIS_SOURCE_LABELS,
} from '../../services/financingService';
import { getProjectedBonus } from '../../lib/financingProjectedBonus';
import { computeWindDownClocks } from '../../lib/financingReconciliation';
import { computePaydownArcModel, ARC_VIEW } from '../../lib/financingPaydownArc';
import { computeMonthsFromDate, getTodayTT, ymdUTC } from '../../utils/dateInputs';
import { formatCurrency, formatDateDisplay } from '../../utils/formatters';
import FinancingStatusBadge from '../manager/FinancingStatusBadge';
import FinancingSelfViewSkeleton from './FinancingSelfViewSkeleton';

// Statuses that indicate a reconciliation record may exist (so we only spend the
// extra read when it could return something). on_financing has no recon yet.
const RECONCILED_STATUSES = ['reconciling', 'post_financing_repayment', 'cleared'];

// A Firestore Timestamp → "YYYY-MM-DD", guarded against a malformed/invalid value
// (a bad toDate() would otherwise throw on .toISOString()). Returns '' on any fault.
function tsToDateStr(ts) {
  try {
    if (!ts || typeof ts.toDate !== 'function') return '';
    const d = ts.toDate();
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return ymdUTC(d);
  } catch {
    return '';
  }
}

// "YYYY_MM" → "May 2026" for a stored ledger month key.
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthKeyLabel(key) {
  if (typeof key !== 'string') return '';
  const [y, m] = key.split('_').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return key;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

// ── Small presentational helpers (Nexus tokens only — no hex, no inline styles) ──

function Card({ title, children, testId }) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden" data-testid={testId}>
      {title && (
        <h3 className="px-4 py-2 border-b border-border bg-card-raised font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          {title}
        </h3>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

function Figure({ label, value, testId, emphasis = false }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <span
        className={emphasis ? 'font-display font-extrabold text-xl tracking-tight text-ink' : 'font-mono text-sm text-ink'}
        data-testid={testId}
      >
        {value}
      </span>
    </div>
  );
}

// ── Take-home waterfall (accessible table — mirrors TakeHomeWaterfallView's
// BreakdownTable; the CD hierarchy sheet reshapes this later, field set is fixed) ──
function TakeHomeBreakdown({ takeHome }) {
  if (!takeHome) return null;
  const { gross, tax, net, financingPortion, takeHome: th, isOwing } = takeHome;
  return (
    <table className="w-full text-sm border-separate border-spacing-0" data-testid="fsv-takehome-table">
      <thead>
        <tr>
          <th className="text-left py-2 px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-border">
            Projected bonus breakdown
          </th>
          <th className="text-right py-2 px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-border">
            Amount (TTD)
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="py-2 px-3 font-semibold border-b border-border">Gross bonus</td>
          <td className="py-2 px-3 text-right font-mono border-b border-border" data-testid="fsv-takehome-gross">{formatCurrency(gross)}</td>
        </tr>
        <tr>
          <td className="py-2 px-3 font-semibold border-b border-border text-ink-muted">− Tax</td>
          <td className="py-2 px-3 text-right font-mono border-b border-border text-ink-muted">− {formatCurrency(tax)}</td>
        </tr>
        <tr className="bg-card-raised">
          <td className="py-2 px-3 font-semibold border-b border-border">Net after-tax</td>
          <td className="py-2 px-3 text-right font-mono border-b border-border">{formatCurrency(net)}</td>
        </tr>
        <tr>
          <td className={`py-2 px-3 font-semibold border-b border-border ${isOwing ? 'text-warning' : 'text-ink-muted'}`}>
            {isOwing ? '− 50% of net → financing' : '− Financing split'}
          </td>
          <td className={`py-2 px-3 text-right font-mono border-b border-border ${isOwing ? 'text-warning' : 'text-ink-muted'}`}>
            {isOwing ? `− ${formatCurrency(financingPortion)}` : '— 0'}
          </td>
        </tr>
        <tr>
          <td className={`py-2 px-3 font-extrabold ${isOwing ? 'text-warning' : 'text-success'}`}>Take-home</td>
          <td
            className={`py-2 px-3 text-right font-mono font-extrabold text-base ${isOwing ? 'text-warning' : 'text-success'}`}
            data-testid="fsv-takehome"
          >
            {formatCurrency(th)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Gate({ label, met }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
        met ? 'bg-success/15 text-success-ink border border-success/30' : 'bg-surface-muted text-ink-muted border border-border',
      ].join(' ')}
    >
      <span className={['h-2 w-2 rounded-full shrink-0', met ? 'bg-success' : 'bg-ink-muted'].join(' ')} aria-hidden="true" />
      {label}
    </span>
  );
}

// ── K9 Paydown-arc hero (glass centerpiece) ─────────────────────────────────────
// The locked Option-A hero: a running-balance arc-to-zero — actual paydown (solid)
// + straight-line projection (dashed) at the current average paydown rate — with a
// "now" dot, a "clear" dot, and the wind-down clock chips. DISPLAY ONLY: every
// figure is derived from the ledger the view already loads (financingPaydownArc.js);
// no writes, no draw/release logic. Static draw (no animation) → reduced-motion safe
// by construction. On the .glass.hero.teal (dark teal) surface, arc strokes use the
// certified hero-ink viz tokens (a dark-teal stroke would be invisible there).
function ptsStr(points) {
  return (points ?? []).map((p) => `${p.x},${p.y}`).join(' ');
}

function ClockChip({ label, value, sub, done = false }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl px-4 py-3 bg-[--hero-chip-island] border border-[--hero-chip-border] min-w-[140px]">
      <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[--hero-ink-muted-teal]">{label}</span>
      <span className={`font-display font-extrabold text-lg tracking-tight tabular-nums ${done ? 'text-[--hero-dot-success]' : 'text-[--hero-ink]'}`}>{value}</span>
      {sub && <span className="font-mono text-[8.5px] text-[--hero-ink-muted-teal]">{sub}</span>}
    </div>
  );
}

function PaydownArcHero({ terms, ledger, clocks }) {
  const model = computePaydownArcModel({ ledger });
  const { W, H, yBase, xLeft, xRight } = ARC_VIEW;
  const { hasData, hasProjection, isSurplus, nowBalance, projectedClearMonths, projectedClearMonthKey, points } = model;

  const monthsToWaiver = clocks ? Math.max(0, clocks.waiverServiceMonths - clocks.serviceMonths) : null;

  // Honest headline copy — never NaN, never a fabricated date.
  let headline;
  if (!hasData) {
    headline = 'Your balance and paydown trajectory will appear here once your first monthly statement is entered.';
  } else if (isSurplus) {
    headline = `You're ${formatCurrency(Math.abs(nowBalance))} in surplus — that's owed back to you, not owed by you.`;
  } else if (hasProjection) {
    const moWord = projectedClearMonths === 1 ? 'month' : 'months';
    headline = `You're carrying ${formatCurrency(nowBalance)} — on track to clear it in about ${projectedClearMonths} ${moWord}${projectedClearMonthKey ? ` (by ${monthKeyLabel(projectedClearMonthKey)})` : ''} at your current pace.`;
  } else {
    headline = `You're carrying ${formatCurrency(nowBalance)}. A projected clear date appears once your balance is trending down.`;
  }

  const canDrawLine = points.actual.length >= 2;

  return (
    <section className="glass hero teal p-6 flex flex-col gap-3 relative overflow-hidden" data-testid="fsv-paydown-hero">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <FinancingStatusBadge status={terms.financingStatus} />
        <div className="text-right">
          <p className="font-mono text-[8px] font-bold uppercase tracking-widest text-[--hero-ink-muted-teal]">Started</p>
          <p className="font-display font-extrabold text-sm text-[--hero-ink] tabular-nums">{formatDateDisplay(terms.effectiveDate)}</p>
        </div>
      </div>

      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[--hero-ink-muted-teal]">Your balance · paying it down to zero</p>
        <p className="font-display font-extrabold text-xl tracking-tight text-[--hero-ink] mt-1" data-testid="fsv-paydown-headline">{headline}</p>
      </div>

      {hasData && (
        <div className="mt-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block w-full h-auto"
            role="img"
            aria-label={
              isSurplus
                ? `Running balance in surplus of ${formatCurrency(Math.abs(nowBalance))}`
                : `Running balance ${formatCurrency(nowBalance)}${hasProjection ? `, projected to clear in about ${projectedClearMonths} months` : ''}`
            }
          >
            {/* zero baseline */}
            <line x1={xLeft} y1={yBase} x2={xRight} y2={yBase} className="stroke-white/30" strokeWidth="1" strokeDasharray="3 3" />
            {/* area under the actual line */}
            {points.area.length > 0 && (
              <polygon points={ptsStr(points.area)} className="fill-white/10" />
            )}
            {/* actual paydown — solid */}
            {canDrawLine && (
              <polyline
                points={ptsStr(points.actual)}
                fill="none"
                className="text-[--hero-ink]"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* projected paydown — dashed */}
            {hasProjection && (
              <polyline
                points={ptsStr([points.now, ...points.projected])}
                fill="none"
                className="text-[--hero-ink-muted-teal]"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="5 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* now dot */}
            {points.now && (
              <circle cx={points.now.x} cy={points.now.y} r="5" className="text-[--hero-ink]" fill="currentColor" />
            )}
            {/* clear dot (zero crossing) */}
            {points.clear && (
              <circle cx={points.clear.x} cy={points.clear.y} r="4.5" className="text-[--hero-dot-success]" fill="currentColor" stroke="#ffffff" strokeWidth="1.5" />
            )}
          </svg>
          <div className="flex justify-between font-mono text-[8.5px] font-bold uppercase tracking-wide text-[--hero-ink-muted-teal] mt-1 gap-2 flex-wrap">
            <span>Effective · {formatDateDisplay(terms.effectiveDate)}</span>
            <span className="text-[--hero-ink]" data-testid="fsv-paydown-now">Now · {formatCurrency(nowBalance)}{isSurplus ? ' (surplus)' : ''}</span>
            <span className={hasProjection ? 'text-[--hero-dot-success]' : ''} data-testid="fsv-paydown-clear">
              {hasProjection ? `Projected clear · ${monthKeyLabel(projectedClearMonthKey)}` : 'Projected clear · —'}
            </span>
          </div>
        </div>
      )}

      {clocks && (
        <div className="flex gap-2.5 flex-wrap mt-1" data-testid="fsv-paydown-clocks">
          <ClockChip
            label="Running balance"
            value={hasData ? `${formatCurrency(nowBalance)}${isSurplus ? ' (surplus)' : ''}` : '—'}
            sub="negative = surplus"
          />
          <ClockChip
            label="Months to 12-mo waiver"
            value={clocks.serviceMet ? 'Earned' : `${monthsToWaiver} of ${clocks.waiverServiceMonths}`}
            sub={`service ${clocks.serviceMonths} mo`}
            done={clocks.serviceMet}
          />
          <ClockChip
            label="Months to term"
            value={`${clocks.termMonthsRemaining} left`}
            sub={`${clocks.agreementTermMonths}-mo term`}
          />
        </div>
      )}
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FinancingSelfView({ tenantId, subjectUid }) {
  const [state, setState] = useState({ status: 'loading' });
  // Bumped by the error state's Retry button to force the effect below to
  // re-run the same load path (§1 states contract).
  const [reloadToken, setReloadToken] = useState(0);
  const retry = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    // Reset to loading on every identity change so a subject switch never leaves
    // the previous subject's data on screen (CodeRabbit). This also keeps the
    // pre-auth state as loading, not empty — auth/tenant context may resolve a
    // tick after mount (Gemini). The parent always supplies both once resolved.
    setState({ status: 'loading' });
    if (!tenantId || !subjectUid) return;
    let active = true;

    (async () => {
      try {
        const terms = await getFinancingTerms(tenantId, subjectUid);
        // "Financed" = terms doc exists AND status is past not_on_financing.
        if (!terms || terms.financingStatus === 'not_on_financing') {
          if (active) setState({ status: 'empty' });
          return;
        }

        const [ledger, projected] = await Promise.all([
          listFinancingMonths(tenantId, subjectUid),
          getProjectedBonus(tenantId, subjectUid).catch(() => null),
        ]);

        // Reconciliation record — only when the status implies one exists, and ONE
        // read for the derived year (no candidate-year probing, which emitted a
        // benign permission-denied console error on every financed-subject load).
        // The year mirrors FinancingReconciliationPanel's derivation: the year of
        // the LATEST entered ledger month, else the current TT year — the same year
        // reconcileFinancing wrote the record under, so subject and manager read the
        // same doc.
        let recon = null;
        if (RECONCILED_STATUSES.includes(terms.financingStatus)) {
          const latest = (ledger ?? []).reduce((a, b) => (a && a.month >= b.month ? a : b), null);
          const year = latest?.month ? String(latest.month).slice(0, 4) : getTodayTT().slice(0, 4);
          // The narrow permission-denied tolerance below is LOAD-BEARING — do not
          // remove: the financingReconciliation `allow get` rule keys the agent arm
          // on canAccessOwn(tenantId, resource.data.agentId), and for an ABSENT doc
          // the resource is null → resource.data.agentId is null → the agent arm
          // cannot match → Firestore returns PERMISSION-DENIED (not a clean
          // not-found) for a subject reading a year with no record. Managers pass
          // via canManage, but subjects MUST tolerate the denial on an absent year
          // (#767 CodeRabbit DISAGREE — the rules model requires it). Anything that
          // is NOT permission-denied rethrows to the outer catch → the error state,
          // so a GENUINE read failure is no longer masked as "no recon".
          recon = await getFinancingReconciliation(tenantId, subjectUid, year).catch((err) => {
            if (err?.code === 'permission-denied') return null;
            throw err;
          });
        }

        const serviceMonths = terms.effectiveDate ? computeMonthsFromDate(terms.effectiveDate) : 0;
        const clocks = computeWindDownClocks({
          serviceMonths,
          currentMonthlyFinancing: terms.currentMonthlyFinancing,
        });

        if (active) setState({ status: 'ready', terms, ledger: ledger ?? [], projected, recon, clocks });
      } catch (e) {
        console.error('[FinancingSelfView] load failed', e);
        if (active) setState({ status: 'error' });
      }
    })();

    return () => { active = false; };
  }, [tenantId, subjectUid, reloadToken]);

  if (state.status === 'loading') {
    return <FinancingSelfViewSkeleton />;
  }

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className="p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger-ink text-sm flex items-center justify-between gap-3 flex-wrap"
        data-testid="financing-self-view"
      >
        <span>We couldn&apos;t load your financing right now. Please try again.</span>
        <button
          type="button"
          onClick={retry}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.status === 'empty') {
    return (
      <div className="p-6 rounded-xl border border-border bg-card-raised text-ink-muted text-sm text-center" data-testid="financing-self-view">
        <p className="text-ink font-semibold mb-1">You're not on financing.</p>
        <p>When you start a financing agreement, your balance, take-home and progress will appear here.</p>
      </div>
    );
  }

  const { terms, ledger, projected, recon, clocks } = state;
  const gates = projected?.result?.gates;

  return (
    <div className="flex flex-col gap-5" data-testid="financing-self-view">

      {/* ── HERO (glass) · paydown arc + wind-down clocks — the locked Option-A centerpiece ── */}
      <PaydownArcHero terms={terms} ledger={ledger} clocks={clocks} />

      {/* ── Terms header ── */}
      <Card title="Your financing agreement" testId="fsv-terms">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <FinancingStatusBadge status={terms.financingStatus} />
          <Figure label="Started" value={formatDateDisplay(terms.effectiveDate)} testId="fsv-effective-date" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Figure label="Financing this month" value={formatCurrency(terms.currentMonthlyFinancing)} testId="fsv-current-monthly" emphasis />
          <Figure label="Agreed monthly" value={formatCurrency(terms.agreedMonthlyFinancing)} testId="fsv-agreed-monthly" />
          <Figure label="Validating API" value={formatCurrency(terms.validatingAPI)} testId="fsv-validating-api" />
        </div>
      </Card>

      {/* ── Take-home + bonus gates (pure-derived) ── */}
      {projected && projected.takeHome && (
        <Card title={`Projected take-home · Year ${projected.yearInAgreement} · Q${projected.quarter}`} testId="fsv-takehome-card">
          {gates && (
            <div className="flex items-center gap-2 flex-wrap mb-4" data-testid="fsv-gates">
              <Gate label="Gross gate" met={!!gates.grossGateMet} />
              <Gate label="Persistency gate" met={!!gates.persistencyGateMet} />
              <Gate label={gates.qualified ? 'Qualified' : 'Not yet qualified'} met={!!gates.qualified} />
            </div>
          )}
          <TakeHomeBreakdown takeHome={projected.takeHome} />
        </Card>
      )}

      {/* ── Wind-down clocks (pure-derived) ── */}
      {clocks && (
        <Card title="Your agreement progress" testId="fsv-clocks">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Figure label="Service" value={`${clocks.serviceMonths} mo`} testId="fsv-service-months" />
            <Figure
              label="Term remaining"
              value={`${clocks.termMonthsRemaining} / ${clocks.agreementTermMonths} mo`}
              testId="fsv-term-remaining"
            />
            <Figure
              label="12-month waiver"
              value={clocks.serviceMet ? 'Earned' : 'Not yet earned'}
              testId="fsv-service-met"
            />
          </div>
        </Card>
      )}

      {/* ── Monthly ledger (SHOWN statement facts only) ── */}
      <Card title="Monthly statements" testId="fsv-ledger">
        {ledger.length === 0 ? (
          <p className="text-sm text-ink-muted">No monthly statements entered yet.</p>
        ) : (
          // WCAG scrollable-region-focusable: a horizontally-scrollable region must be
          // keyboard-focusable. role="region" + tabIndex 0 is the canonical fix; the
          // jsx-a11y rule is a known false-positive for this exact pattern.
          <div
            className="overflow-x-auto"
            role="region"
            aria-label="Monthly statements (scroll horizontally to see all columns)"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
          >
            <table className="w-full text-sm border-separate border-spacing-0 whitespace-nowrap">
              <thead>
                <tr className="bg-card-raised">
                  {['Month', 'Financing paid', 'Net commission', 'Bonus offset', 'Validating API', 'Actual API', 'Your draw', 'Basis', 'Running balance'].map((h) => (
                    <th key={h} className={`${h === 'Running balance' ? 'text-right' : 'text-left'} py-2 px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-border`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => {
                  const basisKey = row.basisSource || (terms.effectiveDate ? deriveBasisSource(terms.effectiveDate, row.month) : null);
                  const surplus = Number(row.runningBalance) < 0;
                  return (
                    <tr key={row.id ?? row.month} data-testid={`fsv-ledger-row-${row.month}`}>
                      <td className="py-2 px-3 font-semibold border-b border-border">{monthKeyLabel(row.month)}</td>
                      <td className="py-2 px-3 font-mono border-b border-border">{formatCurrency(row.financingPaid)}</td>
                      <td className="py-2 px-3 font-mono border-b border-border">{formatCurrency(row.netCommission)}</td>
                      <td className="py-2 px-3 font-mono border-b border-border">{formatCurrency(row.bonusOffset)}</td>
                      <td className="py-2 px-3 font-mono border-b border-border">{row.validatingAPI != null ? formatCurrency(row.validatingAPI) : '—'}</td>
                      <td className="py-2 px-3 font-mono border-b border-border">{row.actualAPI != null ? formatCurrency(row.actualAPI) : '—'}</td>
                      <td className="py-2 px-3 font-mono border-b border-border" data-testid={`fsv-your-draw-${row.month}`}>
                        {row.managerFinancing != null ? formatCurrency(row.managerFinancing) : '—'}
                      </td>
                      <td className="py-2 px-3 border-b border-border text-ink-muted">{basisKey ? (BASIS_SOURCE_LABELS[basisKey] ?? basisKey) : '—'}</td>
                      <td
                        className={`py-2 px-3 text-right font-mono font-bold border-b border-border ${surplus ? 'text-success' : 'text-ink'}`}
                        data-testid={`fsv-running-balance-${row.month}`}
                      >
                        {formatCurrency(row.runningBalance)}{surplus ? ' (surplus)' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Reconciliation (SHOWN wind-down figures) ── */}
      {recon && (
        <Card title="Reconciliation" testId="fsv-recon">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <Figure label="Total drawn" value={formatCurrency(recon.totalFinancingDrawn)} testId="fsv-recon-drawn" />
            <Figure label="Total offsets" value={formatCurrency(recon.totalOffsets)} testId="fsv-recon-offsets" />
            <Figure label="Waiver applied" value={formatCurrency(recon.waiverApplied)} testId="fsv-recon-waiver" />
            <Figure
              label="Closing balance"
              value={`${formatCurrency(recon.closingBalance)}${Number(recon.closingBalance) < 0 ? ' (surplus)' : ''}`}
              testId="fsv-recon-closing"
              emphasis
            />
            <Figure label="Reconciled position" value={formatCurrency(recon.reconciledPosition)} testId="fsv-recon-position" />
            <Figure label="Surplus paid" value={formatCurrency(recon.surplusPaid)} testId="fsv-recon-surplus" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={[
                'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold',
                recon.outcome === 'surplus' ? 'bg-success/15 text-success-ink border border-success/30' : 'bg-warning/15 text-warning-ink border border-warning/30',
              ].join(' ')}
              data-testid="fsv-recon-outcome"
            >
              {recon.outcome === 'surplus' ? 'Surplus owed back to you' : 'Balance owing'}
            </span>
            {recon.serviceMet && <Gate label="12-month waiver earned" met />}
            {recon.garnishStarted && (
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold bg-surface-muted text-ink-muted border border-border">
                Repayment in progress
              </span>
            )}
          </div>
        </Card>
      )}

      {/* ── Status timeline (SPLIT — { from, to, at } only; no actor/note) ── */}
      {Array.isArray(terms.statusHistory) && terms.statusHistory.length > 0 && (
        <Card title="Status history" testId="fsv-status-history">
          <ol className="flex flex-col gap-2">
            {terms.statusHistory.map((entry, i) => (
              <li key={i} className="flex items-center gap-2 flex-wrap text-sm text-ink-muted" data-testid="fsv-status-entry">
                {entry.from && (
                  <>
                    <FinancingStatusBadge status={entry.from} />
                    <span className="text-ink-muted" aria-hidden="true">→</span>
                  </>
                )}
                <FinancingStatusBadge status={entry.to} />
                <span className="font-mono text-[10px] text-ink-muted">
                  {formatDateDisplay(tsToDateStr(entry.at))}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

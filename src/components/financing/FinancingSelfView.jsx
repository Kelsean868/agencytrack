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
import React, { useState, useEffect } from 'react';
import {
  getFinancingTerms,
  listFinancingMonths,
  getFinancingReconciliation,
  deriveBasisSource,
  BASIS_SOURCE_LABELS,
} from '../../services/financingService';
import { getProjectedBonus } from '../../lib/financingProjectedBonus';
import { computeWindDownClocks } from '../../lib/financingReconciliation';
import { computeMonthsFromDate, getTodayTT } from '../../utils/dateInputs';
import { formatCurrency, formatDateDisplay } from '../../utils/formatters';
import FinancingStatusBadge from '../manager/FinancingStatusBadge';

// Statuses that indicate a reconciliation record may exist (so we only spend the
// extra read when it could return something). on_financing has no recon yet.
const RECONCILED_STATUSES = ['reconciling', 'post_financing_repayment', 'cleared'];

// "YYYY_MM" → "May 2026" for a stored ledger month key.
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthKeyLabel(key) {
  if (typeof key !== 'string') return '';
  const [y, m] = key.split('_').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return key;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

// Candidate years for the reconciliation doc ({uid}_{year}). The record's year is
// the trigger year — auto_month12 lands at effectiveDate-month + 11 (this year or
// next), an early election lands in the effectiveDate year. Cover the 24-month term
// window plus the current calendar year; the loop takes the first non-null. Bounded
// (≤4 reads), gated behind a status that implies a record exists.
function reconCandidateYears(effectiveDate) {
  const years = new Set();
  if (typeof effectiveDate === 'string' && effectiveDate.length >= 4) {
    const y = parseInt(effectiveDate.slice(0, 4), 10);
    if (Number.isFinite(y)) { years.add(y); years.add(y + 1); years.add(y + 2); }
  }
  const nowY = parseInt(getTodayTT().slice(0, 4), 10);
  if (Number.isFinite(nowY)) years.add(nowY);
  return [...years];
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

// ── Main component ────────────────────────────────────────────────────────────
export default function FinancingSelfView({ tenantId, subjectUid }) {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (!tenantId || !subjectUid) { setState({ status: 'empty' }); return; }
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

        // Reconciliation record — only when the status implies one exists.
        let recon = null;
        if (RECONCILED_STATUSES.includes(terms.financingStatus)) {
          for (const y of reconCandidateYears(terms.effectiveDate)) {
            const r = await getFinancingReconciliation(tenantId, subjectUid, y);
            if (r) { recon = r; break; }
          }
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
  }, [tenantId, subjectUid]);

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center h-28 rounded-xl border border-border bg-card-raised text-ink-muted text-sm" data-testid="financing-self-view">
        Loading your financing…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger-ink text-sm" data-testid="financing-self-view">
        We couldn't load your financing right now. Please try again.
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
                    <th key={h} className="text-left py-2 px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-border">
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
              <li key={i} className="flex items-center gap-2 text-sm text-ink-muted" data-testid="fsv-status-entry">
                <FinancingStatusBadge status={entry.to} />
                <span className="font-mono text-[10px] text-ink-muted">
                  {entry.at?.toDate ? formatDateDisplay(entry.at.toDate().toISOString().slice(0, 10)) : ''}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

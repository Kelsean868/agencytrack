import React, { useState, useEffect } from 'react';
import { X, Check, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import useFocusTrap from '../../../hooks/useFocusTrap';
import { useAuth } from '../../../context/AuthContext';
import { formatCurrency } from '../../../utils/formatters';
import { PROSPECTING_SOURCE_LABELS } from '../../../services/prospectInfoService';
import { getPolicyHistory } from '../../../services/policiesService';
import { getTodayTT } from '../../../utils/dateInputs';
import { LEGAL_AGENT_TRANSITIONS, POLICY_STATUS_LABELS } from '../../../constants/policyLifecycle';
import { lifecycleNodes } from '../../../lib/policyLedgerDerivation';
import { policyToken, policyPillLabel, isConfirmed } from '../../../lib/policyStatusTokens';

const EMPTY_TX_FIELDS = {
  dateSubmitted: '',
  ratedPremium: '', rateReason: '',
  pendingReason: '',
  reason: '',
  dateIssued: '', settledAPI: '', issuedCoverage: '', initialPremium: '', earnedCommission: '',
};

/** A Firestore Timestamp / Date / ISO value as a "YYYY-MM-DD" date-input value. */
function dateInputValue(d) {
  if (!d) return '';
  const date = d?.toDate ? d.toDate() : new Date(d);
  if (Number.isNaN(date?.getTime?.())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Port_of_Spain', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function fmtDate(d) {
  if (!d) return '—';
  const date = d?.toDate ? d.toDate() : new Date(d);
  if (Number.isNaN(date?.getTime?.())) return '—';
  return date.toLocaleDateString('en-TT', { day: 'numeric', month: 'short', year: 'numeric' });
}

const inputCls = 'h-11 px-3 rounded-lg bg-surface border border-border text-sm text-ink w-full focus:outline-none focus:ring-2 focus:ring-primary/40';

/**
 * PolicyDrillDrawer — Tier 3. Slide-over (desktop) / bottom sheet (mobile)
 * replacing the old inline expand. LifecycleBar (derived Confirmed) +
 * manager-confirmation card + details grid + history + state-machine-filtered
 * transition footer. The transition writes through the EXISTING service logic
 * (onTransition); only the chrome moved here.
 *
 * Lapsed never renders — LEGAL_AGENT_TRANSITIONS excludes it for agents.
 */
export default function PolicyDrillDrawer({ policy, onClose, onTransition, transitioning, transitionError }) {
  const { tenantId, user } = useAuth();
  const today = getTodayTT();

  const modalRef = useFocusTrap({ onEscape: onClose });

  const [history, setHistory] = useState(null);
  const [histError, setHistError] = useState(false);

  const legalNext = LEGAL_AGENT_TRANSITIONS[policy.status] ?? [];
  const [txTo, setTxTo] = useState(legalNext[0] ?? '');
  const [txFields, setTxFields] = useState(EMPTY_TX_FIELDS);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setHistory(null);
    setHistError(false);
    getPolicyHistory(tenantId, policy.id, user?.uid)
      .then((rows) => { if (alive) setHistory(rows); })
      .catch(() => { if (alive) { setHistory([]); setHistError(true); } });
    return () => { alive = false; };
  }, [tenantId, policy.id, user?.uid]);

  const t = policyToken(policy);
  const nodes = lifecycleNodes(policy);
  const confirmed = isConfirmed(policy);

  function pickTarget(to) {
    setTxTo(to);
    setTxFields(EMPTY_TX_FIELDS);
    setMenuOpen(false);
  }

  function onField(e) {
    const { name, value } = e.target;
    setTxFields((prev) => ({ ...prev, [name]: value }));
  }

  // The written → submitted edge is the only one that needs a field off the
  // policy itself: dateWritten, so the service can refuse a dateSubmitted that
  // precedes it. It is passed through, never written back.
  const writtenMin = dateInputValue(policy.dateWritten);

  function submitTransition(e) {
    e.preventDefault();
    if (txTo === 'settled') {
      onTransition(txTo, { ...txFields, dateIssued: txFields.dateIssued || today });
    } else if (policy.status === 'written' && txTo === 'submitted') {
      onTransition(txTo, {
        ...txFields,
        dateSubmitted: txFields.dateSubmitted || today,
        dateWritten: policy.dateWritten,
      });
    } else {
      onTransition(txTo, txFields);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-black/40"
      data-testid="policy-drawer-backdrop"
    >
      <div
        ref={modalRef}
        className="bg-card w-full sm:max-w-md sm:h-full rounded-t-2xl sm:rounded-none flex flex-col max-h-[90vh] sm:max-h-none overflow-y-auto shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label={`Policy detail — ${policy.ownerName}`}
        data-testid="policy-drawer"
      >
        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-start justify-between gap-2">
            <p className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-primary">
              Policy · {policy.productLine || 'Life'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 -mt-1 -mr-1 flex items-center justify-center rounded-lg text-ink-muted hover:bg-surface transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-1.5">
            <span className="font-display font-extrabold text-xl tracking-tight text-ink">{policy.ownerName}</span>
            <span className="font-mono text-[10px] font-bold text-ink-muted ml-2.5">
              {policy.policyNumber ? `#${policy.policyNumber}` : '# PENDING'}
            </span>
          </div>
          {(policy.planName || (policy.insuredName && policy.insuredName !== policy.ownerName)) && (
            <p className="text-[12px] text-ink-muted mt-1.5">
              {policy.insuredName && policy.insuredName !== policy.ownerName ? `Insured · ${policy.insuredName} · ` : ''}
              {policy.planName}
            </p>
          )}
          <div className="flex items-center gap-3 mt-3">
            <span className={`px-2.5 py-[3px] rounded-full font-mono text-[10px] font-bold tracking-[0.1em] uppercase ${t.tint} ${t.text}`}>
              {policyPillLabel(policy)}
            </span>
            <span className="font-display font-extrabold text-xl text-primary tracking-tight">{formatCurrency(policy.proposedAPI)}</span>
            <span className="font-mono text-[10px] text-ink-muted">API</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 flex-1">
          {/* Lifecycle */}
          <p className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink-muted mb-3">Lifecycle</p>
          <div className="flex items-start" data-testid="drawer-lifecycle">
            {nodes.map((n, i) => (
              <React.Fragment key={n.key}>
                {i > 0 && (
                  <span className={`flex-1 h-0.5 mt-[13px] ${nodes[i - 1].state === 'done' ? 'bg-primary' : 'bg-ink-faint/35'}`} />
                )}
                <div className="flex flex-col items-center w-[72px] shrink-0">
                  <span
                    className={
                      n.state === 'done'
                        ? 'w-7 h-7 rounded-full bg-primary dark:bg-primary-dark text-white flex items-center justify-center'
                        : n.state === 'cur'
                        ? 'w-7 h-7 rounded-full bg-gold flex items-center justify-center shadow-[0_0_0_4px_var(--color-gold-tint)]'
                        : 'w-7 h-7 rounded-full bg-card border-[1.5px] border-ink-faint/50'
                    }
                  >
                    {n.state === 'done' && <Check size={14} />}
                    {n.state === 'cur' && <span className="w-2 h-2 rounded-full bg-white" />}
                  </span>
                  <span className={`text-[11px] font-bold mt-2 ${n.state === 'future' ? 'text-ink-muted' : n.state === 'cur' ? 'text-gold-ink' : 'text-primary'}`}>{n.label}</span>
                  <span className="font-mono text-[9px] text-ink-muted mt-0.5">{n.date ? fmtDate(n.date) : '—'}</span>
                  {n.derived && (
                    <span className="font-mono text-[7.5px] font-bold tracking-[0.08em] text-gold-ink bg-gold-tint px-1.5 py-px rounded-full mt-1">DERIVED</span>
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Manager confirmation card */}
          {confirmed && (
            <div className="mt-5 rounded-xl bg-gold-tint border border-gold/30 p-4" data-testid="drawer-confirmation">
              <p className="text-[13px] font-bold text-ink">
                Confirmed by {policy.confirmedByManager} · {fmtDate(policy.confirmedAt)}
              </p>
              <p className="text-[12px] text-ink-muted mt-1.5">
                {policy.hasDiscrepancy ? (
                  <>Your value: <span className="font-semibold text-ink">{formatCurrency(policy.settledAPI)}</span>{' · '}Manager: <span className="font-semibold text-ink">{formatCurrency(policy.managerSettledAPI)}</span></>
                ) : (
                  <>Confirmed value: <span className="font-semibold text-ink">{formatCurrency(policy.managerSettledAPI)}</span></>
                )}
              </p>
              {policy.managerNote && <p className="text-[12px] text-ink-muted mt-1">Note: {policy.managerNote}</p>}
            </div>
          )}

          {/* Details */}
          <p className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink-muted mt-5 mb-3">Details</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Detail k="PRODUCT" v={`${policy.policyClass ?? '—'} · ${policy.planName ?? '—'}`} />
            <Detail k="PREMIUM" v={formatCurrency(policy.proposedPremium)} />
            <Detail k="SOURCE" v={PROSPECTING_SOURCE_LABELS[policy.sourceOfProspect] || policy.sourceOfProspect || '—'} />
            <Detail k="CASH W/ APP" v={policy.cashWithApp?.collected ? (policy.cashWithApp.amount != null ? formatCurrency(policy.cashWithApp.amount) : 'Yes') : 'No'} />
          </div>

          {/* History */}
          <p className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink-muted mt-5 mb-3">History</p>
          <div className="flex flex-col gap-1.5" data-testid="drawer-history">
            {history === null && (
              <div className="flex items-center gap-1.5 text-xs text-ink-muted"><Loader2 size={12} className="animate-spin" /> Loading…</div>
            )}
            {history !== null && history.length === 0 && (
              <p className="text-xs text-ink-muted">{histError ? 'Could not load history.' : 'No history yet.'}</p>
            )}
            {history?.map((h) => (
              <div key={h.id} className="flex items-start gap-2 text-xs">
                <span className="font-mono text-ink-muted shrink-0">{fmtDate(h.at)}</span>
                <span className="text-ink">
                  {(POLICY_STATUS_LABELS[h.fromStatus] ?? h.fromStatus)} → {(POLICY_STATUS_LABELS[h.toStatus] ?? h.toStatus)}
                  <span className="text-ink-muted ml-1.5">({h.actorRole})</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Transition footer — state-machine-filtered */}
        {legalNext.length > 0 && (
          <div className="p-5 border-t border-border bg-surface-muted">
            <p className="text-[11.5px] text-ink-muted mb-2.5">Next step: {POLICY_STATUS_LABELS[txTo] ?? txTo}</p>
            <form onSubmit={submitTransition} className="flex flex-col gap-3">
              <div className="flex items-stretch w-fit rounded-lg overflow-hidden shadow-sm">
                <span className="px-4 py-2.5 bg-primary dark:bg-primary-dark text-white text-[12.5px] font-bold">Move to {POLICY_STATUS_LABELS[txTo] ?? txTo}</span>
                {legalNext.length > 1 && (
                  <>
                    <span className="w-px bg-white/25" />
                    <button
                      type="button"
                      onClick={() => setMenuOpen((o) => !o)}
                      className="px-3 bg-primary dark:bg-primary-dark text-white flex items-center"
                      aria-label="Other status options"
                      aria-expanded={menuOpen}
                      data-testid="drawer-tx-menu-toggle"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </>
                )}
              </div>

              {menuOpen && legalNext.length > 1 && (
                <div className="w-full sm:w-72 bg-card border border-border rounded-xl p-1.5 shadow-lg" role="menu">
                  <p className="font-mono text-[9px] font-bold tracking-[0.14em] text-ink-muted px-2.5 pt-2 pb-1.5">
                    OTHER STATUS · ALLOWED FROM “{(POLICY_STATUS_LABELS[policy.status] ?? policy.status).toUpperCase()}”
                  </p>
                  {legalNext.filter((s) => s !== txTo).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="menuitem"
                      onClick={() => pickTarget(s)}
                      className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg hover:bg-surface text-left"
                      data-testid={`drawer-tx-option-${s}`}
                    >
                      <span className="text-[12.5px] font-bold text-ink">{POLICY_STATUS_LABELS[s] ?? s}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Per-target fields */}
              {policy.status === 'written' && txTo === 'submitted' && (
                <Field label="Date Submitted" required>
                  <input name="dateSubmitted" type="date" min={writtenMin || undefined} max={today}
                    value={txFields.dateSubmitted || today} onChange={onField} className={inputCls} required />
                </Field>
              )}
              {txTo === 'rated' && (
                <>
                  <Field label="Rated Premium (TTD)" required>
                    <input name="ratedPremium" type="number" step="0.01" min="0.01" value={txFields.ratedPremium} onChange={onField} placeholder="0.00" className={inputCls} required />
                  </Field>
                  <Field label="Rate Reason">
                    <input name="rateReason" type="text" value={txFields.rateReason} onChange={onField} placeholder="Optional" className={inputCls} />
                  </Field>
                </>
              )}
              {txTo === 'postponed' && (
                <Field label="Pending Reason">
                  <input name="pendingReason" type="text" value={txFields.pendingReason} onChange={onField} placeholder="Optional" className={inputCls} />
                </Field>
              )}
              {(txTo === 'ntu' || txTo === 'denied') && (
                <Field label="Reason">
                  <input name="reason" type="text" value={txFields.reason} onChange={onField} placeholder="Optional" className={inputCls} />
                </Field>
              )}
              {txTo === 'settled' && (
                <>
                  <Field label="Date Issued" required>
                    <input name="dateIssued" type="date" max={today} value={txFields.dateIssued || today} onChange={onField} className={inputCls} required />
                  </Field>
                  <Field label="Settled API (TTD)" required>
                    <input name="settledAPI" type="number" step="0.01" min="0.01" value={txFields.settledAPI} onChange={onField} placeholder="0.00" className={inputCls} required />
                  </Field>
                  <Field label="Issued Coverage (TTD)" required>
                    <input name="issuedCoverage" type="number" step="0.01" min="0.01" value={txFields.issuedCoverage} onChange={onField} placeholder="0.00" className={inputCls} required />
                  </Field>
                  <Field label="Initial Premium (TTD)" required>
                    <input name="initialPremium" type="number" step="0.01" min="0.01" value={txFields.initialPremium} onChange={onField} placeholder="0.00" className={inputCls} required />
                  </Field>
                  <Field label="Earned Commission (TTD)" required>
                    <input name="earnedCommission" type="number" step="0.01" min="0" value={txFields.earnedCommission} onChange={onField} placeholder="0.00" className={inputCls} required />
                  </Field>
                </>
              )}

              {transitionError && (
                <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-danger-tint text-danger-ink text-sm">
                  <AlertCircle size={16} /> {transitionError}
                </div>
              )}

              <button
                type="submit"
                disabled={transitioning}
                className="h-11 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                data-testid="drawer-tx-confirm"
              >
                {transitioning ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : `Confirm — ${POLICY_STATUS_LABELS[txTo] ?? txTo}`}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ k, v }) {
  return (
    <div className="px-3 py-2.5 bg-surface-muted border border-border rounded-lg">
      <p className="font-mono text-[9px] font-bold text-ink-muted tracking-[0.1em]">{k}</p>
      <p className="text-[12px] font-semibold text-ink mt-0.5 break-words">{v}</p>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
        {label}{required && <span className="text-danger-ink ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

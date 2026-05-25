import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, AlertCircle, ArrowLeft, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { PROSPECTING_SOURCES, PROSPECTING_SOURCE_LABELS } from '../../services/prospectInfoService';
import { createPolicy, getOwnPolicies, transitionPolicyStatus, getPolicyHistory } from '../../services/policiesService';
import {
  LEGAL_AGENT_TRANSITIONS,
  POLICY_STATUS_LABELS,
} from '../../constants/policyLifecycle';

const FREQ_MULT = { A: 1, S: 2, Q: 4, M: 12 };
const FREQ_LABELS = { A: 'Annual', S: 'Semi-Annual', Q: 'Quarterly', M: 'Monthly' };

const PRODUCT_LINES = [
  { value: 'life',     label: 'Life' },
  { value: 'ah',       label: 'A&H' },
  { value: 'property', label: 'Property' },
  { value: 'motor',    label: 'Motor' },
];

const BIZ_TYPES = [
  { value: 'nb_ordinary',   label: 'New Business (Ordinary)' },
  { value: 'inc_ppp',       label: 'Income Protection / PPP' },
  { value: 'replacement',   label: 'Replacement' },
  { value: 'spia',          label: 'SPIA' },
  { value: 'lumpsum',       label: 'Lump Sum' },
  { value: 'platinum_edge', label: 'Platinum Edge' },
];

const POLICY_CLASSES = [
  { value: 'whole_life',     label: 'Whole Life' },
  { value: 'term',           label: 'Term' },
  { value: 'universal_life', label: 'Universal Life' },
  { value: 'endowment',      label: 'Endowment' },
  { value: 'annuity',        label: 'Annuity' },
];

const today = new Date().toISOString().split('T')[0];

const STATUS_BADGE_CLS = {
  submitted: 'bg-blue-50   text-blue-700   dark:bg-blue-950/30   dark:text-blue-400',
  rated:     'bg-green-50  text-green-700  dark:bg-green-950/30  dark:text-green-400',
  postponed: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
  ntu:       'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
  denied:    'bg-red-50    text-red-700    dark:bg-red-950/30    dark:text-red-400',
  settled:   'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
};

const EMPTY_TX_FIELDS = {
  ratedPremium: '', rateReason: '',
  pendingReason: '',
  reason: '',
  dateIssued: today, settledAPI: '', issuedCoverage: '', initialPremium: '', earnedCommission: '',
};

const EMPTY_FORM = {
  ownerName: '',
  insuredName: '',
  policyNumber: '',
  productLine: 'life',
  newBusinessType: 'nb_ordinary',
  policyClass: 'whole_life',
  planName: '',
  planId: '',
  proposedPremium: '',
  proposedFrequency: 'M',
  proposedAPI: '',
  proposedCoverage: '',
  dateWritten: today,
  dateSubmitted: today,
  notes: '',
  isSelfOrFamily: false,
  replacedPolicyAPI: '',
  sourceOfProspect: '',
  cashWithApp: { collected: false, amount: '' },
};

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-TT', { year: 'numeric', month: 'short', day: 'numeric' });
}

function FieldGroup({ label, children, required, id }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'h-11 px-3 rounded-lg bg-surface border border-border text-sm text-ink w-full focus:outline-none focus:ring-2 focus:ring-primary/40';
const selectCls = 'h-11 px-3 rounded-lg bg-surface border border-border text-sm text-ink w-full focus:outline-none focus:ring-2 focus:ring-primary/40';

export default function PolicyLedgerPanel() {
  const { user, userProfile, tenantId } = useAuth();

  const [view, setView] = useState('list');
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sameAsOwner, setSameAsOwner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // ── History timeline state ──
  const [histExpanded, setHistExpanded] = useState(new Set());
  const [histData,     setHistData]     = useState({});  // policyId → history[]
  const [histLoading,  setHistLoading]  = useState({});  // policyId → boolean

  const toggleHistory = useCallback(async (policyId) => {
    setHistExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(policyId)) { next.delete(policyId); return next; }
      next.add(policyId);
      return next;
    });
    if (!histData[policyId]) {
      setHistLoading((prev) => ({ ...prev, [policyId]: true }));
      try {
        const rows = await getPolicyHistory(tenantId, policyId, user?.uid);
        setHistData((prev) => ({ ...prev, [policyId]: rows }));
      } catch {
        setHistData((prev) => ({ ...prev, [policyId]: [] }));
      } finally {
        setHistLoading((prev) => ({ ...prev, [policyId]: false }));
      }
    }
  }, [tenantId, user?.uid, histData]);

  // ── Transition modal state ──
  const [txPolicy, setTxPolicy] = useState(null);  // policy object being transitioned, or null
  const [txTo, setTxTo] = useState('');
  const [txFields, setTxFields] = useState(EMPTY_TX_FIELDS);
  const [txing, setTxing] = useState(false);
  const [txError, setTxError] = useState(null);

  useEffect(() => {
    if (!tenantId || !user?.uid) return;
    setLoading(true);
    getOwnPolicies(tenantId, user.uid)
      .then((data) => { setPolicies(data); setLoadError(null); })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [tenantId, user?.uid]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setForm((prev) => {
      const next = { ...prev, [name]: val };
      if (name === 'proposedPremium' || name === 'proposedFrequency') {
        const prem = parseFloat(name === 'proposedPremium' ? value : prev.proposedPremium) || 0;
        const freq = name === 'proposedFrequency' ? value : prev.proposedFrequency;
        next.proposedAPI = prem > 0 ? String(Math.round(prem * (FREQ_MULT[freq] || 1) * 100) / 100) : '';
      }
      if (sameAsOwner && name === 'ownerName') next.insuredName = value;
      return next;
    });
  }

  function handleSameAsOwner(checked) {
    setSameAsOwner(checked);
    if (checked) setForm((prev) => ({ ...prev, insuredName: prev.ownerName }));
  }

  function handleCashCollected(checked) {
    setForm((prev) => ({ ...prev, cashWithApp: { collected: checked, amount: checked ? prev.cashWithApp.amount : '' } }));
  }

  function handleCashAmount(e) {
    setForm((prev) => ({ ...prev, cashWithApp: { ...prev.cashWithApp, amount: e.target.value } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const agentRef = { uid: user.uid, ...userProfile };
      await createPolicy(tenantId, agentRef, form);
      const fresh = await getOwnPolicies(tenantId, user.uid);
      setPolicies(fresh);
      setForm(EMPTY_FORM);
      setSameAsOwner(false);
      setView('list');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openTxModal(policy) {
    const nexts = LEGAL_AGENT_TRANSITIONS[policy.status] ?? [];
    if (nexts.length === 0) return;
    setTxPolicy(policy);
    setTxTo(nexts[0]);
    setTxFields(EMPTY_TX_FIELDS);
    setTxError(null);
  }

  function closeTxModal() {
    setTxPolicy(null);
    setTxError(null);
  }

  function handleTxFieldChange(e) {
    const { name, value } = e.target;
    setTxFields((prev) => ({ ...prev, [name]: value }));
  }

  async function handleTxSubmit(e) {
    e.preventDefault();
    setTxing(true);
    setTxError(null);
    try {
      const agentRef = { uid: user.uid, ...userProfile };
      await transitionPolicyStatus(tenantId, agentRef, txPolicy.id, txPolicy.status, txTo, txFields);
      const fresh = await getOwnPolicies(tenantId, user.uid);
      setPolicies(fresh);
      closeTxModal();
    } catch (err) {
      setTxError(err.message);
    } finally {
      setTxing(false);
    }
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setSameAsOwner(false);
    setSaveError(null);
    setView('create');
  }

  function cancelCreate() {
    setSaveError(null);
    setView('list');
  }

  // ── LIST VIEW ──
  if (view === 'list') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Policy Ledger</h2>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-11 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors min-w-[44px]"
          >
            <Plus size={16} /> New Policy
          </button>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-border/40 animate-pulse" />
            ))}
          </div>
        )}

        {loadError && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle size={16} /> {loadError}
          </div>
        )}

        {!loading && !loadError && policies.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-sm text-ink-muted">No policies yet. Tap "New Policy" to log your first.</p>
          </div>
        )}

        {!loading && policies.map((p) => {
          const nexts = LEGAL_AGENT_TRANSITIONS[p.status] ?? [];
          return (
            <div key={p.id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm text-ink">{p.ownerName}</p>
                  {p.insuredName !== p.ownerName && (
                    <p className="text-xs text-ink-muted">Insured: {p.insuredName}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_BADGE_CLS[p.status] ?? 'bg-primary/10 text-primary'}`}>
                  {POLICY_STATUS_LABELS[p.status] ?? p.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                <span>API: <span className="text-ink font-semibold">{formatCurrency(p.proposedAPI)}</span></span>
                <span>Source: {PROSPECTING_SOURCE_LABELS[p.sourceOfProspect] || p.sourceOfProspect}</span>
                <span>
                  Cash w/ App:{' '}
                  {p.cashWithApp?.collected
                    ? (p.cashWithApp.amount != null ? formatCurrency(p.cashWithApp.amount) : 'Yes')
                    : 'No'}
                </span>
                <span>Written: {fmtDate(p.dateWritten)}</span>
              </div>
              {p.confirmedAt ? (
                <div className="pt-1 border-t border-border flex flex-col gap-1.5">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                      Confirmed by {p.confirmedByManager}
                    </span>
                    {p.hasDiscrepancy && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                        Discrepancy
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted">
                    {p.hasDiscrepancy ? (
                      <>Your value: <span className="text-ink font-semibold">{formatCurrency(p.settledAPI)}</span>{' · '}Manager: <span className="text-ink font-semibold">{formatCurrency(p.managerSettledAPI)}</span></>
                    ) : (
                      <>Settled: <span className="text-ink font-semibold">{formatCurrency(p.managerSettledAPI)}</span></>
                    )}
                  </p>
                  {p.managerNote && (
                    <p className="text-xs text-ink-muted">Note: {p.managerNote}</p>
                  )}
                </div>
              ) : p.status === 'settled' ? (
                <div className="pt-1 border-t border-border">
                  <p className="text-xs text-ink-muted">Awaiting manager confirmation.</p>
                </div>
              ) : nexts.length > 0 ? (
                <div className="pt-1 border-t border-border">
                  <button
                    onClick={() => openTxModal(p)}
                    className="h-9 px-3 rounded-lg text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/5 transition-colors min-w-[44px]"
                  >
                    Update Status
                  </button>
                </div>
              ) : null}

              {/* ── History timeline ── */}
              <div className="border-t border-border pt-1">
                <button
                  onClick={() => toggleHistory(p.id)}
                  className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors h-8 min-w-[44px]"
                  aria-expanded={histExpanded.has(p.id)}
                  data-testid={`policy-history-toggle-${p.id}`}
                >
                  {histExpanded.has(p.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  History
                </button>
                {histExpanded.has(p.id) && (
                  <div className="mt-1 flex flex-col gap-1.5" data-testid={`policy-history-list-${p.id}`}>
                    {histLoading[p.id] && (
                      <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                        <Loader2 size={12} className="animate-spin" /> Loading…
                      </div>
                    )}
                    {!histLoading[p.id] && histData[p.id]?.length === 0 && (
                      <p className="text-xs text-ink-muted">No history yet.</p>
                    )}
                    {!histLoading[p.id] && histData[p.id]?.map((h) => (
                      <div key={h.id} className="flex items-start gap-2 text-xs">
                        <span className="text-ink-muted shrink-0">{fmtDate(h.at)}</span>
                        <span className="text-ink">
                          <span className={`inline-block px-1.5 py-0.5 rounded-full font-semibold ${STATUS_BADGE_CLS[h.fromStatus] ?? 'bg-primary/10 text-primary'}`}>
                            {POLICY_STATUS_LABELS[h.fromStatus] ?? h.fromStatus}
                          </span>
                          {' → '}
                          <span className={`inline-block px-1.5 py-0.5 rounded-full font-semibold ${STATUS_BADGE_CLS[h.toStatus] ?? 'bg-primary/10 text-primary'}`}>
                            {POLICY_STATUS_LABELS[h.toStatus] ?? h.toStatus}
                          </span>
                          <span className="text-ink-muted ml-1.5">({h.actorRole})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      {/* ── Transition modal ── */}
      {txPolicy && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl w-full max-w-md flex flex-col gap-4 p-5 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-ink">Update Status</h3>
              <button
                onClick={closeTxModal}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-ink-muted hover:bg-surface transition-colors min-w-[44px] min-h-[44px]"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-ink-muted">
              <span className="font-semibold text-ink">{txPolicy.ownerName}</span>
              {' '}— current status: <span className="font-semibold">{POLICY_STATUS_LABELS[txPolicy.status]}</span>
            </p>

            <form onSubmit={handleTxSubmit} className="flex flex-col gap-4">
              {/* Target status */}
              <FieldGroup label="New Status" required id="tx-status">
                <select
                  id="tx-status"
                  value={txTo}
                  onChange={(e) => { setTxTo(e.target.value); setTxFields(EMPTY_TX_FIELDS); setTxError(null); }}
                  className={selectCls}
                >
                  {(LEGAL_AGENT_TRANSITIONS[txPolicy.status] ?? []).map((s) => (
                    <option key={s} value={s}>{POLICY_STATUS_LABELS[s] ?? s}</option>
                  ))}
                </select>
              </FieldGroup>

              {/* Per-transition fields */}
              {txTo === 'rated' && (
                <>
                  <FieldGroup label="Rated Premium (TTD)" required id="tx-ratedPremium">
                    <input id="tx-ratedPremium" name="ratedPremium" type="number" step="0.01" min="0.01"
                      value={txFields.ratedPremium} onChange={handleTxFieldChange}
                      placeholder="0.00" className={inputCls} required />
                  </FieldGroup>
                  <FieldGroup label="Rate Reason" id="tx-rateReason">
                    <input id="tx-rateReason" name="rateReason" type="text"
                      value={txFields.rateReason} onChange={handleTxFieldChange}
                      placeholder="Optional" className={inputCls} />
                  </FieldGroup>
                </>
              )}

              {txTo === 'postponed' && (
                <FieldGroup label="Pending Reason" id="tx-pendingReason">
                  <input id="tx-pendingReason" name="pendingReason" type="text"
                    value={txFields.pendingReason} onChange={handleTxFieldChange}
                    placeholder="Optional" className={inputCls} />
                </FieldGroup>
              )}

              {(txTo === 'ntu' || txTo === 'denied') && (
                <FieldGroup label="Reason" id="tx-reason">
                  <input id="tx-reason" name="reason" type="text"
                    value={txFields.reason} onChange={handleTxFieldChange}
                    placeholder="Optional" className={inputCls} />
                </FieldGroup>
              )}

              {txTo === 'settled' && (
                <>
                  <FieldGroup label="Date Issued" required id="tx-dateIssued">
                    <input id="tx-dateIssued" name="dateIssued" type="date" max={today}
                      value={txFields.dateIssued} onChange={handleTxFieldChange}
                      className={inputCls} required />
                  </FieldGroup>
                  <FieldGroup label="Settled API (TTD)" required id="tx-settledAPI">
                    <input id="tx-settledAPI" name="settledAPI" type="number" step="0.01" min="0.01"
                      value={txFields.settledAPI} onChange={handleTxFieldChange}
                      placeholder="0.00" className={inputCls} required />
                  </FieldGroup>
                  <FieldGroup label="Issued Coverage (TTD)" required id="tx-issuedCoverage">
                    <input id="tx-issuedCoverage" name="issuedCoverage" type="number" step="0.01" min="0.01"
                      value={txFields.issuedCoverage} onChange={handleTxFieldChange}
                      placeholder="0.00" className={inputCls} required />
                  </FieldGroup>
                  <FieldGroup label="Initial Premium (TTD)" required id="tx-initialPremium">
                    <input id="tx-initialPremium" name="initialPremium" type="number" step="0.01" min="0.01"
                      value={txFields.initialPremium} onChange={handleTxFieldChange}
                      placeholder="0.00" className={inputCls} required />
                  </FieldGroup>
                  <FieldGroup label="Earned Commission (TTD)" required id="tx-earnedCommission">
                    <input id="tx-earnedCommission" name="earnedCommission" type="number" step="0.01" min="0"
                      value={txFields.earnedCommission} onChange={handleTxFieldChange}
                      placeholder="0.00" className={inputCls} required />
                  </FieldGroup>
                </>
              )}

              {txError && (
                <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle size={16} /> {txError}
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={closeTxModal}
                  className="flex-1 h-11 rounded-lg border border-border text-sm font-semibold text-ink-muted hover:bg-surface/70 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={txing}
                  className="flex-1 h-11 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {txing ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    );
  }

  // ── CREATE FORM ──
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={cancelCreate}
          className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors h-11 min-w-[44px]"
          aria-label="Back to policy list"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h2 className="text-lg font-bold text-ink">New Policy</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* ── Policy Holder ── */}
        <div className="card flex flex-col gap-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Policy Holder</p>
          <FieldGroup label="Owner Name" required id="ownerName">
            <input id="ownerName" name="ownerName" value={form.ownerName} onChange={handleChange}
              placeholder="Full name" className={inputCls} required />
          </FieldGroup>
          <FieldGroup label="Insured Name" required id="insuredName">
            <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
              <input type="checkbox" checked={sameAsOwner} onChange={(e) => handleSameAsOwner(e.target.checked)}
                className="w-4 h-4 rounded accent-primary" />
              Same as owner
            </label>
            <input id="insuredName" name="insuredName" value={form.insuredName} onChange={handleChange}
              placeholder="Full name" className={inputCls} disabled={sameAsOwner} required />
          </FieldGroup>
          <FieldGroup label="Policy Number" id="policyNumber">
            <input id="policyNumber" name="policyNumber" value={form.policyNumber} onChange={handleChange}
              placeholder="Optional — leave blank if not yet issued" className={inputCls} />
          </FieldGroup>
        </div>

        {/* ── Product ── */}
        <div className="card flex flex-col gap-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Product</p>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Product Line" required id="productLine">
              <select id="productLine" name="productLine" value={form.productLine} onChange={handleChange} className={selectCls}>
                {PRODUCT_LINES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Policy Class" required id="policyClass">
              <select id="policyClass" name="policyClass" value={form.policyClass} onChange={handleChange} className={selectCls}>
                {POLICY_CLASSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FieldGroup>
          </div>
          <FieldGroup label="Business Type" required id="newBusinessType">
            <select id="newBusinessType" name="newBusinessType" value={form.newBusinessType} onChange={handleChange} className={selectCls}>
              {BIZ_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Plan Name" id="planName">
            <input id="planName" name="planName" value={form.planName} onChange={handleChange}
              placeholder="Optional" className={inputCls} />
          </FieldGroup>
        </div>

        {/* ── Production ── */}
        <div className="card flex flex-col gap-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Production</p>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Premium (TTD)" required id="proposedPremium">
              <input id="proposedPremium" name="proposedPremium" type="number" step="0.01" min="0.01"
                value={form.proposedPremium} onChange={handleChange}
                placeholder="0.00" className={inputCls} required />
            </FieldGroup>
            <FieldGroup label="Frequency" required id="proposedFrequency">
              <select id="proposedFrequency" name="proposedFrequency" value={form.proposedFrequency} onChange={handleChange} className={selectCls}>
                {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </FieldGroup>
          </div>
          <FieldGroup label="Proposed API (TTD)" required id="proposedAPI">
            <input id="proposedAPI" name="proposedAPI" type="number" step="0.01" min="0.01"
              value={form.proposedAPI} onChange={handleChange}
              placeholder="Auto-computed from premium × frequency" className={inputCls} required />
          </FieldGroup>
          <FieldGroup label="Coverage Amount (TTD)" id="proposedCoverage">
            <input id="proposedCoverage" name="proposedCoverage" type="number" step="0.01" min="0"
              value={form.proposedCoverage} onChange={handleChange}
              placeholder="Optional" className={inputCls} />
          </FieldGroup>
          {form.newBusinessType === 'replacement' && (
            <FieldGroup label="Replaced Policy API (TTD)" required id="replacedPolicyAPI">
              <input id="replacedPolicyAPI" name="replacedPolicyAPI" type="number" step="0.01" min="0"
                value={form.replacedPolicyAPI} onChange={handleChange}
                placeholder="0.00" className={inputCls} required />
            </FieldGroup>
          )}
        </div>

        {/* ── Dates ── */}
        <div className="card flex flex-col gap-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Dates</p>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Date Written" required id="dateWritten">
              <input id="dateWritten" name="dateWritten" type="date" max={today}
                value={form.dateWritten} onChange={handleChange}
                className={inputCls} required />
            </FieldGroup>
            <FieldGroup label="Date Submitted" required id="dateSubmitted">
              <input id="dateSubmitted" name="dateSubmitted" type="date" min={form.dateWritten} max={today}
                value={form.dateSubmitted} onChange={handleChange}
                className={inputCls} required />
            </FieldGroup>
          </div>
        </div>

        {/* ── Additional ── */}
        <div className="card flex flex-col gap-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Additional</p>
          <FieldGroup label="Source of Prospect" required id="sourceOfProspect">
            <select id="sourceOfProspect" name="sourceOfProspect" value={form.sourceOfProspect} onChange={handleChange}
              className={selectCls} required>
              <option value="">Select source…</option>
              {PROSPECTING_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </FieldGroup>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer min-h-[44px]">
              <input type="checkbox" checked={form.cashWithApp.collected}
                onChange={(e) => handleCashCollected(e.target.checked)}
                className="w-4 h-4 rounded accent-primary" />
              Cash with Application
            </label>
            {form.cashWithApp.collected && (
              <FieldGroup label="Cash Amount (TTD)" required id="cashAmount">
                <input id="cashAmount" type="number" step="0.01" min="0"
                  value={form.cashWithApp.amount} onChange={handleCashAmount}
                  placeholder="0.00" className={inputCls} required />
              </FieldGroup>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer min-h-[44px]">
            <input type="checkbox" name="isSelfOrFamily" checked={form.isSelfOrFamily} onChange={handleChange}
              className="w-4 h-4 rounded accent-primary" />
            Self / Family policy (excluded from awards)
          </label>

          <FieldGroup label="Notes" id="notes">
            <textarea id="notes" name="notes" value={form.notes} onChange={handleChange}
              placeholder="Optional notes…" rows={3}
              className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-ink w-full focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </FieldGroup>
        </div>

        {saveError && (
          <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle size={16} /> {saveError}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={cancelCreate}
            className="flex-1 h-11 rounded-lg border border-border text-sm font-semibold text-ink-muted hover:bg-surface/70 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 h-11 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save Policy'}
          </button>
        </div>
      </form>
    </div>
  );
}

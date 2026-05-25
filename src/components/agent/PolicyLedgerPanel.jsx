import React, { useState, useEffect } from 'react';
import { Plus, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { PROSPECTING_SOURCES, PROSPECTING_SOURCE_LABELS } from '../../services/prospectInfoService';
import { createPolicy, getOwnPolicies } from '../../services/policiesService';

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

function FieldGroup({ label, children, required }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
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

        {!loading && policies.map((p) => (
          <div key={p.id} className="card flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm text-ink">{p.ownerName}</p>
                {p.insuredName !== p.ownerName && (
                  <p className="text-xs text-ink-muted">Insured: {p.insuredName}</p>
                )}
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold shrink-0 capitalize">
                {p.status}
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
          </div>
        ))}
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
          <FieldGroup label="Owner Name" required>
            <input name="ownerName" value={form.ownerName} onChange={handleChange}
              placeholder="Full name" className={inputCls} required />
          </FieldGroup>
          <FieldGroup label="Insured Name" required>
            <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
              <input type="checkbox" checked={sameAsOwner} onChange={(e) => handleSameAsOwner(e.target.checked)}
                className="w-4 h-4 rounded accent-primary" />
              Same as owner
            </label>
            <input name="insuredName" value={form.insuredName} onChange={handleChange}
              placeholder="Full name" className={inputCls} disabled={sameAsOwner} required />
          </FieldGroup>
          <FieldGroup label="Policy Number">
            <input name="policyNumber" value={form.policyNumber} onChange={handleChange}
              placeholder="Optional — leave blank if not yet issued" className={inputCls} />
          </FieldGroup>
        </div>

        {/* ── Product ── */}
        <div className="card flex flex-col gap-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Product</p>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Product Line" required>
              <select name="productLine" value={form.productLine} onChange={handleChange} className={selectCls}>
                {PRODUCT_LINES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Policy Class" required>
              <select name="policyClass" value={form.policyClass} onChange={handleChange} className={selectCls}>
                {POLICY_CLASSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FieldGroup>
          </div>
          <FieldGroup label="Business Type" required>
            <select name="newBusinessType" value={form.newBusinessType} onChange={handleChange} className={selectCls}>
              {BIZ_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Plan Name">
            <input name="planName" value={form.planName} onChange={handleChange}
              placeholder="Optional" className={inputCls} />
          </FieldGroup>
        </div>

        {/* ── Production ── */}
        <div className="card flex flex-col gap-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Production</p>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Premium (TTD)" required>
              <input name="proposedPremium" type="number" step="0.01" min="0.01"
                value={form.proposedPremium} onChange={handleChange}
                placeholder="0.00" className={inputCls} required />
            </FieldGroup>
            <FieldGroup label="Frequency" required>
              <select name="proposedFrequency" value={form.proposedFrequency} onChange={handleChange} className={selectCls}>
                {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </FieldGroup>
          </div>
          <FieldGroup label="Proposed API (TTD)" required>
            <input name="proposedAPI" type="number" step="0.01" min="0.01"
              value={form.proposedAPI} onChange={handleChange}
              placeholder="Auto-computed from premium × frequency" className={inputCls} required />
          </FieldGroup>
          <FieldGroup label="Coverage Amount (TTD)">
            <input name="proposedCoverage" type="number" step="0.01" min="0"
              value={form.proposedCoverage} onChange={handleChange}
              placeholder="Optional" className={inputCls} />
          </FieldGroup>
          {form.newBusinessType === 'replacement' && (
            <FieldGroup label="Replaced Policy API (TTD)" required>
              <input name="replacedPolicyAPI" type="number" step="0.01" min="0"
                value={form.replacedPolicyAPI} onChange={handleChange}
                placeholder="0.00" className={inputCls} required />
            </FieldGroup>
          )}
        </div>

        {/* ── Dates ── */}
        <div className="card flex flex-col gap-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Dates</p>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Date Written" required>
              <input name="dateWritten" type="date" max={today}
                value={form.dateWritten} onChange={handleChange}
                className={inputCls} required />
            </FieldGroup>
            <FieldGroup label="Date Submitted" required>
              <input name="dateSubmitted" type="date" min={form.dateWritten} max={today}
                value={form.dateSubmitted} onChange={handleChange}
                className={inputCls} required />
            </FieldGroup>
          </div>
        </div>

        {/* ── Additional ── */}
        <div className="card flex flex-col gap-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Additional</p>
          <FieldGroup label="Source of Prospect" required>
            <select name="sourceOfProspect" value={form.sourceOfProspect} onChange={handleChange}
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
              <FieldGroup label="Cash Amount (TTD)" required>
                <input type="number" step="0.01" min="0"
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

          <FieldGroup label="Notes">
            <textarea name="notes" value={form.notes} onChange={handleChange}
              placeholder="Optional notes…" rows={3}
              className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-ink w-full focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </FieldGroup>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
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

import React, { useState, useEffect } from 'react';
import { Plus, Loader2, AlertCircle, ArrowLeft, Info, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PROSPECTING_SOURCES } from '../../services/prospectInfoService';
import { SOCIAL_PLATFORMS_ATTRIBUTION } from '../../utils/prospectingConstants';
import { createPolicy, getOwnPolicies, transitionPolicyStatus } from '../../services/policiesService';
import { getPolicyPlans } from '../../services/planCatalogService';
import { getTodayTT } from '../../utils/dateInputs';
import { applyLedgerFilter, filterCounts, LEDGER_FILTERS } from '../../lib/policyLedgerDerivation';
import PipelineStrip from './policyLedger/PipelineStrip';
import PolicyCard from './policyLedger/PolicyCard';
import PolicyDrillDrawer from './policyLedger/PolicyDrillDrawer';

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

// EMPTY_FORM carries no date defaults — dates are filled dynamically at
// component-init and on form-reset via getTodayTT() so overnight sessions
// never show a stale "today" from the initial module load.
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
  dateWritten: '',
  dateSubmitted: '',
  notes: '',
  isSelfOrFamily: false,
  replacedPolicyAPI: '',
  sourceOfProspect: '',
  socialPlatform: null,
  cashWithApp: { collected: false, amount: '' },
};

function FieldGroup({ label, children, required, id }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
        {label}{required && <span className="text-danger-ink ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'h-11 px-3 rounded-lg bg-surface border border-border text-sm text-ink w-full focus:outline-none focus:ring-2 focus:ring-primary/40';
const selectCls = 'h-11 px-3 rounded-lg bg-surface border border-border text-sm text-ink w-full focus:outline-none focus:ring-2 focus:ring-primary/40';

export default function PolicyLedgerPanel({ initialForm, onPrefillConsumed, initialFilter }) {
  const { user, userProfile, tenantId } = useAuth();
  // Computed fresh per render so overnight-open sessions always show the real today.
  const today = getTodayTT();

  const [view, setView] = useState(initialForm ? 'create' : 'list');
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(
    initialForm
      ? { ...EMPTY_FORM, dateWritten: getTodayTT(), dateSubmitted: getTodayTT(), ...initialForm }
      : { ...EMPTY_FORM, dateWritten: getTodayTT(), dateSubmitted: getTodayTT() },
  );
  const [sameAsOwner, setSameAsOwner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Plan catalog
  const [catalogPlans, setCatalogPlans] = useState([]);
  const [planPickerMode, setPlanPickerMode] = useState(
    initialForm?.planId ? 'catalog' : (initialForm?.planName ? 'other' : 'catalog')
  );

  // ── Tier 2 filter / search ──
  const [filter, setFilter] = useState(initialFilter ?? 'all');
  const [search, setSearch] = useState('');

  // ── Tier 3 drawer ──
  const [drawerPolicy, setDrawerPolicy] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState(null);

  useEffect(() => {
    if (!tenantId || !user?.uid) return;
    setLoading(true);
    Promise.all([
      getOwnPolicies(tenantId, user.uid),
      getPolicyPlans(tenantId),
    ])
      .then(([pols, catalog]) => {
        setPolicies(pols);
        setCatalogPlans((catalog.plans ?? []).filter((p) => p.isActive));
        setLoadError(null);
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [tenantId, user?.uid]);

  useEffect(() => {
    if (initialForm) onPrefillConsumed?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (name === 'sourceOfProspect' && value !== 'social-media') {
        next.socialPlatform = null;
      }
      if (sameAsOwner && name === 'ownerName') next.insuredName = value;
      return next;
    });
  }

  function handlePlanSelect(e) {
    const val = e.target.value;
    if (val === '__other__') {
      setPlanPickerMode('other');
      setForm((f) => ({ ...f, planId: null, planName: '' }));
    } else if (val === '') {
      setPlanPickerMode('catalog');
      setForm((f) => ({ ...f, planId: null, planName: '' }));
    } else {
      const plan = catalogPlans.find((p) => p.id === val);
      if (!plan) return;
      setPlanPickerMode('catalog');
      setForm((f) => ({ ...f, planId: plan.id, planName: plan.name, policyClass: plan.class }));
    }
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
      setForm({ ...EMPTY_FORM, dateWritten: today, dateSubmitted: today });
      setSameAsOwner(false);
      setView('list');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openDrawer(policy) {
    setTransitionError(null);
    setDrawerPolicy(policy);
  }

  function closeDrawer() {
    setDrawerPolicy(null);
    setTransitionError(null);
  }

  async function handleTransition(toStatus, fields) {
    if (!drawerPolicy) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      const agentRef = { uid: user.uid, ...userProfile };
      await transitionPolicyStatus(tenantId, agentRef, drawerPolicy.id, drawerPolicy.status, toStatus, fields);
      const fresh = await getOwnPolicies(tenantId, user.uid);
      setPolicies(fresh);
      closeDrawer();
    } catch (err) {
      setTransitionError(err.message);
    } finally {
      setTransitioning(false);
    }
  }

  function openCreate() {
    const merged = { ...EMPTY_FORM, dateWritten: today, dateSubmitted: today, ...(initialForm ?? {}) };
    setForm(merged);
    setSameAsOwner(false);
    setSaveError(null);
    onPrefillConsumed?.();
    setPlanPickerMode(
      merged.planId ? 'catalog' : (merged.planName ? 'other' : 'catalog')
    );
    setView('create');
  }

  function cancelCreate() {
    setSaveError(null);
    setView('list');
  }

  // ── LIST VIEW (v2 — three tiers + drill drawer) ──
  if (view === 'list') {
    const counts = filterCounts(policies);
    const visible = applyLedgerFilter(policies, { filter, search });

    return (
      <div className="flex flex-col gap-4" data-testid="policy-ledger-surface">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Policy Ledger</h2>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-11 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors min-w-[44px]"
          >
            <Plus size={16} /> New Policy
          </button>
        </div>

        {loading && (
          <div className="space-y-3" data-testid="ledger-loading">
            <div className="h-32 rounded-2xl bg-border/40 animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-border/40 animate-pulse" />
            ))}
          </div>
        )}

        {loadError && (
          <div className="card text-center py-12 flex flex-col items-center gap-3" data-testid="ledger-error">
            <div className="w-11 h-11 rounded-xl bg-danger-tint text-danger-ink flex items-center justify-center">
              <AlertCircle size={20} />
            </div>
            <p className="font-display font-extrabold text-[15px] text-ink">Couldn’t load your ledger</p>
            <p className="text-xs text-ink-muted">{loadError}</p>
          </div>
        )}

        {!loading && !loadError && policies.length === 0 && (
          <div className="card text-center py-12 flex flex-col items-center gap-2.5" data-testid="ledger-empty">
            <div className="w-11 h-11 rounded-xl bg-primary-tint text-primary flex items-center justify-center text-xl">＋</div>
            <p className="font-display font-extrabold text-[15px] text-ink">No policies yet</p>
            <p className="text-xs text-ink-muted">Your written business will show here as a live pipeline.</p>
            <button
              onClick={openCreate}
              className="mt-1 h-11 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Log a policy
            </button>
          </div>
        )}

        {!loading && !loadError && policies.length > 0 && (
          <>
            {/* Tier 1 */}
            <PipelineStrip policies={policies} />

            {/* Tier 2 — filter chips + search */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 p-1 bg-surface-muted border border-border rounded-[10px]" role="tablist" aria-label="Filter policies">
                {LEDGER_FILTERS.map((f) => {
                  const on = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      role="tab"
                      aria-selected={on}
                      onClick={() => setFilter(f.key)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                        on ? 'bg-card text-ink border border-border shadow-sm' : 'text-ink-muted hover:text-ink'
                      }`}
                      data-testid={`ledger-filter-${f.key}`}
                    >
                      {f.label}
                      <span className={`font-mono text-[10px] px-1.5 rounded-full ${on ? 'bg-primary-tint text-primary' : 'text-ink-muted'}`}>{counts[f.key]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2 px-3 h-11 bg-card border border-border rounded-lg w-full sm:w-56">
                <Search size={15} className="text-ink-muted shrink-0" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search owner, plan…"
                  className="bg-transparent text-[12.5px] text-ink w-full focus:outline-none"
                  aria-label="Search policies"
                  data-testid="ledger-search"
                />
              </div>
            </div>

            {/* Tier 3 — feed */}
            <div className="flex flex-col gap-2.5" data-testid="ledger-feed">
              {visible.length === 0 ? (
                <div className="card text-center py-8">
                  <p className="text-sm text-ink-muted">No policies match this filter.</p>
                </div>
              ) : (
                visible.map((p) => <PolicyCard key={p.id} policy={p} onOpen={openDrawer} />)
              )}
            </div>

            {policies.some((p) => p.productLine && p.productLine !== 'life') && (
              <p className="flex items-center gap-1 text-xs text-ink-muted">
                <Info size={11} className="shrink-0" />
                Non-Life policies do not count toward Tatil Life awards or persistency.
              </p>
            )}
          </>
        )}

        {drawerPolicy && (
          <PolicyDrillDrawer
            policy={drawerPolicy}
            onClose={closeDrawer}
            onTransition={handleTransition}
            transitioning={transitioning}
            transitionError={transitionError}
          />
        )}
      </div>
    );
  }

  // ── CREATE FORM (reused unchanged) ──
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
              {form.productLine !== 'life' && (
                <p className="flex items-center gap-1 text-xs text-ink-muted mt-1">
                  <Info size={11} className="shrink-0" />
                  Does not count toward Tatil Life awards or persistency
                </p>
              )}
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
          <FieldGroup label="Plan Name" id="planPicker">
            <select
              id="planPicker"
              value={form.planId ?? (planPickerMode === 'other' ? '__other__' : '')}
              onChange={handlePlanSelect}
              className={selectCls}
              data-testid="plan-picker-select"
            >
              <option value="">Select plan…</option>
              {catalogPlans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="__other__">Other (enter manually)</option>
            </select>
            {planPickerMode === 'other' && (
              <input
                id="planName"
                name="planName"
                value={form.planName}
                onChange={handleChange}
                placeholder="Enter plan name"
                className={`${inputCls} mt-2`}
                data-testid="plan-name-freetext"
              />
            )}
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

          {form.sourceOfProspect === 'social-media' && (
            <FieldGroup label="Platform" required id="socialPlatform">
              <select id="socialPlatform" name="socialPlatform" value={form.socialPlatform ?? ''} onChange={handleChange}
                className={selectCls} required>
                <option value="">Select platform…</option>
                {SOCIAL_PLATFORMS_ATTRIBUTION.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </FieldGroup>
          )}

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
          <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-danger-tint text-danger-ink text-sm">
            <AlertCircle size={16} /> {saveError}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={cancelCreate}
            className="flex-1 h-11 rounded-lg border border-border text-sm font-semibold text-ink-muted hover:bg-surface/70 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving || (form.sourceOfProspect === 'social-media' && !form.socialPlatform)}
            className="flex-1 h-11 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save Policy'}
          </button>
        </div>
      </form>
    </div>
  );
}

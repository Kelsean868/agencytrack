import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Upload, Loader2, AlertCircle, ArrowLeft, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PROSPECTING_SOURCES } from '../../services/prospectInfoService';
import { SOCIAL_PLATFORMS_ATTRIBUTION } from '../../utils/prospectingConstants';
import { createPolicy, getOwnPolicies, transitionPolicyStatus, selfConfirmPolicy, declareReinstatement, withdrawReinstatement } from '../../services/policiesService';
import { canDeclareReinstatement } from '../../lib/persistency/reinstatementDeclaration';
import { getPolicyPlans } from '../../services/planCatalogService';
import { getTodayTT } from '../../utils/dateInputs';
import { applyLedgerFilter, LEDGER_FILTERS } from '../../lib/policyLedgerDerivation';
import PolicyDrillDrawer from './policyLedger/PolicyDrillDrawer';
import AwardLensPanel from './policyLedger/AwardLensPanel';
import LedgerPageHeader from './policyLedger/LedgerPageHeader';
import { ledgerExportDate } from '../../lib/policyCampaignLens';
import { DEFAULT_RULESET_2026 } from '../../config/awardsRuleset/2026';
import ImportPortfolioModal from './policyLedger/portfolioImport/ImportPortfolioModal';

// Roles allowed to import an OIPA portfolio export into their own ledger.
const IMPORT_PORTFOLIO_ROLES = new Set(['agent', 'unit_manager', 'branch_manager']);

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
  { value: 'whole_life',        label: 'Whole Life' },
  { value: 'term',              label: 'Term' },
  { value: 'universal_life',    label: 'Universal Life' },
  { value: 'endowment',         label: 'Endowment' },
  { value: 'annuity',           label: 'Annuity' },
  // Added with the OIPA portfolio import (CIB = LifeSpan Gold). NOTE: this array
  // is duplicated verbatim in the other of PolicyLedgerPanel.jsx /
  // PlanCatalogModal.jsx, and `VALID_POLICY_CLASSES` in policiesService.js is a
  // third copy of the same enum. Adding a class means editing all three.
  { value: 'critical_illness',  label: 'Critical Illness' },
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
  // No dateSubmitted: a policy is created at `written` (D1) and the submitted
  // date is collected on the written → submitted transition, in the drawer.
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

// `onPoliciesChanged` fires after every write this panel makes (create, status
// transition, portfolio import) so a parent holding its own copy of the list —
// the dashboard's production hero — can refetch instead of showing stale figures.
//
// `persistency` (optional) is the agent's persistency records, as the dashboard
// already holds them for the Awards tab and Home; with them the campaign card
// shows its persistency ring. Omitted (e.g. a manager's own ledger) → no ring.
export default function PolicyLedgerPanel({ initialForm, onPrefillConsumed, initialFilter, onPoliciesChanged, ruleset = DEFAULT_RULESET_2026, persistency = null }) {
  const { user, userProfile, tenantId, role } = useAuth();
  // Computed fresh per render so overnight-open sessions always show the real today.
  const today = getTodayTT();

  const [view, setView] = useState(initialForm ? 'create' : 'list');
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(
    initialForm
      ? { ...EMPTY_FORM, dateWritten: getTodayTT(), ...initialForm }
      : { ...EMPTY_FORM, dateWritten: getTodayTT() },
  );
  const [sameAsOwner, setSameAsOwner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Plan catalog
  const [catalogPlans, setCatalogPlans] = useState([]);
  const [planPickerMode, setPlanPickerMode] = useState(
    initialForm?.planId ? 'catalog' : (initialForm?.planName ? 'other' : 'catalog')
  );

  // ── Search + hand-off filter ──
  // `initialFilter` is a hand-off from another screen (Home "Do next" →
  // 'action', the Persistency tab → 'lapsed'). The old tab strip that showed
  // it is gone (LX); it now shows as a removable chip in the active-filter row.
  const [handoffFilter, setHandoffFilter] = useState(
    initialFilter && initialFilter !== 'all' ? initialFilter : null,
  );
  const [search, setSearch] = useState('');

  // ── Tier 3 drawer ──
  const [drawerPolicy, setDrawerPolicy] = useState(null);
  // L3 — this policy's `awardWindowsForPolicy` rows, handed in by whichever
  // view opened the drawer (AwardLensPanel's `openWithWindows`), so the
  // drawer's "Counts toward" chips match the card/table it was opened from.
  const [drawerAwardWindows, setDrawerAwardWindows] = useState([]);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState(null);
  // FR-6 — Mark reinstated / Withdraw on an own lapsed policy (Arm G).
  const [reinstating, setReinstating] = useState(false);
  const [reinstateError, setReinstateError] = useState(null);

  // ── Portfolio import (P4c) ──
  const [importModalOpen, setImportModalOpen] = useState(false);

  // The head-office list the ledger is standing on (C-D11) — read off the
  // policy docs, never configured, so the header can't claim a date the data
  // doesn't carry.
  const exportDate = useMemo(() => ledgerExportDate(policies), [policies]);

  const loadLedger = useCallback(() => {
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

  useEffect(() => { loadLedger(); }, [loadLedger]);

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
      onPoliciesChanged?.();
      const fresh = await getOwnPolicies(tenantId, user.uid);
      setPolicies(fresh);
      setForm({ ...EMPTY_FORM, dateWritten: today });
      setSameAsOwner(false);
      setView('list');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openDrawer(policy, awardWindows = []) {
    setTransitionError(null);
    setReinstateError(null);
    setDrawerPolicy(policy);
    setDrawerAwardWindows(awardWindows);
  }

  function closeDrawer() {
    setDrawerPolicy(null);
    setDrawerAwardWindows([]);
    setTransitionError(null);
    setReinstateError(null);
  }

  async function handleTransition(toStatus, fields) {
    if (!drawerPolicy) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      const agentRef = { uid: user.uid, ...userProfile };
      await transitionPolicyStatus(tenantId, agentRef, drawerPolicy.id, drawerPolicy.status, toStatus, fields);
      onPoliciesChanged?.();
      const fresh = await getOwnPolicies(tenantId, user.uid);
      setPolicies(fresh);
      closeDrawer();
    } catch (err) {
      setTransitionError(err.message);
    } finally {
      setTransitioning(false);
    }
  }

  // P2d — the agent confirms their own settled policy's details (Arm F).
  async function handleSelfConfirm(fields) {
    if (!drawerPolicy) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      const agentRef = { uid: user.uid, ...userProfile };
      await selfConfirmPolicy(tenantId, agentRef, drawerPolicy.id, drawerPolicy, fields);
      onPoliciesChanged?.();
      const fresh = await getOwnPolicies(tenantId, user.uid);
      setPolicies(fresh);
      closeDrawer();
    } catch (err) {
      setTransitionError(err.message);
    } finally {
      setTransitioning(false);
    }
  }

  // FR-6 (Option A) — the agent declares / withdraws a reinstatement on an OWN
  // LAPSED policy (firestore.rules Arm G). The drawer stays open on the fresh
  // doc so the agent sees the declaration land.
  const declarer = { uid: user?.uid, ...userProfile, role: role ?? userProfile?.role };
  const canReinstate = Boolean(drawerPolicy) && canDeclareReinstatement(drawerPolicy, declarer);

  async function runReinstate(write) {
    if (!drawerPolicy) return;
    const id = drawerPolicy.id;
    setReinstating(true);
    setReinstateError(null);
    try {
      await write(drawerPolicy);
      onPoliciesChanged?.();
      const fresh = await getOwnPolicies(tenantId, user.uid);
      setPolicies(fresh);
      setDrawerPolicy(fresh.find((p) => p.id === id) ?? null);
    } catch (err) {
      setReinstateError(err.message);
    } finally {
      setReinstating(false);
    }
  }

  function handleDeclareReinstatement(note) {
    return runReinstate((p) => declareReinstatement(tenantId, declarer, p.id, p, { note }));
  }

  function handleWithdrawReinstatement() {
    return runReinstate((p) => withdrawReinstatement(tenantId, declarer, p.id, p));
  }

  function openCreate() {
    const merged = { ...EMPTY_FORM, dateWritten: today, ...(initialForm ?? {}) };
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

  // ── LIST VIEW (LX — page layout matches mockups D1 / D3) ──
  if (view === 'list') {
    // One narrowing for the list: the search (header on desktop, search row
    // on mobile — both bound to `search`) plus any hand-off filter another
    // screen opened the ledger with. The award totals never narrow.
    const visible = applyLedgerFilter(policies, { filter: handoffFilter ?? 'all', search });
    const visibleIds = new Set(visible.map((p) => p.id));
    const hasList = !loading && !loadError && policies.length > 0;
    const handoffLabel = handoffFilter ? LEDGER_FILTERS.find((f) => f.key === handoffFilter)?.label : null;
    const handoffChip = handoffLabel ? { label: handoffLabel, onRemove: () => setHandoffFilter(null) } : null;

    const pageActions = (
      <>
        {IMPORT_PORTFOLIO_ROLES.has(role) && (
          <button
            onClick={() => setImportModalOpen(true)}
            aria-label="Import portfolio"
            className="flex h-11 min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-full text-ink transition-colors hover:bg-surface-muted lg:rounded-xl lg:border lg:border-border lg:px-4 lg:text-sm lg:font-semibold"
            data-testid="import-portfolio-button"
          >
            <Upload size={18} aria-hidden="true" />
            <span className="hidden lg:inline" aria-hidden="true">Import portfolio</span>
          </button>
        )}
        <button
          onClick={openCreate}
          aria-label="New Policy"
          className="flex h-11 min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-full text-ink transition-colors hover:bg-surface-muted lg:rounded-xl lg:border lg:border-border lg:px-4 lg:text-sm lg:font-semibold"
          data-testid="ledger-new-policy"
        >
          <Plus size={18} aria-hidden="true" />
          <span className="hidden lg:inline" aria-hidden="true">New Policy</span>
        </button>
      </>
    );

    const renderHeader = (exportMenu) => (
      <LedgerPageHeader
        exportDate={exportDate}
        search={search}
        onSearchChange={setSearch}
        showSearch={hasList}
        exportMenu={exportMenu}
        actions={pageActions}
      />
    );

    // §2 staggered-assemble — the drill drawer is a fixed-position overlay
    // rendered outside the `.stagger` container (same pattern as GamePlanV2's
    // modalsBlock split): it only opens on click, well after the one-shot
    // mount-time stagger animation has finished.
    return (
      <>
      <div className="flex flex-col gap-4 stagger" data-testid="policy-ledger-surface">
        {/* 1 — the header shows in every state; with a list it is rendered by
            AwardLensPanel so its Export gets the filtered rows (one source). */}
        {!hasList && renderHeader(null)}

        {loading && (
          <div className="space-y-3" data-testid="ledger-loading">
            <div className="h-32 rounded-2xl bg-border/40 animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-border/40 animate-pulse" />
            ))}
          </div>
        )}

        {loadError && (
          <div role="alert" className="card text-center py-12 flex flex-col items-center gap-3" data-testid="ledger-error">
            <div className="w-11 h-11 rounded-xl bg-danger-tint text-danger-ink flex items-center justify-center">
              <AlertCircle size={20} />
            </div>
            <p className="font-display font-extrabold text-[15px] text-ink">Couldn’t load your ledger</p>
            <p className="text-xs text-ink-muted">{loadError}</p>
            <button
              type="button"
              onClick={loadLedger}
              className="mt-1 inline-flex items-center gap-1.5 h-11 px-4 rounded-lg border border-border text-sm font-semibold text-ink hover:bg-surface-muted transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && policies.length === 0 && (
          <div className="card text-center py-12 flex flex-col items-center gap-2.5" data-testid="ledger-empty">
            <div className="w-11 h-11 rounded-xl bg-primary-tint text-primary flex items-center justify-center text-xl">＋</div>
            <p className="font-display font-extrabold text-[15px] text-ink">No policies yet</p>
            <p className="text-xs text-ink-muted">Your written business will show here as a live pipeline.</p>
            <button
              onClick={openCreate}
              className="mt-1 h-11 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors"
            >
              Log a policy
            </button>
          </div>
        )}

        {hasList && (
          <>
            {/* 2–7 — view chips, "Counts toward", award card, mobile search
                row, active chips, list (docs/briefs/ledger-layout-and-l3.md
                § LX). The old PipelineStrip hero and the LEDGER_FILTERS tab
                strip are no longer rendered here: the award card carries the
                figures, the L2 Status filter carries the status narrowing.

                ELIGIBILITY IS DECIDED BY DATE, NOT BY ORIGIN (C-D10, R5). The
                RAW policy array is passed — never `excludeImported(policies)`:
                on 20 Sep 2026 the tenant held 229 policy docs, ALL imported, so
                an origin filter hid 100% of the operator's production (TTD 0
                against a real 3 apps / TTD 73,946.28). The engines apply the
                date test instead. */}
            <AwardLensPanel
              policies={policies}
              visibleIds={visibleIds}
              onOpen={openDrawer}
              ruleset={ruleset}
              renderHeader={renderHeader}
              search={search}
              onSearchChange={setSearch}
              handoffChip={handoffChip}
              persistencyRecords={persistency}
            />

            {policies.some((p) => p.productLine && p.productLine !== 'life') && (
              <p className="flex items-center gap-1 text-xs text-ink-muted">
                <Info size={11} className="shrink-0" />
                Non-Life policies do not count toward Tatil Life awards or persistency.
              </p>
            )}
          </>
        )}
      </div>

        {/* Drill drawer — outside `.stagger` (fixed-position overlay; see note above) */}
        {drawerPolicy && (
          <PolicyDrillDrawer
            policy={drawerPolicy}
            awardWindows={drawerAwardWindows}
            onClose={closeDrawer}
            onTransition={handleTransition}
            transitioning={transitioning}
            transitionError={transitionError}
            onSelfConfirm={handleSelfConfirm}
            selfConfirming={transitioning}
            selfConfirmError={transitionError}
            onDeclareReinstatement={canReinstate ? handleDeclareReinstatement : null}
            onWithdrawReinstatement={canReinstate ? handleWithdrawReinstatement : null}
            reinstating={reinstating}
            reinstateError={reinstateError}
          />
        )}

        {/* Portfolio import modal — same reason as the drill drawer above */}
        {importModalOpen && (
          <ImportPortfolioModal
            onClose={() => setImportModalOpen(false)}
            onImported={() => { onPoliciesChanged?.(); loadLedger(); }}
          />
        )}
      </>
    );
  }

  // ── CREATE FORM (reused unchanged) ──
  return (
    <div className="flex flex-col gap-6 stagger">
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
                aria-describedby="replacedPolicyAPI-help"
                placeholder="0.00" className={inputCls} required />
              {/* A replacement earns the DIFFERENCE in API and no application
                  count at all (Rule 4). Without this figure the campaign lens
                  has to abstain, so it is collected at the point of sale where
                  it is actually known. Enter 0 if nothing was in force. */}
              <p id="replacedPolicyAPI-help" className="text-[11px] text-ink-muted">
                Campaign credit for a replacement is the difference between this
                and the new API. Enter 0 if no policy was in force.
              </p>
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
          </div>
          <p className="text-xs text-ink-muted">
            The application opens as <strong>Written</strong>. Record the date it was
            submitted to head office when you move it to Submitted.
          </p>
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
            className="flex-1 h-11 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save Policy'}
          </button>
        </div>
      </form>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Pencil, Trash2, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import PanelSkeleton from '../ui/PanelSkeleton';
import useFocusTrap from '../../hooks/useFocusTrap';
import {
  getPolicyPlans,
  addPlan,
  updatePlan,
  deactivatePlan,
  promotePendingPlan,
  dismissPendingPlan,
} from '../../services/planCatalogService';

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

const PRODUCT_LINES = [
  { value: 'life',     label: 'Life' },
  { value: 'ah',       label: 'A&H' },
  { value: 'property', label: 'Property' },
  { value: 'motor',    label: 'Motor' },
];

const TABS = ['Active Plans', 'Pending Review'];

const inputCls  = 'h-11 px-3 rounded-lg bg-surface border border-border text-sm text-ink w-full focus:outline-none focus:ring-2 focus:ring-primary/40';
const selectCls = 'h-11 px-3 rounded-lg bg-surface border border-border text-sm text-ink w-full focus:outline-none focus:ring-2 focus:ring-primary/40';

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

const EMPTY_PLAN_FORM = { name: '', class: 'whole_life', productLine: 'life' };
const EMPTY_PROMOTE_FORM = { class: 'whole_life', productLine: 'life' };

export default function PlanCatalogModal({ tenantId, onClose }) {
  const modalRef = useFocusTrap({ onEscape: onClose });
  const [tab, setTab] = useState(0);

  const [plans, setPlans]               = useState([]);
  const [pendingReview, setPendingReview] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(null);

  // Add / Edit form state
  const [editingId, setEditingId]       = useState(null);  // null = add, plan.id = edit
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm]         = useState(EMPTY_PLAN_FORM);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState(null);

  // Promote form state
  const [promotingName, setPromotingName]   = useState(null);
  const [promoteForm, setPromoteForm]       = useState(EMPTY_PROMOTE_FORM);
  const [promoting, setPromoting]           = useState(false);
  const [promoteError, setPromoteError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getPolicyPlans(tenantId);
      setPlans(data.plans ?? []);
      setPendingReview(data.pendingReview ?? []);
    } catch (err) {
      setLoadError(err?.message ?? 'Failed to load plan catalog.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // ── Plan form handlers ────────────────────────────────────────────────────

  function openAddForm() {
    setEditingId(null);
    setPlanForm(EMPTY_PLAN_FORM);
    setSaveError(null);
    setShowPlanForm(true);
  }

  function openEditForm(plan) {
    setEditingId(plan.id);
    setPlanForm({ name: plan.name, class: plan.class, productLine: plan.productLine });
    setSaveError(null);
    setShowPlanForm(true);
  }

  function closePlanForm() {
    setShowPlanForm(false);
    setSaveError(null);
  }

  async function handlePlanSubmit(e) {
    e.preventDefault();
    if (!planForm.name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (editingId) {
        await updatePlan(tenantId, editingId, {
          name: planForm.name.trim(),
          class: planForm.class,
          productLine: planForm.productLine,
        });
      } else {
        await addPlan(tenantId, {
          name: planForm.name.trim(),
          class: planForm.class,
          productLine: planForm.productLine,
        });
      }
      closePlanForm();
      await load();
    } catch (err) {
      setSaveError(err?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(planId) {
    try {
      await deactivatePlan(tenantId, planId);
      await load();
    } catch (err) {
      setLoadError(err?.message ?? 'Deactivate failed.');
    }
  }

  // ── Promote / Dismiss handlers ────────────────────────────────────────────

  function openPromoteForm(name) {
    setPromotingName(name);
    setPromoteForm(EMPTY_PROMOTE_FORM);
    setPromoteError(null);
  }

  function closePromoteForm() {
    setPromotingName(null);
    setPromoteError(null);
  }

  async function handlePromoteSubmit(e) {
    e.preventDefault();
    setPromoting(true);
    setPromoteError(null);
    try {
      await promotePendingPlan(tenantId, promotingName, {
        policyClass: promoteForm.class,
        productLine: promoteForm.productLine,
      });
      closePromoteForm();
      await load();
    } catch (err) {
      setPromoteError(err?.message ?? 'Approve failed.');
    } finally {
      setPromoting(false);
    }
  }

  async function handleDismiss(name) {
    try {
      await dismissPendingPlan(tenantId, name);
      await load();
    } catch (err) {
      setLoadError(err?.message ?? 'Dismiss failed.');
    }
  }

  const activePlans = plans.filter((p) => p.isActive);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-catalog-heading"
    >
      <div className="bg-card rounded-2xl w-full max-w-xl flex flex-col shadow-lg max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0 shrink-0">
          <h2 id="plan-catalog-heading" className="font-bold text-lg text-ink">
            Policy Plan Catalog
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-ink-muted hover:bg-surface transition-colors min-w-[44px] min-h-[44px]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4 pb-0 border-b border-border shrink-0">
          {TABS.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(i)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                tab === i
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t}
              {i === 1 && pendingReview.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold">
                  {pendingReview.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {loadError && (
            <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm flex-wrap">
              <AlertCircle size={16} className="shrink-0" /> <span className="flex-1 min-w-[150px]">{loadError}</span>
              <button
                type="button"
                onClick={load}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {loading && (
            <PanelSkeleton variant="list" count={4} label="Loading plan catalog…" />
          )}

          {/* ── Active Plans tab ── */}
          {!loading && tab === 0 && (
            <>
              {activePlans.length === 0 ? (
                <p className="text-sm text-ink-muted text-center py-6" data-testid="no-active-plans">
                  No active plans. Click "Add Plan" to create your first catalog entry.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {activePlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-surface-raised"
                      data-testid={`plan-row-${plan.id}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-ink">{plan.name}</span>
                        <span className="text-xs text-ink-muted">
                          {POLICY_CLASSES.find((c) => c.value === plan.class)?.label ?? plan.class}
                          {' · '}
                          {PRODUCT_LINES.find((l) => l.value === plan.productLine)?.label ?? plan.productLine}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditForm(plan)}
                          className="h-9 w-9 flex items-center justify-center rounded-lg text-ink-muted hover:bg-primary/10 hover:text-primary transition-colors min-w-[44px] min-h-[44px]"
                          aria-label={`Edit ${plan.name}`}
                          data-testid={`edit-plan-${plan.id}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(plan.id)}
                          className="h-9 w-9 flex items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-colors min-w-[44px] min-h-[44px]"
                          aria-label={`Deactivate ${plan.name}`}
                          data-testid={`deactivate-plan-${plan.id}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Retired plans shown with tag */}
              {plans.filter((p) => !p.isActive).length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Retired</p>
                  {plans.filter((p) => !p.isActive).map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border opacity-60"
                      data-testid={`retired-plan-${plan.id}`}
                    >
                      <span className="text-sm text-ink-muted line-through">{plan.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-border text-ink-muted">(Retired)</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Plan form / button */}
              {!showPlanForm ? (
                <button
                  type="button"
                  onClick={openAddForm}
                  className="h-11 px-4 rounded-lg bg-primary/10 text-primary text-sm font-semibold flex items-center gap-2 hover:bg-primary/20 transition-colors self-start"
                  data-testid="add-plan-btn"
                >
                  <Plus size={15} /> Add Plan
                </button>
              ) : (
                <form
                  onSubmit={handlePlanSubmit}
                  className="flex flex-col gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5"
                  data-testid="plan-form"
                >
                  <p className="text-sm font-semibold text-ink">{editingId ? 'Edit Plan' : 'New Plan'}</p>
                  <FieldGroup label="Plan Name" required id="pf-name">
                    <input
                      id="pf-name"
                      value={planForm.name}
                      onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Whole Life Plus"
                      className={inputCls}
                      required
                    />
                  </FieldGroup>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup label="Class" required id="pf-class">
                      <select
                        id="pf-class"
                        value={planForm.class}
                        onChange={(e) => setPlanForm((f) => ({ ...f, class: e.target.value }))}
                        className={selectCls}
                      >
                        {POLICY_CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </FieldGroup>
                    <FieldGroup label="Product Line" required id="pf-line">
                      <select
                        id="pf-line"
                        value={planForm.productLine}
                        onChange={(e) => setPlanForm((f) => ({ ...f, productLine: e.target.value }))}
                        className={selectCls}
                      >
                        {PRODUCT_LINES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </FieldGroup>
                  </div>
                  {saveError && (
                    <div role="alert" className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <AlertCircle size={14} /> {saveError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closePlanForm}
                      className="flex-1 h-10 rounded-lg border border-border text-sm font-semibold text-ink-muted hover:bg-surface/70 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 h-10 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                      data-testid="plan-form-submit"
                    >
                      {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : (editingId ? 'Save Changes' : 'Add Plan')}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* ── Pending Review tab ── */}
          {!loading && tab === 1 && (
            <>
              {pendingReview.length === 0 ? (
                <p className="text-sm text-ink-muted text-center py-6" data-testid="no-pending">
                  No pending plan names. Agents who enter custom plan names will appear here.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {pendingReview.map((entry) => (
                    <div key={entry.name} data-testid={`pending-row-${entry.name}`}>
                      {promotingName === entry.name ? (
                        <form
                          onSubmit={handlePromoteSubmit}
                          className="flex flex-col gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5"
                          data-testid={`promote-form-${entry.name}`}
                        >
                          <p className="text-sm font-semibold text-ink">
                            Approve: <span className="text-primary">"{entry.name}"</span>
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <FieldGroup label="Class" required id={`promote-class-${entry.name}`}>
                              <select
                                id={`promote-class-${entry.name}`}
                                value={promoteForm.class}
                                onChange={(e) => setPromoteForm((f) => ({ ...f, class: e.target.value }))}
                                className={selectCls}
                              >
                                {POLICY_CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                              </select>
                            </FieldGroup>
                            <FieldGroup label="Product Line" required id={`promote-line-${entry.name}`}>
                              <select
                                id={`promote-line-${entry.name}`}
                                value={promoteForm.productLine}
                                onChange={(e) => setPromoteForm((f) => ({ ...f, productLine: e.target.value }))}
                                className={selectCls}
                              >
                                {PRODUCT_LINES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                              </select>
                            </FieldGroup>
                          </div>
                          {promoteError && (
                            <div role="alert" className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
                              <AlertCircle size={14} /> {promoteError}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={closePromoteForm}
                              className="flex-1 h-10 rounded-lg border border-border text-sm font-semibold text-ink-muted hover:bg-surface/70 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={promoting}
                              className="flex-1 h-10 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                              data-testid={`promote-submit-${entry.name}`}
                            >
                              {promoting ? <><Loader2 size={14} className="animate-spin" /> Approving…</> : 'Approve'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-surface-raised">
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-ink">{entry.name}</span>
                            <span className="text-xs text-ink-muted">
                              Logged by {entry.loggedByAgents} agent{entry.loggedByAgents !== 1 ? 's' : ''}
                              {entry.firstLoggedAt && (
                                <> · First: {
                                  entry.firstLoggedAt?.toDate
                                    ? entry.firstLoggedAt.toDate().toLocaleDateString('en-TT', { year: 'numeric', month: 'short', day: 'numeric' })
                                    : '—'
                                }</>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openPromoteForm(entry.name)}
                              className="h-9 w-9 flex items-center justify-center rounded-lg text-ink-muted hover:bg-primary/10 hover:text-primary transition-colors min-w-[44px] min-h-[44px]"
                              aria-label={`Approve ${entry.name}`}
                              data-testid={`approve-btn-${entry.name}`}
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDismiss(entry.name)}
                              className="h-9 w-9 flex items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-colors min-w-[44px] min-h-[44px]"
                              aria-label={`Dismiss ${entry.name}`}
                              data-testid={`dismiss-btn-${entry.name}`}
                            >
                              <XCircle size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

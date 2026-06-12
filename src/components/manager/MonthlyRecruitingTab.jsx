/**
 * MonthlyRecruitingTab.jsx — I2 monthly recruiting roll-up UI.
 *
 * Single tab with two role-gated sections:
 *  - Own input form  → UM / BM / SM file their monthly rollup.
 *  - Team view       → BM / SM / TA / PA browse the team's rollups (read-only).
 *
 * Month display: stored YYYY-MM, displayed MM-YYYY everywhere, via formatMonthKey().
 * Locked decision (I2 brief §Locked #1): NEVER store MM-YYYY.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../utils/formatters';
import {
  saveRollupDraft, submitRollup, getRollup, getRollupsForUpline,
} from '../../services/managerMonthlyRollupService';
import { formatMonthKey, recentMonthKeys } from '../../utils/monthKeyHelpers';

const CAN_FILE      = ['unit_manager', 'branch_manager', 'sales_manager'];
const CAN_VIEW_TEAM = ['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'];

const DEFAULT_FORM = { candidatesAssessed: 0, agentsContracted: 0, notes: '' };

export default function MonthlyRecruitingTab() {
  const { user, userProfile, role, tenantId } = useAuth();
  const months   = recentMonthKeys(12);
  const canFile  = CAN_FILE.includes(role);
  const canView  = CAN_VIEW_TEAM.includes(role);
  const branchId = userProfile?.branchId ?? null;

  // ── Own-form state ───────────────────────────────────────────────────────
  const [ownMonth,      setOwnMonth]      = useState(months[0]);
  const [form,          setForm]          = useState(DEFAULT_FORM);
  const [ownStatus,     setOwnStatus]     = useState(null);   // null | 'draft' | 'submitted'
  const [ownLoading,    setOwnLoading]    = useState(canFile);
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState('');
  const [savedAt,       setSavedAt]       = useState(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // ── Team-view state ──────────────────────────────────────────────────────
  const [teamMonth,   setTeamMonth]   = useState(months[0]);
  const [rollups,     setRollups]     = useState([]);
  const [teamLoading, setTeamLoading] = useState(canView);
  const [teamError,   setTeamError]   = useState(null);

  const managerName = userProfile?.name ?? userProfile?.email ?? '';
  const managerMeta = {
    managerRole: role,
    branchId:    userProfile?.branchId ?? null,
    unitId:      userProfile?.unitId   ?? null,  // null for BM/SM — see Item 3
  };

  // Load own rollup when month changes
  useEffect(() => {
    if (!canFile || !user) return;
    setOwnLoading(true);
    setSubmitSuccess(false);
    setSubmitError('');
    setSaveError('');
    getRollup(tenantId, user.uid, ownMonth)
      .then((r) => {
        if (!r) {
          setForm(DEFAULT_FORM);
          setOwnStatus(null);
          return;
        }
        // Strip identity/meta fields; load only form-editable fields
        setForm({
          candidatesAssessed: r.candidatesAssessed ?? 0,
          agentsContracted:   r.agentsContracted   ?? 0,
          notes:              r.notes              ?? '',
        });
        setOwnStatus(r.status ?? null);
      })
      .catch(console.error)
      .finally(() => setOwnLoading(false));
  }, [ownMonth, user, tenantId, canFile]);

  // Load team rollups when teamMonth changes
  useEffect(() => {
    if (!canView) return;
    setTeamLoading(true);
    setTeamError(null);
    getRollupsForUpline({ tenantId, monthKey: teamMonth, role, branchId })
      .then(setRollups)
      .catch((err) => {
        console.error('Failed to load team rollups:', err);
        setTeamError('Unable to load team data — check your connection and try again.');
      })
      .finally(() => setTeamLoading(false));
  }, [teamMonth, tenantId, role, branchId, canView]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSaveDraft = async () => {
    if (!user || ownStatus === 'submitted') return;
    setSaving(true);
    setSaveError('');
    try {
      await saveRollupDraft(tenantId, user.uid, managerName, ownMonth, form, managerMeta);
      setSavedAt(new Date());
      setTimeout(() => setSavedAt(null), 3000);
      if (!ownStatus) setOwnStatus('draft');
    } catch (err) {
      console.error('Rollup save failed:', err);
      setSaveError('Save failed — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || ownStatus === 'submitted') return;
    setSubmitError('');
    setSubmitting(true);
    try {
      await submitRollup(tenantId, user.uid, managerName, ownMonth, form, managerMeta);
      setOwnStatus('submitted');
      setSubmitSuccess(true);
    } catch (err) {
      console.error('Rollup submit failed:', err);
      setSubmitError('Submit failed — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitted = ownStatus === 'submitted';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-12">

      {/* ── Own input form (UM / BM / SM) ─────────────────────────────────── */}
      {canFile && (
        <section aria-labelledby="own-form-heading">
          <div className="space-y-6">

            {/* Header + month selector */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="own-form-heading" className="text-xl font-semibold text-text">
                  My Monthly Recruiting
                </h2>
                <p className="text-sm text-text-muted mt-0.5">
                  {isSubmitted
                    ? 'Submitted'
                    : ownStatus === 'draft'
                    ? 'Draft — saved'
                    : 'New entry'}
                </p>
              </div>
              <select
                value={ownMonth}
                onChange={(e) => setOwnMonth(e.target.value)}
                disabled={isSubmitted}
                aria-label="Select month"
                className="h-11 px-3 rounded-lg bg-card border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              >
                {months.map((m) => (
                  <option key={m} value={m}>{formatMonthKey(m)}</option>
                ))}
              </select>
            </div>

            {ownLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="text-text-muted text-sm">Loading…</span>
              </div>
            ) : (
              <>
                {/* Fields card */}
                <div className="bg-card rounded-2xl p-5 space-y-5">
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Recruiting Activity
                  </h3>

                  <NumberField
                    id="candidatesAssessed"
                    label="Candidates Assessed"
                    help="Recruiting candidates who completed a formal assessment this month. (Definition provisional — pending head-of-sales confirmation.)"
                    value={form.candidatesAssessed}
                    onChange={handleChange('candidatesAssessed')}
                    disabled={isSubmitted}
                  />

                  <NumberField
                    id="agentsContracted"
                    label="Agents Contracted"
                    help="New agents who signed a contract this month; log under the month the contract is issued. (Provisional — pending head-of-sales confirmation.)"
                    value={form.agentsContracted}
                    onChange={handleChange('agentsContracted')}
                    disabled={isSubmitted}
                  />

                  <div className="space-y-1">
                    <label htmlFor="recruiting-notes" className="block text-sm font-medium text-text">
                      Notes{' '}
                      <span className="text-text-muted font-normal">(optional)</span>
                    </label>
                    <textarea
                      id="recruiting-notes"
                      value={form.notes}
                      onChange={handleChange('notes')}
                      disabled={isSubmitted}
                      maxLength={1000}
                      rows={3}
                      placeholder="e.g. Two candidates in pipeline for next month"
                      className="w-full px-3 py-2 rounded-lg bg-card-raised border border-border text-text text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                    />
                    <p className="text-xs text-text-muted text-right" aria-hidden="true">
                      {String(form.notes ?? '').length}/1000
                    </p>
                  </div>
                </div>

                {/* Actions */}
                {!isSubmitted && (
                  <div className="space-y-3">
                    {/* Save status */}
                    <div className="text-xs min-h-[1rem]" aria-live="polite">
                      {saving && <span className="text-text-muted">Saving…</span>}
                      {!saving && savedAt && <span className="text-primary">Saved ✓</span>}
                      {!saving && saveError && (
                        <span className="text-red-500">{saveError}</span>
                      )}
                    </div>

                    {submitError && (
                      <p className="text-sm text-red-500" role="alert">{submitError}</p>
                    )}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={saving || submitting}
                        className="flex-1 h-11 rounded-xl bg-card border border-border text-text text-sm font-semibold hover:bg-card-raised transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {saving ? 'Saving…' : 'Save Draft'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || submitting}
                        className="flex-1 h-11 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {submitting ? 'Submitting…' : 'Submit'}
                      </button>
                    </div>
                  </div>
                )}

                {submitSuccess && (
                  <p
                    className="text-sm text-green-600 dark:text-green-400 text-center font-medium"
                    role="status"
                  >
                    Monthly recruiting report submitted.
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* ── Team view (BM / SM / TA / PA) ───────────────────────────────────── */}
      {canView && (
        <section aria-labelledby="team-view-heading">
          <div className="space-y-6">

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="team-view-heading" className="text-xl font-semibold text-text">
                  Team Monthly Recruiting
                </h2>
                <p className="text-sm text-text-muted mt-0.5">
                  Monthly rollups for the selected month
                </p>
              </div>
              <select
                value={teamMonth}
                onChange={(e) => setTeamMonth(e.target.value)}
                aria-label="Select team month"
                className="h-11 px-3 rounded-lg bg-card border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {months.map((m) => (
                  <option key={m} value={m}>{formatMonthKey(m)}</option>
                ))}
              </select>
            </div>

            {teamLoading && (
              <div className="flex items-center justify-center py-12">
                <span className="text-text-muted text-sm">Loading…</span>
              </div>
            )}

            {teamError && (
              <div className="rounded-xl bg-card p-4 text-sm text-red-500" role="alert">
                {teamError}
              </div>
            )}

            {!teamLoading && !teamError && rollups.length === 0 && (
              <div className="rounded-xl bg-card p-8 text-center text-sm text-text-muted">
                No recruiting entries filed for {formatMonthKey(teamMonth)}.
              </div>
            )}

            {!teamLoading && !teamError && rollups.length > 0 && (
              <div className="space-y-2">
                {rollups.map((r) => (
                  <RollupRow key={r.id} rollup={r} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NumberField({ id, label, help, value, onChange, disabled }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-text flex-1">
          {label}
        </label>
        <input
          id={id}
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-label={label}
          className="w-24 h-11 px-3 rounded-lg bg-card-raised border border-border text-text text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        />
      </div>
      {help && (
        <p className="text-xs text-text-muted">{help}</p>
      )}
    </div>
  );
}

function RollupRow({ rollup }) {
  const roleLabel   = getRoleLabel(rollup.managerRole);
  const isSubmitted = rollup.status === 'submitted';
  return (
    <div className="bg-card rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text">
              {rollup.managerName ?? rollup.managerId}
            </p>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                isSubmitted
                  ? 'bg-primary/10 text-primary'
                  : 'bg-card-raised text-text-muted'
              }`}
              aria-label={`Status: ${rollup.status}`}
            >
              {rollup.status}
            </span>
          </div>
          <p className="text-xs text-text-muted">{roleLabel}</p>
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          <p className="text-xs text-text-muted">
            Assessed:{' '}
            <span className="font-semibold text-text">
              {rollup.candidatesAssessed ?? '—'}
            </span>
          </p>
          <p className="text-xs text-text-muted">
            Contracted:{' '}
            <span className="font-semibold text-text">
              {rollup.agentsContracted ?? '—'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

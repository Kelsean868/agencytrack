import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRecentSundays } from '../../utils/validators';
import { saveWarDraft, submitWar, getWar, getOwnJfwCount } from '../../services/managerWarService';
import { getResolvedStandards } from '../../services/managerStandardOverrideService';
import { computeMissedActivities } from '../../utils/accountabilityFlag';
import AccountabilityFlagPanel from './AccountabilityFlagPanel';
import PanelSkeleton, { SkeletonText } from '../ui/PanelSkeleton';

const AUTOSAVE_DELAY = 1500;

const DEFAULT_FORM = {
  oneOnOnesConducted:   0,
  namesSourced:         0,
  interviewsConducted:  0,
  recruitsInFirstWeeks: 0,
  trainingSessions:     0,
  trainingTopic:        '',
  unitMeetingHeld:      false,
  attendanceCount:      0,
  dashboardReviewDone:  false,
};

export default function ManagerWarTab() {
  const { user, userProfile, role, tenantId } = useAuth();
  const sundays = getRecentSundays(8);

  const [weekStart, setWeekStart]       = useState(sundays[0]);
  const [form, setForm]                 = useState(DEFAULT_FORM);
  const [status, setStatus]             = useState(null);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [savedAt, setSavedAt]           = useState(null);
  const [saveError, setSaveError]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [jfwCount, setJfwCount]         = useState(null);
  const [jfwError, setJfwError]         = useState(false);
  const [roleStds, setRoleStds]         = useState({});

  const saveTimer  = useRef(null);
  const savedTimer = useRef(null);
  const doSave     = useRef(null);

  const managerName = userProfile?.name ?? userProfile?.email ?? '';

  const managerMeta = {
    managerRole: role,
    branchId:    userProfile?.branchId ?? null,
    unitId:      userProfile?.unitId   ?? null,
  };

  // Load (or reset) WAR when week changes. §1 states contract — a failed
  // load no longer silently falls through to DEFAULT_FORM (which would mask
  // an existing draft as a blank new report); it renders a blocking error
  // card with Retry instead.
  const loadWar = useCallback(() => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    setSubmitSuccess(false);
    setSubmitError('');
    getWar(tenantId, user.uid, weekStart)
      .then((war) => {
        if (!war) {
          setForm(DEFAULT_FORM);
          setStatus(null);
          return;
        }
        // Strip identity/meta fields; keep only form-editable fields
        const {
          id: _id, managerId: _mid, managerName: _mn, tenantId: _tid,
          weekStart: _ws, managerRole: _mr, managerRoleRank: _rr,
          branchId: _bid, unitId: _uid, jfwCount: _jfw,
          status: s, createdAt: _ca, updatedAt: _ua, submittedAt: _sa,
          ...fields
        } = war;
        setForm((prev) => ({ ...prev, ...fields }));
        setStatus(s ?? null);
      })
      .catch((err) => {
        console.error('[ManagerWarTab] load failed:', err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [weekStart, user, tenantId]);

  useEffect(() => { loadWar(); }, [loadWar]);

  // Fetch JFW count from joint-call logs for the selected week (I1.2)
  const loadJfwCount = useCallback(() => {
    if (!user) return;
    setJfwCount(null);
    setJfwError(false);
    getOwnJfwCount({ tenantId, managerId: user.uid, weekStart })
      .then(setJfwCount)
      .catch((err) => {
        console.error('JFW count failed:', err);
        setJfwError(true);
      });
  }, [weekStart, user, tenantId]);

  useEffect(() => { loadJfwCount(); }, [loadJfwCount]);

  // Fetch resolved standards (org-default ?? override) for the owner (I1.3c-ii).
  // Failure is silent — overlay falls back to actual-only.
  useEffect(() => {
    if (!tenantId || !role || !user) return;
    getResolvedStandards({ tenantId, managerId: user.uid, role })
      .then(setRoleStds)
      .catch(() => setRoleStds({}));
  }, [tenantId, role, user]);

  // Always-current save executor (mirrors WizardForm pattern)
  doSave.current = async () => {
    if (!weekStart || !user || status === 'submitted') return;
    setSaving(true);
    setSaveError(false);
    try {
      await saveWarDraft(tenantId, user.uid, managerName, weekStart, form, managerMeta);
      clearTimeout(savedTimer.current);
      setSavedAt(new Date());
      savedTimer.current = setTimeout(() => setSavedAt(null), 3000);
    } catch (err) {
      console.error('WAR auto-save failed:', err);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // Debounced auto-save on form change (1500ms, mirrors wizard)
  useEffect(() => {
    if (!weekStart || !user || status === 'submitted') return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => { await doSave.current(); }, AUTOSAVE_DELAY);
    return () => clearTimeout(saveTimer.current);
  }, [form, weekStart, user, status]);

  const handleChange = (field) => (e) => {
    const { type, checked, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [field]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleToggle = (field) => () => {
    setForm((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async () => {
    setSubmitError('');
    if (status === 'submitted') return;
    setSubmitting(true);
    try {
      await submitWar(tenantId, user.uid, managerName, weekStart, form, managerMeta);
      setStatus('submitted');
      setSubmitSuccess(true);
    } catch (err) {
      console.error('WAR submit failed:', err);
      setSubmitError('Submit failed — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitted = status === 'submitted';

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <PanelSkeleton variant="list" count={4} label="Loading your weekly activity report…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="max-w-2xl mx-auto flex flex-col items-center gap-3 p-8 rounded-xl bg-danger/10 border border-danger/30 text-center"
        data-testid="manager-war-error"
      >
        <p className="text-sm text-danger-ink font-medium">Couldn&apos;t load your weekly activity report — check your connection and try again.</p>
        <button
          type="button"
          onClick={loadWar}
          className="min-h-[44px] px-4 rounded-lg bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header + week selector */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text">My Weekly Activity Report</h2>
          <p className="text-sm text-text-muted mt-0.5">
            {isSubmitted
              ? 'Submitted'
              : status === 'draft'
              ? 'Draft — auto-saved'
              : 'New report'}
          </p>
        </div>
        <select
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          disabled={isSubmitted}
          aria-label="Select week"
          className="h-11 px-3 rounded-lg bg-card border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        >
          {sundays.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Save status */}
      {!isSubmitted && (
        <div className="text-xs min-h-[1rem]" aria-live="polite">
          {saving && <span className="text-text-muted">Saving…</span>}
          {!saving && savedAt && <span className="text-primary">Saved ✓</span>}
          {!saving && saveError && (
            <span className="text-red-500">Save failed — check connection</span>
          )}
        </div>
      )}

      {/* I3a Tier-1 accountability flag — visible when one or more standards
           are under target. Includes the auto-counted JFW in the comparison. */}
      <AccountabilityFlagPanel
        missed={computeMissedActivities(
          { ...form, jfwCount: jfwCount ?? 0 },
          roleStds,
        )}
      />

      {/* Activities card */}
      <div className="bg-card rounded-2xl p-5 space-y-5">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Activities
        </h3>

        <NumericField
          label="One-on-One Pipeline Reviews"
          value={form.oneOnOnesConducted}
          target={roleStds.oneOnOnesConducted}
          onChange={handleChange('oneOnOnesConducted')}
          disabled={isSubmitted}
        />
        <NumericField
          label="Names Sourced"
          value={form.namesSourced}
          target={roleStds.namesSourced}
          onChange={handleChange('namesSourced')}
          disabled={isSubmitted}
        />
        <NumericField
          label="Initial Interviews Conducted"
          value={form.interviewsConducted}
          target={roleStds.interviewsConducted}
          onChange={handleChange('interviewsConducted')}
          disabled={isSubmitted}
        />
        <NumericField
          label="New Recruits in First Weeks"
          value={form.recruitsInFirstWeeks}
          target={roleStds.recruitsInFirstWeeks}
          onChange={handleChange('recruitsInFirstWeeks')}
          disabled={isSubmitted}
        />
        <NumericField
          label="Training Sessions Delivered"
          value={form.trainingSessions}
          target={roleStds.trainingSessions}
          onChange={handleChange('trainingSessions')}
          disabled={isSubmitted}
        />

        <div className="space-y-1">
          <label htmlFor="trainingTopic" className="block text-sm font-medium text-text">
            Training Topic <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <input
            id="trainingTopic"
            type="text"
            value={form.trainingTopic}
            onChange={handleChange('trainingTopic')}
            disabled={isSubmitted}
            placeholder="e.g. Objection handling"
            className="w-full h-11 px-3 rounded-lg bg-card-raised border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          />
        </div>

        <ToggleField
          label="Unit / Branch Meeting Held"
          checked={form.unitMeetingHeld}
          expected={roleStds.unitMeetingHeld}
          onToggle={handleToggle('unitMeetingHeld')}
          disabled={isSubmitted}
        />
        {form.unitMeetingHeld && (
          <NumericField
            label="Attendance Count"
            value={form.attendanceCount}
            onChange={handleChange('attendanceCount')}
            disabled={isSubmitted}
          />
        )}

        <ToggleField
          label="Planning & Dashboard Review Done"
          checked={form.dashboardReviewDone}
          expected={roleStds.dashboardReviewDone}
          onToggle={handleToggle('dashboardReviewDone')}
          disabled={isSubmitted}
        />
      </div>

      {/* JFW — read-only count from joint-call logs (I1.2) */}
      <div className="bg-card-raised rounded-2xl p-4 flex items-center gap-3 min-h-[44px]">
        <div className="text-sm flex-1">
          <span className="font-medium text-text">Joint Field Work (JFW)</span>
          <span className="ml-2 text-text-muted">— from joint-call logs</span>
        </div>
        {jfwError ? (
          <span className="flex items-center gap-2" role="alert">
            <span className="text-xs text-red-500">Error loading</span>
            <button
              type="button"
              onClick={loadJfwCount}
              className="min-h-[44px] px-2 text-xs font-semibold text-primary underline underline-offset-2"
            >
              Retry
            </button>
          </span>
        ) : jfwCount === null ? (
          <span role="status" aria-label="Joint Field Work count loading">
            <SkeletonText loading reserveCh={6} className="text-xs" />
          </span>
        ) : (
          <ActualTarget
            actual={jfwCount}
            target={roleStds.jfwCount}
            ariaLabel="Joint Field Work count"
          />
        )}
      </div>

      {/* Submit area */}
      {!isSubmitted && (
        <div className="space-y-3">
          {submitError && (
            <p className="text-sm text-red-500" role="alert">{submitError}</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || saving}
            className="w-full h-11 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      )}

      {submitSuccess && (
        <p
          className="text-sm text-green-600 dark:text-green-400 text-center font-medium"
          role="status"
        >
          Report submitted successfully.
        </p>
      )}
    </div>
  );
}

// ── Overlay helpers ───────────────────────────────────────────────────────────

// met/under: teal = met, muted = under — informational only, NOT alarm (I3 flag).
function ActualTarget({ actual, target, ariaLabel }) {
  const hasTarget = target != null && Number.isFinite(Number(target)) && Number(target) > 0;
  if (!hasTarget) {
    return (
      <span className="text-sm font-semibold text-text" aria-label={`${ariaLabel}: ${actual}`}>
        {actual}
      </span>
    );
  }
  const met = Number(actual) >= Number(target);
  return (
    <span
      className={`text-sm font-semibold ${met ? 'text-primary' : 'text-text-muted'}`}
      aria-label={`${ariaLabel}: ${actual} of ${target}`}
    >
      {actual} / {target}
    </span>
  );
}

function BoolStandardBadge({ checked, expected }) {
  if (expected !== true) return null;
  const met = checked === true;
  return (
    <span
      className={`ml-2 text-xs font-medium ${met ? 'text-primary' : 'text-text-muted'}`}
      aria-label={met ? 'standard met' : 'standard not met'}
    >
      {met ? '✓ met' : '· expected'}
    </span>
  );
}

// ── Input components ──────────────────────────────────────────────────────────

function NumericField({ label, value, target, onChange, disabled, step = '1' }) {
  const hasTarget = target != null && Number.isFinite(Number(target)) && Number(target) > 0;
  const met = hasTarget && Number(value) >= Number(target);
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-text flex-1">{label}</span>
      <div className="flex items-center gap-2">
        {hasTarget && (
          <span
            className={`text-xs ${met ? 'text-primary' : 'text-text-muted'}`}
            aria-label={`target: ${target}`}
          >
            / {target}
          </span>
        )}
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-label={label}
          className="w-24 h-11 px-3 rounded-lg bg-card-raised border border-border text-text text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        />
      </div>
    </div>
  );
}

function ToggleField({ label, checked, expected, onToggle, disabled }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      className="flex items-center gap-3 w-full text-left min-h-[44px] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
    >
      <span className="text-primary shrink-0" aria-hidden="true">
        {checked ? <CheckSquare size={20} /> : <Square size={20} />}
      </span>
      <span className="text-sm font-medium text-text">{label}</span>
      <BoolStandardBadge checked={checked} expected={expected} />
    </button>
  );
}

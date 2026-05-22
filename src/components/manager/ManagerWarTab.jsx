import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRecentSundays } from '../../utils/validators';
import { saveWarDraft, submitWar, getWar, getOwnJfwCount } from '../../services/managerWarService';

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
  personalApi:          0,
  personalApps:         0,
};

export default function ManagerWarTab() {
  const { user, userProfile, role, tenantId } = useAuth();
  const sundays = getRecentSundays(8);

  const [weekStart, setWeekStart]       = useState(sundays[0]);
  const [form, setForm]                 = useState(DEFAULT_FORM);
  const [status, setStatus]             = useState(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [savedAt, setSavedAt]           = useState(null);
  const [saveError, setSaveError]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [jfwCount, setJfwCount]         = useState(null);
  const [jfwError, setJfwError]         = useState(false);

  const saveTimer  = useRef(null);
  const savedTimer = useRef(null);
  const doSave     = useRef(null);

  const isProducingManager = Boolean(userProfile?.isProducingManager);
  const managerName        = userProfile?.name ?? userProfile?.email ?? '';

  const managerMeta = {
    managerRole:        role,
    branchId:           userProfile?.branchId ?? null,
    unitId:             userProfile?.unitId   ?? null,
    isProducingManager,
  };

  // Load (or reset) WAR when week changes
  useEffect(() => {
    if (!user) return;
    setLoading(true);
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
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [weekStart, user, tenantId]);

  // Fetch JFW count from joint-call logs for the selected week (I1.2)
  useEffect(() => {
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
      <div className="flex items-center justify-center py-16">
        <span className="text-text-muted text-sm">Loading…</span>
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

      {/* Activities card */}
      <div className="bg-card rounded-2xl p-5 space-y-5">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Activities
        </h3>

        <NumericField
          label="One-on-One Pipeline Reviews"
          value={form.oneOnOnesConducted}
          onChange={handleChange('oneOnOnesConducted')}
          disabled={isSubmitted}
        />
        <NumericField
          label="Names Sourced"
          value={form.namesSourced}
          onChange={handleChange('namesSourced')}
          disabled={isSubmitted}
        />
        <NumericField
          label="Initial Interviews Conducted"
          value={form.interviewsConducted}
          onChange={handleChange('interviewsConducted')}
          disabled={isSubmitted}
        />
        <NumericField
          label="New Recruits in First Weeks"
          value={form.recruitsInFirstWeeks}
          onChange={handleChange('recruitsInFirstWeeks')}
          disabled={isSubmitted}
        />
        <NumericField
          label="Training Sessions Delivered"
          value={form.trainingSessions}
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
          onToggle={handleToggle('dashboardReviewDone')}
          disabled={isSubmitted}
        />
      </div>

      {/* Personal production — dormant until isProducingManager is set on the user doc */}
      {isProducingManager && (
        <div className="bg-card rounded-2xl p-5 space-y-5">
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Personal Production
            </h3>
            <p className="text-xs text-text-muted mt-1">
              Tracked separately — never included in unit totals.
            </p>
          </div>
          <NumericField
            label="Personal API (TTD)"
            value={form.personalApi}
            onChange={handleChange('personalApi')}
            disabled={isSubmitted}
            step="0.01"
          />
          <NumericField
            label="Personal Applications"
            value={form.personalApps}
            onChange={handleChange('personalApps')}
            disabled={isSubmitted}
          />
        </div>
      )}

      {/* JFW — read-only count from joint-call logs (I1.2) */}
      <div className="bg-card-raised rounded-2xl p-4 flex items-center gap-3 min-h-[44px]">
        <div className="text-sm flex-1">
          <span className="font-medium text-text">Joint Field Work (JFW)</span>
          <span className="ml-2 text-text-muted">— from joint-call logs</span>
        </div>
        {jfwError ? (
          <span className="text-xs text-red-500" role="alert">Error loading</span>
        ) : jfwCount === null ? (
          <span className="text-xs text-text-muted" aria-label="Joint Field Work count loading">Loading…</span>
        ) : (
          <span
            className="text-sm font-semibold text-text"
            aria-label={`Joint Field Work count: ${jfwCount}`}
          >
            {jfwCount}
          </span>
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
            className="w-full h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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

function NumericField({ label, value, onChange, disabled, step = '1' }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-text flex-1">{label}</span>
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
  );
}

function ToggleField({ label, checked, onToggle, disabled }) {
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
    </button>
  );
}

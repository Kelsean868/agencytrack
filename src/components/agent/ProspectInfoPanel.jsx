// F3 — Agent-side prospect-info panel (joint-call prep).
//
// Agent-authored: the agent creates a prep record for an upcoming joint call.
// Privacy is the OPPOSITE of F1/F2: the agent reads/edits OWN; managers in
// scope read it via CoachingNotesModal's Prospect Info tab.
//
// Appointment-bound by design (§0 guardrail): intendedAppointmentDate REQUIRED.
// NOT a prospect pipeline or CRM.

import React, { useCallback, useEffect, useState } from 'react';
import { UserSearch, Pencil, Check, Plus, ChevronDown, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  addProspectInfo,
  getProspectInfo,
  updateProspectInfo,
  PROSPECTING_SOURCES,
  PROSPECTING_SOURCE_LABELS,
  APPOINTMENT_TYPES,
  OBJECTIONS,
  POLICY_TYPES,
} from '../../services/prospectInfoService';
import { SOCIAL_PLATFORMS_ATTRIBUTION } from '../../utils/prospectingConstants';

const SOURCE_LABEL      = PROSPECTING_SOURCE_LABELS;
const APPT_TYPE_LABEL   = Object.fromEntries(APPOINTMENT_TYPES.map((a) => [a.value, a.label]));
const OBJECTION_LABEL   = Object.fromEntries(OBJECTIONS.map((o) => [o.value, o.label]));
const POLICY_TYPE_LABEL = Object.fromEntries(POLICY_TYPES.map((p) => [p.value, p.label]));

const BLANK_FORM = {
  clientName:              '',
  clientAge:               '',
  clientOccupation:        '',
  prospectingSource:       'referral',
  socialPlatform:          null,
  appointmentType:         '2nd-interview',
  objections:              [],
  policyType:              '',
  intendedAppointmentDate: '',
};

function toggleObjection(arr, value) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function PrepCard({ prep, isAuthor, onSaved, onCreatePolicyFromPrep }) {
  const { tenantId } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({
    clientName:              prep.clientName              ?? '',
    clientAge:               prep.clientAge               ?? '',
    clientOccupation:        prep.clientOccupation        ?? '',
    prospectingSource:       prep.prospectingSource       ?? 'referral',
    socialPlatform:          prep.socialPlatform          ?? null,
    appointmentType:         prep.appointmentType         ?? '2nd-interview',
    objections:              Array.isArray(prep.objections) ? prep.objections : [],
    policyType:              prep.policyType              ?? '',
    intendedAppointmentDate: prep.intendedAppointmentDate ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const set = (field) => (e) => {
    setForm((s) => ({ ...s, [field]: e.target.value }));
  };

  const setSource = (e) => {
    const src = e.target.value;
    setForm((s) => ({ ...s, prospectingSource: src, socialPlatform: src === 'social-media' ? s.socialPlatform : null }));
  };

  const toggleObj = (value) => {
    setForm((s) => ({ ...s, objections: toggleObjection(s.objections, value) }));
  };

  const saveEdit = async () => {
    if (!form.intendedAppointmentDate) {
      setErr('Appointment date is required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await updateProspectInfo({
        tenantId,
        agentId: prep.agentId,
        prospectId: prep.id,
        ...form,
      });
      setEditing(false);
      onSaved({ ...prep, ...form });
    } catch (e) {
      console.error('Failed to update prospect-info:', e);
      setErr('Save failed — check connection.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setForm({
      clientName:              prep.clientName              ?? '',
      clientAge:               prep.clientAge               ?? '',
      clientOccupation:        prep.clientOccupation        ?? '',
      prospectingSource:       prep.prospectingSource       ?? 'referral',
      socialPlatform:          prep.socialPlatform          ?? null,
      appointmentType:         prep.appointmentType         ?? '2nd-interview',
      objections:              Array.isArray(prep.objections) ? prep.objections : [],
      policyType:              prep.policyType              ?? '',
      intendedAppointmentDate: prep.intendedAppointmentDate ?? '',
    });
    setErr('');
    setEditing(false);
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-card-raised">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
            {APPT_TYPE_LABEL[prep.appointmentType] ?? prep.appointmentType}
          </span>
          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success-ink">
            {SOURCE_LABEL[prep.prospectingSource] ?? prep.prospectingSource}
          </span>
          <span className="text-[11px] text-ink-muted">
            {prep.intendedAppointmentDate || '—'}
          </span>
        </div>
        {isAuthor && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-primary hover:bg-primary/10 transition-colors"
            aria-label="Edit prep"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {!editing ? (
        <div className="text-sm text-ink space-y-1">
          <p className="font-medium">{prep.clientName || '—'}</p>
          {(prep.clientAge || prep.clientOccupation) && (
            <p className="text-xs text-ink-muted">
              {prep.clientAge ? `${prep.clientAge} yrs` : ''}
              {prep.clientAge && prep.clientOccupation ? ' · ' : ''}
              {prep.clientOccupation || ''}
            </p>
          )}
          {prep.policyType && (
            <p className="text-xs text-ink-muted">
              <span className="font-medium">Policy: </span>
              {POLICY_TYPE_LABEL[prep.policyType] ?? prep.policyType}
            </p>
          )}
          {Array.isArray(prep.objections) && prep.objections.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {prep.objections.map((o) => (
                <span key={o} className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning-ink">
                  {OBJECTION_LABEL[o] ?? o}
                </span>
              ))}
            </div>
          )}
          {isAuthor && onCreatePolicyFromPrep && (
            <div className="pt-2 mt-1 border-t border-border">
              <button
                onClick={() => onCreatePolicyFromPrep(prep)}
                className="h-9 px-3 rounded-lg text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/5 transition-colors flex items-center gap-1.5 min-w-[44px]"
                data-testid={`log-policy-btn-${prep.id}`}
              >
                <FileText size={13} aria-hidden="true" /> Log Policy
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={form.clientName}
            onChange={set('clientName')}
            placeholder="Client name"
            maxLength={120}
            className="h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Client name"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              step="1"
              value={form.clientAge}
              onChange={set('clientAge')}
              placeholder="Age"
              className="h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Client age"
            />
            <input
              type="text"
              value={form.clientOccupation}
              onChange={set('clientOccupation')}
              placeholder="Occupation"
              maxLength={120}
              className="h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Client occupation"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.prospectingSource}
              onChange={setSource}
              className="h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Prospecting source"
            >
              {PROSPECTING_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={form.appointmentType}
              onChange={set('appointmentType')}
              className="h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Appointment type"
            >
              {APPOINTMENT_TYPES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          {form.prospectingSource === 'social-media' && (
            <select
              value={form.socialPlatform ?? ''}
              onChange={set('socialPlatform')}
              className="h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Social platform (required)"
              required
            >
              <option value="">Select platform…</option>
              {SOCIAL_PLATFORMS_ATTRIBUTION.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          )}
          <select
            value={form.policyType}
            onChange={set('policyType')}
            className="h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Policy type"
          >
            <option value="">Select policy type…</option>
            {POLICY_TYPES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
            {/* Legacy free-text values (pre-pick-list) display verbatim in the
                card view via the fallback; not offered as a new selection. */}
          </select>
          <input
            type="date"
            value={form.intendedAppointmentDate}
            onChange={set('intendedAppointmentDate')}
            required
            className="h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Intended appointment date (required)"
          />
          <div>
            <p className="text-xs text-ink-muted mb-1">Objections raised so far:</p>
            <div className="flex flex-wrap gap-2">
              {OBJECTIONS.map((o) => (
                <label key={o.value} className="inline-flex items-center gap-2 text-xs text-ink min-h-[44px] px-3 rounded-lg border border-border bg-card cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.objections.includes(o.value)}
                    onChange={() => toggleObj(o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>
          {err && <p className="text-xs text-danger-ink" role="alert">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={cancelEdit}
              className="min-h-[44px] px-4 rounded-lg border border-border text-sm text-ink hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="min-h-[44px] px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-medium flex items-center gap-2 hover:bg-primary/90 dark:hover:bg-primary-dark/90 disabled:opacity-50 transition-colors"
            >
              <Check size={14} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProspectInfoPanel({ onCreatePolicyFromPrep }) {
  const { user, userProfile, tenantId } = useAuth();
  const agentId     = user?.uid;
  const agentUnitId = userProfile?.unitId ?? '';

  const [preps, setPreps]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [adding, setAdding]         = useState(false);
  const [form, setForm]             = useState(BLANK_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError]     = useState('');

  const set = (field) => (e) => {
    setForm((s) => ({ ...s, [field]: e.target.value }));
  };

  const setSource = (e) => {
    const src = e.target.value;
    setForm((s) => ({ ...s, prospectingSource: src, socialPlatform: src === 'social-media' ? s.socialPlatform : null }));
  };

  const toggleObj = (value) => {
    setForm((s) => ({ ...s, objections: toggleObjection(s.objections, value) }));
  };

  useEffect(() => {
    if (!agentId || !tenantId) return;
    setLoading(true);
    setError('');
    getProspectInfo({ tenantId, agentId, callerRole: 'agent', callerUid: agentId })
      .then(setPreps)
      .catch((err) => {
        console.error('Failed to load prospect info:', err);
        setError('Failed to load joint-call prep. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [tenantId, agentId]);

  const handleAdd = useCallback(async (e) => {
    e.preventDefault();
    if (!form.intendedAppointmentDate) {
      setAddError('Appointment date is required.');
      return;
    }
    setSubmitting(true);
    setAddError('');
    try {
      await addProspectInfo({
        tenantId,
        agentId,
        agentUnitId,
        ...form,
      });
      setForm(BLANK_FORM);
      setAdding(false);
      const updated = await getProspectInfo({
        tenantId, agentId, callerRole: 'agent', callerUid: agentId,
      });
      setPreps(updated);
    } catch (err) {
      console.error('Failed to add prospect info:', err);
      setAddError('Failed to save prep — check connection.');
    } finally {
      setSubmitting(false);
    }
  }, [tenantId, agentId, agentUnitId, form]);

  const handleEditSaved = useCallback((updated) => {
    setPreps((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  return (
    <div className="stagger">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-ink flex items-center gap-2">
            <UserSearch size={20} className="text-primary" aria-hidden="true" />
            Joint-Call Prep
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Prep info for an upcoming joint call with your manager. Appointment-bound — not a pipeline.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors"
            data-testid="prospect-info-add-btn"
          >
            <Plus size={16} aria-hidden="true" />
            New Prep
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <form
          onSubmit={handleAdd}
          className="mb-6 p-4 rounded-xl border border-border bg-card flex flex-col gap-3"
          data-testid="prospect-info-add-form"
        >
          <input
            type="text"
            value={form.clientName}
            onChange={set('clientName')}
            placeholder="Client name"
            maxLength={120}
            required
            className="h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Client name"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              step="1"
              value={form.clientAge}
              onChange={set('clientAge')}
              placeholder="Age"
              className="h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Client age"
            />
            <input
              type="text"
              value={form.clientOccupation}
              onChange={set('clientOccupation')}
              placeholder="Occupation"
              maxLength={120}
              className="h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Client occupation"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <select
                value={form.prospectingSource}
                onChange={setSource}
                className="h-11 w-full pl-3 pr-8 rounded-lg border border-border bg-card text-ink text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="Prospecting source"
              >
                {PROSPECTING_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            </div>
            <div className="relative">
              <select
                value={form.appointmentType}
                onChange={set('appointmentType')}
                className="h-11 w-full pl-3 pr-8 rounded-lg border border-border bg-card text-ink text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="Appointment type"
              >
                {APPOINTMENT_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            </div>
          </div>
          {form.prospectingSource === 'social-media' && (
            <div className="relative">
              <select
                value={form.socialPlatform ?? ''}
                onChange={set('socialPlatform')}
                className="h-11 w-full pl-3 pr-8 rounded-lg border border-border bg-card text-ink text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="Social platform (required)"
                required
              >
                <option value="">Select platform…</option>
                {SOCIAL_PLATFORMS_ATTRIBUTION.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            </div>
          )}
          <div className="relative">
            <select
              value={form.policyType}
              onChange={set('policyType')}
              className="h-11 w-full pl-3 pr-8 rounded-lg border border-border bg-card text-ink text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Policy type"
            >
              <option value="">Select policy type…</option>
              {POLICY_TYPES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          </div>
          <div>
            <label htmlFor="prospect-appt-date" className="block text-xs text-ink-muted mb-1">
              Intended appointment date <span className="text-danger-ink">*</span>
            </label>
            <input
              id="prospect-appt-date"
              type="date"
              value={form.intendedAppointmentDate}
              onChange={set('intendedAppointmentDate')}
              required
              className="h-11 w-full px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Intended appointment date (required)"
            />
          </div>
          <div>
            <p className="text-xs text-ink-muted mb-1">Objections raised so far:</p>
            <div className="flex flex-wrap gap-2">
              {OBJECTIONS.map((o) => (
                <label key={o.value} className="inline-flex items-center gap-2 text-sm text-ink min-h-[44px] px-3 rounded-lg border border-border bg-card cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.objections.includes(o.value)}
                    onChange={() => toggleObj(o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>
          {addError && <p className="text-xs text-danger-ink" role="alert">{addError}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setAdding(false); setForm(BLANK_FORM); setAddError(''); }}
              className="min-h-[44px] px-4 rounded-lg border border-border text-sm text-ink hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.clientName.trim() || !form.intendedAppointmentDate || (form.prospectingSource === 'social-media' && !form.socialPlatform)}
              className="min-h-[44px] px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 disabled:opacity-50 transition-colors"
              data-testid="prospect-info-save-btn"
            >
              {submitting ? 'Saving…' : 'Save Prep'}
            </button>
          </div>
        </form>
      )}

      {/* Loading / empty / error / list */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-border/40 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="p-3 rounded-xl border border-danger/30 bg-danger/10 text-sm text-danger-ink" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && preps.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-ink-muted" data-testid="prospect-info-empty">
          <UserSearch size={32} className="opacity-30" aria-hidden="true" />
          <p className="text-sm">No joint-call prep yet.</p>
          <p className="text-xs">Tap "New Prep" to brief your manager on an upcoming call.</p>
        </div>
      )}

      {!loading && !error && preps.length > 0 && (
        <div className="flex flex-col gap-3" data-testid="prospect-info-list">
          {preps.map((prep) => (
            <PrepCard
              key={prep.id}
              prep={prep}
              isAuthor={prep.createdBy === agentId}
              onSaved={handleEditSaved}
              onCreatePolicyFromPrep={onCreatePolicyFromPrep}
            />
          ))}
        </div>
      )}
    </div>
  );
}

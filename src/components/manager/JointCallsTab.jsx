import React, { useEffect, useState, useCallback } from 'react';
import { Phone, Pencil, Check, ChevronDown, Link2, Archive } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  addJointCall,
  getJointCalls,
  updateJointCall,
  archiveJointCall,
  MEETING_TYPES,
  NEEDS_COVERED,
} from '../../services/jointCallsService';
import { getProspectInfo } from '../../services/prospectInfoService';

function formatCallDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-TT', { day: '2-digit', month: 'short', year: 'numeric' });
}

const MEETING_LABEL = Object.fromEntries(MEETING_TYPES.map((m) => [m.value, m.label]));
const NEEDS_LABEL   = Object.fromEntries(NEEDS_COVERED.map((n) => [n.value, n.label]));

function CallCard({ call, isAuthor, agentId, onEditSaved, onArchived, preps }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({
    appointmentDate:    call.appointmentDate    ?? '',
    appointmentTime:    call.appointmentTime    ?? '',
    appointmentKept:    !!call.appointmentKept,
    nextMeetingDate:    call.nextMeetingDate    ?? '',
    meetingType:        call.meetingType        ?? 'observation',
    needCovered:        call.needCovered        ?? 'other',
    comments:           call.comments           ?? '',
    saleMade:           !!call.saleMade,
    coachingMinutes:    call.coachingMinutes    ?? 0,
    trainingIdentified: call.trainingIdentified ?? '',
    prospectInfoId:     call.prospectInfoId     ?? '',
  });
  const [saving, setSaving]       = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [err, setErr]             = useState('');
  const { tenantId }              = useAuth();

  const archive = async () => {
    setArchiving(true);
    try {
      await archiveJointCall({ tenantId, agentId, callId: call.id });
      onArchived(call.id);
    } catch (e) {
      console.error('Failed to archive joint call:', e);
      setArchiving(false);
    }
  };

  const set = (field) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((s) => ({ ...s, [field]: v }));
  };

  const saveEdit = async () => {
    setSaving(true);
    setErr('');
    try {
      await updateJointCall({
        tenantId,
        agentId,
        callId: call.id,
        ...form,
      });
      setEditing(false);
      onEditSaved({ ...call, ...form });
    } catch (e) {
      console.error('Failed to update joint call:', e);
      setErr('Save failed — check connection.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setForm({
      appointmentDate:    call.appointmentDate    ?? '',
      appointmentTime:    call.appointmentTime    ?? '',
      appointmentKept:    !!call.appointmentKept,
      nextMeetingDate:    call.nextMeetingDate    ?? '',
      meetingType:        call.meetingType        ?? 'observation',
      needCovered:        call.needCovered        ?? 'other',
      comments:           call.comments           ?? '',
      saleMade:           !!call.saleMade,
      coachingMinutes:    call.coachingMinutes    ?? 0,
      trainingIdentified: call.trainingIdentified ?? '',
      prospectInfoId:     call.prospectInfoId     ?? '',
    });
    setErr('');
    setEditing(false);
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-card-raised">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
            {MEETING_LABEL[call.meetingType] ?? call.meetingType}
          </span>
          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success-ink">
            {NEEDS_LABEL[call.needCovered] ?? call.needCovered}
          </span>
          <span className="text-[11px] text-ink-muted">
            {call.authorName} · {formatCallDate(call.createdAt)}
          </span>
        </div>
        {isAuthor && !editing && (
          <div className="flex items-center gap-1">
            <button
              onClick={archive}
              disabled={archiving}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
              aria-label="Archive joint call"
            >
              <Archive size={14} />
            </button>
            <button
              onClick={() => setEditing(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-primary hover:bg-primary/10 transition-colors"
              aria-label="Edit joint call"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="text-sm text-ink space-y-1">
          <p className="text-xs text-ink-muted">
            Appointment: {call.appointmentDate || '—'}{call.appointmentTime ? ` · ${call.appointmentTime}` : ''}
            {' · '}
            {call.appointmentKept ? 'Kept' : 'Not kept'}
            {!call.appointmentKept && call.nextMeetingDate ? ` · Next: ${call.nextMeetingDate}` : ''}
            {' · '}
            {call.saleMade ? 'Sale made' : 'No sale'}
            {' · '}
            {`${call.coachingMinutes ?? 0} min coaching`}
          </p>
          {call.comments && (
            <p className="text-sm whitespace-pre-wrap break-words">{call.comments}</p>
          )}
          {call.trainingIdentified && (
            <p className="text-xs text-ink-muted">
              <span className="font-medium">Training: </span>
              <span className="whitespace-pre-wrap break-words">{call.trainingIdentified}</span>
            </p>
          )}
          {call.prospectInfoId && (() => {
            const linked = preps?.find((p) => p.id === call.prospectInfoId);
            return linked ? (
              <p className="text-xs text-ink-muted flex items-center gap-1 pt-0.5">
                <Link2 size={11} className="shrink-0 text-primary" aria-hidden="true" />
                <span className="font-medium text-primary">Prep:</span>
                {linked.clientName || '—'} · {linked.intendedAppointmentDate || '—'}
              </p>
            ) : null;
          })()}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={form.appointmentDate}
              onChange={set('appointmentDate')}
              className="h-9 px-2 rounded-lg border border-border bg-card text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Appointment date"
            />
            <input
              type="time"
              value={form.appointmentTime}
              onChange={set('appointmentTime')}
              className="h-9 px-2 rounded-lg border border-border bg-card text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Appointment time"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.meetingType}
              onChange={set('meetingType')}
              className="h-9 px-2 rounded-lg border border-border bg-card text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Meeting type"
            >
              {MEETING_TYPES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              value={form.needCovered}
              onChange={set('needCovered')}
              className="h-9 px-2 rounded-lg border border-border bg-card text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Need covered"
            >
              {NEEDS_COVERED.map((n) => (
                <option key={n.value} value={n.value}>{n.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={form.appointmentKept} onChange={set('appointmentKept')} />
              <span>Appointment kept</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={form.saleMade} onChange={set('saleMade')} />
              <span>Sale made</span>
            </label>
          </div>
          {!form.appointmentKept && (
            <input
              type="date"
              value={form.nextMeetingDate}
              onChange={set('nextMeetingDate')}
              className="h-9 px-2 rounded-lg border border-border bg-card text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Next meeting date"
            />
          )}
          <textarea
            value={form.comments}
            onChange={set('comments')}
            rows={2}
            maxLength={2000}
            placeholder="Observations…"
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-ink text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Edit comments"
          />
          <input
            type="number"
            min="0"
            step="0.5"
            value={form.coachingMinutes}
            onChange={set('coachingMinutes')}
            className="h-9 px-2 rounded-lg border border-border bg-card text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Coaching minutes"
          />
          <textarea
            value={form.trainingIdentified}
            onChange={set('trainingIdentified')}
            rows={2}
            maxLength={1000}
            placeholder="Training identified…"
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-ink text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Training identified"
          />
          {preps && preps.length > 0 && (
            <div className="relative">
              <label htmlFor={`jc-prep-link-${call.id}`} className="block text-xs text-ink-muted mb-1">
                Link to prospect prep
              </label>
              <select
                id={`jc-prep-link-${call.id}`}
                value={form.prospectInfoId}
                onChange={set('prospectInfoId')}
                className="h-9 pl-2 pr-8 w-full rounded-lg border border-border bg-card text-ink text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                aria-label="Link to prospect prep"
              >
                <option value="">— None —</option>
                {preps.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.clientName || '—'} · {p.intendedAppointmentDate || '—'}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2 top-[28px] text-ink-muted" aria-hidden="true" />
            </div>
          )}
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

const BLANK_FORM = {
  appointmentDate:    '',
  appointmentTime:    '',
  appointmentKept:    true,
  nextMeetingDate:    '',
  meetingType:        'observation',
  needCovered:        'income_protection',
  comments:           '',
  saleMade:           false,
  coachingMinutes:    '',
  trainingIdentified: '',
  prospectInfoId:     '',
};

export default function JointCallsTab({ agentId, agentUnitId }) {
  const { user, userProfile, role, tenantId } = useAuth();
  const [calls, setCalls]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [preps, setPreps]           = useState([]);
  const [prepsError, setPrepsError] = useState('');

  const [form, setForm]             = useState(BLANK_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError]     = useState('');

  const set = (field) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((s) => ({ ...s, [field]: v }));
  };

  useEffect(() => {
    if (!agentId || !role) return;
    setLoading(true);
    setError('');
    getJointCalls({ tenantId, agentId, callerRole: role, callerUid: user?.uid })
      .then(setCalls)
      .catch((err) => {
        console.error('Failed to load joint calls:', err);
        setError('Failed to load joint calls. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [tenantId, agentId, role, user?.uid]);

  useEffect(() => {
    if (!agentId || !role || !tenantId) return;
    setPrepsError('');
    getProspectInfo({ tenantId, agentId, callerRole: role, callerUid: user?.uid })
      .then(setPreps)
      .catch((err) => {
        console.error('Failed to load prospect preps:', err);
        setPrepsError('Failed to load prospect preps. Please try again.');
      });
  }, [tenantId, agentId, role, user?.uid]);

  const handleAdd = useCallback(async (e) => {
    e.preventDefault();
    if (!form.appointmentDate) return;
    setSubmitting(true);
    setAddError('');
    try {
      await addJointCall({
        tenantId,
        agentId,
        agentUnitId,
        authorUid:  user.uid,
        authorName: userProfile?.name ?? userProfile?.email ?? 'Manager',
        authorRole: role,
        ...form,
      });
      setForm(BLANK_FORM);
      const updated = await getJointCalls({
        tenantId, agentId, callerRole: role, callerUid: user?.uid,
      });
      setCalls(updated);
    } catch (err) {
      console.error('Failed to add joint call:', err);
      setAddError('Failed to log joint call — check connection.');
    } finally {
      setSubmitting(false);
    }
  }, [tenantId, agentId, agentUnitId, user, userProfile, role, form]);

  const handleEditSaved = useCallback((updatedCall) => {
    setCalls((prev) => prev.map((c) => (c.id === updatedCall.id ? updatedCall : c)));
  }, []);

  const handleArchived = useCallback((callId) => {
    setCalls((prev) => prev.filter((c) => c.id !== callId));
  }, []);

  return (
    <>
      {/* Call list — scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-0">
        {loading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-border/40 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="p-3 rounded-xl border border-danger/30 bg-danger/10 text-sm text-danger-ink">
            {error}
          </div>
        )}

        {prepsError && (
          <div className="p-3 rounded-xl border border-danger/30 bg-danger/10 text-sm text-danger-ink">
            {prepsError}
          </div>
        )}

        {!loading && !error && calls.filter((c) => !c.archived).length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-ink-muted">
            <Phone size={32} className="opacity-30" aria-hidden="true" />
            <p className="text-sm">No joint-call observations yet.</p>
            <p className="text-xs">Log your first observation below.</p>
          </div>
        )}

        {!loading && !error && calls.filter((c) => !c.archived).map((call) => (
          <CallCard
            key={call.id}
            call={call}
            agentId={agentId}
            isAuthor={call.authorUid === user?.uid}
            onEditSaved={handleEditSaved}
            onArchived={handleArchived}
            preps={preps}
          />
        ))}
      </div>

      {/* Add-call form */}
      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 px-5 py-4 border-t border-border flex-shrink-0 bg-card"
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Appointment date
            <input
              type="date"
              value={form.appointmentDate}
              onChange={set('appointmentDate')}
              required
              className="h-11 px-2 rounded-xl border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Appointment date"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Appointment time
            <input
              type="time"
              value={form.appointmentTime}
              onChange={set('appointmentTime')}
              className="h-11 px-2 rounded-xl border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Appointment time"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Meeting type
            <div className="relative">
              <select
                value={form.meetingType}
                onChange={set('meetingType')}
                className="h-11 pl-3 pr-8 w-full rounded-xl border border-border bg-card text-ink text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                aria-label="Meeting type"
              >
                {MEETING_TYPES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Need covered
            <div className="relative">
              <select
                value={form.needCovered}
                onChange={set('needCovered')}
                className="h-11 pl-3 pr-8 w-full rounded-xl border border-border bg-card text-ink text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                aria-label="Need covered"
              >
                {NEEDS_COVERED.map((n) => (
                  <option key={n.value} value={n.value}>{n.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            </div>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" checked={form.appointmentKept} onChange={set('appointmentKept')} className="h-4 w-4" />
            <span className="text-ink">Appointment kept</span>
          </label>
          <label className="inline-flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" checked={form.saleMade} onChange={set('saleMade')} className="h-4 w-4" />
            <span className="text-ink">Sale made</span>
          </label>
        </div>

        {!form.appointmentKept && (
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Next meeting date
            <input
              type="date"
              value={form.nextMeetingDate}
              onChange={set('nextMeetingDate')}
              className="h-11 px-2 rounded-xl border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Next meeting date"
            />
          </label>
        )}

        <textarea
          value={form.comments}
          onChange={set('comments')}
          placeholder="Observations…"
          rows={3}
          maxLength={2000}
          className="w-full px-3 py-2 rounded-xl border border-border bg-card text-ink text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-ink-muted/60"
          aria-label="Comments"
        />

        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Coaching time (minutes)
          <input
            type="number"
            min="0"
            step="0.5"
            value={form.coachingMinutes}
            onChange={set('coachingMinutes')}
            placeholder="0"
            className="h-11 px-3 rounded-xl border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Coaching minutes"
          />
        </label>

        <textarea
          value={form.trainingIdentified}
          onChange={set('trainingIdentified')}
          placeholder="Training identified…"
          rows={2}
          maxLength={1000}
          className="w-full px-3 py-2 rounded-xl border border-border bg-card text-ink text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-ink-muted/60"
          aria-label="Training identified"
        />

        {preps.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Link to prospect prep (optional)
            <div className="relative">
              <select
                value={form.prospectInfoId}
                onChange={set('prospectInfoId')}
                className="h-11 pl-3 pr-8 w-full rounded-xl border border-border bg-card text-ink text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                aria-label="Link to prospect prep"
              >
                <option value="">— None —</option>
                {preps.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.clientName || '—'} · {p.intendedAppointmentDate || '—'}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            </div>
          </label>
        )}

        {addError && (
          <p className="text-xs text-danger-ink" role="alert">{addError}</p>
        )}

        <button
          type="submit"
          disabled={submitting || !form.appointmentDate}
          className="min-h-[44px] w-full rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Logging…' : 'Log Joint Call'}
        </button>
      </form>
    </>
  );
}

import React, { useEffect, useCallback } from 'react';
import { X, Unlock } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { extractFields } from '../../utils/extractFields';

function formatTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-TT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatWeekLabel(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00Z');
  return `Week of Sunday ${d.toLocaleDateString('en-TT', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

function display(value, format) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number' && value === 0) return '—';
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') return `${Number(value).toFixed(1)}%`;
  return String(value);
}

function Field({ label, value, format }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="text-sm text-ink font-medium">{display(value, format)}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-3 pb-1 border-b border-border">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const submitted = status === 'submitted';
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
      submitted ? 'bg-success/15 text-success-ink' : 'bg-warning/15 text-warning-ink'
    }`}>
      {submitted ? 'Submitted' : 'Draft'}
    </span>
  );
}

export default function SubmissionViewer({ submission: s, onClose }) {
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (!s) return null;

  const f = extractFields(s);
  const totalDials = (parseInt(s.referralCalls) || 0) + (parseInt(s.followUpCalls) || 0) + (parseInt(s.coldCalls) || 0);
  const ciScheduled = (parseInt(s.newCIBooked) || 0) + (parseInt(s.oldCIBooked) || 0);
  const avgPolicySize = f.applicationsSold > 0 ? f.apiSold / f.applicationsSold : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-ink/20"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full z-40 w-96 max-w-full bg-card shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-ink">Submission Details</h2>
            {s.agentName && (
              <p className="text-xs text-ink-muted mt-0.5">{s.agentName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">

          {/* Unlock banner */}
          {s.unlockedBy && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 mb-4">
              <Unlock size={14} className="text-warning-ink mt-0.5 shrink-0" />
              <p className="text-xs text-warning-ink leading-snug">
                Unlocked by <span className="font-semibold">{s.unlockedByName ?? 'a manager'}</span>
                {s.unlockedAt ? ` on ${formatTs(s.unlockedAt)}` : ''}
              </p>
            </div>
          )}

          {/* Section 1 — Week Info */}
          <Section title="Week Info">
            <div className="col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-0.5">Week</p>
              <p className="text-sm font-medium text-ink">{formatWeekLabel(s.weekStarting)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-0.5">Status</p>
              <StatusBadge status={s.status} />
            </div>
            <Field label="Submitted At" value={s.submittedAt ? formatTs(s.submittedAt) : null} />
          </Section>

          {/* Section 2 — Activity */}
          <Section title="Activity">
            <Field label="Referral Calls"   value={s.referralCalls}  />
            <Field label="Follow-up Calls"  value={s.followUpCalls}  />
            <Field label="Cold Calls"       value={s.coldCalls}      />
            <Field label="Total Dials"      value={totalDials || null} />
            <Field label="Tel Contacts"     value={f.telContacts || null} />
            <Field label="F2F Contacts"     value={s.f2fContacts}    />
          </Section>

          {/* Section 3 — Interviews */}
          <Section title="Interviews">
            <Field label="FFI Scheduled"  value={s.ffisScheduled}   />
            <Field label="FFI Conducted"  value={s.ffiConducted}    />
            <Field label="CI Scheduled"   value={ciScheduled || null} />
            <Field label="CI Conducted"   value={s.ciConducted}     />
          </Section>

          {/* Section 4 — Production */}
          <Section title="Production">
            <Field label="Apps Sold"          value={s.applicationsSold}  />
            <Field label="API"                value={f.apiSold}  format="currency" />
            <Field label="Lives Sold"         value={s.livesSold}          />
            <Field label="Avg Policy Size"    value={avgPolicySize || null} format="currency" />
          </Section>

          {/* Section 5 — Persistency */}
          <Section title="Persistency">
            <Field label="Persistency Rate"  value={s.persistencyRate || null} format="percent" />
          </Section>

          {/* Section 6 — Next Week Goals */}
          <Section title="Next Week Goals">
            <Field label="Target Dials"   value={s.targetDials    || null} />
            <Field label="Target FFI"     value={s.targetFFI      || null} />
            <Field label="Target CI"      value={s.targetCI       || null} />
            <Field label="Target Apps"    value={s.targetAppsSold || null} />
            <Field label="Target API"     value={s.targetAPI      || null} format="currency" />
            {s.goalNotes && (
              <div className="col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-0.5">Goal Notes</p>
                <p className="text-sm text-ink leading-snug">{s.goalNotes}</p>
              </div>
            )}
          </Section>

          {/* Self-Evaluation ratings */}
          {(s.ratingOverall || s.overallRating || f.overallRating) ? (
            <Section title="Self-Evaluation">
              <Field label="Planning"         value={f.planningEffectiveness || null} />
              <Field label="Time Management"  value={f.timeManagement        || null} />
              <Field label="Sales"            value={f.salesPerformance      || null} />
              <Field label="Prospecting"      value={f.prospectingEffort     || null} />
              <Field label="Overall"          value={f.overallRating         || null} />
              {f.evaluationNotes && (
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-0.5">Notes</p>
                  <p className="text-sm text-ink leading-snug">{f.evaluationNotes}</p>
                </div>
              )}
            </Section>
          ) : null}

        </div>
      </div>
    </>
  );
}

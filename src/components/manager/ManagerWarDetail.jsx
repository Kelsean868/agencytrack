import React from 'react';
import { ChevronLeft, CheckSquare, Square } from 'lucide-react';
import { getRoleLabel } from '../../utils/formatters';
import { getRoleStandards } from '../../services/managerActivityStandardsService';

export default function ManagerWarDetail({ warData, onBack, standards }) {
  const {
    managerName, managerRole, weekStart, status,
    oneOnOnesConducted, namesSourced, interviewsConducted,
    recruitsInFirstWeeks, trainingSessions, trainingTopic,
    unitMeetingHeld, attendanceCount, dashboardReviewDone,
    jfwCount, personalApi, personalApps,
  } = warData;

  const roleStds = getRoleStandards(standards, managerRole);

  const roleLabel = getRoleLabel(managerRole);
  const hasPersonalProduction = personalApi != null && personalApps != null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronLeft size={20} className="text-text" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-text">{managerName}</h2>
          <p className="text-sm text-text-muted">
            {roleLabel} · {weekStart} ·{' '}
            <span className={status === 'submitted' ? 'text-primary' : 'text-text-muted'}>
              {status === 'submitted' ? 'Submitted' : 'Draft'}
            </span>
          </p>
        </div>
      </div>

      {/* Activities */}
      <div className="bg-card rounded-2xl p-5 space-y-5">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Activities
        </h3>
        <ReadOnlyField label="One-on-One Pipeline Reviews"   value={oneOnOnesConducted} target={roleStds.oneOnOnesConducted} />
        <ReadOnlyField label="Names Sourced"                 value={namesSourced}         target={roleStds.namesSourced} />
        <ReadOnlyField label="Initial Interviews Conducted"  value={interviewsConducted}  target={roleStds.interviewsConducted} />
        <ReadOnlyField label="New Recruits in First Weeks"   value={recruitsInFirstWeeks} target={roleStds.recruitsInFirstWeeks} />
        <ReadOnlyField label="Training Sessions Delivered"   value={trainingSessions}     target={roleStds.trainingSessions} />

        {trainingTopic && (
          <div className="space-y-1">
            <p className="text-xs text-text-muted">Training Topic</p>
            <p className="text-sm text-text">{trainingTopic}</p>
          </div>
        )}

        <ReadOnlyToggle label="Unit / Branch Meeting Held"       checked={Boolean(unitMeetingHeld)}    expected={roleStds.unitMeetingHeld} />
        {unitMeetingHeld && attendanceCount != null && (
          <ReadOnlyField label="Attendance Count" value={attendanceCount} />
        )}
        <ReadOnlyToggle label="Planning & Dashboard Review Done" checked={Boolean(dashboardReviewDone)} expected={roleStds.dashboardReviewDone} />
      </div>

      {/* Personal production — only when fields are present on the WAR doc */}
      {hasPersonalProduction && (
        <div className="bg-card rounded-2xl p-5 space-y-5">
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Personal Production
            </h3>
            <p className="text-xs text-text-muted mt-1">
              Tracked separately — never included in unit totals.
            </p>
          </div>
          <ReadOnlyField label="Personal API (TTD)"    value={personalApi} />
          <ReadOnlyField label="Personal Applications" value={personalApps} />
        </div>
      )}

      {/* JFW — stored value from I1.3a CF */}
      <div className="bg-card-raised rounded-2xl p-4 flex items-center gap-3 min-h-[44px]">
        <div className="text-sm flex-1">
          <span className="font-medium text-text">Joint Field Work (JFW)</span>
          <span className="ml-2 text-text-muted">— from joint-call logs</span>
        </div>
        <ActualTarget actual={jfwCount ?? 0} target={roleStds.jfwCount} ariaLabel="Joint Field Work count" />
      </div>
    </div>
  );
}

// met/under: teal = met, muted = under — informational only, NOT alarm (I3 flag).
function ActualTarget({ actual, target, ariaLabel }) {
  const hasTarget = target != null && Number.isFinite(Number(target)) && Number(target) > 0;
  if (!hasTarget) {
    return (
      <span className="text-sm text-text w-24 text-right" aria-label={`${ariaLabel}: ${actual ?? '—'}`}>
        {actual ?? '—'}
      </span>
    );
  }
  const met = Number(actual) >= Number(target);
  return (
    <span
      className={`text-sm font-semibold w-24 text-right ${met ? 'text-primary' : 'text-text-muted'}`}
      aria-label={`${ariaLabel}: ${actual ?? 0} of ${target}`}
    >
      {actual ?? 0} / {target}
    </span>
  );
}

function ReadOnlyField({ label, value, target }) {
  const hasTarget = target != null && Number.isFinite(Number(target)) && Number(target) > 0;
  const met = hasTarget && Number(value) >= Number(target);
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-text flex-1">{label}</span>
      {hasTarget ? (
        <span
          className={`text-sm font-semibold w-24 text-right ${met ? 'text-primary' : 'text-text-muted'}`}
          aria-label={`${label}: ${value ?? 0} of ${target}`}
        >
          {value ?? 0} / {target}
        </span>
      ) : (
        <span className="text-sm text-text w-24 text-right">{value ?? '—'}</span>
      )}
    </div>
  );
}

function ReadOnlyToggle({ label, checked, expected }) {
  const showBadge = expected === true;
  const met = showBadge && checked === true;
  return (
    <div className="flex items-center gap-3 min-h-[44px]">
      <span className="text-primary shrink-0" aria-hidden="true">
        {checked ? <CheckSquare size={20} /> : <Square size={20} />}
      </span>
      <span className="text-sm font-medium text-text">{label}</span>
      {showBadge && (
        <span
          className={`text-xs font-medium ${met ? 'text-primary' : 'text-text-muted'}`}
          aria-label={met ? 'standard met' : 'standard not met'}
        >
          {met ? '✓ met' : '· expected'}
        </span>
      )}
    </div>
  );
}

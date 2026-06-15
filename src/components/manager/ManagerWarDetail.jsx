import React, { useState } from 'react';
import { ChevronLeft, CheckSquare, Square, Settings } from 'lucide-react';
import { getRoleLabel } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import ManagerOverrideModal from './ManagerOverrideModal';
import { computeMissedActivities } from '../../utils/accountabilityFlag';
import AccountabilityFlagPanel from './AccountabilityFlagPanel';

function warRoleRank(r) {
  return r === 'unit_manager'   ? 1
       : r === 'branch_manager' ? 2
       : r === 'sales_manager'  ? 3
       : r === 'tenant_admin'   ? 4
       : r === 'platform_admin' ? 5 : 0;
}

export default function ManagerWarDetail({ warData, onBack, resolvedStds }) {
  const { user, role: viewerRole, userProfile: viewerProfile, tenantId } = useAuth();
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  const {
    managerId, managerName, managerRole, managerRoleRank, branchId,
    weekStart, status,
    oneOnOnesConducted, namesSourced, interviewsConducted,
    recruitsInFirstWeeks, trainingSessions, trainingTopic,
    unitMeetingHeld, attendanceCount, dashboardReviewDone,
    jfwCount,
  } = warData;

  const stds = resolvedStds ?? {};

  const viewerRank = warRoleRank(viewerRole);
  const isUpline = viewerRank > (managerRoleRank ?? 0)
    && (viewerRank >= 3
        || (viewerRole === 'branch_manager' && viewerProfile?.branchId === branchId));

  const roleLabel = getRoleLabel(managerRole);

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
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-text">{managerName}</h2>
          <p className="text-sm text-text-muted">
            {roleLabel} · {weekStart} ·{' '}
            <span className={status === 'submitted' ? 'text-primary' : 'text-text-muted'}>
              {status === 'submitted' ? 'Submitted' : 'Draft'}
            </span>
          </p>
        </div>
        {isUpline && (
          <button
            type="button"
            onClick={() => setShowOverrideModal(true)}
            aria-label="Set custom standards for this manager"
            className="h-11 px-3 flex items-center gap-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-card transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 shrink-0"
          >
            <Settings size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Custom standards</span>
          </button>
        )}
      </div>

      {/* I3a Tier-1 accountability flag — same panel the owner sees on
           ManagerWarTab; renders nothing when all standards are met. */}
      <AccountabilityFlagPanel
        missed={computeMissedActivities(warData, stds)}
      />

      {/* Activities */}
      <div className="bg-card rounded-2xl p-5 space-y-5">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Activities
        </h3>
        <ReadOnlyField label="One-on-One Pipeline Reviews"   value={oneOnOnesConducted} target={stds.oneOnOnesConducted} />
        <ReadOnlyField label="Names Sourced"                 value={namesSourced}         target={stds.namesSourced} />
        <ReadOnlyField label="Initial Interviews Conducted"  value={interviewsConducted}  target={stds.interviewsConducted} />
        <ReadOnlyField label="New Recruits in First Weeks"   value={recruitsInFirstWeeks} target={stds.recruitsInFirstWeeks} />
        <ReadOnlyField label="Training Sessions Delivered"   value={trainingSessions}     target={stds.trainingSessions} />

        {trainingTopic && (
          <div className="space-y-1">
            <p className="text-xs text-text-muted">Training Topic</p>
            <p className="text-sm text-text">{trainingTopic}</p>
          </div>
        )}

        <ReadOnlyToggle label="Unit / Branch Meeting Held"       checked={Boolean(unitMeetingHeld)}    expected={stds.unitMeetingHeld} />
        {unitMeetingHeld && attendanceCount != null && (
          <ReadOnlyField label="Attendance Count" value={attendanceCount} />
        )}
        <ReadOnlyToggle label="Planning & Dashboard Review Done" checked={Boolean(dashboardReviewDone)} expected={stds.dashboardReviewDone} />
      </div>

      {/* JFW — stored value from I1.3a CF */}
      <div className="bg-card-raised rounded-2xl p-4 flex items-center gap-3 min-h-[44px]">
        <div className="text-sm flex-1">
          <span className="font-medium text-text">Joint Field Work (JFW)</span>
          <span className="ml-2 text-text-muted">— from joint-call logs</span>
        </div>
        <ActualTarget actual={jfwCount ?? 0} target={stds.jfwCount} ariaLabel="Joint Field Work count" />
      </div>

      {showOverrideModal && (
        <ManagerOverrideModal
          tenantId={tenantId}
          managerId={managerId}
          managerName={managerName}
          currentUid={user?.uid}
          onClose={() => setShowOverrideModal(false)}
          onSaved={() => setShowOverrideModal(false)}
        />
      )}
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

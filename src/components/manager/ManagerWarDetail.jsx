import React, { useState } from 'react';
import { ChevronLeft, CheckSquare, Square, Settings, Check, MessageSquare, AlertTriangle, RefreshCw } from 'lucide-react';
import { getRoleLabel } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import ManagerOverrideModal from './ManagerOverrideModal';
import { computeMissedActivities, computeWarCompletion } from '../../utils/accountabilityFlag';
import AccountabilityFlagPanel from './AccountabilityFlagPanel';
import WarCompletionRing from './WarCompletionRing';
import StatusPill from '../ui/StatusPill';
import { reviewWar, warDocId } from '../../services/managerWarService';
import useToast from '../../hooks/useToast';

function warRoleRank(r) {
  return r === 'unit_manager'   ? 1
       : r === 'branch_manager' ? 2
       : r === 'sales_manager'  ? 3
       : r === 'tenant_admin'   ? 4
       : r === 'platform_admin' ? 5 : 0;
}

const REVIEW_META = {
  approved:           { variant: 'success', label: 'Approved' },
  changes_requested:  { variant: 'warning', label: 'Changes requested' },
};

function formatReviewedAt(ts) {
  if (!ts) return '';
  const d = typeof ts.toDate === 'function' ? ts.toDate()
          : ts instanceof Date ? ts
          : new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-TT', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ManagerWarDetail({ warData, onBack, resolvedStds, onReviewed }) {
  const { user, role: viewerRole, userProfile: viewerProfile, tenantId } = useAuth();
  const toast = useToast();
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
  const completion = computeWarCompletion(warData, stds);

  const viewerRank = warRoleRank(viewerRole);
  const isUpline = viewerRank > (managerRoleRank ?? 0)
    && (viewerRank >= 3
        || (viewerRole === 'branch_manager' && viewerProfile?.branchId === branchId));

  // ── Reviewer workflow (item 2.1) ──────────────────────────────────────────
  // Local review state, seeded from the WAR doc, patched in place after a
  // successful review so no reload is needed. Controls only render for a genuine
  // upline caller on a SUBMITTED WAR (same rank/branch gate as the read path).
  const [review, setReview] = useState({
    reviewStatus:   warData.reviewStatus ?? null,
    reviewNote:     warData.reviewNote ?? '',
    reviewedByName: warData.reviewedByName ?? '',
    reviewedAt:     warData.reviewedAt ?? null,
  });
  const [noteInput, setNoteInput]           = useState(warData.reviewNote ?? '');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError]       = useState(false);
  const [lastAction, setLastAction]         = useState(null);

  const canReview = isUpline && status === 'submitted';
  const reviewerName = viewerProfile?.name ?? viewerProfile?.email ?? '';

  const handleReview = async (reviewStatus) => {
    const docId = warData.id || warDocId(managerId, weekStart);
    const note = noteInput.slice(0, 2000);
    setLastAction(reviewStatus);
    setReviewError(false);
    setSubmittingReview(true);
    try {
      await reviewWar(tenantId, docId, {
        status: reviewStatus, note, reviewerUid: user?.uid, reviewerName,
      });
      const updated = {
        reviewStatus, reviewNote: note, reviewedByName: reviewerName, reviewedAt: new Date(),
      };
      setReview(updated);
      onReviewed?.(docId, updated);
      toast.show({
        variant: 'success',
        message: reviewStatus === 'approved' ? 'WAR approved.' : 'Changes requested.',
      });
    } catch (err) {
      console.error('[ManagerWarDetail] review failed:', err);
      setReviewError(true);
      toast.show({ variant: 'error', message: 'Review failed. Please try again.' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const reviewMeta = review.reviewStatus ? REVIEW_META[review.reviewStatus] : null;
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
        <WarCompletionRing
          pct={completion.pct}
          met={completion.met}
          total={completion.total}
          size={48}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold text-text">{managerName}</h2>
            {status === 'submitted' && (
              reviewMeta
                ? <StatusPill variant={reviewMeta.variant} label={reviewMeta.label} />
                : <StatusPill variant="primary" label="To review" />
            )}
          </div>
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

      {/* Current review state — shown whenever a review exists (item 2.1) */}
      {reviewMeta && (
        <div
          className="bg-card rounded-2xl p-5 space-y-3"
          data-testid="war-review-state"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Review
            </h3>
            <StatusPill variant={reviewMeta.variant} label={reviewMeta.label} />
          </div>
          <p className="text-xs text-text-muted">
            {review.reviewedByName ? `Reviewed by ${review.reviewedByName}` : 'Reviewed'}
            {formatReviewedAt(review.reviewedAt) ? ` · ${formatReviewedAt(review.reviewedAt)}` : ''}
          </p>
          {review.reviewNote && (
            <p className="text-sm text-text whitespace-pre-wrap">{review.reviewNote}</p>
          )}
        </div>
      )}

      {/* Reviewer controls — upline caller on a submitted WAR (item 2.1) */}
      {canReview && (
        <div
          className="bg-card rounded-2xl p-5 space-y-4"
          data-testid="war-review-controls"
        >
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Leader&apos;s note
          </h3>
          <div className="space-y-1">
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value.slice(0, 2000))}
              maxLength={2000}
              rows={3}
              disabled={submittingReview}
              aria-label="Leader's note"
              placeholder="Optional note to the manager (visible on their report)…"
              className="w-full px-3 py-2 rounded-lg bg-card-raised border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            />
            <p className="text-xs text-text-muted text-right tabular-nums" aria-live="polite">
              {noteInput.length}/2000
            </p>
          </div>

          {reviewError && (
            <div
              role="alert"
              className="flex flex-col gap-3 p-4 rounded-xl bg-danger/10 border border-danger/30"
              data-testid="war-review-error"
            >
              <p className="flex items-center gap-2 text-sm text-danger-ink font-medium">
                <AlertTriangle size={16} aria-hidden="true" />
                Review failed — check your connection and try again.
              </p>
              <button
                type="button"
                onClick={() => lastAction && handleReview(lastAction)}
                disabled={submittingReview}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors disabled:opacity-60"
              >
                <RefreshCw size={15} aria-hidden="true" />
                Retry
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => handleReview('approved')}
              disabled={submittingReview}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Check size={16} aria-hidden="true" />
              {submittingReview && lastAction === 'approved' ? 'Approving…' : 'Approve WAR'}
            </button>
            <button
              type="button"
              onClick={() => handleReview('changes_requested')}
              disabled={submittingReview}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-card border border-border text-ink text-sm font-semibold hover:bg-card-raised transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <MessageSquare size={16} aria-hidden="true" />
              {submittingReview && lastAction === 'changes_requested' ? 'Requesting…' : 'Request changes'}
            </button>
          </div>
        </div>
      )}

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

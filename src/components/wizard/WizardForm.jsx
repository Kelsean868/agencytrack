import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Check, AlertTriangle, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { saveDraft, submitReport, getDraft, getLastSubmission } from '../../services/submissionService';
import { getLastNSundaysForDropdown } from '../../utils/dateHelpers';
import { formatCurrency, formatDateFriendly, formatDateDisplay } from '../../utils/formatters';
import {
  computeLumpsumCredit,
  computeLumpsumCommission,
  computeTotalProductionCredit,
  computeTotalCommission,
} from '../../lib/schema/weeklyReport.computations';
import SubmissionViewer from '../submissions/SubmissionViewer';
import Step1Prospecting      from './steps/Step1Prospecting';
import Step2Telephone        from './steps/Step2Telephone';
import Step3Approaches       from './steps/Step3Approaches';
import Step4ClosingSales      from './steps/Step4ClosingSales';
import Step5NewNames          from './steps/Step5NewNames';
import Step6DeliveriesService from './steps/Step6DeliveriesService';
import Step7TimeManagement    from './steps/Step7TimeManagement';
import Step8SelfEvaluation    from './steps/Step8SelfEvaluation';
import Step9Goals             from './steps/Step9Goals';

const MAX_AUTOSAVE_RETRIES = 3;

// 9 step components grouped into 5 screens.
// Each entry in `components` is [Component, needsLastWeekData].
const SCREENS = [
  {
    title: 'Prospecting & Calls',
    components: [
      [Step1Prospecting, false],
      [Step2Telephone,   false],
    ],
  },
  {
    title: 'Interviews & Sales',
    components: [
      [Step3Approaches,  false],
      [Step4ClosingSales, false],
    ],
  },
  {
    title: 'New Names & Service',
    components: [
      [Step5NewNames,          true],
      [Step6DeliveriesService, true],
    ],
  },
  {
    title: 'Time & Reflection',
    components: [
      [Step7TimeManagement, false],
      [Step8SelfEvaluation, false],
    ],
  },
  {
    title: 'Next Week Goals',
    components: [
      [Step9Goals, false],
    ],
  },
];

const TOTAL_SCREENS = SCREENS.length; // 5

const INITIAL_DATA = {
  // Step 1
  prospectingLettersSent:       0,
  prospectingEmailsSent:        0,
  seminarsConducted:            0,
  namesFromSeminarsConducted:   0,
  seminarsAttended:             0,
  namesFromSeminarsAttended:    0,
  tradeshowsConducted:          0,
  namesFromTradeshowsConducted: 0,
  tradeshowsAttended:           0,
  namesFromTradeshowsAttended:  0,
  f2fAttempts:                  0,
  f2fContacts:                  0,
  // Step 2
  referralCalls:                0,
  followUpCalls:                0,
  coldCalls:                    0,
  seminarTradeshowCalls:        0,
  serviceCalls:                 0,
  // Step 3
  qualifiedApproaches:          0,
  appointmentsSet:              0,
  ffisScheduled:                0,
  ffiConducted:                 0,
  solutionPresentations:        0,
  // Step 4
  newCIBooked:                  0,
  oldCIBooked:                  0,
  ciConducted:                  0,
  livesSold:                    0,
  newBusiness:    { apps: 0, api: 0 },
  pppIncreases:   { apps: 0, apiIncrease: 0 },
  lumpsums:       { grossAmount: 0 },
  // Step 5
  referralsSought:              0,
  referralsObtained:            0,
  namesFromColdCanvass:         0,
  namesFromOther:               0,
  oldNamesPool:                 0,
  portfolioClientsIdentified:   0,
  // Step 6
  policiesReceived:             0,
  policiesDelivered:            0,
  policiesOutstanding:          0,
  hasServiceWork:               false,
  serviceContacts:              0,
  premiumCollectionMeetings:    0,
  withdrawalsLoans:             0,
  surrenders:                   0,
  policyChanges:                0,
  annualReviews:                0,
  orphanReviews:                0,
  orphansAdopted:               0,
  reinstatementsSubmitted:      0,
  reinstatementAPI:             0,
  renewalPremiumsCollected:     0,
  // Step 7
  officeHours:                  0,
  fieldHours:                   0,
  // Step 8
  ratingPlanning:               0,
  ratingTimeManagement:         0,
  ratingSalesPerformance:       0,
  ratingProspecting:            0,
  ratingOverall:                0,
  notes:                        '',
  // Step 9
  targetDials:                  0,
  targetTelContacts:            0,
  targetF2FAttempts:            0,
  targetFFI:                    0,
  targetCI:                     0,
  targetAppsSold:               0,
  targetAPI:                    0,
  goalNotes:                    '',
};

// screen: 'date' | 'step' | 'review' | 'done' | 'submitted'
export default function WizardForm({ onClose, initialWeek }) {
  const { user, userProfile } = useAuth();
  const agentName = userProfile?.name ?? userProfile?.email ?? '';
  const [screen, setScreen]             = useState(initialWeek ? 'step' : 'date');
  const [weekStarting, setWeekStarting] = useState(initialWeek ?? '');
  const [localWeekChoice, setLocalWeekChoice] = useState(
    () => initialWeek ?? getLastNSundaysForDropdown(1)[0]?.value ?? ''
  );
  const [step, setStep]                 = useState(1);   // 1–5 grouped screens
  const [formData, setFormData]         = useState(INITIAL_DATA);
  const [lastWeekData, setLastWeekData] = useState(null);
  const [draftStatus, setDraftStatus]   = useState(null);
  const [submissionData, setSubmissionData] = useState(null);
  const [viewingSubmission, setViewingSubmission] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState(false);
  const [savedAt, setSavedAt]           = useState(null);
  const [isOffline, setIsOffline]       = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [saveEscalated, setSaveEscalated] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const saveTimer = useRef(null);
  const savedTimer = useRef(null);
  const consecutiveFailures = useRef(0);
  const doSave = useRef(null);

  const dropdownOptions = useMemo(() => {
    const opts = getLastNSundaysForDropdown(6);
    if (initialWeek && !opts.find((o) => o.value === initialWeek)) {
      opts.push({ value: initialWeek, label: formatDateFriendly(initialWeek) });
    }
    return opts;
  }, [initialWeek]);

  useEffect(() => {
    if (!user) return;
    getLastSubmission(user.uid).then(setLastWeekData).catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!weekStarting || !user) return;
    getDraft(user.uid, weekStarting)
      .then((draft) => {
        if (!draft) {
          setDraftStatus(null);
          setSubmissionData(null);
          return;
        }
        const { agentId: _agentId, weekStarting: _ws, status, updatedAt: _updatedAt, submittedAt: _submittedAt, ...fields } = draft;
        setDraftStatus(status ?? null);
        if (status === 'submitted') {
          setSubmissionData(draft);
          setScreen('submitted');
        } else {
          setSubmissionData(null);
          setFormData((prev) => ({ ...prev, ...fields }));
        }
      })
      .catch(console.error);
  }, [weekStarting, user]);

  // Always-current save executor — assigned on every render so the online
  // handler and the retry button always capture the latest closure values.
  doSave.current = async () => {
    if (!weekStarting || !user || draftStatus === 'submitted') return;
    setSaving(true);
    setSaveError(false);
    try {
      await saveDraft(user.uid, agentName, weekStarting, formData, userProfile?.commissionRate ?? 0);
      consecutiveFailures.current = 0;
      setSaveEscalated(false);
      clearTimeout(savedTimer.current);
      setSavedAt(new Date());
      savedTimer.current = setTimeout(() => setSavedAt(null), 3000);
    } catch (err) {
      console.error('Auto-save failed:', err);
      consecutiveFailures.current += 1;
      setSaveError(true);
      if (consecutiveFailures.current >= MAX_AUTOSAVE_RETRIES) setSaveEscalated(true);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save on formData change AND on screen/step change (debounced 1500ms)
  useEffect(() => {
    if (!weekStarting || !user || screen === 'date') return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => { await doSave.current(); }, 1500);
    return () => clearTimeout(saveTimer.current);
  }, [formData, step, weekStarting, screen, user, draftStatus]);

  // Online / offline detection — update isOffline and re-fire save on reconnect
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      clearTimeout(saveTimer.current);
      doSave.current();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleChange = useCallback((name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleManualSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    doSave.current();
  }, []);

  const handleDateSelect = (date) => {
    setWeekStarting(date);
    setStep(1);
    setScreen('step');
    setError('');
  };

  const resetToDatePicker = () => {
    setViewingSubmission(false);
    setScreen('date');
    setWeekStarting('');
    setDraftStatus(null);
    setSubmissionData(null);
    setFormData(INITIAL_DATA);
    setStep(1);
    setError('');
  };

  const submittedAtLabel = (() => {
    const ts = submissionData?.submittedAt;
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return formatDateDisplay(`${yyyy}-${mm}-${dd}`);
  })();

  const handleNext = () => {
    if (step < TOTAL_SCREENS) setStep((s) => s + 1);
    else setScreen('review');
  };

  const handleBack = () => {
    if (screen === 'review')                  { setScreen('step'); setStep(TOTAL_SCREENS); }
    else if (screen === 'step' && step > 1)   { setStep((s) => s - 1); }
    else if (screen === 'step' && step === 1) { setScreen('date'); }
  };

  const handleSubmit = async () => {
    setError('');
    if (draftStatus === 'submitted') {
      setError("This week's report has already been submitted and cannot be changed.");
      return;
    }
    setSubmitting(true);
    try {
      await submitReport(user.uid, agentName, weekStarting, formData, userProfile?.commissionRate ?? 0);
      setDraftStatus('submitted');
      setScreen('done');
    } catch (e) {
      setError('Submission failed. Please try again.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const prevLabel = screen === 'review' ? 'Back' : step === 1 ? 'Change week' : 'Prev';
  const nextLabel = screen === 'review'
    ? (submitting ? 'Submitting…' : 'Submit Report')
    : step === TOTAL_SCREENS ? 'Review' : 'Next';

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 bg-bg shrink-0">
        <div>
          <p className="text-xs font-medium text-ink-muted">
            {screen === 'step'      && `Screen ${step} of ${TOTAL_SCREENS}`}
            {screen === 'review'    && 'Review'}
            {screen === 'date'      && 'Weekly Report'}
            {screen === 'done'      && 'Complete'}
            {screen === 'submitted' && 'Weekly Report'}
          </p>
          <h1 className="text-lg font-bold text-ink leading-tight">
            {screen === 'date'      && 'Select Week'}
            {screen === 'step'      && SCREENS[step - 1].title}
            {screen === 'review'    && 'Review & Submit'}
            {screen === 'done'      && 'Report Submitted'}
            {screen === 'submitted' && 'Already submitted'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <SaveStatusIndicator
            saving={saving}
            savedAt={savedAt}
            saveError={saveError}
            isOffline={isOffline}
            onRetry={handleManualSave}
          />
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface text-ink-muted transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* 5-dot progress bar */}
      {screen === 'step' && (
        <div className="flex gap-1.5 px-4 pb-3 shrink-0">
          {SCREENS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i + 1 === step
                  ? 'bg-primary flex-[2]'
                  : i + 1 < step
                  ? 'bg-primary/40 flex-1'
                  : 'bg-border flex-1'
              }`}
            />
          ))}
        </div>
      )}

      {/* Persistent-failure escalation banner */}
      {saveEscalated && screen !== 'date' && screen !== 'done' && screen !== 'submitted' && (
        <div
          role="alert"
          className="mx-4 mb-2 px-4 py-3 rounded-xl bg-warning-tint border border-warning/30 flex items-start gap-3 shrink-0"
        >
          <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-ink flex-1">
            Couldn&apos;t save your work. Don&apos;t close this window — your typing is safe. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={handleManualSave}
            className="h-11 px-3 rounded-lg bg-warning text-white text-sm font-semibold hover:opacity-90 transition-opacity shrink-0"
          >
            Try now
          </button>
        </div>
      )}

      {/* Body */}
      <main className="flex-1 overflow-y-auto">

        {/* Date picker */}
        {screen === 'date' && (
          <div className="px-4 py-4 max-w-lg mx-auto">
            <label htmlFor="wizard-week" className="block text-sm text-ink-muted mb-4">
              Select the Sunday this reporting week starts on.
            </label>
            <select
              id="wizard-week"
              value={localWeekChoice}
              onChange={(e) => { setLocalWeekChoice(e.target.value); setError(''); }}
              className="w-full h-11 px-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 mb-4"
            >
              {dropdownOptions.map((opt, i) => (
                <option key={opt.value} value={opt.value}>
                  {i === 0 ? `This week — ${opt.label}` : opt.label}
                </option>
              ))}
            </select>
            {error && <p className="text-xs text-danger mb-3">{error}</p>}
            <button
              type="button"
              onClick={() => handleDateSelect(localWeekChoice)}
              className="btn-primary w-full h-11"
            >
              Start Report
            </button>
          </div>
        )}

        {/* Grouped step screens */}
        {screen === 'step' && (
          <div className="px-4 pb-6 max-w-lg mx-auto">
            {SCREENS[step - 1].components.map(([Component, needsLastWeek], i) => (
              <div key={i}>
                {i > 0 && (
                  <hr className="border-t border-[var(--color-border)] my-6" />
                )}
                <Component
                  data={formData}
                  onChange={handleChange}
                  {...(needsLastWeek ? { lastWeekData } : {})}
                />
              </div>
            ))}
          </div>
        )}

        {/* Review */}
        {screen === 'review' && (
          <div className="px-4 py-4 max-w-lg mx-auto">
            <ReviewSummary data={formData} weekStarting={weekStarting} />
            <ProductionSummaryPanel
              data={formData}
              commissionRate={userProfile?.commissionRate ?? 0}
            />
            {error && <p className="text-sm text-danger mt-4">{error}</p>}
          </div>
        )}

        {/* Already submitted — interstitial */}
        {screen === 'submitted' && (
          <div className="px-4 py-4 max-w-lg mx-auto">
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-sm">
              <h2 className="text-lg font-bold text-ink mb-2">Already submitted</h2>
              <p className="text-sm text-ink-muted leading-relaxed mb-5">
                You submitted this week
                {submittedAtLabel ? ` on ${submittedAtLabel}` : ''}.
                Submitted weeks can&apos;t be edited. You can view what you submitted,
                or pick a different week.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setViewingSubmission(true)}
                  className="btn-primary w-full h-11"
                >
                  View Submission
                </button>
                <button
                  type="button"
                  onClick={resetToDatePicker}
                  className="w-full h-11 rounded-xl border border-border bg-[var(--color-surface)] text-ink font-semibold text-sm hover:bg-surface transition-colors"
                >
                  Pick Different Week
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Done */}
        {screen === 'done' && (
          <div className="px-4 py-6 max-w-lg mx-auto flex flex-col items-center text-center pt-16">
            <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mb-4">
              <Check size={32} className="text-success" />
            </div>
            <h2 className="text-xl font-bold text-ink mb-2">Report Submitted!</h2>
            <p className="text-sm text-ink-muted mb-8">
              Your weekly report for {formatDateFriendly(weekStarting)} has been submitted successfully.
            </p>
            <button type="button" onClick={onClose} className="btn-primary w-full max-w-xs">
              Back to Dashboard
            </button>
          </div>
        )}
      </main>

      {/* Submission viewer overlay (reused as-is from History tab) */}
      {viewingSubmission && submissionData && (
        <SubmissionViewer
          submission={submissionData}
          onClose={resetToDatePicker}
        />
      )}

      {/* Footer nav */}
      {(screen === 'step' || screen === 'review') && (
        <footer className="grid grid-cols-5 gap-2 px-4 py-4 border-t border-border bg-[var(--color-surface)] shrink-0">
          <button
            type="button"
            onClick={handleBack}
            className="col-span-2 h-11 rounded-xl border border-border bg-[var(--color-surface)] text-ink font-semibold text-sm hover:bg-surface transition-colors"
          >
            {prevLabel}
          </button>
          <button
            type="button"
            onClick={screen === 'review' ? handleSubmit : handleNext}
            disabled={submitting}
            className="col-span-3 h-11 rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm hover:bg-primary/90 dark:hover:bg-primary transition-colors disabled:opacity-60"
          >
            {nextLabel}
          </button>
        </footer>
      )}
    </div>
  );
}

// ─── Save status indicator ────────────────────────────────────────────────────

function SaveStatusIndicator({ saving, savedAt, saveError, isOffline, onRetry }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="flex items-center">
      {saving && (
        <span className="text-xs text-ink-muted animate-pulse">Saving…</span>
      )}
      {!saving && savedAt && isOffline && (
        <span className="flex items-center gap-1 text-xs text-warning">
          <Check size={13} />
          Saved offline — will sync when reconnected
        </span>
      )}
      {!saving && savedAt && !isOffline && (
        <span className="flex items-center gap-1 text-xs text-success">
          <Check size={13} />
          Saved
        </span>
      )}
      {!saving && !savedAt && isOffline && (
        <span className="text-xs text-warning">Offline — will save when reconnected</span>
      )}
      {!saving && !savedAt && !isOffline && saveError && (
        <span role="alert" className="flex items-center gap-1 text-xs text-danger">
          <AlertTriangle size={13} />
          Save failed — tap to retry
          <button
            type="button"
            onClick={onRetry}
            className="h-11 px-2 flex items-center gap-1 text-xs font-semibold text-danger border border-danger/30 rounded-lg hover:bg-danger-tint transition-colors ml-1"
            aria-label="Retry save"
          >
            <RotateCcw size={12} />
            Retry
          </button>
        </span>
      )}
    </div>
  );
}

// ─── Production summary panel ────────────────────────────────────────────────

function ProductionSummaryPanel({ data, commissionRate }) {
  const nb   = data.newBusiness  ?? {};
  const ppp  = data.pppIncreases ?? {};
  const lmps = data.lumpsums     ?? {};

  const nbApi       = parseFloat(nb.api) || 0;
  const nbApps      = parseInt(nb.apps, 10) || 0;
  const pppApps     = parseInt(ppp.apps, 10) || 0;
  const pppInc      = parseFloat(ppp.apiIncrease) || 0;
  const lmpsGross   = parseFloat(lmps.grossAmount) || 0;
  const lmpsCredit  = computeLumpsumCredit(lmpsGross);
  const lmpsComm    = computeLumpsumCommission(lmpsGross);

  const productionShape = {
    newBusiness:  { api: nbApi },
    pppIncreases: { apiIncrease: pppInc },
    lumpsums:     { apiCredit: lmpsCredit },
  };
  const totalCredit = computeTotalProductionCredit(productionShape);
  const rateDecimal = (parseFloat(commissionRate) || 0) / 100;
  const totalComm   = computeTotalCommission(
    { ...productionShape, lumpsums: { apiCredit: lmpsCredit, commission: lmpsComm } },
    rateDecimal
  );

  const hasPpp  = pppApps > 0 || pppInc > 0;
  const hasLmps = lmpsGross > 0;

  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-border/60 p-4 mb-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">
        Production this week
      </h3>

      {/* Production rows */}
      <div className="flex justify-between py-2 border-b border-border/50">
        <span className="text-sm text-ink-muted">New Business</span>
        <span className="text-sm font-semibold text-ink">
          {nbApps} {nbApps === 1 ? 'app' : 'apps'} · {formatCurrency(nbApi)}
        </span>
      </div>
      {hasPpp && (
        <div className="flex justify-between py-2 border-b border-border/50">
          <span className="text-sm text-ink-muted">PPP Increases</span>
          <span className="text-sm font-semibold text-ink">
            {pppApps} {pppApps === 1 ? 'increase' : 'increases'} · {formatCurrency(pppInc)}
          </span>
        </div>
      )}
      {hasLmps && (
        <div className="flex justify-between py-2 border-b border-border/50">
          <span className="text-sm text-ink-muted">Lumpsum (10% of {formatCurrency(lmpsGross)})</span>
          <span className="text-sm font-semibold text-ink">{formatCurrency(lmpsCredit)}</span>
        </div>
      )}
      <div className="flex justify-between py-2">
        <span className="text-sm font-semibold text-ink">Total Production API</span>
        <span className="text-sm font-bold text-primary">{formatCurrency(totalCredit)}</span>
      </div>

      {/* Commission rows */}
      {commissionRate > 0 && (
        <>
          <div className="border-t border-border/60 mt-1 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
              Estimated commission
            </h3>
            <div className="flex justify-between py-1.5 border-b border-border/40">
              <span className="text-sm text-ink-muted">
                New Business ({commissionRate}%)
              </span>
              <span className="text-sm font-semibold text-ink">{formatCurrency(nbApi * rateDecimal)}</span>
            </div>
            {hasLmps && (
              <div className="flex justify-between py-1.5 border-b border-border/40">
                <span className="text-sm text-ink-muted">Lumpsum (0.5% × {formatCurrency(lmpsGross)})</span>
                <span className="text-sm font-semibold text-ink">{formatCurrency(lmpsComm)}</span>
              </div>
            )}
            {hasPpp && (
              <div className="flex justify-between py-1.5 border-b border-border/40">
                <span className="text-sm text-ink-muted italic">PPP — production credit only</span>
                <span className="text-sm text-ink-muted">—</span>
              </div>
            )}
            <div className="flex justify-between py-2 mt-0.5">
              <span className="text-sm font-semibold text-ink">Estimated commission earned</span>
              <span className="text-sm font-bold text-primary">{formatCurrency(totalComm)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Review helpers ───────────────────────────────────────────────────────────

function ReviewRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-semibold text-ink text-right max-w-[55%]">{value}</span>
    </div>
  );
}

function ReviewSection({ title, children }) {
  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-border/60 p-4 mb-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ReviewSummary({ data, weekStarting: _weekStarting }) {
  const totalCalls =
    (data.referralCalls ?? 0) + (data.followUpCalls ?? 0) + (data.coldCalls ?? 0) +
    (data.seminarTradeshowCalls ?? 0) + (data.serviceCalls ?? 0);

  const totalNames =
    (data.referralsObtained ?? 0) +
    (data.namesFromSeminarsConducted ?? 0) + (data.namesFromSeminarsAttended ?? 0) +
    (data.namesFromTradeshowsConducted ?? 0) + (data.namesFromTradeshowsAttended ?? 0) +
    (data.namesFromColdCanvass ?? 0) + (data.namesFromOther ?? 0);

  const totalHours = (data.officeHours ?? 0) + (data.fieldHours ?? 0);

  return (
    <div>
      <p className="text-sm text-ink-muted mb-4">
        Check your numbers before submitting. You can go back to edit any screen.
      </p>

      <ReviewSection title="Screen 1 — Prospecting & Calls">
        <ReviewRow label="Letters Sent"                    value={data.prospectingLettersSent} />
        <ReviewRow label="Emails Sent"                     value={data.prospectingEmailsSent} />
        <ReviewRow label="Seminars Conducted"              value={data.seminarsConducted} />
        <ReviewRow label="Names (Seminars Conducted)"      value={data.namesFromSeminarsConducted} />
        <ReviewRow label="Seminars Attended"               value={data.seminarsAttended} />
        <ReviewRow label="Names (Seminars Attended)"       value={data.namesFromSeminarsAttended} />
        <ReviewRow label="Tradeshows Conducted"            value={data.tradeshowsConducted} />
        <ReviewRow label="Names (Tradeshows Conducted)"    value={data.namesFromTradeshowsConducted} />
        <ReviewRow label="Tradeshows Attended"             value={data.tradeshowsAttended} />
        <ReviewRow label="Names (Tradeshows Attended)"     value={data.namesFromTradeshowsAttended} />
        <ReviewRow label="F2F Attempts"                    value={data.f2fAttempts} />
        <ReviewRow label="F2F Contacts"                    value={data.f2fContacts} />
        <ReviewRow label="Referral Calls"                  value={data.referralCalls} />
        <ReviewRow label="Follow-Up Calls"                 value={data.followUpCalls} />
        <ReviewRow label="Cold Calls"                      value={data.coldCalls} />
        <ReviewRow label="Seminar / Tradeshow Calls"       value={data.seminarTradeshowCalls} />
        <ReviewRow label="Service Calls"                   value={data.serviceCalls} />
        <ReviewRow label="Total Calls"                     value={totalCalls} />
      </ReviewSection>

      <ReviewSection title="Screen 2 — Interviews & Sales">
        <ReviewRow label="Qualified Approaches"   value={data.qualifiedApproaches} />
        <ReviewRow label="Appointments Set"       value={data.appointmentsSet} />
        <ReviewRow label="FFIs Scheduled"         value={data.ffisScheduled} />
        <ReviewRow label="FFIs Conducted"         value={data.ffiConducted} />
        <ReviewRow label="Solution Presentations" value={data.solutionPresentations} />
        <ReviewRow label="New CI Booked"          value={data.newCIBooked} />
        <ReviewRow label="Old CI Booked"          value={data.oldCIBooked} />
        <ReviewRow label="CI Conducted"           value={data.ciConducted} />
        <ReviewRow label="NB Apps Written"          value={data.newBusiness?.apps ?? 0} />
        <ReviewRow label="Lives Sold"             value={data.livesSold} />
        <ReviewRow label="NB API (TTD)"           value={formatCurrency(data.newBusiness?.api ?? 0)} />
        {(data.pppIncreases?.apps > 0 || data.pppIncreases?.apiIncrease > 0) && <>
          <ReviewRow label="PPP Increases"        value={data.pppIncreases?.apps ?? 0} />
          <ReviewRow label="PPP Total API Inc."   value={formatCurrency(data.pppIncreases?.apiIncrease ?? 0)} />
        </>}
        {(data.lumpsums?.grossAmount > 0) && <>
          <ReviewRow label="Lumpsum Gross"        value={formatCurrency(data.lumpsums?.grossAmount ?? 0)} />
        </>}
      </ReviewSection>

      <ReviewSection title="Screen 3 — New Names & Service">
        <ReviewRow label="Referrals Sought"             value={data.referralsSought} />
        <ReviewRow label="Referrals Obtained"           value={data.referralsObtained} />
        <ReviewRow label="Names from Cold Canvass"      value={data.namesFromColdCanvass} />
        <ReviewRow label="Names from Other Sources"     value={data.namesFromOther} />
        <ReviewRow label="Old Names Pool"               value={data.oldNamesPool} />
        <ReviewRow label="Portfolio Clients Identified" value={data.portfolioClientsIdentified} />
        <ReviewRow label="New Names Added"              value={totalNames} />
        <ReviewRow label="Policies Received"            value={data.policiesReceived} />
        <ReviewRow label="Policies Delivered"           value={data.policiesDelivered} />
        <ReviewRow label="Policies Outstanding"         value={data.policiesOutstanding} />
      </ReviewSection>

      {data.hasServiceWork && (
        <ReviewSection title="Screen 3 — Service Work">
          <ReviewRow label="Service Contacts"            value={data.serviceContacts} />
          <ReviewRow label="Premium Collection Meetings" value={data.premiumCollectionMeetings} />
          <ReviewRow label="Withdrawal & Loan Requests"  value={data.withdrawalsLoans} />
          <ReviewRow label="Surrender Requests"          value={data.surrenders} />
          <ReviewRow label="Policy Change Forms"         value={data.policyChanges} />
          <ReviewRow label="Annual Reviews"              value={data.annualReviews} />
          <ReviewRow label="Orphan Reviews"              value={data.orphanReviews} />
          <ReviewRow label="Orphans Adopted"             value={data.orphansAdopted} />
          <ReviewRow label="Reinstatements Submitted"    value={data.reinstatementsSubmitted} />
          <ReviewRow label="Service API Reinstated"      value={formatCurrency(data.reinstatementAPI)} />
          <ReviewRow label="Renewal Premiums Collected"  value={formatCurrency(data.renewalPremiumsCollected)} />
        </ReviewSection>
      )}

      <ReviewSection title="Screen 4 — Time & Reflection">
        <ReviewRow label="Office Hours"     value={`${data.officeHours}h`} />
        <ReviewRow label="Field Hours"      value={`${data.fieldHours}h`} />
        <ReviewRow label="Total Hours"      value={`${totalHours}h`} />
        <ReviewRow label="Planning"         value={`${data.ratingPlanning}/10`} />
        <ReviewRow label="Time Management"  value={`${data.ratingTimeManagement}/10`} />
        <ReviewRow label="Sales Performance" value={`${data.ratingSalesPerformance}/10`} />
        <ReviewRow label="Prospecting"      value={`${data.ratingProspecting}/10`} />
        <ReviewRow label="Overall"          value={`${data.ratingOverall}/10`} />
        {data.notes && <ReviewRow label="Notes" value={data.notes} />}
      </ReviewSection>

      <ReviewSection title="Screen 5 — Next Week Goals">
        <ReviewRow label="Target Dials"        value={data.targetDials} />
        <ReviewRow label="Target Tel Contacts" value={data.targetTelContacts} />
        <ReviewRow label="Target F2F Attempts" value={data.targetF2FAttempts} />
        <ReviewRow label="Target FFI"          value={data.targetFFI} />
        <ReviewRow label="Target CI"           value={data.targetCI} />
        <ReviewRow label="Target Apps Sold"    value={data.targetAppsSold} />
        <ReviewRow label="Target API"          value={formatCurrency(data.targetAPI)} />
        {data.goalNotes && <ReviewRow label="Goal Notes" value={data.goalNotes} />}
      </ReviewSection>
    </div>
  );
}

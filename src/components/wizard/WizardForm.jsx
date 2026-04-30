import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { saveDraft, submitReport, getDraft, getLastSubmission } from '../../services/submissionService';
import { validateSundayDate, getRecentSundays, formatDateLabel } from '../../utils/validators';
import { formatCurrency } from '../../utils/formatters';
import Step1Prospecting      from './steps/Step1Prospecting';
import Step2Telephone        from './steps/Step2Telephone';
import Step3Approaches       from './steps/Step3Approaches';
import Step4ClosingSales      from './steps/Step4ClosingSales';
import Step5NewNames          from './steps/Step5NewNames';
import Step6DeliveriesService from './steps/Step6DeliveriesService';
import Step7TimeManagement    from './steps/Step7TimeManagement';
import Step8SelfEvaluation    from './steps/Step8SelfEvaluation';
import Step9Goals             from './steps/Step9Goals';

const STEPS = [
  { title: 'Prospecting',                component: Step1Prospecting },
  { title: 'Telephone Activity',         component: Step2Telephone },
  { title: 'Approaches & FFI',           component: Step3Approaches },
  { title: 'Closing Interviews & Sales', component: Step4ClosingSales },
  { title: 'New Names & Pipeline',       component: Step5NewNames },
  { title: 'Deliveries & Service',       component: Step6DeliveriesService },
  { title: 'Time Management',            component: Step7TimeManagement },
  { title: 'Self-Evaluation',            component: Step8SelfEvaluation },
  { title: 'Next Week Goals',            component: Step9Goals },
];

const TOTAL_STEPS = STEPS.length;

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
  applicationsSold:             0,
  livesSold:                    0,
  apiSold:                      0,
  estimatedCommissions:         0,
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

// screen: 'date' | 'step' | 'review' | 'done'
export default function WizardForm({ onClose }) {
  const { user, userProfile } = useAuth();
  const agentName = userProfile?.name ?? userProfile?.email ?? '';
  const [screen, setScreen]             = useState('date');
  const [weekStarting, setWeekStarting] = useState('');
  const [customDate, setCustomDate]     = useState('');
  const [step, setStep]                 = useState(1);
  const [formData, setFormData]         = useState(INITIAL_DATA);
  const [lastWeekData, setLastWeekData] = useState(null);
  const [draftStatus, setDraftStatus]   = useState(null);
  const [saving, setSaving]             = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const saveTimer = useRef(null);
  const recentSundays = getRecentSundays(8);

  useEffect(() => {
    if (!user) return;
    getLastSubmission(user.uid).then(setLastWeekData).catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!weekStarting || !user) return;
    getDraft(user.uid, weekStarting)
      .then((draft) => {
        if (!draft) { setDraftStatus(null); return; }
        const { agentId, weekStarting: _ws, status, updatedAt, submittedAt, ...fields } = draft;
        setDraftStatus(status ?? null);
        setFormData((prev) => ({ ...prev, ...fields }));
      })
      .catch(console.error);
  }, [weekStarting, user]);

  useEffect(() => {
    if (!weekStarting || !user || screen === 'date') return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      // Do not auto-save submitted reports.
      if (draftStatus === 'submitted') return;
      setSaving(true);
      try { await saveDraft(user.uid, agentName, weekStarting, formData); }
      catch { /* silently ignore auto-save errors */ }
      finally { setSaving(false); }
    }, 1500);
    return () => clearTimeout(saveTimer.current);
  }, [formData, weekStarting, screen, user, draftStatus]);

  const handleChange = useCallback((name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleDateSelect = (date) => {
    setWeekStarting(date);
    setStep(1);
    setScreen('step');
    setError('');
  };

  const handleCustomDate = () => {
    if (!customDate) { setError('Please select a date.'); return; }
    if (!validateSundayDate(customDate)) { setError('Week Starting must be a Sunday.'); return; }
    handleDateSelect(customDate);
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
    else setScreen('review');
  };

  const handleBack = () => {
    if (screen === 'review')                    { setScreen('step'); setStep(TOTAL_STEPS); }
    else if (screen === 'step' && step > 1)     { setStep((s) => s - 1); }
    else if (screen === 'step' && step === 1)   { setScreen('date'); }
  };

  const handleSubmit = async () => {
    setError('');
    if (draftStatus === 'submitted') {
      setError("This week's report has already been submitted and cannot be changed.");
      return;
    }
    setSubmitting(true);
    try {
      await submitReport(user.uid, agentName, weekStarting, formData);
      setDraftStatus('submitted');
      setScreen('done');
    } catch (e) {
      setError('Submission failed. Please try again.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const StepComponent = screen === 'step' ? STEPS[step - 1].component : null;
  const extraProps    = screen === 'step' && (step === 5 || step === 6) ? { lastWeekData } : {};


  const prevLabel = screen === 'review' ? 'Back' : step === 1 ? 'Change week' : 'Prev';
  const nextLabel = screen === 'review'
    ? (submitting ? 'Submitting…' : 'Submit Report')
    : step === TOTAL_STEPS ? 'Review' : 'Next';

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 bg-bg shrink-0">
        <div>
          <p className="text-xs font-medium text-ink-muted">
            {screen === 'step'   && `Step ${step} of ${TOTAL_STEPS}`}
            {screen === 'review' && 'Review'}
            {screen === 'date'   && 'Weekly Report'}
            {screen === 'done'   && 'Complete'}
          </p>
          <h1 className="text-lg font-bold text-ink leading-tight">
            {screen === 'date'   && 'Select Week'}
            {screen === 'step'   && STEPS[step - 1].title}
            {screen === 'review' && 'Review & Submit'}
            {screen === 'done'   && 'Report Submitted'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-ink-muted animate-pulse">Saving…</span>
          )}
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

      {/* Pill-dot progress */}
      {screen === 'step' && (
        <div className="flex gap-1.5 px-4 pb-3 shrink-0">
          {STEPS.map((_, i) => (
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {/* Date picker */}
        {screen === 'date' && (
          <div className="px-4 py-4 max-w-lg mx-auto">
            <p className="text-sm text-ink-muted mb-4">
              Select the Sunday this reporting week starts on.
            </p>
            <div className="flex flex-col gap-2 mb-6">
              {recentSundays.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDateSelect(d)}
                  className="w-full text-left px-4 py-3.5 rounded-xl border border-border/60 bg-white hover:border-primary hover:bg-primary/5 transition-colors flex justify-between items-center"
                >
                  <span className="text-sm font-medium text-ink">{formatDateLabel(d)}</span>
                  {i === 0 && (
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      This week
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-border pt-5">
              <p className="text-xs text-ink-muted mb-2">Or enter a specific Sunday:</p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => { setCustomDate(e.target.value); setError(''); }}
                  className="flex-1 h-11 px-3 border border-border/60 rounded-lg bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button type="button" onClick={handleCustomDate} className="btn-primary px-5">
                  Go
                </button>
              </div>
              {error && <p className="text-xs text-danger mt-2">{error}</p>}
            </div>
          </div>
        )}

        {/* Step form */}
        {screen === 'step' && StepComponent && (
          <div className="px-4 pb-6 max-w-lg mx-auto">
            <StepComponent data={formData} onChange={handleChange} {...extraProps} />
          </div>
        )}

        {/* Review */}
        {screen === 'review' && (
          <div className="px-4 py-4 max-w-lg mx-auto">
            <ReviewSummary data={formData} weekStarting={weekStarting} />
            {error && <p className="text-sm text-danger mt-4">{error}</p>}
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
              Your weekly report for {formatDateLabel(weekStarting)} has been submitted successfully.
            </p>
            <button type="button" onClick={onClose} className="btn-primary w-full max-w-xs">
              Back to Dashboard
            </button>
          </div>
        )}
      </div>

      {/* Footer nav */}
      {(screen === 'step' || screen === 'review') && (
        <div className="grid grid-cols-5 gap-2 px-4 py-4 border-t border-border bg-white shrink-0">
          <button
            type="button"
            onClick={handleBack}
            className="col-span-2 h-11 rounded-xl border border-border bg-white text-ink font-semibold text-sm hover:bg-surface transition-colors"
          >
            {prevLabel}
          </button>
          <button
            type="button"
            onClick={screen === 'review' ? handleSubmit : handleNext}
            disabled={submitting}
            className="col-span-3 h-11 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {nextLabel}
          </button>
        </div>
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
    <div className="bg-white rounded-xl border border-border/60 p-4 mb-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ReviewSummary({ data, weekStarting }) {
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
        Check your numbers before submitting. You can go back to edit any step.
      </p>

      <ReviewSection title="Step 1 — Prospecting">
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
      </ReviewSection>

      <ReviewSection title="Step 2 — Telephone Activity">
        <ReviewRow label="Referral Calls"            value={data.referralCalls} />
        <ReviewRow label="Follow-Up Calls"           value={data.followUpCalls} />
        <ReviewRow label="Cold Calls"                value={data.coldCalls} />
        <ReviewRow label="Seminar / Tradeshow Calls" value={data.seminarTradeshowCalls} />
        <ReviewRow label="Service Calls"             value={data.serviceCalls} />
        <ReviewRow label="Total Calls"               value={totalCalls} />
      </ReviewSection>

      <ReviewSection title="Step 3 — Approaches & FFI">
        <ReviewRow label="Qualified Approaches"   value={data.qualifiedApproaches} />
        <ReviewRow label="Appointments Set"       value={data.appointmentsSet} />
        <ReviewRow label="FFIs Scheduled"         value={data.ffisScheduled} />
        <ReviewRow label="FFIs Conducted"         value={data.ffiConducted} />
        <ReviewRow label="Solution Presentations" value={data.solutionPresentations} />
      </ReviewSection>

      <ReviewSection title="Step 4 — Closing Interviews & Sales">
        <ReviewRow label="New CI Booked"         value={data.newCIBooked} />
        <ReviewRow label="Old CI Booked"         value={data.oldCIBooked} />
        <ReviewRow label="CI Conducted"          value={data.ciConducted} />
        <ReviewRow label="Applications Sold"     value={data.applicationsSold} />
        <ReviewRow label="Lives Sold"            value={data.livesSold} />
        <ReviewRow label="API Sold"              value={formatCurrency(data.apiSold)} />
        <ReviewRow label="Est. Commissions"      value={formatCurrency(data.estimatedCommissions)} />
      </ReviewSection>

      <ReviewSection title="Step 5 — New Names & Pipeline">
        <ReviewRow label="Referrals Sought"             value={data.referralsSought} />
        <ReviewRow label="Referrals Obtained"           value={data.referralsObtained} />
        <ReviewRow label="Names from Cold Canvass"      value={data.namesFromColdCanvass} />
        <ReviewRow label="Names from Other Sources"     value={data.namesFromOther} />
        <ReviewRow label="Old Names Pool"               value={data.oldNamesPool} />
        <ReviewRow label="Portfolio Clients Identified" value={data.portfolioClientsIdentified} />
        <ReviewRow label="New Names Added"              value={totalNames} />
      </ReviewSection>

      <ReviewSection title="Step 6 — Policy Deliveries">
        <ReviewRow label="Policies Received"    value={data.policiesReceived} />
        <ReviewRow label="Policies Delivered"   value={data.policiesDelivered} />
        <ReviewRow label="Policies Outstanding" value={data.policiesOutstanding} />
      </ReviewSection>

      {data.hasServiceWork && (
        <ReviewSection title="Step 6 — Service Work">
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

      <ReviewSection title="Step 7 — Time Management">
        <ReviewRow label="Office Hours" value={`${data.officeHours}h`} />
        <ReviewRow label="Field Hours"  value={`${data.fieldHours}h`} />
        <ReviewRow label="Total Hours"  value={`${totalHours}h`} />
      </ReviewSection>

      <ReviewSection title="Step 8 — Self-Evaluation">
        <ReviewRow label="Planning"          value={`${data.ratingPlanning}/10`} />
        <ReviewRow label="Time Management"   value={`${data.ratingTimeManagement}/10`} />
        <ReviewRow label="Sales Performance" value={`${data.ratingSalesPerformance}/10`} />
        <ReviewRow label="Prospecting"       value={`${data.ratingProspecting}/10`} />
        <ReviewRow label="Overall"           value={`${data.ratingOverall}/10`} />
        {data.notes && <ReviewRow label="Notes" value={data.notes} />}
      </ReviewSection>

      <ReviewSection title="Step 9 — Next Week Goals">
        <ReviewRow label="Target Dials"       value={data.targetDials} />
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

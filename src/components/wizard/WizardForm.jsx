/**
 * Track J Wizard v2 PR1 — Structural shell (re-pagination + navigation).
 *
 * Re-fans the WAR Wizard from the legacy 9-step/5-group structure to the
 * v2 mockup's 12-step/4-phase structure. Step 11 ("Targets for next week")
 * is the final step in PR1 and submits via the existing mechanism. The
 * discrete Review step 12 ships in PR3.
 *
 * Preserve list (NEVER touched, per brief):
 *   • Submission payload shape — every persisted field name + type stays.
 *   • Autosave behavior — 1500ms debounce + retry escalation + sticky 8s
 *     error window + online/offline rebroadcast.
 *   • `parseFloat` numeric coercion + Sunday-only week-start rule.
 *   • Field atoms (`NumericField`, `CurrencyField`, `SuggestedField`,
 *     `ReadOnlyField`, `Card`) from `CardStack.jsx` — unchanged.
 *   • Existing last-week reads / suggested derivations (oldNamesPool,
 *     policiesOutstanding, CI-conducted) — these are EXISTING wizard
 *     behavior, NOT the deferred Decision-A SUGGESTED atom.
 *   • v3 revert boundary: revert the Q4 shell commit (initialStep prop +
 *     resolvePath wiring in AgentDashboard) → back to v2 open-at-step-1
 *     behavior. Legacy Step1–Step9 files are NOT on disk (removed in the v2
 *     migration); a revert does not restore them.
 *
 * What changed:
 *   • SCREENS (5 entries) → STEPS (12 entries).
 *   • Active steps 1-3 mount NEW `v2steps/StepLettersOutreach`,
 *     `StepSeminarsTradeshows`, `StepCallsF2F` (lifted JSX from the
 *     legacy Step1Prospecting + Step2Telephone; same field names + atoms).
 *   • Steps 4-11 mount the existing step files 1:1.
 *   • Screen 'review' is REMOVED from the PR1 state machine — step 11's
 *     Next button submits directly. Review-with-jump-back arrives in PR3.
 *   • PhaseProgress (v2chrome) replaces the 5-dot bar.
 *   • AutosaveChip (v2chrome) replaces the inline indicator visually.
 *     `SaveStatusIndicator` stays exported for back-compat with
 *     `WizardFormSaveStatus.test.jsx` consumers.
 *   • Footer nav: Back · centered "STEP N OF 12" · Next-labeled-with-title.
 *
 * Deferred to PR2 (live-compute layer): Week-So-Far panel, sparkline,
 * conversion %, est-commission, last-week vs deltas. To PR3: discrete
 * Review step 12 + Edit·Step-N jump-back + submit→celebration moment.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Check, AlertTriangle, RotateCcw } from 'lucide-react';
import PanelSkeleton from '../ui/PanelSkeleton';
import { useAuth } from '../../context/AuthContext';
import WeekSoFarPanel from './v2chrome/WeekSoFarPanel';
import ReviewSubmit from './v2chrome/ReviewSubmit';
import Celebration from './v2chrome/Celebration';
import { saveDraft, submitReport, getDraft, getRecentSubmissions, sanitize, getLeaderboardPoints } from '../../services/submissionService';
import { computePoints } from '../../lib/computePoints.js';
import { mapFloorToPoints } from '../daily/DailyCaptureV2.helpers';
import { getLastNSundaysForDropdown } from '../../utils/dateHelpers';
import { formatDateFriendly } from '../../utils/formatters';
import SubmissionViewer from '../submissions/SubmissionViewer';
import WeekConfirmView from './WeekConfirmView';
import { deriveSections } from './WeekConfirmView.helpers';
import { setByPath } from './WizardForm.helpers';

// All 12 wizard steps are now v2 components (legacy step files retired in the
// R1→R2→R3 pass). v2steps/ holds every step's component.
import StepLettersOutreach    from './v2steps/StepLettersOutreach';      // step 1
import StepSeminarsTradeshows from './v2steps/StepSeminarsTradeshows';   // step 2
import StepCallsF2F           from './v2steps/StepCallsF2F';             // step 3
import StepSocialContent      from './v2steps/StepSocialContent';        // step 4 (R3)
import StepNewNamesAdded      from './v2steps/StepNewNamesAdded';        // step 5 (R3)
import StepApproachesInterviews from './v2steps/StepApproachesInterviews'; // step 6 (R1)
import StepNewBusiness          from './v2steps/StepNewBusiness';          // step 7 (R1)
import StepDeliveryService      from './v2steps/StepDeliveryService';      // step 8 (R1)
import StepHoursWorked          from './v2steps/StepHoursWorked';          // step 9 (R2)
import StepRateYourWeek         from './v2steps/StepRateYourWeek';         // step 10 (R2)
import StepTargetsNextWeek      from './v2steps/StepTargetsNextWeek';      // step 11 (R2)

// v2 chrome.
import PhaseProgress          from './v2chrome/PhaseProgress';
import AutosaveChip           from './v2chrome/AutosaveChip';

const MAX_AUTOSAVE_RETRIES = 3;
const FAILURE_STICKY_MS = 8000;

// ─────────────────────────────────────────────────────────────────────────────
// v2 12-step / 4-phase structure.
// PR3: complete v2 flow (steps 1-12). Step 12 = Review & submit (mounted
// as a special-case below, not via the step-component shape).
// `needsLastWeekData` mirrors the legacy `[Step, true]` flag for steps that
// consume the prior week's draft via the legacy data flow (existing wizard
// behavior — see the brief's preserve note on existing last-week reads).
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  // ── Activity (1-5) ────────────────────────────────────────────────────────
  { n: 1,  phase: 'activity',   title: 'Letters & outreach',      Component: StepLettersOutreach },
  { n: 2,  phase: 'activity',   title: 'Seminars & tradeshows',   Component: StepSeminarsTradeshows },
  { n: 3,  phase: 'activity',   title: 'Calls & face-to-face',    Component: StepCallsF2F },
  { n: 4,  phase: 'activity',   title: 'Social & content',        Component: StepSocialContent },
  { n: 5,  phase: 'activity',   title: 'New names added',         Component: StepNewNamesAdded,     needsLastWeekData: true },
  // ── Sales (6-8) ── v2 components (R1 retirement extraction) ───────────────
  { n: 6,  phase: 'sales',      title: 'Approaches & interviews', Component: StepApproachesInterviews },
  { n: 7,  phase: 'sales',      title: 'New business this week',  Component: StepNewBusiness },
  { n: 8,  phase: 'sales',      title: 'Delivery & service',      Component: StepDeliveryService, needsLastWeekData: true },
  // ── Reflection (9-10) ── v2 components (R2 retirement extraction) ─────────
  { n: 9,  phase: 'reflection', title: 'Hours worked',            Component: StepHoursWorked },
  { n: 10, phase: 'reflection', title: 'Rate your week',          Component: StepRateYourWeek },
  // ── Goals (11-12) ── v2 component (R2 retirement extraction) ──────────────
  { n: 11, phase: 'goals',      title: 'Targets for next week',   Component: StepTargetsNextWeek, needsGoalSeeding: true },
  // PR3: step 12 = Review & submit. Mounted as a special-case below
  // (ReviewSubmit isn't a step-component-shape; it needs commissionRate +
  // edit-jump callback). The STEPS entry exists so PhaseProgress, footer
  // counter, and the phase-rail logic all see step 12 as a real step.
  { n: 12, phase: 'goals',      title: 'Review & submit',         Component: null },
];

const TOTAL_STEPS_DISPLAY = 12;
const FINAL_STEP = 12;

const INITIAL_DATA = {
  // Step 1 — prospecting
  prospectingLettersSent:       0,
  prospectingEmailsSent:        0,
  seminarsConducted:            0,
  namesFromSeminarsConducted:   0,
  tradeshowsAttended:           0,
  namesFromTradeshowsAttended:  0,
  f2fAttempts:                  0,
  f2fContacts:                  0,
  // Step 2 — telephone
  referralCalls:                0,
  followUpCalls:                0,
  coldCalls:                    0,
  seminarTradeshowCalls:        0,
  serviceCalls:                 0,
  // Step 3 — approaches & FFI
  telContacts:                  0,
  qualifiedApproaches:          0,
  appointmentsSet:              0,
  ffisScheduled:                0,
  ffiConducted:                 0,
  solutionPresentations:        0,
  // Step 4 — closing & new business
  newCIBooked:                  0,
  oldCIBooked:                  0,
  ciConducted:                  0,
  livesSold:                    0,
  newBusiness:    { apps: 0, api: 0 },
  pppIncreases:   { apps: 0, apiIncrease: 0 },
  lumpsums:       { grossAmount: 0 },
  // Step 5 — new names
  referralsSought:              0,
  referralsObtained:            0,
  namesFromColdCanvass:         0,
  namesFromOther:               0,
  oldNamesPool:                 0,
  portfolioClientsIdentified:   0,
  // Step 6 — delivery & service
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
  // Step 7 — hours
  officeHours:                  0,
  fieldHours:                   0,
  // Step 8 — self-evaluation
  ratingPlanning:               0,
  ratingTimeManagement:         0,
  ratingSalesPerformance:       0,
  ratingProspecting:            0,
  ratingOverall:                0,
  notes:                        '',
  // Step 9 — next-week goals
  targetDials:                  0,
  targetTelContacts:            0,
  targetF2FAttempts:            0,
  targetFFI:                    0,
  targetCI:                     0,
  targetAppsSold:               0,
  targetAPI:                    0,
  goalNotes:                    '',
  // Social & Content (StepSocialMedia)
  socialPostsTotal:             0,
  socialEngagementTotal:        0,
  socialInboxEnquiries:         0,
  namesFromSocial:              0,
  socialPlatformBreakdown: {
    facebook:  0,
    instagram: 0,
    whatsapp:  0,
    linkedin:  0,
  },
};

// screen: 'date' | 'confirm' | 'step' | 'done' | 'submitted'
// Note: 'review' removed in PR1 — step 11 submits directly. PR3 reintroduces
// the discrete review step with Edit·Step-N jump-back.
// 'confirm' (Wizard v3 Phase 1): the fast-path entry — daily/hybrid agents
// confirm their daily-aggregated week before Rate → Goals → Submit.
const BRANCH_DIRECT_UNIT = '__branch_direct__';

export default function WizardForm({ onClose, initialWeek, initialStep, initialScreen, goal, floors }) {
  const { user, userProfile, tenantId, role, branchId } = useAuth();
  const targetUnitId = role === 'branch_manager' ? BRANCH_DIRECT_UNIT : (userProfile?.unitId ?? null);
  const agentName = userProfile?.name ?? userProfile?.email ?? '';
  const [screen, setScreen]             = useState(initialScreen ?? (initialWeek ? 'step' : 'date'));
  const [weekStarting, setWeekStarting] = useState(initialWeek ?? '');
  const [localWeekChoice, setLocalWeekChoice] = useState(
    () => initialWeek ?? getLastNSundaysForDropdown(1)[0]?.value ?? ''
  );
  const [step, setStep]                 = useState(initialStep ?? 1); // 1..FINAL_STEP (12)
  // PR3: when the agent clicks "Edit · Step N" from the Review screen, we
  // navigate back to step N AND set returnToReview=true so a "Back to
  // Review" affordance appears on the footer (Next-label override). This
  // avoids extending PR1's visited-step navigation semantics.
  const [returnToReview, setReturnToReview] = useState(false);
  // Wizard v3 fast path: set true when the agent advances out of the Confirm
  // screen into step 10 (Rate). Lets handleBack return to Confirm from step 10
  // instead of decrementing to full-path step 9 (which the fast path skipped).
  const [cameFromConfirm, setCameFromConfirm] = useState(false);
  const [formData, setFormData]         = useState(INITIAL_DATA);
  // Confirm screen: false until the getDraft read completes, so the fast-path
  // Confirm never flashes WeekConfirmView's "No activity logged" empty state
  // before formData is seeded. resolvePath routes empty weeks to 'full', so a
  // loaded Confirm always has data.
  const [draftLoaded, setDraftLoaded]   = useState(false);
  // BUG-DATALOSS: a getDraft READ FAILURE (network/permission) must NOT fall
  // through to a fresh, auto-saving form — the debounced doSave would then
  // overwrite the very draft the read failed to load. draftLoadError gates the
  // form body (an error card replaces the steps), suppresses the footer/nav,
  // and hard-guards doSave. Retry bumps draftReloadNonce to re-run the load.
  const [draftLoadError, setDraftLoadError]   = useState(false);
  const [draftReloadNonce, setDraftReloadNonce] = useState(0);
  const [lastWeekData, setLastWeekData] = useState(null);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [draftStatus, setDraftStatus]   = useState(null);
  const [submissionData, setSubmissionData] = useState(null);
  const [viewingSubmission, setViewingSubmission] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [savedAt, setSavedAt]           = useState(null);
  const [isOffline, setIsOffline]       = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [saveEscalated, setSaveEscalated] = useState(false);
  const [stickyError, setStickyError]   = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const [priorPoints, setPriorPoints]   = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
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
    // ONE read serves both lastWeekData (index 0) AND the 6-week sparkline
    // (slice 0..5) for the WeekSoFarPanel. Depend on `user?.uid` (primitive)
    // rather than `user` (new object ref every render via useAuth) so this
    // effect doesn't refire on every render and loop through setState.
    getRecentSubmissions(tenantId, user.uid, 6)
      .then((recent) => {
        setRecentSubmissions(recent);
        setLastWeekData(recent[0] ?? null);
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, tenantId]);

  useEffect(() => {
    if (!weekStarting || !user) return;
    // No setDraftLoaded(false) reset here: WizardForm remounts on every open
    // (showWizard toggles mount/unmount), so draftLoaded starts false per open.
    // Adding a synchronous reset perturbs the fake-timer autosave RTL tests.
    // Depend on `user?.uid` (primitive), NOT `user` (fresh object every render
    // via useAuth — same trap the getRecentSubmissions effect above documents).
    // With `user` this effect re-fired on every render, which would auto-re-run
    // getDraft on the error-triggered re-render and silently self-clear
    // draftLoadError before the agent could act — defeating the guard + Retry.
    getDraft(tenantId, user.uid, weekStarting)
      .then((draft) => {
        // Flip in-band with the other setters (NOT via a trailing .finally) so
        // the promise chain stays then→catch — the autosave RTL tests drain
        // exactly those two ticks inside act(); a third link would hang them.
        setDraftLoaded(true);
        setDraftLoadError(false); // success clears any prior read error (incl. after Retry)
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
      // A genuine read failure — surface it and PREVENT the overwrite. Set the
      // error flag in-band with the setters (chain stays exactly then→catch, no
      // extra link). draftLoadError gates the form + guards doSave so the
      // unread draft is never clobbered by a fresh-form autosave.
      .catch((e) => { console.error(e); setDraftLoaded(true); setDraftLoadError(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStarting, user?.uid, tenantId, draftReloadNonce]);

  // Always-current save executor — assigned on every render so the online
  // handler and the retry button always capture the latest closure values.
  doSave.current = async () => {
    // Belt-and-braces: never write while the draft read failed (draftLoadError).
    // Reassigned every render, so it captures the current draftLoadError value.
    // `submitting` closes the post-submit trailing-autosave race: a timer
    // scheduled by the last pre-submit form change would otherwise fire during
    // the submitReport await (draftStatus still 'draft') and be denied by the
    // submitted-doc write rules — console error + sticky save-failed indicator
    // under the celebration. (Run 8 A-9; surfaced by the a5 live smoke.)
    if (!weekStarting || !user || draftStatus === 'submitted' || draftLoadError || submitting) return;
    setSaving(true);
    setStickyError(false);     // legitimate replacement — clear sticky before new attempt
    try {
      await saveDraft(tenantId, user.uid, agentName, weekStarting, formData, userProfile?.commissionRate ?? 0, targetUnitId, branchId);
      consecutiveFailures.current = 0;
      setSaveEscalated(false);
      clearTimeout(savedTimer.current);
      setSavedAt(new Date());
      savedTimer.current = setTimeout(() => setSavedAt(null), 3000);
    } catch (err) {
      console.error('Auto-save failed:', err);
      consecutiveFailures.current += 1;
      setStickyError(true);
      if (consecutiveFailures.current >= MAX_AUTOSAVE_RETRIES) setSaveEscalated(true);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save on formData change AND on screen/step change (debounced 1500ms).
  useEffect(() => {
    if (!weekStarting || !user || screen === 'date') return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => { await doSave.current(); }, 1500);
    return () => clearTimeout(saveTimer.current);
  }, [formData, step, weekStarting, screen, user, draftStatus]);

  // One-time read of the agent's current leaderboard total — used by Celebration
  // to compute earned = computePoints(sanitize(formData)) and show level progress.
  // Non-existent doc → priorPoints stays 0 (first-submission path).
  useEffect(() => {
    if (!tenantId || !user?.uid) return;
    getLeaderboardPoints(tenantId, user.uid)
      .then(setPriorPoints)
      .catch(() => {});
  }, [tenantId, user?.uid]);

  // Online / offline detection — update isOffline and re-fire save on reconnect.
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

  // Once the agent descends into the full-path step flow (any step < 10 — via
  // the phase rail or Review's Edit·Step jump-back), the Confirm-return shortcut
  // is stale: a subsequent forward walk back to step 10 should Back to step 9,
  // not Confirm. Clear cameFromConfirm whenever step < 10 so the shortcut only
  // applies when the agent reached step 10 directly from Confirm. (Gemini #723.)
  useEffect(() => {
    if (step < 10 && cameFromConfirm) setCameFromConfirm(false);
  }, [step, cameFromConfirm]);

  const handleChange = useCallback((name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleManualSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    doSave.current();
  }, []);

  // Retry after a failed draft read: clear the error, drop back to the loading
  // skeleton, and bump the nonce so the getDraft effect re-runs. On success the
  // effect's .then clears draftLoadError and the normal flow resumes (draft
  // loads, or a fresh form if the week has no draft).
  const handleDraftReload = useCallback(() => {
    setDraftLoadError(false);
    setDraftLoaded(false);
    setDraftReloadNonce((n) => n + 1);
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

  const handleSubmit = async () => {
    setError('');
    if (draftStatus === 'submitted') {
      setError("This week's report has already been submitted and cannot be changed.");
      return;
    }
    // Cancel any pending debounced autosave — its write would race the submit
    // and be denied once the doc flips to submitted (Run 8 A-9).
    clearTimeout(saveTimer.current);
    setSubmitting(true);
    try {
      await submitReport(tenantId, user.uid, agentName, weekStarting, formData, userProfile?.commissionRate ?? 0, targetUnitId, branchId);
      const sanitized = sanitize(formData, userProfile?.commissionRate ?? 0);
      setEarnedPoints(computePoints(sanitized));
      setDraftStatus('submitted');
      // Celebration's "View submission" CTA reuses the SAME
      // viewingSubmission/submissionData/<SubmissionViewer> mechanism the
      // "already submitted" interstitial uses (see below). Populate it here
      // with the exact shape `submitReport` just persisted, so the celebration
      // screen can open the viewer with no extra Firestore read.
      setSubmissionData({
        ...sanitized,
        userId: user.uid,
        agentId: user.uid,
        agentName,
        unitId: targetUnitId,
        branchId,
        weekStarting,
        status: 'submitted',
        updatedAt: new Date(),
        submittedAt: new Date(),
      });
      setScreen('done');
    } catch (e) {
      setError('Submission failed. Please try again.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    // "Back to Review" override: if the agent is editing post-Review, the
    // footer Next jumps straight back to step 12 regardless of where they
    // are. This is the dedicated forward-return-to-Review path that's
    // intentionally separate from `handleDotClick`'s visited-set gate.
    if (returnToReview && step < FINAL_STEP) {
      setReturnToReview(false);
      setError('');
      setStep(FINAL_STEP);
      return;
    }
    if (step < FINAL_STEP) {
      setError('');
      setStep((s) => s + 1);
    } else {
      // step === FINAL_STEP (12) — Review screen → Submit
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step === 10 && cameFromConfirm) {
      // Fast path entered via Confirm: Back from the first post-Confirm step
      // (Rate, step 10) returns to the Confirm screen, not full-path step 9.
      setCameFromConfirm(false);
      setError('');
      setScreen('confirm');
    } else if (step > 1) {
      setError('');
      setStep((s) => s - 1);
    } else {
      setReturnToReview(false);
      setError('');
      setScreen('date');
    }
  };

  const handleDotClick = useCallback((stepN) => {
    // Backward-only navigation via the phase rail (PR1 semantics).
    // Forward jump-back to Review uses the explicit Next-as-Back-to-Review
    // pattern set up by ReviewSubmit's onEditStep callback.
    if (stepN < step) setStep(stepN);
  }, [step]);

  // ReviewSubmit's "Edit · Step N" pill callback: jump back to step N and
  // arm returnToReview so the footer Next becomes a "Back to Review" button.
  const handleEditStep = useCallback((stepN) => {
    if (stepN < 1 || stepN > FINAL_STEP) return;
    setReturnToReview(true);
    setStep(stepN);
  }, []);

  // ── Wizard v3 fast-path Confirm screen (Phase 1) ──────────────────────────
  // "Looks good →" advances out of Confirm into the step flow at step 10 (Rate).
  // Step 11 = Goals, step 12 = Review (no skip-model needed — Phase 0 verified
  // STEPS 10/11/12 = Rate/Goals/Review).
  const handleConfirmNext = useCallback(() => {
    setError('');
    setCameFromConfirm(true);
    setScreen('step');
    setStep(10);
  }, []);

  // Inline field edit from Confirm. Domain rule: parseFloat, never store a
  // string. Writes through setByPath so dotted keys (newBusiness.api,
  // socialPlatformBreakdown.*) update the real nested field; existing autosave
  // then persists the merged draft.
  const handleConfirmEdit = useCallback((key, nextValue) => {
    const num = parseFloat(nextValue) || 0;
    setFormData((prev) => setByPath(prev, key, num));
  }, []);

  const activeStepEntry = STEPS.find((s) => s.n === step) ?? STEPS[0];
  const ActiveStepComponent = activeStepEntry.Component;
  const nextStepEntry = STEPS.find((s) => s.n === step + 1);

  // Wizard v3 fast-path Confirm readout: points earned this week vs the floor
  // target. Both helpers are pure (no fetch); mirrors handleSubmit's earned
  // computation. NOT intra-week pace (computeWeekToDatePoints/computePaceState) —
  // there is no elapsed-days cursor at end-of-week confirmation.
  const confirmCommissionRate = userProfile?.commissionRate ?? 0;
  const confirmEarnedPoints = useMemo(
    () => computePoints(sanitize(formData, confirmCommissionRate)),
    [formData, confirmCommissionRate]
  );
  const confirmFloorPoints = useMemo(() => mapFloorToPoints(floors), [floors]);
  const confirmFloorMet = confirmFloorPoints > 0 && confirmEarnedPoints >= confirmFloorPoints;

  const prevLabel = step === 1 ? 'Change week' : 'Back';
  const nextLabel = (() => {
    if (returnToReview && step < FINAL_STEP) return 'Back to Review';
    if (step === FINAL_STEP) return submitting ? 'Submitting…' : 'Submit Report';
    return `Next · ${nextStepEntry?.title ?? ''}`;
  })();

  const submittedAtLabel = (() => {
    const ts = submissionData?.submittedAt;
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-TT', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  })();

  // Draft-read-failure card — replaces the form body while draftLoadError is
  // set (data-integrity: no editable/auto-saving form over an unread draft).
  // Established error-card idiom: role="alert" + AlertTriangle + ≥44px Retry.
  const draftLoadErrorCard = (
    <div className="px-4 py-4 max-w-lg mx-auto">
      <div
        role="alert"
        className="card flex items-start gap-3 text-danger-ink"
        data-testid="wizard-v2-draft-error"
      >
        <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Couldn&apos;t load your saved draft</p>
          <p className="text-xs text-ink-muted mt-0.5">
            We couldn&apos;t reach your saved report for this week. Your work hasn&apos;t
            been changed — check your connection and try again.
          </p>
          <button
            type="button"
            onClick={handleDraftReload}
            className="mt-2 min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
            data-testid="wizard-v2-draft-error-retry"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-bg flex flex-col"
      data-testid="wizard-v2-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Weekly report wizard"
    >
      {/* Header — eyebrow + title + autosave chip + close */}
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 bg-bg shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-ink-muted">
            {screen === 'step'      && `Step ${step} · ${activeStepEntry.phase[0].toUpperCase()}${activeStepEntry.phase.slice(1)}`}
            {screen === 'date'      && 'Weekly Report'}
            {screen === 'confirm'   && 'Weekly Report'}
            {screen === 'done'      && 'Complete'}
            {screen === 'submitted' && 'Weekly Report'}
          </p>
          <h1
            className="text-xl font-display font-bold text-ink leading-tight mt-1"
            style={{ letterSpacing: '-0.018em' }}
            data-testid="wizard-v2-step-title"
          >
            {screen === 'date'      && 'Select Week'}
            {screen === 'confirm'   && 'Confirm your week'}
            {screen === 'step'      && activeStepEntry.title}
            {screen === 'done'      && 'Report Submitted'}
            {screen === 'submitted' && 'Already submitted'}
          </h1>
        </div>
        <div className="flex items-start gap-2 shrink-0">
          {screen === 'step' && !draftLoadError && (
            <AutosaveChip
              saving={saving}
              savedAt={savedAt}
              stickyError={stickyError}
              isOffline={isOffline}
              onRetry={handleManualSave}
            />
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface text-ink-muted transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close"
            data-testid="wizard-v2-close"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Phase progress rail — only during the step flow (suppressed while the
          draft-load error card owns the body — nav must be inert then) */}
      {screen === 'step' && !draftLoadError && (
        <div className="px-4 pb-3 shrink-0">
          <PhaseProgress
            currentStep={step}
            totalSteps={TOTAL_STEPS_DISPLAY}
            onDotClick={handleDotClick}
          />
        </div>
      )}

      {/* Persistent-failure escalation banner — preserved verbatim from
          the legacy WizardForm. Fires after MAX_AUTOSAVE_RETRIES (3)
          consecutive failures; clears on next successful save. */}
      {saveEscalated && screen !== 'date' && screen !== 'done' && screen !== 'submitted' && (
        <div
          role="alert"
          className="mx-4 mb-2 px-4 py-3 rounded-xl bg-warning-tint border border-warning/30 flex items-start gap-3 shrink-0"
        >
          <AlertTriangle size={16} className="text-warning-ink shrink-0 mt-0.5" />
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

      {/* Body — flex row on lg+ so the WeekSoFarPanel can sit in the right rail. */}
      <div className="flex-1 flex flex-row overflow-hidden" data-testid="wizard-v2-body-row">
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
              className="w-full h-11 px-3 border border-border rounded-xl bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 mb-4"
            >
              {dropdownOptions.map((opt, i) => (
                <option key={opt.value} value={opt.value}>
                  {i === 0 ? `This week — ${opt.label}` : opt.label}
                </option>
              ))}
            </select>
            {error && <p className="text-xs text-danger-ink mb-3">{error}</p>}
            <button
              type="button"
              onClick={() => handleDateSelect(localWeekChoice)}
              className="btn-primary w-full h-11"
            >
              Start Report
            </button>
          </div>
        )}

        {/* Wizard v3 fast-path Confirm screen — daily/hybrid agents confirm
            their daily-aggregated week before Rate → Goals → Submit. Sections
            derive from live formData so inline edits reflect immediately.
            Gated on draftLoaded so the aggregated data never flashes the
            "No activity logged" empty state at this trust-sensitive moment. */}
        {screen === 'confirm' && (
          draftLoadError ? (
            draftLoadErrorCard
          ) : draftLoaded ? (
            <>
              {/* Points-earned-vs-floor readout — end-of-week context, not pace. */}
              <div data-testid="wizard-v2-confirm-points" className="max-w-lg mx-auto px-4 pt-4">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-card border border-border/60 px-4 py-3 shadow-sm">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-ink-muted">
                      Points this week
                    </p>
                    <p
                      data-testid="wizard-v2-confirm-points-value"
                      className="mt-1 text-xl font-display font-bold text-ink leading-none"
                      style={{ letterSpacing: '-0.02em' }}
                    >
                      {confirmEarnedPoints}{' '}
                      <span className="text-ink-muted font-normal">/ {confirmFloorPoints} pts</span>
                    </p>
                  </div>
                  {confirmFloorMet && (
                    <span
                      data-testid="wizard-v2-confirm-floor-met"
                      className="flex items-center gap-1 text-xs font-semibold text-success-ink shrink-0"
                    >
                      <Check size={14} aria-hidden="true" />
                      Floor met
                    </span>
                  )}
                </div>
              </div>
              <WeekConfirmView
                draft={formData}
                sections={deriveSections(formData)}
                onEditField={handleConfirmEdit}
                onConfirm={handleConfirmNext}
                variant="desktop"
              />
            </>
          ) : (
            <div
              className="px-4 py-4 max-w-lg mx-auto"
              data-testid="wizard-v2-confirm-loading"
            >
              <PanelSkeleton variant="list" count={4} label="Loading your week…" />
            </div>
          )
        )}

        {/* Active v2 step — gated on draftLoaded (BUG-101). The editable step
            body must NOT render until the getDraft check resolves: otherwise a
            value typed pre-resolve is silently overwritten by the late draft
            merge (setFormData spread, ~L297), and an already-submitted week
            accepts input for a beat before flipping to the interstitial. This
            mirrors the Confirm screen's draftLoaded gate exactly. Since the
            getDraft resolution that flips draftLoaded=true also sets
            screen='submitted' in the same batch, a submitted week transitions
            loading→interstitial with no editable-input window. */}
        {screen === 'step' && (
          draftLoadError ? (
            draftLoadErrorCard
          ) : draftLoaded ? (
            <>
              {step === FINAL_STEP && (
                <div className="px-4 pb-6 max-w-2xl mx-auto" data-testid={`wizard-v2-step-${step}`}>
                  <ReviewSubmit
                    data={formData}
                    lastWeekData={lastWeekData}
                    commissionRate={userProfile?.commissionRate ?? 0}
                    onEditStep={handleEditStep}
                  />
                </div>
              )}
              {step !== FINAL_STEP && ActiveStepComponent && (
                <div className="px-4 pb-6 max-w-lg mx-auto" data-testid={`wizard-v2-step-${step}`}>
                  <ActiveStepComponent
                    data={formData}
                    onChange={handleChange}
                    {...(activeStepEntry.needsLastWeekData  ? { lastWeekData } : {})}
                    {...(activeStepEntry.needsGoalSeeding   ? { goal, floors } : {})}
                  />
                </div>
              )}
            </>
          ) : (
            <div
              className="px-4 py-4 max-w-lg mx-auto"
              data-testid="wizard-v2-step-loading"
            >
              <PanelSkeleton variant="list" count={4} label="Loading your week…" />
            </div>
          )
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
                  className="w-full h-11 rounded-xl border border-border bg-card text-ink font-semibold text-sm hover:bg-surface transition-colors"
                >
                  Pick Different Week
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Done — PR3 swaps the legacy plain confirmation for the v2 celebration. */}
        {screen === 'done' && (
          <Celebration
            formData={formData}
            weekStartingLabel={formatDateFriendly(weekStarting)}
            weekStarting={weekStarting}
            commissionRate={userProfile?.commissionRate ?? 0}
            earnedPoints={earnedPoints}
            priorPoints={priorPoints}
            onClose={onClose}
            onViewSubmission={() => setViewingSubmission(true)}
          />
        )}

        {error && screen === 'step' && (
          <p className="px-4 pb-4 text-sm text-danger-ink text-center" role="alert">{error}</p>
        )}
      </main>

      {/* Desktop WeekSoFarPanel — right rail, lg+ only, hidden on Review (step 12)
          and while the draft-load error card owns the body. */}
      {screen === 'step' && step !== FINAL_STEP && !draftLoadError && (
        <aside
          className="hidden lg:flex border-l border-border bg-bg overflow-y-auto px-4 py-4"
          aria-label="Live week-so-far panel"
        >
          <WeekSoFarPanel
            formData={formData}
            commissionRate={userProfile?.commissionRate ?? 0}
            lastWeekData={lastWeekData}
            recentSubmissions={recentSubmissions}
            currentStep={step}
            totalSteps={TOTAL_STEPS_DISPLAY}
            weekStarting={weekStarting}
            variant="desktop"
          />
        </aside>
      )}
      </div>

      {/* Mobile WeekSoFarPanel — collapsed strip, hidden on Review (step 12)
          and while the draft-load error card owns the body. */}
      {screen === 'step' && step !== FINAL_STEP && !draftLoadError && (
        <div className="lg:hidden px-4 pb-2 shrink-0">
          <WeekSoFarPanel
            formData={formData}
            commissionRate={userProfile?.commissionRate ?? 0}
            lastWeekData={lastWeekData}
            recentSubmissions={recentSubmissions}
            currentStep={step}
            totalSteps={TOTAL_STEPS_DISPLAY}
            weekStarting={weekStarting}
            variant="mobile"
          />
        </div>
      )}

      {/* Submission viewer overlay (reused unchanged from the History tab) */}
      {viewingSubmission && submissionData && (
        <SubmissionViewer
          submission={submissionData}
          onClose={resetToDatePicker}
        />
      )}

      {/* Footer nav — Back · "STEP N OF 12" · Next-with-title.
          12 = the mockup's full rail length (review step 12 ships in PR3).
          Suppressed while draftLoadError owns the body: a live Submit here would
          write fresh/empty formData over the unread draft (the overwrite we
          exist to prevent), and Next/Back navigation must be inert too. */}
      {screen === 'step' && !draftLoadError && (
        <footer
          className="grid items-center px-4 py-4 border-t border-border bg-card shrink-0 gap-3"
          style={{ gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1.6fr)' }}
          data-testid="wizard-v2-footer"
        >
          <button
            type="button"
            onClick={handleBack}
            className="h-11 px-4 rounded-xl border border-border bg-card text-ink font-semibold text-sm hover:bg-surface transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            data-testid="wizard-v2-back"
          >
            {prevLabel}
          </button>
          <span
            className="text-[10px] font-bold font-mono uppercase tracking-widest text-ink-muted whitespace-nowrap"
            data-testid="wizard-v2-step-counter"
          >
            Step {step} of {TOTAL_STEPS_DISPLAY}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={submitting}
            className="h-11 px-4 rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm hover:bg-primary/90 dark:hover:bg-primary transition-colors disabled:opacity-60 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary truncate"
            data-testid="wizard-v2-next"
          >
            {nextLabel}
          </button>
        </footer>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy SaveStatusIndicator — preserved for back-compat with
// `WizardFormSaveStatus.test.jsx` consumers + any future need. The new
// `AutosaveChip` (v2chrome) is what the wizard actually renders inside its
// header now; this remains the SoT for the autosave state-machine semantics
// (saving / saved / failed + 8s sticky window + 2s retry throttle).
// ─────────────────────────────────────────────────────────────────────────────

function SaveStatusIndicator({ saving, savedAt, stickyError, isOffline, onRetry }) {
  const lastRetryAt   = useRef(0);
  const failedShownAt = useRef(0);
  const stickyTimer   = useRef(null);
  const savingRef     = useRef(saving);
  const [, setStickyTick] = useState(0);

  savingRef.current = saving;

  useEffect(() => {
    if (stickyError) {
      lastRetryAt.current = 0;
      failedShownAt.current = Date.now();
      clearTimeout(stickyTimer.current);
    } else if (savingRef.current) {
      clearTimeout(stickyTimer.current);
      failedShownAt.current = 0;
    } else {
      const remaining = FAILURE_STICKY_MS - (Date.now() - failedShownAt.current);
      clearTimeout(stickyTimer.current);
      stickyTimer.current = setTimeout(() => {
        failedShownAt.current = 0;
        setStickyTick(n => n + 1);
      }, remaining > 0 ? remaining : 0);
    }
  }, [stickyError]);

  useEffect(() => () => clearTimeout(stickyTimer.current), []);

  const visibleError = stickyError || (
    failedShownAt.current > 0 &&
    Date.now() - failedShownAt.current < FAILURE_STICKY_MS &&
    !saving
  );

  function handleRetry() {
    if (Date.now() - lastRetryAt.current < 2000) return;
    lastRetryAt.current = Date.now();
    onRetry();
  }

  return (
    <div className="flex items-center">
      <div role="status" aria-live="polite" aria-atomic="true">
        {saving && (
          <span className="text-xs text-ink-muted animate-pulse motion-reduce:animate-none">Saving…</span>
        )}
        {!saving && savedAt && isOffline && !visibleError && (
          <span className="flex items-center gap-1 text-xs text-warning-ink">
            <Check size={13} />
            Saved offline — will sync when reconnected
          </span>
        )}
        {!saving && savedAt && !isOffline && !visibleError && (
          <span className="flex items-center gap-1 text-xs text-success-ink">
            <Check size={13} />
            Saved
          </span>
        )}
      </div>
      <div role="alert" aria-atomic="true">
        {!saving && !savedAt && isOffline && !visibleError && (
          <span className="text-xs text-warning-ink">Offline — will save when reconnected</span>
        )}
        {visibleError && !saving && !isOffline && (
          <span className="flex items-center gap-1 text-xs text-danger-ink">
            <AlertTriangle size={13} />
            Save failed — tap to retry
            <button
              type="button"
              onClick={handleRetry}
              className="h-11 px-2 flex items-center gap-1 text-xs font-semibold text-danger-ink border border-danger/30 rounded-lg hover:bg-danger-tint transition-colors ml-1"
              aria-label="Retry save"
            >
              <RotateCcw size={12} />
              Retry
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

export { SaveStatusIndicator };

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { saveOnboardingIdentity, markOnboardingComplete } from '../../services/userService';
import { saveWizardMoneyNeeds, saveWizardGamePlan, saveWizardProfile } from '../../services/onboardingService';
import WizardWelcome    from './steps/WizardWelcome';
import WizardIdentity   from './steps/WizardIdentity';
import WizardCompletion from './steps/WizardCompletion';
import WizardMoneyNeeds from './steps/WizardMoneyNeeds';
import WizardGamePlan   from './steps/WizardGamePlan';
import WizardGoals      from './steps/WizardGoals';
import WizardProfile    from './steps/WizardProfile';

// Step IDs
const STEP_WELCOME      = 0;
const STEP_IDENTITY     = 1;
const STEP_MONEY_NEEDS  = 2;
const STEP_GAME_PLAN    = 3;
const STEP_GOALS        = 4;
const STEP_PROFILE      = 5;
const STEP_COMPLETION   = 6;
const TOTAL_STEPS       = 7;

// Content steps (shown in stepper; excludes Welcome + Completion frame screens)
const CONTENT_STEP_COUNT = 5;
function contentStepIndex(step) {
  if (step === STEP_IDENTITY)    return 1;
  if (step === STEP_MONEY_NEEDS) return 2;
  if (step === STEP_GAME_PLAN)   return 3;
  if (step === STEP_GOALS)       return 4;
  if (step === STEP_PROFILE)     return 5;
  return null;
}

const LS_KEY = (uid) => `agencytrack-onboarding-step-${uid}`;

export default function OnboardingWizard() {
  const { user, userProfile, tenantId, refreshProfile } = useAuth();

  // Stable year for the current onboarding session
  const [year] = useState(() => new Date().getFullYear());

  function deriveInitialStep() {
    if (!user?.uid) return STEP_WELCOME;
    const identityDone = !!(userProfile?.agentNumber || userProfile?.dateOfBirth);
    if (!identityDone) {
      // No identity yet — use localStorage pointer or start from Welcome
      try {
        const saved = parseInt(localStorage.getItem(LS_KEY(user?.uid)), 10);
        if (!isNaN(saved) && saved >= STEP_WELCOME && saved < TOTAL_STEPS) return saved;
      } catch (e) {
        console.error('[OnboardingWizard] Failed to read from localStorage:', e);
      }
      return STEP_WELCOME;
    }
    // Identity done — try localStorage for a content-step checkpoint
    try {
      const saved = parseInt(localStorage.getItem(LS_KEY(user?.uid)), 10);
      if (!isNaN(saved) && saved > STEP_IDENTITY && saved < STEP_COMPLETION) return saved;
    } catch (e) {
      console.error('[OnboardingWizard] Failed to read from localStorage:', e);
    }
    // Identity done but no content checkpoint → first content step after identity
    return STEP_MONEY_NEEDS;
  }

  const [step,       setStep]       = useState(deriveInitialStep);
  const [saving,     setSaving]     = useState(false);
  const [completing, setCompleting] = useState(false);
  const [saveError,  setSaveError]  = useState(null);

  // Persist step pointer for cross-device resume
  useEffect(() => {
    if (user?.uid && step > STEP_WELCOME && step < STEP_COMPLETION) {
      try {
        localStorage.setItem(LS_KEY(user.uid), String(step));
      } catch (e) {
        console.error('[OnboardingWizard] Failed to write to localStorage:', e);
      }
    }
  }, [step, user?.uid]);

  function advance() {
    setStep((s) => Math.min(s + 1, STEP_COMPLETION));
  }

  function back() {
    setStep((s) => Math.max(s - 1, STEP_WELCOME));
  }

  function skip() {
    if (step === STEP_WELCOME) {
      setStep(STEP_COMPLETION);
    } else {
      advance();
    }
  }

  // ── Step handlers ─────────────────────────────────────────────────────────────

  async function handleIdentitySave({ agentNumber, dateOfBirth }) {
    setSaving(true);
    setSaveError(null);
    try {
      await saveOnboardingIdentity(tenantId, user.uid, { agentNumber, dateOfBirth });
      advance();
    } catch (err) {
      console.error('[OnboardingWizard] saveOnboardingIdentity:', err);
      setSaveError('Could not save — please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleMoneyNeedsSave(data) {
    setSaving(true);
    setSaveError(null);
    try {
      await saveWizardMoneyNeeds(tenantId, user.uid, year, data);
      advance();
    } catch (err) {
      console.error('[OnboardingWizard] saveWizardMoneyNeeds:', err);
      setSaveError(err.message ?? 'Could not save — please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleGamePlanSave(data) {
    setSaving(true);
    setSaveError(null);
    try {
      await saveWizardGamePlan(tenantId, user.uid, year, userProfile?.name ?? '', data);
      advance();
    } catch (err) {
      console.error('[OnboardingWizard] saveWizardGamePlan:', err);
      setSaveError(err.message ?? 'Could not save — please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleProfileSave(data) {
    setSaving(true);
    setSaveError(null);
    try {
      await saveWizardProfile(tenantId, user.uid, data);
      advance();
    } catch (err) {
      console.error('[OnboardingWizard] saveWizardProfile:', err);
      setSaveError(err.message ?? 'Could not save — please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEnterApp() {
    setCompleting(true);
    try {
      await markOnboardingComplete(tenantId, user.uid);
      await refreshProfile();
    } catch (err) {
      console.error('[OnboardingWizard] markOnboardingComplete:', err);
      setSaveError('Could not complete setup — please check your connection and try again.');
      await refreshProfile().catch(() => {});
    } finally {
      setCompleting(false);
    }
  }

  const contentIdx = contentStepIndex(step);

  return (
    <div
      className="fixed inset-0 z-50 bg-surface flex flex-col"
      data-testid="onboarding-wizard"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
        <span className="font-display font-bold text-base text-ink tracking-tight">
          AgencyTrack
        </span>
        {contentIdx !== null && (
          <span className="text-xs text-ink-muted">
            Step {contentIdx} of {CONTENT_STEP_COUNT}
          </span>
        )}
      </header>

      {/* Stepper dots — only shown during content steps */}
      {contentIdx !== null && (
        <div className="flex items-center justify-center gap-2 pt-4 shrink-0" aria-hidden="true">
          {Array.from({ length: CONTENT_STEP_COUNT }, (_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-200 ${
                i + 1 === contentIdx
                  ? 'w-6 h-1.5 bg-primary'
                  : i + 1 < contentIdx
                  ? 'w-1.5 h-1.5 bg-primary/60'
                  : 'w-1.5 h-1.5 bg-border'
              }`}
            />
          ))}
        </div>
      )}

      {/* Content area */}
      <main className="flex-1 overflow-y-auto flex flex-col justify-center">
        {saveError && (
          <div
            role="alert"
            className="mx-6 mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm px-4 py-3"
          >
            {saveError}
          </div>
        )}

        {step === STEP_WELCOME && (
          <WizardWelcome onNext={advance} onSkip={skip} />
        )}

        {step === STEP_IDENTITY && (
          <WizardIdentity
            userProfile={userProfile}
            onSave={handleIdentitySave}
            onSkip={skip}
            saving={saving}
          />
        )}

        {step === STEP_MONEY_NEEDS && (
          <WizardMoneyNeeds
            tenantId={tenantId}
            uid={user?.uid}
            year={year}
            onSave={handleMoneyNeedsSave}
            onSkip={skip}
            saving={saving}
          />
        )}

        {step === STEP_GAME_PLAN && (
          <WizardGamePlan
            tenantId={tenantId}
            uid={user?.uid}
            userName={userProfile?.name ?? ''}
            onSave={handleGamePlanSave}
            onSkip={skip}
            saving={saving}
          />
        )}

        {step === STEP_GOALS && (
          <WizardGoals
            tenantId={tenantId}
            uid={user?.uid}
            unitId={userProfile?.unitId ?? null}
            onNext={advance}
            onSkip={skip}
          />
        )}

        {step === STEP_PROFILE && (
          <WizardProfile
            tenantId={tenantId}
            uid={user?.uid}
            userProfile={userProfile}
            onSave={handleProfileSave}
            onSkip={skip}
            saving={saving}
          />
        )}

        {step === STEP_COMPLETION && (
          <WizardCompletion
            userProfile={userProfile}
            onEnterApp={handleEnterApp}
            completing={completing}
          />
        )}
      </main>

      {/* Back nav — shown only on content steps past the first */}
      {step > STEP_WELCOME && step < STEP_COMPLETION && (
        <footer className="px-6 pb-6 pt-2 shrink-0">
          <button
            onClick={back}
            className="text-sm text-ink-muted hover:text-ink transition-colors min-h-[44px] px-2"
          >
            ← Back
          </button>
        </footer>
      )}
    </div>
  );
}

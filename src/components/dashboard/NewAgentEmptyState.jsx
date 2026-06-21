import React from 'react';
import { ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

// New-agent dashboard empty state (shown when allSubmissions.length === 0).
// Replaces the generic "Welcome to AgencyTrack" splash with a personalized,
// oriented, path-previewing hero. Display-only — reuses the .role-hero teal card
// + Nexus typography classes; white text on teal is AA (5.83:1), path-preview
// uses text-white/90 (5.7:1 on #01696f, banked AA-safe). Extracted from
// AgentDashboard so it is unit-testable in isolation.
//
// @param {string}        firstName     agent's first name ('' → name-less fallback)
// @param {number|null}   committedGoal  committed personal annual API goal, or null
// @param {() => void}    onStart        opens the weekly-report wizard
const PATH_STEPS = ['Submit a weekly report', 'See your goal progress', 'Climb the leaderboard'];

export default function NewAgentEmptyState({ firstName, committedGoal, onStart }) {
  const heading = firstName
    ? `Welcome, ${firstName} — your account's ready.`
    : "Welcome — your account's ready.";

  const hasGoal = Number(committedGoal) > 0;
  const subtext = hasGoal
    ? `Your ${formatCurrency(committedGoal)} goal is set. Log your first week to start tracking.`
    : 'Submit your first weekly report to start tracking your goal progress.';

  return (
    <div className="role-hero">
      <div className="goal-period">Get Started</div>
      <h2 className="text-2xl font-extrabold tracking-tight leading-tight">{heading}</h2>
      <p className="goal-target">{subtext}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-white/90">
        {PATH_STEPS.map((step, i) => (
          <React.Fragment key={step}>
            {i > 0 && <ArrowRight size={13} aria-hidden="true" className="opacity-70" />}
            <span>{step}</span>
          </React.Fragment>
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-4 inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-white text-primary dark:text-primary-dark font-semibold text-sm hover:bg-white/95 transition-colors min-h-[44px]"
      >
        Submit your first report
      </button>
    </div>
  );
}

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function WizardCompletion({ userProfile, onEnterApp, completing }) {
  const agentNumber = userProfile?.agentNumber;
  const dob = userProfile?.dateOfBirth;

  return (
    <div className="flex flex-col items-center text-center max-w-sm mx-auto gap-8 py-8 px-6">
      {/* Success icon — small gold accent (AA-checked, constraint accent only) */}
      <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <CheckCircle2 size={40} className="text-amber-600 dark:text-amber-400" />
      </div>

      {/* Copy */}
      <div className="flex flex-col gap-3">
        <h2 className="font-display font-bold text-2xl text-ink leading-tight">
          You&apos;re all set!
        </h2>
        <p className="text-base text-ink-muted leading-relaxed">
          Your profile is ready. You can start logging activity right away.
        </p>
      </div>

      {/* Summary card */}
      {(agentNumber || dob) && (
        <div className="w-full bg-surface-raised rounded-xl border border-border px-4 py-4 flex flex-col gap-2 text-left">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Profile snapshot
          </p>
          {agentNumber && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">Agent number</span>
              <span className="text-sm font-mono tabular-nums font-medium text-ink tracking-wider">
                {agentNumber}
              </span>
            </div>
          )}
          {dob && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">Date of birth</span>
              <span className="text-sm font-medium text-ink">{dob}</span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onEnterApp}
        disabled={completing}
        className="btn-primary w-full h-12 text-base disabled:opacity-60"
      >
        {completing ? 'Loading…' : 'Enter AgencyTrack'}
      </button>
    </div>
  );
}

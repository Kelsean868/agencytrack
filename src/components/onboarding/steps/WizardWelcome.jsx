import React from 'react';
import { ChevronRight } from 'lucide-react';

export default function WizardWelcome({ onNext, onSkip }) {
  return (
    <div className="flex flex-col items-center text-center max-w-sm mx-auto gap-8 py-8 px-6">
      {/* Icon */}
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
          <path d="M3 3h18v18H3z" strokeLinejoin="round" />
          <path d="M3 9h18M9 21V9" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Copy */}
      <div className="flex flex-col gap-3">
        <h1 className="font-display font-bold text-2xl text-ink leading-tight">
          Welcome to AgencyTrack
        </h1>
        <p className="text-base text-ink-muted leading-relaxed">
          Let&apos;s take two minutes to set up your profile so your manager can
          find you and your progress is tracked correctly from day one.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full">
        <button
          onClick={onNext}
          className="btn-primary w-full h-12 flex items-center justify-center gap-2 text-base"
        >
          Get Started <ChevronRight size={18} />
        </button>
        <button
          onClick={onSkip}
          className="text-sm text-ink-muted hover:text-ink transition-colors py-2 min-h-[44px]"
        >
          Skip setup for now
        </button>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import GapAnalysisPanel from '../../goals/GapAnalysisPanel';
import { getGoalHierarchy } from '../../../services/goalsService';

export default function WizardGoals({ tenantId, uid, unitId, onNext, onSkip }) {
  const [hierarchy, setHierarchy] = useState(undefined); // undefined = loading, null = no data
  const [loadErr,   setLoadErr]   = useState(null);

  useEffect(() => {
    if (!tenantId || !uid) return;
    let active = true;
    const year = new Date().getFullYear();
    getGoalHierarchy(tenantId, unitId ?? null, year, uid)
      .then((h)  => { if (active) setHierarchy(h); })
      .catch((err) => {
        console.error('[WizardGoals] getGoalHierarchy:', err);
        if (active) {
          setLoadErr('Could not load your plan — tap Continue to keep going.');
          setHierarchy(null);
        }
      });
    return () => { active = false; };
  }, [tenantId, uid, unitId]);

  const loading = hierarchy === undefined;

  return (
    <div className="flex flex-col gap-6 px-6 py-8 max-w-md mx-auto w-full">
      <div className="flex flex-col gap-2 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Target size={22} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-ink font-display">
          Your goal portfolio
        </h2>
        <p className="text-sm text-ink-muted">
          Here&apos;s how your commitment stacks up. You can drill into the full
          breakdown from your dashboard anytime.
        </p>
      </div>

      {loadErr && (
        <p role="alert" className="text-sm text-warning font-medium text-center">
          {loadErr}
        </p>
      )}

      <GapAnalysisPanel
        hierarchy={hierarchy ?? null}
        ytdTotals={{ api: 0, apps: 0 }}
        loading={loading}
        title="Goal overview"
      />

      <button
        type="button"
        onClick={onNext}
        className="w-full rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold py-3 min-h-[44px] transition-opacity"
      >
        Continue
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="text-sm text-ink-muted hover:text-ink transition-colors min-h-[44px]"
      >
        Skip for now
      </button>
    </div>
  );
}

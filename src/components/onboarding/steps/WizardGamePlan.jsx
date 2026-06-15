import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { deriveAnnualApps } from '../../../lib/deriveApps';

function parseTTD(raw) {
  return parseFloat(String(raw).replace(/,/g, '')) || 0;
}

export default function WizardGamePlan({ onSave, onSkip, saving }) {
  const [annualAPI,  setAnnualAPI]  = useState('');
  const [avgPolicy,  setAvgPolicy]  = useState('');
  const [error,      setError]      = useState(null);

  const derivedApps = annualAPI && avgPolicy
    ? deriveAnnualApps(parseTTD(annualAPI), parseTTD(avgPolicy))
    : null;

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    const api = parseTTD(annualAPI);
    const avg = parseTTD(avgPolicy);
    if (api <= 0) { setError('Enter your Annual API target.'); return; }
    if (avg <= 0) { setError('Enter your average policy size.'); return; }
    await onSave({ annualAPI: api, avgPolicyAPI: avg });
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8 max-w-md mx-auto w-full">
      <div className="flex flex-col gap-2 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <TrendingUp size={22} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-ink font-display">
          Set your Game Plan
        </h2>
        <p className="text-sm text-ink-muted">
          Commit to an annual production target. This locks your Personal
          Commitment and you&apos;ll see it every day on your dashboard.
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wiz-annual-api" className="text-sm font-semibold text-ink">
            Annual API target (TTD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">$</span>
            <input
              id="wiz-annual-api"
              type="number"
              inputMode="decimal"
              min="0"
              step="1000"
              placeholder="e.g. 300000"
              value={annualAPI}
              onChange={(e) => setAnnualAPI(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-8 py-3 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="wiz-avg-policy" className="text-sm font-semibold text-ink">
            Average policy size (TTD)
          </label>
          <p className="text-xs text-ink-muted -mt-0.5">
            Used to calculate how many applications you need to write.
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">$</span>
            <input
              id="wiz-avg-policy"
              type="number"
              inputMode="decimal"
              min="0"
              step="500"
              placeholder="e.g. 12000"
              value={avgPolicy}
              onChange={(e) => setAvgPolicy(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-8 py-3 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
            />
          </div>
        </div>

        {derivedApps !== null && derivedApps > 0 && (
          <div className="rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-ink-muted">Applications needed</p>
            <p className="text-base font-bold tabular-nums text-ink">
              {Math.ceil(derivedApps)}
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger font-medium">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold py-3 min-h-[44px] transition-opacity disabled:opacity-60"
        >
          {saving ? 'Committing…' : 'Commit & Continue'}
        </button>

        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-ink-muted hover:text-ink transition-colors min-h-[44px]"
        >
          Skip for now
        </button>
      </form>
    </div>
  );
}

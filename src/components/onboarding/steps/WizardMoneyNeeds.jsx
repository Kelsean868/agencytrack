import React, { useState } from 'react';
import { DollarSign } from 'lucide-react';

function parseTTD(raw) {
  return parseFloat(String(raw).replace(/,/g, '')) || 0;
}

export default function WizardMoneyNeeds({ onSave, onSkip, saving }) {
  const [monthly, setMonthly] = useState('');
  const [error,   setError]   = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    const monthlyAmt = parseTTD(monthly);
    if (monthlyAmt <= 0) {
      setError('Please enter a monthly income target greater than 0.');
      return;
    }
    await onSave({ monthly: monthlyAmt });
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8 max-w-md mx-auto w-full">
      <div className="flex flex-col gap-2 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <DollarSign size={22} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-ink font-display">
          What do you need to take home?
        </h2>
        <p className="text-sm text-ink-muted">
          Set a monthly after-tax income target. This seeds your Money Needs worksheet
          — you can fill in the full breakdown anytime.
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wiz-monthly-target" className="text-sm font-semibold text-ink">
            Monthly take-home target (TTD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm font-medium pointer-events-none">
              $
            </span>
            <input
              id="wiz-monthly-target"
              type="number"
              inputMode="decimal"
              min="0"
              step="100"
              placeholder="e.g. 10000"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-8 py-3 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
              aria-describedby={error ? 'wiz-mn-error' : undefined}
            />
          </div>
          {monthly && parseTTD(monthly) > 0 && (
            <p className="text-xs text-ink-muted">
              Annual target: TTD{' '}
              {(parseTTD(monthly) * 12).toLocaleString('en-TT', { maximumFractionDigits: 0 })}
            </p>
          )}
        </div>

        {error && (
          <p id="wiz-mn-error" role="alert" className="text-sm text-danger font-medium">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold py-3 min-h-[44px] transition-opacity disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save & Continue'}
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

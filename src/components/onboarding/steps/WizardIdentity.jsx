import React, { useState } from 'react';
import { AlertTriangle, Lock, ChevronRight } from 'lucide-react';
import { getTodayTT } from '../../../utils/dateInputs';

// Soft-validation: 3 digits + 1 letter + 2 digits (e.g. 012B34)
const AGENT_NUM_RE = /^\d{3}[A-Za-z]\d{2}$/;

export default function WizardIdentity({ userProfile, onSave, onSkip, saving }) {
  const lockedAgentNumber = userProfile?.agentNumber || null;
  const lockedDob = userProfile?.dateOfBirth || null;

  const [agentNumber, setAgentNumber] = useState(lockedAgentNumber || '');
  const [dob, setDob] = useState(lockedDob || '');
  const [formatWarn, setFormatWarn] = useState(false);

  const isLocked = !!lockedAgentNumber;
  const today = getTodayTT();

  function handleAgentNumberChange(e) {
    const v = e.target.value.toUpperCase();
    setAgentNumber(v);
    setFormatWarn(v.length > 0 && !AGENT_NUM_RE.test(v));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ agentNumber: agentNumber.trim(), dateOfBirth: dob });
  }

  const canSave = !saving && (agentNumber.trim().length > 0 || dob.length > 0);

  return (
    <div className="flex flex-col gap-6 max-w-sm mx-auto w-full px-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display font-bold text-xl text-ink">Your identity</h2>
        <p className="text-sm text-ink-muted leading-relaxed">
          This is set once. Your manager can correct it if needed.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Agent Number */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wizard-agent-number" className="text-sm font-medium text-ink">
            Agent number
          </label>
          {isLocked ? (
            <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-border bg-surface-raised text-ink-muted">
              <Lock size={14} className="shrink-0" />
              <span className="font-mono tabular-nums tracking-wider text-sm">{lockedAgentNumber}</span>
              <span className="ml-auto text-xs text-ink-muted">locked</span>
            </div>
          ) : (
            <>
              <input
                id="wizard-agent-number"
                type="text"
                inputMode="text"
                placeholder="000A00"
                value={agentNumber}
                onChange={handleAgentNumberChange}
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                className="h-11 px-3 rounded-xl border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono tabular-nums tracking-wider text-sm"
                aria-describedby={formatWarn ? 'wizard-agent-number-warn' : undefined}
              />
              {formatWarn && (
                <div
                  id="wizard-agent-number-warn"
                  role="status"
                  className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2"
                >
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    Format looks unusual — expected 3 digits + 1 letter + 2 digits (e.g.&nbsp;012B34).
                    Your manager can correct this after setup.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Date of Birth */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wizard-dob" className="text-sm font-medium text-ink">
            Date of birth
          </label>
          {lockedDob ? (
            <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-border bg-surface-raised text-ink-muted">
              <Lock size={14} className="shrink-0" />
              <span className="text-sm">{lockedDob}</span>
              <span className="ml-auto text-xs text-ink-muted">locked</span>
            </div>
          ) : (
            <input
              id="wizard-dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={today}
              min="1900-01-01"
              className="h-11 px-3 rounded-xl border border-border bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            type="submit"
            disabled={!canSave}
            className="btn-primary w-full h-12 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {saving ? 'Saving…' : (
              <>Save &amp; Continue <ChevronRight size={18} /></>
            )}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-ink-muted hover:text-ink transition-colors py-2 min-h-[44px]"
          >
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}

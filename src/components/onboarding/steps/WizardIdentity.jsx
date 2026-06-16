import React, { useState, useMemo } from 'react';
import { AlertTriangle, Lock, ChevronRight } from 'lucide-react';
import { getTodayTT, computeMonthsFromDate, parseDateOnlyTT } from '../../../utils/dateInputs';

// Soft-validation: 3 digits + 1 letter + 2 digits (e.g. 012B34)
const AGENT_NUM_RE = /^\d{3}[A-Za-z]\d{2}$/;
const MAX_INDUSTRY_MONTHS = 600;

export default function WizardIdentity({ userProfile, onSave, onSkip, saving }) {
  const lockedAgentNumber      = userProfile?.agentNumber || null;
  const lockedDob              = userProfile?.dateOfBirth || null;
  const lockedContractDate     = (userProfile?.contractStartDate && userProfile.contractStartDate !== '')
    ? userProfile.contractStartDate : null;
  const lockedMonthsAtTatil    = typeof userProfile?.monthsAtTatil    === 'number' && !isNaN(userProfile.monthsAtTatil)    ? userProfile.monthsAtTatil    : null;
  const lockedMonthsInIndustry = typeof userProfile?.monthsInIndustry === 'number' && !isNaN(userProfile.monthsInIndustry) ? userProfile.monthsInIndustry : null;

  const [agentNumber,    setAgentNumber]    = useState(lockedAgentNumber || '');
  const [dob,            setDob]            = useState(lockedDob || '');
  const [contractDate,   setContractDate]   = useState(lockedContractDate || '');
  const [isFirstCompany, setIsFirstCompany] = useState(null);
  const [industryMonths, setIndustryMonths] = useState('');
  const [formatWarn,     setFormatWarn]     = useState(false);

  const today = getTodayTT();

  function handleAgentNumberChange(e) {
    const v = e.target.value.toUpperCase();
    setAgentNumber(v);
    setFormatWarn(v.length === 6 && !AGENT_NUM_RE.test(v));
  }

  const isContractDateValid = useMemo(() => {
    if (!contractDate) return false;
    try {
      const d       = parseDateOnlyTT(contractDate);
      const minDate = parseDateOnlyTT('1980-01-01');
      const todayDate = parseDateOnlyTT(today);
      return d >= minDate && d <= todayDate;
    } catch {
      return false;
    }
  }, [contractDate, today]);

  const monthsAtTatilComputed = useMemo(
    () => (contractDate ? computeMonthsFromDate(contractDate) : 0),
    [contractDate],
  );

  const parsedIndustryMonths = Math.floor(Number(industryMonths));
  const industryMonthsValid  = industryMonths !== ''
    && !isNaN(parsedIndustryMonths)
    && parsedIndustryMonths >= monthsAtTatilComputed
    && parsedIndustryMonths <= MAX_INDUSTRY_MONTHS;

  const hasContractDateEntry = contractDate.length > 0 && !lockedContractDate && isContractDateValid;
  const tenureBlockComplete  = !hasContractDateEntry
    || (isFirstCompany !== null && (isFirstCompany === true || industryMonthsValid));

  const canSave = !saving
    && tenureBlockComplete
    && (agentNumber.trim().length > 0 || dob.length > 0 || hasContractDateEntry);

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { agentNumber: agentNumber.trim(), dateOfBirth: dob };
    if (contractDate && !lockedContractDate && isFirstCompany !== null) {
      const mAtTatil    = computeMonthsFromDate(contractDate);
      const mInIndustry = isFirstCompany ? mAtTatil : parsedIndustryMonths;
      payload.contractStartDate  = contractDate;
      payload.monthsAtTatil      = mAtTatil;
      payload.monthsInIndustry   = mInIndustry;
    }
    onSave(payload);
  }

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
          {lockedAgentNumber ? (
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

        {/* Contract start date */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wizard-contract-date" className="text-sm font-medium text-ink">
            Contract start date
            <span className="ml-1 text-xs text-ink-muted font-normal">(when you joined Tatil)</span>
          </label>
          {lockedContractDate ? (
            <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-border bg-surface-raised text-ink-muted">
              <Lock size={14} className="shrink-0" />
              <span className="text-sm">{lockedContractDate}</span>
              <span className="ml-auto text-xs text-ink-muted">locked</span>
            </div>
          ) : (
            <input
              id="wizard-contract-date"
              type="date"
              value={contractDate}
              onChange={(e) => {
                setContractDate(e.target.value);
                setIsFirstCompany(null);
                setIndustryMonths('');
              }}
              max={today}
              min="1980-01-01"
              className="h-11 px-3 rounded-xl border border-border bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
            />
          )}
        </div>

        {/* Industry tenure — shown when contract date is entered (not locked) */}
        {hasContractDateEntry && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-ink">
                Is Tatil Life your first company as an insurance agent?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFirstCompany(true)}
                  className={`flex-1 h-10 rounded-xl border text-sm font-medium transition-colors ${
                    isFirstCompany === true
                      ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
                      : 'border-border text-ink-muted hover:border-primary/50'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsFirstCompany(false)}
                  className={`flex-1 h-10 rounded-xl border text-sm font-medium transition-colors ${
                    isFirstCompany === false
                      ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
                      : 'border-border text-ink-muted hover:border-primary/50'
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            {/* Yes → derived months hint */}
            {isFirstCompany === true && (
              <p className="text-xs text-ink-muted" data-testid="wizard-derived-months">
                Industry tenure derived from your contract date:{' '}
                <span className="font-medium">
                  {monthsAtTatilComputed} month{monthsAtTatilComputed !== 1 ? 's' : ''}
                </span>.
              </p>
            )}

            {/* No → enter total industry months */}
            {isFirstCompany === false && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="wizard-industry-months" className="text-sm font-medium text-ink">
                  Total months as an insurance agent
                </label>
                <input
                  id="wizard-industry-months"
                  type="number"
                  inputMode="numeric"
                  min={monthsAtTatilComputed}
                  max={MAX_INDUSTRY_MONTHS}
                  value={industryMonths}
                  onChange={(e) => setIndustryMonths(e.target.value)}
                  placeholder={String(monthsAtTatilComputed)}
                  className="h-11 px-3 rounded-xl border border-border bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                />
                {industryMonths !== '' && !industryMonthsValid && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Must be {monthsAtTatilComputed}–{MAX_INDUSTRY_MONTHS} months (can&apos;t be less than your Tatil tenure).
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Locked tenure summary */}
        {lockedContractDate && lockedMonthsAtTatil !== null && (
          <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-border bg-surface-raised text-ink-muted text-sm">
            <Lock size={14} className="shrink-0" />
            <span>
              {lockedMonthsAtTatil} mo at Tatil &middot; {lockedMonthsInIndustry} mo in industry
            </span>
            <span className="ml-auto text-xs text-ink-muted">locked</span>
          </div>
        )}

        {/* Note */}
        <p className="text-xs text-ink-muted leading-relaxed -mt-2">
          Your manager will confirm your details.
        </p>

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

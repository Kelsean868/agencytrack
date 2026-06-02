import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Plus, Loader2, Check, Minus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  saveDailyEntry,
  getDailyEntry,
  getDailyEntriesForWeek,
} from '../../services/dailyActivityService';
import { createEmptyDailyEntry, getSundayOf } from '../../lib/schema/dailyActivity';
import {
  computeLumpsumCredit,
  computeLumpsumCommission,
  computeTotalProductionCredit,
  validatePppIncrease,
} from '../../lib/schema/weeklyReport.computations';
import { MIN_PPP_INCREASE } from '../../lib/schema/weeklyReport';
import { formatCurrency } from '../../utils/formatters';
import { deriveCountStripChips } from './DailyCaptureV2.helpers';

// ── Local helpers ──────────────────────────────────────────────────────────

function getTodayLocalDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function weekdayLong(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-TT', { weekday: 'long' }).toUpperCase();
}

function isoWeekNumber(dateStr) {
  // Sunday-anchored week number (week containing Jan 1 = week 1).
  const d = new Date(dateStr + 'T12:00:00Z');
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((d - start) / 86400000);
  return Math.ceil((diffDays + start.getUTCDay() + 1) / 7);
}

const intOrZero = (v) => parseInt(v, 10) || 0;
const floatOrZero = (v) => parseFloat(v) || 0;

// ── Sub-components ─────────────────────────────────────────────────────────

function Stepper({ value, onChange, ariaLabel, allowDecimal = false }) {
  const v = allowDecimal ? floatOrZero(value) : intOrZero(value);
  const step = allowDecimal ? 0.5 : 1;
  const handle = (next) => {
    if (next < 0) return;
    onChange(allowDecimal ? next : Math.round(next));
  };
  const handleType = (raw) => {
    if (raw === '') return onChange(0);
    if (allowDecimal) {
      const n = parseFloat(raw);
      if (!Number.isNaN(n) && n >= 0) onChange(n);
    } else {
      const cleaned = raw.replace(/[^0-9]/g, '');
      onChange(cleaned === '' ? 0 : parseInt(cleaned, 10));
    }
  };
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`${ariaLabel} decrease`}
        onClick={() => handle(v - step)}
        disabled={v <= 0}
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-border bg-card text-ink hover:border-primary/50 hover:text-primary disabled:opacity-40 disabled:hover:border-border disabled:hover:text-ink transition-colors"
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <input
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        pattern={allowDecimal ? undefined : '[0-9]*'}
        value={v === 0 ? '' : v}
        placeholder="0"
        aria-label={ariaLabel}
        onChange={(e) => handleType(e.target.value)}
        className="w-12 h-11 text-center rounded-lg border border-border bg-surface text-ink text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        type="button"
        aria-label={`${ariaLabel} increase`}
        onClick={() => handle(v + step)}
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-border bg-card text-ink hover:border-primary/50 hover:text-primary transition-colors"
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function StepperRow({ label, name, value, onChange, allowDecimal = false }) {
  const id = `dcv2-${name}`;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <label htmlFor={id} className="text-sm text-ink flex-1">
        {label}
      </label>
      <Stepper
        value={value}
        onChange={(v) => onChange(name, v)}
        ariaLabel={label}
        allowDecimal={allowDecimal}
      />
    </div>
  );
}

function MoneyRow({ label, name, value, onChange }) {
  const id = `dcv2-${name}-money`;
  const v = floatOrZero(value);
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <label htmlFor={id} className="text-sm text-ink flex-1">
        {label}
      </label>
      <div className="flex h-11 rounded-lg border border-border overflow-hidden bg-surface">
        <span className="flex items-center px-2 text-[11px] font-semibold text-ink-muted bg-surface border-r border-border shrink-0">
          TTD
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={v === 0 ? '' : v}
          placeholder="0.00"
          aria-label={`${label} (TTD)`}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9.]/g, '');
            onChange(name, cleaned === '' ? 0 : floatOrZero(cleaned));
          }}
          className="w-28 px-2 bg-transparent text-ink text-base text-right focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
    </div>
  );
}

function GroupCard({ accent, title, filledCount, totalCount, headerRight, children }) {
  const dotClass =
    accent === 'gold'
      ? 'bg-warning'
      : 'bg-primary';
  const borderClass =
    accent === 'gold'
      ? 'border-warning/30'
      : 'border-primary/20';
  return (
    <div className={`rounded-xl bg-card border ${borderClass} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${dotClass}`}
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
        </div>
        {headerRight != null ? (
          headerRight
        ) : (
          <span className="text-xs font-mono text-ink-muted">
            {filledCount}/{totalCount}
          </span>
        )}
      </div>
      <div className="flex flex-col divide-y divide-border/50">{children}</div>
    </div>
  );
}

function CountStrip({ chips, loading }) {
  const items = [
    { label: 'APPR', value: chips.appr },
    { label: 'FFI',  value: chips.ffi },
    { label: 'CI',   value: chips.ci },
    { label: 'APPS', value: chips.apps },
  ];
  return (
    <div
      data-testid="dcv2-count-strip"
      className="grid grid-cols-4 gap-2 mt-2"
      aria-label="Week-to-date counts"
    >
      {items.map((it) => (
        <div
          key={it.label}
          data-testid={`dcv2-chip-${it.label.toLowerCase()}`}
          className="flex flex-col items-center rounded-lg bg-card-raised border border-border/60 px-2 py-1.5"
        >
          <span className="text-lg font-bold text-ink leading-tight">
            {loading ? '–' : it.value}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
            {it.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DailyCaptureV2({ onClose }) {
  const { user, userProfile, tenantId } = useAuth();
  const agentName = userProfile?.name ?? userProfile?.email ?? '';
  const today = useMemo(() => getTodayLocalDate(), []);
  const weekStarting = useMemo(() => getSundayOf(today), [today]);

  const [data, setData] = useState(() =>
    createEmptyDailyEntry(today, user?.uid ?? '', agentName)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [pppExpanded, setPppExpanded] = useState(false);
  const [reflectionExpanded, setReflectionExpanded] = useState(false);
  const [chips, setChips] = useState({ appr: 0, ffi: 0, ci: 0, apps: 0 });
  const [chipsLoading, setChipsLoading] = useState(true);

  // Initial load — today's entry (if any).
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    getDailyEntry(tenantId, user.uid, today)
      .then((existing) => {
        if (existing) {
          setData((prev) => ({ ...prev, ...existing }));
          if (
            existing.pppIncreases?.apps > 0 ||
            existing.pppIncreases?.apiIncrease > 0 ||
            existing.lumpsums?.grossAmount > 0
          ) {
            setPppExpanded(true);
          }
          if (
            existing.hoursWorked != null ||
            existing.wins ||
            existing.blockers
          ) {
            setReflectionExpanded(true);
          }
        }
      })
      .catch((e) => {
        console.error('Failed to load daily entry:', e);
        setError('Could not load today — your save will overwrite.');
      })
      .finally(() => setLoading(false));
  }, [user?.uid, today, tenantId]);

  // Count-strip read — on mount, and after a successful save.
  const refreshChips = useCallback(async () => {
    if (!user?.uid) return;
    setChipsLoading(true);
    try {
      const weekDocs = await getDailyEntriesForWeek(tenantId, user.uid, weekStarting);
      setChips(deriveCountStripChips(weekDocs));
    } catch (e) {
      console.error('Count-strip read failed:', e);
      // Leave previous chips in place rather than zero them.
    } finally {
      setChipsLoading(false);
    }
  }, [tenantId, user?.uid, weekStarting]);

  useEffect(() => {
    refreshChips();
  }, [refreshChips]);

  // Field setters.
  const handleChange = (name, value) => {
    setData((prev) => ({ ...prev, [name]: value }));
  };
  const nbChange = (field, value) => {
    setData((prev) => ({ ...prev, newBusiness: { ...prev.newBusiness, [field]: value } }));
  };
  const pppChange = (field, value) => {
    setData((prev) => ({
      ...prev,
      pppIncreases: { ...prev.pppIncreases, [field]: value },
    }));
  };
  const lmpsChange = (field, value) => {
    setData((prev) => ({ ...prev, lumpsums: { ...prev.lumpsums, [field]: value } }));
  };

  // Derived: per-day production credit (display only).
  const lmpsGross = floatOrZero(data.lumpsums?.grossAmount);
  const lmpsCredit = computeLumpsumCredit(lmpsGross);
  const lmpsCommission = computeLumpsumCommission(lmpsGross);
  const dayProductionCredit = computeTotalProductionCredit({
    newBusiness:  data.newBusiness ?? {},
    pppIncreases: data.pppIncreases ?? {},
    lumpsums:     { ...(data.lumpsums ?? {}), apiCredit: lmpsCredit },
  });

  // PPP soft-warning (same rule as the v1 modal).
  const pppApps = intOrZero(data.pppIncreases?.apps);
  const pppInc = floatOrZero(data.pppIncreases?.apiIncrease);
  const pppAvgPerApp = pppApps > 0 ? pppInc / pppApps : null;
  const pppWarn = pppInc > 0 && pppAvgPerApp != null && !validatePppIncrease(pppAvgPerApp);

  // {filled}/{total} counters — display-only, value > 0.
  const prospectingFilled =
    (intOrZero(data.qualifiedApproaches) > 0 ? 1 : 0) +
    (intOrZero(data.newNamesAdded) > 0 ? 1 : 0) +
    (intOrZero(data.oldNamesWorked) > 0 ? 1 : 0) +
    (intOrZero(data.serviceContacts) > 0 ? 1 : 0);
  const apptsFilled =
    (intOrZero(data.appointmentsSet) > 0 ? 1 : 0) +
    (intOrZero(data.ffisScheduled) > 0 ? 1 : 0) +
    (intOrZero(data.ffiConducted) > 0 ? 1 : 0);
  const interviewsFilled =
    (intOrZero(data.newCIBooked) > 0 ? 1 : 0) +
    (intOrZero(data.oldCIBooked) > 0 ? 1 : 0) +
    (intOrZero(data.ciConducted) > 0 ? 1 : 0) +
    (intOrZero(data.solutionPresentations) > 0 ? 1 : 0);

  const handleSave = async () => {
    if (!user?.uid) return;
    setSaving(true);
    setError('');
    try {
      await saveDailyEntry(tenantId, user.uid, agentName, today, data);
      setSavedAt(new Date());
      // Refresh the count strip so today's just-saved entry is reflected.
      await refreshChips();
      setTimeout(() => onClose?.(), 600);
    } catch (e) {
      console.error('Save failed:', e);
      setError('Save failed — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-bg flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dcv2-title"
      data-testid="daily-capture-v2"
    >
      {/* Sticky header — Log Today + reduced WTD count strip */}
      <header className="px-4 pt-4 pb-3 bg-bg shrink-0 border-b border-border/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 id="dcv2-title" className="text-lg font-bold text-ink leading-tight">
              Log Today
            </h1>
            <p className="text-[11px] font-mono uppercase tracking-widest text-ink-muted mt-0.5">
              {weekdayLong(today)} · WK {isoWeekNumber(today)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 -mt-2 -mr-2 flex items-center justify-center rounded-full hover:bg-surface text-ink-muted transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <CountStrip chips={chips} loading={chipsLoading} />
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm text-ink-muted mt-3">Loading today's entry…</p>
          </div>
        ) : (
          <div className="px-4 py-4 max-w-lg mx-auto flex flex-col gap-4">
            {/* Prospecting */}
            <GroupCard
              accent="teal"
              title="Prospecting"
              filledCount={prospectingFilled}
              totalCount={4}
            >
              <StepperRow
                label="Qualified approaches"
                name="qualifiedApproaches"
                value={data.qualifiedApproaches}
                onChange={handleChange}
              />
              <StepperRow
                label="New names added"
                name="newNamesAdded"
                value={data.newNamesAdded}
                onChange={handleChange}
              />
              <StepperRow
                label="Old names worked"
                name="oldNamesWorked"
                value={data.oldNamesWorked}
                onChange={handleChange}
              />
              <StepperRow
                label="Service contacts"
                name="serviceContacts"
                value={data.serviceContacts}
                onChange={handleChange}
              />
            </GroupCard>

            {/* Appointments & FFI */}
            <GroupCard
              accent="teal"
              title="Appointments & FFI"
              filledCount={apptsFilled}
              totalCount={3}
            >
              <StepperRow
                label="Appointments set"
                name="appointmentsSet"
                value={data.appointmentsSet}
                onChange={handleChange}
              />
              <StepperRow
                label="FFIs scheduled"
                name="ffisScheduled"
                value={data.ffisScheduled}
                onChange={handleChange}
              />
              <StepperRow
                label="FFIs conducted"
                name="ffiConducted"
                value={data.ffiConducted}
                onChange={handleChange}
              />
            </GroupCard>

            {/* Interviews */}
            <GroupCard
              accent="gold"
              title="Interviews"
              filledCount={interviewsFilled}
              totalCount={4}
            >
              <StepperRow
                label="New CIs booked"
                name="newCIBooked"
                value={data.newCIBooked}
                onChange={handleChange}
              />
              <StepperRow
                label="Old CIs booked"
                name="oldCIBooked"
                value={data.oldCIBooked}
                onChange={handleChange}
              />
              <StepperRow
                label="CIs conducted"
                name="ciConducted"
                value={data.ciConducted}
                onChange={handleChange}
              />
              <StepperRow
                label="Solution presentations"
                name="solutionPresentations"
                value={data.solutionPresentations}
                onChange={handleChange}
              />
            </GroupCard>

            {/* Production */}
            <GroupCard
              accent="gold"
              title="Production"
              headerRight={
                dayProductionCredit > 0 ? (
                  <span
                    data-testid="dcv2-day-credit"
                    className="text-xs font-semibold text-warning"
                  >
                    {formatCurrency(dayProductionCredit)} credit
                  </span>
                ) : (
                  <span className="text-xs font-mono text-ink-muted">—</span>
                )
              }
            >
              <StepperRow
                label="New business — apps"
                name="apps"
                value={data.newBusiness?.apps ?? 0}
                onChange={nbChange}
              />
              <MoneyRow
                label="New business — API"
                name="api"
                value={data.newBusiness?.api ?? 0}
                onChange={nbChange}
              />

              {/* PPP / Lumpsums disclosure — collapsed by default */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setPppExpanded((v) => !v)}
                  className="w-full min-h-[44px] flex items-center justify-between gap-2 text-sm font-semibold text-ink-muted hover:text-primary transition-colors"
                  aria-expanded={pppExpanded}
                  aria-controls="dcv2-ppp-body"
                >
                  <span>PPP increases &amp; lumpsums — optional</span>
                  <span aria-hidden="true">{pppExpanded ? '▴' : '▾'}</span>
                </button>
                {pppExpanded && (
                  <div id="dcv2-ppp-body" className="flex flex-col divide-y divide-border/50 mt-2">
                    <StepperRow
                      label="PPP increases — apps"
                      name="apps"
                      value={data.pppIncreases?.apps ?? 0}
                      onChange={pppChange}
                    />
                    <MoneyRow
                      label="PPP — API increase"
                      name="apiIncrease"
                      value={data.pppIncreases?.apiIncrease ?? 0}
                      onChange={pppChange}
                    />
                    <MoneyRow
                      label="Lumpsum — gross"
                      name="grossAmount"
                      value={data.lumpsums?.grossAmount ?? 0}
                      onChange={lmpsChange}
                    />
                    {pppWarn && (
                      <p className="text-xs text-warning font-medium py-2" role="status">
                        Average {formatCurrency(Math.round(pppAvgPerApp))} per app is below the {formatCurrency(MIN_PPP_INCREASE)} minimum.
                      </p>
                    )}
                    {lmpsGross > 0 && (
                      <div className="pt-2 pb-1 flex flex-col gap-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-ink-muted">Lumpsum API credit (10%)</span>
                          <span className="font-semibold text-primary">
                            {formatCurrency(lmpsCredit)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-ink-muted">Lumpsum commission (0.5%)</span>
                          <span className="font-semibold text-primary">
                            {formatCurrency(lmpsCommission)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </GroupCard>

            {/* Reflection (D1) — disclosure + always-visible Note */}
            <div className="rounded-xl bg-card border border-border/60 p-4">
              <button
                type="button"
                onClick={() => setReflectionExpanded((v) => !v)}
                className="w-full min-h-[44px] flex items-center justify-between gap-2 text-sm font-semibold text-ink-muted hover:text-primary transition-colors"
                aria-expanded={reflectionExpanded}
                aria-controls="dcv2-reflection-body"
              >
                <span>Reflection — optional</span>
                <span aria-hidden="true">{reflectionExpanded ? '▴' : '▾'}</span>
              </button>
              {reflectionExpanded && (
                <div
                  id="dcv2-reflection-body"
                  className="flex flex-col gap-3 mt-3 pb-3 border-b border-border/50"
                >
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Optional journal — captured per day, not propagated to the weekly report.
                  </p>
                  <StepperRow
                    label="Hours worked"
                    name="hoursWorked"
                    value={data.hoursWorked ?? 0}
                    onChange={(_n, v) => handleChange('hoursWorked', v === 0 ? null : v)}
                    allowDecimal
                  />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="dcv2-wins" className="text-sm font-medium text-ink">
                      Wins
                    </label>
                    <textarea
                      id="dcv2-wins"
                      rows={2}
                      value={data.wins}
                      onChange={(e) => handleChange('wins', e.target.value)}
                      placeholder="What went well today…"
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-border/60 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="dcv2-blockers" className="text-sm font-medium text-ink">
                      Blockers
                    </label>
                    <textarea
                      id="dcv2-blockers"
                      rows={2}
                      value={data.blockers}
                      onChange={(e) => handleChange('blockers', e.target.value)}
                      placeholder="What got in the way…"
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-border/60 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1 pt-3">
                <label htmlFor="dcv2-note" className="text-sm font-medium text-ink">
                  Note — optional
                </label>
                <textarea
                  id="dcv2-note"
                  rows={3}
                  value={data.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Anything else to remember…"
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border/60 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </main>

      {/* Sticky save footer */}
      <footer className="px-4 py-4 border-t border-border bg-card shrink-0">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          data-testid="dcv2-save"
          className="w-full h-12 rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-base hover:bg-primary/90 dark:hover:bg-primary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Saving…
            </>
          ) : savedAt ? (
            <>
              <Check size={18} /> Saved
            </>
          ) : (
            <>
              Save today
              <span className="text-[10px] font-mono uppercase tracking-widest opacity-80">
                · Rolls into WK {isoWeekNumber(today)}
              </span>
            </>
          )}
        </button>
      </footer>
    </div>
  );
}

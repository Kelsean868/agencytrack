import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Loader2, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, NumericField, CurrencyField } from '../wizard/CardStack';
import { saveDailyEntry, getDailyEntry } from '../../services/dailyActivityService';
import { createEmptyDailyEntry } from '../../lib/schema/dailyActivity';
import {
  computeLumpsumCredit,
  computeLumpsumCommission,
  validatePppIncrease,
} from '../../lib/schema/weeklyReport.computations';
import { MIN_PPP_INCREASE } from '../../lib/schema/weeklyReport';
import { formatCurrency } from '../../utils/formatters';
import { getTodayTT } from '../../utils/dateInputs';

function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-TT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function DailyEntryModal({ onClose }) {
  const { user, userProfile, tenantId } = useAuth();
  const agentName = userProfile?.name ?? userProfile?.email ?? '';
  const today = useMemo(() => getTodayTT(), []);

  const [data, setData] = useState(() =>
    createEmptyDailyEntry(today, user?.uid ?? '', agentName)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [pppExpanded, setPppExpanded] = useState(false);
  const [lumpsumsExpanded, setLumpsumsExpanded] = useState(false);
  const [reflectionExpanded, setReflectionExpanded] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    getDailyEntry(tenantId, user.uid, today)
      .then((existing) => {
        if (existing) {
          setData((prev) => ({ ...prev, ...existing }));
          if (existing.pppIncreases?.apps > 0 || existing.pppIncreases?.apiIncrease > 0) {
            setPppExpanded(true);
          }
          if (existing.lumpsums?.grossAmount > 0) {
            setLumpsumsExpanded(true);
          }
          if (
            existing.hoursWorked != null ||
            existing.wins ||
            existing.blockers ||
            existing.notes
          ) {
            setReflectionExpanded(true);
          }
        }
      })
      .catch((e) => {
        console.error('Failed to load daily entry:', e);
        setError('Could not load existing entry — your save will overwrite.');
      })
      .finally(() => setLoading(false));
  }, [user?.uid, today, tenantId]);

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
  const removePPP = () => {
    setData((prev) => ({ ...prev, pppIncreases: { apps: 0, apiIncrease: 0 } }));
    setPppExpanded(false);
  };
  const removeLumpsums = () => {
    setData((prev) => ({ ...prev, lumpsums: { grossAmount: 0 } }));
    setLumpsumsExpanded(false);
  };

  const lmpsGross = data.lumpsums?.grossAmount ?? 0;
  const lmpsCredit = computeLumpsumCredit(lmpsGross);
  const lmpsComm = computeLumpsumCommission(lmpsGross);

  const pppApps = data.pppIncreases?.apps ?? 0;
  const pppInc = data.pppIncreases?.apiIncrease ?? 0;
  const pppAvgPerApp = pppApps > 0 ? pppInc / pppApps : null;
  const pppWarn = pppInc > 0 && pppAvgPerApp !== null && !validatePppIncrease(pppAvgPerApp);

  const handleSave = async () => {
    if (!user?.uid) return;
    setSaving(true);
    setError('');
    try {
      await saveDailyEntry(tenantId, user.uid, agentName, today, data);
      setSavedAt(new Date());
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
      aria-labelledby="daily-entry-title"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 bg-bg shrink-0 border-b border-border/40">
        <div>
          <p className="text-xs font-medium text-ink-muted">Daily entry</p>
          <h1 id="daily-entry-title" className="text-lg font-bold text-ink leading-tight">
            Log today — {formatDateLong(today)}
          </h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface text-ink-muted transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
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
            {/* Activity */}
            <Card badge="Activity" desc="Approaches, appointments, FFIs and CIs you logged today.">
              <div className="flex flex-col gap-4">
                <NumericField
                  label="Qualified Approaches"
                  name="qualifiedApproaches"
                  value={data.qualifiedApproaches}
                  onChange={handleChange}
                />
                <NumericField
                  label="Appointments Set"
                  name="appointmentsSet"
                  value={data.appointmentsSet}
                  onChange={handleChange}
                />
                <NumericField
                  label="FFIs Scheduled"
                  name="ffisScheduled"
                  value={data.ffisScheduled}
                  onChange={handleChange}
                />
                <NumericField
                  label="FFIs Conducted"
                  name="ffiConducted"
                  value={data.ffiConducted}
                  onChange={handleChange}
                />
                <NumericField
                  label="Solution Presentations"
                  name="solutionPresentations"
                  value={data.solutionPresentations}
                  onChange={handleChange}
                />
                <NumericField
                  label="New CIs Booked"
                  name="newCIBooked"
                  value={data.newCIBooked}
                  onChange={handleChange}
                />
                <NumericField
                  label="Old CIs Booked"
                  name="oldCIBooked"
                  value={data.oldCIBooked}
                  onChange={handleChange}
                />
                <NumericField
                  label="CIs Conducted"
                  name="ciConducted"
                  value={data.ciConducted}
                  onChange={handleChange}
                />
              </div>
            </Card>

            {/* Names & Service */}
            <Card badge="Names & Service" desc="Pipeline activity that doesn't count as production.">
              <div className="flex flex-col gap-4">
                <NumericField
                  label="New names added today"
                  name="newNamesAdded"
                  value={data.newNamesAdded}
                  onChange={handleChange}
                />
                <NumericField
                  label="Old names worked today"
                  name="oldNamesWorked"
                  value={data.oldNamesWorked}
                  onChange={handleChange}
                />
                <NumericField
                  label="Service contacts today"
                  name="serviceContacts"
                  value={data.serviceContacts}
                  onChange={handleChange}
                />
              </div>
            </Card>

            {/* Production — New Business primary */}
            <Card badge="New Business" desc="New policy applications sold today.">
              <div className="flex flex-col gap-4">
                <NumericField
                  label="Applications Written"
                  name="apps"
                  value={data.newBusiness?.apps ?? 0}
                  onChange={nbChange}
                />
                <CurrencyField
                  label="API today (TTD)"
                  name="api"
                  value={data.newBusiness?.api ?? 0}
                  onChange={nbChange}
                />
              </div>
            </Card>

            {/* PPP Increases */}
            <Card
              badge="PPP Increases"
              desc={`Minimum ${formatCurrency(MIN_PPP_INCREASE)} API increase per application.`}
            >
              {!pppExpanded ? (
                <button
                  type="button"
                  onClick={() => setPppExpanded(true)}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 bg-card-raised text-primary text-sm font-semibold hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Plus size={16} />
                  Add PPP details
                </button>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-end -mt-1">
                    <button
                      type="button"
                      onClick={removePPP}
                      className="flex items-center gap-1 text-xs text-ink-muted hover:text-danger transition-colors"
                    >
                      <X size={12} />
                      Remove
                    </button>
                  </div>
                  <NumericField
                    label="Number of PPP increases"
                    name="apps"
                    inputId="ppp-apps"
                    value={data.pppIncreases?.apps ?? 0}
                    onChange={pppChange}
                  />
                  <CurrencyField
                    label="Total API increase (TTD)"
                    name="apiIncrease"
                    inputId="ppp-api-increase"
                    value={data.pppIncreases?.apiIncrease ?? 0}
                    onChange={pppChange}
                  />
                  {pppWarn && (
                    <p className="text-xs text-warning-ink font-medium" role="status">
                      Average {formatCurrency(Math.round(pppAvgPerApp))} per application is below
                      the {formatCurrency(MIN_PPP_INCREASE)} minimum — check your figures.
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* Lumpsums */}
            <Card badge="Lumpsums" desc="10% API credit · 0.5% commission (fixed rates).">
              {!lumpsumsExpanded ? (
                <button
                  type="button"
                  onClick={() => setLumpsumsExpanded(true)}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 bg-card-raised text-primary text-sm font-semibold hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Plus size={16} />
                  Add lumpsum details
                </button>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-end -mt-1">
                    <button
                      type="button"
                      onClick={removeLumpsums}
                      className="flex items-center gap-1 text-xs text-ink-muted hover:text-danger transition-colors"
                    >
                      <X size={12} />
                      Remove
                    </button>
                  </div>
                  <CurrencyField
                    label="Gross lumpsum amount (TTD)"
                    name="grossAmount"
                    value={data.lumpsums?.grossAmount ?? 0}
                    onChange={lmpsChange}
                  />
                  {lmpsGross > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1 border-t border-primary/20">
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-muted">API credit (10%)</span>
                        <span className="font-semibold text-primary">
                          {formatCurrency(lmpsCredit)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-muted">Commission (0.5%)</span>
                        <span className="font-semibold text-primary">
                          {formatCurrency(lmpsComm)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Reflection (collapsed by default) */}
            <Card>
              {!reflectionExpanded ? (
                <button
                  type="button"
                  onClick={() => setReflectionExpanded(true)}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card-raised text-ink-muted text-sm font-semibold hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Plus size={16} />
                  Add reflection (optional)
                </button>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex text-xs font-semibold text-white bg-primary dark:bg-primary-dark px-2 py-0.5 rounded-full">
                      Reflection
                    </span>
                    <button
                      type="button"
                      onClick={() => setReflectionExpanded(false)}
                      className="flex items-center gap-1 text-xs text-ink-muted hover:text-danger transition-colors"
                    >
                      <X size={12} />
                      Collapse
                    </button>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Optional journal — captured per-day, NOT propagated to the weekly report.
                  </p>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="daily-hours" className="text-sm font-medium text-ink">
                      Hours worked today
                    </label>
                    <input
                      id="daily-hours"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.5"
                      value={data.hoursWorked ?? ''}
                      onChange={(e) =>
                        handleChange(
                          'hoursWorked',
                          e.target.value === '' ? null : parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full h-11 px-3 rounded-lg bg-surface border border-border/60 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="daily-wins" className="text-sm font-medium text-ink">
                      Wins
                    </label>
                    <textarea
                      id="daily-wins"
                      rows={2}
                      value={data.wins}
                      onChange={(e) => handleChange('wins', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-border/60 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="daily-blockers" className="text-sm font-medium text-ink">
                      Blockers
                    </label>
                    <textarea
                      id="daily-blockers"
                      rows={2}
                      value={data.blockers}
                      onChange={(e) => handleChange('blockers', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-border/60 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="daily-notes" className="text-sm font-medium text-ink">
                      Notes
                    </label>
                    <textarea
                      id="daily-notes"
                      rows={3}
                      value={data.notes}
                      onChange={(e) => handleChange('notes', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-border/60 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              )}
            </Card>

            {error && (
              <p className="text-sm text-danger-ink" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="grid grid-cols-5 gap-2 px-4 py-4 border-t border-border bg-card shrink-0">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="col-span-2 h-11 rounded-xl border border-border bg-card text-ink font-semibold text-sm hover:bg-surface transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="col-span-3 h-11 rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm hover:bg-primary/90 dark:hover:bg-primary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Saving…
            </>
          ) : savedAt ? (
            <>
              <Check size={16} /> Saved
            </>
          ) : (
            'Save'
          )}
        </button>
      </footer>
    </div>
  );
}

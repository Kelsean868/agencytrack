// E3 — Agent-side persistency tab.
//
// Shows the agent's current month + monthly trend + self-entry form (locked
// when a manager has already entered for the same month) + a "Open Playground"
// CTA. Award-gate banner appears when persistency is below 90%.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, ReferenceLine, Tooltip, XAxis, YAxis, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, AlertCircle, Calculator, Edit3, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getAgentHistory,
  getAvailableMonths,
} from '../../services/persistencyService';
import PersistencyEntryForm from '../manager/PersistencyEntryForm';
import { getOwnPolicies } from '../../services/policiesService';
import { buildLedgerPrefill } from '../../lib/persistency/ledgerPrefill';
import { DEFAULT_ANNUITY_MISSED_PREMIUM_RULE } from '../../lib/persistency/deriveFromLedger';
import { persistencyModelFor } from '../../lib/persistency/model';
import PersistencyPlayground from '../persistency/PersistencyPlayground';
import PersistencyOutlookHero from '../persistency/PersistencyOutlookHero';
import ConfirmPersistencySheet from '../persistency/ConfirmPersistencySheet';
import PanelSkeleton from '../ui/PanelSkeleton';
import {
  buildPersistencyOutlook, outlookGateFor, resolveAnnuityRule,
} from '../../lib/persistency/persistencyOutlook';
import { derivePolicyLens } from '../../lib/policyCampaignLens';
import { isTieredCampaign } from '../../utils/campaignEngine';
import { getTodayTT } from '../../utils/dateInputs';

function formatPct(decimal) {
  if (!Number.isFinite(decimal)) return '—';
  return `${(decimal * 100).toFixed(1)}%`;
}


// The campaign whose gate the outlook projects to: the first active tiered
// campaign that gates on persistency. Its tier ladder is what the gap sentence
// compares against.
function gatingCampaign(campaigns) {
  return (Array.isArray(campaigns) ? campaigns : []).find((c) => (
    isTieredCampaign(c) && c.structure === 'qualify' && outlookGateFor(c)
  )) ?? null;
}

export default function PersistencyTab({ onViewLapsedPolicies, activeCampaigns = [] }) {
  const { user, role, tenantId } = useAuth();

  const [history, setHistory] = useState([]);
  const [monthKeys, setMonthKeys] = useState([]);
  const [activeMonthKey, setActiveMonthKey] = useState(null);
  const [editing, setEditing] = useState(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // The policy ledger, for the P3 prefill. DELIBERATELY UNFILTERED: persistency
  // is the one reader that must SEE the imported docs (dispatcher ruling 5e) --
  // they are its entire input. Every other consumer of getOwnPolicies wraps it
  // in excludeImported(); this one must not.
  const [ledgerDocs, setLedgerDocs] = useState(null);
  const [confirming, setConfirming] = useState(false);
  // null = follow the newest saved record's rule; a choice here overrides it
  // for this view only.
  const [annuityRuleChoice, setAnnuityRuleChoice] = useState(null);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError('');
    try {
      const [recs, months, policies] = await Promise.all([
        getAgentHistory(tenantId, user.uid, 12),
        getAvailableMonths(tenantId, 'agent', user.uid),
        // A ledger failure must not take the whole tab down: without it the
        // form falls back to plain manual entry, which is the pre-P3 behaviour.
        getOwnPolicies(tenantId, user.uid).catch((e) => {
          console.error('[PersistencyTab] ledger load failed:', e);
          return null;
        }),
      ]);
      setHistory(recs);
      setMonthKeys(months);
      setLedgerDocs(policies);
      setActiveMonthKey((prev) => prev ?? months[0] ?? null);
    } catch (e) {
      setError(e.message ?? 'Failed to load persistency.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, tenantId]);

  useEffect(() => { load(); }, [load]);

  // The export date is read off the ledger itself rather than configured, so
  // the tab can never claim a date the data does not carry. Newest wins when a
  // ledger somehow holds two.
  const ledgerExportDate = useMemo(() => {
    if (!Array.isArray(ledgerDocs)) return null;
    const dates = [...new Set(ledgerDocs.map((d) => d.exportDate).filter(Boolean))].sort();
    return dates.length ? dates[dates.length - 1] : null;
  }, [ledgerDocs]);

  // What the ledger WOULD produce for the active month, for the read-only line
  // under "No record entered". Uses the default annuity rule, matching what the
  // form opens with, so the number here and the number in the form agree.
  //
  // It is explicitly labelled "not saved yet": an unsaved derivation is not a
  // persistency record, it does not gate an award, and a figure shown without
  // that qualifier would be read as one.
  const ledgerPreview = useMemo(() => {
    if (!ledgerDocs || !activeMonthKey) return null;
    try {
      const p = buildLedgerPrefill(ledgerDocs, {
        monthKey: activeMonthKey,
        exportDate: ledgerExportDate,
        annuityMissedPremiumRule: DEFAULT_ANNUITY_MISSED_PREMIUM_RULE,
      });
      return p.hasLedger ? p : null;
    } catch {
      // A malformed month must not take the tab down; the form is still there.
      return null;
    }
  }, [ledgerDocs, activeMonthKey, ledgerExportDate]);

  // ONE outlook for the hero; the campaign card and the Home chip call the same
  // builder on the same inputs.
  const campaign = useMemo(() => gatingCampaign(activeCampaigns), [activeCampaigns]);
  const annuityRule = annuityRuleChoice ?? resolveAnnuityRule(history);
  const outlook = useMemo(() => {
    if (!Array.isArray(ledgerDocs)) return null;
    const productionTarget = campaign
      ? { tiers: campaign.tiers ?? [], current: derivePolicyLens(ledgerDocs, campaign, {})?.api?.current ?? 0 }
      : null;
    try {
      return buildPersistencyOutlook({
        policies: ledgerDocs,
        records: history,
        today: getTodayTT(),
        annuityMissedPremiumRule: annuityRule,
        gate: campaign ? outlookGateFor(campaign) : null,
        productionTarget,
      });
    } catch (e) {
      console.error('[PersistencyTab] outlook failed:', e);
      return null;
    }
  }, [ledgerDocs, history, campaign, annuityRule]);

  // Confirm is offered only for a derived month nobody has saved yet — a saved
  // record (by the agent or a manager) is already the confirmed figure.
  const canConfirm = Boolean(outlook?.derived)
    && !history.some((r) => r.monthKey === outlook.derived.monthKey);

  const recordByMonth = useMemo(() => {
    const m = {};
    history.forEach((r) => { m[r.monthKey] = r; });
    return m;
  }, [history]);

  const currentRecord = activeMonthKey ? recordByMonth[activeMonthKey] : null;

  // How many figures the self-entry form will ask for depends on the month's
  // model — six on the legacy model, seven from September 2026. Kept in step
  // with the form rather than hardcoded, so the copy cannot promise a count the
  // form does not show. Null before a month is selected: the sentence then omits
  // the count instead of guessing one.
  const inputCountWord = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(String(activeMonthKey))) return null;
    return { 6: 'six', 7: 'seven' }[persistencyModelFor(activeMonthKey).inputs.length] ?? null;
  }, [activeMonthKey]);
  const currentDecimal = currentRecord?.persistency ?? null;
  const meetsGate = (currentDecimal ?? 0) >= 0.90;

  // Manager has entered if the existing record's enteredByRole is anything
  // other than 'agent'. Agents may still see (read-only) a manager-entered
  // doc for the same month.
  const lockedByManager = currentRecord
    && currentRecord.enteredByRole
    && currentRecord.enteredByRole !== 'agent';

  // Trend chart data: oldest-first decimals scaled to %.
  const chartData = useMemo(() => history.map((r) => ({
    monthKey: r.monthKey,
    pct: Number.isFinite(r.persistency) ? Math.round(r.persistency * 1000) / 10 : null,
  })), [history]);

  // First paint only — before any successful load, show a skeleton instead of
  // the "—" placeholder figures. Once data has loaded once, a Retry-driven
  // reload keeps showing the existing content in place (matches the 0.1a
  // error+Retry contract; only the very first render is a true unknown).
  if (loading && monthKeys.length === 0 && !error) {
    return (
      <div className="flex flex-col gap-4" data-testid="agent-persistency-tab">
        <PanelSkeleton variant="metric-row" count={1} label="Loading persistency…" />
        <PanelSkeleton variant="list" count={3} />
      </div>
    );
  }

  // §2 staggered-assemble — the self-entry form + playground are fixed-
  // position overlays rendered outside the `.stagger` container (same
  // pattern as GamePlanV2's modalsBlock split): they only open on click,
  // well after the one-shot mount-time stagger animation has finished.
  return (
    <>
    <div className="flex flex-col gap-4 stagger" data-testid="agent-persistency-tab">
      {error && (
        <div role="alert" className="card flex items-center gap-2 text-sm text-danger-ink flex-wrap" data-testid="agent-persistency-error">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={load}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <PersistencyOutlookHero
        outlook={outlook}
        loading={loading && !outlook}
        error={!loading && ledgerDocs === null && !error ? 'Your policy ledger did not load, so no estimate can be shown.' : ''}
        onRetry={load}
        canConfirm={canConfirm}
        onConfirm={() => setConfirming(true)}
        annuityRule={annuityRule}
        onAnnuityRuleChange={setAnnuityRuleChoice}
      />

      {/* Month selector */}
      <div className="flex items-center gap-2">
        <select
          aria-label="Month"
          data-testid="agent-persistency-month-selector"
          value={activeMonthKey ?? ''}
          onChange={(e) => setActiveMonthKey(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {monthKeys.length === 0 && <option value="">—</option>}
          {monthKeys.map((mk) => (
            <option key={mk} value={mk}>{mk}</option>
          ))}
        </select>
      </div>

      {/* Big number */}
      {/* @@hero-pane-start */}
      <div className="glass hero teal p-6 flex flex-col gap-2" data-testid="agent-persistency-summary">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[--hero-ink-muted-teal]" />
          <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-[--hero-ink-muted-teal]">
            Your persistency · {activeMonthKey ?? '—'}
          </p>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[--hero-chip-island] border border-[--hero-chip-border]"
            data-testid="agent-persistency-value"
          >
            {Number.isFinite(currentDecimal) && (
              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${
                currentDecimal >= 0.90 ? 'bg-[--hero-dot-success]'
                  : currentDecimal >= 0.80 ? 'bg-[--hero-dot-warning]'
                  : 'bg-[--hero-dot-danger]'
              }`} />
            )}
            <span className="text-3xl font-bold text-[--hero-ink]">
              {currentRecord ? formatPct(currentDecimal) : '—'}
            </span>
          </span>
          {currentRecord && meetsGate && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[--hero-chip-island] border border-[--hero-chip-border] text-[--hero-ink] text-[9px] font-bold font-mono uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-[--hero-dot-success]" />
              Award-eligible
            </span>
          )}
        </div>
        {!currentRecord && !loading && (
          <p className="text-xs text-[--hero-ink-muted-teal]">No record entered for this month yet.</p>
        )}
        {!currentRecord && !loading && ledgerPreview && (
          <p
            className="text-xs text-[--hero-ink-muted-teal] mt-1"
            data-testid="ledger-preview-line"
          >
            {`${ledgerPreview.provenance}: `}
            <strong>{`${(ledgerPreview.ledger.derived.persistency * 100).toFixed(1)}%`}</strong>
            {' (not saved yet)'}
          </p>
        )}
      </div>
      {/* @@hero-pane-end */}

      {/* Award gate banner — only when a record exists and persistency < 90% */}
      {currentRecord && !meetsGate && (
        <div
          className="card flex items-start gap-2 bg-warning-tint border-warning/30"
          data-testid="award-gate-banner"
        >
          <AlertCircle size={16} className="text-warning-ink shrink-0 mt-0.5" />
          <div className="text-sm text-ink">
            <p className="font-semibold">
              Your persistency is {formatPct(currentDecimal)}. Awards require 90% minimum.
            </p>
            <p className="text-xs text-ink-muted mt-1">
              Use the Playground below to model your path.
            </p>
          </div>
        </div>
      )}

      {/* Trend chart */}
      <div className="card flex flex-col gap-2" data-testid="persistency-trend-chart">
        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">
          Monthly trend
        </p>
        {chartData.length === 0 ? (
          <p className="text-xs text-ink-muted py-6 text-center">
            No history yet — your trend appears after the first month is entered.
          </p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <XAxis dataKey="monthKey" fontSize={10} stroke="var(--color-text-muted)" />
                <YAxis domain={[0, 100]} fontSize={10} stroke="var(--color-text-muted)" />
                <Tooltip
                  formatter={(v) => [`${v}%`, 'Persistency']}
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine y={90} stroke="var(--color-gold)" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Self-entry CTA */}
      <div className="card flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">
              Self-entry
            </p>
            <p className="text-sm text-ink mt-1">
              {lockedByManager
                ? 'Your manager has entered figures for this month. View only.'
                : `Enter the ${inputCountWord ? `${inputCountWord} ` : ''}business figures from the Tatil monthly report. Persistency is derived automatically.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={!activeMonthKey || lockedByManager}
            className="h-10 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-60"
            data-testid="agent-persistency-edit-button"
          >
            {lockedByManager ? <Lock size={14} /> : <Edit3 size={14} />}
            {lockedByManager ? 'Locked' : currentRecord ? 'Edit' : 'Enter'}
          </button>
        </div>
      </div>

      {/* Playground CTA */}
      <div className="card flex flex-col gap-2">
        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">
          What-if calculator
        </p>
        <p className="text-sm text-ink-muted">
          Model new business, reinstatements, business rolling off, and decreases
          expected to see how your persistency would change.
        </p>
        <button
          type="button"
          onClick={() => setPlaygroundOpen(true)}
          className="self-start h-10 px-4 rounded-lg border border-primary text-primary text-sm font-semibold flex items-center gap-2 hover:bg-primary/10 transition-colors"
          data-testid="agent-playground-open-button"
        >
          <Calculator size={14} /> Open Playground
        </button>
      </div>
    </div>

      {/* Self-entry form + Playground — outside `.stagger` (fixed-position
          overlays; see note above) */}
      {editing && activeMonthKey && (
        <PersistencyEntryForm
          tenantId={tenantId}
          monthKey={activeMonthKey}
          agentUid={user.uid}
          agentName="You"
          existingRecord={currentRecord}
          writerRole={role}
          writerUid={user.uid}
          ledgerDocs={ledgerDocs}
          ledgerExportDate={ledgerExportDate}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}

      {confirming && outlook?.derived && (
        <ConfirmPersistencySheet
          tenantId={tenantId}
          agentUid={user.uid}
          writerUid={user.uid}
          writerRole={role}
          derived={outlook.derived}
          onClose={() => setConfirming(false)}
          onSaved={() => { setConfirming(false); load(); }}
        />
      )}

      {playgroundOpen && (
        <PersistencyPlayground
          mode="self"
          agentName="You"
          currentRecord={currentRecord}
          onClose={() => setPlaygroundOpen(false)}
          onViewLapsedPolicies={onViewLapsedPolicies}
          ledgerDocs={ledgerDocs}
          ledgerExportDate={ledgerExportDate}
        />
      )}
    </>
  );
}

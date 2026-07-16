// MyWeekPanel — the manager's OWN current week (Fable, Tier-1 #6 remainder).
//
// Design intent: docs/design-system/screens-v2/manager-v2-shared.jsx
// MyWeekPanel — "player-coach" surface: a producing manager's own selling is
// tracked separately from unit/branch totals (repo rule) but the manager
// still needs a glance at their own submission state + own key KPIs.
//
// Data pattern mirrors ManagerWarTab's own-production read (ManagerWarTab.jsx
// ~L174-200, "MyWarCard production metric row"): getAgentSubmissions(tenantId,
// uid) is the SAME pipeline agents use, read via extractFields.js /
// extractTotalProductionCredit — never raw submission fields. Self-contained
// fetch (own useEffect), so it drops into the Team tab without needing
// useBranchOverview plumbing. Read-only — no write path from this panel.
//
// Four states (§1): loading skeleton (PanelSkeleton) · error card + Retry ·
// honest "no report started" empty state · the KPI row when a submission
// (draft or submitted) exists for the current week.
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAgentSubmissions } from '../../services/submissionService';
import { extractFields, extractTotalProductionCredit } from '../../utils/extractFields';
import { formatCurrency } from '../../utils/formatters';
import { getMostRecentSunday } from '../../utils/dateHelpers';
import { useCountUp } from '../../hooks/useCountUp';
import PanelSkeleton from '../ui/PanelSkeleton';
import StatusPill from '../ui/StatusPill';

const STATUS_META = {
  submitted: { variant: 'success', label: 'Submitted' },
  draft:     { variant: 'warning', label: 'Draft' },
  none:      { variant: 'muted',   label: 'Not started' },
};

export default function MyWeekPanel() {
  const { user, tenantId } = useAuth();
  const weekStart = getMostRecentSunday();

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [own, setOwn]         = useState(null); // { status: 'submitted'|'draft'|'none', api, apps }

  const load = useCallback(() => {
    if (!user || !tenantId) return;
    setLoading(true);
    setError(false);
    getAgentSubmissions(tenantId, user.uid)
      .then((subs) => {
        const sub = (subs || []).find((s) => s.weekStarting === weekStart);
        if (!sub) {
          setOwn({ status: 'none', api: 0, apps: 0 });
          return;
        }
        setOwn({
          status: sub.status === 'submitted' ? 'submitted' : 'draft',
          api:    extractTotalProductionCredit(sub),
          apps:   parseFloat(extractFields(sub).applicationsSold) || 0,
        });
      })
      .catch((err) => {
        console.error('[MyWeekPanel] own-submission load failed:', err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [user, tenantId, weekStart]);

  useEffect(() => { load(); }, [load]);

  const animatedApi = useCountUp(own?.api ?? 0, { duration: 800, decimals: 2 });

  if (loading) {
    return (
      <div className="card" data-testid="my-week-panel-loading">
        <div className="h-3 w-24 rounded bg-border/30 animate-pulse mb-4" />
        <PanelSkeleton variant="metric-row" count={2} label="Loading your week…" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="card flex items-start gap-3 text-danger-ink"
        data-testid="my-week-panel-error"
      >
        <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Could not load your week</p>
          <button
            type="button"
            onClick={load}
            className="mt-2 min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_META[own?.status ?? 'none'];

  return (
    <section aria-labelledby="my-week-panel-heading" className="card" data-testid="my-week-panel">
      <div className="flex items-baseline justify-between mb-3">
        <p
          id="my-week-panel-heading"
          className="text-[10px] font-bold font-mono uppercase tracking-widest text-ink-muted"
        >
          My week
        </p>
        <StatusPill variant={statusMeta.variant} label={statusMeta.label} />
      </div>

      {own?.status === 'none' ? (
        <p className="text-sm text-ink-muted py-2" data-testid="my-week-panel-empty">
          No report started for this week yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-ink-muted font-mono">
                My API · This week
              </p>
              <p
                className="text-lg font-bold font-display text-ink tabular-nums mt-1"
                data-testid="my-week-panel-api"
              >
                {formatCurrency(animatedApi)}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-ink-muted font-mono">
                Applications
              </p>
              <p
                className="text-lg font-bold font-display text-ink tabular-nums mt-1"
                data-testid="my-week-panel-apps"
              >
                {own?.apps ?? 0}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-ink-muted italic mt-3">
            Your selling is tracked separately — never counted in unit totals.
          </p>
        </>
      )}
    </section>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAgentSubmissions } from '../../services/submissionService';
import { getTenantUsers } from '../../services/managerService';
import { getAgentHistory } from '../../services/persistencyService';
import { formatCurrency, getUnitDisplayName } from '../../utils/formatters';
import { resolveAnnualAPIFloor } from '../../utils/tenureFloors';
import {
  filterSubmissionsByPeriod,
  computeAgentTotals,
} from '../../lib/productionReport/computations';
import TimePeriodToggle from './TimePeriodToggle';
import DataSourceBadge from './DataSourceBadge';
import WhereYouRankPanel from './WhereYouRankPanel';
import useLeaderboard from '../../hooks/useLeaderboard';

const PERIOD_LABEL = {
  week: 'this week', mtd: 'month to date', quarter: 'quarter to date', ytd: 'year to date',
};
const PERIOD_DISPLAY = [
  { id: 'week', label: 'Week' },
  { id: 'mtd', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'ytd', label: 'Year' },
];

// Map AgentProductionView's period IDs → the leaderboards aggregate's period
// fields. The two diverge only at quarter→qtd; everything else is identical.
const PERIOD_TO_AGG_FIELD = {
  week:    'week',
  mtd:     'mtd',
  quarter: 'qtd',
  ytd:     'ytd',
};

// Short caption used in the "Where you rank" footer ("...this year/week/...").
const PERIOD_CAPTION = {
  week:    'week',
  mtd:     'month',
  quarter: 'quarter',
  ytd:     'year',
};

export default function AgentProductionView() {
  const { user, userProfile, tenantId } = useAuth();
  // P7 — read the P1 leaderboards aggregate (branch-scoped, agent-readable).
  // Replaces the self-only ranking that PR 397 dropped: Firestore rules deny
  // agent reads of peer submissions, so the old `getAgentSubmissions`-only
  // path always resolved to "rank 1 of 1." The aggregate is what fixes that.
  // leaderboardLoading is not directly consumed — the pill renders "—" and
  // the panel renders the unranked empty state while the aggregate resolves.
  const {
    error: leaderboardError,
    byPeriod: leaderboardByPeriod,
  } = useLeaderboard();
  const [period, setPeriod] = useState('week');
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Authorized addition: most-recent E3 persistency record (dispatcher-approved, Phase 1 G3).
  // Independent effect; renders "—" until resolved or on error.
  const [persHistory, setPersHistory] = useState([]);

  useEffect(() => {
    if (!user?.uid || !tenantId) return;
    setLoading(true);
    Promise.all([
      getAgentSubmissions(tenantId, user.uid).catch(() => []),
      getTenantUsers(tenantId).catch(() => []),
    ]).then(([subs, users]) => {
      setAllSubmissions(subs);
      setAllUsers(users);
    }).catch(setError).finally(() => setLoading(false));
  }, [user?.uid, tenantId]);

  useEffect(() => {
    if (!user?.uid || !tenantId) return;
    getAgentHistory(tenantId, user.uid, 1)
      .then(setPersHistory)
      .catch(() => {});
  }, [user?.uid, tenantId]);

  // All four period windows computed from already-fetched submissions (no new read)
  const periodTotals = useMemo(() => ({
    week:    computeAgentTotals(filterSubmissionsByPeriod(allSubmissions, 'week')),
    mtd:     computeAgentTotals(filterSubmissionsByPeriod(allSubmissions, 'mtd')),
    quarter: computeAgentTotals(filterSubmissionsByPeriod(allSubmissions, 'quarter')),
    ytd:     computeAgentTotals(filterSubmissionsByPeriod(allSubmissions, 'ytd')),
  }), [allSubmissions]);

  const myTotals = periodTotals[period];

  // YTD vs tenure-floor bar. Uses contractStartDate from userProfile (already loaded).
  // Falls back to 200,000 when contractStartDate is absent.
  const ytdFloor = useMemo(
    () => resolveAnnualAPIFloor({ contractStartDate: userProfile?.contractStartDate }),
    [userProfile?.contractStartDate]
  );

  const initials = useMemo(() => {
    const name = userProfile?.name ?? '';
    return name.split(' ').filter(Boolean).map(s => s[0]).join('').toUpperCase().slice(0, 2) || '?';
  }, [userProfile?.name]);

  const unitLabel = useMemo(() => {
    if (!userProfile?.unitId) return null;
    const mgr = allUsers.find(u => u.id === userProfile.unitId);
    return getUnitDisplayName(mgr ?? null);
  }, [allUsers, userProfile?.unitId]);

  // Period-scoped ranking from the aggregate (memoized so its identity is
  // stable across re-renders that don't change byPeriod / period).
  const rankingForPeriod = useMemo(() => {
    const field = PERIOD_TO_AGG_FIELD[period] ?? 'ytd';
    return leaderboardByPeriod[field] ?? [];
  }, [leaderboardByPeriod, period]);

  // Viewer's own entry from the aggregate. If absent (unranked / not in
  // ranking yet / aggregate not yet loaded), the pill renders "—" + the
  // panel renders the unranked empty state.
  const viewerEntry = useMemo(
    () => rankingForPeriod.find((e) => e.agentId === user?.uid) ?? null,
    [rankingForPeriod, user?.uid]
  );
  const viewerRank   = viewerEntry?.rank ?? null;
  const branchTotal  = rankingForPeriod.length;

  const persDecimal = persHistory[0]?.persistency ?? null;
  const persDisplay = Number.isFinite(persDecimal) ? `${(persDecimal * 100).toFixed(1)}%` : '—';

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-ink-muted text-sm">Loading production data…</div>;
  }
  if (error) {
    return <div className="py-8 text-center text-danger-ink text-sm">Failed to load production data.</div>;
  }

  const ytdApi = periodTotals.ytd.totalApi;
  const floorPct = ytdFloor > 0 ? Math.min(100, Math.round((ytdApi / ytdFloor) * 100)) : 0;
  const aboveFloor = ytdApi >= ytdFloor;

  return (
    <div className="flex flex-col gap-4">
      {/* Controls row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <DataSourceBadge source="estimated" />
        <TimePeriodToggle selected={period} onChange={setPeriod} />
      </div>

      {/* Hero card */}
      <div className="card">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base font-display shrink-0"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold font-display text-ink leading-tight truncate">
              {userProfile?.name ?? 'You'}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">
              {unitLabel ?? 'Agent'} · {PERIOD_LABEL[period]}
            </p>
          </div>

          {/* P7 — Branch-rank pill (restored from PR 397's deferral).
              Reads from the aggregate, NOT a self-only ranking. Renders "—"
              while the aggregate loads or when the viewer is unranked. */}
          <div
            data-testid="agent-production-rank-pill"
            data-rank={viewerRank ?? 'unranked'}
            data-total={branchTotal}
            className="shrink-0 text-right"
          >
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">
              Branch rank
            </p>
            <p className="text-2xl font-bold font-display text-primary tabular-nums leading-none mt-0.5">
              {viewerRank ?? '—'}
              <span className="text-sm text-ink-muted font-normal">
                {' / '}{branchTotal || '—'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex gap-8 mt-5 flex-wrap">
          {[
            { k: 'New API',      v: formatCurrency(myTotals.totalApi) },
            { k: 'Applications', v: String(myTotals.totalApps) },
            { k: 'Persistency',  v: persDisplay },
          ].map(({ k, v }) => (
            <div key={k}>
              <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">{k}</p>
              <p className="text-3xl font-bold font-display text-ink tracking-tight mt-1 leading-none">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4-window period grid */}
      <div>
        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted mb-2.5">
          What I did · week → year
        </p>
        <div className="grid grid-cols-4 gap-2.5">
          {PERIOD_DISPLAY.map(p => {
            const t = periodTotals[p.id];
            const active = p.id === period;
            return (
              <div
                key={p.id}
                className={`rounded-xl p-3 border ${
                  active ? 'bg-primary-tint border-primary/30' : 'bg-card border-border'
                }`}
              >
                <p className={`text-[9px] font-bold font-mono uppercase tracking-widest ${active ? 'text-primary' : 'text-ink-muted'}`}>
                  {p.label}
                </p>
                <p className="text-lg font-bold font-display text-ink tracking-tight mt-1">
                  {formatCurrency(t.totalApi)}
                </p>
                <p className="text-[10px] text-ink-muted mt-0.5 font-mono">{t.totalApps} apps</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* YTD vs tenure-floor bar */}
      <div className="card">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">
            Year to date vs tenure floor
          </p>
          <span className="text-xs text-ink-muted tabular-nums">
            {formatCurrency(ytdApi)} / {formatCurrency(ytdFloor)}
          </span>
        </div>
        <div className="w-full bg-surface-muted rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${aboveFloor ? 'bg-primary' : 'bg-warning'}`}
            style={{ width: `${floorPct}%` }}
          />
        </div>
        <p className={`text-xs font-semibold mt-2 ${aboveFloor ? 'text-success-ink' : 'text-warning-ink'}`}>
          {aboveFloor
            ? `✓ ${floorPct}% — above floor`
            : `${floorPct}% — keep pushing to clear floor`}
        </p>
      </div>

      {/* P7 — "Where you rank" around-me panel (restored from PR 397's
          deferral). Reads the same branch-scoped aggregate as the rank
          pill — single source of truth, fixes the always-#1 bug. */}
      {!leaderboardError && (
        <WhereYouRankPanel
          ranking={rankingForPeriod}
          viewerUid={user?.uid ?? null}
          viewerName={userProfile?.name ?? null}
          branchLabel={null}
          periodLabel={PERIOD_CAPTION[period] ?? 'period'}
        />
      )}
    </div>
  );
}

/**
 * useProductionLeaderboard — the Production Leaderboard's state and derivation
 * (R2-11). Moved VERBATIM out of ProductionLeaderboardSurface so the Nexus
 * surface and the FR leaderboard (FrLeaderboard) read ONE state source: the
 * period (seeded from the saved default; an in-session change wins), the
 * branch aggregate (useLeaderboard), last week's champions, the scope state
 * and filter, the podium / tail slices and both around-me computations.
 *
 * @param {{ branchIdOverride?: string, scopeRoleOverride?: string,
 *           overrideBranchName?: string }} [args]
 */
import { useMemo, useState, useRef, useEffect } from 'react';
import useLeaderboard from './useLeaderboard';
import useWeeklyChampions from './useWeeklyChampions';
import useLeaderboardScope from './useLeaderboardScope';
import useAppSettings from './useAppSettings';
import { applyScope, unitOptionsFromRanking } from '../lib/leaderboard/scopeFilter';
import { useAuth } from '../context/AuthContext';
import { isValidPeriod } from '../config/viewDefaults';
import {
  computeAroundMe,
  VISIBLE_MAX_DESKTOP,
  VISIBLE_MAX_MOBILE,
} from '../lib/leaderboard/aroundMeLogic';

// Settings v2 (Tier 2 · 2.4) — map the stored semantic period to this surface's
// period key. Absent/invalid → the surface keeps its built-in YTD default.
const SETTINGS_PERIOD_TO_KEY = { week: 'WK', month: 'MTD', quarter: 'QTD', year: 'YTD' };

export const LEADERBOARD_PERIODS = Object.freeze([
  { k: 'WK',  field: 'week',    label: 'Week'    },
  { k: 'MTD', field: 'mtd',     label: 'Month'   },
  { k: 'QTD', field: 'qtd',     label: 'Quarter' },
  { k: 'YTD', field: 'ytd',     label: 'Year'    },
]);
const PERIODS = LEADERBOARD_PERIODS;

export default function useProductionLeaderboard({
  branchIdOverride,
  scopeRoleOverride,
  overrideBranchName,
} = {}) {
  const [period, setPeriod] = useState('YTD');
  const { loading, error, byPeriod, doc, reload } = useLeaderboard(branchIdOverride);
  const { champions, loading: championsLoading } = useWeeklyChampions();
  const { user, userProfile, role, tenantId } = useAuth();
  // Settings v2 (Tier 2 · 2.4) — seed the initial period from the saved default.
  // An in-session period change wins over a late reconcile (session-override-wins).
  const { settings } = useAppSettings({ tenantId, uid: user?.uid });
  const periodTouchedRef = useRef(false);
  useEffect(() => {
    if (periodTouchedRef.current) return;
    const saved = settings.defaultPeriod;
    if (isValidPeriod(saved) && SETTINGS_PERIOD_TO_KEY[saved]) setPeriod(SETTINGS_PERIOD_TO_KEY[saved]);
  }, [settings.defaultPeriod]);
  const viewerUid    = user?.uid ?? null;
  const viewerName   = userProfile?.name ?? null;
  const viewerBranch = overrideBranchName ?? userProfile?.branchName ?? null;

  const activeField = useMemo(
    () => PERIODS.find((p) => p.k === period)?.field ?? 'ytd',
    [period]
  );
  const activeLabel = useMemo(
    () => PERIODS.find((p) => p.k === period)?.label ?? 'Year',
    [period]
  );

  // Branch-wide ranking from the loaded period. The scope filter (P5a) takes
  // this as input and returns the displayed ranking + scoped leaderApi.
  const branchRanking = useMemo(
    () => byPeriod[activeField] ?? [],
    [byPeriod, activeField]
  );

  // ── P5a scope: derive unit-picker options + manage the scope state ───────
  const unitOptions = useMemo(
    () => unitOptionsFromRanking(branchRanking),
    [branchRanking]
  );
  const availableUnitIds = useMemo(
    () => unitOptions.map((u) => u.unitId),
    [unitOptions]
  );
  const {
    scope, targetUnitId, selectBranch, selectUnit,
  } = useLeaderboardScope({
    uid: viewerUid,
    role,
    availableUnitIds,
    effectiveRole: scopeRoleOverride,
  });

  // Apply the scope filter — `ranking` from here on is the DISPLAYED set
  // (podium / tail / around-me / leaderApi all derive from it). My Branch
  // → branchRanking passthrough; My Unit → filtered + rank-remapped to
  // rankWithinUnit + leaderApi rescaled to the unit's max.
  const {
    displayedRanking: ranking,
    scopedLeaderApi: leaderApi,
    count: scopeCount,
  } = useMemo(
    () => applyScope({ ranking: branchRanking, scope, targetUnitId }),
    [branchRanking, scope, targetUnitId]
  );

  const podium = ranking.slice(0, 3);
  const tail   = ranking.slice(3, 8);

  // Scope label for the subtitle (e.g. "South · Lee's Unit").
  const scopeLabel = useMemo(() => {
    if (scope === 'branch') return viewerBranch || 'Branch';
    const picked = unitOptions.find((u) => u.unitId === targetUnitId);
    return `${viewerBranch || 'Branch'} · ${picked?.unitName || 'Unit'}`;
  }, [scope, targetUnitId, unitOptions, viewerBranch]);

  // P4 — compute around-me state for BOTH breakpoints (one is rendered via
  // sm:hidden, the other via hidden sm:block). Recomputes on period change
  // OR on scope change because `ranking` is a useMemo-derivative of both.
  const aroundMeDesktop = useMemo(
    () => computeAroundMe({ ranking, viewerUid, visibleMax: VISIBLE_MAX_DESKTOP }),
    [ranking, viewerUid]
  );
  const aroundMeMobile = useMemo(
    () => computeAroundMe({ ranking, viewerUid, visibleMax: VISIBLE_MAX_MOBILE }),
    [ranking, viewerUid]
  );

  // A "slow period" is one where the (scoped) period array exists but every
  // entry is at 0 API (e.g. a fresh WK where no submissions have landed yet,
  // or a scoped unit with no production). We treat that the same as empty —
  // an honest "no production logged" state — rather than showing a podium of
  // all-zero champions.
  const isSlowOrEmpty =
    ranking.length === 0 ||
    (leaderApi === 0 && ranking.every((e) => (e.periodApi ?? 0) === 0));

  // An explicit period pick by the viewer (marks the session override).
  const choosePeriod = (k) => { periodTouchedRef.current = true; setPeriod(k); };

  return {
    period, choosePeriod, loading, error, byPeriod, doc, reload,
    champions, championsLoading, role, viewerUid, viewerName,
    activeField, activeLabel, branchRanking, unitOptions,
    scope, targetUnitId, selectBranch, selectUnit,
    ranking, leaderApi, scopeCount, podium, tail, scopeLabel,
    aroundMeDesktop, aroundMeMobile, isSlowOrEmpty,
  };
}

export function formatComputedAt(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-TT', {
      month:  'short',
      day:    'numeric',
      hour:   'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

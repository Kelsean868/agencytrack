import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getRecentSundays } from '../../utils/validators';
import { getRoleLabel } from '../../utils/formatters';
import { AlertTriangle } from 'lucide-react';
import { getWarsForUpline, getWarsForUplineWeeks } from '../../services/managerWarService';
import {
  getResolvedStandards,
  getResolvedStandardsForMany,
} from '../../services/managerStandardOverrideService';
import { computeMissedActivities, computeWarCompletion } from '../../utils/accountabilityFlag';
import ManagerWarDetail from './ManagerWarDetail';
import WarCompletionRing from './WarCompletionRing';
import WarStreakDots from './WarStreakDots';
import StatusPill from '../ui/StatusPill';
import PanelSkeleton from '../ui/PanelSkeleton';

// Review-state pill for a submitted WAR (item 2.1). Draft/unsubmitted → null.
function reviewPill(war) {
  if (war.status !== 'submitted') return null;
  if (war.reviewStatus === 'approved') return { variant: 'success', label: 'Approved' };
  if (war.reviewStatus === 'changes_requested') return { variant: 'warning', label: 'Changes requested' };
  return { variant: 'primary', label: 'To review' };
}

export default function TeamWarsTab() {
  const { tenantId, role, userProfile } = useAuth();
  const sundays   = getRecentSundays(8);
  const branchId  = userProfile?.branchId ?? null;

  const [weekStart,      setWeekStart]      = useState(sundays[0]);
  const [wars,           setWars]           = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [selectedWar,    setSelectedWar]    = useState(null);
  const [resolvedStds,   setResolvedStds]   = useState({});
  // I3a — per-manager resolved standards for the list-row badges.
  // Map<managerId, resolvedStandards>. Failure leaves the map empty (no badges).
  const [listStandards,  setListStandards]  = useState(new Map());
  // item 2.1 — per-manager 8-week filing streak. Map<managerId, Set<weekStart>>
  // of weeks with a SUBMITTED WAR. Degrades silently to empty (no dots) on error.
  const [streakByManager, setStreakByManager] = useState(new Map());

  const loadWars = useCallback(() => {
    setLoading(true);
    setError(null);
    getWarsForUpline({ tenantId, weekStart, role, branchId })
      .then(setWars)
      .catch((err) => {
        console.error('Failed to load team WARs:', err);
        setError('Unable to load reports — check your connection and try again.');
      })
      .finally(() => setLoading(false));
  }, [tenantId, weekStart, role, branchId]);

  useEffect(() => { loadWars(); }, [loadWars]);

  // I3a — bulk-resolve standards once per WAR list (org-default fetched once;
  // override docs fetched per-manager in parallel). Degrades silently — a
  // failed bulk resolve leaves listStandards empty so rows render without
  // badges, mirroring the no-data baseline.
  useEffect(() => {
    if (!tenantId || wars.length === 0) {
      setListStandards(new Map());
      return;
    }
    const managers = wars.map((w) => ({
      managerId:   w.managerId,
      managerRole: w.managerRole,
    }));
    let cancelled = false;
    getResolvedStandardsForMany({ tenantId, managers })
      .then((map) => { if (!cancelled) setListStandards(map); })
      .catch(() => { if (!cancelled) setListStandards(new Map()); });
    return () => { cancelled = true; };
  }, [tenantId, wars]);

  // item 2.1 — one read for the whole surface (not per row): fetch the 8-week
  // window for this scope, bucket submitted weeks by manager for the streak dots.
  // Index-safe (BM: branchId+weekStart composite; SM+: weekStart single-field).
  // Degrades silently to no dots on error, mirroring the list-standards effect.
  useEffect(() => {
    if (!tenantId) { setStreakByManager(new Map()); return; }
    let cancelled = false;
    getWarsForUplineWeeks({ tenantId, weekStarts: getRecentSundays(8), role, branchId })
      .then((docs) => {
        if (cancelled) return;
        const m = new Map();
        for (const d of docs) {
          if (d.status !== 'submitted') continue;
          if (!m.has(d.managerId)) m.set(d.managerId, new Set());
          m.get(d.managerId).add(d.weekStart);
        }
        setStreakByManager(m);
      })
      .catch(() => { if (!cancelled) setStreakByManager(new Map()); });
    return () => { cancelled = true; };
  }, [tenantId, role, branchId]);

  // Patch a reviewed WAR into local state so the row pill + drill update without
  // a reload (item 2.1). docId === war.id ({managerId}_{weekStart}).
  function handleReviewed(docId, updated) {
    setWars((prev) => prev.map((w) => (w.id === docId ? { ...w, ...updated } : w)));
    setSelectedWar((prev) => (prev && prev.id === docId ? { ...prev, ...updated } : prev));
  }

  function handleSelectWar(war) {
    setSelectedWar(war);
    setResolvedStds({});
    getResolvedStandards({ tenantId, managerId: war.managerId, role: war.managerRole })
      .then(setResolvedStds)
      .catch(() => setResolvedStds({}));
  }

  if (selectedWar) {
    return (
      <ManagerWarDetail
        warData={selectedWar}
        onBack={() => setSelectedWar(null)}
        resolvedStds={resolvedStds}
        onReviewed={handleReviewed}
      />
    );
  }

  // item 2.1 team stat strip counts, derived from the loaded week's WARs.
  // NOTE (honest scope): a WAR doc exists only once a manager starts a draft or
  // submits, so "NOT FILED" counts started-but-unsubmitted (draft) reports and
  // the FILED denominator is reports STARTED this week. Managers who never
  // created a WAR do not appear in the WAR query and are not counted here —
  // surfacing never-started managers needs a downline-manager roster read,
  // deferred to keep this surface read-light.
  const filedWars     = wars.filter((w) => w.status === 'submitted');
  const toReviewCount = filedWars.filter((w) => !w.reviewStatus).length;
  const notFiledCount = wars.filter((w) => w.status !== 'submitted').length;
  const orderedSundays = sundays.slice().reverse(); // oldest → newest for dots

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header + week selector */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text">Team Activity Reports</h2>
          <p className="text-sm text-text-muted mt-0.5">Manager WARs for the selected week</p>
        </div>
        <select
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          aria-label="Select week"
          className="h-11 px-3 rounded-lg bg-card border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {sundays.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Team stat strip (item 2.1) */}
      {!loading && !error && (
        <div
          className="bg-card rounded-2xl p-4 flex flex-wrap items-center gap-x-6 gap-y-3"
          data-testid="war-header-strip"
        >
          <StatStripItem label="Filed" value={`${filedWars.length}/${wars.length}`} tone="text-success" testid="war-stat-filed" />
          <StatStripItem label="To review" value={toReviewCount} tone="text-primary" testid="war-stat-toreview" />
          <StatStripItem label="Not filed" value={notFiledCount} tone="text-danger" testid="war-stat-notfiled" />
          <div className="flex-1 min-w-0" />
          <p className="text-xs text-text-muted">Reports due Monday 9 AM</p>
        </div>
      )}

      {loading && (
        <PanelSkeleton variant="list" count={5} label="Loading team activity reports…" />
      )}

      {error && (
        <div className="rounded-xl bg-card p-4 text-sm text-red-500 flex items-center justify-between gap-3 flex-wrap" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadWars}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && wars.length === 0 && (
        <div className="rounded-xl bg-card p-8 text-center text-sm text-text-muted">
          No reports filed for this week.
        </div>
      )}

      {!loading && !error && wars.length > 0 && (
        <div className="space-y-2">
          {wars.map((war) => {
            const stds       = listStandards.get(war.managerId) ?? {};
            const missed     = computeMissedActivities(war, stds);
            const completion = computeWarCompletion(war, stds);
            const submitted  = streakByManager.get(war.managerId);
            const history    = orderedSundays.map((ws) => submitted?.has(ws) ?? false);
            return (
              <WarSummaryRow
                key={war.id}
                war={war}
                missedCount={missed.length}
                completion={completion}
                streakHistory={history}
                onSelect={() => handleSelectWar(war)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatStripItem({ label, value, tone, testid }) {
  return (
    <div data-testid={testid}>
      <div className={`text-2xl font-bold leading-none tabular-nums ${tone}`}>{value}</div>
      <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function WarSummaryRow({ war, missedCount, completion, streakHistory, onSelect }) {
  const roleLabel = getRoleLabel(war.managerRole);
  const pill = reviewPill(war);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left bg-card rounded-xl p-4 hover:bg-card-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]"
    >
      <div className="flex items-start gap-3">
        <WarCompletionRing
          pct={completion.pct}
          met={completion.met}
          total={completion.total}
          size={42}
          stroke={4.5}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text">{war.managerName}</p>
            {pill && <StatusPill variant={pill.variant} label={pill.label} />}
            {missedCount > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning-ink text-[10px] font-bold uppercase tracking-wide"
                aria-label={`${missedCount} standard${missedCount === 1 ? '' : 's'} under target`}
                data-testid={`team-war-under-badge-${war.managerId}`}
              >
                <AlertTriangle size={10} aria-hidden="true" />
                {missedCount} under
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted">{roleLabel}</p>
          <div className="mt-1.5">
            <WarStreakDots history={streakHistory} showLabel={false} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-text-muted">JFW: {war.jfwCount ?? '—'}</p>
          <p className="text-xs text-text-muted">1-on-1s: {war.oneOnOnesConducted ?? '—'}</p>
        </div>
      </div>
    </button>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getRecentSundays } from '../../utils/validators';
import { getRoleLabel } from '../../utils/formatters';
import { AlertTriangle } from 'lucide-react';
import { getWarsForUpline } from '../../services/managerWarService';
import {
  getResolvedStandards,
  getResolvedStandardsForMany,
} from '../../services/managerStandardOverrideService';
import { computeMissedActivities } from '../../utils/accountabilityFlag';
import ManagerWarDetail from './ManagerWarDetail';

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
      />
    );
  }

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

      {loading && (
        <div className="flex items-center justify-center py-16">
          <span className="text-text-muted text-sm">Loading…</span>
        </div>
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
            const stds   = listStandards.get(war.managerId) ?? {};
            const missed = computeMissedActivities(war, stds);
            return (
              <WarSummaryRow
                key={war.id}
                war={war}
                missedCount={missed.length}
                onSelect={() => handleSelectWar(war)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function WarSummaryRow({ war, missedCount, onSelect }) {
  const roleLabel = getRoleLabel(war.managerRole);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left bg-card rounded-xl p-4 hover:bg-card-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text">{war.managerName}</p>
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
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-text-muted">JFW: {war.jfwCount ?? '—'}</p>
          <p className="text-xs text-text-muted">1-on-1s: {war.oneOnOnesConducted ?? '—'}</p>
        </div>
      </div>
    </button>
  );
}

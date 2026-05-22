import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getRecentSundays } from '../../utils/validators';
import { getRoleLabel } from '../../utils/formatters';
import { getWarsForUpline } from '../../services/managerWarService';
import ManagerWarDetail from './ManagerWarDetail';

export default function TeamWarsTab() {
  const { tenantId, role, userProfile } = useAuth();
  const sundays   = getRecentSundays(8);
  const branchId  = userProfile?.branchId ?? null;

  const [weekStart,    setWeekStart]    = useState(sundays[0]);
  const [wars,         setWars]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [selectedWar,  setSelectedWar]  = useState(null);

  useEffect(() => {
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

  if (selectedWar) {
    return <ManagerWarDetail warData={selectedWar} onBack={() => setSelectedWar(null)} />;
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
        <div className="rounded-xl bg-card p-4 text-sm text-red-500" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && wars.length === 0 && (
        <div className="rounded-xl bg-card p-8 text-center text-sm text-text-muted">
          No reports filed for this week.
        </div>
      )}

      {!loading && !error && wars.length > 0 && (
        <div className="space-y-2">
          {wars.map((war) => (
            <WarSummaryRow
              key={war.id}
              war={war}
              onSelect={() => setSelectedWar(war)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WarSummaryRow({ war, onSelect }) {
  const roleLabel = getRoleLabel(war.managerRole);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left bg-card rounded-xl p-4 hover:bg-card-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text">{war.managerName}</p>
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

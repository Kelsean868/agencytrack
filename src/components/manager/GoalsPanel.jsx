import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getTenantUsers } from '../../services/managerService';
import { getGoals, setGoals, getCompanyMinimums } from '../../services/goalsService';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';

const TENANT_ID = import.meta.env.VITE_TENANT_ID;

function emptyGoals() {
  return {
    targetAnnualAPI:         '',
    targetAnnualApps:        '',
    targetAnnualPersistency: '',
    targetWeeklyAPI:         '',
    targetWeeklyApps:        '',
    targetWeeklyDials:       '',
    targetWeeklyFFI:         '',
    notes:                   '',
  };
}

function NumInput({ label, value, onChange, currency }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-ink-muted">{label}</label>
      <div className="flex items-center h-9 rounded-lg border border-border bg-white overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
        {currency && (
          <span className="text-xs text-ink-muted pl-2 pr-1 shrink-0">TTD</span>
        )}
        <input
          type="number"
          min="0"
          step={currency ? '1000' : '1'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-full px-2 text-sm text-ink focus:outline-none bg-transparent"
        />
      </div>
    </div>
  );
}

function BelowFloorWarning({ label }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-warning"
      title={`This target is below the Tatil Life minimum. Consider revising.`}
    >
      <AlertTriangle size={12} />
      {label} below company minimum
    </span>
  );
}

export default function GoalsPanel() {
  const { user, userProfile } = useAuth();
  const [agents, setAgents]       = useState([]);
  const [goalsMap, setGoalsMap]   = useState({});
  const [editMap, setEditMap]     = useState({});
  const [minimums, setMinimums]   = useState(null);
  const [savingId, setSavingId]   = useState(null);
  const [savedId, setSavedId]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    Promise.all([
      getTenantUsers(),
      getCompanyMinimums(TENANT_ID).catch(() => ({ annualAPI: 200000, annualApps: 42, persistency: 90 })),
    ])
      .then(async ([userList, mins]) => {
        setMinimums(mins);
        const agentList = userList.filter((u) => u.role === 'agent');
        setAgents(agentList);

        const gMap = {};
        const eMap = {};
        await Promise.all(
          agentList.map(async (a) => {
            const g = await getGoals(TENANT_ID, a.id).catch(() => null);
            gMap[a.id] = g;
            eMap[a.id] = g
              ? {
                  targetAnnualAPI:         g.targetAnnualAPI         ?? '',
                  targetAnnualApps:        g.targetAnnualApps        ?? '',
                  targetAnnualPersistency: g.targetAnnualPersistency ?? '',
                  targetWeeklyAPI:         g.targetWeeklyAPI         ?? '',
                  targetWeeklyApps:        g.targetWeeklyApps        ?? '',
                  targetWeeklyDials:       g.targetWeeklyDials       ?? '',
                  targetWeeklyFFI:         g.targetWeeklyFFI         ?? '',
                  notes:                   g.notes                   ?? '',
                }
              : emptyGoals();
          })
        );
        setGoalsMap(gMap);
        setEditMap(eMap);
      })
      .catch((e) => {
        console.error(e);
        setError('Failed to load agents or goals.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleField = useCallback((agentId, field, value) => {
    setEditMap((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], [field]: value },
    }));
  }, []);

  const handleSave = async (agent) => {
    setSavingId(agent.id);
    try {
      const managerName = userProfile?.name ?? userProfile?.email ?? 'Manager';
      await setGoals(TENANT_ID, agent.id, editMap[agent.id], user.uid, managerName);
      const updated = await getGoals(TENANT_ID, agent.id);
      setGoalsMap((prev) => ({ ...prev, [agent.id]: updated }));
      setSavedId(agent.id);
      setTimeout(() => setSavedId(null), 2500);
    } catch (e) {
      console.error('Failed to save goals:', e);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-border/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">{error}</div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-muted">No agents found in this tenant.</p>
      </div>
    );
  }

  const mins = minimums ?? { annualAPI: 200000, annualApps: 42, persistency: 90 };

  return (
    <div className="flex flex-col gap-4">
      {/* Company Minimum reference bar */}
      <div className="flex flex-wrap gap-4 px-4 py-3 rounded-xl bg-surface border border-border text-xs text-ink-muted">
        <p className="font-semibold text-ink-muted uppercase tracking-wide">Company Minimums</p>
        <span>Annual API: <span className="font-semibold text-ink">{formatCurrency(mins.annualAPI)}</span></span>
        <span>Annual Apps: <span className="font-semibold text-ink">{mins.annualApps}</span></span>
        <span>Persistency: <span className="font-semibold text-ink">{mins.persistency}%</span></span>
      </div>

      {agents.map((agent) => {
        const g   = goalsMap[agent.id];
        const e   = editMap[agent.id] ?? emptyGoals();
        const isSaving = savingId === agent.id;
        const isSaved  = savedId  === agent.id;

        const agentLabel = agent.name ?? agent.displayName ?? agent.email ?? agent.id;

        const apiVal  = parseFloat(e.targetAnnualAPI)         || 0;
        const appsVal = parseFloat(e.targetAnnualApps)        || 0;
        const persVal = parseFloat(e.targetAnnualPersistency) || 0;

        const apiWarn  = apiVal  > 0 && apiVal  < mins.annualAPI;
        const appsWarn = appsVal > 0 && appsVal < mins.annualApps;
        const persWarn = persVal > 0 && persVal < mins.persistency;
        const hasWarning = apiWarn || appsWarn || persWarn;

        return (
          <div key={agent.id} className="card flex flex-col gap-4">
            {/* Agent header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">{agentLabel}</p>
                {g?.setByName && g?.updatedAt && (
                  <p className="text-xs text-ink-muted mt-0.5">
                    Last set by {g.setByName}
                    {' · '}
                    {g.updatedAt.toDate?.().toLocaleDateString('en-TT') ?? ''}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleSave(agent)}
                disabled={isSaving}
                className={`h-9 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 shrink-0 ${
                  isSaved
                    ? 'bg-success/15 text-success'
                    : 'bg-primary text-white hover:bg-[color:var(--color-primary-dark)]'
                }`}
              >
                {isSaving ? 'Saving…' : isSaved ? 'Saved ✓' : 'Save'}
              </button>
            </div>

            {/* Below-floor warnings — non-blocking */}
            {hasWarning && (
              <div className="flex flex-wrap gap-2">
                {apiWarn  && <BelowFloorWarning label="Annual API" />}
                {appsWarn && <BelowFloorWarning label="Annual Apps" />}
                {persWarn && <BelowFloorWarning label="Persistency" />}
              </div>
            )}

            {/* Annual targets */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Annual Targets</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <NumInput
                  label="Annual API (TTD)"
                  value={e.targetAnnualAPI}
                  onChange={(v) => handleField(agent.id, 'targetAnnualAPI', v)}
                  currency
                />
                <NumInput
                  label="Annual Apps"
                  value={e.targetAnnualApps}
                  onChange={(v) => handleField(agent.id, 'targetAnnualApps', v)}
                />
                <NumInput
                  label="Annual Persistency %"
                  value={e.targetAnnualPersistency}
                  onChange={(v) => handleField(agent.id, 'targetAnnualPersistency', v)}
                />
              </div>
            </div>

            {/* Weekly targets */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Weekly Targets</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumInput
                  label="Weekly API (TTD)"
                  value={e.targetWeeklyAPI}
                  onChange={(v) => handleField(agent.id, 'targetWeeklyAPI', v)}
                  currency
                />
                <NumInput
                  label="Weekly Apps"
                  value={e.targetWeeklyApps}
                  onChange={(v) => handleField(agent.id, 'targetWeeklyApps', v)}
                />
                <NumInput
                  label="Weekly Dials"
                  value={e.targetWeeklyDials}
                  onChange={(v) => handleField(agent.id, 'targetWeeklyDials', v)}
                />
                <NumInput
                  label="Weekly FFI"
                  value={e.targetWeeklyFFI}
                  onChange={(v) => handleField(agent.id, 'targetWeeklyFFI', v)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-ink-muted">Notes</label>
              <textarea
                value={e.notes}
                onChange={(ev) => handleField(agent.id, 'notes', ev.target.value)}
                rows={2}
                maxLength={300}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

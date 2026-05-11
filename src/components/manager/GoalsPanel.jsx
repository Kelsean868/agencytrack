import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import SaveButton from '../ui/SaveButton';
import { getTenantUsers } from '../../services/managerService';
import { getGoals, setGoals, getCompanyMinimums, getUnitGoals, setUnitGoals, getBranchGoals, setBranchGoals } from '../../services/goalsService';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateDisplay, getUnitDisplayName } from '../../utils/formatters';

function emptyGoals() {
  return {
    targetAnnualAPI:         '',
    targetAnnualApps:        '',
    targetAnnualPersistency: '',
    targetMonthlyAPI:        '',
    targetQuarterlyAPI:      '',
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
      <div className="flex items-center h-9 rounded-lg border border-border bg-[var(--color-surface)] overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
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

// ── Unit / Branch Goals form ─────────────────────────────────────────────────

function GoalLevelForm({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Annual API (TTD) *" value={value.api ?? ''} onChange={(v) => set('api', v)} currency />
        <NumInput label="Annual Apps *"       value={value.apps ?? ''} onChange={(v) => set('apps', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <NumInput label="FFIs (optional)"   value={value.ffiConducted ?? ''} onChange={(v) => set('ffiConducted', v)} />
        <NumInput label="CIs (optional)"    value={value.ciConducted  ?? ''} onChange={(v) => set('ciConducted', v)} />
        <NumInput label="Dials (optional)"  value={value.dials        ?? ''} onChange={(v) => set('dials', v)} />
      </div>
    </div>
  );
}

function UnitGoalsTab({ role, userProfile, allUsers }) {
  const { user, tenantId } = useAuth();
  const isUnitManager = role === 'unit_manager';
  const currentYear = new Date().getFullYear();
  const unitId = userProfile?.unitId ?? null;

  const units = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const u of allUsers) {
      if (u.role === 'unit_manager' && u.unitId && !seen.has(u.unitId)) {
        seen.add(u.unitId);
        out.push({ id: u.unitId, label: getUnitDisplayName(u) });
      }
    }
    return out;
  }, [allUsers]);

  const [selectedUnit, setSelectedUnit] = useState(isUnitManager ? unitId : (units[0]?.id ?? ''));
  const [form, setForm]     = useState({ api: '', apps: '', ffiConducted: '', ciConducted: '', dials: '' });
  const [existing, setExisting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!selectedUnit || !tenantId) return;
    setLoadingGoals(true);
    setLoadError('');
    getUnitGoals(tenantId, selectedUnit, currentYear)
      .then((g) => {
        setExisting(g);
        setForm({
          api:          g?.api          ?? '',
          apps:         g?.apps         ?? '',
          ffiConducted: g?.ffiConducted ?? '',
          ciConducted:  g?.ciConducted  ?? '',
          dials:        g?.dials        ?? '',
        });
      })
      .catch((e) => {
        console.error(e);
        setLoadError('Failed to load unit goals.');
      })
      .finally(() => setLoadingGoals(false));
  }, [selectedUnit, currentYear, tenantId]);

  const handleSave = async () => {
    if (!selectedUnit || !tenantId) return;
    setSaving(true);
    setSaveError('');
    try {
      await setUnitGoals(tenantId, selectedUnit, currentYear, form, {
        setBy:     user.uid,
        setByName: userProfile?.name ?? userProfile?.email ?? 'Manager',
        setByRole: role,
      });
      const updated = await getUnitGoals(tenantId, selectedUnit, currentYear);
      setExisting(updated);
      setSavedAt(new Date());
    } catch (e) {
      console.error(e);
      setSaveError('Failed to save unit goals. Please try again.');
    }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Unit Goals — {currentYear}
        </p>
        {!isUnitManager && units.length > 0 && (
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="h-9 px-3 border border-border rounded-lg bg-[var(--color-surface)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
        )}
        {isUnitManager && unitId && (
          <span className="text-xs text-ink-muted">Your unit</span>
        )}
      </div>

      {!isUnitManager && units.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-sm text-ink-muted">No unit managers in this tenant. Add one to set unit goals.</p>
        </div>
      ) : !selectedUnit ? (
        <p className="text-sm text-ink-muted italic">No units found.</p>
      ) : loadingGoals ? (
        <div className="h-24 rounded-xl bg-border/30 animate-pulse" />
      ) : loadError ? (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">{loadError}</div>
      ) : (
        <div className="card flex flex-col gap-4">
          {existing?.setByName && (
            <p className="text-xs text-ink-muted">
              Last set by {existing.setByName}
              {existing.setAt && ` · ${formatDateDisplay(existing.setAt.toDate?.().toISOString?.().slice(0, 10) ?? '')}`}
            </p>
          )}
          <GoalLevelForm value={form} onChange={setForm} />
          {saveError && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
              {saveError}
            </div>
          )}
          <SaveButton onClick={handleSave} saving={saving} savedAt={savedAt} label="Save Unit Goals" className="self-start" />
        </div>
      )}
    </div>
  );
}

function BranchGoalsTab({ userProfile }) {
  const { user, tenantId } = useAuth();
  const currentYear = new Date().getFullYear();

  const [form, setForm]     = useState({ api: '', apps: '', ffiConducted: '', ciConducted: '', dials: '' });
  const [existing, setExisting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    setLoadError('');
    getBranchGoals(tenantId, currentYear)
      .then((g) => {
        setExisting(g);
        setForm({
          api:          g?.api          ?? '',
          apps:         g?.apps         ?? '',
          ffiConducted: g?.ffiConducted ?? '',
          ciConducted:  g?.ciConducted  ?? '',
          dials:        g?.dials        ?? '',
        });
      })
      .catch((e) => {
        console.error(e);
        setLoadError('Failed to load branch goals.');
      })
      .finally(() => setLoading(false));
  }, [currentYear, tenantId]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    setSaveError('');
    try {
      await setBranchGoals(tenantId, currentYear, form, {
        setBy:     user.uid,
        setByName: userProfile?.name ?? userProfile?.email ?? 'Manager',
      });
      const updated = await getBranchGoals(tenantId, currentYear);
      setExisting(updated);
      setSavedAt(new Date());
    } catch (e) {
      console.error(e);
      setSaveError('Failed to save branch goals. Please try again.');
    }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Branch Goals — {currentYear}
      </p>
      {loading ? (
        <div className="h-24 rounded-xl bg-border/30 animate-pulse" />
      ) : loadError ? (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">{loadError}</div>
      ) : (
        <div className="card flex flex-col gap-4">
          {existing?.setByName && (
            <p className="text-xs text-ink-muted">
              Last set by {existing.setByName}
              {existing.setAt && ` · ${formatDateDisplay(existing.setAt.toDate?.().toISOString?.().slice(0, 10) ?? '')}`}
            </p>
          )}
          <GoalLevelForm value={form} onChange={setForm} />
          {saveError && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
              {saveError}
            </div>
          )}
          <SaveButton onClick={handleSave} saving={saving} savedAt={savedAt} label="Save Branch Goals" className="self-start" />
        </div>
      )}
    </div>
  );
}

// ── Agent goals panel (original content) ─────────────────────────────────────
function AgentGoalsTab({ onGoalsLoaded }) {
  const { user, userProfile, tenantId } = useAuth();
  const [agents, setAgents]       = useState([]);
  const [goalsMap, setGoalsMap]   = useState({});
  const [editMap, setEditMap]     = useState({});
  const [minimums, setMinimums]   = useState(null);
  const [savingId, setSavingId]       = useState(null);
  const [savedAtMap, setSavedAtMap]   = useState({});
  const [saveErrorId, setSaveErrorId] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [partialLoadWarning, setPartialLoadWarning] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      getTenantUsers(),
      getCompanyMinimums(tenantId).catch(() => ({ annualAPI: 200000, annualApps: 42, persistency: 90 })),
    ])
      .then(async ([userList, mins]) => {
        setMinimums(mins);
        const agentList = userList.filter((u) => u.role === 'agent');
        setAgents(agentList);

        const gMap = {};
        const eMap = {};
        let anyFailed = false;
        await Promise.all(
          agentList.map(async (a) => {
            const g = await getGoals(tenantId, a.id).catch(() => {
              anyFailed = true;
              return null;
            });
            gMap[a.id] = g;
            eMap[a.id] = g
              ? {
                  targetAnnualAPI:         g.targetAnnualAPI         ?? '',
                  targetAnnualApps:        g.targetAnnualApps        ?? '',
                  targetAnnualPersistency: g.targetAnnualPersistency ?? '',
                  targetMonthlyAPI:        g.targetMonthlyAPI        ?? '',
                  targetQuarterlyAPI:      g.targetQuarterlyAPI      ?? '',
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
        setPartialLoadWarning(anyFailed);
        if (typeof onGoalsLoaded === 'function') {
          onGoalsLoaded(agentList, gMap);
        }
      })
      .catch((e) => {
        console.error(e);
        setError('Failed to load agents or goals.');
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleField = useCallback((agentId, field, value) => {
    setEditMap((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], [field]: value },
    }));
  }, []);

  const handleSave = async (agent) => {
    if (!tenantId) return;
    setSavingId(agent.id);
    setSaveErrorId(null);
    try {
      const managerName = userProfile?.name ?? userProfile?.email ?? 'Manager';
      await setGoals(tenantId, agent.id, editMap[agent.id], user.uid, managerName);
      const updated = await getGoals(tenantId, agent.id);
      setGoalsMap((prev) => ({ ...prev, [agent.id]: updated }));
      setSavedAtMap((prev) => ({ ...prev, [agent.id]: new Date() }));
    } catch (e) {
      console.error('Failed to save goals:', e);
      setSaveErrorId(agent.id);
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

      {partialLoadWarning && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning">
          Some agents&rsquo; goals couldn&rsquo;t be loaded. They will appear blank.
        </div>
      )}

      {agents.map((agent) => {
        const g   = goalsMap[agent.id];
        const e   = editMap[agent.id] ?? emptyGoals();
        const isSaving = savingId === agent.id;
        const agentSavedAt = savedAtMap[agent.id] ?? null;
        const isSaveError = saveErrorId === agent.id;

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
              <SaveButton onClick={() => handleSave(agent)} saving={isSaving} savedAt={agentSavedAt} label="Save" className="shrink-0" />
            </div>

            {/* Below-floor warnings — non-blocking */}
            {hasWarning && (
              <div className="flex flex-wrap gap-2">
                {apiWarn  && <BelowFloorWarning label="Annual API" />}
                {appsWarn && <BelowFloorWarning label="Annual Apps" />}
                {persWarn && <BelowFloorWarning label="Persistency" />}
              </div>
            )}

            {/* Save error — visible feedback if setGoals fails */}
            {isSaveError && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
                Failed to save goals for {agentLabel}. Please try again.
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

            {/* Period API targets */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Period API Targets (Optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <NumInput
                  label="Monthly API Target"
                  value={e.targetMonthlyAPI}
                  onChange={(v) => handleField(agent.id, 'targetMonthlyAPI', v)}
                  currency
                />
                <NumInput
                  label="Quarterly API Target"
                  value={e.targetQuarterlyAPI}
                  onChange={(v) => handleField(agent.id, 'targetQuarterlyAPI', v)}
                  currency
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
              <label htmlFor={`goals-notes-${agent.id}`} className="text-xs text-ink-muted">Notes</label>
              <textarea
                id={`goals-notes-${agent.id}`}
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

// ── Main GoalsPanel — sub-tab wrapper ────────────────────────────────────────
export default function GoalsPanel({ onGoalsLoaded }) {
  const { role, userProfile } = useAuth();
  const [subTab, setSubTab] = useState('agents');
  const [allUsers, setAllUsers] = useState([]);

  const canSeeBranch = role === 'branch_manager' || role === 'tenant_admin' || role === 'platform_admin';
  const canSeeUnit   = role === 'unit_manager' || canSeeBranch;

  useEffect(() => {
    getTenantUsers().then(setAllUsers).catch(console.error);
  }, []);

  const tabs = [
    { id: 'agents',  label: 'Agent Goals' },
    ...(canSeeUnit   ? [{ id: 'unit',   label: 'Unit Goals'   }] : []),
    ...(canSeeBranch ? [{ id: 'branch', label: 'Branch Goals' }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap px-3 ${
              subTab === t.id
                ? 'bg-[var(--color-surface)] text-primary shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'agents' && <AgentGoalsTab onGoalsLoaded={onGoalsLoaded} />}
      {subTab === 'unit'   && canSeeUnit   && <UnitGoalsTab   role={role} userProfile={userProfile} allUsers={allUsers} />}
      {subTab === 'branch' && canSeeBranch && <BranchGoalsTab userProfile={userProfile} />}
    </div>
  );
}

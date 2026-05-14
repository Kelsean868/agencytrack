import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import SaveButton from '../ui/SaveButton';
import TabPills from '../ui/TabPills';
import Avatar from '../ui/Avatar';
import GapAnalysisPanel from '../goals/GapAnalysisPanel';
import CommissionPlayground from '../goals/CommissionPlayground';
import { getTenantUsers } from '../../services/managerService';
import {
  getGoals, setGoals, getCompanyMinimums,
  getUnitGoals, setUnitGoals,
  getBranchGoals, setBranchGoals,
  getGoalHierarchy,
} from '../../services/goalsService';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateDisplay, getUnitDisplayName } from '../../utils/formatters';

const FALLBACK_MINIMUMS = { annualAPI: 200000, annualApps: 42, persistency: 90 };
const ZERO_YTD = { api: 0, apps: 0, ffiConducted: 0, ciConducted: 0, dials: 0 };

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
      <div className="flex items-center h-11 rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
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

// 'unset' = no doc or all-zero targets · 'below' = any annual target under
// the company minimum · 'above' = all three meet or beat the minimum. Drives
// the StatusChip and the below-floor auto-expand rule.
function getAgentStatus(goalsDoc, mins) {
  if (!goalsDoc) return 'unset';
  const api  = parseFloat(goalsDoc.targetAnnualAPI)         || 0;
  const apps = parseFloat(goalsDoc.targetAnnualApps)        || 0;
  const pers = parseFloat(goalsDoc.targetAnnualPersistency) || 0;
  if (api === 0 && apps === 0 && pers === 0) return 'unset';
  if (api < mins.annualAPI || apps < mins.annualApps || pers < mins.persistency) return 'below';
  return 'above';
}

function StatusChip({ status }) {
  if (status === 'above') {
    return (
      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success">
        Above floor
      </span>
    );
  }
  if (status === 'below') {
    return (
      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/15 text-warning">
        Below floor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-danger/15 text-danger">
      Not set
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
            className="h-11 px-3 border border-border rounded-lg bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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

// ── Self sub-tab — manager's personal commitment + Commission Playground ────
function SelfTab() {
  const { user, userProfile, tenantId } = useAuth();
  const [managerGoals, setManagerGoals] = useState(null);
  const displayName = userProfile?.name ?? userProfile?.email ?? 'Manager';

  useEffect(() => {
    if (!user?.uid || !tenantId) return;
    getGoals(tenantId, user.uid).then(setManagerGoals).catch(console.error);
  }, [user?.uid, tenantId]);

  return (
    <div className="flex flex-col gap-4">
      <CommissionPlayground
        agentId={user?.uid}
        agentName={displayName}
        isManagerSelf={true}
        tenantId={tenantId}
        submissions={[]}
      />

      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Your Personal Annual Target</p>
        {managerGoals?.personalAnnualAPI ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">Annual API</span>
              <span className="text-sm font-semibold text-ink">{formatCurrency(parseFloat(managerGoals.personalAnnualAPI))}</span>
            </div>
            {parseFloat(managerGoals.personalAnnualApps) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">Annual Apps</span>
                <span className="text-sm font-semibold text-ink">{Math.ceil(parseFloat(managerGoals.personalAnnualApps))}</span>
              </div>
            )}
            {managerGoals.updatedAt && (
              <p className="text-xs text-ink-muted">
                Last updated: {managerGoals.updatedAt.toDate?.().toLocaleDateString('en-TT') ?? ''}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-muted italic">
            No personal target set. Use the Commission Playground above to calculate and save your goals.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Agent goal row (expand/collapse) ─────────────────────────────────────────
function AgentGoalRow({
  agent, goalsDoc, editValues, minimums,
  isExpanded, onToggle,
  onField, onSave,
  isSaving, savedAt, hasSaveError,
}) {
  const agentLabel = agent.name ?? agent.displayName ?? agent.email ?? agent.id;
  const status = getAgentStatus(goalsDoc, minimums);
  const formId = `agent-goal-form-${agent.id}`;

  // Collapsed-row summary. 'Not set' agents get the mock's hint copy; the
  // others get a compact targets-saved summary.
  let summary;
  if (status === 'unset') {
    summary = `Tap to set ${new Date().getFullYear()} targets · Default = company minimums`;
  } else {
    const api  = parseFloat(goalsDoc.targetAnnualAPI)         || 0;
    const apps = parseFloat(goalsDoc.targetAnnualApps)        || 0;
    const pers = parseFloat(goalsDoc.targetAnnualPersistency) || 0;
    const parts = [];
    if (api  > 0) parts.push(`Annual ${formatCurrency(api)}`);
    if (apps > 0) parts.push(`Apps ${Math.ceil(apps)}`);
    if (pers > 0) parts.push(`Persistency ${Math.round(pers)}%`);
    if (goalsDoc.updatedAt) {
      const dateStr = goalsDoc.updatedAt.toDate?.().toLocaleDateString('en-TT') ?? '';
      if (dateStr) parts.push(`Saved ${dateStr}`);
    }
    summary = parts.join(' · ');
  }

  // Live edit warnings — reflect the in-progress edit, not the saved doc.
  const editApi  = parseFloat(editValues.targetAnnualAPI)         || 0;
  const editApps = parseFloat(editValues.targetAnnualApps)        || 0;
  const editPers = parseFloat(editValues.targetAnnualPersistency) || 0;
  const apiWarn  = editApi  > 0 && editApi  < minimums.annualAPI;
  const appsWarn = editApps > 0 && editApps < minimums.annualApps;
  const persWarn = editPers > 0 && editPers < minimums.persistency;
  const hasEditWarning = apiWarn || appsWarn || persWarn;

  return (
    <div className="card flex flex-col gap-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={formId}
        className="flex items-center gap-3 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
      >
        <Avatar name={agentLabel} src={agent.photoURL} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink truncate">{agentLabel}</span>
            <StatusChip status={status} />
          </div>
          {summary && <p className="text-xs text-ink-muted mt-0.5 truncate">{summary}</p>}
        </div>
        {isExpanded
          ? <ChevronUp   size={18} className="text-ink-muted shrink-0" />
          : <ChevronDown size={18} className="text-ink-muted shrink-0" />}
      </button>

      {isExpanded && (
        <div id={formId} className="flex flex-col gap-4">
          {hasEditWarning && (
            <div className="flex flex-wrap gap-2">
              {apiWarn  && <BelowFloorWarning label="Annual API" />}
              {appsWarn && <BelowFloorWarning label="Annual Apps" />}
              {persWarn && <BelowFloorWarning label="Persistency" />}
            </div>
          )}

          {hasSaveError && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
              Failed to save goals for {agentLabel}. Please try again.
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Annual Targets</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumInput
                label="Annual API (TTD)"
                value={editValues.targetAnnualAPI}
                onChange={(v) => onField('targetAnnualAPI', v)}
                currency
              />
              <NumInput
                label="Annual Apps"
                value={editValues.targetAnnualApps}
                onChange={(v) => onField('targetAnnualApps', v)}
              />
              <NumInput
                label="Annual Persistency %"
                value={editValues.targetAnnualPersistency}
                onChange={(v) => onField('targetAnnualPersistency', v)}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Period API Targets (Optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <NumInput
                label="Monthly API Target"
                value={editValues.targetMonthlyAPI}
                onChange={(v) => onField('targetMonthlyAPI', v)}
                currency
              />
              <NumInput
                label="Quarterly API Target"
                value={editValues.targetQuarterlyAPI}
                onChange={(v) => onField('targetQuarterlyAPI', v)}
                currency
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Weekly Targets</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumInput
                label="Weekly API (TTD)"
                value={editValues.targetWeeklyAPI}
                onChange={(v) => onField('targetWeeklyAPI', v)}
                currency
              />
              <NumInput
                label="Weekly Apps"
                value={editValues.targetWeeklyApps}
                onChange={(v) => onField('targetWeeklyApps', v)}
              />
              <NumInput
                label="Weekly Dials"
                value={editValues.targetWeeklyDials}
                onChange={(v) => onField('targetWeeklyDials', v)}
              />
              <NumInput
                label="Weekly FFI"
                value={editValues.targetWeeklyFFI}
                onChange={(v) => onField('targetWeeklyFFI', v)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <label htmlFor={`goals-notes-${agent.id}`} className="text-xs text-ink-muted">Notes</label>
            <textarea
              id={`goals-notes-${agent.id}`}
              value={editValues.notes}
              onChange={(ev) => onField('notes', ev.target.value)}
              rows={2}
              maxLength={300}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          <SaveButton onClick={onSave} saving={isSaving} savedAt={savedAt} label="Save Goals" className="self-end" />
        </div>
      )}
    </div>
  );
}

// ── Agent goals tab ──────────────────────────────────────────────────────────
function AgentGoalsTab() {
  const { user, userProfile, tenantId } = useAuth();
  const [agents, setAgents]       = useState([]);
  const [goalsMap, setGoalsMap]   = useState({});
  const [editMap, setEditMap]     = useState({});
  const [minimums, setMinimums]   = useState(null);
  const [expandedIds, setExpandedIds]   = useState(() => new Set());
  const [savingId, setSavingId]         = useState(null);
  const [savedAtMap, setSavedAtMap]     = useState({});
  const [saveErrorId, setSaveErrorId]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [partialLoadWarning, setPartialLoadWarning] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      getTenantUsers(tenantId),
      getCompanyMinimums(tenantId).catch(() => FALLBACK_MINIMUMS),
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

        // Below-floor agents auto-expand on initial mount so a manager sees
        // their forms without an extra tap. 'Not set' and 'Above floor' rows
        // stay collapsed.
        const autoOpen = new Set();
        agentList.forEach((a) => {
          if (getAgentStatus(gMap[a.id], mins) === 'below') autoOpen.add(a.id);
        });
        setExpandedIds(autoOpen);
      })
      .catch((e) => {
        console.error(e);
        setError('Failed to load agents or goals.');
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleToggle = useCallback((agentId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  }, []);

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
          <div key={i} className="h-20 bg-border/40 rounded-xl animate-pulse" />
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

  const mins = minimums ?? FALLBACK_MINIMUMS;

  return (
    <div className="flex flex-col gap-4">
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

      {agents.map((agent) => (
        <AgentGoalRow
          key={agent.id}
          agent={agent}
          goalsDoc={goalsMap[agent.id]}
          editValues={editMap[agent.id] ?? emptyGoals()}
          minimums={mins}
          isExpanded={expandedIds.has(agent.id)}
          onToggle={() => handleToggle(agent.id)}
          onField={(field, value) => handleField(agent.id, field, value)}
          onSave={() => handleSave(agent)}
          isSaving={savingId === agent.id}
          savedAt={savedAtMap[agent.id] ?? null}
          hasSaveError={saveErrorId === agent.id}
        />
      ))}
    </div>
  );
}

// ── Main GoalsPanel — single-row sub-tab wrapper + persistent goal cascade ──
export default function GoalsPanel() {
  const { user, userProfile, role, tenantId } = useAuth();
  const [subTab, setSubTab] = useState('self');
  const [allUsers, setAllUsers] = useState([]);
  const [hierarchy, setHierarchy] = useState(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState(null);

  // sales_manager joins the manager-role list per the org-hierarchy memory.
  // Bundled fix for a pre-existing gap surfaced during M4 discovery.
  const canSeeBranch =
    role === 'branch_manager' ||
    role === 'sales_manager' ||
    role === 'tenant_admin' ||
    role === 'platform_admin';
  const canSeeUnit = role === 'unit_manager' || canSeeBranch;

  useEffect(() => {
    getTenantUsers(tenantId).then(setAllUsers).catch(console.error);
  }, []);

  useEffect(() => {
    if (!user?.uid || !tenantId) return;
    setHierarchyLoading(true);
    setHierarchyError(null);
    getGoalHierarchy(tenantId, userProfile?.unitId ?? null, new Date().getFullYear(), user.uid)
      .then(setHierarchy)
      .catch((e) => {
        console.error(e);
        setHierarchyError('Failed to load goal cascade.');
      })
      .finally(() => setHierarchyLoading(false));
  }, [user?.uid, tenantId, userProfile?.unitId]);

  const tabs = useMemo(() => [
    { id: 'self',   label: 'Self'   },
    { id: 'agents', label: 'Agent'  },
    ...(canSeeUnit   ? [{ id: 'unit',   label: 'Unit'   }] : []),
    ...(canSeeBranch ? [{ id: 'branch', label: 'Branch' }] : []),
  ], [canSeeUnit, canSeeBranch]);

  return (
    <div className="flex flex-col gap-4">
      <GapAnalysisPanel
        hierarchy={hierarchy}
        ytdTotals={ZERO_YTD}
        loading={hierarchyLoading}
        error={hierarchyError}
        title="Goal Cascade"
      />

      <TabPills tabs={tabs} activeId={subTab} onChange={setSubTab} />

      {subTab === 'self'   && <SelfTab />}
      {subTab === 'agents' && <AgentGoalsTab />}
      {subTab === 'unit'   && canSeeUnit   && <UnitGoalsTab   role={role} userProfile={userProfile} allUsers={allUsers} />}
      {subTab === 'branch' && canSeeBranch && <BranchGoalsTab userProfile={userProfile} />}
    </div>
  );
}

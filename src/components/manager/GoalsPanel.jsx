import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Lock, Lightbulb, CheckCircle2 } from 'lucide-react';
import RecommendLockDrawer from '../goals/RecommendLockDrawer';
import SaveButton from '../ui/SaveButton';
import TabPills from '../ui/TabPills';
import Avatar from '../ui/Avatar';
import GapAnalysisPanel from '../goals/GapAnalysisPanel';
import CommissionPlayground from '../goals/CommissionPlayground';
import DerivedIncomePanel from '../goals/DerivedIncomePanel';
import AwardsReachPanel from '../goals/AwardsReachPanel';
import MdrtTracker from '../goals/MdrtTracker';
import { getTenantUsers } from '../../services/managerService';
import LedgerLoadError from '../goals/LedgerLoadError';
import {
  getGoals, setGoals, getCompanyMinimums,
  getUnitGoals, setUnitGoals,
  getBranchGoals, setBranchGoals,
  getSalesManagerGoals, setSalesManagerGoals, getSalesManagerUid,
  getGoalHierarchy,
} from '../../services/goalsService';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateDisplay, getUnitDisplayName } from '../../utils/formatters';
import {
  resolveAnnualAPIFloor,
  FLAT_ANNUAL_API_FALLBACK,
  DEFAULT_TENURE_API_FLOORS,
} from '../../utils/tenureFloors';

const FALLBACK_MINIMUMS = {
  annualAPI: 200000,
  annualApps: 42,
  persistency: 90,
  tenureApiFloors: DEFAULT_TENURE_API_FLOORS,
};

// Helper: resolve the per-agent annual API floor from contractStartDate.
// Used by the row's status chip, below-floor warning, and the displayed
// minimum. Apps + Persistency floors stay flat — only API is tenured.
function agentAnnualFloor(agent, mins) {
  return resolveAnnualAPIFloor({
    contractStartDate: agent?.contractStartDate ?? null,
    tenureApiFloors: mins?.tenureApiFloors,
    fallback: FLAT_ANNUAL_API_FALLBACK,
  });
}
const STATUS_ORDER = { unset: 0, below: 1, above: 2 };

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
      className="inline-flex items-center gap-1 text-[11px] text-warning-ink"
      title={`This target is below the Tatil Life minimum. Consider revising.`}
    >
      <AlertTriangle size={12} />
      {label} below company minimum
    </span>
  );
}

// 'unset' = no doc or all-zero targets · 'below' = any annual target under
// the company minimum · 'above' = all three meet or beat the minimum. Drives
// the StatusChip and the below-floor auto-expand rule. The API floor is
// resolved per-agent from tenure; Apps + Persistency stay flat.
function getAgentStatus(goalsDoc, mins, annualAPIFloor) {
  if (!goalsDoc) return 'unset';
  const api  = parseFloat(goalsDoc.targetAnnualAPI)         || 0;
  const apps = parseFloat(goalsDoc.targetAnnualApps)        || 0;
  const pers = parseFloat(goalsDoc.targetAnnualPersistency) || 0;
  if (api === 0 && apps === 0 && pers === 0) return 'unset';
  if (api < annualAPIFloor || apps < mins.annualApps || pers < mins.persistency) return 'below';
  return 'above';
}

function StatusChip({ status }) {
  if (status === 'above') {
    return (
      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success-ink">
        Above floor
      </span>
    );
  }
  if (status === 'below') {
    return (
      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/15 text-warning-ink">
        Below floor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-danger/15 text-danger-ink">
      Not set
    </span>
  );
}

function CommittedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success-ink">
      <CheckCircle2 size={10} />
      Game Plan committed
    </span>
  );
}

function LockedBadge({ locked }) {
  if (locked === true) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
        <Lock size={10} />
        Locked
      </span>
    );
  }
  if (locked === false) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/10 text-warning-ink">
        <Lightbulb size={10} />
        Suggested
      </span>
    );
  }
  return null;
}

function LockToggle({ locked, onChange }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex-1 h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
          !locked
            ? 'bg-warning/10 border-warning/40 text-warning-ink'
            : 'bg-transparent border-border text-ink-muted'
        }`}
      >
        <Lightbulb size={16} /> Recommend
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex-1 h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
          locked
            ? 'bg-primary/10 border-primary/40 text-primary'
            : 'bg-transparent border-border text-ink-muted'
        }`}
      >
        <Lock size={16} /> Lock
      </button>
    </div>
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
  const [locked, setLocked] = useState(false);
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
        setLocked(g?.locked === true);
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
        locked,
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
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger-ink">{loadError}</div>
      ) : (
        <div className="card flex flex-col gap-4">
          {existing?.setByName && (
            <p className="text-xs text-ink-muted">
              Last set by {existing.setByName}
              {existing.setAt && ` · ${formatDateDisplay(existing.setAt.toDate?.().toISOString?.().slice(0, 10) ?? '')}`}
            </p>
          )}
          <LockToggle locked={locked} onChange={setLocked} />
          {locked && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-primary/8 border border-primary/25 dark:bg-primary-dark/10 dark:border-primary-dark/30 text-sm text-primary">
              <Lock size={15} className="mt-0.5 shrink-0" />
              Agents' commitments must meet or exceed this unit target.
            </div>
          )}
          {!locked && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 text-sm text-warning-ink">
              <Lightbulb size={15} className="mt-0.5 shrink-0" />
              Suggested target — a guide, not a binding commitment.
            </div>
          )}
          <GoalLevelForm value={form} onChange={setForm} />
          {saveError && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">
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
  const [locked, setLocked] = useState(false);
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
        setLocked(g?.locked === true);
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
        locked,
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
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger-ink">{loadError}</div>
      ) : (
        <div className="card flex flex-col gap-4">
          {existing?.setByName && (
            <p className="text-xs text-ink-muted">
              Last set by {existing.setByName}
              {existing.setAt && ` · ${formatDateDisplay(existing.setAt.toDate?.().toISOString?.().slice(0, 10) ?? '')}`}
            </p>
          )}
          <LockToggle locked={locked} onChange={setLocked} />
          {locked && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-primary/8 border border-primary/25 dark:bg-primary-dark/10 dark:border-primary-dark/30 text-sm text-primary">
              <Lock size={15} className="mt-0.5 shrink-0" />
              Units and agents must commit to totals that meet or exceed this branch target.
            </div>
          )}
          {!locked && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 text-sm text-warning-ink">
              <Lightbulb size={15} className="mt-0.5 shrink-0" />
              Suggested target — a guide, not a binding commitment.
            </div>
          )}
          <GoalLevelForm value={form} onChange={setForm} />
          {saveError && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">
              {saveError}
            </div>
          )}
          <SaveButton onClick={handleSave} saving={saving} savedAt={savedAt} label="Save Branch Goals" className="self-start" />
        </div>
      )}
    </div>
  );
}

function SalesManagerGoalsTab({ userProfile }) {
  const { user, tenantId, role } = useAuth();
  const currentYear = new Date().getFullYear();

  const [form, setForm]         = useState({ api: '', apps: '', ffiConducted: '', ciConducted: '', dials: '' });
  const [existing, setExisting] = useState(null);
  const [smUid, setSmUid]       = useState(null);
  const [locked, setLocked]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [savedAt, setSavedAt]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!tenantId || !user?.uid) return;
    setLoading(true);
    setLoadError('');

    const resolveSmUid = role === 'sales_manager'
      ? Promise.resolve(user.uid)
      : getSalesManagerUid(tenantId);

    resolveSmUid
      .then((uid) => {
        setSmUid(uid);
        if (!uid) return null;
        return getSalesManagerGoals(tenantId, uid, currentYear);
      })
      .then((g) => {
        setExisting(g);
        setLocked(g?.locked === true);
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
        setLoadError('Failed to load SM goals.');
      })
      .finally(() => setLoading(false));
  }, [currentYear, tenantId, user?.uid, role]);

  const handleSave = async () => {
    if (!tenantId || !smUid) return;
    setSaving(true);
    setSaveError('');
    try {
      await setSalesManagerGoals(tenantId, smUid, currentYear, form, {
        setBy:     user.uid,
        setByName: userProfile?.name ?? userProfile?.email ?? 'Manager',
        locked,
      });
      const updated = await getSalesManagerGoals(tenantId, smUid, currentYear);
      setExisting(updated);
      setSavedAt(new Date());
    } catch (e) {
      console.error(e);
      setSaveError('Failed to save SM goals. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        SM Target — {currentYear}
      </p>
      {loading ? (
        <div className="h-24 rounded-xl bg-border/30 animate-pulse" />
      ) : loadError ? (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger-ink">{loadError}</div>
      ) : !smUid ? (
        <div className="p-4 rounded-xl bg-border/20 text-sm text-ink-muted">No sales manager found for this tenant.</div>
      ) : (
        <div className="card flex flex-col gap-4">
          {existing?.setByName && (
            <p className="text-xs text-ink-muted">
              Last set by {existing.setByName}
              {existing.setAt && ` · ${formatDateDisplay(existing.setAt.toDate?.().toISOString?.().slice(0, 10) ?? '')}`}
            </p>
          )}
          <LockToggle locked={locked} onChange={setLocked} />
          {locked && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-primary/8 border border-primary/25 dark:bg-primary-dark/10 dark:border-primary-dark/30 text-sm text-primary">
              <Lock size={15} className="mt-0.5 shrink-0" />
              Branch targets must align to meet or exceed this company-wide target.
            </div>
          )}
          {!locked && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 text-sm text-warning-ink">
              <Lightbulb size={15} className="mt-0.5 shrink-0" />
              Suggested target — a guide, not a binding commitment.
            </div>
          )}
          <GoalLevelForm value={form} onChange={setForm} />
          {saveError && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">
              {saveError}
            </div>
          )}
          <SaveButton onClick={handleSave} saving={saving} savedAt={savedAt} label="Save SM Target" className="self-start" />
        </div>
      )}
    </div>
  );
}

// ── Self sub-tab — manager's personal commitment + portfolio panels (UM/BM) ─
function SelfTab({ allSubmissions, confirmedSettlements, ytdTotals, ownDataLoading, hierarchyLoading, hierarchy, isProducing, commissionRate }) {
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

      {isProducing && (
        <>
          <div className="border-t border-border pt-4">
            <DerivedIncomePanel
              hierarchy={hierarchy}
              ytdTotals={ytdTotals}
              commissionRate={commissionRate}
              loading={hierarchyLoading || ownDataLoading}
            />
          </div>
          <div className="border-t border-border pt-4">
            <AwardsReachPanel
              submissions={allSubmissions}
              confirmedSettlements={confirmedSettlements}
              agentProfile={userProfile}
            />
          </div>
          <div className="border-t border-border pt-4">
            <MdrtTracker
              ytdTotals={ytdTotals}
              loading={ownDataLoading}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Agent goal row (expand/collapse) ─────────────────────────────────────────
function AgentGoalRow({
  agent, goalsDoc, editValues, minimums,
  isExpanded, onToggle,
  onField, onSave, onSetTarget,
  isSaving, savedAt, hasSaveError,
}) {
  const agentLabel = agent.name ?? agent.displayName ?? agent.email ?? agent.id;
  const annualAPIFloor = agentAnnualFloor(agent, minimums);
  const status = getAgentStatus(goalsDoc, minimums, annualAPIFloor);
  const formId = `agent-goal-form-${agent.id}`;
  const isCommitted = goalsDoc?.gamePlanCommitted === true;
  const targetLocked = goalsDoc?.targetLocked;
  const hasManagerTarget = (parseFloat(goalsDoc?.targetAnnualAPI) || 0) > 0;

  // Collapsed-row summary.
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
  // API warning uses the per-agent tenure floor; Apps/Persistency stay flat.
  const editApi  = parseFloat(editValues.targetAnnualAPI)         || 0;
  const editApps = parseFloat(editValues.targetAnnualApps)        || 0;
  const editPers = parseFloat(editValues.targetAnnualPersistency) || 0;
  const apiWarn  = editApi  > 0 && editApi  < annualAPIFloor;
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
            {isCommitted && <CommittedBadge />}
            {hasManagerTarget && <LockedBadge locked={targetLocked} />}
          </div>
          {summary && <p className="text-xs text-ink-muted mt-0.5 truncate">{summary}</p>}
        </div>
        {isExpanded
          ? <ChevronUp   size={18} className="text-ink-muted shrink-0" />
          : <ChevronDown size={18} className="text-ink-muted shrink-0" />}
      </button>

      {isExpanded && (
        <div id={formId} className="flex flex-col gap-4">
          {/* Manager target row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {hasManagerTarget ? (
                <span className="text-xs text-ink-muted">
                  Manager target: <span className="font-semibold text-ink">{formatCurrency(parseFloat(goalsDoc?.targetAnnualAPI) || 0)}</span>
                  {targetLocked === true && <span className="ml-1 text-primary font-semibold">(locked)</span>}
                  {targetLocked === false && <span className="ml-1 text-warning-ink font-semibold">(suggested)</span>}
                </span>
              ) : (
                <span className="text-xs text-ink-muted italic">No manager target set</span>
              )}
            </div>
            {onSetTarget && (
              <button
                type="button"
                onClick={onSetTarget}
                className="h-9 px-4 rounded-lg text-xs font-semibold border border-primary/40 text-primary hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 shrink-0"
              >
                {hasManagerTarget ? 'Edit target' : 'Set target'}
              </button>
            )}
          </div>

          {hasEditWarning && (
            <div className="flex flex-wrap gap-2">
              {apiWarn  && <BelowFloorWarning label="Annual API" />}
              {appsWarn && <BelowFloorWarning label="Annual Apps" />}
              {persWarn && <BelowFloorWarning label="Persistency" />}
            </div>
          )}

          {hasSaveError && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">
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
  // Drawer state for set-manager-target flow
  const [drawerAgent, setDrawerAgent] = useState(null);
  const [drawerSaving, setDrawerSaving] = useState(false);

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
        // stay collapsed. API floor resolves per-agent from tenure.
        const autoOpen = new Set();
        agentList.forEach((a) => {
          const floor = agentAnnualFloor(a, mins);
          if (getAgentStatus(gMap[a.id], mins, floor) === 'below') autoOpen.add(a.id);
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

  const handleDrawerSave = async (targetValues, targetLocked) => {
    if (!drawerAgent || !tenantId) return;
    setDrawerSaving(true);
    try {
      const managerName = userProfile?.name ?? userProfile?.email ?? 'Manager';
      await setGoals(
        tenantId,
        drawerAgent.id,
        {
          targetAnnualAPI:         targetValues.targetAnnualAPI,
          targetAnnualApps:        targetValues.targetAnnualApps,
          targetAnnualPersistency: targetValues.targetAnnualPersistency,
          targetWeeklyAPI:         targetValues.targetWeeklyAPI,
          targetLocked,
        },
        user.uid,
        managerName,
      );
      const updated = await getGoals(tenantId, drawerAgent.id);
      setGoalsMap((prev) => ({ ...prev, [drawerAgent.id]: updated }));
    } finally {
      setDrawerSaving(false);
    }
    // RecommendLockDrawer calls onClose after this resolves
  };

  const mins = minimums ?? FALLBACK_MINIMUMS;

  // Exception-first ordering: unset → below-floor → above-floor.
  // Hoisted above early returns so useMemo is not called conditionally.
  const sortedAgents = useMemo(() => (
    [...agents].sort((a, b) => {
      const fa = agentAnnualFloor(a, mins);
      const fb = agentAnnualFloor(b, mins);
      return (STATUS_ORDER[getAgentStatus(goalsMap[a.id], mins, fa)] ?? 0) -
             (STATUS_ORDER[getAgentStatus(goalsMap[b.id], mins, fb)] ?? 0);
    })
  ), [agents, goalsMap, mins]);

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
      <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger-ink">{error}</div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-muted">No agents found in this tenant.</p>
      </div>
    );
  }

  const drawerGoalsDoc = drawerAgent ? goalsMap[drawerAgent.id] : null;
  const drawerFloor = drawerAgent ? agentAnnualFloor(drawerAgent, mins) : 200000;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4 px-4 py-3 rounded-xl bg-surface border border-border text-xs text-ink-muted">
        <p className="font-semibold text-ink-muted uppercase tracking-wide">Company Minimums</p>
        <span>Annual API: <span className="font-semibold text-ink">{formatCurrency(mins.annualAPI)}</span></span>
        <span>Annual Apps: <span className="font-semibold text-ink">{mins.annualApps}</span></span>
        <span>Persistency: <span className="font-semibold text-ink">{mins.persistency}%</span></span>
      </div>

      {partialLoadWarning && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning-ink">
          Some agents&rsquo; goals couldn&rsquo;t be loaded. They will appear blank.
        </div>
      )}

      {sortedAgents.map((agent) => (
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
          onSetTarget={() => setDrawerAgent(agent)}
          isSaving={savingId === agent.id}
          savedAt={savedAtMap[agent.id] ?? null}
          hasSaveError={saveErrorId === agent.id}
        />
      ))}

      <RecommendLockDrawer
        open={drawerAgent !== null}
        onClose={() => setDrawerAgent(null)}
        agentName={drawerAgent?.name ?? drawerAgent?.email ?? ''}
        initial={{
          targetAnnualAPI:         drawerGoalsDoc?.targetAnnualAPI         ?? '',
          targetAnnualApps:        drawerGoalsDoc?.targetAnnualApps        ?? '',
          targetAnnualPersistency: drawerGoalsDoc?.targetAnnualPersistency ?? '',
          targetWeeklyAPI:         drawerGoalsDoc?.targetWeeklyAPI         ?? '',
          targetLocked:            drawerGoalsDoc?.targetLocked,
        }}
        annualAPIFloor={drawerFloor}
        minimums={mins}
        onSave={handleDrawerSave}
        saving={drawerSaving}
      />
    </div>
  );
}

// ── Main GoalsPanel — single-row sub-tab wrapper + persistent goal cascade ──
const EMPTY = Object.freeze([]);
const ZERO_TOTALS = Object.freeze({ api: 0, apps: 0, activityApps: 0, ffiConducted: 0, ciConducted: 0, dials: 0 });

/**
 * `ownProduction` is ManagerDashboard's `useMyProduction()` result for a
 * producing manager (null otherwise). Its `ytdTotals.api` / `.apps` are the
 * LEDGER's settled figures (hero-ledger H1), so this panel shows the same
 * production as the manager's My Production tab — and reuses that fetch
 * instead of re-reading submissions and settlements on its own.
 */
export default function GoalsPanel({ ownProduction = null }) {
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
  const canSetSmTarget =
    role === 'sales_manager' ||
    role === 'tenant_admin' ||
    role === 'platform_admin';
  const isProducing = role === 'unit_manager' || role === 'branch_manager';
  const own = isProducing ? ownProduction : null;
  const allSubmissions = own?.allSubmissions ?? EMPTY;
  const settlements = own?.settlements ?? EMPTY;
  const ytdTotals = own?.ytdTotals ?? ZERO_TOTALS;
  const ownDataLoading = Boolean(own && (own.loading || own.ledgerPending));

  useEffect(() => {
    getTenantUsers(tenantId).then(setAllUsers).catch(console.error);
  }, [tenantId]);

  useEffect(() => {
    if (!user?.uid || !tenantId) return;
    setHierarchyLoading(true);
    setHierarchyError(null);
    getSalesManagerUid(tenantId)
      .catch(() => null)
      .then((smUid) =>
        getGoalHierarchy(tenantId, userProfile?.unitId ?? null, new Date().getFullYear(), user.uid, smUid)
      )
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
    ...(canSeeUnit     ? [{ id: 'unit',   label: 'Unit'   }] : []),
    ...(canSeeBranch   ? [{ id: 'branch', label: 'Branch' }] : []),
    ...(canSetSmTarget ? [{ id: 'sm',     label: 'SM Target' }] : []),
  ], [canSeeUnit, canSeeBranch, canSetSmTarget]);

  return (
    <div className="flex flex-col gap-4">
      {own?.policiesError && <LedgerLoadError onRetry={own.loadPolicies} />}
      <GapAnalysisPanel
        hierarchy={hierarchy}
        ytdTotals={ytdTotals}
        loading={hierarchyLoading || Boolean(own?.ledgerPending)}
        error={hierarchyError}
        title="Goal Cascade"
      />

      <TabPills tabs={tabs} activeId={subTab} onChange={setSubTab} />

      {/* Always mounted so in-progress form state survives sub-tab switches. */}
      <div className={subTab !== 'self' ? 'hidden' : undefined}>
        <SelfTab
          allSubmissions={allSubmissions}
          confirmedSettlements={settlements}
          ytdTotals={ytdTotals}
          ownDataLoading={ownDataLoading}
          hierarchyLoading={hierarchyLoading}
          hierarchy={hierarchy}
          isProducing={isProducing}
          commissionRate={parseFloat(userProfile?.commissionRate) || null}
        />
      </div>
      {subTab === 'agents' && <AgentGoalsTab />}
      {subTab === 'unit'   && canSeeUnit     && <UnitGoalsTab          role={role} userProfile={userProfile} allUsers={allUsers} />}
      {subTab === 'branch' && canSeeBranch   && <BranchGoalsTab        userProfile={userProfile} />}
      {subTab === 'sm'     && canSetSmTarget && <SalesManagerGoalsTab  userProfile={userProfile} />}
    </div>
  );
}

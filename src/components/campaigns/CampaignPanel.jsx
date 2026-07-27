import React, { useState, useEffect, useMemo, useCallback } from 'react';
import StatusPill from '../ui/StatusPill';
import TabPills from '../ui/TabPills';
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Megaphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';
import {
  getCampaigns, createCampaign, updateCampaign, deleteCampaign,
  getCampaignSubmissions,
  campaignSubsScopeFor,
} from '../../services/campaignService';
import { getTenantUsers } from '../../services/managerService';
import { getPersistencyMapForYear } from '../../services/persistencyService';
import { computeCampaignProgress, computeStandings, isTieredCampaign, persistencyPctForPeriod, campaignYears } from '../../utils/campaignEngine';
import { CampaignStandingsBlock } from './CampaignStandings';
import { formatCurrency, formatDateFriendly, getUnitDisplayName } from '../../utils/formatters';

const METRIC_OPTIONS = [
  { value: 'apiSold',          label: 'API'  },
  { value: 'applicationsSold', label: 'Apps' },
  { value: 'ffiConducted',     label: 'FFIs' },
  { value: 'ciConducted',      label: 'CIs'  },
];

const METRIC_LABEL = Object.fromEntries(METRIC_OPTIONS.map((m) => [m.value, m.label]));

function today() { return new Date().toISOString().slice(0, 10); }

function classifyDate(startDate, endDate) {
  const t = today();
  if (t < startDate) return 'upcoming';
  if (t > endDate)   return 'ended';
  return 'active';
}


const SCOPE_VARIANT = { branch: 'primary', unit: 'warning', agent: 'muted' };
const SCOPE_LABEL   = { branch: 'Branch',  unit: 'Unit',    agent: 'Agent'  };
const STATUS_VARIANT = { active: 'success', upcoming: 'primary', ended: 'muted' };
const STATUS_LABEL   = { active: 'Active',  upcoming: 'Upcoming', ended: 'Ended' };

// ─── Progress table inside expanded campaign row ─────────────────────────────
function ProgressTable({ campaign, submissions, allUsers }) {
  const participantIds = useMemo(() => {
    const { type, unitIds = [], agentIds = [] } = campaign.scope ?? {};
    if (type === 'branch') return allUsers.filter((u) => u.role === 'agent').map((u) => u.id);
    if (type === 'unit')   return allUsers.filter((u) => u.role === 'agent' && unitIds.includes(u.unitId)).map((u) => u.id);
    if (type === 'agent')  return agentIds;
    return [];
  }, [campaign, allUsers]);

  const rows = useMemo(() => participantIds.map((aid) => {
    const user = allUsers.find((u) => u.id === aid);
    const { metrics, allAchieved } = computeCampaignProgress(campaign, submissions, aid);
    return { aid, name: user?.name ?? user?.displayName ?? `Agent …${aid.slice(-4)}`, metrics, allAchieved };
  }), [participantIds, campaign, submissions, allUsers]);

  if (submissions.length === 0) {
    return (
      <p className="text-xs text-ink-muted italic py-2">
        No submissions in this campaign period yet — progress appears here once agents file their weekly reports.
      </p>
    );
  }

  const targets = campaign.targets ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left pb-2 pr-4 font-semibold text-ink-muted">Agent</th>
            {targets.map((t) => (
              <th key={t.metric} className="text-right pb-2 px-3 font-semibold text-ink-muted">
                {METRIC_LABEL[t.metric] ?? t.metric}
              </th>
            ))}
            <th className="text-right pb-2 pl-3 font-semibold text-ink-muted">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.aid} className="border-b border-border/50 last:border-0">
              <td className="py-2 pr-4 font-medium text-ink">{row.name}</td>
              {row.metrics.map((m) => (
                <td key={m.metric} className="py-2 px-3 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-ink">{m.metric === 'apiSold' ? formatCurrency(Math.round(m.current)) : m.current}</span>
                    <div className="h-1 w-16 rounded-full bg-border/60 overflow-hidden">
                      <div className={`h-1 rounded-full ${m.achieved ? 'bg-success' : 'bg-primary'}`} style={{ width: `${m.pct}%` }} />
                    </div>
                  </div>
                </td>
              ))}
              <td className="py-2 pl-3 text-right">
                {row.allAchieved
                  ? <span className="inline-flex items-center gap-0.5 text-success-ink font-semibold"><CheckCircle2 size={12} /> Complete</span>
                  : <span className="text-ink-muted">In Progress</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Campaign list row ────────────────────────────────────────────────────────
function CampaignRow({ campaign, canEdit, onEdit, onDelete, allUsers, tenantId, subsScope }) {
  const [expanded, setExpanded] = useState(false);
  const [subs, setSubs] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [persByAgent, setPersByAgent] = useState({});

  const status = classifyDate(campaign.startDate, campaign.endDate);
  const tiered = isTieredCampaign(campaign);

  // Eligible participants for standings (id · name · unit), scope-resolved.
  const participants = useMemo(() => {
    const { type, unitIds = [], agentIds = [] } = campaign.scope ?? {};
    const nameOf = (u, id) => u?.name ?? u?.displayName ?? u?.email ?? `Agent …${String(id).slice(-4)}`;
    if (type === 'branch') {
      return allUsers.filter((u) => u.role === 'agent').map((u) => ({ id: u.id, name: nameOf(u, u.id), unit: u.unitId ?? null }));
    }
    if (type === 'unit') {
      return allUsers.filter((u) => u.role === 'agent' && unitIds.includes(u.unitId)).map((u) => ({ id: u.id, name: nameOf(u, u.id), unit: u.unitId ?? null }));
    }
    if (type === 'agent') {
      return agentIds.map((id) => {
        const u = allUsers.find((x) => x.id === id);
        return { id, name: nameOf(u, id), unit: u?.unitId ?? null };
      });
    }
    return [];
  }, [campaign, allUsers]);

  const standings = useMemo(
    () => (tiered ? computeStandings(campaign, subs, participants, persByAgent) : []),
    [tiered, campaign, subs, participants, persByAgent],
  );
  const hasPersistency = Object.keys(persByAgent).length > 0;

  const handleExpand = useCallback(async () => {
    if (!expanded && !dataLoaded && tenantId) {
      setSubsLoading(true);
      try {
        const data = await getCampaignSubmissions(tenantId, campaign.startDate, campaign.endDate, subsScope);
        setSubs(data);
        // Read-light persistency for the gate DISPLAY: one batched `in` query
        // per spanned year (no new index — see getPersistencyMapForYear). Only
        // fetched for tiered campaigns; failures degrade to "no data" pills.
        if (tiered) {
          try {
            const opts = campaign.scope?.type === 'unit' && campaign.scope.unitIds?.length === 1
              ? { unitId: campaign.scope.unitIds[0] } : {};
            const maps = await Promise.all(
              campaignYears(campaign.startDate, campaign.endDate).map((y) => getPersistencyMapForYear(tenantId, y, opts)),
            );
            const merged = {};
            for (const m of maps) {
              for (const [aid, recs] of Object.entries(m)) (merged[aid] = merged[aid] ?? []).push(...recs);
            }
            const pctByAgent = {};
            for (const p of participants) {
              const pct = persistencyPctForPeriod(merged[p.id] ?? [], campaign.startDate, campaign.endDate);
              if (pct != null) pctByAgent[p.id] = pct;
            }
            setPersByAgent(pctByAgent);
          } catch (e) {
            console.error('[CampaignRow] persistency load failed:', e);
          }
        }
        setDataLoaded(true);
      } catch (e) { console.error(e); }
      finally { setSubsLoading(false); }
    }
    setExpanded((v) => !v);
  }, [expanded, dataLoaded, campaign, tenantId, tiered, participants, subsScope]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface/60 transition-colors"
        onClick={handleExpand}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-ink truncate">{campaign.name}</span>
            <StatusPill variant={SCOPE_VARIANT[campaign.scope?.type] ?? 'muted'} label={SCOPE_LABEL[campaign.scope?.type] ?? campaign.scope?.type} />
            <StatusPill variant={STATUS_VARIANT[status] ?? 'muted'} label={STATUS_LABEL[status] ?? status} />
          </div>
          <p className="text-xs text-ink-muted">
            {formatDateFriendly(campaign.startDate)} → {formatDateFriendly(campaign.endDate)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(campaign); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-primary hover:bg-primary/10 transition-colors"
                aria-label="Edit"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(campaign); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10 transition-colors"
                aria-label="Delete"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          {expanded ? <ChevronUp size={16} className="text-ink-muted" /> : <ChevronDown size={16} className="text-ink-muted" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {tiered ? (
            subsLoading
              ? <div className="h-40 rounded-lg bg-border/30 animate-pulse" />
              : <CampaignStandingsBlock campaign={campaign} standings={standings} hasPersistency={hasPersistency} />
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-2">Participant Progress</p>
              {subsLoading
                ? <div className="h-16 rounded-lg bg-border/30 animate-pulse" />
                : <ProgressTable campaign={campaign} submissions={subs} allUsers={allUsers} />
              }
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Create / Edit drawer ─────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '', description: '', prize: '',
  startDate: '', endDate: '',
  scope: { type: 'branch', unitIds: [], agentIds: [] },
  targets: [{ metric: 'apiSold', threshold: '' }],
  status: 'active',
  // v2 prize structure (all optional — legacy campaigns omit these entirely)
  prizeStructure: 'none',       // 'none' | 'qualify' | 'placement' (UI selector)
  standingsMetric: 'apiSold',   // ranking metric for tiered standings
  persistencyGateEnabled: true,
  tiers: [],                    // qualify: [{ level, name, api, apps, cash, voucher }]
  placements: [
    { rank: 1, prize: '' },
    { rank: 2, prize: '' },
    { rank: 3, prize: '' },
  ],
  kiosk: false,
  meeting: false,
  countsTowardAwards: true,
};

// Simple 44px accessible toggle row (visibility + awards linkage).
function ToggleRow({ checked, onChange, label, sub }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-full min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-colors ${
        checked ? 'bg-primary/5 border-primary/30' : 'bg-card border-border'
      }`}
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {sub && <span className="block text-[11px] text-ink-muted mt-0.5">{sub}</span>}
      </span>
      <span className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${checked ? 'bg-primary dark:bg-primary-dark' : 'bg-surface-muted'}`}>
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

// Map the form's UI shape → the persisted campaign doc. UI-only fields
// (prizeStructure) are translated to the stored `structure`; number coercion
// happens in campaignService (domain rule: never store numbers as strings).
function buildCampaignPayload(f) {
  const base = {
    name: f.name, description: f.description, prize: f.prize,
    startDate: f.startDate, endDate: f.endDate,
    scope: f.scope, targets: f.targets, status: f.status,
    kiosk: !!f.kiosk, meeting: !!f.meeting,
    countsTowardAwards: f.countsTowardAwards !== false,
  };
  if (f.prizeStructure === 'qualify') {
    base.structure = 'qualify';
    base.standingsMetric = f.standingsMetric === 'applicationsSold' ? 'applicationsSold' : 'apiSold';
    base.persistencyGateEnabled = f.persistencyGateEnabled !== false;
    base.tiers = f.tiers;
    base.placements = [];
  } else if (f.prizeStructure === 'placement') {
    base.structure = 'placement';
    base.standingsMetric = f.standingsMetric === 'applicationsSold' ? 'applicationsSold' : 'apiSold';
    base.persistencyGateEnabled = f.persistencyGateEnabled !== false;
    base.placements = f.placements.filter((p) => String(p.prize).trim() !== '');
    base.tiers = [];
  } else {
    // Legacy free-text prize — clear any prior structure (edit path).
    base.structure = null;
    base.tiers = [];
    base.placements = [];
  }
  return base;
}

function CampaignForm({ initial, role, _uid, userProfile, allUsers, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    if (!initial) return EMPTY_FORM;
    return {
      ...EMPTY_FORM,
      ...initial,
      prizeStructure: initial.structure ?? 'none',
      tiers: initial.tiers ?? [],
      placements: initial.placements?.length ? initial.placements : EMPTY_FORM.placements,
      standingsMetric: initial.standingsMetric ?? 'apiSold',
      persistencyGateEnabled: initial.persistencyGateEnabled !== false,
      kiosk: !!initial.kiosk,
      meeting: !!initial.meeting,
      countsTowardAwards: initial.countsTowardAwards !== false,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isUnitManager = role === 'unit_manager';
  const unitId = userProfile?.unitId ?? null;

  // Lock scope for unit managers
  useEffect(() => {
    if (isUnitManager && unitId) {
      setForm((f) => ({ ...f, scope: { type: 'unit', unitIds: [unitId], agentIds: [] } }));
    }
  }, [isUnitManager, unitId]);

  const agents = useMemo(() => allUsers.filter((u) => u.role === 'agent'), [allUsers]);
  const units  = useMemo(() => {
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

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const setScope = (key, val) => setForm((f) => ({ ...f, scope: { ...f.scope, [key]: val } }));

  const toggleUnit = (id) => {
    const ids = form.scope.unitIds.includes(id)
      ? form.scope.unitIds.filter((x) => x !== id)
      : [...form.scope.unitIds, id];
    setScope('unitIds', ids);
  };

  const toggleAgent = (id) => {
    const ids = form.scope.agentIds.includes(id)
      ? form.scope.agentIds.filter((x) => x !== id)
      : [...form.scope.agentIds, id];
    setScope('agentIds', ids);
  };

  const addMetric = () => {
    if (form.targets.length >= 4) return;
    setForm((f) => ({ ...f, targets: [...f.targets, { metric: 'applicationsSold', threshold: '' }] }));
  };

  const updateTarget = (i, key, val) => {
    setForm((f) => {
      const t = [...f.targets];
      t[i] = { ...t[i], [key]: val };
      return { ...f, targets: t };
    });
  };

  const removeTarget = (i) => {
    setForm((f) => ({ ...f, targets: f.targets.filter((_, idx) => idx !== i) }));
  };

  // ── Prize-tier + placement editing ──────────────────────────────────────────
  const addTier = () => setForm((f) => {
    const nextLevel = f.tiers.reduce((m, t) => Math.max(m, Number(t.level) || 0), 0) + 1;
    return { ...f, tiers: [...f.tiers, { level: nextLevel, name: '', api: '', apps: '', cash: '', voucher: '' }] };
  });
  const updateTier = (i, key, val) => setForm((f) => {
    const tiers = [...f.tiers];
    tiers[i] = { ...tiers[i], [key]: val };
    return { ...f, tiers };
  });
  const removeTier = (i) => setForm((f) => ({ ...f, tiers: f.tiers.filter((_, idx) => idx !== i) }));
  const updatePlacement = (i, val) => setForm((f) => {
    const placements = [...f.placements];
    placements[i] = { ...placements[i], prize: val };
    return { ...f, placements };
  });

  const validate = () => {
    if (!form.name.trim()) return 'Campaign name is required.';
    if (form.prizeStructure === 'none' && !form.prize.trim()) return 'Prize is required.';
    if (!form.startDate || !form.endDate) return 'Start and end dates are required.';
    if (form.endDate <= form.startDate) return 'End date must be after start date.';
    if (form.targets.length === 0) return 'At least one metric target is required.';
    if (form.targets.some((t) => !(parseFloat(t.threshold) > 0))) return 'Each metric must have a threshold greater than 0.';
    if (form.prizeStructure === 'qualify') {
      if (form.tiers.length === 0) return 'Add at least one prize tier, or switch the prize structure to "Simple".';
      if (form.tiers.some((t) => !t.name.trim())) return 'Each prize tier needs a name.';
      if (form.tiers.some((t) => !(parseFloat(t.cash) > 0 || parseFloat(t.voucher) > 0))) return 'Each tier needs a cash or voucher prize.';
    }
    if (form.prizeStructure === 'placement') {
      if (!(parseFloat(form.placements[0]?.prize) > 0)) return 'The 1st-place prize is required for a placement campaign.';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(buildCampaignPayload(form));
    } catch (e) {
      setError('Failed to save. Please try again.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="flex-1 bg-black/40 border-0 p-0 m-0 cursor-pointer"
      />
      <div className="w-full max-w-md bg-card flex flex-col overflow-y-auto shadow-xl">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-ink">{initial ? 'Edit Campaign' : 'New Campaign'}</h2>
          <button aria-label="Close campaign form" onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface text-ink-muted transition-colors">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 px-5 py-4 flex flex-col gap-4">
          {/* Name */}
          <div>
            <label htmlFor="campaign-name" className="block text-xs font-semibold text-ink-muted mb-1">Campaign Name *</label>
            <input
              id="campaign-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Q2 API Sprint"
              className="w-full h-11 px-3 border border-border rounded-xl bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="campaign-description" className="block text-xs font-semibold text-ink-muted mb-1">Description</label>
            <textarea
              id="campaign-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder="Optional details…"
              className="w-full px-3 py-2 border border-border rounded-xl bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          {/* Prize */}
          <div>
            <label htmlFor="campaign-prize" className="block text-xs font-semibold text-ink-muted mb-1">Prize *</label>
            <input
              id="campaign-prize"
              value={form.prize}
              onChange={(e) => set('prize', e.target.value)}
              placeholder="e.g. Weekend Getaway for Two"
              className="w-full h-11 px-3 border border-border rounded-xl bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="campaign-start-date" className="block text-xs font-semibold text-ink-muted mb-1">Start Date *</label>
              <input
                id="campaign-start-date"
                type="date"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
                className="w-full h-11 px-3 border border-border rounded-xl bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label htmlFor="campaign-end-date" className="block text-xs font-semibold text-ink-muted mb-1">End Date *</label>
              <input
                id="campaign-end-date"
                type="date"
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
                className="w-full h-11 px-3 border border-border rounded-xl bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Scope */}
          <div>
            <p className="block text-xs font-semibold text-ink-muted mb-1">Scope</p>
            {isUnitManager ? (
              <p className="text-sm text-ink-muted italic">This Unit (your unit only)</p>
            ) : (
              <div className="flex flex-col gap-2">
                {[
                  { value: 'branch', label: 'Branch-wide' },
                  { value: 'unit',   label: 'Specific unit(s)' },
                  { value: 'agent',  label: 'Specific agent(s)' },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scopeType"
                      value={opt.value}
                      checked={form.scope.type === opt.value}
                      onChange={() => setScope('type', opt.value)}
                      className="accent-primary"
                    />
                    <span className="text-sm text-ink">{opt.label}</span>
                  </label>
                ))}

                {form.scope.type === 'unit' && units.length > 0 && (
                  <div className="ml-5 flex flex-col gap-1 mt-1">
                    {units.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.scope.unitIds.includes(u.id)}
                          onChange={() => toggleUnit(u.id)}
                          className="accent-primary"
                        />
                        <span className="text-sm text-ink">{u.label}</span>
                      </label>
                    ))}
                  </div>
                )}

                {form.scope.type === 'agent' && agents.length > 0 && (
                  <div className="ml-5 flex flex-col gap-1 mt-1 max-h-40 overflow-y-auto">
                    {agents.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.scope.agentIds.includes(a.id)}
                          onChange={() => toggleAgent(a.id)}
                          className="accent-primary"
                        />
                        <span className="text-sm text-ink">{a.name ?? a.displayName ?? a.email}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Targets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-ink-muted">Metric Targets *</p>
              {form.targets.length < 4 && (
                <button onClick={addMetric} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                  + Add Metric
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {form.targets.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={t.metric}
                    onChange={(e) => updateTarget(i, 'metric', e.target.value)}
                    className="flex-1 h-10 px-2 border border-border rounded-lg bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {METRIC_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={t.threshold}
                    onChange={(e) => updateTarget(i, 'threshold', e.target.value)}
                    placeholder="Threshold"
                    className="w-28 h-10 px-2 border border-border rounded-lg bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {form.targets.length > 1 && (
                    <button
                      aria-label="Remove target"
                      onClick={() => removeTarget(i)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Prize structure (optional v2) */}
          <div className="border-t border-border pt-4">
            <p className="block text-xs font-semibold text-ink-muted mb-1">Prize Structure</p>
            <p className="text-[11px] text-ink-muted mb-2">
              Add tiers or a podium to unlock ranked standings, the persistency gate, and projected payouts. Leave as Simple to keep the free-text prize.
            </p>
            <div className="flex flex-col gap-2">
              {[
                { value: 'none', label: 'Simple', sub: 'Free-text prize (as before)' },
                { value: 'qualify', label: 'Qualify tiers', sub: 'Hit a tier, win its prize — everyone who reaches it wins' },
                { value: 'placement', label: 'Placement podium', sub: 'A race — top three by the metric take the prizes' },
              ].map((opt) => (
                <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="prizeStructure"
                    value={opt.value}
                    checked={form.prizeStructure === opt.value}
                    onChange={() => set('prizeStructure', opt.value)}
                    className="accent-primary mt-0.5"
                  />
                  <span className="flex flex-col text-sm text-ink">
                    {opt.label}
                    <span className="text-[11px] text-ink-muted font-normal">{opt.sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Standings metric + gate (shown for tiered structures) */}
          {form.prizeStructure !== 'none' && (
            <>
              <div>
                <label htmlFor="standings-metric" className="block text-xs font-semibold text-ink-muted mb-1">Rank standings by</label>
                <select
                  id="standings-metric"
                  value={form.standingsMetric}
                  onChange={(e) => set('standingsMetric', e.target.value)}
                  className="w-full h-11 px-3 border border-border rounded-xl bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="apiSold">API</option>
                  <option value="applicationsSold">Applications</option>
                </select>
              </div>

              <ToggleRow
                checked={form.persistencyGateEnabled}
                onChange={(v) => set('persistencyGateEnabled', v)}
                label="Persistency gate"
                sub="Scale each projected payout by quality — ≥90% full · 85–89% half · 80–84% quarter · <80% disqualified"
              />
            </>
          )}

          {/* Qualify tier editor */}
          {form.prizeStructure === 'qualify' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gold-ink">Prize Tiers *</p>
                <button type="button" onClick={addTier} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                  + Add Tier
                </button>
              </div>
              {form.tiers.length === 0 && (
                <p className="text-[11px] text-ink-muted italic mb-2">No tiers yet — add Bronze/Silver/Gold-style levels with an API and apps minimum plus a cash or voucher prize.</p>
              )}
              <div className="flex flex-col gap-2">
                {form.tiers.map((tr, i) => (
                  <div key={i} className="rounded-xl border border-border bg-surface-raised p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-gold text-white flex items-center justify-center font-display font-extrabold text-xs shrink-0">L{tr.level}</span>
                      <input
                        value={tr.name}
                        onChange={(e) => updateTier(i, 'name', e.target.value)}
                        placeholder="Tier name (e.g. Gold)"
                        aria-label={`Tier ${i + 1} name`}
                        className="flex-1 h-10 px-2 border border-border rounded-lg bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <button
                        type="button"
                        aria-label="Remove tier"
                        onClick={() => removeTier(i)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'api', label: 'API min', ph: '250000' },
                        { key: 'apps', label: 'Apps min', ph: '20' },
                        { key: 'cash', label: 'Cash prize', ph: '10000' },
                        { key: 'voucher', label: 'Voucher', ph: '1000' },
                      ].map((fld) => (
                        <div key={fld.key}>
                          <label htmlFor={`tier-${i}-${fld.key}`} className="block text-[10px] font-mono text-ink-muted mb-0.5">{fld.label}</label>
                          <input
                            id={`tier-${i}-${fld.key}`}
                            type="number"
                            min="0"
                            value={tr[fld.key]}
                            onChange={(e) => updateTier(i, fld.key, e.target.value)}
                            placeholder={fld.ph}
                            className="w-full h-10 px-2 border border-border rounded-lg bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Placement editor */}
          {form.prizeStructure === 'placement' && (
            <div>
              <p className="text-xs font-semibold text-gold-ink mb-2">Placement Prizes *</p>
              <div className="flex flex-col gap-2">
                {form.placements.map((p, i) => (
                  <div key={p.rank} className="flex items-center gap-2">
                    <span className="w-16 text-sm font-semibold text-ink shrink-0">
                      {p.rank === 1 ? '1st' : p.rank === 2 ? '2nd' : '3rd'} place
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={p.prize}
                      onChange={(e) => updatePlacement(i, e.target.value)}
                      placeholder="Prize amount (TTD)"
                      aria-label={`${p.rank === 1 ? '1st' : p.rank === 2 ? '2nd' : '3rd'} place prize`}
                      className="flex-1 h-10 px-2 border border-border rounded-lg bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visibility + awards linkage */}
          <div className="border-t border-border pt-4 flex flex-col gap-2">
            <p className="block text-xs font-semibold text-ink-muted">Where it shows</p>
            <ToggleRow
              checked={form.kiosk}
              onChange={(v) => set('kiosk', v)}
              label="Kiosk wall display"
              sub="Rotate this campaign's leaderboard on the branch TV"
            />
            <ToggleRow
              checked={form.meeting}
              onChange={(v) => set('meeting', v)}
              label="Meeting mode"
              sub="Add a slide to the stand-up run-of-show"
            />
            <ToggleRow
              checked={form.countsTowardAwards}
              onChange={(v) => set('countsTowardAwards', v)}
              label="Counts toward annual awards"
              sub="Settled production rolls into agents' annual awards progress"
            />
          </div>

          {/* Status */}
          <div>
            <p className="block text-xs font-semibold text-ink-muted mb-1">Status</p>
            <div className="flex gap-3">
              {['active', 'draft'].map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={form.status === s}
                    onChange={() => set('status', s)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-ink capitalize">{s}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-danger-ink">{error}</p>}
        </div>

        <div className="px-5 pb-5 pt-2 border-t border-border shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-11 rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm hover:bg-primary/90 dark:hover:bg-primary transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function CampaignPanel() {
  const { user, userProfile, role, tenantId } = useAuth();
  // Rules-provable submissions scope for standings reads (see campaignService).
  const subsScope = useMemo(
    () => campaignSubsScopeFor(role, user?.uid, userProfile?.branchId),
    [role, user?.uid, userProfile?.branchId],
  );
  const [campaigns, setCampaigns] = useState([]);
  const [allUsers, setAllUsers]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [listTab, setListTab]     = useState('active');
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const toast = useToast();

  const canCreate = ['unit_manager', 'branch_manager', 'tenant_admin', 'platform_admin'].includes(role);

  // Retry-able: extracted so the error card's Retry button re-invokes the
  // same fetch (§1 states contract — never a silent console.error swallow).
  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [camps, users] = await Promise.all([
        getCampaigns(tenantId),
        getTenantUsers(tenantId),
      ]);
      setCampaigns(camps);
      setAllUsers(users);
    } catch (e) {
      console.error('[CampaignPanel] load failed:', e);
      setLoadError(true);
    }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const out = { active: [], upcoming: [], ended: [] };
    for (const c of campaigns) out[classifyDate(c.startDate, c.endDate)]?.push(c);
    return out;
  }, [campaigns]);

  const listTabs = useMemo(() => [
    { id: 'active',   label: 'Active',   badge: grouped.active.length   },
    { id: 'upcoming', label: 'Upcoming', badge: grouped.upcoming.length },
    { id: 'ended',    label: 'Ended',    badge: grouped.ended.length    },
  ], [grouped]);

  const handleSave = async (formData) => {
    if (!tenantId) return;
    try {
      if (editing) {
        await updateCampaign(tenantId, editing.id, formData);
      } else {
        await createCampaign(
          tenantId, user.uid,
          userProfile?.name ?? userProfile?.email ?? '',
          role,
          formData
        );
      }
      setFormOpen(false);
      setEditing(null);
      toast.show({ variant: 'success', message: 'Campaign saved' });
      await load();
    } catch (err) {
      console.error('[CampaignPanel] save failed:', err);
      toast.show({ variant: 'error', message: "Couldn't save campaign" });
    }
  };

  const handleDelete = async (id) => {
    if (!tenantId) return;
    try {
      await deleteCampaign(tenantId, id);
      setDeletingId(null);
      toast.show({ variant: 'success', message: 'Campaign deleted' });
      await load();
    } catch (err) {
      console.error('[CampaignPanel] delete failed:', err);
      toast.show({ variant: 'error', message: "Couldn't delete campaign" });
    }
  };

  const canEditCampaign = (c) =>
    role === 'tenant_admin' || role === 'platform_admin' || role === 'branch_manager' || c.createdBy === user?.uid;

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-border/40 animate-pulse" />)}
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 p-8 rounded-xl bg-danger/10 border border-danger/30 text-center"
        data-testid="campaign-panel-error"
      >
        <AlertTriangle size={28} className="text-danger-ink" aria-hidden="true" />
        <p className="text-sm text-danger-ink font-medium">Couldn&apos;t load campaigns — check your connection and try again.</p>
        <button
          type="button"
          onClick={load}
          className="min-h-[44px] px-4 rounded-lg bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const visibleCampaigns = grouped[listTab] ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Delete confirm dialog */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-base font-bold text-ink mb-2">Delete Campaign?</h3>
            <p className="text-sm text-ink-muted mb-5">This cannot be undone. All associated campaign data will be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="flex-1 h-11 rounded-xl border border-border text-ink font-semibold text-sm">Cancel</button>
              <button onClick={() => handleDelete(deletingId)} className="flex-1 h-11 rounded-xl bg-danger text-white font-semibold text-sm hover:bg-danger/90 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Form drawer */}
      {formOpen && (
        <CampaignForm
          initial={editing}
          role={role}
          uid={user?.uid}
          userProfile={userProfile}
          allUsers={allUsers}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Campaigns</h2>
        {canCreate && (
          <button
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="h-11 px-4 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 dark:hover:bg-primary transition-colors"
          >
            <Plus size={16} />
            New Campaign
          </button>
        )}
      </div>

      {/* Tab bar */}
      <TabPills tabs={listTabs} activeId={listTab} onChange={setListTab} />

      {/* Campaign list */}
      {visibleCampaigns.length === 0 ? (
        <div className="card text-center py-10 flex flex-col items-center gap-3" data-testid="campaign-list-empty">
          <div className="p-3 rounded-full bg-surface-muted text-ink-muted">
            <Megaphone size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">
              {listTab === 'active' ? 'No active campaigns' : listTab === 'upcoming' ? 'No upcoming campaigns' : 'No ended campaigns'}
            </p>
            <p className="text-sm text-ink-muted mt-0.5">
              {canCreate
                ? 'Create a campaign to motivate your team toward a shared goal.'
                : `Check back later — you'll see ${listTab} campaigns here once your manager sets one up.`}
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="min-h-[44px] mt-1 inline-flex items-center gap-2 px-4 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors"
            >
              <Plus size={16} aria-hidden="true" />
              New Campaign
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleCampaigns.map((c) => (
            <CampaignRow
              key={c.id}
              campaign={c}
              canEdit={canEditCampaign(c)}
              onEdit={(camp) => { setEditing(camp); setFormOpen(true); }}
              onDelete={(camp) => setDeletingId(camp.id)}
              allUsers={allUsers}
              tenantId={tenantId}
              subsScope={subsScope}
            />
          ))}
        </div>
      )}
    </div>
  );
}

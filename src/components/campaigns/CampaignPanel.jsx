import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getCampaigns, createCampaign, updateCampaign, deleteCampaign,
  getCampaignSubmissions,
} from '../../services/campaignService';
import { getTenantUsers } from '../../services/managerService';
import { computeCampaignProgress } from '../../utils/campaignEngine';
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

function ScopeBadge({ scope }) {
  const { type } = scope ?? {};
  const map = { branch: 'Branch', unit: 'Unit', agent: 'Agent' };
  const color = type === 'branch' ? 'bg-primary/10 text-primary' : type === 'unit' ? 'bg-warning/15 text-warning' : 'bg-border/60 text-ink-muted';
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{map[type] ?? type}</span>;
}

function StatusBadge({ status }) {
  const map = { active: ['bg-success/15 text-success', 'Active'], upcoming: ['bg-primary/10 text-primary', 'Upcoming'], ended: ['bg-border/60 text-ink-muted', 'Ended'] };
  const [cls, label] = map[status] ?? ['bg-border/60 text-ink-muted', status];
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{label}</span>;
}

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
    return <p className="text-xs text-ink-muted italic py-2">No submissions in this campaign period yet.</p>;
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
                  ? <span className="inline-flex items-center gap-0.5 text-success font-semibold"><CheckCircle2 size={12} /> Complete</span>
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
function CampaignRow({ campaign, canEdit, onEdit, onDelete, allUsers, tenantId }) {
  const [expanded, setExpanded] = useState(false);
  const [subs, setSubs] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);

  const status = classifyDate(campaign.startDate, campaign.endDate);

  const handleExpand = useCallback(async () => {
    if (!expanded && subs.length === 0 && tenantId) {
      setSubsLoading(true);
      try {
        const data = await getCampaignSubmissions(tenantId, campaign.startDate, campaign.endDate);
        setSubs(data);
      } catch (e) { console.error(e); }
      finally { setSubsLoading(false); }
    }
    setExpanded((v) => !v);
  }, [expanded, subs.length, campaign, tenantId]);

  return (
    <div className="rounded-xl border border-border bg-[var(--color-surface)] overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface/60 transition-colors"
        onClick={handleExpand}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-ink truncate">{campaign.name}</span>
            <ScopeBadge scope={campaign.scope} />
            <StatusBadge status={status} />
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
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-2">Participant Progress</p>
          {subsLoading
            ? <div className="h-16 rounded-lg bg-border/30 animate-pulse" />
            : <ProgressTable campaign={campaign} submissions={subs} allUsers={allUsers} />
          }
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
};

function CampaignForm({ initial, role, _uid, userProfile, allUsers, onSave, onClose }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
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

  const validate = () => {
    if (!form.name.trim()) return 'Campaign name is required.';
    if (!form.prize.trim()) return 'Prize is required.';
    if (!form.startDate || !form.endDate) return 'Start and end dates are required.';
    if (form.endDate <= form.startDate) return 'End date must be after start date.';
    if (form.targets.length === 0) return 'At least one metric target is required.';
    if (form.targets.some((t) => !(parseFloat(t.threshold) > 0))) return 'Each metric must have a threshold greater than 0.';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
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
      <div className="w-full max-w-md bg-[var(--color-surface)] flex flex-col overflow-y-auto shadow-xl">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-ink">{initial ? 'Edit Campaign' : 'New Campaign'}</h2>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface text-ink-muted transition-colors">
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
              className="w-full h-11 px-3 border border-border rounded-xl bg-[var(--color-surface)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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
              className="w-full px-3 py-2 border border-border rounded-xl bg-[var(--color-surface)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
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
              className="w-full h-11 px-3 border border-border rounded-xl bg-[var(--color-surface)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                className="w-full h-11 px-3 border border-border rounded-xl bg-[var(--color-surface)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label htmlFor="campaign-end-date" className="block text-xs font-semibold text-ink-muted mb-1">End Date *</label>
              <input
                id="campaign-end-date"
                type="date"
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
                className="w-full h-11 px-3 border border-border rounded-xl bg-[var(--color-surface)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                    className="flex-1 h-10 px-2 border border-border rounded-lg bg-[var(--color-surface)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                    className="w-28 h-10 px-2 border border-border rounded-lg bg-[var(--color-surface)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {form.targets.length > 1 && (
                    <button
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

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <div className="px-5 pb-5 pt-2 border-t border-border shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-11 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
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
  const [campaigns, setCampaigns] = useState([]);
  const [allUsers, setAllUsers]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [listTab, setListTab]     = useState('active');
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast]         = useState('');

  const canCreate = ['unit_manager', 'branch_manager', 'tenant_admin', 'platform_admin'].includes(role);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [camps, users] = await Promise.all([
        getCampaigns(tenantId),
        getTenantUsers(),
      ]);
      setCampaigns(camps);
      setAllUsers(users);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const grouped = useMemo(() => {
    const out = { active: [], upcoming: [], ended: [] };
    for (const c of campaigns) out[classifyDate(c.startDate, c.endDate)]?.push(c);
    return out;
  }, [campaigns]);

  const handleSave = async (formData) => {
    if (!tenantId) return;
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
    showToast('Campaign saved');
    await load();
  };

  const handleDelete = async (id) => {
    if (!tenantId) return;
    await deleteCampaign(tenantId, id);
    setDeletingId(null);
    showToast('Campaign deleted');
    await load();
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

  const visibleCampaigns = grouped[listTab] ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-success text-white text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}

      {/* Delete confirm dialog */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 max-w-sm w-full">
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
            className="h-10 px-4 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 dark:hover:bg-primary transition-colors"
          >
            <Plus size={16} />
            New Campaign
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border">
        {['active', 'upcoming', 'ended'].map((tab) => (
          <button
            key={tab}
            onClick={() => setListTab(tab)}
            className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors capitalize whitespace-nowrap px-3 ${
              listTab === tab ? 'bg-[var(--color-surface)] text-primary shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {tab}
            {grouped[tab]?.length > 0 && (
              <span className="ml-1 text-[10px] font-bold opacity-70">({grouped[tab].length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Campaign list */}
      {visibleCampaigns.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-sm text-ink-muted">
            {listTab === 'active' ? 'No active campaigns.' : listTab === 'upcoming' ? 'No upcoming campaigns.' : 'No ended campaigns.'}
          </p>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

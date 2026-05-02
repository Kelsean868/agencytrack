import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Loader2, UserCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { createAgent, getUnitManagers, getAgentsForUnit } from '../../services/agentManagementService';
import { getTenantUsers } from '../../services/managerService';
import { formatDateDisplay, formatDateFriendly } from '../../utils/formatters';

const TENANT_ID = import.meta.env.VITE_TENANT_ID;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AgentAvatar({ name }) {
  const initials = (name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

function CreateAgentDrawer({ onClose, onCreated, role, userProfile }) {
  const [form, setForm] = useState({
    name: '', email: '', agentNumber: '', contractStartDate: '', unitId: '',
  });
  const [unitManagers, setUnitManagers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const isUnitManager = role === 'unit_manager';

  useEffect(() => {
    if (isUnitManager) {
      setForm((f) => ({ ...f, unitId: userProfile?.unitId ?? '' }));
      return;
    }
    getUnitManagers(TENANT_ID).then(setUnitManagers).catch(console.error);
  }, [isUnitManager, userProfile]);

  function validate() {
    if (!form.name.trim()) return 'Full name is required.';
    if (!EMAIL_RE.test(form.email)) return 'A valid email address is required.';
    if (!form.unitId) return 'Unit assignment is required.';
    if (!form.contractStartDate) return 'Contract start date is required.';
    if (form.contractStartDate > new Date().toISOString().slice(0, 10)) {
      return 'Contract start date cannot be in the future.';
    }
    return null;
  }

  async function handleSave() {
    setError('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    try {
      await createAgent({
        name:              form.name.trim(),
        email:             form.email.trim().toLowerCase(),
        agentNumber:       form.agentNumber.trim(),
        unitId:            form.unitId,
        contractStartDate: form.contractStartDate,
      });
      onCreated(form.email.trim().toLowerCase());
    } catch (err) {
      const code = err?.code ?? '';
      if (code.includes('already-exists')) {
        setError('An account with this email already exists.');
      } else if (code.includes('permission-denied')) {
        setError("You don't have permission to create agents in this unit.");
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-[var(--color-surface)] shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-bold text-ink">Add New Agent</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-border/40 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Full Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Jordan Smith"
              className="h-10 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Email Address *</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="agent@example.com"
              className="h-10 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Agent Number */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Agent Number</label>
            <input
              type="text"
              value={form.agentNumber}
              onChange={set('agentNumber')}
              placeholder="Optional"
              className="h-10 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Contract Start Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Contract Start Date *</label>
            <input
              type="date"
              value={form.contractStartDate}
              onChange={set('contractStartDate')}
              max={new Date().toISOString().slice(0, 10)}
              className="h-10 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {form.contractStartDate && (
              <p className="text-[10px] text-ink-muted">{formatDateFriendly(form.contractStartDate)}</p>
            )}
          </div>

          {/* Unit */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Unit *</label>
            {isUnitManager ? (
              <div className="h-10 px-3 rounded-lg border border-border bg-border/30 text-sm text-ink-muted flex items-center">
                {userProfile?.name ?? 'Your unit'} (locked)
              </div>
            ) : (
              <select
                value={form.unitId}
                onChange={set('unitId')}
                className="h-10 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Select a unit manager…</option>
                {unitManagers.map((um) => (
                  <option key={um.uid} value={um.unitId ?? um.uid}>
                    {um.name ?? um.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : 'Create Agent Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgentManagementPanel() {
  const { role, userProfile } = useAuth();

  const [agents, setAgents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [toast, setToast]         = useState('');

  const isUnitManager = role === 'unit_manager';

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      let list;
      if (isUnitManager && userProfile?.unitId) {
        list = await getAgentsForUnit(TENANT_ID, userProfile.unitId);
      } else {
        const all = await getTenantUsers();
        list = all.filter((u) => u.role === 'agent');
      }
      list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      setAgents(list);
    } catch (err) {
      console.error('[AgentManagementPanel] loadAgents:', err);
    } finally {
      setLoading(false);
    }
  }, [isUnitManager, userProfile]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  function handleCreated(email) {
    setShowDrawer(false);
    loadAgents();
    setToast(`Agent account created. A password setup email has been sent to ${email}.`);
    setTimeout(() => setToast(''), 6000);
  }

  return (
    <div className="flex flex-col gap-4 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-success text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg max-w-sm text-center">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Agent Roster{agents.length > 0 ? ` — ${agents.length} agent${agents.length !== 1 ? 's' : ''}` : ''}
        </p>
        <button
          onClick={() => setShowDrawer(true)}
          className="btn-primary flex items-center gap-1.5 text-sm px-3 h-9"
        >
          <Plus size={15} /> Add Agent
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-border/30 animate-pulse" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="card text-center py-10 flex flex-col items-center gap-3">
          <UserCircle size={40} className="text-border" />
          <p className="text-sm text-ink-muted italic">No agents yet — create your first agent above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Column headers */}
          <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-3 px-3 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
            <span>Name</span>
            <span>Email</span>
            <span>Agent #</span>
            <span>Contract Start</span>
            <span>Joined</span>
          </div>
          {agents.map((agent) => {
            const joinedDate = agent.createdAt?.toDate?.().toISOString().slice(0, 10) ?? '';
            return (
              <div
                key={agent.uid ?? agent.id}
                className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-3 items-center px-3 py-3 rounded-xl bg-[var(--color-surface)] border border-border"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AgentAvatar name={agent.name} />
                  <span className="text-sm font-semibold text-ink truncate">{agent.name ?? '—'}</span>
                </div>
                <span className="text-xs text-ink-muted truncate">{agent.email ?? '—'}</span>
                <span className="text-xs text-ink-muted">{agent.agentNumber || '—'}</span>
                <span className="text-xs text-ink-muted">
                  {agent.contractStartDate ? formatDateDisplay(agent.contractStartDate) : '—'}
                </span>
                <span className="text-xs text-ink-muted">
                  {joinedDate ? formatDateDisplay(joinedDate) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Create drawer */}
      {showDrawer && (
        <CreateAgentDrawer
          onClose={() => setShowDrawer(false)}
          onCreated={handleCreated}
          role={role}
          userProfile={userProfile}
        />
      )}
    </div>
  );
}

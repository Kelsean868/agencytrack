import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, Clock, AlertTriangle, LockOpen, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getWeeklySubmissions, getTenantUsers } from '../../services/managerService';
import { unlockSubmission } from '../../services/unlockService';
import { getLastNSundays } from '../../utils/dateHelpers';
import { formatDateFriendly } from '../../utils/formatters';
import SubmissionViewer from '../submissions/SubmissionViewer';

const MANAGER_ROLES = ['unit_manager', 'branch_manager', 'super_admin'];

function daysSinceSunday(weekStarting) {
  const sunday = new Date(weekStarting + 'T12:00:00Z');
  return Math.floor((Date.now() - sunday.getTime()) / (1000 * 60 * 60 * 24));
}

function formatSubmittedAt(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-TT', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Column({ icon: Icon, title, color, children, count }) {
  const borderColor = { success: 'border-success/30', warning: 'border-warning/30', danger: 'border-danger/30' }[color];
  const headerColor = { success: 'bg-success/10 text-success', warning: 'bg-warning/10 text-warning', danger: 'bg-danger/10 text-danger' }[color];
  return (
    <div className={`flex-1 min-w-[200px] rounded-xl border ${borderColor} overflow-hidden`}>
      <div className={`flex items-center gap-2 px-4 py-3 ${headerColor}`}>
        <Icon size={16} />
        <span className="text-sm font-semibold">{title}</span>
        <span className="ml-auto text-sm font-bold">{count}</span>
      </div>
      <div className="divide-y divide-border/40 bg-[var(--color-surface)]">{children}</div>
    </div>
  );
}

function AgentRow({ name, sub }) {
  return (
    <div className="px-4 py-3">
      <p className="text-sm font-medium text-ink">{name}</p>
      {sub && <p className="text-xs text-ink-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function SubmittedAgentRow({ name, submittedAt, submissionId, onUnlock, onView }) {
  const [confirming, setConfirming] = useState(false);
  const [unlocking, setUnlocking]   = useState(false);

  const handleConfirm = async () => {
    setUnlocking(true);
    try {
      await onUnlock(submissionId, name);
      setConfirming(false);
    } catch (e) {
      console.error('Unlock failed:', e);
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="px-4 py-3 flex items-start justify-between gap-2">
      <div>
        <p className="text-sm font-medium text-ink">{name}</p>
        {submittedAt && <p className="text-xs text-ink-muted mt-0.5">{formatSubmittedAt(submittedAt)}</p>}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onView}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:text-primary hover:bg-primary/10 transition-colors"
          aria-label={`View ${name}'s report`}
        >
          <Eye size={14} />
        </button>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="shrink-0 h-8 px-2.5 flex items-center gap-1.5 rounded-lg border border-warning/40 text-warning text-xs font-semibold hover:bg-warning/10 transition-colors"
          aria-label={`Unlock ${name}'s report`}
        >
          <LockOpen size={12} />
          Unlock
        </button>
      ) : (
        <div className="flex flex-col gap-1 items-end shrink-0">
          <p className="text-[11px] text-ink-muted text-right max-w-[140px] leading-tight">
            Unlock {name}'s report?
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setConfirming(false)}
              className="h-7 px-2.5 rounded-lg border border-border text-xs text-ink-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={unlocking}
              className="h-7 px-2.5 rounded-lg bg-warning text-white text-xs font-semibold disabled:opacity-60 hover:bg-warning/90 transition-colors"
            >
              {unlocking ? '…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default function CompliancePanel({ selectedWeek, setSelectedWeek }) {
  const { user, userProfile, role, tenantId } = useAuth();
  const [submissions, setSubmissions]           = useState([]);
  const [users, setUsers]                       = useState([]);
  const [usersLoaded, setUsersLoaded]           = useState(false);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState('');
  const [viewingSubmission, setViewingSubmission] = useState(null);

  const sundays   = getLastNSundays(8);
  const isManager = MANAGER_ROLES.includes(role);

  const loadData = () => {
    setLoading(true);
    setError('');
    Promise.all([getWeeklySubmissions(selectedWeek), getTenantUsers()])
      .then(([subs, userList]) => {
        setSubmissions(subs);
        setUsers(userList.filter((u) => u.role === 'agent'));
        setUsersLoaded(true);
      })
      .catch((e) => {
        console.error(e);
        setError('Failed to load data.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [selectedWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  const { submitted, pending, missing } = useMemo(() => {
    const userNameMap = {};
    users.forEach((u) => { userNameMap[u.id] = u.name ?? u.displayName ?? u.email ?? null; });

    function resolveName(s) {
      if (s.agentName)   return s.agentName;
      if (s.displayName) return s.displayName;
      if (s.userName)    return s.userName;
      const uid = s.agentId ?? s.userId ?? '';
      if (uid && userNameMap[uid]) return userNameMap[uid];
      return uid ? `Agent ${uid.slice(-6)}` : '—';
    }

    const submitted = submissions
      .filter((s) => s.status === 'submitted')
      .map((s) => ({
        id:           s.id,
        agentId:      s.agentId ?? s.userId,
        name:         resolveName(s),
        submittedAt:  s.submittedAt,
        submission:   s,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const pending = submissions
      .filter((s) => s.status !== 'submitted')
      .map((s) => ({ id: s.agentId ?? s.userId, name: resolveName(s) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const missing = [];
    if (usersLoaded && users.length > 0) {
      const submittedIds = new Set(submissions.map((s) => s.agentId ?? s.userId));
      users.forEach((u) => {
        if (!submittedIds.has(u.id)) missing.push({ id: u.id, name: u.name ?? u.email ?? u.id });
      });
      missing.sort((a, b) => a.name.localeCompare(b.name));
    }

    return { submitted, pending, missing };
  }, [users, usersLoaded, submissions]);

  const handleUnlock = async (submissionId, agentName) => {
    if (!user?.uid || !tenantId) return;
    const managerName = userProfile?.name ?? userProfile?.email ?? 'Manager';
    await unlockSubmission(tenantId, submissionId, user.uid, managerName);
    // Reload to reflect status change
    loadData();
  };

  const days       = daysSinceSunday(selectedWeek);
  const totalKnown = usersLoaded && users.length > 0 ? users.length : null;

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-10 bg-border/40 rounded-lg animate-pulse w-48" />
        <div className="flex gap-4 flex-wrap">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 min-w-[200px] h-40 bg-border/40 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">{error}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Submission viewer drawer */}
      {viewingSubmission && (
        <SubmissionViewer
          submission={viewingSubmission}
          onClose={() => setViewingSubmission(null)}
        />
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {sundays.map((d, i) => (
            <option key={d} value={d}>{i === 0 ? `This week — ${formatDateFriendly(d)}` : formatDateFriendly(d)}</option>
          ))}
        </select>

        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-success">{submitted.length}</span> submitted
          {pending.length > 0 && (
            <> &nbsp;·&nbsp; <span className="font-semibold text-warning">{pending.length} draft</span></>
          )}
          {totalKnown !== null && (
            <> &nbsp;·&nbsp; <span className="font-semibold text-ink">{totalKnown} agents total</span></>
          )}
          {missing.length > 0 && (
            <> &nbsp;·&nbsp; <span className="font-semibold text-danger">{missing.length} missing</span></>
          )}
        </p>
      </div>

      <div className="flex gap-4 flex-wrap items-start">
        {/* Submitted */}
        <Column icon={CheckCircle} title="Submitted" color="success" count={submitted.length}>
          {submitted.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-muted">None yet.</p>
          )}
          {submitted.map((a) =>
            isManager ? (
              <SubmittedAgentRow
                key={a.id}
                name={a.name}
                submittedAt={a.submittedAt}
                submissionId={a.id}
                onUnlock={handleUnlock}
                onView={() => setViewingSubmission(a.submission)}
              />
            ) : (
              <AgentRow
                key={a.id}
                name={a.name}
                sub={a.submittedAt ? formatSubmittedAt(a.submittedAt) : undefined}
              />
            )
          )}
        </Column>

        {/* Pending / Draft */}
        <Column icon={Clock} title="Pending / Draft" color="warning" count={pending.length}>
          {pending.length === 0 && <p className="px-4 py-3 text-sm text-ink-muted">None.</p>}
          {pending.map((a) => <AgentRow key={a.id} name={a.name} />)}
        </Column>

        {/* Missing */}
        <Column icon={AlertTriangle} title="Missing" color="danger" count={missing.length}>
          {!usersLoaded || users.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-muted">No user list available yet.</p>
          ) : missing.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-muted">All accounted for.</p>
          ) : (
            missing.map((a) => (
              <AgentRow
                key={a.id}
                name={a.name}
                sub={days > 0 ? `${days} day${days !== 1 ? 's' : ''} since Sunday` : 'Due today'}
              />
            ))
          )}
        </Column>
      </div>
    </div>
  );
}

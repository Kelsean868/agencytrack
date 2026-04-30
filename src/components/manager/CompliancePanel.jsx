import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { getWeeklySubmissions, getTenantUsers } from '../../services/managerService';
import { getLastNSundays } from '../../utils/dateHelpers';

function daysSinceSunday(weekStarting) {
  const sunday = new Date(weekStarting + 'T00:00:00');
  const now = new Date();
  return Math.floor((now - sunday) / (1000 * 60 * 60 * 24));
}

function formatSubmittedAt(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-TT', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Column({ icon: Icon, title, color, children, count }) {
  const borderColor = {
    success: 'border-success/30',
    warning: 'border-warning/30',
    danger:  'border-danger/30',
  }[color];
  const headerColor = {
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger:  'bg-danger/10 text-danger',
  }[color];

  return (
    <div className={`flex-1 min-w-[200px] rounded-xl border ${borderColor} overflow-hidden`}>
      <div className={`flex items-center gap-2 px-4 py-3 ${headerColor}`}>
        <Icon size={16} />
        <span className="text-sm font-semibold">{title}</span>
        <span className="ml-auto text-sm font-bold">{count}</span>
      </div>
      <div className="divide-y divide-border/40 bg-white">{children}</div>
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

export default function CompliancePanel({ selectedWeek, setSelectedWeek }) {
  const [submissions, setSubmissions] = useState([]);
  const [users, setUsers]             = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const sundays = getLastNSundays(8);

  useEffect(() => {
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
  }, [selectedWeek]);

  const { submitted, pending, missing } = useMemo(() => {
    // Submitted and draft come directly from submissions — no users needed.
    const submitted = submissions
      .filter((s) => s.status === 'submitted')
      .map((s) => ({
        id: s.agentId ?? s.userId,
        name: s.agentName ?? s.displayName ?? s.agentId ?? s.userId ?? '—',
        submittedAt: s.submittedAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const pending = submissions
      .filter((s) => s.status !== 'submitted')
      .map((s) => ({
        id: s.agentId ?? s.userId,
        name: s.agentName ?? s.displayName ?? s.agentId ?? s.userId ?? '—',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Missing requires a populated users list to know who hasn't submitted.
    const missing = [];
    if (usersLoaded && users.length > 0) {
      const submittedIds = new Set(
        submissions.map((s) => s.agentId ?? s.userId)
      );
      users.forEach((u) => {
        if (!submittedIds.has(u.id)) {
          missing.push({ id: u.id, name: u.name ?? u.email ?? u.id });
        }
      });
      missing.sort((a, b) => a.name.localeCompare(b.name));
    }

    return { submitted, pending, missing };
  }, [users, usersLoaded, submissions]);

  const days = daysSinceSunday(selectedWeek);
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
    return (
      <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {sundays.map((d, i) => (
            <option key={d} value={d}>
              {i === 0 ? `This week (${d})` : d}
            </option>
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
        <Column
          icon={CheckCircle}
          title="Submitted"
          color="success"
          count={submitted.length}
        >
          {submitted.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-muted">None yet.</p>
          )}
          {submitted.map((a) => (
            <AgentRow
              key={a.id}
              name={a.name}
              sub={a.submittedAt ? formatSubmittedAt(a.submittedAt) : undefined}
            />
          ))}
        </Column>

        <Column
          icon={Clock}
          title="Pending / Draft"
          color="warning"
          count={pending.length}
        >
          {pending.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-muted">None.</p>
          )}
          {pending.map((a) => (
            <AgentRow key={a.id} name={a.name} />
          ))}
        </Column>

        <Column
          icon={AlertTriangle}
          title="Missing"
          color="danger"
          count={missing.length}
        >
          {!usersLoaded || users.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-muted">
              No user list available yet.
            </p>
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

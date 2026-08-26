import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Copy, Trash2, Plus, RefreshCw, AlertTriangle, KeyRound } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';
import { getTenantUsers } from '../../services/managerService';

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-TT', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CallSourcesTab() {
  const { tenantId } = useAuth();
  const { show: showToast } = useToast();

  const [sources, setSources] = useState([]);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [sourceApp, setSourceApp]       = useState('kqm-calls');
  const [sourceUserId, setSourceUserId] = useState('');
  const [creditUid, setCreditUid]       = useState('');
  const [label, setLabel]               = useState('');

  const [creating, setCreating]     = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  // The raw token lives in component state for exactly one render cycle's worth
  // of user attention and is never persisted, logged, or re-fetchable.
  const [mintedToken, setMintedToken] = useState(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/callSources`),
        orderBy('createdAt', 'desc')
      );
      const [snap, tenantUsers] = await Promise.all([getDocs(q), getTenantUsers(tenantId)]);
      setSources(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setUsers(tenantUsers);
    } catch {
      setError('Failed to load call sources.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const usersById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u])),
    [users]
  );

  const selectedUser = creditUid ? usersById[creditUid] : null;
  // Decision 5: a role change does NOT revoke a link — auto-revoking on
  // promotion would silently stop capture. Warn instead, and let a human decide.
  const creditRoleWarning = selectedUser && selectedUser.role !== 'agent'
    ? `${selectedUser.name ?? 'This user'} is a ${selectedUser.role.replace(/_/g, ' ')}, not an agent. Calls will still be credited to them.`
    : null;

  const canSubmit = sourceApp.trim() && sourceUserId.trim() && creditUid && label.trim() && !creating;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setCreating(true);
    setError(null);
    try {
      const fn = httpsCallable(getFunctions(), 'createCallSource');
      const result = await fn({
        sourceApp: sourceApp.trim(),
        sourceUserId: sourceUserId.trim(),
        creditUid,
        label: label.trim(),
      });
      setMintedToken(result.data.token);
      setSourceUserId('');
      setCreditUid('');
      setLabel('');
      await load();
      showToast({ message: 'Call source created', variant: 'success' });
    } catch (err) {
      setError(err.message || 'Failed to create call source.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (sourceId) => {
    setRevokingId(sourceId);
    setError(null);
    try {
      const fn = httpsCallable(getFunctions(), 'revokeCallSource');
      await fn({ sourceId });
      await load();
      showToast({ message: 'Call source revoked', variant: 'success' });
    } catch (err) {
      setError(err.message || 'Failed to revoke call source.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(mintedToken);
      showToast({ message: 'Token copied', variant: 'success' });
    } catch {
      showToast({ message: 'Copy failed — select and copy manually', variant: 'error' });
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Linked Call Sources</h2>
          <p className="text-ink-muted text-sm mt-1">
            Link an external calling system to an agent. Calls made through a linked
            source count toward that agent&apos;s KPIs. Tokens expire after one year.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="h-11 w-11 shrink-0 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 mb-4 rounded-xl bg-danger/10 border border-danger/20">
          <AlertTriangle size={16} className="text-danger-ink mt-0.5 shrink-0" />
          <p className="text-sm text-danger-ink" data-testid="call-sources-error">{error}</p>
        </div>
      )}

      {/* The one and only time this token is visible. */}
      {mintedToken && (
        <div
          className="p-4 mb-6 rounded-xl bg-warning/10 border border-warning/30"
          data-testid="call-source-token-reveal"
        >
          <div className="flex items-center gap-2 mb-2">
            <KeyRound size={16} className="text-ink" />
            <p className="text-sm font-semibold text-ink">Copy this token now</p>
          </div>
          <p className="text-xs text-ink-muted mb-3">
            This will not be shown again. It is stored only as a hash — if it is lost,
            revoke this source and create a new one.
          </p>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-card-raised text-ink text-xs font-mono break-all"
              data-testid="call-source-token-value"
            >
              {mintedToken}
            </code>
            <button
              type="button"
              onClick={handleCopyToken}
              className="h-11 px-3 shrink-0 rounded-lg border border-border text-ink text-sm font-semibold flex items-center gap-2 hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Copy size={14} />
              Copy
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMintedToken(null)}
            className="mt-3 min-h-[44px] text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
            data-testid="call-source-token-dismiss"
          >
            I&apos;ve saved it — hide
          </button>
        </div>
      )}

      {/* Create */}
      <form onSubmit={handleCreate} className="card flex flex-col gap-4 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">New link</p>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="cs-label">Label</label>
          <input
            id="cs-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Tracy-ann Nurse (assistant)"
            className="h-11 px-3 rounded-lg border border-border bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="cs-credit">Credit calls to</label>
          <select
            id="cs-credit"
            value={creditUid}
            onChange={(e) => setCreditUid(e.target.value)}
            className="h-11 px-3 rounded-lg border border-border bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select an agent…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email ?? u.id}
              </option>
            ))}
          </select>
          {creditRoleWarning && (
            <p className="text-xs text-warning-ink mt-1" data-testid="cs-role-warning">
              {creditRoleWarning}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="cs-app">Source system</label>
          <input
            id="cs-app"
            type="text"
            value={sourceApp}
            onChange={(e) => setSourceApp(e.target.value)}
            placeholder="e.g. kqm-calls"
            className="h-11 px-3 rounded-lg border border-border bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="cs-source-user">
            Caller ID in that system
          </label>
          <input
            id="cs-source-user"
            type="text"
            value={sourceUserId}
            onChange={(e) => setSourceUserId(e.target.value)}
            placeholder="e.g. kqm-user-77"
            className="h-11 px-3 rounded-lg border border-border bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          data-testid="cs-create"
          className="h-11 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          {creating ? 'Creating…' : 'Create link'}
        </button>
      </form>

      {/* List */}
      <div className="card flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Existing links
        </p>

        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : sources.length === 0 ? (
          <p className="text-sm text-ink-muted" data-testid="cs-empty">
            No call sources yet. Create one above to start crediting an assistant&apos;s
            calls to an agent.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sources.map((s) => {
              const revoked = !!s.revokedAt;
              return (
                <li
                  key={s.id}
                  data-testid="cs-row"
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{s.label}</p>
                    <p className="text-xs text-ink-muted truncate">
                      {s.sourceApp} · credits{' '}
                      {usersById[s.creditUid]?.name ?? s.creditUid} · expires{' '}
                      {formatDate(s.expiresAt)}
                    </p>
                  </div>
                  {revoked ? (
                    <span
                      className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full bg-card-raised text-ink-muted"
                      data-testid="cs-revoked-badge"
                    >
                      Revoked
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRevoke(s.id)}
                      disabled={revokingId === s.id}
                      data-testid="cs-revoke"
                      className="shrink-0 min-h-[44px] px-3 rounded-lg border border-danger/40 text-danger-ink text-sm font-semibold inline-flex items-center gap-2 hover:bg-danger/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      {revokingId === s.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

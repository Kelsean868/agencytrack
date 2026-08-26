import React, { useCallback, useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Copy, Trash2, Plus, RefreshCw, AlertTriangle, KeyRound } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-TT', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toMillis(ts) {
  if (!ts) return 0;
  if (ts.toMillis) return ts.toMillis();
  return new Date(ts).getTime();
}

export default function CallSourcesTab() {
  const { tenantId, user } = useAuth();
  const { show: showToast } = useToast();
  const uid = user?.uid;

  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [sourceApp, setSourceApp]       = useState('kqm-calls');
  const [sourceUserId, setSourceUserId] = useState('');
  const [label, setLabel]               = useState('');

  const [creating, setCreating]     = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  // The raw token lives in component state for exactly one render cycle's worth
  // of user attention and is never persisted, logged, or re-fetchable.
  const [mintedToken, setMintedToken] = useState(null);

  const load = useCallback(async () => {
    if (!tenantId || !uid) return;
    setLoading(true);
    setError(null);
    try {
      // The where() is NOT optional and is NOT a nicety — the rules' read arm is
      // `resource.data.creditUid == request.auth.uid`, and Firestore evaluates a
      // list against the query, not the results. An unconstrained list here is
      // denied outright rather than silently filtered. This query and that rule
      // are a matched pair; change one, change both.
      //
      // Deliberately NO orderBy: equality + orderBy on another field needs a
      // composite index, and an agent has a handful of links, not thousands.
      // Sorting client-side keeps this off the index-deploy path entirely.
      const q = query(
        collection(db, `tenants/${tenantId}/callSources`),
        where('creditUid', '==', uid)
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      setSources(rows);
    } catch {
      setError('Failed to load your call sources.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, uid]);

  useEffect(() => { load(); }, [load]);

  const canSubmit = sourceApp.trim() && sourceUserId.trim() && label.trim() && !creating;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setCreating(true);
    setError(null);
    try {
      const fn = httpsCallable(getFunctions(), 'createCallSource');
      // No creditUid: the callable sets it from the verified token, and passing
      // it is a hard rejection. The link always credits the signed-in user.
      const result = await fn({
        sourceApp: sourceApp.trim(),
        sourceUserId: sourceUserId.trim(),
        label: label.trim(),
      });
      setMintedToken(result.data.token);
      setSourceUserId('');
      setLabel('');
      await load();
      showToast({ message: 'Call source attached', variant: 'success' });
    } catch (err) {
      setError(err.message || 'Failed to attach call source.');
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
          <h2 className="text-xl font-semibold text-ink">My Call Sources</h2>
          <p className="text-ink-muted text-sm mt-1">
            Attach your calling software so the calls it makes count toward your
            activity. If an assistant calls on your behalf, attach their profile
            here — the calls still count as yours. Tokens expire after one year.
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
            revoke this source and attach a new one.
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

      {/* Attach */}
      <form onSubmit={handleCreate} className="card flex flex-col gap-4 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Attach a call source
        </p>

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

        <p className="text-xs text-ink-muted" data-testid="cs-self-credit-note">
          Calls from this source are credited to you. You cannot attach a source
          for someone else.
        </p>

        <button
          type="submit"
          disabled={!canSubmit}
          data-testid="cs-create"
          className="h-11 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          {creating ? 'Attaching…' : 'Attach'}
        </button>
      </form>

      {/* List */}
      <div className="card flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Attached sources
        </p>

        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : sources.length === 0 ? (
          <p className="text-sm text-ink-muted" data-testid="cs-empty">
            Nothing attached yet. Attach your calling software above so its calls
            count toward your activity.
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
                      {s.sourceApp} · expires {formatDate(s.expiresAt)}
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

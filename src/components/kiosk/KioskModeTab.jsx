import React, { useCallback, useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Copy, ExternalLink, Trash2, Plus, RefreshCw } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';

const KIOSK_BASE = 'https://agencytrack.vercel.app/kiosk';

function kioskUrl(tenantId, tokenId) {
  return `${KIOSK_BASE}/${tenantId}/${tokenId}`;
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-TT', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function KioskModeTab() {
  const { tenantId } = useAuth();
  const { show: showToast } = useToast();
  const [tokens, setTokens]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError]       = useState(null);

  const loadTokens = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, `tenants/${tenantId}/kioskTokens`),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Only show active (non-revoked) tokens
      setTokens(all.filter((t) => !t.revokedAt));
    } catch {
      setError('Failed to load kiosk tokens.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const fn = httpsCallable(getFunctions(), 'createKioskToken');
      const result = await fn({ branchId: null });
      // Reload to get the new token from Firestore
      await loadTokens();
      // Auto-copy the new URL
      try {
        await navigator.clipboard.writeText(result.data.kioskUrl);
        showToast({ message: 'Kiosk URL generated and copied', variant: 'success' });
      } catch {
        showToast({ message: 'URL generated — copy failed, use the copy button', variant: 'warning' });
      }
      setCopiedId(result.data.tokenId);
      setTimeout(() => setCopiedId(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to create kiosk token.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (tokenId) => {
    setRevokingId(tokenId);
    setError(null);
    try {
      const fn = httpsCallable(getFunctions(), 'revokeKioskToken');
      await fn({ tokenId });
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    } catch (err) {
      setError(err.message || 'Failed to revoke token.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = async (tokenId) => {
    const url = kioskUrl(tenantId, tokenId);
    try {
      await navigator.clipboard.writeText(url);
      showToast({ message: 'Link copied', variant: 'success' });
    } catch {
      showToast({ message: 'Copy failed', variant: 'error' });
    }
    setCopiedId(tokenId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-ink">Kiosk Mode</h2>
          <p className="text-ink-muted text-sm mt-1">
            Generate a secure URL to display the branch performance dashboard on a TV.
            Tokens expire after one year.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadTokens}
            disabled={loading}
            className="h-11 w-11 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || loading}
            className="h-11 px-4 rounded-lg bg-primary text-white text-sm font-semibold flex items-center gap-2 hover:bg-primary-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            {creating ? 'Generating…' : 'Generate URL'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-danger-tint text-danger-ink text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-ink-muted text-sm">Loading…</div>
      )}

      {!loading && tokens.length === 0 && (
        <div className="py-12 text-center text-ink-muted text-sm">
          No active kiosk URLs. Generate one to get started.
        </div>
      )}

      {!loading && tokens.length > 0 && (
        <div className="flex flex-col gap-3">
          {tokens.map((token) => {
            const url = kioskUrl(tenantId, token.id);
            const copied = copiedId === token.id;
            const revoking = revokingId === token.id;
            return (
              <div
                key={token.id}
                className="bg-card border border-card-raised rounded-xl p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-ink text-sm font-mono truncate">{url}</p>
                  <p className="text-ink-muted text-xs mt-1">
                    Created {formatDate(token.createdAt)}
                    {token.expiresAt && ` · Expires ${formatDate(token.expiresAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    aria-label="Copy kiosk URL"
                    type="button"
                    onClick={() => handleCopy(token.id)}
                    title={copied ? 'Copied!' : 'Copy URL'}
                    className="h-11 w-11 rounded-lg flex items-center justify-center text-ink-muted hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Copy size={15} className={copied ? 'text-success-ink' : ''} />
                  </button>
                  <a
                    aria-label="Open kiosk"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open kiosk"
                    className="h-11 w-11 rounded-lg flex items-center justify-center text-ink-muted hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ExternalLink size={15} />
                  </a>
                  <button
                    aria-label="Revoke kiosk URL"
                    type="button"
                    onClick={() => handleRevoke(token.id)}
                    disabled={revoking}
                    title="Revoke URL"
                    className="h-11 w-11 rounded-lg flex items-center justify-center text-ink-muted hover:text-danger hover:bg-danger-tint transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={15} className={revoking ? 'animate-pulse' : ''} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

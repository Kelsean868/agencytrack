import React, { useCallback, useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Copy, ExternalLink, Trash2, Plus, RefreshCw } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';
import { APP_URL } from '../../constants/brand';
import { PANEL_ORDER, PANEL_LABELS } from '../../lib/kiosk/kioskConfig';
import { getKioskConfig, setKioskDisabledPanels } from '../../lib/kiosk/kioskConfigService';

const KIOSK_BASE = `${APP_URL}/kiosk`;

function kioskUrl(tenantId, tokenId) {
  return `${KIOSK_BASE}/${tenantId}/${tokenId}`;
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-TT', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function KioskModeTab() {
  const { tenantId, branchId, user } = useAuth();
  const { show: showToast } = useToast();
  const [tokens, setTokens]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError]       = useState(null);
  // Tier-3 #15: per-branch panel enable/disable. `disabledPanels` holds the
  // keys a manager has turned OFF; a panel is "enabled" when NOT in this list.
  const [disabledPanels, setDisabledPanels] = useState([]);
  const [savingKey, setSavingKey] = useState(null);

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

  // Tier-3 #15: load the branch's saved panel config. A read failure / absent
  // doc degrades to all-enabled ([]), matching the kiosk display's fail-open.
  useEffect(() => {
    if (!tenantId || !branchId) return;
    let cancelled = false;
    getKioskConfig(tenantId, branchId)
      .then((cfg) => { if (!cancelled) setDisabledPanels(cfg.disabledPanels); })
      .catch(() => { /* degrade to all-enabled */ });
    return () => { cancelled = true; };
  }, [tenantId, branchId]);

  const togglePanel = async (key) => {
    if (!branchId || savingKey) return;
    const label = PANEL_LABELS[key] ?? key;
    const wasDisabled = disabledPanels.includes(key);
    const prev = disabledPanels;
    const next = wasDisabled
      ? disabledPanels.filter((k) => k !== key)
      : [...disabledPanels, key];
    // Optimistic update, then persist; revert on failure.
    setDisabledPanels(next);
    setSavingKey(key);
    try {
      await setKioskDisabledPanels(tenantId, branchId, user?.uid, next);
      showToast({
        message: wasDisabled ? `${label} shown on kiosk` : `${label} hidden from kiosk`,
        variant: 'success',
      });
    } catch {
      setDisabledPanels(prev);
      showToast({ message: 'Failed to update panel — try again', variant: 'error' });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-ink">Kiosk Mode</h2>
          <p className="text-ink-muted text-sm mt-1">
            Generate a secure URL to display the branch performance dashboard on a TV.
            Each link pairs with the first screen that opens it and works only there.
            It stays live while that screen uses it at least once every 90 days.
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
            className="h-11 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold flex items-center gap-2 hover:bg-primary-dark dark:hover:bg-primary-dark/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
                    {' · '}
                    <span data-testid={`kiosk-pairing-${token.id}`}>
                      {token.deviceBoundAt ? `Paired ${formatDate(token.deviceBoundAt)}` : 'Not paired yet'}
                    </span>
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
                    aria-label="Open kiosk (pairs this device if the link is not paired yet)"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={token.deviceBoundAt ? 'Open kiosk' : 'Open kiosk — this pairs the link with THIS device'}
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

      {/* Tier-3 #15: per-slide manager enable/disable. Toggling a panel OFF
          persists it into kioskConfig/{branchId}.disabledPanels; the kiosk
          display reads the same doc and skips disabled panels. Panels with no
          data for the week are STILL skipped automatically on top of this.
          Campaign + Celebration panels stay auto (data-driven), so they remain
          read-only status pills. */}
      <section className="mt-10" aria-labelledby="kiosk-panels-heading">
        <h3 id="kiosk-panels-heading" className="text-base font-semibold text-ink">
          Panels shown on the kiosk
        </h3>
        <p className="text-ink-muted text-sm mt-1">
          Toggle which panels the wall rotates through. Panels with no data for
          the week are skipped automatically regardless of this setting.
        </p>
        {!branchId && (
          <p className="mt-3 px-3 py-2 rounded-lg bg-surface-raised text-ink-muted text-sm">
            Panel scheduling is per branch. Your account has no branch assigned,
            so these controls are unavailable.
          </p>
        )}
        <ul className="mt-4 grid grid-cols-2 gap-2">
          {PANEL_ORDER.map((key) => {
            const enabled = !disabledPanels.includes(key);
            const label = PANEL_LABELS[key] ?? key;
            const busy = savingKey === key;
            return (
              <li
                key={key}
                className="flex items-center justify-between bg-card border border-card-raised rounded-lg pl-3 pr-2 py-1"
              >
                <span className="text-ink text-sm">{label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${label} panel — ${enabled ? 'shown, tap to hide' : 'hidden, tap to show'}`}
                  data-testid={`kiosk-panel-toggle-${key}`}
                  disabled={!branchId || busy}
                  onClick={() => togglePanel(key)}
                  className="relative shrink-0 h-11 w-11 flex items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-6 w-10 items-center rounded-full px-0.5 transition-colors ${
                      enabled ? 'bg-primary dark:bg-primary-dark' : 'bg-ink-dim'
                    }`}
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                        enabled ? 'translate-x-4' : 'translate-x-0'
                      } ${busy ? 'animate-pulse' : ''}`}
                    />
                  </span>
                </button>
              </li>
            );
          })}
          <li className="flex items-center justify-between bg-card border border-card-raised rounded-lg px-3 py-2">
            <span className="text-ink text-sm">{PANEL_LABELS.campaignLeaderboards}</span>
            <span className="text-xs font-medium text-ink-muted bg-surface-raised rounded-full px-2 py-0.5">
              When flagged
            </span>
          </li>
          <li className="flex items-center justify-between bg-card border border-card-raised rounded-lg px-3 py-2">
            <span className="text-ink text-sm">{PANEL_LABELS.celebrations}</span>
            <span className="text-xs font-medium text-ink-muted bg-surface-raised rounded-full px-2 py-0.5">
              When any
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}

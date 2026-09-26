/**
 * useLedgerSavedViews — the agent's user-saved Policy Ledger views (L2,
 * docs/briefs/ledger-lens-build.md § L2 item 3). Same idiom as
 * `useLedgerTargetTier`: a module-level session store every mounted consumer
 * shares (so a save on mobile shows immediately if desktop is also open this
 * session), backed by `prefs/app.ledgerSavedViews`. A failed write keeps the
 * in-memory list for the rest of the session (orchestrator decision 1 — no
 * error spam) and logs once in development.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserPrefs, setLedgerSavedViews } from '../services/userPrefsService';

const sessionViews = new Map(); // `${tenantId}:${uid}` -> views[]
const listeners = new Set();
const prefsReads = new Map();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getVersion() { return version; }

function readPrefs(tenantId, uid) {
  const key = `${tenantId}:${uid}`;
  if (!prefsReads.has(key)) {
    const p = getUserPrefs(tenantId, uid).catch((err) => {
      prefsReads.delete(key);
      throw err;
    });
    prefsReads.set(key, p);
  }
  return prefsReads.get(key);
}

/** Test-only: forget every session choice and cached read. */
export function __resetLedgerSavedViewsStore() {
  sessionViews.clear();
  prefsReads.clear();
  emit();
}

export function useLedgerSavedViews() {
  const { tenantId, user } = useAuth();
  const uid = user?.uid ?? null;
  const key = `${tenantId}:${uid}`;
  const [saved, setSaved] = useState(null);

  useSyncExternalStore(subscribe, getVersion, getVersion);

  useEffect(() => {
    if (!tenantId || !uid) return undefined;
    let alive = true;
    readPrefs(tenantId, uid)
      .then((prefs) => {
        const rows = Array.isArray(prefs?.ledgerSavedViews) ? prefs.ledgerSavedViews : [];
        if (alive) setSaved(rows);
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('[useLedgerSavedViews] prefs read failed', err);
      });
    return () => { alive = false; };
  }, [tenantId, uid]);

  const views = useMemo(
    () => (sessionViews.has(key) ? sessionViews.get(key) : (saved ?? [])),
    [key, saved, version], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const persist = useCallback((nextViews) => {
    sessionViews.set(key, nextViews);
    emit();
    if (!tenantId || !uid) return;
    setLedgerSavedViews(tenantId, uid, nextViews).catch((err) => {
      if (import.meta.env.DEV) console.warn('[useLedgerSavedViews] save failed — kept for this session', err);
    });
  }, [key, tenantId, uid]);

  const saveView = useCallback((view) => {
    persist([...views.filter((v) => v.id !== view.id), view]);
  }, [views, persist]);

  const deleteView = useCallback((id) => {
    persist(views.filter((v) => v.id !== id));
  }, [views, persist]);

  return { views, saveView, deleteView };
}

/**
 * useLedgerTargetTier(campaignId) — the agent's "My target tier" for one
 * campaign (Policy Ledger L1, docs/briefs/ledger-lens-build.md § L1 item 2).
 *
 * ONE source for both pickers — the ledger's campaign card and the Campaign
 * screen hero — so they stay in sync:
 *
 *   · Saved:     `prefs/app.ledgerTargetTiers.{campaignId}` (userPrefsService),
 *                read once per session per user.
 *   · Session:   a module-level map every mounted picker subscribes to, so a
 *                change on one screen shows on the other without a reload, and
 *                a choice survives a failed write (offline / rules) for the
 *                rest of the session.
 *
 * Returns `tierName: null` until the agent has chosen; the caller then shows the
 * default (the next tier above current, or the top tier once reached) — which
 * `derivePolicyLens` already resolves when given no tier name.
 *
 * A failed write keeps the in-memory choice and shows no error (orchestrator
 * decision 1); it is logged in development so it never fails silently there.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserPrefs, setLedgerTargetTier } from '../services/userPrefsService';

const sessionChoices = new Map();
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

function getVersion() {
  return version;
}

function readPrefs(tenantId, uid) {
  const key = `${tenantId}:${uid}`;
  if (!prefsReads.has(key)) {
    const p = getUserPrefs(tenantId, uid).catch((err) => {
      prefsReads.delete(key); // let a later mount try again
      throw err;
    });
    prefsReads.set(key, p);
  }
  return prefsReads.get(key);
}

/** Test-only: forget every session choice and cached read. */
export function __resetLedgerTargetTierStore() {
  sessionChoices.clear();
  prefsReads.clear();
  emit();
}

export function useLedgerTargetTier(campaignId) {
  const { tenantId, user } = useAuth();
  const uid = user?.uid ?? null;
  const key = `${tenantId}:${uid}:${campaignId}`;
  const [saved, setSaved] = useState(null);

  useSyncExternalStore(subscribe, getVersion, getVersion);

  useEffect(() => {
    if (!tenantId || !uid || !campaignId) return undefined;
    let alive = true;
    readPrefs(tenantId, uid)
      .then((prefs) => {
        const value = prefs?.ledgerTargetTiers?.[campaignId];
        if (alive) setSaved(typeof value === 'string' && value ? value : null);
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('[useLedgerTargetTier] prefs read failed', err);
      });
    return () => { alive = false; };
  }, [tenantId, uid, campaignId]);

  const setTierName = useCallback((name) => {
    if (!campaignId || typeof name !== 'string' || !name) return;
    sessionChoices.set(key, name);
    emit();
    if (!tenantId || !uid) return;
    setLedgerTargetTier(tenantId, uid, campaignId, name).catch((err) => {
      if (import.meta.env.DEV) console.warn('[useLedgerTargetTier] save failed — kept for this session', err);
    });
  }, [key, tenantId, uid, campaignId]);

  const tierName = sessionChoices.has(key) ? sessionChoices.get(key) : saved;
  return { tierName, setTierName };
}

import { useState, useEffect, useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// useFrequentNav — device-local "most-visited" tracker for the mobile More sheet.
//
// The redesign spec (redesign-addendum §3) requires the More sheet to carry an
// auto **Frequent** row alongside the ★ Pinned row. This hook counts activeTab
// visits per user and returns the top-N most-visited destinations resolvable in
// the current role nav.
//
// Persistence is **localStorage-only** — deliberately NOT Firestore-synced like
// usePinnedNav. A Firestore write on every navigation would be far too chatty and
// would need a new write path/rules; nav frequency is also inherently a
// per-device signal, so a device-local counter is the right model. Key is
// namespaced per-user (`agencytrack-frequent-nav:{uid}`) so counts never bleed
// across accounts on a shared browser (mirrors the usePinnedNav mirror key).
//
// State binds the counts to the scopeId they belong to ({ scopeId, counts }) so
// the persist effect always writes to the correct key even across a user switch —
// and the state updaters stay side-effect-free (persistence lives in its own
// effect), honoring React's "updaters must be pure" contract.
// ─────────────────────────────────────────────────────────────────────────────

export const FREQUENT_KEY_PREFIX = 'agencytrack-frequent-nav';
export const frequentKey = (scopeId) => `${FREQUENT_KEY_PREFIX}:${scopeId}`;

function readCounts(scopeId) {
  if (!scopeId) return {};
  try {
    const raw = localStorage.getItem(frequentKey(scopeId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function writeCounts(scopeId, counts) {
  if (!scopeId) return;
  try { localStorage.setItem(frequentKey(scopeId), JSON.stringify(counts)); } catch { /* quota / disabled — ignore */ }
}

/**
 * @param {{
 *   scopeId?: string,          // per-user key (uid). Falsy → tracking disabled.
 *   activeTab?: string,        // current tabId; each change is counted as a visit.
 *   navItems?: Array,          // resolved role nav (descriptor source, by tabId).
 *   excludeTabIds?: string[],  // tabIds already surfaced elsewhere (bottom nav, pinned).
 *   limit?: number,            // max Frequent rows (default 3).
 * }} params
 * @returns {Array} top-N most-visited nav descriptors (may be empty).
 */
export default function useFrequentNav({
  scopeId, activeTab, navItems = [], excludeTabIds = [], limit = 3,
}) {
  // counts are bound to the scope they were read for — so a mid-session user
  // switch can never persist one user's counts under another's key.
  const [state, setState] = useState(() => ({ scopeId, counts: readCounts(scopeId) }));

  // Re-sync when the active user changes (shared browser).
  useEffect(() => {
    setState({ scopeId, counts: readCounts(scopeId) });
  }, [scopeId]);

  // Count each navigation — pure updater (safe under Strict/concurrent double-invoke).
  // The scope guard drops the increment on the transient render where scopeId has
  // changed but the re-sync effect hasn't run yet.
  useEffect(() => {
    if (!scopeId || !activeTab) return;
    setState((prev) => {
      if (prev.scopeId !== scopeId) return prev;
      return { scopeId, counts: { ...prev.counts, [activeTab]: (prev.counts[activeTab] ?? 0) + 1 } };
    });
  }, [scopeId, activeTab]);

  // Persistence as a dedicated side effect — always targets the scope the counts
  // belong to (state.scopeId), never the render-time scopeId.
  useEffect(() => {
    if (!state.scopeId) return;
    writeCounts(state.scopeId, state.counts);
  }, [state]);

  // Stable exclude key so the memo doesn't rerun on a fresh-but-equal array.
  const excludeKey = (excludeTabIds ?? []).join('|');

  return useMemo(() => {
    const exclude = new Set(excludeKey ? excludeKey.split('|') : []);
    const byTab = new Map((navItems ?? []).filter((i) => i?.tabId).map((i) => [i.tabId, i]));
    return Object.entries(state.counts)
      .filter(([tabId, n]) => n > 0 && byTab.has(tabId) && !exclude.has(tabId))
      .sort((a, b) => b[1] - a[1])
      .map(([tabId]) => byTab.get(tabId))
      .filter((item) => item && item.disabled !== true)
      .slice(0, limit);
  }, [state, navItems, excludeKey, limit]);
}

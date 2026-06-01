/**
 * useLeaderboardScope — per-user leaderboard scope state with localStorage
 * persistence (mirrors the per-UID dark-mode / sidebar-collapsed / tenantId
 * pattern in src/main.jsx + src/context/AuthContext.jsx).
 *
 * Storage key: `agencytrack-leaderboard-scope-{uid}` →
 *   JSON.stringify({ scope: 'branch' | 'unit', targetUnitId: string | null })
 *
 * Defaults: scope = 'branch', targetUnitId = null. The default is the
 * brief-locked choice (MyBranch out-of-the-box for managers) — fresh
 * managers see the wider view first, then opt into a unit.
 *
 * Invariants the hook enforces (defensive — bad cached state must not blow
 * the consumer up):
 *   - When `targetUnitId` is missing OR no longer present in
 *     `availableUnitIds`, we fall back to scope='branch' even if the
 *     persisted value said 'unit'. This survives a manager moving units
 *     (their persisted unitId becomes stale → fallback to branch).
 *   - When `role` is 'agent' (or anything that's not UM/BM), scope is
 *     forced to 'branch' regardless of persistence (the control isn't
 *     rendered for agents, but we still want the resolver to read 'branch'
 *     for safety).
 *
 * The control component (`LeaderboardScopeControl`) consumes the setter to
 * persist user choices; the surface consumes `scope` + `targetUnitId` to
 * feed `applyScope()` in `src/lib/leaderboard/scopeFilter.js`.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'agencytrack-leaderboard-scope-';

function storageKey(uid) {
  return uid ? `${STORAGE_PREFIX}${uid}` : null;
}

function readPersisted(uid) {
  const key = storageKey(uid);
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      scope:         parsed.scope === 'unit' ? 'unit' : 'branch',
      targetUnitId:  typeof parsed.targetUnitId === 'string' ? parsed.targetUnitId : null,
    };
  } catch {
    return null;
  }
}

function writePersisted(uid, value) {
  const key = storageKey(uid);
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded / private mode — ignore; in-memory state still works.
  }
}

/**
 * Track J P5b: `effectiveRole` lets SM (head of sales) borrow BM-style scope
 * semantics inside the branch picker. When the SM container passes
 * `effectiveRole: 'branch_manager'`, the invariants below treat the SM the
 * same as a BM (scope can be 'unit' tied to a unit in `availableUnitIds`,
 * else falls back to 'branch'). `role` still governs storage / UI gating
 * upstream — `effectiveRole` is purely the scope state's view of the user.
 */
export default function useLeaderboardScope({ uid, role, availableUnitIds, effectiveRole }) {
  const scopeRole = effectiveRole ?? role;
  // The default state is { scope: 'branch', targetUnitId: null }. We
  // rehydrate from localStorage on mount (and on uid change — a different
  // signed-in user has a different persisted preference).
  const [scope, setScope]                 = useState('branch');
  const [targetUnitId, setTargetUnitId]   = useState(null);

  // Rehydrate on uid change (covers initial mount + signed-in user swap).
  useEffect(() => {
    const persisted = readPersisted(uid);
    if (persisted) {
      setScope(persisted.scope);
      setTargetUnitId(persisted.targetUnitId);
    } else {
      setScope('branch');
      setTargetUnitId(null);
    }
  }, [uid]);

  // Persist on every change (after the initial rehydrate).
  const setBoth = useCallback(
    (nextScope, nextUnitId) => {
      setScope(nextScope);
      setTargetUnitId(nextUnitId);
      writePersisted(uid, { scope: nextScope, targetUnitId: nextUnitId });
    },
    [uid]
  );

  // Convenience setters the UI uses directly. Both round-trip through setBoth
  // so persistence stays in one place.
  const selectBranch = useCallback(() => setBoth('branch', null), [setBoth]);
  const selectUnit   = useCallback((unitId) => setBoth('unit', unitId), [setBoth]);

  // ── Apply invariants AFTER rehydrate (memoized derived state, not direct
  //    setState — avoids spurious re-renders + lets the consumer see the
  //    "safe" view of scope state regardless of cache shape). ────────────────
  let effectiveScope        = scope;
  let effectiveTargetUnitId = targetUnitId;

  // Agents (and any role outside UM/BM under the effectiveRole view) never
  // get a scope — force branch.
  if (scopeRole !== 'unit_manager' && scopeRole !== 'branch_manager') {
    effectiveScope        = 'branch';
    effectiveTargetUnitId = null;
  }

  // If the persisted unit is no longer in `availableUnitIds`, fall back to
  // branch. (availableUnitIds is null/undefined-tolerant: if not provided,
  // we don't apply this check.)
  if (
    effectiveScope === 'unit' &&
    Array.isArray(availableUnitIds) &&
    availableUnitIds.length > 0 &&
    (effectiveTargetUnitId == null || !availableUnitIds.includes(effectiveTargetUnitId))
  ) {
    effectiveScope        = 'branch';
    effectiveTargetUnitId = null;
  }

  return {
    scope:        effectiveScope,
    targetUnitId: effectiveTargetUnitId,
    selectBranch,
    selectUnit,
  };
}

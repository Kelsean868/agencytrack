/**
 * Track J P5b — SM (sales_manager / head-of-sales) leaderboard container.
 *
 * What this does:
 *   • Enumerates every active branch in the tenant via branchService.listBranches().
 *   • Persists the SM's last-picked branch under
 *     `agencytrack-sm-leaderboard-branch-{uid}` so revisits restore the
 *     previous selection (mirrors the P5a per-UID localStorage pattern).
 *   • Defaults to the first branch on first use — no forced "select a branch"
 *     empty-state, no dead-end.
 *   • Renders `<ProductionLeaderboardSurface branchIdOverride scopeRoleOverride='branch_manager'>`
 *     so the surface reads `leaderboards/{pickedBranchId}` AND the inner
 *     scope control + scope state behave BM-style (My Branch chip + the P5a
 *     unit-picker scoped to the picked branch's loaded ranking).
 *
 * Why this lives outside ProductionLeaderboardSurface:
 *   The surface is reusable by agents (no override), UM/BM (own branch), and
 *   SM (picked branch). Wrapping rather than embedding the picker keeps the
 *   surface single-purpose and lets us mount the same component for every
 *   role from `ManagerDashboard`.
 *
 * Backend invariants relied on:
 *   • `branches/{branchId}` rule: `allow read: if isSignedIn() && getTenantId() == tenantId`
 *     (firestore.rules) — SM can list branches in own tenant. No change.
 *   • `leaderboards/{branchId}` rule: managers-in-tenant can read any branch
 *     (canManage covers SM). No change.
 *
 * Cleanup parked: removing `gamification/Leaderboard` (the points-board
 * component) once no role mounts it; PA still falls into that arm in
 * `ManagerDashboard`, so the import is intentionally retained for now.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listBranches } from '../../services/branchService';
import ProductionLeaderboardSurface from './ProductionLeaderboardSurface';

const STORAGE_PREFIX = 'agencytrack-sm-leaderboard-branch-';

function storageKey(uid) {
  return uid ? `${STORAGE_PREFIX}${uid}` : null;
}

function readPersisted(uid) {
  const key = storageKey(uid);
  if (!key || typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

function writePersisted(uid, branchId) {
  const key = storageKey(uid);
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(branchId));
  } catch {
    // Quota / private mode — fall back to in-memory state.
  }
}

function sortByName(a, b) {
  const an = String(a?.name ?? '').toLowerCase();
  const bn = String(b?.name ?? '').toLowerCase();
  if (an < bn) return -1;
  if (an > bn) return  1;
  return 0;
}

export default function SmLeaderboardView() {
  const { tenantId, user } = useAuth();
  const uid = user?.uid ?? null;

  const [branches, setBranches]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState(null);
  const [pickedId, setPickedId]   = useState(null);

  // ── Load every ACTIVE branch in the tenant, sorted by name ────────────────
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const all = await listBranches(tenantId);
        if (cancelled) return;
        const active = all.filter((b) => b.isActive !== false).sort(sortByName);
        setBranches(active);

        // Resolve initial selection: persisted-if-still-active, else first.
        const persisted = readPersisted(uid);
        const persistedHit = active.find((b) => b.id === persisted);
        const initial = persistedHit ? persistedHit.id : (active[0]?.id ?? null);
        setPickedId(initial);
        // If we DIDN'T have a persisted hit but did default, persist it so a
        // reload restores the same default rather than re-rolling. No-op if
        // initial is null.
        if (uid && initial && persisted !== initial) {
          writePersisted(uid, initial);
        }
      } catch (err) {
        if (cancelled) return;
        setError({
          code:    err?.code    ?? 'unknown',
          message: err?.message ?? 'Failed to load branches',
        });
        setBranches([]);
        setPickedId(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tenantId, uid]);

  const selectBranch = useCallback(
    (id) => {
      setPickedId(id);
      writePersisted(uid, id);
    },
    [uid]
  );

  const pickedBranch = useMemo(
    () => branches.find((b) => b.id === pickedId) ?? null,
    [branches, pickedId]
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-4" data-testid="sm-leaderboard-loading">
        <div className="h-10 rounded-xl bg-surface-muted animate-pulse w-64" />
        <div className="h-14 rounded-xl bg-surface-muted animate-pulse" />
        <div className="h-14 rounded-xl bg-surface-muted animate-pulse" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="card flex flex-col items-center text-center py-12" data-testid="sm-leaderboard-error">
        <p className="text-base font-bold font-display text-ink">
          Couldn't load branches
        </p>
        <p className="mt-1.5 text-sm text-ink-muted">
          Try again in a moment — the branch list is fetched on every visit.
        </p>
      </div>
    );
  }

  // ── No branches in tenant (e.g. C1 not yet seeded for this tenant) ────────
  if (branches.length === 0) {
    return (
      <div className="card flex flex-col items-center text-center py-12" data-testid="sm-leaderboard-empty">
        <p className="text-base font-bold font-display text-ink">
          No branches in this tenant yet
        </p>
        <p className="mt-1.5 text-sm text-ink-muted">
          Once a tenant admin adds branches, you'll be able to pick between them here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-testid="sm-leaderboard-view">
      {/* Branch picker row — sits ABOVE the production surface. Native
          <select> for keyboard + screen-reader parity (mirrors the BM
          unit-picker treatment so the visual grammar is consistent). */}
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
        data-testid="sm-leaderboard-branch-picker-row"
      >
        <label
          className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-ink-muted"
          data-testid="sm-leaderboard-branch-picker-label"
        >
          <Building2 size={12} aria-hidden="true" />
          Branch
          <select
            data-testid="sm-leaderboard-branch-picker"
            data-value={pickedId ?? ''}
            aria-label="Pick a branch"
            value={pickedId ?? ''}
            onChange={(e) => selectBranch(e.target.value)}
            className="text-xs font-bold font-mono uppercase tracking-widest bg-card border border-border rounded-lg px-2 py-1.5 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <p
          className="text-[10.5px] font-mono uppercase tracking-widest text-ink-muted"
          data-testid="sm-leaderboard-branch-picker-count"
        >
          {branches.length} branch{branches.length === 1 ? '' : 'es'} · all branches
        </p>
      </div>

      {/* Production surface — reads leaderboards/{pickedId} via the
          branchIdOverride; scopeRoleOverride='branch_manager' enables the
          BM-style MyBranch chip + unit-picker within the picked branch. */}
      <ProductionLeaderboardSurface
        branchIdOverride={pickedId ?? undefined}
        scopeRoleOverride="branch_manager"
        overrideBranchName={pickedBranch?.name ?? undefined}
      />
    </div>
  );
}

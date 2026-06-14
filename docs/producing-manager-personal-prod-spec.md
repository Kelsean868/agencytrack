# Producing-Manager Personal Production — Feature Spec

**Status:** Recon complete. Product call required before implementation.
**Date:** 2026-06-14
**Scope:** `isProducingManager` flag UI + `personalApi` aggregation pipeline

---

## 1. Background

All Tatil Life managers are producing managers — they sell insurance personally in
addition to managing their team. The WAR form (Track I) already captures
`personalApi` + `personalApps` fields, but they are orphaned: no downstream
pipeline consumes them, and there is no UI to enable the feature per-manager.

## 2. What is already built (do not re-implement)

| Component | Location | Status |
|-----------|----------|--------|
| WAR form fields `personalApi` / `personalApps` | `ManagerWarTab.jsx:302-320` | Shipped — gated by `isProducingManager` |
| `sanitizeWar` personal-production branch | `managerWarService.js:45-50` | Shipped |
| `isProducingManager` read from `userProfile` | `ManagerWarTab.jsx:48` | Shipped |
| Field stored to `managerWeeklyReports/{id}` | `managerWarService.js:78-95` | Shipped |
| Tests for include/omit behavior | `managerWarService.test.js:155-170` | Shipped |

The `isProducingManager` flag on the user doc (`tenants/{tid}/users/{uid}`) is the
sole gate. When `false` (default), personal-production panel is hidden and fields
are omitted from the WAR document.

## 3. What is missing

### 3a. `isProducingManager` toggle UI

No user-facing control exists to set the flag. Enabling personal production for a
manager currently requires a direct Firestore write. Since all Tatil managers
produce, this blocks the feature for the pilot.

**Proposed:** Add a boolean toggle to the Edit User form (UserManagementPanel /
EditUserModal) writable by `tenant_admin` and `branch_manager`. The flag is stored
on the user doc at `tenants/{tid}/users/{uid}.isProducingManager`.

Files affected: `UserManagementPanel.jsx`, `EditUserModal.jsx` (or equivalent),
`userService.js` (ensure field is persisted).

### 3b. `personalApi` downstream pipeline — PRODUCT CALL REQUIRED

`personalApi` / `personalApps` from WAR docs are never read by any surface. The
options are:

| Option | Description | Trade-offs |
|--------|-------------|------------|
| **A — Branch rollup only** | Producing manager's personalApi added to branch production totals in leaderboard aggregate | Simple; accurate total branch API; managers appear in branch stats but not individual agent leaderboard |
| **B — Agent leaderboard mixed** | Manager's WAR personalApi surfaced alongside agent submissions in the production leaderboard | Shows unified individual ranking; risk of accountability confusion (manager + agent rows mixed) |
| **C — Separate manager production board** | A new surface on ManagerDashboard showing producing managers' personal YTD API / Apps | Maximum isolation; requires new UI surface and aggregation query |
| **D — Manager personal dashboard only** | personalApi shows on the manager's OWN dashboard/WAR history; no rollup into branch totals | Lowest risk; no leaderboard/aggregate changes; manager can self-monitor |

**Kyron's call required before implementation.** Option D (dashboard-only) is the
lowest-risk initial slice and reversible; Options A–C add aggregate complexity.

## 4. Data model (existing, no changes needed)

```
tenants/{tid}/users/{uid}
  isProducingManager: boolean   ← gate flag (currently set only via Firestore)

tenants/{tid}/managerWeeklyReports/{managerId}_{weekStarting}
  personalApi: number           ← TTD, omitted when isProducingManager=false
  personalApps: number          ← count, omitted when isProducingManager=false
```

No new collections needed for 3a. New indexes/aggregation collections may be
needed for 3b depending on the option chosen.

## 5. Implementation order

1. **3a first** — `isProducingManager` toggle UI (mechanical, no product call needed).
   Unlocks personal-production panel for pilot managers immediately.
2. **3b after Kyron's decision** — once the downstream pipeline option is chosen,
   implement aggregation. Do not speculate on the design.

## 6. Out of scope

- Manager submitting via the agent wizard (WizardForm) — not the right surface.
  Personal production is captured in WAR, not `submissions/`.
- Multi-year historical backfill of personalApi — pilot concern only.
- `isProducingManager` on agent-role users — only meaningful for manager roles.

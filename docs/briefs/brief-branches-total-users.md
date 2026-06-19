# Brief — Branches table: total users per branch (with role breakdown)

**Size:** XS
**Merge:** HUMAN-MERGE (count-semantics change visible to admins)
**Stacks on:** `main`
**Deploy:** none (pure client display; Vercel auto-deploys)

---

## 1. Goal

The Tenant Admin **Branches** table shows "N agents" per branch. It should show the **total number of users** in each branch (all roles), with a compact per-role breakdown.

---

## 2. Locked decisions

1. **Headline count = total active users with `branchId === branch.id`** — drop the `role === 'agent'` filter. Active-only, mirroring the current behavior. (Counting deactivated users is a separate tweak, not in this PR.)
2. **Column header `AGENTS` → `USERS`** (or `MEMBERS`).
3. **Role breakdown shown compactly** — the total plus a secondary line or tooltip, e.g. `9 · 5 agents, 2 UM, 1 BM, 1 SM`. Derived from the already-loaded `getAllUsers` — no new query.
4. **No new query, no rules change, no denormalized counter.** Pure client display change over data `BranchesPanel` already loads.

---

## 3. Phase 0 — recon + gates (STOP and report on any gate)

1. **Confirm the mechanism.** `src/components/admin/BranchesPanel.jsx` loads `Promise.all([listBranches, getBranchManagers, getAllUsers])` on mount; per its own header doc the per-row count is active users with `role === 'agent'` && `branchId === thisBranchId`. Verify this live (the snapshot is ~#668-era).
2. **GATE — do non-agent roles carry `branchId`?** Confirm UM / BM / SM users have `branchId` set to their branch, so a `branchId`-based total captures them. **If a branch's assigned manager (`branches/{id}.managerId`) does NOT have `branchId === that branch`** — so counting by `branchId` would still exclude the manager — STOP and report. "Total users in a branch" then needs a definition call (branchId-members only, vs. also folding in the assigned `managerId`); do not guess.
3. Identify the test file (`src/components/admin/__tests__/BranchesPanel.test.jsx`), the row-render path, and the column header for the edits.

---

## 4. Phase 1 — build

1. Change the per-row count to **all active users with `branchId === branch.id`** (remove the role filter).
2. Rename the column header.
3. Compute and render the per-role breakdown (group the branch's users by role). Compact presentation, both themes, Nexus tokens. Add a `data-testid` on the count for the smoke.
4. Empty branch → `0 users`, no crash.

## 5. Phase 2 — tests

Extend `BranchesPanel.test.jsx`: total includes non-agent roles; the breakdown is correct; an empty branch shows 0; deactivated users excluded (active-only).

## 6. Phase 3 — verify

Lint, the affected suite, build all green.

## 7. Phase 4 — docs (with placeholders)

1. `docs/CONTEXT.md` per Rule 16 (respect the size caps; shed oldest as you prepend).
2. Leave `#TBD`/`{TBD}` placeholders for PR# + squash SHA.

## 8. Phase 5 — commit / push / PR

1. Branch off `main`; commit fix + tests + docs.
2. Open the PR, report feature-branch HEAD SHA (Rule 20), poll CI + Gemini and disposition each (Rule 21).
3. **HOLD for human review** (Rule 19).

---

## 9. Acceptance / smoke

Production smoke via `setupBypassSession`, both themes, axe no-new. The bar is that the count now includes non-agent roles — not just that the label changed.

1. Log in as `A11Y_TENANT_ADMIN`, open **Branches**.
2. Find `smoke_branch` (it carries mixed roles — at least the smoke agent plus a branch manager). Assert its user count is **greater than the agent-only count** — i.e., it includes the non-agent member(s) — and that the role breakdown renders. Read via the `data-testid` hook.
3. Both themes; axe no new serious/critical vs main.

If the smoke tenant's branches don't carry a mix of roles that makes total > agents observable, report it and fall back to the Phase 2 component-test proof.

---

## 10. Out of scope

- Counting deactivated users.
- Changing how `branchId` is assigned to users.
- The `managerId`-vs-`branchId` membership question (if the Phase 0 gate trips, that's a separate decision, not this PR).

## 11. Risks / falsification

- **Silent undercount.** If non-agent roles don't carry `branchId`, the new "total" quietly equals agents (+ UMs) and still omits BMs/SMs. Falsifier: a branch with a known branch manager shows a total that doesn't include that manager. The Phase 0 gate guards it; the `smoke_branch` smoke (which has a BM) tests it directly.

# AgencyTrack Session Kickoff — Track C PR C1 (Branches Schema + Tenant Admin Management UI)

> **For Kyron:** This is the prompt to paste into a fresh Claude Code session to start PR C1. Copy from the line below all the way down. The prompt is self-contained — Claude Code will read the right files and produce a plan before writing any code.
>
> **C1 is the first PR of Track C.** Track B (v2) closed with B5. Track C bridges "code shipped" → "real Tatil pilot agents using real data." C1 is the foundation: branches as a real Firestore collection, with a tenant-admin management UI on top. Smaller surface than B5 in line count, but introduces a NEW Firestore path (`tenants/{tid}/meta/branches/{branchId}`), so security rules + write-path discipline matter as much per line of code as B5 did.
>
> When C1 ships, C2 (bulk user import) unblocks. C3 (goals seeding) follows.

---

## ✂ COPY FROM HERE ✂

# AgencyTrack Session Kickoff — Track C PR C1 (Branches Schema + Tenant Admin Management UI)

## Step 0 — Read these in order, do not skip
1. `CLAUDE.md` — static project rules (code style, domain rules, theme system, workflow). Pay special attention to: post-merge protocol (steps 9 and 9.5); the `git branch -D` rule; the docs-only-PR untracked-doc collision pattern; and the single-branch PR rule.
2. `docs/CONTEXT.md` — current state, locked decisions, active follow-ups. **CONTEXT.md overrides CLAUDE.md where they differ — it's newer.**
3. `docs/track-c-implementation.md` § PR C1 — the canonical scope, files (starting hypotheses), schema, acceptance criteria, and out-of-scope list for this PR. Read fully. Treat the file listing as starting hypotheses, not directives (B-series retrospective lesson).
4. `docs/design-v2-PRD.md` — confirm the tenant-admin surfaces post-B5 and the per-role nav matrix. Skim § "Tenant Admin" and § "Cross-cutting (sidebar nav shell)."
5. `mocks/concept-4-complete.html` — the mock has a tenant-admin sidebar item "Branches" at `mocks/concept-4-complete.html:1839` and a read-only "Branch overview" card at lines 2026-2047 (Port of Spain / San Fernando / Tobago with health pills). **There is no full management UI in the mock** — C1 designs the management surface from first principles using B5's tile-and-modal patterns. Confirm this finding during audit; if a fuller surface design exists somewhere in the mock that I missed, surface it as a discovery.
6. `firestore.rules` — current state. Specifically read the `match /tenants/{tenantId}` block, the existing `match /meta/{docId}` block (lines 54-56, currently `allow write: if false`), and the B5-shipped `match /config/{docId}` block (lines 119+) for the tenant-scope guard pattern.
7. `src/services/agentManagementService.js` and `src/services/userService.js` — confirm the existing branch-derivation pattern (per `docs/FOLLOW_UPS.md` § "Branches Management UI" — branches today are derived from user docs, not a separate collection). C1's read paths must NOT regress this until the new collection is populated.
8. **B-series retrospectives + the latest entries in `docs/CONTEXT.md` § Where we left off.** Four lessons apply directly:
   - Speculative file listings in the implementation plan are **starting hypotheses, not directives**.
   - Mock-vs-code surface-gap audit before any code.
   - Honest data-availability check — don't fabricate routes, accounts, or data.
   - Implement the mock faithfully — do not redesign mid-flight. Where the mock is silent (as on the C1 management UI), reuse the most recent matching pattern (B5's tile-and-modal) rather than inventing a new aesthetic.

## Step 1 — Tree state verification (do this before anything else)

```bash
git fetch origin
git status
git log origin/main --oneline -3
git worktree list
```

Working tree must be clean. `origin/main` HEAD must match the SHA in `docs/CONTEXT.md` § Current main HEAD. If either fails: STOP, surface in chat, do not absorb the discrepancy.

## Session scope

**In scope (PR C1 only):**

- **Branches Firestore collection.** New path: `tenants/{tenantId}/meta/branches/{branchId}`. Schema per `docs/track-c-implementation.md` § PR C1 § Schema (locked).
- **Tenant Admin Branches Panel** (list view). Sorted active-first then `createdAt` desc. Inactive rows visually de-emphasised with "Inactive" pill. Row actions: Edit, Deactivate / Reactivate.
- **Branch Editor Modal** (create + edit). Lifts B5's `EditConfigModal` patterns: focus trap, Escape, return-focus, reduced-motion guards, `role="dialog"`, `aria-modal`, save-disabled-during-write. Form fields: `name` (required, trimmed, ≤ 100 chars), `managerId` (optional dropdown of active branch_manager users in tenant + "Unassigned" option).
- **`branchService.js`** — `listBranches`, `getBranch`, `createBranch`, `updateBranch`, `deactivateBranch`, `reactivateBranch`. Pure service layer; never reads from `users` collection.
- **Sidebar item upgrade.** The "Branches" sidebar item shipped as a stub in B5 (per `mocks/concept-4-complete.html:1839`) becomes a real link routing to `<BranchesPanel />`.
- **Backwards compatibility.** Existing dashboards (branch_manager, sales_manager, agent surfaces) must continue to render correctly when the new collection is empty for a tenant. Read paths fall back to the current user-doc-derived branch list. C1 does NOT migrate read paths — that's a separate ticket.
- **Firestore rules.** New `match /meta/branches/{branchId}` block. Read = any signed-in user in tenant. Write = `tenant_admin` OR `platform_admin` with tenant-scope guard absorbed (per B5 lesson). Emulator regression test analogous to B5's `scripts/test-b5-config-rule.js` — proposed file: `scripts/test-c1-branches-rule.js`.

**Out of scope (do not expand into):**

- User-management changes (PR-4 Edit-user flows in `docs/FOLLOW_UPS.md` — separate ticket).
- Goals seeding (C3 scope).
- Bulk operations / CSV import (C2 scope).
- Hard delete of branches.
- Unit hierarchy modeling.
- Branch-manager assignment uniqueness validation (audit-phase decision; default = no validation in C1).
- Migration of existing `user.branchId` string values to new collection IDs.
- Sidebar shell or chrome changes beyond linking the existing "Branches" item.
- Notification drawer redesign.
- Any new routing library.
- Any chrome layout changes.
- Phase 9 Sales Manager Target layer.

## Decisions locked — do not re-litigate

These are settled before the session starts. If the audit surfaces a reason to revisit, treat it as a surprise-stop — do not unilaterally override.

### Schema
- **Path:** `tenants/{tenantId}/meta/branches/{branchId}`
- **Fields:**
  - `name` — string, required, trimmed, non-empty, ≤ 100 chars
  - `managerId` — string \| null. References a `branch_manager` UID in the same tenant. `null` = "Unassigned"
  - `isActive` — boolean. Default `true` on create. Soft-delete sets to `false`
  - `createdAt` — `serverTimestamp()` on create. Never updated
  - `updatedAt` — `serverTimestamp()` on every write (including reactivation)
  - `updatedBy` — string. UID of the writer. Required on every write
- **`branchId`** — auto-generated by Firestore's `add()`. Opaque random string, not human-readable. Display field is always `name`.

### Permissions (mirror B5 `companyMinimums` pattern)
- **Read:** any signed-in user in the tenant — `isSignedIn() && getTenantId() == tenantId`
- **Write:** `tenant_admin` OR `platform_admin` (with platform_admin tenant-scope guard absorbed, per B5 lesson — even though platform_admin is cross-tenant by design, they must be writing into a specific tenant's path)
- **Data shape validation in rules:** validation that `name` is a non-empty string and `isActive` is a boolean is **deferred** per B5 lesson. Tightening rules-level data-shape coupling makes the rules fragile against schema additions. Client-side validation handles shape; rules handle access.

### UI behavior
- List sorted by `isActive` desc, then `createdAt` desc
- Inactive branches: reduced opacity + "Inactive" pill + Reactivate action (no separate filter to toggle visibility — they always show, just de-emphasised)
- "Add Branch" CTA opens `<BranchEditorModal>` in create mode
- Per-row "Edit" opens `<BranchEditorModal>` in edit mode, pre-seeded with current values from a fresh read (no stale data)
- Per-row "Deactivate" / "Reactivate" toggles `isActive` (inline confirm pattern — single-click button with confirmation copy in tooltip / disclosure, not a separate modal). Audit-phase decision can refine if Kyron prefers a confirmation modal.
- **Empty state:** "No branches yet. Click **Add Branch** to create your first branch."

### Modal behavior (lift from B5 EditConfigModal pattern)
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing at modal heading
- First focusable receives focus on open
- Tab / Shift+Tab cycle within modal
- Escape cancels and closes
- Returns focus to the trigger button on close
- Reduced-motion guards on open/close animation
- Save button disables during write; modal closes only on success
- On error, modal stays open and surfaces a specific error message (no optimistic UI)

### Validation (client-side, NOT mirrored at rules level per data-shape decision above)
- `name` — required, trimmed, non-empty, ≤ 100 chars (audit-phase confirms max — surface if mock or PRD implies different). Tenant-unique recommended (audit-phase decision: enforce in service layer via list-then-check, or skip and let admins handle dupes).
- `managerId` — dropdown of active `branch_manager` users in the tenant. "Unassigned" option always available.

### Token naming
- All new tokens use `--color-*` prefix (B-series locked)
- Update both `:root` and `.dark` blocks together
- Reuse existing semantic tokens where possible (`--color-surface`, `--color-text`, `--color-text-muted`, `--color-primary`, `--color-border`)

### A11y — bake in from the start
- **Form labels:** every input has a `<label>` (not just `aria-label`)
- **Validation errors:** `aria-invalid="true"` on the field + error text in `aria-live="polite"` region
- **Modal a11y:** focus trap + Escape + return focus + `role="dialog"` + `aria-modal` + `aria-labelledby`
- **Reduced-motion guards** on all modal animations
- **Keyboard:** every interactive element keyboard-reachable in DOM order; focus rings visible (`focus-visible:ring-2 focus-visible:ring-primary/40` per existing pattern)
- **Color contrast:** Save button states (active, disabled, error), inactive-pill, list-row hover — all ≥ 4.5:1 in both modes
- **Heading hierarchy:** Tenant Admin dashboard `<h1>` → section `<h2>` → tile/card `<h3>`. No skips. Confirm B4's shell-level heading structure isn't disrupted.

### Project-wide policy (recap)
- Lucide React for icons. No emojis as structural icons.
- No hardcoded hex outside CSS variables (except `AgentReportDocument.jsx`).
- Both light and dark mode tested before opening PR.
- Verification artifacts stay local — never commit.
- All numeric fields (none in C1, but pattern recap) — `parseFloat` enforced.
- `serverTimestamp()` for `createdAt` / `updatedAt`.

Plus everything in `docs/CONTEXT.md` § Locked decisions.

### Banked items landing in C1's first commit (single docs commit, conventional title)

C1's first commit bundles the following banked items in addition to the standard CONTEXT.md SHA bump:

1. **CONTEXT.md SHA bump** — standard B-series first-commit protocol; carried into Track C.
2. **CLAUDE.md prune-step addition** (banked from PR #57 cleanup) — document `git remote prune origin` (or `git fetch --prune`) in the post-merge sequence (CLAUDE.md § Session Protocol step 9.5). The prune step keeps stale remote refs from accumulating after squash merges, which makes worktree teardown cleaner and `git branch --merged` more accurate.

Suggested commit title: `chore(docs): bump CONTEXT.md to <sha> + CLAUDE.md prune step`. Single commit, no code changes mixed in. Drafted directly inside the C1 feature worktree (per the PR #51 banked rule).

## Write-path discipline gate (C1-specific)

C1 introduces a NEW Firestore collection. The discipline below is non-negotiable; any deviation is a surprise-stop.

### Pre-write read for edits
The Edit modal must perform a fresh read of the target branch document before opening, and seed inputs from current state. **Do not write blindly.** Create mode skips this read (no document yet).

### Optimistic UI is forbidden
Modal stays open until write completes. Save button disables on click and shows a spinner. Modal closes **only on write success**. On failure, modal stays open and surfaces a specific error.

### Error states (each gets a specific message and recovery path)
- **Permission denied** (Firestore rules reject the write) — "You don't have permission to manage branches. Contact your platform admin." Logs to console with rule context. No retry button.
- **Network failure** (offline / timeout) — "Couldn't reach the server. Check your connection and try again." Retry button keeps modal open with user input intact.
- **Validation error** (client-side, before any write) — inline under the field, never as a generic toast. Specific copy per rule (empty name, name too long, manager not found).
- **Duplicate name conflict** (if uniqueness validation is absorbed) — "A branch named '{name}' already exists. Pick a different name."

**No silent failures.** Every catch path surfaces a user-visible message. No `console.error(...)` without a UI update.

### Firestore rules enforcement (mandatory)
Client-side validation runs first for UX, but the source of truth is `firestore.rules`. The rule must:
- Restrict writes to `tenant_admin` OR `platform_admin`
- Require tenant-scope match (`getTenantId() == tenantId` for tenant_admin; explicit guard for platform_admin per B5 lesson)
- Read = any signed-in user in tenant

If the rules currently allow any authenticated user (or any role beyond `tenant_admin` / `platform_admin`) to write `tenants/{tid}/meta/branches/{branchId}`, that is **NOT a surprise-stop in C1's case** — the path is new, so the existing `match /meta/{docId}` block at `firestore.rules:54-56` (which is `allow write: if false`) is the inherited default. C1's rule additions are purely additive. **However:** the new match block must not accidentally widen access. Verify via emulator regression test (`scripts/test-c1-branches-rule.js`) before push.

### Audit trail
`updatedBy: uid` + `updatedAt: serverTimestamp()` on every write (mirror B5). No separate audit-log collection. Per-doc fields are the audit trail until P11's audit-log infrastructure ships.

## What to do first — Plan first (Option A)

> Do not write code yet. Produce a work plan in chat covering:
>
> 1. **Audit current state.** Read the files listed in §Session scope. Confirm:
>    - Whether `branchService.js` already exists in any form (it shouldn't, but verify). If yes, name it and decide reuse vs replace.
>    - Whether `tenants/{tid}/meta/branches` already exists in the pilot tenant (almost certainly not, but verify via console or by checking any seed scripts).
>    - The exact shape of `user.branchId` values today — are they strings? Slugs? UIDs? Numerics? The fallback display strategy depends on what's actually stored.
>    - The existing branch-derivation read pattern. Name the file(s), name the function(s) that produce the "list of branches" today. Confirm the audit-phase claim that this is sourced from `users` docs, not from any other path.
>    - The current `firestore.rules` state for `match /meta/{docId}` (the parent block, lines 54-56). Confirm `allow write: if false`. Quote the block.
>    - The B5-shipped `match /config/{docId}` block (lines 119+ per CONTEXT.md). Quote the block — C1's new rule mirrors this pattern.
>    - The existing `match /tenants/{tenantId}` parent rule and any helper functions (`isSignedIn()`, `getTenantId()`, `canManage()`, `isTenantAdmin()`, etc.). Name them.
>    - Whether `mocks/concept-4-complete.html` has a fuller branches management surface design that the audit-prep missed (search for `Add Branch`, `branch-list`, `Branches · YTD`, etc.). If yes, surface as a discovery before designing from scratch.
>    - Where `<TenantAdminDashboard />` lives post-B5 (or whether B5 routed via a `ManagerDashboard.jsx` branch). Identify the surface that hosts the "Branches" sidebar destination.
>    - Whether B5's `<EditConfigModal>` pattern is reusable as-is (with field swap) or requires a fresh modal component for C1. Default expectation: reuse the modal scaffolding (focus trap, Escape, etc.) at the primitive level, not the line-by-line markup.
>    - Whether `scripts/test-b5-config-rule.js` exists and what its structure looks like — C1's `scripts/test-c1-branches-rule.js` mirrors it.
>    - Whether the manager dropdown source — active `branch_manager` users in tenant — has an existing query or service helper. If yes, name it and reuse.
>
> 2. **Mock-vs-code parity check.** For the tenant_admin Branches surface:
>    - Confirm the mock's tenant-admin sidebar item "Branches" maps to a real route after C1 (not a stub).
>    - Confirm the mock's "Branch overview" card at lines 2026-2047 is read-only (it is) and is NOT what C1 ships. C1 ships the management UI; the overview card stays as it was (or gets enhanced separately).
>    - Confirm whether any other mock surface (search for `Add Branch`, `branch-edit`, `branch-create`, etc.) implies UI we should reuse rather than design fresh.
>
> 3. **Design the management surface.** Since the mock has no full branches management UI design, pick a layout from B5's vocabulary:
>    - Table-style list (header row + sortable columns) — matches User Roster pattern
>    - Card grid (one card per branch) — matches Branch overview pattern in the mock
>    - Recommend ONE with a one-line justification. Default recommendation (pre-audit): table-style list. CRUD on a small set (< 20 rows) is more legible as a table; cards are richer but waste vertical space. Audit may overturn this if the codebase has a strong card-list precedent for tenant_admin surfaces.
>
> 4. **File-by-file change map** with risk per file. Distinguish "additive" (new service, new components, new rules block, new emulator test) from "structural" (sidebar item link / route wiring) from "surface" (CSS additions). For any file in `docs/track-c-implementation.md` § PR C1 that the audit shows is unrelated, drop it from the change set with a one-line justification.
>
> 5. **Firestore rules verification + plan.** Quote the existing `match /meta/{docId}` block. Quote the B5 `match /config/{docId}` block. Propose the new `match /meta/branches/{branchId}` block as a code diff. Confirm rules-evaluation precedence (more specific match wins; the broader `meta/{docId}` write-locked match doesn't override the specific branches match). If precedence is uncertain, surface as a discipline gate.
>
> 6. **Emulator test plan.** Sketch `scripts/test-c1-branches-rule.js` cases:
>    - Cross-tenant read denied
>    - Same-tenant read allowed for any signed-in role (agent, unit_manager, branch_manager, sales_manager, tenant_admin)
>    - Agent write denied
>    - Unit manager write denied
>    - Branch manager write denied
>    - Sales manager write denied
>    - Tenant admin write allowed in own tenant
>    - Tenant admin write denied in other tenant
>    - Platform admin write allowed in any tenant
>    - Unauthenticated read + write both denied
>
> 7. **Tenant-admin preview matrix plan.** 8 cells: tenant_admin × {1440px, 1024px, 768px, 390px} × {light, dark}. Per cell, enumerate the assertions: empty state, populated list, modal open (create), modal open (edit), validation error, save success, deactivate inline, reactivate inline. Plus drive-by checks confirming the other 4 roles cannot reach the Branches management surface (sidebar item absent or `aria-disabled`, direct route 404 / redirect).
>
> 8. **A11y verification plan.** Form labels + `aria-describedby` for any help text. `aria-invalid` + live-region announcements. Modal focus trap + Escape + return focus. Reduced-motion guards. Color contrast on Save button states + inactive pill + list-row hover at light + dark.
>
> 9. **Open questions for me to answer before code starts.** Especially:
>    - Layout choice for the management UI (table vs card grid)
>    - Branch-name uniqueness — enforce in service layer (list-then-check) or skip
>    - Branch-manager assignment uniqueness — enforce or skip (audit-phase decision per the implementation plan)
>    - Manager dropdown behavior when no active branch_managers exist in the tenant
>    - Inline confirm vs modal confirm for Deactivate / Reactivate
>    - Whether to absorb a tiny rules-only fix to the existing `meta/{docId}` block (e.g., adding helper-function comments) or keep the new rule purely additive
>    - Empty-state copy ratification
>
> I'll review and approve before any code is written.

## Autonomous scope — what Claude Code can do without further check-in (after plan approval)

> 1. Sync main: `git fetch origin && git pull origin main` (per locked feedback memory).
> 2. Create worktree branch off `origin/main` HEAD (verify SHA against `docs/CONTEXT.md`).
> 3. **First commit on the branch must bundle the CONTEXT.md SHA bump AND the CLAUDE.md prune-step addition** banked from PR #57 cleanup. Single commit, conventional title `chore(docs): bump CONTEXT.md to <sha> + CLAUDE.md prune step`. Drafted directly inside the C1 feature worktree (per CLAUDE.md banked rule from PR #51).
> 4. Implement changes per the approved plan.
> 5. `npm run lint && npm run build` — must both pass.
> 6. Commit (conventional commits, per CLAUDE.md). Suggested sequence: docs commit (step 3) → token additions (if any) → CSS additions → `branchService.js` → `firestore.rules` update + emulator test → `<BranchEditorModal>` → `<BranchesPanel>` → tenant-admin dashboard wire-up → sidebar item link upgrade.
> 7. Push to feature branch.
> 8. Open PR titled `feat(track-c-c1): branches schema + tenant admin management UI` with description covering: scope, file count breakdown, tenant-admin preview matrix verification (8 cells), drive-by verification (other-role cannot-access checks), Firestore rules state (quoted before/after, emulator test results), write-path failure-mode verification (permission denied / network failure / validation error each demonstrated), audit-trail (`updatedBy` + `updatedAt`), backwards-compat verification (empty-collection fallback for branch_manager / sales_manager dashboards), dark-mode verification, a11y verification, open follow-ups.
> 9. Wait for Vercel preview Ready via `scripts/wait-vercel-ready.sh <sha> --target preview --pr <PR#>`.
> 10. Run preview walkthroughs **for the tenant_admin role**, plus drive-by per-other-role test account confirming the Branches management surface is unreachable.
> 11. Post the verification summary in PR comments. Include: 8-cell tenant-admin matrix render confirmations, drive-by confirmations for the other 4 roles, write-path success + failure-mode demonstrations (screenshots showing each error state), modal focus-trap manual confirmation, reduced-motion check, single-`<main>` invariant survival.
> 12. **STOP at preview-verified.** No merge. Kyron merges manually.

## Hard rules — non-negotiable, applies every session

- **Worktree branch only.** Never push directly to `main`. Branch off `origin/main` HEAD.
- **Always pull main before branching:** `git fetch origin && git pull origin main` (per locked feedback memory).
- **Docs drafts live inside the feature worktree** (per PR #51 retrospective banking) — do not draft in main worktree, do not draft in a sibling worktree.
- **No auto-merge.** Push → PR → preview Ready → tenant-admin matrix walkthrough + drive-by other-roles → STOP for human merge.
- **Post-merge verification (tightened in PR #50):** `git fetch origin && git pull origin main && git log origin/main --oneline -5` to confirm squash SHA — the pull is required so worktree-local tooling matches production. Then production walkthrough via `scripts/exploration-walk.cjs --url=https://agencytrack.vercel.app --label=track-c-c1_production`.
- **Worktree teardown after merge.** `git worktree remove <path>` then `git worktree prune`. **Local branch deletion uses `git branch -D <feature-branch>`** (force, per CLAUDE.md banked rule).
- **Never echo `.env.local` values** to chat output, PR comments, logs, or screenshots. Reference by env var name only.
- **Verification artifacts stay local.** Logs, screenshots, one-off verification scripts — never commit.
- **No emojis as structural icons.** Lucide React only.
- **No hardcoded hex outside CSS variables** (except `AgentReportDocument.jsx`).
- **All new tokens use `--color-*` prefix** (B-series locked).
- **Implement the mock faithfully where it provides design** — do not redesign. Where the mock is silent (the management UI), reuse B5's tile-and-modal patterns. The only design decisions this session are token-name mappings, layout choice (table vs card grid), and the audit-phase decisions surfaced in the plan.
- **No new routing library.**
- **No new Firestore collections beyond `meta/branches`.** The audit-trail decision is per-doc fields only; no separate audit-log collection.
- **Both light + dark mode tested** before opening PR — for tenant_admin specifically, plus drive-by the other 4 roles.
- **A11y is not a follow-up.** Form labels, modal focus trap, Escape, return focus, ARIA invalid + live region, reduced-motion guards — all ship in the PR.
- **Optimistic UI is forbidden** for the write path (per §Write-path discipline gate).
- **Firestore rules enforcement is a hard floor.** Emulator regression test must pass before push.

## Discipline gates — surface in chat, do not absorb unilaterally

**Two-strike stop:** If you hit the same kind of unexpected friction twice in a row on this session — two ambiguous mock-vs-code disagreements, two retries on the same step, two dark-mode contrast issues, two unsafe-rules surfaces, two scope-creep temptations — STOP and wait for me, regardless of progress. Counter resets at the start of each new session.

### C1-specific surprise-stop triggers

- **Existing `user.branchId` values aren't strings** — if user docs reference branchIds that are numeric IDs, references, or some other shape, the fallback display strategy needs to handle whatever the actual type is. Surface during audit. Don't guess.
- **Existing `match /meta/{docId}` write rule already permits writes from a non-Admin-SDK source** — the assumption is `allow write: if false` (lines 54-56). If that's actually wider, surface as a SECURITY surprise-stop and propose a remediation before C1's rule adds.
- **`tenants/{tid}/meta` path is already used for something else** — if `meta` is already a singleton config doc or has a non-branches sub-doc structure, the path scheme `meta/branches/{branchId}` may collide. Confirm the meta path is available before locking.
- **Manager dropdown is empty** — no active `branch_manager` users in the tenant. Confirm with Kyron whether to: (a) allow null managerId (Unassigned default) — current default; (b) hide manager field if no candidates exist; (c) show input but disable save until at least one manager exists. Default is (a).
- **The mock has a fuller branches management UI somewhere I missed** — surface as a discovery and pivot to mock-faithful implementation rather than designing from scratch.
- **Branch-name uniqueness validation** turns out to be load-bearing — i.e., the audit reveals downstream code that assumes unique names. Surface as a scope question (enforce in service layer? in rules? skip and rely on admin discipline?).
- **Existing branch-derivation read paths break with an empty new collection** — i.e., the fallback claim ("dashboards keep working with empty collection") turns out to be false and there are real read regressions. Surface as a SECURITY/data-integrity surprise-stop.
- **B5's modal pattern doesn't transfer** — i.e., the focus-trap hook or modal scaffolding is too tightly coupled to `<EditConfigModal>` to reuse for `<BranchEditorModal>`. Surface as a scope question; reusability vs duplication is a one-line cost decision.
- **Two-strike trigger** — if the audit hits two ambiguous mock-vs-code disagreements, two unsafe-rules surfaces, or two scope-creep temptations, STOP.

Discipline gates are the value of this workflow. They're not friction — they're catching bugs before they ship. **C1's most likely surprises cluster around: existing `user.branchId` value shape, existing `match /meta/{docId}` rule wider-than-expected, and mock-vs-code parity on a management UI that the mock doesn't actually design.**

## Stash / pending state from prior sessions

Read `docs/CONTEXT.md` § Pending operational state. Surface anything notable in chat before starting C1. Known carry-overs as of B5 close + post-B5 follow-ups:

- **Untracked legacy doc** at `docs/PR-3-Claude-Code-Brief.md` — stale, intentionally untracked across multiple PRs. Decide separately (archive or delete) — not C1 scope.
- **GitHub "Automatically delete head branches" is ON** (confirmed via PR #50 cleanup). Worktree teardown should be clean. Local branch removal uses `-D`.
- **Open follow-ups in `docs/FOLLOW_UPS.md`:**
  - "Branches Management UI" — **C1 closes this entry entirely.** Confirm during PR description.
  - PR-4 Edit-user flows — out of C1 scope, separate ticket.
  - HIGH#5 Server-side email infrastructure — out of C1 scope.
  - HIGH#4 Persisted-state cycle in walkthroughs — C1 should follow the verification template that includes a persisted-state cycle (set sidebar-collapsed, set dark-mode, reload, verify).
  - Wizard UX hardening, Mobile FU#1-#4, etc. — out of C1 scope.

## Final stop condition

End the session when:
- PR C1 is open with Vercel preview verified for **tenant_admin** at 1440px desktop, 1024px tablet, 768px tablet-portrait, and 390px mobile in **both light and dark mode** (8 render-state checks for the new surface)
- Drive-by verification confirms the Branches management surface is unreachable for the other 4 roles (4 sanity checks)
- Branch Editor Modal opens, focus-traps, closes via Escape, closes via Cancel, returns focus to trigger
- Save success path closes modal and the new branch appears in the list with correct sort order
- Save failure paths each surface a specific error message and keep the modal open: permission denied (rule-blocked from a non-tenant_admin role test), network failure (offline), validation error (client-side empty-name)
- Deactivate / Reactivate inline actions toggle `isActive` and the row visually updates
- Firestore rules verified to restrict `meta/branches/{branchId}` writes to `tenant_admin` OR `platform_admin` (quoted in PR description)
- Emulator regression test (`scripts/test-c1-branches-rule.js`) passes — output captured in PR description
- Firestore document state confirmed: write succeeds with required fields (`name`, `managerId`, `isActive`, `createdAt`, `updatedAt`, `updatedBy`)
- Backwards-compat verified: log in as `branch_manager` and `sales_manager` test accounts; confirm dashboards still render branches even when the new collection is empty in the test tenant (or seeded with a single branch)
- Theme toggle still works in B4's TopBar; dark-mode persistence still works on the new surface
- Existing single-`<main>` invariant holds on the tenant-admin Branches surface
- Reduced-motion behavior verified on modal open/close
- Form label / `aria-describedby` / `aria-invalid` / live-region a11y verified at light + dark
- Test account login verified for tenant_admin; missing accounts surfaced and provisioned before this stop condition can be met
- All open questions for Kyron are listed at the end of the plan / PR description
- `npm run lint` and `npm run build` both green on the feature branch
- Two-strike counter is at 0 or surfaced if not

Post a summary in chat with: tree state, PR link, what's done (Branches collection + service + management UI + editor modal + sidebar item upgrade + first-commit doc bumps), Firestore rules state (safe before write-path ship — yes/no, emulator test result), what's blocked on Kyron, two-strike counter status, and the closing line: **"C1 ready for review. Next is C2 — bulk user provisioning."**

## ✂ COPY ENDS HERE ✂

---

## Notes for Kyron

- **First PR of Track C.** Track B (v2) is closed (no B6). Track C is a sibling track, not an extension. C1 → C2 → C3 in dependency order.
- **C1 introduces a new Firestore collection** at `tenants/{tid}/meta/branches/{branchId}`. Schema, permissions, and write-path discipline are locked in this brief. Audit-phase decisions are limited to: layout (table vs card grid), uniqueness validation (enforce or skip), inline-vs-modal confirm for Deactivate / Reactivate, and a few other finely-scoped open questions surfaced in the plan output.
- **Mock-vs-code gap on the management UI.** The mock at `mocks/concept-4-complete.html:1839` has a tenant-admin sidebar item "Branches" but the only on-screen surface is the read-only "Branch overview" card at lines 2026-2047. There's no full management UI design. C1 designs from B5's tile-and-modal vocabulary. The brief surfaces this as a discovery during audit (in case I missed a fuller surface in the mock) and locks the design fallback to B5 patterns.
- **Backwards compat is the load-bearing constraint.** Existing dashboards (branch_manager, sales_manager) derive branches from `users` docs today. C1 introduces the new collection but does NOT migrate read paths. As long as the fallback derivation still works when the new collection is empty for a tenant, C1 ships safely; the read-path migration is a separate ticket.
- **Firestore rules surprise-stop is rules-precedence, not rules-too-permissive.** The existing `match /meta/{docId}` block is `allow write: if false` (Admin SDK only). C1 introduces a more specific `match /meta/branches/{branchId}` match. The discipline gate verifies precedence: more-specific wins, broader doesn't override. Emulator test confirms before push.
- **First commit bundles two banked items:** CONTEXT.md SHA bump + CLAUDE.md prune-step addition (banked from PR #57 cleanup). Single docs commit, drafted inside the C1 feature worktree per the PR #51 banking rule.
- **Audit-trail decision is locked.** No separate audit-log collection. Per-doc `updatedBy` + `updatedAt` is the trail until P11 ships. Mirrors B5.
- **"Tenant_admin matrix verified before merge" is a hard floor.** 8 render-state cells for the new surface (4 breakpoints × 2 themes) plus 4 drive-by other-role sanity checks. If any cell can't be verified (test account missing, Vercel preview broken), the PR doesn't ship.
- **C2 unblocks immediately after C1 merges.** C2's CSV import references `branchId` values that must exist in C1's collection. Sequencing matters.

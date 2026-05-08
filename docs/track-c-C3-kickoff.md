# AgencyTrack Session Kickoff — Track C PR C3 (2026 Personal Commitments CSV Import)

> **For Kyron:** This is the prompt to paste into a fresh Claude Code session to start PR C3. Copy from the line below all the way down. The prompt is self-contained — Claude Code reads the right files and produces a plan before writing any code.
>
> **C3 is the third and final PR of Track C.** C1 (PR #60) shipped branches schema. C2 (PR #61) shipped bulk user import. C3 ships bulk personal-commitment import. After C3 merges, Track C closes and pilot-data onboarding is unblocked. Track D follows.

---

## ✂ COPY FROM HERE ✂

# AgencyTrack Session Kickoff — Track C PR C3 (2026 Personal Commitments CSV Import)

## Step 0 — Read these in order, do not skip

1. `CLAUDE.md` — static project rules. Pay special attention to: post-merge protocol; the `git branch -D` rule; the docs-only-PR untracked-doc collision pattern; the single-branch PR rule; and the (extended in C2 close) `.env.local` use-vs-echo traps + additive-deploy timing rule + admin-script require-path note.
2. `docs/CONTEXT.md` — current state, locked decisions, active follow-ups. CONTEXT.md overrides CLAUDE.md where they differ.
3. `docs/track-c-implementation.md` § PR C3 — canonical scope hypotheses. **Audit may surface drift between this file and the kickoff brief — brief wins; cascade-correct in a separate docs commit.** (C2 had the same drift pattern with branchId/branchName.)
4. `docs/track-c-C2-kickoff.md` — for the patterns and discipline gates that apply (CSV import shape, multi-step modal UX, audit-trail conventions, write-path discipline). C3 follows C2's precedent closely.
5. `firestore.rules` — current state. Specifically read `match /goals/{goalId}` (the rule pattern that gates personal commitment writes) and `match /config/{docId}` (companyMinimums lives there — needed for target-floor validation).
6. `src/services/userImportService.js` — C2-shipped. C3's `goalsImportService.js` mirrors its structure verbatim (parseCSV → prepareImport → runImport → buildErrorCSV → buildTemplateCSV → downloadCSV → generateBatchId).
7. `src/components/admin/BulkImportUsersModal.jsx` — C2-shipped. C3 reuses the four-step modal scaffolding (file picker → preview → progress → summary), `useFocusTrap`, `StepIndicator`, `StatusPill`, `CancelConfirmDialog` mid-flight pattern.
8. `src/services/goalsService.js` — **C3's primary reuse target.** `setGoals(tenantId, agentId, data, setBy, setByName)` already enforces `companyMinimums` floors on `personalAnnualAPI` / `personalAnnualApps` / `personalAnnualPersistency` and writes audit fields. C3's bulk import calls `setGoals` per row inside try/catch — does NOT reimplement floor validation.
9. `src/services/agentManagementService.js` — `getAllUsers({ includeInactive: true })` returns `{ uid, email, role, branchId, active, ... }`. C3 filters `role === 'agent' && active !== false` to find import candidates.
10. `src/components/manager/UserManagementPanel.jsx` — current header has the C2-shipped "Bulk Import" CTA. C3 renames it to "Bulk Import Users" and adds a sibling "Bulk Import Goals" button. Both gated on `role in ['tenant_admin', 'platform_admin']`.
11. C-series retrospectives + the latest entries in `docs/CONTEXT.md` § Where we left off. Lessons from C1/C2 apply directly:
    - Speculative file listings are starting hypotheses, not directives.
    - Mock-vs-code surface-gap audit before any code.
    - Honest data-availability check.
    - Reusability assumptions break: surface, don't absorb.
    - `.env.local` use-vs-echo (extended): never cat/echo/grep token files; never embed tokens as URL params for tool calls.
    - Verification scripts discover real data; don't create new permanent state if a temporary path exists.
    - Destructive operations on production → gate live execution behind explicit human approval.

## Step 1 — Tree state verification (do this before anything else)

```bash
git fetch origin
git status
git log origin/main --oneline -3
git worktree list
```

Working tree must be clean. `origin/main` HEAD must match `docs/CONTEXT.md` § Current main HEAD with at most one PR of drift (C2, expected). If either fails: STOP, surface in chat, do not absorb.

## Session scope

**In scope (PR C3 only):**

- `src/services/goalsImportService.js` — NEW. CSV parse via Papaparse, per-row validation (agent identifier lookup → `getAllUsers` filter to agents, target-vs-companyMinimums floor check delegated to `setGoals`, role/active confirmation, duplicate-existing-goal check), per-row write coordination via `setGoals`, result aggregation. Pure service layer; mirrors C2 `userImportService.js` structure verbatim.
- `src/components/admin/BulkImportGoalsModal.jsx` — NEW. Four-step wizard. Reuses `useFocusTrap` + `StepIndicator` / `StatusPill` / `CancelConfirmDialog` patterns from `BulkImportUsersModal.jsx` (copy-from-precedent — third-consumer threshold for extracting `CsvImportModalShell` not yet met).
- `src/services/goalsService.js` — MODIFY (additive). Extend `setGoals` to accept passthrough `csvImportBatchId` + `importedFromCsv` fields. Single-user CareerPortal "Edit My Goals" flow never sets these → behavior unchanged.
- `src/components/manager/UserManagementPanel.jsx` — MODIFY. Rename C2-shipped "Bulk Import" CTA to "Bulk Import Users" for disambiguation; add sibling "Bulk Import Goals" CTA. Two-button pattern. **Surface-stop fallback**: if at implementation time the header genuinely can't fit two CTAs at smaller breakpoints (especially 768px / 390px), STOP and surface — fall back to a dropdown design (chevron + menu of "Users" / "Personal Commitments"). Default to two-button.
- `src/components/admin/BulkImportUsersModal.jsx` — MODIFY. Tiny alongside-fix: add `'internal'` to the friendly-message branch in the error-code map at line 244 (closes F3 MEDIUM). The new C3 modal mirrors the same map shape from the start with `'internal'` already included.
- CSV format spec: required columns `agentEmail`, `annualApiTarget`, `annualAppsTarget`. Headers case-insensitive. UTF-8 with optional BOM. CRLF tolerated. **No `year` column** — the personal-commitment doc has no `year` field; "2026" is editorial framing only (template/CSV header copy says "2026 personal commitments" for human clarity).
- Tenant scope: all imported goals land in calling tenant_admin's tenant (from auth claims). No cross-tenant import.
- Permissions: direct Firestore writes by tenant_admin under existing `match /goals/{goalId}` + `canManage(tenantId)` rules. NO new Cloud Function. NO new Firestore rules.
- Audit trail per imported goal: `setBy` + `updatedAt` (existing `setGoals` writes these via `serverTimestamp()`); new passthrough `csvImportBatchId` (UUID v4, generated via `crypto.randomUUID()`) + `importedFromCsv: true`. `merge: true` semantics preserve manager-set targets on the same doc.
- Backwards compatibility: existing P6A/P8C goal-setting UIs (CareerPortal, GoalsPanel) remain unchanged.

**Out of scope (do not expand into):**

- Branch goals seeding (managers set via existing P8C UI during pilot onboarding — Q1 lock).
- Unit goals seeding (same — managers set via existing P8C UI).
- Sales Manager Target layer (Phase 9 — out of pilot scope).
- Future-year roll-over button (separate post-pilot ticket — Q3 lock).
- Year other than 2026 (locked single-year — Q3 lock).
- Goal updates via re-import (C3 is import-only; re-importing same agent = skip with warning, mirrors C2 duplicate-email pattern).
- Bulk personal-commitment EDIT (deferred to a future track if pilot needs it).
- Hard delete of goal docs.
- New Cloud Function (writes are simple Firestore ops; rules already gate access).
- New Firestore collections.
- Phase 9 Sales Manager Target.
- Any chrome layout changes.
- Migrating `EditConfigModal` / `BranchEditorModal` to consume `useFocusTrap` (C2 follow-up; still applies).
- Persistency commitment column (Q4 lock — two columns only; persistency follows in a tiny PR if pilot reports needing it).

## Decisions ratified during plan-phase

These were locked via Kyron's Q1–Q7 review of the C3 plan. Source of truth: the plan-approval message (2026-05-08).

### Q1 — CTA placement (A, two sibling buttons)
Add "Bulk Import Goals" alongside the existing C2 "Bulk Import" CTA. Rename the C2 CTA to "Bulk Import Users" for disambiguation. Two explicit buttons read clearer than a dropdown; the rename surprise is minor (pilot hasn't started). **Surface-stop fallback**: if header can't fit two CTAs at 768px / 390px, STOP and convert to dropdown.

### Q2 — F3 MEDIUM absorption (yes)
Add `'internal'` to the friendly-message branch in both `BulkImportUsersModal.jsx:244` (alongside-fix) and the new `BulkImportGoalsModal.jsx` (from the start). Note in the PR description as a small alongside-fix, not the headline scope.

### Q3 — companyMinimums presence (B, warn banner)
At Step 1, if `getCompanyMinimums` returns the built-in defaults (no explicit doc), render a soft banner above the file picker:
> "Using default company minimums (TTD 200,000 API / 42 apps). Set explicit minimums in Company Config if your org's floors are different. Floors apply regardless."

Banner uses `--color-warning` tint background + Lucide `Info` icon. Not dismissible (the configuration gap is real; admin acknowledges by setting explicit minimums in Company Config). Floor validation runs the same way regardless — defaults still apply at the service layer.

### Q4 — `personalAnnualPersistency` column (A, two columns only)
Two columns only (API + Apps). Persistency commitment is more personal; agents set their own via CareerPortal "Edit My Goals". If pilot reports needing bulk-persistency seeding, it's a 1-line addition in a follow-up PR.

### Q5 — Zero eligible agents empty-state (A, block)
If every active agent already has 2026 personal commitments set, block at Step 1 with:
> "All active agents already have 2026 personal commitments. Edit individuals via Career Portal."

Same `--color-warning` banner-style as the Q3 banner; sibling visual language.

### Q6 — `setGoals` extension (A, passthrough audit fields)
Extend `setGoals` to accept passthrough `csvImportBatchId` + `importedFromCsv`. Existing single-user CareerPortal flow never sets these → behavior unchanged. Service-layer extension only; no Cloud Function changes.

### Q7 — `CsvImportModalShell` extraction (defer)
C3 is the second consumer of the four-step wizard pattern; SS-2 commitment says wait for the third. Add to `docs/FOLLOW_UPS.md` as MEDIUM:
> Extract `CsvImportModalShell` (StepIndicator + StatusPill + four-step state machine + CancelConfirmDialog mid-flight pattern + template/error-CSV download CTAs) when a third consumer of the bulk-import pattern lands. Likely candidates: bulk persistency entry, bulk activity entry, bulk campaign creation. Until then, copy-from-precedent is acceptable.

### Audit-finding ratifications

- **1a — goal doc path:** brief wins (`tenants/{tid}/goals/{agentUid}`). Implementation plan's `tenants/{tid}/users/{uid}/goals/{year}` is wrong. Cascade-correct § PR C3.
- **1b — year scoping:** approved. CSV/template framing says "2026 personal commitments" for human clarity; no `year` field stored on the goal doc. The existing flat-doc shape is correct.
- **1c — setGoals reuse:** approved with emphasis. `goalsImportService.runImport` MUST call existing `setGoals` per row inside try/catch — do NOT reimplement floor validation. Single source of truth for floor logic.
- **1d — audit-field naming:** keep `updatedAt` for consistency with existing `setGoals`. Do NOT introduce `setAt` on the personal-commitment doc. The unitGoals/branchGoals (`setAt`) vs personal goals (`updatedAt`) inconsistency is existing; surfacing as a small LOW follow-up if cleanup is desired later.
- **1e — other confirmations:** all approved as audited.

## Locked policy (recap from CLAUDE.md / CONTEXT.md)

- All new tokens use `--color-*` prefix; update both `:root` and `.dark` blocks together.
- Lucide React icons. No emojis as structural icons.
- No hardcoded hex outside CSS variables (except `AgentReportDocument.jsx`).
- Both light + dark mode tested before opening PR.
- Verification artifacts stay local — never commit.
- All numeric fields — `parseFloat` enforced (existing `setGoals` already enforces; C3 inherits).
- `serverTimestamp()` for `updatedAt`.
- `.env.local` use-vs-echo (extended traps from C2 close): never cat/echo/grep token files; never embed tokens as URL query-params for tool calls; if a tool forces a token into a string param, STOP and surface.

## A11y — bake in from the start

- Form labels: file picker has `<label>` (not just placeholder).
- Validation errors: `aria-invalid="true"` + `role="alert"` + `aria-live="polite"` for preview-table per-row errors (mirrors C2).
- Modal a11y: focus trap (via `useFocusTrap` hook) + Escape (with mid-flight confirmation) + return focus + `role="dialog"` + `aria-modal` + `aria-labelledby`.
- Reduced-motion guards on transitions and modal animations.
- Keyboard: preview table rows reachable; filter toggles keyboard-operable; file picker invokable via keyboard.
- Color contrast: error/warning/valid rows ≥ 4.5:1 in both modes.
- Heading hierarchy: modal `<h2>` → step section `<h3>` (if used).
- Step indicator at top of modal as semantic `<ol aria-current="step">`.
- Progress bar (Step 3): `role="status"` with text-only "Importing…" (indeterminate per C2 Q4).
- Error report download CTA: `<a download="...">` with `href` from `URL.createObjectURL(blob)`.

## Banked items landing in C3's first commits

C3's first commits bundle banked items from C2's close as separate concerns — one purpose per commit:

1. `chore(docs): bump CONTEXT.md to f906108 + C2 PR #61 to recently-shipped` — CONTEXT.md SHA bump, recently-shipped table refreshed, Where-we-left-off note for C2 close + C3 framing.
2. `docs(claude-md): extend .env.local traps + additive-deploy + tooling notes` — combines extended `.env.local` use-vs-echo traps, additive-deploy generalization to Cloud Functions, squash-SHA pattern note, and admin-script require-path note. Single CLAUDE.md commit covering all four.
3. `docs(track-c): add C3 kickoff brief` — write `docs/track-c-C3-kickoff.md`.
4. `docs(follow-ups): C3 sweep — F3 internal-error + cleanup utility + CsvImportModalShell + audit-field naming` — adds the F3 MEDIUM (closed by C3), cleanup utility MEDIUM, CsvImportModalShell extraction MEDIUM, audit-field naming LOW.
5. `docs(track-c): align implementation plan with C3 kickoff brief` — cascade-correct § PR C3 (path correction, drop GoalsSeederModal/single-user UI, drop new helper, document audit-field naming).

Then code commits begin.

## Write-path discipline gate (C3-specific)

C3 writes goal docs from a tenant_admin client without a Cloud Function intermediary. The discipline below is non-negotiable.

### Pre-write validation
Client validates every row before any write happens — preview table reflects the validation outcome. No write attempts on rows the preview shows as error/warning. **Floor validation is delegated to the existing `setGoals` service** — single source of truth.

### Optimistic UI is forbidden
Modal stays open until the per-row write loop completes. No "goals updated" UI changes until summary screen confirms.

### Per-row atomicity
Each row's outcome captured atomically. A failure in row N does not affect row N+1.

### Rollback is NOT supported
Successfully-written goals are not reverted on partial failure or user-cancel. Recovery is via the existing CareerPortal "Edit My Goals" UI for individual edits.

### Audit trail per imported goal
- `setBy: <caller_uid>` (existing `setGoals` writes this)
- `setByName: <caller_name>` (existing `setGoals` writes this)
- `updatedAt: serverTimestamp()` (existing `setGoals` writes this)
- `csvImportBatchId: <UUID v4>` (NEW passthrough)
- `importedFromCsv: true` (NEW passthrough)

`merge: true` semantics preserve manager-set targets on the same doc.

## What to do first — Plan first (Option A)

> Do not write code yet. Produce a work plan in chat covering audit findings, existing-goal data discovery, verification approach, CSV format verification, UX wireframe, file-by-file change map, no-Cloud-Function confirmation, tenant-admin preview matrix plan, a11y verification plan, open questions for Kyron.

## Autonomous scope — what Claude Code can do without further check-in (after plan approval)

1. Sync main: `git fetch origin && git pull origin main`.
2. Create worktree branch off `origin/main` HEAD (verify SHA against CONTEXT.md).
3. Copy `.env.local` from main worktree into the C3 worktree.
4. Five docs commits per the order above.
5. Code commits in this suggested order:
   a. `feat(goals): extend setGoals to accept csvImportBatchId + importedFromCsv`
   b. `feat(track-c-c3): goals import service`
   c. `feat(track-c-c3): bulk import goals modal + internal-error fix in users modal`
   d. `feat(track-c-c3): wire bulk-import goals CTA in tenant_admin shell` (with two-sibling-buttons pattern unless header forces dropdown fallback)
6. `npm run lint && npm run build` — must both pass.
7. Push to feature branch.
8. **NO Cloud Function deploy required for C3** — writes are client-side Firestore ops covered by existing rules.
9. Open PR titled `feat(track-c-c3): 2026 personal commitments csv import` with description covering: scope, file count breakdown, tenant-admin preview matrix verification (8 cells), drive-by verification, write-path failure-mode demonstrations, audit-trail (setBy + updatedAt + csvImportBatchId + importedFromCsv), backwards-compat (existing CareerPortal/GoalsPanel UIs unchanged), dark-mode verification, a11y verification, open follow-ups.
10. Wait for Vercel preview Ready via `scripts/wait-vercel-ready.sh`.
11. Run preview walkthroughs for tenant_admin (4 breakpoints × 2 themes = 8 cells), plus drive-by per-other-role test account confirming the Bulk Import Goals CTA is absent.
12. Run the failure-mode demos via the verification script (`verification/c3-goals-shots.cjs`). **Test goals are cleaned up by the script after verification with batch-id-match guard** (defensive — only delete docs whose `csvImportBatchId` matches the test batch's UUID; verify before each `deleteDoc`).
13. Post the verification summary in PR comments.
14. STOP at preview-verified. No merge.

## Hard rules — non-negotiable, applies every session

- Worktree branch only. Never push directly to `main`.
- Always pull main before branching: `git fetch origin && git pull origin main`.
- Docs drafts live inside the feature worktree.
- No auto-merge. Push → PR → preview Ready → matrix walkthrough + drive-by → STOP.
- Post-merge verification: `git fetch origin --prune && git pull origin main && git log origin/main --oneline -5`. Then production walkthrough via `scripts/exploration-walk.cjs --url=https://agencytrack.vercel.app --label=track-c-c3_production`.
- Worktree teardown after merge: `git worktree remove <path> && git worktree prune && git branch -D <feature-branch>`.
- Never echo `.env.local` values to chat / tool params / URLs / commits / PR comments / screenshots / logs. Reading programmatically OK. If a tool mechanism forces a token into a string param: STOP, surface, do not work around.
- Verification artifacts stay local.
- No emojis as structural icons. Lucide React only.
- No hardcoded hex outside CSS variables (except `AgentReportDocument.jsx`).
- All new tokens use `--color-*` prefix.
- Both light + dark mode tested.
- A11y is not a follow-up.
- Optimistic UI is forbidden.
- No new routing library.
- No new Firestore collections. C3 writes to existing `goals` only.
- No new Cloud Function. C3 is client-side Firestore writes under existing rules.
- Hard delete remains unsupported.
- 2026 only. No `year` column on the CSV; "2026" is template-copy framing.
- Personal commitments only. Branch/unit goals out of scope.
- For destructive operations on production: gate live execution behind explicit human approval.

## Discipline gates — surface in chat, do not absorb unilaterally

**Two-strike stop:** Same as C1/C2. Two same-dimension friction events → STOP.

### C3-specific surprise-stop triggers

- `setGoals` extension reveals existing call sites that ARE passing `csvImportBatchId` or `importedFromCsv` — would mean the field is in use somewhere unexpected. Surface before extending.
- The companyMinimums banner copy doesn't render legibly in dark mode (color contrast on warning-tint over dark surface). Surface; adjust token mapping.
- The two-sibling-button pattern crowds the UserManagementPanel header at 768px or below — STOP, surface, fall back to dropdown.
- The verification script's cleanup phase finds ANY doc where `csvImportBatchId` doesn't match the test batch — STOP and surface, do not force-delete.
- `canManage()` rule helper doesn't include `tenant_admin` for `match /goals/{goalId}` — would mean tenant_admin can't write goals without rules expansion. Surface as SECURITY consideration before assuming the deploy is rules-clean. (Pre-locked: confirmed `canManage` includes tenant_admin in firestore.rules:25-27.)
- CSV column ambiguity (email vs agentNumber) — if codebase has multiple identifier paths and existing UIs use different ones, surface for canonical lock. (Pre-locked: agentEmail.)
- Two-strike trigger — two ambiguous service-reuse disagreements or two scope-creep temptations → STOP.

C3's most likely surprises cluster around: existing goal-doc field naming (audit pre-confirmed: `personalAnnualAPI` / `personalAnnualApps`), companyMinimums presence/shape (audit pre-confirmed: defaults-fall-through behavior), and CTA placement at smaller breakpoints (Q1 surface-stop fallback).

## Stash / pending state from prior sessions

Read `docs/CONTEXT.md` § Pending operational state. Surface anything notable in chat before starting C3. Known carry-overs as of C2 close:

- Untracked legacy doc at `docs/PR-3-Claude-Code-Brief.md` — stale, intentionally untracked. Not C3 scope.
- GitHub "Automatically delete head branches" is ON.
- Open follow-ups in `docs/FOLLOW_UPS.md`:
  - PR-4 Edit-user flows — out of C3 scope.
  - HIGH#5 Server-side email infrastructure — out of C3 scope.
  - HIGH#6 YTD composite index — pre-existing from B5. Out of C3 scope.
  - F3 MEDIUM — `BulkImportUsersModal.jsx:244` `internal` error code — closed in C3 (alongside-fix).
  - MEDIUM cleanup utility formalization — out of C3 scope.
  - Wizard UX hardening, Mobile FU#1-4 — out of C3 scope.

## Final stop condition

End the session when:

- PR is open with Vercel preview verified for tenant_admin at 1440px / 1024px / 768px / 390px in both light and dark mode (8 cells)
- Drive-by verification confirms the Bulk Import Goals CTA is unreachable for the other 4 roles
- File picker accepts CSV; rejects non-CSV with clear error
- Preview table renders with valid / warning / error rows correctly distinguished, including agent name resolved from email lookup
- "Confirm import" CTA disabled when 0 valid rows
- Successful import: per-row goal docs land in Firestore at `tenants/tatillife_south/goals/{agentUid}` with correct fields including `csvImportBatchId`, `importedFromCsv`, `setBy`, `updatedAt`; visible in CareerPortal after refresh
- Partial failure: summary surfaces correct counts (succeeded / skipped / failed) + per-row error details; no silent drops
- Cancel mid-flight: confirmation dialog shown; goals written pre-cancel persist
- Duplicate existing goal: warning shown in preview; row skipped on import; summary reports skip
- Below-floor target: row rejected with `setGoals`-emitted "Annual API must be at least TTD X" copy
- Invalid agent identifier: row rejected with specific error
- companyMinimums-defaults banner renders in both light and dark mode (legible)
- Two-sibling-button CTA renders cleanly at all four breakpoints (or surface-stop if cramped at 768/390)
- Modal focus trap, Escape (with mid-flight confirmation), return focus all manually verified
- Theme toggle still works in B4's TopBar; dark-mode persistence still works
- Existing single-`<main>` invariant holds
- Reduced-motion behavior verified
- A11y: form labels / `aria-invalid` / live-region / `role="alert"` all verified at light + dark
- Test goals from verification run are cleaned up by the script with batch-id-match guard
- Test account login verified for tenant_admin
- All open questions for Kyron are listed in plan / PR description
- `npm run lint` and `npm run build` both green
- Two-strike counter at 0 or surfaced if not

Post a summary in chat with: tree state, PR link, what's done (service + modal + CTA wire-up + first-commit doc bumps), test-goal cleanup confirmation, what's blocked on Kyron, two-strike counter status, and the closing line: "C3 ready for review. Track C complete pending merge."

## ✂ COPY ENDS HERE ✂

---

## Notes for Kyron (not part of the COPY)

- **C3 is the third and final PR of Track C.** C1 (#60) shipped branches collection. C2 (#61) shipped bulk user import. C3 ships bulk personal-commitment import. After C3 merges, Track C is complete and pilot-data-onboarding is unblocked.
- **C3 is the smallest of the three Track C PRs.** Reuses `setGoals` for write coordination + floor validation, scaffolding from C2 modal, `useFocusTrap` from C2. No new Cloud Function, no new Firestore collections, no new rules. Estimated ~half the surface of C2.
- **Test approach is contamination-free with batch-id-match guard.** Verification script discovers existing agents, generates test CSV in-memory, runs import, deletes test goal docs post-verification — but ONLY if each doc's `csvImportBatchId` matches the test batch's UUID. Defensive design prevents accidentally wiping a real agent's commitment if a mid-run race lands a manual write on the same doc.
- **Reuse boundary: copy from precedent.** Defer extracting `CsvImportModalShell` until a third consumer materializes. SS-2 commitment honored.
- **Pilot launch readiness is the goal.** After C3 merges + branch/unit managers set their layer's goals via P8C UIs, the gap-analysis surface is fully populated for pilot agents.
- **Audit-trail decision is consistent across Track C.** Per-doc fields (`setBy`, `updatedAt`, `csvImportBatchId`, `importedFromCsv`) — no separate audit-log collection.
- **Tenant_admin matrix verified before merge is the hard floor.**

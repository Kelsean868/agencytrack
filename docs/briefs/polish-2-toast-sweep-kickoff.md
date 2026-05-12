# POLISH-2 — Toast adoption sweep — kickoff brief

**Status:** First MEDIUM post-M-series PR. Path (A) MEDIUM queue, 1 of 4.
**Estimated CC effort:** Half-day to one day. Single PR.
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 0/2 (clean state).

---

## Context

Polish-1 (PR #114) built the Toast primitive infrastructure (Toast.jsx + ToastProvider.jsx + useToast.js + toastContext.js). Several surfaces have inline toast patterns predating the primitive — audit flagged them as future migration candidates. PR-4 migrated UserManagementPanel's inline toast during the user-edit work. Two confirmed remaining migration targets:

- **CampaignPanel.jsx** — inline toast for campaign actions
- **BranchesPanel.jsx** — inline toast for branch CRUD

Additionally, some save surfaces lack toast feedback entirely (silent saves can leave users uncertain). Phase 2 discovery should inventory ALL inline-toast patterns + all save surfaces lacking toast feedback to produce a complete migration + addition matrix.

**What this PR DOES:**
- Migrate confirmed inline-toast targets to the Polish-1 primitive (CampaignPanel + BranchesPanel + anything else discovery surfaces)
- Add toast feedback to save surfaces currently silent on success/error
- Consolidate toast patterns so future migrations are zero
- Preserve existing UX where SaveButton state already provides per-button feedback (don't add redundant global toasts)

**What this PR does NOT do:**
- Modify the Toast primitive itself (API stays)
- Add new variants beyond Polish-1's 4 (success/error/warning/info)
- Touch save business logic — only adds feedback to existing save paths
- Build offline-aware toast queuing or other infrastructure changes

**Closures expected in PR description** (not in FOLLOW_UPS.md):
- Resolves Polish-2 Toast adoption sweep from post-M-series MEDIUM backlog
- Note: Future inline toast patterns introduced by new features should use the primitive directly — no further sweeps needed if discipline holds

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -5`. HEAD should include the wizard-hardening-closeout docs PR squash at top (or R1 squash if docs PR ordering differed).
4. Confirm clean state: `git worktree list` shows only main + the stale TA-cleanup filesystem residue (per PR-4's banked finding — leave alone).
5. Create worktree at `.claude/worktrees/feat-polish-2-toast-sweep` on branch `feat/polish-2-toast-sweep`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery

### 2a — Inventory inline toast patterns

Grep the codebase for inline toast implementations. Patterns to search:
- `role="status"` and `role="alert"` outside the Toast primitive itself
- `aria-live` in component files
- Local `useState` patterns named `toast*`, `notification*`, `feedback*`, `successMessage*`, `errorMessage*`
- `setTimeout` patterns clearing local notification state (auto-dismiss pattern)
- Top-center / fixed-positioned notification divs

For each finding, capture:
- File path + line range
- What action triggers it
- Variant (success/error/warning/info equivalent)
- Whether it has an action button (Retry, Dismiss, etc.)
- Sticky vs auto-dismiss behavior

Expected confirmed targets (audit flagged):
- CampaignPanel.jsx
- BranchesPanel.jsx

There may be more — Phase 2 should produce a complete list.

### 2b — Inventory save surfaces without toast feedback

Search for save handlers without toast wiring:
- Settlement save (`src/components/settlements/` or similar)
- Persistency save (PersistencyEntryForm if any save action exists; manager-locked rules may limit this)
- Goal save (Unit/Branch goal save — M4 explicitly deferred Toast adoption to this sweep per the brief)
- User create save (UserManagementPanel's create flow — PR-4 migrated user-EDIT toast but check whether create also needs)
- Profile save (ProfileScreen)
- Wizard final submit (likely has different patterns — verify but probably already covered by R1 status indicator)

For each finding, capture:
- File path + save handler location
- Current feedback (SaveButton state? silent? inline error?)
- Whether a global toast would ADD value (some surfaces are fine with just SaveButton state)

### 2c — Existing Polish-1 primitive verification

1. Verify `useToast` hook still exists at `src/hooks/useToast.js`
2. Verify ToastProvider mounted at App.jsx root
3. Verify API matches Polish-1's spec:
   - `show({ message, variant, duration, action })` 
   - Returns toastId
   - `dismiss(toastId)` for programmatic dismissal
4. Confirm variants: success / error / warning / info

### 2d — Decision principle for "add toast vs leave silent"

A save surface benefits from a global toast when:
- Save is decoupled from the UI element that triggered it (e.g., bulk action, background save)
- Save success isn't otherwise visible (page doesn't navigate, UI doesn't change visibly)
- Failure recovery needs the user to take action elsewhere

A save surface does NOT need a toast when:
- SaveButton primitive already shows idle/saving/saved/error states ON THE BUTTON
- The successful save causes a visible UI change (record appears in list, etc.)
- Adding a toast would be redundant with existing feedback

Surface this principle's application per save handler in Phase 3.

---

## Phase 3 — Design + scope surface (STOP HERE — scope gate)

Output a structured surface:

```
DISCOVERY — Polish-2 Toast adoption sweep

INLINE TOAST PATTERNS INVENTORIED:

| File | Line range | Trigger | Variant | Migration target |
|------|------------|---------|---------|------------------|
| CampaignPanel.jsx | <range> | <action> | <variant> | useToast({ variant, message, [action] }) |
| BranchesPanel.jsx | <range> | <action> | <variant> | useToast(...) |
| <any others discovered> | | | | |

SAVE SURFACES WITHOUT TOAST (inventoried):

| File | Save handler | Current feedback | Recommended action |
|------|--------------|------------------|---------------------|
| <surface 1> | <handler> | <SaveButton states / silent / inline> | <add toast / leave silent — rationale> |
| <surface 2> | | | |

DECISION TABLE — per surface:

| Surface | Action | Variant | Rationale |
|---------|--------|---------|-----------|
| CampaignPanel inline → primitive | Migrate | per existing pattern | Audit-flagged migration |
| BranchesPanel inline → primitive | Migrate | per existing pattern | Audit-flagged migration |
| <save surface X> | Add | success/error | <one line rationale> |
| <save surface Y> | Leave silent | n/a | SaveButton state sufficient |

NEW / MODIFIED COMPONENTS:
- CampaignPanel.jsx — remove inline toast state + JSX, wire useToast
- BranchesPanel.jsx — same pattern
- <any other migration targets>
- <any save surfaces gaining toast>
- Test updates: existing tests should still pass; add coverage for new toast wires if non-trivial

SCOPE ESTIMATE:
- Files modified: <count>
- New files: <count, likely 0>
- Migration LOC: <est total — should be net negative since inline patterns are larger than useToast calls>
- New toast wires LOC: <est total>
- Total file count: <under 30 ceiling>

EDGE CASES:
- <Any inline toasts with non-standard shapes (e.g., warning-with-retry-action) — Polish-1's action: {label, onClick} should cover, but verify>
- <Any patterns where the inline behavior differs from primitive (e.g., position, duration) — surface for explicit decision>
- <Any modal-bound toasts that interact with focus management>

OPEN QUESTIONS FOR KELSEAN:
- For save surfaces that COULD have a toast but currently don't, confirm the add-or-leave-silent decisions
- For inline patterns with non-standard behavior (e.g., longer duration, sticky-until-dismissed), preserve via primitive's options OR normalize to primitive defaults?
- Any save surfaces that explicitly should NOT have toast (e.g., wizard auto-save would be noisy)?
- Mobile considerations — current Polish-1 toast position is top-center on all viewports; any surface where this conflicts visually?
```

**STOP at end of Phase 3.** Wait for Kelsean to:
- Confirm the migration matrix is complete
- Approve the add-or-leave-silent decisions per save surface
- Lock any non-standard behavior preservations
- Answer open questions
- Greenlight Phase 4

---

## Phase 4 — Implement (only after Phase 3 approval)

Build per locked design. Order:

1. **Migrations first** — replace inline toast state + JSX with useToast hook calls per surface
2. **Additions second** — add toast wires to save surfaces that gained them
3. **Tests** — verify existing tests still pass; add coverage for new wires if not covered

**Constraints (carry over):**
- Use Polish-1's Toast primitive as-is (no API changes)
- Preserve user-facing behavior where possible (same message, same variant, same action if any)
- Net negative LOC expected (primitive call < inline implementation)
- A11y baseline: primitive handles role/aria-live correctly; don't override

**No data layer changes.** Pure UX consolidation.

---

## Phase 5 — Tests

Required coverage:

- Existing tests on migrated surfaces should pass without modification (or with minor mock adjustments for useToast)
- New tests for added toast wires: verify save success fires success toast, save failure fires error toast
- Visual smoke: existing surfaces should look identical post-migration (Polish-1 primitive matches inline pattern visually)

`npm test` must remain 100% passing.

---

## Phase 6 — Production smoke (CC EXECUTES — non-negotiable per project standard)

Use `scripts/verification/lib/walk-helpers.mjs` setupBypassSession pattern.

### Smoke scope

1. **Migration verification:**
   - Sign in as appropriate role
   - Navigate to each migrated surface (CampaignPanel, BranchesPanel, etc.)
   - Trigger the action that fires the toast
   - Verify toast appears via Polish-1 primitive (DOM contains `role="status"` or `role="alert"` per variant)
   - Verify visual position (top-center per Polish-1 spec)
   - Capture screenshots mid-toast

2. **Addition verification:**
   - For each save surface gaining a toast, trigger save
   - Verify toast appears with appropriate copy + variant
   - For error cases, mock or force failure via route intercept and verify error toast fires

3. **Regression sweep:**
   - Existing toast surfaces (UserManagementPanel post-PR-4) still work
   - Other dashboards still render
   - No console errors anywhere

### Smoke gates

- All migration targets fire primitive toasts (not inline)
- All addition targets fire toasts on save
- No console errors
- No regression on previously-working toast surfaces

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit organization:
   - `refactor(campaigns): migrate inline toast to Polish-1 primitive`
   - `refactor(branches): migrate inline toast to Polish-1 primitive`
   - `feat(<surface>): add toast feedback on save success/error` (per addition)
   - `test: coverage for migrated and added toast wires`
5. Push, open PR titled: `refactor(ui): POLISH-2 — Toast adoption sweep`
6. PR description MUST include:
   - **Summary:** N inline toast migrations + M save-feedback additions; the Toast primitive is now the only toast pattern in the app
   - **Closes:** Polish-2 Toast adoption sweep from post-M-series MEDIUM backlog
   - **Decision table** (verbatim from Phase 3) showing all surfaces and their final state
   - **Smoke results** from Phase 6 — screenshots embedded
   - **Path (A) MEDIUM progress: 1/4 closed**
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 reveals MORE than 5 inline toast patterns to migrate → SURFACE; may need to split
- Phase 2 reveals a toast pattern with non-standard behavior that Polish-1 primitive can't represent → SURFACE; may need primitive extension (different scope)
- Any source code changes outside migration/addition targets → STOP
- Test suite regression → STOP
- CI gate fails → STOP and fix before requesting review
- ANY token appearance in any artifact → IMMEDIATE STOP
- Two strikes hit → STOP

---

## Out of scope

- Toast primitive API changes (new variants, new options)
- New ToastProvider features (e.g., toast queueing changes)
- Modifying SaveButton states (those are M1 territory)
- Other manager portal screens beyond toast touchpoints
- PR-4b user role/branch edits (separate PR)
- Branches Mgmt UI (separate PR)
- Audit trail infrastructure
- Updating `docs/FOLLOW_UPS.md` (housekeeping handles closures)

---

## What success looks like

After this PR merges:

1. The Toast primitive is the only toast pattern in the app — no inline toasts remain
2. Save surfaces that benefit from global feedback have it
3. Save surfaces where SaveButton state suffices stay clean (no redundant toasts)
4. Net negative LOC across the codebase (primitive call < inline implementation)
5. Future feature toasts have one clear pattern to follow
6. Path (A) MEDIUM progress: 1/4 closed; PR-4b next (role + branchId edits via Cloud Function)

This PR is small but architecturally clarifying. After it merges, the codebase has zero "but how does Component X show toasts?" ambiguity.

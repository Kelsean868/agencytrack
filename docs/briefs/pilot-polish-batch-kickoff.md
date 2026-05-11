# Pilot Polish PR #3 — Login logo + UX-N + BUG-N2 — kickoff brief

**Status:** Ready to execute. Third and final of three Pilot Polish PRs (Wizard UX ✓ → Mobile FU#1 ✓ → **this**).
**Estimated CC effort:** Under 1 day. Single PR, three unrelated small items batched.
**Two-strike counter:** 0/2 (fresh session).

---

## Context

Three independent low-risk polish items batched into one cheap PR before pilot launch:

1. **Login logo** — The AgencyTrack logo asset is sitting in `C:\Projects\AgencyTrack\public\` unused. The login screen currently has no logo or a placeholder. First impression every agent gets — should look polished.
2. **UX-N** — Empty-state copy on the Persistency tab when a user has no scope assigned (e.g., a unit manager with no `unitId` on their user doc, which Kelsean saw firsthand during BUG-N smoke). Current copy is functional but not actionable. Tracked as **UX-N** in `docs/FOLLOW_UPS.md` (added in PR #86).
3. **BUG-N2** — `firestore.rules` unitGoals write rule is missing `sales_manager` from the allowed roles. Per the 5-tier hierarchy (Agent → Unit Manager → Branch Manager → Sales Manager → Tenant Admin → Platform Admin), sales managers should logically have at least branch-manager-level write access. Kelsean confirmed sales managers WILL set unit goals during pilot, so this needs to land pre-pilot. Same one-line fix shape as PR #84 (BUG-N).

**Discipline:** discovery → surface → approve → implement, same as previous Pilot Polish PRs. Three items but all small — discovery should land in one combined surface output.

**Closures expected in this PR's description** (do NOT modify `docs/FOLLOW_UPS.md` — future housekeeping handles that):
- Closes **UX-N**
- Closes **BUG-N2**

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -3`. HEAD should include the PR #90 squash commit at top (or newer).
4. Confirm clean state: `git worktree list` shows only the main worktree. `git branch` shows only `main`.
5. Create worktree at `.claude/worktrees/feat-pilot-polish-batch` on branch `feat/pilot-polish-batch`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery (read-only, all three items in parallel)

### Item 1 — Login logo

1. List contents of `C:\Projects\AgencyTrack\public\` to identify the logo asset(s). Capture filename(s), extension, and approximate file size.
2. Read `src/components/LoginScreen.jsx` (or whatever the actual login component is — search broadly if the file name differs).
3. Identify:
   - Current state: is there any existing logo or placeholder? What does it render now?
   - Where in the component the logo should be placed
   - Dark mode considerations: is the asset light-mode-only (will it look bad on a dark background)? Are there separate light/dark variants in `public/`? Or is the asset theme-neutral?
4. Note any other places the logo might need to appear (sidebar header, mobile bottom-nav avatar, app icon) — but **out of scope** for this PR unless they're already broken. Just login screen.

### Item 2 — UX-N (empty-state copy)

1. Find the Persistency tab component that renders the "no scope assigned" empty state — likely `src/components/manager/PersistencyTab.jsx` or a sub-component.
2. Identify the exact current copy string. Capture it verbatim.
3. Plan the replacement copy (Kelsean has approved this exact string in advance):
   > **"Contact your branch manager to be assigned to a unit so you can view your unit's persistency data."**
4. Check if the same empty-state pattern is used elsewhere (Goals tab? Settlements?) — if so, surface but don't change without Kelsean's call.

### Item 3 — BUG-N2 (sales_manager unitGoals rule)

1. Open `firestore.rules`. Find the `match /unitGoals/{docId}` block (line ~209-223 per BUG-N diagnosis).
2. Identify the `allow write` rule's role list. Current state (per BUG-N fix):
   - `'platform_admin', 'tenant_admin'` in the first OR branch
   - `'branch_manager'` in the second OR branch
   - `'unit_manager'` in the third OR branch (with `callerUnitId(tenantId)` check, post BUG-N)
3. Confirm `'sales_manager'` is NOT currently in any of those branches.
4. Plan: add `'sales_manager'` to the same OR branch as `'branch_manager'` (logical equivalence — sales manager has at least branch-manager-level scope).
5. Verify the read rule (`allow read` or `allow get`) — does it ALREADY include sales_manager? If not, that's a parallel bug. Surface in Phase 3.

---

## Phase 3 — Surface findings + design proposal (STOP HERE)

Output a single structured summary in chat using this template:

```
DISCOVERY — Pilot Polish Batch #3

ITEM 1 — Login logo

Asset(s) in C:\Projects\AgencyTrack\public\:
  - <filename>: <size>, <format>
  - <filename2>: <size>, <format>
  - [list all files; flag any that look like logo candidates]

Current login screen state:
  - File: <path>
  - Current logo/placeholder: <description>
  - Proposed integration: <where the logo goes, dimensions, alt text>
  - Dark mode handling: <single asset / theme-aware / separate assets>
  - Files to touch: <list>

ITEM 2 — UX-N empty-state copy

Current copy location:
  - File: <path>, line: <n>
  - Current string: "<verbatim>"
  - Proposed replacement: "Contact your branch manager to be assigned to a unit so you can view your unit's persistency data."
  - Same pattern used elsewhere? <yes/no, where if yes — surface only, don't change>
  - Files to touch: <list>

ITEM 3 — BUG-N2 sales_manager unitGoals

Current write rule role list (paste verbatim):
  <paste current allow write block>

Proposed change:
  Add 'sales_manager' to the branch_manager OR branch.

Read rule check:
  - Does allow get / allow read currently include sales_manager? <yes/no>
  - If no, surface as BUG-N2-parallel (do NOT fix in this PR without Kelsean's confirmation — read access is a separate decision)

Files to touch: firestore.rules

Cross-cutting concerns:
- Any item that turned out to be more complex than expected? <list>
- Any item that exposes a parallel issue we should track? <list>

Estimated scope:
- Files modified: <count, target ≤6>
- New files: <count, likely 0>
- New tests: <count — probably 0 since rules tests aren't possible without TEST-N harness, and the other two items are visual>
- Risk assessment: LOW — three independent mechanical changes

Proposed scope for this PR:
  [confirm: ship all three items, no parallel bugs absorbed without Kelsean's approval]
```

**STOP at end of Phase 3.** Do not write any code. Wait for Kelsean's response.

---

## Phase 4 — Implement (only after approval)

After approval, implement per the approved design:

### Item 1 — Login logo

1. Add the logo to the login screen at the approved size/position.
2. Use `<img alt="AgencyTrack" />` with a meaningful alt text — NOT empty alt, NOT decorative role.
3. Ensure the asset is referenced via Vite's standard `/logo.svg` (or whatever the filename) path, served from `/public/`.
4. Dark mode: if single asset, apply CSS filter or test that it works on both backgrounds; if separate assets, conditional rendering via `useDarkMode` or equivalent hook.
5. Responsive: logo should scale appropriately at mobile (380px) and desktop. Use Tailwind responsive utilities.
6. No new dependencies. No new theme tokens.

### Item 2 — UX-N copy change

1. Single-line copy swap. The new string is approved verbatim above.
2. No structural changes to the empty-state component. Just the text.

### Item 3 — BUG-N2 rules fix

1. Add `'sales_manager'` to the role list in the `allow write` block.
2. Match existing formatting (spacing, ordering — sales_manager goes adjacent to branch_manager since they're in the same OR branch).
3. Add an inline comment: `// BUG-N2: sales_manager has at least branch_manager-level scope per 5-tier hierarchy`
4. Do NOT change `allow get` / `allow read` unless Phase 3 confirmed it needs the parallel fix AND Kelsean approved.

---

## Phase 5 — Tests

Limited test surface for this PR:

1. **Login logo** — visual change, no test added unless the component already has render tests (in which case, extend with an assertion that the logo renders with correct alt text).
2. **UX-N** — copy change, optional test asserting the new string appears in the empty-state component output (use the PersistencyTab or relevant component's existing test file if one exists).
3. **BUG-N2** — no test (no rules-testing harness exists; TEST-N follow-up tracks building one).

`npm test` must remain 100% passing.

---

## Phase 6 — Production smoke (new standard)

Three separate smoke surfaces — combine into one Playwright script.

### Pre-merge smoke (against Vercel preview)

Canonical bypass pattern (URL parameter, `samesitenone`, `domcontentloaded` — see `scripts/exploration-walk.cjs` for reference).

#### Login logo smoke
1. Navigate to the preview URL (logged out).
2. Take a screenshot of the login screen at 1440x900 (desktop) and 390x844 (mobile).
3. Inspect the DOM for `<img>` with alt="AgencyTrack" (or whatever the approved alt text).
4. Toggle dark mode (if possible from the login screen) and capture again.

#### UX-N smoke
1. Sign in as **Test Unit Manager** (the user without a `unitId` — Kelsean has verified this account exists and demonstrates the empty state).
2. Navigate to Persistency tab.
3. Capture screenshot of the empty state.
4. Verify the new copy string is present in the rendered DOM (text content match).

#### BUG-N2 smoke (real write-read-verify cycle — apply the standard)
1. Sign in as a **sales_manager** (if test credentials exist — surface if not).
2. Navigate to Goals tab or wherever unit goals are set.
3. Attempt to set a unit goal target.
4. Verify the save succeeds without permission errors.
5. **Hard reload** (`page.reload({ waitUntil: 'domcontentloaded' })`).
6. Re-open Goals tab.
7. **Verify the goal persisted from Firestore.**

If no sales_manager test credentials exist:
- Surface in Phase 3 along with the proposal
- Fall back to Firebase Rules Playground simulation (set up the playground with a sales_manager-claim user and confirm allow=true)
- Kelsean will run the real smoke post-merge manually

### Post-merge production smoke

Same procedure but against `https://agencytrack.vercel.app` after merge + Vercel rebuild + `firebase deploy --only firestore:rules` (Kelsean runs the rules deploy locally, per established pattern from PR #83/#84/#85).

Both smokes documented in PR body.

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit (recommend separate commits per item for clean history):
   - `feat(login): add AgencyTrack logo to login screen`
   - `feat(persistency): improve empty-state copy when no scope assigned (UX-N)`
   - `fix(bugn2): unitGoals rule — allow sales_manager writes`
5. Push, open PR titled: `feat(pilot-polish): login logo + UX-N empty-state + BUG-N2 sales_manager rule`
6. PR description MUST include:
   - **Three sub-sections** (one per item) with before/after screenshots or rule diffs
   - **Closes UX-N + BUG-N2** statement (no FOLLOW_UPS.md edit — future housekeeping handles that)
   - Pre-merge smoke results for all three items
   - **Reminder for Kelsean: requires `firebase deploy --only firestore:rules` post-merge** (BUG-N2 rules change won't take effect otherwise)
7. **STOP.** Do not merge. Kelsean reviews, merges, deploys rules, smokes.

---

## Hard stops

- Phase 2 discovery surfaces a parallel issue requiring schema or significant code change → STOP and surface; we'll re-scope
- The logo asset is missing from `public/` or is in an unexpected format (e.g., a PSD) → STOP and surface
- Dark-mode logo handling requires more than a single CSS rule or simple conditional render → STOP and surface (could need a second asset added to `public/`, that's an asset workflow Kelsean should handle)
- BUG-N2 read rule actually needs sales_manager too (parallel scope) → SURFACE and ask before absorbing
- No sales_manager test credentials → surface in Phase 3, plan fallback smoke
- Any change needed outside `firestore.rules`, the login component, or the persistency empty-state component → STOP and surface
- Test suite regression → STOP
- CI gate fails → STOP and fix before requesting review
- Two strikes hit → STOP

---

## Out of scope

- Logo placement anywhere other than the login screen (sidebar header, app icon, favicon — separate scope each)
- Other empty-state copy improvements (only the one Persistency tab message)
- Any other rules changes
- Building rules-testing harness (TEST-N, separate PR)
- Touching `docs/FOLLOW_UPS.md` (housekeeping handles closures)
- Touching the brief docs in `docs/briefs/`
- Walk script changes (WALK-1, separate)

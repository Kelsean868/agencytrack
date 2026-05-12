# Manager Portal Revamp — M4: Goals IA flatten + GapAnalysisPanel surfacing — kickoff brief

**Status:** Ready to execute. Fourth PR in the M-series. Largest remaining IA + UX refactor.
**Estimated CC effort:** 2–3 days. May split into M4a/M4b based on Phase 3 scope discovery.
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 0/2 (clean state post-WALK-3 + clean execution through M3 + Polish-1).

---

## Context

Per the manager portal audit (recommendation #3, P0/large): "Goals tab IA flatten + GapAnalysisPanel surfacing — collapse the 3-level nav to 2, swap stacked agent forms for expand/collapse, surface GapAnalysisPanel at the top so managers can see their cascade. Inputs to h-11 (44px)."

**The IA problem (locked answer from audit Q3 = Option b):** Currently Goals nav is 3-level deep:
- Goals tab → My Production / My Unit (outer sub-tabs)
- My Unit → Agent Goals / Unit Goals / Branch Goals (inner sub-tabs)

The fix: **single sub-tab row** (Self / Agent / Unit / Branch), role-gated. Matches the Awards tab shape and uses M1's TabPills primitive. Sidebar real estate stays clean — role-gating already exists in the data layer.

**The UX problems** beyond IA:
- AgentGoalsTab stacks all agents with full forms — 8 agents = 1000+px scroll per audit
- NumInput is h-9 (36px) — violates 44px touch target on mobile
- 3 different Save button shapes (now unified by M1's SaveButton primitive but consumer wiring may not match yet)
- GapAnalysisPanel exists in the agent portal but isn't surfaced for managers to see their goal-setting cascade

**Pre-approved design decisions** (from audit Phase 3, locked in M2's review):
- IA: single sub-tab row gated by role (Q3 = Option b)
- Sub-tabs: **Self** (manager's own commitment + GapAnalysisPanel) / **Agent Goals** (per-agent, expand/collapse) / **Unit Goals** / **Branch Goals**
- Role visibility:
  - unit_manager sees: Self, Agent, Unit
  - branch_manager+ sees: Self, Agent, Unit, Branch
- GapAnalysisPanel surfaces at the top of Goals tab so managers see how their goal-setting feeds into the cascade

**Closures expected in PR description** (not in FOLLOW_UPS.md — housekeeping handles):
- Resolves audit recommendation #3 (Goals IA flatten + GapAnalysisPanel surfacing)

**What stays unchanged:**
- Goal eligibility computation logic (existing services untouched)
- 5-layer goal hierarchy (Company Floor → Sales Manager Target → Branch Target → Unit Target → Personal Commitment) — current state preserved
- CommissionPlayground component (surfacing within Goals tab may move; the component itself stays)

**M4 does NOT add:**
- The Sales Manager Target layer (Phase 9 work, post-pilot per memory)
- A 5th GapAnalysisPanel layer (Phase 9)
- New goal fields or schema changes

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -5`. HEAD should include the Polish-1 squash commit at top, with M3 below.
4. Confirm clean state: `git worktree list` shows only main; `git branch` shows only `main`. Apply surface-before-act discipline for any stale worktrees.
5. Create worktree at `.claude/worktrees/feat-m4-goals-ia-flatten` on branch `feat/m4-goals-ia-flatten`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery

This is the second-longest discovery phase in the M-series (after M2). The IA refactor touches multiple components with intertwined state; getting the design right in Phase 3 prevents expensive rework.

### 2a — Source-of-truth documents

1. `docs/design/manager-portal-recommendations.md` — re-read the Goals tab section in full
2. `mocks/manager-portal-concepts.html` — open in browser, study the Goals mock if present (mock priority list included Goals per audit Phase 3 approval). This is the visual target.

### 2b — Current Goals surface

Read all of these in full. Capture file:line for each finding:

1. `src/components/dashboard/ManagerDashboard.jsx` — find the My Production / My Unit outer sub-tab structure (per memory, lines 285-340 area). Map out:
   - State management for outer sub-tab (`goalsSubTab` or similar)
   - JSX block that renders the outer sub-tabs
   - How the outer sub-tab gates which content shows
2. `src/components/goals/GoalsPanel.jsx` — read in full (~624 lines per audit). Capture:
   - The 3 internal tabs (Agent / Unit / Branch) and their state management
   - The role gating logic (`canSeeBranch`, `canSeeUnit`, etc.)
   - The 3 internal Save button patterns (post-M1, should be using SaveButton primitive — verify)
3. `src/components/goals/AgentGoalsTab.jsx` (or wherever the per-agent form stack lives) — capture:
   - How the agents list renders (map over user list?)
   - Per-agent form structure
   - NumInput component reference
   - Save handling per agent
4. `src/components/goals/UnitGoalsTab.jsx` — capture similar
5. `src/components/goals/BranchGoalsTab.jsx` — capture similar
6. `src/components/goals/CommissionPlayground.jsx` — capture:
   - Current placement and integration
   - Whether it lives inside My Production sub-tab today
   - Whether it needs to move with the IA flatten

### 2c — GapAnalysisPanel current state

1. `src/components/dashboard/GapAnalysisPanel.jsx` — read in full. Capture:
   - Props/API
   - Current consumers (agent dashboard?)
   - Current 4-layer hierarchy rendering
   - Loading/empty states
2. Identify where GapAnalysisPanel currently renders for agents — the goal is to surface it for managers too, but in a manager-relevant context.

### 2d — NumInput / input touch targets

1. Find `NumInput` (or equivalent numeric input component used in Goals). Audit:
   - Current height (h-9 = 36px per audit finding)
   - Whether bumping to h-11 (44px) affects layout density
   - Whether this is a shared component used elsewhere
2. If NumInput is used in other surfaces (Settlements, Persistency, etc.), bumping height affects them too — surface in Phase 3 for explicit scope decision

### 2e — Expand/collapse pattern research

The audit recommends "expand/collapse" for AgentGoalsTab (one agent's form visible at a time instead of all stacked). Options:
1. Native HTML `<details>` + `<summary>` — simplest, accessible by default, no JS state
2. Custom React component with useState — full control, custom styling
3. Existing accordion in the codebase? — check if MobileNavDrawer or any similar component has an accordion shape that could be reused/extracted

Surface the chosen approach in Phase 3 with rationale.

---

## Phase 3 — Design + scope surface (STOP HERE — critical approval gate)

Output a structured surface using this template:

```
DISCOVERY — M4 Goals IA flatten + GapAnalysisPanel surfacing

CURRENT IA (3-level nav):
- File: <path>
- State: <outer sub-tab state + inner sub-tab state>
- Visual structure: <description>
- Role gating: <how UM vs BM+ visibility is implemented>

PROPOSED IA (single sub-tab row):
- TabPills items per role:
  - unit_manager: <list>
  - branch_manager+: <list>
  - sales_manager+: <list, current state>
  - tenant_admin: <list>
- Sub-tab id mapping: <how new ids map to current data flow>
- Files modified for IA collapse: <list>

SELF SUB-TAB (the new piece):
- What renders inside Self? <e.g., GapAnalysisPanel + the manager's Personal Commitment form + CommissionPlayground?>
- Is CommissionPlayground moved here from My Production?
- Layout shape: <stacked sections, g4-mix two-column, etc.>

GAPANALYSISPANEL SURFACING:
- Current consumer: <agent dashboard / which file>
- Manager context adaptation: <does it need new props for manager scope?>
- Placement in Goals tab: <inside Self only, or above all sub-tabs as global context>
- 4-layer hierarchy preserved (Sales Manager layer deferred to Phase 9)

AGENT GOALS — EXPAND/COLLAPSE:
- Approach: <native <details> / custom React / extracted accordion>
- Rationale: <one paragraph>
- Reusable elsewhere? <yes/no — could become a shared primitive>
- Expand state management: <single-expanded-at-a-time vs. multi-expand>
- Save state visualization per row: <unsaved indicator, last-saved timestamp, etc.>

UNIT GOALS + BRANCH GOALS — minimal changes:
- These don't have the "stacked forms" problem (single form per scope)
- Refactor surface: form input heights h-9 → h-11
- Any other changes? <list>

NUMINPUT / h-11 BUMP:
- File: <path>
- Current height: h-9 (36px)
- Proposed: h-11 (44px)
- Shared with other surfaces? <list>
- If shared: bumping affects them too — explicit scope decision required:
  - (a) Bump globally (cleanest, but expands scope to other surfaces)
  - (b) Bump only in Goals usage (create a variant or use Tailwind className override)
- Recommendation: <a or b>

CSS TOKENS / DESIGN LANGUAGE:
- Uses existing Nexus tokens
- M1 primitives used: TabPills (sub-tabs), SaveButton (per-row saves), Avatar (agent rows)
- Any new design tokens needed? <no/yes — surface if yes>

NEW / MODIFIED COMPONENTS:
- ManagerDashboard.jsx: <modifications — outer sub-tabs removed, Goals tab passes directly to GoalsPanel>
- GoalsPanel.jsx: <heavy refactor — new sub-tab structure, Self sub-tab content composition>
- AgentGoalsTab.jsx: <expand/collapse refactor>
- UnitGoalsTab.jsx: <h-11 bump>
- BranchGoalsTab.jsx: <h-11 bump>
- GapAnalysisPanel.jsx: <props extension if needed for manager context>
- NEW (if needed): <expand/collapse component if extracted, ManagerSelfPanel if separated>

DATA FLOW:
- All existing services unchanged
- Existing hooks unchanged
- One new derived value: <if any — e.g., per-agent unsaved-state tracking>

SCOPE ESTIMATE:
- Files modified: <count>
- New files: <count>
- New tests: <count>
- Lines changed (net): <estimate>
- Total file count: <under 30 ceiling>

SHOULD M4 BE SPLIT?
- M4a (IA flatten + GapAnalysisPanel surfacing + h-11 bump): <yes/no, why>
- M4b (AgentGoalsTab expand/collapse refactor): <yes/no, why>
- Recommendation: <single PR or split>

OPEN QUESTIONS FOR KELSEAN:
- <list any decisions that need a human design call>
- <e.g., "Does Self sub-tab also show CommissionPlayground, or should that be a separate route/surface?">
- <e.g., "Expand/collapse — single-expanded-at-a-time (cleaner) or multi-expand (faster for editing multiple agents)?">
- <e.g., "h-11 bump scope — Goals-only or codebase-wide for NumInput?">
- <e.g., "GapAnalysisPanel placement — inside Self only, or above all sub-tabs as persistent context?">
```

**STOP at end of Phase 3.** Wait for Kelsean to:
- Lock the Self sub-tab composition
- Approve the expand/collapse approach
- Decide NumInput bump scope
- Confirm GapAnalysisPanel placement
- Answer open questions
- Confirm single vs split PR
- Greenlight Phase 4

---

## Phase 4 — Implement (only after Phase 3 approval)

Build order recommended:

1. **IA flatten foundation** — collapse the outer sub-tabs in ManagerDashboard; route directly to GoalsPanel
2. **GoalsPanel sub-tab restructure** — new TabPills with role-gated items, Self/Agent/Unit/Branch
3. **Self sub-tab implementation** — compose GapAnalysisPanel + manager's Personal Commitment (+ CommissionPlayground if Phase 3 locked that)
4. **Agent expand/collapse** — refactor AgentGoalsTab to the chosen pattern
5. **Unit/Branch tabs** — h-11 input bump (minimal touch)
6. **GapAnalysisPanel adaptation** — if manager-context props are needed
7. **Tests** — RTL coverage for the new sub-tab structure + Self composition + expand/collapse behavior

**Constraints (carry over):**
- Use M1 primitives (TabPills for sub-tabs, SaveButton for save actions, Avatar for agent rows)
- Use existing Nexus tokens — no new ones
- 44px touch targets for interactive elements (including the h-11 input bump)
- Dark mode parity throughout
- `prefers-reduced-motion` respected for any expand/collapse animation
- Functional components, useMemo/useCallback for expensive derivations
- A11y baseline: ARIA roles for expand/collapse (aria-expanded, aria-controls), focus management when expanding

**Zero behavior change to goal eligibility/computation logic.** Only IA + visual changes. If you find pre-existing bugs in goal services or computations, log as follow-ups in PR description.

---

## Phase 5 — Tests

Cover key surfaces with RTL:

- New sub-tab structure: renders correct items per role, TabPills value/onChange wiring works
- Self sub-tab: GapAnalysisPanel renders + (if included) Personal Commitment form renders + (if included) CommissionPlayground renders
- Agent expand/collapse: clicking a row expands, clicking again collapses, multiple agents expandable (per Phase 3 decision)
- Per-agent SaveButton: idle / saving / saved states fire correctly
- Role gating: unit_manager doesn't see Branch tab, etc.

Scaffold from existing test patterns (MobileNavDrawer.test.jsx, ToastProvider.test.jsx).

`npm test` must remain 100% passing.

---

## Phase 6 — Production smoke (CC EXECUTES — non-negotiable, per project memorialized standard)

Use `scripts/verification/lib/walk-helpers.mjs` setupBypassSession pattern (cookie-after-handshake — direct buildBypassUrl calls forbidden).

### Smoke scope

1. **Goals tab IA verification (primary):**
   - Sign in as test branch manager (use A11Y_SALES_MANAGER_EMAIL or properly-roled account)
   - Navigate to Goals tab
   - Verify single sub-tab row (Self / Agent / Unit / Branch) renders — no 3-level nesting
   - Click through each sub-tab — content renders correctly
   - Capture screenshots at desktop (1440x900) and mobile (390x844), light + dark — minimum 16 screenshots (4 sub-tabs × 2 viewports × 2 modes)

2. **Agent expand/collapse verification:**
   - On Agent Goals sub-tab, click an agent row → expands to show form
   - Click again → collapses
   - Tab through expanded form — focus moves through inputs correctly
   - Verify h-11 inputs (programmatic: `getBoundingClientRect().height >= 44`)
   - Save an agent's goals (real Firestore write) → SaveButton shows saving → saved state → hard reload → verify persistence
   - This is a write-read-verify cycle exercising the full save path

3. **GapAnalysisPanel surfacing verification:**
   - Navigate to Self sub-tab
   - GapAnalysisPanel renders with 4 layers (Company Floor → Branch → Unit → Personal)
   - Manager's actual goal-setting reflects in the cascade

4. **Role gating verification:**
   - If a unit_manager test account exists, verify they see only Self/Agent/Unit (no Branch)
   - If not feasible, document the role-gating logic verified via tests only

5. **Other manager screens regression sweep:**
   - Overview (M2 hero), Awards (M3 medals), Persistency, Settlements — quick desktop-light pass — confirm no M4-induced regressions

### Smoke gates

- All 16+ Goals screenshots show the new single sub-tab row IA
- Expand/collapse works smoothly at mobile and desktop
- Write-read-verify cycle for agent goals save passes
- No console errors anywhere
- No regression on other manager surfaces

If smoke fails:
- IA broken / sub-tabs missing → fix in scope
- Expand/collapse issue → fix in scope
- Write-read-verify failure → STOP and surface (could be data layer regression)
- Other regressions → STOP and surface

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing (existing 504+ new tests must pass)
4. Commit organization (logical chunks):
   - `refactor(manager-revamp): M4 — collapse Goals outer sub-tabs in ManagerDashboard`
   - `feat(manager-revamp): M4 — single sub-tab row in GoalsPanel (Self/Agent/Unit/Branch by role)`
   - `feat(manager-revamp): M4 — Self sub-tab composes GapAnalysisPanel + Personal Commitment`
   - `feat(manager-revamp): M4 — AgentGoalsTab expand/collapse refactor`
   - `style(goals): bump goals inputs to h-11 for touch target compliance`
   - `test(manager-revamp): RTL coverage for M4 IA + Self composition + expand/collapse`
5. Push, open PR titled: `feat(manager-revamp): M4 — Goals IA flatten + GapAnalysisPanel surfacing + agent expand/collapse + h-11 inputs`
6. PR description MUST include:
   - **Summary:** 3-level nav collapsed to single sub-tab row; agent goal forms moved to expand/collapse; GapAnalysisPanel surfaces for managers; inputs touch-target compliant
   - **Closes:** audit recommendation #3
   - **IA before/after diagram or screenshots**
   - **Role visibility matrix** (sub-tabs per role)
   - **Smoke results** from Phase 6 — screenshots embedded
   - **Test coverage** counts
   - **Built on Polish-1's Toast primitive** if any save toast usage was added (likely yes per audit's "use Toast for goal save feedback" intent — though this is M4-internal, not a Toast adoption sweep)
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 reveals state management in ManagerDashboard or GoalsPanel is significantly more complex than the audit suggested → STOP and surface; may need re-scope
- Phase 3 surface estimate exceeds 30 file ceiling → STOP and propose M4a/M4b split
- Phase 4 expand/collapse implementation requires a new library or significant new patterns → STOP and surface (built-in HTML <details> or simple React state should suffice)
- Phase 5 tests fail in ways that suggest data layer regression → STOP and surface
- Phase 6 write-read-verify cycle for agent goals save fails → STOP and surface (production data issue)
- Any source code changes outside Goals + GapAnalysisPanel + ManagerDashboard IA wiring → STOP
- Test suite regression → STOP
- CI gate fails → STOP and fix before requesting review
- ANY token appearance in any artifact → IMMEDIATE STOP
- Two strikes hit → STOP

---

## Out of scope

- Sales Manager Target layer in GapAnalysisPanel (Phase 9, post-pilot per memory)
- 5th layer addition to GapAnalysisPanel (Phase 9)
- New goal fields or schema changes
- Refactoring CommissionPlayground beyond its placement (its internals stay as-is)
- Migrating other inline toast patterns (separate "Polish-2 Toast adoption sweep" PR — out of scope here)
- Other manager portal screens (M5 next)
- Modifications to goal eligibility/computation services
- Rules changes (M4 is read + write on existing collections; rules already permit these for current roles)
- Schema migrations
- TenantAdminDashboard Goals surface (separate scope)
- Walk script changes
- Updating `docs/FOLLOW_UPS.md` (housekeeping handles closures)

---

## What success looks like

After this PR merges:

1. Goals tab has a single sub-tab row (Self / Agent / Unit / Branch), role-gated — no more 3-level nesting
2. AgentGoalsTab shows agents in expand/collapse rows — no more 1000+px scroll for 8 agents
3. GapAnalysisPanel surfaces inside the Self sub-tab so managers see how their goal-setting cascades
4. All goal inputs are touch-target compliant at 44px
5. M-series is 4/5 complete; only M5 (WeeklyChampionsBanner upgrade) remains
6. The audit's recommendation #3 closes

This is the largest IA refactor in the M-series. Doing it right means the Goals tab becomes the polished, productive surface managers expected from day one.

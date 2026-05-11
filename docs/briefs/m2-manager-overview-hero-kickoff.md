# Manager Portal Revamp — M2: Manager Overview hero — kickoff brief

**Status:** Ready to execute. Second PR in the M-series. First major visible redesign after M1's primitives shipped.
**Estimated CC effort:** 2–3 days. May be a single large PR or split (M2a/M2b) based on Phase 3 scope discovery.
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 2/2 (E5 + C3). Workflow operates at tolerance ceiling — next process violation triggers hard stop.

---

## Context

PR #102 hid the hardcoded placeholder stats on Manager Overview with a "Branch metrics coming soon" empty-state card before pilot launch. This PR (M2) replaces that placeholder with the real hero design recommended in the manager portal audit (PR #103).

**The replacement is composite:** four distinct surface additions plus the placeholder removal, mirroring the agent portal's post-Track-B-v2 dashboard pattern:

1. **Team YTD role-hero + donut** — gradient banner with Team YTD API vs Team Goal, similar to the agent portal's `.role-hero` + `.hero-donut` pattern from B2
2. **4-item KPICard sparkline strip** — compliance trend, API trend, apps trend, FFI trend, each with 4-week sparkline + W/W pulse-pill comparison (mirrors AgentDashboard's KPI grid)
3. **Activity feed (g4-mix left)** — recent branch events (submissions, agent badges earned, goals hit) with categorical pills, capped at 25 items in last 7 days
4. **Team award medals (g4-mix right)** — most recently earned agent achievements rendered as BadgeGrid-style medallions

**Real data behind all of it.** No more placeholders. This requires Firestore aggregation work on top of the visual redesign.

**Pre-approved design decisions** (from audit Phase 3, locked):
- Donut shows Team YTD API vs Team Annual Goal (decided in Q2 — Option iii)
- 4 KPIs: compliance-rate / API / apps / FFI (decided in Q2)
- W/W pulse pills consistent with agent portal pattern
- Uses Nexus tokens, no new design system

**Closures expected in PR description** (not in `docs/FOLLOW_UPS.md` — housekeeping handles that):
- Closes the placeholder-card patch from PR #102 (this PR removes the placeholder entirely)
- Resolves audit recommendation #1 (Manager Overview hero)

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -5`. HEAD should include PR #105 (M1 shared primitives) at top.
4. Confirm clean state: `git worktree list` shows only main; `git branch` shows only `main`. If any stale worktrees exist from prior M-series work, remove cleanly (check for uncommitted changes first per the surface-before-act discipline — same protocol as PR #105's Phase 1).
5. Create worktree at `.claude/worktrees/feat-m2-manager-overview-hero` on branch `feat/m2-manager-overview-hero`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery

This is a deep discovery phase. M2 has the most architecture-relevant decisions in the entire M-series — every downstream M-PR will reference these patterns.

### 2a — Read source-of-truth documents

1. `docs/design/manager-portal-audit.md` — re-read the Manager Overview section + cross-cutting observations
2. `docs/design/manager-portal-recommendations.md` — re-read recommendation #1 in full
3. `mocks/manager-portal-concepts.html` — **open in browser, study the Overview mock carefully**. This is the visual target.

### 2b — Agent portal hero pattern (the design language to extend)

Read these to understand the existing patterns M2 should mirror:

1. `src/components/dashboard/AgentDashboard.jsx` — full read. Focus on:
   - The role-hero + goal carousel section (top of dashboard)
   - The KPI sparkline grid with W/W comparison pills
   - The g4-mix layout (activity feed + badge grid side-by-side)
2. `src/index.css` — the design tokens + class definitions for:
   - `.role-hero` + `.role-hero::before/::after` (gradient banner with decorative blobs)
   - `.hero-donut` (period-switching donut hero)
   - `.bar` + `.bar-fill` (thin progress primitive used in hero)
   - `.g4-mix` (1.6fr / 1fr two-column layout)
   - `.activity-list` + `.activity-icon` + `.activity-pill` (with 4 categorical variants)
   - `.badge-grid` + `.badge-medal` + `.medal-1..8` (medal palettes)
3. `src/components/dashboard/KPICard.jsx` (or wherever the agent's KPI cards live) — understand its props, sparkline rendering (Recharts), and W/W pill component
4. `src/components/dashboard/ActivityFeed.jsx` (or wherever activity feed lives) — understand the event categorization, pill colors, item shape, time bucketing

### 2c — Firestore data architecture (what queries you'll need)

Read the existing services to map out what's already fetchable vs. what needs new query work:

1. `src/services/managerService.js` — what does `getAllYTDSubmissions()`, `getTenantUsers()` return? Are aggregations done client-side or in Cloud Functions?
2. `src/services/submissionService.js` — weekly submission queries; what's the shape of a submission doc?
3. `src/services/goalsService.js` — `getBranchGoals(tenantId, year)`, `getUnitGoals(...)`, `getGoalHierarchy(...)` — what's available for "Team Annual Goal"?
4. `src/services/awardsService.js` (if exists) or wherever badges/awards are tracked — what surfaces can be aggregated for "team award medals"?
5. `src/hooks/` — any existing hooks like `useAgentMetrics`, `useSubmissions`, `useBranchMetrics`?

### 2d — Current Manager Overview state

1. `src/components/dashboard/ManagerDashboard.jsx` — read in full. Map out:
   - The placeholder card from PR #102 (what gets replaced)
   - The MotivationalCarousel (does it stay? per audit recommendation: replaced by hero, but verify)
   - The "Submit Weekly Report" button (stays, repositioned)
   - The current tab structure (does Overview-tab content match what the hero is replacing?)
2. Find the existing `branchId` access pattern — how does ManagerDashboard know which branch to scope to? (`useAuth().branchId`, prop passed from Shell, etc.)

### 2e — Define the four KPIs precisely

The audit's "Q2 = Option iii" decision specified 4 KPIs but they need exact definitions for implementation. Propose definitions during Phase 3 surface; my Phase 3 review will lock them. Likely shapes:

- **Compliance trend** — % of agents in branch who submitted for the week. 4-week trend. W/W = this-week % vs last-week %.
- **API trend** — total branch API submitted per week. 4-week trend. W/W = this-week sum vs last-week sum.
- **Apps trend** — total branch apps submitted per week. Same shape as API.
- **FFI trend** — total branch Fact Finding Interviews per week. Same shape as API/apps.

If any of these don't have a clean Firestore aggregation path, surface alternatives.

---

## Phase 3 — Design + scope surface (STOP HERE — critical approval gate)

This is the most consequential approval gate in M2. Get the design + data plan right here and Phase 4 is mechanical; get it wrong and implementation rework is expensive.

Output a single structured surface using this template:

```
DISCOVERY — M2 Manager Overview hero

DESIGN LANGUAGE EXTENSION:
- Hero layout: <description, referencing .role-hero pattern>
- Donut: <library/approach, e.g., "matches AgentDashboard's hero-donut">
- KPI strip: <count, layout, sparkline library, W/W pill component>
- Activity feed: <event shape, categorical pills>
- Team medals: <medal source, badge component to use>
- Removed elements: <MotivationalCarousel? Submit button position?>

DATA ARCHITECTURE:
- Branch scope resolution: <how the Overview knows which branch to aggregate>
- Submissions aggregation:
  - Source: <Firestore path, query shape>
  - Aggregation: client-side or Cloud Functions? <reasoning>
  - Performance estimate: <expected doc count, ms estimate>
- Team Annual Goal:
  - Source: <branchGoals collection, sum of agent goals, fallback>
  - What happens if not set?
- KPIs (exact definitions):
  - Compliance trend: <formula>
  - API trend: <formula>
  - Apps trend: <formula>
  - FFI trend: <formula>
- Activity feed events:
  - Sources: <submissions, badges, goals — what queries>
  - Categorization: <which kind goes to which pill color>
  - Recency cap: <last N days, max N items>
- Team award medals:
  - Source: <where team-level achievements live>
  - Selection: <recent N, top N, etc.>

NEW COMPONENTS (Phase 4 build list):
- ManagerHeroDonut.jsx (or extension of existing): <description>
- BranchKPIStrip.jsx: <description, uses ui/KPICard? new file?>
- BranchActivityFeed.jsx: <reuses ActivityFeed or new>
- TeamMedalsPanel.jsx: <reuses BadgeGrid or new>
- New service functions: <list any new ones needed in managerService.js>
- New hook (if appropriate): useBranchOverview(branchId) — composes all 4 sections' data?

REAL-DATA WIRING PLAN:
- Component-tree data flow: <where queries fire, where they're cached>
- Loading states: <skeleton patterns per section>
- Error states: <what shows if data fails>
- Empty states: <what shows when branch has no agents, no submissions, etc.>

SCOPE ESTIMATE:
- New files: <count, new components + services + hooks>
- Modified files: <count, primarily ManagerDashboard.jsx + ManagerOverviewTab.jsx>
- New tests: <count + which components get RTL coverage>
- Removed code: <count, placeholder card from PR #102>
- Total file count: <number — must be under 30 per project ceiling>

SHOULD M2 BE SPLIT?
- M2a (data layer + donut + KPI strip): <yes/no, why>
- M2b (activity feed + team medals): <yes/no, why>
- Recommendation: <single PR or split>

OPEN QUESTIONS FOR KELSEAN:
- <list any decisions that need a human design call>
- <e.g., "Should the donut show 'YTD vs Annual Goal' or 'Quarter vs Quarter Goal'? Audit said annual, but quarterly aligns better with branch incentive cadence.">
- <e.g., "If Team Annual Goal isn't set, fall back to sum of agent goals, or company minimum × agent count?">
```

**STOP at end of Phase 3.** Wait for Kelsean to:
- Approve KPI definitions
- Lock the data architecture decisions
- Confirm single vs split PR
- Answer open questions
- Greenlight Phase 4

---

## Phase 4 — Implement (only after Phase 3 approval)

After approval, build per the locked design. Order recommended:

1. **Data services / hooks first** — build the Firestore aggregation layer + any new hooks. Test these in isolation.
2. **Section components** — ManagerHeroDonut, BranchKPIStrip, BranchActivityFeed, TeamMedalsPanel. Each is a discrete component with its own tests.
3. **Wire into ManagerDashboard** — replace the PR #102 placeholder section with the new composite. Remove MotivationalCarousel if audit/Phase 3 confirmed removal. Reposition "Submit Weekly Report" button per design.

**Constraints (carry over from M1):**
- Use M1 primitives where applicable (Avatar in activity feed, StatusPill for status indicators, TabPills if any sub-views, ConfirmDialog if needed, SaveButton not applicable here)
- Use existing Nexus tokens — no new ones unless absolutely required (surface to Kelsean if needed)
- Functional components, useMemo/useCallback for expensive aggregations
- 44px touch targets for interactive elements
- Dark mode parity throughout
- `prefers-reduced-motion` respected for any animations
- A11y baseline: ARIA roles, focus-visible rings, keyboard support

**Hard rule for data layer:**
- All Firestore reads through service files, not in components directly (per CLAUDE.md)
- Client-side aggregation must be memoized — branches can have 20+ agents × 52 weeks × multiple metrics; recomputing on every render kills performance
- Loading states everywhere — never show partial UI that looks broken during fetch

**No source code changes outside the components and services this PR adds.** If you find pre-existing bugs in adjacent code, log as follow-ups in PR description.

---

## Phase 5 — Tests

Cover each new section component with RTL tests using M1 SaveButton/Avatar/etc. test files as scaffold templates:

- `ManagerHeroDonut.test.jsx` — donut renders, progress fills correctly, edge cases (0%, 100%, > 100% overflow)
- `BranchKPIStrip.test.jsx` — 4 cards render, sparklines render, W/W pulse pills show correct comparisons, loading states render
- `BranchActivityFeed.test.jsx` — items render, categorical pills match event type, empty state renders
- `TeamMedalsPanel.test.jsx` — medals render, empty state when no awards

**Service tests** for new aggregation functions (if added to managerService.js or similar).

`npm test` must remain 100% passing including the existing 427 tests from M1.

---

## Phase 6 — Production smoke (CC EXECUTES this — not handed off)

**Critical clarification from M1's process note:** CC runs Phase 6 against the Vercel preview before opening the PR. Smoke results go into the PR description. Do not defer to Kelsean — that's a phase skip.

Use `scripts/verification/lib/walk-helpers.mjs` (the WALK-1 hardened helpers).

### Smoke scope

1. **Agent portal regression** — sign in as test agent (`kelsean@gmail.com`). Walk through AgentDashboard. Confirm no regressions from M2's changes to ManagerDashboard's data services (some services may be shared).
2. **Manager Overview hero — primary verification surface:**
   - Sign in as test branch manager
   - Land on Overview tab
   - Capture screenshots at desktop (1440x900) and mobile (390x844)
   - Capture light + dark mode
   - Total 4 screenshots minimum for Overview
   - **Programmatic checks:**
     - No hardcoded numbers from the old placeholder (`8`, `5`, `3`, `384000`, `960000`) in DOM
     - Donut renders with non-zero data (test agent's branch has real submissions)
     - 4 KPI cards render with real numbers
     - Activity feed renders with at least one event (or empty state correctly)
     - Team medals section renders with content or empty state correctly
     - No console errors
3. **Other manager screens** (regression sweep):
   - Team tab, Goals tab, Persistency tab, Settlements tab — confirm M1 primitives still render correctly on these surfaces (light mode, desktop only — fast pass)

### Real write-read-verify cycle

If any new Firestore writes are introduced in M2 (e.g., a "favorite this view" toggle or similar), apply the WALK-1 write-read-verify standard. If M2 is purely read-only on the Manager Overview hero (likely), skip the write-cycle — but document this in the PR description so reviewers know.

### Smoke gates

- Visual: no unexpected layout shifts, color drift, or component disappearance. Acceptable diffs: any places where the new hero replaces older surfaces — flag as intentional in PR description.
- Functional: every interactive element works. Tests catch unit-level behavior; smoke catches integration + real-data rendering.
- Performance: hero loads within 3 seconds on production preview (subjective, capture observed load time)
- No console errors anywhere

If smoke fails:
- **Data layer bug:** fix in scope, re-smoke
- **Visual regression:** fix in scope, re-smoke
- **Unexpected production behavior** (e.g., a real production agent's data exposes an edge case): STOP and surface

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing (existing 427+ new tests must pass)
4. Commit organization (one commit per logical chunk):
   - `feat(services): add branch overview aggregation queries`
   - `feat(hooks): add useBranchOverview composing data for Manager Overview`
   - `feat(manager-revamp): M2 — ManagerHeroDonut component`
   - `feat(manager-revamp): M2 — BranchKPIStrip component`
   - `feat(manager-revamp): M2 — BranchActivityFeed component`
   - `feat(manager-revamp): M2 — TeamMedalsPanel component`
   - `feat(manager-revamp): M2 — wire ManagerDashboard Overview tab to new hero`
   - `test(manager-revamp): RTL tests for M2 components`
5. Push, open PR titled: `feat(manager-revamp): M2 — Manager Overview hero (real-data Team YTD donut + KPI strip + activity feed + team medals)`
6. PR description MUST include:
   - **Summary:** placeholder card replaced with composite hero matching mock + agent portal pattern parity
   - **Closes:** placeholder card from PR #102; resolves audit recommendation #1
   - **Data architecture:** brief summary of Firestore aggregation approach + performance estimate
   - **Components added** with file:line references to each
   - **Smoke results** from Phase 6 — screenshots embedded or referenced
   - **Programmatic checks** results (UID-pattern style: no placeholder numbers in DOM, donut renders, KPIs render, etc.)
   - **Acceptable visual diffs** explicitly noted (e.g., "MotivationalCarousel removed — replaced by hero")
   - **Performance observed** during smoke
   - **Test coverage:** count of new tests, total count after merge
7. **STOP.** Do not merge. Kelsean reviews + spot-checks the preview.

---

## Hard stops

- Phase 2 reveals fundamental Firestore data shape issues (e.g., no efficient way to compute compliance trend without Cloud Functions) → STOP and surface; may need a precursor data-engineering PR
- Phase 3 scope estimate exceeds 30 file ceiling → STOP and surface; mandatory split into M2a/M2b
- Phase 4 reveals the agent portal's hero pattern requires significant adaptation (not just extension) for the manager case → STOP and surface; design review needed
- Performance during Phase 6 smoke shows >5s load on the hero → STOP and surface; aggregation strategy needs revision
- Any source code changes outside the M2 scope (new components + services + ManagerDashboard wiring) → STOP and surface
- Test suite regression → STOP
- CI gate fails → STOP and fix before requesting review
- Two strikes hit → STOP

---

## Out of scope

- Other manager portal screens (M3 Awards medals, M4 Goals IA, M5 WeeklyChampionsBanner — separate PRs)
- Adding new manager portal navigation (out of scope per audit)
- Cloud Functions for aggregation unless Phase 3 surfaces a hard need
- Modifying agent portal surfaces (M2 must not regress them but must not change them either)
- Updating `docs/FOLLOW_UPS.md` (housekeeping handles closures)
- Walk script changes
- Rules changes (M2 is read-only on existing collections)
- Schema migrations (use existing data shapes)
- TenantAdminDashboard placeholder removal (separate housekeeping PR)
- Sales_manager-specific views (Phase 9, post-pilot)

---

## What success looks like

After this PR merges:

1. Manager Overview shows a real Team YTD donut, 4 real KPI sparkline cards, real activity feed, real team medals — all backed by Firestore
2. The placeholder card from PR #102 is gone
3. Branch managers logging in see a polished dashboard matching the agent portal's design language
4. Performance is acceptable (sub-3-second load on the hero)
5. M3 (Awards medals) and M4 (Goals IA flatten) can build on M2's data patterns and component shapes

This is the "before/after" PR of the manager portal revamp — the moment where the manager experience visually catches up to the agent experience.

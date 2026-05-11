# Manager Portal Revamp — M1: Shared Primitives Library — kickoff brief

**Status:** Ready to execute. First implementation PR after the manager portal audit (PR #103).
**Estimated CC effort:** 1–2 days. Single PR. Pure refactor — zero behavior change.
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 2/2 (E5 + C3). Workflow operates at tolerance ceiling — next process violation triggers hard stop.

---

## Context

The manager portal audit (`docs/design/manager-portal-audit.md`, `docs/design/manager-portal-recommendations.md`, `mocks/manager-portal-concepts.html` — all merged in PR #103) identified five patterns that are duplicated across the codebase, fragmenting design cohesion:

- **Avatar** — 5+ implementations (UserAvatar, AgentAvatar in Leaderboard, AgentAvatar in AOM, inline avatar in PersistencyAgentRow, photo block in ProfileScreen)
- **StatusPill** — 7+ implementations (ScopeBadge, StatusBadge, DataSourceBadge ×2, AwardState, statusBadge, LevelChip)
- **TabPills** — 5 implementations (Goals, Goals-nested, Campaigns, Awards, Production Report)
- **ConfirmDialog** — 6 paradigms (typed-email modal, inline-row Cancel/Confirm in Compliance + Settlement, bare modal Campaign, pendingMode panel Profile, bulk-validate Settlement, modal save Persistency)
- **SaveButton** — 4 scattered shapes

Per the audit's implementation sequence, **this is the architectural unblocker**. Every downstream manager portal redesign (Overview hero, Awards medals, Goals IA flatten) would otherwise face a "which version of X do I match?" dilemma. By extracting these to single sources of truth FIRST, all subsequent revamp PRs become smaller and lower-risk.

**This PR is a pure refactor.** Zero new behavior. Zero new features. Every consumer surface should be visually and functionally identical after the change — only the underlying component changes. Smoke verifies that.

**Naming this work "M1"** — first PR in the Manager portal revamp series. Subsequent PRs will be M2 (Overview hero), M3 (Awards medals), etc. The M-prefix mirrors the agent portal's B-prefix from Track B v2.

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -5`. HEAD should include PR #104 (CLAUDE.md `.env.local` positive guidance) at top, with PR #103 (audit deliverables) and PR #102 (Manager Overview placeholder hide) below.
4. Confirm clean state: `git worktree list` shows only main; `git branch` shows only `main`.
5. Create worktree at `.claude/worktrees/feat-m1-shared-primitives` on branch `feat/m1-shared-primitives`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery

This is the longest discovery phase since WALK-1. Take time. The primitive APIs derive from understanding the union of needs across ALL existing implementations. Get this wrong and the primitives won't fit all consumers.

### 2a — Read the audit deliverables (source of truth)

1. `docs/design/manager-portal-audit.md` — full read, especially the "Patterns that hurt cohesion" section with the duplication counts.
2. `docs/design/manager-portal-recommendations.md` — full read, especially the "Shared primitives library" recommendation and any per-primitive guidance.
3. `mocks/manager-portal-concepts.html` — open in browser, observe how the mock uses Avatar, StatusPill, TabPills, ConfirmDialog, SaveButton patterns. The mock's implementations are the visual target.

### 2b — Catalog existing implementations (for each of the 5 primitives)

For each primitive type, find ALL existing implementations and capture:

- **File path + line range** of the implementation
- **Component name** (or anonymous inline implementation)
- **Props/API** the current implementation exposes
- **Visual variants** it supports (sizes, colors, states)
- **Behaviors** it handles (click, hover, focus, keyboard)
- **Edge cases** in its current logic (e.g., empty state, loading state, error state)

Where to look (audit findings + your own grep):

**Avatar**
- `src/components/manager/UserManagementPanel.jsx:37-49` (UserAvatar)
- `src/components/gamification/Leaderboard.jsx:81-110` (AgentAvatar variant 1)
- `src/components/manager/AgentOfMonthTab.jsx` (AgentAvatar variant 2 — find exact lines)
- `src/components/manager/PersistencyAgentRow.jsx` (inline avatar — find exact lines)
- `src/components/profile/ProfileScreen.jsx` (photo block — find exact lines)
- Any other consumers found via `grep -r "avatar\|photo" src/`

**StatusPill**
- ScopeBadge, StatusBadge — find in `src/components/`
- DataSourceBadge — exists in 2 places per audit; both
- AwardState, statusBadge, LevelChip — find each

**TabPills**
- `src/components/dashboard/ManagerDashboard.jsx` — Goals sub-tabs (h-9), Awards-style nav
- `src/components/campaigns/CampaignPanel.jsx` — filter tabs (h-9 per Mobile FU#1 audit)
- `src/components/awards/ManagerAwardsPanel.jsx` — Annual/Activity/Recruiting tabs
- `src/components/productionReport/ProductionReportTab.jsx` — TimePeriodToggle
- Any other tab-pill patterns

**ConfirmDialog**
- `src/components/manager/DeactivateConfirmDialog.jsx` (typed-email pattern — load-bearing per CLAUDE.md note)
- Inline confirms in CompliancePanel (Unlock), SettlementPanel (delete row), CampaignPanel (delete), Profile (logging mode pending), Persistency (manager save)
- `src/components/admin/EditConfigModal.jsx` — modal pattern reference for a11y baseline

**SaveButton**
- Find every `<button>` that calls a save function. Likely in: GoalsPanel (Save Agent Goals / Save Unit Goals / Save Branch Goals — 3 shapes per audit), SettlementPanel, PersistencyEntryForm, ProfileScreen, EditConfigModal.

### 2c — Compare against agent portal patterns

The agent portal post-Track B v2 has primitive-like patterns. Check whether any can be **promoted to shared without rework**:

- `.btn-primary` / `.btn-secondary` from `src/index.css` — already widely used, may serve SaveButton's needs with proper props
- The `<Shell>` chrome — already shared between agent and manager dashboards
- `.card` / `.label` / `.input` — already shared

If a primitive's job is mostly to wrap an existing CSS class with proper props + a11y baseline, design it that way. Don't introduce new styles where existing ones work.

---

## Phase 3 — Primitive API design (SURFACE FOR APPROVAL — STOP HERE)

This is the critical design gate. CC produces an API design for each of the 5 primitives. Kelsean reviews before any code is written.

Output format per primitive (use this template — produce in chat):

```
PRIMITIVE: Avatar

Existing implementations (catalog):
- src/components/manager/UserManagementPanel.jsx:37-49 (UserAvatar) — props: { name, size? }, renders: photo OR initials
- src/components/gamification/Leaderboard.jsx:81-110 (AgentAvatar) — props: { agent, size }, renders: photo OR initials with dark-mode contrast handling
- [... etc for all 5+ implementations]

Union of needs:
- Display agent photo if photoURL present
- Fallback to initials if no photo
- Multiple sizes (sm/md/lg/xl) — list exact px values used across consumers
- Optional badge overlay (some implementations add a small indicator)
- Optional click handler (some implementations are interactive)
- Dark mode contrast handling (Leaderboard variant has explicit bg-primary-dark override)
- A11y: alt text for photo, aria-label for initials-only state

Proposed API:
<Avatar
  src={photoURL}                  // optional
  name="Jane Doe"                 // required — drives initials + alt
  size="md"                       // 'sm' | 'md' | 'lg' | 'xl'
  badge={null}                    // optional ReactNode overlay
  onClick={null}                  // optional handler — adds button semantics + focus ring
  className=""                    // escape hatch for layout
/>

File location: src/components/ui/Avatar.jsx
Tests: src/components/ui/__tests__/Avatar.test.jsx
- renders photo when src provided
- renders initials when src missing
- handles 1-word, 2-word, 3+-word names (initials logic)
- renders badge overlay when provided
- renders as button when onClick provided (semantics + role)
- renders as div when onClick absent
- alt text matches name when photo present
- aria-label set when no photo (initials state)

Migration path:
- 5 consumer call sites swap to <Avatar />
- Existing UserAvatar / AgentAvatar / etc. component definitions deleted
- 0 visual regressions expected — primitive matches existing rendering byte-for-byte

Estimated lines:
- Avatar.jsx: ~80
- Avatar.test.jsx: ~120
- Consumer migrations: ~30-40 lines per consumer (delete old, insert new)
```

Repeat for **StatusPill, TabPills, ConfirmDialog, SaveButton**.

**Output a single combined surface** with all 5 primitive designs. Then STOP. Wait for Kelsean to:
- Approve, adjust, or redirect each primitive's API
- Surface concerns about consumer migrations
- Re-prioritize if any primitive should be deferred to a later PR (e.g., ConfirmDialog might be too varied to fully consolidate now)

---

## Phase 4 — Build the primitives + tests (only after Phase 3 approval)

After Kelsean approves the 5 APIs, build them one at a time:

For each primitive:
1. Create the component file in `src/components/ui/`
2. Create the test file in `src/components/ui/__tests__/`
3. Run tests — must pass before moving to consumer migration

**Order of build:**
1. Avatar (lowest complexity)
2. StatusPill
3. SaveButton
4. TabPills
5. ConfirmDialog (highest complexity — focus trap, escape handling, ARIA modal)

Reasoning: stacking complexity. If a higher-complexity primitive surfaces issues, the lower-complexity ones are already shipped in the worktree.

**Constraints:**
- Functional components only, no class components (per CLAUDE.md)
- `useMemo`/`useCallback` for expensive calculations
- All components handle loading, error, empty states where applicable
- No inline styles — Tailwind + CSS variables only
- Use existing Nexus tokens, no new ones
- 44px minimum touch targets for interactive primitives
- Dark mode parity baked in
- `prefers-reduced-motion` respected for any animations
- A11y baseline: ARIA roles, focus-visible rings, keyboard support

---

## Phase 5 — Migrate consumers (sequential, with smoke after each)

After all 5 primitives + tests pass, migrate consumers one primitive type at a time:

**Migration discipline:**
- One primitive type's full migration per commit (e.g., "refactor: migrate all 5 Avatar consumers to ui/Avatar")
- Visual smoke after each commit before proceeding to next primitive type
- If a consumer reveals a primitive API gap, FIX THE PRIMITIVE (in this PR's scope) and re-migrate

**Per-consumer migration steps:**
1. Replace the existing implementation with the primitive
2. Delete the old implementation (don't leave dead code)
3. Verify the consumer renders identically (visual check in dev server, brief screenshot if helpful)

**Hard rule: zero behavior change.** If the existing implementation has a bug, leave it alone — fix in a follow-up PR. The goal is mechanical consolidation, not correctness improvements.

If a consumer has subtle styling or props that the primitive's API doesn't cover, two options:
- **Acceptable variance:** extend the primitive's API (add a prop) — surface in commit message
- **Unacceptable variance:** STOP and surface — primitive design needs revision

---

## Phase 6 — Production smoke

Use the WALK-1 hardened helpers (`scripts/verification/lib/walk-helpers.mjs`). This PR touches BOTH manager and agent portals — verify both.

### Smoke 1: Agent portal regression check
Sign in as test agent (`kelsean@gmail.com`). Walk through:
1. AgentDashboard (avatars in Leaderboard, badges, KPI cards)
2. Wizard (SaveButton in wizard steps, ConfirmDialog if any)
3. CareerPortal (avatars, status pills if any)
4. Profile (Avatar in photo block, SaveButton)

For each screen: capture screenshot, verify visual parity with main before the merge (compare against `verification/manager-portal-audit/` baseline screenshots from PR #103 if helpful).

### Smoke 2: Manager portal regression check
Sign in as test branch manager. Walk through:
1. Overview (current placeholder card from PR #102 still renders)
2. Team (UserManagementPanel — Avatar swap visible)
3. Campaigns (TabPills swap visible, ConfirmDialog on delete)
4. Production Report (TabPills swap visible)
5. Master Sheet (StatusPill on row status)
6. Compliance (StatusPill on kanban statuses, ConfirmDialog on unlock)
7. Persistency (Avatar in agent rows, SaveButton, ConfirmDialog)
8. Goals (TabPills for sub-tabs, SaveButton ×3 — confirm consistency)
9. Settlements (ConfirmDialog on delete, SaveButton)
10. Leaderboard (Avatar in champion cards + leader rows)
11. AoM (Avatar in candidate cards)
12. Profile (Avatar, SaveButton)

For each screen: capture screenshot at desktop (1440x900) and mobile (390x844), light + dark. Compare against baselines.

### Smoke gates:
- **Visual:** no unexpected layout shifts, color drift, or component disappearance. Acceptable diffs: any consolidation where one consumer's variant changed slightly to match the primitive's canonical form — flag in PR description for explicit review.
- **Functional:** every interactive element (click, focus, keyboard) works as it did before. Tests catch the unit-level behavior; smoke catches integration.
- **No console errors** on any screen.

If any smoke check fails:
- **Primitive API issue:** revise the primitive, re-migrate affected consumers, re-smoke
- **Migration issue:** fix the specific consumer's wiring, re-smoke
- **Surprise (existing bug surfaces under refactor):** STOP and surface — may need a separate PR

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing (new tests for primitives + existing tests must still pass)
4. Commit organization: per the brief's recommended order, commits should be:
   - `feat(ui): add Avatar primitive + tests`
   - `feat(ui): add StatusPill primitive + tests`
   - `feat(ui): add SaveButton primitive + tests`
   - `feat(ui): add TabPills primitive + tests`
   - `feat(ui): add ConfirmDialog primitive + tests`
   - `refactor(manager): migrate Avatar consumers to ui/Avatar`
   - `refactor(manager): migrate StatusPill consumers to ui/StatusPill`
   - `refactor(manager): migrate SaveButton consumers to ui/SaveButton`
   - `refactor(manager): migrate TabPills consumers to ui/TabPills`
   - `refactor(manager): migrate ConfirmDialog consumers to ui/ConfirmDialog`
5. Push, open PR titled: `feat(manager-revamp): M1 — shared primitives library (Avatar, StatusPill, SaveButton, TabPills, ConfirmDialog)`
6. PR description MUST include:
   - **Summary:** 5 primitives extracted, ~X consumers migrated, ~Y lines of duplicate code removed
   - **Migration table:** primitive → list of consumers migrated, with file:line references
   - **Test coverage:** new tests added per primitive
   - **Smoke results:** both agent and manager portal walks documented (light + dark, desktop + mobile)
   - **Pre-existing behavior preserved:** explicit note that zero functional changes were introduced; any visual diffs documented as intentional consolidation
   - **Next M-series PR:** brief reference to M2 (Overview hero) coming next, which depends on this PR
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 reveals a primitive has >10 distinct implementations or fundamentally different behavior across consumers — STOP and surface; may need to defer that primitive to its own PR
- Phase 3 surface reveals an API that requires breaking changes to consumers (e.g., new required props that didn't exist before) → STOP and discuss
- Phase 4 build surfaces missing CSS tokens or design language gaps not covered by Nexus → STOP and surface
- Phase 5 migration uncovers existing bugs in consumer code → STOP and surface (don't fix in this PR — log as follow-up)
- Smoke shows visual regressions that aren't intentional consolidation → STOP and fix
- Test suite regression on existing tests → STOP
- CI gate fails → STOP and fix before requesting review
- Total file count > 40 → STOP and consider splitting (recommended ceiling is ~30 files)
- Two strikes hit → STOP

---

## Out of scope

- Any new features or behavior changes (this PR is pure refactor)
- Manager Overview hero redesign (M2 — separate PR, depends on this one)
- Manager Awards medal system (M3 — separate PR, depends on this one)
- Goals IA flatten (M4 — separate PR, depends on this one)
- WeeklyChampionsBanner upgrade (M5 — separate PR)
- Mobile bottom-nav role-specific defaults (separate PR after primitives)
- TenantAdminDashboard placeholder removal (separate housekeeping PR)
- Fixing pre-existing bugs found during migration (log as follow-ups)
- Closing audit-derived follow-ups in `docs/FOLLOW_UPS.md` (housekeeping handles)
- Walk script changes
- Rules changes
- Adding new design tokens (use existing Nexus tokens only)
- Modifying existing primitive-adjacent files like StatCard, Shell (already shared, not in duplication count)

---

## What success looks like

After this PR merges:

1. `src/components/ui/` contains 5 new primitive components with tests
2. Every consumer surface uses the canonical primitive
3. ~15-25 consumer files have lighter, more readable implementations
4. The agent portal works identically to before (regression-free)
5. The manager portal works identically to before (regression-free)
6. M2–M5 PRs can start immediately with no "which version do I match?" friction

The next manager portal revamp PR (M2 — Manager Overview hero) should require dramatically less custom code because the primitives are already in place.

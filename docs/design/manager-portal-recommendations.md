# Manager Portal — Redesign Recommendations

**Companion to:** [`docs/design/manager-portal-audit.md`](manager-portal-audit.md) (current-state inventory)
**Visual reference:** [`mocks/manager-portal-concepts.html`](../../mocks/manager-portal-concepts.html) (this PR)
**Status:** Approved direction (Phase 3 review on 2026-05-11). Ready to translate into implementation PRs (B1–B5 cadence).

---

## How to read this document

Every recommendation lands in one of three buckets:

| Priority | Meaning |
|---|---|
| **P0** | Highest impact. Required for the manager portal to feel coherent with the agent portal. Manager Overview, Awards medal alignment, Goals IA flatten, Shared primitives library, mobile bottom-nav re-balance. |
| **P1** | Important polish. Visible improvements that don't change paradigm. Leaderboard hero upgrade, Persistency tile alignment, Production Report tile + medal alignment. |
| **P2** | Cosmetic / token cleanup. Hardcoded hex → tokens, undefined utilities, non-standard alphas, placeholder removals. |

Effort labels (small / medium / large) map roughly to the B1–B5 sub-PR scale: **small** ≈ 1 day CC + review; **medium** ≈ 2–3 days; **large** ≈ 4–5 days with multiple reviewer rounds.

Each per-screen section names the **proposed primitives** to use. None of them are new — they all already exist in [`src/index.css`](../../src/index.css). The recommendations rewire what's already there; they do not introduce a new design system.

---

## Cross-cutting recommendations (P0)

These cut across every screen recommendation below. They're written first because the per-screen recommendations cite them.

### CC-1 — Shared primitives library

Promote 5 patterns to single sources of truth in `src/components/ui/`. **No new behavior** — pure refactor. Unblocks every per-screen redesign by eliminating "which version do I match?" decisions.

| Primitive | Today (count) | Proposed home | API |
|---|---|---|---|
| `<Avatar>` | 5 implementations | `src/components/ui/Avatar.jsx` | `{ name, photoURL, size = 'md', initials? }` — sizes `xs`/`sm`/`md`/`lg` |
| `<StatusPill>` | 7+ implementations | `src/components/ui/StatusPill.jsx` | `{ kind: 'success'\|'warning'\|'danger'\|'primary'\|'gold'\|'ink', children, size = 'sm' }` |
| `<TabPills>` | 5 implementations | `src/components/ui/TabPills.jsx` | `{ items: [{id, label, badge?}], value, onChange, size = 'md' }` — `md` = h-11 (touch) / `sm` = h-9 (dense rows) |
| `<ConfirmDialog>` | 6 paradigms | `src/components/ui/ConfirmDialog.jsx` | `{ title, body, confirmLabel, danger?, requireTypedText?, onConfirm, onClose }` — handles modal AND inline-row variants via `variant` prop |
| `<SaveButton>` | 4+ implementations | `src/components/ui/SaveButton.jsx` | `{ onClick, isDirty, isSaving, savedAt, error, label = 'Save' }` — owns idle/saving/saved/error states |

**Effort:** Medium. **Priority:** P0 (blocks Awards / Overview / Goals redesigns from looking polished).

### CC-2 — Token system enforcement

Rename / replace hardcoded values to use tokens consistently. Pure search-and-replace except where flagged.

| Site | From | To |
|---|---|---|
| `CampaignCard.jsx:42-44` | `bg-[#f59e0b]` / `bg-[#94a3b8]` / `bg-[#b45309]` | New `<RankMedal rank={1\|2\|3} />` from CC-1 candidate, backed by `--color-medal-1/6/2` |
| `RankedLeaderboard.jsx:32-37` | `yellow-400` / `zinc-300` / `amber-600` Tailwind | `<RankMedal />` from above |
| `Leaderboard.jsx` (Trophy icon for #1) | `Trophy + text-warning` | `<RankMedal rank={position} />` |
| `MotivationalCarousel.jsx:367` | `bg-[#01696f]/8` | `bg-primary/10` |
| `ManagerAwardsPanel.jsx:101` | `bg-warning/8` | `bg-warning/10` |
| `SettlementPanel.jsx:227` | `bg-primary/8` | `bg-primary/10` |
| `KioskShell.jsx:80-82` | `#1a1612`, `#4ab5b8` literals | `var(--color-presentation)`, `var(--color-presentation-accent)` |
| `AOMCategorySection.jsx:43`, `KioskModeTab.jsx:148` | `border-card-raised` (undefined utility) | `border-[color:var(--color-border-strong)]` (or just `border-[color:var(--color-border)]`) |
| `KioskModeTab.jsx:8` | `KIOSK_BASE = 'https://agencytrack.vercel.app/kiosk'` | `${window.location.origin}/kiosk` |
| `MasterSheet.jsx:45-58`, `Leaderboard.jsx LevelChip 112-118`, etc. | Bespoke status-pill JSX | `<StatusPill />` from CC-1 |

**Effort:** Small (mechanical). **Priority:** P2 alone, but **bundle with CC-1** for the same PR — the search-and-replace lands as a side-effect of swapping to the new primitives.

### CC-3 — Mobile bottom-nav: role-specific defaults

Replace the single shared `BOTTOM_NAV` in [`ManagerDashboard.jsx:60-66`](../../src/components/dashboard/ManagerDashboard.jsx) with `BOTTOM_NAV_DEFAULTS` keyed by role:

```js
const BOTTOM_NAV_DEFAULTS = {
  agent:          ['dashboard', 'submit',     'history',     'leaderboard', 'profile'],
  unit_manager:   ['overview',  'team',       'persistency', 'goals',       'profile'],
  branch_manager: ['overview',  'team',       'mastersheet', 'compliance',  'profile'],
  sales_manager:  ['overview',  'team',       'mastersheet', 'compliance',  'profile'], // revisit Phase 9 with cross-branch surfaces
  tenant_admin:   ['dashboard', 'branches',   'users',       'campaigns',   'profile'], // already in TenantAdminDashboard, leave as-is
};
```

The "More" drawer absorbs everything else via the existing `MobileNavDrawer`. Bottom-nav max stays at 5 items per Material guidance (this skill's Quick Reference §9 `bottom-nav-limit`).

**Justification:** A unit_manager's daily workflow is Persistency entry + Goals review; both are 2 taps deeper than they need to be today. A branch_manager's daily workflow is week-of submission tracking — Reports + Compliance surfaces that data faster than Campaigns does.

**Effort:** Small. **Priority:** P0 (mobile experience is part of cohesion).

### CC-4 — Categorical accent token usage in manager portal

`--color-gold` and `--color-ink` are defined for the agent portal's activity feed and currently absent from every manager surface. Use them in:

- **Activity feed on Manager Overview** (new — see Overview recommendation): `ai-gold` for award/badge events, `ai-success` for new submissions, `ai-primary` for rank changes, `ai-ink` for compliance/document events.
- **Awards medallions** (Awards recommendation): `medal-1` (gold/qualified) / `medal-6` (silver/in-contention) / `medal-locked` (not eligible) — these already use the gold palette via `--color-medal-1-*`.
- **StatusPill `kind="gold"` / `kind="ink"`** (CC-1): expose them as first-class kinds so `Awards` qualifying status can read "gold" instead of "success".

**Effort:** Bundled with screen redesigns. **Priority:** P0.

### CC-5 — Type scale codification

The project has `Cabinet Grotesk` for h1–h4 and `Satoshi` for body, but no codified type scale tokens. Inconsistencies surface as `BranchManagerProductionView.h2 text-base` (16px Satoshi) vs `AOMCategorySection.h2 text-xl` (20px Cabinet Grotesk) for the same nav-level header.

Recommend adding 4 type-scale utilities to [`src/index.css`](../../src/index.css) `@layer components`:

```css
.h-display-lg { @apply font-display text-2xl font-bold tracking-tight; } /* page title */
.h-display    { @apply font-display text-xl  font-bold tracking-tight; } /* section title */
.h-section    { @apply text-sm font-semibold uppercase tracking-wide text-ink-muted; } /* subsection caption */
.h-microcaps  { @apply text-xs font-semibold uppercase tracking-wide text-ink-muted; } /* card label */
```

Replace ad-hoc `text-xl font-bold` / `text-base font-semibold` / `text-xs uppercase tracking-wide text-ink-muted` patterns across both portals with these utilities. Pure cohesion — no behavior change.

**Effort:** Small (additive utilities + sweep). **Priority:** P1.

---

## Per-screen recommendations

Screens are ordered by priority (the order future PRs should land), not sidebar order.

---

### S1 — Manager Overview / Dashboard 🅿️0 LARGE

**Anchor screen.** Sets the visual tone for the whole portal. Replaces the highest-traffic landing surface.

#### Recommended approach

Replace the current [`ManagerDashboard.jsx:246-299`](../../src/components/dashboard/ManagerDashboard.jsx) Overview tab with a **3-block layout** that mirrors the agent's `AgentDashboard` rhythm but adapted for orchestrator concerns:

1. **Hero block** — `.role-hero` gradient with a single Team YTD donut on the right and a Team API headline + period progress bar on the left. The donut visualizes Team YTD API ÷ Team API Goal.
2. **KPI strip** — 4 `<KPICard>` sparklines below the hero, week-over-week comparison pills underneath, mirroring the agent dashboard's `KPI Activity Grid` pattern at [`AgentDashboard.jsx:443-484`](../../src/components/dashboard/AgentDashboard.jsx). Cards: **Compliance Rate**, **Weekly API**, **Weekly Apps**, **Weekly FFI**.
3. **`g4-mix` 2-column** — recent activity feed on the left (`ai-success` for new submissions, `ai-gold` for badge unlocks, `ai-primary` for rank changes, `ai-ink` for unlock/compliance events) + team award medallions on the right (`<BadgeGrid>` analogue showing the team's earned monthly awards).

Below the 3-block hero: a thin "team status" strip with quick links to Pending Reports (count → opens Compliance), Recent Settlements (count → opens Settlements), and Active Campaigns (count → opens Campaigns).

Below that: existing CTAs (Submit Weekly Report, Start Meeting, Export Branch CSV) moved into a single action row near the bottom.

#### Specific changes

| Today | Proposed |
|---|---|
| Hardcoded `stats = { totalAgents: 8, ... }` literal at lines 134-140 | Real Firestore-backed `useTeamStats()` hook reading `getWeeklySubmissions(currentWeek)` + `getAllYTDSubmissions()` + `getBranchGoals(year)`. **This is part of THIS PR — do not assume a separate patch lands first** (per Phase 3 critical finding) |
| `MotivationalCarousel` legacy component | Removed from Overview entirely; the `.role-hero` IS the hero |
| Custom inline progress bar (lines 263-268) | `.bar` / `.bar-fill` primitive inside `.role-hero` |
| 4× hand-rolled `<StatCard>` | 4× `<KPICard>` reuse from `src/components/dashboard/KPICard.jsx` |
| No activity feed | New `<ActivityFeed>` instance via `buildManagerActivityEvents()` util (new — derives from team submissions, badge unlocks across the team, settlement confirmations). Mirror of [`buildActivityEvents`](../../src/utils/buildActivityEvents.js) but team-scoped |
| No team awards visualization | `<TeamAwardsBadgeGrid>` — variant of `BadgeGrid` showing which monthly bonuses any team member has unlocked. Reuses `medal-1..8` palette |

#### Role-specific variations

- **unit_manager:** "Team YTD" = unit aggregate; activity feed scoped to unit submissions; team awards = unit's badges
- **branch_manager:** "Team YTD" = branch aggregate; activity feed scoped to branch
- **sales_manager:** Same as branch_manager today (current-state). Phase 9 will add a cross-branch toggle in the hero
- **tenant_admin:** Lands on `TenantAdminDashboard` (separate dashboard) — not affected by this redesign. See "Cross-cutting deferred decisions" below

#### Implementation considerations

- **Existing components reused:** `KPICard`, `BadgeGrid` (extend with `mode='team'`), `Shell` (already in place), `.role-hero` / `.bar` / `g4-mix` primitives (already in CSS).
- **New components:** `ActivityFeed` already exists; needs a `<TeamActivityFeed>` thin wrapper that supplies team-scoped events. New util: `buildManagerActivityEvents()` mirroring the agent variant.
- **New service hook:** `useTeamStats(role, scopeId)` consolidates the Firestore reads needed for the hero + KPI strip + status strip. Single hook, fetched once per dashboard mount.
- **Performance:** KPI sparklines need 4 weeks of historical aggregates. Use the existing `getAllYTDSubmissions()` reader and aggregate client-side; don't add a new Firestore index unless the data volume crosses 5k submissions/year (currently nowhere near).

#### Priority / effort

🅿️0 **LARGE** — anchor screen + Firestore wiring + new util + new hook.

---

### S2 — Manager Awards 🅿️0 MEDIUM

**Closes the largest single visual gap** in the manager portal: AwardCard's color-coded border vs BadgeGrid's medallions.

#### Recommended approach

Replace the [`AwardCard`](../../src/components/awards/ManagerAwardsPanel.jsx) status-color border surface with a **medal-coin slot**. Each award becomes a `.badge-item` with a `.medal-1`/`.medal-6`/`.medal-locked` medallion, with the criterion progress shown beneath as a `.bar-thick` primitive. Status maps:

| Today | Proposed |
|---|---|
| `Qualified` (success border) | `.medal-1.glow` (gold medallion) |
| `In Contention` (warning border) | `.medal-6` (silver medallion, no glow per index.css convention) |
| `Not Eligible` (danger border) | `.medal-locked` (neutral grayscale) |
| `MonthlyBonusCard` "Next tier" subcard | Promote to `.role-hero` with `.bar-thick` showing tier progress |

The `<AnnualAward / Activity / Recruit>` tab pill row swaps to `<TabPills size="md" />` from CC-1.

#### Specific changes

| Today | Proposed |
|---|---|
| Inline `DataSourceBadge` (lines 7-16) | Import shared `productionReport/DataSourceBadge.jsx` — kill the duplicate |
| `bg-warning/8` non-standard alpha (line 101) | `bg-warning/10` |
| Status-color border on AwardCard | `<AwardMedal />` — new shared primitive wrapping `.medal-1/6/locked` with the award's `iconSlug` |
| Hardcoded category-id allow-list (lines 184-188) | Derived from `awardsEngine` config — config becomes the source of truth |
| Manager-only AwardCard treatment | Visually parallel to agent BadgeGrid; user can recognize "this is the team's award medal" instantly |

#### Role-specific variations

- All manager roles see the same Awards tab layout. Award scope (per-agent vs per-unit vs per-branch) is read from the `awardsEngine` config and surfaces in the criterion text, not the layout.

#### Implementation considerations

- **New primitive:** `<AwardMedal>` in `src/components/awards/AwardMedal.jsx` — paramterized over `{ tier: 1\|6\|locked, iconSlug, glow?, size? }`. Reuses the `.badge-medal` + `.medal-N[.glow]` CSS classes.
- **No new tokens.** All medal palettes already in `index.css`.
- **No service changes.** Reads from `awardsEngine` exactly as today.

#### Priority / effort

🅿️0 **MEDIUM** — single-tab redesign, no new data, single new primitive.

---

### S3 — Goals 🅿️0 LARGE

**Resolves the worst IA in the portal** (3-level nav cliff) and brings goal-setting into visible alignment with `GapAnalysisPanel`.

#### Recommended approach

Flatten the Goals tab to **a single sub-tab row** with role-gated items, matching Phase 3 Q3 Option (b):

```
Goals
  └─ TabPills: [Self] [Agent] [Unit] [Branch]   ← single row, role-gated
```

| Sub-tab | Visible to |
|---|---|
| Self | all manager roles (CommissionPlayground reverse-calc) |
| Agent | all manager roles (per-agent goal editor — current `AgentGoalsTab`) |
| Unit | unit_manager and above (current `UnitGoalsTab`) |
| Branch | branch_manager and above (current `BranchGoalsTab`) |

**Above the sub-tab row, surface `<GapAnalysisPanel>`** showing the cascade their goal-setting feeds into. The same component the agent dashboard uses — wired to `getGoalHierarchy(tenantId, scopeUnitId, year, agentId?)`. Managers see live what their decisions produce downstream.

#### Specific changes

| Today | Proposed |
|---|---|
| Two layers of sub-tabs (My Production / My Unit → Agent / Unit / Branch) | Single `<TabPills>` row from CC-1 |
| `NumInput` with h-9 (36pt) inputs | h-11 (44pt touch-target compliant); promote to shared `<NumberInput>` primitive (CC-1 candidate) |
| Three different Save button shapes | Single `<SaveButton>` from CC-1 |
| `AgentGoalsTab` stacks all 8 agents with full forms (1000+px scroll) | Expand/collapse pattern: only one agent expanded at a time, default all collapsed. Tap agent name → expands inline; tap again → collapses. Default expanded for agents below floor. |
| No GapAnalysisPanel surfacing | Renders at top of Goals tab, hierarchy fetched once per mount |
| Default minimums duplicated (lines 316, 413) | Single source: `goalsService.getCompanyMinimums()` fallback |

#### Role-specific variations

- **unit_manager:** Sees Self / Agent / Unit (no Branch); GapAnalysisPanel renders at unit scope
- **branch_manager:** Sees all 4; GapAnalysisPanel renders at branch scope
- **sales_manager:** Same as branch_manager today; Phase 9 adds cross-branch view
- **tenant_admin:** N/A — currently no path from `TenantAdminDashboard` to Goals (deferred decision below)

#### Implementation considerations

- **Reuses:** `CommissionPlayground`, `BelowFloorWarning`, `GoalLevelForm`, `GapAnalysisPanel`. Internal rewiring of `GoalsPanel.jsx` only.
- **Removes:** Outer "My Production / My Unit" sub-tab wrapper in `ManagerDashboard.jsx:326-413` — Goals tab now self-contains the IA.
- **Mobile:** Sub-tab row uses `<TabPills>` `overflow-x-auto` for narrow viewports (already standard Tailwind pattern).

#### Priority / effort

🅿️0 **LARGE** — IA flatten + expand/collapse pattern + GapAnalysisPanel wiring + 4 sub-tabs to keep working + h-11 input primitive promotion.

---

### S4 — Persistency 🅿️1 MEDIUM

**Highest-cohesion screen today gets a polish pass to lift it the rest of the way.**

#### Recommended approach

Three changes, all consolidations:

1. **Top-of-tab `.role-hero`** — colored band with the current month's branch/unit/tenant aggregate persistency %, with a `.bar-thick` showing position vs the company floor (typically 90%). Current "aggregate summary card" (lines 286-303) absorbs into the hero.
2. **`.config-tile-grid` for the stat tiles** — replace hand-rolled `grid-cols-2 sm:grid-cols-4` with `.config-tile-grid` + `.config-tile`. Same data, project-standard primitive.
3. **Promote `<PersistencyAgentRow>` to `<UserRecordRow>` shared primitive** — the current row pattern (avatar + name + sub + status pill + action buttons) is the closest the manager portal has to a clean record-row idiom. Promote to `src/components/ui/UserRecordRow.jsx` for reuse in Compliance kanban (replacing `AgentRow`), Settlements history (replacing inline JSX), and the Team roster (replacing the CSS-grid table).

#### Specific changes

| Today | Proposed |
|---|---|
| Aggregate summary card (lines 286-303) | `.role-hero` + `.config-tile-grid` for the breakdown |
| Threshold legend pattern (lines 308-315) | New `<StatusKey>` shared primitive (CC-1 candidate); reused in Awards + Compliance |
| Magic numbers 0.90 / 0.80 in two files | Single read: `companyMinimums.persistency` (with fallback) |
| Hidden `<span>` "for lint cleanliness" (lines 367-370) | Removed; lint comment fixed properly |
| Custom status pill in `badgeClass` | `<StatusPill kind={success\|warning\|danger}>` from CC-1 |

#### Role-specific variations

- Same scope-by-role behavior (`SCOPE_BY_ROLE` map). Hero stat reads aggregate from the user's scope.

#### Implementation considerations

- **`PersistencyAgentRow` already has the right shape** — just rename + relocate to `src/components/ui/UserRecordRow.jsx`, parameterize over `{ avatar, primary, secondary, badge, actions[] }`.
- **`StatusKey` primitive** is small (~30 lines of JSX); generic over a `legend = [{ color, label }]` array.

#### Priority / effort

🅿️1 **MEDIUM** — surface polish + 1 primitive promotion + 1 new small primitive.

---

### S5 — Leaderboard 🅿️1 SMALL

#### Recommended approach

Upgrade `WeeklyChampionsBanner` to `.role-hero` shape (gradient background, `::before/::after` decorative blobs), with the 3 champion cards inside rendering a `medal-1/2/3` medallion alongside the existing avatar + value.

`LeaderRow` rank position swaps from `Trophy + text-warning` (#1 only) to `<RankMedal rank={position} />` for the top 3, falling back to plain numbers for positions 4+. Same `<RankMedal>` primitive used in Production Report and Campaign rank pills (CC-2).

#### Specific changes

| Today | Proposed |
|---|---|
| `WeeklyChampionsBanner` flat `bg-primary/10 border-primary/20` | `.role-hero` gradient with embedded medal-1/2/3 |
| `Trophy + text-warning` for #1 only | `<RankMedal rank={position} />` for top 3 |
| Internal `AgentAvatar` (lines 81-110) | `<Avatar>` from CC-1 |
| `LevelChip` `LEVEL_COLORS` semantic-color reuse | `<StatusPill kind="primary"/"gold"/...>` keyed by level — adds visual variety, frees `success`/`warning`/`danger` for genuine status meaning |
| `WeeklyChampionsBanner grid-cols-3` on mobile (tight at 360px) | `grid-cols-1 sm:grid-cols-3` — stacks on narrow screens |

#### Role-specific variations

- Manager-only "Branch Unit — not in competition" section keeps its `opacity-60` demoted treatment but gains a subtle "(Reference only)" badge from `<StatusPill kind="ink">` for clarity.

#### Priority / effort

🅿️1 **SMALL** — single-component upgrade, no new data.

---

### S6 — Production Report 🅿️1 SMALL

**Already the most internally consistent module. Just align with project tokens.**

#### Recommended approach

Two targeted changes:

1. **`<RankMedal>` for top-3** — `RankedLeaderboard.medalClass` (lines 32-37) currently uses Tailwind `yellow-400` / `zinc-300` / `amber-600`. Swap to `<RankMedal>` from CC-1.
2. **Branch aggregate row → `.config-tile-grid`** — `BranchManagerProductionView` lines 134-155 hand-rolls `flex-wrap` with `min-w-[130px]` tiles. Use `.config-tile-grid` + `.config-tile`.
3. **Header typography** — `h2 text-base` (Satoshi body) → `<h2 className="h-display">` from CC-5.

#### Priority / effort

🅿️1 **SMALL** — token + primitive cleanup.

---

### S7 — Compliance 🅿️1 SMALL

#### Recommended approach

Keep the kanban-column pattern (it's correct for this surface). Three consolidations:

1. **`Column` header** (lines 27-32) — keep semantic colors but use `<StatusPill>` from CC-1 for the count badge instead of inline JSX.
2. **`AgentRow` inside columns** → `<UserRecordRow>` from S4's primitive promotion. Same shape as `PersistencyAgentRow`.
3. **Inline Unlock confirm** → `<ConfirmDialog variant="inline">` from CC-1 for paradigm consistency.

#### Priority / effort

🅿️1 **SMALL** — primitive swaps, no new behavior.

---

### S8 — Master Sheet 🅿️2 SMALL

**Power-user spreadsheet. Resists redesign — and shouldn't be redesigned.**

#### Recommended approach

Two cosmetic changes:

1. **Status badge** (lines 45-58) → `<StatusPill>` from CC-1.
2. **Footer text** ("X submissions • Y submitted • Z draft") — same data shown in `CompliancePanel` controls header. Promote to a shared `<WeekSummaryFooter>` consumed by both, fed from a `useWeekStats(week)` hook.

The sticky-column table is the right tool for this job. Don't touch it.

#### Priority / effort

🅿️2 **SMALL** — token + primitive cleanup.

---

### S9 — Campaigns 🅿️2 SMALL

#### Recommended approach

1. **`RankBadge`** (CampaignCard.jsx:42-44) → `<RankMedal>` (CC-2)
2. **`ScopeBadge`, `StatusBadge`** → `<StatusPill>` (CC-1)
3. **Tab pill row** (lines 624-639) → `<TabPills>` (CC-1)
4. **Bespoke delete confirm modal** (lines 583-594) → `<ConfirmDialog variant="modal">` (CC-1)
5. **Drawer chrome** (lines 141-155) → promote shared `<Drawer>` primitive, also used by `CreateUserDrawer` in Team

#### Priority / effort

🅿️2 **SMALL** — primitive swaps. Drawer extraction adds slight scope but unblocks Team / Campaigns / Settlements.

---

### S10 — Team 🅿️2 SMALL

#### Recommended approach

1. **Roster table** → list of `<UserRecordRow>` (S4 primitive). Removes the non-collapsing CSS-grid table; mobile experience improves (rows wrap naturally).
2. **`UserAvatar`** → `<Avatar>` (CC-1)
3. **Toast handling** → shared `<Toast>` primitive (CC-1 candidate; co-locate with `<ConfirmDialog>`).
4. **Drawer** → shared `<Drawer>` (S9).

#### Priority / effort

🅿️2 **SMALL** — primitive sweeps, no surface logic change.

---

### S11 — Settlements 🅿️2 SMALL

#### Recommended approach

1. **Mode toggle** (lines 314-320) → `<TabPills size="sm">` ("Single entry" / "Bulk entry")
2. **Inline-row delete confirm** → `<ConfirmDialog variant="inline">` (CC-1)
3. **Form chrome** — replace `inputCls` / `labelCls` consts with the existing `.input` / `.label` classes from `index.css`
4. **History rows** → `<UserRecordRow>` (S4)
5. **`bg-primary/8`** → `bg-primary/10` (CC-2)

#### Priority / effort

🅿️2 **SMALL** — primitive sweeps.

---

### S12 — Agent of Month 🅿️2 SMALL

#### Recommended approach

1. **`bg-warning-tint` / `bg-danger-tint` standardization** — pick one approach (the `-tint` tokens) and sweep the whole portal to use it. Currently mixed with `bg-warning/10` etc. Choose tokens for cohesion.
2. **`border-card-raised`** undefined utility → `border-[color:var(--color-border-strong)]` (CC-2)
3. **`p-6 max-w-5xl` width constraint** — drop. Aligns with rest of portal using full Shell width.
4. **`AgentAvatar` inline** → `<Avatar>` (CC-1)
5. **Loading state** — text-only "Loading candidates…" → 3× h-32 pulse skeleton matching neighboring tabs.

#### Priority / effort

🅿️2 **SMALL** — token + primitive cleanup. AOM is already the most a11y-polished surface; preserve that.

---

### S13 — Kiosk 🅿️2 SMALL

#### Recommended approach

1. **`KIOSK_BASE` hardcoded URL** → `${window.location.origin}/kiosk` (CC-2)
2. **`KioskShell` loading spinner literal hex** → `var(--color-presentation-*)` tokens (CC-2)
3. **`border-card-raised`** undefined utility → fix (CC-2)
4. **`p-6 max-w-3xl` width constraint** — drop. Same as AOM.
5. **Action icon cluster** → reuse `.topbar-icon-btn` primitive
6. **Loading state** — text-only "Loading…" → skeleton matching neighbors

The kiosk display surface (KioskShell) intentionally renders always-dark. Bypass to literal hex was the wrong fix — `--color-presentation-*` tokens were added to `:root` for exactly this case.

#### Priority / effort

🅿️2 **SMALL** — token + primitive cleanup.

---

### S14 — Profile 🅿️2 SMALL

**Already polished. Two small cohesion improvements.**

#### Recommended approach

1. **Read-only info card** (lines 460-477) → `.config-tile-grid` + `.config-tile` for Email / Role / Member Since.
2. **Manager profile feels emptier than agent profile** (no logging-mode panel) — add a "Member of [Branch] · [Unit]" `.config-tile` group at the top so the page has visual weight matching the agent variant.

#### Priority / effort

🅿️2 **SMALL** — additive tile.

---

## TenantAdminDashboard scope (deferred decisions)

Per Phase 3 Q4: **functional scope** for `TenantAdminDashboard` is **out of scope** for this audit. The decision below is surfaced as an explicit deferred item, not a recommendation:

> **TenantAdminDashboard currently provides no operational-screen access paths.** A tenant_admin landing on this dashboard cannot reach Goals / Persistency / Settlements / Master Sheet / Compliance / Awards / Agent of Month / Kiosk from their own sidebar. Whether to expose these read-only is a strategic decision outside this audit's scope.
>
> **The "Coming soon" placeholders in `TenantAdminDashboard` (Roles & Permissions, Audit Log, Billing, Settings) and `BranchHealthCards` ("% to YTD goal", "Last sync", "System Health") should either be implemented or removed. Placeholder text in production is not acceptable post-pilot.**

**Cohesion scope** for `TenantAdminDashboard` IS in scope and follows from CC-1 / CC-2 / CC-3 / CC-5:

- Sidebar / topbar / bottom-nav already use the project's primitives ✓
- `RoleDistributionCard`, `BranchHealthCards`, `CompanyConfigPanel` use `.config-tile-grid` and `.role-bar` ✓
- The "Coming soon" placeholders cannot become production-quality without backing data. **Remove until they have it** — do not let placeholder text ship to Tatil.
- `BOTTOM_NAV_DEFAULTS` map (CC-3) covers `tenant_admin` row; existing TA bottom-nav is correct as-is.

---

## Sales Manager — forward-looking note

Sales_manager currently has **no dashboard divergence** — they route to `ManagerDashboard` and see the same nav as branch_manager. Phase 9 (post-pilot) will add cross-branch surfaces under SCOPE-1 (cross-branch aggregation across multiple branches under the SM's purview) and a 5th layer to the goal-hierarchy gap analysis (SM-level targets that span branches). Until Phase 9 ships, all sales_manager recommendations in this document mirror branch_manager. Implementation PRs derived from this audit should not pre-build SM-specific surfaces; they should be re-evaluated when SCOPE-1 lands.

---

## Suggested implementation sequence

The order below sequences PRs by dependency, not just priority. Each PR is sized to the B1–B5 cadence (1 PR ≈ 1–3 days CC + 1 reviewer round).

| # | PR title | Includes | Priority | Effort |
|---|---|---|---|---|
| 1 | `feat(ui): shared primitives library — Avatar, StatusPill, TabPills, ConfirmDialog, SaveButton, NumberInput, Drawer, Toast` | CC-1 + CC-5 type-scale utilities | P0 | Medium |
| 2 | `chore(tokens): manager portal token sweep — replace hardcoded hex, fix undefined utilities, swap to shared primitives` | CC-2 + CC-4 + bottom-nav role-defaults (CC-3) | P0 | Small-Medium |
| 3 | `feat(manager-overview): role-hero + KPI sparklines + activity feed + team awards + real Firestore stats` | S1 (anchor screen — Firestore wiring is in this PR, not separate) | P0 | Large |
| 4 | `feat(manager-awards): medal-coin AwardCard + monthly bonus role-hero` | S2 | P0 | Medium |
| 5 | `refactor(manager-goals): flatten IA to single sub-tab row, surface GapAnalysisPanel, h-11 inputs, expand/collapse agents` | S3 | P0 | Large |
| 6 | `feat(manager-persistency): role-hero + config-tile-grid + UserRecordRow primitive promotion` | S4 | P1 | Medium |
| 7 | `feat(leaderboard): WeeklyChampionsBanner role-hero upgrade + RankMedal medallions` | S5 | P1 | Small |
| 8 | `chore(manager): production-report + compliance + master-sheet primitive sweeps` | S6 + S7 + S8 | P1–P2 | Small |
| 9 | `chore(manager): campaigns + team + settlements primitive sweeps` | S9 + S10 + S11 | P2 | Small |
| 10 | `chore(manager): aom + kiosk + profile cleanup, remove TA placeholder copy` | S12 + S13 + S14 + TenantAdminDashboard placeholder removal | P2 | Small |

**Total scope:** 10 PRs across approximately 6–8 weeks at a sustainable cadence (1–2 PRs/week, leaving room for pilot feedback and other priority work). Comparable to Track B v2's B1–B5 + follow-ups footprint.

**Critical sequencing note:** PRs #1 and #2 must land *before* the per-screen redesigns (#3 onward). The shared primitives library is the spine — without it, every per-screen redesign reinvents the same primitives in slightly different ways and the cohesion problem persists.

---

## Out of scope for these recommendations

- **Source code changes in this PR.** This is the design phase. Implementation lands as discrete PRs derived from the sequence above.
- **New design tokens.** All recommendations use the existing Nexus token system. No new colors, no new gradients, no new font families.
- **New surfaces / features.** This is a redesign of existing functionality. Cross-branch SM surfaces, AI-assisted insights, automated nudges, etc. are Phase 9+ scope.
- **Architectural changes.** Role system, data model, permission rules, Firestore structure all stay as-is.
- **Brand identity changes.** Logo, color palette beyond what Nexus already defines, marketing surfaces are not touched.
- **Real-device testing.** Mocks live in browser; real-device passes happen during the implementation PRs (#1–#10 above).

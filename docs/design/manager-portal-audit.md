# Manager Portal — UX/UI Audit

**Audit date:** 2026-05-11
**Audited branch:** `main` @ `bcd2d3e` (post-PR #100 housekeeping HEAD)
**Audited roles:** branch_manager (primary), unit_manager, sales_manager, tenant_admin
**Audit method:** source-level read of every manager-accessible component, cross-referenced against the agent portal's Track B v2 design language as defined in [`mocks/concept-4-complete.html`](../../mocks/concept-4-complete.html), [`src/index.css`](../../src/index.css), [`tailwind.config.js`](../../tailwind.config.js), and [`src/components/dashboard/AgentDashboard.jsx`](../../src/components/dashboard/AgentDashboard.jsx).
**Visual reference:** [`mocks/manager-portal-concepts.html`](../../mocks/manager-portal-concepts.html) (this PR) for the redesign direction. Production screenshots of the audited current state in `verification/manager-portal-audit/` (gitignored).
**Companion document:** [`docs/design/manager-portal-recommendations.md`](manager-portal-recommendations.md) — the actionable per-screen recommendations.

---

## Executive summary

The agent portal received a coherent visual upgrade in May 2026 via Track B v2 ("Concept 4 Complete") — the Nexus warm theme tokens, the role-hero gradient + goal-donut combo, KPICard sparklines, the `g4-mix` activity-feed + medal-badges pairing, the `Shell` (sidebar + topbar + bottom-nav) chrome, and the `.config-tile-grid` / `.role-bar` primitives. It is the most visually polished and design-coherent surface in the application.

**The manager portal did not receive the same treatment.** The `Shell` chrome was extended to manager dashboards in B4 — so the outer frame is consistent — but everything *inside* Shell evolved screen-by-screen without a unified pass. The result is a portal where:

1. **The Manager Overview ships hardcoded placeholder data in production.** [`ManagerDashboard.jsx:134-140`](../../src/components/dashboard/ManagerDashboard.jsx) literally returns `{ totalAgents: 8, submittedThisWeek: 5, pendingSubmissions: 3, teamYTDAPI: 384000, teamAPIGoal: 960000 }` — none of it from Firestore. The most-visited landing page for every manager role is a mock.

2. **Common patterns have 5–7 independent implementations.** Tab pills (5), avatars (5), status badges (7+), confirmation dialogs (6), save buttons (4+), and input fields (5) each have their own bespoke versions across the manager surfaces. None of the duplicates are visually identical.

3. **The agent portal's signature primitives are absent.** No `.role-hero`, no donut, no goal carousel, no activity feed, no medal badges, no `.config-tile-grid`, no `.role-bar`, no categorical accent tokens (`--color-gold`, `--color-ink`). The manager portal is monochromatic next to the agent portal's polychromatic feed.

4. **Information architecture has two notable cliffs.** The Goals tab nests three navigation levels (Goals → My Production / My Unit → Agent Goals / Unit Goals / Branch Goals). The mobile bottom-nav serves the agent role's primary surfaces but excludes the unit manager's primary daily workflows (Persistency, Goals, Settlements).

5. **Two surfaces are quietly more polished than the rest** — the Production Report sub-module is the most internally consistent corner of the manager portal (its own mini design system: `ProductionTable` + `RankedLeaderboard` + `TimePeriodToggle` + `DataSourceBadge`), and the Agent of Month tab is the most a11y-polished surface anywhere in either portal. Both demonstrate the bar is achievable without rewriting the whole portal.

The audit covers 14 manager-accessible screens plus the tenant-admin dashboard and its admin panels. Each gets a per-screen entry below with source references, design-cohesion rating, and gap inventory.

The recommendations document handles "what to change in what order" — this document is "what's there and what's wrong with it."

---

## Design language baseline

The Nexus warm theme is the design language. Manager-portal recommendations extend it; they do not replace it. The token system is fully tokenized — every color resolves through a CSS variable in `:root` / `.dark`, surfaced as Tailwind utilities via `var(--color-*)`. There are no hardcoded brand colors in the agent portal except the PDF report (`react-pdf` cannot resolve CSS vars) and three legacy spots noted below.

### Tokens (verified against `src/index.css`)

| Category | Tokens | Notes |
|---|---|---|
| Surfaces | `--color-bg`, `--color-surface`, `--color-surface-raised`, `--color-surface-muted` | Warm beige light; warm dark |
| Text | `--color-text`, `--color-text-muted`, `--color-text-faint` | Cabinet Grotesk for h1–h4, Satoshi for body |
| Borders | `--color-border`, `--color-border-strong` | |
| Brand | `--color-primary`, `-dark`, `-light`, `-tint` | Teal `#01696f` light, lifted `#4ab5b8` dark |
| Status | `--color-success`, `-warning`, `-danger` (each with `-tint`) | Warm-toned dark variants |
| Categorical (B3) | `--color-gold`, `-tint`; `--color-ink`, `-tint` | Achievement / document accents |
| Medals (B1) | `--color-medal-1` through `-medal-8` (each with light/mid/deep/glow) | Glossy-coin radial gradients |
| Presentation | `--color-presentation`, `-text`, `-muted`, `-accent`, `-border` | Theme-independent (always dark) |

### Component primitives (CSS-defined, ready to use)

| Primitive | Defined at | Status across manager portal |
|---|---|---|
| `.card` | `index.css:200-203` | Used widely ✓ |
| `.btn-primary` / `.btn-secondary` / `.input` / `.label` | `index.css:174-214` | Used in some surfaces; many bypass with bespoke classes |
| `.shell` / `.sidebar` / `.topbar` / `.bottom-nav` | `index.css:702-1150` (B4) | Adopted everywhere ✓ |
| `.role-hero` (gradient + decorative blobs) | `index.css:407-434` (B2) | **Not used** anywhere in manager portal |
| `.bar` / `.bar-fill` (thin progress) | `index.css:436-452` (B2) | **Not used** in manager portal; managers hand-roll progress bars |
| `.goal-carousel` / `.goal-tabs` / `.goal-slide` / `.hero-donut` | `index.css:454-603` (B2) | **Not used** in manager portal |
| `.activity-list` / `.activity-icon.ai-{success,gold,primary,ink}` / `.activity-pill` | `index.css:616-665` (B3) | **Not used** in manager portal |
| `.badge-grid` / `.badge-medal` / `.medal-1..8` / `.tier-pips` | `index.css:222-385` (B1) | **Not used** in manager portal |
| `.config-tile-grid` / `.config-tile` | `index.css:1153-1196` (B5) | Used by tenant-admin only; manager portal hand-rolls equivalent stat tiles |
| `.role-bar` / `.role-bar-fill-*` | `index.css:1198-1219` (B5) | Used by tenant-admin only |
| `.g4-mix` (1.6fr / 1fr 2-col grid) | `index.css:674-681` (B4) | Used by agent dashboard only |

### Interaction conventions

- Hover lifts: shadow transition on `.card`; color-shift on `.topbar-icon-btn`, `.sidebar-foot-action`
- Focus: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` is the project standard, baked into `.btn-primary`, `.btn-secondary`, `.input`, all `.sidebar-link` / `.bottom-nav-item` / `.topbar-icon-btn` primitives
- Motion: 150–300ms transitions, all guarded by `@media (prefers-reduced-motion: no-preference)`
- 44pt minimum touch targets baked into `.btn-primary`, `.btn-secondary`, `.input`, `.bottom-nav-item`

---

## Per-screen audit

Each entry below covers a tab in the manager portal. Files are referenced by relative path with line numbers for exact specifics. Entries are ordered by sidebar nav position (per [`ManagerDashboard.jsx:38-55`](../../src/components/dashboard/ManagerDashboard.jsx)).

### 1. Overview / Manager Dashboard

| Field | Value |
|---|---|
| Source | [`src/components/dashboard/ManagerDashboard.jsx:246-299`](../../src/components/dashboard/ManagerDashboard.jsx) (overview tab inline) |
| Roles | unit_manager, branch_manager, sales_manager, platform_admin (tenant_admin routes to `TenantAdminDashboard` instead) |
| Primary interactions | Read team YTD progress; jump to the wizard; trigger Start Meeting / Export Branch CSV from the topbar |
| Design cohesion | ❌ Low |
| Tokens used | `text-ink`, `text-ink-muted`, `bg-primary/10`, `.card`, `.btn-primary` |
| Patterns used | `MotivationalCarousel` (legacy), custom inline progress bar (lines 263-268), 4× hand-rolled `<StatCard>` (lines 68-81) |
| Empty state | None — same hardcoded numbers always render |
| Loading state | None — instant render of literals |
| Hover/focus | `.btn-primary` inherits global hover; `<StatCard>` has no hover state |
| Mobile behavior | `grid-cols-2` always (line 275); stats stay 2-up at every viewport |

**Critical findings**

- 🔴 **Hardcoded stats.** [`ManagerDashboard.jsx:134-140`](../../src/components/dashboard/ManagerDashboard.jsx) returns a literal `useMemo` object with `totalAgents:8`, `submittedThisWeek:5`, etc. `complianceRate` at line 144 is computed from these literals. **In production, every manager sees the same numbers regardless of their actual data.**
- 🔴 **None of the agent-portal Track B v2 patterns reach this screen.** No `.role-hero`, no donut, no `KPICard` sparklines, no `ActivityFeed`, no `BadgeGrid`, no `g4-mix`, no `GapAnalysisPanel`. The manager Overview is the highest-traffic landing page in the portal and ships the least design treatment.
- 🟡 **"Welcome back" is duplicated** — appears in the topbar (line 240) and again as an h2 in the body (line 250).
- 🟡 **Custom progress bar** at lines 263-268 hand-rolls what the `.bar` / `.bar-fill` primitive already provides.

---

### 2. Team

| Field | Value |
|---|---|
| Source | [`src/components/manager/UserManagementPanel.jsx`](../../src/components/manager/UserManagementPanel.jsx) (655 lines) + [`DeactivateConfirmDialog.jsx`](../../src/components/manager/DeactivateConfirmDialog.jsx) |
| Roles | All manager roles. `CREATABLE_ROLES` map at lines 20-26 gates which roles a current user can create |
| Primary interactions | View/search roster; Add User (358-line drawer); Bulk Import Users / Goals (tenant_admin+); Deactivate / Reactivate (typed-email confirm) |
| Design cohesion | ⚠️ Medium |
| Tokens used | `text-ink`, `text-ink-muted`, `bg-primary/10/15/20`, `bg-success`, `bg-warning/10/30`, `bg-danger/10/30`, `.btn-primary`, `.card` (in empty state) |
| Patterns used | Custom CSS-grid table (line 560 — `grid-cols-[2fr_2fr_1.5fr_1fr_auto]`); drawer pattern for create form; standalone dialog for deactivate; fixed toast (lines 462-501) |
| Empty state | ✓ Handled (lines 552-557) — `UserCircle` icon + italic copy |
| Loading state | ✓ 3-row pulse skeleton (lines 547-549) |
| Hover/focus | ✓ `focus-visible:ring` on bulk-import / add-user buttons; deactivate button color-shifts on hover |
| Mobile behavior | ⚠️ `grid-cols-[2fr_2fr_1.5fr_1fr_auto]` does NOT collapse — table will overflow on <640px. No `sm:` breakpoint variant. CreateUserDrawer `max-w-md` slides from right |

**Findings**

- The roster grid is a custom CSS grid with no reuse anywhere else. Other "list of records" surfaces (Persistency, Settlements, Production Report) each build their own table; no shared `<RecordRow>` primitive exists.
- Toast handling is inline (lines 462-501) and bespoke. `CampaignPanel` has its own toast (single string, no kind), `PersistencyTab` has none. Three toast paradigms across the portal.
- Drawer chrome (lines 141-155) — backdrop `<button>` + `max-w-md` panel — is duplicated almost verbatim in `CampaignPanel`'s `CampaignForm` (lines 277-290). No shared `<Drawer>` primitive.
- `UserAvatar` (lines 37-49) is one of 5 avatar implementations across the manager portal (see Cross-cutting Observations).

---

### 3. Campaigns

| Field | Value |
|---|---|
| Source | [`src/components/campaigns/CampaignPanel.jsx`](../../src/components/campaigns/CampaignPanel.jsx) (665 lines) + [`CampaignCard.jsx`](../../src/components/campaigns/CampaignCard.jsx) (109 lines, agent-side) |
| Roles | All view; create gated to UM / BM / TA / PA (line 506); edit gated to creator OR BM+ (line 561) |
| Primary interactions | Filter by status tab; create/edit via drawer; expand row → `ProgressTable` per agent; delete via bespoke modal |
| Design cohesion | ⚠️ Medium |
| Tokens used | `text-ink`, `text-ink-muted`, `bg-primary/10`, `bg-success/15`, `bg-warning/15`, `bg-danger/15`, `bg-border/60`, `accent-primary` on radios |
| Patterns used | Tab pill row (lines 624-639); card row with chevron expansion; drawer form; toast (577-580); bespoke confirm modal (583-594) |
| Empty state | ✓ Per tab (lines 642-648) — generic copy in `.card` |
| Loading state | ✓ 3-row pulse skeleton (lines 564-569) |
| Hover/focus | ✓ Row button has `hover:bg-surface/60`; edit/delete icons color-shift on hover |
| Mobile behavior | Drawer `max-w-md`; `ProgressTable` wrapped in `overflow-x-auto`; tab row uses `flex-1` and `whitespace-nowrap` (fine on mobile) |

**Findings**

- 🟡 **Hardcoded medal hex.** `RankBadge` in [`CampaignCard.jsx:42-44`](../../src/components/campaigns/CampaignCard.jsx) uses literal `bg-[#f59e0b]`, `bg-[#94a3b8]`, `bg-[#b45309]` instead of `--color-medal-1/6/2` tokens.
- Tab pill (line 624) is a 4th independent implementation (Goals top-level, Goals nested, Awards, Production Report TimePeriodToggle are the others).
- `ScopeBadge` (lines 30-35) and `StatusBadge` (lines 37-41) inline; pattern repeats in `DataSourceBadge`, `Leaderboard.LevelChip`, `MasterSheet.statusBadge`, `ManagerAwardsPanel.AwardState`. Seven status-pill variants total.
- Bespoke delete confirm modal (lines 583-594) is the 3rd confirm paradigm.

---

### 4. Production Report

| Field | Value |
|---|---|
| Source | [`src/components/productionReport/ProductionReportTab.jsx`](../../src/components/productionReport/ProductionReportTab.jsx) (router, 14 lines) → `AgentProductionView`, `UnitManagerProductionView`, `BranchManagerProductionView` + shared `ProductionTable`, `RankedLeaderboard`, `TimePeriodToggle`, `DataSourceBadge` |
| Roles | agent (own row), unit_manager (unit aggregate + leaderboard + unit rank in branch), BM+ (branch aggregate + per-unit + top-N + branch total) |
| Primary interactions | Switch period (Week/MTD/Quarter/YTD); branch view: toggle Show all / Top 10; read aggregate / rank / breakdown |
| Design cohesion | ✅ Internally high; ⚠️ disconnected from agent portal idioms |
| Tokens used | `text-ink`, `text-ink-muted`, `text-primary`, `bg-primary/5/10`, `bg-success`, `bg-warning`, `bg-danger`, `.card`, `tabular-nums` |
| Patterns used | `TimePeriodToggle` (radiogroup, `role=radio`); `DataSourceBadge` (estimated/confirmed pill); shared `ProductionTable` + `RankedLeaderboard`; multiple `.card` sections stacked |
| Empty state | ✓ Handled in `ProductionTable` (lines 12-18) and `RankedLeaderboard` (lines 24-30) |
| Loading state | ⚠️ Text-only "Loading production data…" — no skeleton ([`BranchManagerProductionView.jsx:115-117`](../../src/components/productionReport/BranchManagerProductionView.jsx)) |
| Hover/focus | ✓ `hover:bg-surface` on table rows; hover state on leaderboard rows |
| Mobile behavior | `ProductionTable` wrapped in `overflow-x-auto` with `min-w-[560px]` — horizontally scrolls on mobile. Aggregate `flex-wrap` with `min-w` per tile. Reasonable |

**Findings**

- This is the most internally consistent module in the manager portal. The shared sub-components form a coherent mini design system. **It demonstrates that consolidation works.**
- 🟡 **Hardcoded medal colors.** `RankedLeaderboard.medalClass` at lines 32-37 uses arbitrary Tailwind colors (`yellow-400`, `zinc-300`, `amber-600`) instead of `medal-1` / `medal-6` / `medal-2` tokens. Same gap as `CampaignCard.RankBadge`.
- Branch aggregate card ([`BranchManagerProductionView.jsx:134-155`](../../src/components/productionReport/BranchManagerProductionView.jsx)) is essentially a `.config-tile-grid` candidate — currently a hand-rolled `flex-wrap` with `min-w-[130px]` tiles.
- `BranchManagerProductionView` headline "Production Report" (line 127) is a 16px h2 in body Satoshi — agent portal uses Cabinet Grotesk for major headers.

---

### 5. Awards (manager view)

| Field | Value |
|---|---|
| Source | [`src/components/awards/ManagerAwardsPanel.jsx`](../../src/components/awards/ManagerAwardsPanel.jsx) (262 lines) |
| Roles | All manager roles |
| Primary interactions | Read monthly bonus + tier progress; switch annual category tab (Annual / Activity / Recruiting); read `AwardCard` per award |
| Design cohesion | ⚠️ Medium — disconnected from agent BadgeGrid paradigm |
| Tokens used | `text-ink`, `text-ink-muted`, `bg-success/5/10/15/30`, `bg-warning/10/15`, `bg-primary/5/10/20`, `bg-danger/60`, `bg-border/10/40/60`, `bg-warning/8` (non-standard) |
| Patterns used | `AwardCard` (color-coded border + bg per state, lines 52-108); `MonthlyBonusCard` (single bonus surface); 3rd tab-pill row implementation; inline `DataSourceBadge` (lines 7-16) duplicating the shared one |
| Empty state | ✓ Per category (lines 251-254) and zero-agents (lines 222-228) |
| Loading state | ✓ 4× h-28 pulse rectangles (lines 209-216) |
| Hover/focus | ⚠️ None on `AwardCard`s; tab pills have `hover:text-ink` only |
| Mobile behavior | Cards stack vertically; tab pills `overflow-x-auto` for narrow widths (line 237) |

**Findings**

- ❌ **AwardCard ≠ BadgeGrid medallions.** Manager `AwardCard` uses a status-color border + tinted background system. Agent `BadgeGrid` uses glossy-coin medallions. **Manager awards and agent achievements present completely different visual paradigms for what is conceptually the same idea.** This is the largest single visual gap in the manager portal.
- Inline `DataSourceBadge` (lines 7-16) is a re-implementation of the shared `productionReport/DataSourceBadge.jsx` — same name, same behavior, two definitions.
- `bg-warning/8` (line 101) — non-standard Tailwind alpha; "/8" isn't in the project's opacity scale and resolves as an arbitrary value.
- `MonthlyBonusCard` "Next tier" subcard (lines 137-144) is a textbook `.role-hero` + `.bar` primitive candidate.

---

### 6. Master Sheet

| Field | Value |
|---|---|
| Source | [`src/components/manager/MasterSheet.jsx`](../../src/components/manager/MasterSheet.jsx) (327 lines) |
| Roles | All managers |
| Primary interactions | Pick week (last 8 Sundays); search agent; click row → `SubmissionViewer` drawer; export CSV (24 columns) |
| Design cohesion | ✅ High for what it is — power-user spreadsheet view |
| Tokens used | `text-ink`, `text-ink-muted`, `bg-success/15`, `bg-warning/15`, `bg-danger`, `bg-surface`, `bg-border/40/60` |
| Patterns used | Large horizontally-scrolling table with 2 sticky columns (Agent + Status); 5-row pulse skeleton; status badge pill; conditional API color class for at-/below-target |
| Empty state | ✓ Handled inside `<tbody>` (lines 279-289) |
| Loading state | ✓ 5× `SkeletonRow` |
| Hover/focus | ✓ `group-hover:bg-surface/30` on rows; `group-hover:bg-surface/50` on sticky cells |
| Mobile behavior | `overflow-x-auto`; sticky columns explicit `left-0` and `left-[160px]`. Functional, not ergonomic on a 360px viewport |

**Findings**

- Sticky-column table is appropriate here. Pain is chrome inconsistency with neighboring tabs (different control-row pattern from `TimePeriodToggle`, different status-badge implementation).
- Status badge implementation (lines 45-58) is the 4th independent badge pattern in the manager portal.
- Footer text (line 319) "X submissions • Y submitted • Z draft" is the same data shown in `CompliancePanel`'s controls header — duplicated affordance across two adjacent tabs.
- 24-column schema (lines 10-34) is hardcoded. Defensible — these map to `extractFields` keys — but if a new wizard field ships, this list goes silently stale.

---

### 7. Compliance

| Field | Value |
|---|---|
| Source | [`src/components/manager/CompliancePanel.jsx`](../../src/components/manager/CompliancePanel.jsx) (301 lines) |
| Roles | All managers; Unlock action gated to managers via `isManager` check |
| Primary interactions | Pick week; view 3-column kanban (Submitted / Pending-Draft / Missing); view submission; unlock with inline confirm |
| Design cohesion | ⚠️ Medium |
| Tokens used | `text-ink`, `text-ink-muted`, `text-success`, `text-warning`, `text-danger`, `bg-success/10`, `bg-warning/10`, `bg-danger/10`, `border-success/30`, `border-warning/30`, `border-danger/30` |
| Patterns used | 3-column kanban via `Column` component (lines 23-36); `SubmittedAgentRow` with confirm-inline pattern (47-112); plain `AgentRow` (38-45); single-row controls header |
| Empty state | ✓ Per column ("None yet." / "None." / "All accounted for.") |
| Loading state | ✓ 3× h-40 pulse cards in a row + 1× h-10 controls pulse |
| Hover/focus | ✓ Eye and Unlock buttons have hover bg + color shift; `aria-label` on each |
| Mobile behavior | `flex-wrap` on the 3-column row + `min-w-[200px]` per column — wraps to single column on narrow screens |

**Findings**

- Kanban column pattern is unique to this surface; appears nowhere else in either portal.
- Inline Unlock confirm (lines 87-108) is a 4th confirm pattern (typed-email, Cancel/Confirm inline, modal-without-typing, inline now). Six confirm paradigms total (see Cross-cutting Observations).
- `AgentRow` inside columns has the same shape as `PersistencyAgentRow`. Consolidation candidate.
- `Column` header (lines 27-32) is functionally a colored hero strip; could be reframed as a tinted `.role-bar` style.

---

### 8. Persistency

| Field | Value |
|---|---|
| Source | [`src/components/manager/PersistencyTab.jsx`](../../src/components/manager/PersistencyTab.jsx) (374) + [`PersistencyAgentRow.jsx`](../../src/components/manager/PersistencyAgentRow.jsx) (84) + [`PersistencyEntryForm.jsx`](../../src/components/manager/PersistencyEntryForm.jsx) (modal) |
| Roles | `SCOPE_BY_ROLE` (lines 28-34): UM (unit) / BM (branch) / SM,TA,PA (tenant) |
| Primary interactions | Pick month; sort by Persistency / Name / Gross; Add new month; Download CSV; Print; per-row Edit + Playground |
| Design cohesion | ✅ Highest in manager portal |
| Tokens used | `text-ink`, `text-ink-muted`, `text-success`, `text-warning`, `text-danger`, `bg-success/15`, `bg-warning/15`, `bg-danger/15`, `bg-card`, `bg-card-raised`, `bg-primary/10` |
| Patterns used | Controls row (3 selects + 2 export buttons); aggregate summary card with `grid-cols-2 sm:grid-cols-4` stat tiles; threshold legend inline color key (lines 308-315); list of `PersistencyAgentRow` `.card-with-avatar` rows; entry form + playground modals |
| Empty state | ✓ (line 324-326) — italic copy in `.card` |
| Loading state | ✓ 5× h-14 pulse rows |
| Hover/focus | ✓ Button hover; per-row Edit/Playground buttons border + hover. `data-testid` attributes throughout — clearly E2E-tested |
| Mobile behavior | `PersistencyAgentRow` uses `flex-wrap` with `sm:gap-4` — wraps reasonably. Controls `flex-wrap`. Acceptable |

**Findings**

- **`PersistencyAgentRow` is the most agent-portal-shaped row in the manager portal** — has avatar, name, sub, badge, action buttons. Strong candidate for promotion to a shared `<UserRecordRow>` primitive.
- Aggregate "stat tile" grid (lines 286-303) is the closest the manager portal comes to `.config-tile-grid` — but it's hand-rolled, doesn't use the `.config-tile` primitive.
- 🟡 **Magic numbers duplicated.** Thresholds 0.90 / 0.80 hardcoded in `PersistencyTab.jsx` (lines 41-46) AND `PersistencyAgentRow.jsx` (lines 10-15). Should derive from `companyMinimums.persistency`.
- 🟡 **Code smell.** Hidden `<span>` at lines 367-370 renders `Calculator` and `Edit3` icons "for lint cleanliness" — bad practice; the icons are imported but used only via `PersistencyAgentRow`. Should be removed and the lint comment fixed.
- Threshold legend pattern unique to this tab — could become a generic `<StatusKey>` primitive used here + Awards + Compliance.

---

### 9. Goals

| Field | Value |
|---|---|
| Source | [`src/components/manager/GoalsPanel.jsx`](../../src/components/manager/GoalsPanel.jsx) (624 lines — 4 sub-components: `UnitGoalsTab`, `BranchGoalsTab`, `AgentGoalsTab`, `GoalLevelForm`, `NumInput`) + [`ManagerDashboard.jsx:326-413`](../../src/components/dashboard/ManagerDashboard.jsx) wraps in My Production / My Unit sub-tab + [`CommissionPlayground`](../../src/components/goals/CommissionPlayground/index.jsx) |
| Roles | "My Production" all managers; "My Unit" routes through `GoalsPanel` with internal Agent / Unit / Branch sub-tabs gated by `canSeeBranch` (BM+) and `canSeeUnit` (UM+) |
| Primary interactions | Per-agent goal editing (10 numeric fields + notes, save per-row); unit-level goal editing (with BM+ unit picker); branch-level goal editing (single year); personal commission playground reverse-calc |
| Design cohesion | ❌ Low |
| Tokens used | `text-ink`, `text-ink-muted`, `bg-primary`, `bg-success/15`, `bg-warning`, `bg-danger/10/30`, `bg-surface`, `.card`, `focus:ring-primary/40` |
| Patterns used | Nested sub-tab bar (ManagerDashboard) + nested sub-tab bar (GoalsPanel) + per-agent `.card` form; `NumInput` inline component (lines 23-42); `BelowFloorWarning` pill (44-54) |
| Empty state | ✓ Per tab |
| Loading state | ✓ 3× h-40 (Agent), h-24 single (Unit/Branch) |
| Hover/focus | `focus-within` ring on `NumInput`; saved button color-shift to `bg-success/15` |
| Mobile behavior | ❌ **Inputs are h-9 (36px) — violates the project's 44pt touch-target standard** (`src/index.css` `.input` is `min-h-[44px]`); `grid-cols-2 sm:grid-cols-3 sm:grid-cols-4` inside each agent card; stacks fine |

**Findings**

- ❌ **3-level nav cliff.** Goals tab → My Production / My Unit → Agent Goals / Unit Goals / Branch Goals. **Three layers of navigation for one conceptual surface.** Awards has 1 sub-tab layer; Production Report has implicit role-based switching. Inconsistent depth.
- ❌ **Inputs below touch-target standard.** `NumInput` h-9 = 36pt. Project standard is 44pt minimum. `.input` primitive in `index.css` has `min-h-[44px]` — `NumInput` bypasses it.
- ❌ **`GapAnalysisPanel` not surfaced.** The agent portal renders [`GapAnalysisPanel.jsx`](../../src/components/goals/GapAnalysisPanel.jsx) on `AgentDashboard` to visualize the goal hierarchy this exact data feeds. Managers cannot see the cascade their goal-setting produces.
- 5th input pattern in the manager portal (`NumInput`).
- `AgentGoalsTab` Save button (lines 461-473), `UnitGoalsTab` Save button (lines 191-199), `BranchGoalsTab` Save button (lines 283-291) — same code, three copies, slightly different styles (`h-9 px-4 rounded-lg` vs `h-10 px-4 rounded-xl`).
- `AgentGoalsTab` stacks all agents with full forms — 8 agents = 1000+px scroll.
- 🟡 **Default minimums duplicated.** `{ annualAPI: 200000, annualApps: 42, persistency: 90 }` at lines 316 AND 413 — same fallback in `goalsService.js`.

---

### 10. Settlements

| Field | Value |
|---|---|
| Source | [`src/components/manager/SettlementPanel.jsx`](../../src/components/manager/SettlementPanel.jsx) (577 lines) |
| Roles | BM/TA/PA write; UM read-only unless `userProfile.canConfirmSettlements` flag |
| Primary interactions | Single-entry form OR bulk-entry mode (toggle); settlement history table with pagination + per-row delete confirm |
| Design cohesion | ⚠️ Medium |
| Tokens used | `text-ink`, `text-ink-muted`, `text-primary`, `text-success`, `text-danger`, `bg-primary/8/10/20` (non-standard `/8`), `bg-success`, `bg-danger/10/30`, `bg-surface`, `bg-border/30/40` |
| Patterns used | TWO sections in one panel (Enter + History); shared input class const at line 221; bulk table inside `.card` (lines 411-466); separate history table (lines 503-562); inline-row delete confirm (528-547) |
| Empty state | ✓ Handled (245-247 / 295-303 / 494-497) |
| Loading state | ✓ 4-row pulse / h-20 pulse |
| Hover/focus | ✓ `hover:bg-surface/60` on history rows; delete button color-shifts; bulk-mode toggle changes icon |
| Mobile behavior | History table `overflow-x-auto`; bulk entry table `overflow-x-auto` with input widths fixed (`w-24` / `w-16`) — fine on mobile but tight |

**Findings**

- Mode toggle (lines 314-320) is a tiny icon+text button rather than a tab pill — different paradigm from every other "switch view" interaction.
- Inline-row delete confirm (528-547) is the 6th and final confirm pattern (typed-email, Cancel/Confirm inline ×2, modal-without-typing, pendingMode panel, bulk-validate, this).
- 🟡 **`bg-primary/8` non-standard alpha** (line 227) — same issue as `bg-warning/8` in Awards.
- Two tables in same panel use different chrome: history table has `bg-surface-raised` wrapper (line 503) while read-only history uses `bg-[var(--color-surface)]` (line 250).
- Form chrome (lines 221-222 `inputCls` / `labelCls` consts) duplicates per-tab; existing `.input` + `.label` classes in `index.css` would work.

---

### 11. Leaderboard (shared with agent)

| Field | Value |
|---|---|
| Source | [`src/components/gamification/Leaderboard.jsx`](../../src/components/gamification/Leaderboard.jsx) (331 lines) |
| Roles | All; manager view (lines 308-329) shows full competition + separate "Branch Unit — not in competition" demoted section; agent view (285-305) shows champions banner + own rank card + competition |
| Primary interactions | Read-only; live updates via `onSnapshot` |
| Design cohesion | ⚠️ Medium |
| Tokens used | `text-ink`, `text-ink-muted`, `text-primary`, `text-warning`, `bg-primary/5/10/20`, `bg-success/15`, `bg-warning/15`, `bg-danger/15`, `bg-border/40/60` |
| Patterns used | `WeeklyChampionsBanner` (lines 29-79) — special hero card with 3 `ChampionCard` tiles; `LeaderRow` (128-170) with avatar + name + `LevelChip` + streak flame + points; internal `AgentAvatar` duplicate (lines 81-110) |
| Empty state | ✓ Handled (lines 271-280) — keeps champions banner, replaces list with `.card` empty |
| Loading state | ✓ 5× h-14 pulse rows |
| Hover/focus | ⚠️ `LeaderRow` has `transition-colors` but no hover bg shift (only "current user" highlight) |
| Mobile behavior | Rows wrap (`flex-wrap` on inner header line 147); `WeeklyChampionsBanner` stays `grid-cols-3` even on mobile — tight on 360px |

**Findings**

- `WeeklyChampionsBanner` uses `bg-primary/10` with `border-primary/20` — close to `.role-hero` but flat, no gradient, no donut, no medallions. **This was the precursor to `.role-hero`, never upgraded.**
- `LeaderRow` rank uses `Trophy` icon for #1 + plain number for others (lines 137-141). Could swap to `medal-1` / `medal-6` / `medal-2` medallions for the top 3.
- `AgentAvatar` (lines 81-110) is a 4th avatar implementation.
- `LevelChip` (`LEVEL_COLORS` 112-118) maps Rookie/Associate/Pro/Elite/Legend to color tokens. Uses `success`/`warning`/`danger` semantically but those colors mean different things elsewhere.
- Manager-only "Branch Unit — not in competition" section (318-327) is `opacity-60` and visually demoted. Quietly differentiates manager view; agents don't know it exists.

---

### 12. Agent of Month

| Field | Value |
|---|---|
| Source | [`src/components/manager/AgentOfMonthTab.jsx`](../../src/components/manager/AgentOfMonthTab.jsx) (180 lines) + [`AOMCategorySection.jsx`](../../src/components/manager/AOMCategorySection.jsx) (110 lines) |
| Roles | branch_manager+ only (UM excluded explicitly in NAV_ITEMS line 51). Requires `userProfile.branchId` or shows "No branch assigned" |
| Primary interactions | Switch month (current/prev — only enabled if `isWithinEditWindow`); Refresh; Approve a candidate as winner per category |
| Design cohesion | ✅ Most a11y-polished surface in either portal |
| Tokens used | `text-ink`, `text-ink-muted`, `text-primary`, `bg-primary/10/20`, `bg-surface-raised`, `bg-card`, `bg-warning-tint`, `text-warning`, `bg-danger-tint`, `text-danger` |
| Patterns used | Header with month-toggle pill group (lines 90-119) — proper `role="group"` + `aria-pressed`; one `AOMCategorySection` per category; per-section winner highlight + ranked candidate list with Approve button |
| Empty state | ✓ Both at panel level (no branchId) and per-section ("No submissions for this month yet") |
| Loading state | ⚠️ Text-only "Loading candidates…" (line 155) — no skeleton |
| Hover/focus | ✅ `focus-visible:ring-primary` on ALL interactive elements (refresh, month-toggle, approve). Best in portal |
| Mobile behavior | `grid-cols-1 lg:grid-cols-3` — stacks cleanly. Responsive |

**Findings**

- Uses `bg-warning-tint` and `bg-danger-tint` tokens (lines 141, 148) — these tokens exist in `:root` but are inconsistently used. Most of the manager portal uses `bg-warning/10` and `bg-danger/10` instead. Two ways to do the same thing.
- 🟡 **`p-6 max-w-5xl` width constraint** (line 79) — only manager surface (along with Kiosk) that constrains its width inside Shell. Inconsistent with neighboring tabs.
- 🟡 **`border-card-raised` undefined utility** (line 43) — appears only here and in `KioskModeTab`. Project defines `bg-card-raised`, not `border-card-raised`. Renders as default border, silently.
- `AOMCategorySection` inline `AgentAvatar` (lines 11-30) is the 5th avatar implementation.

---

### 13. Kiosk

| Field | Value |
|---|---|
| Source | [`src/components/kiosk/KioskModeTab.jsx`](../../src/components/kiosk/KioskModeTab.jsx) (193) + `KioskShell.jsx` (109) + `KioskRoute.jsx` + 13 panel files in `src/components/kiosk/panels/` |
| Roles | branch_manager+ only |
| Primary interactions in MANAGER UI | Generate kiosk URL (creates token, auto-copies); Refresh; per-token Copy / Open / Revoke |
| Design cohesion | ⚠️ Medium |
| Tokens used | `text-ink`, `text-ink-muted`, `text-primary`, `bg-primary`, `bg-surface-raised`, `bg-card`, `bg-danger-tint`, `bg-success` (only via copied state) |
| Patterns used | Header + action bar + token list cards with icon-button cluster |
| Empty state | ✓ (lines 133-137) — "No active kiosk URLs" |
| Loading state | ⚠️ Text-only "Loading…" (line 130) |
| Hover/focus | ✅ `focus-visible:ring-primary` on all action icons |
| Mobile behavior | `p-6 max-w-3xl` — same width-constrained pattern as AOM |

**Findings**

- 🟡 **`KIOSK_BASE = 'https://agencytrack.vercel.app/kiosk'` hardcoded** (line 8). Will produce wrong URLs on Vercel preview deploys. Should derive from `window.location.origin`.
- 🟡 **`KioskShell` loading spinner uses literal hex** `#1a1612` and `#4ab5b8` (lines 80-82). The project has `--color-presentation-*` tokens for exactly this case (always-dark surfaces). Currently bypassed.
- Same `border-card-raised` undefined utility as AOM.
- Token URL at line 151 uses `font-mono` — JetBrains Mono is loaded; usage is rare across the app.
- Action icon cluster (`h-11 w-11`) is conceptually identical to `.topbar-icon-btn` primitive. Should use that.

---

### 14. Profile (shared with agent)

| Field | Value |
|---|---|
| Source | [`src/components/profile/ProfileScreen.jsx`](../../src/components/profile/ProfileScreen.jsx) (482 lines) |
| Roles | All; logging-mode panel agent-only; `unitName` field unit_manager-only |
| Primary interactions | Upload photo (with progress bar); edit display name / phone / bio / unitName; agents only: pick logging mode (Weekly/Daily/Hybrid) with confirm-flow + daily nudge time |
| Design cohesion | ✅ High |
| Tokens used | `text-ink`, `text-ink-muted`, `text-primary`, `text-danger`, `bg-primary`, `bg-primary/10`, `bg-surface`, `bg-warning/10/30`, `bg-border`, `bg-danger/10/20`, `.card`, `.btn-primary` |
| Patterns used | Avatar + camera overlay + progress bar; multiple `.card` sections stacked; fieldset + radio cards for logging mode; `pendingMode` confirm panel inline |
| Empty state | N/A — always personal data |
| Loading state | None — initial render uses `userProfile` from context |
| Hover/focus | ✓ `focus:ring-primary` on inputs; `hover:border-primary/40` on logging-mode radio cards |
| Mobile behavior | ✅ Inputs are h-11 (44pt touch target compliant); forms stack natively; photo upload progress bar `max-w-xs` centered |

**Findings**

- Profile is shared with agent portal so mostly fine. Manager-specific concerns: `unitName` field appears as one extra row inside the Edit Profile card with no visual indication that unit branding is a manager-only affordance. Logging mode panel shows for agents only, so managers see a noticeably shorter profile (3 cards vs 4) with no visual call-out — page just feels emptier for managers.
- Read-only info card (lines 460-477) is a perfect `.config-tile-grid` candidate.

---

## Tenant Admin Dashboard (separate dashboard fork)

A tenant_admin lands on [`TenantAdminDashboard`](../../src/components/dashboard/TenantAdminDashboard.jsx), not `ManagerDashboard`. Out of audit scope per the kickoff brief but visible enough to surface its current state:

| Field | Value |
|---|---|
| Source | [`src/components/dashboard/TenantAdminDashboard.jsx`](../../src/components/dashboard/TenantAdminDashboard.jsx) + admin panels in `src/components/admin/` |
| Sidebar | Dashboard / Branches / All Users / Roles & Permissions [disabled] / Company Config / Campaigns / Audit Log [disabled] / Billing [disabled] / Settings [disabled] / Profile |
| Bottom-nav | Dashboard / Config / Users / Campaigns / Profile |
| Design cohesion | ✅ Best of any manager-tier dashboard; uses `.config-tile-grid`, `.role-bar` from B5 |

**Critical finding:** A tenant_admin currently has **no path** from this dashboard to Goals / Persistency / Settlements / Master Sheet / Compliance / Awards / AoM / Kiosk. Whether this is intentional (TA delegates everything operational to BMs) or an oversight is a strategic decision deferred to the recommendations document, not this audit.

🟡 **Placeholder content in production** — four sidebar items are aria-disabled "Coming soon" stubs (Roles & Permissions, Audit Log, Billing, Settings); `BranchHealthCards` renders "% to YTD goal" and "Last sync" as `—` "Coming soon"; `RoleDistributionCard` has a "Manage roles & permissions · Coming soon" disabled button; `TenantAdminDashboard.jsx:166-176` shows "Active Branches" as `${count} / ${count}` (numerator = denominator) with hardcoded "All operational" sub.

---

## Cross-cutting observations

### Patterns that work well across the manager portal

- The `<Shell>` chrome (sidebar + topbar + bottom-nav) is consistent across `ManagerDashboard`, `TenantAdminDashboard`, and `AgentDashboard`. B4 absorption did its job.
- Skeleton loading via `bg-border/30 animate-pulse` rectangles is used in 8+ panels with consistent shape.
- `extractFields()` + `getTenantUsers()` / `getAllYTDSubmissions()` is the canonical reader/fetcher pair, used uniformly in 6+ tabs.
- The Production Report sub-module is the most internally cohesive corner — shared `ProductionTable`, `RankedLeaderboard`, `TimePeriodToggle`, `DataSourceBadge`. A model for what cross-tab consolidation looks like.
- `AgentOfMonthTab`'s a11y is the gold standard — `focus-visible:ring-primary` on every interactive, proper ARIA roles.

### Patterns that hurt cohesion (with counts)

| Pattern | Independent implementations | Locations |
|---|---|---|
| Tab pill row | **5** | Goals top-level, Goals nested, Campaigns, Awards, Production Report TimePeriodToggle |
| Avatar | **5** | UserAvatar (UserManagement), AgentAvatar (Leaderboard), AgentAvatar (AOMCategorySection), inline (PersistencyAgentRow), photo block (ProfileScreen) |
| Confirm/destructive flow | **6** | Typed-email modal (DeactivateConfirmDialog), inline-row Cancel/Confirm (CompliancePanel Unlock + SettlementPanel Delete), modal w/o type-confirm (CampaignPanel Delete), pendingMode panel (ProfileScreen logging mode), bulk-confirm (SettlementPanel bulk), single-step modal save (PersistencyEntryForm) |
| Status pill / badge | **7+** | ScopeBadge + StatusBadge (CampaignPanel), DataSourceBadge + AwardState (ManagerAwardsPanel), inline DataSourceBadge (productionReport/), statusBadge (MasterSheet:45), LevelChip (Leaderboard) |
| Save button | **4+** | AgentGoalsTab, UnitGoalsTab, BranchGoalsTab, SettlementPanel — same idle/saving/saved/error states, 3 different styles |
| Input field | **5** | NumInput (Goals), MasterSheet search/select, CampaignPanel inputs, SettlementPanel inputs, .input primitive (rarely used by manager tabs) |

### Token-system gaps

- **Categorical color tokens unused.** `--color-gold` (achievement) and `--color-ink` (document/violet) are absent from every manager surface. The manager portal uses only `--color-success`, `-warning`, `-danger`, `-primary` — feels monochromatic next to the agent feed's polychromatic activity pills.
- **Hardcoded medal colors in 3 places.** Should use `--color-medal-*`:
  - [`CampaignCard.jsx:42-44`](../../src/components/campaigns/CampaignCard.jsx) — `bg-[#f59e0b]/[#94a3b8]/[#b45309]`
  - [`RankedLeaderboard.jsx:32-37`](../../src/components/productionReport/RankedLeaderboard.jsx) — `yellow-400/zinc-300/amber-600`
  - [`Leaderboard.jsx`](../../src/components/gamification/Leaderboard.jsx) — `Trophy` icon + `text-warning` instead of medallion
- **Non-standard Tailwind alpha values.** `bg-warning/8` (`ManagerAwardsPanel.jsx:101`), `bg-primary/8` (`SettlementPanel.jsx:227`). Tailwind doesn't ship `/8` — these resolve as arbitrary values. Should be `/10`.
- **Undefined utility class.** `border-card-raised` (`AOMCategorySection.jsx:43`, `KioskModeTab.jsx:148`). Project defines `bg-card-raised`, not `border-card-raised`. Silently renders as default border.

### Information architecture

- **Sidebar imbalance.** The "Manage" section (Overview, Team, Campaigns, Production Report, Awards, Master Sheet, Compliance) has 7 items; "Operations" (Persistency, Goals, Settlements) has 3; "Tools" (Leaderboard, AoM, Kiosk, Profile) has 4. Several tabs sit far from related work — Master Sheet and Production Report both surface week's data with different cuts but live in different sections; Compliance and Master Sheet have heavy overlap (both list submissions for a week) and at least sit adjacent.
- **3-level nav cliff in Goals** (see screen 9). Three layers of navigation for one conceptual surface. Awards has 1 sub-tab layer; Production Report has implicit role-based switching with no visible sub-tabs. Inconsistent depth.
- **Naming drift**:
  - "Master Sheet" (sidebar) = "Reports" (BOTTOM_NAV) — same surface, two names
  - "Production Report" vs "Reports" vs "Master Sheet" — three things called some flavor of "report"
  - "Team" (sidebar) vs "Add User" + "User Roster" (inside the panel) — concept naming drift
  - "Goals" → "My Unit" → "Agent Goals" / "Unit Goals" / "Branch Goals" → on agent portal same data is called "Goal Hierarchy" in `GapAnalysisPanel`. Four label variants.

### Role-specific differences in code

- **Branch CSV export** ([`ManagerDashboard.jsx:210-219`](../../src/components/dashboard/ManagerDashboard.jsx)) — BM/TA/PA only (in topbar)
- **Bulk Import Users / Goals** — TA/PA only
- **AoM + Kiosk tabs** — BM+ only (UM excluded)
- **Persistency scope** — UM (unit) / BM (branch) / SM,TA,PA (tenant)
- **GoalsPanel sub-tabs** — UM sees Agent + Unit; BM+ sees Agent + Unit + Branch
- **Settlement panel** — BM/TA/PA write-mode; UM read-only unless `userProfile.canConfirmSettlements` flag
- **Compliance Unlock** — all manager roles
- **Campaign create / edit** — UM scope locked to own unit; BM+ can edit any
- **TenantAdminDashboard** is a separate dashboard component routed from `App.jsx` for tenant_admin role — has different sidebar; does not route to ManagerDashboard
- **Sales_manager** has no current dashboard divergence; routes to `ManagerDashboard` like other managers. Cross-branch surfaces planned for Phase 9 (post-pilot)

---

## Mobile-secondary audit

PR #90 (Mobile FU#1) shipped touch-target compliance and basic mobile coverage across the manager portal. The `<Shell>` chrome works correctly at 390px (sidebar hides, bottom-nav appears, mobile drawer absorbs overflow nav). What this audit identifies is unfinished mobile work *inside* the tabs:

| Tab | Mobile state |
|---|---|
| Overview | StatCards stay 2-up; no responsive scale-up at sm: / md: |
| Team | Roster grid does NOT collapse; horizontal overflow on <640px |
| Campaigns | Drawer / tabs respond; `ProgressTable` has `overflow-x-auto` |
| Production Report | `ProductionTable` has `overflow-x-auto` with `min-w-[560px]`; aggregate `flex-wrap` |
| Awards | Cards stack; tab pills `overflow-x-auto` |
| Master Sheet | `overflow-x-auto`; sticky columns work but 22 columns to scroll on 360px |
| Compliance | `flex-wrap` with `min-w-[200px]` per kanban column — wraps to single column |
| Persistency | `flex-wrap` with `sm:gap-4` — acceptable |
| Goals | h-9 inputs **violate 44pt standard**; otherwise stacks |
| Settlements | `overflow-x-auto`; bulk inputs tight |
| Leaderboard | `WeeklyChampionsBanner` stays `grid-cols-3` — tight on 360px |
| Agent of Month | `grid-cols-1 lg:grid-cols-3` — clean stacking |
| Kiosk | `max-w-3xl` constraint; cards stack |
| Profile | h-11 inputs ✓; clean stacking |

**Mobile bottom-nav** ([`ManagerDashboard.jsx:60-66`](../../src/components/dashboard/ManagerDashboard.jsx)) is a single shared list for all 4 manager roles: Overview / Team / Reports (= Master Sheet) / Campaigns / Profile. Compliance, Persistency, Goals, Settlements, Awards, Leaderboard, AoM, Kiosk reachable via `MobileNavDrawer` only.

**For a unit_manager** whose primary daily workflow is Persistency entry + Goals review, both surfaces are one drawer-tap deeper than they need to be. The recommendations document proposes role-specific `BOTTOM_NAV_DEFAULTS` to address this.

---

## Hardcoded data, placeholders, and silent debt — full inventory

| Location | What | Severity |
|---|---|---|
| `ManagerDashboard.jsx:134-140` | Entire Overview stats object literal — totalAgents, submittedThisWeek, pendingSubmissions, teamYTDAPI, teamAPIGoal | 🔴 Critical |
| `KioskModeTab.jsx:8` | `KIOSK_BASE = 'https://agencytrack.vercel.app/kiosk'` — production URL hardcoded; misfires on previews | 🟡 Medium |
| `PersistencyTab.jsx:41-46` + `PersistencyAgentRow.jsx:10-15` | Threshold 0.90/0.80 hardcoded in both files (duplicated); should derive from companyMinimums | 🟡 Medium |
| `ManagerAwardsPanel.jsx:184-188` | Hardcoded category-id allow-list for Annual/Activity/Recruit grouping — fragile to engine changes | 🟡 Medium |
| `BranchHealthCards.jsx:71-77` | Per-branch "% to YTD goal" and "Last sync" rendered as `—` "Coming soon" — placeholder data in production | 🟡 Medium |
| `TenantAdminDashboard.jsx:166-176` | "Active Branches" tile shows `${count} / ${count}` (denominator = numerator); "System Health" tile is `—` "Coming soon" | 🟡 Medium |
| `RoleDistributionCard.jsx:74-82` | "Manage roles & permissions · Coming soon" disabled button | 🟡 Medium |
| `TenantAdminDashboard.jsx:46-53` | Four sidebar items disabled with no destination: Roles & Permissions, Audit Log, Billing, Settings | 🟡 Medium |
| `MotivationalCarousel.jsx:367` | `bg-[#01696f]/8` literal hex (already flagged in CLAUDE.md) | 🟢 Low |
| `GoalsPanel.jsx:316, 413` | Default minimums fallback `{ annualAPI: 200000, annualApps: 42, persistency: 90 }` duplicated in two places | 🟢 Low |
| `CampaignCard.jsx:42-44` | RankBadge hex literals `bg-[#f59e0b]/[#94a3b8]/[#b45309]` instead of medal tokens | 🟢 Low |
| `RankedLeaderboard.jsx:32-37` | medalClass uses `yellow-400/zinc-300/amber-600` Tailwind colors instead of `medal-1/6/2` | 🟢 Low |
| `KioskShell.jsx:80-82` | Loading spinner uses literal `#1a1612` and `#4ab5b8` instead of `--color-presentation-*` tokens | 🟢 Low |
| `ProfileScreen.jsx:11-12` | `MAX_BYTES = 2*1024*1024`, `BIO_MAX = 200` — no tenant config | 🟢 Low |
| `ManagerAwardsPanel.jsx:101` | `bg-warning/8` non-standard Tailwind alpha | 🟢 Low |
| `SettlementPanel.jsx:227` | `bg-primary/8` non-standard alpha | 🟢 Low |
| `MasterSheet.jsx:10-34` | 24-column hardcoded schema — silent stale risk if wizard fields change | 🟢 Low |
| `PersistencyTab.jsx:367-370` | Hidden `<span>` rendering Calculator+Edit3 icons "for lint cleanliness" — code smell | 🟢 Low |
| `AOMCategorySection.jsx:43`, `KioskModeTab.jsx:148` | `border-card-raised` — undefined utility class | 🟢 Low |

**No `TODO` / `FIXME` comments** found in any read manager file — the codebase doesn't flag this debt inline. All these placeholders are silently in production.

---

## What this audit explicitly does NOT do

- Recommend redesigns. That is the recommendations document's job.
- Propose architectural changes (role system, data model, etc.). That is outside this audit's scope per Phase 3 hard stops.
- Touch source code. The `src/` tree is read-only for this PR.
- Change `docs/FOLLOW_UPS.md`. Closures and additions are handled by future housekeeping briefs.
- Update `CLAUDE.md`. Design system documentation update can be a follow-up after recommendations are accepted.

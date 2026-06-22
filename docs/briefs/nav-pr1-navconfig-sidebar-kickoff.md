# Nav Redesign — PR-1: navConfig + Sidebar groups + scope chips + Planner SOON — Kickoff Brief

**Type:** Feature (M) — nav IA centralization, presentation + routing wiring. No Firestore, no rules, no Cloud Functions.
**Merge channel:** HUMAN-MERGE (touches routing for Agent/UM/BM). Not green-channel.
**Trigger:** Nav & Quick Actions redesign (build spec: `Nav & Quick Actions — CC Build Spec.md`). This is PR 1 of 4. It centralizes the per-role sidebar nav into a single config and renders the §2 `pinned`-layout section groups, scope chips, and the Planner `SOON` stub. Pinning, Quick-Add, and the menu-layout preference are PR-2/3/4 and are OUT of scope here.

---

## Inputs
- This brief: `docs/briefs/nav-pr1-navconfig-sidebar-kickoff.md`
- Build spec (reference, in dispatcher's hands — not committed): `Nav & Quick Actions — CC Build Spec.md` §2 (sidebar nav per role) and §6 (acceptance).
- Existing shell: `src/components/shell/{Shell,Sidebar,TopBar,MobileBottomNav,MobileNavDrawer}.jsx`
- Existing coming-soon mechanism: `src/config/comingSoonTabs.js` + `src/components/ui/ComingSoonPanel.jsx` (REUSE for Planner — do not invent a new disabled-stub).

---

## Decisions locked — do not re-litigate
(If Phase 0 surfaces a reason to revisit, treat as a surprise-stop → STOP and wait for dispatcher.)

1. **Layout in scope = `pinned` only.** `workspace` / `both` are PR-4. Do not build the My Work/My Team toggle here.
2. **The ★ Pinned zone is NOT rendered in PR-1.** Pinning (seeds, star affordance, persistence) is PR-2 in full. PR-1 ships section groups only. Do not add pin seeds, star icons, or any `prefs/app` reads/writes.
3. **Roles centralized this track = `agent`, `unit_manager`, `branch_manager` only.**
   - `agent` → **agent** config.
   - `unit_manager` AND `branch_manager` → **producingManager** config (both keep a My Production group — preserves PR #719).
   - Branch-only oversight items are gated to `branch_manager` *within* the producingManager config (see §Target nav).
   - A **manager** (non-producing) config is DEFINED in navConfig per spec §2 but assigned to NO role this track (reserved).
   - `sales_manager`, `tenant_admin`, `platform_admin` → **UNTOUCHED.** Their existing inline nav must render exactly as today. Do not route them through navConfig.
4. **Game Plan is a live route** (`dashboard/GamePlanV2/`). Render it with NO `NEW` tag. Money Needs (`agent/MoneyNeedsPanel.jsx`) is its child.
5. **Planner is the only `SOON` item.** Render disabled via the existing `comingSoonTabs` mechanism.
6. **Prospect Prep:** spec marks it `SOON`, but `agent/ProspectInfoPanel.jsx` exists. Phase 0 must determine whether it is a **wired standalone agent destination** today or **embedded only**. If standalone → render as a live Tools item (no SOON). If embedded-only / not independently routable → render `SOON`. Surface the finding in the report-back.
7. **No-regression guard (critical):** the new agent/UM/BM nav must lose NO destination that the current sidebar reaches for that role. Phase 0 builds an explicit old→new mapping; any current destination not present in the new config is folded into the closest group (branch-only items gated to `branch_manager`), or surfaced as a STOP if there's no clean home.
8. **Scope chips** (MINE / TEAM / BOTH) render in PR-1 on the items enumerated in §Target nav. A chip is a small label next to the item; it does not change routing in PR-1.
9. **44px hit targets stay.** Any new interactive element (chip is non-interactive; items already are) keeps ≥44px tap area. focus-visible rings preserved. No new hex — reuse existing tokens.

---

## Target nav (end state for PR-1)

Item shape (extend the existing item object the Sidebar already consumes — confirm exact keys in Phase 0):
`{ key, label, icon, tabId? | action?, scope?: 'MINE'|'TEAM'|'BOTH', soon?: true, child?: true }`
Items are grouped by `sectionLabel` (existing Sidebar grouping). `child:true` renders indented under the preceding item (Money Needs under Game Plan).

### agent
- **Today:** Dashboard · Daily Log · Weekly Report · History
- **Planning:** Game Plan → Money Needs `child` · Goals · Planner `SOON`
- **Tools:** Commission · Persistency · Policy Ledger · Prospect Prep `(SOON per decision #6 unless Phase 0 proves standalone)` · Production Report
- **Recognition:** Leaderboard · Awards · Career Portal

### producingManager (role ∈ {unit_manager, branch_manager})
- **My Production:** Dashboard · Daily Log · Weekly Report · Commission · Persistency `MINE` · Policy Ledger · Production Report `MINE` · History
- **My Team:** Team Dashboard · Master Sheet · Weekly WARs · Recruiting · Team Goals `TEAM` · Persistency Entry `TEAM` · Compliance · Campaigns · Meetings · Team Reports `TEAM` · Team Awards `TEAM`
  - **branch_manager-only (gated):** Reconciliation · Kiosk Mode — appended to My Team (or an Oversight subgroup) only when `role === 'branch_manager'`. (These exist as `PolicyReconciliationPanel.jsx` / `KioskModeTab.jsx`; include only if Phase 0 confirms they are current BM destinations — no-regression guard.)
- **Planning:** Game Plan · Goals `MINE` · Planner `SOON`
- **Recognition:** Leaderboard `BOTH` · Awards `MINE` · Career Portal

### manager (DEFINED, UNASSIGNED this track — per spec §2)
- **Team:** Team Dashboard · Master Sheet · Weekly WARs · Team Goals · Reports
- **Grow:** Recruiting · Campaigns · Meetings · Planner `SOON`
- **Oversight:** Compliance · Persistency · Reconciliation
- **Recognition:** Leaderboard · Awards · Kiosk Mode · Career Portal

> Map labels to **existing** tabIds/actions discovered in Phase 0. Do NOT fabricate a destination. Any label here with no existing route → STOP and surface (except Planner, which is `SOON` by design).

---

## Phase 0 — gate + audit (no edits)
1. Rule 9 clean-main gate: `git checkout main; git fetch origin; git pull --ff-only origin main; git status`. Record HEAD SHA.
2. Fresh branch: `git checkout -b feat/nav-pr1-navconfig`. Run `git branch --show-current` and confirm before any commit (standing rule).
3. **Source-verify (Rule 17)** — pair grep with `git ls-files`:
   - Confirm the Sidebar item contract: which keys it reads (`navItems`, `sectionLabel`, `tabId`, `action`, scope/child if any). File: `src/components/shell/Sidebar.jsx`.
   - Locate where each role's nav is **currently constructed** — grep `navItems` / `sectionLabel` / `<Sidebar` / `<Shell` / `setActiveTab(` across `src/components/dashboard/AgentDashboard.jsx` and `src/components/dashboard/ManagerDashboard.jsx`. Extract the current items verbatim (key/label/tabId/action/sectionLabel) for agent, unit_manager, branch_manager. Note how `ManagerDashboard` branches by role.
   - Confirm `src/config/comingSoonTabs.js` shape + `ui/ComingSoonPanel.jsx` API (how a tab is marked coming-soon).
   - Confirm Game Plan tabId (`dashboard/GamePlanV2/`) and Money Needs route (`agent/MoneyNeedsPanel.jsx`).
   - **Decision #6:** determine Prospect Prep wiring (standalone route vs embedded). Record verdict.
   - Locate the nav test: `src/components/dashboard/__tests__/AgentDashboardNav.test.jsx` (and any manager-nav test). These will need updating in Phase 2.
4. **Build the old→new mapping table** for agent / unit_manager / branch_manager. Every current destination must map into the new config (no-regression guard, decision #7). Flag any unmapped current item or any target label with no route.
5. **Hard-stop:** if the current nav for UM/BM differs materially from the §Target assumptions such that a clean fold-in isn't possible, or if any non-Planner target label has no existing route, **STOP and wait for dispatcher** with the mapping table.

## Phase 1 — navConfig
- Create `src/components/shell/navConfig.js` as the single source of truth. Export a resolver, e.g. `getNavConfig(role)` returning the grouped item list for `agent` / `producingManager` (UM+BM) / `manager` (defined, unused). Encode `sectionLabel`, `scope`, `soon`, `child`, and branch-only gating (a predicate or a `roles` field on the gated items).
- Items reference **existing** tabIds/actions from the Phase 0 mapping. Planner items carry `soon:true` and wire through `comingSoonTabs`/`ComingSoonPanel`.

## Phase 2 — wire dashboards + Sidebar rendering
- `AgentDashboard.jsx`: replace the inline agent navItems with `getNavConfig('agent')`.
- `ManagerDashboard.jsx`: for `role ∈ {unit_manager, branch_manager}` use `getNavConfig('producingManager')` (pass role so branch-only items resolve). For all other roles, **leave the existing inline nav exactly as-is** (decision #3).
- `Sidebar.jsx` (+ `MobileNavDrawer.jsx` which shares the list): render scope chips (MINE/TEAM/BOTH) and `child` indentation; render `soon` items disabled with the coming-soon affordance. Keep the active-item left-bar + tint, collapse toggle, sign-out, focus-visible rings. No new hex; reuse tokens.
- Update `AgentDashboardNav.test.jsx` (and any manager-nav test) to match the new structure.
- **MobileBottomNav.jsx: do NOT change behavior in PR-1** (center FAB stays as today; Quick-Add is PR-3). Only update if its per-role item source is the same array you're centralizing AND leaving it would break the build — if so, surface as a stop rather than silently reworking mobile nav.

## Phase 3 — verify
- `npm run lint` and `npm run build` green. If either fails → STOP.
- `npm test` green (the updated nav tests included). If a pre-existing unrelated failure appears, surface it; do not fix out-of-scope.
- a11y: run the established axe/playwright sidebar check. Gate = **no NEW serious/critical vs main baseline** (delta, not absolute zero). The `text-*-faint → text-*-muted` contrast fix is pre-authorized in-PR (Rule 9 carve-out); any OTHER new serious/critical node → STOP and surface.

## Phase 4 — smoke
- Real walk, not just render: log in as the **test agent** (`kelsean@gmail.com` / `tatillife_smoke`) on desktop; assert the new agent groups (Today/Planning/Tools/Recognition) render, Game Plan has no NEW tag, Money Needs is indented under Game Plan, Planner shows the coming-soon state and is non-navigable, and an existing destination (e.g. Policy Ledger) still navigates.
- If a producing-manager test credential is available, repeat for a UM and a BM (assert My Production + My Team render; BM additionally shows Reconciliation/Kiosk if folded in). If no PM credential is available, note the gap in the report (do not fabricate a pass).
- Mobile-viewport check (390×844) uses the viewport-aware login routine (desktop sidebar selector is CSS-hidden at that size).
- Run against the Vercel preview. (Production post-merge smoke is the dispatcher/operator step after merge.)

## Phase 5 — docs (placeholders)
- `docs/CONTEXT.md`: add an active-track entry for the Nav redesign with PR-1 = this branch; leave the squash-SHA as a `<!-- PR #___ -->` placeholder for the post-merge fill. Respect the size cap (active track/HEAD/where-we-left-off ≤ 3 entries; PR history archived to 5 rows).
- `docs/FOLLOW_UPS.md`: bank (a) Prospect Prep verdict if it stayed SOON, (b) the PR-2/3/4 sequence as queued items, (c) any no-regression fold-in that deserves a second look.
- This is a feature PR with a real runtime surface → **no smoke waiver**; Phase 4 smoke is required.

## Phase 6 — commit / push / open PR — then HOLD
- `git branch --show-current` → must be `feat/nav-pr1-navconfig`.
- Conventional commit, push, open PR (base `main`). PR body: scope, the old→new mapping table, Prospect Prep verdict, smoke results (incl. any PM-credential gap), self-critique (Rule 22: ≥1 known gap), and the falsification note (Rule 23).
- **Rule 21:** poll for the Gemini bot review; disposition every comment before reporting PR-ready.
- **Rule 20:** the PR-ready report names the feature-branch HEAD SHA; no silent post-report pushes.
- **CC never merges or deploys (Rule 19).** Stop at PR-open. Surface the PR URL + HEAD SHA for dispatcher review.

---

## Out of scope (defer — do not touch)
- ★ Pinned zone, seeds, star affordance, `prefs/app` reads/writes, any rules change (all PR-2).
- Quick-Add menu, desktop pencil → popover, mobile ＋ → sheet, removing the mobile pencil, amber-dot relocation (all PR-3).
- Menu-layout preference UI, `workspace`/`both` layouts, My Work/My Team toggle (all PR-4).
- Tenant Admin / Platform Admin / Sales Manager nav (untouched).
- Any change to MobileBottomNav behavior beyond what Phase 2 explicitly allows.

## Standing rule reminders
- Single fresh branch off freshly-fetched main; never reuse.
- `git branch --show-current` before every commit.
- Rule 17 source-verify on every behavioral/path claim in Phase 0.
- Rule 12 canonical hard-stop phrasing: "STOP and wait for dispatcher."
- Rule 15 SHA-verify after push; Rule 20 re-report HEAD SHA; Rule 21 Gemini disposition; Rule 22 self-critique; Rule 23 falsification note.
- Phase 6 HOLD — dispatcher invokes `/post-merge` after Kyron squash-merges + deploys.

## Acceptance checklist
- [ ] `shell/navConfig.js` exists; resolves agent / producingManager (UM+BM) / manager(defined-unused).
- [ ] Agent sidebar renders Today/Planning/Tools/Recognition; Game Plan has no NEW tag; Money Needs indented child; Planner `SOON` disabled via comingSoonTabs.
- [ ] UM and BM both render My Production + My Team; branch-only items gated to BM; no current destination lost (no-regression mapping attached to PR).
- [ ] Scope chips render on the §Target items.
- [ ] Sales Manager / Tenant Admin / Platform Admin nav unchanged.
- [ ] MobileBottomNav behavior unchanged.
- [ ] lint + build + test green; axe = no new serious/critical vs baseline.
- [ ] Desktop agent smoke passes with value assertions; mobile viewport renders; PM smoke run or gap noted.
- [ ] Prospect Prep verdict recorded.

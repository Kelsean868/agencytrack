# AgencyTrack — Product Requirements Document: Navigation & Quick Actions

**Version:** 1.1
**Date:** June 2026
**Author:** Kyron Marchan
**Status:** SHIPPED — all 4 PRs merged (PR-1 → PR-4, 2026-06-22/23)
**Supersedes / builds on:** Track J #392 (agent sidebar IA: PLANNING/TOOLS/RECOGNITION groups, Commission + Goals added, Joint-Call Prep → Prospect Prep, Profile → footer avatar)

---

## 1. EXECUTIVE SUMMARY

This redesign makes AgencyTrack's navigation **role-aware and job-to-be-done first**. It does three things:

1. **Role-keyed sidebar** reorganized into task groups, with a per-user **★ Pinned** zone for the handful of screens each person touches daily.
2. **Role-aware Quick-Add menu** behind the desktop pencil and the mobile center **＋** — the most common "create" actions for each role, one tap from anywhere.
3. A **Menu layout preference** (Pinned / Workspace / Both) so managers can choose how their sidebar is organized; agents stay on the simple Pinned default.

The sidebar nav today is built inline inside each dashboard with no personalization, the pencil is single-purpose (log today only), and mobile carries two floating buttons. This redesign centralizes nav into one config, adds personalization and a curated create-menu, and removes the mobile clutter — without losing any destination a role can currently reach.

**In scope (roles):** Agent, Unit Manager, Branch Manager.
**Untouched this track:** Sales Manager, Tenant Admin, Platform Admin.

---

## 2. PROBLEM STATEMENT

### Current pain points
- Sidebar nav is **constructed inline per dashboard** — duplicated logic, no single source of truth, drift risk between Agent and Manager shells.
- **No personalization** — every user of a role sees the same flat-ish list; the 4–5 screens someone uses daily aren't surfaced.
- The **floating pencil is single-purpose** (log today). Every other "create" action (weekly report, log a policy, start a meeting, enter persistency, log recruiting) requires navigating to its screen first.
- **Mobile carries two floating buttons** (daily pencil + submit-report FAB), competing for the same corner and crowding the thumb zone.
- **Producing managers** (UM + BM) need both a personal-production view and a team view, but the nav doesn't cleanly separate "mine" from "team."
- No **coming-soon affordance** in nav for features that are designed but not yet shipped (e.g. the Planner), so teased work has no home.

---

## 3. GOALS & SUCCESS METRICS

| Goal | Metric | Target |
|------|--------|--------|
| Single source of truth for nav | Inline nav arrays remaining for in-scope roles | 0 (all via `navConfig.js`) |
| No regression | Destinations lost vs. current nav (Agent/UM/BM) | 0 |
| Faster "create" | Taps to start any common create action | ≤ 2 from any screen |
| Reduced mobile clutter | Floating buttons on mobile | 1 (center ＋) |
| Personalization | Pinned screens per user, editable | Yes (seeded per role) |
| Manager flexibility | Menu layouts available to managers | 3 (Pinned / Workspace / Both) |
| Accessibility | New serious/critical axe nodes vs. main baseline | 0 (delta) |

---

## 4. SCOPE

### In scope
- A role-keyed `navConfig.js` for Agent / Producing Manager (UM + BM) / Manager (defined, see §6).
- Sidebar section groups by job-to-be-done, with scope chips (MINE / TEAM / BOTH).
- Per-user ★ Pinned zone (seeded per role; add/remove; persisted).
- Role-aware Quick-Add menu (desktop pencil popover, mobile ＋ sheet).
- Menu-layout preference (Pinned default for all; Workspace/Both opt-in for managers; agents locked to Pinned).
- Planner surfaced as a disabled **SOON** item via the existing coming-soon mechanism.

### Out of scope
- Sales Manager / Tenant Admin / Platform Admin nav (unchanged).
- Drag-reorder of pins (v2).
- The optional Quick-Add grid variant (sheet/list only).
- Building the Planner feature itself (this track only stubs the nav entry).
- Any router introduction — nav stays on the existing `useState`-driven tab system.

---

## 5. THE NAVIGATION MODEL

### 5.1 Layouts
- **Pinned (default, all roles):** ★ Pinned zone + task groups. Agents are **locked** to this.
- **Workspace (managers opt-in):** a My Work ⇄ My Team toggle at the top of the sidebar; shows one workspace's groups at a time.
- **Both (managers opt-in):** ★ Pinned zone above the toggle (pinned zone is hidden in Workspace-only mode).

### 5.2 Section groups (job-to-be-done)
Items are grouped by `sectionLabel`. Each item carries an optional **scope chip**: **MINE** (your own view), **TEAM** (team view), **BOTH** (one screen, scope toggle inside). Chips appear only where a tool exists at both levels, so nothing is hidden.

### 5.3 ★ Pinned
Per-user, persisted, seeded with per-role defaults on first run. Pin/unpin via a star affordance on each pinnable row. Pins are aliases of the real items (same route); the original stays in its group. Uncapped; editable immediately. (Reordering is v2.)

**Per-role default seeds** (resolved against the live config at render; absent ids dropped):
- `agent`: daily-log, wizard, policy-ledger, goals, planner
- `producingManager`: mp-report, mastersheet, monthly-recruiting, mp-goals, planner
- `manager`: (empty)

**localStorage mirror key (per-user):** `agencytrack-pinned-nav:{uid}` (JSON string array). Per-user namespacing prevents cross-user pin bleed on a shared browser.

### 5.4 Quick-Add
The desktop pencil opens a popover; the mobile center **＋** ("Create") opens a bottom sheet. Same role-aware action list in both. The floating pencil is **removed on mobile** (desktop only). Each action routes to an existing modal/screen. Team actions sit under a TEAM divider for managers.

**PR-3 resolved wiring for producingManager:**
- `log-today` (primary action) → `setShowMpDailyModal` (manager daily-capture modal)
- `start-meeting` (TEAM group) → `handleStartMeeting` (meeting mode)

The `manager` configKey (`'manager'`) is used by the Quick-Add menu for SM/TA/PA roles even though no sidebar nav is assigned to them this track.

### 5.5 Menu-layout preference
Lives in Profile / Settings (3 radio cards). Default **Pinned** for all roles (marked DEFAULT). Agents locked to Pinned; managers can switch.

**Agent→Pinned clamp is defense-in-depth** (see §7 decision #9).

**localStorage mirror key (per-user):** `agencytrack-menu-layout:{uid}` (string: `'pinned'|'workspace'|'both'`).

### 5.6 Workspace layout groups — PR-4 IA decisions

Two dispatcher rulings locked in PR-4 Phase 0 (2026-06-22):

**Decision A — Recognition group is persistent (scope BOTH).** A single `Recognition` group (Leaderboard) is appended below the active workspace's groups regardless of which workspace is active. It renders once in both My Work and My Team states; no duplication or testid collision.

**Decision B — My Work preserves sub-headers; My Team is flat.** My Work retains the `My Production` and `Planning` sub-headers (matching the pinned layout); My Team renders as a single flat `My Team` section.

**Action items injected at workspace tops** (not present in the pinned-layout item set):
- `My Work` top: Daily Log (`id: 'mp-daily-log'`, `action: 'log-today'`) → `setShowMpDailyModal`
- `My Team` top: Meetings (`id: 'mp-meetings'`, `action: 'start-meeting'`) → `handleStartMeeting`

**Governing invariant:** `My Work ∪ My Team ∪ Recognition` routable destinations == the pinned-layout producingManager destinations, per role. Enforced by the load-bearing unit test `src/components/shell/__tests__/navConfig.workspace.test.js`.

**Group definitions (verified against `navConfig.js`):**

| Workspace | Section | Item IDs |
|-----------|---------|----------|
| My Work | My Production | mp-report, mp-commission, mp-policies, my-war, mp-history |
| My Work | Planning | mp-game-plan, mp-money-needs, mp-goals, planner |
| My Team | My Team | overview, team, mastersheet, team-wars†, monthly-recruiting, goals, persistency, compliance, campaigns, production-report, awards, team-perf, settlements, policy-reconciliation, agent-of-month†, kiosk† |
| Both workspaces | Recognition | leaderboard |

† BM-only items; role-gated out for UM at resolve time.

---

## 6. ROLE → CONFIG MAPPING (locked)

| Role | Config | Notes |
|------|--------|-------|
| `agent` | **agent** | Today / Planning / Tools / Recognition |
| `unit_manager` | **producingManager** | My Production + Planning + My Team + Recognition |
| `branch_manager` | **producingManager** | Same, plus branch-only items (Weekly WARs, Agent of Month, Kiosk) gated to BM via `roles` |
| `sales_manager` and up | — (untouched) | Existing inline nav unchanged this track |

### producingManager nav — route-faithful ruling (PR-1 Phase 0, Option 2)

The producingManager config maps **only to existing tabIds** in ManagerDashboard's render-switch — no new screens were introduced. The original build-spec mockups proposed idealized "MINE" surfaces that had no existing route; these were **dropped** under the route-faithful dispatcher ruling and deferred (see §11).

**Shipped producingManager nav:**
- **My Production:** Weekly Report, Commission, Policy Ledger, My WAR, History
- **Planning:** Game Plan, Money Needs (child of Game Plan), Goals (MINE chip), Planner (SOON)
- **My Team:** Team Dashboard, Team, Master Sheet, Weekly WARs (BM only), Recruiting, Team Goals (TEAM), Persistency Entry (TEAM), Compliance, Campaigns, Team Reports (TEAM), Team Awards (TEAM), Team Roster, Settlements, Reconciliation, Agent of Month (BM only), Kiosk Mode (BM only)
- **Recognition:** Leaderboard (BOTH)

The **`manager` config** (Team / Grow / Oversight / Recognition) is **defined in `navConfig.js` but assigned to no sidebar role this track** — reserved for a future non-producing manager surface. Its `configKey: 'manager'` IS used by the Quick-Add menu for SM/TA/PA.

---

## 7. LOCKED DECISIONS

1. **Default layout = Pinned for every role.** Workspace/Both are manager opt-in; agents locked to Pinned.
2. **Desktop pencil opens the Quick-Add menu** with "Log today" as the highlighted first action (accepts +1 tap to log vs. today's direct pencil).
3. **Mobile: center ＋ replaces both the daily FAB and the submit FAB.** The "not-logged-today" amber nudge relocates to a **dot on the ＋**, mirrored on the "Log today" row inside the sheet. Desktop pencil keeps its existing dot.
4. **Game Plan is live** — render with no `NEW` tag; Money Needs is its indented child. **Planner is the only SOON item**, rendered disabled via `src/config/comingSoonTabs.js` + `ui/ComingSoonPanel.jsx`. Prospect Prep is also SOON (see decision #5).
5. **Prospect Prep: SOON (agent nav only; no manager route).** PR-1 Phase 0 audit confirmed `ProspectInfoPanel.jsx` exists as an agent-only standalone route. Final state: rendered disabled via `COMING_SOON_TABS` in the agent nav. No producingManager or manager nav item was created.
6. **Prefs persistence = owner-only subdoc** `tenants/{tenantId}/users/{uid}/prefs/app` holding `{ pinnedNav: string[], menuLayout, updatedAt }`, written with `{ merge: true }` so both fields coexist without clobbering. localStorage per-user mirrors serve as offline/fast fallback (keys: `agencytrack-pinned-nav:{uid}` and `agencytrack-menu-layout:{uid}`). Firestore is source of truth on load. Chosen over adding fields to `users/{uid}` doc to keep the self-write allowlist clean (privilege-laundering guard).
7. **No-regression guard:** the new Agent/UM/BM nav loses no destination the current nav reaches. The load-bearing unit tests (`navConfig.test.js`, `navConfig.workspace.test.js`) enforce this at CI time.
8. **No new hex; 44px hit targets; focus-visible rings; reduced-motion guards.** Reuse existing Nexus tokens only.
9. **Agent→Pinned clamp is defense-in-depth (3 independent layers).** (1) `useMenuLayout` resolver returns `'pinned'` for `role === 'agent'` regardless of any stored value in localStorage or Firestore; (2) ProfileScreen disables Workspace/Both radio cards for agents (native `disabled` + `aria-disabled` + reason text); (3) AgentDashboard has no `showWorkspaceToggle` render path. A stale or forced `workspace`/`both` pref can never surface a manager-only layout to an agent.

---

## 8. ROLLOUT PLAN

All PRs were human-merged. Every PR touching routing and/or Firestore held for human review by the hard-floor rule (rules/auth/roles/money).

| PR | Scope | Persistence / rules | Squash SHA |
|----|-------|---------------------|------------|
| **PR-1** (#726) | `navConfig.js` + Sidebar section groups + scope chips + Planner SOON. Centralizes Agent/UM/BM nav. No pinned zone yet. | None | `b7aa372` |
| **PR-2** (#727) | ★ Pinned model — per-role seeds, star affordance, persist to `prefs/app` + localStorage. Adds the rules block + rules test. | Firestore + rules | `98d8aed` |
| **PR-2 smoke** (#728) | Production Firestore round-trip + deploy-gate close (test-only; no src/ changes). | None | `ff49636` |
| **PR-3** (#729) | Quick-Add menu — desktop pencil popover, mobile ＋ sheet, DailyFAB absorbed into ＋, amber-dot relocation. | None | `48e5a89` |
| **PR-4** (#731) | Menu-layout preference UI + Workspace/Both layouts + My Work⇄My Team toggle (agents locked; 3-layer clamp). | Writes `prefs/app` (rules already in place) | `fa8f06d` |

**Dependencies (preserved):** PR-2 depends on PR-1 (config exists). PR-4 depends on PR-1 (config) and PR-2 (rules block). PR-3 is independent of PR-2/4 and landed in parallel after PR-1.

---

## 9. PERSISTENCE & SECURITY

- New subcollection doc: `tenants/{tenantId}/users/{uid}/prefs/app`.
- Fields: `{ pinnedNav: string[], menuLayout: 'pinned'|'workspace'|'both', updatedAt: Timestamp }`. Written with `{ merge: true }` — each write preserves the other field.
- Rule: owner-only read/write (`request.auth.uid == uid`), matching the existing `users/{uid}/moneyNeeds|yearPlan|monthlyPlan` subcollection pattern. The sensitive `users/{uid}` self-write allowlist is **not** modified.
- New rules test: `tests/rules/userPrefs.rules.test.mjs` (owner can read/write own; non-owner denied).
- **localStorage mirrors (per-user, offline/fast fallback):**
  - `agencytrack-pinned-nav:{uid}` — JSON string array of pinned item IDs.
  - `agencytrack-menu-layout:{uid}` — layout string (`'pinned'|'workspace'|'both'`).
  - Per-user namespacing (`:uid` suffix) prevents cross-user bleed on shared browsers. Firestore is source of truth on load; a failed read keeps the mirror/default and never blocks render.

---

## 10. ACCEPTANCE CRITERIA

All criteria met as of PR-4 (#731, 2026-06-23).

- ✅ Sidebar renders the role's task groups; Agent/UM/BM nav comes entirely from `navConfig.js`; SM/TA/PA unchanged.
- ✅ ★ Pinned seeds per role; pin/unpin persists per user (cross-device via `prefs/app`).
- ✅ Planner and Prospect Prep show SOON and are non-navigable; Game Plan has no NEW tag; Money Needs is its child.
- ✅ Scope chips render on dual-context items; no destination lost vs. current nav.
- ✅ Desktop pencil opens Quick-Add popover; mobile ＋ opens the sheet; no pencil on mobile; amber nudge relocated.
- ✅ Menu layout: Pinned default for all; agents locked (3-layer clamp); managers can switch to Workspace/Both.
- ✅ Light + dark; 44px targets; 0 new serious/critical axe nodes vs. baseline; lint + build + tests green.

---

## 11. FOLLOW-UPS & DEFERRED ITEMS

### Resolved at ship

| Item | Resolution |
|------|-----------|
| Prospect Prep final state | SOON — agent-only route, no manager nav item. |
| Producing-manager smoke credential | Verified in PR-2 smoke (#728) production round-trip. |
| Workspace/Both group lists | Locked in §5.6; enforced by `navConfig.workspace.test.js`. |
| Scope-chip inventory | Confirmed in `navConfig.js`: Leaderboard BOTH, Goals MINE/TEAM, Persistency TEAM, Production Report TEAM, Team Awards TEAM. |

### Deferred MINE surfaces (dropped at PR-1, not built)

The original build-spec mockups proposed idealized personal-production surfaces for producingManager that had no existing route in ManagerDashboard: `mp-dashboard`, `mp-persistency` (standalone), `mp-production-report` (standalone), `mp-awards`, `manager-career`. These were dropped under the PR-1 route-faithful ruling. If a future track ships these screens, the navConfig producingManager items can be extended with their new tabIds.

### Open LOW follow-ups (banked post-PR-4)

1. **Late-`uid` hook hardening** — `useMenuLayout` and `usePinnedNav` both read `uid` from the `useState` initializer, which could theoretically miss the uid if a consumer mounts before auth resolves. Harden both hooks together if consumers ever mount pre-auth. Low risk today (all consumers mount post-auth via `AuthContext`).
2. **`ProfileScreen` bio-counter contrast** — `ProfileScreen.jsx:305` uses `text-ink-muted/60` (opacity modifier) on the bio character counter, which falls below WCAG AA. Easy fix: remove the `/60` opacity modifier. Pre-existing debt unrelated to nav; deferred as a standalone cleanup.

---

## 12. REFERENCES

- Build spec: `Nav & Quick Actions — CC Build Spec.md` (visual source of truth: `Nav & Quick Actions - 2 Options.html`).
- Mockups: `AgencyTrack App Layout.html`, `AgencyTrack App Mobile.html`, `AgencyTrack Settings v2.html`.
- Kickoff briefs:
  - `docs/briefs/nav-pr1-navconfig-sidebar-kickoff.md`
  - `docs/briefs/nav-pr2-pinned-model-kickoff.md`
  - `docs/briefs/nav-pr3-quickadd-kickoff.md`
  - `docs/briefs/nav-pr4-menu-layout-kickoff.md`
- Prior art: Track J #392 (agent IA), PR #719 (producing-manager My Production), `firestore.rules` users-doc allowlist (PR-4 guard).

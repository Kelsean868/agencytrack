# AgencyTrack — Product Requirements Document: Navigation & Quick Actions

**Version:** 1.0
**Date:** June 2026
**Author:** Kyron Marchan
**Status:** Locked — Build in progress (PR-1 dispatching)
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
- **Both (managers opt-in):** Workspace plus the ★ Pinned row above the toggle.

### 5.2 Section groups (job-to-be-done)
Items are grouped by `sectionLabel`. Each item carries an optional **scope chip**: **MINE** (your own view), **TEAM** (team view), **BOTH** (one screen, scope toggle inside). Chips appear only where a tool exists at both levels, so nothing is hidden.

### 5.3 ★ Pinned
Per-user, persisted, seeded with per-role defaults on first run. Pin/unpin via a star affordance on each pinnable row. Pins are aliases of the real items (same route); the original stays in its group. Uncapped; editable immediately. (Reordering is v2.)

### 5.4 Quick-Add
The desktop pencil opens a popover; the mobile center **＋** ("Create") opens a bottom sheet. Same role-aware action list in both. The floating pencil is **removed on mobile** (desktop only). Each action routes to an existing modal/screen. Team actions sit under a TEAM divider for managers.

### 5.5 Menu-layout preference
Lives in Profile / Settings (3 radio cards). Default **Pinned** for all roles (marked DEFAULT). Agents locked to Pinned; managers can switch.

---

## 6. ROLE → CONFIG MAPPING (locked)

| Role | Config | Notes |
|------|--------|-------|
| `agent` | **agent** | Today / Planning / Tools / Recognition |
| `unit_manager` | **producingManager** | My Production + My Team (keeps My Production from PR #719) |
| `branch_manager` | **producingManager** | Same, plus branch-only oversight items (Reconciliation, Kiosk Mode) gated to BM |
| `sales_manager` and up | — (untouched) | Existing inline nav unchanged this track |

A non-producing **manager** config (Team / Grow / Oversight / Recognition) is **defined in `navConfig.js` but assigned to no role this track** — reserved for future use. Rationale: PR #719 already gave both UM and BM a "My Production" surface, so routing BM to a production-less config would regress it.

---

## 7. LOCKED DECISIONS

1. **Default layout = Pinned for every role.** Workspace/Both are manager opt-in; agents locked to Pinned.
2. **Desktop pencil opens the Quick-Add menu** with "Log today" as the highlighted first action (accepts +1 tap to log vs. today's direct pencil).
3. **Mobile: center ＋ replaces both the daily FAB and the submit FAB.** The "not-logged-today" amber nudge relocates to a **dot on the ＋**, mirrored on the "Log today" row inside the sheet. Desktop pencil keeps its existing dot.
4. **Game Plan is live** — render with no `NEW` tag; Money Needs is its indented child. **Planner is the only SOON item**, rendered disabled via `src/config/comingSoonTabs.js` + `ui/ComingSoonPanel.jsx`.
5. **Prospect Prep:** spec marks SOON, but `agent/ProspectInfoPanel.jsx` exists. Final state decided by the PR-1 Phase 0 audit (standalone route → live; embedded-only → SOON).
6. **Prefs persistence = owner-only subdoc** `tenants/{tenantId}/users/{uid}/prefs/app` holding `{ pinnedNav: string[], menuLayout, updatedAt }`, with a localStorage mirror as offline/fast fallback. Chosen over adding fields to the `users/{uid}` doc, whose self-write is a strict field allowlist (the PR-4 privilege-laundering guard) that should not absorb cosmetic prefs. Requires a small new rules block + one rules test, landed once in the Pinned PR.
7. **No-regression guard:** the new Agent/UM/BM nav loses no destination the current nav reaches; the build PR carries an explicit old→new mapping.
8. **No new hex; 44px hit targets; focus-visible rings; reduced-motion guards.** Reuse existing Nexus tokens.

---

## 8. ROLLOUT PLAN

Ship Pinned first; Workspace/Both is a fast-follow. Every PR touches routing and/or Firestore, so all are **human-merge** by the hard-floor rule (rules/auth/roles/money always hold for human review).

| PR | Scope | Persistence / rules | Merge |
|----|-------|---------------------|-------|
| **PR-1** | `navConfig.js` + Sidebar section groups + scope chips + Planner SOON. Centralizes Agent/UM/BM nav. **No pinned zone yet.** | None | Human |
| **PR-2** | ★ Pinned model — per-role seeds, star affordance, persist to `prefs/app` + localStorage. Adds the rules block + rules test. | Firestore + rules change | Human |
| **PR-3** | Quick-Add menu — desktop pencil popover, mobile ＋ sheet, remove mobile pencil, amber-dot relocation. | None | Human |
| **PR-4** | Menu-layout preference UI + Workspace/Both layouts + My Work/My Team toggle (agents locked). | Writes `prefs/app` (rules already in place) | Human |

**Dependencies:** PR-2 depends on PR-1 (config exists). PR-4 depends on PR-1 (config) and PR-2 (rules block). PR-3 is independent of PR-2/4 and can land in parallel after PR-1.

---

## 9. PERSISTENCE & SECURITY

- New subcollection doc: `tenants/{tenantId}/users/{uid}/prefs/app`.
- Rule: owner-only read/write (`request.auth.uid == uid`), matching the existing `users/{uid}/moneyNeeds|yearPlan|monthlyPlan` subcollection pattern.
- New rules test: `tests/rules/userPrefs.rules.test.mjs` (owner can read/write own; non-owner denied).
- The sensitive `users/{uid}` self-write allowlist is **not** modified — cosmetic prefs stay out of the privilege-laundering surface.
- localStorage key mirrors the doc for offline/fast paint; Firestore is source of truth on load.

---

## 10. ACCEPTANCE CRITERIA (umbrella)

- Sidebar renders the role's task groups; Agent/UM/BM nav comes entirely from `navConfig.js`; SM/TA/PA unchanged.
- ★ Pinned seeds per role; pin/unpin persists per user (cross-device via `prefs/app`).
- Planner shows SOON and is non-navigable; Game Plan has no NEW tag; Money Needs is its child.
- Scope chips render on dual-context items; no destination lost vs. current nav.
- Desktop pencil opens Quick-Add popover; mobile ＋ opens the sheet; no pencil on mobile; amber nudge relocated.
- Menu layout: Pinned default for all; agents locked; managers can switch to Workspace/Both.
- Light + dark; 44px targets; no new serious/critical axe nodes vs. baseline; lint + build + tests green.

---

## 11. OPEN ITEMS & RISKS

- **Prospect Prep final state** — pending PR-1 Phase 0 audit (decision #5).
- **Producing-manager smoke credential** — UM/BM login needed to assert My Production + My Team render; without it, smoke notes a gap rather than a pass.
- **Workspace/Both group lists** — full group definitions live in the mockup; confirm against `navConfig.js` at PR-4 authoring.
- **Scope-chip dual-context inventory** — which tools genuinely have both MINE and TEAM surfaces today is audit-confirmed per item (Leaderboard BOTH, Persistency, Goals, Production Report, Team Reports…).

---

## 12. REFERENCES

- Build spec: `Nav & Quick Actions — CC Build Spec.md` (visual source of truth: `Nav & Quick Actions - 2 Options.html`).
- Mockups: `AgencyTrack App Layout.html`, `AgencyTrack App Mobile.html`, `AgencyTrack Settings v2.html`.
- Kickoff briefs: `docs/briefs/nav-pr1-navconfig-sidebar-kickoff.md` (+ PR-2/3/4 to follow).
- Prior art: Track J #392 (agent IA), PR #719 (producing-manager My Production), `firestore.rules` users-doc allowlist (PR-4 guard).

# AgencyTrack — Navigation & Quick Actions · Build Spec

Hand this folder to Claude Code. The **visual source of truth** is
`Nav & Quick Actions - 2 Options.html` — open it in a browser and toggle **Role**
(Agent / Producing Manager / Manager) and **Layout** (Pinned / Workspace / Both),
and press **Tap ＋** to open the quick-add menu.

This redesign covers three things:
1. A **role-aware sidebar** reorganized by *job to be done*, with a curated **★ Pinned** zone.
2. A **role-aware quick-add menu** behind the desktop pencil and the mobile center **＋**
   (the floating pencil is **removed on mobile**).
3. A **Menu layout** preference in the profile/settings screen.

> **Do I need a separate profile-screen mockup?** No. The "Menu layout" preference is
> already drawn in the mockup (the *Profile → Preferences* card). It is a small section that
> slots into the **existing** Settings/Profile screen. `reference/AgencyTrack Settings v2.html`
> is included only so the card matches that screen's styling.

---

## 0. Decision (locked)

- **Default layout for EVERY role = `pinned` (Pinned + groups).** Agents, producing managers,
  and managers all land on this.
- `workspace` and `both` are **opt-in** alternatives, available to managers & producing managers
  only, from *Profile → Preferences → Menu layout*. **Agents are locked to `pinned`.**
- Ship `pinned` first. `workspace`/`both` can be a fast-follow — the nav config below already
  describes all three.

---

## 1. Component map (existing repo — see `design_handoff_v2_app/README.md`)

| Surface | File to update | Change |
|---|---|---|
| Desktop sidebar | `shell/Sidebar.jsx` (+ `.sidebar` in `index.css`) | Consume the new role-keyed nav config; render section groups, the ★ Pinned zone, scope chips, and (for `workspace`/`both`) the My Work/My Team toggle. |
| Mobile bottom nav | `shell/MobileBottomNav.jsx` | Center **＋** opens the Quick-Add sheet (below). **Remove the floating desktop pencil on mobile.** |
| Mobile "More" drawer | `shell/MobileNavDrawer.jsx` | Same nav config, full list. |
| Quick-Add menu ★ NEW | `shell/QuickAddMenu.jsx` (new) | Desktop = popover anchored to the pencil FAB; mobile = bottom sheet from ＋. Role-aware action list. |
| Desktop pencil FAB | wherever the FAB lives in `shell/` | Click opens `QuickAddMenu`. Keep on desktop only. |
| Menu-layout preference | `profile/ProfileScreen.jsx` (or `settings`) | Add a "Menu layout" section (3 radio cards). Persist to user prefs. |
| Nav config ★ NEW | `shell/navConfig.js` (new) | Single source of truth for nav per role/layout/workspace + pin seeds. |

Reuse existing tokens/utilities only (`bg-primary`, `text-ink`, `.card`, `.medal-N`, etc.).
**No new hex.** Icons already exist in the icon set used by the shell.

---

## 2. Sidebar nav — DEFAULT layout (`pinned`) per role

Each item = `{ key, label, icon, route, badge?, child?, soon?, scope? }`.
`scope` renders a chip: **MINE** (your own view) · **TEAM** (team view) · **BOTH** (one screen,
scope toggle inside). Chips only appear where a tool exists at both levels — so nothing is lost.

### Agent
- **★ Pinned** (seed): Log Today · Weekly Report · Policy Ledger · Goals · Planner `SOON`
- **Today:** Dashboard · Daily Log · Weekly Report · History
- **Planning:** Game Plan `NEW` → *Money Needs* (child) · Goals · Planner `SOON`
- **Tools:** Commission · Persistency · Policy Ledger · Prospect Prep `SOON` · Production Report
- **Recognition:** Leaderboard · Awards · Career Portal

### Producing Manager (`unit_manager`)
- **★ Pinned** (seed): Log Today · Weekly Report · Master Sheet · Recruiting · Goals · Planner `SOON`
- **My Production:** Dashboard · Daily Log · Weekly Report · Commission · Persistency `MINE` · Policy Ledger · Production Report `MINE` · History
- **My Team:** Team Dashboard · Master Sheet · Weekly WARs · Recruiting · Team Goals `TEAM` · Persistency Entry `TEAM` · Compliance · Campaigns · Meetings · Team Reports `TEAM` · Team Awards `TEAM`
- **Planning:** Game Plan `NEW` · Goals `MINE` · Planner `SOON`
- **Recognition:** Leaderboard `BOTH` · Awards `MINE` · Career Portal

### Manager (branch / sales — non-producing)
- **★ Pinned** (seed): Team Dashboard · Master Sheet · Weekly WARs · Recruiting · Planner `SOON`
- **Team:** Team Dashboard · Master Sheet · Weekly WARs · Team Goals · Reports
- **Grow:** Recruiting · Campaigns · Meetings · Planner `SOON`
- **Oversight:** Compliance · Persistency · Reconciliation
- **Recognition:** Leaderboard · Awards · Kiosk Mode · Career Portal

> Notes: keep the active-item left bar + tint. The `child` item (Money Needs under Game Plan)
> keeps its indented connector. `SOON` items are visible but disabled — **Planner** is teased
> with a `SOON` tag exactly like Prospect Prep (it appears in both ★ Pinned and Planning/Grow;
> the route is stubbed/disabled until the Planner feature ships).

---

## 3. ★ Pinned model

- **Per-user**, persisted (Firestore user prefs `pinnedNav: string[]`, fall back to
  `localStorage['agencytrack-pinned-nav']`). Stores item `key`s.
- **Seeded** with the per-role defaults in §2 on first run; user can add/remove.
- **Pin / unpin** = star affordance on each pinnable row (hover on desktop, edit mode on mobile).
- Reordering pins is optional (drag) — not required for v1.
- Pinned rows are duplicates/aliases of the real items (same route); they don't remove the
  original from its group.

---

## 4. Quick-Add menu (pencil on desktop, ＋ on mobile)

Same **content** in every layout; only presentation differs (desktop popover list vs. mobile
sheet — the mockup also shows a grid variant, optional). Each action routes to an existing
modal/screen. `primary` = the highlighted top action. `soon` = disabled (Planner not shipped).
`group:'team'` items sit under a **TEAM** divider.

### Agent
1. **Log today** *(primary)* → `DailyEntryModal`
2. Weekly report → `WizardForm`
3. Log a policy → Policy Ledger add
4. New goal → `GoalsPanel` / Step9Goals
5. Book appointment `SOON` → Planner

### Producing Manager
1. **Log today** *(primary)* → `DailyEntryModal`
2. Weekly report → `WizardForm`
3. Log a policy → Policy Ledger add
4. *(TEAM)* Log recruiting → `MonthlyRecruitingTab`
5. *(TEAM)* Start a meeting → `MeetingMode`
6. *(TEAM)* Enter persistency → `PersistencyEntryForm`
7. *(TEAM)* Schedule coaching `SOON` → Planner

### Manager
1. **Log recruiting** *(primary)* → `MonthlyRecruitingTab`
2. Start a meeting → `MeetingMode`
3. Send WAR nudge → WAR nudge action
4. Enter persistency → `PersistencyEntryForm`
5. Launch campaign → `CampaignPanel`
6. Schedule coaching `SOON` → Planner

**Mobile:** the center **＋** (label "Create") opens a bottom sheet with this list. The desktop
floating pencil must **not** render on mobile breakpoints.

---

## 5. Menu-layout preference

- Lives in **Profile / Settings** (`profile/ProfileScreen.jsx`). Match
  `reference/AgencyTrack Settings v2.html` styling.
- Value `menuLayout ∈ { 'pinned' | 'workspace' | 'both' }`.
  - Persist to user prefs (Firestore `preferences.menuLayout`, fallback localStorage).
  - **Default `'pinned'` for all roles.** Mark Pinned as **DEFAULT**.
  - **Agents:** locked to `'pinned'` (other options disabled).
  - **Managers / producing managers:** all three selectable.
- `workspace` = My Work ⇄ My Team toggle at the top of the sidebar; shows one workspace's
  groups at a time. `both` = `workspace` **plus** the ★ Pinned row above the toggle. (Agents never
  see the toggle.) Full group lists for these are in the mockup — toggle Layout to read them.

---

## 6. Acceptance checklist

- [ ] Sidebar renders the §2 groups for each role; default layout = `pinned`.
- [ ] ★ Pinned seeds per role (incl. **Planner `SOON`**); pin/unpin persists per user.
- [ ] **Planner** shows a `SOON` tag (like Prospect Prep) and is disabled until the feature ships.
- [ ] Scope chips (MINE/TEAM/BOTH) show on the dual-context items listed in §2.
- [ ] Desktop pencil opens Quick-Add popover; **no pencil on mobile**.
- [ ] Mobile center ＋ opens the Quick-Add sheet with the role's actions; `SOON` disabled.
- [ ] Profile → Menu layout: default Pinned (all roles), agents locked, managers can switch.
- [ ] Light + dark themes; 44px hit targets; `focus-visible` rings; reduced-motion guards.
- [ ] Both themes verified; `npm run lint` + `npm test` green.

---

## 7. Files in this folder

- `Nav & Quick Actions - 2 Options.html` — interactive visual source of truth (self-contained).
- `Nav & Quick Actions — CC Build Spec.md` — this spec.
- `reference/AgencyTrack Settings v2.html` — existing settings screen (for the preference card).
- `reference/AgencyTrack App Layout.html` — current desktop shell.
- `reference/AgencyTrack App Mobile.html` — current mobile shell + bottom nav.

Also already in your repo and worth re-reading: `design_handoff_v2_app/README.md`
(shell component map + token bridge).

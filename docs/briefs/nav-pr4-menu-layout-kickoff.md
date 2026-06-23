# Nav Redesign — PR-4: Menu-layout preference + workspace/both layouts — Kickoff Brief

**Type:** Feature (L) — net-new IA (the workspace toggle) + a settings preference + persistence to an existing doc. No new rules, no functions, no new screens.
**Merge channel:** HUMAN-MERGE (touches routing/nav for every producing-manager screen + a permission-shaped agent lock). Not green-channel.
**Run model:** **Opus** (net-new layout-state IA + the agent-lock permission rule + cross-layout no-regression judgment).
**Trigger:** Final nav PR (4 of 4). PR-1 (navConfig `b7aa372`), PR-2 (Pinned `ff49636`), PR-3 (Quick-Add `48e5a89`) are on main. This PR adds the Menu-layout preference (Pinned / Workspace / Both) and the `workspace`/`both` sidebar layouts for producing managers, with agents locked to `pinned`.

---

## Inputs
- This brief: `docs/briefs/nav-pr4-menu-layout-kickoff.md`
- Addendum (workspace/both group definitions, pulled from the mockup): in dispatcher's hands; its lists are the **intent**, NOT a verbatim build target (see the reconciliation rulings below).
- Settings styling reference: `AgencyTrack Settings v2.html` (mockup) — for the 3-radio-card preference section.
- On main: `src/components/shell/navConfig.js` (the shipped, route-faithful agent + producingManager configs), `Sidebar.jsx`, `MobileNavDrawer.jsx`, `src/services/userPrefsService.js` (PR-2 — extend with menuLayout), `usePinnedNav.js` + the PR-2 pinned zone (reused by `both`), `profile/ProfileScreen.jsx` (where the preference card slots in).

---

## THE GOVERNING INVARIANT — read first
`workspace` and `both` are **alternative presentations of the SAME per-role item set** already in `navConfig` from PR-1. **No-regression-across-layouts:** every destination reachable in the `pinned` layout for a role MUST be reachable in that role's `workspace`/`both` layout. The addendum supplies the *grouping intent*; it does NOT define a new item set. Bind every group entry to an **existing** tabId/action; drop addendum labels that have no route (the known-absent MINE surfaces); fold in live items the addendum omits. This is the PR-1 route-faithful discipline applied to layouts — Phase 0 produces the mapping table and hard-stops if it can't satisfy the invariant.

---

## Decisions locked — do not re-litigate
(Phase 0 surprise → STOP and wait for dispatcher.)

1. **Three layouts, default `pinned`.** Preference value `menuLayout ∈ { 'pinned' | 'workspace' | 'both' }`. Pinned marked **DEFAULT** in the UI.
2. **Agents clamped to `pinned`.** The layout resolver returns `pinned` for `role === 'agent'` **regardless of any stored `menuLayout`** (defense-in-depth against a stale/manual pref). The Settings UI disables the workspace/both radio cards for agents. **Do NOT build agent workspace/both group variants** — they are dead surface.
3. **Workspace/both render only for producing managers** (`unit_manager`, `branch_manager` → producingManager config). The non-producing `manager` config stays **defined-but-unassigned** (per PR-1). SM/TA/PA untouched.
4. **`workspace`** = a **My Work ⇄ My Team toggle** at the top of the sidebar; shows one workspace's groups at a time. The toggle is **session-state**, defaults to **My Work** on load, **not persisted**.
5. **`both`** = the PR-2 **★ Pinned zone** (reused as-is, seeds + persistence already shipped) rendered **above** the My Work/My Team toggle, then the active workspace's groups. `[★ Pinned] → [toggle] → [active workspace groups]`.
6. **Persistence:** `menuLayout` writes to the **existing** `prefs/app` doc via `userPrefsService` (extend with `setMenuLayout`), `{ merge: true }` so it coexists with `pinnedNav`. **No firestore.rules change** — PR-2's owner-only `prefs/{prefId}` block already permits it. localStorage-first/Firestore-reconcile, mirror key **`agencytrack-menu-layout:{uid}`** (per-user, matching the PR-2 pinned-key convention).
7. **Reconciliation rulings (addendum vs shipped reality) — apply these:**
   - Game Plan: **no `NEW` tag** (PR-1 already removed it).
   - Drop (no route; bank as the same FU surfaces): My Work Dashboard (`mp-dashboard`), Persistency MINE (`mp-persistency`), Production Report MINE (`mp-production-report`), Awards MINE (`mp-awards`), Career Portal (manager career), Prospect Prep in PM My Work (manager prospect route — confirm in Phase 0; if agent-only, drop).
   - Fold back in (live in pinned, omitted by addendum — REQUIRED by the invariant): **My WAR** (`my-war`) and **Money Needs** (`mp-money-needs`, child of Game Plan) into My Work; **Team** (`team`), **Team Roster** (`team-perf`), **Settlements** (`settlements`), **Agent of Month** (`agent-of-month`, BM) into My Team.
   - Daily Log in PM My Work = the manager log-today **action** (`setShowMpDailyModal`, shipped in PR-3).
   - Meetings in My Team = the `handleStartMeeting` **action** item (Sidebar already renders action items).
   - Planner = `SOON` in every layout (consistency fix per the addendum) via `comingSoonTabs`.
   - Preserve all scope chips (MINE/TEAM/BOTH) from the addendum where the bound item exists at both levels.
8. **a11y:** the workspace toggle is a real control (segmented buttons or tabs) — `aria-pressed`/`role=tab`, keyboard-operable, focus-visible, 44px, reduced-motion. Radio cards are a labelled radiogroup; disabled cards (agent) are `aria-disabled` with a reason. No new hex.

---

## Phase 0 — gate + audit (no edits)
1. Rule 9 clean-main gate; record HEAD (expect `b802f0c` or later). Fresh branch `feat/nav-pr4-menu-layout`; `git branch --show-current` before any commit.
2. **Source-verify (Rule 17):**
   - Enumerate the **complete** shipped producingManager item set in `navConfig` (every id, its tabId/action, scope, role-gating). This is the universe that workspace/both must fully cover (the invariant).
   - Read `userPrefsService.js` (PR-2) — confirm the `prefs/app` read/write shape to extend with `menuLayout`. Confirm the PR-2 mirror/reconcile pattern in `usePinnedNav` to mirror for menuLayout.
   - Read `Sidebar.jsx` — where groups + the (PR-2) pinned zone render, to slot the toggle (workspace) and the pinned-row-above-toggle (both).
   - Read `ProfileScreen.jsx` — where the preference card slots in; match `AgencyTrack Settings v2.html` styling using existing tokens.
   - Confirm the manager prospect route question (ruling #7).
3. **Build the mapping table:** partition the full producingManager item set into My Work / My Team per the addendum's grouping + ruling #7. Mark each addendum label as bound / dropped (no route) / folded-in. **Verify the invariant:** the union of My Work + My Team destinations == the pinned-layout producingManager destinations. List any item that can't be placed.
4. **Hard-stop** if: the invariant can't be satisfied (an item has no group, or a required fold-in has no home); or `menuLayout` can't be added to `prefs/app`/mirror cleanly; or the Sidebar has no clean insertion point for the toggle / pinned-above-toggle.

## Phase 1 — persistence + resolver
- Extend `userPrefsService.js`: `setMenuLayout(tenantId, uid, menuLayout)` (merge-write to `prefs/app`). Extend the prefs read to return `menuLayout`.
- A `useMenuLayout({ role, ... })` hook (or extend the pinned hook): localStorage-first paint (mirror `agencytrack-menu-layout:{uid}`) → Firestore reconcile → default `pinned`. **Resolver clamps `agent` → `pinned`** before returning (ruling #2), independent of stored value.

## Phase 2 — workspace/both nav model
- In `navConfig.js`: add the workspace partition for producingManager — `getWorkspaceGroups(configKey, { role, workspace: 'work'|'team' })` returning the route-faithful My Work / My Team groups from the Phase 0 mapping (scope chips, SOON, action items, child indent all preserved). Reuse the existing item descriptors — do not duplicate route definitions.
- Add Planner `SOON` to the relevant groups (ruling #7).

## Phase 3 — render
- `Sidebar.jsx`: when layout is `workspace` or `both` (producing managers only), render the My Work ⇄ My Team toggle (session-state, default My Work) and the active workspace's groups. For `both`, render the PR-2 ★ Pinned zone above the toggle (reuse the existing component — do not reimplement). For `pinned` (and all agents), render exactly as today (PR-1/PR-2 path unchanged).
- `MobileNavDrawer.jsx`: parity — managers in workspace/both get the toggle; agents unchanged. If the drawer can't host the toggle cleanly, STOP (don't silently diverge mobile).
- `ProfileScreen.jsx`: add the **Menu layout** section — 3 radio cards (Pinned DEFAULT / Workspace / Both), persisted via `setMenuLayout`. Agents: workspace/both disabled with a reason. Managers: all three selectable. Match Settings v2 styling.
- Wire the resolver into `AgentDashboard.jsx` (always pinned — effectively a no-op clamp) and `ManagerDashboard.jsx` (UM/BM honor menuLayout; other roles unaffected).

## Phase 4 — verify
- `npm run lint`, `npm run build`, `npm test` green. Add tests: resolver clamps agent→pinned even with stored `workspace`; producingManager workspace partition covers the full pinned item set (the invariant, as a unit test — this is the load-bearing assertion); toggle switches groups; both shows pinned zone above toggle; Settings disables workspace/both for agents.
- axe delta (UM workspace + both, light+dark; agent settings) — no NEW serious/critical vs baseline; toggle + radio cards keyboard/focus correct. Any new node beyond the faint→muted carve-out → STOP.

## Phase 5 — smoke (real interaction — required; preview + prod post-merge; committed harness, no unconditional SKIP)
- **Settings → layout switch (UM):** set Workspace → assert sidebar shows the toggle + My Work groups; toggle to My Team → assert My Team groups; set Both → assert ★ Pinned zone above the toggle. Reload → assert the chosen layout persisted (Firestore round-trip: clear the `agencytrack-menu-layout:{uid}` mirror before reload so persistence can only come from Firestore — same mirror-cleared pattern as the PR-2 round-trip leg).
- **No-regression spot-check:** in UM Workspace, assert a folded-in item that the addendum omitted is reachable — navigate to **My WAR** (My Work) and **Settlements** (My Team) and assert each opens.
- **Agent lock:** as the test agent, assert the Settings workspace/both cards are disabled AND the sidebar renders `pinned` (no toggle), even if a `menuLayout: 'workspace'` value is forced into the mirror/doc (defense-in-depth).
- **Both layout:** assert pinned zone + toggle + groups coexist without duplicate-key/testid collisions (the PR-2-class bug).

## Phase 6 — docs + commit/push/PR — then HOLD
- `docs/CONTEXT.md`: active-track → PR-4 in flight, squash-SHA placeholder, Rule 16 caps. `docs/FOLLOW_UPS.md`: mark the nav-redesign sequence COMPLETE after this; the deferred MINE surfaces (mp-dashboard/mp-persistency/mp-production-report/mp-awards/manager-career) remain banked (not built here).
- `git branch --show-current` = `feat/nav-pr4-menu-layout`. Conventional commit, push, open PR (base main).
- PR body: the workspace mapping table + invariant-coverage proof, the agent-clamp test result, the persistence round-trip smoke, Rule 22 self-critique (≥1 gap), Rule 23 falsification (e.g. "overturned if an agent with a forced workspace pref ever renders the toggle, or if a pinned-reachable destination is unreachable in workspace").
- Rule 21 Gemini disposition; Rule 20 HEAD SHA; Rule 15 after any post-report push. **Rule 19 — never merge/deploy.** HOLD at PR-open.

---

## Out of scope (defer — do not touch)
- New screens / the deferred MINE surfaces (mp-dashboard etc.) — banked FUs, not built here.
- Drag-reorder of pins (v2). Quick-Add (PR-3, shipped). navConfig pinned groups + scope-chip set (PR-1, only regrouped here, not redefined).
- Any firestore.rules change (the existing `prefs/{prefId}` block already covers `menuLayout`).
- SM/TA/PA nav.

## Standing rule reminders
- Fresh branch off freshly-fetched main; `git branch --show-current` before every commit.
- Rule 17 source-verify (full item set, service, Sidebar insertion points) in Phase 0.
- Rule 12 STOP phrasing; Rules 15/19/20/21/22/23 as standard.
- No untracked smoke; no unconditional SKIP for a load-bearing assertion; deploy-gated legs implemented conditionally, not stubbed (PR-2 lesson).

## Acceptance checklist
- [ ] Settings Menu-layout section: 3 radio cards, Pinned DEFAULT; agents disabled (workspace/both), managers selectable; persists to `prefs/app`.
- [ ] Resolver clamps agent→pinned regardless of stored value; UM/BM honor menuLayout; localStorage-first/Firestore-reconcile; mirror `agencytrack-menu-layout:{uid}`.
- [ ] Workspace: My Work⇄My Team toggle (session-state, default My Work); route-faithful groups; **invariant holds** (workspace destinations == pinned destinations for the role).
- [ ] Both: ★ Pinned zone (PR-2 reuse) above toggle + active groups; no duplicate key/testid.
- [ ] Game Plan no NEW; Planner SOON in all layouts; known MINE surfaces dropped (not stubbed); my-war/money-needs/team/team-perf/settlements/agent-of-month folded in.
- [ ] SM/TA/PA unaffected; no rules change.
- [ ] lint+build+test green (incl. invariant + agent-clamp unit tests); axe no new serious/critical; smoke proves layout-switch persistence (mirror-cleared round-trip) + agent lock + no-regression spot-check (preview + prod); harness committed.

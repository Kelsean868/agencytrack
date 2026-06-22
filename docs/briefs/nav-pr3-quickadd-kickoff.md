# Nav Redesign — PR-3: Quick-Add menu — Kickoff Brief

**Type:** Feature (M) — presentation + wiring to existing modals/actions. No Firestore, no rules, no Cloud Functions, no new screens.
**Merge channel:** HUMAN-MERGE (changes the behavior of the primary daily-capture control + mobile shell). Not green-channel.
**Run model:** **Sonnet** (presentation + wiring; escalate to dispatcher only if Phase 0 surfaces a new-modal requirement — see decision #6).
**Trigger:** Nav redesign PR 3 of 4. PR-1 (navConfig, `b7aa372`) and PR-2 (Pinned, `ff49636`) are on main. This PR puts a role-aware Quick-Add menu behind the desktop pencil and the mobile center ＋, removes the floating pencil on mobile, relocates the amber not-logged-today nudge, and lands the two actions deferred from PR-1 (Meetings, manager log-today). Menu-layout/workspace (PR-4) stays OUT of scope.

---

## Inputs
- This brief: `docs/briefs/nav-pr3-quickadd-kickoff.md`
- Build spec §4 (Quick-Add action lists per role) — reference in dispatcher's hands.
- On main: `src/components/daily/DailyFAB.jsx` (the floating pencil — opens daily capture today, carries the amber dot), `src/components/shell/{Shell,MobileBottomNav,MobileNavDrawer}.jsx`, `src/components/shell/navConfig.js`, `src/config/comingSoonTabs.js`.
- Existing action handlers to wire to (confirm exact names in Phase 0): agent `log-today` (`setShowDailyModal`), `submit` (wizard); manager `handleStartMeeting`/MeetingMode, `monthly-recruiting`, `persistency` (PersistencyEntryForm), `campaigns` (CampaignPanel); policy-ledger add; goals/Step9Goals.

---

## Decisions locked — do not re-litigate
(Phase 0 surprise → STOP and wait for dispatcher.)

1. **Desktop pencil → Quick-Add popover.** `DailyFAB` no longer opens daily capture directly; it opens a `QuickAddMenu` popover anchored to the FAB. "Log today" is the highlighted first action and routes to the existing `log-today` action (path preserved — one extra tap, per the PRD-accepted tradeoff). Keep the FAB on desktop only.
2. **Mobile center ＋ → Quick-Add bottom sheet**, labelled "Create". **Remove the floating pencil on mobile breakpoints entirely.** The ＋ replaces both the old daily FAB and the submit FAB as the create entry point.
3. **Amber not-logged-today dot relocates:**
   - Desktop: stays on the pencil FAB (unchanged condition/source).
   - Mobile: dot on the center ＋, mirrored on the "Log today" row inside the sheet. Drive it from the **same not-logged-today predicate `DailyFAB` uses today** — do not invent a new condition. Daily-mode/loggingMode gating must match the existing FAB exactly (a weekly-mode agent who never sees the dot today must not start seeing it).
4. **Role-aware action lists** (build spec §4). Map every action to an **existing** handler/route. `primary` = highlighted top action. `soon` = disabled via `comingSoonTabs`. `group:'team'` items sit under a TEAM divider.
   - **agent:** Log today *(primary)* → log-today · Weekly report → submit · Log a policy → policy-ledger add · New goal → goals · Book appointment `SOON` → planner
   - **producingManager:** Log today *(primary)* → manager log-today (see #6) · Weekly report → mp-report/submit · Log a policy → policy add · *(TEAM)* Log recruiting → monthly-recruiting · *(TEAM)* Start a meeting → handleStartMeeting · *(TEAM)* Enter persistency → persistency · *(TEAM)* Schedule coaching `SOON` → planner
   - **manager (non-producing):** *(not assigned a navConfig role this track — see PR-1)* — build the action list in the menu config per spec §4 but it routes for no role yet UNLESS Phase 0 finds a non-producing role currently using ManagerDashboard. If none, define-but-don't-assign (mirror PR-1's manager config treatment). Do not fabricate routing.
5. **Same content, two presentations.** Desktop = popover list anchored to the pencil; mobile = bottom sheet from ＋. The optional grid variant is OUT (sheet/list only). One role-aware action source feeds both.
6. **Manager log-today — Phase 0 gates this.** PR-1 found no manager `log-today` action (manager daily capture is FAB-only). Determine in Phase 0 whether a manager daily-capture trigger can be wired to an **existing** modal/handler (e.g. the manager DailyFAB's own open path) **without building a new screen**. If it's a one-line wire to an existing modal → do it. If it would require authoring a new manager daily-capture modal → **STOP and surface** (that's PR-scope expansion, not a Sonnet silent build). Until resolved, the PM "Log today" primary action is the only blocked item; the rest of the PM list proceeds.
7. **Quick-Add does not change navConfig or the sidebar.** Pins, groups, scope chips are untouched. This PR adds the menu + FAB/＋ wiring only.
8. **a11y:** popover and sheet are focus-trapped, `Escape`-dismiss, `aria-label`led, return focus to the trigger on close; 44px targets; focus-visible rings; reduced-motion guards. Disabled `SOON` items are non-activatable. No new hex.

---

## Phase 0 — gate + audit (no edits)
1. Rule 9 clean-main gate; record HEAD (expect `d478c82` or later). Fresh branch `feat/nav-pr3-quickadd`; `git branch --show-current` before any commit.
2. **Source-verify (Rule 17):**
   - `DailyFAB.jsx`: how it opens daily capture today, the exact not-logged-today predicate + loggingMode gating, and the amber-dot render. This predicate is reused for the mobile ＋ dot (#3).
   - `MobileBottomNav.jsx`: the center button today (submit FAB?), how it's wired, and the mobile breakpoint at which the desktop pencil currently renders (must be removed there, #2).
   - Confirm each §4 action maps to an existing handler/route; list the exact identifiers. Flag any that don't exist (except `SOON` planner).
   - **Decision #6:** determine manager log-today feasibility (existing modal wire vs new screen). Record the verdict — this is the one likely STOP.
   - Confirm whether any non-producing role routes through ManagerDashboard (affects #4 manager list assignment).
3. **Hard-stop** if: the desktop pencil's daily-capture path can't be cleanly rerouted behind a menu while preserving the `log-today` action; or manager log-today needs a new modal (#6); or any non-SOON §4 action has no existing route.

## Phase 1 — Quick-Add config + component
- Add a role-aware action source (co-locate with `navConfig.js` or a sibling `quickAddConfig.js`): `getQuickAddActions(configKey, { role })` → ordered actions `{ key, label, icon, action|tabId, primary?, soon?, group? }`, SOON via `comingSoonTabs`.
- `src/components/shell/QuickAddMenu.jsx` (new): one component, two presentations — desktop popover (anchored) and mobile sheet — selected by a `variant` prop or breakpoint. Renders primary highlight, TEAM divider, disabled SOON. Each action dispatches the existing handler then closes.

## Phase 2 — wire desktop pencil + mobile ＋
- `DailyFAB.jsx` (desktop): click opens `QuickAddMenu` (popover) instead of daily capture. Keep the amber dot on the FAB (#3 desktop). Ensure it does not render at mobile breakpoints (#2).
- `MobileBottomNav.jsx`: center ＋ ("Create") opens `QuickAddMenu` (sheet). Relocate the amber dot onto the ＋ using the shared predicate (#3 mobile). Remove the floating pencil on mobile.
- Wire `getQuickAddActions` into `AgentDashboard.jsx` and `ManagerDashboard.jsx` (UM/BM). Land the two deferred actions: **Meetings** (`handleStartMeeting`) in the PM list, and **manager log-today** per the #6 verdict.

## Phase 3 — verify
- `npm run lint`, `npm run build` green. `npm test` green; add/adjust tests: Quick-Add renders the correct role list (agent vs PM), primary action present, SOON disabled, TEAM divider for PM. If a manager-log-today wire landed, assert it dispatches.
- axe delta (agent + UM, light+dark) on the open popover AND the open sheet: focus trap, Escape, return-focus, labels — no NEW serious/critical vs baseline. Any new node beyond the faint→muted carve-out → STOP.

## Phase 4 — smoke (real interaction — required; preview + prod post-merge)
- **Desktop agent (the load-bearing path, decision #1):** click the pencil → popover opens → click "Log today" → assert daily-capture opens. Then reopen → "Weekly report" → assert wizard opens. Prove the behavior change preserves the daily-capture path, not just that the menu renders.
- **Mobile agent (390×844):** assert the floating pencil is **absent**; tap ＋ → sheet opens with the agent actions; the amber dot appears on ＋ only when not-logged-today (toggle/log to confirm it clears); SOON item non-activatable.
- **Producing manager (UM/BM):** ＋/pencil opens the PM list with the TEAM divider; "Start a meeting" → assert MeetingMode opens; if manager log-today wired, assert it opens.
- Mirror the PR-1/PR-2 harness style; commit the harness (per the lesson — no untracked smoke), and **no unconditional SKIP** standing in for a real assertion (conditional or fail-loud only).

## Phase 5 — docs (placeholders)
- `docs/CONTEXT.md`: active-track → PR-3 in flight, squash-SHA placeholder, Rule 16 caps.
- `docs/FOLLOW_UPS.md`: mark the deferred Meetings + manager-log-today items resolved (or note manager-log-today still deferred if #6 stopped it); confirm PR-4 queued.

## Phase 6 — commit / push / PR — then HOLD
- `git branch --show-current` = `feat/nav-pr3-quickadd`. Conventional commit, push, open PR (base main).
- PR body: the §4 action→handler mapping table, the manager-log-today verdict, the desktop pencil-behavior smoke result, Rule 22 self-critique (≥1 gap), Rule 23 falsification note (e.g. "overturned if clicking Log today in the popover does not open daily capture, or if the mobile pencil still renders").
- Rule 21 Gemini disposition before reporting; Rule 20 report HEAD SHA; Rule 15 after any post-report push. **Rule 19 — never merge/deploy.** HOLD at PR-open.

---

## Out of scope (defer — do not touch)
- Menu-layout preference UI, workspace/both layouts, My Work/My Team toggle (PR-4).
- navConfig groups, pins, scope chips (PR-1/PR-2 — untouched).
- The optional Quick-Add grid variant.
- Any new screen/modal (if manager log-today needs one → STOP, don't build).
- SM/TA/PA nav and shells beyond removing the mobile floating pencil (which applies globally).

## Standing rule reminders
- Fresh branch off freshly-fetched main; `git branch --show-current` before every commit.
- Rule 17 source-verify (predicate, handlers, breakpoints) in Phase 0.
- Rule 12 "STOP and wait for dispatcher"; Rule 15/19/20/21/22/23 as standard.
- No untracked smoke; no unconditional SKIP for a load-bearing assertion (CLAUDE.md lesson from PR-2).

## Acceptance checklist
- [ ] `QuickAddMenu.jsx` renders role-aware actions; primary highlighted; SOON disabled; TEAM divider for PM.
- [ ] Desktop pencil opens the popover; "Log today" opens daily capture (path preserved); pencil keeps amber dot.
- [ ] Mobile ＋ opens the sheet; floating pencil absent on mobile; amber dot on ＋ via the shared predicate, mirrored on the Log today row.
- [ ] Meetings action wired (handleStartMeeting → MeetingMode); manager log-today wired per #6 verdict (or STOP-surfaced if it needs a new modal).
- [ ] No navConfig/sidebar/pins change; SM/TA/PA nav unaffected.
- [ ] lint+build+test green; axe no new serious/critical on popover + sheet; smoke proves pencil→Log today and mobile pencil-absent (preview + prod); harness committed, no unconditional SKIP.

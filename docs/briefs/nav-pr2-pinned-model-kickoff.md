# Nav Redesign — PR-2: ★ Pinned model (prefs/app persistence + rules) — Kickoff Brief

**Type:** Feature (M) — adds the ★ Pinned zone, per-user persistence, and the first Firestore-persisted user pref.
**Merge channel:** HUMAN-MERGE — touches `firestore.rules` (access-control hard floor). Not green-channel.
**Run model:** **Opus** (rules + access-control).
**Trigger:** Nav redesign PR 2 of 4. PR-1 (navConfig + sidebar groups, squash `b7aa372`) is on main. This PR adds the per-user ★ Pinned zone seeded per role, the star pin/unpin affordance on the desktop Sidebar, and persistence to a new owner-only `prefs/app` subdoc with a localStorage mirror. Quick-Add (PR-3) and menu-layout/workspace (PR-4) remain OUT of scope.

---

## Inputs
- This brief: `docs/briefs/nav-pr2-pinned-model-kickoff.md`
- On main from PR-1: `src/components/shell/navConfig.js` (`getNavConfig(configKey, { role, showDailyCapture })`), `Sidebar.jsx` / `MobileNavDrawer.jsx` (render groups + scope chips + SOON), `src/config/comingSoonTabs.js`.
- Existing user-subdoc pattern to MIRROR (read in Phase 0, do not invent a new shape):
  - Service: `src/services/moneyNeedsService.js` (how tenantId+uid are sourced and a `users/{uid}` subcollection doc is read/written).
  - Rule: the `moneyNeeds` (and `yearPlan`/`monthlyPlan`) block in `firestore.rules`.
  - Rules test: `tests/rules/moneyNeeds.rules.test.mjs` (emulator harness, deny-matrix style).

---

## Decisions locked — do not re-litigate
(Phase 0 surprise → STOP and wait for dispatcher.)

1. **Persistence model = localStorage-first, Firestore-reconcile.**
   - On load: paint pins immediately from the localStorage mirror (instant, offline-tolerant). If no mirror, paint the per-role seeds.
   - In the background: read `prefs/app`. On success, **Firestore wins** — reconcile state and refresh the mirror. On read failure: keep the mirror/seeds and carry on; **never block the sidebar on the network read** and never show a spinner for pins.
   - Write path is **Firestore-primary**: write the doc, then update the mirror. A failed write surfaces a non-blocking console warn (do not throw into render).
2. **Storage shape.** Doc: `tenants/{tenantId}/users/{uid}/prefs/app` = `{ pinnedNav: string[], updatedAt }`. Write with **`{ merge: true }`** (PR-4 adds `menuLayout` to the SAME doc — neither may clobber the other). localStorage mirror key: **`agencytrack-pinned-nav`** (stores the `pinnedNav` array as JSON).
3. **Seeds are per-role, validated against the role's navConfig.** A seed entry that doesn't resolve to a real item id in that role's `getNavConfig` output is **dropped** (not stubbed). Seeds (by label — bind to the actual item `id` from navConfig in Phase 0):
   - **agent:** Daily Log (log-today) · Weekly Report (submit) · Policy Ledger · Goals · Planner `SOON`
   - **producingManager:** Weekly Report (mp-report) · Master Sheet · Recruiting · Goals (mp-goals) · Planner `SOON`
     - Note: the spec's PM seed lists "Log Today", but manager log-today has no route (deferred to PR-3). It will not resolve and is correctly dropped — do NOT add a manager log action here.
4. **A pin is an alias.** Pinning adds the item to the ★ Pinned zone at the top; the original stays in its group. Pinned items resolve their descriptor (label/icon/tabId|action/disabled) from the role's navConfig by id. **SOON items are pinnable** (Planner is seeded) and render disabled in the zone too.
5. **Pinned list is uncapped and editable immediately.** No drag-reorder (v2). Zone renders pins in a stable order (seed/config order, then append newly-pinned at end).
6. **Empty state:** if a user has zero pins, hide the ★ Pinned zone entirely (no empty header).
7. **Surface scope this PR:** the ★ Pinned zone + star pin/unpin interaction ships on the **desktop `Sidebar`**. `MobileNavDrawer` renders the pinned zone **read-only** (shows persisted/seeded pins at top; no star edit on mobile). **Mobile pin edit-mode is deferred** → bank as a follow-up.
8. **All Firestore access goes through a service file** (coding rule): create `src/services/userPrefsService.js` — `getUserPrefs(tenantId, uid)` and `setPinnedNav(tenantId, uid, pinnedNav)`. Source tenantId+uid exactly as `moneyNeedsService` does.
9. **a11y:** the star is a real `<button>`, ≥44px target, `aria-pressed`, `aria-label` "Pin {label}" / "Unpin {label}", focus-visible ring, reduced-motion guard. No new hex — reuse existing tokens (mirror the `.badge-soon` token pair already used for scope chips if any chip styling is needed).

---

## Phase 0 — gate + audit (no edits)
1. Rule 9 clean-main gate; record HEAD (expect `4b7710f` or later). Fresh branch `feat/nav-pr2-pinned`; `git branch --show-current` before any commit.
2. **Source-verify (Rule 17):**
   - Enumerate the actual item `id`s in `getNavConfig` output for `agent` and `producingManager` so the seeds (decision #3) bind to real ids. Record the id for each seed label; flag any that won't resolve (PM "Log Today" expected to drop).
   - Read `moneyNeedsService.js` — capture how tenantId+uid are obtained and the read/write call shape. `userPrefsService.js` mirrors it.
   - Read the `moneyNeeds` rule block in `firestore.rules` — capture the exact owner-gating pattern. The new `prefs` rule mirrors it.
   - Read `tests/rules/moneyNeeds.rules.test.mjs` — capture the emulator harness/setup. The new test mirrors it.
   - Confirm where `Sidebar.jsx` renders its section groups (the insertion point for the ★ Pinned zone, above the first group) and how `MobileNavDrawer.jsx` renders its list.
3. **Hard-stop** if: the `moneyNeeds` rule/service/test pattern can't be cleanly mirrored for `prefs/app`; or a seed label resolves ambiguously (more than one id); or the Sidebar group render has no clean above-groups insertion point. STOP with findings.

## Phase 1 — persistence layer + rules
- `src/services/userPrefsService.js`: `getUserPrefs(tenantId, uid)` (read `prefs/app`, return `{ pinnedNav?: string[] }` or null), `setPinnedNav(tenantId, uid, pinnedNav)` (`setDoc(..., { pinnedNav, updatedAt: serverTimestamp() }, { merge: true })`).
- `firestore.rules`: add an owner-only block for `tenants/{tenantId}/users/{uid}/prefs/{prefId}` mirroring the `moneyNeeds` owner gating (`allow read, write: if <owner check used by moneyNeeds>`). Do NOT touch the `users/{uid}` self-write allowlist.
- `tests/rules/userPrefs.rules.test.mjs`: deny-matrix mirroring the moneyNeeds harness — owner reads own (allow), owner writes own valid (allow), different-uid reads (deny), different-uid writes (deny), unauthenticated (deny). Include a cross-tenant case only if the moneyNeeds test does.

## Phase 2 — pinned state hook + seeds
- In `navConfig.js` (co-located nav data): export `getPinnedSeed(configKey)` returning the validated seed id[] per decision #3 (drop unresolved labels).
- `usePinnedNav({ role, configKey, navItems })` hook: implements decision #1 (localStorage-first paint → Firestore reconcile → mirror refresh) and #2 (shape/keys). Exposes `pinnedIds`, `isPinned(id)`, `pin(id)`, `unpin(id)`, and a resolver mapping `pinnedIds` → descriptors from `navItems`/config (skipping ids absent from the current role's config). Writes via `userPrefsService` then mirror.

## Phase 3 — render
- `Sidebar.jsx`: render the ★ Pinned zone above the first section group when `pinnedIds.length > 0` (decision #6). Each group row gets a star button (decision #9); clicking toggles `pin/unpin`. Pinned-zone rows reuse the existing row renderer (chips/child/disabled all honored), plus their own unpin star. Keep active-item left-bar+tint, collapse behavior, focus rings.
- `MobileNavDrawer.jsx`: render the pinned zone read-only at top (decision #7) — no star button on mobile this PR.
- Wire `usePinnedNav` in `AgentDashboard.jsx` and `ManagerDashboard.jsx` (UM/BM only; other roles unaffected — they pass no pinned state and render exactly as today).

## Phase 4 — verify
- `npm run lint`, `npm run build` green.
- `npm test` green, including the new hook/seed unit tests (seed validation drops PM "Log Today"; pin/unpin mutates state; reconcile prefers Firestore).
- **Rules emulator:** run the rules test suite (mirror the moneyNeeds invocation; JDK 21 is installed). The new `userPrefs` deny-matrix must pass. If the emulator can't start → STOP (don't skip the rules test on a rules PR).
- axe delta on Sidebar (agent + UM, light+dark): no NEW serious/critical vs main baseline. The star button's contrast/hit-target must pass; if the only failure is a known faint→muted token issue, the Rule 9 carve-out applies — any other new node → STOP.

## Phase 5 — smoke (real write-read-verify — required)
- Preview, then prod post-merge. As **test agent** (`kelsean@gmail.com`):
  1. Fresh state shows the agent seed pins in the ★ zone.
  2. Pin a currently-unpinned item → assert it appears in the zone AND a `prefs/app` write occurs (network) AND the `agencytrack-pinned-nav` mirror updates.
  3. **Reload → assert the pin persisted** (read-back from Firestore), proving the rules+claims path end-to-end.
  4. Unpin → reload → assert it's gone.
- If a UM/BM credential run is cheap, spot-check that the PM seed (no Log Today) renders. Mirror the PR-1 smoke harness style; leave it untracked so HEAD == smoked-SHA, or commit per the same convention.

## Phase 6 — commit / push / PR — then HOLD
- `git branch --show-current` = `feat/nav-pr2-pinned`. Conventional commit, push, open PR (base main).
- PR body: the seed id-binding table (incl. the dropped PM Log Today), the rules block diff + emulator deny-matrix result, smoke write-read-verify result, Rule 22 self-critique (≥1 gap), Rule 23 falsification note (e.g. "overturned if a reload doesn't read back the pinned id, or if a non-owner emulator write is allowed").
- Rule 21 Gemini disposition before reporting; Rule 20 report HEAD SHA; Rule 15 after any post-report push. **Rule 19 — never merge/deploy.** HOLD at PR-open.

## Phase 5 docs (placeholders)
- `docs/CONTEXT.md`: active-track entry → PR-2 in flight, squash-SHA placeholder. Rule 16 caps.
- `docs/FOLLOW_UPS.md`: bank **mobile pin edit-mode** (deferred this PR) and confirm PR-3/PR-4 remain queued.

---

## Out of scope (defer — do not touch)
- `menuLayout`, workspace/both layouts, the My Work/My Team toggle (PR-4 — but the `prefs/app` rule you add here must already permit the PR-4 `menuLayout` write to the same doc; the owner-only block covers it, so no PR-4 rules change).
- Quick-Add menu, pencil/＋ behavior, mobile pin edit-mode (PR-3 / deferred).
- The `users/{uid}` self-write allowlist (untouched).
- Drag-reorder of pins (v2).

## Standing rule reminders
- Fresh branch off freshly-fetched main; `git branch --show-current` before every commit.
- Rule 17 source-verify (seeds, service, rule, rules-test patterns) in Phase 0.
- Rule 12 "STOP and wait for dispatcher"; Rule 15 SHA-verify; Rule 19 no merge/deploy; Rule 20 HEAD SHA; Rule 21 Gemini; Rule 22 self-critique; Rule 23 falsification.
- Rules PR → the emulator deny-matrix MUST run green; do not waive.

## Acceptance checklist
- [ ] `userPrefsService.js` reads/writes `prefs/app` with `{ merge: true }`; tenantId+uid sourced like moneyNeeds.
- [ ] `firestore.rules` owner-only `prefs/{prefId}` block mirrors moneyNeeds; `users/{uid}` allowlist untouched.
- [ ] `userPrefs.rules.test.mjs` deny-matrix passes on the emulator.
- [ ] Per-role seeds resolve to real navConfig ids; PM "Log Today" correctly dropped.
- [ ] localStorage-first paint; Firestore reconcile (Firestore wins); read-failure degrades gracefully; mirror key `agencytrack-pinned-nav`.
- [ ] Desktop Sidebar: ★ Pinned zone above groups (hidden when empty); star pin/unpin works; pins are aliases (original stays in group); SOON pins render disabled.
- [ ] MobileNavDrawer: pinned zone read-only.
- [ ] Other roles (SM/TA/PA) unaffected.
- [ ] lint+build+test+rules-emulator green; axe no new serious/critical; smoke write-read-verify persists across reload (preview + prod).

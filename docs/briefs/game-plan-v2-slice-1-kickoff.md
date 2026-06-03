# Game Plan v2 — Slice 1: shell + Money Needs re-home

**Track:** J (V2 Redesign)
**Type:** Frontend-only — composition + panel restyle + nav re-nest. No new collection, no new writes, no Firestore rules change.
**Risk:** Low–Medium (new nav item + route + hub shell; restyle of an existing panel). No data-model or security surface touched.
**Build annotation (layout authority):** `docs/design/Game-Plan-Slice-1-Build.html` (landed alongside this brief). EXISTING regions tagged teal, NEW chrome tagged gold.

---

## 1. Why

Game Plan is a net-new v2 screen, deferred at PR #392. The v2 nav makes it the **PLANNING parent**. Per the locked mechanics spec, Game Plan is the annual→monthly commission/API planner (the LIMRA "Looking Ahead" worksheet, renamed) — **Path A**. The weekly/daily activity planner the workshop floated is a separate future question and is **out of scope** here.

Slice 1 is composition-first: build the Game Plan shell, re-home the existing Money Needs worksheet as Step 1, re-nest the nav. Everything that needs new persistence (Year Plan, Monthly, Commit, Manager workflow) is deferred to later slices.

---

## 2. Scope — IN

### 2.1 Game Plan shell (new chrome), rendered by a new `game-plan` tab

- **PlanAnchorStrip** — leads with the income/commission need. Foot chips: After-Tax Need · Renewals Cover · Commission Need · API Commitment. Sources (all from the EXISTING `moneyNeeds/{year}` doc):
  - After-Tax Need ← `totalAnnualAfterTax`
  - Renewals Cover ← `estimatedRenewalIncome.total`
  - Commission Need ← `firstYearCommissionsRequired`
  - **API Commitment** — Phase-0 resolve: if the agent has a committed API in Goals (`personalAnnualAPI`), show it; otherwise show it honestly as not-yet-set ("—" / "Set in your plan"), since the commit→Goals loop is deferred. **Do NOT fabricate an API figure.**
  - Plan completeness % = **derived** (e.g. is the Money Needs worksheet created / non-empty). Status pill = static **"Draft"** (commit doesn't exist in Slice 1).
- **StepRail** — 4 cards. Money Needs = done/current (links to the Money Needs step). Year Plan / Monthly Plan / Review & Commit render as honest **"next / coming"** states — NOT interactive cards showing empty or fabricated data.
- **"Plan so far" cascade** — read-only: Money Needs total → its derived commission/API target (existing `firstYearCommissionsRequired` / `firstYearCommissionsTargets`). The Year Plan / Monthly rungs show as "coming," not empty placeholders.
- **Review & Commit card** on the hub — a **disabled / preview** affordance with honest copy (the commit→Goals write is deferred), plus a live link to the existing **Goals** page.

### 2.2 Money Needs as Step 1 (re-home + restyle)

- Re-home the EXISTING `MoneyNeedsPanel` + `moneyNeedsService` — **unchanged data model**. Verified: each line item already stores `frequency` + `annualizedAmount`, and the service already exports `annualizeAmount(amount, frequency)`. **The per-row how-paid-freq + annualize column is presentational over existing fields — no new data.**
- Restyle toward the mockup's checklist: the 5 groups (Fixed / Living / Business / Savings / Misc), the 3 sub-calcs (Industry / Car / Loans), the summary chain After-Tax → +PAYE → Pre-Tax → −Renewals → 1st-Year Commissions Required → commission targets. Per-row name · TTD amount · how-paid-freq · annualized, with **≥44px touch targets** on inputs.
- Keep the existing first-run/empty template (fresh, pre-seeded names, amounts 0) — that is the empty state.
- **Preserve the existing Money Needs visibility/sharing behavior as-is** (the Track G privacy model — `visibility`, the share toggle, consent/audit). The annotation's "share-with-manager toggle disabled" refers ONLY to any NEW manager-review-workflow affordance from the mockup (which is deferred) — do NOT disable or remove the existing visibility toggle. If in doubt, leave existing behavior untouched.
- Money Needs keeps its own route/`tabId`; it becomes a child nav item under Game Plan (still deep-linkable). Reachable from the nav child AND the hub's rail card.

### 2.3 Nav re-nest (`AgentDashboard` NAV_ITEMS)

- Add Game Plan as the Planning parent, before `money-needs`: `{ id: 'game-plan', label: 'Game Plan', tabId: 'game-plan', Icon: <verify in Phase 0 — annotation suggests BarChart2>, sectionLabel: 'Planning' }`, with a **NEW** badge.
- Convert `money-needs` to a child: `{ child: true }`, drop its `sectionLabel`. Keep its existing `tabId`/route.
- **Goals stays a sibling** under Planning — it does NOT nest under Game Plan.
- `lookahead` → `game-plan` reconciliation: the mockup's internal key is `lookahead`; use `game-plan` consistently as the tab id/route. Note the mapping in the PR body.

---

## 3. Scope — DEFERRED (do NOT build in Slice 1)

Each is a deliberate net-new decision for a later slice:

- **Year Plan:** allocation, percent/direct mode, add-line, award-eligibility rule, license-profile tabs + the license-profile **user attribute** ("not stored on the user yet").
- **Monthly Plan:** the 12-month target-vs-actual chart, the monthly **target store**, the **actual-by-month read**, variance + "to finish the month" suggestions.
- **Review & Commit → Goals write** (the loop close).
- **Manager review/suggest workflow** (the gold banner, suggest-a-change, plan-health) + any new share affordance.
- **Folding the Commission Playground in** / retiring its standalone tab — leave Playground untouched.
- The weekly/daily **activity planner** — **CONFIRMED scope: derived + tracked** (Path B). Surface the personal weekly activity derived from the plan (the Commission Playground decomposition: income → API → apps → CIs → dials → prospects, weekly/daily), **plus** set-plan / log-actual / variance / manager roll-up. Net-new store + write surface + manager roll-up. **High priority — the intended next slice after Slice 1** (likely ahead of Year Plan; final ordering set when scoped). Distinct from the company-floor weekly minimums in `WeeklyStandardCard`.

---

## 4. Locked decisions

1. **Path A** — annual→monthly API planner; weekly-activity planner out of scope.
2. **No new `gamePlan` collection.** Completeness derived; status static "Draft." No new writes, no new Firestore rules, no new index.
3. **Honest framing** — forward steps read "next / coming," never empty or fabricated data. "Draft" is honest (no commit yet). Don't invent an API Commitment figure.
4. **Goals stays a sibling**; only Money Needs nests.
5. **Ship together** (no shell / Money-Needs split) — the restyle is presentational over existing service output; splitting would ship a dead Step 1.
6. **Preserve existing Money Needs behavior** (visibility/sharing) — re-home does not remove existing functionality.
7. **statusToken() roles** (don't assert token names): step done = success/teal; step current = teal accent; step upcoming/locked = muted; draft status = warning.

---

## 5. Phases

### Phase 0 — Gate + source-verify (Rule 17)
- `git fetch origin`, verify origin/main HEAD against CONTEXT.md, branch off origin/main.
- Confirm against live code (the brief asserts these from the repomix — re-verify):
  - `MoneyNeedsPanel` + `moneyNeedsService` structure; line-item `frequency` + `annualizedAmount` fields exist (→ the freq/annualize column is presentational). **If, contrary to this, the per-row freq/annualize is NOT in the existing model → STOP and wait for dispatcher** (it would make Slice 1 a data change).
  - `AgentDashboard` NAV_ITEMS shape + that `money-needs` is currently a top-level Planning item and no `game-plan` tab exists.
  - The existing v2 screen/shell pattern to model the hub on (e.g. `HomeV2`, the v2 `PolicyLedgerPanel`) — for component placement + folder convention.
  - `statusToken()` roles available.
  - The existing Goals route/tab (for the hub's link-out).
- Resolve the **API Commitment** chip source (Goals `personalAnnualAPI` vs honest not-yet-set).

### Phase 1 — Confirm no-new-data
- Confirm: no new collection, no new write path, no Firestore rules change, no index change. If any would be needed, **STOP and wait for dispatcher.**

### Phase 2 — Build
- New shell components (PlanAnchorStrip, StepRail, the cascade, the disabled Commit preview) placed per the verified v2 convention; the `game-plan` tab renders the hub.
- Restyle `MoneyNeedsPanel` to the checklist (preserving its data flow + visibility behavior).
- Nav re-nest + `game-plan` route/tab wiring; rail Money-Needs card → money-needs tab; hub Goals link → goals tab.
- Apply statusToken() roles; honest "coming" states; ≥44px touch targets; both themes.

### Phase 3 — Verify
- `npm run lint` (0 errors) + `npm run build` (clean).

### Phase 4 — Smoke (shared harness, agent login, both themes)
Default RUN (user-visible behavior). Assertions:
- **Nav:** Game Plan appears as a Planning parent with Money Needs nested beneath it; Money Needs is no longer a top-level item; Goals still a sibling.
- The `game-plan` tab loads: anchor strip renders (with Money-Needs-derived chips, or the honest empty/not-set states), the rail shows Money Needs live + Year Plan/Monthly/Commit as "coming," the cascade renders, the Commit preview is disabled, the Goals link is present.
- Money Needs Step 1 renders (the checklist; the first-run/empty template if the agent has no worksheet).
- **Write-read-verify** (regression on the restyled form against the existing service): edit one Money Needs expense-line amount → save → reload → assert the value persisted. (No new write path — this confirms the restyle didn't break the existing write.)
- `axe`: **NO-NEW** serious/critical vs the main baseline (delta, not absolute). Fix any NEW violations the restyle/shell introduces; pre-existing ones are out of scope.
- Both themes green; 0 console errors.
- AUTO-REVERT on smoke fail.

### Phase 4 — Docs (placeholders; Rule 16)
- `CONTEXT.md` Recently-shipped row with `#TBD`/`{TBD}` placeholders; refresh the top-of-file fields + the "Where we left off" prose.
- `FOLLOW_UPS.md`: the "Game Plan v2 screen deferred; Money Needs re-nesting pending (#392)" FU — mark the **shell + Money-Needs re-nest resolved by this slice**, and convert the remainder into a **"Game Plan v2 — remaining slices"** FU listing the §3 deferred items (including the weekly-activity planner — confirmed **derived + tracked**, flagged as the intended next slice).

### Phase 5 — Commit / push / PR
- Conventional commit (e.g. `feat(game-plan): Slice 1 shell + Money Needs re-home`).
- PR body: scope, the `lookahead`→`game-plan` note, the smoke checklist (Rule 18 — updated post-run), the deferred list.
- Report the feature-branch HEAD SHA (Rule 20). **Do not merge or deploy (Rule 19).**

---

## 6. Acceptance criteria
- [ ] Game Plan nav parent added (NEW badge); Money Needs nested child; Money Needs no longer top-level; Goals still a sibling.
- [ ] `game-plan` tab renders the hub (anchor strip + rail + cascade + disabled Commit preview + Goals link), both themes.
- [ ] Forward steps render as honest "coming"; no empty/fabricated data; status = "Draft."
- [ ] API Commitment chip shows an existing value or an honest not-set state — never a fabricated number.
- [ ] Money Needs Step 1 re-homed + restyled to the checklist; existing data flow + visibility behavior preserved; ≥44px inputs.
- [ ] No new collection, no new write path, no rules/index change.
- [ ] Lint 0 errors; build clean.
- [ ] Smoke green both themes incl. the Money Needs write-read-verify; axe NO-NEW.
- [ ] Docs updated with placeholders; the #392 Game Plan FU updated.

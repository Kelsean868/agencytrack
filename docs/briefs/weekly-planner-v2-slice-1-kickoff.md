# Weekly Planner v2 — Slice 1: suggested-target card (+ decomposition extraction)

**Track:** J (V2 Redesign) — Weekly-Activity Planner, Slice 1 of 4
**Type:** A refactor (extract the goal-decomposition engine) + a new read-only card. Touches the shipped Commission Playground.
**Risk:** Medium — the extraction re-points a shipped, working tool (`GoalDecompositionTab`); requires zero-behavior-change verification. The new card is frontend-only.
**Build annotation (layout authority):** `docs/design/Weekly-Planner-Slice-1-Build.html` (landed alongside this brief). EXISTING tagged teal (Playground engine, anchor, `ACT_FLOORS`), NEW chrome tagged gold (the card only).

---

## 1. Why + the Phase-0 finding

Game Plan's next slice is the weekly-activity planner (derived + tracked, Path B). Slice 1 = the read-only DERIVED suggested-target card in the Game Plan hub — "to stay on your plan: 50 dials · 40 contacts · 12 FFIs · 6 CIs / week" — composition over the Commission Playground's decomposition engine.

**Source-verify finding (changes the slice):** the income→API→apps→CIs→dials goal-decomposition chain is NOT an extracted function — it lives tangled inside `src/components/goals/CommissionPlayground/tabs/GoalDecompositionTab.jsx` (only the *modal/reverse* math is extracted, in `utils/commissionMath.js`). So the card can't "just call the engine." To show the derived line without duplicating the LIMRA chain (which would drift — the exact thing we're avoiding), Slice 1 must first **extract the decomposition into a shared pure function**, re-point the existing Playground tab at it (zero behavior change), then build the card consuming it.

> If Phase 0 finds the decomposition is in fact already a reusable function (contradicting this finding), skip the extraction, build the card alone, and flag it.

---

## 2. Scope — IN

### 2.1 Extract the goal-decomposition engine
- Extract the income→API→apps→CIs→dials→prospects chain (the A–J chain; see the Goals System Plan) from `GoalDecompositionTab.jsx` into a shared pure function in an **app-wide location** (e.g. `src/utils/goalDecomposition.js`), since it's now consumed by both the Playground and the Game Plan hub. Add a unit test.
- Re-point `GoalDecompositionTab.jsx` to consume the extracted function. **Zero behavior change** — the tab must render identical outputs. Verified by: existing Playground/GoalDecomposition tests still pass + a unit test on the extracted function (known inputs → the chain's outputs) + the tab's `OutputTable` numbers unchanged.
- The function must expose the **API → weekly activity** decomposition the card needs (apps = API ÷ avg policy size; CIs, dials via the ratios), so the card can derive from a committed API anchor without re-running the income→API half.
- Do NOT change the decomposition math, the rounding (nearest $10 / whole counts), or the auto-population of ratios from 8+ weeks of history. Same logic, relocated.

### 2.2 The suggested-target card (Game Plan hub "This week" rung)
- A read-only "Suggested weekly plan" card in the Game Plan hub — a new "This week" cascade rung below the monthly rung, **NOT a new nav item** — per the annotation.
- Content: the derived weekly activity line (dials · contacts · FFIs · CIs · apps), each chip carrying its ratio basis, with the tap-to-expand derivation chain — computed via the extracted function from the agent's API anchor + ratios.
- **Anchor = `personalAnnualAPI`** from the goals doc (consistent with the Game Plan Slice 1 anchor chip). If no committed API anchor exists → the honest fallback (below), never a fabricated target.
- **No-history fallback** (< 8 weeks of submitted reports → ratios can't be derived) → fall back to the **company floor** (`ACT_FLOORS`) as the suggestion, flagged "based on the company floor until you have 8 weeks of history."
- States: loading; empty/no-anchor ("Set a plan to see your week" + CTA per the annotation); the < 8-weeks→floor fallback; error.
- Read-only. No steppers, no commit, no stored plan, no actual, no variance.

---

## 3. Scope — DEFERRED (later slices)

- **Slice 2:** agent-set plan — steppers, the `weeklyPlan` store, commit + reset-to-suggested, floored at minimum.
- **Slice 3:** plan vs actual vs variance (weekly + daily; actual read from the weekly submission + daily from Daily Capture); evolve `WeeklyStandardCard` to plan-vs-actual-with-floor-baseline.
- **Slice 4:** manager roll-up (team aggregate).
- **Commission Playground tab absorption** — this slice reuses the engine; retiring the standalone tab is a later decision.
- **Daily breakdown in the card** — CD's call: hold to Slice 3 (meaningless without daily actuals; in Slice 1 it'd be a ÷5 restatement or imply tracking that doesn't exist).

---

## 4. Locked decisions

1. **Extraction first** — single source of truth; no duplicated decomposition math / drift.
2. The extraction is **zero-behavior-change** to the Playground tab — verified, not assumed.
3. Anchor = `personalAnnualAPI`; honest fallback (floor / "set your plan") when absent — never fabricate.
4. **Read-only Slice 1** — no store, no write, no variance, no manager roll-up; doesn't touch `WeeklyStandardCard` (Slice 3); doesn't retire the Playground tab.
5. **No daily breakdown** in Slice 1 (Slice 3).
6. `statusToken()` roles: suggested target = teal accent; floor baseline = thin neutral reference line. (Variance ▲▼ = Slice 3.)

---

## 5. Phases

### Phase 0 — gate + source-verify (Rule 17)
- `git fetch origin`, verify origin/main HEAD against CONTEXT.md, branch off origin/main.
- **Assess the extraction:** confirm the decomposition in `GoalDecompositionTab.jsx` is a clean math/UI separation (the chain is computable as a pure function, the UI state staying in the tab). **If the math is deeply interwoven with UI state such that a clean zero-behavior-change extraction isn't feasible → STOP and wait for dispatcher** (we split into an extract-only PR first).
- Confirm: `personalAnnualAPI` on the goals doc (the anchor); `ACT_FLOORS` (the floor fallback); the 8-week history / ratio-auto-population path; the existing GoalDecomposition tests (the regression baseline); the Game Plan hub component (where the rung/card mounts).

### Phase 1 — confirm no-new-data
- Confirm: no new collection/store/write, no Firestore rules/index change (Slice 1 reads existing goals + history; the card is read-only). If any write would be needed, STOP and wait for dispatcher.

### Phase 2 — build
- Extract the decomposition function + unit test; re-point `GoalDecompositionTab` (zero behavior change).
- Build the suggested-target card in the Game Plan hub consuming the function; anchor + fallbacks + states per §2.2.
- `statusToken()` roles; both themes; ≥44px touch targets on any interactive (tap-to-expand) element.

### Phase 3 — verify
- `npm run lint` (0 errors); `npm run build` (clean).
- **Regression:** existing GoalDecomposition/Playground tests pass unchanged; the new decomposition unit test passes; the Playground tab's output is identical (the extraction changed nothing user-visible there).

### Phase 4 — smoke (shared harness, agent, both themes)
Default RUN (user-visible). Assertions:
- **Playground regression:** open the Commission Playground → Goal Decomposition tab; assert it renders without error and its computed output is unchanged by the extraction (drive a known input or assert a representative computed value).
- **Game Plan hub:** the new "This week" / suggested-plan rung renders; with an API anchor present, the derived weekly line shows (dials/contacts/FFIs/CIs/apps) with the derivation reveal; the no-anchor and < 8-weeks→floor fallbacks render their honest states.
- `axe` NO-NEW vs main baseline; both themes; 0 console errors. AUTO-REVERT on smoke fail.

### Phase 4 — docs (placeholders; Rule 16)
- `CONTEXT.md` Recently-shipped row + `#TBD`/`{TBD}` placeholders; refresh top-of-file fields + Where-we-left-off.
- `FOLLOW_UPS.md`: open/extend a "Weekly-activity planner — remaining slices" FU listing Slices 2–4 + the Playground absorption; note the decomposition is now extracted (a small cleanup-debt reduction).

### Phase 5 — commit / push / PR
- Conventional commit: `feat(game-plan): weekly planner Slice 1 — suggested-target card + decomposition extraction`.
- PR body: the extraction + the card, the zero-behavior-change verification, the smoke checklist (Rule 18 — updated post-run), the deferred slices.
- Report feature-branch HEAD SHA (Rule 20). **Do not merge or deploy (Rule 19).**

---

## 6. Acceptance criteria
- [ ] Decomposition chain extracted to a shared pure function (+ unit test); `GoalDecompositionTab` re-pointed with ZERO behavior change (existing tests pass; output identical).
- [ ] Suggested-target card renders in the Game Plan hub from `personalAnnualAPI` + ratios; derivation reveal works.
- [ ] No-anchor + < 8-weeks→floor fallbacks render honest states; no fabricated target.
- [ ] Read-only; no store/write/variance; `WeeklyStandardCard` + Playground tab untouched (beyond the re-point).
- [ ] No new collection / rules / index.
- [ ] Lint 0 errors; build clean; regression + new unit test pass.
- [ ] Smoke green both themes (Playground unchanged + card + fallbacks), axe NO-NEW.
- [ ] Docs updated with placeholders.

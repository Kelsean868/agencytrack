# Brief — DCv2 Phase 5: Manager days-worked + weekend marker

**Size:** M
**Merge:** HUMAN-MERGE (touches the aggregator → functions deploy post-merge)
**Stacks on:** `main` after `/post-merge 691` (Phase 4 shipped, 403247e)
**Deploy:** `firebase deploy --only functions` required post-merge (cron is touched). Vercel auto-deploys the frontend.

---

## 1. Goal

Give a manager, on the existing roster, two emergent signals per agent for the selected week, sitting beside the outcome they already see (API-vs-target):

1. **Days worked** — how many distinct days this week the agent actually logged activity. Effort, derived from what they logged, not from any setting.
2. **Weekend marker** — whether the agent logged on the weekend (Saturday or the opening Sunday) this week.

Together with the API/target colour already in the grid, this gives the effort-plus-outcome pairing a manager needs to coach: "logged 6 days including the weekend and still under target" reads very differently from "logged 2 days, no weekend."

Optional enhancement, **in-scope but droppable-last**: **weekend production share** — how much of the week's API came from weekend days, as a third column (`weekendApi` / share %). Build it if scope allows; it is the *first* thing to cut if Phase 0 findings or time force a trim, in which case it becomes the §10 fast-follow. The core (days-worked + marker) ships regardless. See decision 8 in §2.

This is a *surfacing* feature. It shows raw signals. It does **not** add any algorithmic judgement, score, or "underperformer" flag.

---

## 2. Locked decisions

1. **Days-worked is EMERGENT.** `daysWorked` = count of distinct dates in the week that have a `dailyActivity` doc with any logged activity. It is NOT read from any `workingDaysPerWeek` config. (Per-agent working-days was dropped; the tenant default stays a pace denominator only and is not used here.)
2. **Weekend = Saturday OR the opening Sunday** of the week (Trinidad week is Sun-start; both ends are now loggable — Saturday already was, Sunday cell shipped in Phase 4). `weekendWorked` = true iff a logged entry exists on either day.
3. **Persist in the submission, render-only in the manager view.** The aggregator (both twins) writes `daysWorked` and `weekendWorked` (and `weekendApi` when the share enhancement is built) into the weekly submission doc. `MasterSheet` reads them off the submission it already loads — **no new manager-side reads, no rules change.**
4. **Both aggregator twins emit the fields.** Client aggregate-on-save (`aggregateCurrentWeekDaily`, `loggingModeService`) covers the live/current week; the cron (`sundayDailyToWeekly.js`) covers finalised weeks. If they share a pure rollup, change it once; if duplicated, change both and keep them byte-identical.
5. **Placement:** new column(s) immediately adjacent to the existing API-vs-target column in `MasterSheet`, so effort sits beside outcome. Days-worked as a number; weekend as a compact marker (icon/badge, Nexus tokens — not alarm-red).
6. **Graceful absence.** Submissions without the new fields render `—`, never crash. Greenfield (no real agent data), so no historical backfill is required; new saves get the fields via aggregate-on-save, and the south cron backfills finalised weeks going forward.
7. **Defer:** multi-week trend, any cross-week comparison, any flag/threshold logic. Out of scope.
8. **Weekend production share is IN-SCOPE, droppable-last.** `weekendApi` = sum of API from weekend-day (Sat + opening-Sun) entries, persisted on the submission and rendered as a column/share beside the marker. Build it as part of this PR. It is the single first thing to cut if a Phase 0 gate or time forces a trim — and only then does it become the §10 fast-follow. The core (days-worked + marker) is never cut.

---

## 3. Phase 0 — recon + gates (STOP and report on any gate)

Confirm against source before writing anything. Pair every grep with `git ls-files` for tracked status (Rule 17).

1. **Submission schema.** Locate the weekly submission/draft doc shape (`tenants/{tid}/submissions/{uid}_{weekStarting}`). Confirm where its fields are assembled and that adding three scalar fields is additive (no schema validator/rules `hasOnly()` arm on the submission write that would reject new fields). **GATE 1:** if a rules `hasOnly()` or validator constrains the submission's field set, STOP and report — adding fields would need a rules change, which changes the merge calculus.
2. **Aggregator twins.** Identify the exact client rollup (`aggregateCurrentWeekDaily` in `src/services/loggingModeService.js`) and the cron rollup (`functions/aggregators/sundayDailyToWeekly.js`), and the pure rollup `src/lib/schema/dailyActivity.aggregator.js`. **Determine whether the two twins share a pure module or each carry their own aggregation math.** **GATE 2:** if they're duplicated AND already divergent in how they count/iterate daily docs, STOP and report before adding fields — I need to see the divergence.
3. **Per-day data at rollup time.** Confirm the rollup iterates the week's `dailyActivity` docs (it does, per `where('weekStarting','==',W)`), so distinct-date count and weekend-day detection are computable in-place with no extra read. Confirm the daily doc carries its own date (the `YYYY-MM-DD` doc id / a date field) so distinct-date and day-of-week are derivable. Use the TT-anchored helpers (`getSundayOf`, `getTodayTT`, `parseDateOnlyTT`) — do NOT introduce browser-local date math (the UTC-4 trap).
4. **MasterSheet mechanics.** In `src/components/manager/MasterSheet.jsx`, read the column-definition array, `cellContent(col, row)`, the CSV export, and confirm `row` is the submission. Identify the API/target column so the new columns land beside it. Confirm what effort/outcome signals already render per row so the additions sit beside them, not duplicate them.
5. **Smoke manager account.** Confirm an existing manager-role account that can see the smoke test agent's row (agent is in `tatillife_smoke`, unit `Mdi3Qf9XEwMg4zbGmu8OFOvAEuM2`, branch `smoke_branch`). **GATE 3:** if no manager over that unit/branch exists for smoke, STOP and report — the acceptance smoke needs one; do not silently create roles.

---

## 4. Phase 1 — aggregator emits the fields

1. In the rollup, compute over the week's daily docs:
   - `daysWorked` = count of distinct dates that have any logged activity (define "any activity" the same way the existing rollup decides a day is non-empty — confirm and reuse that predicate; do not invent a second emptiness rule).
   - `weekendWorked` = true iff any logged entry falls on the opening Sunday (`weekStarting`) or the Saturday (`weekStarting + 6`).
   - (Enhancement, droppable-last) `weekendApi` = sum of API from weekend-day (Sat + opening-Sun) entries, for the production-share column.
2. Write these onto the submission doc in BOTH twins (or the one shared module). Preserve the existing `merge:true` semantics — these are additive.
3. Tests: extend the aggregation unit tests (client side `dailyActivity.aggregator` tests, and the functions-side `dailyToWeekly.test.js`) with cases: 0 days, 5 weekday-only (weekendWorked=false), a Sunday-only week, a Saturday-only week, a 7-day week (daysWorked=7, weekendWorked=true), and a distinct-date-dedupe case (two docs same date → counts once; should not happen by doc-id design, but guard it). Assert TT-anchoring (a Sunday-boundary case that would mis-bucket under browser-local).

## 5. Phase 2 — MasterSheet renders the columns

1. Add the column definition(s) adjacent to the API/target column: a **Days worked** numeric column and a **Weekend** marker column (compact badge/icon; Nexus warning/info tokens, never alarm-red). When the enhancement is built, add a **Weekend API** (or share %) column immediately beside the marker.
2. Extend `cellContent` to render the new fields from `row` (the submission). Absent field → `—`. Both light and dark themes.
3. Extend the CSV export to include the new columns (header + value), `—`/empty-safe.
4. A11y: column headers labelled; the weekend marker has an accessible label (e.g. `aria-label="Worked weekend"`); contrast passes (axe no-new vs main baseline). Expose a test hook on the day-count cell and weekend marker (`data-testid`) for the smoke.

## 6. Phase 3 — pairing + polish

1. Verify the new columns read naturally beside the existing API-vs-target colour (effort beside outcome). Preserve sticky-column behaviour and horizontal-scroll layout — do not break the existing column widths/stickiness.
2. Confirm `MasterSheet` still renders cleanly for: an agent with a submission but no new fields (`—`), an agent with daysWorked=0, and a full 7-day weekend-worked agent.

## 7. Phase 4 — docs (with placeholders)

1. Update `docs/CONTEXT.md` per Rule 16 (respect the size caps now baked in — shed oldest entries as you prepend).
2. Add/extend the relevant doc note describing the emergent days-worked + weekend signal and where it's persisted/rendered. Leave `#TBD`/`{TBD}` placeholders for PR# and squash SHA to be filled at `/post-merge`.

## 8. Phase 5 — commit / push / PR

1. Branch off `main`. Commit the aggregator change, MasterSheet change, tests, and docs.
2. Open the PR. Report the feature-branch HEAD SHA (Rule 20).
3. Poll CI + Gemini and disposition every comment (Rule 21).
4. **HOLD for human review** — do not merge (Rule 19). Note in the PR that `firebase deploy --only functions` is required post-merge (cron touched).

---

## 9. Acceptance / smoke

Production smoke via `setupBypassSession`, both themes, axe no-new. The bar is **the manager sees emergent signals that reflect real daily logging** — not just that fields exist in Firestore. Mirror the Phase 4 rigour: prove the rendered row moves with the data.

1. Seed (through the real save path so aggregate-on-save fires, not a raw SDK submission write): the smoke test agent logs daily activity on **distinct days including a weekend day** for a target week — e.g. Thu + Fri + Sat (Saturday = weekend) → expect `daysWorked=3`, `weekendWorked=true`.
2. Log in as the smoke **manager** account, open `MasterSheet` for that week.
3. Assert the agent's row shows **Days worked = 3** and the **weekend marker present** (both themes). Read via the `data-testid` hooks, not text-scraping.
4. Negative leg: a weekday-only agent (or the same agent in a weekday-only week) → weekend marker **absent**, days-worked equals the weekday count.
5. (Enhancement) If the share column is built, assert the **Weekend API** column reflects the Saturday entry's API for the seeded agent.

Failure to render the correct count/marker = fail. Field-in-Firestore alone is not sufficient.

---

## 10. Out of scope / deferred

- **Weekend production share** is NOT here by default — it is in-scope for this PR (§2 decision 8). It lands in §10 *only* as the fast-follow if a Phase 0 gate or time forces it to be cut; the attribution is computable at the same rollup point, so re-adding it later is cheap.
- Per-agent or per-tenant working-days config (dropped; not used here).
- Multi-week trend, streaks, cross-week comparison.
- Any threshold, flag, score, or "underperformer" judgement. Raw signals only. (Pairs with the existing `AccountabilityFlagPanel` but adds no new judgement to it.)
- Surfacing the same signal in `MeetingMode` / 1:1 view — possible later, not now.
- Generalising the cron off the hardcoded `tatillife_south` (SEC-9c, its own ticket).

---

## 11. Risks / falsification

- **Twin divergence (GATE 2).** If the client and cron rollups don't share a module and count days differently, the manager could see different `daysWorked` for a live vs finalised week. Falsifier: the two rollups produce different counts for the same seeded week. The unit tests must cover both paths; if shared module, this risk collapses.
- **Submission field-set constraint (GATE 1).** If a rules `hasOnly()` guards the submission write, new fields get rejected silently. Falsifier: write a submission with the new fields in the emulator and confirm it persists; STOP if denied.
- **Date trap.** Weekend detection done with browser-local dates mis-buckets the Sunday boundary under UTC-4. Falsifier: a Sunday-boundary unit case that passes TT-anchored and fails browser-local. Use the TT helpers only.
- **"Any activity" definition drift.** If days-worked uses a different non-empty predicate than the rollup's own, the count can disagree with what the agent's strip shows. Reuse the existing predicate; do not invent a second one.

# Brief — Daily Capture v2 · Phase 4: Full-week logging (the Sunday cell)

**Track:** Daily Capture v2 · **Phase:** 4. **Size:** S–M.
**Merge:** HUMAN-MERGE — agent-facing, deploys to live agents. **Stacks on:** `main` (after `/post-merge 690`).
**Preconditions:** `/post-merge 690` merged (clean main with 3b's strip changes).

## Goal
Let every agent log activity for **any** day they actually worked, including Sunday — so the same agent can report a 5-, 6-, or 7-day week accurately, week to week. Days-worked is **emergent** (what they log), not configured. This is the capture half; the manager-facing weekend/days-worked view is the next phase (Phase 5), out of scope here.

## Verified ground truth (recons — do not re-litigate)
- The strip is generated Mon(+1)…Sat(+6) off `weekStarting`; the opening Sunday is never a cell.
- `isOff` is **cosmetic only** — it dims + suppresses the missing-dot; it never gates loggability. The only logging gate is `!isFuture`.
- `saveDailyEntry` has no date validation; the `dailyActivity` write rule is owner-scoped with no date constraint — a Sunday-dated doc is already writable, no rules change.
- The aggregator queries `where('weekStarting','==',W)` (no day-of-week filter); `getSundayOf(Sunday)` returns that same Sunday, so a Sunday doc tags `weekStarting = itself` and counts in the week it opens — no aggregator change.
- On Sunday (`isTodaySunday`) the form is replaced by the read-only confirm view and the strip is hidden.

## Decisions Locked (do not deviate)
1. **Universal, no gate, no config.** Prepend the week's opening Sunday to the strip as a back-fillable cell (Mon–Sat → **Sun–Sat, 7 cells**) for ALL agents. Do NOT gate it on `workingDaysPerWeek` and do NOT introduce `wd = 7` — days-worked is emergent.
2. **Sunday is always "off"-styled** (dimmed when empty, never a missing-nag) — any agent *may* work it, none is *expected* to. Loggability stays universal (`isOff` is cosmetic). Follows existing off-day streak/nudge behavior (no break, no nag).
3. **Sunday is a back-fill cell** reached Mon-onward. On Sunday itself the confirm view still owns the screen (strip hidden) — Sunday's own work is logged the next day. Do NOT add same-day Sunday logging; do NOT touch the Sunday confirm model.
4. Logging the Sunday cell writes via the existing `saveDailyEntry` → `weekStarting = getSundayOf(Sunday) = that Sunday` → counts in the week it opens. **No aggregator change, no rules change, no functions.**
5. **Pace denominator UNCHANGED** (3b's `workingDaysPerWeek`, 5/6). Sunday work adds points toward the weekly floor (so the agent reads further "ahead"); it is not added to the denominator. No pace math change.

## Phase 0 — source re-verify (post-3b)
1. `deriveWeekStripDays` (post-3b shape) — confirm prepending the opening Sunday yields a cell whose date == `weekStarting`, and that `getSundayOf` of that date returns itself.
2. The select/save path treats the Sunday cell identically to any other past back-fill cell (`selectedDate = Sunday` → `saveDailyEntry`).
3. `isOff` can apply to Sunday (always off, no-nag) without gating loggability; a *logged* Sunday still renders its activity chip.
4. On `isTodaySunday`, the strip stays hidden — confirm no regression to the confirm view.
5. Re-confirm: no rules change (owner-scoped Sunday write allowed) and the `weekStarting` query already includes the Sunday doc.

## Scope
Prepend the opening Sunday in `deriveWeekStripDays` + ensure it renders off-styled, no-nag, and is loggable like any back-fill day. Nothing else.

## NON-scope
`wd = 7` / per-agent or per-tenant working-days for Sunday; same-day Sunday logging; the manager weekend/days-worked view (Phase 5); pace-denominator changes; aggregator/rules/functions changes.

## Phase 1 — implement.

## Phase 2 — static verify
Lint/build/full suite + unit tests: `deriveWeekStripDays` returns the opening Sunday as the FIRST cell with date == `weekStarting`; that cell is `isOff` (no missing-dot) yet selectable (not `isFuture` on a past Sunday); and a Sunday selection routes to a `weekStarting` equal to that Sunday.

## Phase 3 — smoke (REAL — must prove the Sunday work COUNTS)
Force a weekday so the opening Sunday is a past back-fill cell. Select it, log activity, save, reload. Assert: (a) the Sunday cell exists and is selectable; (b) a `dailyActivity` doc is written for the Sunday date with `weekStarting` == that Sunday; (c) **the week's aggregated total / points reflect the Sunday activity** — not merely that the doc exists. Both themes; axe NO-NEW.

## Phase 4 — docs (note Phase 5 = the manager weekend/days-worked view).
## Phase 5 — branch `feat/daily-capture-v2-4-full-week-logging` off `main`; PR; Rule 20 SHA; HOLD.
## Phase 6 — Gemini disposition.

## Self-critique (Rule 22)
The load-bearing claim is "Sunday work counts toward the week," and it rests on the aggregator's `weekStarting`-field query + the `getSundayOf(Sunday)=itself` tagging — the Phase 3 smoke must assert the week TOTAL moves, not just that a doc was written, or we'd ship a cell that logs into a void. Two accepted warts, both flagged: Sunday can only be back-filled (not logged same-day, because Sunday is the confirm day), and the always-present Sunday cell adds one dimmed cell to the strip for the majority who never work Sundays — the cost of universal, config-free capture.

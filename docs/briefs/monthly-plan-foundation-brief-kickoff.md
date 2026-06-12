# Monthly Plan — Foundation Slice (Game Plan Step 3, Slice 1 of 3)

## Context
Monthly Plan is Step 3 of the agent's Game Plan loop: it breaks the Year Plan's
annual API target into 12 monthly targets and tracks actual production month-by-month
against them. This is the **headless foundation slice** — the `monthlyPlan` store,
its service, its rules, and the **pure math + actuals helpers** the panel will render.
**No UI ships in this slice.** The panel (Slice 2) and the StepRail/PlanCascade wiring
(Slice 3) build on this.

Design source: CD's annotation `Monthly Plan Panel — Step 3 Build`, with the three
reconciliations below applied. Mirror targets: the Year Plan foundation
(`yearPlanService.js` + the `/users/{uid}/yearPlan/{year}` rules arm) for the
store/service/rules; existing shipped engines for the math (see Reuse map).

## Decisions locked (do not re-litigate — surface ANY deviation before implementing)

**Store.** `tenants/{tid}/users/{uid}/monthlyPlan/{year}` subcollection, mirroring
`yearPlan/{year}` (doc ID = the year). Doc shape:
- `tenantId`, `uid`, `year` (number)
- `targets` — array of **12 numbers in FULL TTD** (Jan…Dec). **NOT thousands** — the
  annotation drew `55` (K); store `55000`, `parseFloat` enforced. (Reconciliation 1.)
- `split` — `'even' | 'custom'`
- `status` — `'draft' | 'committed'` (this slice only ever creates `'draft'`)
- `anchorAPI` — snapshot of the Year Plan total API (full TTD) at create time
- `createdAt`, `updatedAt` (serverTimestamp)
- **Invariant:** `Σ targets === anchorAPI` (full TTD, both sides). Enforced in the
  helpers + asserted in tests.

**Anchor = the Year Plan total.** `anchorAPI` is the sum of the agent's enabled-line
`yearPlan/{year}.lines.*.targetAPI`. The **caller resolves it from the loaded
yearPlan and passes it in** — the service does not chain-read the yearPlan. No
yearPlan (or zero total) ⇒ no anchor ⇒ the panel's "do Year Plan first" state
(Slice 2); `createMonthlyPlan` is simply not called. A stale anchor (agent later
re-allocates their Year Plan so the total moves) is a **Slice-2 re-sync concern** —
bank it here, don't solve it in the foundation.

**Actuals are READ, never stored.** Reuse `extractTotalProductionCredit(submission)`
from `extractFields.js` (V2-first, V1 fallback — the canonical production-credit read)
for each submission's API, and bucket by the `weekStarting` month in **Trinidad time**
via `parseDateOnlyTT`. A weekly submission belongs to **one** month — its
`weekStarting` (Sunday) month; weeks that straddle a month boundary are assigned by
their Sunday, the simple explainable rule. (Reconciliation 2 — confirm field/helper
names in Phase 1.)

**Pace is a NEW month proration, reusing existing bands.** (Reconciliation 3.)
`planVariance.js` prorates against the **week** (`plan × elapsed ÷ 6` working days) —
it does **not** do month pace. Monthly expected-to-date is `target × elapsedDays ÷
daysInMonth` over **calendar** days, Trinidad time. So:
- Write the month proration fresh (small).
- **Reuse** `planVariance`'s ahead / on-track / behind **variance-band thresholds**
  (e.g. the ≥ 90%-of-pace on-track band) rather than inventing new ones — import them
  if exported, else mirror the exact thresholds and note it. Single-source the bands.
- **Reuse** `goalDecomposition`'s avg-policy figure (default TTD 12,000) for the
  apps conversion — do not introduce a second avg-policy constant.

### Deferred OUT of this slice (do not build here)
- The `MonthlyPlanModal` + `MonthChart` + `MonthTargetField` + `BalanceInvariant` +
  `ToFinishReadout` UI → **Slice 2** (gated panel).
- StepRail Step 3 live + the PlanCascade Monthly rung → **Slice 3** (gated wiring).
- Commit → Goals write → **Step 4**.
- Stale-anchor re-sync (yearPlan total moved after the monthly plan was saved) →
  **Slice 2** (banked).
- Per-line monthly targets (`targets[month][line]`) → deferred per your call
  (total-per-month ships; per-line is a later weight increase).
- Notifications/nudges + manager monthly roll-up → separate surfaces.

## Phase 1 — recon (report findings inline, then PROCEED through the build)
Read and report the items below in your build report. Mirror whatever the existing
code does. **Only stop and report if a finding contradicts a locked decision above** —
e.g. `extractTotalProductionCredit` doesn't exist as described, submissions carry no
usable `weekStarting`, or `planVariance` exposes no reusable band logic AND its
thresholds can't be cleanly mirrored. Routine structural differences are not a stop.
1. **`yearPlanService.js` + the `yearPlan` rules arm** — the create/get/save signatures,
   the idempotency pattern, the doc-ID/`year` handling, and the exact owner-only rules
   arm to mirror for `monthlyPlan`.
2. **`extractTotalProductionCredit`** (`src/utils/extractFields.js`) — confirm the
   signature and that it returns a per-submission API number (V2-first, V1 fallback).
3. **Submission shape** — confirm `weekStarting` (a Sunday) is present and usable, and
   how submissions are loaded for the hub today (reuse that load in Slice 2/3 — this
   slice's helpers just take a `submissions[]` argument).
4. **`parseDateOnlyTT` / `getTodayTT`** (`src/utils/dateInputs.js`) — the TT-time
   date utilities for month bucketing + "today" / elapsed-days math.
5. **`planVariance.js`** — its pace formula (confirm it's week-scoped) and its
   variance-band thresholds/exports, so the month-pace helper reuses the bands rather
   than inventing them. Report whether the bands are importable or must be mirrored.
6. **`goalDecomposition.js`** — the avg-policy figure / `DEFAULT_DECOMPOSITION_INPUTS`
   to reuse for the apps conversion (`apps = API ÷ avgPolicyAPI`).
7. **The emulator-rules + service-test harness** used for `yearPlan`
   (`tests/rules/yearPlan.rules.test.mjs`, `yearPlanService.test.js`) — match the style.

## Phase 2 — service (`src/services/monthlyPlanService.js`, new)
Mirror `yearPlanService.js` exactly in style. Export:
1. `createMonthlyPlan(tenantId, uid, year, anchorAPI)` — **idempotent** (getDoc; if the
   doc exists, return it untouched; else scaffold + setDoc). Scaffold = `targets:
   seedEvenSplit(anchorAPI)`, `split: 'even'`, `status: 'draft'`, `anchorAPI`, `year`
   as a number, `tenantId`, `uid`, `createdAt`/`updatedAt` serverTimestamp.
2. `getMonthlyPlan(tenantId, uid, year)` — getDoc → `data()` or `null`.
3. `saveMonthlyPlan(tenantId, uid, year, targets, split)` — writes `targets` (12 full-TTD
   numbers, `parseFloat`), `split`, `status: 'draft'`, `updatedAt`. (Caller guarantees
   `Σ targets === anchorAPI` via the balance helper; the service re-validates the length
   is 12 and all numeric.)

## Phase 3 — rules (`firestore.rules`)
New `monthlyPlan` arm, sibling to the `yearPlan` arm under
`/tenants/{tenantId}/.../users/{uid}/...`. **Owner-only**, mirroring the `yearPlan`
arm exactly (get/list; create with `status == 'draft'`; update by owner; `delete: false`).
No manager-read arm this slice.

**Deploy posture:** this is a new owner-only arm with **no UI writing it until the
gated Slice-2 panel** — same situation as the Year Plan foundation, which deployed its
owner arm at merge. So **deploy these rules at this slice's merge**
(`firebase deploy --only firestore:rules`), emulator-proven, zero production exposure.
(This is unlike the 2b manager-allowlist, which rode the un-gate because a live
dropdown would exercise it — not the case for a brand-new owner-only arm.)

## Phase 4 — pure helpers (`src/lib/monthlyPlanMath.js`, new — fully unit-tested)
Pure, framework-free, the intricate core. Export:

**Write / plan side:**
- `seedEvenSplit(anchorAPI)` → 12 even full-TTD targets; **last month absorbs the
  rounding remainder so `Σ === anchorAPI` exactly.**
- `balanceDelta(targets, anchorAPI)` → `Σ targets − anchorAPI` (0 = balanced; the
  pill's "vs annual" figure; Save is gated on `=== 0`).
- `autoDistributeRemainder(targets, anchorAPI, currentMonthIndex)` → spread the delta
  evenly across the **untouched future** months (indices `> currentMonthIndex`),
  last future month absorbing rounding so the result balances. Past + current months
  are not redistributed.
- `monthEditable(monthIndex, currentMonthIndex)` → past months **locked**, current +
  future **editable** (the panel uses this; pure so it's testable).

**Read / pace side** (these take `submissions[]`, the plan, and `todayTT` — no I/O):
- `bucketActualsByMonth(submissions, year)` → `number[12]` of full-TTD actuals, each =
  Σ `extractTotalProductionCredit(sub)` for subs whose `parseDateOnlyTT(weekStarting)`
  falls in that month (Trinidad time). Past months = complete; current = month-to-date
  partial; future = 0.
- `monthlyPace(target, year, monthIndex, actualToDate, todayTT)` → `{ expectedToDate
  (target × elapsedCalendarDays ÷ daysInMonth, TT-time), state (ahead | on-track |
  behind, REUSING planVariance's band thresholds), toFinishAPI (max(0, target −
  actualToDate)), toFinishApps (toFinishAPI ÷ avgPolicyAPI) }`. Only meaningful for the
  current month; past = settled, future = target-only.
- `ytdDelta(actualByMonth, targets, currentMonthIndex)` → `Σ(actual − target)` over the
  **completed** months (indices `< currentMonthIndex`) — the "+9K ahead" YTD pace figure.

Reuse, do not re-implement: `extractTotalProductionCredit` (extractFields), `parseDateOnlyTT`/
`getTodayTT` (dateInputs), the avg-policy figure (goalDecomposition), the variance-band
thresholds (planVariance — import or mirror-with-note).

### Tests
- **Service unit** (`monthlyPlanService.test.js`, mirror `yearPlanService.test.js`):
  create scaffolds the documented shape with an even split summing to `anchorAPI`;
  create is idempotent; `getMonthlyPlan` returns data/null; `saveMonthlyPlan` writes
  `parseFloat` numerics + status draft + rejects a non-12 targets array.
- **Math unit** (`monthlyPlanMath.test.js`): `seedEvenSplit` sums to `anchorAPI` exactly
  (last-month rounding absorption — assert explicitly); `balanceDelta` zero/positive/
  negative; `autoDistributeRemainder` rebalances to `Σ === anchorAPI` touching only
  future months; `monthEditable` past-locked/current+future-editable; `bucketActualsByMonth`
  buckets a known submission set into the right TT-months incl. a month-boundary week;
  `monthlyPace` expected-to-date proration + the three states at known day-of-month
  values + toFinish API/apps; `ytdDelta` over completed months only.
- **Emulator rules** (`tests/rules/monthlyPlan.rules.test.mjs`, mirror the yearPlan
  harness): owner create/get/list/update ALLOW; create with `status != 'draft'` DENY;
  non-owner get DENY; any manager get DENY; delete DENY.

## Phase 5 — docs (with placeholders)
- PR-table row (placeholder SHA).
- Cross-reference CD's annotation + the Year Plan briefs.
- Bank explicitly: panel + chart + readouts → Slice 2; StepRail/cascade wiring →
  Slice 3; stale-anchor re-sync → Slice 2; per-line monthly targets → deferred;
  the production write-read smoke (agent saves a monthlyPlan → reload → assert) → rides
  **Slice 2** (the first UI that writes the store).
- Note the three reconciliations applied (full-TTD not K; weekStarting-month bucketing;
  month proration new + bands reused) so the design reference and the build agree.
- CONTEXT.md: add the `monthlyPlan/{year}` store to the data-model section if it tracks
  subcollections; otherwise leave untouched (feature foundation, Rule 16(b)).

## Phase 6 — commit / push / PR
- Branch `feat/monthly-plan-foundation`.
- Conventional commit: `feat(monthly-plan): foundation — monthlyPlan store, service, rules, pace/actuals math`.
- Push; open PR; **Rule 21** Gemini poll + disposition; **Rule 20** report names the
  feature-branch HEAD SHA, no silent post-report pushes.

## Smoke
Headless — no prod UI writes `monthlyPlan` yet. Verification is the **emulator rules
tests** (authoritative for the rules) + the **service + math unit tests**. Deploy the
rules at merge (per Phase 3) — emulator-proven, zero prod exposure (no UI writes the
path until the gated panel). The first production write-read-verify smoke — agent saves
a `monthlyPlan` → reload → assert persisted — **rides Slice 2** (the first UI that can
create a plan). Reasoned waiver here, same posture as the Year Plan foundation.

## Merge posture
Headless backend + pure helpers + tests = **inert and reviewable**. No new visual
design. Auto-merge eligible under the standard gate, with the one operator action being
the **rules deploy at merge** (Phase 3) — so if this runs in an autonomous window,
auto-merge the PR but leave the `firebase deploy --only firestore:rules` for the
operator and call it out in the report. If attended, deploy right after merge.

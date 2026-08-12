# Flake race — Phase 0 measured results and comparison

**Companion to:** `docs/reviews/flake-race-phase0-classification.md` (the pre-registration,
committed at `551c0c58` **before** any burn on this branch).
**Branch:** `fix/flake-awaiting-pattern` off `origin/staging` `27303333`
**Instrument:** `scripts/flake/burn-isolated.ps1` (ported by #896; not modified here).
**Worktree rule honoured:** no checkout, rebase or branch switch occurred in the burn tree
between the pre-registration commit and the last burn.

**No test file is edited by this branch.** Phase 0 is report-and-stop.

---

## Table 2 — measured isolated burn rates

30 iterations each, serialized (never concurrent — `docs/FOLLOW_UPS.md` § Vitest on Windows),
`TZ=UTC`, one machine, nothing else running. `MeetingMode` was burned twice (30 + 60).

| File | Named members' class (Table 1) | Burn | Rate | Failure shape | Which test failed |
|---|---|---|---|---|---|
| `CompliancePanel.nudge.test.jsx` **(control)** | **PROXY ×2** | 0/30 | **0%** | — | — |
| `MeetingMode.test.jsx` | 2 DIRECT + 2 PROXY | 1/30 · 1/60 | **2/90 = 2.2%** | **timeout ×2** | `skip-logs the awards scene` (**DIRECT**) · `renders an in-reach award card` (PROXY-weak) |
| `AgentPlannerPanel.test.jsx` | PROXY (A2, A5) | 2/30 | **6.7%** | **notfound ×2** | `e on a focused SERIES card` (**PROXY**) ×2 |
| `AgentPlannerPanel.weeknav.test.jsx` | PROXY | 0/30 | 0% | — | — |
| `DailyCaptureV2.test.jsx` | 1 PROXY + 3 NEITHER | 0/30 | 0% | — | — |
| `WizardFormV2Characterization.test.jsx` | unclassified | 0/30 | 0% | — | — |
| `AgentAwardsPanel.test.jsx` | sweep/R4 | 0/30 | 0% | — | — |
| `BranchesPanel.test.jsx` | sweep | 0/30 | 0% | — | — |
| `AwardsRulesetPanel.test.jsx` | 50× burn only | 0/30 | 0% | — | — |
| `WizardFormV2RetirementR1.test.jsx` | 50× burn only | 0/30 | 0% | — | — |
| `WizardFormV2RetirementR2.test.jsx` | sweep | 0/30 | 0% | — | — |

Total: **390 iterations, 4 failures, across 11 files.**

### ⚠ Rate correction — 16.7% is superseded and must not be quoted

`MeetingMode` measured **2/90 (2.2%, Wilson 0.6–7.7%)** here against **5/30 (16.7%, Wilson
7.3–33.6%)** in #896 — same harness, same file, same machine class.

| | Pooled |
|---|---|
| point estimate | **7/120 = 5.8%** |
| Wilson 95% | **2.9 – 11.6%** |

**But the two windows are significantly inconsistent** — two-proportion `z = 2.92,
p = 0.0035` — so pooling them is a summary of two disagreeing samples, **not** an estimate
of a stable rate. The discrepancy is **unexplained**. Machine-load sensitivity is the
obvious candidate and fits a timing-window mechanism, but it has not been measured and is
recorded as provisional, not as the answer.

`docs/FOLLOW_UPS.md` line 32 and the § Flake register section both recorded 16.7% as *the*
baseline; both are corrected in this branch to show both windows, the pooled figure, and
the inconsistency.

**The mechanism does not depend on the rate**, which is exactly why there was no reason to
leave an inflated number standing — correcting it costs the finding nothing. And the rate
is no longer the instrument of record at all: see § THE ACCEPTANCE TEST IS THE TRACE.

---

## Comparison — does the classification predict the rate?

**No.** The evidence is presented below in descending order of weight, because an earlier
draft of this document led with the single observed DIRECT failure — an n=1 result that
cannot carry a falsification any more than the `5006…5027` cluster could carry a margin
argument. The strong claim does not rest on it, and should not be read as doing so.

### 1. DISPOSITIVE — the control, and it depends on no burn at all

`CompliancePanel.nudge.test.jsx` carries the PROXY shape **twice** (`:101` mock-call gate →
`:105` bare query on element B; `:113` gate → `:114` bare query on element B).

It carried those two shapes **during the 57% failure era** and it carries the same two
shapes **now, in the 0/200 and 0/30 fixed state**. Neither gate was touched by what fixed
it: #563 removed `userEvent.setup({ delay: null })`, a dispatch-scheduling change.

**The pattern was present in both the broken state and the fixed state, and the fix changed
neither instance of it.** A property that is identical either side of the repair cannot be
what the repair addressed. This is a historical fact about the one member of the family
with a proven fix and a documented baseline; it holds independently of anything measured on
this branch.

Per the brief's own standard — *"if your method gets the control wrong, the method is wrong
and nothing downstream of it counts"* — that settles it.

### 2. SUPPORTING — the base rate

**390 PROXY sites across 64 files** of 380 scanned, against **6 files ever observed
failing**. Two counts inside that make the point sharper than the totals do: the control
carries **6** PROXY sites and never fails; `MeetingMode`, the most active member on record,
carries **4**. Any dose-response reading of the classification is contradicted before a
single burn is run.

**A pattern every file shares and only some files fail on is a description, not a cause.**

### 3. CORROBORATING ONLY (n=1 — weak, and flagged as such)

`skip-logs the awards scene` (`MeetingMode.test.jsx:150`) is DIRECT — its `waitFor` gate
*is* its assertion, nothing is queried afterwards — and it failed at **5010ms**. Consistent
with legs 1 and 2, but **one observation**. It is not load-bearing and no conclusion here
rests on it.

### Pre-registered predictions, scored

| Prediction | Outcome | Weight |
|---|---|---|
| **P4** — the control checks the method | **METHOD FAILS THE CHECK** (leg 1) | **dispositive** |
| **P1** — PROXY files burn hot, DIRECT/NEITHER cold | **FALSIFIED.** Three of four PROXY-membered files burned 0/30 (control, weeknav, DailyCaptureV2); one burned hot | strong (n=11 files) |
| **P2** — PROXY fails fast, never by 5000ms timeout | **SPLIT.** True for `AgentPlannerPanel` (notfound ×2). False for `MeetingMode`, where the PROXY-classified `awards in-reach` test failed by **timeout at the DIRECT gate** (`:178`), never reaching its bare queries at `:179–181` | moderate |
| **P3** — DIRECT tests cannot fail by this mechanism | **FALSIFIED**, but on n=1 | weak — corroborating only |

### Where the hypothesis DOES hold — one site, and it is real

`AgentPlannerPanel.test.jsx:536` — `e on a focused SERIES card` — failed **2/30, both
element-not-found on `series-edit-choice`, fast**. That is the predicted PROXY signature
exactly, and it is the only reproduced member for which the brief's framing is the better
description of the observable.

---

## What the rates DO separate on

Both files that reproduced in isolation dispatch a **synchronous, document/window-level
keyboard event immediately after an async-load gate**. No file that burned cold does so in
its named failing test.

| File | Named test dispatches sync `fireEvent.keyDown(document\|window)` after load? | Burn |
|---|---|---|
| `MeetingMode.test.jsx` | **yes** — `:126`, `:143`, `:155`, `:177` | **HOT** |
| `AgentPlannerPanel.test.jsx` | **yes** — `pressKey` `:408-410`, `ctrlZ` `:57-59` | **HOT** |
| `AgentPlannerPanel.weeknav.test.jsx` | no — failing test uses `fireEvent.click` (`:123`) | cold |
| `DailyCaptureV2.test.jsx` | no — `fireEvent.click` only | cold |
| `CompliancePanel.nudge.test.jsx` | no — uses `userEvent` (async, act-wrapped) | cold |
| the other six | no | cold |

**Within `MeetingMode` the mapping is exact — 4 for 4, no false positives, no false
negatives.** The four tests that fire a transport `ArrowRight` after an async load
(`:124`, `:137`, `:150`, `:163`) are precisely the four named register members. The eight
that do not have never been named. The `Tab` focus-trap test (`:83`) is an in-file negative
control: it awaits the load *and* fires a keydown, but at `useFocusTrap`'s listener rather
than the transport listener, and it has never been a member.

### The mechanism, stated in one sentence

A synchronous `fireEvent.keyDown` dispatched at a document/window listener whose
subscription is torn down and re-created as async mock data lands can hit the **previous
commit's handler closure**, which then bails or clamps against stale bounds, so the state
transition the test is waiting for **never happens at all**.

Source, verified rather than inferred:

- **`MeetingMode.jsx:929-931`** — `go` is a `useCallback` over `[total]`:
  `setIndex((i) => Math.min(Math.max(i + dir, 0), Math.max(total - 1, 0)))`. The keydown
  listener at **`:936-949`** re-subscribes on `[go, total]`. Before `data` lands,
  `model` is `null` → `scenes = []` → **`total = 0`**, so that handler clamps the index to
  **0**.

  **Refinement — it advances SHORT, it does not fail to advance.** `setIndex` takes a
  **functional updater** (`(i) => …`), so `i` is always the current index: the *index* is
  never stale, only `total` is. A dispatch served by the stale handler computes
  `Math.min(i + 1, Math.max(0 - 1, 0))` = **0**, contributing nothing; dispatches served
  after the re-subscription advance normally. With `k` of the seven ArrowRights served by
  the stale handler, **the deck rests at `7 − k`**, not at 0 and not at 7. `That's the
  room` (index 7) therefore never renders and the `waitFor` at `:156` runs its full
  5000ms — **never, not late**, which is the signature the register has recorded four
  separate times.

  This is a **measurable** prediction rather than a story, and it is what the
  instrumentation below is built to test.
- **`AgentPlannerPanel.jsx:1330-1336`** — `document.addEventListener('keydown', onKeyDown)`
  with a **17-entry dependency array** (`sheet, churn, seriesChoice, … resolveAppt,
  moveCardFocus, changeView, isDesktop`). Same shape, far more re-subscription churn.

This is **not a new theory.** It is the mechanism #872 already diagnosed and fixed for the
sibling test, recorded verbatim in `docs/FOLLOW_UPS.md`: *"Against a not-yet-re-subscribed
(stale-closure) listener, `resolveAppt(id)` returns null and the handler bails silently.
Fix: `await userEvent.keyboard('e')` — async and act-wrapped, so pending passive effects
flush before dispatch… a determinism fix, not a longer wait."*

**The SERIES sibling never received that fix.** `pressKey` at `:408-410` is still a bare
synchronous `fireEvent.keyDown`, and `AgentPlannerPanel.test.jsx:546` still calls it. That
is a concrete, unfixed defect with a proven remedy — and it is the test that burned hot.

---

## Instrumentation — measuring the mechanism instead of asserting it

The section above is a story with a correlation behind it. This investigation exists
because five rounds shipped stories, so the mechanism is instrumented before it is
accepted.

**Neither the test nor the component is edited.** A setup file
(`scripts/flake/instrument-keydown-setup.js`) is appended to the normal setup chain by a
side config (`scripts/flake/vitest.instrumented.config.js`, not referenced by
`vite.config.js`, so CI never loads it). It wraps `addEventListener` and reads the DOM; it
changes no application state and is inert unless `FLAKE_INSTRUMENT` is set.

### How each quantity is observed

| Question | How |
|---|---|
| **Q1** — `total` at each handler invocation | Two independent readings that cross-check. **(a)** `MeetingMode.jsx:1006-1008` renders `{clampedIndex + 1} / {total}` into the header — a direct DOM readout of both numbers. **(b)** The transport listener lives on **`window`** (`:947`); `useFocusTrap` owns the `document` one. `model === null ⇔ scenes === [] ⇔ total === 0` (`:924-931`), and the effect re-subscribes on `[go, total]` (`:936-949`), so **window-generation 1 is exactly the `total === 0` handler**. |
| **Q2** — final `clampedIndex` at failure | The same header counter, sampled by a `MutationObserver` so the value survives RTL's auto-cleanup rather than depending on afterEach hook ordering. |
| **Q3** — which dispatch ordinal first saw a non-zero `total` | A capture-phase probe on `window`, registered through the *original* `addEventListener`, assigns each dispatch an ordinal before any component handler runs. Each dispatch records which window generation served it. |

Generations are counted **per target**. A first version used one global counter and was
unreadable — "gen 1" was the focus trap, not the transport handler. Corrected before any
reading was taken.

### It is proven to fire, and the healthy trace is the control

Run with `FLAKE_INSTRUMENT=all` on a **passing** `skip-logs the awards scene`:

```
keydown handler registrations: 3
  gen 1 on document registered after dispatch 0, counter=00/00
  gen 1 on window   registered after dispatch 0, counter=00/00      <- the stale handler EXISTS
  gen 2 on window   registered after dispatch 0, counter=01/08      <- re-subscribed after data
dispatches: 7   #1..#7 all servedBy=[gen1@document, gen2@window]
counterBefore: 01/08 02/08 03/08 04/08 05/08 06/08 07/08
Q1 total at each WINDOW-handler invocation: 8 ×7 (all win-gen2)
Q2 FINAL counter: 08/08
Q3 first dispatch served by a fresh transport handler: 1
dispatches served by the STALE transport handler (win-gen1, total===0): 0 of 7
```

Two things this establishes before any failure is examined: **the `total === 0` handler is
real and is registered on every mount**, and **in a healthy run every dispatch is served by
the fresh handler** and the counter advances monotonically to `08/08`.

### What the two accounts predict — designed to discriminate, not to confirm

| | STALE-TOTAL | CONTENT-NOT-LOADED |
|---|---|---|
| dispatches served by win-gen1 | **≥ 1** | 0 |
| final counter | **strictly between `01/08` and `08/08`** (`7 − k`) | **`08/08`** |
| Q3 first fresh-served dispatch | **> 1** | 1 |

These are mutually exclusive on every row, and they imply different fixes. A failing trace
reading `08/08` with zero stale-served dispatches **refutes** the mechanism proposed in
this document, and that outcome is reported as readily as the other.

**Status: running.** 260 instrumented iterations of `MeetingMode.test.jsx`; at the measured
2.2% that yields roughly 5–6 failing traces. Results and verdict are appended when it
completes.

### CROSS-FILE RESULT — `AgentPlannerPanel` instrumented, 10/150 (6.7%)

`FLAKE_PROBE_TESTID=series-edit-choice`, 150 instrumented iterations. Failures: `e on a
focused SERIES card` ×6, `undo after a bulk move` ×3, `pushes ONE undo entry` ×2.

**PROXY is refuted for the `e` SERIES site — decisively, in all six traces:**

```
#1 key=e  servedBy=[gen1@document]
PROBE testid "series-edit-choice" EVER rendered: NO
  document transport generations: serving=[1] totalRegistered=1
  generations registered AFTER a dispatch: 0
  PROBE-VERDICT: element NEVER rendered at all -> handler bailed (favours STALE-LISTENER)
```

Under PROXY the sheet commits on a later paint and "EVER rendered" is **YES** — the passing
run shows exactly that. It is **NO** in every failing trace. The element does not arrive
late; **it never arrives**. So the brief's prescribed fix (`await findByTestId`) would
convert a fast element-not-found into a 5000ms timeout and still fail. That was the
predicted discriminator and it resolved against PROXY.

#### ⚠ REFINEMENT — this is NOT the same signature as `MeetingMode`, and the difference is real

| | `MeetingMode` | `AgentPlannerPanel` |
|---|---|---|
| generations at teardown | 2+ (gen1 **superseded** by gen2) | **1** in failing runs (4 in passing runs) |
| registered after a dispatch | yes | **0** |
| signature | stale closure **refreshed too late** | stale closure **never refreshed at all** |

Both are the same disease — the live handler closure disagrees with the committed render —
but they are not the same presentation, and claiming "same mechanism" would overstate it.
In failing `AgentPlannerPanel` runs the keydown effect ran **once** and never re-ran, so
`resolveAppt` never saw the appointment data and the handler bailed. In passing runs it ran
four times. **The fix is still the dispatch fix** (`await userEvent.keyboard` flushes the
pending effect before dispatching, which is what produces the later generations), but the
mechanism is stated here as *related*, not identical.

#### Two instrument caveats, recorded rather than smoothed over

1. **The `VERDICT-INPUT` line is meaningless for this file and must be ignored here.** It
   reads "no counter rendered -> component never left the load gate", but `AgentPlannerPanel`
   renders no `NN / MM` counter at all — that readout is `MeetingMode`-specific. It is a
   false signal from a MeetingMode-shaped instrument, not evidence.
2. **The `ctrlZ` double-serving was an INSTRUMENT BUG, now diagnosed and fixed.** The
   `ctrlZ` traces showed one dispatch served by two generations
   (`servedBy=[gen7@document, gen8@document]`). I flagged it as "either a real listener leak
   or an instrument defect". **CodeRabbit independently identified the cause on PR #898:**
   `wrappedFor` keyed one wrapper per function reference, so registering the *same* function
   twice on a target left the older wrapper attached — it kept recording `invoke` rows under
   its stale generation. Fixed to a FIFO queue per reference.

   CodeRabbit's warning was that this "inflates the exact counts the Phase 0 conclusion
   rests on — verify it before the traces are used as evidence." **Verified rather than
   argued:**

   | Trace set | dispatch rows | rows with >1 handler on the transport target |
   |---|---|---|
   | `MeetingMode` (all 33 traces) | **199** | **0** |
   | `AgentPlannerPanel` `e` SERIES (6 traces) | 6 | 0 (`serving=[1] totalRegistered=1`) |

   **Neither load-bearing conclusion is affected.** The leak manifested only in the `ctrlZ`
   traces, where React reuses a stable handler reference across registrations. So the
   observation is real but it is a property of the *instrument*, not a product listener
   leak — and the two `undo` members remain uncharacterised, now for want of a clean
   measurement rather than because of a suspected product defect.

### The second, independent discriminator (cross-file, `AgentPlannerPanel`)

`AgentPlannerPanel.test.jsx:536` burned **2/30**, and the two accounts predict opposite
outcomes for the same one-line mutation:

- **If PROXY** (element commits on a later paint), replacing the bare
  `getByTestId('series-edit-choice')` at `:547` with `await screen.findByTestId(...)` fixes
  it.
- **If the stale listener** (the handler bailed, so the sheet will *never* render), that
  same change converts a fast element-not-found into a **5000ms timeout** and still fails —
  while switching `pressKey('e')` to `await userEvent.keyboard('e')` fixes it.

Note that the observed shape so far — fast element-not-found — is predicted by **both**
accounts, so this leg currently establishes correlation, not mechanism. The mutation is
what separates them. The register's own history favours the second: #872's fix was the
dispatch change, and the FU records that it is what makes the neighbouring `Enter` test
immune.

---

## Instrument correction (CodeRabbit, post-burn — figures re-verified)

CodeRabbit raised two valid defects in `scripts/flake/classify-await-shapes.mjs`, both
fixed on this branch:

1. **Shell interpolation** — pathspecs from `argv` were interpolated into an `execSync`
   string. Replaced with `execFileSync('git', ['ls-files', '--', ...pathspecs])`.
2. **Single-line classification of multiline gates** — a multiline
   `await screen.findByRole(\n …\n)` had its arguments truncated, producing an empty
   gate target so that a *same-element* follow-up could misreport as PROXY. The classifier
   now builds the complete balanced statement first, and only accepts a gate whose match
   begins on the line being classified.

The second could have **inflated the PROXY count**, which is the figure §3 of the
pre-registration rests on, so it was re-run rather than reasoned about:

| | before fix | after fix |
|---|---|---|
| gate sites | 1179 | 1180 |
| **PROXY** | **390** | **390 — unchanged** |
| DIRECT | 178 | 179 |
| NEITHER | 611 | 611 |
| `CompliancePanel.nudge` (control) | 6 | **6 — unchanged** |
| `MeetingMode` | 4 | **4 — unchanged** |

One multiline `expect(await findBy…)` is now correctly counted DIRECT. **No conclusion in
this document depends on the difference**, and the two counts that carry the argument are
identical either way. The pre-registration is deliberately **not** edited — it records what
was committed before the burn, and amending its quoted output would falsify that audit
trail. These are the corrected figures.

---

## Limits of these results (Rule 23 falsification, stated before banking)

1. **A 0/30 isolated burn does not clear a file.** The harness's own header says so. Most
   of this family fails only under full-suite contention; `DailyCaptureV2`'s stepper member
   and the weeknav member are **CI-only** observations and could not have reproduced here.
   The nine cold files are cold *in isolation*, nothing more.
2. **n is small where it matters most.** Four failures total. `MeetingMode` at 2/90 has a
   95% interval of roughly 0.3–7.8%; the file-level comparison rests on that.
3. **The listener diagnosis is not mutation-verified.** Phase 0 forbids editing a test, so
   the causal claim rests on source reading plus the exact 4-for-4 in-file mapping and
   #872's prior fix of the identical shape — not on a red-to-green demonstration. The
   experiment above is what would settle it.
4. **What would overturn it:** the `findByTestId` mutation fixing `e on a focused SERIES
   card`; or any isolation-reproducible member that dispatches no synchronous
   document-level event; or `MeetingMode` continuing to fail after `userEvent.keyboard`
   replaces its `fireEvent.keyDown` loops.
5. **The 29 Jul step change remains unexplained.** Nothing measured here bears on it, and
   it should not be quietly attributed to this mechanism.

---

---

## Why `k = 1` every time — the act-boundary model, and its one falsified corollary

**`k = 1` in 33 of 33 traces, with zero variance.** That is too uniform for a stochastic
race and the uniformity itself is informative.

The seven dispatches are synchronous, so no effect can flush *between* them on their own.
But RTL wraps each `fireEvent` in `act()`, and **`act()` flushes pending passive effects on
exit**. The stale window is therefore closed by the act boundary around **dispatch #1**,
always and only there.

**The model is binary, not graded: `k ∈ {0, 1}`, necessarily. There is no mechanism that
yields `k = 2`.**

### This replaces the falsifier

**Old:** "a failure at `target` with zero stale-served is a second mechanism."
**New and stricter: `k ≥ 2` breaks this mechanism outright.**

The existing 33 traces already satisfy it without having been designed to — `k = 1`
throughout, `k = 2` never observed. The falsifier is cheap to re-check on every future run
and is now the primary one.

### The free prediction — tested, and it does NOT hold

If every test fails **iff** dispatch #1 is stale, then dispatches 2–7 add nothing to the
failure probability and all four tests should fail at approximately the same rate — the
one-dispatch `ArrowRight advances` no rarer than the seven-dispatch `skip-logs`.

Computed from the 33 traces over 260 iterations (each iteration runs all four tests):

| Test | dispatches | fails / 260 | rate | Wilson 95% |
|---|---|---|---|---|
| `skip-logs the awards scene` | 7 | 17 | **6.5%** | 4.1 – 10.2 |
| `awards in-reach card` | 7 | 8 | **3.1%** | 1.6 – 6.0 |
| `agenda rail` | 5 | 4 | **1.5%** | 0.6 – 3.9 |
| `ArrowRight advances` | 1 | 4 | **1.5%** | 0.6 – 3.9 |

**χ² = 13.67 (df = 3), against 7.81 at p = .05 and 11.34 at p = .01. The equal-rate
prediction is falsified at p < 0.01.** Extreme pair `skip-logs` vs `ArrowRight`: z = 2.90.

**Reported rather than filed away, as instructed — and the failure is not in the direction
anticipated.** The concern was that the one-dispatch test would be diluted and come out
materially rarer. It did not: `ArrowRight` (1 dispatch) and `agenda rail` (5 dispatches) are
**identical at 4/260**. Nor does rate scale with dispatch count — `skip-logs` and
`awards in-reach` both fire seven dispatches and differ two-fold (6.5% vs 3.1%).

**What survives and what does not, stated separately:**

- **The binary claim `k ∈ {0, 1}` is CONFIRMED** — 33/33, `k = 2` never seen. The act
  boundary closing the window at dispatch #1 is consistent with every trace.
- **The equal-rate COROLLARY is FALSIFIED.** It carries an extra assumption the mechanism
  does not require: that `P(stale at dispatch #1)` is the *same* for every test. It is not.

The corollary needs the stale window to have a test-independent width. The observed
spread says window width is **context-sensitive** — and the candidates are all mundane and
none are measured: the four tests mount under different accumulated process conditions (JIT
warmth, GC pressure, the preceding test's teardown), `skip-logs` runs immediately after the
heaviest test in the file, and `awards in-reach` sits in a separate `describe` with
different mocks and a nine-scene deck rather than eight.

**This is offered as an observation with an unexplained cause, not a repaired model.**
Notably it points the same way as the load hypothesis below: if window width varies with
context, per-test variation is a fourth data point for it rather than a contradiction.

---

## THE ACCEPTANCE TEST IS THE TRACE, NOT THE RATE

This is the most consequential consequence of the instrumentation and it changes how the
fix must be proven.

At a pooled ~5.8% (Wilson ≈ 2.9–11.6%), demonstrating a fix by rate needs many hundreds of
iterations and still only ever yields *"no red in N attempts"* — an argument from absence,
which is precisely the currency the last five rounds traded in. **That is no longer
necessary.** The mechanism is now observable on every single iteration, pass or fail, so
the post-fix claim is **deterministic**:

> **Every dispatch is served by the fresh generation · zero stale-served dispatches ·
> final counter reaches the target (`08/08` for `skip-logs`).**

Run over a modest N with `FLAKE_INSTRUMENT=all` and report the traces.

**The strictest clause, and the one that must not be softened: if even ONE iteration shows
a stale-served dispatch, the fix is incomplete — regardless of whether the assertion
passed.** A green assertion with `stale-served: 1` means the race still fires and something
downstream happened to recover it; that is a masked failure, not a fixed one, and it is
exactly the kind of result that let #872's remedy be recorded as closed while the race
survived underneath it.

### Does the instrument perturb the rate? Yes — and usefully

| Run | Iterations | Failures | Rate |
|---|---|---|---|
| Uninstrumented (`staging` `2ef1abc5`, #896) | 30 | 5 | 16.7% |
| Uninstrumented (this branch) | 90 | 2 | 2.2% |
| **Instrumented (this branch)** | **see final table below** | | **≈ 14%** |

The instrumented rate sits well above the uninstrumented pooled figure. **This is
amplification, not contamination**, and the traces are the evidence: every instrumented
failure shows the *same* signature as the uninstrumented ones — same four tests, same
timeout shape, same `k = 1` stale-served dispatch, same `final = target − k`. The mechanism
is unchanged; only its frequency moved.

### ⚑ THE WINDOW-WIDTH HYPOTHESIS — one mechanism behind four unexplained numbers

**Stated as a hypothesis, not as established. No burn was spent on it and none should be
yet.**

The stale window is the gap between the render commit that sets `total = 8` and the
passive-effect flush that re-subscribes the listener. **If that gap widens under load, one
mechanism accounts for four separate numbers this investigation has been unable to
reconcile:**

| Observation | Gap | Comparison |
|---|---|---|
| Instrument amplification | 2.2% → ≈12.3% | same branch, same machine, instrumented vs not |
| The 5/30 vs 2/90 discrepancy (z = 2.92, p = 0.0035) | 16.7% → 2.2% | **both uninstrumented**, different machine load |
| CI vs local | ≈30–45% → 2–6% | different runner, heavier contention |
| Per-test spread (χ² = 13.67, p < .01) | 6.5% → 1.5% | same run, different accumulated process state |

Four amplifiers, one window. Each is otherwise an isolated anomaly; together they are what
a load-sensitive timing gap would look like.

**It also retro-explains the register's oldest confusion.** Four rounds attributed the
family to "contention" and were declared wrong by the isolation result — but under this
hypothesis both readings are partly right: contention does not *cause* the race, it
**widens the window**, which is exactly the "load modulates an intrinsic race rather than
causing it" shape the brief offered and could not then support.

**Falsification:** measure the same file instrumented and uninstrumented under deliberately
varied machine load. If the instrumented/uninstrumented ratio is constant across load
levels, window width is not what load is changing and this is wrong. **Not now** — it costs
burns and changes no Phase 1 decision.

**The opportunity amplification creates:** an instrument that raises the hit rate while
preserving the trace is a *better* acceptance test than the bare harness, because it
reaches the failure mode faster. Phase 1 should verify the fix under instrumentation, where
the race is easiest to hit, rather than under the quiet conditions where it is hardest.

---

## ONE proven mechanism, and a set of unreproduced observations — NOT two confirmed families

An earlier draft of this document claimed the register was "at least two families". **That
claim is downgraded here**, because only one family has been reproduced and instrumented,
and the evidence for the second is weaker than the phrasing implied.

| Family | Members | Shape | Status |
|---|---|---|---|
| **B — synchronous keyboard dispatch at a re-subscribing listener** | `MeetingMode` ×4 (proven); `AgentPlannerPanel` A2 `e` SERIES (correlated, instrumentation pending) | **timeout**, 5006–5027ms | **PROVEN for `MeetingMode`** — directly observed per-iteration, both competing accounts refuted by the same trace. The awaited element never arrives regardless of how it is awaited, so the awaiting-pattern hypothesis does not apply and no gate change can help. |
| **A — bare query after a gate on a different element** | `DailyCaptureV2 > stepper "+"` (`:189`) | fast element-not-found, **167 / 181ms** | **⚠ OBSERVED, NOT CONFIRMED — downgraded.** `DailyCaptureV2` burned **0/30**: those failures are **CI history, not local reproduction**. This family therefore has **no path to mutation verification by the method built here**, because there is nothing locally to mutate against. It remains a real observed failure of a genuinely different shape; it is **not** a confirmed second mechanism. The structural reading (`dcv2-save` at `:191` and the stepper rows load on separate async paths) is still plausible and still unverified. |
| **C — unresolved** | `weeknav` navigation (`:117`), `DailyCaptureV2` streak / `aggregate-on-save` | timeout, CI-only | **UNTESTED.** None reproduced in isolation. Do not assume family B covers them. |

**The honest summary is one mechanism proven and a residue of unreproduced observations**,
not a tidy taxonomy. Family A's language is deliberately weakened: a different *shape* of
failure is not the same as a different *mechanism* demonstrated.

### ⚠ The nine 0/30 files are NOT clean

**Wilson 95% upper bound on 0/30 is ≈ 11%.** Every one of those files could be failing at
up to roughly one run in nine and this burn would look exactly as it does.

They are recorded as **"no local reproduction at n=30"** and must never be described as
fixed, clean, unaffected, or cleared. The burn harness's own header makes the same point.
This matters directly for scope: **no fix is proposed for any of them**, because there
would be nothing to verify it against.

---

## Recommendation

**Do not apply the brief's mechanical fix across the register.** Rewriting proxy gates to
direct gates everywhere would be the sixth round: it would touch ~390 sites to address a
shape the control disproves, and against family B it changes nothing.

### Scope: the fix is the TEST, not the component

1. **The test-side fix is already proven.** #872 took a sibling test to green with
   `await userEvent.keyboard('e')`, which is act-wrapped and flushes pending passive
   effects before dispatch. This is applying a demonstrated remedy to the members it
   missed, not trying a sixth new idea.
2. **Changing both at once destroys the attribution.** The production change alters runtime
   behaviour on a manager-facing screen and needs its own slice with its own smoke. If both
   land together and the rate goes to zero, nobody can say which did it — precisely the
   error that produced #563's confounded `delay: null` + `CHIP_WAIT` bundle, which this
   investigation then spent two sessions untangling.

### ⚠ THE CAVEAT — the test fix MASKS this race, it does not remove it

Stated plainly because it is the part most likely to be lost: **a component whose keyboard
handler behaves differently depending on whether a passive effect has flushed is defective
independently of any test.** `MeetingMode.jsx:929-931` clamps against a `total` that is `0`
until data lands, so a real user pressing ArrowRight during load has the keypress silently
swallowed. No test is involved in that.

Switching the tests to `userEvent.keyboard` removes **the only thing currently detecting
it**. The follow-up therefore records the diagnosis, the `file:line`, and this obligation:
**the slice that owns the component fix must add a DELIBERATE regression test for the
stale-`total` window** — one that dispatches during the load gap on purpose — otherwise the
race persists with its detector deleted.

### Order of work

1. **Complete the instrumentation run** (in flight) and report the verdict. No test edit
   until it reports and the dispatcher rules.
2. **Run the two-way mutation experiment** on `AgentPlannerPanel.test.jsx:536` — one test,
   200 iterations per arm, ~30 min. It discriminates the accounts outright.
3. **If family B survives**, fix at the dispatch site only (`MeetingMode`'s six
   `fireEvent.keyDown` sites; the `pressKey` `:408-410` and `ctrlZ` `:57-59` helpers) and
   burn at **200+** iterations — the 2.2% rate makes 30 uninformative.
4. **Bank the component defect as its own follow-up**, with the masking caveat and the
   regression-test obligation above.
5. **Strike the dead register entries** — see below.

### Register entries to strike

- **`DailyEntryModal.test.jsx` — DELETED 2026-07-08 in `214ea26c`** ("tier-0.6 delete
  unwired onboarding steps + DailyEntryModal ruling"). It is named as a live member by both
  `28968bbf` and the #543 50× burn and is still carried in `docs/FOLLOW_UPS.md`. **The file
  does not exist.** Strike it with the reason, so nobody hunts it again.
- **The eleven sweep-only files** that enter the register solely via `28968bbf` and have
  never been observed failing. All burned 0/30 here.

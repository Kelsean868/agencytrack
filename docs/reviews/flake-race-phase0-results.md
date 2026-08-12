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

### A rate correction that matters

`MeetingMode` measured **2/90 (2.2%)** here against **5/30 (16.7%)** in #896, same harness,
same file, different machine load. These are not reconcilable as one rate. The 16.7% figure
should be treated as a wide-interval point estimate, not a baseline — and any future
"we fixed it, it burns clean now" claim needs to clear 2.2%, not 16.7%, which requires far
more iterations than 30. Recorded so the next round does not repeat the small-n error the
register has already made twice.

---

## Comparison — does the classification predict the rate?

**No.** The brief asked for exactly this check, and the answer is clean.

| Prediction (pre-registered) | Outcome |
|---|---|
| **P1** — PROXY files burn hot, DIRECT/NEITHER cold | **FALSIFIED.** Of four files whose named members are PROXY, three burned 0/30 (control, weeknav, DailyCaptureV2) and one burned hot. PROXY does not separate. |
| **P2** — PROXY fails fast (element-not-found), never by 5000ms timeout | **SPLIT.** True for `AgentPlannerPanel` (notfound ×2). False for `MeetingMode`, where the PROXY-classified `awards in-reach` test failed by **timeout at the DIRECT gate** (`:178`), never reaching its bare queries at `:179–181`. |
| **P3** — DIRECT tests cannot fail by this mechanism | **FALSIFIED.** `skip-logs the awards scene` (`MeetingMode.test.jsx:150`) is DIRECT — its `waitFor` gate *is* its assertion, nothing is queried afterwards — and it failed at **5010ms**. |
| **P4** — the control's behaviour checks the method | **METHOD FAILS THE CHECK.** The control is PROXY twice over (`:101` mock gate → `:105` bare query on B; `:113` → `:114`) and burns **0/30**. Both shapes were present during its 57% failure era and are unchanged today; what fixed it was #563 removing `delay: null`, which touched neither gate. |

Per the brief's own standard — *"if your method gets the control wrong, the method is wrong
and nothing downstream of it counts"* — the awaiting-pattern classification is not the
mechanism. **A pattern every file shares and only some files fail on is a description, not
a cause**, and at **390 PROXY sites across 64 files** against 6 files ever observed failing,
that is what this is.

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
  **0** on every ArrowRight. Seven rapid ArrowRights against it leave the deck on the
  opening scene, and `That's the room` (index 7) never renders → the `waitFor` at `:156`
  runs its full 5000ms. **Never, not late** — the signature the register has recorded four
  separate times.
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

### The discriminating experiment (Phase 1, not run here)

The two accounts predict opposite results, which makes this cheap and decisive:

- **If the defect is PROXY** (element commits on a later paint), replacing the bare
  `getByTestId('series-edit-choice')` at `:547` with `await screen.findByTestId(...)` fixes
  it.
- **If the defect is the stale listener** (handler bailed, so the sheet will *never*
  render), that same change converts a fast element-not-found into a **5000ms timeout** and
  still fails — while switching `pressKey('e')` to `await userEvent.keyboard('e')` fixes it.

Run both mutations against a 200-iteration burn of that one test. The register's own
history already favours the second: #872's fix was the dispatch change, and the FU records
that it is what makes the neighbouring `Enter` test immune.

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

## Recommendation

**Do not apply the brief's mechanical fix.** Rewriting proxy gates to direct gates across
the register would be the sixth round, it would touch ~390 sites to address a shape the
control disproves, and on the one member where the timeout mechanism operates it would
change nothing — the element never arrives regardless of how it is awaited.

Recommended next slice, in order:

1. **Run the two-way mutation experiment above** on `AgentPlannerPanel.test.jsx:536`. One
   test, 200 iterations each arm, ~30 minutes. It discriminates the two accounts outright.
2. **If the listener account survives**, fix at the dispatch site — replace synchronous
   `fireEvent.keyDown(document, …)` with `await userEvent.keyboard(…)` in the six
   `MeetingMode` sites and the `pressKey`/`ctrlZ` helpers — and burn `MeetingMode` at 200
   iterations, which the 2.2% rate requires. This is #872's proven remedy applied to the
   members it missed, not a new approach.
3. **Consider the component fix separately.** `MeetingMode.jsx:929-931` clamping against a
   `total` of 0 is arguably a real product bug: a fast user pressing ArrowRight during load
   gets a silently-swallowed keypress. That is a production change and belongs in its own
   PR with its own review, not smuggled into a test-infra slice.
4. **Strike the dead register entries** — `DailyEntryModal.test.jsx` (deleted in
   `214ea26c`) and the eleven sweep-only files that have never been observed failing.

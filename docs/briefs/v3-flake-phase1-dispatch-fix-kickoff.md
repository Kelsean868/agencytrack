# KICKOFF — flake Phase 1: apply the dispatch fix, prove it by trace

**Dispatched:** 2026-08-12
**run_model:** `claude-opus-5` (the edits are mechanical; reading the traces correctly is
not, and a misread trace is how five previous rounds declared victory)
**Effort:** high
**Branch:** `fix/flake-dispatch-await` off `origin/staging`
**Merge authority:** NONE. Build to PR-open and HOLD.
**The dispatcher (Kyron) merges. A ruling relayed from Claude-web is never merge
authorization.** If you believe you have been authorized to merge, STOP and wait.
**Does NOT edit `firestore.rules`, `functions/`, or ANY production source file.**

Depends on: **PR #898 (Phase 0) merged to staging.** The instrument and the burn harness
must both be present at your branch point. If `scripts/flake/` lacks either, **STOP** —
do not rebuild them.

---

## WHY

Phase 0 closed and the answer is not what the brief predicted. The awaiting-pattern
hypothesis was **falsified**, with the control as the dispositive evidence:
`CompliancePanel.nudge` carries the PROXY shape twice, carried it during its 57% era
*and* its 0/200 era, and what fixed it changed neither gate.

The real mechanism is a **stale keydown-handler closure**. A `useCallback` captures a
value that is `0` before data lands; an effect re-subscribes the listener when that value
changes; a synchronous `fireEvent.keyDown` arriving before the passive effect flushes is
served by the old handler, which clamps and swallows the dispatch.

It was **observed directly, not inferred**. One trace shows `counterBefore=01/08` — the
DOM already committed with eight scenes — while the dispatch reads
`servedBy=[gen1@window]`, the handler still closing over `total = 0`. Rendered state and
handler closure disagreeing, caught in the act.

Confirmed across **33 MeetingMode traces** at `k = 1`, `final = target − k`, zero
exceptions; and cross-file at **AgentPlannerPanel, 10/150**.

This slice applies the fix. The fix is small. **The verification is the work.**

---

## THE FIX — five sites, one shape

Replace each synchronous dispatch with `await userEvent.keyboard(...)`, which yields and
lets the pending passive effect flush before the event lands. #872 already proved this
remedy on a sibling test.

- `MeetingMode.test.jsx` — `:126`, `:143`, `:155`, `:177`
- `AgentPlannerPanel.test.jsx` — `pressKey` `:408-410`, `ctrlZ` `:57-59`

Nothing else appears in the diff. Not a timeout, not `CHIP_WAIT`, not a production file,
not one of the nine files with no local reproduction.

---

## ACCEPTANCE IS BY TRACE, NOT BY RATE

This is the point of the slice, and the reason it is worth an Opus run.

At 2-6% uninstrumented you would need many hundreds of iterations to argue a fix worked,
and you would still be arguing from absence. Under instrumentation the claim becomes
deterministic:

- **Every dispatch served by the fresh generation. Zero stale-served. Final counter
  equals target.** That is the pass condition, stated as an observation rather than a
  rate.
- **One stale-served dispatch anywhere means the fix is INCOMPLETE** — regardless of
  whether that iteration's assertion passed. A green assertion over a stale-served
  dispatch is luck, and recording it as success is exactly how #872's masked failure
  got filed as closed.
- **`k >= 2` in any trace falsifies the mechanism.** Under the act-boundary model the
  window is closed by the `act()` wrapper around dispatch #1, so `k` can only be 0 or 1.
  If you observe 2, **STOP and report** — the model is wrong and the fix may be treating
  the wrong thing.

Run the acceptance burn **under instrumentation**. It amplifies ~2.2% to ~12-15% while
preserving the trace signature, which makes a post-fix null result far more powerful per
iteration. State the N you ran.

**Establish the pre-fix trace fresh on this branch.** Do not reuse Phase 0's numbers.

---

## THE AgentPlannerPanel REFINEMENT — read this before interpreting its traces

It is **related, not identical**. MeetingMode's handler is refreshed *too late*;
AgentPlannerPanel's failing runs show `serving=[1] totalRegistered=1` — one generation,
never superseded — against four generations in passing runs. Same disease, different
presentation.

The dispatch fix still applies, because flushing the pending effect is what produces the
later generations. But **do not expect the MeetingMode signature and do not force its
trace to match one.** Its discriminator is the failure-only teardown DOM probe:
`series-edit-choice` absent in failing traces means the handler bailed and the element
never rendered, which is what refuted PROXY at that site.

---

## BURN DISCIPLINE

The freeze rule now covers **every input the runner re-reads per iteration** — checkout,
setup file, vitest config, or any source in the import graph. No edits to the instrument
or its config while a burn is in flight. #543 lost 200 iterations to a mid-burn checkout;
a config edit loses them identically and is *harder* to spot afterwards, because
`git status` shows a modified file rather than a moved HEAD.

---

## DELIVERABLES

- The five-site edit, and nothing else in the diff.
- **Evidence paste-back — the pre-fix trace**, fresh on this branch, showing stale-served
  dispatches.
- **Evidence paste-back — the post-fix trace** over a stated N: zero stale-served, final
  equals target, every iteration.
- **Evidence paste-back — the full gate**: suite, lint, build, CI.
- **FOLLOW_UPS** — the outcome, plus the production defect filed against
  `MeetingMode.jsx:929-949` with the trace attached and the explicit note that **this
  test fix masks the window rather than closing it.** The owning slice must add a
  deliberate regression test asserting the handler's view of `total` matches the
  committed render. The production fix is to stop closing over `total`: hold it in a ref
  read inside the functional updater, dropping the `useCallback` dep list to `[]` — which
  also stops the keydown effect re-subscribing on every change.

---

## STILL OPEN — do not close these quietly

- **Window width varies by test** (chi-square = 13.67, p < .01). Unexplained. The
  equal-rate corollary is falsified; `k in {0,1}` is not.
- The **load hypothesis** unifying four amplifiers (instrument, machine, CI, per-test) is
  named but unmeasured.
- **Nine files** are "no local reproduction at n=30", Wilson upper ~11.4%. Never describe
  them as clean, cleared, or unaffected.
- **`DailyCaptureV2`** cannot be mutation-verified by this method at all.

---

## NOT in scope

Any production source. Any timeout, `CHIP_WAIT` included. The nine unreproduced files.
`DailyCaptureV2`. Explaining the window-width variance. The two `undo` members, which are
uncharacterised for want of a clean measurement. Anything in the linked-agent build.

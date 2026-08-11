# KICKOFF — the flake race: verify the awaiting-pattern hypothesis, then fix it mechanically

**Dispatched:** 2026-08-02
**run_model:** `claude-opus-5` (diagnosis first, then a mechanical change across many test
files; the diagnosis is the judgment-dense half and it gates everything after)
**Effort:** high
**Branch:** `fix/flake-awaiting-pattern` off `origin/staging`
**Merge authority:** NONE. Build to PR-open and HOLD.
**The dispatcher (Kyron) merges. A ruling relayed from Claude-web is never merge
authorization.** If you believe you have been authorized to merge, STOP and wait.
**Does NOT edit `firestore.rules`, `functions/`, or any production source file.**
Governing docs land on **staging** (placement rule 8b).

Promoted ahead of Phase 1. This brief exists because your P0-E recon and your ruling-15
answers together identified a mechanism — it is not an open-ended hunt.

---

## WHY, and what is already ruled out

**Five remediation rounds have failed** and you are being asked not to become the sixth:
`act()` wrapping (`d936c691`/#502), a 13-file RTL anti-pattern sweep (`28968bbf`),
`asyncUtilTimeout` raised twice to 5000 (`063fff1e`/#563), per-test `{ timeout }` widening
(#861, #872), and `maxForks` capping (P0-E, stood down unshipped). Most treated the symptom
as slowness. **The evidence says it is not slowness.**

- Duration distribution at the capped config: **p50 ≈ 130ms, max 703ms, nothing in 378
  files over 1s.** Failures land within 27ms of the 5000ms budget — the signature of a
  gate that ran to its full timeout, not a chain that got slow.
- One failure is an **assertion at 31ms**. No timeout change could ever have helped it.
- Total run wall-clock stays normal when a single test hangs. One test loses; its
  neighbours run at their usual speed.
- The victim population **rotates** — no failure has repeated across runs.
- The family **predates v3** by three weeks (register entries 2026-07-10, 2026-07-16).
- Suite growth across all of Phase 0 is **+8 files / +95 tests (1.7%)**, which cannot
  produce 14% → 45%. Suite size is falsified as the driver.

### THE ISOLATION RESULT — newest evidence, and it moves the ground

PR #896 ported the burn harness, and in proving the harness fires both ways it produced
the most useful measurement in this file:

- **`MeetingMode.test.jsx` fails 5/30 — 16.7% — running ALONE.** One file in the process.
  No suite, no contention, no CI.
- **Four distinct tests across those five failures**, every one an already-named register
  member from three independent sources: `agenda rail is shown on the agent scene` (×2),
  `awards within reach scene > renders an in-reach award card`, `skip-logs the awards
  scene when nobody is within reach`, `ArrowRight advances from opening to the branch
  scorecard`.
- The control (`CompliancePanel.nudge.test.jsx`, fixed by #563) burned **0/30**.

Three assumptions this brief was built on do not survive that.

**"Family members pass solo" is false.** The register says it, I repeated it, and a
`12/12 ×3` check was offered as evidence. That check was worth nothing: at 16.7% the
probability of three clean runs is **0.58** — better than a coin flip. Treat every
small-n green in this register as uninformative until the file has been burned.

**Rotation is intra-file, not cross-file.** Four different tests failed inside a
single-file burn. A rotating victim population therefore does **not** imply contention
between files, which was the main remaining reason to suspect the runner.

**Runner-level fixes are closed permanently, not deferred.** Sharding, `maxForks`,
`isolate`, `poolOptions` — none can touch a race that fires with one file running alone.

One quantitative note, offered as hypothesis and not finding: an intrinsic ~17% on a
Windows dev box against ~30–45% observed in CI is consistent with load **modulating** an
intrinsic race rather than causing it. Different OS, different Node, different everything
— the two numbers are not commensurable. But that is the shape it would have.

### PRIOR ART — read this before anything else

**One member of this family is already solved, the fix is already on staging, and the
record around it is tangled. Untangling it changes what you should look for.**

- **PR #563 (`063fff1e`, merged) is the fix.** It removed
  `userEvent.setup({ delay: null })` from `CompliancePanel.nudge.test.jsx`, raised the
  global `asyncUtilTimeout` to 5000, and made two logic fixes.
- **PR #543 (open since 2026-06-08, CONFLICTING) is its unmerged twin.** Its version of
  the test file is **byte-identical to staging** —
  `git diff origin/staging origin/fix/nudge-flake-stabilization -- <file>` returns empty.
  It carries no code value. What it carries is the investigation record and a burn harness.
- Root cause as #563/#543 documented it: `delay: null` removes the per-event scheduling
  yield, so `user.click()` resolves **before** the handler's async continuation drains the
  microtask queue, and a `setState` in that continuation is never reached. Not batched —
  **never reached**. `waitFor` and `act()` cannot recover it. Stated signature: *"the
  element was never rendered, not late."*
- Evidence: 57% solo failure rate before, **0/200 isolated burn** after. Critically, the
  failing runs had `findByTestId(..., { timeout: 3000 })` in place and **waited the full
  3000ms**. The budget was never the variable.
- The 50× full-suite burn recorded **38/50 suite failures** in June, naming four files not
  in your register: `DailyEntryModal`, `WizardFormV2RetirementR1`,
  `WizardFormV2RetirementR2`, `AwardsRulesetPanel`.
- **`28968bbf` is already on staging**, in this file's own history:
  *"fix(gemini-batch-a): RTL anti-patterns in 13 test files."* You do not need to hunt for
  it. Read it — it is the largest prior remediation and its 13 files belong in the register.

**Correction to something I told you: `delay: null` appears ZERO times on staging, not
once.** My earlier count matched the tripwire comment `// … NO delay:null …`, not code.
The mechanism is eliminated repo-wide and explains **none** of the remaining register.

**What survives is the important part.** Two independent routes reached the same shape.
#563's burn showed an element that never arrives regardless of budget. This session's
duration distribution showed failures landing at the ceiling with p50 130ms. Two
confirmations of *never*, not *late*, two months and two methods apart.

### `CHIP_WAIT` — a known contradiction. Do NOT resolve it here.

`CompliancePanel.nudge.test.jsx` carries `const CHIP_WAIT = { timeout: 3000 }`, introduced
by **#563 — the same commit that raised the global to 5000**. #872's audit then correctly
named it as the surviving self-narrowing anti-pattern: one file capped 40% below the
global ceiling. Both FOLLOW_UPS entries are true and they read as contradictory.

They reconcile. `CHIP_WAIT` was **in place during the 57% failures and did not cause
them** — the assertion waited its full 3000ms and the chip never appeared. It is inert
with respect to the proven mechanism, not a competing fix to it.

**And this file is now the control.** It is the only member of the family with a proven
fix and a documented 0/200 baseline. Changing its timeout before the experiment destroys
the one reference point you have. Leave it alone. Bank the reconciliation in FOLLOW_UPS as
a deliberate deferral carrying this reasoning, and revisit `CHIP_WAIT` after this
investigation reports — as its own change, with its own burn.

**The hypothesis this slice tests.** All eight implicated files share one shape:
`vi.mock` on a service module + `mockResolvedValue` + `waitFor`/`findBy`. A mocked
service promise resolves into a multi-commit render chain, and the test awaits a **gate
that can be satisfied on an earlier commit than the one carrying the element it then
queries**. Whether that happens depends on microtask/macrotask interleaving.

**Correction to my own framing: contention is not the trigger.** I wrote this brief around
it and the isolation burn falsified it. The interleaving is nondeterministic on its own;
load appears to modulate the rate, not create the failure. The awaiting pattern survives
as the candidate defect, and the fix is unchanged — **await the thing you are about to
assert on**, not a proxy for it.

---

## PHASE 0 — VERIFY THE HYPOTHESIS. Report and STOP.

This is the whole gate. If the hypothesis is wrong the fix is wrong, and five rounds of
plausible-but-wrong fixes are exactly why this brief exists.

**0. Reconcile the register first — it is incomplete, and by a wide margin.** Your register
has 7 files. This family has been worked at least five times before you: `d936c691` (#502,
`act()` wrap), `28968bbf` (13 files), `063fff1e` (#563), #861 and #872 (per-test widening).
Report the **union** of every file ever named as flaky across all of those plus #875 and
your ruling-15 table, each with which round touched it and whether that round's change is
still present. The fix's scope depends on the real number, and so does the question of why
five rounds have not held.

`CompliancePanel.nudge.test.jsx` stays **in the register as the control, and out of the fix
scope entirely** — its fix is merged and its baseline is documented. Classify it like the
others. It is the one case where you can check your classification against a proven answer:
if your method gets the control wrong, the method is wrong and nothing downstream of it
counts.

**THE PROTOCOL — classify blind, then burn, then compare. That order is the whole design.**

You now have a seven-minute local reproduction at a measurable rate, which converts this
from archaeology into an experiment. The order matters more than the speed.

1. **Classify every file in the reconciled register WITHOUT burning it.** Write the
   classification down and commit it before you measure anything. If you burn first you
   will fit the classification to the rate — that is not a slur, it is what anyone does
   with the answer already on the page.
2. **Then burn each register file isolated, 30 iterations**, and record the rate.
3. **Then compare.** If PROXY files burn hot and DIRECT files burn cold, that is real
   evidence and the first this investigation has had. If the rates do not separate, the
   classification predicts nothing — say so. A pattern every file shares and only some
   files fail on is a description, not a cause.

Report the pre-registered classification and the measured rates as **two separate tables,
in that order**, so the comparison is auditable rather than asserted.

Start with `MeetingMode.test.jsx`. It has had **zero** remediation rounds despite being the
most active member of the family, and it is the one file where you already have a rate.

Then, for **each** test in the reconciled register, read the test body and classify it
against this pattern. Cite `file:line`.

1. **Does it await a PROXY and then query something else?** The failing shape is:
   ```
   await waitFor(() => expect(someMock).toHaveBeenCalled())   // proxy gate
   expect(screen.getByTestId('x')).toBeInTheDocument()        // different thing
   ```
   as against the safe shape:
   ```
   expect(await screen.findByTestId('x')).toBeInTheDocument() // gate IS the assertion
   ```
   Report for each test: PROXY, DIRECT, or NEITHER — with the actual lines.

2. **How many render commits separate the gate from the query?** Where you can determine
   it, say whether the awaited condition can be true before the queried element exists.
   This is the causal claim; everything else is correlation.

3. **Does the classification predict the failure shape?** Under the hypothesis, PROXY
   tests should produce assertion / element-not-found failures, and tests awaiting
   something that never arrives at all should produce timeouts. Your register has
   timeout 7 / element-not-found 4 / assertion 3 / unrecorded 3. **Check whether the
   split lines up.** If PROXY tests are failing with timeouts and DIRECT tests with
   assertions, the hypothesis is backwards and you should say so.

4. **Count the pattern across the whole suite**, not just the register. How many
   `waitFor(() => expect(<mock>)...)` call sites exist in `src/**/__tests__`? If the
   register's 17 are a small fraction of hundreds of identical call sites, then either
   the pattern is not sufficient on its own, or the other sites are simply lucky — say
   which you think and why.

**STOP and report.** Do not change a single test until I rule.

**If the classification does not support the hypothesis, say so plainly.** A clean
falsification here is worth more than a fix, and this is the sixth remediation round —
being wrong again quietly is the expensive outcome.

---

## 1. If confirmed — the fix, and its constraints

Mechanical, one shape, applied at every confirmed site:

- Replace proxy gates with direct ones: `await screen.findByX(...)` where the awaited
  element **is** the asserted element.
- Where a mock-call assertion is genuinely the point, assert it **after** a direct
  DOM gate rather than using it as the gate.
- **Do not change any timeout.** Not `asyncUtilTimeout`, not per-test `{ timeout }`,
  not `testTimeout`. If a site appears to need one, that site falsifies the hypothesis —
  STOP and report it rather than widening.
- **Do not touch production source.** If a test cannot be fixed without a component
  change, that is a finding, not a licence.

## 2. Proving it worked

The bar is the same one that caught every prior round's false confidence.

- **Baseline first.** Fresh, on this branch, before any edit. Record files and tests.
- **Use the burn harness that already exists.** #543 established it; the harness-salvage
  PR lands it on staging at `scripts/flake/burn-isolated.ps1` and
  `scripts/flake/burn-suite.ps1`.
  It also banked a **WORKTREE RULE** from that PR's invalidated first attempt — *no
  checkout in the burn tree during a burn*, because a mid-burn checkout silently ran
  iterations against the unfixed file and all 200 results had to be discarded. Read those
  scripts before writing your own, and honour that rule. **If they are not on your branch
  point, the salvage has not landed — STOP and say so** rather than writing a new harness
  and re-deriving a bar that already exists.
- **Mutation-verify the diagnosis, not just the fix.** Pick one confirmed PROXY test and
  burn it isolated, pre-fix and post-fix, the way #543 did — its bar was ~57% → 0/200. If
  it will not fail in its original form under the burn, the diagnosis is unproven for
  that site and you should say so rather than counting it.
- **Five consecutive full CI runs**, all green, all reported with timings and run IDs.
  Same standard as P0-E, and the same rule: **a red inside the five is data — STOP and
  report, do not re-run.**
- **Recompute the failure rate** from CI history after the fix lands enough runs to be
  meaningful. State honestly that the post-fix window will be small, and that the claim
  is "no red in N attempts", not a new rate.

## 3. Bank the outcome either way

Whether this confirms or falsifies, the register gets the answer. Include the corrected
statistical framing so nobody re-derives the wrong one:

- The rise is a **step change around 29 Jul**, not a per-slice trend. Windows 2 and 3
  overlap almost entirely (Wilson 19–50% vs 21–72%); only window 1 vs window 3 is
  separable.
- Suite size is **falsified** as the driver: +1.7% tests cannot move 14% → 45%, and the
  family predates v3 by three weeks.
- What changed around 29 Jul remains **unexplained**. Say so rather than filling it.

---

## 4. Deliverables

- The Phase 0 classification table: every register test, PROXY/DIRECT/NEITHER, with
  `file:line` and the actual gate and query lines.
- The suite-wide pattern count from Phase 0 question 4.
- If confirmed: the fix, the under-load mutation evidence, five green runs, the banked
  outcome.
- If falsified: the classification, the reason, and a recommendation for what to test
  next — no code change at all.

---

## NOT in scope

Any timeout, `CHIP_WAIT` included. Any production source file. `maxForks`, `isolate`,
sharding, `poolOptions`, or any runner config — the isolation result closes these
permanently rather than provisionally: nothing at the runner level can affect a race that
fires with one file running alone. Phase 1 work.
Fixing tests that are not in the register unless the suite-wide count shows the pattern
is pervasive and I rule for widening.

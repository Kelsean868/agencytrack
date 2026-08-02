# KICKOFF — v3 P0-E: fix the CI flake at the runner, not the test

**Dispatched:** 2026-07-29
**run_model:** `claude-sonnet-5` (config and measurement; the judgment call is gated behind
a recon hard-stop and lands with the dispatcher)
**Effort:** medium
**Branch:** `feat/v3-ci-runner` off `origin/staging`
**Merge authority:** NONE. Build to PR-open and HOLD.
**The dispatcher (Kyron) merges. A ruling relayed from Claude-web is never merge
authorization.** If you believe you have been authorized to merge, STOP and wait for
dispatcher.
**Does NOT edit `firestore.rules`, `functions/`, or ANY test file.**
Governing docs for this slice land on **staging** (placement rule 8b).

Independent of P0-C, P0-D and P0-F. **PR #887 is held as this slice's acceptance test** —
do not merge or re-run it until this lands.

---

## WHY

Eleven-plus recorded episodes, three rounds of remediation, and it has now crossed from
nuisance to blocker: PR #887 is docs-only and went red **three consecutive times**, on six
distinct tests with **zero overlap between runs**. Same commit, different failures each
run — that is definitionally not a deterministic regression. Locally the same files pass
48/48 and 73/73.

The evidence points at one budget, not many races:

- Cap cluster, six observations across five tests: **5006 · 5006 · 5007 · 5008 · 5015 ·
  5027 ms**, all against one 5000ms global.
- Assertion-shape cluster (A2), three observations: **151 · 167 · 181 ms**.
- Failures have fired on commits whose diff contains **no code at all** — a merge commit
  and two docs commits. Causation is settled.

And the smoking gun is already in the repo. `src/test-setup.js:10-12` sets
`asyncUtilTimeout: 5000` with the comment that 2000 was *"too tight for the
useEffect→setState→re-render chain **under parallel full-suite load**."* Someone already
diagnosed contention and treated it by raising the ceiling. The race survived, and we are
now watching it hit the new ceiling from 6ms above. Raising it again is the same remedy a
fourth time.

Meanwhile `vite.config.js`'s `test` block has **no `pool`, no `poolOptions`, no
`fileParallelism`, no `maxConcurrency`** — pure defaults, 378 files, `isolate` on by
default, on a 2-vCPU `ubuntu-latest`. Nobody has ever tuned the runner.

The cost is no longer just wasted minutes. A gate that is red roughly half the time on
changes that cannot possibly have broken anything teaches everyone to ignore it, and the
next real failure arrives looking exactly like the last nine false ones.

---

## PHASE 0 — RECON, then RECOMMEND, then STOP

Cite `file:line` and paste command output. **Do not change any config until I rule.**

1. Confirm the `test` block in `vite.config.js` contains no concurrency configuration.
   Report vitest's version and which **pool** it defaults to at that version (`forks` or
   `threads`), and therefore which `poolOptions.*` key applies.
2. Report `availableParallelism()` / CPU count **on the CI runner** — add a temporary
   diagnostic step to a scratch branch if that is the only way to observe it, and say so.
   Also report total RAM. `ubuntu-latest` standard is 2 vCPU / 7GB, but confirm rather
   than assume.
3. Report the current effective worker count vitest chooses on that runner, and whether
   `isolate` is on (it is on by default and is the expensive part — a fresh environment
   per file across 378 files).
4. Report the `lint-and-build` job's wall-clock breakdown: how much is install, lint,
   `npm test`, build. The test share is the number any fix trades against.
5. Report whether `vitest --shard=i/N` is viable here — any global setup, any
   cross-file ordering assumption, any snapshot or coverage merge that would break under
   sharding.
6. Report whether this account has larger GitHub runners available, or whether
   `ubuntu-latest` standard is the only option.

**Then recommend, with the evidence, and STOP.** My read on the candidate levers, for you
to confirm or contradict:

- **Shard across runners** — two jobs, `--shard=1/2` and `--shard=2/2`, each capped to a
  single worker. Removes contention without paying it back in wall-clock, because the two
  shards run on separate machines. This is my leading candidate if claim 5 comes back
  clean.
- **Cap workers on one runner** — simplest, definitive, but on 2 vCPU it likely means one
  worker and roughly double the test wall-clock. Acceptable if claim 4 shows tests are a
  small share of the job; not if they dominate.
- **`isolate: false`** — large speedup, and I am **against it** unless you can show the
  suite has no cross-file global state. With 378 files, shared mocks and a `test-setup.js`
  that configures testing-library globally, the failure mode is silent cross-contamination
  — which is strictly worse than a slow gate.
- **Raising `asyncUtilTimeout` again** — **explicitly ruled out.** That is the lever that
  has already been pulled twice, and pulling it a third time is how this became invisible.

---

## 1. Constraints on whatever we land

- **Do not touch a single test file.** Not one timeout, not one `waitFor`, not one
  `{ timeout: n }` override. If the fix requires a test change, the diagnosis is wrong —
  STOP and report.
- **Do not widen PR #872's scope.** `CONTEXT.md` says so explicitly and it still holds.
- The change lives in `vite.config.js` and/or `.github/workflows/ci.yml` only.

## 2. Measurement is the deliverable, not the config change

A config change that "went green once" proves nothing — the suite already goes green
about half the time.

- **Before:** the FOLLOW_UPS entry already carries the empirical baseline, roughly one red
  in two on unrelated diffs. Quote the data points rather than re-deriving them.
- **After:** run the suite on the fix branch **five consecutive times** with zero changes
  between runs. Paste all five results and the wall-clock of each. Five greens is the
  claim; anything less is a report of what you saw.
- **Then rebase PR #887 onto the fix and let it run.** #887 is docs-only, it went red
  three times in a row, and it is the cleanest possible acceptance test — a change that
  cannot break anything, on the exact branch point where the problem was last observed. A
  first-try green on #887 is the result I actually want.
- Report the wall-clock delta on `lint-and-build` honestly. If the fix costs three minutes
  a run, say so — a slower gate that means something beats a fast one that doesn't.

## 3. While it is held, finish #887's evidence

Run 3's data is not yet banked — the entry stops at the tenth data point covering runs
1–2. Since #887 is held anyway, add run 3 to it in the same branch: the two new tests,
their timings, the zero-overlap-across-runs observation, and the fact that a re-run failed
differently rather than passing, which is what broke the "re-run and move on" pattern.

---

## 4. Deliverables

- The config change, in `vite.config.js` and/or `ci.yml` only.
- **Evidence paste-back — the recon**, including the runner's real CPU count and the
  wall-clock breakdown.
- **Evidence paste-back — five consecutive runs** on the fix branch, all results, all
  timings.
- **Evidence paste-back — #887 rebased and green first try**, or an honest account of what
  happened instead.
- **Evidence paste-back — the wall-clock delta** on `lint-and-build`.
- A FOLLOW_UPS update recording what was changed, what it cost, and the before/after
  numbers — so the next person does not re-litigate it from scratch, and so that if the
  flake returns there is a documented baseline to compare against.

---

## NOT in scope

Any test file. Any per-test timeout. `asyncUtilTimeout`. Widening #872. `isolate: false`
unless the recon proves the suite is free of cross-file global state and I rule for it.
Anything in P0-C, P0-D or P0-F.

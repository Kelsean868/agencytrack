# Flake burn harness

Two PowerShell scripts for measuring test flakiness by repetition. A "burn" runs
the same thing N times and reports how often it failed.

They exist because a red CI on this repo no longer reliably distinguishes a real
regression from scheduling noise, and four rounds of remediation have been aimed
at mechanisms that were partly guessed. A burn replaces the guess with a rate.

Ported from PR #543 (`tmp/burn-*.ps1`), which never merged — its code content had
already landed via **#563** (`063fff1e`). The scripts were the only part not on
`staging`, and `git ls-tree` found nothing matching "burn" anywhere, so they were
effectively lost on an unmerged branch.

---

## ⚠ THE WORKTREE RULE

**A burn tree is FROZEN for the duration of the burn. Any `checkout`, `rebase`,
`stash pop`, or branch switch inside it invalidates EVERY iteration — not just
the ones after the switch.**

The invalidation is total, and that is the part worth internalising. You cannot
keep the iterations that ran before the switch, because at the moment you notice
the tree moved you no longer know **which** iterations saw which tree. A burn
does not stamp each iteration with the SHA it measured, so there is no boundary
to cut at. Salvaging "the first N" requires knowing N, and not knowing N is the
whole problem.

**If a burn must measure two refs: two worktrees, two burns.** Never move one
tree between them.

This is banked as a rule in root `CLAUDE.md` (§ Banked patterns, beside the
worktree-junction rule). This file is the operator-facing copy.

Banked from PR #543's first attempt: a ~200-iteration burn had a different ref
checked out mid-run, silently measured the unfixed file for part of it, and **all
200 results were discarded**. Nothing errored — the burn ran to completion and
reported a clean-looking number.

**Also:** do not run two burns concurrently on one machine. Concurrent full-suite
runs generate their own Windows worker-contention failures (CLAUDE.md § Vitest on
Windows) that are indistinguishable from the effect being measured.

---

## `burn-isolated.ps1` — one file, N times

Measures a single file's **solo** flake rate, with no other test file competing.

```powershell
.\scripts\flake\burn-isolated.ps1 -TestPath "src/components/manager/__tests__/MeetingMode.test.jsx" -Iterations 200
```

| parameter | default | meaning |
|---|---|---|
| `-TestPath` | *(required)* | test file, relative to repo root |
| `-Iterations` | `200` | enough to resolve a low-single-digit rate; use ~30 to prove the instrument works |
| `-ExpectZero` | off | exit non-zero if ANY iteration fails — for control burns and gates |
| `-LogDir` | `tmp/burn-logs-isolated` | per-failure logs (gitignored) |

Failures are classified by **shape** — `timeout` / `notfound` / `assertion` /
`other` — because the register's taxonomy turns on it. A timeout and a sub-100ms
assertion cannot share a remedy, and at least one remediation round was misaimed
because that distinction was not recorded when the failure was collected.

Without `-ExpectZero` the script always exits 0. Observed failures are the
**data**, not an error.

## `burn-suite.ps1` — full suite, N times

```powershell
.\scripts\flake\burn-suite.ps1 -Iterations 50
.\scripts\flake\burn-suite.ps1 -Iterations 8     # prove it fires, cheaply
```

Same parameters minus `-TestPath`. Each iteration is a full suite run — minutes,
not seconds — so pick N deliberately.

The output that matters is the **per-file tally**. Whether the failing population
rotates or concentrates is the diagnostic: many files seen once each points at
something shared, one file dominating points at that file.

---

## Reading a result

**A clean isolated burn does not clear a file.** It narrows the cause to
contention with other files; it does not prove stability. Use `burn-suite.ps1`
for that.

**A clean burn at low N proves very little.** At a 17% per-run failure rate,
three clean runs happen 58% of the time. Sample sizes here need to be chosen
against the rate you are trying to detect, not against patience. This is not
hypothetical — a "12/12 three times, passes in isolation" conclusion recorded
during this repo's own investigation was overturned by a 30-iteration burn on the
same file.

**Rotation inside a single file is not evidence of cross-file contention.** If
four different tests in one file fail across a burn of that file alone, the
rotation is intra-file and no other file is involved.

---

## Baselines

Measured on `staging` at `2ef1abc5`, 30 iterations each, one machine, serially.

| file | result | shape |
|---|---|---|
| `CompliancePanel.nudge.test.jsx` | **0/30** | — (control; #563's fix holding) |
| `MeetingMode.test.jsx` | **5/30 (16.7%)** | all `timeout`; 4 distinct tests |

`CompliancePanel.nudge.test.jsx` is the **control**. It is the only member of the
flake family with a proven fix and a documented baseline (0/200 at #543/#563).
Do not change its timeouts while it is serving as the reference point.

---

## Gotcha, if you edit these scripts

`$ErrorActionPreference = 'Stop'` makes PowerShell raise `NativeCommandError` on
**any** native-command stderr output. `vitest` writes to stderr whenever a test
logs via `console.error`, so with `Stop` in effect the burn aborts on the first
such iteration instead of recording it as a failure.

Both scripts therefore set `Stop` for setup validation and drop to `Continue`
before the loop. This was found by running the harness, not by reading it: the
control file emits no stderr, so the control burn passed 30/30 while the harness
was broken.

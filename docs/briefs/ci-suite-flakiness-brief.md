# Brief — CI suite flakiness: diagnose + stabilize

**Suggested branch:** `fix/ci-suite-flakiness`
**Size:** M–L (Phase 1 diagnosis sets the true scope)
**Type:** Test-infrastructure (possibly CI config). Human-merged + pre-review. Likely test-only / no render path → no CF, no deploy — Phase 1 confirms.
**This PR cannot merge on a waiver.** Its purpose is a trustworthy CI; it must clear the green bar it's building.

---

## Context

A cluster of `waitFor`-timing tests flake on CI while passing locally: DailyEntryModal, CompliancePanel.nudge (still flaking despite the PR #543 fix + probation), PolicyLedgerPanel, WizardFormV2RetirementR1/R2, AwardsRulesetPanel. This flakiness now **blocks merges** — it forced a documented waiver on PR #561 (three CI runs, three different failing tests). CI is no longer a trustworthy gate. Fix the root cause so it is again.

## Goal

`lint-and-build` passes reliably — the flaky tests stabilized **at root cause**, proven over many runs, not a single lucky green.

---

## Phase 1 — DIAGNOSIS (HARD STOP — this is the crux; do NOT prescribe or write a fix until the root cause is understood)

1. **Catalog.** The full flaky set (the names above + any others surfaced). For each: the exact failure mode — which assertion, `waitFor` for which element, what timeout.
2. **Common pattern?** Same signature across them (waitFor timing out on an element that renders slightly too slow), or distinct? Shared cause (a common setup / util / mock / provider) or independent per test?
3. **Local repro — essential.** Do they flake locally under load? Try: full-suite repeated N times, randomized order, single-thread (`--pool=forks`/`--no-file-parallelism`), isolated vs in-suite. **Any fix is unverifiable without a local repro** — finding one is the primary Phase 1 deliverable.
4. **Root-cause hypothesis with evidence.** Which of: (a) CI runner resource contention (slower CPU → async exceeds `waitFor`'s default timeout); (b) test isolation — shared state, timers, or listeners leaking across tests (order-dependent); (c) a specific slow async setup; (d) a global `waitFor`/test timeout too short for CI's speed. Gather evidence, don't guess.
5. **The #543 tell.** What did #543 do for CompliancePanel.nudge (delay:0, CHIP_WAIT timeouts, tripwires), and why is it STILL flaking — what's the residual cause? A "fixed" test still failing is the clearest pointer to the real root.

**Report the diagnosis + a proposed fix strategy. Hard stop for dispatcher review** — the strategy (systemic vs per-test vs CI-config vs interim retry) is a decision point, not CC's unilateral call.

---

## Phase 2 — FIX (strategy confirmed at the Phase 1 review — brief stays open here until then)

Likely one or a combination of:
- **Systemic:** a CI-appropriate global `waitFor`/test timeout; a shared isolation fix (proper `afterEach` cleanup of timers/listeners/mocks); fake timers where real-clock waits cause the drift.
- **Per-test:** deterministic timing fixes (explicit waits, `delay:0`, stable mocks) for each flaky test.
- **Interim retry** (only if explicitly agreed as a stop-gap): scoped `vitest` retry on the known-flaky set — but band-aids that mask without fixing are not the default, and any root fixes deferred get banked, not dropped.

---

## Phase 3 — STABILITY GATE (a flake is NOT proven fixed by one green run)

1. Each previously-flaky test passes a high number of **consecutive** local runs (≥20) — 100% green. Document the counts.
2. CI `lint-and-build` green across **several consecutive** runs, not one.
3. Full suite remains green.
4. The documented run counts are the proof — record them in the PR body.
5. Post-merge: confirm the flakiness does not recur over the next several PRs (the real-world proof), and only then retire the probation.

---

## Phase 4 — docs

Record the root cause + the fix. Close the elevated suite-flakiness FU (and subsume the CompliancePanel #543 probation if this resolves it). Note any agreed interim stop-gaps + the remaining root fixes if not fully resolved. SHA placeholders for Phase 5.

---

## Phase 5 — commit / push / PR

Human-merge + pre-review. HEAD SHA (Rule 20); poll + disposition every Gemini comment (Rule 21). **CI must be green — no waiver on this PR.** Smoke: likely N/A (test-infra, no render path) — waive with justification per the smoke rule, unless the fix touches a component/render path.

---

## Boundary

- Test-infrastructure + possibly CI config. **No feature/component behavior change** — tests pass for the same reasons, just reliably.
- **If the diagnosis finds a real app race masquerading as a flake** (the test intermittently fails because the *app* intermittently misbehaves — a genuine race/effect-cleanup bug in component code), STOP and report. That's a more important and different fix, not a test-timing tweak.
- If Phase 1 shows the flaky set needs genuinely independent per-test work at a scale better split across PRs, say so at the review — the single-PR container is the default, not a constraint.

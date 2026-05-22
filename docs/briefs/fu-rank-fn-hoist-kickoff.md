# PR Kickoff — TOOLING/Rules: Hoist duplicated rank helpers (AUTONOMOUS-SAFE)

**Track:** banked FU (rules hygiene). **Type:** Refactor (pure, no behavior change) · **Size:** S–M · **Risk:** Low — mechanical, fully covered by the existing emulator suite.
**AUTONOMOUS RUN:** dispatcher (Kyron) is away; chat-Claude is not reviewing mid-flight. Proceed through all phases WITHOUT the usual Phase-1 stop, BUT honor the STOP-conditions below — when in doubt, STOP and leave a note rather than guessing. End at PR-open. NEVER merge.

## Goal

Consolidate the duplicated block-local rank helpers (`warRoleRank`, `cnRoleRank`, `jcRoleRank`, and any other `*RoleRank` copies) into a single top-level `roleRank()` function in firestore.rules, with zero behavior change. This is the banked rank-fn-hoist FU.

## Phase 1 — source-verify (report in the final summary; do NOT stop here unless a STOP-condition fires)

1. `grep`/read every `*RoleRank` function definition in firestore.rules. Quote each one verbatim with its line range and the block it lives in.
2. Compare them. They are hoistable into ONE top-level fn ONLY IF they are byte-identical in their role→rank mapping.

**STOP-CONDITION A:** if the rank fns are NOT identical (different role sets, different numbers, different ordering that changes results), DO NOT force a single consolidation. Hoist only the ones that are genuinely identical, leave the divergent ones block-local, and clearly note the divergence in the report. A behavior-changing "consolidation" is a failure, not a success.

## Approach (pure refactor)

- Define one top-level `function roleRank() { ... }` (Firestore top-level functions are accessible inside nested `match` blocks).
- Replace each identical block-local copy with a call to the top-level `roleRank()`.
- Remove the now-dead block-local definitions.
- Change NOTHING about the predicates that use them — same call sites, same comparisons. The diff should be: one new top-level fn + deletions of the duplicates + the call-site name swap. No `allow` rule logic changes.

## Phases

1. Source-verify (above).
2. Hoist. Pure refactor only.
3. Verify — run the FULL Firestore emulator rules suite (`firestore.rules.test.mjs` via the emulator). **STOP-CONDITION B:** if ANY previously-green case goes red, STOP, revert the change, and report which case failed — do not try to "fix" the rule to make it pass (a red case means the refactor changed behavior). Also run the full vitest suite (env-unset) + lint + build.
4. Docs WITH placeholders: CONTEXT.md recently-shipped + Where-we-left-off (#TBD/{TBD}); FOLLOW_UPS.md — mark the rank-fn-hoist FU resolved.
5. Commit / push / PR. Branch off fresh main (`git fetch` first; expected HEAD = current main). Rules change is a pure refactor with no new grants — **do NOT deploy** (the deployed rules are byte-equivalent in behavior; deploy happens post-merge only if needed, but a pure refactor needs no pre-merge deploy since behavior is unchanged and the emulator proves it). Lint + build + full suite. Push, PR via `gh`, Rule 15. **Do NOT merge.**

## STOP-conditions summary (autonomous safety)
- A: rank fns not identical → partial hoist + note, never force.
- B: any emulator case goes red → revert + report, never "fix the rule."
- C: anything ambiguous, unexpected, or not covered here → STOP, leave a note in the report, move on to the next task. Do not guess on rules.

## Acceptance
- One top-level `roleRank()`; identical duplicates removed; divergent ones (if any) left + noted.
- Full emulator suite green (unchanged from before); vitest green (env-unset); lint 0; build green.
- No `allow` predicate logic changed. No deploy. PR open, not merged. Rule 15 SHA reported.

## Smoke — WAIVED (justified)
Pure rules refactor with no behavior change, proven by the unchanged emulator suite. No user-visible change. (Confirm in the report: emulator suite identical pass before/after, no predicate logic touched.)

## Post-merge (for when Kyron returns + reviews)
Standard docs fill, no deploy.

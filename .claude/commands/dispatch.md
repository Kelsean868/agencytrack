---
description: Execute a kickoff brief through Phases 0-5 with standing methodology applied.
argument-hint: <brief-path>
---

PR dispatch — execute the kickoff brief at `$ARGUMENTS`.

Read the brief in full before doing anything else. Then execute Phases 0–5 as the brief specifies.

Strike count opens at 0/2.

## Standing methodology (canonical CLAUDE.md applies — these are reminders)

- **Phase 0 gate** (Session Protocol step 1): if not on main with clean working tree, checkout main first. Hard-stop if Phase 0 step 3 fetch/pull surfaces unexpected divergence.
- **Single-branch PR rule** (Rule 1): fresh branch off freshly-fetched main, never reuse.
- **Source-verify at brief authoring** (Rule 17): if any Phase 1 sanity check shows a brief premise has shifted (file paths moved, grep counts changed, items already shipped, etc.), STOP and wait for dispatcher.
- **Canonical hard-stop phrasing** (Rule 12): every stop condition in summary reports uses the literal phrase "STOP and wait for dispatcher".
- **Smoke default** (Rule 9): production smoke runs autonomously via `setupBypassSession`. Waiver allowed only for pure-docs / internal-refactor / tooling changes — justify inline if waiving.
- **Direct-to-main verification** (Rule 15): any post-Phase-5 direct-to-main push (Phase 6 placeholder fill, hotfix) requires `git fetch origin && git log origin/main --oneline -1` immediately after push, SHA-match against `git rev-parse HEAD`, and explicit "pushed and verified — SHA <sha>" report.

## Scope extensions

Per Rule 9 in-PR scope extension: if a clearly-in-scope adjacency surfaces during execution, document it inline and bank — do not STOP for dispatcher unless the adjacency materially changes the PR's surface area or risk profile.

## Stop conditions

- Phase 0 gate divergence (working tree dirty, SHA mismatch, fetch/pull non-fast-forward)
- Phase 1 sanity check shows a brief premise has shifted
- `npm run lint` or `npm run build` fails in Phase 3 on a file outside the PR's edit set
- Smoke (if run) surfaces a regression
- Any premise the brief asserts that the repo state contradicts

In each case, STOP and wait for dispatcher.

## After PR is open

Surface the PR URL in your summary. Do NOT run Phase 6 post-merge sequence until dispatcher confirms merge — Phase 6 is invoked separately via `/post-merge <pr-number>`.

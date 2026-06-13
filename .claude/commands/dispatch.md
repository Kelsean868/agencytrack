---
description: Execute a kickoff brief through Phases 0-5 with standing methodology applied.
argument-hint: <brief-path>
---

PR dispatch — execute the kickoff brief at `$ARGUMENTS`.

## Step 0 — brief-on-main guard (MANDATORY, before reading the brief)

`git fetch origin`, then confirm the brief path exists on `origin/main`:
`git ls-tree origin/main -- docs/briefs/<file>` must be non-empty. If it is empty (the
brief is not on `origin/main`), **STOP IMMEDIATELY** and report: "brief not on origin/main
— merge the docs PR first (Rule 10)." Reading the brief from a local or docs branch is no
longer permitted — the dispatch must run against the merged-to-main brief so the Rule 10
audit trail (brief authorship/timing in main's history) is intact before any work begins.

Only once the brief is confirmed on `origin/main`:

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

## Phase 5 smoke enforcement

Phase 5 includes the Rule 21 Gemini disposition table — poll for the bot review after PR open (up to 10 min; if absent, note it and proceed — a pre-merge "absent" is provisional pending the `/post-merge` re-poll (Rule 21 backstop)) and disposition every comment before reporting.

**Phase 5 is not complete until the smoke has RUN green against the preview; smokes are never authorization-gated.** A smoke that is created but not run does not satisfy Phase 5. Run the full leg set (both themes, all credential tiers per the brief), fix-and-rerun anything surfaced, then report with itemized gate table + final HEAD SHA (Rule 20) and known gaps (Rule 22) before declaring pre-review hold. (Banked 2026-06-06, PR #515 — two consecutive created-not-run smokes prompted this hardening.)

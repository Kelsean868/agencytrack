# Discipline Gates — Kickoff brief

- **Status:** FINAL — decisions locked. Three new Methodology Rules (self-critique gate, falsification-before-banking gate, currency verification), additive only, all landing this pass.
- **Channel:** HUMAN-MERGE + pre-review (touches CLAUDE.md).
- **Scope class:** Docs only — `CLAUDE.md` + `docs/kickoff-template.md` + `docs/CONTEXT.md` (+ `.claude/commands/dispatch.md` conditional). No app code, rules, or CF.
- **Smoke:** WAIVED per Rule 9 (pure docs). Justified inline in PR body; `npm run build && npm run lint` + visual diff of the edited docs stands in.
- **Branch:** docs branch via `/land-brief discipline-gates`; then feature-branch off `origin/main` for implementation via `/dispatch`.
- **Rules in force:** Rule 10 (brief lands as its own docs PR), Rule 12 (hard-stop phrasing), Rule 15 (post-merge origin verify), Rule 17 (source verification — see Phases 0/1; author could not verify live rule numbers), Rule 19 (no auto-merge), Rule 20 (report feature-branch HEAD SHA). Phase 0 confirms the live rule set.

> **Origin:** review of the public `fable-mode` skill (June 2026) for deltas additive to our existing dispatch discipline, plus a standing operator request to stop answering present-tense factual questions from training priors without verifying.

## 0. Why
Three discipline deltas survived the "we already do this" filter, and a fourth concern (currency of current-world facts) came from operator feedback. All four land as **durable Methodology Rules + template/CONTEXT edits** so they bind both the dispatcher's chat answers and CC's runs — not one-off brief language.

## Phase 0 — Read order + format/state verification (before anything)
Read in order:
1. `CLAUDE.md` — § Methodology requirements + § Dispatcher tooling.
2. `docs/CONTEXT.md` — § How to update this file; § Locked decisions; § Current main HEAD.
3. `docs/kickoff-template.md`.

Verify:
- `git fetch origin && git status && git log origin/main --oneline -3` — tree clean; HEAD matches CONTEXT § Current main HEAD. Else **STOP** (Rule 12).
- Confirm this brief's Phases 0–6 format matches current sibling briefs in `docs/briefs/` and the live kickoff-template. The author reconstructed this format from prior sessions, not the live template file (which in the working snapshot still showed the older Step-0/Option-A-B structure). If the house format has moved, surface before proceeding.

## Phase 1 — Audit / findings hard-stop
1. `grep -nE '^### [0-9]+\.' CLAUDE.md` → **highest existing Methodology Rule number.** The three new rules append as the next three sequential numbers (N, N+1, N+2). Do NOT assume 18/19/20 — snapshot showed max 17 but live is known ahead.
2. `ls .claude/commands/` then read `dispatch.md` / `post-merge.md` → does either enumerate PR-report contents, or how CC answers source-derived / current-world questions? Determines the conditional Phase 2 edit. If neither section exists, record and skip — do not invent it.
3. Confirm `docs/CONTEXT.md` contains `## How to update this file`. If the header differs, surface the actual header.

**STOP. Paste Phase 1 findings — resolved (N, N+1, N+2), dispatch.md disposition, CONTEXT header — back to dispatcher for lock before Phase 2 (Rule 12).**

## Phase 2 — Implement (after Phase 1 lock)
**`CLAUDE.md` — append three rules** (terse; long rationale goes in the PR body, not CLAUDE.md, to respect the lean-file / prompt-cache cost):
> **N. Self-critique gate.** Before posting any PR-ready report, plan, or final session summary, CC enumerates ≥1 known gap — what it did NOT verify, the weakest part of the change, or an assumption that could be wrong. Self-generated and independent of Rule 21 (Gemini disposition): surfaces blind spots before external review, not after. A report with no stated gap is incomplete, not clean.

> **N+1. Falsification-before-banking gate.** Before a finding is banked as a locked decision (CONTEXT.md § Locked decisions), an active follow-up, or a CLAUDE.md rule, state what evidence would overturn it. If that can't be answered, the finding is provisional — record it as provisional, do not bank it as settled. Applies to architecture findings, audit conclusions, and rule rationales.

> **N+2. Currency verification.** Any time-sensitive or current-world fact handed to the operator — role holders, prices, laws/regulatory status, product or model availability, recent events — is web-searched and verified current at answer time, not asserted from training priors. Rule 17 extended from brief-authoring to live answers: training-era confidence on a present-tense fact is the trigger to search, not to assert. State the as-of date or source when the fact could have changed. Applies to the dispatcher's chat answers and CC's knowledge-work outputs alike.

**`docs/kickoff-template.md` — three edits:**
- Option A / plan block — add bullet: *Expected output per stage — for each file in the change map, state the expected post-change state, so drift is detectable when actual ≠ expected at the surprise-stop gate.*
- Autonomous-scope PR step — append `, and known gaps (what was not verified / weakest part)`.
- Final stop-condition summary line — append `, and known gaps (per the self-critique gate)`.

**`docs/CONTEXT.md` § How to update this file — add one line:**
> Before banking a finding as a locked decision or follow-up, state what would falsify it (Methodology Rule N+1). Unfalsifiable-at-time findings are recorded as provisional, not settled.

**`.claude/commands/dispatch.md` (conditional, per Phase 1 #2):** if the command enumerates PR-report contents, add the known-gaps requirement for parity with Rule N. If it describes how CC answers source-derived / current-world questions, add the currency requirement (Rule N+2) too. Else skip and note in the report.

## Phase 3 — Verification
- `npm run build && npm run lint` — green.
- Visual diff every edited doc; confirm **no existing rule was renumbered or reworded** (additive only).

## Phase 4 — Docs-with-placeholders
- Any Rule 10 `#{TBD}` trailer / CONTEXT placeholder introduced is filled at Phase 6 with the work-PR number + squash SHA (Rule 16). None expected beyond the standard trailer.

## Phase 5 — Commit / push / PR
- `docs:` conventional commit; push to feature branch; open PR.
- PR body covers: scope, file-count breakdown, verification, smoke-waiver justification, open follow-ups, **and known gaps (dogfooding the self-critique gate)**.
- **STOP. Do not merge / deploy (Rule 19).** Report PR URL + lint/build result + feature-branch HEAD SHA (Rule 20).

## Phase 6 — Post-merge
- `/post-merge <pr#>` fills any `#{TBD}` trailer + CONTEXT placeholders, then Rule 15 origin verification.

## Acceptance criteria
- `CLAUDE.md` carries three new sequential Methodology Rules — terse, additive, no renumbering of existing rules.
- `docs/kickoff-template.md` carries the expected-output bullet + two known-gaps appends.
- `docs/CONTEXT.md` § How to update carries the falsification line.
- `dispatch.md` parity applied, or explicitly waived with reason in the report.
- Build/lint green; no app code touched.

---

## Known gaps in THIS brief (self-critique — dogfooding the gate it adds)
1. House Phases 0–6 format was reconstructed from prior sessions, not read from the live `kickoff-template.md` (snapshot still showed the older Step-0/Option-A-B structure) — Phase 0 reconciles.
2. Live Methodology Rule numbers unverified (snapshot max 17; live known ahead) — pushed to Phase 1 #1.
3. `dispatch.md` / `post-merge.md` not in the working snapshot — the parity edit is conditional, not confirmed needed (Phase 1 #2).
4. The three rule wordings are a starting draft; not collision-checked against existing rule phrasing — CC/operator may tighten for the house terseness convention.

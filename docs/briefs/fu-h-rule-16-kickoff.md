# FU-H: Promote post-merge fill scope to canonical Rule 16

**Type:** Methodology PR (LOW severity)
**Shape:** XS, doc-only. Single-file edit to CLAUDE.md (add Rule 16, anchor tweak at line 344). Plus the FU-H demonstration scope: fix CONTEXT.md top-table staleness (currently 3 PRs stale at HEAD) in the same commit.
**Reference shape:** Similar to past methodology PRs (e.g., the CLAUDE.md batch in PR #168).
**Banking origin:** FU-H banked from 2026-05-17 methodology batch audit; three design options banked. This PR picks **Option 3 (promote to Rule 16)** per the 2026-05-17 FU-H audit's Section 5 recommendation. Audit findings are project-scoped retrievable via `conversation_search` for "FU-H audit Rule 16".

---

## Architectural decision (locked at brief authoring time)

**Option 3 selected.** Justification:

- Closes the immediate gap (top-table staleness, currently reproducing live) AND resolves the standing "Rule 4 shorthand" terminology drift that Rule 15:503 explicitly flags as unresolved. The FU-H body's own banking note says Option 3 "resolves both this gap and the 'Rule 4 shorthand' terminology drift simultaneously" — bundling is the design intent.
- Option 1 leaves the shorthand drift unresolved (negative instruction only — "don't use Rule 4 shorthand") and visually buries the new mandate in a 5-bullet cleanup section.
- Option 2 duplicates content already split across Rules 7, 8, and § Post-merge local cleanup, inviting three-surface drift over time.
- Option 3 fits the existing rule cadence (Rule 16 follows Rule 15 with no gap), self-applies via CC's standing read of CLAUDE.md, and gives briefs a stable numeric anchor forever.

Counterargument considered: minimum-surface-area preference favors Option 1. Rejected because the +6 lines vs. Option 1 buys terminology drift resolution that prevents future brief-author confusion.

## Source-verified state (from FU-H audit)

- Session Protocol step 9.5 anchored at CLAUDE.md:326–327 (no fill-scope mandate present).
- § Post-merge local cleanup at CLAUDE.md:329–344 (mandates branch/file mechanics; no top-table mandate).
- CLAUDE.md:344 currently reads: `Rule 15 governs the origin-verification step for any commit produced by this sequence.`
- CLAUDE.md:503 (Rule 15 "Note on terminology") explicitly flags "Rule 4 shorthand" as carrying-forward-prohibited but does NOT give the sequence a replacement anchor.
- Existing rules 1–15 enumerated and stable; slot **16** is the next sequential number with no collision.
- CONTEXT.md top-table at HEAD shows `Current main HEAD = 3ae762c` (PR #183) — actual is `903486f` — **3 PRs of staleness** (#184, #185, #186 all merged without top-table updates). Live evidence.

---

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`
2. `git checkout main && git pull --ff-only origin main`
3. `git log origin/main --oneline -1` — capture verbatim. Expected: this brief's docs PR squash commit (the brief-docs PR landing before this work PR).
4. `git checkout -b chore/fu-h-rule-16`
5. Any failure or drift → **STOP and wait for dispatcher.**

## Phase 1 — re-verify FU-H audit findings (Rule 11)

The audit was thorough; these checks are spot-confirmations that nothing has shifted between the audit and execution.

1. Read CLAUDE.md and confirm:
   - Session Protocol step 9.5 still at CLAUDE.md:326–327 (or nearby — capture actual current line).
   - § Post-merge local cleanup section still at CLAUDE.md:329–344 (or nearby — capture actual current line range).
   - Line ~344 still anchors to Rule 15 only (no Rule 16 reference yet).
   - Rule 15 "Note on terminology" still flags "Rule 4 shorthand" as unresolved (line ~503).
   - Existing rules end at Rule 15 (no Rule 16 already present).
2. Read CONTEXT.md top-table. Confirm `Current main HEAD` is still stale relative to actual `git log origin/main --oneline -1`. If somehow already current (e.g., previous PR added a Rule 16 ahead of FU-H), **STOP and wait for dispatcher**.
3. If any audit claim has shifted materially → **STOP and wait for dispatcher**.

## Phase 2 — execute

### 2a. Add Rule 16 to CLAUDE.md

Append the following block after Rule 15's body (before any subsequent section, if one exists; otherwise as the new tail of the numbered rules list). Match the formatting cadence of Rules 1–15 (`###` heading, prose body, optional sub-headings).

```markdown
### 16. Post-merge fill scope is canonical

The post-merge cleanup sequence (Session Protocol step 9.5 + § Post-merge local cleanup) MUST update the following in `docs/CONTEXT.md` as part of every cycle, regardless of whether the work brief's Phase 4 specified them:

- **Current main HEAD** — squash SHA of the fill commit (or the work PR squash if no fill commit was needed).
- **Active track** — identifier of the just-shipped work.
- **Next track** — remove items that just shipped; promote the next-up item, or note "(queue clear)" if none.
- **"Where we left off"** prose — one-line summary of the just-shipped PR and what's next.
- **Last updated** — ISO date of the fill commit.

Any `#TBD` or `{TBD}` placeholders introduced in the work PR's Phase 4 are filled with the work PR's number and squash SHA (the pre-existing mechanic, now consolidated under Rule 16).

**Terminology resolution.** Some prior briefs used "Rule 4 shorthand" to refer to this sequence; that collides with canonical Rule 4 (env-listing safety) and is retired. Briefs and dispatches cite **Rule 16** when referencing the post-merge fill scope.

**Verification anchor.** Rule 15 (origin-verification) verifies the push produced by Rule 16's fill commit.
```

### 2b. Anchor tweak at CLAUDE.md:344

Locate the line in § Post-merge local cleanup that currently reads (or equivalent):

> Rule 15 governs the origin-verification step for any commit produced by this sequence.

Replace with:

> Rule 16 governs the fill scope for this sequence; Rule 15 governs the origin-verification step for any commit produced by it.

If the line wording differs at execution time (due to CLAUDE.md edits since the audit), apply the spirit of the tweak: cite Rule 16 alongside Rule 15 in the same anchor sentence.

### 2c. Fix current CONTEXT.md top-table staleness (the demonstration case)

Update CONTEXT.md top-table fields to reflect the current accurate state at branch base:

- **Current main HEAD** → SHA captured from Phase 0 step 3 (the brief-docs PR's squash, or whatever `git log origin/main --oneline -1` returned).
- **Active track** → "FU-G shipped (PR #186, squash `bd238d2`, fill commit `903486f`). FU-H methodology PR (this PR) in progress."
- **Next track** → "FU-H Rule 16 work PR (this PR) — promote post-merge fill scope to canonical Rule 16; fix current top-table staleness as demonstration case."
- **"Where we left off"** prose → "FU-G script-local READMEs (LOW closure) shipped clean — five consecutive clean Rule 15 dogfoods. FU-H Rule 16 methodology PR is the active track: adds canonical Rule 16 for post-merge fill scope and retires the 'Rule 4 shorthand' terminology drift flagged by Rule 15:503."
- **Last updated** → `2026-05-17`

These edits are Phase 2c, NOT Phase 4 (Phase 4 below adds a recently-shipped row for FU-H itself with TBD placeholders).

## Phase 3 — verify

1. `git diff --stat` shows exactly two changed entries: `M CLAUDE.md` (Rule 16 added + anchor tweak), `M docs/CONTEXT.md` (top-table fix + Phase 4 row from below). Nothing else. Anything outside this → **STOP and wait for dispatcher.**
2. `git diff main -- .env.example` returns empty (no credential-doc touch).
3. Read CLAUDE.md Rule 16 + anchor tweak end-to-end. Confirm:
   - Rule 16 heading is `### 16. Post-merge fill scope is canonical` (or the exact form matching adjacent rules).
   - All five top-table fields enumerated.
   - Terminology resolution paragraph present, naming Rule 16 as the replacement.
   - Verification anchor paragraph references Rule 15.
4. Read CONTEXT.md top-table end-to-end. Confirm all five fields updated to non-stale values matching Phase 2c.
5. Run `npm run lint` for parity (no source touched, no errors expected).

## Phase 4 — docs placeholder fill (in same commit)

Add a recently-shipped row to `docs/CONTEXT.md` for FU-H itself:

- Format must match the existing recently-shipped rows in CONTEXT.md (capture the existing row format during Phase 1).
- Use `#{TBD}` for PR number and `{TBD}` for squash SHA.
- One-line summary: "FU-H methodology (LOW closure): Rule 16 added to CLAUDE.md mandating post-merge fill scope (Current main HEAD, Active track, Next track, Where we left off, Last updated). Anchor tweak at CLAUDE.md:344 cites Rule 16 alongside Rule 15. Retires 'Rule 4 shorthand' terminology drift flagged by Rule 15:503. Top-table staleness demonstrated and fixed in same commit."

Phase 4 here does **not** update the top-table further (Phase 2c already did the fix-current-staleness work). The top-table will be updated again in Phase 6 to reflect FU-H having shipped — that's the canonical demonstration of Rule 16.

## Phase 5 — commit, push, open PR

1. `git add CLAUDE.md docs/CONTEXT.md`
2. Commit message: `docs(methodology): add Rule 16 (post-merge fill scope) + fix CONTEXT.md top-table staleness (FU-H)`
3. `git push -u origin chore/fu-h-rule-16`
4. Open PR against main. Title: `docs(methodology): add Rule 16 — post-merge fill scope is canonical (FU-H)`. Body must include:
   - Reference to this brief at `docs/briefs/fu-h-rule-16-kickoff.md`.
   - Link to FOLLOW_UPS.md FU-H entry.
   - Explicit note: "Implementation scope intentionally includes fix-current-staleness alongside the Rule 16 addition, per FU-H audit Section 6 #1. Rule 16's effectiveness will be canonically demonstrated by the Phase 6 post-merge fill of this PR — that is the first Rule 16 application in the wild."
   - Phase 1 findings section, if any divergences from audit were caught during re-verification.
5. Report PR URL + branch HEAD SHA to dispatcher.

## Phase 6 — post-merge cleanup (the first canonical Rule 16 application)

**This Phase 6 IS Rule 16 in action.** If it executes correctly, Rule 16 is self-validating. If it fails, Rule 16 needs immediate iteration.

Standard sequence per Session Protocol step 9 + § Post-merge local cleanup, governed by Rule 16:

1. `git checkout main && git fetch origin && git pull --ff-only origin main`
2. Capture work PR squash SHA: `git log origin/main --oneline -1` — paste verbatim to dispatcher.
3. **Rule 16 fill scope (mandatory):**
   - `docs/CONTEXT.md` recently-shipped row: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
   - `docs/CONTEXT.md` top-table `Current main HEAD` → SHA of the fill commit being produced (you'll know after step 5; use the post-push value here in a second-pass commit if needed, OR pre-compute by knowing your fill commit will sit at HEAD after step 6).
   - `docs/CONTEXT.md` top-table `Active track` → "FU-H Rule 16 shipped (PR #{N}, squash {SHA}). Methodology canon updated; top-table self-heals from here forward."
   - `docs/CONTEXT.md` top-table `Next track` → "(queue clear)" — FU-G shipped, FU-H shipped, FU-F deferred to dedicated session, FU-I deferred post-pilot.
   - `docs/CONTEXT.md` top-table `Where we left off` → "FU-H Rule 16 methodology landed. Top-table is now self-healing on every post-merge cycle. Backlog: FU-F (dedicated session), FU-I (post-pilot), and end-of-day banking decisions on brief-authoring-source-verification + local docs/* branch cleanup."
   - `docs/CONTEXT.md` top-table `Last updated` → `2026-05-17`.
   - `docs/FOLLOW_UPS.md` — if FU-H has its own banking entry, replace it with a resolved-block matching the FU-D/FU-E/FU-G pattern.
4. `git add docs/CONTEXT.md docs/FOLLOW_UPS.md`
5. Commit: `docs: fill PR #{N} placeholders (FU-H closure) — first Rule 16 application`
6. `git push origin main`
7. **Rule 15 verification (mandatory, unchanged):**
   - `git fetch origin && git log origin/main --oneline -1` — paste verbatim.
   - `git rev-parse HEAD && git rev-parse origin/main` — paste verbatim.
   - Confirm: local HEAD == origin/main, subject matches the fill commit, work PR squash SHA sits directly below.
   - Report "pushed and verified" with all SHAs visible.
   - Any mismatch → **STOP and wait for dispatcher.** Hard-stop.
8. **Rule 16 self-validation report** (new for this PR): paste the final CONTEXT.md top-table contents verbatim to dispatcher. Dispatcher will confirm all five Rule 16 fields are non-stale. If any field still shows stale data → Rule 16 needs immediate iteration; **STOP and wait for dispatcher**.
9. Worktree cleanup (optional): delete `chore/fu-h-rule-16` locally + remote.

---

## Acceptance criteria

- CLAUDE.md contains a Rule 16 block meeting the spec in Phase 2a (heading, five-field enumeration, terminology paragraph, verification anchor).
- CLAUDE.md:344 (or equivalent anchor line) cites Rule 16 alongside Rule 15.
- CONTEXT.md top-table is non-stale post-Phase 2c (Current main HEAD matches branch base; Active track + Next track + Where we left off + Last updated all current).
- `git diff main..HEAD -- .env.example` returns empty.
- Phase 6 post-merge fill executes Rule 16 successfully — all five top-table fields updated in the fill commit, validated by the Phase 6 step 8 dispatcher check.

## Out of scope

- FU-F implementation (deferred to dedicated session per FU-F audit recommendation).
- FU-I (TENANT_ID parameterization, deferred post-pilot).
- Brief-authoring source-verification methodology banking (4-instance pattern across FU-G + FU-F; deferred to end-of-day decision — possibly FU-J).
- Local docs/* branch cleanup sweep (11 stale branches noted at FU-G close; deferred to end-of-day decision).
- Any edits to Rules 1–15 beyond the line 344 anchor tweak.

## Rule references

- **Rule 9** — Phase 0 git fetch + branch-off-main gate.
- **Rule 10** — This brief commits to `docs/briefs/` via a small docs PR BEFORE CC dispatch.
- **Rule 11** — Phase 1 re-verifies the audit's source captures.
- **Rule 12** — Hard-stop language used throughout.
- **Rule 15** — Phase 6 step 7 origin verification (unchanged from prior PRs).
- **Rule 16 (this PR)** — Phase 6 step 3 is the first canonical application; Phase 6 step 8 validates it.

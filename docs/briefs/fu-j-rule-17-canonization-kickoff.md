# FU-J: Promote brief/rule authoring source-verification discipline to canonical Rule 17

**Type:** Methodology PR (LOW severity)
**Shape:** XS, doc-only. Single-file edit to CLAUDE.md (add Rule 17 after Rule 16, update meta-paragraph at line 359 to include Rules 16 + 17 entries).
**Reference shape:** Mirrors PR #188 / FU-H Rule 16 brief (the precedent). `docs/briefs/fu-h-rule-16-kickoff.md`.
**Banking origin:** FU-J banked from PR #190 (2026-05-17, `54c7d1c`). FU-J body lives at `docs/FOLLOW_UPS.md` lines 1754–1774 with six enumerated instances + proposed Rule 17 substance.

---

## Architectural decision (locked at brief authoring time)

**Add Rule 17 as new methodology requirement, with meta-paragraph catch-up in same commit.** Justification:

- The six-instance pattern is real, banked, and surfaced 1–2 days ago; freshness still acute. Canonization now closes the loop while context is hot.
- Rule 11 already exists for the *specific* case (FU-body diagnoses). Rule 17 is the *general* principle (all source-derived claims in briefs and rule wording). The brief locks: cite Rule 11 when the FU-body diagnosis itself is the gap; cite Rule 17 otherwise. No collision.
- Meta-paragraph at CLAUDE.md:359 currently enumerates rule additions through Rule 15 only — Rule 16's addition in PR #188 missed updating it. FU-J brief catches this drift at authoring time (a Rule 17 application in itself) and absorbs the 1-line catch-up in the same commit. Doing so demonstrates Rule 17's value and prevents a second drift accumulating.
- Same-commit shape (Rule 17 addition + meta-paragraph catch-up) matches FU-H's pattern of bundling a demonstration case with the rule addition. Splitting would be over-engineering for two single-line edits to the same file.

**Counterargument considered:** could leave the meta-paragraph alone and defer to a separate "stale-row sweep" PR (which would also catch FU-H's missing RESOLVED footer in FOLLOW_UPS.md). Rejected because (a) the meta-paragraph drift is in the same file as Rule 17's addition, so absorbing costs ~1 line of diff; (b) leaving it unmarked invites a third drift if Rule 18 ever lands.

**FU-H's missing RESOLVED footer in FOLLOW_UPS.md (lines 1735–1750) is OUT OF SCOPE.** That's a FOLLOW_UPS.md edit, not a CLAUDE.md edit, and tracking it via FU-J would conflate scopes. Flagged separately for a future small docs PR or stale-row sweep.

---

## Source-verified state (at brief authoring time, 2026-05-18)

Each anchor below was confirmed against fresh uploads of `CLAUDE.md`, `docs/FOLLOW_UPS.md`, `docs/CONTEXT.md` as of `c113d41` HEAD.

- **CLAUDE.md line 521** = end of Rule 16 body (`**Verification anchor.** Rule 15 (origin-verification) verifies the push produced by Rule 16's fill commit.`).
- **CLAUDE.md line 522** = blank line.
- **CLAUDE.md line 523** = `---` section terminator marking end of `## Methodology requirements` section before `## Banked patterns (also from 2026-05-14 session)` at line 525.
- **Rule 17 slot:** insert as new `### 17. ...` block between line 521 (end of Rule 16) and line 523 (`---`). No `---` separator between Rules 16 and 17, matching the Rule 15↔16 cadence.
- **CLAUDE.md line 359** = methodology requirements meta-paragraph; current enumeration cuts at Rule 15 ("rule 15 added 2026-05-17 from PR #176 silent-push recovery arc"). No Rule 16 entry.
- **FU-J body** at `docs/FOLLOW_UPS.md` lines 1754–1774 enumerates six instances; substance for Rule 17 proposed in body's "Proposed resolution" section (lines 1769–1771).
- **Rule 11 body** at CLAUDE.md lines 448–458 specifically addresses FU-body diagnosis claims. Rule 17 generalizes to all source-derived claims in any brief or rule wording.
- **Existing rule cadence:** `### N. Title` heading → opening sentence → optional bullet list → continuation paragraph → optional "Banked from PR #X (date/context)" closure. Rules 11, 14, 15, 16 all follow this shape. Rule 17 will match.
- **FU-G RESOLVED pattern** at `docs/FOLLOW_UPS.md` lines 1694–1713 is the closure shape for FU-J's Phase 4 FOLLOW_UPS.md update: title gets `(LOW, RESOLVED YYYY-MM-DD)` suffix, banking content preserved verbatim, new `**Resolved in PR #{N}** (\`{SHA}\`, YYYY-MM-DD).` paragraph appended.
- **CONTEXT.md recently-shipped row format** at lines 124–130 is `| #N | \`SHA\` | Description |` markdown table row.

---

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`
2. `git checkout main && git pull --ff-only origin main`
3. `git log origin/main --oneline -1` — capture verbatim. Expected: this brief's docs PR squash commit (the brief-docs PR landing before this work PR per Rule 10).
4. `git checkout -b chore/fu-j-rule-17`
5. Any failure or drift → **STOP and wait for dispatcher.**

## Phase 1 — re-verify FU-J audit findings (Rule 11)

The brief's source-verified state was captured 2026-05-18 against `c113d41`; these checks confirm nothing has shifted between brief commit and execution.

1. Read CLAUDE.md and confirm:
   - Rule 16 body still ends near line 521 with the `**Verification anchor.** Rule 15 (origin-verification) ...` paragraph. Capture actual current line number.
   - The `---` section terminator still follows immediately after Rule 16 (no Rule 17 already present).
   - Meta-paragraph near line 359 still enumerates rule additions ending at Rule 15 (no Rule 16 entry, no Rule 17 entry).
   - Rule 11 (FU body re-audit) still present at lines ~448–458.
   - Rules 1–16 present and stable.
2. Read FOLLOW_UPS.md FU-J body (lines ~1754–1774) and confirm the six enumerated instances are unchanged.
3. Read FOLLOW_UPS.md FU-G RESOLVED pattern (lines ~1694–1713) and capture the exact closure-paragraph format for use in Phase 4.
4. Read CONTEXT.md top-table and recently-shipped section; capture current row format from line ~124–130.
5. If any audit claim has shifted materially → **STOP and wait for dispatcher.**

## Phase 2 — execute

### 2a. Add Rule 17 to CLAUDE.md

Insert the following block after Rule 16's `**Verification anchor.**` paragraph, before the `---` section terminator. Match the formatting cadence of Rules 11, 14, 15, 16 (`###` heading, opening sentence, bullet list, continuation paragraphs, "Banked from" closure).

```markdown
### 17. Source verification at authoring time

When a brief or methodology rule describes source behavior — default behavior, example values, command syntax, file paths, line numbers, existing structural format — the author MUST verify each claim against current source BEFORE locking the brief's "Decisions locked" section or proposing rule wording. Specifically:

- **Default behavior / fallback claims:** grep or read the consumer site; never paraphrase from memory.
- **Example values:** trace through actual call sites (scheme prefixes, separator characters, escape rules, units). Operator copy-paste must work verbatim.
- **File paths and line numbers:** open the file and confirm; line numbers drift between sessions.
- **Existing structural format:** read the existing target document end-to-end before prescribing changes (table cadence, paragraph count, heading levels).
- **Operational possibility of proposed wording:** for rule additions, mentally simulate the rule's first execution and check for chicken-and-egg conditions (e.g., "fill commit SHA captured before fill commit exists").

Rule 11 is the specific case of this discipline for FU-body diagnoses; Rule 17 is the general principle applied to all source-derived claims in briefs and rule wording. Cite Rule 11 when the FU-body diagnosis itself is the gap; cite Rule 17 otherwise.

Phase 1 audits remain the execution-time safety net (per Rule 11's "re-audit before first work" and existing Phase 1 gates in every brief). Rule 17 shifts the primary verification surface to authoring time — Phase 1 catches what authoring missed, not what authoring shouldn't have written.

Banked from PR #{TBD} (2026-05-18). Six instances surfaced 2026-05-17 across FU-G + FU-F + FU-H briefs and Rule 16 wording; enumerated in `docs/FOLLOW_UPS.md` FU-J body at banking time (PR #190, `54c7d1c`).
```

### 2b. Meta-paragraph catch-up at CLAUDE.md:359

Locate the methodology requirements meta-paragraph (currently at line ~359). Current text ends:

> ...rule 14 added 2026-05-16 from env-credentials propagation audit closure; rule 15 added 2026-05-17 from PR #176 silent-push recovery arc). Apply on every CC brief and dispatch.

Replace the closing portion to extend the enumeration through Rules 16 and 17:

> ...rule 14 added 2026-05-16 from env-credentials propagation audit closure; rule 15 added 2026-05-17 from PR #176 silent-push recovery arc; rule 16 added 2026-05-17 from FU-H methodology PR (#188) — post-merge fill scope canonization; rule 17 added 2026-05-18 from FU-J methodology PR — source verification at authoring time). Apply on every CC brief and dispatch.

The PR # for Rule 17's entry stays as literal `FU-J methodology PR` (no `#{TBD}` token here) — Phase 6 fill replaces this with `(#{N})` once the squash SHA is captured.

If the meta-paragraph wording differs at execution time from the audit capture, apply the spirit: enumeration must extend to cover both Rules 16 and 17 with their banking dates and PR contexts.

## Phase 3 — verify

1. `git diff --stat` shows exactly one changed entry: `M CLAUDE.md`. Anything else → **STOP and wait for dispatcher.**
2. `git diff main -- docs/CONTEXT.md docs/FOLLOW_UPS.md` is empty at this point (Phase 4 will add those changes; Phase 3 verifies Phase 2 in isolation). If you have already done Phase 4 by this point, re-order the verification.
3. `git diff main -- .env.example` returns empty (no credential-doc touch).
4. Read CLAUDE.md Rule 17 block end-to-end. Confirm:
   - Heading is `### 17. Source verification at authoring time`.
   - Five-bullet list present (default behavior, example values, file paths, structural format, operational possibility).
   - Rule 11 carve-out paragraph present.
   - Phase 1 safety-net paragraph present.
   - "Banked from PR #{TBD}" closure present with `{TBD}` literal.
5. Read CLAUDE.md meta-paragraph at line ~359. Confirm enumeration now includes Rule 16 + Rule 17 entries.
6. Run `npm run lint`. No source touched → 0 problems expected.
7. Run `npm run build`. No source touched → clean build expected.

## Phase 4 — docs placeholder fill (in same commit as Phase 2)

### 4a. Update FOLLOW_UPS.md FU-J entry

Match the FU-G RESOLVED pattern at lines 1694–1713. Specifically:

1. Update FU-J heading from:
   ```
   ### FU-J — Brief and rule authoring source-verification discipline (LOW, methodology, banked 2026-05-17)
   ```
   to:
   ```
   ### FU-J — Brief and rule authoring source-verification discipline (LOW, methodology, RESOLVED 2026-05-18)
   ```
2. Preserve the entire existing body (Surface, Specific instances 1–6, Proposed resolution, Severity, Sequencing) verbatim — this is the drift trail.
3. Append a new closure paragraph after the existing "Sequencing" line, in this shape:

   ```
   **Resolved in PR #{TBD}** (`{TBD}`, 2026-05-18). Rule 17 added to `CLAUDE.md` mandating source-verification at brief- and rule-authoring time for behavioral/example/format/path claims. Five-bullet enumeration covers default behavior, example values, file paths, structural format, and operational possibility of proposed wording. Rule 11 explicitly carved out as the specific case for FU-body diagnoses. Meta-paragraph at `CLAUDE.md:359` extended in same commit to cover both Rule 16 (missed during PR #188) and Rule 17 entries.
   ```

### 4b. Add CONTEXT.md recently-shipped row

Match the recently-shipped row format at CONTEXT.md lines 124–130 (`| #N | \`SHA\` | Description |`).

Insert a new row at the top of the recently-shipped table:

```
| #{TBD} | `{TBD}` | FU-J methodology (LOW closure): Rule 17 added to `CLAUDE.md` mandating brief/rule source-verification at authoring time (default behavior, example values, file paths, structural format, operational possibility). Rule 11 carved as specific case for FU-body diagnoses. Meta-paragraph at line 359 extended to cover Rules 16 + 17 (caught Rule 16 catch-up drift from PR #188). Single-file CLAUDE.md edit. |
```

Drop the oldest row if the recently-shipped table is over 5 entries.

### 4c. Top-table / "Where we left off" updates are Phase 6 (Rule 16)

Per Rule 16, the post-merge fill cycle handles top-table (`Current main HEAD`, `Active track`, `Next track`, "Where we left off", `Last updated`). Do NOT update those in Phase 4. They get updated in Phase 6.

## Phase 5 — commit, push, open PR

1. `git add CLAUDE.md docs/CONTEXT.md docs/FOLLOW_UPS.md`
2. Commit message: `docs(methodology): add Rule 17 (source verification at authoring time) + meta-paragraph catch-up for Rule 16 (FU-J)`
3. `git push -u origin chore/fu-j-rule-17`
4. Open PR against main. Title: `docs(methodology): add Rule 17 — source verification at authoring time (FU-J)`. Body must include:
   - Reference to this brief at `docs/briefs/fu-j-rule-17-canonization-kickoff.md`.
   - Link to FOLLOW_UPS.md FU-J entry.
   - Explicit note: "Implementation scope intentionally includes the CLAUDE.md:359 meta-paragraph catch-up for Rule 16 (missed during PR #188's Phase 2 spec) alongside the Rule 17 addition. This catch-up is itself a Rule 17 application (drift caught at authoring time, before the rule lands)."
   - Phase 1 findings section, if any divergences from this brief's source-verified state were caught during re-verification.
5. Report PR URL + branch HEAD SHA to dispatcher.

## Phase 6 — post-merge cleanup (third canonical Rule 16 application)

Standard sequence per Session Protocol step 9 + § Post-merge local cleanup + Rule 16.

1. `git checkout main && git fetch origin && git pull --ff-only origin main`
2. Capture work PR squash SHA: `git log origin/main --oneline -1` — paste verbatim to dispatcher.
3. **Rule 16 fill scope (mandatory):**
   - `CLAUDE.md` Rule 17 "Banked from" line: replace `#{TBD}` with the actual work PR number.
   - `CLAUDE.md:359` meta-paragraph: replace `FU-J methodology PR` with `FU-J methodology PR (#{N})` using the actual work PR number.
   - `docs/CONTEXT.md` recently-shipped row: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
   - `docs/CONTEXT.md` top-table `Current main HEAD` → the work PR's squash SHA (per Rule 16's corrected wording — anchors on work-PR squash, NOT the fill commit). Captured in step 2.
   - `docs/CONTEXT.md` top-table `Active track` → "FU-J Rule 17 shipped (PR #{N}, squash {SHA}). Source-verification discipline now canonical."
   - `docs/CONTEXT.md` top-table `Next track` → "FU-K stale branch cleanup sweep (XS) — first canonical Rule 17 application in the wild during FU-K brief drafting."
   - `docs/CONTEXT.md` top-table `Where we left off` → updated prose covering FU-J shipped + FU-K queued + any session-context that's pertinent.
   - `docs/CONTEXT.md` top-table `Last updated` → ISO date of fill commit (e.g., `2026-05-18`).
   - `docs/FOLLOW_UPS.md` FU-J entry: replace `#{TBD}` and `{TBD}` in the closure paragraph with actual PR number + squash SHA.
4. `git add CLAUDE.md docs/CONTEXT.md docs/FOLLOW_UPS.md`
5. Commit: `docs: fill PR #{N} placeholders (FU-J closure) — third Rule 16 application`
6. `git push origin main`
7. **Rule 15 verification (mandatory, unchanged):**
   - `git fetch origin && git log origin/main --oneline -1` — paste verbatim.
   - `git rev-parse HEAD && git rev-parse origin/main` — paste verbatim.
   - Confirm: local HEAD == origin/main, subject matches the fill commit, work PR squash SHA sits directly below.
   - Report "pushed and verified" with all SHAs visible.
   - Any mismatch → **STOP and wait for dispatcher.** Hard-stop.
8. Worktree cleanup (optional, deferred to FU-K's sweep): the just-created `chore/fu-j-rule-17` branch will be caught by FU-K's `git branch --merged main` enumeration when FU-K executes. No per-PR cleanup needed.

---

## Acceptance criteria

- `CLAUDE.md` contains a Rule 17 block meeting the spec in Phase 2a (heading, five-bullet enumeration, Rule 11 carve-out paragraph, Phase 1 safety-net paragraph, "Banked from" closure).
- `CLAUDE.md:359` meta-paragraph extends enumeration to cover Rules 16 and 17 with banking dates and PR contexts.
- `git diff main..HEAD` shows exactly three modified files: `M CLAUDE.md`, `M docs/CONTEXT.md`, `M docs/FOLLOW_UPS.md`. Nothing else.
- `git diff main..HEAD -- .env.example` returns empty.
- `npm run lint` returns 0 problems.
- `npm run build` completes clean.
- Phase 6 post-merge fill executes Rule 16 successfully — all five top-table fields updated; Rule 17 + meta-paragraph + CONTEXT.md + FOLLOW_UPS.md placeholders all filled with actual PR number and squash SHA.

## Out of scope

- **FU-H FOLLOW_UPS.md missing RESOLVED footer** (lines 1735–1750). Stale-row drift from PR #188 Phase 6. Worth a separate small docs PR or stale-row sweep; do NOT absorb into this PR.
- **FU-K execution** (stale branch cleanup sweep). Chains after this PR per session plan; will be the first canonical Rule 17 application in the wild during FU-K brief drafting.
- **Existing untracked files in working tree** (~14 files, ~9 stale briefs + 5 verification scripts). Covered by separate 2026-05-13 banked FU ("Untracked legacy briefs + verification scripts cleanup") and listed under CONTEXT.md "Pending operational state." Not in FU-J's or FU-K's scope.
- **Any edits to Rules 1–16** beyond the meta-paragraph catch-up at line 359.

## Rule references

- **Rule 9** — Phase 0 git fetch + branch-off-main gate.
- **Rule 10** — This brief commits to `docs/briefs/` via a small docs PR BEFORE CC dispatch.
- **Rule 11** — Phase 1 re-verifies the brief's source-verified state. Rule 17 (this PR) is the general principle; Rule 11 is the specific case for FU-body diagnoses.
- **Rule 12** — Hard-stop language used throughout (only "STOP and wait for dispatcher" appears as a halt condition).
- **Rule 15** — Phase 6 step 7 origin verification (unchanged from prior PRs).
- **Rule 16** — Phase 6 fill scope. This PR's Phase 6 is the third canonical Rule 16 application (after PR #188 first and PR #190 second).
- **Rule 17 (this PR)** — applied at brief authoring time during this brief's drafting (source-verified anchors enumerated above); becomes canonical in CLAUDE.md when this PR merges.

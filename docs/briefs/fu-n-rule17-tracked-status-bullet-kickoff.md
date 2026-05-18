# FU-N: Rule 17 sub-bullet — pair `grep` with `git ls-files` for tracked-status enumeration

**Type:** Implementation PR (LOW methodology refinement)
**Shape:** XS, 3-file commit (1 CLAUDE.md edit + 2 docs).
**Reference shape:** Smaller than FU-J methodology PR (FU-J canonized Rule 17 itself). FU-N refines one sub-discipline of Rule 17 with a single new bullet.
**Banking origin:** FU-N banked 2026-05-18 in FU-F-2 Phase 4b (FOLLOW_UPS.md). Surfaced during FU-M execution Phase 1 (PR #202) — `multi-role-smoke.cjs` discovered as excluded-not-tracked, exposing that the FU-F audit's `grep`-based enumeration had counted untracked + excluded files as migration targets. Knock-on dispatcher miscount in FU-M closure ("6") corrected during FU-F-2 brief authoring to actual ("5").

---

## Architectural decision (locked at brief authoring time, source-verified against `45af029`)

**Add ONE new sub-bullet to Rule 17's bullet list at position 4 (between "File paths and line numbers" and "Existing structural format").**

The new bullet matches existing style (`- **Label:** detail.`) and reads:

```
- **Enumeration tracked-status:** when listing files via `grep -rn` to scope a migration or audit, pair with `git ls-files` (or use `git grep`) to filter to tracked-only paths. Untracked or excluded files appear in `grep` output but are not part of canonical repo state, and silently inflate migration-target counts in briefs.
```

**Position rationale:** the existing bullet sequence progresses from abstract→concrete (default behavior → example values → file paths → structural format → operational simulation). The new bullet is meta to "File paths and line numbers" — it's about whether a file IS in canonical repo state at all, which naturally chains after the per-file confirmation discipline. Going to position 4 (after "File paths") keeps the abstract→concrete progression intact.

**Wording rationale:**
- "Enumeration tracked-status" — terse label matching existing two-or-three-word labels (Default behavior / Example values / File paths / Existing structural / Operational possibility).
- "`grep -rn` to scope a migration or audit" — concrete usage that triggered this discipline (FU-F audit scoping; FU-M discovery).
- "pair with `git ls-files` (or use `git grep`)" — two acceptable solutions per FU-N body's "Proposed fix".
- "silently inflate migration-target counts in briefs" — concrete consequence, references the FU-M / FU-F-2 miscount story without naming PRs (CLAUDE.md should stay PR-agnostic per existing style).

**Counterarguments considered:**
- *Bank as separate "Methodology Patterns" note* (one of FU-N body's options) — rejected. CLAUDE.md Rule 17 is the canonical home for source-verification discipline; splitting refinements into a separate document fragments where contributors look. One-location-rule wins.
- *Add as new Rule 18* — rejected. The discipline is a special case of Rule 17 (verify file claims against source), not a distinct rule. Sub-bullet is the correct granularity.
- *Update line 537 "Banked from PR #192" with a "Refined in PR #{TBD}" addendum* — rejected. The banking line documents original canonization. Sub-bullet additions don't change the canonization fact; git history captures refinements. Adding a refinement log to every rule would clutter CLAUDE.md over time.

---

## Source-verified state (at brief authoring time, 2026-05-18)

Confirmed against repo HEAD `45af029` (post-FU-F-2 Phase 6 fill). Kyron pasted current CLAUDE.md contents during brief authoring per Rule 17 self-application.

- **Rule 17** at CLAUDE.md lines 523-537. Heading: `### 17. Source verification at authoring time`.
- **Existing bullet list** at lines 527-531 (5 bullets):
  1. **Default behavior / fallback claims:** grep or read the consumer site; never paraphrase from memory.
  2. **Example values:** trace through actual call sites (scheme prefixes, separator characters, escape rules, units). Operator copy-paste must work verbatim.
  3. **File paths and line numbers:** open the file and confirm; line numbers drift between sessions.
  4. **Existing structural format:** read the existing target document end-to-end before prescribing changes (table cadence, paragraph count, heading levels).
  5. **Operational possibility of proposed wording:** for rule additions, mentally simulate the rule's first execution and check for chicken-and-egg conditions (e.g., "fill commit SHA captured before fill commit exists").
- **Line 533** Rule 11 vs Rule 17 disambiguation paragraph.
- **Line 535** Phase 1 safety-net paragraph.
- **Line 537** Banked from PR #192 line.
- **Line 539** `---` separator.
- **Line 541** `## Banked patterns` H2 (Rule 17 is currently the LAST rule).

**Rule heading style across CLAUDE.md:** all 17 rules use `### N. Title` (verified via grep on lines 361-523). Sub-bullets use `- **Label:** detail.` style throughout.

**Line numbers may drift** by the time CC executes — Phase 1 step 1 captures current line range, locks anchor.

---

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`
2. `git checkout main && git pull --ff-only origin main`
3. `git log origin/main --oneline -1` — capture verbatim. Expected: this brief's docs PR squash (per Rule 10).
4. `git checkout -b chore/fu-n-rule17-tracked-status-bullet`
5. Any failure or drift → **STOP and wait for dispatcher.**

## Phase 1 — re-verify CLAUDE.md Rule 17 structure (Rule 17 self-application)

This phase is the canonical Rule 17 application — we're refining Rule 17 itself, so source-verification is paramount.

1. Find Rule 17 heading line: `grep -n "^### 17\." CLAUDE.md` — should return exactly 1 hit. Capture line number.
2. Read CLAUDE.md from the Rule 17 heading line through the `## Banked patterns` H2 heading (or `---` separator preceding it). Capture verbatim.
3. Confirm the 5-bullet list matches brief's source-verified state EXACTLY (label text + bullet order). Specifically:
   - Bullet 1 label: "Default behavior / fallback claims"
   - Bullet 2 label: "Example values"
   - Bullet 3 label: "File paths and line numbers"
   - Bullet 4 label: "Existing structural format"
   - Bullet 5 label: "Operational possibility of proposed wording"
4. If any bullet label differs OR bullets are reordered OR additional bullets exist OR section has been edited since `45af029` → **STOP and wait for dispatcher.**
5. Confirm Rule 17 is the last `### N. Title` heading before `## Banked patterns` (no Rule 18 has been added).
6. Read `docs/FOLLOW_UPS.md` FU-N entry. Confirm:
   - Heading: `### FU-N — Audit enumeration: pair grep with git ls-files to distinguish tracked/untracked/excluded (LOW, methodology, banked 2026-05-18)`.
   - Status still "banked 2026-05-18" (not already RESOLVED or modified).
   - Body sections present (Surfaced / Mechanism / Proposed fix / Severity / Sequencing).
7. Any divergence from brief's source-verified state → **STOP and wait for dispatcher.**

## Phase 2 — execute

### 2a. Add new sub-bullet to CLAUDE.md Rule 17

Locate the existing bullet 3 (File paths and line numbers) in CLAUDE.md. Insert the NEW bullet immediately AFTER bullet 3 and BEFORE bullet 4 (Existing structural format).

**Exact insertion (verbatim):**

```
- **Enumeration tracked-status:** when listing files via `grep -rn` to scope a migration or audit, pair with `git ls-files` (or use `git grep`) to filter to tracked-only paths. Untracked or excluded files appear in `grep` output but are not part of canonical repo state, and silently inflate migration-target counts in briefs.
```

After insertion, the bullet list at lines (was 527-531, now 527-532 with 6 bullets) should read in this order:
1. **Default behavior / fallback claims:** ...
2. **Example values:** ...
3. **File paths and line numbers:** ...
4. **Enumeration tracked-status:** ... (NEW)
5. **Existing structural format:** ...
6. **Operational possibility of proposed wording:** ...

Use `str_replace` with the bullet 3 + bullet 4 pair as `old_str` and the bullet 3 + NEW bullet + bullet 4 trio as `new_str`. This anchors the insertion uniquely without depending on line numbers.

Do NOT modify any other Rule 17 content (intro paragraph, disambiguation paragraph, safety-net paragraph, banked-from line). Drift trail preserved.

## Phase 3 — verify

1. `git diff --stat HEAD` shows exactly 3 changed entries: `M CLAUDE.md`, `M docs/FOLLOW_UPS.md`, `M docs/CONTEXT.md`. Anything else → **STOP and wait for dispatcher.**
2. `git diff main..HEAD -- .env.example` returns empty (Rule 14 carve-out).
3. Read the modified Rule 17 section end-to-end. Confirm:
   - All 6 bullets present in correct order.
   - New bullet matches verbatim from Phase 2a Edit.
   - Original 5 bullets unchanged (label + detail text).
   - Intro paragraph + disambiguation paragraph + safety-net paragraph + banked-from line all intact.
4. `git diff main..HEAD -- CLAUDE.md` — should show exactly the new bullet's insertion (no surrounding text modified). Capture verbatim for Phase 5 report.
5. Run `npm run lint`. Expect 0 problems (docs-only changes, no JS touched).
6. Run `npm run build`. Expect clean.

**Smoke waiver per Rule 27:** docs-only methodology refinement. No code, no app behavior, no runtime impact. CLAUDE.md is reference documentation for the methodology arc; the canonical Rule 27 waiver carve-out for "pure docs commits" applies.

## Phase 4 — docs placeholder fill + banking (in same commit as Phase 2)

### 4a. FU-N RESOLVED block

1. Update FU-N heading from:
   ```
   ### FU-N — Audit enumeration: pair `grep` with `git ls-files` to distinguish tracked/untracked/excluded (LOW, methodology, banked 2026-05-18)
   ```
   to:
   ```
   ### FU-N — Audit enumeration: pair `grep` with `git ls-files` to distinguish tracked/untracked/excluded (LOW, methodology, RESOLVED 2026-05-18)
   ```
2. Preserve existing body (Surfaced / Mechanism / Proposed fix / Severity / Sequencing) verbatim — drift trail.
3. Append closure paragraph after "Sequencing" line:

   ```
   **Resolved in PR #{TBD}** (`{TBD}`, 2026-05-18). Added new sub-bullet to CLAUDE.md Rule 17 bullet list at position 4: "Enumeration tracked-status: when listing files via `grep -rn` to scope a migration or audit, pair with `git ls-files` (or use `git grep`) to filter to tracked-only paths. Untracked or excluded files appear in `grep` output but are not part of canonical repo state, and silently inflate migration-target counts in briefs." Closes the methodology gap surfaced via FU-M Phase 1 discovery (PR #202) + FU-F-2 brief authoring miscount (preserved as Rule 11 drift trail in FU-F-2 RESOLVED block per PR #204). **Seventh canonical Rule 17 in-the-wild signal — and the meta-application:** this very PR's brief was authored AFTER Kyron pasted current CLAUDE.md Rule 17 content (per Rule 17 itself), making FU-N the canonical example of source-verification at brief-authoring time refining the discipline it itself implements.
   ```

### 4b. Add CONTEXT.md recently-shipped row

Insert at top of CONTEXT.md recently-shipped table:

```
| #{TBD} | `{TBD}` | FU-N Rule 17 sub-bullet (LOW methodology refinement): added "Enumeration tracked-status" bullet at position 4 of Rule 17's bullet list — pairs `grep` with `git ls-files` (or `git grep`) for tracked-status filtering during file enumeration. Closes the methodology gap surfaced via FU-M discovery + FU-F-2 miscount. Self-applying: brief was authored against source-verified CLAUDE.md per Rule 17 itself. |
```

Drop oldest row if recently-shipped exceeds 5 entries.

### 4c. Top-table / "Where we left off" updates are Phase 6 (Rule 16)

Per Rule 16, the post-merge fill cycle handles top-table fields. Do NOT update those in Phase 4.

## Phase 5 — commit, push, open PR

1. `git add CLAUDE.md docs/FOLLOW_UPS.md docs/CONTEXT.md`
   (NOT `git add -A` — 14 pre-existing untracked files remain outside FU-N's scope.)
2. Commit message: `docs(methodology): FU-N Rule 17 sub-bullet — pair grep with git ls-files for tracked-status`
3. `git push -u origin chore/fu-n-rule17-tracked-status-bullet`
4. Open PR against main. Title: `docs(methodology): FU-N Rule 17 sub-bullet — pair grep with git ls-files for tracked-status`. Body must include:
   - Reference to this brief at `docs/briefs/fu-n-rule17-tracked-status-bullet-kickoff.md`.
   - Reference to FU-N entry in FOLLOW_UPS.md (now RESOLVED 2026-05-18).
   - Note: "Refines Rule 17's bullet list with one new sub-bullet at position 4. Closes the methodology gap surfaced via FU-M Phase 1 discovery (PR #202) + FU-F-2 brief authoring miscount. Self-applying meta-PR: brief itself was authored against source-verified CLAUDE.md content per Rule 17."
   - Phase 3 step 4 verbatim `git diff main..HEAD -- CLAUDE.md` output (shows the single-bullet insertion clean).
   - Smoke waiver justification (pure docs methodology change).
5. Report PR URL + branch HEAD SHA to dispatcher.

## Phase 6 — post-merge cleanup (tenth canonical Rule 16 application)

Standard sequence per Session Protocol step 9 + § Post-merge local cleanup + Rule 16.

1. `git checkout main && git fetch origin && git pull --ff-only origin main`
2. Capture work PR squash SHA: `git log origin/main --oneline -1` — paste verbatim.
3. **Rule 16 fill scope (mandatory):**
   - `docs/CONTEXT.md` recently-shipped row: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
   - `docs/CONTEXT.md` top-table `Current main HEAD` → work PR squash SHA (per Rule 16 — anchors on work-PR squash, NOT fill commit).
   - `docs/CONTEXT.md` top-table `Active track` → "FU-N Rule 17 sub-bullet shipped (PR #{N}, squash {SHA}). Methodology arc closes — `Enumeration tracked-status` discipline now documented in canonical Rule 17."
   - `docs/CONTEXT.md` top-table `Next track` → "Session backlog: FU-I post-pilot (TENANT_ID parameterization); BEH-1 blocked on slide copy. Smaller follow-ups available: Mobile FU#4 cosmetics, react-hooks ×3, shakedown bugs 001/003/004/006, Wizard R2-R5 residual, untracked legacy briefs/scripts cleanup (2026-05-13 banked)."
   - `docs/CONTEXT.md` top-table `Where we left off` → updated prose covering: FU-N as the methodology arc's coda. Two-day arc closes at 24 commits across 8 work PRs (FU-J / FU-K / FU-H+FU-C / FU-F-1 / FU-L / FU-M / FU-F-2 / FU-N), 1 methodology canonization (Rule 17 PR #192) refined by 1 sub-bullet update (FU-N), Rule 16 self-healed across 10 consecutive cycles with zero drift, 7 Rule 17 in-the-wild signals all productively addressed (FU-N closure adds the 7th as meta-application), 5 Rule 11 corrected-diagnosis preservations, 1 Rule 9 in-PR extension. Strike count holds 0/2 throughout. Backlog narrows to FU-I (post-pilot) + BEH-1 (blocked) + smaller items.
   - `docs/CONTEXT.md` top-table `Last updated` → ISO date of fill commit.
   - `docs/FOLLOW_UPS.md` FU-N closure paragraph: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
4. `git add docs/CONTEXT.md docs/FOLLOW_UPS.md`
5. Commit: `docs: fill PR #{N} placeholders (FU-N closure) — tenth Rule 16 application`
6. `git push origin main`
7. **Rule 15 verification (mandatory):**
   - `git fetch origin && git log origin/main --oneline -1` — paste verbatim.
   - `git rev-parse HEAD && git rev-parse origin/main` — paste verbatim.
   - Confirm: local HEAD == origin/main, fill commit on top, work PR squash directly below.
   - Report "pushed and verified" with all SHAs visible.
   - Any mismatch → **STOP and wait for dispatcher.** Hard-stop.
8. Worktree cleanup deferred to operator decision.

---

## Acceptance criteria

- CLAUDE.md Rule 17 bullet list has exactly 6 bullets in expected order; new "Enumeration tracked-status" bullet at position 4.
- New bullet text matches brief Phase 2a verbatim.
- Original 5 bullets unchanged (label + detail text).
- Rule 17 intro paragraph + disambiguation + safety-net paragraph + banked-from line all intact.
- FU-N entry in FOLLOW_UPS.md has RESOLVED suffix + closure paragraph with `#{TBD}`/`{TBD}` placeholders.
- CONTEXT.md recently-shipped row added at top.
- `git diff main..HEAD --stat` shows exactly 3 modified files.
- `git diff main..HEAD -- .env.example` returns empty.
- `npm run lint` returns 0 problems.
- `npm run build` completes clean.

## Out of scope

- **Adding refinement-log lines to other CLAUDE.md rules** — single-rule scope; broader meta-changes would warrant separate PR.
- **Restructuring Rule 17's other paragraphs** — out of scope. Drift trail preserved.
- **Adding "Rule 18" or new top-level rule** — sub-bullet is the correct granularity per architectural decision.
- **Updating existing FU bodies that referenced the pre-FU-N enumeration discipline** — historical records, not retro-edits.
- **`.env.example`** — Rule 14 carve-out (no credential doc touch).

## Rule references

- **Rule 9** — Phase 0 git fetch + branch-off-main gate.
- **Rule 10** — Brief commits to `docs/briefs/` via small docs PR BEFORE CC dispatch.
- **Rule 11** — FU-N body preserved verbatim in RESOLVED block. Drift trail intact.
- **Rule 12** — Hard-stop language used throughout.
- **Rule 14** — `.env.example` not touched.
- **Rule 15** — Phase 6 step 7 origin verification.
- **Rule 16** — Phase 6 fill scope. **Tenth** canonical application.
- **Rule 17** — Self-application: brief authored AFTER Kyron pasted current CLAUDE.md Rule 17 content. Source-verified line range, heading style, bullet structure, and surrounding paragraph cadence against repo HEAD `45af029` BEFORE locking Phase 2a's exact insertion text. Canonical Rule 17 example — the brief that refines the discipline applies the discipline at authoring time.
- **Rule 27** — Smoke default waived; pure docs methodology change with no app surface.

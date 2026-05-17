# Stale-row sweep: FU-H RESOLVED footer (PR #188 Phase 6 spec omission)

**Type:** Docs hygiene PR (LOW severity, stale-row cleanup)
**Shape:** XS, doc-only. Two-file commit (`docs/FOLLOW_UPS.md` + `docs/CONTEXT.md`). No source/script/test touch.
**Reference shape:** Similar to FU-G RESOLVED pattern at `docs/FOLLOW_UPS.md` lines 1694–1713 (same closure-block shape).
**Origin:** Drift surfaced twice during Session A (2026-05-18) — once during FU-J brief authoring (Phase 1 source-verification noticed FU-H banking entry never got its RESOLVED footer despite PR #188 having shipped on 2026-05-17), and again during FU-J Phase 6 writeup. Explicitly carried forward to a separate small PR per scope-discipline.

---

## Architectural decision (locked at brief authoring time)

**Narrow scope: fix FU-H entry only, not a broader stale-row audit.** Justification:

- FU-H is the one known drift, surfaced and traced to a specific spec omission in PR #188's Phase 6 step 3 ("replace FU-H banking entry with a resolved-block matching the FU-D/FU-E/FU-G pattern" — instruction was in the brief, was not executed by CC at the time, was not caught by dispatcher review either).
- A broader stale-row audit could surface additional drifts each requiring decisions. That's a separate session at fresh head, not a late-night cap.
- Rule 8 (Phase 4 stale-row audit) already mandates ongoing reconciliation of "PR open / awaiting merge / in progress" claims in the Active follow-ups table. This sweep is the body-level analog (closed-but-not-marked-RESOLVED entries in the FOLLOW_UPS detail sections), and we're using FU-H as the canonical first instance rather than building it into a generalized methodology rule tonight.
- Out of scope: methodology rule tightening (e.g., extending Rule 16 to explicitly mandate FU-entry banking→resolved conversion in Phase 6). The current Rule 16 wording covers placeholder fills; transitioning a banking-shape entry to a resolved-shape entry is governed by the work brief's Phase 6 spec. PR #188's brief had the spec; CC missed execution. This is a one-off execution miss, not a recurring methodology gap — addressing it inside a fix is sufficient.

**Counterargument considered:** absorbing a Rule 16 tightening to mandate the FU-entry conversion explicitly. Rejected because (a) the conversion is already in every work brief's Phase 6 spec by convention, (b) tightening Rule 16 should be a dedicated methodology PR with proper authoring source-verification (per Rule 17), (c) scope creep risk past midnight AST.

---

## Source-verified state (at brief authoring time, 2026-05-18)

Each anchor confirmed against repo HEAD `b3e6376` (post-FU-K Phase 6 fill).

- **FU-H banking entry** lives at `docs/FOLLOW_UPS.md` lines ~1735–1750. Current heading: `### FU-H — Phase 4 fill scope methodology (LOW, methodology)`. Body preserves the original banking text — three sections (Banked from / Scope / Open design question), Closure criteria, Severity. **No RESOLVED suffix, no Resolved-in-PR closure paragraph.**
- **PR #188 actual squash SHA:** `a543c30` (per CONTEXT.md recently-shipped row that was correctly written during PR #194 Phase 6, and per `git log origin/main` showing `a543c30 docs(methodology): add Rule 16 (post-merge fill scope) + reconcile top-table post-hotfix (FU-H Pass 3) (#188)` — both sources agree).
- **PR #188 merge date:** 2026-05-17 (per the same sources).
- **FU-G RESOLVED pattern** at `docs/FOLLOW_UPS.md` lines ~1694–1713 is the closure template. Shape: heading gets `(LOW, ..., RESOLVED YYYY-MM-DD)` suffix; existing banking body preserved verbatim; new `**Resolved in PR #{N}** (\`{SHA}\`, YYYY-MM-DD). ...` paragraph appended.
- **CONTEXT.md recently-shipped row format:** `| #N | \`SHA\` | Description |` markdown table row, at lines ~124–130.
- **CONTEXT.md top-table** is current as of `b3e6376` (FU-K Phase 6 fill): `Last updated: 2026-05-18`, `Current main HEAD: b195782`, etc. Phase 6 will update these for this sweep PR.

---

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`
2. `git checkout main && git pull --ff-only origin main`
3. `git log origin/main --oneline -1` — capture verbatim. Expected: this brief's docs PR squash (the brief-docs PR landing before this work PR per Rule 10).
4. `git checkout -b chore/fu-h-stale-row-sweep`
5. Any failure or drift → **STOP and wait for dispatcher.**

## Phase 1 — re-verify source-verified state (Rule 11 + Rule 17)

1. Read `docs/FOLLOW_UPS.md` FU-H entry at lines ~1735–1750. Confirm:
   - Heading is still `### FU-H — Phase 4 fill scope methodology (LOW, methodology)` (no RESOLVED suffix).
   - No `**Resolved in PR #X**` closure paragraph already present.
   - Banking body unchanged (Banked from / Scope / Open design question / Closure criteria / Severity sections all present).
   - If heading already has RESOLVED suffix OR closure paragraph already present → **STOP and wait for dispatcher.** The drift may have been fixed in a separate commit; verify against `git log -p docs/FOLLOW_UPS.md | grep "FU-H"` before proceeding.
2. Re-verify PR #188 squash SHA via `git log origin/main --oneline --grep="add Rule 16"` — expect `a543c30 docs(methodology): add Rule 16 ...`. If SHA differs from `a543c30` → **STOP and wait for dispatcher.**
3. Read FOLLOW_UPS.md FU-G RESOLVED pattern at lines ~1694–1713 and confirm closure-paragraph format (heading suffix + appended `**Resolved in PR #X** (\`SHA\`, date). ...` paragraph).
4. **Optional stale-row scan** (Rule 8 hygiene): scan FOLLOW_UPS.md for other entries that have shipped per `git log origin/main --oneline -50` but lack RESOLVED suffix on their heading. **If any found, report in Phase 5 surface but do NOT absorb into this PR** — narrow scope is locked.
5. If any audit claim has shifted materially → **STOP and wait for dispatcher.**

## Phase 2 — execute

### 2a. Update FU-H FOLLOW_UPS.md entry

1. Update FU-H heading from:
   ```
   ### FU-H — Phase 4 fill scope methodology (LOW, methodology)
   ```
   to:
   ```
   ### FU-H — Phase 4 fill scope methodology (LOW, methodology, RESOLVED 2026-05-17)
   ```
2. Preserve the entire existing body (Banked from / Scope / Open design question / Closure criteria / Severity) verbatim — this is the drift trail preserved per Rule 11's pattern (the "Open design question" in particular preserves the pre-decision design space; do NOT collapse it).
3. Append a new closure paragraph after the existing "Severity" line, matching FU-G's shape:

   ```
   **Resolved in PR #188** (`a543c30`, 2026-05-17). Rule 16 added to `CLAUDE.md` mandating post-merge fill scope (Current main HEAD, Active track, Next track, "Where we left off", Last updated). Anchor tweak at `CLAUDE.md:344` cites Rule 16 alongside Rule 15. Retired "Rule 4 shorthand" terminology drift flagged by Rule 15:503. Top-table staleness fixed in same commit as Rule 16 demonstration case. Pass 3 amend corrected initial `fill commit` anchor wording to `work-PR squash` (the operationally-possible version) after the hotfix-Phase-4 self-application surfaced the chicken-and-egg condition. Rule 16 has self-validated across four consecutive post-merge cycles (PRs #188, #190, #192, #194) with zero drift recurrences. **Note on this footer:** PR #188's Phase 6 spec included this resolved-block conversion but execution missed it; the drift was caught during FU-J + FU-K Session A brief authoring (2026-05-18) and reconciled in this stale-row sweep PR.
   ```

### 2b. No other FOLLOW_UPS.md changes

The FU-H "Open design question" section is preserved verbatim per the drift-trail principle — even though Rule 16 has now resolved the question, the historical design space is informative for future readers. Do NOT collapse or summarize it.

## Phase 3 — verify

1. `git diff --stat HEAD` shows exactly two changed entries: `M docs/FOLLOW_UPS.md`, `M docs/CONTEXT.md`. Anything else → **STOP and wait for dispatcher.**
2. `git diff main..HEAD -- .env.example` returns empty (Rule 14 carve-out — no credential touch).
3. Read FOLLOW_UPS.md FU-H entry end-to-end. Confirm:
   - Heading ends with `, RESOLVED 2026-05-17)`.
   - Banking body intact (all five sub-sections present unchanged).
   - Closure paragraph present, starts with `**Resolved in PR #188**`, contains `\`a543c30\`` and `2026-05-17`, ends with the "PR #188's Phase 6 spec included this resolved-block conversion but execution missed it" note.
4. Read CONTEXT.md recently-shipped table. Confirm the new row from Phase 4b is at the top with `#{TBD}` and `{TBD}` placeholders.
5. Run `npm run lint`. Expect 0 problems.
6. Run `npm run build`. Expect clean.

## Phase 4 — docs placeholder fill (in same commit as Phase 2)

### 4a. (No FOLLOW_UPS.md placeholder fills)

This sweep PR's own FOLLOW_UPS.md entry is not banked separately — it's a docs-hygiene cleanup, not a tracked FU. No FU-X entry to update for this PR.

### 4b. Add CONTEXT.md recently-shipped row

Insert at the top of the recently-shipped table:

```
| #{TBD} | `{TBD}` | Stale-row sweep (LOW docs-hygiene): FU-H FOLLOW_UPS.md entry got its `RESOLVED 2026-05-17` heading suffix and `**Resolved in PR #188** (a543c30, 2026-05-17). ...` closure paragraph per the FU-G pattern. Drift originated as PR #188 Phase 6 execution miss (brief spec included the conversion; CC missed it; dispatcher review didn't catch). Caught twice during Session A (2026-05-18) FU-J + FU-K brief authoring + Phase 6 writeup; reconciled in this sweep. |
```

Drop the oldest row if the recently-shipped table exceeds 5 entries.

### 4c. Top-table updates are Phase 6 (Rule 16)

Per Rule 16, the post-merge fill cycle handles top-table fields. Do NOT update those in Phase 4.

## Phase 5 — commit, push, open PR

1. `git add docs/FOLLOW_UPS.md docs/CONTEXT.md`
2. Commit message: `docs(hygiene): FU-H RESOLVED footer (PR #188 Phase 6 spec omission)`
3. `git push -u origin chore/fu-h-stale-row-sweep`
4. Open PR against main. Title: `docs(hygiene): FU-H RESOLVED footer — stale-row sweep`. Body must include:
   - Reference to this brief at `docs/briefs/fu-h-stale-row-sweep-kickoff.md`.
   - One-line context: "Closes FU-H FOLLOW_UPS.md drift originated as PR #188 Phase 6 spec execution miss. Caught during Session A (2026-05-18) FU-J + FU-K brief authoring."
   - Phase 1 findings: if optional stale-row scan in Phase 1 step 4 surfaced any additional drift candidates, list them here for dispatcher review (do NOT absorb).
   - Phase 1 divergences: if any source-verified anchors shifted between brief authoring and Phase 1 verification, report (Rule 17 dogfood).
5. Report PR URL + branch HEAD SHA to dispatcher.

## Phase 6 — post-merge cleanup (fifth canonical Rule 16 application)

Standard sequence per Session Protocol step 9 + § Post-merge local cleanup + Rule 16.

1. `git checkout main && git fetch origin && git pull --ff-only origin main`
2. Capture work PR squash SHA: `git log origin/main --oneline -1` — paste verbatim to dispatcher.
3. **Rule 16 fill scope (mandatory):**
   - `docs/CONTEXT.md` recently-shipped row: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
   - `docs/CONTEXT.md` top-table `Current main HEAD` → work PR squash SHA (per Rule 16 — anchors on work-PR squash, NOT fill commit).
   - `docs/CONTEXT.md` top-table `Active track` → "Stale-row sweep shipped (PR #{N}, squash {SHA}). FU-H FOLLOW_UPS.md drift closed."
   - `docs/CONTEXT.md` top-table `Next track` → carry forward Session A's "Next track" content with this sweep removed from the candidate list (FU-F dedicated session, FU-I post-pilot — those remain).
   - `docs/CONTEXT.md` top-table `Where we left off` → updated prose covering this stale-row sweep as Session A epilogue, and remaining queue.
   - `docs/CONTEXT.md` top-table `Last updated` → ISO date of fill commit (2026-05-18 if same day, 2026-05-19 if rolled over).
   - **No `docs/FOLLOW_UPS.md` placeholder fills** — this sweep PR didn't introduce any placeholders into FOLLOW_UPS.md (FU-H closure paragraph used hardcoded `#188` + `a543c30`, not `#{TBD}` + `{TBD}`).
4. `git add docs/CONTEXT.md`
5. Commit: `docs: fill PR #{N} placeholders (stale-row sweep closure) — fifth Rule 16 application`
6. `git push origin main`
7. **Rule 15 verification (mandatory):**
   - `git fetch origin && git log origin/main --oneline -1` — paste verbatim.
   - `git rev-parse HEAD && git rev-parse origin/main` — paste verbatim.
   - Confirm: local HEAD == origin/main, subject matches the fill commit, work PR squash directly below.
   - Report "pushed and verified" with all SHAs visible.
   - Any mismatch → **STOP and wait for dispatcher.** Hard-stop.
8. Worktree cleanup: the `chore/fu-h-stale-row-sweep` branch can be cleaned by running `node scripts/maintenance/prune-merged-branches.mjs --execute` later. Do NOT run during Phase 6 — operator decision.

---

## Acceptance criteria

- `docs/FOLLOW_UPS.md` FU-H entry heading ends with `, RESOLVED 2026-05-17)`.
- `docs/FOLLOW_UPS.md` FU-H banking body preserved verbatim (drift trail).
- `docs/FOLLOW_UPS.md` FU-H closure paragraph present, contains `**Resolved in PR #188** (\`a543c30\`, 2026-05-17)` and the spec-omission acknowledgement note.
- `docs/CONTEXT.md` has a new recently-shipped row at the top describing this sweep (with placeholders pre-Phase-6).
- `git diff main..HEAD --stat` shows exactly 2 modified files.
- `git diff main..HEAD -- .env.example` returns empty.
- `npm run lint` returns 0 problems.
- `npm run build` completes clean.
- Phase 6 fills CONTEXT.md placeholders + updates top-table per Rule 16.

## Out of scope

- **Broader FOLLOW_UPS.md stale-row audit** — if Phase 1 optional scan surfaces additional drift candidates, list them in Phase 5 report only. Do NOT absorb into this PR. Separate session at fresh head.
- **Rule 16 tightening** to explicitly mandate banking→resolved conversion in Phase 6. Would itself be a methodology PR; out of scope for hygiene cleanup.
- **Worktree cleanup** of `chore/fu-h-stale-row-sweep` — operator decision after Phase 6, runs via `prune-merged-branches.mjs --execute`.

## Rule references

- **Rule 7** — Active follow-ups table = active items only; closed items get RESOLVED suffix + Resolved-in-PR footer (this PR's surface).
- **Rule 8** — Phase 4 stale-row audit (this PR is itself a Rule 8 application against the FU body sections, not the Active follow-ups table).
- **Rule 9** — Phase 0 git fetch + branch-off-main gate.
- **Rule 10** — Brief commits to `docs/briefs/` via small docs PR BEFORE CC dispatch.
- **Rule 11** — Banking body preserved verbatim including the "Open design question" section, even though Rule 16 resolved that question. Drift trail principle.
- **Rule 12** — Hard-stop language used throughout.
- **Rule 14** — `.env.example` not touched.
- **Rule 15** — Phase 6 step 7 origin verification.
- **Rule 16** — Phase 6 fill scope. Fifth canonical application.
- **Rule 17** — Source-verification at authoring time. Five anchors verified at brief authoring; Phase 1 re-verifies as safety net.

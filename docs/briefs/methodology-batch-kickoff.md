# CLAUDE.md methodology batch — kickoff brief

**Scope:** 6 precise edits to CLAUDE.md banking methodology refinements that emerged from the FU#4 → arbitrary-syntax-sweep → border-border-resolution → placeholder-sweep arc (PRs #154, #155, #156, #157, #158). One numbered rule extended (rule 8), one regex fix (rule 4), one new numbered rule (rule 9), two new bullets in existing sections (Post-merge local cleanup × 2), one new entry in ## Banked patterns.
**Size:** ~80 lines added / ~5 lines edited across one file (CLAUDE.md). Single PR.
**Severity:** None — pure methodology documentation. No behavioral change to code, tests, or runtime. Future briefs benefit from the refined methodology.

---

## Goal

Bank six methodology refinements from the recent PR arc into CLAUDE.md:

1. **Phase 0 branch-confirmation gate** — new bullet in `### Post-merge local cleanup` section (insertion BEFORE existing "After step 9.5's pull..." lead-in)
2. **Rule 8 extension to CONTEXT.md prose claims** — new paragraph appended to existing `### 8. Phase 4 stale-row audit` body
3. **Verification target language** — new bullet in `### Post-merge local cleanup` section (after existing untracked-doc-collision bullet)
4. **Rule 4 regex fix** — three text substitutions in existing `### 4. env-listing commands filter for KEY= pattern` body + new appended note explaining why
5. **Static CSS verification as smoke replacement** — new bullet in `## Banked patterns (also from 2026-05-14 session)` section, after existing "Smoke is CC's default" bullet
6. **Rule 9 — Dispatcher Phase-5 scope-extension protocol** — new numbered rule added after existing rule 8, with corresponding update to `## Methodology requirements` intro paragraph (eight → nine)

### Out of scope (deferred to separate dispatch)

- **Env-credentials propagation audit** — the methodology-edit-queue 7th item. NOT a CLAUDE.md edit but an investigative audit (which env keys exist, where they're sourced from, what the worktree-propagation behavior should be). Deferred to its own audit-only dispatch in a future session — too different in shape to bundle with documentation edits.

---

## Phase 1 — Verify audit findings against current CLAUDE.md

CC's prior audit established these anchors. Re-verify each before any edit:

1. `## Session Protocol` at line 317; `### Post-merge local cleanup (standard sequence, not exception)` at line 329
2. `## Banked patterns (also from 2026-05-14 session)` at line 425; "Smoke is CC's default" bullet at line 431
3. `### 4. env-listing commands filter for KEY= pattern` at line 385; the `^[A-Z_]+=` regex appears at lines 386, 394, 395
4. `### 8. Phase 4 stale-row audit` at line 419-421
5. `## Methodology requirements` intro at lines 352-354 with "eight rules emerged..."
6. Total file length: 439 lines

If any anchor's line number has drifted by more than ±10 (small edits since the audit), re-locate by content anchor and proceed. If any anchor has been substantially moved, restructured, or removed, **STOP and surface** — the edits' insertion points may need rethinking.

---

## Phase 2 — Apply 6 edits

Each edit specifies the exact textual change. Apply in order; do NOT batch into a single sed pass — these are heterogeneous insertions and substitutions, sequence matters for line-number stability.

### Edit 1 — Phase 0 branch-confirmation gate

**Location:** `### Post-merge local cleanup (standard sequence, not exception)` section. Currently the section opens with the lead-in "After step 9.5's pull and after capturing the squash SHA from `git log origin/main --oneline -5`:"

**Action:** Insert a new bullet BEFORE that lead-in (i.e., between the section heading and the first bullet). Then keep the existing lead-in unchanged.

**New content to insert:**

```markdown

**Phase 0 — branch confirmation gate (validated PRs #154–#158).** Before step 9.5's pull, verify `git rev-parse --abbrev-ref HEAD` returns `main`. If not, `git checkout main` before any further command. Step 9.5's `git pull origin main` from a feature branch creates an unintended merge commit or operates on the wrong working tree; the Phase 0 gate eliminates both modes. Surfaced after PR #154 hiccup (placeholder edits applied to wrong branch, required recovery); validated in PRs #155, #156, #157, #158.

```

The blank line above and below the bullet are intentional — match the section's existing bullet spacing.

### Edit 2 — Rule 8 extension to CONTEXT.md prose claims

**Location:** End of `### 8. Phase 4 stale-row audit` body (after the existing paragraph ending "...CONTEXT.md state drifts silently from shipped reality.").

**Action:** Append a new paragraph as the second paragraph within the rule body. Do NOT add a sub-heading; keep it as flowing rule body.

**New content to append (after existing paragraph, separated by one blank line):**

```markdown

The audit extends to CONTEXT.md prose claims, not just the table. Component-consumer tracking ("X.jsx still consumed by Y"), deferred-but-still-valid annotations, and recently-shipped narrative all drift silently in the same way. PR #156 exposed a 22-day-stale "still consumed by ManagerDashboard" claim about MotivationalCarousel that survived the table-scoped scan because it lived in prose. Phase 4 must `git grep` for any named component referenced in CONTEXT.md prose and verify the claim against current state.
```

### Edit 3 — Verification target language

**Location:** `### Post-merge local cleanup (standard sequence, not exception)` section. Insert as a new bullet AFTER the existing untracked-doc-collision bullet (the one ending "Reference: PR #51 retrospective, B-series cleanup pattern across PRs #45, #50, #51.") but BEFORE the next section heading `### Single-branch PR rule`.

**Action:** Insert as a new top-level bullet matching the existing bullet structure.

**New content to insert:**

```markdown
- **Verification target = no NEW stale state from this PR.** After cleanup, "clean" means this PR's branch is deleted, its worktree (if any) removed, no PR-specific untracked artifacts remain. Pre-existing stale branches from prior sessions fall under the running Worktree + branch audit FU, not this PR's cleanup. Verification must scope honestly to what this PR introduced; "only main + remote refs" is aspirational across all PRs, not a per-PR-enforceable target. Banked from PR #155 (arbitrary-syntax sweep) surfacing 4 pre-existing stale branches that were correctly identified as out-of-scope.
```

### Edit 4 — Rule 4 regex fix (three substitutions + appended note)

**Location:** `### 4. env-listing commands filter for KEY= pattern` body, lines 385-395.

**Substitutions (apply all three, in order):**

a. Replace `filter for ` + backtick + `^[A-Z_]+=` + backtick + ` patterns` → `filter for ` + backtick + `^[A-Z0-9_]+=` + backtick + ` patterns`

b. Replace the PowerShell example line. Find: `Get-Content .env.local | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object { ($_ -split '=')[0] }`. Replace with: `Get-Content .env.local | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object { ($_ -split '=')[0] }`

c. Replace `Apply the same ` + backtick + `^[A-Z_]+=` + backtick + ` filter` → `Apply the same ` + backtick + `^[A-Z0-9_]+=` + backtick + ` filter`

**Appended note (add after existing Rule 4 body, before the blank line preceding Rule 5):**

```markdown

Character class must include digits (`[A-Z0-9_]+`, not `[A-Z_]+`) — keys like `A11Y_AGENT_PASSWORD`, `A11Y_BRANCH_MANAGER_PASSWORD` etc. begin with digit-containing prefixes and the digit-less pattern silently misses them. PR #156 smoke walk surfaced this gap when env-listing reported `A11Y_*` keys as absent; values were then pasted inline to unblock, requiring post-PR credential rotation. Both the credentials and the regex pattern are now fixed; this rule update prevents recurrence.
```

### Edit 5 — Static CSS verification as smoke replacement

**Location:** `## Banked patterns (also from 2026-05-14 session)` section. Insert as a new top-level bullet AFTER the existing "Smoke is CC's default, not Kyron's manual check." bullet (which ends "...too permissive a default.") and BEFORE the next bullet that begins "Mobile-viewport smokes need viewport-aware login routines."

**Action:** Insert as a new top-level bullet matching existing bullet structure.

**New content to insert:**

```markdown
- **Static CSS verification as smoke replacement for utility-alias and config-binding refactors.** When smoke is genuinely waived per the "internal refactor, no user-visible behavior" carve-out, CSS-only changes verify deterministically by inspecting the compiled bundle: fetch `dist/assets/index-*.css` (post-build) or the Vercel preview's served bundle, grep for expected utility classes, confirm rules emit with expected `var(--*)` resolution. Stronger than human spot-check (deterministic), cheaper than full smoke (no auth or navigation). Validated in PR #155 (arbitrary CSS-var-syntax → named-utility sweep — verified target utilities present in preview bundle, source patterns tree-shaken) and PR #156 (border-border resolution — verified `.border-border` rule emission in compiled bundle BEFORE smoke measured computed colors). For genuinely-waivable CSS-only refactors, this is the load-bearing verification.
```

### Edit 6 — Rule 9 (Dispatcher Phase-5 scope-extension protocol)

**Two sub-edits:**

**Sub-edit 6a:** Update `## Methodology requirements` intro paragraph.

**Location:** Line 354 (intro to numbered rules block).

**Find:** `These eight rules emerged from a productive but mistake-yielding session. Apply on every CC brief and dispatch.`

**Replace with:** `These rules emerged from productive sessions and post-incident learnings (originally 8 from pilot prep 2026-05-14; rule 9 added 2026-05-15 from FU#4 → border-border arc). Apply on every CC brief and dispatch.`

**Sub-edit 6b:** Add Rule 9 after existing Rule 8.

**Location:** After `### 8. Phase 4 stale-row audit` body (including the Edit 2 extension paragraph just added). Insert BEFORE the `---` horizontal-rule separator at line 423.

**Action:** Insert a new numbered rule as `### 9. Dispatcher Phase-5 scope-extension protocol`.

**New content to insert:**

```markdown

### 9. Dispatcher Phase-5 scope-extension protocol

Phase 5 stops exist for dispatcher review and authorization, not just go/no-go on merge. When CC surfaces findings adjacent to the brief's locked scope — same category, same risk profile, same verification basis — the dispatcher MAY authorize an in-PR extension rather than requiring a follow-up. CC MUST NOT unilaterally expand; the scope-lock protects against silent drift. The dispatcher's authority to extend exists precisely because Phase 5 is review-authorization.

Protocol: surface as out-of-scope per brief → dispatcher evaluates → if authorized, CC applies via NEW commit (not amend — preserves "extended at Phase 5 review" audit trail), updates PR description, re-stops at Phase 5. Validated in PR #158 (placeholder-sweep), where 2 additional sites mapping to PRs already verified HIGH-confidence landed via commit 0f6a4b5 on the same branch.
```

---

## Phase 3 — Verification (manual + grep)

No lint or build will catch CLAUDE.md content errors. Verification is:

1. **Manual diff review.** `git diff CLAUDE.md` — confirm:
   - 6 additions match the brief specifications above
   - No unintended deletions
   - No unintended whitespace changes (Markdown is whitespace-sensitive for blank lines around bullets/paragraphs)
2. **Grep verification:**
   - `grep -c '^[A-Z_]+=' CLAUDE.md` should now return 0 (old pattern absent)
   - `grep -c '^[A-Z0-9_]+=' CLAUDE.md` should return 3 (Rule 4 has it 3 times after the edits)
   - `grep -c 'Phase 0' CLAUDE.md` should return ≥ 1 (Edit 1)
   - `grep -c 'Static CSS verification' CLAUDE.md` should return ≥ 1 (Edit 5)
   - `grep -c 'dispatcher' CLAUDE.md` should return ≥ 1 (Edit 6 — note lowercase d in body text)
   - `grep -c '### 9.' CLAUDE.md` should return 1 (Edit 6b)
   - `grep -c 'These nine' CLAUDE.md` should return... wait, the new intro says "originally 8... rule 9 added" not "These nine rules" — so `grep -c 'rule 9 added' CLAUDE.md` should return 1
3. **Line count:** approximately +80 lines (file should grow from 439 to ~520; small variance acceptable)

If any grep check fails, STOP and surface — an edit didn't land as specified.

---

## Phase 4 — Docs (CONTEXT.md only; no FOLLOW_UPS.md edits)

This batch is methodology bookkeeping, not tracked-FU resolution. The 7 banked items from the session were NOT in `docs/FOLLOW_UPS.md` (they were in a chat-side queue). So FOLLOW_UPS.md is untouched.

### `docs/CONTEXT.md`

1. **Top table:** update HEAD SHA + active/next track lines with `<sha>` placeholder
2. **Recently-shipped table:** prepend a new row:
   ```
   #<pr#> | <sha> | docs: CLAUDE.md methodology batch (6 edits from FU#4 → border-border arc)
   ```
3. **Drop the oldest row** from the recently-shipped table (cap is 5)
4. **"Where we left off":** rewrite to describe the methodology batch closure. Mention that the 7th queue item (env-credentials propagation audit) is deferred to its own audit-only dispatch.
5. **Stale-row audit (per refined Rule 8):** in addition to the Active follow-ups table scan, also `git grep` for any prose claims about component consumers, deferred items, or live state that could be stale. Reconcile if found.

---

## Phase 5 — Commit, push, open PR

1. Feature branch: `docs/claude-md-methodology-batch`
2. Commit organization: single source commit + docs commit
   - Source: `docs(claude.md): methodology batch — Phase 0 gate, Rule 4 regex fix, Rule 8 extension, verification target, static CSS pattern, Rule 9 dispatcher protocol`
   - Docs: `docs: bank PR-<pr#> placeholders (methodology batch closure)`
3. Push the feature branch (NOT main)
4. PR title: `docs(claude.md): methodology batch — 6 edits from FU#4 → border-border arc`
5. PR description content (verbatim, fill placeholders):

```markdown
## Summary

Banks 6 methodology refinements that emerged from the PR #154 → #158 arc into CLAUDE.md.

### Edits

1. **Phase 0 branch-confirmation gate** — new bullet in `### Post-merge local cleanup` (validated PRs #154–#158)
2. **Rule 8 extension** — Phase 4 stale-row audit now covers CONTEXT.md prose, not just the Active follow-ups table (banked from PR #156 dead-code finding on MotivationalCarousel — 22-day-stale prose claim)
3. **Verification target language** — new bullet establishing per-PR cleanup verification scope (banked from PR #155)
4. **Rule 4 regex fix** — env-listing pattern updated from `[A-Z_]+` to `[A-Z0-9_]+` to match keys like `A11Y_AGENT_PASSWORD`. Three substitutions + appended explanatory note (banked from PR #156 credential exposure incident).
5. **Static CSS verification as smoke replacement** — new pattern in `## Banked patterns` documenting when compiled-bundle inspection is the load-bearing verification for CSS-only refactors (validated in PRs #155, #156)
6. **Rule 9 — Dispatcher Phase-5 scope-extension protocol** — formalizes dispatcher authority to authorize in-PR scope extension when CC surfaces in-category findings (validated in PR #158)

### Deferred from scope

The 7th queue item — env-credentials propagation audit (which env keys exist, where they're sourced from, worktree-propagation behavior) — is investigative, not documentation. Deferred to its own audit-only dispatch in a future session.

### Verification

- 6 edits applied per brief specifications
- Grep verification confirms: old regex pattern absent (3 → 0), new pattern present (0 → 3), all new section markers present
- Manual diff review confirms no unintended whitespace or deletion drift
- Line count: 439 → ~520 (additions only)
```

6. Open PR against `main`, link to the brief at `docs/briefs/methodology-batch-kickoff.md`

---

## Phase 6 — Smoke WAIVED

Pure docs change. No source touched. Memory 35 waiver applies trivially. No spot-check needed.

If the docs-only nature ever feels not-quite-waivable for some downstream reason (e.g., this PR is the FIRST to test CC re-reading CLAUDE.md after edits), surface and we'll discuss — but I don't expect that to come up.

---

## Phase 7 — Stop for review

After Phase 5, **stop**. Surface:
1. PR URL
2. Grep verification results (the 7 checks from Phase 3)
3. Line count delta
4. Any Phase 1 hard-stop findings (anchor drift beyond ±10 lines)
5. Current strike count

Do NOT merge. Wait for merge confirmation per Memory 26.

---

## Post-merge sequence (CC, after merge confirmation)

Per CLAUDE.md banked post-merge sequence WITH the newly-banked Phase 0 gate (which this PR itself adds — first-class enforcement post-merge):

1. **Phase 0:** Verify on main — `git rev-parse --abbrev-ref HEAD` returns `main`. If not, `git checkout main` BEFORE any other step.
2. `git fetch origin --prune && git pull origin main`
3. Capture squash SHA: `git log origin/main --oneline -1`
4. Fill `<pr#>` + `<sha>` placeholders in `docs/CONTEXT.md`
5. Commit + push direct to main: `docs: fill PR #<pr#> placeholders (methodology batch closure)`
6. Worktree cleanup if applicable
7. Verify clean state per the newly-banked verification target rule (no NEW stale state from this PR; pre-existing stale branches are out-of-scope)

---

## Strike rules

Session opens at 0/2. Two-strike rule applies. Hard stops in this brief:
- Phase 1 anchor drift > ±10 lines on any of the 6 anchors → STOP
- Phase 2 any unintended deletion, whitespace drift in adjacent unchanged sections, or substitution miss → STOP
- Phase 3 any grep verification check returns unexpected count → STOP
- Any scope expansion beyond the 6 specified edits (e.g., touching other rules, adding 7th item from queue) → STOP

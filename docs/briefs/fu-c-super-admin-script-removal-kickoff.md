# FU-C — super_admin script removal — kickoff brief

**Status:** Execution PR for FU-C (MEDIUM, banked from the May 5 2026 role retirement arc; Phase 1 sanity-check grep requirement satisfied by the 2026-05-17 audit). Removes 2 vestigial dead-code scripts from the pre-PR-3 super_admin era, prunes related `.gitignore` entries and CLAUDE.md sensitive-files bullets, cleans up one stale comment surfaced as adjacent debt.
**Sizing:** XS (2 file deletes + ~6 line edits across 3 docs/config files; no logic changes; smoke waived).
**Strike count opens at:** 0/2.
**Audit:** 2026-05-17 FU-C audit (inline dispatch, no docs/briefs/ commit) confirmed scope. FUNCTIONAL_GATE bucket empty; role retirement is complete in production code paths.

---

## Context

FU-C was banked as MEDIUM with an explicit mandatory Phase 1 sanity-check grep requirement before any removal. The 2026-05-17 audit satisfied that gate with five categorized buckets:

- **DEAD_SCRIPT (2 files):** `functions/set-super-admin.cjs` (22 lines, one-time claim setter for Kyron's UID) and `functions/seed-super-admin-user.cjs` (45 lines, one-time user doc seeder with hardcoded `kyron@tatillife.com` literal at line 30). Both tracked in git despite being in `.gitignore` (gitignore added after the files were already in index).
- **FUNCTIONAL_GATE (0 files):** Empty. Role retirement complete. `firestore.rules` has zero super_admin references; `functions/index.js` line 405 and 1052 hits are post-removal comments only (actual role gates exclude super_admin).
- **TEST_OR_SEED (5 files):** Migration scripts + emulator harness + one test sentinel. **Out of FU-C scope** per dispatcher decision — each has rational reasons to stay.
- **DOCS_OR_HISTORY (53+ hits):** Immutable historical references. No action required.
- **Adjacent debt (1 comment):** `scripts/a11y-axe-scan-manager.cjs:17` carries a stale PR-1-era docstring saying "if a dedicated branch_manager-tier scan account doesn't exist yet, super_admin credentials may be used locally — flag as follow-up." That follow-up was closed by PR-3 + FU-B; the script now reads `A11Y_BRANCH_MANAGER_*` env vars exclusively. **Folded into FU-C scope** as a 1-line cleanup.

Platform_admin safety check: zero overlap with removal candidates. The two DEAD_SCRIPT files contain no platform_admin references; deletion cannot touch in-progress platform_admin scaffolding.

External references confirmed at audit: zero npm scripts, zero CI workflows, zero imports of the removal targets.

---

## Phase 0 — Gate

1. Confirm `git status` working tree clean (the ~15 pre-existing untracked files in the working tree are tracked by separate cleanup FUs; ignore — do NOT stage them).
2. Confirm current branch is `main`. If not, `git checkout main`.
3. `git fetch origin && git pull origin main`. Confirm main is at the fresh HEAD.
4. **Rule 15 dogfood gate** (per CLAUDE.md Rule 15, PR #180): Run `git log origin/main --oneline -1` and `git rev-parse HEAD`. Confirm the SHAs match. If they do not match: **STOP and wait for dispatcher.**
5. `git checkout -b chore/fu-c-super-admin-script-removal` — fresh branch, never reuse.

---

## Phase 1 — Re-verify audit findings still hold

1. `git ls-files functions/set-super-admin.cjs` — must return exactly one match (confirms file is tracked, not just present locally).
2. `git ls-files functions/seed-super-admin-user.cjs` — must return exactly one match.
3. `git grep -n "super_admin" -- functions/index.js firestore.rules src/` — must return only comment-only references in `functions/index.js` (lines 405 and 1052). If any non-comment hit appears in `src/` or `firestore.rules`, or if `functions/index.js` shows a non-comment `super_admin` reference: **STOP and wait for dispatcher** (FUNCTIONAL_GATE survivor surfaced post-audit).
4. `git grep -n "set-super-admin\|seed-super-admin-user" -- package.json functions/package.json .github/` — must return zero hits (confirms zero npm scripts, zero CI references).
5. Read `.gitignore` lines 27–28 and confirm they list exactly `functions/set-super-admin.cjs` and `functions/seed-super-admin-user.cjs`.
6. Read `CLAUDE.md` § Sensitive Files — Never Commit and confirm lines 272–273 reference the two removal targets.
7. Read `scripts/a11y-axe-scan-manager.cjs` lines 15–20 and confirm the stale PR-1-era comment about super_admin credentials is present.

If any premise has shifted: **STOP and wait for dispatcher.**

---

## Phase 2 — File deletions

### Edit 1 — `git rm functions/set-super-admin.cjs`

Run `git rm functions/set-super-admin.cjs`. The file should be tracked despite `.gitignore` (audit confirmed via `git ls-files`). Confirm with `git status`: file should appear under "Changes to be committed: deleted: functions/set-super-admin.cjs".

### Edit 2 — `git rm functions/seed-super-admin-user.cjs`

Same as Edit 1, for the second file.

---

## Phase 3 — Companion cleanup edits

### Edit 3 — Prune `.gitignore` lines 27–28

Remove the two `.gitignore` entries:

```
functions/set-super-admin.cjs
functions/seed-super-admin-user.cjs
```

Preserve all other `.gitignore` content unchanged. The `!` allowlist entries on lines 34–38 (for `functions/scripts/*.cjs` migration/restore scripts) are NOT touched — out of FU-C scope.

### Edit 4 — Prune CLAUDE.md § Sensitive Files — Never Commit lines 272–273

Remove the two bullet lines that reference the deleted files. The bullets list `functions/set-super-admin.cjs` and `functions/seed-super-admin-user.cjs` as gitignored historical bootstrap scripts. Preserve the section header, any introductory prose, and the remaining bullets (`functions/service-account-key.json` and `functions/seed-agent-names.cjs`).

If the section's structure leaves an awkward gap after the bullet deletions (e.g., a 4-bullet list becomes a 2-bullet list and the framing prose mentions "four files"): adjust the surrounding prose minimally to match the new count. Otherwise leave structure alone.

### Edit 5 — Clean stale comment in `scripts/a11y-axe-scan-manager.cjs:17`

Locate the stale PR-1-era comment block (around line 17, may span multiple lines):

```
// For PR 1: if a dedicated branch_manager-tier scan account doesn't exist
// yet, super_admin credentials may be used locally — flag as follow-up.
```

Delete the entire comment block. The script now reads `A11Y_BRANCH_MANAGER_*` env vars exclusively (FU-B PR #182 closure), so the fallback guidance is obsolete. Do NOT add a replacement comment unless the surrounding context becomes unclear without it — the script's other docstrings should already explain the env var consumption pattern. If a one-liner replacement is needed to preserve docstring flow, use:

```
// Reads A11Y_BRANCH_MANAGER_EMAIL / _PASSWORD from .env.local; see .env.example.
```

(Refine to match the surrounding comment style.)

---

## Phase 4 — `FOLLOW_UPS.md` FU-C → Resolved

### Edit 6 — Mark FU-C as Resolved with closure note

Flip FU-C's status from Active to Resolved. Replace the Active body with a Resolved closure note (per Rule 11 pattern established in FU-B closure). Closure-note template:

```
**Resolved in PR #TBD** ({TBD}, 2026-05-17). Removed 2 vestigial dead-code
scripts from the pre-PR-3 super_admin era:
- functions/set-super-admin.cjs (22 lines, one-time claim setter)
- functions/seed-super-admin-user.cjs (45 lines, one-time user doc seeder
  containing hardcoded kyron@tatillife.com literal)

Companion cleanup landed in the same PR: .gitignore lines 27–28 entries
pruned, CLAUDE.md § Sensitive Files — Never Commit bullets for both files
removed, stale PR-1-era comment in scripts/a11y-axe-scan-manager.cjs:17
referencing super_admin credentials as a fallback (rendered obsolete by
PR-3 + FU-B PR #182) deleted.

Phase 1 sanity-check grep (2026-05-17 audit, satisfying the FU-C banking
requirement) confirmed: FUNCTIONAL_GATE bucket empty across firestore.rules
+ functions/index.js + src/. Role retirement is complete in production
code paths. Zero npm-script or CI references to the removed files. The
platform_admin successor role's scaffolding (PlatformAdminStubScreen in
App.jsx, Firestore rules cross-tenant grants, functions/scripts/
seed-platform-admin.cjs bootstrap) is untouched — its cross-tenant UI
build is deferred indefinitely per dispatcher decision 2026-05-17 (single-
tenant Tatil Life scope).

TEST_OR_SEED bucket (migration scripts, emulator harness, one test sentinel)
deliberately left in place — each has rational reasons to stay; out of
FU-C banked scope.
```

Leave `#TBD` / `{TBD}` placeholders as literals — post-merge sequence fills them per Rule 15 verification.

---

## Phase 5 — `CONTEXT.md` updates

### Edit 7 — Recently-shipped table

1. Drop the oldest row (which is currently `#174` after PR #182's row landed — confirm at Phase 1 by reading current table state).
2. Add new placeholder row at top:
   ```
   | #TBD | {TBD} | FU-C closure: super_admin script removal + companion cleanup |
   ```
3. Maintain 5-row contract.

### Edit 8 — Top-table backfill (FU-H gap demonstration, continues from PR #180 + #182)

The top table's `Current main HEAD`, `Active track`, and `Next track` fields go stale on every PR merge (FU-H methodology gap, banked PR #180). Backfill manually:

- **Current main HEAD** — set to the SHA captured at Phase 0 step 4 (post-pull, post-Rule-15-dogfood). Will go stale again after this PR merges.
- **Active track** — update to reflect current shipping context (FU completion arc; MEDIUM-severity backlog reducing).
- **Next track** — drop FU-C (now resolved). Surface FU-G execution (LOW) as next, with FU-F / FU-H design resolution / FU-I behind it. Note: FU-F (parser unification) was blocked on FU-B; now unblocked.

### Edit 9 — "Where we left off" prose update

Advance from PR #182 (FU-B closure) to PR #TBD (FU-C closure). Reflect today's session arc: FU-C ships clean, role retirement formally complete (super_admin artifacts removed in code), MEDIUM-severity FU queue reduced to zero remaining items.

Keep concise (1–2 short paragraphs). Match existing prose length.

---

## Phase 6 — Verification

1. `git diff main --stat` — sanity-read. Expect: 2 file deletions (`functions/set-super-admin.cjs`, `functions/seed-super-admin-user.cjs`), small edits to `.gitignore`, `CLAUDE.md`, `scripts/a11y-axe-scan-manager.cjs`, `docs/FOLLOW_UPS.md`, `docs/CONTEXT.md`. Total touched: 7 paths (2 deletes + 5 edits).
2. `git ls-files functions/set-super-admin.cjs` — must return zero results (file removed).
3. `git ls-files functions/seed-super-admin-user.cjs` — must return zero results.
4. `git grep -n "set-super-admin\|seed-super-admin-user" -- .` — must return only references in `docs/CONTEXT.md` (the new FU-C placeholder row + "Where we left off" prose) and `docs/FOLLOW_UPS.md` (the new closure note). No references in tracked code or `.gitignore` or `CLAUDE.md`.
5. `git grep -n "super_admin" -- functions/index.js firestore.rules src/` — must still return only the 2 comment-only references in `functions/index.js` (lines 405 and 1052). No new gates.
6. `git grep -n "PR 1.*super_admin\|super_admin.*flag as follow-up" -- scripts/` — must return zero hits (stale comment removed).
7. `npm run lint` — must report 0 problems.
8. `npm run build` — must complete clean.

**Smoke waiver:** Pure deletion + companion docs/config cleanup. Zero runtime callers of the removed scripts (verified at audit: no imports, no npm scripts, no CI references). No source files in `src/` or `functions/` (other than companion docs) modified. Memory #27's smoke default carve-out applies. Waiver justified inline in PR body.

If lint regresses, build fails, or any grep check fails: **STOP and wait for dispatcher.**

---

## Phase 7 — Commit, push, dogfood, open PR

1. `git add -A` — captures the 2 deletes + 5 edits. Then `git status` to confirm:
   - 2 files marked "deleted"
   - 5 files marked "modified" (`.gitignore`, `CLAUDE.md`, `scripts/a11y-axe-scan-manager.cjs`, `docs/FOLLOW_UPS.md`, `docs/CONTEXT.md`)
   - 0 untracked files staged (the ~15 pre-existing untracked files are NOT this PR's surface)
2. Commit message:
   ```
   chore(roles): remove super_admin vestigial scripts + companion cleanup

   Closes FU-C (MEDIUM). Removes 2 dead-code scripts from the pre-PR-3
   super_admin era (set-super-admin.cjs claim setter + seed-super-admin-
   user.cjs user doc seeder). Both were tracked in git despite .gitignore
   entries (gitignore added post-index). Companion cleanup:

   - .gitignore: prune the 2 obsolete entries
   - CLAUDE.md § Sensitive Files: drop the 2 bullets describing the
     removed files
   - scripts/a11y-axe-scan-manager.cjs:17: delete stale PR-1-era comment
     referencing super_admin credentials as a fallback (rendered obsolete
     by PR-3 + FU-B PR #182)

   2026-05-17 audit confirmed FUNCTIONAL_GATE bucket empty across
   firestore.rules + functions/index.js + src/. Role retirement is
   complete in production code paths. Platform_admin successor scaffolding
   untouched (cross-tenant UI build deferred indefinitely per dispatcher
   decision; single-tenant Tatil Life scope).

   TEST_OR_SEED bucket (migration scripts, emulator harness, one test
   sentinel) deliberately left in place — out of FU-C banked scope.

   Smoke waived (deletion + companion docs/config only, no runtime
   callers of removed scripts).
   ```
3. `git push -u origin chore/fu-c-super-admin-script-removal`
4. **Rule 15 dogfood at push time:** Run `git fetch origin && git log origin/chore/fu-c-super-admin-script-removal --oneline -1` and verify the SHA matches local HEAD. Report explicit "pushed to origin/chore/fu-c-super-admin-script-removal, verified" line. If mismatch: **STOP and wait for dispatcher.**
5. Open PR via `gh pr create` with title:
   `chore(roles): remove super_admin vestigial scripts + companion cleanup (FU-C)`
   PR body should reference FU-C closure, the 2026-05-17 audit's empty FUNCTIONAL_GATE finding, the platform_admin distinction, the companion cleanup scope, and inline-justify the smoke waiver.
6. **STOP and wait for dispatcher.** Do not merge. Surface the PR URL.

---

## Acceptance criteria

- `functions/set-super-admin.cjs` removed from tracked source (`git ls-files` returns zero)
- `functions/seed-super-admin-user.cjs` removed from tracked source
- `.gitignore` no longer contains entries for the 2 removed files
- `CLAUDE.md` § Sensitive Files — Never Commit no longer contains bullets for the 2 removed files
- `scripts/a11y-axe-scan-manager.cjs` no longer contains the stale "For PR 1: if a dedicated branch_manager-tier scan account doesn't exist yet, super_admin credentials may be used locally — flag as follow-up" comment
- `FOLLOW_UPS.md` FU-C status flipped Active → Resolved with closure note including audit-derived diagnosis + platform_admin safety affirmation
- `CONTEXT.md` top-table 3 fields backfilled, "Where we left off" advanced, recently-shipped 5-row contract maintained with new placeholder
- Phase 6 grep checks all pass
- Lint 0 problems, build clean
- Smoke waiver justified inline in PR body
- Zero source files in `src/` or `functions/index.js` modified (only the 2 deletes + companion docs/config)

---

## Out of scope

- **TEST_OR_SEED bucket** (5 items): `migrate-user-mgmt-pr1.cjs`, `migrate-super-admin-to-tenant-admin.cjs`, `restore-super-admin-claim.cjs`, `functions/scripts/test-pr2-emulator.cjs`, `src/services/__tests__/persistencyService.test.js:284`. Each has rational reasons to stay (migration idempotency, rollback documentation, test-sentinel utility). If future cleanup is desired, bank as separate FU.
- **`!` allowlist entries in `.gitignore:34–38`** for `functions/scripts/*.cjs`. These preserve the migration/restore scripts as tracked despite being in `.gitignore`; correctly named and unaffected by FU-C scope.
- **Platform Admin portal UI build.** Deferred indefinitely per dispatcher decision 2026-05-17 (single-tenant Tatil Life scope; revisit when a second tenant is needed). PlatformAdminStubScreen in App.jsx remains.
- **15 pre-existing untracked files** in the working tree. Covered by separate Untracked legacy cleanup tracking; do NOT stage in this PR.
- **FU-G execution / FU-F / FU-H design resolution / FU-I** — each has its own future PR.

---

## Standing rule reminders

- **Rule 1** (single-branch PR): fresh branch `chore/fu-c-super-admin-script-removal`, never reuse.
- **Rule 2** (fetch before branching): Phase 0 step 3 enforces.
- **Rule 9** (smoke default): waiver allowed for changes outside user-visible behavior; justify inline.
- **Rule 11** (FU body re-audit before first work): satisfied by the 2026-05-17 audit; corrected diagnosis lands in Phase 4 closure note.
- **Rule 12** (canonical hard-stop): every hard stop uses literal phrase **"STOP and wait for dispatcher"**.
- **Rule 14** (`.env.example` as canonical credential doc): not directly invoked by this PR; no .env.example changes.
- **Rule 15** (push verification): dogfooded at Phase 0 step 4 (pre-branch) and Phase 7 step 4 (post-push). Post-merge sequence will run Rule 15 again on the placeholder-fill commit.

---

## Post-merge expectations

After Kelsean merges, the post-merge placeholder-fill sequence fills:
- `#TBD` / `{TBD}` literals in FOLLOW_UPS.md FU-C closure note
- `#TBD` / `{TBD}` literals in CONTEXT.md recently-shipped row

Per Rule 15, CC must verify the placeholder-fill commit reaches origin/main and report explicitly. Operator (Kelsean) verifies with verbatim `git log origin/main --oneline -3` paste-back per memory #30 dispatcher discipline.

CONTEXT.md top-table fields will go stale again after merge (FU-H gap continues until FU-H's design resolution PR). Same demonstration arc as PR #180 + #182.

This PR closes the MEDIUM-severity FU queue. After FU-C ships, all remaining backlog items (FU-F, FU-G, FU-H, FU-I) are LOW severity.

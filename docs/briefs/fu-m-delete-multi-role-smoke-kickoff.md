# FU-M: Delete defunct `multi-role-smoke.cjs`

**Type:** Implementation PR (LOW housekeeping, defunct-script removal)
**Shape:** XS, 3-file commit (1 deletion + 2 docs).
**Reference shape:** Similar to FU-H stale-row sweep brief shape (small docs-focused PR with single-file work).
**Banking origin:** FU-M banked 2026-05-18 in FU-F-1 Phase 4d (FOLLOW_UPS.md). Surfaced during FU-F audit re-run 2026-05-18 Section 7 finding #1. Dispatcher signed off on delete option (Option b) 2026-05-18 afternoon AST.

---

## Architectural decision (locked at brief authoring time)

**Delete `scripts/multi-role-smoke.cjs` entirely.** Justification:

- Audit finding: script references retired `super_admin` role (closed in user-mgmt PR-3, PR #28/#29). Reads legacy `Super_admin_login` / `Branch_Manager_login` / `Unit_Manager_login` env vars in non-canonical Title_Case naming. Not referenced in `.env.example`.
- Defunct under current auth model. Would not execute correctly post-May-5 refactor.
- Operator (Kyron) does not recognize the script as operationally relevant in current workflow.
- Maintenance dead weight: risks confusion for future contributors; counted in FU-F audit's 7 `.cjs` migration target population, which now shrinks to 6 once this PR ships.

**Counterargument considered:** Option (a) update the script to canonical `A11Y_*` naming + non-retired roles. Rejected because (a) operator does not recall using it, (b) update would require domain knowledge of what the script was originally meant to validate (likely an early multi-role login smoke test from the pre-PR-3 era), (c) Option (b) delete is cheaper, cleaner, and the audit explicitly recommended it as preferred.

**Knock-on benefit for FU-F-2:** with `multi-role-smoke.cjs` deleted, FU-F-2's `.cjs` migration target shrinks from 7 candidates to 6 (Pattern G ×3 + Pattern H ×2 + 1 untracked `mgr-mobile-audit.cjs` already out of scope). Cleaner FU-F-2 scope as direct sequel.

---

## Source-verified state (at brief authoring time, 2026-05-18)

Confirmed against repo HEAD `bd89fe5` (post-FU-L Phase 6 fill).

- **`scripts/multi-role-smoke.cjs`** present, tracked. Tagged by FU-F audit as Pattern H (.cjs simple-mutating loadDotEnvLocal helper). References to legacy `Super_admin_login` / `Branch_Manager_login` / `Unit_Manager_login` per audit Section 7.
- **FU-M body** at `docs/FOLLOW_UPS.md` (line position TBD per Phase 1 capture). Banking text from FU-F-1 PR #198 Phase 4d landed 2026-05-18. Heading currently reads `### FU-M — multi-role-smoke.cjs likely defunct: triage + remove or update (LOW, housekeeping, banked 2026-05-18)`.
- **`.env.example`** does NOT reference `Super_admin_login` / `Branch_Manager_login` / `Unit_Manager_login` (audit Section 7 verified). Rule 14 carve-out: this PR does NOT touch `.env.example`.
- **FU-G RESOLVED pattern** at `docs/FOLLOW_UPS.md` lines ~1694–1713 is the closure shape template.
- **CONTEXT.md recently-shipped row format** at top-of-table — single markdown table row.
- **FU-F audit's 7-`.cjs` enumeration** included `multi-role-smoke.cjs` as 1 of 3 Pattern H sites. Deletion drops Pattern H to 2 sites (manager-audit-screenshots.cjs + manager-audit-screenshots-mobile.cjs).

---

## Phase 0 — pre-flight (Rule 9 gate)

1. `git fetch origin`
2. `git checkout main && git pull --ff-only origin main`
3. `git log origin/main --oneline -1` — capture verbatim. Expected: this brief's docs PR squash (per Rule 10).
4. `git checkout -b chore/fu-m-delete-multi-role-smoke`
5. Any failure or drift → **STOP and wait for dispatcher.**

## Phase 1 — re-verify FU-M scope + cross-reference safety check (Rule 11 + Rule 17)

This phase is heavier than Phase 2 because deletion needs cross-reference verification before it ships.

1. Confirm `scripts/multi-role-smoke.cjs` still tracked: `git ls-files scripts/multi-role-smoke.cjs` returns the path. If empty → **STOP and wait for dispatcher** (file may already be deleted or moved).

2. Read FU-M entry in `docs/FOLLOW_UPS.md`. Capture current line range. Confirm:
   - Heading: `### FU-M — multi-role-smoke.cjs likely defunct: triage + remove or update (LOW, housekeeping, banked 2026-05-18)`
   - Body sections present: Surfaced, Failure mode (latent), Proposed fix (a/b/c options), Sequencing, Severity.
   - No prior in-progress modifications.
   - If heading already has RESOLVED suffix or closure paragraph present → **STOP and wait for dispatcher.**

3. **Cross-reference safety check (Rule 17 critical):** verify nothing else in the repo references the script or its env vars.

   ```bash
   # Reference search: any file that mentions the script by name
   grep -rn "multi-role-smoke" --include='*' . | grep -v '^./.git/' | grep -v '^./node_modules/'
   ```

   Expected matches:
   - `scripts/multi-role-smoke.cjs` itself (the file being deleted).
   - `docs/FOLLOW_UPS.md` FU-M entry (the entry being marked RESOLVED).
   - **Anywhere else** → CAPTURE and SURFACE; do NOT proceed with deletion until dispatcher reviews.

   ```bash
   # Env var search: legacy Title_Case env vars used by this script
   grep -rn "Super_admin_login\|Branch_Manager_login\|Unit_Manager_login" --include='*' . | grep -v '^./.git/' | grep -v '^./node_modules/'
   ```

   Expected matches: only `scripts/multi-role-smoke.cjs` itself.
   - **Anywhere else** → CAPTURE and SURFACE; do NOT proceed.

4. Verify `.env.example` does NOT mention any of the legacy env vars (audit Section 7 already verified, but re-confirm at execution time per Rule 11):
   ```bash
   grep -E "Super_admin_login|Branch_Manager_login|Unit_Manager_login" .env.example
   ```
   Expected: no matches.

5. If any unexpected cross-reference surfaces → **STOP and wait for dispatcher.** Deletion will be deferred until references are resolved.

6. If all clear → proceed to Phase 2.

## Phase 2 — execute

### 2a. Delete the script

```powershell
git rm scripts/multi-role-smoke.cjs
```

Confirm with `git status` that the deletion is staged.

## Phase 3 — verify

1. `git diff --stat HEAD` shows exactly 3 changed entries: `D scripts/multi-role-smoke.cjs`, `M docs/FOLLOW_UPS.md`, `M docs/CONTEXT.md`. Anything else → **STOP and wait for dispatcher.**
2. `git diff main..HEAD -- .env.example` returns empty (Rule 14 carve-out — should be untouched since we didn't change it).
3. Run `npm run lint`. Expect 0 problems (no source change to non-deleted code).
4. Run `npm run build`. Expect clean.

**Smoke waiver per Rule 27:** deleting a defunct standalone script with no cross-references (verified in Phase 1 step 3). No production impact. No runtime behavior change. Smoke walk waived.

## Phase 4 — docs placeholder fill + banking (in same commit as Phase 2)

### 4a. FU-M RESOLVED block

1. Update FU-M heading from:
   ```
   ### FU-M — multi-role-smoke.cjs likely defunct: triage + remove or update (LOW, housekeeping, banked 2026-05-18)
   ```
   to:
   ```
   ### FU-M — multi-role-smoke.cjs likely defunct: triage + remove or update (LOW, housekeeping, RESOLVED 2026-05-18)
   ```
2. Preserve existing body (Surfaced, Failure mode, Proposed fix options a/b/c, Sequencing, Severity) verbatim — drift trail.
3. Append closure paragraph after existing "Severity" line:

   ```
   **Resolved in PR #{TBD}** (`{TBD}`, 2026-05-18). Deleted `scripts/multi-role-smoke.cjs` per Option (b) — Kyron confirmed the script defunct under current auth model (post-PR-3 super_admin retirement). Phase 1 cross-reference safety check confirmed no other repo files reference the script name or its legacy `Super_admin_login` / `Branch_Manager_login` / `Unit_Manager_login` env vars. Knock-on effect for FU-F-2: `.cjs` migration target population shrinks from 7 to 6 (Pattern G ×3 + Pattern H ×2 tracked + 1 untracked `mgr-mobile-audit.cjs` already out of scope). Banked 2026-05-18 morning, resolved 2026-05-18 afternoon — same-day close.
   ```

### 4b. Add CONTEXT.md recently-shipped row

Insert at top of CONTEXT.md recently-shipped table:

```
| #{TBD} | `{TBD}` | FU-M defunct-script deletion (LOW housekeeping closure): removed `scripts/multi-role-smoke.cjs` (referenced retired `super_admin` role + legacy `Super_admin_login` env vars). Phase 1 cross-reference safety check confirmed no other repo files reference the script. FU-F-2 target shrinks from 7 to 6 `.cjs` migrations as knock-on benefit. Banked-and-resolved same day. |
```

Drop oldest row if recently-shipped exceeds 5 entries.

### 4c. Top-table updates are Phase 6 (Rule 16)

Per Rule 16, the post-merge fill cycle handles top-table fields. Do NOT update those in Phase 4.

## Phase 5 — commit, push, open PR

1. `git add docs/FOLLOW_UPS.md docs/CONTEXT.md`
   (Deletion of `scripts/multi-role-smoke.cjs` was already staged by `git rm` in Phase 2a.)
2. Commit message: `chore(scripts): FU-M delete defunct multi-role-smoke.cjs`
3. `git push -u origin chore/fu-m-delete-multi-role-smoke`
4. Open PR against main. Title: `chore(scripts): FU-M delete defunct multi-role-smoke.cjs`. Body must include:
   - Reference to this brief at `docs/briefs/fu-m-delete-multi-role-smoke-kickoff.md`.
   - Reference to FU-M entry in FOLLOW_UPS.md (now RESOLVED 2026-05-18).
   - Note: "Defunct script referencing retired super_admin role + legacy Title_Case env vars. Phase 1 cross-reference safety check confirmed no other repo files reference the script or its env vars. Knock-on effect for FU-F-2: target shrinks 7 → 6 .cjs migrations."
   - Phase 1 cross-reference scan output (verbatim — should show only the expected matches: the file itself + the FU-M entry).
   - Smoke waiver justification.
5. Report PR URL + branch HEAD SHA to dispatcher.

## Phase 6 — post-merge cleanup (eighth canonical Rule 16 application)

Standard sequence per Session Protocol step 9 + § Post-merge local cleanup + Rule 16.

1. `git checkout main && git fetch origin && git pull --ff-only origin main`
2. Capture work PR squash SHA: `git log origin/main --oneline -1` — paste verbatim.
3. **Rule 16 fill scope (mandatory):**
   - `docs/CONTEXT.md` recently-shipped row: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
   - `docs/CONTEXT.md` top-table `Current main HEAD` → work PR squash SHA.
   - `docs/CONTEXT.md` top-table `Active track` → "FU-M defunct-script deletion shipped (PR #{N}, squash {SHA}). multi-role-smoke.cjs removed; FU-F-2 target shrinks 7 → 6."
   - `docs/CONTEXT.md` top-table `Next track` → "Session backlog: FU-F-2 (`.cjs` sibling helper + 6 `.cjs` migrations, S-bucket — sequencing constraint resolved, ready for brief draft); FU-I post-pilot (TENANT_ID parameterization); BEH-1 blocked on slide copy."
   - `docs/CONTEXT.md` top-table `Where we left off` → updated prose covering FU-M same-day close, FU-F-2 sequencing now unblocked, remaining queue.
   - `docs/CONTEXT.md` top-table `Last updated` → ISO date of fill commit.
   - `docs/FOLLOW_UPS.md` FU-M closure paragraph: replace `#{TBD}` and `{TBD}` with actual PR number + squash SHA.
4. `git add docs/CONTEXT.md docs/FOLLOW_UPS.md`
5. Commit: `docs: fill PR #{N} placeholders (FU-M closure) — eighth Rule 16 application`
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

- `scripts/multi-role-smoke.cjs` deleted.
- `docs/FOLLOW_UPS.md` FU-M entry has RESOLVED suffix + closure paragraph with `#{TBD}`/`{TBD}` placeholders.
- `docs/CONTEXT.md` has new recently-shipped row at top (placeholders to be filled in Phase 6).
- `git diff main..HEAD --stat` shows exactly 3 entries: 1 deleted + 2 modified.
- `git diff main..HEAD -- .env.example` returns empty.
- `npm run lint` returns 0 problems.
- `npm run build` completes clean.
- Phase 1 cross-reference safety check passed (only expected matches: the deleted file itself + the FU-M FOLLOW_UPS entry).

## Out of scope

- **Other `.cjs` script migrations** — FU-F-2 territory (next session in current arc).
- **`.env.example` audit** — Phase 1 step 4 verifies it doesn't reference the legacy vars; no `.env.example` edit needed.
- **Pattern H sibling scripts** (`manager-audit-screenshots.cjs`, `manager-audit-screenshots-mobile.cjs`) — those are FU-F-2 migration targets, not defunct.
- **Untracked legacy briefs/scripts cleanup** — separate 2026-05-13 banked FU.

## Rule references

- **Rule 9** — Phase 0 git fetch + branch-off-main gate.
- **Rule 10** — Brief commits to `docs/briefs/` via small docs PR BEFORE CC dispatch.
- **Rule 11** — FU-M body preserved verbatim in RESOLVED block. Three banked Proposed fix options (a/b/c) preserved as drift trail.
- **Rule 12** — Hard-stop language used throughout.
- **Rule 14** — `.env.example` not touched.
- **Rule 15** — Phase 6 step 7 origin verification.
- **Rule 16** — Phase 6 fill scope. Eighth canonical application.
- **Rule 17** — Source-verification at authoring time. Cross-reference safety check is the Phase 1 application (gates the deletion).
- **Rule 27** — Smoke default waived; script deletion has no runtime impact (Phase 1 step 3 confirms no cross-references).

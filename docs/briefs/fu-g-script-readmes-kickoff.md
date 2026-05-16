# FU-G: Script-local READMEs for operational env vars

**Type:** Follow-up closure (LOW severity)
**Shape:** XS, doc-only. One README extension + one new README. No source code. No `.env.example` change.
**Reference shape:** Matches FU-D/FU-E (PR #178) — minimal-touch doc-only ship with FOLLOW_UPS resolved-block pattern.
**Banking origin:** 2026-05-17 env-credentials propagation audit Layer 3; scope re-confirmed in 2026-05-17 methodology batch audit (FU-I carved out at that time).

---

## Context

Two operational env vars are read across `scripts/verification/**` and `scripts/cleanup/**` but absent from any documentation. They are orchestration knobs (not credentials or Firebase client config), so they belong in script-local READMEs per Rule 14.

- **PREVIEW_HOST** — consumed across ~18 verification smoke/walk scripts. Existing `scripts/verification/README.md` documents VERCEL_BYPASS_TOKEN + A11Y_AGENT_PASSWORD but omits PREVIEW_HOST.
- **CLEANUP_ALLOWED_TENANTS** — consumed in `scripts/cleanup/wipe-test-data-sweep.mjs:90`, `scripts/cleanup/preview-test-data-sweep.mjs:71`, and orchestrator sites in `scripts/verification/pr-f-bulk-test-data-smoke.mjs` + `scripts/verification/shakedown/**`. `scripts/cleanup/README.md` does not exist — this FU creates it.

**Sub-finding (flag in verification README, not fix):** PREVIEW_HOST consumption is inconsistent — some scripts hardcode the host string (`e1-slice-2b-walk.mjs:53`, `e2-walk.mjs:48`), others read `process.env.PREVIEW_HOST` with a fallback. Documentation alone won't unify the pattern. The README must note the env var is the preferred path and that hardcoded sites are pre-existing drift. **Consolidation is explicitly out of scope.**

---

## Phase 0 — Pre-flight (Rule 9 gate)

1. `git fetch origin`
2. `git checkout main && git pull --ff-only origin main`
3. Confirm HEAD matches the brief-docs PR squash (will be confirmed by dispatcher at execution time).
4. `git checkout -b chore/fu-g-script-readmes`
5. Any failure or drift → **STOP and wait for dispatcher.**

## Phase 1 — FU body + source state verification (Rule 11)

1. `grep -A 30 "FU-G —" docs/FOLLOW_UPS.md` — confirm scope statement matches this brief (PREVIEW_HOST + CLEANUP_ALLOWED_TENANTS, READMEs only, no `.env.example`).
2. Verify `scripts/verification/README.md` exists. Capture its current Environment requirements section verbatim for the diff context. Confirm PREVIEW_HOST is NOT currently documented.
3. Verify `scripts/cleanup/README.md` does NOT exist (`ls scripts/cleanup/`). If it does → **STOP and wait for dispatcher** (FU body needs re-banking).
4. Verify `docs/runbooks/test-data-lifecycle.md` exists. If it does not → **STOP and wait for dispatcher** (cross-reference target missing; spec is not executable).
5. Verify the PREVIEW_HOST hardcoded drift sites are still present: `grep -n "vercel.app\|PREVIEW_HOST" scripts/verification/e1-slice-2b-walk.mjs scripts/verification/e2-walk.mjs` — both should surface hardcoded host strings.
6. Verify CLEANUP_ALLOWED_TENANTS abort-guard semantics by reading the actual source: `grep -B 2 -A 10 "CLEANUP_ALLOWED_TENANTS" scripts/cleanup/wipe-test-data-sweep.mjs scripts/cleanup/preview-test-data-sweep.mjs`. Capture the abort logic exactly so the README describes real behavior (not assumed behavior).

Any verification failure → **STOP and wait for dispatcher.**

## Phase 2 — Execute

### 2a. Extend `scripts/verification/README.md`

Add a PREVIEW_HOST entry to the Environment requirements section, alongside existing VERCEL_BYPASS_TOKEN + A11Y_AGENT_PASSWORD entries. Format must match the existing entries' shape. Contents:

- Purpose: overrides the preview host for smoke and walk scripts.
- Default behavior: if unset, scripts using the fallback pattern default to the production preview URL; scripts that hardcode the host ignore this env var entirely (see drift note below).
- Example: `PREVIEW_HOST=https://agencytrack-preview-XXXX.vercel.app`
- Drift note (one line): "Two legacy walk scripts (`e1-slice-2b-walk.mjs`, `e2-walk.mjs`) hardcode the host instead of reading PREVIEW_HOST. The env var is the preferred path; the hardcoded sites are pre-existing drift, out of scope for FU-G."

### 2b. Create `scripts/cleanup/README.md`

New file. Sections in order:

1. **Purpose** — one paragraph: `scripts/cleanup/**` contains test-data sweep and preview-data scripts for the multi-tenant Firestore. Operations are destructive and gated by an allowlist env var.
2. **Environment requirements** — CLEANUP_ALLOWED_TENANTS as a comma-separated tenant ID allowlist. Required for `wipe-test-data-sweep.mjs` and `preview-test-data-sweep.mjs`. Abort-guard semantics described per the actual source captured in Phase 1.6 (do not invent behavior). Example: `CLEANUP_ALLOWED_TENANTS=tatillife_south`.
3. **Consumer list** — short paragraph naming `wipe-test-data-sweep.mjs`, `preview-test-data-sweep.mjs`, and the orchestrator consumption from `pr-f-bulk-test-data-smoke.mjs` + shakedown harness.
4. **Cross-reference** — "See `docs/runbooks/test-data-lifecycle.md` for the full operator runbook and lifecycle." Use a relative Markdown link.

## Phase 3 — Verify

1. `git diff --stat` shows exactly two changed entries: `M scripts/verification/README.md`, `A scripts/cleanup/README.md`. Anything else → **STOP and wait for dispatcher.**
2. `git diff main -- .env.example` returns empty. Rule 14 carve-out preserved.
3. Read both READMEs end-to-end. Confirm Markdown renders cleanly (headings, code blocks, the relative link to `docs/runbooks/test-data-lifecycle.md`).
4. Run `npm run lint` for parity; no source touched so no errors expected.

## Phase 4 — Docs placeholder fill (same commit)

1. **`docs/FOLLOW_UPS.md`** — replace the active "FU-G —" entry with a resolved-block matching the FU-D/FU-E pattern:
   > `**Resolved in PR #{TBD}** ({TBD}, 2026-05-17). [one-paragraph summary of what was added]. .env.example was intentionally NOT modified per Rule 14 carve-out (these are operational knobs, not credentials).`
2. **`docs/CONTEXT.md`** — add a recently-shipped row using `#TBD` for PR number and `{TBD}` for squash SHA. One-line summary: "FU-G script-local READMEs (LOW closure): PREVIEW_HOST documented in `scripts/verification/README.md`; new `scripts/cleanup/README.md` documents CLEANUP_ALLOWED_TENANTS. `.env.example` untouched per Rule 14 carve-out."
3. **Top-table state in CONTEXT.md is explicitly out of scope** for this Phase 4 — `Current main HEAD`, `Active track`, `Next track`, and "Where we left off" prose are NOT updated here. Pending FU-H methodology resolution. Do not touch.

## Phase 5 — Commit, push, open PR

1. `git add scripts/verification/README.md scripts/cleanup/README.md docs/FOLLOW_UPS.md docs/CONTEXT.md`
2. Commit message: `docs(scripts): document PREVIEW_HOST + CLEANUP_ALLOWED_TENANTS in script-local READMEs (FU-G)`
3. `git push -u origin chore/fu-g-script-readmes`
4. Open PR against main. Title: `docs(scripts): document operational env vars in script-local READMEs (FU-G)`. Body: references this brief at `docs/briefs/fu-g-script-readmes-kickoff.md`, links the FOLLOW_UPS.md FU-G entry, explicitly states `.env.example` was NOT modified.
5. Report PR URL + branch SHA to dispatcher.

## Phase 6 — Post-merge cleanup (after dispatcher confirms merge)

Standard sequence per Session Protocol step 9 + § Post-merge local cleanup:

1. `git checkout main && git fetch origin && git pull --ff-only origin main`
2. Capture work PR squash SHA: `git log origin/main --oneline -1` — paste verbatim to dispatcher.
3. Fill `#{TBD}`/`{TBD}` placeholders in `docs/CONTEXT.md` (recently-shipped row) + `docs/FOLLOW_UPS.md` (FU-G resolved block) with the real PR number and squash SHA.
4. `git add docs/CONTEXT.md docs/FOLLOW_UPS.md`
5. Commit: `docs: fill PR #{N} placeholders (FU-G closure)`
6. `git push origin main`
7. **Rule 15 verification (mandatory):**
   - `git fetch origin && git log origin/main --oneline -1` — paste verbatim.
   - `git rev-parse HEAD && git rev-parse origin/main` — paste verbatim.
   - Confirm: local HEAD == origin/main, subject matches the fill commit, work PR squash SHA sits directly below.
   - Report "pushed and verified" with all SHAs visible.
   - Any mismatch → **STOP and wait for dispatcher.** Hard-stop.
8. Optional: delete `chore/fu-g-script-readmes` locally + remote.

---

## Acceptance criteria

- `scripts/verification/README.md` Environment requirements section has a PREVIEW_HOST entry meeting Phase 2a's four sub-bullets.
- `scripts/cleanup/README.md` exists and documents CLEANUP_ALLOWED_TENANTS per Phase 2b, with abort-guard semantics matching the real source captured in Phase 1.6.
- `git diff main..HEAD -- .env.example` returns empty.
- `docs/FOLLOW_UPS.md` FU-G entry in resolved-block form with PR number + SHA filled post-merge.
- `docs/CONTEXT.md` recently-shipped row for FU-G filled post-merge.

## Out of scope

- `.env.example` modification (Rule 14 carve-out).
- PREVIEW_HOST hardcoded-site consolidation in `e1-slice-2b-walk.mjs` / `e2-walk.mjs`. Documentation flags the drift; source fix is separate, unbanked.
- TENANT_ID parameterization (FU-I, deferred post-pilot).
- CONTEXT.md top-table state updates (pending FU-H methodology resolution).

## Rule references

- **Rule 9** — Phase 0 git fetch + branch-off-main gate.
- **Rule 10** — This brief commits to `docs/briefs/` via a small docs PR BEFORE CC dispatch.
- **Rule 11** — FU body re-audit in Phase 1.
- **Rule 12** — Hard-stop language ("STOP and wait for dispatcher") used unambiguously throughout.
- **Rule 14** — `.env.example` is the canonical credential doc; operational orchestration knobs do NOT belong there.
- **Rule 15** — Post-merge verification mandatory in Phase 6.

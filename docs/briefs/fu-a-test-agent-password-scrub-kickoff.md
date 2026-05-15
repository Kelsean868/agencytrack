# Kickoff Brief — FU-A: Scrub hardcoded test agent password (HIGH exposure closure)

**Type:** Code change + docs scrub + FU bank-as-Resolved PR (XS-S size)
**Shape:** HIGH#6 / PR #160 closure pattern
**Strike count opens at:** 0/2
**Smoke:** Waived (admin script change, no user-visible surface; operator-only invocation path)

---

## Audit findings (from env-credentials propagation audit, 2026-05-16)

`functions/set-agent-password.cjs` contains a literal test agent password and Firebase Auth UID at lines 5-7, tracked in git. Same password value referenced in 3 brief files. Surfaced as Section 4 Exposure #1 of the audit. HIGH priority — bounded blast radius (test account `kelsean@gmail.com`, UID `J0j4uBqzTPcfm1IlGCPyDzo27RP2`) but real plaintext password exposure in tracked files.

## Decisions locked

1. **.env.local read pattern** — relocate password to `TEST_AGENT_PASSWORD` env var, read via `dotenv`. CLI arg option rejected for ergonomics (operator runs this manually; remembering CLI args is friction)
2. **3-brief-file scrub** — replace literal password with `<TEST_AGENT_PASSWORD>` placeholder in `docs/briefs/walk-1-kickoff.md`, `docs/briefs/polish-series-housekeeping-kickoff.md`, `docs/briefs/e1-slice-2b-kickoff.md`
3. **Operator rotation as post-merge action** — code change doesn't invalidate the leaked credential; PR body explicitly instructs Kelsean to rotate via Firebase Console post-merge
4. **Bank-as-Resolved pattern** — FU-A is created directly in the Resolved section with full closure note. No Active-section round-trip. (Same pattern as PR #172's SEC-9b residual closure.)
5. **Demonstrates Rule 14** — adds `TEST_AGENT_PASSWORD` to `.env.example` in same PR as the new read site, satisfying Rule 14 (whether or not PR A has merged yet — PR B is independent)

## Phase 0 — Gate

1. Confirm on `main`, working tree clean. `git fetch origin && git pull origin main`.
2. Create fresh branch off freshly-fetched main: `chore/close-fu-a-test-agent-password-scrub`
3. Confirm CLAUDE.md Phase 0 gate checks pass.

## Phase 1 — Locate sources & verify state

1. Read `functions/set-agent-password.cjs` in full. Confirm:
   - Literal password value at lines 5-7
   - Firebase Admin SDK init pattern
   - Whether `dotenv` is already imported (likely not)
2. Read `.env.example` in full. Confirm structure for adding a new entry.
3. Read each of the 3 brief files at the cited lines (from audit Section 4 Exposure #1):
   - `docs/briefs/walk-1-kickoff.md:92`
   - `docs/briefs/polish-series-housekeeping-kickoff.md:69`
   - `docs/briefs/e1-slice-2b-kickoff.md:366`
   Confirm the literal password value appears at each. Capture exact surrounding context (sentence-level) **without surfacing the literal value to chat**.
4. Confirm no other tracked file in the repo contains the same literal password (run `grep -r <literal-password> .` — interpret matches locally, do not surface the value).

**Hard stops (Rule 12 canonical):**
- If the literal password value differs across the 4 files (unexpected): **STOP and wait for dispatcher**
- If any other tracked file beyond the 4 enumerated contains the same literal password: **STOP and wait for dispatcher** (expansion of Section 4 Exposure #1 scope)
- If `dotenv` package is not installed (check `package.json`): **STOP and wait for dispatcher** (would need separate install commit, scope expansion)

## Phase 2 — Apply edits

### Edit 1 — `functions/set-agent-password.cjs`

Refactor to:
1. Load environment via `dotenv` at script start (require pattern for `.cjs`)
2. Read `TEST_AGENT_PASSWORD` from `process.env`
3. Fail fast with clear error if env var is missing

Approximate code shape (CC adapts to actual file structure):

```js
require('dotenv').config({ path: '.env.local' });

const NEW_PASSWORD = process.env.TEST_AGENT_PASSWORD;
if (!NEW_PASSWORD) {
  console.error('ERROR: TEST_AGENT_PASSWORD must be set in .env.local');
  console.error('Add: TEST_AGENT_PASSWORD=<value> to .env.local before running this script');
  process.exit(1);
}
```

Remove the literal password value entirely. Preserve the UID (it's a public identifier, not a secret).

### Edit 2 — `.env.example`

Add a new entry (near the bottom of the file, or wherever test credentials are documented):

```
# TEST_AGENT_PASSWORD — password for the test agent account (kelsean@gmail.com)
# Used by functions/set-agent-password.cjs to rotate the test agent's password
# Optional: only required when running that script
TEST_AGENT_PASSWORD=
```

### Edit 3 — Scrub 3 brief files

For each of the 3 brief files, replace the literal password reference with `<TEST_AGENT_PASSWORD>` placeholder text. Adapt to the surrounding sentence context.

Approximate shape:
- Before: `kelsean@gmail.com / <literal-password>`
- After: `kelsean@gmail.com / <TEST_AGENT_PASSWORD>` (or descriptive equivalent — e.g., "test agent password from `.env.local`")

**CRITICAL — DO NOT include the literal password value in:**
- The commit message
- The PR description / body
- Any file content (including this brief if updates are made)
- Any chat output

Reference by FU-A only. The grep verification (Phase 3) is local to CC's execution and never surfaced.

## Phase 3 — Verification

1. `npm run lint` — must pass with 0 problems (preserves PR #172's clean baseline).
2. `npm run build` — clean build.
3. **Structural verification of the script** (without invoking it):
   - Confirm `require('dotenv').config()` line was added
   - Confirm `process.env.TEST_AGENT_PASSWORD` is the source
   - Confirm error-on-missing path exists
   - Confirm no literal password remains anywhere in the file
4. **Grep verification:** `grep -r <literal-password> .` (CC uses the actual literal identified in Phase 1) should return zero matches across tracked files. If matches found in untracked files: log locally, do NOT modify untracked files (out of scope).

**Hard stops (Rule 12 canonical):**
- If lint regresses from 0 problems: **STOP and wait for dispatcher**
- If build fails: **STOP and wait for dispatcher**
- If grep finds residual literal password in any tracked file post-edit: **STOP and wait for dispatcher**

## Phase 4 — Docs (FU-A bank-as-Resolved + CONTEXT.md)

### FOLLOW_UPS.md — append FU-A directly to Resolved section

Append at the end of the Resolved section (bank-and-resolve in same PR, matching PR #172's SEC-9b pattern):

```
### FU-A: Hardcoded test agent password scrub (RESOLVED 2026-05-16)

**Banked + resolved in same PR.** The `functions/set-agent-password.cjs` script contained a literal test agent password and Firebase Auth UID at lines 5-7, tracked in git. Same password value also appeared in 3 brief files (`docs/briefs/walk-1-kickoff.md:92`, `docs/briefs/polish-series-housekeeping-kickoff.md:69`, `docs/briefs/e1-slice-2b-kickoff.md:366`).

**Blast radius:** Test agent account only (`kelsean@gmail.com`, UID `J0j4uBqzTPcfm1IlGCPyDzo27RP2`). Bounded but real plaintext exposure.

**Fixes applied in this PR:**
- `functions/set-agent-password.cjs`: literal password replaced with `process.env.TEST_AGENT_PASSWORD` read via `dotenv`; fail-fast on missing env var
- `.env.example`: `TEST_AGENT_PASSWORD` documented with purpose comment (Rule 14 compliance)
- 3 brief files: literal password scrubbed, replaced with `<TEST_AGENT_PASSWORD>` placeholder
- Grep verification confirmed no tracked file retains the literal value

**Operator action (post-merge, required):** Rotate test agent password via Firebase Console → Authentication → Users → kelsean@gmail.com → Reset password. **The code change alone does not invalidate the leaked credential — only rotation does.** Update `.env.local` with the new value to keep the script functional.

**Surfaced from:** Section 4 Exposure #1 of env-credentials propagation audit (2026-05-16).
```

### CONTEXT.md — Recently shipped placeholder

Add a placeholder row at top of the Recently shipped table for this PR. Drop oldest to maintain 5-row contract.

## Phase 5 — Commit, push, PR

1. Stage all changes:
   ```
   git add functions/set-agent-password.cjs .env.example \
           docs/briefs/walk-1-kickoff.md \
           docs/briefs/polish-series-housekeeping-kickoff.md \
           docs/briefs/e1-slice-2b-kickoff.md \
           docs/FOLLOW_UPS.md docs/CONTEXT.md
   ```
2. `git commit -m "chore(security): close FU-A — scrub test agent password from tracked files (Rule 14 compliance)"`
3. `git push -u origin chore/close-fu-a-test-agent-password-scrub`
4. Open PR with body containing:
   - Reference to FU-A surfaced in env-credentials propagation audit (2026-05-16)
   - Summary: password scrubbed from 4 tracked files; `.env.local` read pattern adopted; Rule 14 demonstrated
   - **⚠️ POST-MERGE OPERATOR ACTION REQUIRED:** "Rotate the test agent password (`kelsean@gmail.com`, UID `J0j4uBqzTPcfm1IlGCPyDzo27RP2`) via Firebase Console → Authentication → Users → Reset password. **The code change alone does not invalidate the leaked credential.** Update `.env.local` with the new value to keep the script functional."
   - **Smoke waiver justification:** "Admin script change — operator-only invocation path, no user-visible surface, no client bundle impact. Functional verification structural (script not invoked); credential exposure closed by code change + operator rotation."
5. Stop after PR is open. Wait for Kelsean to merge.

---

## Acceptance criteria

- `functions/set-agent-password.cjs`: literal password removed; `dotenv` import added; `process.env.TEST_AGENT_PASSWORD` read with fail-fast on missing
- `.env.example`: `TEST_AGENT_PASSWORD` documented with purpose comment (Rule 14 compliance)
- 3 brief files: literal password replaced with `<TEST_AGENT_PASSWORD>` placeholder
- No literal password remains in any tracked file (grep-verified)
- FU-A appended directly to FOLLOW_UPS.md Resolved section with full closure note
- CONTEXT.md placeholder row added; oldest dropped to maintain 5-row contract
- Lint preserved at 0 problems
- Build clean
- Smoke waiver justified inline in PR body
- **Operator-action note for post-merge rotation included in PR body (explicit, visible)**

## Out of scope

- Actual password rotation (operator-only action, post-merge)
- Other FUs from the audit (separate work — see PR A for banking)
- Any tracked-but-gitignored cleanup (FU-C territory)
- Email address scrub from seed scripts (FU-C territory)
- Modifying untracked files even if they contain the literal password (out of scope; surface in chat if encountered)

## Standing rule reminders

- Single-branch PR rule
- Phase 0 gate
- Smoke waiver justified inline
- Post-merge sequence (Rule 4) runs automatically
- All hard stops use Rule 12 canonical phrasing
- **CRITICAL:** Do NOT include the literal password value in commit messages, PR descriptions, file content, or chat output. Reference by FU-A only.

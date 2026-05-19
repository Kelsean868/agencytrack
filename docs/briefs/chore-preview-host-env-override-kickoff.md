# PR brief — PREVIEW_HOST env override on 2 verification smokes

**Sized:** XS (2 line changes total, 1 file each)
**Branch:** `chore/preview-host-env-override`
**Type:** Verification-script refactor.

## Outcome

Add `process.env.PREVIEW_HOST ??` env-override pattern to 2 tracked verification smokes that currently hardcode their preview URL default. Closes the PREVIEW_HOST override FU banked in PR #225 (`975b0fc`).

Pattern to apply (already in use at `mobile-fu2-tap-targets-smoke.mjs:61-62` and `mobile-fu4-cosmetics-smoke.mjs:73-75`):

```javascript
const PREVIEW_HOST = process.env.PREVIEW_HOST ?? '<existing-stale-default>';
```

Files to update:
1. `scripts/verification/border-border-smoke.mjs:34-35`
2. `scripts/verification/resend-invite-ui-smoke.mjs:43-44`

Existing literal defaults stay as fallbacks — re-runs against future preview branches honor `$env:PREVIEW_HOST` from the operator shell.

## Decisions locked

- No other logic changes — env-override only
- Existing stale defaults stay as fallbacks (no value to changing them now; the env override is the re-run mechanism going forward)
- 2 already-correct smokes (mobile-fu2, mobile-fu4) are untouched

## Out of scope

- Modifying the stale default URLs themselves
- Adding PREVIEW_HOST support to other smokes (e.g. `high6-ytd-smoke.mjs`, `mgr-mobile-audit.cjs`) — separate task if any need it
- Any other env var work
- Logic changes beyond the override
- Adding tests for the env-override behavior (verification scripts themselves are the test surface)

## Phase 0 — gate

Standard. STOP on divergence.

## Phase 1 — sanity checks (Rule 17 source-verify, source-verification sub-bullet applies)

1. **Verify target files have the literal pattern (not env override):**
Select-String -Path scripts/verification/border-border-smoke.mjs -Pattern "PREVIEW_HOST" -Context 0,1
Select-String -Path scripts/verification/resend-invite-ui-smoke.mjs -Pattern "PREVIEW_HOST" -Context 0,1
   Expected: each file shows `const PREVIEW_HOST = '...literal...'` (no `process.env.PREVIEW_HOST`). If either already has the env override, STOP for dispatcher (FU may have been partially resolved elsewhere).

2. **Verify positive-precedent files have the env-override pattern** (paired verification per Rule 17 sub-bullet):
Select-String -Path scripts/verification/mobile-fu2-tap-targets-smoke.mjs -Pattern "process.env.PREVIEW_HOST"
Select-String -Path scripts/verification/mobile-fu4-cosmetics-smoke.mjs -Pattern "process.env.PREVIEW_HOST"
   Expected: each file shows the env-override usage. This confirms the pattern this PR mirrors. If either is missing, the FU premise has shifted — STOP for dispatcher.

3. **Capture exact line content for str_replace**: read each target file at the PREVIEW_HOST line and capture the exact literal text to substitute. Line numbers from FU (34-35, 43-44) are reference, not authoritative — source-verify the current state.

4. **Confirm both files are tracked** (not still untracked from before PR #225's TRACK action):
git ls-files scripts/verification/border-border-smoke.mjs scripts/verification/resend-invite-ui-smoke.mjs
   Expected: both paths appear in output. If either is still untracked, the brief premise has shifted — STOP for dispatcher.

## Phase 2 — edits

### Edit 1 — `scripts/verification/border-border-smoke.mjs`

`str_replace` the captured literal `const PREVIEW_HOST = '<default>';` with:
```javascript
const PREVIEW_HOST = process.env.PREVIEW_HOST ?? '<default>';
```

Preserve the exact original default string (don't change the URL value).

### Edit 2 — `scripts/verification/resend-invite-ui-smoke.mjs`

Same pattern as Edit 1 on this file's PREVIEW_HOST declaration.

### Edit 3 — Close PREVIEW_HOST FU in `docs/FOLLOW_UPS.md`

Find the FU section: `### Add PREVIEW_HOST env override to 2 verification smokes (LOW, refactor)` (banked in PR #225 cycle, commit `e02f79b`).

1. Prefix heading with ✅ and suffix with `— CLOSED 2026-05-19 (PR #TBD, {TBD})`.
2. Prepend body: `**RESOLVED 2026-05-19**`.
3. Append closing note:
Shipped via PR #TBD ({TBD}). Both files now honor PREVIEW_HOST env override. Existing stale defaults preserved as fallback.

### Edit 4 — Update `docs/CONTEXT.md`

1. Drop oldest row in Recently-shipped table.
2. Add new row at top with `#TBD` / `{TBD}` placeholders. Description: "PREVIEW_HOST env override on border-border + resend-invite-ui smokes — closes FU banked in PR #225. Pattern mirrors existing mobile-fu2 / mobile-fu4 smokes."
3. Update `Current main HEAD` field to `{TBD}`.
4. Update `Active track` field to "PREVIEW_HOST env override — chore/preview-host-env-override in flight."
5. Update `Next track` field to "Pending: Resend invite mail/ swap (#215), Resend invite audit log (#215). MEDIUM still empty."
6. Update "Where we left off" prose: 1–2 short paragraphs noting this PR closes the PREVIEW_HOST FU banked in PR #225, completing a session arc that shipped 6 work PRs and closed 5 LOW FUs (R2-R5 by audit, UI discovery, @apply sweep, untracked scripts, PREVIEW_HOST). LOW tier reduces to just the two #215 Resend invite items.

## Phase 3 — verification

1. `npm run lint` → expect clean.
2. `npm run build` → expect clean (verification scripts not part of app build, but ensures no breakage).
3. Syntax check both modified files:
node --check scripts/verification/border-border-smoke.mjs
node --check scripts/verification/resend-invite-ui-smoke.mjs
   Expected: exit 0.
4. Post-edit grep to confirm both files now show env override:
Select-String -Path scripts/verification/border-border-smoke.mjs -Pattern "process.env.PREVIEW_HOST"
Select-String -Path scripts/verification/resend-invite-ui-smoke.mjs -Pattern "process.env.PREVIEW_HOST"
   Expected: 1 match per file.

## Phase 4 — smoke

**Waived.** Justification: verification-script refactor, not part of app runtime. Env override is additive — preserves existing literal default as fallback. No user-visible surface, no runtime behavior change, no Firestore rules touched.

## Phase 5 — commit, push, open PR

1. Fresh branch off Phase 0 SHA: `git checkout -b chore/preview-host-env-override` (Rule 1).
2. Stage all 4 modifications (2 scripts + FOLLOW_UPS.md + CONTEXT.md).
3. Commit message:
chore(verification): add PREVIEW_HOST env override to 2 smokes
Aligns scripts/verification/border-border-smoke.mjs and resend-invite-ui-smoke.mjs
with the env-override pattern already used in mobile-fu2-tap-targets-smoke.mjs
and mobile-fu4-cosmetics-smoke.mjs.
Pattern:
const PREVIEW_HOST = process.env.PREVIEW_HOST ?? '<existing-default>';
Existing stale defaults preserved as fallback — re-runs against future preview
branches honor $env:PREVIEW_HOST from the operator shell.
Closes PREVIEW_HOST env override FU banked in PR #225 (e02f79b).
Smoke waived: verification-script refactor, no app runtime surface.

4. Push: `git push -u origin chore/preview-host-env-override`.
5. Open PR via `gh pr create` or GitHub UI. Title: `chore(verification): add PREVIEW_HOST env override to 2 smokes`.
6. Surface PR URL.

## Phase 6 — held

Standard. Per documented dual-surface gap at `cb18914`: if `/post-merge` displays "unrecognized" on CLI, CC still executes — wait for the post-merge summary.

# PR brief — Untracked verification scripts resolution

**Sized:** S (6 file additions + 1 deletion + 4 inline comment additions)
**Branch:** `chore/untracked-scripts-resolution`
**Type:** Repo housekeeping. No app runtime surface change.

## Outcome

Resolve 7 untracked verification scripts accumulated over recent sessions in `scripts/` directory:

1. **TRACK 6 scripts** — structural peers of the 19 existing tracked smokes under `scripts/verification/`:
   - `scripts/mgr-mobile-audit.cjs` (331 lines, banked PR #90)
   - `scripts/verification/border-border-smoke.mjs` (285 lines, banked PR #156)
   - `scripts/verification/high6-ytd-smoke.mjs` (160 lines, banked PR #160)
   - `scripts/verification/mobile-fu2-tap-targets-smoke.mjs` (333 lines, banked PR #153)
   - `scripts/verification/mobile-fu4-cosmetics-smoke.mjs` (352 lines, banked PR #154)
   - `scripts/verification/resend-invite-ui-smoke.mjs` (217 lines, banked PR #215)

2. **DELETE 1 script** — `scripts/verification/pr-d-email-smoke.mjs` (719 lines, banked PR #133).
   Rationale: imports forbidden `functions/service-account-key.json` per CLAUDE.md (banned post-PR #78); hardcoded production identifiers (UID, emails, tenant ID); mutates production (creates/deactivates 4 users, sends real emails); purpose discharged at PR #133 ship time. Reversible if Track D cron audit returns (rewrite for ambient creds + env-flag gate then).

3. **POLISH 4 scripts** — document `PREVIEW_HOST` env override as the re-run mechanism, inline as one-line comments near each script's stale-default preview URL. Affected: `border-border-smoke.mjs`, `mobile-fu2-tap-targets-smoke.mjs`, `mobile-fu4-cosmetics-smoke.mjs`, `resend-invite-ui-smoke.mjs`.

## Decisions locked

- pr-d-email-smoke.mjs path is DELETE, not REWRITE-AND-TRACK. Documented in commit message for future audit trail.
- `scripts/verification/` tracking convention is the established norm — 6 TRACK candidates are exact structural peers of existing tracked smokes (19 already there per audit).
- No executable logic changes to the 6 TRACK scripts — they're added as-is. Inline comment polish is the only modification.
- Hardcoded sensitive identifiers in the 6 TRACK scripts (UIDs, tenant IDs, emails) were vetted in audit — CC explicitly confirmed redaction patterns applied via `setupBypassSession` + per-script `redact()` helpers; no credential-echo violations.

## Out of scope

- Track D email-cron work (separate scope, not active)
- Rewriting `pr-d-email-smoke.mjs` for ambient creds (deferred per DELETE decision)
- Any executable logic changes to the 6 TRACK scripts (read-only verification logic stays as-is)
- Removing `functions/service-account-key.json` from disk (separate hygiene concern; key file is already gitignored)
- Adding new smokes for shipped PRs not in the 7-script inventory
- The 7 worktree-attached `[gone]` branches (separate cleanup FU)

## Phase 0 — gate

Standard. STOP on divergence.

## Phase 1 — sanity checks (Rule 17 source-verify, source-verification sub-bullet applies)

1. **Inventory** — confirm 7 untracked scripts match the audit:
git ls-files --others --exclude-standard scripts/
   Expected 7 files matching the audit list. If count differs, surface and STOP for dispatcher.

2. **Verify scripts/verification/ tracking convention exists** (paired verification, Rule 17 sub-bullet):
git ls-files scripts/verification/ | Measure-Object -Line
   Expected ≥10 tracked .mjs / .cjs files. If significantly fewer, the precedent claim is wrong — STOP for dispatcher.

3. **Verify gitignore doesn't block additions** (Rule 17 sub-bullet — `git check-ignore -v` for each path):
git check-ignore -v scripts/mgr-mobile-audit.cjs
git check-ignore -v scripts/verification/border-border-smoke.mjs
git check-ignore -v scripts/verification/high6-ytd-smoke.mjs
git check-ignore -v scripts/verification/mobile-fu2-tap-targets-smoke.mjs
git check-ignore -v scripts/verification/mobile-fu4-cosmetics-smoke.mjs
git check-ignore -v scripts/verification/resend-invite-ui-smoke.mjs
   Expected: each returns no ignore match (script will git add successfully). If any are blocked, surface and STOP for dispatcher.

4. **Re-verify pr-d-email-smoke.mjs credential violation** (Rule 17 sub-bullet):
Select-String -Path scripts/verification/pr-d-email-smoke.mjs -Pattern "service-account-key|admin.credential.cert"
   Expected: matches found. If zero matches, the audit premise has shifted — STOP for dispatcher (the file may have already been cleaned).

5. **Confirm CLAUDE.md still forbids service-account-key.json pattern**:
Select-String -Path CLAUDE.md -Pattern "service-account-key"
   Expected: matches found referencing the PR #78 removal. If zero, the ban may have been relaxed — STOP for dispatcher.

## Phase 2 — edits

### Edit 1 — `git add` the 6 TRACK scripts (no content changes)
git add scripts/mgr-mobile-audit.cjs
git add scripts/verification/border-border-smoke.mjs
git add scripts/verification/high6-ytd-smoke.mjs
git add scripts/verification/mobile-fu2-tap-targets-smoke.mjs
git add scripts/verification/mobile-fu4-cosmetics-smoke.mjs
git add scripts/verification/resend-invite-ui-smoke.mjs

Verify staging:
git diff --cached --stat
Expected: 6 new files staged with line counts roughly matching audit (~1678 lines total).

### Edit 2 — `git rm` pr-d-email-smoke.mjs
git rm scripts/verification/pr-d-email-smoke.mjs

Confirm removal:
Test-Path scripts/verification/pr-d-email-smoke.mjs
Expected: `False`.

### Edit 3 — Polish: add PREVIEW_HOST override comment to 4 scripts

For each of:
- `scripts/verification/border-border-smoke.mjs` (current stale default near line 35)
- `scripts/verification/mobile-fu2-tap-targets-smoke.mjs` (line 62)
- `scripts/verification/mobile-fu4-cosmetics-smoke.mjs` (line 74)
- `scripts/verification/resend-invite-ui-smoke.mjs` (line 44)

Read the file to find the actual hardcoded preview URL line (audit line numbers are reference, not authoritative). Insert a one-line comment immediately above the stale URL default:

```javascript
// Stale default — overridable via PREVIEW_HOST env var for re-runs against future preview branches or production.
```

If the file already has such a comment (defensive check, per Rule 17 source-verify sub-bullet), skip the edit for that file and note in summary.

Stage these 4 modifications:
git add scripts/verification/border-border-smoke.mjs
git add scripts/verification/mobile-fu2-tap-targets-smoke.mjs
git add scripts/verification/mobile-fu4-cosmetics-smoke.mjs
git add scripts/verification/resend-invite-ui-smoke.mjs

### Edit 4 — Update `docs/FOLLOW_UPS.md` to resolve the untracked-scripts FU

Find the FU section referencing untracked verification scripts (likely under § Worktree + branch audit or a standalone "Untracked verification scripts" entry — grep for "untracked.*scripts" or "verification.*scripts" to locate). 

If found:
- Prefix the heading with ✅ and suffix with `— CLOSED 2026-05-19 (PR #TBD, {TBD})`.
- Prepend body: `**RESOLVED 2026-05-19**`.
- Append closing note: `Shipped via PR #TBD ({TBD}). 6 scripts tracked (structural peers of existing 19 tracked smokes), 1 deleted (pr-d-email-smoke.mjs — service-account-key.json import violation + discharged purpose), 4 preview-URL polish comments added inline.`

If no such FU section exists (it may have lived only in CONTEXT.md "Where we left off" running notes), skip this edit and note in summary.

### Edit 5 — Update `docs/CONTEXT.md`

1. Drop oldest row in Recently-shipped table.
2. Add new row at top with `#TBD` / `{TBD}` placeholders. Description: "Untracked verification scripts resolution — 6 TRACK (peers of existing 19), 1 DELETE (pr-d-email-smoke.mjs — credential pattern violation, purpose discharged), 4 polish comments documenting PREVIEW_HOST override."
3. Update `Current main HEAD` field to `{TBD}`.
4. Update `Active track` field to "Untracked scripts resolution — chore/untracked-scripts-resolution in flight."
5. Update `Next track` field to "Pending: Resend invite mail/ swap (#215), Resend invite audit log (#215)."
6. Update "Where we left off" prose: 1–2 short paragraphs noting this PR resolved the 7-untracked-script overhang via TRACK 6 + DELETE 1, that pr-d-email-smoke.mjs was deleted rather than rewritten due to service-account-key.json import violation + Track D not currently in scope, and that the LOW tier is now reduced to the two Resend invite items.

## Phase 3 — verification

1. `npm run lint` → expect clean. Lint config may not cover `.cjs` / `.mjs` files in `scripts/` — if lint surfaces NEW errors on these scripts that weren't present before, STOP for dispatcher.

2. `npm run build` → expect clean. Scripts in `scripts/` are not part of the app build pipeline; build output should be unaffected. If build fails, STOP for dispatcher.

3. **Stage verification** — `git diff --cached --stat` should show:
   - 6 new files (additions)
   - 1 deleted file (`pr-d-email-smoke.mjs`)
   - 4 modified files (polish comments)
   - 2 modified docs (`docs/FOLLOW_UPS.md` if applicable + `docs/CONTEXT.md`)

4. **Working tree check** — `git status` should show zero untracked files in `scripts/` (the previously-7 are now staged or deleted).

5. **No-op syntax verification on tracked scripts** — confirm each of the 6 TRACK scripts parses cleanly:
node --check scripts/mgr-mobile-audit.cjs
node --check scripts/verification/border-border-smoke.mjs
node --check scripts/verification/high6-ytd-smoke.mjs
node --check scripts/verification/mobile-fu2-tap-targets-smoke.mjs
node --check scripts/verification/mobile-fu4-cosmetics-smoke.mjs
node --check scripts/verification/resend-invite-ui-smoke.mjs
   Expected: each returns exit code 0 (valid syntax). Do NOT run these scripts — they have side effects (network calls, file writes). Syntax check only.

## Phase 4 — smoke

**Waived.** Justification: pure repo housekeeping. No app runtime surface change. The 6 TRACK scripts are added as-is (no logic modification); polish edits are documentation comments only; the deletion removes a file that was never invoked by the build or test pipeline. Smoke waiver permitted per Rule 9 for internal-tooling / repo-state changes.

## Phase 5 — commit, push, open PR

1. Fresh branch off Phase 0 SHA: `git checkout -b chore/untracked-scripts-resolution` (Rule 1).
2. Stage already done in Phase 2 — verify with `git status` clean except for staged changes + docs.
3. Stage docs changes too: `git add docs/CONTEXT.md docs/FOLLOW_UPS.md` (if Edit 4 applied).
4. Commit message:
chore(verification): resolve 7 untracked scripts — 6 track, 1 delete
Aligns scripts/ working-tree state with the established scripts/verification/
tracking convention (19 per-PR smokes already tracked).
TRACK (6):

scripts/mgr-mobile-audit.cjs (PR #90, mgr-mobile audit)
scripts/verification/border-border-smoke.mjs (PR #156)
scripts/verification/high6-ytd-smoke.mjs (PR #160)
scripts/verification/mobile-fu2-tap-targets-smoke.mjs (PR #153)
scripts/verification/mobile-fu4-cosmetics-smoke.mjs (PR #154)
scripts/verification/resend-invite-ui-smoke.mjs (PR #215)

DELETE (1):

scripts/verification/pr-d-email-smoke.mjs (PR #133)
Reasons: imports forbidden functions/service-account-key.json
(banned post-PR #78); hardcoded production UID + emails + tenant ID;
mutates production (creates/deactivates 4 users, sends real emails);
purpose discharged at PR #133 ship time. Reversible if Track D cron
audit returns — write a fresh ambient-creds version then.

POLISH (4):

Inline PREVIEW_HOST override comment added near stale default URLs in
border-border, mobile-fu2-tap-targets, mobile-fu4-cosmetics,
resend-invite-ui smokes. Documents the env override mechanism for
re-runs against future preview branches or production.

Smoke waived: pure repo housekeeping, no app runtime surface change.

5. Push: `git push -u origin chore/untracked-scripts-resolution`.
6. Open PR. Title: `chore(verification): resolve 7 untracked scripts — 6 track, 1 delete`.
7. PR description: outcome summary + smoke-waiver justification + pr-d-email-smoke.mjs deletion rationale.
8. Surface PR URL.

## Phase 6 — held

Standard. Per documented dual-surface gap at `cb18914`: if `/post-merge` displays "unrecognized" on CLI, CC still executes the canonical sequence — wait for the post-merge summary.

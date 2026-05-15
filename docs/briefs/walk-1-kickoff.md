# WALK-1 — Harden walk scripts with real write-read-verify cycles — kickoff brief

**Status:** Ready to execute. Bakes the smoke standard into automated walks.
**Estimated CC effort:** 1–2 days. Single PR.
**Two-strike counter:** 0/2 (fresh session).

---

## Context

The smoke standard (memorialized in project memory): "walks MUST include a real write-read-verify cycle (log in → write Firestore doc → reload → assert persisted) to exercise rules + claims + indexes. Selector-only checks miss bugs."

This was learned the hard way: E3 walk reported 18/18 against both preview AND production while PR #85's `allow get` regression was live, because walk check 9 (`entry_form_saves_to_firestore`) only verified the Save button was enabled — it never fired the actual Firestore write. Manual application of the new smoke pattern caught it immediately.

**Four banked lessons from running smokes manually:**
1. **Bypass cookie value:** `x-vercel-set-bypass-cookie=samesitenone`, NOT `true`. `_vercel_jwt` is the SSO cookie, not the bypass cookie — the bypass cookie is server-set via the URL parameter.
2. **`waitUntil` strategy for Firebase apps:** use `'domcontentloaded'`, never `'networkidle'`. Firebase keeps long-polling sockets open indefinitely; `'networkidle'` will never resolve.
3. **`CardStack.NumericField` selector:** renders `<input type="text" inputMode="numeric">`, NOT `<input type="number">`. Selectors looking for `input[type="number"]` will miss it.
4. **`dispatchEvent('click')` for `display:none` parents:** Playwright refuses force-click on parents that are `display:none`. Use `dispatchEvent('click')` to bypass actionability checks when navigating sidebar items at mobile viewport.

This PR is **prescriptive — design is pre-approved, CC proceeds straight to implementation without a separate Phase 3 design-surface stop.** Hard stops still apply for surprises.

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -3`. HEAD should include the housekeeping PR squash commit (`chore(polish-series)...`) at top, or whatever's at HEAD if housekeeping hasn't merged yet.
4. Confirm clean state: `git worktree list` shows only main. If a stale housekeeping worktree exists, remove it (`git worktree remove <path>` + `git branch -D <branch>` if no unique commits).
5. Create worktree at `.claude/worktrees/feat-walk-hardening` on branch `feat/walk-hardening`.
6. `cd` into the worktree.

---

## Phase 2 — Read existing walk scripts (mandatory before any edits)

Read these in full so the hardening additions are surgical, not refactors:

1. `scripts/exploration-walk.cjs` — general role-based walker
2. `scripts/verification/e3-persistency-walk.mjs` — E3 persistency-specific walk
3. `scripts/wait-vercel-ready.sh` — deployment polling helper (read for context; not modifying)
4. `.env.local` (in main worktree) — confirm it has `VERCEL_BYPASS_TOKEN` set (do NOT echo the value)
5. `package.json` — confirm Playwright is in devDependencies and check if any other Playwright-using scripts exist

Capture in a single output:
- Current structure of each walk (entry point, role-config approach, check pattern)
- Where login happens in each (so the write-read-verify cycle can be appended after)
- What screenshots/reports are generated (where they're saved, what format)

If either script's structure is fundamentally different than expected (e.g., it's a TypeScript framework instead of a simple cjs script, or it uses Selenium not Playwright), STOP and surface — re-scope.

Otherwise, proceed directly to Phase 3 (implementation) without a separate design-approval stop. The design below is pre-approved.

---

## Phase 3 — Implement the hardening (proceed if Phase 2 shows expected script structures)

### 3a — Create a shared helper module

New file: `scripts/verification/lib/walk-helpers.mjs` (or `.cjs` matching the consumer scripts' language — convert as needed; prefer ESM for new code per project convention).

The helper exports:

1. **`buildBypassUrl(baseUrl, token)`** — constructs the bypass URL:
   ```
   ${baseUrl}/?x-vercel-protection-bypass=${token}&x-vercel-set-bypass-cookie=samesitenone
   ```
   Returns the full URL. Token is read from a parameter — never embedded in any log line. The function MUST NOT log its return value.

2. **`waitForFirebaseReady(page)`** — utility that waits for the app to finish initial Firebase auth resolution. Use `domcontentloaded` then a short `waitForFunction` poll for app-rendered content (e.g., presence of a known stable DOM node). Replaces `'networkidle'` patterns.

3. **`hardReloadAndAwaitReady(page)`** — reloads with `{ waitUntil: 'domcontentloaded' }`, then calls `waitForFirebaseReady`.

4. **`writeReadVerifyCycle(page, options)`** — the canonical cycle. Options:
   - `writeFn(page)` — async function that performs a write (fill form, click save, etc.)
   - `verifyFn(page)` — async function that asserts the persisted value is visible after reload
   - `description` — string label for the cycle (logged + used in screenshot filenames)
   - `screenshotDir` — directory for cycle screenshots (e.g., `verification/walks/`)
   
   Sequence: `writeFn` → screenshot `<dir>/<label>-post-write.png` → `hardReloadAndAwaitReady` → `verifyFn` → screenshot `<dir>/<label>-post-verify.png`. Returns `{ pass: boolean, errors: string[] }`.

5. **`safeLog(message, value)`** — guard against accidentally logging tokens or `.env.local` values. Redacts anything that matches token-like patterns (long alphanumeric strings) or paths to `.env.local`. Use this anywhere a value might bleed sensitive data.

Include a top-of-file comment block in the helper documenting the 4 banked lessons (verbatim from the Context section above). Future readers should learn these without leaving the file.

### 3b — Harden `scripts/verification/e3-persistency-walk.mjs`

Add a NEW write-read-verify check using `writeReadVerifyCycle`. Existing checks stay — additive only.

**Cycle definition:**
- `writeFn`: log in as test agent (`kelsean@gmail.com` / `<TEST_AGENT_PASSWORD>` from `.env.local`), navigate to Persistency tab, click Enter, fill 6 fields with `businessPlaced: 1.00` and 0s elsewhere, click Save, wait for dialog close.
- `verifyFn`: assert the "Saved" indicator and/or the rendered persistency value (100.0% / Award-eligible badge) is visible on the Persistency tab.
- `description`: `e3-persistency-write-read-verify`
- `screenshotDir`: existing screenshot path used by the script.

Add this as the **final check** in the walk. Increment the total check count accordingly.

**Selector update for the 6 inputs:** use `input[inputmode="numeric"]` or label-based selectors — NOT `input[type="number"]` (lesson 3).

Update the script's `waitUntil` calls throughout to `'domcontentloaded'` if any use `'networkidle'` (lesson 2).

### 3c — Harden `scripts/exploration-walk.cjs`

Add a NEW write-read-verify check for the **agent role only** (other roles' write surfaces are too varied for one canonical cycle; their existing checks stay unchanged).

**Cycle definition for agent role:**
- `writeFn`: navigate to the weekly wizard (already done in existing agent walk), type a small change into any visible numeric field, wait for the "Saved" indicator (the one added in PR #88), then verify the indicator appeared.
- `verifyFn`: hard-reload, re-open the wizard, assert the typed value persisted.
- `description`: `agent-wizard-write-read-verify`

If the agent role walk doesn't already navigate to the wizard, this addition has to add that navigation. Use the existing role-config pattern.

**Selector update:** same `input[inputmode="numeric"]` / label-based for wizard NumericField inputs.

**For sidebar navigation at mobile viewports:** if the existing walk uses `.click()` and fails at 380px width (sidebar is `display:none`), use `element.dispatchEvent(new Event('click', { bubbles: true }))` instead (lesson 4). Capture this pattern in a helper inside `walk-helpers.mjs` if multiple call sites need it.

Update `waitUntil` calls throughout (lesson 2).

### 3d — Update bypass-handling in BOTH scripts

Replace any existing bypass handling (if either script does it inline) with calls to `buildBypassUrl` from the helper. Ensure no script logs the bypass URL or token. Audit all `console.log` / `console.error` calls in both scripts for accidental token bleeds — fix using `safeLog` where needed.

If `process.env.VERCEL_BYPASS_TOKEN` is not set at runtime, scripts should fail fast with a clear "expected `.env.local` with `VERCEL_BYPASS_TOKEN`" message — not silently navigate to the bypass URL without the token (which would just hit SSO).

---

## Phase 4 — Run the hardened walks against production

Once Phase 3 implementation is complete in the worktree:

1. **Run `scripts/verification/e3-persistency-walk.mjs` against production.** Expected: all existing checks pass (per prior runs) PLUS the new write-read-verify cycle passes.

2. **Run `scripts/exploration-walk.cjs` against production for the agent role.** Expected: existing checks pass plus the new write-read-verify cycle passes.

3. If either fails:
   - **Walk-script bug:** fix it (in this PR's scope). Re-run.
   - **Production regression:** STOP and surface immediately. This would be a real bug the new walks caught.

The successful run output (pass counts + cycle results) goes in the PR body.

---

## Phase 5 — Smoke + tests

**No new unit tests needed** — walk scripts are integration tests themselves. The value is the cycle, not testing the cycle.

**Lint + build:**
- `npm run lint` → 0 errors (the new helper module is .mjs, ensure it doesn't trip the project's ESLint config — surface and fix if it does)
- `npm run build` → green (walk scripts are not bundled, build should be unaffected)
- `npm test` → 100% passing (existing tests unaffected)

---

## Phase 6 — Verify, commit, push, PR

1. `git diff` — review. Should be: new helper file + edits to 2 walk scripts. Nothing else.
2. Commit (recommended: one commit per logical chunk for review clarity):
   - `feat(walks): add scripts/verification/lib/walk-helpers.mjs with bypass + cycle utilities`
   - `feat(walks): harden e3-persistency-walk.mjs with real write-read-verify cycle`
   - `feat(walks): harden exploration-walk.cjs with agent-role write-read-verify cycle`
3. Push, open PR titled: `feat(walks): harden walk scripts with real write-read-verify cycles + 4 banked lessons`
4. PR description MUST include:
   - The 4 banked lessons (verbatim from Context — useful for future grep)
   - Summary of additions per script
   - Production walk run results (pass counts + cycle results)
   - Reference to lessons-documented in the helper module
   - One-line note: "Future walks should use `walk-helpers.mjs` for consistency."
5. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 reveals scripts use a different framework than Playwright OR have a fundamentally different structure → STOP and surface
- Phase 4 production walks fail in unexpected ways (i.e., the new cycle catches a real production bug) → STOP and surface; this is exactly what WALK-1 exists to do, but it changes the scope to "fix the discovered bug first" before WALK-1 can land
- Adding the cycle requires modifying source code (not walk scripts) → STOP and surface; that's not WALK-1 scope
- Any source code changes outside `scripts/` → STOP
- Test suite regression → STOP
- CI gate fails → STOP
- Two strikes hit → STOP

---

## Out of scope

- Walk-script changes for non-agent roles in `exploration-walk.cjs` (branch_manager/unit_manager/sales_manager/tenant_admin write paths are varied; cycle each separately in future PRs as needed)
- New unit tests for the helper module (integration utility; cycle proves itself in actual walks)
- Modifying source code in `src/` to make walks easier (if the cycle uncovers a UX issue, file a separate follow-up — don't fix in this PR)
- Updating `docs/FOLLOW_UPS.md` to close the WALK-1 entry (next housekeeping PR handles closure)
- Building the rules-testing harness (TEST-N, separate)
- BUG-N3 fix (next PR, half-day separate)
- Any deployment changes (Vercel, Firebase, GitHub Actions)
- Adding the cycle to mobile viewport runs (current scope is desktop walk hardening; mobile-specific cycles can be a follow-up)

---

## Files expected to change

- NEW: `scripts/verification/lib/walk-helpers.mjs`
- MODIFIED: `scripts/verification/e3-persistency-walk.mjs`
- MODIFIED: `scripts/exploration-walk.cjs`

That's it. ~3 files. If the diff has more, STOP and surface.

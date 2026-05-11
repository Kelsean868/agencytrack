# WALK-3 — Cookie-based bypass + URL-parameter exposure elimination — kickoff brief

**Status:** Hardening PR. Manual-review-triggered after M3 smoke token leak.
**Estimated CC effort:** Half-day. Single focused PR.
**Two-strike counter:** 0/2 (fresh session).
**Project carry-in:** 3/2 currently (over ceiling). Successful completion of this PR + manual review restores carry-in to **0/2**.

---

## Context

During M3 smoke (in progress), CC wrote a new smoke script that followed the `buildBypassUrl` pattern from `scripts/verification/lib/walk-helpers.mjs`. When the script's `page.goto` failed with `ERR_NAME_NOT_RESOLVED`, Playwright's error message embedded the bypass URL **twice** — once in the top-level error string and once in the `Call log:` block. The script's `redact()` helper used `String.prototype.replace()` (first-occurrence-only), so the second occurrence surfaced unredacted to chat output. Token rotated. M3 paused.

**The root cause is architectural, not just the script bug.** The `buildBypassUrl` pattern places the token in a URL parameter. Any URL containing the token can leak through standard error paths (DNS failures, network errors, stack traces, request logs). Even with `.replaceAll()` in a redaction layer, the next failure mode might encode the token differently (URL-encoded, base64'd, embedded in serialized request state). Redaction is whack-a-mole; the architecture needs to remove the token from URLs entirely after the initial handshake.

**The robust pattern:** the bypass token belongs in a URL **exactly once**, for **exactly one request**, inside a function that catches and sanitizes errors before they surface. After that single request, Vercel sets the session cookie (`_vercel_jwt` or similar), and all subsequent navigation uses the cookie alone — no token in any URL anywhere.

This PR implements that pattern as the canonical approach, updates existing walks to use it, and banks the principle in CLAUDE.md.

**No source code changes outside `scripts/`, `CLAUDE.md`, and the dedicated tests.**

---

## Phase 1 — Sync + worktree

1. `git fetch origin --prune`
2. `git checkout main && git pull origin main`
3. Confirm: `git log origin/main --oneline -5`. HEAD should include the M2 squash commit (M3 is paused; its branch `feat/m3-manager-awards-medals` exists but is not merged).
4. Confirm clean state: `git worktree list` shows main + the M3 worktree (`feat-m3-manager-awards-medals`). **Leave the M3 worktree untouched** — it holds the in-progress M3 work we'll resume after this PR lands.
5. Create worktree at `.claude/worktrees/feat-walk-3-cookie-bypass` on branch `feat/walk-3-cookie-bypass`.
6. `cd` into the worktree.

---

## Phase 2 — Discovery

### 2a — Current bypass mechanism

1. `scripts/verification/lib/walk-helpers.mjs` — read in full. Identify:
   - Current `buildBypassUrl` signature and usage
   - The 4 banked lessons documented at top (preserve, extend)
   - All existing exports
   - Consumer call patterns
2. `scripts/verification/e3-persistency-walk.mjs` — read in full. Identify:
   - How it uses `buildBypassUrl`
   - Whether subsequent navigation reuses the URL with token, or just the bare URL
3. `scripts/exploration-walk.cjs` — read in full. Same checks. Note this is CommonJS — refactor must preserve compatibility.

### 2b — Vercel bypass cookie mechanics

Confirm the bypass flow by reading Vercel's documented behavior:
1. First request with `?x-vercel-protection-bypass=<TOKEN>&x-vercel-set-bypass-cookie=samesitenone` triggers Vercel to:
   - Validate the bypass token
   - Set a session cookie (likely `_vercel_jwt` — confirm exact name via inspection)
   - Allow the response through
2. Subsequent requests check the session cookie, not the URL parameter
3. **The cookie name is what matters for context.addCookies()** — Phase 3 will lock the exact name

If the cookie name can't be reliably determined ahead of time, the fallback is the "navigate once with URL, then strip URL handling" approach documented in Phase 3 below.

### 2c — Playwright cookie-set patterns

Verify Playwright's `context.addCookies([...])` API:
1. `context.addCookies([{ name, value, domain, path, ... }])` is the canonical way to inject cookies
2. After cookies are added, `context.newPage()` inherits them
3. All page.goto calls in that context use the cookies automatically

Or, equivalently — and probably simpler for this case — make the initial bypass-URL request in a tightly-scoped helper that catches errors with full sanitization, then return control to consumer code that uses bare URLs.

---

## Phase 3 — Design + scope surface (STOP HERE)

This is the architectural decision gate. Surface a structured design:

```
DISCOVERY — WALK-3 cookie-based bypass

CURRENT MECHANISM:
- buildBypassUrl(baseUrl, token) → returns URL with token params
- Used in <list of consumers>
- Subsequent navigation uses <bare URL / URL with token / inconsistent>

VERCEL BYPASS COOKIE (verified):
- Cookie name: <_vercel_jwt or similar — confirmed via inspection>
- Cookie domain: <e.g., .agencytrack.vercel.app or specific subdomain>
- Cookie path: /
- Expiry: session-based

PROPOSED NEW PATTERN (one of two):

Option A — setupBypassSession (recommended): tightly-scoped initial-handshake helper
  
  export async function setupBypassSession(context, baseUrl, token) {
    const page = await context.newPage();
    const setupUrl = `${baseUrl}/?x-vercel-protection-bypass=${token}&x-vercel-set-bypass-cookie=samesitenone`;
    try {
      await page.goto(setupUrl, { waitUntil: 'domcontentloaded' });
    } catch (err) {
      // NEVER include URL or token in surface error
      throw new Error(`Bypass session setup failed: ${err.name} (${err.code ?? 'unknown'})`);
    } finally {
      await page.close();
    }
    // Cookie is now set on the context. All subsequent pages inherit it.
  }
  
  Usage pattern (canonical for all walks + smoke scripts):
    await setupBypassSession(context, baseUrl, process.env.VERCEL_BYPASS_TOKEN);
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login`);  // NO token in URL ever again

Option B — direct cookie injection (alternative): skip the URL request entirely
  
  await context.addCookies([{
    name: '_vercel_jwt',
    value: <derived from token>,  // ← problem: cookie value is a JWT, not the raw token
    domain: hostname,
    ...
  }]);
  
  Issue: Vercel's cookie value is a session JWT derived from the token, not the token itself.
  Without server-side cookie derivation, we'd need to extract the cookie value from a real
  bypass request anyway. So Option B reduces to Option A in practice.

RECOMMENDATION: Option A. The URL parameter exists for exactly ONE request inside a try/catch
that catches all error types before they can surface. Subsequent navigation uses bare URLs.

DEPRECATION OF buildBypassUrl:
- Keep the function for internal use by setupBypassSession only
- Document at the top of the file: "DO NOT call buildBypassUrl directly from consumer code.
  Use setupBypassSession() to establish a bypass session, then navigate with bare URLs."
- Add a JSDoc @private annotation
- Or: rename to _buildBypassUrl (underscore prefix convention) to signal internal-only

CHANGES TO EXISTING WALKS:
- scripts/verification/e3-persistency-walk.mjs: refactor to use setupBypassSession
- scripts/exploration-walk.cjs: refactor to use setupBypassSession (CommonJS import: const { setupBypassSession } = require(...) — confirm dynamic import path works)

CLAUDE.md ADDITION:
- New nested sub-bullet under existing `.env.local — use, don't echo` rule
- States: "Sensitive tokens must never appear in URLs that pass through Playwright's standard
  error paths. The canonical pattern in walk-helpers.mjs is setupBypassSession() — a tightly-
  scoped initial-handshake function that catches and sanitizes all errors before they surface.
  After session setup, all navigation uses bare URLs. URL-parameter-bypass patterns from
  consumer code are forbidden. Banked from M3-smoke incident."

FILES TO TOUCH:
- scripts/verification/lib/walk-helpers.mjs (modified — add setupBypassSession, mark buildBypassUrl private)
- scripts/verification/e3-persistency-walk.mjs (modified — refactor to new pattern)
- scripts/exploration-walk.cjs (modified — refactor to new pattern)
- CLAUDE.md (modified — new sub-bullet)

NO source code changes outside scripts/ + CLAUDE.md.

SMOKE PLAN:
- Run the refactored e3-persistency-walk against production preview (token-rotated, fresh)
- Expected: 21/21 same as before. The functional behavior is unchanged.
- Run exploration-walk against production preview.
- Expected: 30/30 same as before.
- If either walk regresses, surface — the refactor changed behavior, not just the bypass pattern.

INDUCED-FAILURE TEST (validates the leak fix):
- Force an error condition (e.g., wrong hostname) in setupBypassSession
- Confirm the surface error message does NOT contain the token
- Document this test in the PR description as proof the architecture works

OPEN QUESTIONS FOR KELSEAN:
- Confirm setupBypassSession is the right name (alternatives: establishBypassSession, initBypassCookie, etc.)
- Confirm buildBypassUrl deprecation approach (rename with underscore vs JSDoc @private vs delete entirely after migration)
- Should the CLAUDE.md addition reference "M3-smoke incident" or use a generic descriptor?
```

**STOP at end of Phase 3.** Wait for Kelsean to:
- Lock the new function name + deprecation approach
- Confirm the induced-failure test plan
- Approve the CLAUDE.md addition text
- Greenlight Phase 4

---

## Phase 4 — Implement (only after Phase 3 approval)

Build per locked design. Order:

1. **Add `setupBypassSession` to walk-helpers.mjs** with full JSDoc + the canonical pattern as a usage example in comments
2. **Mark `buildBypassUrl` private** per the approved approach (rename or JSDoc)
3. **Refactor `e3-persistency-walk.mjs`** to use setupBypassSession
4. **Refactor `exploration-walk.cjs`** to use setupBypassSession (handle CommonJS dynamic import if needed)
5. **Update CLAUDE.md** with the new principle as an additional sub-bullet under the existing `.env.local` rule (same insertion pattern used for the C2 close + C3 close entries)

**Constraints:**
- No new dependencies
- Preserve all existing walk behavior — refactor changes the bypass pattern, not the assertions
- Error messages in setupBypassSession must never include the URL OR the token under any code path
- Tested via induced-failure scenario in Phase 6

---

## Phase 5 — Tests

This is integration infrastructure code, not unit-testable in the traditional sense. The validation is:
- Existing walks still pass at their original counts (21/21 and 30/30)
- Induced-failure test confirms no token leak in error path

If there's appetite for a tiny unit test on the redaction behavior of setupBypassSession's error catch block, add one — but the real validation is the smoke + induced-failure in Phase 6.

`npm test` must remain 100% passing for existing tests.

---

## Phase 6 — Production smoke + induced-failure test (CC EXECUTES — non-negotiable this time)

### Standard smoke

Run both refactored walks against production preview using the new pattern:

1. `scripts/verification/e3-persistency-walk.mjs` — expect 21/21 (unchanged from prior runs)
2. `scripts/exploration-walk.cjs` for agent role — expect 30/30 (unchanged from prior runs)

### Induced-failure test (this is the proof the architecture works)

Run a deliberately-failing setupBypassSession:

1. Call setupBypassSession with an invalid hostname (e.g., `https://this-does-not-exist.vercel.app`)
2. Capture the surface error message
3. Assert: error message does NOT contain the token value
4. Assert: error message does NOT contain the URL with parameters
5. Document the test in PR description with the actual error message captured (token-redacted by design)

If the induced-failure test surfaces the token: the architecture is broken, STOP and surface.

If both standard walks pass + induced-failure proves clean error surfacing: PR-ready.

---

## Phase 7 — Verify, commit, push, PR

1. `npm run lint` → 0 errors
2. `npm run build` → green
3. `npm test` → 100% passing
4. Commit organization:
   - `feat(walks): add setupBypassSession — token-isolated bypass via cookie-after-handshake`
   - `refactor(walks): e3-persistency-walk uses setupBypassSession pattern`
   - `refactor(walks): exploration-walk uses setupBypassSession pattern`
   - `docs(claude-md): bank cookie-after-handshake pattern (M3-smoke incident close)`
5. Push, open PR titled: `feat(walks): WALK-3 — token-isolated bypass session (eliminates URL-parameter token exposure)`
6. PR description MUST include:
   - **Summary:** architectural fix; token now appears in exactly one URL inside a sanitized try/catch; all subsequent navigation uses bare URLs
   - **Closes:** M3-smoke incident (resets project carry-in to 0/2)
   - **The 5 banked lessons** in walk-helpers.mjs (the 4 existing + the new one)
   - **Standard smoke results:** 21/21 + 30/30
   - **Induced-failure test result:** error message captured with no token leak
   - **Files to look at first** for review: walk-helpers.mjs's new function + CLAUDE.md addition
7. **STOP.** Do not merge. Kelsean reviews.

---

## Hard stops

- Phase 2 reveals Vercel's bypass cookie cannot be reliably set via Playwright (architectural blocker) → STOP and surface; may need fallback design
- Phase 6 induced-failure test surfaces the token in error messages → STOP and surface; refactor incomplete
- Existing walks regress at their pass counts → STOP and surface; refactor changed behavior unintentionally
- Any source code changes outside `scripts/` + `CLAUDE.md` → STOP
- Token appears in any artifact (PR description, commit message, error message, log line) → IMMEDIATE STOP; this PR is specifically about preventing this
- Two strikes hit → STOP

---

## Out of scope

- Migrating any other scripts (this PR migrates only e3-persistency-walk and exploration-walk; future smoke scripts use the new pattern)
- Adding new walk scripts
- Changes to existing walk behavior beyond bypass mechanism
- Changes to source code in `src/`
- Changes to Firestore rules
- Updating `docs/FOLLOW_UPS.md`
- Re-opening or working on M3 (its branch stays alive in its own worktree)

---

## What success looks like

After this PR merges:

1. `setupBypassSession` is the canonical bypass mechanism — documented in walk-helpers.mjs and CLAUDE.md
2. `buildBypassUrl` is marked private; consumer code can't call it directly
3. Both existing walks pass at original counts using the new pattern
4. Induced-failure test demonstrates the token cannot surface through Playwright error paths
5. Project carry-in resets to **0/2** — workflow has been manually reviewed AND hardened
6. M3 smoke can resume using the new pattern; same for Polish-1's smoke and all future PR smokes

# scripts/verification — Playwright verification walks

Reusable end-to-end verification scripts. Each PR or feature area gets a
`*-walk.mjs` file here. Scripts are tracked in git; runtime artifacts
(screenshots, results.json) are written to `verification/{feature}/` which
is gitignored.

## File naming

```
e2-walk.mjs   ← E2 Modal Targeting (PR #66)
e1-walk.mjs   ← (future) E1 schema split
e3-walk.mjs   ← (future) E3 persistency playground
```

## How to run

```bash
# From project root
node scripts/verification/e2-walk.mjs
```

Artifacts appear in `verification/e2-modal-targeting/` (gitignored):
- `screenshots/00-logged-in.png`, `a-career-portal.png`, …
- `results.json` — machine-readable pass/fail summary

## Environment requirements

`.env.local` at the project root must contain:

```
VERCEL_BYPASS_TOKEN=<token>     # Vercel protection bypass for preview URLs
A11Y_AGENT_PASSWORD=<password>  # Password for kelsean@gmail.com test agent
```

**Never echo these values to chat, logs, PR descriptions, or screenshots.**
See CLAUDE.md § `.env.local — use, don't echo`.

If `VERCEL_BYPASS_TOKEN` has been rotated since the last run, update it in
`.env.local` before running. Rotate the token in Vercel project settings:
Settings → Deployment Protection → Protection Bypass for Automation.

### Operational knob: `PREVIEW_HOST`

`.env.local` may optionally set:

```
PREVIEW_HOST=agencytrack-preview-XXXX.vercel.app
```

Bare host — scripts prepend `https://` internally (e.g. `https://${PREVIEW_HOST}/`).
Including the scheme in the value produces `https://https://...` and breaks the
first `page.goto`.

Overrides the preview host targeted by smoke and walk scripts. Each
fallback-pattern script (e.g. `bug-n3-smoke.mjs`, `e3-persistency-walk.mjs`,
`e4-walk.mjs`, `e5-walk.mjs`, `e6-walk.mjs`) hardcodes its own per-feature-branch
preview URL as a fallback, captured at the time the walk was authored. These
fallbacks are typically stale — Vercel garbage-collects old branch previews — so
they may be unreachable or reflect old code. Always set `PREVIEW_HOST`
explicitly to target a current preview deployment.

Two legacy walk scripts (`e1-slice-2b-walk.mjs:53`, `e2-walk.mjs:48`) hardcode
the host without reading `PREVIEW_HOST` at all. The fallback-pattern scripts at
least respect the env var; these do not. Both categories are pre-existing
drift; consolidation is out of scope for FU-G.

## Test account

- Email: `kelsean@gmail.com`
- Role: `agent` (used for all current walks)
- Password: `A11Y_AGENT_PASSWORD` in `.env.local`

## Shared helpers

Screen-agnostic smoke primitives live in [`lib/walk-helpers.mjs`](lib/walk-helpers.mjs) — `setupBypassSession`, `resolvePreviewUrl` (use `SMOKE_PREVIEW_URL`), `setTheme` / `waitForTheme` / `runBothThemes` (light+dark runner), `waitForLoaded` (`data-loading="false"` wait), plus the React-19 / overflow / console-capture helpers. Import these in new per-screen smokes instead of re-deriving the banked lessons (see `daily-capture-v2-smoke.mjs` for the canonical consumer).

**Theme invariant (dark-leg trust repair, banked from the FU smoke theme harness fix):** `setTheme` only registers a context-level `addInitScript` — it takes effect on the *next* navigation, not the current document. A `setTheme(...)` call placed AFTER `page.goto()` (or passed a boolean instead of the literal string `'light'`/`'dark'`) leaves the document on the default LIGHT theme while a "dark leg" axe/assertion silently runs against it. The invariant going forward: **theme is applied BEFORE the page navigates, AND asserted via `waitForTheme(page, theme)` immediately before any axe/assertion run.** `setTheme` now throws on a non-`'light'`/`'dark'` argument (catches the boolean-arg mistake at the source); `waitForTheme` throws if the DOM's `html.dark` class doesn't match the intended theme within the timeout (catches mis-ordering). A mis-ordered or mis-typed dark leg can no longer silently pass as light.

## Reusable patterns (banked from E2 development)

### Login flow

**Problem:** Firebase SPA — `waitForURL` resolves immediately (no URL change
on login). `waitForSelector('[class*="card"]')` matches the login form's own
card before auth completes.

**Solution:** wait for the email input to detach (login form unmounted), then
wait for the sidebar nav landmark (dashboard mounted):

```javascript
await pg.waitForSelector('input[type="email"]', { state: 'detached', timeout: 25000 });
await pg.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 15000 });
```

Note: `waitForLoadState('networkidle')` after login may stall indefinitely —
Firestore real-time listeners keep WebSocket connections open. Use the sidebar
selector instead.

### Career Portal navigation

**Problem:** CareerPortal is a **tab** inside AgentDashboard (`activeTab ===
'career'`), not a separate route. `page.goto('/career')` shows the login page.

**Solution:** click the "Career" button in the sidebar:

```javascript
const careerBtn = pg.getByRole('button', { name: /^Career$/i });
await careerBtn.waitFor({ timeout: 10000 });
const isActive = await careerBtn.evaluate((el) => el.getAttribute('aria-current') === 'page');
if (!isActive) await careerBtn.click();
```

The sidebar button sets `aria-current="page"` on the active tab — check it
before clicking to avoid toggling away from an already-active tab.

### Selector specificity — avoid `.text-3xl` alone

The CareerPortal page has multiple `.text-3xl` elements:
- API result in Modal Targeting panel: `p.text-3xl.text-ink`
- Career level badge: `span.text-3xl.text-primary`

Using `.text-3xl` alone triggers Playwright's strict-mode violation (multiple
matches). Always scope with the color token class:

```javascript
// ✓ specific
const resultText = await page.locator('.text-3xl.text-ink').innerText();

// ✗ ambiguous — will throw if more than one match
const resultText = await page.locator('.text-3xl').innerText();
```

### Range slider interaction

Playwright's `fill()` does not work on `input[type="range"]`. Use the native
value setter + dispatched events so React's synthetic onChange fires:

```javascript
async function setRangeValue(page, locator, value) {
  await locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v));
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
```

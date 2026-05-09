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

## Test account

- Email: `kelsean@gmail.com`
- Role: `agent` (used for all current walks)
- Password: `A11Y_AGENT_PASSWORD` in `.env.local`

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

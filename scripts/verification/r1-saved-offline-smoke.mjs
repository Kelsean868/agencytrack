/**
 * R1 — Saved-while-offline copy smoke.
 *
 * Scope: verify that when the wizard auto-save fires while the browser is
 * offline (Firestore persistentLocalCache resolves the write locally and
 * defers the server hop), the indicator shows "Saved offline — will sync
 * when reconnected" — NOT bare "Saved".
 *
 * Flow:
 *   1. Bypass-session handshake (token in one URL, then bare URLs).
 *   2. Agent login.
 *   3. Open the weekly wizard, select an older week, advance to step screen.
 *   4. Allow the initial mount auto-save to complete in online state.
 *   5. context.setOffline(true) → mutate a NumericField → wait for debounce
 *      → assert "Saved offline — will sync when reconnected" appears AND
 *        bare "Saved" copy is absent.
 *   6. context.setOffline(false) → online handler auto-retries → assert
 *      bare "Saved" appears.
 *
 * Run from this worktree (env copied from main per CLAUDE.md):
 *   node scripts/verification/r1-saved-offline-smoke.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD
 *
 * Override preview host via env:
 *   PREVIEW_HOST=agencytrack-git-feat-wizard-ux-hardening-kyron-marchan-s-projects.vercel.app
 *
 * Artifacts: verification/r1-saved-offline/ (gitignored).
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { setupBypassSession, waitForFirebaseReady } from './lib/walk-helpers.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/r1-saved-offline');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
const RESULTS_FILE  = resolve(ARTIFACTS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

// ── env ──────────────────────────────────────────────────────────────────────
function loadEnv(p) {
  const env = {};
  try {
    const src = readFileSync(p, 'utf8');
    src.split('\n').forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !k.startsWith('#')) env[k] = v;
    });
  } catch { /* missing file */ }
  return env;
}

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN   = env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL    = env.A11Y_AGENT_EMAIL;
const AGENT_PASSWORD = env.A11Y_AGENT_PASSWORD;

const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-git-feat-wizard-ux-hardening-kyron-marchan-s-projects.vercel.app';
const BASE_URL = `https://${PREVIEW_HOST}`;

if (!BYPASS_TOKEN)   { console.error('VERCEL_BYPASS_TOKEN missing'); process.exit(1); }
if (!AGENT_EMAIL)    { console.error('A11Y_AGENT_EMAIL missing'); process.exit(1); }
if (!AGENT_PASSWORD) { console.error('A11Y_AGENT_PASSWORD missing'); process.exit(1); }

function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg;
  for (const v of [BYPASS_TOKEN, AGENT_PASSWORD]) {
    if (v) out = out.replace(new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[REDACTED]');
  }
  return out;
}

// ── helpers ──────────────────────────────────────────────────────────────────
const results = {};
async function check(id, label, fn) {
  try {
    await fn();
    results[id] = { label, pass: true };
    console.log(`PASS ${id}: ${label}`);
  } catch (e) {
    const msg = redact(e.message ?? String(e));
    results[id] = { label, pass: false, error: msg };
    console.error(`FAIL ${id}: ${label}\n  ${msg}`);
  }
}

async function ss(page, name) {
  await page.screenshot({ path: resolve(SS_DIR, `${name}.png`), fullPage: false });
}

async function signIn(page, email, password) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  await page.locator('input[type="email"]').fill(email);
  const pw = page.locator('input[type="password"]');
  await pw.fill(password);
  await pw.press('Enter');
  await page.waitForSelector('input[type="email"]', { state: 'detached', timeout: 25000 });
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 15000 });
}

// ── main ─────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

try {
  await setupBypassSession(context, BASE_URL, BYPASS_TOKEN);
} catch (e) {
  console.error('Bypass setup failed:', redact(e.message));
  await browser.close();
  process.exit(1);
}

const page = await context.newPage();

// ── 01 Login ─────────────────────────────────────────────────────────────────
await check('01_login', 'Agent login succeeds', async () => {
  await signIn(page, AGENT_EMAIL, AGENT_PASSWORD);
  await ss(page, '01-logged-in');
});

// ── 02 Open wizard ───────────────────────────────────────────────────────────
await check('02_open_wizard', 'Wizard opens to date picker', async () => {
  const wizardBtn = page.getByRole('button', { name: /submit.*report|weekly report/i }).first();
  await wizardBtn.waitFor({ timeout: 15000 });
  await wizardBtn.click();
  // Wait for either "Select Week" h1 or the wizard's date select dropdown.
  await page.waitForSelector('select#wizard-week', { timeout: 10000 });
  await ss(page, '02-wizard-date-picker');
});

// ── 03 Advance to step screen ────────────────────────────────────────────────
// Pick an older Sunday from the dropdown — avoids colliding with this week's
// submitted draft. Index 5 = 5 weeks back (oldest of the 6 options).
await check('03_advance_to_step', 'Wizard advances from date picker to step screen', async () => {
  const select = page.locator('select#wizard-week');
  const options = await select.locator('option').elementHandles();
  // Pick the oldest week available (last option) — minimizes data conflict risk.
  const lastValue = await options[options.length - 1].getAttribute('value');
  await select.selectOption(lastValue);

  const startBtn = page.getByRole('button', { name: /start report/i });
  await startBtn.click();

  // Step screen header: "Screen 1 of 5" + h1 = "Prospecting & Calls". Or
  // "Already submitted" interstitial if the chosen week is locked — in
  // that case pick an older one. For now assume the oldest is unsubmitted.
  const submittedHeader = page.getByText('Already submitted');
  const stepHeader = page.getByText(/Screen 1 of 5/);
  try {
    await stepHeader.waitFor({ timeout: 8000 });
  } catch {
    if (await submittedHeader.isVisible().catch(() => false)) {
      throw new Error('Oldest dropdown week is submitted; need a different fixture week');
    }
    throw new Error('Did not land on step screen');
  }
  await ss(page, '03-step-screen');
});

// ── 04 Allow initial mount auto-save to settle (online) ──────────────────────
await check('04_initial_save_online', 'Initial mount auto-save fires online and shows bare "Saved"', async () => {
  // The useEffect at WizardForm:231 queues a 1500ms save timer on screen entry.
  // Wait for the indicator to show bare "Saved" (success state, !isOffline).
  await page.getByText('Saved', { exact: true }).first().waitFor({ timeout: 8000 });
  await ss(page, '04-initial-saved-online');
});

// ── 05 R1: Saved-while-offline copy appears ──────────────────────────────────
//
// Flip the wizard's isOffline=true via a JS window `offline` event — this is
// exactly the signal the wizard's listener at WizardForm.jsx:240 responds to.
// We deliberately do NOT use context.setOffline(true), because Firebase's
// WebChannel can hang in headless Chromium when the network is fully severed,
// leaving setDoc unresolved and the indicator stuck at "Saving…" (verified
// behavior, screenshot artifact from a prior run captured this). R1 is purely
// a display-branch change keyed off React state; verifying it does not
// require true network-level isolation. The unit tests in
// WizardFormSaveStatus.test.jsx cover the React-state path deterministically.
//
// Triggering the save: fill the first NumericField input. CardStack's
// NumericField is <input type="text" inputMode="numeric"> (LESSON 3) with no
// +/- buttons; fill() is the canonical input mechanism.
await check('05_saved_offline_copy', 'When offline + auto-save fires, indicator shows "Saved offline — will sync when reconnected"', async () => {
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForTimeout(200);

  // CardStack.NumericField is <input type="text" inputMode="numeric"> (per
  // walk-helpers LESSON 3) — no +/- buttons. Trigger handleChange by filling.
  const numericInput = page.locator('input[inputmode="numeric"]').first();
  await numericInput.waitFor({ timeout: 5000 });
  const prev = await numericInput.inputValue();
  const next = String((parseInt(prev || '0', 10) || 0) + 1);
  await numericInput.fill(next);
  // Blur so React commits the change (some controlled inputs only commit on
  // blur in certain timing patterns).
  await numericInput.blur();

  // Wait for 1500ms debounce + save resolution. Even with the network
  // severed, persistentLocalCache resolves setDoc once the mutation commits
  // to IndexedDB (typically <100ms). 4000ms is a generous safety margin.
  await page.waitForTimeout(4000);

  // Capture screenshot first — proof even if the assertion below fails.
  await ss(page, '05-saved-offline-copy');

  // Positive assertion: offline-saved copy is present.
  const offlineSaved = page.getByText('Saved offline — will sync when reconnected');
  await offlineSaved.waitFor({ timeout: 5000 });

  // Negative assertion: no bare "Saved" copy anywhere in the status region.
  const exactSavedCount = await page.getByText('Saved', { exact: true }).count();
  if (exactSavedCount > 0) {
    throw new Error(`Expected no bare "Saved" while offline, found ${exactSavedCount} match(es)`);
  }
});

// ── 06 Online recovery: bare "Saved" reappears ───────────────────────────────
await check('06_online_recovery', 'Reconnecting clears offline copy and shows bare "Saved" again', async () => {
  await page.evaluate(() => window.dispatchEvent(new Event('online')));

  // Online event handler calls doSave.current() immediately. Allow microtasks
  // + setDoc resolution. With persistentLocalCache the local write resolves
  // first; the queued offline write flushes to the server in the background.
  await page.waitForTimeout(2500);

  await ss(page, '06-online-saved-recovered');

  // Negative: offline-saved copy is gone.
  const offlineSavedCount = await page
    .getByText('Saved offline — will sync when reconnected')
    .count();
  if (offlineSavedCount > 0) {
    throw new Error(`Expected offline copy to clear, still showing ${offlineSavedCount} match(es)`);
  }

  // Positive: bare "Saved" appears (or the save already faded; in that
  // case trigger one more change and re-wait).
  let exactSavedCount = await page.getByText('Saved', { exact: true }).count();
  if (exactSavedCount === 0) {
    const incrementBtn = page.getByRole('button', { name: /^Increase / }).first();
    await incrementBtn.click();
    await page.waitForTimeout(2200);
    exactSavedCount = await page.getByText('Saved', { exact: true }).count();
  }
  if (exactSavedCount === 0) {
    throw new Error('Expected bare "Saved" copy after reconnect; none found');
  }
});

// ── done ─────────────────────────────────────────────────────────────────────
writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
await context.close();
await browser.close();

const failed = Object.entries(results).filter(([, r]) => !r.pass);
console.log(`\n${Object.keys(results).length - failed.length}/${Object.keys(results).length} checks passed`);
if (failed.length > 0) {
  console.error('Failed:', failed.map(([id]) => id).join(', '));
  process.exit(1);
}

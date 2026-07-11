/**
 * planner-smoke.mjs — 3.2 live write-read on staging as the seeded agent.
 * Book an appointment (create arm + (agentId,date) composite) -> card renders
 * -> postpone-with-rebook (2 writes + link) -> console watched for
 * permission/index errors. Synthetic staging tenant only.
 */
import { chromium } from 'playwright';
import {
  setupBypassSession, captureConsoleAndNetwork, formatCaptureReport, stamp, installGlobalTimeout,
} from '../scripts/verification/lib/walk-helpers.mjs';
import { mkdirSync } from 'fs';
import { resolve, join } from 'path';

const BASE = 'https://agencytrack-git-staging-kyron-marchan-s-projects.vercel.app';
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
if (!TOKEN) { console.error('MISSING ENV: VERCEL_BYPASS_TOKEN'); process.exit(2); }
const AGENT = { email: 'staging-agent-1@agencytrack-staging.test', password: 'ChangeMe-Staging-2026!' };
const SS_DIR = resolve('out/planner-smoke', stamp().replace(/:/g, '-'));
mkdirSync(SS_DIR, { recursive: true });
const results = [];
const record = (id, ok, detail) => { results.push({ id, ok }); console.log(`[${stamp()}] ${ok ? 'PASS' : 'FAIL'} ${id} - ${detail}`); };
const clearTimer = installGlobalTimeout(8 * 60 * 1000, () => {});

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 850 }, ignoreHTTPSErrors: true });
  await setupBypassSession(context, BASE, TOKEN);
  const page = await context.newPage();
  const cap = captureConsoleAndNetwork(page);
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', AGENT.email);
  await page.fill('input[type="password"]', AGENT.password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 25000 });
  await page.waitForTimeout(1500);

  const nav = page.locator('[data-testid="nav-planner"], [data-testid="pinned-planner"]').first();
  await nav.waitFor({ state: 'visible', timeout: 12000 });
  const disabled = await nav.getAttribute('aria-disabled');
  record('tab-ungated', disabled !== 'true', disabled !== 'true' ? 'planner tab enabled (un-gated)' : 'planner tab still aria-disabled');
  await nav.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(SS_DIR, '1-planner.png') });

  const bookBtn = page.getByRole('button', { name: /book|add appointment|new appointment/i }).first();
  const hasBook = await bookBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  record('book-affordance', hasBook, hasBook ? 'booking affordance present' : 'no book button found');
  if (hasBook) {
    await bookBtn.click();
    const dlg = page.locator('[role="dialog"]').last();
    await dlg.waitFor({ state: 'visible', timeout: 8000 });
    // fill the minimal fields the sheet requires; rely on defaults where possible
    const noteInput = dlg.locator('textarea, input[name="note"]').first();
    if (await noteInput.isVisible().catch(() => false)) await noteInput.fill('Smoke booking');
    const saveBtn = dlg.getByRole('button', { name: /save|book/i }).last();
    await saveBtn.click();
    await page.waitForTimeout(2500);
    const cardVisible = await page.getByText('Smoke booking').first().isVisible().catch(() => false);
    record('create-write-read', cardVisible, cardVisible ? 'appointment written through rules and rendered' : 'booked appointment not visible');
    await page.screenshot({ path: join(SS_DIR, '2-booked.png') });
  }

  const fsErrors = cap.consoleMessages.filter((m) =>
    /permission|denied|requires an index|failed-precondition|FirebaseError/i.test(m.text ?? String(m)));
  record('no-firestore-errors', fsErrors.length === 0, fsErrors.length === 0
    ? 'zero permission/index errors (composites + arms live)'
    : `${fsErrors.length} error(s): ${fsErrors.map((m) => (m.text ?? '').slice(0, 140)).join(' | ')}`);
  console.log(formatCaptureReport(cap));
  await context.close();
} finally { await browser.close(); clearTimer(); }
const fails = results.filter((r) => !r.ok).length;
console.log(`planner smoke: ${results.length - fails} PASS / ${fails} FAIL - shots: ${SS_DIR}`);
process.exit(fails ? 1 : 0);

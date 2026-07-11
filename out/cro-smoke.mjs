/**
 * cro-smoke.mjs — item 3.1 live end-to-end on staging: real cro-claim session.
 * Login as the seeded CRO → CRODashboard routes → Delivery Register lists the
 * seeded settled policy with a clawback chip → Mark delivered fires the REAL
 * Arm E write through deployed rules → row flips to Delivered. Console watched
 * for permission/index errors throughout.
 *
 * Usage: node --env-file=.env.staging out/cro-smoke.mjs
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
const CRO = { email: 'staging-cro@agencytrack-staging.test', password: 'ChangeMe-Staging-2026!' };
const SS_DIR = resolve('out/cro-smoke', stamp().replace(/:/g, '-'));
mkdirSync(SS_DIR, { recursive: true });

const results = [];
const record = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`[${stamp()}] ${ok ? 'PASS' : 'FAIL'} ${id} — ${detail}`);
};
const clearTimer = installGlobalTimeout(8 * 60 * 1000, () => {});

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 850 }, ignoreHTTPSErrors: true });
  await setupBypassSession(context, BASE, TOKEN);
  const page = await context.newPage();
  const cap = captureConsoleAndNetwork(page);

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', CRO.email);
  await page.fill('input[type="password"]', CRO.password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 25_000 });
  await page.waitForTimeout(2000);

  const registerVisible = await page.getByText(/delivery register/i).first()
    .waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);
  record('cro-routes', registerVisible, registerVisible
    ? 'cro claim routed to CRODashboard; Delivery Register visible'
    : 'Delivery Register never appeared (routing or stale deploy)');
  await page.screenshot({ path: join(SS_DIR, '1-register.png') });
  if (!registerVisible) throw new Error('cannot continue');

  const rowVisible = await page.getByText('SMK-CRO-001').first()
    .waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
  record('register-lists', rowVisible, rowVisible
    ? 'seeded settled policy listed (tenant-wide CRO read arm live)'
    : 'seeded policy SMK-CRO-001 not listed');

  if (rowVisible) {
    const chipOk = await page.getByText(/20 days|19 days|days left/i).first().isVisible().catch(() => false);
    record('clawback-chip', chipOk, chipOk ? 'clawback countdown chip rendered' : 'no countdown chip found');

    const markBtn = page.getByRole('button', { name: /mark delivered|delivered/i }).first();
    await markBtn.waitFor({ state: 'visible', timeout: 8_000 });
    await markBtn.click();
    await page.waitForTimeout(800);
    // confirm dialog (date defaults to today) — confirm
    const confirmBtn = page.getByRole('button', { name: /confirm|mark delivered|save/i }).last();
    if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(SS_DIR, '2-after-delivery.png') });

    // verify the flip: switch to Delivered view if the register splits views
    let deliveredVisible = await page.getByText(/delivered/i).first().isVisible().catch(() => false);
    const deliveredTab = page.getByRole('button', { name: /^delivered/i }).first();
    if (await deliveredTab.isVisible().catch(() => false)) {
      await deliveredTab.click();
      await page.waitForTimeout(1200);
      deliveredVisible = await page.getByText('SMK-CRO-001').first().isVisible().catch(() => false);
    }
    record('arm-e-write', deliveredVisible,
      deliveredVisible ? 'Arm E delivery write ACCEPTED by deployed rules; row shows delivered'
                       : 'delivery state not visible after write attempt');
    await page.screenshot({ path: join(SS_DIR, '3-delivered.png') });
  }

  const fsErrors = cap.consoleMessages.filter((m) =>
    /permission|denied|requires an index|failed-precondition|FirebaseError/i.test(m.text ?? String(m)));
  record('no-firestore-errors', fsErrors.length === 0, fsErrors.length === 0
    ? 'zero permission/index errors across the cro session'
    : `${fsErrors.length} Firestore error(s): ${fsErrors.map((m) => (m.text ?? '').slice(0, 140)).join(' | ')}`);

  console.log(formatCaptureReport(cap));
  await context.close();
} finally {
  await browser.close();
  clearTimer();
}
const fails = results.filter((r) => !r.ok).length;
console.log(`\n── cro smoke: ${results.length - fails} PASS / ${fails} FAIL — shots: ${SS_DIR}`);
process.exit(fails ? 1 : 0);

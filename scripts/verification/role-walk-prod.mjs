/**
 * role-walk-prod.mjs — READ-ONLY post-deploy role walk (first used for P2b–P2e, 27 Sep 2026).
 * Logs in as each A11Y role on production, clicks every nav / tab item (no saves),
 * records Firestore permission errors per screen, and screenshots each at 1440x900.
 * Usage: node scripts/verification/role-walk-prod.mjs [label]   (screenshots → docs/reports/screenshots/role-walk-<label>/)
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { setTheme, loginAs, captureConsoleAndNetwork, mobileDispatchClick } from './lib/walk-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUT = resolve(ROOT, `docs/reports/screenshots/role-walk-${process.argv[2] ?? 'latest'}`);
mkdirSync(OUT, { recursive: true });
const BASE = 'https://portal.agencytrack.app';
readFileSync(resolve(ROOT, '.env.local'), 'utf8').split(/\r?\n/).forEach((l) => {
  const eq = l.indexOf('='); if (eq < 1) return;
  const k = l.slice(0, eq).trim(); const v = l.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  if (k && !(k in process.env)) process.env[k] = v;
});
const ROLES = ['TENANT_ADMIN', 'SALES_MANAGER', 'BRANCH_MANAGER', 'UNIT_MANAGER', 'AGENT'];
const NAV = '[data-testid^="nav-"], [data-testid^="agent-tab-"], [data-testid^="manager-tab-"], [data-testid^="mgr-tab-"], [role="tab"]';
const SKIP = /reorder|logout|signout|sign-out|theme|notif|profile-menu|help/i;
const PERM = /permission|insufficient|PERMISSION_DENIED|failed-precondition|requires an index/i;
// reCAPTCHA (App Check) iframe asks headless Chromium for storage access and is refused — browser noise, not our rules.
const NOISE = /requestStorageAccess/;
const report = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const role of ROLES) {
    const email = process.env[`A11Y_${role}_EMAIL`]; const pass = process.env[`A11Y_${role}_PASSWORD`];
    if (!email || !pass) { report.push({ role, skipped: 'no credentials' }); continue; }
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await setTheme(ctx, 'light');
    const page = await ctx.newPage();
    const cap = captureConsoleAndNetwork(page);
    const r = { role, screens: [] };
    try {
      await loginAs(page, BASE, email, pass);
      await page.waitForTimeout(4000);
      await page.screenshot({ path: resolve(OUT, `${role}-home.png`) });
      const ids = await page.$$eval(NAV, (els) => [...new Set(els.map((e) => e.getAttribute('data-testid') || `tab:${(e.textContent || '').trim().slice(0, 30)}`))]);
      for (const id of ids.filter((i) => i && !SKIP.test(i)).slice(0, 25)) {
        const before = cap.consoleMessages.length;
        const sel = id.startsWith('tab:') ? `[role="tab"]:has-text("${id.slice(4).replace(/"/g, '')}")` : `[data-testid="${id}"]`;
        try {
          await page.goto(BASE); await page.waitForTimeout(3000);
          if (await page.locator(sel).count() === 0) { r.screens.push({ id, note: 'gone' }); continue; }
          await mobileDispatchClick(page, sel);
          await page.waitForTimeout(3500);
          const errs = cap.consoleMessages.slice(before).filter((m) => (m.type === 'error' || PERM.test(String(m.text))) && !NOISE.test(String(m.text)));
          const perm = errs.filter((m) => PERM.test(String(m.text))).map((m) => String(m.text).slice(0, 220));
          const shot = `${role}-${id.replace(/[^a-z0-9-]/gi, '_').slice(0, 40)}.png`;
          await page.screenshot({ path: resolve(OUT, shot) });
          r.screens.push({ id, errors: errs.length, permissionErrors: perm });
        } catch (e) { r.screens.push({ id, note: `click failed: ${String(e.message).slice(0, 80)}` }); }
      }
    } catch (e) { r.loginError = String(e.message).slice(0, 200); }
    report.push(r);
    await ctx.close();
  }
} finally { await browser.close(); }
writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2));
for (const r of report) {
  if (r.skipped || r.loginError) { console.log(`${r.role}: ${r.skipped || 'LOGIN ERROR ' + r.loginError}`); continue; }
  const bad = r.screens.filter((s) => s.permissionErrors?.length);
  console.log(`${r.role}: ${r.screens.length} screens, ${bad.length} with permission errors`);
  for (const s of r.screens) console.log(`   ${s.id} :: errors=${s.errors ?? '-'} ${s.note ?? ''} ${s.permissionErrors?.length ? '| ' + s.permissionErrors.join(' || ') : ''}`);
}
console.log(`Report: ${OUT}`);

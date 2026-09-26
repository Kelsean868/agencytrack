/**
 * mx-mdrt-design-check.mjs — MX (MDRT award threshold) design check ritual
 * (docs/briefs/ledger-layout-and-l3.md § MX, scaled from § LX Deliverables 2
 * per the brief's own instruction).
 *
 * LOCAL FIXTURES ONLY — the A11Y preview agent's Awards tab renders the same
 * `AwardCard` component this harness renders directly with real engine
 * output, so a preview pass would add nothing this local pass doesn't
 * already cover, and the agent's real production data doesn't land it in
 * all three MDRT states anyway.
 *
 * 390×844 and 1440×900, light + dark, into
 * docs/reports/screenshots/ledger-2026-09-26/mx/.
 *
 * Run: node scripts/verification/mx-mdrt-design-check.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { setTheme, waitForTheme, captureConsoleAndNetwork } from './lib/walk-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUT_DIR = resolve(ROOT, 'docs/reports/screenshots/ledger-2026-09-26/mx');
mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
];
const THEMES = ['light', 'dark'];
const CASES = ['not-yet', 'in-contention', 'qualified'];

const results = [];
const consoleErrors = [];

async function fixturePass(browser) {
  console.log('\n=== MX LOCAL FIXTURE PASS ===');
  const server = await createServer({ root: ROOT, server: { port: 0 }, logLevel: 'error' });
  await server.listen();
  const { port } = server.httpServer.address();
  const base = `http://localhost:${port}/scripts/verification/mx-mdrt-design-check-fixture.html`;
  try {
    for (const theme of THEMES) {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        try {
          await setTheme(context, theme);
          const page = await context.newPage();
          const capture = captureConsoleAndNetwork(page);
          for (const id of CASES) {
            await page.goto(`${base}?case=${id}`, { waitUntil: 'domcontentloaded' });
            await waitForTheme(page, theme, 8000).catch((e) => console.log(`  [warn] ${e.message}`));
            await page.locator(`[data-case="${id}"]`).waitFor({ timeout: 20000 });
            await page.waitForTimeout(400);
            const shot = resolve(OUT_DIR, `awards-mdrt-${id}-${vp.name}-${theme}.png`);
            await page.screenshot({ path: shot, fullPage: true });
            const bodyText = await page.locator(`[data-case="${id}"]`).innerText();
            results.push({ id, vp: vp.name, theme, status: 'SHOT', note: bodyText.replace(/\s+/g, ' ').slice(0, 160) });
          }
          const errors = capture.consoleMessages.filter((m) => m.type === 'error');
          if (errors.length) consoleErrors.push({ vp: vp.name, theme, errors: errors.map((m) => String(m.text).slice(0, 200)) });
          console.log(`  ${vp.name}-${theme}: ${CASES.length} cases saved`);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await server.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  await fixturePass(browser);
} finally {
  await browser.close();
}

console.log('\n══════════════════════════════════════════');
for (const r of results) console.log(`${r.status.padEnd(5)} ${r.id.padEnd(14)} ${r.vp}-${r.theme}  ${r.note}`);
console.log(`Console errors captured: ${consoleErrors.length}`);
for (const e of consoleErrors) console.log(`  ${e.vp}-${e.theme}: ${JSON.stringify(e.errors).slice(0, 400)}`);
console.log(`Screenshots in: ${OUT_DIR}`);
console.log('══════════════════════════════════════════');
process.exit(consoleErrors.length ? 1 : 0);

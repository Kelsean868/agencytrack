/**
 * ledger-l0-design-check.mjs — L0 design check ritual
 * (docs/briefs/ledger-lens-build.md § Deliverables, item 2).
 *
 * Two passes:
 *   1. PREVIEW — the real PR preview deployment (SMOKE_PREVIEW_URL), read-only:
 *      login as the A11Y test agent, screenshot Home (+ Awards/Campaign tab if
 *      one is visible). The test agent has 0 settled policies and no campaign,
 *      so this mostly documents the empty state — pending fixtures are covered
 *      by pass 2.
 *   2. LOCAL FIXTURES — ledger-l0-fixture-harness.html served by a dev Vite
 *      server, rendering HeroCard / CampaignHeroCompact / ProgressBlock with
 *      unit-test-shaped fixtures covering pending present / pending = 0 /
 *      pending past 100%.
 *
 * Screenshots at 390×844 and 1440×900, light + dark, into
 * docs/reports/screenshots/ledger-2026-09-26/l0/. No client names or real
 * policy numbers in any committed screenshot (fixture data only).
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession, setTheme, waitForTheme, loginAs, captureConsoleAndNetwork,
  formatCaptureReport, resolvePreviewUrl,
} from './lib/walk-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUT_DIR = resolve(ROOT, 'docs/reports/screenshots/ledger-2026-09-26/l0');
mkdirSync(OUT_DIR, { recursive: true });

function loadEnv() {
  try {
    const src = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch {}
}
loadEnv();

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing ${k}`); return v; };
const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASS = requireEnv('A11Y_AGENT_PASSWORD');
const PREVIEW_URL = resolvePreviewUrl();

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
];
const THEMES = ['light', 'dark'];

const consoleErrors = [];

// ── Pass 1 — the real preview (read-only) ───────────────────────────────────
async function previewPass(browser) {
  console.log(`\n=== PREVIEW PASS — ${PREVIEW_URL} ===`);
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      try {
        await setupBypassSession(context, PREVIEW_URL, BYPASS_TOKEN);
        await setTheme(context, theme);
        const page = await context.newPage();
        const capture = captureConsoleAndNetwork(page);
        await loginAs(page, PREVIEW_URL, AGENT_EMAIL, AGENT_PASS);
        await waitForTheme(page, theme, 8000).catch((e) => console.log(`  [warn] ${e.message}`));
        await page.waitForTimeout(1500);
        const homeShot = resolve(OUT_DIR, `preview-home-${vp.name}-${theme}.png`);
        await page.screenshot({ path: homeShot, fullPage: true });
        console.log(`  saved ${homeShot}`);

        // Awards tab → Campaign screen, if visible for this test account.
        const awardsTab = page.locator('[data-testid="agent-tab-awards"]');
        if (await awardsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await awardsTab.click();
          await page.waitForTimeout(1500);
          const campaignScreen = page.locator('[data-testid="campaign-screen"]');
          if (await campaignScreen.isVisible({ timeout: 3000 }).catch(() => false)) {
            const campaignShot = resolve(OUT_DIR, `preview-campaign-${vp.name}-${theme}.png`);
            await page.screenshot({ path: campaignShot, fullPage: true });
            console.log(`  saved ${campaignShot}`);
          } else {
            console.log(`  [skip] no campaign screen for this test account (${vp.name}-${theme}) — no seeded campaign`);
          }
        } else {
          console.log(`  [skip] Awards tab not visible (${vp.name}-${theme})`);
        }

        const report = formatCaptureReport(capture);
        if (capture.consoleMessages.some((m) => m.type === 'error')) {
          consoleErrors.push({ pass: 'preview', vp: vp.name, theme, report });
        }
      } catch (e) {
        console.log(`  [FAIL] preview ${vp.name}-${theme}: ${e.message}`);
      } finally {
        await context.close();
      }
    }
  }
}

// ── Pass 2 — local fixtures ─────────────────────────────────────────────────
async function fixturePass(browser) {
  console.log('\n=== LOCAL FIXTURE PASS ===');
  const server = await createServer({ root: ROOT, server: { port: 0 } });
  await server.listen();
  const address = server.httpServer.address();
  const localUrl = `http://localhost:${address.port}/scripts/verification/ledger-l0-fixture-harness.html`;
  console.log(`  dev server: ${localUrl}`);
  try {
    for (const theme of THEMES) {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        try {
          await setTheme(context, theme);
          const page = await context.newPage();
          const capture = captureConsoleAndNetwork(page);
          await page.goto(localUrl, { waitUntil: 'domcontentloaded' });
          await waitForTheme(page, theme, 8000).catch((e) => console.log(`  [warn] ${e.message}`));
          await page.waitForTimeout(1200);
          const shot = resolve(OUT_DIR, `local-fixture-${vp.name}-${theme}.png`);
          await page.screenshot({ path: shot, fullPage: true });
          console.log(`  saved ${shot}`);
          formatCaptureReport(capture);
          if (capture.consoleMessages.some((m) => m.type === 'error')) {
            consoleErrors.push({ pass: 'fixture', vp: vp.name, theme, messages: capture.consoleMessages.filter((m) => m.type === 'error') });
          }
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
  await previewPass(browser);
  await fixturePass(browser);
} finally {
  await browser.close();
}

console.log('\n══════════════════════════════════════════');
console.log(`Console errors captured: ${consoleErrors.length}`);
for (const e of consoleErrors) {
  console.log(`  ${e.pass} ${e.vp}-${e.theme}:`, JSON.stringify(e.messages ?? e.report ?? {}).slice(0, 300));
}
console.log(`Screenshots in: ${OUT_DIR}`);
console.log('══════════════════════════════════════════');

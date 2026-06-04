/**
 * screenshot-atlas.mjs — Track J item 21. Baseline before-state visual atlas.
 *
 * Walks agent + branch_manager through every reachable tab/screen in BOTH
 * themes (light/dark) and captures full-page PNGs under
 * verification/atlas-2026-06-04/ plus an index.md mapping screen→files. This
 * one baseline set is committed (the .gitignore carries a
 * !verification/atlas-2026-06-04/ negation); future atlases REPLACE this dir,
 * they do not accumulate.
 *
 * Tab discovery is dynamic: agent tabs are [data-testid^="agent-tab-"], manager
 * tabs are [data-testid^="nav-"] (sidebar). The wizard tab + nav scaffolding
 * (drawer backdrop / "more" toggle) are skipped — they open modals/menus, not
 * screens.
 *
 *   node scripts/verification/screenshot-atlas.mjs --url=https://agencytrack.vercel.app
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v]; }));
const URL          = args.url ?? 'https://agencytrack.vercel.app';
const IS_PROD      = URL.startsWith('https://');
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const DIR          = 'verification/atlas-2026-06-04';

const ROLES = {
  agent:          { email: process.env.A11Y_AGENT_EMAIL,          pass: process.env.A11Y_AGENT_PASSWORD,          sel: '[data-testid^="agent-tab-"]', skip: ['agent-tab-wizard'] },
  branch_manager: { email: process.env.A11Y_BRANCH_MANAGER_EMAIL, pass: process.env.A11Y_BRANCH_MANAGER_PASSWORD, sel: '[data-testid^="nav-"]',        skip: ['nav-drawer-backdrop', 'nav-more'] },
};

if (IS_PROD && !BYPASS_TOKEN) { console.error('Missing VERCEL_BYPASS_TOKEN'); process.exit(1); }
mkdirSync(DIR, { recursive: true });

const MANIFEST = []; // { role, theme, tab, file }

async function login(page, email, pass) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => document.body && document.body.textContent.replace(/\s+/g, '').length > 400, { timeout: 30_000 });
  await page.waitForTimeout(1200);
}

async function walkRole(role, theme) {
  const { email, pass, sel, skip } = ROLES[role];
  if (!email || !pass) { console.log(`[${role}/${theme}] missing creds — skip`); return; }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);
  const page = await context.newPage();
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, email, pass);
    if (theme === 'dark') {
      await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('agencytrack-dark', 'true'); });
      await page.waitForTimeout(400);
    }
    const tabs = (await page.$$eval(sel, (els) => els.map((e) => e.getAttribute('data-testid'))))
      .filter((t, i, a) => t && a.indexOf(t) === i)
      .filter((t) => !skip.includes(t));
    console.log(`[${role}/${theme}] ${tabs.length} tabs: ${tabs.join(', ')}`);
    for (const tab of tabs) {
      try {
        await page.click(`[data-testid="${tab}"]`, { timeout: 8_000 });
        await page.waitForTimeout(1600);
        const file = `${role}-${theme}-${tab}.png`;
        await page.screenshot({ path: `${DIR}/${file}`, fullPage: true });
        MANIFEST.push({ role, theme, tab, file });
        console.log(`    ✓ ${file}`);
      } catch (e) {
        console.log(`    ✗ ${tab}: ${String(e).slice(0, 80)}`);
      }
    }
  } catch (e) {
    console.log(`[${role}/${theme}] FATAL: ${String(e).slice(0, 160)}`);
  } finally {
    await browser.close();
  }
}

console.log(`\nScreenshot atlas\nTarget: ${URL}\nOut: ${DIR}/\n`);
for (const role of ['agent', 'branch_manager']) for (const theme of ['light', 'dark']) await walkRole(role, theme);

// index.md
const byScreen = {};
for (const m of MANIFEST) { (byScreen[`${m.role} · ${m.tab}`] ??= []).push(m); }
let md = `# Screenshot atlas — 2026-06-04\n\nBaseline before-state captures for the Track J redesign program. Agent + Branch Manager, every reachable tab, both themes. Future atlases REPLACE this directory.\n\nTarget: \`${URL}\` · ${MANIFEST.length} captures.\n\n| Role | Tab | Light | Dark |\n|---|---|---|---|\n`;
for (const key of Object.keys(byScreen).sort()) {
  const [role, tab] = key.split(' · ');
  const light = byScreen[key].find((m) => m.theme === 'light');
  const dark  = byScreen[key].find((m) => m.theme === 'dark');
  md += `| ${role} | ${tab} | ${light ? `[png](${light.file})` : '—'} | ${dark ? `[png](${dark.file})` : '—'} |\n`;
}
writeFileSync(`${DIR}/index.md`, md);
console.log(`\nAtlas: ${MANIFEST.length} captures → ${DIR}/ + index.md`);
process.exit(MANIFEST.length > 0 ? 0 : 1);

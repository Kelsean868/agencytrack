/**
 * axe-contrast-local.mjs — run axe color-contrast detail against a local target
 * (no Vercel bypass; talks to real Firebase via the local build).
 *
 * Usage:
 *   node scripts/verification/axe-contrast-local.mjs --url=http://127.0.0.1:4173 --label=nav-branch
 *   node scripts/verification/axe-contrast-local.mjs --url=http://127.0.0.1:4174 --label=main-baseline
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'fs';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach(line => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch {}
}
loadEnv();

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const URL   = args.url   ?? 'http://127.0.0.1:4173';
const LABEL = args.label ?? 'branch';

const AGENT_EMAIL = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS  = process.env.A11Y_AGENT_PASSWORD;
if (!AGENT_EMAIL || !AGENT_PASS) { console.error('Missing A11Y_AGENT_*'); process.exit(1); }

async function loginAndWait(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(2000);
}

async function runContrastDetail(page, theme) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const cv = results.violations.find(v => v.id === 'color-contrast');
  if (!cv) {
    console.log(`[${LABEL}/${theme}] color-contrast: PASS (0 nodes)`);
    return [];
  }
  console.log(`\n[${LABEL}/${theme}] color-contrast: ${cv.nodes.length} failing node(s)`);
  console.log('─'.repeat(72));
  const entries = cv.nodes.map((node, i) => {
    const selector = (node.target ?? []).join(' > ');
    const checks = node.any ?? [];
    const ratioData = checks.map(c => {
      const data = c.data ?? {};
      return `fg=${data.fgColor ?? '?'} bg=${data.bgColor ?? '?'} ratio=${data.contrastRatio ?? '?'} (need ${data.expectedContrastRatio ?? '?'})`;
    }).join('; ');
    console.log(`  [${i + 1}] selector: ${selector || '(no target)'}`);
    if (ratioData) console.log(`       contrast: ${ratioData}`);
    console.log();
    return { selector, ratioData };
  });
  console.log('─'.repeat(72));
  return entries;
}

const browser = await chromium.launch({ headless: true });
const allResults = {};
for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await loginAndWait(page);
  if (theme === 'dark') {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('agencytrack-dark', 'true'); } catch {}
    });
    await page.waitForTimeout(400);
  }
  allResults[theme] = await runContrastDetail(page, theme);
  await context.close();
}
await browser.close();

console.log('\n══ SIDEBAR/AVATAR CHECK ══');
for (const [theme, entries] of Object.entries(allResults)) {
  const sectionHeaders = entries.filter(e =>
    e.selector.includes('.sidebar-section') ||
    /sidebar-section[^-]/.test(e.selector)
  );
  const sectionLinks = entries.filter(e => e.selector.includes('.sidebar-link'));
  const avatarNodes  = entries.filter(e => e.selector.includes('sidebar-foot-avatar'));
  console.log(`[${LABEL}/${theme}] .sidebar-section nodes: ${sectionHeaders.length}`);
  console.log(`[${LABEL}/${theme}] .sidebar-link nodes:    ${sectionLinks.length}`);
  console.log(`[${LABEL}/${theme}] .sidebar-foot-avatar:   ${avatarNodes.length}`);
}
console.log(`\nTotal [${LABEL}/light]: ${allResults.light.length} nodes`);
console.log(`Total [${LABEL}/dark]:  ${allResults.dark.length} nodes`);

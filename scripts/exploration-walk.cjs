/**
 * exploration-walk.cjs
 *
 * Programmatic walkthrough of the agent flow that mirrors the manual
 * exploration template in scripts/exploration-template.md. Drives the app
 * with Playwright, captures console errors, network failures, uncaught
 * rejections, and structural-element verification. Saves a filled-out
 * markdown report to verification/exploration_<scope>_<timestamp>.md.
 *
 * Use after every PR merge against production, and against any preview URL
 * during PR verification.
 *
 * Usage:
 *   node scripts/exploration-walk.cjs                                          # uses A11Y_BASE_URL or http://localhost:5173
 *   node scripts/exploration-walk.cjs --url=https://agencytrack.vercel.app     # explicit URL
 *   node scripts/exploration-walk.cjs --url=<preview> --label=pr1_preview      # custom report label
 *
 * Env (read from .env.local):
 *   A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD  — required
 *   VERCEL_BYPASS_TOKEN                    — required for protected previews
 *   A11Y_BASE_URL                          — fallback if --url not passed
 *
 * Bypass-cookie auto-detection:
 *   - URL on agencytrack.vercel.app domain with a "-git-" or hashed subdomain → preview, wires bypass
 *   - URL == https://agencytrack.vercel.app                                   → production, no bypass
 *   - localhost                                                                → no bypass
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

loadDotEnvLocal();
function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  const lines = text.split(/\r?\n/);
  // First pass: validate every line. Throw before mutating process.env so a
  // partial parse can't precede the failure. Detection target: a line where
  // the value half contains an embedded `KEY=` pattern, which only happens
  // when two key=value pairs got concatenated by a missing newline (see
  // TOOLING-N — silent corruption ate an hour of the SEC-9 autonomous run).
  const parsed = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    const embedded = val.match(/([A-Z][A-Z0-9_]*)=/);
    if (embedded) {
      throw new Error(
        `Malformed .env.local: line ${i + 1} appears to concatenate two keys ` +
        `("${key}" and "${embedded[1]}"). Ensure each key is on its own line ` +
        `and the file ends with a trailing newline.`
      );
    }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    parsed.push([key, val]);
  }
  for (const [key, val] of parsed) {
    if (!(key in process.env)) process.env[key] = val;
  }
}

function arg(name, fallback) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.replace(`--${name}=`, '') : fallback;
}

const BASE_URL = arg('url', process.env.A11Y_BASE_URL || 'http://localhost:5173');
const LABEL    = arg('label', null);
const EMAIL    = process.env.A11Y_AGENT_EMAIL;
const PASSWORD = process.env.A11Y_AGENT_PASSWORD;
const BYPASS   = process.env.VERCEL_BYPASS_TOKEN || '';

if (!EMAIL || !PASSWORD) {
  console.error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD in .env.local');
  process.exit(1);
}

// ── Bypass auto-detection ───────────────────────────────────────────────────
function detectScope(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'agencytrack.vercel.app') return { scope: 'production', needsBypass: false };
    if (u.hostname.endsWith('.vercel.app'))      return { scope: 'preview',    needsBypass: !!BYPASS };
    return { scope: 'local', needsBypass: false };
  } catch {
    return { scope: 'unknown', needsBypass: false };
  }
}
const { scope, needsBypass } = detectScope(BASE_URL);
const REPORT_LABEL = LABEL || scope;

// ── Known-harmless console / network patterns (per exploration-template.md) ─
const HARMLESS_CONSOLE = [
  /\[AgencyTrack\] Auth claims:/,
  /\[AgencyTrack\] UID:/,
];
const HARMLESS_NET = [
  // Initial Firestore Listen channel POST aborts under StrictMode double-mount,
  // immediately retried successfully. Per scripts/exploration-template.md.
  /firestore\.googleapis\.com\/.*Listen\/channel/,
  // Fontshare WOFF2 font requests get cancelled by the browser when the
  // page paints before the font is needed (especially behind the Vercel
  // SSO bypass-cookie redirect). Harmless — fonts load on the next paint.
  /cdn\.fontshare\.com\/.*\.woff2/,
];
const isHarmless = (text, patterns) => patterns.some((p) => p.test(text));

(async () => {
  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, '').slice(0, 15);
  console.log(`[exploration-walk] target=${BASE_URL} scope=${scope} bypass=${needsBypass ? 'on' : 'off'}`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  const networkFailures = [];
  const uncaughtRejections = [];
  const actionsCompleted = new Set();
  const stepNotes = [];
  const verificationDir = path.resolve(process.cwd(), 'verification', 'walk');
  fs.mkdirSync(verificationDir, { recursive: true });

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error'   && !isHarmless(text, HARMLESS_CONSOLE)) consoleErrors.push(text);
    if (msg.type() === 'warning' && !isHarmless(text, HARMLESS_CONSOLE)) consoleWarnings.push(text);
  });
  page.on('pageerror',     (err) => uncaughtRejections.push(String(err)));
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (isHarmless(url, HARMLESS_NET)) return;
    networkFailures.push(`${req.method()} ${url} — ${req.failure()?.errorText || 'unknown'}`);
  });

  async function applyVercelBypass() {
    if (!needsBypass) return;
    const u = new URL(BASE_URL);
    u.searchParams.set('x-vercel-protection-bypass', BYPASS);
    u.searchParams.set('x-vercel-set-bypass-cookie', 'samesitenone');
    await page.goto(u.toString(), { waitUntil: 'domcontentloaded' });
  }

  async function step(id, label, fn) {
    try {
      await fn();
      actionsCompleted.add(id);
      console.log(`  [ok] ${id}: ${label}`);
    } catch (e) {
      const msg = e.message?.slice(0, 200) || String(e);
      console.log(`  [SKIP] ${id}: ${label} — ${msg}`);
      stepNotes.push(`Step ${id} (${label}): ${msg}`);
    }
  }

  try {
    // ── 1: Navigate to target URL ────────────────────────────────────────────
    await step('1', 'Navigate to target URL (login screen renders)', async () => {
      await applyVercelBypass();
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=AgencyTrack', { timeout: 15_000 });
      await page.waitForSelector('input[type="email"]', { timeout: 5_000 });
    });
    await step('1a', 'LoginScreen has exactly one <main>', async () => {
      const count = await page.locator('main').count();
      if (count !== 1) throw new Error(`expected 1 main, got ${count}`);
    });

    // ── 2: Login ─────────────────────────────────────────────────────────────
    await step('2', 'Login (auth chain returns 200)', async () => {
      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForSelector('text=Dashboard', { timeout: 20_000 });
    });
    await step('2a', 'AgentDashboard has 1 main, 1 nav, 1 header', async () => {
      const mains   = await page.locator('main').count();
      const navs    = await page.locator('nav[aria-label="Dashboard sections"]').count();
      const headers = await page.locator('header').count();
      if (mains !== 1)   throw new Error(`expected 1 main, got ${mains}`);
      if (navs !== 1)    throw new Error(`expected 1 nav, got ${navs}`);
      if (headers !== 1) throw new Error(`expected 1 header, got ${headers}`);
    });

    // ── 3: KPI cards rendered ────────────────────────────────────────────────
    await step('3', 'Wait for dashboard (YTD API rendered)', async () => {
      await page.waitForSelector('text=YTD API', { timeout: 10_000 });
    });

    // ── 4: Screenshot light ──────────────────────────────────────────────────
    await step('4', 'Screenshot dashboard (light mode)', async () => {
      await page.screenshot({ path: path.join(verificationDir, `${REPORT_LABEL}_dashboard-light_${stamp}.png`), fullPage: true });
    });

    // ── 5–10, 14, 15a, 16: tabs ──────────────────────────────────────────────
    const tabs = [
      ['5',   'Career'],
      ['6',   'Awards'],
      ['14',  'Leaderboard'],
      ['15a', 'History'],
      ['16',  'Profile'],
    ];
    for (const [id, name] of tabs) {
      await step(id, `${name} tab renders`, async () => {
        await page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).click();
        await page.waitForTimeout(500);
      });
      await step(`${id}a`, `${name} tab — single <main>`, async () => {
        const count = await page.locator('main').count();
        if (count !== 1) throw new Error(`expected 1 main, got ${count}`);
      });
    }

    // ── 7–9: awards subtabs ──────────────────────────────────────────────────
    await step('6', 'Awards tab', async () => {
      await page.getByRole('button', { name: /^Awards$/i }).click();
      await page.waitForTimeout(400);
    });
    await step('7-9', 'Awards subtabs (Quarterly/Annual/Club)', async () => {
      for (const sub of ['Quarterly', 'Annual', 'Club']) {
        const btn = page.getByRole('button', { name: new RegExp(`^${sub}$`, 'i') }).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(300);
        }
      }
    });

    // ── 20–22: dark mode ─────────────────────────────────────────────────────
    await step('20', 'Toggle dark mode', async () => {
      await page.getByRole('button', { name: /^dashboard$/i }).first().click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /toggle dark mode/i }).click();
      await page.waitForTimeout(400);
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      if (!isDark) throw new Error('html.dark class not added');
    });
    await step('21', 'Screenshot dashboard (dark mode)', async () => {
      await page.screenshot({ path: path.join(verificationDir, `${REPORT_LABEL}_dashboard-dark_${stamp}.png`), fullPage: true });
    });
    await step('22', 'Toggle back to light mode', async () => {
      await page.getByRole('button', { name: /toggle dark mode/i }).click();
      await page.waitForTimeout(400);
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      if (isDark) throw new Error('html.dark class still present');
    });

    // ── 23, 23a, 26: wizard ──────────────────────────────────────────────────
    await step('23', 'Open wizard (Select Week renders)', async () => {
      await page.getByRole('button', { name: /Submit Weekly Report/i }).click();
      await page.waitForSelector('text=Select Week', { timeout: 10_000 });
    });
    await step('23a', 'Wizard has header + main + label/select binding', async () => {
      const mains   = await page.locator('main').count();
      const headers = await page.locator('header').count();
      if (mains !== 1)   throw new Error(`expected 1 main in wizard, got ${mains}`);
      if (headers !== 1) throw new Error(`expected 1 header in wizard, got ${headers}`);
      const sel    = await page.locator('select#wizard-week').count();
      const label  = await page.locator('label[for="wizard-week"]').count();
      if (sel !== 1)   throw new Error(`expected 1 select#wizard-week, got ${sel}`);
      if (label !== 1) throw new Error(`expected 1 label[for=wizard-week], got ${label}`);
    });
    await step('26', 'Close wizard (returns to dashboard)', async () => {
      await page.getByRole('button', { name: /^close$/i }).click();
      await page.waitForSelector('text=Dashboard', { timeout: 5_000 });
      const onWizard = await page.locator('text=Select Week').count();
      if (onWizard > 0) throw new Error('still on wizard after close');
    });

    // ── 27, 28: sign out ─────────────────────────────────────────────────────
    await step('27', 'Sign out', async () => {
      await page.getByRole('button', { name: /sign out/i }).click();
      await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
    });
    await step('28', 'Verify login redirect', async () => {
      const visible = await page.getByRole('button', { name: /sign in/i }).isVisible();
      if (!visible) throw new Error('not redirected to login');
    });

  } finally {
    await browser.close();
  }

  // ── Compose report ─────────────────────────────────────────────────────────
  const allActions = [
    ['1',    'Navigate to target URL (login screen renders)'],
    ['1a',   'LoginScreen has exactly one <main>'],
    ['2',    'Login (auth chain returns 200)'],
    ['2a',   'AgentDashboard has 1 main, 1 nav, 1 header'],
    ['3',    'Wait for dashboard (YTD API rendered)'],
    ['4',    'Screenshot dashboard (light mode)'],
    ['5',    'Career tab renders'],
    ['5a',   'Career tab — single <main>'],
    ['6',    'Awards tab renders'],
    ['6a',   'Awards tab — single <main>'],
    ['7-9',  'Awards subtabs (Quarterly/Annual/Club)'],
    ['14',   'Leaderboard tab renders'],
    ['14a',  'Leaderboard tab — single <main>'],
    ['15a',  'History tab renders'],
    ['15aa', 'History tab — single <main>'],
    ['16',   'Profile tab renders'],
    ['16a',  'Profile tab — single <main>'],
    ['20',   'Toggle dark mode'],
    ['21',   'Screenshot dashboard (dark mode)'],
    ['22',   'Toggle back to light mode'],
    ['23',   'Open wizard (Select Week renders)'],
    ['23a',  'Wizard has header + main + label/select binding'],
    ['26',   'Close wizard (returns to dashboard)'],
    ['27',   'Sign out'],
    ['28',   'Verify login redirect'],
  ];
  const completed = allActions.filter(([id]) => actionsCompleted.has(id)).length;

  const lines = [];
  lines.push(`# AgencyTrack Exploration — ${REPORT_LABEL}`);
  lines.push('');
  lines.push(`**Target:** ${BASE_URL}`);
  lines.push(`**Scope:** ${scope}${needsBypass ? ' (bypass cookie wired)' : ''}`);
  lines.push(`**Date:** ${startedAt.toISOString()}`);
  lines.push(`**Test agent:** ${EMAIL}`);
  lines.push('');
  lines.push('## Headline');
  lines.push('');
  lines.push(`Programmatic walkthrough completed ${completed}/${allActions.length} checks. Exercises tab navigation, dark-mode toggle, wizard open/close, sign out + login redirect, and structural-element verification per tab. Out-of-scope steps (PDF download, notifications bell, multi-week wizard interstitial flows) require manual verification.`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Actions completed: ${completed} / ${allActions.length}`);
  lines.push(`- Console errors captured: ${consoleErrors.length}`);
  lines.push(`- Console warnings captured: ${consoleWarnings.length}`);
  lines.push(`- Network failures: ${networkFailures.length}`);
  lines.push(`- Uncaught rejections: ${uncaughtRejections.length}`);
  lines.push(`- Step failure notes: ${stepNotes.length}`);
  lines.push('');
  lines.push('## Action checklist');
  lines.push('');
  for (const [id, label] of allActions) {
    lines.push(`- [${actionsCompleted.has(id) ? 'x' : ' '}] ${id}. ${label}`);
  }
  lines.push('');
  lines.push('Steps not exercised programmatically (manual / out-of-scope): 11–13 (PDF download), 15b/15c (SubmissionViewer), 17–19 (notifications bell), 24–26.b (B1-specific wizard interstitial flows).');
  lines.push('');
  lines.push('## Console errors');
  lines.push('');
  if (consoleErrors.length === 0) lines.push('None observed (filtered known patterns: AuthContext logging).');
  else                            consoleErrors.forEach((e) => lines.push(`- \`${e}\``));
  lines.push('');
  lines.push('## Console warnings');
  lines.push('');
  if (consoleWarnings.length === 0) lines.push('None observed.');
  else                              consoleWarnings.forEach((w) => lines.push(`- \`${w}\``));
  lines.push('');
  lines.push('## Network failures');
  lines.push('');
  if (networkFailures.length === 0) lines.push('None (excluding known-harmless StrictMode Listen ERR_ABORTED).');
  else                              networkFailures.forEach((n) => lines.push(`- \`${n}\``));
  lines.push('');
  lines.push('## Uncaught rejections');
  lines.push('');
  if (uncaughtRejections.length === 0) lines.push('None.');
  else                                 uncaughtRejections.forEach((r) => lines.push(`- \`${r}\``));
  lines.push('');
  lines.push('## Step failure notes');
  lines.push('');
  if (stepNotes.length === 0) lines.push('None.');
  else                        stepNotes.forEach((s) => lines.push(`- ${s}`));
  lines.push('');
  lines.push('## Screenshots saved');
  lines.push('');
  lines.push(`- \`verification/walk/${REPORT_LABEL}_dashboard-light_${stamp}.png\``);
  lines.push(`- \`verification/walk/${REPORT_LABEL}_dashboard-dark_${stamp}.png\``);
  lines.push('');
  lines.push('## Recommendation');
  lines.push('');
  const allClean =
    consoleErrors.length === 0 &&
    networkFailures.length === 0 &&
    uncaughtRejections.length === 0 &&
    stepNotes.length === 0 &&
    completed === allActions.length;
  if (allClean) {
    lines.push('**PASS** — all programmatic checks completed cleanly. Manual interactive flows (PDF download, notifications, multi-week wizard) remain out of scope for this automated walkthrough.');
  } else {
    lines.push('**REVIEW** — see sections above for specifics.');
  }
  lines.push('');
  lines.push('---');
  lines.push('Generated by `scripts/exploration-walk.cjs`.');

  const outPath = path.resolve(process.cwd(), 'verification', `exploration_${REPORT_LABEL}_${stamp}.md`);
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`\nReport saved: ${path.relative(process.cwd(), outPath)}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

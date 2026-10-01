/**
 * fr-width-real-app — the W-3 real-app width sweep (docs/briefs/fr-fit-any-width-kickoff.md § W-3).
 *
 * Runs the W-1 breakage probes (lib/fr-width-probes.mjs) against the REAL app —
 * a local STAGING build — signed in as the staging fixture agent, on every FR
 * agent route at 1024, 1280, 1366, 1440 and 390 px, light and dark.
 *
 * READ-ONLY. It only clicks navigation. Every Firestore WRITE channel and every
 * Cloud Functions call is aborted at the network layer, so a screen that writes
 * on open cannot write. Sign-in (identitytoolkit / securetoken) and reads pass.
 *
 * STAGING ONLY. Before signing in it fetches the served bundle and refuses to
 * run unless it carries `agencytrack-staging` and NO `agencytrack-2a610`
 * (CLAUDE.md: a build without the staging env talks to production).
 *
 * Usage (from a checkout that has W-1's lib/fr-width-probes.mjs):
 *   npm run build -- --mode staging
 *   npx vite preview --port 4173 --strictPort         (in another shell)
 *   node scripts/verification/fr-width-real-app.mjs [--base http://localhost:4173]
 *        [--widths 1024,1280,1366,1440,390] [--out <dir>] [--report docs/audits/fr-width-real-app-<date>.md]
 *   node scripts/verification/fr-width-real-app.mjs --guard-only   (staging bundle check, no sign-in)
 *
 * Credentials: the staging fixture agent staging-agent-1@agencytrack-staging.test
 * (seeded by scripts/staging/seed-staging.mjs) with STAGING_SEED_PASSWORD from
 * .env.staging — the same as smoke-daily-call-fields.mjs. NOT the A11Y_* pair
 * in .env.local: that is a PRODUCTION account and fails against staging
 * (scripts/verification/SMOKES.md). The password is read, never printed.
 * Open modal dialogs (Today's celebration takeover) are closed with Escape before
 * every click and probe, and listed in the report. The weekly-report wizard
 * (which ignores Escape and replaces the whole shell) is probed as its own
 * screen, then left with its own Close button. A route that still fails is
 * reported NOT CHECKED and the sweep moves on.
 * Exit 1 when any finding remains or a route was not checked, 2 when a guard
 * refuses to run.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PROBE } from './lib/fr-width-probes.mjs';
import { loginAs } from './lib/walk-helpers.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const BASE = arg('base', 'http://localhost:4173').replace(/\/$/, '');
const WIDTHS = arg('widths', '1024,1280,1366,1440,390').split(',').map(Number);
const OUT = arg('out', join(tmpdir(), `fr-width-real-app-${Date.now()}`));
const REPORT = arg('report', null);
mkdirSync(OUT, { recursive: true });

// ── env (names only ever referenced; values never logged) ────────────────────
// KEY=VALUE lines only (Rule 4). Same loader and precedence as
// smoke-daily-call-fields.mjs: .env.local, then .env.staging, then process.env.
function loadEnvFile(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* file absent — fall through to process.env */ }
  return out;
}
// Staging fixture credentials. The A11Y_* pair in `.env.local` is a PRODUCTION
// account — it fails against staging Firebase with "Incorrect email or
// password". The staging fixtures are seeded by scripts/staging/seed-staging.mjs
// with the synthetic address below and STAGING_SEED_PASSWORD from .env.staging.
const E = { ...loadEnvFile('.env.local'), ...loadEnvFile('.env.staging'), ...process.env };
const EMAIL = 'staging-agent-1@agencytrack-staging.test';
const PASSWORD = E.STAGING_SEED_PASSWORD;

// After any fetch, exit through process.exitCode, never process.exit(): on
// Windows, exiting while fetch keep-alive handles close trips a libuv
// assertion (exit 127). Refusals before the first fetch may exit at once.
class Refused extends Error {}
function refuse(msg) {
  throw new Refused(msg);
}
function reportRefusal(e) {
  if (!(e instanceof Refused)) throw e;
  console.error(`REFUSED: ${e.message}`);
  process.exitCode = 2;
}
const GUARD_ONLY = process.argv.includes('--guard-only');
try {
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) refuse('--base must be a local server (staging build served locally)');
  if (!GUARD_ONLY && (!EMAIL || !PASSWORD)) refuse('STAGING_SEED_PASSWORD is not set (.env.staging in this checkout)');
} catch (e) {
  reportRefusal(e);
  process.exit(2); // no fetch has run yet, so exiting here is safe
}

/** Staging guard: the served entry bundle must name staging and never production. */
async function bundleGuard() {
  const html = await (await fetch(`${BASE}/`)).text();
  const srcs = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  if (!srcs.length) refuse('no /assets/*.js script in the served index.html');
  let staging = 0; let prod = 0;
  for (const s of srcs) {
    const js = await (await fetch(`${BASE}${s}`)).text();
    staging += (js.match(/agencytrack-staging/g) || []).length;
    prod += (js.match(/agencytrack-2a610/g) || []).length;
  }
  if (prod > 0) refuse(`bundle names the PRODUCTION project (${prod}x agencytrack-2a610) — build with --mode staging`);
  if (staging === 0) refuse('bundle does not name agencytrack-staging');
  return { staging, prod, scripts: srcs.length };
}

/** Abort anything that could write: Firestore Write channel, Cloud Functions. */
async function readOnly(context) {
  const blocked = [];
  await context.route(/firestore\.googleapis\.com\/.*Firestore\/Write\/|cloudfunctions\.net|\.run\.app\//, (route) => {
    blocked.push(new URL(route.request().url()).pathname.split('/').slice(-3).join('/'));
    return route.abort();
  });
  return blocked;
}

const settle = (page, ms) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => setTimeout(r, t))), ms);

/** Every FR sidebar route: top items, and the sub-items a hub opens. */
async function collectRoutes(page) {
  const top = await page.$$eval('[data-testid^="fr-nav-"]', (bs) => bs.map((b) => ({ id: b.getAttribute('data-testid'), label: (b.innerText || b.textContent).trim().split(/\r?\n/)[0].trim(), hub: b.hasAttribute('aria-expanded') })));
  const routes = [];
  for (const t of top) {
    if (!t.hub) { routes.push({ label: t.label, path: [t.id] }); continue; }
    await page.click(`[data-testid="${t.id}"]`);
    await settle(page, 300);
    const subs = await page.$$eval('.fr-sidebar-subs button', (bs) => bs.map((b, i) => ({ i, label: b.textContent.trim() })));
    for (const s of subs) routes.push({ label: `${t.label} · ${s.label}`, path: [t.id, s.i] });
  }
  return routes;
}

/**
 * Close any open modal dialog with Escape (its own keyboard path). Today can
 * open a celebration takeover (FilingStreakCelebration / CelebrationTakeover):
 * a full-screen dialog whose scrim button covers the sidebar and the page, so
 * a click would never land and the probes would measure the page under it.
 * Closing only clears page state; anything that tried to save is aborted by
 * readOnly(). Every close is listed in the report.
 */
const dismissed = [];
/**
 * The weekly-report wizard is not a pop-up over a screen: while it is open the
 * app draws no shell (no sidebar, no main), and it does not close on Escape
 * (by design — it holds a draft). The sweep treats it as its own screen:
 * probes it, then closes it with its own Close button. Its close behaviour is
 * never changed or worked around.
 */
const WIZARD = '[data-testid="wizard-v2-modal"]';
async function closeDialogs(page, where) {
  for (let i = 0; i < 3; i += 1) {
    const open = await page.$$eval('[role="dialog"][aria-modal="true"]', (ds, wizard) => ds
      .filter((d) => !d.matches(wizard))
      .filter((d) => { const r = d.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map((d) => d.getAttribute('data-testid') || d.getAttribute('aria-labelledby') || 'dialog'), WIZARD);
    if (!open.length) return;
    dismissed.push({ where, dialogs: open });
    await page.keyboard.press('Escape');
    await settle(page, 300);
  }
  throw new Error(`a modal dialog would not close with Escape (${where})`);
}

async function open(page, route) {
  await closeDialogs(page, `before ${route.label}`);
  await page.click(`[data-testid="${route.path[0]}"]`);
  await settle(page, 250);
  if (route.path.length > 1) {
    await closeDialogs(page, `before ${route.label}`);
    await page.locator('.fr-sidebar-subs button').nth(route.path[1]).click();
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await settle(page, 900);
  await closeDialogs(page, route.label);
  return (await page.locator(WIZARD).first().isVisible().catch(() => false)) ? 'wizard' : 'page';
}

/**
 * Leave the wizard with its own Close control (the header X, or the week
 * picker's Close before a week is chosen). If it is still open after that, a
 * reload brings the signed-in app back (nothing was saved: readOnly()).
 * Returns how it was left, for the report.
 */
async function leaveWizard(page) {
  for (const sel of [`${WIZARD} [data-testid="wizard-v2-close"]`, `${WIZARD} [aria-label="Close"]`]) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await settle(page, 500);
      if (!(await page.locator(WIZARD).first().isVisible().catch(() => false))) return 'closed with its Close button';
    }
  }
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="fr-sidebar"]', { timeout: 20_000 });
  await closeDialogs(page, 'after reload');
  return 'still open after Close — page reloaded';
}

if (GUARD_ONLY) {
  try {
    const g = await bundleGuard();
    console.log(`staging guard OK — ${g.staging}x agencytrack-staging, 0x agencytrack-2a610 in ${g.scripts} entry script(s)`);
    process.exitCode = 0;
  } catch (e) {
    reportRefusal(e);
  }
} else {
  try {
    process.exitCode = await sweep();
  } catch (e) {
    reportRefusal(e);
  }
}

async function sweep() {

const browser = await chromium.launch();
const findings = [];
const visited = [];
let guard;
let blocked = [];
try {
  guard = await bundleGuard();
  console.log(`staging guard OK — ${guard.staging}x agencytrack-staging, 0x agencytrack-2a610 in ${guard.scripts} entry script(s)`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => { try { localStorage.setItem('agencytrack-look', 'fr'); } catch { /* storage blocked */ } });
  blocked = await readOnly(context);
  const page = await context.newPage();
  await loginAs(page, BASE, EMAIL, PASSWORD);
  await page.waitForSelector('[data-testid="fr-sidebar"]', { timeout: 20_000 });
  await closeDialogs(page, 'after sign-in');
  const routes = await collectRoutes(page);
  console.log(`${routes.length} routes`);
  for (const route of routes) {
    const slug = route.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let n = 0;
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      const kind = await open(page, route);
      const root = kind === 'wizard' ? WIZARD : 'main#main-content';
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: w < 768 ? 844 : 900 });
        await settle(page, 400);
        await closeDialogs(page, `${route.label} @ ${w}`);
        for (const theme of ['light', 'dark']) {
          await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), theme === 'dark');
          await settle(page, 150);
          const found = await page.evaluate(`(${PROBE.toString()})(${JSON.stringify(root)})`);
          for (const f of found) findings.push({ route: route.label, width: w, theme, ...f });
          n += found.length;
          mkdirSync(join(OUT, slug), { recursive: true });
          await page.screenshot({ path: join(OUT, slug, `${w}-${theme}.png`) });
        }
      }
      const note = kind === 'wizard' ? `wizard probed as its own screen; ${await leaveWizard(page)}` : null;
      visited.push({ route: route.label, findings: n, note });
      console.log(`${n ? 'FIND' : 'OK  '} ${route.label} · ${n} findings${note ? ` · ${note}` : ''}`);
    } catch (e) {
      // One route failing (a stuck overlay, a slow screen) must not lose the
      // rest of the sweep; it is reported as NOT CHECKED, never as clean.
      const reason = String(e.message || e).split('\n')[0].slice(0, 160);
      visited.push({ route: route.label, findings: n, error: reason });
      console.log(`FAIL ${route.label} · not checked — ${reason}`);
    }
  }
  await context.close();
} finally {
  await browser.close();
}

// Route × width table (light/dark merged), then details.
const key = (f) => `${f.route}|${f.width}|${f.probe}|${f.selector}|${f.text}`;
const merged = new Map();
for (const f of findings) {
  const m = merged.get(key(f));
  if (m) m.themes.add(f.theme); else merged.set(key(f), { ...f, themes: new Set([f.theme]) });
}
const rows = [...merged.values()];
const failed = visited.filter((v) => v.error);
const cell = (s) => String(s).replace(/\|/g, '/');
const md = [
  `# FR width sweep — real app (staging) — ${new Date().toISOString().slice(0, 16)}Z`,
  '',
  `Staging build served at a local port · signed in as the staging fixture agent · FR look · widths ${WIDTHS.join(', ')} · light + dark · read-only (${blocked.length} write/function requests aborted).`,
  '',
  `**${rows.length} findings** on ${new Set(rows.map((r) => r.route)).size}/${visited.length} routes${failed.length ? ` · **${failed.length} route(s) NOT CHECKED**` : ''}. Screenshots are not committed.`,
  '',
  `| Route | ${WIDTHS.join(' | ')} |`,
  `|---|${WIDTHS.map(() => '---').join('|')}|`,
  ...visited.map((v) => `| ${v.route} | ${v.error ? `**NOT CHECKED** — ${cell(v.error)} |${' |'.repeat(WIDTHS.length - 1)}` : `${WIDTHS.map((w) => { const c = rows.filter((r) => r.route === v.route && r.width === w).length; return c ? `**${c}**` : '0'; }).join(' | ')} |`}`),
  '',
  ...(visited.some((v) => v.note) ? ['Notes:', '', ...visited.filter((v) => v.note).map((v) => `- ${v.route}: ${cell(v.note)}`), ''] : []),
  ...(dismissed.length ? ['Modal dialogs closed with Escape before probing:', '', ...dismissed.map((d) => `- ${cell(d.where)}: ${d.dialogs.map((x) => `\`${cell(x)}\``).join(', ')}`), ''] : []),
  ...(rows.length ? ['| Route | Width | Theme | Probe | Element | Text | Detail |', '|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.route} | ${r.width} | ${[...r.themes].sort().join('+')} | ${r.probe} | \`${cell(r.selector).slice(0, 100)}\` | ${cell(r.text)} | ${cell(r.detail)} |`)] : []),
].join('\n');
writeFileSync(join(OUT, 'real-app.md'), md);
if (REPORT) writeFileSync(REPORT, md);
console.log(`\n${md}\n\nScreenshots: ${OUT}`);
// A route that could not be checked is a failure, never a clean pass.
return rows.length || failed.length ? 1 : 0;
}

/**
 * smoke-call-sources-self-service.mjs
 * Staging smoke for PR #919 — call sources are self-service and self-credit only.
 *
 * This is the smoke slice A (#915) was owed and never got: the first exercise of
 * the callSources collection, its callables and its rules against a real Firebase.
 *
 * ─── THIS SMOKE MUTATES. THAT IS WHY IT IS STAGING-ONLY. ────────────────────
 * Every other preview smoke in this directory is a read-only click-through,
 * because CLAUDE.md § Workflow pins feature-branch Vercel previews to the
 * PRODUCTION Firebase project — a mutating smoke there writes production data.
 * This one creates and revokes real documents and mints a real bearer token, so
 * it runs against the `staging` branch deployment, the only Vercel host bound to
 * `agencytrack-staging`. The BASE guard below is not a convenience; it is the
 * mechanism that keeps that true, and it refuses to run anywhere else.
 *
 * ─── TOKEN HYGIENE IS ENFORCED HERE, NOT REMEMBERED ─────────────────────────
 * The raw token is returned exactly once, at creation, and is never recoverable
 * (only its SHA-256 hash is stored). Governance forbids it reaching chat output,
 * a PR body, a commit message, a log line, a screenshot, or a URL param.
 * So this script never reads the value across the CDP boundary at all: the token
 * assertion runs INSIDE the page and returns a length and a boolean, never the
 * string. There is no variable in this file that ever holds it. The reveal panel
 * is dismissed before any screenshot is possible.
 *
 * Run:
 *   node --env-file=.env.staging scripts/verification/smoke-call-sources-self-service.mjs
 */
import { chromium } from 'playwright';
import { setupBypassSession, captureConsoleAndNetwork, formatCaptureReport } from './lib/walk-helpers.mjs';

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing ${k} — run with --env-file=.env.staging`); return v; };

// The staging branch deployment — bound to the `agencytrack-staging` Firebase
// project. Read from env, then validated by the guard below.
const BASE = (process.env.STAGING_BASE_URL
  || 'https://agencytrack-git-staging-kyron-marchan-s-projects.vercel.app').replace(/\/+$/, '');
const TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');

// Staging synthetic tenant account.
//
// The password comes from STAGING_SEED_PASSWORD in .env.staging — the same
// value the seeding script used — and is referenced BY NAME ONLY. Never echo it,
// never default it, never inline it.
//
// ⚠ smoke-tier0-staging.mjs used to hardcode 'ChangeMe-Staging-2026!' for these
// accounts, and that literal had gone stale — INVALID_LOGIN_CREDENTIALS against
// the live tenant (probed 2026-08-26). It was moved onto STAGING_SEED_PASSWORD
// in the same PR as this file. Do not reintroduce the pattern: a credential
// that lives in one file rots there, and in a smoke without an explicit
// auth-error race it presents as a mystery 30-second timeout.
const AGENT = {
  email: process.env.STAGING_AGENT_EMAIL || 'staging-agent-1@agencytrack-staging.test',
  password: requireEnv('STAGING_SEED_PASSWORD'),
};

// HARD GUARD. A mutating smoke that reaches production writes real credentials
// into a real tenant. Refuse rather than warn.
if (!/agencytrack-git-staging-/.test(BASE) || /agencytrack\.vercel\.app|agencytrack-2a610/.test(BASE)) {
  throw new Error('REFUSING TO RUN: BASE is not the staging branch deployment. This smoke mutates.');
}

const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true, note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };

async function login(page, email, password) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 200,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(2000);
}

/**
 * The staging agent has a 5-week filing streak in its seeded data, so a
 * CELEBRATION MODAL fires on login: `div.fixed.inset-0.z-[60]` with an
 * `inset-0` backdrop button over the entire viewport. It covers EVERY nav
 * item, not just this feature's — a control tab known-good in other smokes
 * is equally un-clickable underneath it.
 *
 * This is seeded-data state, not a defect in the feature under test, and it
 * will hit any smoke that signs in as this account. Dismiss it and assert it
 * is gone, rather than clicking through it with force/dispatchEvent — those
 * would "pass" while the app was still blocked, which is how a green leg ends
 * up meaning nothing.
 */
async function dismissCelebration(page) {
  const overlay = page.locator('div.fixed.inset-0.z-\\[60\\]').first();
  if (!await overlay.isVisible({ timeout: 2500 }).catch(() => false)) return 'none present';

  const btn = page.locator('[data-testid="celebration-dismiss"]').first();
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) await btn.click().catch(() => {});
  else await page.keyboard.press('Escape');

  await page.waitForTimeout(900);
  const stillThere = await overlay.isVisible({ timeout: 1500 }).catch(() => false);
  if (stillThere) throw new Error('celebration overlay would not dismiss — app still blocked');
  return 'dismissed';
}

async function setDarkMode(page, wantDark) {
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (isDark === wantDark) return;
  await page.evaluate((d) => {
    document.documentElement.classList.toggle('dark', d);
    try { localStorage.setItem('agencytrack-dark', d ? 'true' : 'false'); } catch {}
  }, wantDark);
  await page.waitForTimeout(400);
}

async function runTheme(browser, theme) {
  console.log(`\n=== AGENT ${theme.toUpperCase()} — call sources self-service ===`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE, TOKEN);
  const page = await ctx.newPage();
  const capture = captureConsoleAndNetwork(page);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  try { await login(page, AGENT.email, AGENT.password); }
  catch (e) { fail(`${theme}-login`, e.message); await ctx.close(); return; }

  try { const r = await dismissCelebration(page); pass(`${theme}-app-unblocked`, `celebration: ${r}`); }
  catch (e) { fail(`${theme}-app-unblocked`, e.message); await ctx.close(); return; }

  await setDarkMode(page, theme === 'dark');

  // LEG 1 — an ORDINARY AGENT can reach the tab at all.
  // This is the whole slice in one assertion: under slice A this nav entry lived
  // on ManagerDashboard behind MANAGER_ROLES, so an agent seeing it IS the
  // self-service change. A failure here is the feature not shipping, not a flake.
  const navItem = page.locator('[data-testid="agent-tab-call-sources"]').first();
  if (!await navItem.isVisible({ timeout: 8000 }).catch(() => false)) {
    const seen = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid^="agent-tab-"]')).map(e => e.getAttribute('data-testid')));
    fail(`${theme}-nav-reachable`, `Call Sources not in agent nav. saw: ${seen.join(', ')}`);
    await ctx.close();
    return;
  }
  // The sidebar is its OWN scroll container (nav.sidebar, clientH 900 /
  // scrollH 1344) and Call Sources is the 15th of 18 entries at y≈1065 —
  // below the fold on a 900px viewport. So scroll it into view, then click.
  //
  // Do NOT reach for `force: true` or dispatchEvent if this fails. Both were
  // tried while the real cause was still unknown, and both are why the cause
  // stayed unknown: dispatchEvent "worked" and opened the tab while a
  // full-screen modal was still covering the entire app. A click that bypasses
  // hit-testing cannot tell you the app is blocked. The overlay is handled
  // above, deliberately, before we get here.
  await navItem.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  try {
    await navItem.click({ timeout: 10_000 });
  } catch (e) {
    fail(`${theme}-nav-reachable`, `nav item present but not clickable: ${e.message.split('\n')[0]}`);
    await ctx.close();
    return;
  }
  await page.waitForTimeout(1200);

  const onTab = await page.getByText('My Call Sources').first()
    .isVisible({ timeout: 6000 }).catch(() => false);
  if (!onTab) { fail(`${theme}-nav-reachable`, 'clicked, but the Call Sources panel did not render'); await ctx.close(); return; }
  pass(`${theme}-nav-reachable`, 'ordinary agent can open Call Sources');

  // LEG 2 — the list loads. An error here means the rules query was rejected,
  // which is the `where('creditUid','==',uid)` filter being wrong: the read arm
  // is owner-only, and Firestore denies an unconstrained list outright.
  const err = await page.locator('[data-testid="call-sources-error"]').first()
    .textContent({ timeout: 2500 }).catch(() => null);
  if (err) { fail(`${theme}-list-loads`, `error banner: ${err}`); await ctx.close(); return; }
  pass(`${theme}-list-loads`, 'no error banner — owner-scoped query accepted');

  // LEG 3 — attach a source.
  const label = `smoke ${theme} — delete me`;
  await page.fill('#cs-label', label);
  await page.fill('#cs-app', 'kqm-calls');
  await page.fill('#cs-source-user', `smoke-${theme}-caller`);
  await page.click('[data-testid="cs-create"]');

  // Wait for a SIGNAL, not a stopwatch. These callables were created minutes
  // ago, so the first invocation of each pays a Cloud Functions cold start —
  // a fixed 2.5s wait made the light leg (which runs first) report "no token
  // panel" while the call was still in flight, and the dark leg pass on the
  // now-warm function. A fixed sleep does not test the feature, it tests how
  // warm the runtime happened to be.
  const outcome = await Promise.race([
    page.locator('[data-testid="call-source-token-reveal"]').first()
      .waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'revealed'),
    page.locator('[data-testid="call-sources-error"]').first()
      .waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'error'),
  ]).catch(() => 'timeout');

  if (outcome === 'error') {
    const msg = await page.locator('[data-testid="call-sources-error"]').first().textContent().catch(() => '?');
    fail(`${theme}-create`, `create failed: ${msg}`); await ctx.close(); return;
  }
  if (outcome === 'timeout') { fail(`${theme}-create`, 'no reveal and no error within 45s'); await ctx.close(); return; }
  pass(`${theme}-create`, 'createCallSource accepted with no creditUid in payload');

  // LEG 4 — the token is revealed exactly once, and this script never holds it.
  // The assertion runs INSIDE the page and returns {shown, len} only. The string
  // never crosses into Node, so it cannot reach a log, a screenshot or a report
  // even by accident. Do NOT "improve" this by reading textContent here.
  const tokenShape = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="call-source-token-value"]');
    if (!el) return { shown: false, len: 0 };
    return { shown: true, len: (el.textContent || '').trim().length };
  });
  if (!tokenShape.shown) fail(`${theme}-token-revealed`, 'no token reveal panel after create');
  else if (tokenShape.len < 20) fail(`${theme}-token-revealed`, `token implausibly short (${tokenShape.len} chars)`);
  else pass(`${theme}-token-revealed`, `revealed once, ${tokenShape.len} chars (value never read)`);

  // Dismiss the reveal BEFORE anything could screenshot it.
  //
  // ⚠ This leg only means something if the panel was actually shown. The first
  // version asserted "not visible" unconditionally, so on the light run — where
  // the panel never rendered at all because the create was still cold-starting —
  // it reported PASS. A dismissal test that passes hardest when there was
  // nothing to dismiss is worse than no test: it is a green light for the exact
  // state it exists to catch. Gate it on the panel having appeared.
  if (!tokenShape.shown) {
    fail(`${theme}-token-dismissed`, 'skipped — panel never appeared, so dismissal proves nothing');
  } else {
    await page.click('[data-testid="call-source-token-dismiss"]').catch(() => {});
    await page.waitForTimeout(600);
    const stillVisible = await page.locator('[data-testid="call-source-token-reveal"]')
      .first().isVisible({ timeout: 1000 }).catch(() => false);
    if (stillVisible) fail(`${theme}-token-dismissed`, 'reveal panel still on screen after dismiss');
    else pass(`${theme}-token-dismissed`, 'panel cleared — nothing sensitive left rendered');
  }

  // LEG 5 — it appears in MY list. This IS the self-credit assertion, and it
  // needs no second account: the rules read arm is `creditUid == request.auth.uid`,
  // so a row that renders for this signed-in agent could not have been credited
  // to anyone else. If creditUid had been set to another uid, the row would be
  // invisible here rather than merely wrong.
  const rows = page.locator('[data-testid="cs-row"]');
  const mine = await rows.filter({ hasText: label }).first()
    .isVisible({ timeout: 6000 }).catch(() => false);
  if (!mine) { fail(`${theme}-listed-as-mine`, `"${label}" not in this agent's list`); await ctx.close(); return; }
  pass(`${theme}-listed-as-mine`, 'visible under owner-only read — credited to the signed-in agent');

  // LEG 6 — revoke it. Also the cleanup: this smoke leaves nothing behind.
  const row = rows.filter({ hasText: label }).first();
  await row.locator('[data-testid="cs-revoke"]').click();

  // Same cold-start reasoning as the create leg: wait for the outcome, not a
  // stopwatch. Getting this wrong is not a cosmetic test failure — a revoke
  // that is reported failed but actually succeeded sends someone hunting a
  // token that isn't there, and one reported passed but actually pending
  // leaves a LIVE CREDENTIAL in the tenant. Wait long enough to know.
  const revoked = await Promise.race([
    row.locator('[data-testid="cs-revoked-badge"]').waitFor({ state: 'visible', timeout: 45_000 }).then(() => true),
    row.waitFor({ state: 'detached', timeout: 45_000 }).then(() => true),
  ]).catch(() => false);

  if (revoked) pass(`${theme}-revoke`, 'revoked — nothing live left behind');
  else fail(`${theme}-revoke`, 'still active after 45s — CLEANUP NEEDED, a live token was left behind');

  formatCaptureReport(capture);
  await ctx.close();
}

const browser = await chromium.launch();
try {
  await runTheme(browser, 'light');
  await runTheme(browser, 'dark');
} finally {
  await browser.close();
}

console.log('\n=== SUMMARY ===');
const failed = results.filter(r => !r.ok);
results.forEach(r => console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id}${r.note ? ' — ' + r.note : ''}`));
console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
if (failed.some(r => /revoke/.test(r.id))) {
  console.log('\n! A revoke leg failed. Check the staging callSources collection for a live token and revoke it by hand.');
}
process.exit(failed.length ? 1 : 0);

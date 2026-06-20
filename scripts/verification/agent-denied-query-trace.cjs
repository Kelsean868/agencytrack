'use strict';
/**
 * Agent denied-query runtime trace.
 *
 * The agent exploration walk captures `FirebaseError: Missing or insufficient
 * permissions.` but only surfaces `.message` — not the collection path or which
 * surface fired it. The SM-tier proof (#699) visits only Dashboard + Goals and
 * sees 0 errors, so the goals-hierarchy query is NOT the culprit; a different
 * tab fires a separate denied query.
 *
 * This trace logs in as the agent, visits each agent tab ONE AT A TIME, and for
 * every captured console error records:
 *   - which tab was active when it fired (surface attribution)
 *   - the full serialized error (code + message + name + stack), not just .message
 *   - all console args (catch contextual labels the app logs alongside the error)
 *
 * It also enables Firestore SDK debug logging when reachable, which logs the
 * failed Listen target path.
 *
 * Run: node --env-file=.env.local scripts/verification/agent-denied-query-trace.cjs
 */
const path        = require('path');
const { chromium } = require(path.resolve(__dirname, '../../node_modules/playwright-core'));

const BASE_URL = process.env.A11Y_BASE_URL || 'https://portal.agencytrack.app';
const EMAIL    = process.env.A11Y_AGENT_EMAIL;
const PASSWORD = process.env.A11Y_AGENT_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD');
  process.exit(1);
}

// Visit order mirrors the walk's extra surfaces (the proof already cleared
// dashboard + goals). Each is its own testid click.
const TABS = [
  { name: 'history',           testId: 'agent-tab-history' },
  { name: 'game-plan',         testId: 'agent-tab-game-plan' },
  { name: 'money-needs',       testId: 'agent-tab-money-needs' },
  { name: 'goals',             testId: 'agent-tab-goals' },
  { name: 'commission',        testId: 'agent-tab-commission' },
  { name: 'persistency',       testId: 'agent-tab-persistency' },
  { name: 'policy-ledger',     testId: 'agent-tab-policy-ledger' },
  { name: 'prospect-info',     testId: 'agent-tab-prospect-info' },
  { name: 'production-report', testId: 'agent-tab-production-report' },
  { name: 'awards',            testId: 'agent-tab-awards' },
  { name: 'career',            testId: 'agent-tab-career' },
  { name: 'leaderboard',       testId: 'agent-tab-leaderboard' },
  { name: 'profile',           testId: 'agent-tab-profile' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let currentTab = 'initial-load';
  const events = [];   // { tab, kind, text, code, name, stack, args }

  // Capture EVERY console message (all types) with full arg serialization.
  page.on('console', async (msg) => {
    const type = msg.type();
    const text = msg.text();
    // Firestore debug logging emits the failed Listen target at type 'debug'/'log'.
    const isFsDebug = /@firebase\/firestore|Listen|Query\(target=|permission-denied|insufficient permissions/i.test(text);
    if (type !== 'error' && type !== 'warning' && !isFsDebug) return;

    const serializedArgs = [];
    for (const arg of msg.args()) {
      try {
        const detail = await arg.evaluate((v) => {
          if (v && typeof v === 'object') {
            return {
              __obj: true,
              code: v.code ?? null,
              name: v.name ?? null,
              message: v.message ?? null,
              stack: v.stack ?? null,
              keys: Object.keys(v).slice(0, 20),
            };
          }
          return { __obj: false, value: String(v) };
        });
        serializedArgs.push(detail);
      } catch {
        serializedArgs.push({ __obj: false, value: '<unserializable>' });
      }
    }
    events.push({ tab: currentTab, kind: type, text, args: serializedArgs });
  });

  page.on('pageerror', (err) => {
    events.push({ tab: currentTab, kind: 'pageerror', text: String(err), args: [] });
  });

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Try to enable Firestore debug logging via any window-exposed hook.
    await page.evaluate(() => {
      try {
        if (window.firebase?.firestore?.setLogLevel) window.firebase.firestore.setLogLevel('debug');
      } catch { /* not exposed; per-tab attribution is the primary signal */ }
    });

    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 20000 });

    // Let the initial dashboard load settle (this is the proof's clean baseline).
    currentTab = 'initial-load';
    await page.waitForTimeout(4000);

    for (const tab of TABS) {
      currentTab = tab.name;
      const btn = page.locator(`[data-testid="${tab.testId}"]`);
      const count = await btn.count();
      if (!count) {
        console.log(`[trace] tab ${tab.name} (${tab.testId}) — not present, skipping`);
        continue;
      }
      try {
        await btn.first().click({ timeout: 8000 });
      } catch {
        console.log(`[trace] tab ${tab.name} — click failed (may need More drawer), skipping`);
        continue;
      }
      await page.waitForTimeout(4000);  // allow async listeners/queries to fire + fail
      console.log(`[trace] visited ${tab.name}`);
    }

    // ── Wizard leg — the walk's write-read-verify surface, NOT covered above ──
    // Open wizard → Select Week → Start Report (loads draft / submitted view).
    // This is the only walk action beyond tab-landing that touches Firestore.
    currentTab = 'wizard-open';
    try {
      // Return to dashboard/home so the "Submit Weekly Report" CTA is present.
      const home = page.locator('[data-testid="agent-tab-dashboard"]');
      if (await home.count()) { await home.first().click({ timeout: 8000 }); await page.waitForTimeout(1500); }

      await page.getByRole('button', { name: /Submit Weekly Report/i }).click({ timeout: 8000 });
      await page.waitForSelector('text=Select Week', { timeout: 10000 });
      await page.waitForTimeout(2000);
      console.log('[trace] wizard opened (Select Week)');

      currentTab = 'wizard-start-report';
      // Iterate up to 3 weeks clicking Start Report — replicates the walk's
      // submitted-week probing (each Start Report triggers a draft/submission read).
      const select = page.locator('select#wizard-week');
      const options = await select.locator('option').all();
      for (let i = 0; i < Math.min(options.length, 3); i++) {
        const weekVal = await options[i].getAttribute('value');
        if (i > 0) await select.selectOption(weekVal);
        await page.getByRole('button', { name: /Start Report/i }).click({ timeout: 8000 });
        await page.waitForTimeout(2500);  // allow getDraft / submitted-view read to fire
        console.log(`[trace] wizard Start Report week#${i} (${weekVal})`);
        const changeBtn = page.getByRole('button', { name: /Change week|Pick another/i });
        if (await changeBtn.count()) { await changeBtn.first().click(); await page.waitForSelector('text=Select Week', { timeout: 5000 }); }
        else break;
      }
    } catch (e) {
      console.log(`[trace] wizard leg ended: ${e.message.split('\n')[0]}`);
    }

    // ── Dark-mode toggle leg (pure UI, but the walk does it) ──
    currentTab = 'dark-mode';
    try {
      const toggle = page.getByRole('button', { name: /toggle dark mode|dark mode/i });
      if (await toggle.count()) { await toggle.first().click({ timeout: 5000 }); await page.waitForTimeout(2000); console.log('[trace] toggled dark mode'); }
    } catch { /* non-fatal */ }
  } finally {
    await browser.close();
  }

  // Report
  console.log('\n========== DENIED-QUERY TRACE REPORT ==========');
  const errs = events.filter((e) => e.kind === 'error' || e.kind === 'pageerror');
  console.log(`total error events: ${errs.length}`);
  const permErrs = events.filter((e) =>
    /insufficient permissions|permission-denied/i.test(e.text) ||
    e.args.some((a) => a.__obj && (a.code === 'permission-denied' || /insufficient permissions/i.test(a.message || '')))
  );
  console.log(`permission-denied events: ${permErrs.length}\n`);

  const byTab = {};
  for (const e of permErrs) byTab[e.tab] = (byTab[e.tab] || 0) + 1;
  console.log('permission-denied by tab:', JSON.stringify(byTab, null, 2));

  console.log('\n--- full permission-denied events ---');
  for (const e of permErrs) {
    console.log(`\n[tab=${e.tab}] [${e.kind}] ${e.text}`);
    e.args.forEach((a, i) => {
      if (a.__obj) {
        console.log(`  arg${i}: code=${a.code} name=${a.name} msg=${a.message}`);
        if (a.stack) console.log(`         stack: ${a.stack.split('\n').slice(0, 4).join(' | ')}`);
      } else {
        console.log(`  arg${i}: ${a.value}`);
      }
    });
  }

  console.log('\n--- any firestore debug/Listen lines (target paths) ---');
  const fsLines = events.filter((e) => /Listen|Query\(target=|@firebase\/firestore/i.test(e.text));
  if (!fsLines.length) console.log('  (none — Firestore debug logging not reachable from page context)');
  for (const e of fsLines) console.log(`  [tab=${e.tab}] ${e.text}`);

  console.log('\n--- all error/warning events (context) ---');
  for (const e of events.filter((x) => x.kind === 'error' || x.kind === 'warning')) {
    console.log(`  [tab=${e.tab}] [${e.kind}] ${e.text}`);
  }
  console.log('===============================================');

  process.exit(0);
})();

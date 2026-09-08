/**
 * smoke-persistency-p4-playground-levers.mjs — PR #940 (Persistency P4,
 * What-If Playground catches up with the 24-month model).
 *
 * ⚠ READ-ONLY BY DESIGN, AND IT HAS TO BE. A feature-branch Vercel preview
 * builds against PRODUCTION Firebase (agencytrack-2a610), so signing in here
 * authenticates against the live tenant and reads live data. This walk opens
 * the Playground and drags sliders in a modal that writes nothing — the
 * Playground has no save path at all — and it never opens the entry form.
 *
 * What it proves that the unit tests cannot: that against a real preview build
 * reading a real persistency document, the P4 wiring reaches the DOM —
 *   - the `Business Rolling Off` lever renders on whichever model the account's
 *     record is on (it is unconditional, §3.2)
 *   - the header model line renders and names a model
 *   - the `Decreases Expected` lever's presence AGREES with that model line:
 *     present on a 24-month month, absent on a legacy month. This is the real
 *     assertion — it holds whichever month production happens to carry, so it
 *     does not depend on prod having a September 2026 record.
 *   - moving a new lever actually moves the projected percentage (the lever is
 *     wired to projectPersistency, not decorative)
 *
 * SKIP-NOT-FAIL: if the persistency tab, the Playground, or a model line is
 * unreachable for the signed-in account (no record on the selected month, or a
 * legacy document written before `monthKey` was added to the payload), that leg
 * skips with an explicit note rather than passing.
 *
 * Usage:
 *   node scripts/verification/smoke-persistency-p4-playground-levers.mjs <preview-url>
 */
import { chromium } from 'playwright';
import {
  setupBypassSession,
  loginAs,
  waitForFirebaseReady,
  captureConsoleAndNetwork,
  setTheme,
  waitForTheme,
  stamp,
  installGlobalTimeout,
  finishSmoke,
} from './lib/walk-helpers.mjs';

const BASE_URL = process.argv[2];
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const EMAIL = process.env.A11Y_AGENT_EMAIL;
const PASSWORD = process.env.A11Y_AGENT_PASSWORD;

if (!BASE_URL) {
  console.error('usage: node scripts/verification/smoke-persistency-p4-playground-levers.mjs <preview-url>');
  process.exit(2);
}
for (const [name, value] of [
  ['VERCEL_BYPASS_TOKEN', TOKEN],
  ['A11Y_AGENT_EMAIL', EMAIL],
  ['A11Y_AGENT_PASSWORD', PASSWORD],
]) {
  if (!value) {
    console.error(`missing ${name} — set it in .env.local and re-run from the main worktree`);
    process.exit(2);
  }
}

const results = [];
const record = (leg, passed, detail = '') => {
  results.push({ leg, passed, detail });
  console.log(`${stamp()} ${passed ? 'PASS' : 'FAIL'}  ${leg}${detail ? ' — ' + detail : ''}`);
};
const skip = (name, why) => {
  console.log(`${stamp()} SKIP  ${name} — ${why}`);
};

const clear = installGlobalTimeout(420_000, () => {
  console.error('global timeout — smoke aborted');
  process.exit(1);
});

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await setupBypassSession(context, BASE_URL, TOKEN);
    const page = await context.newPage();
    const capture = captureConsoleAndNetwork(page);

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);
    await loginAs(page, BASE_URL, EMAIL, PASSWORD);
    await waitForFirebaseReady(page);
    const signedIn = !(await page.locator('input[type="password"]').first().isVisible().catch(() => false));
    record(`[agent/${theme}] signs in`, signedIn);

    await setTheme(context, theme);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);
    const themeOk = await waitForTheme(page, theme).then(() => true).catch(() => false);
    record(`[agent/${theme}] renders in the ${theme} theme`, themeOk);

    const tab = page.locator('[data-testid="agent-tab-persistency"]');
    const tabThere = await tab.isVisible().catch(() => false);
    record(`[agent/${theme}] persistency tab is reachable`, tabThere);

    if (!tabThere) {
      skip(`[agent/${theme}] Playground legs`, 'persistency tab not reachable for this account');
    } else {
      await tab.click();
      await page.waitForTimeout(1500);

      const openBtn = page.locator('[data-testid="agent-playground-open-button"]');
      const openThere = await openBtn.isVisible().catch(() => false);
      if (!openThere) {
        skip(`[agent/${theme}] Playground legs`, 'Open Playground button not reachable');
      } else {
        await openBtn.click();
        const modal = page.locator('[data-testid="persistency-playground"]');
        const modalThere = await modal
          .waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);
        record(`[agent/${theme}] Playground opens`, modalThere);

        if (!modalThere) {
          skip(`[agent/${theme}] lever legs`, 'Playground did not open');
        } else {
          // ── Unconditional lever (§3.2) ──────────────────────────────────
          const gbfCount = await page.locator('[data-testid="playground-slider-goodBusinessFallingOff"]').count();
          record(`[agent/${theme}] "Business Rolling Off" lever renders (unconditional)`, gbfCount === 1);

          // ── Model line + effective-dated lever must AGREE ───────────────
          const modelLine = page.locator('[data-testid="playground-model-line"]');
          const modelLineThere = await modelLine.isVisible().catch(() => false);
          const decCount = await page.locator('[data-testid="playground-slider-decreasesAnticipated"]').count();

          if (!modelLineThere) {
            // No model line means no usable monthKey on the record — the
            // specified degradation (§3.4). The decreases lever must then be
            // hidden too, and the modal must still be standing.
            record(`[agent/${theme}] no model line → decreases lever hidden, modal still standing`,
              decCount === 0 && (await modal.isVisible()),
              'record carries no usable monthKey (legacy doc) — degraded as specified');
            skip(`[agent/${theme}] model-line wording leg`, 'record carries no usable monthKey');
          } else {
            const lineText = (await modelLine.innerText()).replace(/\s+/g, ' ').trim();
            const is24 = /^24-month model/.test(lineText);
            const is12 = /^12-month model/.test(lineText);
            record(`[agent/${theme}] model line names a model and its window`,
              (is24 && /September 2026 onwards/.test(lineText))
              || (is12 && /through August 2026/.test(lineText)),
              lineText);

            record(`[agent/${theme}] "Decreases Expected" lever presence agrees with the model line`,
              (is24 && decCount === 1) || (is12 && decCount === 0),
              `${lineText} → decreases lever ${decCount ? 'PRESENT' : 'absent'}`);
          }

          // ── The new lever is actually wired to projectPersistency ────────
          // Drag Business Rolling Off (present on both models) and confirm the
          // projected percentage moves. Nothing is written by this.
          const projected = page.locator('[data-testid="playground-projected-pct"]');
          const before = (await projected.innerText().catch(() => '')).trim();
          const slider = page.locator('[data-testid="playground-slider-goodBusinessFallingOff"]');
          if (gbfCount === 1 && before) {
            await slider.evaluate((el) => {
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              setter.call(el, String(Math.round(Number(el.max) / 2)));
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            });
            await page.waitForTimeout(400);
            const after = (await projected.innerText()).trim();
            record(`[agent/${theme}] "Business Rolling Off" lever moves the projected %`,
              after !== before, `${before} → ${after}`);

            // Reset returns it — proves ZERO_LEVERS covers the new levers.
            await page.locator('[data-testid="playground-reset-btn"]').click();
            await page.waitForTimeout(400);
            const reset = (await projected.innerText()).trim();
            record(`[agent/${theme}] Reset returns the projected % to its at-zero value`,
              reset === before, `${after} → ${reset}`);
          } else {
            skip(`[agent/${theme}] lever-wiring leg`, 'no rolling-off slider or no projected % to compare');
          }
        }
      }
    }

    const errors = capture.consoleMessages.filter((m) => m.type === 'error');
    record(`[agent/${theme}] no console errors`, errors.length === 0,
      errors.length ? errors.slice(0, 3).map((e) => e.text).join(' | ') : 'clean');

    await context.close();
  }
} finally {
  await browser.close();
}

finishSmoke(results, { clearTimeout: clear });

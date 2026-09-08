/**
 * smoke-persistency-p4-playground-levers.mjs — PR #940 (Persistency P4/P4b/P4c,
 * What-If Playground catches up with the 24-month model).
 *
 * ⚠ READ-ONLY BY DESIGN, AND IT HAS TO BE. A feature-branch Vercel preview
 * builds against PRODUCTION Firebase (agencytrack-2a610), so signing in here
 * authenticates against the live tenant and reads live data. This walk opens
 * the Playground and drags sliders in a modal that writes nothing — the
 * Playground has no save path at all — and it never opens the entry form.
 *
 * What it proves that the unit tests cannot: that against a real preview build
 * reading a real persistency document, the P4/P4b/P4c wiring reaches the DOM —
 *   - the `Business Rolling Off` lever renders on whichever model the account's
 *     record is on (it is unconditional, §3.2)
 *   - the header model line renders and names a model
 *   - the `Decreases Expected` lever's presence AGREES with that model line:
 *     present on a 24-month month, absent on a legacy month. This is the real
 *     assertion — it holds whichever month production happens to carry, so it
 *     does not depend on prod having a September 2026 record.
 *   - the additive and subtractive levers actually move the projected gross
 *     (they are wired to projectPersistency, not decorative)
 *   - P4c's three-state discriminator agrees with the ACCOUNT'S BASELINE
 *     (current.grossSettled, read once at rest) at every lever position:
 *     nothing-to-plan-from is fixed for the whole account and must stay the
 *     neutral message however far a subtractive lever is dragged — it must
 *     NEVER flip to the P4b danger message, which is the exact defect P4c
 *     fixes. Asserted as an agreement, not a fixed expectation, so it holds
 *     whether or not the account has a persistency record. Live production
 *     currently has no non-zero-baseline account reachable here, so the
 *     danger-message path itself skips rather than asserting a guess.
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

          // ── The new levers are wired, and the P4c three-state discriminator
          // agrees with the account's baseline at every lever position ──────
          //
          // P4c: "nothing to plan from" is a property of current.grossSettled
          // — the RECORD, not the projection — so it is fixed for the whole
          // walk once read at rest. A zero-baseline account must show the
          // NEUTRAL line at every lever position, NEVER the P4b danger
          // message, however far a subtractive lever is dragged. That is
          // the exact defect P4c fixes (P4b fired the danger message here).
          // Nothing is written by any of this — the Playground has no save path.
          const projected = page.locator('[data-testid="playground-projected-pct"]');
          const slider = page.locator('[data-testid="playground-slider-goodBusinessFallingOff"]');

          // Reads the rendered "Projected Net Gross" figure back off the DOM.
          const readGross = async () => {
            const text = await page.locator('[data-testid="persistency-projected-output"]').innerText();
            const m = text.match(/TTD\s*(-?[\d,]+(?:\.\d+)?)/);
            return m ? parseFloat(m[1].replace(/,/g, '')) : NaN;
          };
          const setLever = async (locator, value) => {
            await locator.evaluate((el, v) => {
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              setter.call(el, String(v));
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }, value);
            await page.waitForTimeout(400);
          };

          if (gbfCount === 1) {
            // At rest, no lever has moved, so the displayed gross equals
            // current.grossSettled exactly — this is the one point in the
            // walk where reading it off the DOM tells us the account's fixed
            // baseline.
            const restGrossProbe = await readGross();
            const isNothingToPlanFrom = restGrossProbe <= 0;
            if (isNothingToPlanFrom) {
              skip(`[agent/${theme}] impossible-plan (danger-message) state`,
                'account has no settled business (grossSettled <= 0) — "nothing to plan from" is sticky regardless of lever position (P4c), so the danger path cannot be exercised live on this account');
            }

            const guardState = async (label) => {
              const gross = await readGross();
              const shown = (await projected.innerText()).trim();
              const neutral = await page.locator('[data-testid="playground-nothing-to-plan-warning"]').count();
              const danger = await page.locator('[data-testid="playground-negative-denominator-warning"]').count();
              const nbCard = await page.locator('[data-testid="playground-shortfall-card-nb"]').count();

              let shape, agrees;
              if (isNothingToPlanFrom) {
                shape = 'neutral (nothing to plan from)';
                agrees = shown === '—' && neutral === 1 && danger === 0 && nbCard === 0;
              } else if (gross <= 0) {
                shape = 'danger (impossible plan)';
                agrees = shown === '—' && danger === 1 && neutral === 0 && nbCard === 0;
              } else {
                shape = 'normal';
                agrees = shown !== '—' && neutral === 0 && danger === 0 && nbCard === 1;
              }
              record(`[agent/${theme}] P4c state agrees with the account baseline — ${label}`,
                Number.isFinite(gross) && agrees,
                `gross ${gross} → shown "${shown}", expected ${shape} (neutral ${neutral ? 'Y' : 'N'}, danger ${danger ? 'Y' : 'N'}, nb-card ${nbCard ? 'Y' : 'N'})`);
              return { gross, shown };
            };

            // 1. At rest.
            const rest = await guardState('at rest');

            // 2. New Business up — an ADDITIVE lever, so the displayed
            //    "Projected Net Gross" figure must still rise, even though
            //    (on a zero-baseline account) the PERCENTAGE stays suppressed
            //    throughout — that stickiness is the P4c fix.
            await setLever(page.locator('[data-testid="playground-slider-newBusinessPlanned"]'), 500_000);
            const lifted = await guardState('new business up');
            record(`[agent/${theme}] additive lever raises projected gross`,
              lifted.gross > rest.gross, `${rest.gross} → ${lifted.gross}`);

            // 3. Business Rolling Off to max — a SUBTRACTIVE lever, so gross
            //    must fall. This is the lever P4 made reachable and P4b/P4c guard.
            await setLever(slider, 500_000);
            const dropped = await guardState('rolling off at max');
            record(`[agent/${theme}] subtractive lever lowers projected gross`,
              dropped.gross < lifted.gross, `${lifted.gross} → ${dropped.gross}`);

            // 4. Reset returns everything — proves ZERO_LEVERS covers the new levers.
            await page.locator('[data-testid="playground-reset-btn"]').click();
            await page.waitForTimeout(400);
            const resetGross = await readGross();
            const resetShown = (await projected.innerText()).trim();
            record(`[agent/${theme}] Reset returns projected gross and the percentage to their at-rest values`,
              resetGross === rest.gross && resetShown === rest.shown,
              `gross ${dropped.gross} → ${resetGross}; shown "${resetShown}"`);
          } else {
            skip(`[agent/${theme}] lever-wiring + P4c state legs`, 'no rolling-off slider present');
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

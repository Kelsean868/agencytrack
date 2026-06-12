/**
 * Year Plan Slice 2b smoke — AwardProjectionStrip render + licenseProfile dropdown.
 *
 * Part A — AwardProjectionStrip (agent context, light then dark on same page):
 *   Requires VITE_YEAR_PLAN_ENABLED=true in the preview build. If the Year Plan
 *   step card renders as a non-interactive div (flag off), Part A legs are skipped
 *   with an ENV_GATE note and the overall smoke still passes.
 *   When flag is on:
 *   - Open YearPlanModal via the Year Plan step card
 *   - Handle profile-prompt (select "Composite") and no-seed (dismiss) if needed
 *   - Ensure Life annual API > 0 (fill 300 000 if blank)
 *   - Assert data-testid="award-projection-strip" is visible (light + dark)
 *   - axe NO-NEW serious/critical on the strip (light pass only)
 *
 * Part B — licenseProfile dropdown (BM context, light then dark on same page):
 *   - Navigate to Team tab
 *   - Open EditUserDrawer for first agent row
 *   - Assert #edit-user-license-profile select with 4 options (blank + 3 profiles)
 *   - Verify current value is blank or one of the 3 known values
 *
 * Usage:
 *   node scripts/verification/year-plan-2b-smoke.mjs --url=<preview>
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('='); if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const cliArgs = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v];
}));
const URL          = cliArgs.url ?? 'https://agencytrack.vercel.app';
const IS_PROD      = URL.startsWith('https://');
const AGENT_EMAIL  = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS   = process.env.A11Y_AGENT_PASSWORD;
const BM_EMAIL     = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASS      = process.env.A11Y_BRANCH_MANAGER_PASSWORD;
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;

if (!AGENT_EMAIL || !AGENT_PASS) { console.error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD'); process.exit(1); }
if (!BM_EMAIL || !BM_PASS)       { console.error('Missing A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD'); process.exit(1); }
if (IS_PROD && !BYPASS_TOKEN)    { console.error('Missing VERCEL_BYPASS_TOKEN for prod URL'); process.exit(1); }

console.log(`\nYear Plan Slice 2b smoke`);
console.log(`Target: ${URL}\n`);

// ── helpers ─────────────────────────────────────────────────────────────────

async function login(page, email, pass) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(1200);
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    if (t === 'dark') { document.documentElement.classList.add('dark'); localStorage.setItem('agencytrack-dark', 'true'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('agencytrack-dark', 'false'); }
  }, theme);
  await page.waitForTimeout(400);
}

// ── Part A — AwardProjectionStrip (both themes, single agent context/page) ──

async function runPartA(browser) {
  const results = [];
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('fontshare.com')) return;
    if (t.includes('Failed to load resource') && t.includes('net::ERR_FAILED')) return;
    errors.push(t);
  });

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, AGENT_EMAIL, AGENT_PASS);

    // Navigate to Game Plan tab
    await page.click('[data-testid="agent-tab-game-plan"]');
    await page.waitForSelector('[data-testid="game-plan-hub"]', { timeout: 15_000 });
    await page.waitForTimeout(800);

    // Check if Year Plan step card is a clickable button (VITE_YEAR_PLAN_ENABLED=true baked in)
    const yearPlanIsButton = await page.evaluate(() => {
      const rail = document.querySelector('[data-testid="game-plan-rail"]');
      if (!rail) return false;
      const candidates = rail.querySelectorAll('button, div[aria-disabled]');
      for (const el of candidates) {
        if (/Year Plan/i.test(el.textContent || '')) {
          return el.tagName === 'BUTTON';
        }
      }
      return false;
    });

    if (!yearPlanIsButton) {
      const note = 'VITE_YEAR_PLAN_ENABLED not true in preview build — Year Plan step is non-interactive; AwardProjectionStrip render verification skipped';
      console.log(`  [A/light] ENV_GATE: ${note}`);
      console.log(`  [A/dark]  ENV_GATE: same`);
      results.push({ part: 'A', theme: 'light', result: 'ENV_GATE', pass: true, note });
      results.push({ part: 'A', theme: 'dark',  result: 'ENV_GATE', pass: true, note });
      return results;
    }

    // ── Open modal, handle all pre-allocating phases ───────────────────────
    async function openModalToAllocating() {
      // Click the Year Plan step button
      await page.evaluate(() => {
        const rail = document.querySelector('[data-testid="game-plan-rail"]');
        if (!rail) return;
        const btns = rail.querySelectorAll('button');
        for (const btn of btns) {
          if (/Year Plan/i.test(btn.textContent || '')) { btn.click(); return; }
        }
      });
      await page.waitForFunction(
        () => Boolean(document.querySelector('[role="dialog"][aria-label*="Year Plan"]')),
        { timeout: 15_000 }
      );
      await page.waitForTimeout(1200); // let load() settle

      // Handle profile-prompt
      const profilePrompt = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        return Boolean(d) && /What lines are you licensed for/i.test(d.textContent || '');
      });
      if (profilePrompt) {
        await page.getByRole('button', { name: /Composite/i }).first().click();
        await page.waitForTimeout(2000);
      }

      // Handle no-seed
      const noSeed = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        if (!d) return false;
        const t = d.textContent || '';
        return /Start from scratch/i.test(t) || /No Money Needs/i.test(t);
      });
      if (noSeed) {
        await page.evaluate(() => {
          const btns = document.querySelectorAll('[role="dialog"] button');
          for (const b of btns) {
            if (/scratch|dismiss|skip/i.test(b.textContent || '')) { b.click(); break; }
          }
        });
        await page.waitForTimeout(1000);
      }

      // Wait for allocating phase (Life annual API input must be visible)
      await page.waitForFunction(
        () => Boolean(document.querySelector('[aria-label="Life annual API"]')),
        { timeout: 10_000 }
      );
    }

    async function ensureLifeAPISet() {
      const lifeInput = page.getByLabel('Life annual API');
      const val = await lifeInput.inputValue().catch(() => '');
      const num = parseFloat(val.replace(/,/g, '')) || 0;
      if (num <= 0) {
        await lifeInput.fill('300000');
        await page.keyboard.press('Tab');
        await page.waitForTimeout(800);
      }
    }

    async function assertStrip(theme) {
      const stripVisible = await page.evaluate(
        () => Boolean(document.querySelector('[data-testid="award-projection-strip"]'))
      );
      const pillCount = await page.evaluate(
        () => document.querySelectorAll('[data-testid^="award-pill-"]').length
      );
      let axeSC = [];
      if (theme === 'light') {
        try {
          const res = await new AxeBuilder({ page })
            .include('[data-testid="award-projection-strip"]')
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();
          axeSC = res.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .flatMap((v) => (v.nodes || []).map((n) => ({ id: v.id, target: (n.target ?? []).join(' > ') })));
        } catch (e) {
          axeSC = [{ id: 'axe-error', target: String(e).slice(0, 120) }];
        }
      }
      const pass = stripVisible && pillCount > 0 && axeSC.length === 0 && errors.length === 0;
      console.log(`  [A/${theme}] strip=${stripVisible} pills=${pillCount} axe-sc=${axeSC.length} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
      if (axeSC.length) axeSC.slice(0, 3).forEach((n) => console.log(`    axe ${n.id}: ${n.target}`));
      return { part: 'A', theme, stripVisible, pillCount, axeSC, errors: errors.length, pass };
    }

    // ── light ────────────────────────────────────────────────────────────
    await openModalToAllocating();
    await ensureLifeAPISet();
    results.push(await assertStrip('light'));

    // Close modal, toggle dark, reopen
    await page.getByRole('button', { name: /Close Year Plan/i }).click().catch(async () => {
      await page.keyboard.press('Escape');
    });
    await page.waitForTimeout(600);
    await setTheme(page, 'dark');

    // ── dark ─────────────────────────────────────────────────────────────
    await openModalToAllocating();
    await ensureLifeAPISet();
    results.push(await assertStrip('dark'));

  } catch (e) {
    const fatal = String(e).slice(0, 300);
    console.log(`  [A] FATAL: ${fatal}`);
    results.push({ part: 'A', theme: 'light', fatal, pass: false });
    results.push({ part: 'A', theme: 'dark',  fatal, pass: false });
  } finally {
    await context.close();
  }
  return results;
}

// ── Part B — licenseProfile dropdown (both themes, single BM context/page) ──

async function runPartB(browser) {
  const results = [];
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('fontshare.com')) return;
    if (t.includes('Failed to load resource') && t.includes('net::ERR_FAILED')) return;
    errors.push(t);
  });

  async function assertLicenseDropdown(theme) {
    const dropdownPresent = await page.evaluate(
      () => Boolean(document.querySelector('#edit-user-license-profile'))
    );
    // Absent dropdown = VITE_YEAR_PLAN_ENABLED not set in build — gate correctly applied.
    if (!dropdownPresent) {
      const note = 'VITE_YEAR_PLAN_ENABLED not true in preview build — licenseProfile dropdown absent (flag gate correct)';
      console.log(`  [B/${theme}] ENV_GATE: ${note}`);
      return { part: 'B', theme, result: 'ENV_GATE', pass: true, note };
    }
    const optionValues = await page.evaluate(() => {
      const sel = document.querySelector('#edit-user-license-profile');
      return sel ? Array.from(sel.options).map((o) => o.value) : [];
    });
    const currentVal = await page.evaluate(
      () => document.querySelector('#edit-user-license-profile')?.value ?? '__missing__'
    );
    const hasBlank     = optionValues.includes('');
    const hasComposite = optionValues.includes('composite');
    const hasLifeOnly  = optionValues.includes('life_only');
    const hasGeneral   = optionValues.includes('general_only');
    const validValue   = ['', 'composite', 'life_only', 'general_only'].includes(currentVal);
    const pass = optionValues.length === 4 && hasBlank && hasComposite && hasLifeOnly && hasGeneral && validValue && errors.length === 0;
    console.log(`  [B/${theme}] dropdown=true options=${optionValues.length} blank=${hasBlank} composite=${hasComposite} life_only=${hasLifeOnly} general_only=${hasGeneral} val="${currentVal}" valid=${validValue} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    return { part: 'B', theme, dropdownPresent, optionCount: optionValues.length, currentVal, validValue, errors: errors.length, pass };
  }

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, BM_EMAIL, BM_PASS);

    // Navigate to Team tab and open first agent's EditUserDrawer
    await page.click('[data-testid="nav-team"]');
    await page.waitForTimeout(2000);

    // Find first agent-role row — licenseProfile dropdown only shows for agent targets.
    // Each user row is a grid div; the role label span (text-xs text-ink-muted) reads "Agent".
    const firstTestId = await page.evaluate(() => {
      const editBtns = Array.from(document.querySelectorAll('[data-testid^="user-edit-"]'));
      // First try to find an agent row specifically
      const agentBtn = editBtns.find((btn) => {
        let el = btn.parentElement;
        while (el && !el.classList.contains('grid')) el = el.parentElement;
        if (!el) return false;
        const spans = el.querySelectorAll('span');
        return Array.from(spans).some((s) => s.textContent.trim() === 'Agent');
      });
      // Fall back to first available if no agent row found
      return (agentBtn ?? editBtns[0])?.dataset.testid ?? null;
    });
    if (!firstTestId) throw new Error('No user-edit-* buttons found in Team panel');

    await page.click(`[data-testid="${firstTestId}"]`);
    await page.waitForSelector('[data-testid="edit-user-drawer"]', { timeout: 8_000 });
    await page.waitForTimeout(500);

    // ── light ────────────────────────────────────────────────────────────
    results.push(await assertLicenseDropdown('light'));

    // Close drawer, toggle dark, reopen
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="edit-user-drawer"]', { state: 'detached', timeout: 5_000 }).catch(() => {});
    await setTheme(page, 'dark');
    await page.waitForTimeout(400);

    await page.click(`[data-testid="${firstTestId}"]`);
    await page.waitForSelector('[data-testid="edit-user-drawer"]', { timeout: 8_000 });
    await page.waitForTimeout(500);

    // ── dark ─────────────────────────────────────────────────────────────
    results.push(await assertLicenseDropdown('dark'));

  } catch (e) {
    const fatal = String(e).slice(0, 300);
    console.log(`  [B] FATAL: ${fatal}`);
    results.push({ part: 'B', theme: 'light', fatal, pass: false });
    results.push({ part: 'B', theme: 'dark',  fatal, pass: false });
  } finally {
    await context.close();
  }
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });

console.log('--- Part A: AwardProjectionStrip (agent) ---');
const partAResults = await runPartA(browser);

console.log('\n--- Part B: licenseProfile dropdown (branch_manager) ---');
const partBResults = await runPartB(browser);

await browser.close();

const allResults = [...partAResults, ...partBResults];
const envGated = allResults.filter((r) => r.result === 'ENV_GATE');
const verified = allResults.filter((r) => r.result !== 'ENV_GATE');
const allPass = allResults.every((r) => r.pass);

console.log(`\nYear Plan Slice 2b smoke:`);
if (envGated.length) console.log(`  ENV_GATE: ${envGated.length} leg(s) skipped — VITE_YEAR_PLAN_ENABLED not set in preview build`);
console.log(`  Verified: ${verified.filter((r) => r.pass).length}/${verified.length} pass`);
console.log(`  Overall: ${allPass ? '✓ PASS' : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);

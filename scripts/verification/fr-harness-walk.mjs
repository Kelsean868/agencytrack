/**
 * fr-harness-walk — the "FR harness walk" ritual (docs/briefs/fr-agent-redesign-program.md §5.1).
 *
 * Drives the DEV-only FR harness (/fr-harness.html, src/components/fr/harness) with
 * Playwright. NO Firebase, NO sign-in, NO production: the harness renders the
 * FR Views with SAMPLE data, so this is safe to run anywhere `npm run dev` runs.
 *
 * For every scene of the chosen slice, in light AND dark:
 *   1. screenshot            desktop 1440×900 and/or phone 390×844 (full page)
 *   2. axe                   WCAG 2.2 A/AA — serious + critical must be 0
 *   3. tap targets           every visible interactive element ≥ 44px tall
 *   4. console               no console errors / page errors (phone: no sideways scroll)
 *   5. glide probe           (scenes with A/B data) click "Change data"; geometry
 *                            sampled at ~0 / 240 / 700 ms must be strictly between
 *                            old and new at 240 ms and settled at 700 ms (MOTION3.md)
 *   6. reduced-motion probe  same change under prefers-reduced-motion settles < 60 ms
 *   7. swipe probe           (pager scenes) slow 60px drag stays · 220px drag moves one
 *                            page · ArrowRight moves one page · viewport height ==
 *                            active page height (no blank scroll)
 *
 * Usage:
 *   npm run dev                                  (in another shell; port 5173)
 *   node scripts/verification/fr-harness-walk.mjs --slice FR-0 [--base http://localhost:5173] [--out <dir>]
 *
 * Exit code 1 when any check fails. Prints a markdown summary table (the
 * evidence paste-back for the PR body). Screenshots go to --out (default: the
 * OS temp dir) — verification artifacts are never committed.
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg('base', 'http://localhost:5173');
const SLICE = arg('slice', 'all');
const ONLY = arg('scene', null);
const OUT = arg('out', join(tmpdir(), `fr-harness-walk-${Date.now()}`));
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

const AXE_SOURCE = require('node:fs').readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const EXEC_PATH = process.env.PW_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const results = [];
function record(scene, theme, vp, check, pass, detail = '') {
  results.push({ scene, theme, vp, check, pass, detail });
  const mark = pass === null ? 'SKIP' : pass ? 'PASS' : 'FAIL';
  console.log(`${mark.padEnd(4)} ${scene} · ${theme} · ${vp} · ${check}${detail ? ` — ${detail}` : ''}`);
}

async function listScenes(browser) {
  const page = await browser.newPage();
  await page.goto(`${BASE}/fr-harness.html`, { waitUntil: 'networkidle' });
  const scenes = await page.$$eval('main li', (lis) => lis.map((li) => {
    const a = li.querySelector('a');
    const meta = li.querySelector('span')?.textContent || '';
    const [slice, viewport] = meta.split(' · ');
    return { id: new URL(a.href).searchParams.get('scene'), slice, viewport };
  }));
  await page.close();
  return scenes;
}

/** In-page: geometry of every data-driven element inside the scene root. */
const SNAPSHOT = () => {
  const root = document.querySelector('[data-scene-root]');
  const els = [...root.querySelectorAll('[style]')].filter((el) => /width|height|left|top|transform|stroke-dash/.test(el.getAttribute('style')));
  return els.map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return [r.width, r.height, r.left, r.top, parseFloat(cs.strokeDasharray) || 0];
  });
};

async function glideProbe(page) {
  return page.evaluate(async (snapSrc) => {
    const snap = new Function(`return (${snapSrc})()`);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const a = snap();
    document.querySelector('[data-testid="fr-harness-change"]').click();
    const t0 = performance.now();
    await wait(240);
    const mid = snap();
    const tMid = performance.now() - t0;
    await wait(700);
    const b = snap();
    let changed = 0; let between = 0;
    const n = Math.min(a.length, mid.length, b.length);
    for (let i = 0; i < n; i += 1) {
      for (let k = 0; k < 5; k += 1) {
        const d = b[i][k] - a[i][k];
        if (Math.abs(d) > 1.5) {
          changed += 1;
          const lo = Math.min(a[i][k], b[i][k]) + 0.25;
          const hi = Math.max(a[i][k], b[i][k]) - 0.25;
          if (mid[i][k] > lo && mid[i][k] < hi) between += 1;
        }
      }
    }
    return { changed, between, tMid: Math.round(tMid) };
  }, SNAPSHOT.toString());
}

async function reducedProbe(page) {
  return page.evaluate(async (snapSrc) => {
    const snap = new Function(`return (${snapSrc})()`);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const a = snap();
    document.querySelector('[data-testid="fr-harness-change"]').click();
    await wait(60);
    const mid = snap();
    await wait(600);
    const b = snap();
    let changed = 0; let settled = 0;
    const n = Math.min(a.length, mid.length, b.length);
    for (let i = 0; i < n; i += 1) {
      for (let k = 0; k < 5; k += 1) {
        if (Math.abs(b[i][k] - a[i][k]) > 1.5) {
          changed += 1;
          if (Math.abs(mid[i][k] - b[i][k]) <= 1) settled += 1;
        }
      }
    }
    return { changed, settled };
  }, SNAPSHOT.toString());
}

async function tapTargets(page) {
  return page.evaluate(() => {
    const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=tab], [role=button], [role=radio], [role=switch]';
    const bad = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"],[inert]')) continue;
      if (r.height < 43.5) bad.push(`${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label').slice(0, 30)}]` : ''} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return bad;
  });
}

async function axe(page) {
  await page.addScriptTag({ content: AXE_SOURCE });
  return page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.nodes.length})`);
  });
}

async function swipeProbe(page) {
  const vp = page.locator('[data-testid="swipe-pager-viewport"]');
  const box = await vp.boundingBox();
  const active = () => page.$eval('[role="tab"][aria-selected="true"]', (el) => el.textContent.trim());
  const drag = async (dx, steps, stepMs) => {
    const y = box.y + 120;
    const x0 = box.x + box.width / 2 + 100;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i += 1) {
      await page.mouse.move(x0 + (dx * i) / steps, y);
      await page.waitForTimeout(stepMs);
    }
    await page.mouse.up();
    await page.waitForTimeout(700);
  };
  const out = {};
  const start = await active();
  await drag(-60, 12, 40);
  out.slowShortStays = (await active()) === start;
  await drag(-220, 10, 20);
  const second = await active();
  out.longMoves = second !== start;
  await page.focus('[role="tab"][aria-selected="true"]');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(700);
  out.arrowMoves = (await active()) !== second;
  out.heightFits = await page.evaluate(() => {
    const view = document.querySelector('[data-testid="swipe-pager-viewport"]');
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find((p) => p.getAttribute('aria-hidden') !== 'true');
    return Math.abs(view.getBoundingClientRect().height - panel.getBoundingClientRect().height) <= 2;
  });
  return out;
}

async function walkScene(browser, scene, theme, vpName) {
  const ctx = await browser.newContext({ ...VIEWPORTS[vpName], colorScheme: theme });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  // The walk may run without internet (cloud sandbox). A failed request to a
  // NON-local host (e.g. the Google Fonts JetBrains Mono import) is noted,
  // not failed; a failed LOCAL request is a real error.
  page.on('requestfailed', (r) => {
    const host = new URL(r.url()).hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') external.push(host);
    else errors.push(`request failed: ${r.url()}`);
  });
  page.on('response', (r) => {
    const u = new URL(r.url());
    if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && r.status() >= 400) errors.push(`${r.status()} ${u.pathname}`);
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/^Failed to load resource/.test(m.text())) return; // classified by the request listeners above
    errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  const url = `${BASE}/fr-harness.html?scene=${scene.id}${theme === 'dark' ? '&theme=dark' : ''}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900); // entrance motion settles
  const shot = join(OUT, `${scene.id}-${vpName}-${theme}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  record(scene.id, theme, vpName, 'screenshot', true, shot);

  const violations = await axe(page);
  record(scene.id, theme, vpName, 'axe serious/critical = 0', violations.length === 0, violations.join(', '));

  if (vpName === 'phone') {
    // On a phone, anything wider than the screen makes the browser widen the
    // layout viewport — the whole page then scrolls sideways.
    const w = await page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    record(scene.id, theme, vpName, 'no sideways scroll (390px)', w.inner === 390 && w.scroll <= 390, `innerWidth ${w.inner}, scrollWidth ${w.scroll}`);
  }

  const small = await tapTargets(page);
  record(scene.id, theme, vpName, 'tap targets ≥ 44px', small.length === 0, small.slice(0, 6).join('; '));

  if (scene.hasVariants) {
    const g = await glideProbe(page);
    const ok = g.changed > 0 && g.between / g.changed >= 0.8;
    record(scene.id, theme, vpName, 'glide probe', ok, `${g.between}/${g.changed} values mid-flight at ${g.tMid}ms`);
  }
  if (scene.pager) {
    const s = await swipeProbe(page);
    record(scene.id, theme, vpName, 'swipe: slow 60px stays', s.slowShortStays);
    record(scene.id, theme, vpName, 'swipe: 220px moves one page', s.longMoves);
    record(scene.id, theme, vpName, 'swipe: ArrowRight moves one page', s.arrowMoves);
    record(scene.id, theme, vpName, 'swipe: height = active page', s.heightFits);
  }
  record(scene.id, theme, vpName, 'no console errors', errors.length === 0,
    [...errors.slice(0, 3), ...(external.length ? [`(offline, not counted: ${[...new Set(external)].join(', ')})`] : [])].join(' | '));
  await ctx.close();

  if (scene.hasVariants && theme === 'light') {
    const rctx = await browser.newContext({ ...VIEWPORTS[vpName], reducedMotion: 'reduce' });
    const rp = await rctx.newPage();
    await rp.goto(url, { waitUntil: 'networkidle' });
    await rp.waitForTimeout(300);
    const r = await reducedProbe(rp);
    record(scene.id, 'reduced', vpName, 'reduced motion settles < 60ms', r.changed > 0 && r.settled / r.changed >= 0.9, `${r.settled}/${r.changed}`);
    await rctx.close();
  }
}

const browser = await chromium.launch({ executablePath: EXEC_PATH });
try {
  let scenes = await listScenes(browser);
  if (SLICE !== 'all') scenes = scenes.filter((s) => s.slice === SLICE);
  if (ONLY) scenes = scenes.filter((s) => s.id === ONLY);
  if (scenes.length === 0) throw new Error(`no scenes for slice ${SLICE}`);
  for (const scene of scenes) {
    // Scene metadata beyond the index (variants / pager) is read from the page.
    const probe = await browser.newPage();
    await probe.goto(`${BASE}/fr-harness.html?scene=${scene.id}`, { waitUntil: 'networkidle' });
    scene.hasVariants = (await probe.$('[data-testid="fr-harness-change"]')) !== null;
    scene.pager = (await probe.$('[data-testid="swipe-pager-viewport"]')) !== null;
    await probe.close();
    const vps = scene.viewport === 'both' ? ['desktop', 'phone'] : [scene.viewport];
    for (const vp of vps) {
      for (const theme of ['light', 'dark']) {
        await walkScene(browser, scene, theme, vp);
      }
    }
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => r.pass === false);
const rows = results.filter((r) => r.check !== 'screenshot');
const md = [
  `### FR harness walk — slice ${SLICE} — ${new Date().toISOString().slice(0, 16)}Z`,
  '',
  `${rows.length - failed.length}/${rows.length} checks pass · screenshots: ${results.filter((r) => r.check === 'screenshot').length} (in \`${OUT}\`)`,
  '',
  '| Scene | Theme | Viewport | Check | Result | Detail |',
  '|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.scene} | ${r.theme} | ${r.vp} | ${r.check} | ${r.pass === null ? 'SKIP' : r.pass ? 'PASS' : '**FAIL**'} | ${String(r.detail).replace(/\|/g, '/').slice(0, 120)} |`),
].join('\n');
writeFileSync(join(OUT, 'summary.md'), md);
console.log(`\n${md}\n\nSummary: ${join(OUT, 'summary.md')}`);
process.exit(failed.length ? 1 : 0);

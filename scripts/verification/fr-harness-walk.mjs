/**
 * fr-harness-walk — the "FR harness walk" ritual (docs/briefs/fr-agent-redesign-program.md §5.1).
 *
 * Drives the DEV-only FR harness (/fr-harness.html, src/components/fr/harness) with
 * Playwright. NO Firebase, NO sign-in, NO production: the harness renders the
 * FR Views with SAMPLE data, so this is safe to run anywhere `npm run dev` runs.
 *
 * For every scene of the chosen slice, in light AND dark:
 *   1. screenshot            desktop 1440×900 / tablet 900×800 / phone 390×844 (full page)
 *   2. axe                   WCAG 2.2 A/AA — serious + critical must be 0
 *   3. tap targets           every visible interactive element ≥ 44px tall
 *   4. console               no console errors / page errors (phone: no sideways scroll)
 *   5. glide probe           (scenes with A/B data) click "Change data"; geometry
 *                            sampled at ~0 / 240 / 700 ms must be strictly between
 *                            old and new at 240 ms and settled at 700 ms (MOTION3.md)
 *      redraw / count-up     (same click, FR-3) Line paths flip fr-draw-a↔b and are
 *                            mid-draw at 240 ms, drawn by 700 ms; changed tile figures
 *                            read between old and new at 240 ms. A variant scene must
 *                            have at least one of the three motions measured.
 *   6. reduced-motion probe  same change under prefers-reduced-motion settles < 60 ms
 *   7. swipe probe           (pager scenes) slow 60px drag stays · 220px drag moves one
 *                            page · ArrowRight moves one page · viewport height ==
 *                            active page height (no blank scroll)
 *
 * Usage:
 *   npm run dev                                  (in another shell; port 5173)
 *   node scripts/verification/fr-harness-walk.mjs --slice FR-0 [--base http://localhost:5173] [--out <dir>]
 *
 * Width sweep (docs/briefs/fr-fit-any-width-kickoff.md § W-1) — replaces the
 * checks above with the five breakage probes (scripts/verification/lib/
 * fr-width-probes.mjs), every scene inside the REAL app shell (?frame=app),
 * at 13 window widths × light + dark:
 *   FR_HARNESS_STUB_FIREBASE=1 npm run dev       (the ledger scenes need the stub)
 *   node scripts/verification/fr-harness-walk.mjs --sweep [--slice X] [--scene id]
 *        [--widths 1024,1280] [--shots key|all|none] [--report docs/audits/fr-width-sweep-<date>.md]
 * Exit 1 when any finding remains.
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
import { SWEEP_WIDTHS, sweepWidthsFor, sweepScene, sweepReport, writeSweep } from './lib/fr-width-probes.mjs';

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
  tablet: { viewport: { width: 900, height: 800 } },
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
  // A Line chart's end dot and end label are RE-KEYED on a data change and fade
  // in after the redraw (MOTION3 rule 3) — they jump by design, so they belong
  // to the redraw probe, not the glide probe.
  const els = [...root.querySelectorAll('[style]')]
    .filter((el) => /width|height|left|top|transform|stroke-dash/.test(el.getAttribute('style')))
    .filter((el) => !['end-dot', 'end-label'].includes(el.getAttribute('data-part')));
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

/**
 * Redraw + count-up probe (FR-3). Two motions the geometry probe cannot see:
 *   · Line charts REDRAW (MOTION3 rule 3: paths cannot tween) — after a data
 *     change the path class flips fr-draw-a ↔ fr-draw-b and the stroke is
 *     mid-draw at ~240 ms (0 < dashoffset < --fr-len) and drawn by 700 ms.
 *   · Big numbers COUNT old → new in 420 ms (MOTION3 rule 4) — every changed
 *     tile figure ([data-testid$="-value"] [aria-hidden]) must read strictly
 *     between old and new at ~240 ms and equal new by 700 ms.
 */
async function drawCountProbe(page, { tMid = 240, tEnd = 700 } = {}) {
  return page.evaluate(async ({ tMid, tEnd }) => {
    const root = document.querySelector('[data-scene-root]');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const nums = () => [...root.querySelectorAll('[data-testid$="-value"] [aria-hidden="true"]')]
      .map((el) => { const n = parseFloat(el.textContent.replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : null; });
    const paths = () => [...root.querySelectorAll('path.fr-draw-a, path.fr-draw-b')];
    const cls0 = paths().map((p) => p.getAttribute('class'));
    const a = nums();
    document.querySelector('[data-testid="fr-harness-change"]').click();
    const t0 = performance.now();
    await wait(tMid);
    const now = paths();
    const mid = now.map((p) => {
      const cs = getComputedStyle(p);
      return { off: parseFloat(cs.strokeDashoffset) || 0, len: parseFloat(cs.getPropertyValue('--fr-len')) || 0 };
    });
    const m = nums();
    const tAt = Math.round(performance.now() - t0);
    await wait(tEnd - tMid);
    const end = now.map((p) => parseFloat(getComputedStyle(p).strokeDashoffset) || 0);
    const c = nums();
    let changed = 0; let between = 0; let settled = 0;
    for (let i = 0; i < Math.min(a.length, m.length, c.length); i += 1) {
      // A change of under 2 display units (e.g. 2 → 3 apps) has no whole
      // value strictly between old and new, so "mid-flight" cannot exist;
      // those figures are not judged here.
      if (a[i] == null || c[i] == null || Math.abs(c[i] - a[i]) < 2) continue;
      changed += 1;
      if (m[i] > Math.min(a[i], c[i]) && m[i] < Math.max(a[i], c[i])) between += 1;
      if (m[i] === c[i]) settled += 1;
    }
    const flipped = now.filter((p, i) => cls0[i] && p.getAttribute('class') !== cls0[i]).length;
    return {
      tMid: tAt,
      lines: now.length,
      flipped,
      drawingMid: mid.filter((d) => d.off > 0.5 && d.len > 0 && d.off < d.len).length,
      drawnEnd: end.every((o) => Math.abs(o) <= 0.5),
      numbers: { changed, between, settledAtMid: settled },
    };
  }, { tMid, tEnd });
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
    // Reload so the redraw/count-up probe starts from variant A again.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const dc = await drawCountProbe(page);
    let measured = 0;
    if (g.changed > 0) {
      measured += 1;
      record(scene.id, theme, vpName, 'glide probe', g.between / g.changed >= 0.8, `${g.between}/${g.changed} values mid-flight at ${g.tMid}ms`);
    } else {
      record(scene.id, theme, vpName, 'glide probe', null, 'no styled geometry changes in this scene (see redraw / count-up)');
    }
    if (dc.lines > 0 && dc.flipped > 0) {
      measured += 1;
      record(scene.id, theme, vpName, 'line redraw probe', dc.drawingMid > 0 && dc.drawnEnd, `${dc.drawingMid}/${dc.lines} lines mid-draw at ${dc.tMid}ms; drawn by 700ms: ${dc.drawnEnd}`);
    }
    if (dc.numbers.changed > 0) {
      measured += 1;
      record(scene.id, theme, vpName, 'count-up probe', dc.numbers.between / dc.numbers.changed >= 0.8, `${dc.numbers.between}/${dc.numbers.changed} figures between old and new at ${dc.tMid}ms`);
    }
    // A scene with sample variants must have SOME motion measured — never a pass by skipping.
    if (measured === 0) record(scene.id, theme, vpName, 'motion measured', false, 'the data change moved no geometry, line or figure');
  }
  // A responsive scene has its phone pager only at phone width (absent, or
  // display:none, above it) — there is nothing to swipe there, so the probe is
  // a SKIP with a note, never a pass. At phone width a missing pager FAILS.
  const pagerVisible = scene.pager
    && await page.locator('[data-testid="swipe-pager-viewport"]').first().isVisible().catch(() => false);
  if (scene.pager && !pagerVisible) {
    if (vpName === 'phone') record(scene.id, theme, vpName, 'swipe: pager present', false, 'scene has a pager but none is visible at phone width');
    else record(scene.id, theme, vpName, 'swipe probe', null, 'no pager at this viewport (phone-only layout)');
  }
  if (pagerVisible) {
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
    await rp.reload({ waitUntil: 'networkidle' });
    await rp.waitForTimeout(300);
    const rd = await drawCountProbe(rp, { tMid: 60, tEnd: 300 });
    const parts = [];
    let ok = true;
    let measured = 0;
    if (r.changed > 0) { measured += 1; ok = ok && r.settled / r.changed >= 0.9; parts.push(`geometry ${r.settled}/${r.changed}`); }
    if (rd.numbers.changed > 0) {
      measured += 1;
      ok = ok && rd.numbers.settledAtMid === rd.numbers.changed;
      parts.push(`figures ${rd.numbers.settledAtMid}/${rd.numbers.changed}`);
    }
    if (rd.lines > 0 && rd.flipped > 0) { measured += 1; ok = ok && rd.drawingMid === 0; parts.push(`lines mid-draw at 60ms: ${rd.drawingMid}`); }
    record(scene.id, 'reduced', vpName, 'reduced motion settles < 60ms', measured > 0 && ok, parts.join(' · ') || 'nothing measured');
    await rctx.close();
  }
}

if (process.argv.includes('--sweep')) {
  const widths = arg('widths', null)?.split(',').map(Number) ?? SWEEP_WIDTHS;
  const shots = arg('shots', 'key');
  const report = arg('report', null);
  const sb = await chromium.launch({ executablePath: EXEC_PATH });
  const findings = [];
  let scenes = [];
  try {
    scenes = await listScenes(sb);
    if (SLICE !== 'all') scenes = scenes.filter((s) => s.slice === SLICE);
    if (ONLY) scenes = scenes.filter((s) => ONLY.split(',').includes(s.id));
    if (scenes.length === 0) throw new Error(`no scenes for slice ${SLICE}`);
    const titles = await (async () => {
      const p = await sb.newPage();
      await p.goto(`${BASE}/fr-harness.html`, { waitUntil: 'networkidle' });
      const t = await p.$$eval('main li a:first-child', (as) => as.map((a) => [new URL(a.href).searchParams.get('scene'), a.textContent.trim()]));
      await p.close();
      return new Map(t);
    })();
    for (const scene of scenes) {
      scene.title = titles.get(scene.id) || scene.id;
      const ws = sweepWidthsFor(scene, widths);
      const t0 = Date.now();
      const f = await sweepScene(sb, { base: BASE, scene, widths: ws, out: OUT, shots });
      findings.push(...f);
      console.log(`${f.length ? 'FIND' : 'OK  '} ${scene.id} · ${ws.length} widths · ${f.length} findings · ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  } finally {
    await sb.close();
  }
  const stamp = `${new Date().toISOString().slice(0, 16)}Z`;
  const rep = sweepReport(findings, { scenes, widths, stamp, shotsDir: OUT });
  writeSweep(OUT, rep, findings);
  // The committed report never names a local temp path (screenshots stay out of git).
  if (report) writeFileSync(report, sweepReport(findings, { scenes, widths, stamp, shotsDir: null }).md);
  console.log(`\n${rep.md}\n\nSweep: ${join(OUT, 'sweep.md')}`);
  process.exit(rep.rows.length ? 1 : 0);
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
    // A responsive scene may render its pager ONLY at phone width (one layout
    // at a time, e.g. FR-2 Today), so look for it at 390px too — otherwise the
    // swipe probe would silently never run.
    if (!scene.pager) {
      const pctx = await browser.newContext(VIEWPORTS.phone);
      const pp = await pctx.newPage();
      await pp.goto(`${BASE}/fr-harness.html?scene=${scene.id}`, { waitUntil: 'networkidle' });
      scene.pager = (await pp.$('[data-testid="swipe-pager-viewport"]')) !== null;
      await pctx.close();
    }
    // viewport: 'desktop' | 'phone' | 'both' | a comma list ('desktop,tablet,phone').
    const vps = scene.viewport === 'both' ? ['desktop', 'phone'] : scene.viewport.split(',');
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
const skipped = rows.filter((r) => r.pass === null).length;
const md = [
  `### FR harness walk — slice ${SLICE} — ${new Date().toISOString().slice(0, 16)}Z`,
  '',
  `${rows.length - failed.length - skipped}/${rows.length - skipped} checks pass${skipped ? ` · ${skipped} skipped (see Detail)` : ''} · screenshots: ${results.filter((r) => r.check === 'screenshot').length} (in \`${OUT}\`)`,
  '',
  '| Scene | Theme | Viewport | Check | Result | Detail |',
  '|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.scene} | ${r.theme} | ${r.vp} | ${r.check} | ${r.pass === null ? 'SKIP' : r.pass ? 'PASS' : '**FAIL**'} | ${String(r.detail).replace(/\|/g, '/').slice(0, 120)} |`),
].join('\n');
writeFileSync(join(OUT, 'summary.md'), md);
console.log(`\n${md}\n\nSummary: ${join(OUT, 'summary.md')}`);
process.exit(failed.length ? 1 : 0);

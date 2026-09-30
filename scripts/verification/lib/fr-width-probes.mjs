/**
 * fr-width-probes — the breakage probes and the width sweep behind
 * `fr-harness-walk.mjs --sweep` (docs/briefs/fr-fit-any-width-kickoff.md § W-1).
 *
 * Every scene renders inside the REAL app shell (`?frame=app`: FrSidebar at
 * 220px ≥1024, the 72px rail at 768–1023, the phone tab bar below 768), so a
 * "1280" window gives the view the ~1000px it gets in the app — not the whole
 * window the frameless walk gives it.
 *
 * Probes (in-page, scoped to [data-scene-root]; each finding names the scene,
 * width, theme, a selector and the element's text):
 *   1 crushed   a text element that wraps to > 2 lines while under 12ch wide,
 *               or whose words stack one per line
 *   2 overflow  a non-scroll element with scrollWidth > clientWidth + 1
 *               (deepest one only — its ancestors overflow because of it), and
 *               any page-level sideways scroll. Form fields (they scroll their
 *               own text) and chart plots (probe 5) are left out.
 *   3 overlap   in-flow visible siblings whose boxes intersect by > 2px
 *   4 clipped   a FIGURE (money, count, date, %) cut by text-overflow: ellipsis
 *   5 chart     a chart plot narrower than 120px, two value labels in one
 *               plot whose painted text collides, a Donut ring squeezed below
 *               its designed size, a ProgressDonut ring below 48px (designed
 *               56 / 84 / 112px), or a Donut legend that overlaps its ring
 */
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

export const SWEEP_WIDTHS = [360, 390, 430, 600, 768, 900, 1024, 1180, 1280, 1366, 1440, 1600, 1920];
/** The app's own shell breakpoint: below it the sidebar is gone and the tab bar shows. */
export const PHONE_BREAKPOINT = 768;
/** Widths that always get a screenshot (the W-2 before/after pairs + a phone). */
export const KEY_WIDTHS = [390, 1024, 1280, 1366];

/** In-page probe. Serialised with toString(), so it must be self-contained. */
export const PROBE = () => {
  const root = document.querySelector('[data-scene-root]');
  const out = [];
  if (!root) return [{ probe: 'harness', selector: '-', text: '', detail: 'no [data-scene-root]' }];
  const canvas = document.createElement('canvas').getContext('2d');

  const cssPath = (el) => {
    const parts = [];
    let n = el;
    for (let i = 0; n && n !== root && i < 4; i += 1, n = n.parentElement) {
      const tid = n.getAttribute('data-testid');
      if (tid) { parts.unshift(`[data-testid="${tid}"]`); break; }
      const cls = typeof n.className === 'string' ? n.className.trim().split(/\s+/).filter((c) => !c.includes(':')).slice(0, 2) : [];
      parts.unshift(`${n.tagName.toLowerCase()}${cls.length ? `.${cls.join('.')}` : ''}`);
    }
    return parts.join(' > ');
  };
  const textOf = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false; // sr-only, collapsed
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05;
  };
  const inPager = (el) => Boolean(el.closest('[data-testid="swipe-pager-viewport"]'));
  const all = [...root.querySelectorAll('*')].filter((el) => !(el instanceof SVGElement) && shown(el));

  // 1 — crushed text
  for (const el of all) {
    const texts = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!texts.length) continue;
    const text = texts.map((t) => t.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (!/[A-Za-z0-9]/.test(text)) continue;
    const tops = [];
    for (const t of texts) {
      const range = document.createRange();
      range.selectNodeContents(t);
      for (const r of range.getClientRects()) {
        if (r.width < 1) continue;
        if (!tops.some((y) => Math.abs(y - r.top) < 3)) tops.push(r.top);
      }
    }
    const lines = tops.length;
    if (lines < 2) continue;
    const cs = getComputedStyle(el);
    canvas.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const ch = canvas.measureText('0').width || parseFloat(cs.fontSize) * 0.55;
    const w = el.getBoundingClientRect().width;
    const words = text.split(' ').length;
    const narrow = lines > 2 && w < 12 * ch;
    const stacked = (words >= 3 && lines >= words) || (words === 2 && lines === 2 && w < 8 * ch);
    if (narrow || stacked) {
      out.push({ probe: 'crushed', selector: cssPath(el), text: textOf(el), detail: `${lines} lines · ${words} words · ${Math.round(w)}px (${(w / ch).toFixed(1)}ch)` });
    }
  }

  // Chart plots (Line <svg>, or the lowest ancestor holding ≥ 2 bars of a bar
  // chart). Bar value labels sit centred over their bar and are allowed to be
  // wider than it; what breaks is two labels hitting each other, so plots are
  // judged by the label-collision check in probe 5, not by probe 2.
  const plots = new Set();
  for (const part of root.querySelectorAll('[data-part="line"],[data-part="value"],[data-part="bar"]')) {
    const kind = part.getAttribute('data-part');
    let plot = kind === 'line' ? part.closest('svg') : part.parentElement;
    while (kind !== 'line' && plot && plot !== root && plot.querySelectorAll(`[data-part="${kind}"]`).length < 2) plot = plot.parentElement;
    if (plot && plot !== root && root.contains(plot)) plots.add(plot);
  }
  const inPlot = (el) => [...plots].some((p) => p !== el && p.contains(el));

  // 2 — overflow (non-scroll containers; deepest only). Form fields scroll
  // their own text, so they are never "overflowing".
  const over = all.filter((el) => {
    if (inPager(el) || inPlot(el)) return false;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return false;
    const cs = getComputedStyle(el);
    if (!['visible', 'hidden', 'clip'].includes(cs.overflowX)) return false;
    if (cs.textOverflow === 'ellipsis') return false; // a truncating label; figures → probe 4
    if (cs.display === 'inline' || el.clientWidth === 0) return false;
    return el.scrollWidth > el.clientWidth + 1;
  });
  for (const el of over) {
    if (over.some((o) => o !== el && el.contains(o))) continue;
    out.push({ probe: 'overflow', selector: cssPath(el), text: textOf(el), detail: `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}` });
  }
  const docW = document.documentElement.scrollWidth;
  if (docW > window.innerWidth + 1) {
    out.push({ probe: 'overflow', selector: 'page', text: '', detail: `page scrolls sideways: scrollWidth ${docW} > window ${window.innerWidth}` });
  }

  // 3 — overlap (in-flow visible siblings)
  // Plain inline boxes are left out: a wrapped inline span's bounding box
  // covers every line it touches, so the next span on its last line would
  // "intersect" it while nothing overlaps on screen.
  const inFlow = (el) => {
    const cs = getComputedStyle(el);
    return ['static', 'relative', 'sticky'].includes(cs.position) && !['contents', 'inline'].includes(cs.display) && !cs.transform.startsWith('matrix(-');
  };
  for (const parent of [root, ...all]) {
    if (inPager(parent)) continue;
    const kids = [...parent.children].filter((k) => !(k instanceof SVGElement) && shown(k) && inFlow(k));
    if (kids.length < 2) continue;
    const boxes = kids.map((k) => k.getBoundingClientRect());
    for (let i = 0; i < kids.length; i += 1) {
      for (let j = i + 1; j < kids.length; j += 1) {
        const a = boxes[i]; const b = boxes[j];
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 2 && iy > 2) {
          out.push({ probe: 'overlap', selector: `${cssPath(kids[i])}  ×  ${cssPath(kids[j])}`, text: `${textOf(kids[i]).slice(0, 30)} × ${textOf(kids[j]).slice(0, 30)}`, detail: `${Math.round(ix)}×${Math.round(iy)}px` });
        }
      }
    }
  }

  // 4 — clipped figure
  const isFigure = (el, text) => {
    if (!/\d/.test(text)) return false;
    const dense = (text.match(/[0-9.,:%/$+\-−–]/g) || []).length / Math.max(1, text.replace(/\s/g, '').length);
    return dense >= 0.4 || getComputedStyle(el).fontVariantNumeric.includes('tabular-nums');
  };
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.textOverflow !== 'ellipsis' || el.scrollWidth <= el.clientWidth + 1) continue;
    const text = textOf(el);
    if (isFigure(el, text)) out.push({ probe: 'clipped', selector: cssPath(el), text, detail: `figure cut: ${el.scrollWidth} > ${el.clientWidth}` });
  }

  // 5 — tiny chart / donut legend on its ring
  // A one-bar chart has no plot width to judge (plots need ≥ 2 bars, above).
  for (const plot of plots) {
    const w = plot.getBoundingClientRect().width;
    if (w > 0 && w < 120) out.push({ probe: 'chart', selector: cssPath(plot), text: textOf(plot.parentElement || plot), detail: `plot ${Math.round(w)}px wide (< 120)` });
    // Label collision: the painted text of two labels in one plot intersects.
    const labels = [];
    for (const el of plot.querySelectorAll('*')) {
      if (el instanceof SVGElement || !shown(el)) continue;
      for (const t of el.childNodes) {
        if (t.nodeType !== 3 || !t.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(t);
        const r = range.getBoundingClientRect();
        if (r.width > 0) labels.push({ el, r, text: t.textContent.trim() });
      }
    }
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        const a = labels[i].r; const b = labels[j].r;
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 1 && iy > 1) {
          out.push({ probe: 'chart', selector: `${cssPath(labels[i].el)}  ×  ${cssPath(labels[j].el)}`, text: `${labels[i].text} × ${labels[j].text}`, detail: `labels collide ${Math.round(ix)}×${Math.round(iy)}px` });
        }
      }
    }
  }
  // A Donut ring has a DESIGNED size (its width attribute); it fails only when
  // the layout squeezes it below that size.
  for (const svg of new Set([...root.querySelectorAll('[data-part="arc"]')].map((a) => a.closest('svg')).filter(Boolean))) {
    const want = parseFloat(svg.getAttribute('width')) || 0;
    const w = svg.getBoundingClientRect().width;
    if (want && w < want * 0.9) out.push({ probe: 'chart', selector: cssPath(svg), text: textOf(svg.parentElement), detail: `donut ${Math.round(w)}px, designed ${want}px` });
  }
  for (const ring of root.querySelectorAll('svg[role="img"][viewBox="0 0 100 100"]')) {
    const w = ring.getBoundingClientRect().width;
    if (w > 0 && w < 48) out.push({ probe: 'chart', selector: cssPath(ring), text: ring.getAttribute('aria-label')?.slice(0, 60) || '', detail: `ring ${Math.round(w)}px (< 48)` });
  }
  for (const wrap of root.querySelectorAll('[role="img"]')) {
    const legend = wrap.nextElementSibling;
    if (!legend || legend.tagName !== 'UL') continue;
    const a = wrap.getBoundingClientRect(); const b = legend.getBoundingClientRect();
    const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ix > 2 && iy > 2) out.push({ probe: 'chart', selector: cssPath(legend), text: textOf(legend), detail: `legend overlaps ring ${Math.round(ix)}×${Math.round(iy)}px` });
  }
  return out;
};

/** Scenes to sweep, and at which widths. A phone-only scene is a phone layout
 * (< 768 only); a desktop-only scene is a ≥ 768 layout; everything else is a
 * real screen that the app can show at any width. */
export function sweepWidthsFor(scene, widths = SWEEP_WIDTHS) {
  const vps = scene.viewport === 'both' ? ['desktop', 'phone'] : scene.viewport.split(',');
  const phone = vps.includes('phone');
  const big = vps.includes('desktop') || vps.includes('tablet');
  if (phone && !big) return widths.filter((w) => w < PHONE_BREAKPOINT);
  if (big && !phone) return widths.filter((w) => w >= PHONE_BREAKPOINT);
  return widths;
}

const settle = (page, ms) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => setTimeout(r, t))), ms);

/**
 * Sweep one scene. Two contexts: a phone one (touch, DPR 2, 844 tall) for
 * widths below the shell breakpoint and a desktop one (900 tall) above it; the
 * page is loaded once per context and RESIZED between widths. Reduced motion
 * is on so entrance motion never sits between a resize and a probe. Themes
 * flip the `dark` class the harness itself sets.
 */
export async function sweepScene(browser, { base, scene, widths, out, shots = 'key' }) {
  const findings = [];
  const groups = [
    { ws: widths.filter((w) => w < PHONE_BREAKPOINT), opts: { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, h: 844 },
    { ws: widths.filter((w) => w >= PHONE_BREAKPOINT), opts: {}, h: 900 },
  ];
  for (const g of groups) {
    if (!g.ws.length) continue;
    const ctx = await browser.newContext({ ...g.opts, viewport: { width: g.ws[0], height: g.h }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(`${base}/fr-harness.html?scene=${scene.id}&frame=app`, { waitUntil: 'networkidle' });
    await settle(page, 400);
    for (const w of g.ws) {
      await page.setViewportSize({ width: w, height: g.h });
      await settle(page, 350);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), theme === 'dark');
        await settle(page, 120);
        const found = await page.evaluate(`(${PROBE.toString()})()`);
        for (const f of found) findings.push({ scene: scene.id, title: scene.title, width: w, theme, ...f });
        const wantShot = shots === 'all' || (shots !== 'none' && (KEY_WIDTHS.includes(w) || found.length > 0));
        if (wantShot) {
          mkdirSync(join(out, scene.id), { recursive: true });
          await page.screenshot({ path: join(out, scene.id, `${w}-${theme}.png`), fullPage: true });
        }
      }
    }
    await ctx.close();
  }
  return findings;
}

/** Collapse light/dark duplicates; group by screen; markdown. */
export function sweepReport(findings, { scenes, widths, stamp, shotsDir }) {
  const key = (f) => `${f.scene}|${f.width}|${f.probe}|${f.selector}|${f.text}`;
  const merged = new Map();
  for (const f of findings) {
    const k = key(f);
    const prev = merged.get(k);
    if (prev) prev.themes.add(f.theme);
    else merged.set(k, { ...f, themes: new Set([f.theme]) });
  }
  const rows = [...merged.values()];
  const byScene = new Map();
  for (const r of rows) {
    if (!byScene.has(r.scene)) byScene.set(r.scene, []);
    byScene.get(r.scene).push(r);
  }
  const cell = (s) => String(s).replace(/\|/g, '/').replace(/\n/g, ' ');
  const counts = ['crushed', 'overflow', 'overlap', 'clipped', 'chart'].map((p) => `${p} ${rows.filter((r) => r.probe === p).length}`).join(' · ');
  const lines = [
    `# FR width sweep — ${stamp}`,
    '',
    `Harness \`?frame=app\` (real FrSidebar / tab bar) · widths ${widths.join(', ')} · light + dark · ${scenes.length} scenes.`,
    '',
    `**${rows.length} findings** (light/dark duplicates merged) · ${counts} · screens with findings: ${byScene.size}/${scenes.length}.`,
    shotsDir ? `\nScreenshots (not committed): \`${shotsDir}\`` : '',
    '',
  ];
  const clean = scenes.filter((s) => !byScene.has(s.id)).map((s) => s.id);
  for (const s of scenes) {
    const list = byScene.get(s.id);
    if (!list) continue;
    list.sort((a, b) => a.width - b.width || a.probe.localeCompare(b.probe));
    const ws = [...new Set(list.map((r) => r.width))].join(', ');
    lines.push(`## ${s.title} (\`${s.id}\`) — ${list.length} · widths ${ws}`, '');
    lines.push('| Width | Theme | Probe | Element | Text | Detail |', '|---|---|---|---|---|---|');
    for (const r of list) {
      lines.push(`| ${r.width} | ${[...r.themes].sort().join('+')} | ${r.probe} | \`${cell(r.selector).slice(0, 110)}\` | ${cell(r.text)} | ${cell(r.detail)} |`);
    }
    lines.push('');
  }
  lines.push(`## Clean at every width (${clean.length})`, '', clean.length ? clean.map((id) => `\`${id}\``).join(' · ') : '(none)', '');
  return { md: lines.join('\n'), rows, byScene };
}

export function writeSweep(outDir, report, findings) {
  writeFileSync(join(outDir, 'sweep.md'), report.md);
  writeFileSync(join(outDir, 'sweep.json'), JSON.stringify(findings, null, 1));
}

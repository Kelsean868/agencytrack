/**
 * a11y-contrast-sweep — runtime contrast sweep, both themes, INCLUDING the
 * states axe does not check.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * `06-DEFECT-CLASSES.md` §1 is the most reliable defect class in the source
 * build: five occurrences of ink on a brand or semantic fill that inverts in
 * dark mode, because `--teal` gets *brighter* (#01696F → #4AB5B8) rather than
 * darker.
 *
 * The worst was a **skip link at 2.44:1**. Its only audience is keyboard users,
 * so the single state it ever renders in was the one that failed — and it
 * survived five review rounds because it is invisible in a screenshot of the
 * default state. That is the whole argument for this file: axe checks neither
 * `:focus-visible` nor `:disabled`, and both are where this defect class hides.
 *
 * ── WHY A BROWSER AND NOT A STATIC SCAN ─────────────────────────────────────
 * A static parse of `src/index.css` was considered and rejected: all five
 * historical defects are Tailwind *utility* ink applied in JSX and composited
 * through CSS custom properties. A CSS-only parse cannot see any of them.
 *
 * ── AUTHENTICATION: EMULATOR, NEVER PRODUCTION ──────────────────────────────
 * Runs against the Firebase **emulator** with a fully synthetic seeded user
 * (`smoke-agent@agencytrack.test`), through the real `firestore.rules`. No real
 * credential is read and no production tenant is touched. This composes three
 * already-proven pieces rather than inventing anything:
 *   · emulator lifecycle + synthetic seed — `emulator-roundtrip-smoke.mjs`
 *   · seeded user through real rules      — `lib/emulator-seed.cjs`
 *   · Playwright login + dark toggle      — `a11y-axe-scan.cjs`
 *
 * Vercel previews are bound to PRODUCTION Firebase (CLAUDE.md § Workflow), so
 * that path is closed to CI by design.
 *
 * ── THE MATHS LIVES IN contrast.js ──────────────────────────────────────────
 * Colours are extracted in-page; every ratio is computed in Node with
 * `src/utils/contrast.js`. One implementation of the WCAG maths, not a second
 * copy that can drift from the token tests.
 *
 * ── MODE ────────────────────────────────────────────────────────────────────
 * REPORTING by default: enumerates failures and exits 0, because pre-existing
 * failures predate this sweep and are not its to fix. `--blocking` flips it.
 * The CI job name states the mode — a gate that is quietly non-blocking is
 * worse than no gate.
 *
 * Usage:
 *   firebase emulators:exec --only auth,firestore --project=demo-agencytrack \
 *     "node scripts/verification/a11y-contrast-sweep.mjs"
 *   node scripts/verification/a11y-contrast-sweep.mjs --blocking
 */

import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio, requiredRatio, isLargeText } from '../../src/utils/contrast.js';

const require = createRequire(import.meta.url);
const { seedSmokeAgent } = require('./lib/emulator-seed.cjs');

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');

const BASE_URL = process.env.A11Y_BASE_URL || 'http://127.0.0.1:4173';
const BLOCKING = process.argv.includes('--blocking');
const SERVER_TIMEOUT_MS = 60_000;

/** Wait for the preview server to answer before driving a browser at it. */
async function waitForServer(url) {
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Preview server never became reachable at ${url}`);
}

/**
 * In-page collector. Returns SERIALISABLE colour pairs — no maths here, so the
 * WCAG implementation stays in contrast.js.
 *
 * The effective background is resolved by walking ancestors and compositing
 * every translucent layer down onto the first opaque one. A dark-mode semantic
 * tint is an alpha wash over the card's own tint, so an element's own
 * `background-color` is very often NOT what its ink actually sits on — reading
 * only the element's own background is how these defects get missed.
 */
const COLLECTOR = `(stateLabel) => {
  const parseRgb = (s) => {
    const m = String(s).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };

  // Returns { rgb } or { indeterminate: reason }. A gradient / image background
  // sets background-IMAGE, so getComputedStyle().backgroundColor reports
  // transparent — walking past it silently measures the ink against whatever
  // opaque ancestor lies beyond, which is how white-on-teal reads as
  // white-on-white at 1.08:1. Reporting "cannot determine" is the honest answer
  // and matches what axe itself does (incomplete, not violation).
  const effectiveBg = (el) => {
    const layers = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const cs2 = getComputedStyle(node);
      if (cs2.backgroundImage && cs2.backgroundImage !== 'none') {
        return { indeterminate: 'background-image/gradient at ' + node.tagName.toLowerCase() };
      }
      const c = parseRgb(cs2.backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
      node = node.parentElement;
    }
    if (!layers.length) return { rgb: [255, 255, 255] };
    let base = layers[layers.length - 1];
    if (base.a < 1) base = { r: 255, g: 255, b: 255, a: 1 };
    let out = [base.r, base.g, base.b];
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const l = layers[i];
      if (l.a >= 1) { out = [l.r, l.g, l.b]; continue; }
      out = [
        Math.round(l.a * l.r + (1 - l.a) * out[0]),
        Math.round(l.a * l.g + (1 - l.a) * out[1]),
        Math.round(l.a * l.b + (1 - l.a) * out[2]),
      ];
    }
    return { rgb: out };
  };

  const describe = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.')
      : '';
    const testid = el.getAttribute('data-testid');
    return el.tagName.toLowerCase() + id + cls + (testid ? '[data-testid=' + testid + ']' : '');
  };

  // Own-text only: a wrapper div inherits its children's text and would be
  // measured against the wrong background.
  const ownText = (el) => Array.from(el.childNodes)
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent.trim())
    .join(' ')
    .trim();

  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const text = ownText(el);
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const fg = parseRgb(cs.color);
    if (!fg) continue;
    const bgResult = effectiveBg(el);
    out.push({
      selector: describe(el),
      text: text.slice(0, 60),
      fg: [fg.r, fg.g, fg.b],
      fgAlpha: fg.a,
      bg: bgResult.rgb || null,
      indeterminate: bgResult.indeterminate || null,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      state: stateLabel,
      disabled: el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true',
    });
  }
  return out;
}`;

/** Measure the default rendered state. */
async function sweepDefault(page, theme, route) {
  return (await page.evaluate(`(${COLLECTOR})('default')`)).map((s) => ({ ...s, theme, route }));
}

/**
 * Measure :focus-visible. THE reason this file exists — the 2.44:1 skip link
 * rendered only in this state, so the default-state screenshot was always clean.
 *
 * Keyboard Tab is used rather than `.focus()` because `:focus-visible` only
 * matches on keyboard interaction; a programmatic focus would silently measure
 * the wrong state and report a false pass.
 */
async function sweepFocusVisible(page, theme, route, maxStops = 25) {
  const found = [];
  await page.evaluate(() => document.body.focus?.());
  for (let i = 0; i < maxStops; i += 1) {
    await page.keyboard.press('Tab');
    const one = await page.evaluate(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      if (!el.matches(':focus-visible')) return null;
      const collect = ${COLLECTOR};
      const all = collect('focus-visible');
      const desc = (e) => {
        const id = e.id ? '#' + e.id : '';
        const cls = (e.className && typeof e.className === 'string')
          ? '.' + e.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
        const t = e.getAttribute('data-testid');
        return e.tagName.toLowerCase() + id + cls + (t ? '[data-testid=' + t + ']' : '');
      };
      const key = desc(el);
      return all.find((s) => s.selector === key) || null;
    })()`);
    if (one) found.push({ ...one, theme, route });
  }
  return found;
}

/** Measure :disabled — the other state axe skips. */
async function sweepDisabled(page, theme, route) {
  const all = await page.evaluate(`(${COLLECTOR})('disabled')`);
  return all.filter((s) => s.disabled).map((s) => ({ ...s, theme, route }));
}

/** Node-side scoring — all maths from contrast.js. */
function score(sample) {
  // Not measurable — see the collector. Excluded from failures rather than
  // scored against a background we know we could not resolve. Counted and
  // reported separately so the gap is visible instead of silently dropped.
  if (sample.indeterminate) return { ...sample, ratio: null, required: null, pass: null };
  const ratio = contrastRatio(sample.fg, sample.bg);
  const required = requiredRatio(sample.fontSize, sample.fontWeight);
  return {
    ...sample,
    ratio: Math.round(ratio * 100) / 100,
    required,
    large: isLargeText(sample.fontSize, sample.fontWeight),
    pass: ratio >= required,
  };
}

async function signIn(page, agent) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', agent.email);
  await page.fill('input[type="password"]', agent.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForSelector('text=Dashboard', { timeout: 20_000 });
}

/**
 * Persist the theme and reload so main.jsx applies the class PRE-MOUNT — the
 * same path a real user takes (no FOUC). Deliberately does not wait on a
 * post-login selector, because this also runs on the unauthenticated route.
 */
async function applyTheme(page, theme) {
  await page.evaluate((t) => {
    if (t === 'dark') localStorage.setItem('agencytrack-dark', '1');
    else localStorage.removeItem('agencytrack-dark');
  }, theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
}

(async () => {
  const startedAt = new Date();
  console.log(`[contrast-sweep] mode: ${BLOCKING ? 'BLOCKING' : 'REPORTING'}`);

  await waitForServer(BASE_URL);
  const agent = await seedSmokeAgent();
  console.log(`[contrast-sweep] seeded synthetic user: ${agent.email} (emulator only)`);

  const browser = await chromium.launch();
  const samples = [];

  try {
    for (const theme of ['light', 'dark']) {
      // A FRESH CONTEXT per theme. Firebase auth persists in IndexedDB, not
      // localStorage, so clearing localStorage between themes leaves the user
      // signed in and the login route redirects straight to the dashboard —
      // silently skipping the unauthenticated sweep for the second theme.
      // Found by running it: the dark pass timed out waiting for the email field.
      const context = await browser.newContext();
      const page = await context.newPage();
      // ── UNAUTHENTICATED: the login route ──────────────────────────────────
      // Swept FIRST and deliberately. The worst historical defect in this class
      // was the skip link at 2.44:1, which lives here and renders only under
      // :focus-visible. It is also where the disabled-submit control lives, so
      // skipping this route leaves `:disabled` unmeasured — and a sweep that
      // measures no disabled element has not covered one of the two states it
      // exists for.
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await applyTheme(page, theme);
      await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
      samples.push(...await sweepDefault(page, theme, 'login'));
      samples.push(...await sweepDisabled(page, theme, 'login'));
      samples.push(...await sweepFocusVisible(page, theme, 'login'));

      // ── AUTHENTICATED: the dashboard ──────────────────────────────────────
      await signIn(page, agent);
      samples.push(...await sweepDefault(page, theme, 'dashboard'));
      samples.push(...await sweepDisabled(page, theme, 'dashboard'));
      samples.push(...await sweepFocusVisible(page, theme, 'dashboard'));

      const n = samples.filter((s) => s.theme === theme).length;
      console.log(`[contrast-sweep] ${theme}: ${n} elements measured (login + dashboard)`);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const scored = samples.map(score);
  const failures = scored.filter((s) => s.pass === false);
  const indeterminate = scored.filter((s) => s.pass === null);
  const byState = (st) => scored.filter((s) => s.state === st).length;

  const report = {
    startedAt: startedAt.toISOString(),
    mode: BLOCKING ? 'blocking' : 'reporting',
    baseUrl: BASE_URL,
    totals: {
      measured: scored.length,
      failures: failures.length,
      indeterminate: indeterminate.length,
      byState: {
        default: byState('default'),
        'focus-visible': byState('focus-visible'),
        disabled: byState('disabled'),
      },
    },
    failures: failures.sort((a, b) => a.ratio - b.ratio),
    indeterminate: indeterminate.map((s) => ({ selector: s.selector, text: s.text, theme: s.theme, state: s.state, reason: s.indeterminate })),
  };

  const outDir = join(ROOT, 'verification', 'a11y');
  mkdirSync(outDir, { recursive: true });
  const stamp = startedAt.toISOString().replace(/[:.]/g, '').slice(0, 15);
  const outPath = join(outDir, `contrast_${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`\n[contrast-sweep] measured ${scored.length} elements `
    + `(default ${byState('default')}, focus-visible ${byState('focus-visible')}, disabled ${byState('disabled')})`);
  console.log(`[contrast-sweep] failures: ${failures.length}`);
  console.log(`[contrast-sweep] indeterminate (gradient/image bg — see hero-pane-foreign-ink-guard): ${indeterminate.length}`);
  for (const f of failures.slice(0, 40)) {
    console.log(`  ✗ [${f.theme}/${f.state}] ${f.ratio}:1 (needs ${f.required}) `
      + `${f.selector} — "${f.text}"`);
  }
  console.log(`[contrast-sweep] report: ${outPath}`);

  if (byState('focus-visible') === 0) {
    console.error('[contrast-sweep] ERROR: zero :focus-visible elements measured — '
      + 'a run that visited no focus state has not tested the thing this sweep exists for.');
    process.exit(1);
  }

  if (BLOCKING && failures.length) process.exit(1);
  process.exit(0);
})().catch((err) => {
  console.error('[contrast-sweep] fatal:', err);
  process.exit(1);
});

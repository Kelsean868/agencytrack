// smoke-scroll-nav.mjs — page-scroll reachability + sidebar-nav layout smoke.
//
// Guards two staging-review defects:
//   D1 — page scroll broken: on some screens content extends below the viewport
//        but no scroller (page / .shell-content / inner card) can reach it.
//   D2 — sidebar nav crowded: long labels wrap to 2 lines; rows overlap.
//
// Method (content-agnostic, so it does not depend on seed volume):
//   For each role, log in, then for every enabled sidebar tab:
//     1. click it, let content settle,
//     2. scroll EVERY scrollable container (+ window + .shell-content) to bottom,
//     3. measure the deepest on-screen content bottom vs the viewport bottom.
//   unreachablePx > threshold  ⇒  D1 BROKEN for that screen.
//   Nav check: measure every .sidebar-link row height; a row taller than the
//   single-line baseline (label wrapped) or vertically overlapping its neighbour
//   ⇒ D2 BROKEN.
//
// Run modes:
//   local repro : node --env-file=.env.local scripts/verification/smoke-scroll-nav.mjs
//   staging     : node --env-file=.env.staging scripts/verification/smoke-scroll-nav.mjs
//                   (SMOKE_BASE_URL=<preview> VERCEL_BYPASS_TOKEN=<tok>)
//
// Env: SMOKE_BASE_URL (default http://localhost:5173), optional VERCEL_BYPASS_TOKEN,
//      SMOKE_THEME (light|dark|both, default light), SHOT_DIR (screenshot output).
//      Role creds, first present wins:
//        BM   : ROLE_BM_EMAIL/PASSWORD    | A11Y_BRANCH_MANAGER_EMAIL/PASSWORD
//        AGENT: ROLE_AGENT_EMAIL/PASSWORD | A11Y_AGENT_EMAIL/PASSWORD

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { loginAs, setupBypassSession, setTheme } from './lib/walk-helpers.mjs';

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const TOKEN = process.env.VERCEL_BYPASS_TOKEN || null;
const THEME = process.env.SMOKE_THEME || 'light';
const SHOT_DIR = process.env.SHOT_DIR
  || path.join(process.env.TEMP || '/tmp', 'scroll-nav-shots');
const VIEWPORT_W = Number(process.env.VIEWPORT_W || 1440);
const VIEWPORT_H = Number(process.env.VIEWPORT_H || 900);  // shrink (e.g. 560) to stress page-scroll data-independently
const UNREACHABLE_PX = 24;   // slack below the fold that still counts as "reachable"
const ROW_WRAP_PX = 40;      // a single-line sidebar row is ~38px; taller ⇒ wrapped
const ROW_OVERLAP_PX = 2;    // vertical overlap between adjacent rows

mkdirSync(SHOT_DIR, { recursive: true });

// Account resolution. SMOKE_ACCOUNTS=staging uses the seeded staging accounts
// (all share STAGING_SEED_PASSWORD — read from env, never a command line). Else
// falls back to per-role ROLE_*/A11Y_* creds (local repro against prod Firebase).
const STAGING = process.env.SMOKE_ACCOUNTS === 'staging';
const STAGING_PW = process.env.STAGING_SEED_PASSWORD;
const cred = (a, b, stagingEmail) => ({
  email: process.env[`${a}_EMAIL`] || process.env[`${b}_EMAIL`] || (STAGING ? stagingEmail : undefined),
  password: process.env[`${a}_PASSWORD`] || process.env[`${b}_PASSWORD`] || (STAGING ? STAGING_PW : undefined),
});
const ROLES = [
  { key: 'branch_manager', ...cred('ROLE_BM', 'A11Y_BRANCH_MANAGER', 'staging-branch-manager@agencytrack-staging.test') },
  { key: 'agent', ...cred('ROLE_AGENT', 'A11Y_AGENT', 'staging-agent-1@agencytrack-staging.test') },
];

// Sidebar links that leave the shell (overlays / fullscreen) — not page-scroll surfaces.
const SKIP_LABELS = [/^weekly report$/i, /^daily log$/i, /^meetings?$/i, /^kiosk mode$/i];

const themes = THEME === 'both' ? ['light', 'dark'] : [THEME];
const results = [];
let anyFail = false;

// ── the in-page measurement (D1) ────────────────────────────────────────────
async function measureScroll(page) {
  return page.evaluate(() => {
    const sc = document.querySelector('.shell-content');
    // Scroll every scrollable container + window + shell-content to the bottom so
    // a legit inner-scroll card is NOT mis-flagged; only genuine clips remain.
    document.querySelectorAll('*').forEach((el) => {
      if (el.scrollHeight - el.clientHeight > 4) el.scrollTop = el.scrollHeight;
    });
    window.scrollTo(0, document.documentElement.scrollHeight);
    if (sc) sc.scrollTop = sc.scrollHeight;

    const vh = window.innerHeight;
    const root = sc || document.body;
    let maxBottom = -Infinity;
    let deepest = '';
    root.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      const t = (el.textContent || '').trim();
      if (r.width > 0 && r.height > 0 && t && el.children.length === 0) {
        if (r.bottom > maxBottom) { maxBottom = r.bottom; deepest = t.slice(0, 40); }
      }
    });
    // Clip audit: any element whose content is meaningfully taller than its box
    // while overflow-y is hidden/clip (or overflow-x set with no y-scroll) — a
    // genuine unreachable clip, independent of whether the page can scroll.
    const clips = [];
    (sc || document.body).querySelectorAll('*').forEach((el) => {
      const st = getComputedStyle(el);
      const clipped = ['hidden', 'clip'].includes(st.overflowY);
      const over = el.scrollHeight - el.clientHeight;
      if (clipped && over > 24 && el.clientHeight > 0) {
        clips.push({ cls: (el.className || el.tagName).toString().slice(0, 60), hiddenPx: over, h: el.clientHeight });
      }
    });
    const cs = sc ? getComputedStyle(sc) : null;
    return {
      clips: clips.slice(0, 6),
      hasShellContent: !!sc,
      scScrollH: sc ? sc.scrollHeight : null,
      scClientH: sc ? sc.clientHeight : null,
      scOverflowY: cs ? cs.overflowY : null,
      pageScrollable: document.documentElement.scrollHeight - vh,
      shellScrollable: sc ? sc.scrollHeight - sc.clientHeight : null,
      viewportH: vh,
      maxContentBottom: Math.round(maxBottom),
      unreachablePx: Math.round(maxBottom - vh),
      deepest,
    };
  });
}

// ── real wheel-scroll probe — the D1 CORE check ─────────────────────────────
// The staging bug: content is reachable programmatically (scrollTop / scrollbar
// drag) but the mouse wheel + trackpad are SWALLOWED. A programmatic reachability
// check (scrollTo) passes right through it — so we must dispatch a REAL wheel over
// the content pane and confirm the scroll position actually moved.
async function wheelProbe(page) {
  await page.evaluate(() => { const sc = document.querySelector('.shell-content'); if (sc) sc.scrollTop = 0; window.scrollTo(0, 0); });
  const before = await page.evaluate(() => {
    const sc = document.querySelector('.shell-content');
    return {
      scScrollable: sc ? sc.scrollHeight - sc.clientHeight : 0,
      pageScrollable: document.documentElement.scrollHeight - window.innerHeight,
    };
  });
  const scrollableBy = Math.max(before.scScrollable, before.pageScrollable);
  if (scrollableBy <= 40) return { scrollableBy, wheelMoved: 0, wheelOk: true }; // nothing to scroll — not a defect
  await page.mouse.move(Math.round(VIEWPORT_W * 0.62), Math.round(VIEWPORT_H * 0.5)); // over the content pane
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(250);
  const moved = await page.evaluate(() => {
    const sc = document.querySelector('.shell-content');
    return Math.round((sc ? sc.scrollTop : 0) + window.scrollY);
  });
  return { scrollableBy, wheelMoved: moved, wheelOk: moved > 40 };
}

// One screen: real wheel probe (primary) + programmatic reachability + clip audit
// (diagnostic). Returns a result row. Shared by the sidebar-tab + footer loops.
async function checkScreen(page, role, theme, label) {
  const w = await wheelProbe(page);
  const m = await measureScroll(page);
  await page.evaluate(() => { const sc = document.querySelector('.shell-content'); if (sc) sc.scrollTop = 0; window.scrollTo(0, 0); });
  const broken = !w.wheelOk || m.unreachablePx > UNREACHABLE_PX;
  if (process.env.SHOT_ALL) {
    await page.screenshot({ path: path.join(SHOT_DIR, `screen-${role}-${theme}-${label.replace(/\W+/g, '_') || 'x'}.png`) }).catch(() => {});
  }
  let shot;
  if (broken) {
    shot = path.join(SHOT_DIR, `broken-${role}-${theme}-${label.replace(/\W+/g, '_')}.png`);
    await page.screenshot({ path: shot }).catch(() => {});
  }
  return { kind: 'scroll', role, theme, label, ...m, ...w, shot, verdict: broken ? 'BROKEN' : 'ok' };
}

// ── enumerate the currently-rendered sidebar tabs ───────────────────────────
async function readSidebar(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('.sidebar .sidebar-link')];
    return rows.map((btn, i) => {
      const label = btn.querySelector('span')?.textContent?.trim() || '';
      const r = btn.getBoundingClientRect();
      const disabled = btn.classList.contains('sidebar-link-disabled')
        || btn.getAttribute('aria-disabled') === 'true';
      return { i, label, height: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), disabled };
    });
  });
}

// Click a sidebar tab by exact label via a real DOM click event (fires React's
// onClick without Playwright actionability waits — reliable on slow deploys).
async function clickNav(page, label) {
  return page.evaluate((lbl) => {
    const links = [...document.querySelectorAll('.sidebar .sidebar-link')];
    const el = links.find((b) => (b.querySelector('span')?.textContent || '').trim() === lbl);
    if (!el) return false;
    el.click();
    return true;
  }, label);
}

async function run() {
  const browser = await chromium.launch();
  try {
    for (const theme of themes) {
      for (const role of ROLES) {
        if (!role.email || !role.password) {
          console.log(`SKIP ${role.key} (${theme}) — creds absent`);
          continue;
        }
        const context = await browser.newContext({ viewport: { width: VIEWPORT_W, height: VIEWPORT_H } });
        if (TOKEN && /vercel\.app/.test(BASE)) await setupBypassSession(context, BASE, TOKEN);
        const page = await context.newPage();
        await loginAs(page, BASE, role.email, role.password);
        if (theme !== 'light') await setTheme(context, theme);
        await page.waitForTimeout(500);

        // ── D2 nav layout check ──────────────────────────────────────────────
        const nav = await readSidebar(page);
        const wrapped = nav.filter((r) => !r.disabled && r.height > ROW_WRAP_PX);
        let overlaps = 0;
        const sorted = [...nav].sort((a, b) => a.top - b.top);
        for (let k = 1; k < sorted.length; k++) {
          if (sorted[k].top < sorted[k - 1].bottom - ROW_OVERLAP_PX) overlaps++;
        }
        const navShot = path.join(SHOT_DIR, `nav-${role.key}-${theme}.png`);
        await page.locator('.sidebar').screenshot({ path: navShot }).catch(() => {});
        const navFail = wrapped.length > 0 || overlaps > 0;
        if (navFail) anyFail = true;
        results.push({
          kind: 'nav', role: role.key, theme, tabs: nav.length,
          wrappedLabels: wrapped.map((w) => `${w.label}(${w.height}px)`), overlaps,
          verdict: navFail ? 'BROKEN' : 'ok', shot: navShot,
        });

        // ── D1 per-tab scroll check ──────────────────────────────────────────
        const seen = new Set();
        for (const row of nav) {
          if (row.disabled || SKIP_LABELS.some((re) => re.test(row.label))) continue;
          if (seen.has(row.label)) continue;   // pinned-zone dupes render the same screen
          seen.add(row.label);
          const clicked = await clickNav(page, row.label);
          if (!clicked) { results.push({ kind: 'scroll', role: role.key, theme, label: row.label, verdict: 'skip(not-found)' }); continue; }
          await page.waitForTimeout(1100);
          // overlay detection — if the shell vanished, reset and skip
          const hasShell = await page.locator('.shell-content').count();
          if (!hasShell) {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(400);
            results.push({ kind: 'scroll', role: role.key, theme, label: row.label, verdict: 'skip(overlay)' });
            continue;
          }
          const res = await checkScreen(page, role.key, theme, row.label);
          if (res.verdict === 'BROKEN') anyFail = true;
          results.push(res);
        }

        // Footer-reached screens (Profile, Settings) — not sidebar tabs.
        for (const [label, sel] of [['Profile', '.sidebar-foot-avatar'], ['Settings', '.sidebar-foot-action.is-settings']]) {
          const ok = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);
          if (!ok) { results.push({ kind: 'scroll', role: role.key, theme, label, verdict: 'skip(not-found)' }); continue; }
          await page.waitForTimeout(1100);
          if (!(await page.locator('.shell-content').count())) continue;
          const res = await checkScreen(page, role.key, theme, label);
          if (res.verdict === 'BROKEN') anyFail = true;
          results.push(res);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  // ── report ─────────────────────────────────────────────────────────────────
  console.log(`\n=== smoke-scroll-nav @ ${BASE} (themes: ${themes.join(',')}) ===`);
  for (const r of results) {
    if (r.kind === 'nav') {
      console.log(`\n[NAV ${r.verdict}] ${r.role}/${r.theme} — ${r.tabs} tabs, overlaps=${r.overlaps}, wrapped=[${r.wrappedLabels.join(', ')}]`);
    } else if (r.verdict?.startsWith('skip')) {
      console.log(`  · ${r.role}/${r.theme} ${r.label.padEnd(22)} ${r.verdict}`);
    } else {
      const tag = r.verdict === 'BROKEN' ? 'BROKEN' : 'ok    ';
      const wheelStr = r.scrollableBy > 40 ? `wheelMoved=${String(r.wheelMoved).padStart(4)}/${r.scrollableBy}px` : 'wheel=n/a(fits)  ';
      const clipStr = r.clips && r.clips.length ? `  CLIPS=[${r.clips.map((c) => `${c.cls}:${c.hiddenPx}px`).join(' | ')}]` : '';
      console.log(`  ${tag} ${r.role}/${r.theme} ${r.label.padEnd(22)} ${wheelStr}  unreachable=${String(r.unreachablePx).padStart(5)}px${clipStr}${r.shot ? '  → ' + path.basename(r.shot) : ''}`);
    }
  }
  const brokenScroll = results.filter((r) => r.kind === 'scroll' && r.verdict === 'BROKEN');
  const brokenNav = results.filter((r) => r.kind === 'nav' && r.verdict === 'BROKEN');
  console.log(`\n=== SUMMARY: ${brokenScroll.length} broken-scroll screen(s), ${brokenNav.length} broken-nav render(s) ===`);
  console.log(`Screenshots: ${SHOT_DIR}`);
  process.exit(anyFail ? 1 : 0);
}

run().catch((e) => { console.error('smoke crashed:', e); process.exit(2); });

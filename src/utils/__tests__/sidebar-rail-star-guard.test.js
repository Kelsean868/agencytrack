/**
 * Sidebar Rail Star Guard
 *
 * Static CSS-scan test. Both 72px icon-rail layouts — the tablet breakpoint
 * (768–1023px) and the desktop collapsed rail (≥1024px + html.sidebar-collapsed)
 * — MUST hide `.sidebar-nav-star`.
 *
 * Why: in a 72px rail the nav row is 56px wide (72 − 2×8px padding) while the
 * star is `position:absolute; right:2px; width:44px; z-index:1` — it covers
 * x=10→54, i.e. 79% of the row INCLUDING the row centre (x=28). If it renders
 * there it swallows every sidebar nav click: a pinned row unpins instead of
 * navigating, and an unpinned row's star is `opacity:0` but still hit-testable
 * (opacity does not remove pointer events) so it pins instead of navigating.
 * The expanded 232px sidebar is unaffected (row 208px, star x=162→206, centre
 * x=104 — no overlap), which is why the bug was invisible at desktop widths.
 *
 * Banked 2026-07-24 (Run A Tier 3 fix branch). The tablet block dropped this
 * selector when it was copied from the collapsed-desktop rule while its comment
 * claimed "Same hide-list as the collapsed desktop rule"; the Run-A planner
 * smokes at 900×800 caught it — 7 smokes failed with "click intercepted by …
 * aria-label='Unpin Planner'".
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
// Comments are STRIPPED before any analysis: this file's own explanatory comments
// (and the ones in index.css) mention `.sidebar-nav-star`, and a comment sitting
// inside a selector list would otherwise satisfy the selector regex below —
// making the guard unable to fail. Verified with a revert-the-fix control.
const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Body of the @media block starting at `start` (brace-matched). */
function blockBodyAt(start) {
  const open = css.indexOf('{', start);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
}

/** Bodies of EVERY @media block whose condition matches `re` (the file has several
 *  `min-width: 1024px` blocks, so callers must consider all of them). */
function mediaBlocks(re) {
  const out = [];
  const rx = new RegExp(re.source, `${re.flags.replace('g', '')}g`);
  let m;
  while ((m = rx.exec(css)) !== null) {
    const body = blockBodyAt(m.index);
    if (body) out.push(body);
  }
  return out;
}

/** Body of the FIRST @media block whose condition matches `re`. */
function mediaBlock(re) {
  return mediaBlocks(re)[0] ?? null;
}

/** True when `body` contains a `display:none` rule whose selector list includes `.sidebar-nav-star`. */
function hidesNavStar(body) {
  // Split into declarations blocks: `<selectors> { <decls> }`
  const rules = body.match(/[^{}]+\{[^{}]*\}/g) || [];
  return rules.some((rule) => {
    const [selectors, decls] = rule.split('{');
    if (!/\.sidebar-nav-star\b/.test(selectors)) return false;
    return /display\s*:\s*none/.test(decls);
  });
}

describe('sidebar 72px rail — pin star must not overlay the nav link', () => {
  it('the TABLET rail (768–1023px) hides .sidebar-nav-star', () => {
    const body = mediaBlock(/@media\s*\(min-width:\s*768px\)\s*and\s*\(max-width:\s*1023px\)/);
    expect(body, 'tablet @media block not found in src/index.css').toBeTruthy();
    expect(
      hidesNavStar(body),
      'The 768–1023px rail must include .sidebar-nav-star in its display:none hide-list — '
      + 'otherwise the 44px star covers the 56px nav row centre and intercepts every nav click.',
    ).toBe(true);
  });

  it('the desktop COLLAPSED rail (html.sidebar-collapsed) hides .sidebar-nav-star', () => {
    // The collapsed rules live in a ≥1024px block scoped by .sidebar-collapsed —
    // the file has several min-width:1024px blocks, so check them all.
    const bodies = mediaBlocks(/@media\s*\(min-width:\s*1024px\)/);
    expect(bodies.length, 'no ≥1024px @media block found in src/index.css').toBeGreaterThan(0);
    const guarded = bodies.some(
      (b) => /\.sidebar-collapsed\s+\.sidebar-nav-star/.test(b) && hidesNavStar(b),
    );
    expect(
      guarded,
      'The collapsed desktop rail must keep .sidebar-nav-star in its display:none hide-list.',
    ).toBe(true);
  });

  it('the star geometry that makes this necessary is unchanged (44px wide, right-anchored, absolute)', () => {
    // If these values change, re-derive the overlap math in this file's header.
    const rule = css.match(/\.sidebar-nav-star\s*\{[^}]*\}/);
    expect(rule, '.sidebar-nav-star rule not found').toBeTruthy();
    expect(rule[0]).toMatch(/position:\s*absolute/);
    expect(rule[0]).toMatch(/width:\s*44px/);
    expect(rule[0]).toMatch(/right:\s*2px/);
  });
});

/**
 * Dark-Ink Static Guard — `dark:text-primary-dark`-as-text ban
 *
 * Static source-scan test, sibling to hero-pane-foreign-ink-guard.test.js.
 * A NEW dedicated test (rather than an extension of the hero guard) because the
 * hero guard is per-component and `.glass.hero`-scoped (curated component list,
 * marker extraction, hero-ink token semantics), while this rule is repo-wide
 * and surface-agnostic: `dark:text-primary-dark` used as a TEXT color is wrong
 * on (almost) every dark surface, not just hero panes.
 *
 * Why the pattern is banned: in dark mode `--primary-dark-channels` resolves to
 * 1 105 111 (#01696f — the button-BACKGROUND-intended token, see index.css
 * .dark block), so `dark:text-primary-dark` as text renders un-lifted teal at
 * 1.75–2.50:1 on the dark card family — an automatic AA failure. Bare
 * `text-primary` already lifts to #4ab5b8 in dark (4.63–6.61:1 on the same
 * backgrounds). The fix is always to DELETE the dark override, never to add
 * one. `dark:bg-primary-dark` button BACKGROUNDS are the D6-legitimate pattern
 * and are not matched by this guard.
 *
 * Allowlist: persistent-light-background elements INVERT the math — on a
 * `bg-white` surface (white in both themes) #01696f passes 6.46:1 while the
 * lifted #4ab5b8 would FAIL at 2.44:1, so the dark override is contrast-CORRECT
 * there (the Tailwind-class twin of the `.role-hero` white-pill CSS pattern
 * documented in index.css). Each allowlist entry must keep carrying the pattern
 * (stale entries fail the suite) and its inversion is math-locked below.
 *
 * Banked from the repo-wide dark-ink sweep (FU of PR #773, 2026-07-02).
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, relative, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { contrastRatio, composite } from '../contrast.js';

// ESM-safe project root (this file lives at src/utils/__tests__/).
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SRC = resolve(ROOT, 'src');

// The anti-pattern: `dark:` (with any extra variant chain, e.g. dark:hover:)
// applied to `text-primary-dark`. Does NOT match `dark:bg-primary-dark`
// (D6-legitimate button backgrounds), bare `text-primary-dark` (a light-mode
// color, e.g. DerivedIncomePanel), or light-mode `hover:text-primary-dark`.
const DARK_INK_AS_TEXT = /\bdark:(?:[a-z-]+:)*text-primary-dark\b/;

// Sites where the dark override is contrast-CORRECT (persistent-light
// backgrounds — see header). Paths are POSIX-style, relative to repo root.
const ALLOWLIST = new Set([
  // bg-white CTA button inside the teal .role-hero card; white in both themes.
  // #01696f on white = 6.46:1 PASS; lifted #4ab5b8 on white = 2.44:1 FAIL.
  'src/components/dashboard/NewAgentEmptyState.jsx',
]);

// Recursively collect scannable source files under src/ (components, utils,
// hooks, ...), excluding tests and mocks.
function collectSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      collectSourceFiles(full, out);
    } else if (/\.(jsx|js)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = collectSourceFiles(SRC);
const posixRel = (f) => relative(ROOT, f).split('\\').join('/');

describe('Dark-ink static guard — dark:text-primary-dark as text is banned repo-wide', () => {
  it('scans a non-trivial source tree (sanity)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no non-allowlisted source file uses dark:text-primary-dark as a text color', () => {
    const offenders = files
      .filter((f) => !ALLOWLIST.has(posixRel(f)))
      .filter((f) => DARK_INK_AS_TEXT.test(readFileSync(f, 'utf-8')))
      .map(posixRel);

    expect(
      offenders,
      `dark:text-primary-dark used as a TEXT color (renders un-lifted #01696f at ` +
        `~2.2-2.5:1 on dark surfaces — AA fail):\n` +
        offenders.map((f) => `  ❌ ${f}`).join('\n') +
        `\nFix: DELETE the dark:text-primary-dark override and keep bare text-primary ` +
        `(lifts to #4ab5b8 in dark). Never add a dark text variant. ` +
        `dark:bg-primary-dark button backgrounds are legitimate (D6) and unaffected. ` +
        `Only a persistent-light-background element (bg-white in both themes) may be ` +
        `allowlisted here, with the inversion math locked below.`,
    ).toEqual([]);
  });

  it('every allowlist entry still carries the pattern (no stale entries)', () => {
    const stale = [...ALLOWLIST].filter((rel) => {
      const full = resolve(ROOT, rel);
      let src;
      try {
        src = readFileSync(full, 'utf-8');
      } catch {
        return true; // file gone → stale
      }
      return !DARK_INK_AS_TEXT.test(src);
    });
    expect(
      stale,
      `Allowlist entries no longer carrying dark:text-primary-dark — remove them:\n` +
        stale.map((f) => `  ❌ ${f}`).join('\n'),
    ).toEqual([]);
  });
});

// ── Deterministic math locks (executed proof, same basis as contrast.test.js) ──
//
// Token values mirror src/index.css:
//   .dark --primary-channels:      74 181 184  (#4ab5b8 — bare text-primary in dark)
//   .dark --primary-dark-channels:  1 105 111  (#01696f — text-primary-dark in dark)
//   .dark --color-surface:         #252019 [37,32,25]
//   .dark --color-surface-raised:  #302a23 [48,42,35]
// If a token changes, update both here and there (same contract as glassPair()).

const LIFTED = [74, 181, 184]; // dark bare text-primary (post-sweep render)
const UNLIFTED = [1, 105, 111]; // dark text-primary-dark (the removed override)
const CARD = [37, 32, 25];
const RAISED = [48, 42, 35];
const WHITE = [255, 255, 255];

// Effective dark backgrounds of the swept sites (Phase 0.3 table of the sweep PR).
const SWEPT_DARK_BACKGROUNDS = {
  'card #252019': CARD,
  'card-raised #302a23': RAISED,
  'bg-primary/10 over card': composite(LIFTED, 0.1, CARD),
  'dark:bg-primary-dark/10 over card': composite(UNLIFTED, 0.1, CARD),
  'dark:bg-primary-dark/15 over card': composite(UNLIFTED, 0.15, CARD),
  'dark:bg-primary/20 over card': composite(LIFTED, 0.2, CARD),
};

describe('Dark-ink math locks — sweep replacement passes, removed override failed', () => {
  for (const [name, bg] of Object.entries(SWEPT_DARK_BACKGROUNDS)) {
    it(`bare text-primary (dark #4ab5b8) >= 4.5:1 on ${name}`, () => {
      expect(contrastRatio(LIFTED, bg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`removed dark:text-primary-dark (#01696f) was < 4.5:1 on ${name}`, () => {
      expect(contrastRatio(UNLIFTED, bg)).toBeLessThan(4.5);
    });
  }

  // The allowlist inversion: on persistent white, the dark override is the
  // PASSING color and the sweep replacement would be the failure.
  it('allowlist inversion: #01696f on bg-white passes AA; lifted #4ab5b8 would fail', () => {
    expect(contrastRatio(UNLIFTED, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIFTED, WHITE)).toBeLessThan(4.5);
  });
});

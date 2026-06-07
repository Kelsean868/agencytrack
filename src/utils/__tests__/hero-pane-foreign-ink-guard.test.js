/**
 * Hero Pane Foreign-Ink Guard
 *
 * Static source-scan test. For every component that renders a `.glass.hero`
 * pane, asserts:
 *   1. All text-[--{css-var}] classes reference a certified hero ink variable.
 *   2. No raw status-color class (text-success, text-danger, text-warning,
 *      text-primary, text-ink-faint) appears anywhere in the file — these are
 *      always wrong on a glass pane (islands use the -ink suffix variants or
 *      hero-dot tokens for hue; values use hero-ink).
 *
 * Why static rather than runtime: glass compositing means runtime axe cannot
 * reliably compute contrast on these surfaces (reports "incomplete" not
 * "violation"). This guard is the certifier alongside the contrast.test.js
 * heroPair() ratio matrix.
 *
 * Banked 2026-06-06 (PR #518 fix-branch, dispatcher S2-hero ink defect report).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM-safe project root (avoids `process.cwd()` which is not in browser globals)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// Certified hero ink CSS variable names (the part after `--` in the token).
// All text-[--{var}] occurrences in hero components must be from this set.
// Gold is reserved (unused by design, operator verdict 2026-06-06) but remains
// certified to allow future reinstatement without a guard edit.
const HERO_INK_VARS = new Set([
  'hero-ink',
  'hero-ink-muted-teal',
  'hero-ink-muted-gold',
  'hero-accent',
]);

// Raw status-color text classes that must NEVER appear in a hero component.
// Islands use text-{status}-ink (reads against the island's own bg) or the
// hero-dot token for hue (with hero-ink for the value). The raw forms appear
// directly on the glass and fail contrast.
//
// Negative lookaheads prevent false-positives on the -ink suffix variants:
//   text-success-ink   → allowed (island-internal)
//   text-success       → forbidden (on glass = fail)
const FORBIDDEN_PATTERNS = [
  { label: 'text-success (use hero-dot-success + hero-ink)', re: /\btext-success\b(?!-ink)/ },
  { label: 'text-warning (use hero-dot-warning + hero-ink)',  re: /\btext-warning\b(?!-ink)/ },
  { label: 'text-danger (use hero-dot-danger + hero-ink)',    re: /\btext-danger\b(?!-ink)/ },
  { label: 'text-primary (use hero tokens)',                  re: /\btext-primary\b(?!-dark)/ },
  { label: 'text-ink-faint (banned globally — D5)',           re: /\btext-ink-faint\b/ },
];

const HERO_COMPONENTS = [
  {
    name: 'CommissionAnchorStrip',
    path: 'src/components/agent/CommissionAnchorStrip.jsx',
  },
  {
    name: 'SuggestedWeekCard',
    path: 'src/components/dashboard/GamePlanV2/SuggestedWeekCard.jsx',
  },
  {
    name: 'PersRealityBar',
    path: 'src/components/manager/PersRealityBar.jsx',
  },
];

describe('Hero pane foreign-ink guard', () => {
  for (const { name, path } of HERO_COMPONENTS) {
    const fullPath = resolve(ROOT, path);
    let src;
    try {
      src = readFileSync(fullPath, 'utf-8');
    } catch {
      throw new Error(`Cannot read hero component: ${path}`);
    }

    it(`${name} renders a .glass.hero pane`, () => {
      expect(src).toMatch(/\bglass\s+hero\s+(teal|gold)\b/);
    });

    it(`${name}: every text-[--var] class uses a certified hero ink variable`, () => {
      // Match text-[--{varName}] — captures the varName after `--`
      const matches = [...src.matchAll(/\btext-\[--([^\]]+)\]/g)];
      const foreignVars = matches
        .map((m) => m[1])
        .filter((varName) => !HERO_INK_VARS.has(varName));

      expect(
        foreignVars,
        `${name} uses non-certified CSS vars in text classes: ${foreignVars.map((v) => `--${v}`).join(', ')}\n` +
          `Certified set: ${[...HERO_INK_VARS].map((v) => `--${v}`).join(', ')}`,
      ).toEqual([]);
    });

    it(`${name}: no forbidden raw status-color text class`, () => {
      const violations = FORBIDDEN_PATTERNS.filter(({ re }) => re.test(src)).map(
        ({ label }) => label,
      );

      expect(
        violations,
        `${name} contains forbidden color class(es):\n${violations.map((l) => `  ❌ ${l}`).join('\n')}`,
      ).toEqual([]);
    });
  }
});

// ── Inverse guard: card-context branches must not leak hero-ink tokens ─────────
//
// Hero components that render dual-state (glass.hero state + card state) mark their
// card-only branches with @@card-context-start / @@card-context-end comments.
// This scan extracts those blocks and asserts that no hero-tier token (hero-chip bg,
// hero-chip border, hero-ink text) appears inside — ensuring card-context render
// paths use card-tier inks only.
//
// Banked 2026-06-06 (G-1 trace: CommissionAnchorStrip no-goal state rendered hero-ink
// Chips outside .glass.hero; fix + this inverse guard together close the gap).
// ──────────────────────────────────────────────────────────────────────────────────

const CARD_CONTEXT_COMPONENTS = [
  {
    name: 'CommissionAnchorStrip (no-goal card state)',
    path: 'src/components/agent/CommissionAnchorStrip.jsx',
    startMarker: '// @@card-context-start',
    endMarker:   '// @@card-context-end',
  },
];

// Hero-tier token patterns that must NOT appear inside a card-context block.
const HERO_TOKEN_PATTERNS = [
  { label: 'bg-[--hero-chip-island] (use bg-surface-raised in card context)',   re: /\bbg-\[--hero-chip-island\]/ },
  { label: 'border-[--hero-chip-border] (use border-border in card context)',   re: /\bborder-\[--hero-chip-border\]/ },
  { label: 'text-[--hero-ink*] (use text-ink / text-ink-muted in card context)', re: /\btext-\[--hero-ink/ },
];

describe('Hero-ink inverse guard — card-context branches', () => {
  for (const { name, path, startMarker, endMarker } of CARD_CONTEXT_COMPONENTS) {
    it(`${name}: no hero-ink tokens in @@card-context block`, () => {
      const fullPath = resolve(ROOT, path);
      const src = readFileSync(fullPath, 'utf-8');

      const startIdx = src.indexOf(startMarker);
      const endIdx   = src.indexOf(endMarker);

      expect(startIdx, `${name}: missing @@card-context-start marker`).toBeGreaterThanOrEqual(0);
      expect(endIdx,   `${name}: missing @@card-context-end marker`).toBeGreaterThan(startIdx);

      const block = src.slice(startIdx, endIdx + endMarker.length);
      const violations = HERO_TOKEN_PATTERNS
        .filter(({ re }) => re.test(block))
        .map(({ label }) => label);

      expect(
        violations,
        `${name} @@card-context block leaks hero-tier token(s):\n` +
          violations.map((l) => `  ❌ ${l}`).join('\n'),
      ).toEqual([]);
    });
  }
});

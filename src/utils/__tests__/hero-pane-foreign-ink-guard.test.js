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
  // No (?!-dark) exemption: text-primary-dark as hero text is equally foreign
  // (dark-ink sweep FU — the dark:text-primary-dark-as-text anti-pattern; the
  // repo-wide ban lives in dark-ink-static-guard.test.js).
  { label: 'text-primary (any variant — use hero tokens)',    re: /\btext-primary\b/ },
  { label: 'text-ink-faint (banned globally — D5)',           re: /\btext-ink-faint\b/ },
];

// Optional startMarker/endMarker fields: when set, the guard extracts only the
// bracketed hero-pane block from the source file before running checks. This lets
// mixed files (hero pane + non-hero sections) participate in the guard without
// false-positives from non-hero code that legitimately uses text-primary, etc.
// Markers must be present in the source file — guard tests will fail if missing.
const HERO_COMPONENTS = [
  // ── S1/S2 originals — whole-file scan (entire component is the hero pane) ──
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
  // ── S3 sweep — PR #534: whole-component files ──────────────────────────────
  {
    name: 'HeroCard (Agent Dashboard YTD)',
    path: 'src/components/dashboard/HomeV2/HeroCard.jsx',
  },
  {
    name: 'PipelineStrip (Policy Ledger)',
    path: 'src/components/agent/policyLedger/PipelineStrip.jsx',
  },
  // (ManagerHeroSection removed Run A Tier 1 §7 — orphaned dead code, deleted.)
  // ── S3 sweep — PR #534: mixed files with @@hero-pane-start/end markers ─────
  // Guard scans only the extracted hero block; non-hero sections are not scanned.
  {
    name: 'HistoryAnchorStrip (HistoryTab)',
    path: 'src/components/submissions/HistoryTab.jsx',
    startMarker: '// @@hero-pane-start',
    endMarker:   '// @@hero-pane-end',
  },
  {
    name: 'AgentProductionView hero section',
    path: 'src/components/productionReport/AgentProductionView.jsx',
    startMarker: '{/* @@hero-pane-start */}',
    endMarker:   '{/* @@hero-pane-end */}',
  },
  {
    name: 'PersistencyTab hero section',
    path: 'src/components/agent/PersistencyTab.jsx',
    startMarker: '{/* @@hero-pane-start */}',
    endMarker:   '{/* @@hero-pane-end */}',
  },
  {
    name: 'BranchManagerProductionView hero section',
    path: 'src/components/productionReport/BranchManagerProductionView.jsx',
    startMarker: '{/* @@hero-pane-start */}',
    endMarker:   '{/* @@hero-pane-end */}',
  },
  {
    name: 'MonthlyBonusHero (ManagerAwardsPanel)',
    path: 'src/components/awards/ManagerAwardsPanel.jsx',
    startMarker: '// @@hero-pane-start',
    endMarker:   '// @@hero-pane-end',
  },
  {
    name: 'PolicyReconciliationPanel pending hero',
    path: 'src/components/manager/PolicyReconciliationPanel.jsx',
    startMarker: '{/* @@hero-pane-start */}',
    endMarker:   '{/* @@hero-pane-end */}',
  },
  {
    name: 'CompliancePanel reality bar',
    path: 'src/components/manager/CompliancePanel.jsx',
    startMarker: '{/* @@hero-pane-start */}',
    endMarker:   '{/* @@hero-pane-end */}',
  },
];

describe('Hero pane foreign-ink guard', () => {
  for (const { name, path, startMarker, endMarker } of HERO_COMPONENTS) {
    const fullPath = resolve(ROOT, path);
    let src;
    try {
      src = readFileSync(fullPath, 'utf-8');
    } catch {
      throw new Error(`Cannot read hero component: ${path}`);
    }

    // When markers are provided, extract only the hero-pane block for scanning.
    // This prevents false-positives from non-hero code in mixed files.
    let block = src;
    if (startMarker && endMarker) {
      const startIdx = src.indexOf(startMarker);
      const endIdx   = src.indexOf(endMarker);
      if (startIdx >= 0 && endIdx > startIdx) {
        block = src.slice(startIdx, endIdx + endMarker.length);
      }
    }

    if (startMarker) {
      it(`${name}: @@hero-pane-start marker present`, () => {
        expect(
          src.indexOf(startMarker),
          `${name}: missing @@hero-pane-start marker ("${startMarker}") in ${path}`,
        ).toBeGreaterThanOrEqual(0);
      });
    }
    if (endMarker) {
      it(`${name}: @@hero-pane-end marker present and after start`, () => {
        const si = startMarker ? src.indexOf(startMarker) : -1;
        const ei = src.indexOf(endMarker);
        expect(
          ei,
          `${name}: missing or misplaced @@hero-pane-end marker ("${endMarker}") in ${path}`,
        ).toBeGreaterThan(si);
      });
    }

    it(`${name} renders a .glass.hero pane`, () => {
      expect(block).toMatch(/\bglass\s+hero\s+(teal|gold)\b/);
    });

    it(`${name}: every text-[--var] class uses a certified hero ink variable`, () => {
      // Match text-[--{varName}] — captures the varName after `--`
      const matches = [...block.matchAll(/\btext-\[--([^\]]+)\]/g)];
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
      const violations = FORBIDDEN_PATTERNS.filter(({ re }) => re.test(block)).map(
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

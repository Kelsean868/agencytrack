/**
 * Clarity mask-attribute guard.
 *
 * Static source-scan test (foreign-ink-guard shape). For every surface that
 * renders agents' personal financial data, asserts that its data container
 * still carries `data-clarity-mask="True"`.
 *
 * Why this guard matters: Microsoft Clarity's masking MODE (Strict) is a
 * dashboard-only setting — the npm init API cannot set it in code (see
 * docs/clarity-integration.md). So the element-level `data-clarity-mask="True"`
 * attribute is the LOAD-BEARING, code-enforced defense that keeps household
 * budget figures out of session recordings regardless of mode. A silent
 * refactor that drops the attribute from any of these containers must fail the
 * suite rather than silently exposing financial data in a recording.
 *
 * Banked 2026-07-03 (FU — Microsoft Clarity integration, privacy-gated).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM-safe project root (avoids `process.cwd()` which is not a browser global).
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// Matches data-clarity-mask set to a TRUTHY value INSIDE AN ACTUAL TAG, tolerant
// of formatting (quote style, casing, {true} JSX expr, or the attribute on its
// own line in a multi-line tag) so a valid reformat doesn't false-fail — but:
//   • NOT a bare attribute-name match: data-clarity-mask={false} / "false" masks
//     nothing and must still fail (Gemini #786).
//   • The `<[^>]*…[^>]*>` wrap requires the attribute to sit within a real tag,
//     so the string appearing only in a comment/prose does NOT satisfy the guard
//     (CodeRabbit #786). `[^>]` spans newlines, covering multi-line JSX tags.
// Mirrors the regex-based foreign-ink-guard precedent.
const MASK_ATTR_REGEX = /<[^>]*\bdata-clarity-mask\s*=\s*(?:["']True["']|["']true["']|\{\s*true\s*\})[^>]*>/;
const MASK_ATTR_DISPLAY = 'data-clarity-mask="True"';

// Every surface that renders personal financial data. Each container's mask
// attribute is verified present. Keep this list in sync with the mask points in
// docs/clarity-integration.md.
const MASKED_SURFACES = [
  {
    name: 'MoneyNeedsPanel worksheet (household budget)',
    path: 'src/components/agent/MoneyNeedsPanel.jsx',
  },
  {
    name: 'TeamPlansRoster rows (shared Money Needs figures)',
    path: 'src/components/manager/TeamPlansRoster.jsx',
  },
  {
    name: 'AgentPlanDrawer (shared Money Needs projection)',
    path: 'src/components/manager/AgentPlanDrawer.jsx',
  },
  {
    name: 'PlanSuggestionsCard (agent hub — manager plan-suggestion notes)',
    path: 'src/components/dashboard/GamePlanV2/PlanSuggestionsCard.jsx',
  },
];

describe('Clarity mask-attribute guard', () => {
  for (const { name, path } of MASKED_SURFACES) {
    it(`${name}: data container carries ${MASK_ATTR_DISPLAY}`, () => {
      const fullPath = resolve(ROOT, path);
      let src;
      try {
        src = readFileSync(fullPath, 'utf-8');
      } catch {
        throw new Error(`Cannot read Clarity-masked surface: ${path}`);
      }
      expect(
        MASK_ATTR_REGEX.test(src),
        `${path} is missing ${MASK_ATTR_DISPLAY} (or an equivalent truthy form). ` +
          `This attribute is the code-enforced defense keeping personal financial ` +
          `data out of Clarity recordings (mode is dashboard-only). Do not remove ` +
          `it — see docs/clarity-integration.md.`,
      ).toBe(true);
    });
  }
});

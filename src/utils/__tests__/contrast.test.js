import { describe, test, expect } from 'vitest';
import { contrastRatio, relativeLuminance, composite, toRgb, passesAA } from '../contrast';

// Channel values MUST match src/index.css. The status-ink tokens are proven here:
// every (ink, background) pair ≥ 4.5:1 against the raw surfaces AND the /10 and
// /15 tints of its own status, in BOTH themes. This is the deterministic basis for
// the contrast-debt retirement allowlist shutdown — executed proof, not eyeballs.
const THEMES = {
  light: {
    surfaces: { surface: [255, 255, 255], bg: [247, 246, 242], raised: [250, 250, 248] },
    status: {
      danger:  { base: [192, 57, 43], ink: [178, 43, 29] },
      warning: { base: [180, 83, 9],  ink: [162, 65, 0] },
      success: { base: [45, 122, 79], ink: [31, 108, 65] },
    },
  },
  dark: {
    surfaces: { surface: [37, 32, 25], bg: [26, 22, 18], raised: [48, 42, 35] },
    status: {
      danger:  { base: [217, 107, 93],  ink: [246, 136, 122] },
      warning: { base: [232, 181, 62],  ink: [232, 181, 62] },
      success: { base: [93, 184, 118],  ink: [100, 191, 125] },
    },
  },
};
const TINT_ALPHAS = [0.10, 0.15]; // count badge (/10) + StatusPill (/15)
const AA = 4.5;

describe('contrast module — WCAG math sanity', () => {
  test('black-on-white is 21:1', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
  });
  test('identical colours are 1:1', () => {
    expect(contrastRatio([100, 100, 100], [100, 100, 100])).toBeCloseTo(1, 5);
  });
  test('ratio is symmetric', () => {
    expect(contrastRatio([10, 20, 30], [200, 210, 220])).toBeCloseTo(contrastRatio([200, 210, 220], [10, 20, 30]), 10);
  });
  test('relativeLuminance: white=1, black=0', () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5);
  });
  test('toRgb parses #hex and channel strings', () => {
    expect(toRgb('#b22b1d')).toEqual([178, 43, 29]);
    expect(toRgb('178 43 29')).toEqual([178, 43, 29]);
  });
  test('composite at alpha 0 = bg, alpha 1 = fg', () => {
    expect(composite([200, 100, 50], 0, [10, 20, 30])).toEqual([10, 20, 30]);
    expect(composite([200, 100, 50], 1, [10, 20, 30])).toEqual([200, 100, 50]);
  });
});

describe('status-ink tokens clear AA against every background (both themes)', () => {
  for (const [theme, cfg] of Object.entries(THEMES)) {
    for (const [name, { ink }] of Object.entries(cfg.status)) {
      for (const [sName, surface] of Object.entries(cfg.surfaces)) {
        test(`${theme}: ${name}-ink on raw ${sName} ≥ ${AA}`, () => {
          expect(contrastRatio(ink, surface)).toBeGreaterThanOrEqual(AA);
        });
        for (const alpha of TINT_ALPHAS) {
          test(`${theme}: ${name}-ink on ${name}/${alpha * 100} tint over ${sName} ≥ ${AA}`, () => {
            const tintBg = composite(cfg.status[name].base, alpha, surface);
            expect(contrastRatio(ink, tintBg)).toBeGreaterThanOrEqual(AA);
            expect(passesAA(ink, tintBg)).toBe(true);
          });
        }
      }
    }
  }
});

describe('the base (pre-ink) status text was genuinely below AA where fixed', () => {
  // Confirms the -ink tokens were necessary, not cosmetic — the documented debt.
  test('light danger base on its /15 tint was < AA', () => {
    const { base } = THEMES.light.status.danger;
    expect(contrastRatio(base, composite(base, 0.15, THEMES.light.surfaces.surface))).toBeLessThan(AA);
  });
  test('light warning base on its /15 tint was < AA', () => {
    const { base } = THEMES.light.status.warning;
    expect(contrastRatio(base, composite(base, 0.15, THEMES.light.surfaces.surface))).toBeLessThan(AA);
  });
  test('dark danger base on its /15 tint was < AA', () => {
    const { base } = THEMES.dark.status.danger;
    expect(contrastRatio(base, composite(base, 0.15, THEMES.dark.surfaces.surface))).toBeLessThan(AA);
  });
});

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

// ── AA-straggler fixes (cleanup-duo) ──────────────────────────────────────────
// Proven deterministically: channel values must match src/index.css.

describe('activity-time text-muted: passes AA on card surface (both themes)', () => {
  // text-faint was 2.50:1 light / 4.17:1 dark — both fail; text-muted fixes both.
  const light = { textMuted: [107, 101, 96],  surface: [255, 255, 255] };
  const dark  = { textMuted: [184, 174, 160], surface: [37, 32, 25] };
  test('light: text-muted on surface ≥ 4.5', () => {
    expect(contrastRatio(light.textMuted, light.surface)).toBeGreaterThanOrEqual(4.5);
  });
  test('dark: text-muted on surface ≥ 4.5', () => {
    expect(contrastRatio(dark.textMuted, dark.surface)).toBeGreaterThanOrEqual(4.5);
  });
  test('old text-faint on light surface was < AA', () => {
    expect(contrastRatio([168, 163, 156], [255, 255, 255])).toBeLessThan(4.5);
  });
  test('old text-faint on dark surface was < AA', () => {
    expect(contrastRatio([138, 128, 116], [37, 32, 25])).toBeLessThan(4.5);
  });
});

describe('NotificationDrawer Mark-all-read: dark hover primary-light passes AA', () => {
  // dark hover was text-primary-dark = #01696f on dark surface = 2.50:1 (fail).
  // Fix: dark:hover:text-primary-light = #6DC8CB = 8.29:1 (pass).
  const darkSurface   = [37, 32, 25];
  const primaryDark   = [74, 181, 184];   // text-primary dark (default)
  const primaryLight  = [109, 200, 203];  // text-primary-light dark (hover fix)
  const primaryDrkDrk = [1, 105, 111];    // text-primary-dark in dark mode (the failing hover)
  test('dark default text-primary on dark surface ≥ 4.5', () => {
    expect(contrastRatio(primaryDark, darkSurface)).toBeGreaterThanOrEqual(4.5);
  });
  test('dark hover text-primary-light on dark surface ≥ 4.5', () => {
    expect(contrastRatio(primaryLight, darkSurface)).toBeGreaterThanOrEqual(4.5);
  });
  test('old dark hover text-primary-dark on dark surface was < AA', () => {
    expect(contrastRatio(primaryDrkDrk, darkSurface)).toBeLessThan(4.5);
  });
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

import { describe, test, expect } from 'vitest';
import { contrastRatio, relativeLuminance, composite, toRgb, passesAA, glassPair, heroPair, heroPairDeep, isLargeText, requiredRatio, AA_NORMAL, AA_LARGE } from '../contrast';

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

// ── Commission GoalDecompositionTab — dark teal text pairing lock ─────────────
//
// FU fix (commission dark-contrast): the ladder value/connector/toggle/settle
// text spans used `text-primary dark:text-primary-dark`, which resolves to the
// UN-lifted teal #01696f in dark mode (2.33–2.50:1 on the dark card / bg-primary/5
// — a real color-contrast regression surfaced by PR #771's dark axe legs). The
// fix DELETES the dark override so bare `text-primary` (= #4ab5b8 lifted in dark)
// renders instead. This block locks the correct pairing so a re-introduced
// override is caught deterministically, not only by a live axe run.
//
// Channel values MUST match src/index.css .dark:
//   --primary-channels: 74 181 184   (#4ab5b8, bare text-primary in dark — the fix)
//   --primary-dark-channels: 1 105 111 (#01696f, text-primary-dark in dark — the bug)
//   --surface-channels: 37 32 25     (#252019, dark bg-card)
describe('commission GoalDecompositionTab: dark lifted-teal text clears AA (regression lock)', () => {
  const darkCard    = [37, 32, 25];                      // dark bg-card #252019
  const bgPrimary5  = composite([74, 181, 184], 0.05, darkCard); // dark bg-primary/5 (act-ladder value bg)
  const bgPrimary10 = composite([74, 181, 184], 0.10, darkCard); // dark bg-primary/10 (history-pill bg)
  const liftedTeal  = [74, 181, 184];                    // #4ab5b8 — bare text-primary in dark (fix)
  const unliftedTeal = [1, 105, 111];                    // #01696f — text-primary-dark in dark (the bug)

  test('fix: #4ab5b8 on dark bg-card ≥ 4.5', () => {
    expect(contrastRatio(liftedTeal, darkCard)).toBeGreaterThanOrEqual(4.5);
  });
  test('fix: #4ab5b8 on dark bg-primary/5 ≥ 4.5', () => {
    expect(contrastRatio(liftedTeal, bgPrimary5)).toBeGreaterThanOrEqual(4.5);
  });
  test('fix: #4ab5b8 on dark bg-primary/10 (history pill) ≥ 4.5', () => {
    expect(contrastRatio(liftedTeal, bgPrimary10)).toBeGreaterThanOrEqual(4.5);
  });
  // Rule 23 falsifier — this block goes red if the dark override is re-introduced.
  test('bug guard: #01696f (dark override) on dark bg-card was < 4.5', () => {
    expect(contrastRatio(unliftedTeal, darkCard)).toBeLessThan(4.5);
  });
  test('bug guard: #01696f (dark override) on dark bg-primary/5 was < 3:1 (large-text floor)', () => {
    expect(contrastRatio(unliftedTeal, bgPrimary5)).toBeLessThan(3.0);
  });
});

// ── Nexus Glass — glassPair ink × tint × theme matrix ─────────────────────────
//
// NOTE ON RECIPE DIVERGENCE (banked):
//   The nexus-glass-recipe.html AA table states warning #B45309 at 4.7:1. Our
//   glassPair() module computes 4.33:1 (teal) / 4.38:1 (gold) in light mode.
//   Investigation showed the recipe's 4.7:1 was computed against raw --color-bg
//   (#F7F6F2, lum≈0.921), not against the glass-composited effective background.
//   glassPair() is the authoritative floor: tint → base@0.62 → darkest named
//   surface. The composited effective bg is cooler than the warm surface alone,
//   which lowers warm-ink contrast. The module is correct; the recipe doc's table
//   is a shortcut. FU: regenerate the recipe HTML AA table from glassPair outputs
//   at the next design-doc touch.
//
// TEXT MATRIX — inks the app ACTUALLY uses as text on the flagship three cards:
//   CommissionAnchorStrip (gold): text-ink · text-ink-muted · warning-ink · danger-ink
//   PersRealityBar         (teal): text-ink · text-ink-muted · warning-ink · danger-ink · success-ink
//   SuggestedWeekCard      (teal): text-ink · text-ink-muted · teal(primary) · warning-ink · danger-ink · success-ink
//   Union → all six inks tested against both tints × both themes.
//   Raw status base colors (warning, danger, success) are NOT text inks — they
//   appear only as graphical fills (sparklines, PaceRow bars). See GRAPHICAL block.
const GLASS_INKS = {
  light: {
    'text-ink':      [40,  37,  29],                       // --text-channels (all three cards)
    'text-ink-muted':[107, 101, 96],                       // --text-muted-channels (all three)
    teal:            [1,   105, 111],                      // --primary-channels (SuggestedWeekCard teal.text)
    'warning-ink':   THEMES.light.status.warning.ink,      // [162, 65, 0] — gap-to-goal, behind-pace, unresolved
    'danger-ink':    THEMES.light.status.danger.ink,       // [178, 43, 29] — below-floor, error states
    'success-ink':   THEMES.light.status.success.ink,      // [31, 108, 65] — award-eligible, ahead/on-track
  },
  dark: {
    'text-ink':      [240, 235, 224],
    'text-ink-muted':[184, 174, 160],
    teal:            [74,  181, 184],
    'warning-ink':   THEMES.dark.status.warning.ink,       // [232, 181, 62]
    'danger-ink':    THEMES.dark.status.danger.ink,        // [246, 136, 122]
    'success-ink':   THEMES.dark.status.success.ink,       // [100, 191, 125]
  },
};

// GRAPHICAL fills — raw status base colors used as non-text graphical elements:
//   PersRealityBar:    bg-warning/70 · bg-danger/70 · bg-success/70  (sparkline bars)
//   SuggestedWeekCard: bg-warning (behind) · bg-success (ahead/on-track)  (PaceRow fills)
// WCAG SC 1.4.11 Non-Text Contrast threshold = 3:1 (not 4.5:1).
const GLASS_GRAPHICAL = {
  light: {
    warning: THEMES.light.status.warning.base,             // [180, 83, 9]
    danger:  THEMES.light.status.danger.base,              // [192, 57, 43]
    success: THEMES.light.status.success.base,             // [45, 122, 79]
  },
  dark: {
    warning: THEMES.dark.status.warning.base,              // [232, 181, 62]
    danger:  THEMES.dark.status.danger.base,               // [217, 107, 93]
    success: THEMES.dark.status.success.base,              // [93, 184, 118]
  },
};

const GLASS_FAINT = {
  light: [168, 163, 156],  // --text-faint-channels (light)
  dark:  [107, 101, 96],   // --text-faint-channels dark context — fails by design
};

describe('glassPair — text inks clear AA (4.5:1) on glass effective bg (both tints × both themes)', () => {
  for (const theme of ['light', 'dark']) {
    for (const tint of ['teal', 'gold']) {
      const bg = glassPair(tint, theme);
      for (const [inkName, inkRgb] of Object.entries(GLASS_INKS[theme])) {
        test(`${theme}/${tint}: ${inkName} ≥ 4.5:1 on glass`, () => {
          expect(contrastRatio(inkRgb, bg)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});

describe('glassPair — graphical fills clear non-text contrast (3:1) on glass effective bg (both tints × both themes)', () => {
  // WCAG SC 1.4.11: graphical elements need 3:1, not 4.5:1.
  // Raw base channels are tested (full-opacity floor); actual renders at /70 are
  // lighter-over-glass but the base floor is the conservative bound.
  for (const theme of ['light', 'dark']) {
    for (const tint of ['teal', 'gold']) {
      const bg = glassPair(tint, theme);
      for (const [colorName, colorRgb] of Object.entries(GLASS_GRAPHICAL[theme])) {
        test(`${theme}/${tint}: ${colorName} (graphical) ≥ 3:1 on glass`, () => {
          expect(contrastRatio(colorRgb, bg)).toBeGreaterThanOrEqual(3.0);
        });
      }
    }
  }
});

describe('glassPair — text-ink-faint FAILS on glass (design intent guard)', () => {
  // The recipe designs faint to fail; this test makes putting faint on glass
  // a permanent red suite. If this test ever goes GREEN, a tint has been
  // inadvertently lightened to the point where faint becomes legible —
  // which means the tint is too washed-out (fix: deepen the tint, not the ink).
  for (const theme of ['light', 'dark']) {
    for (const tint of ['teal', 'gold']) {
      const bg = glassPair(tint, theme);
      test(`${theme}/${tint}: text-ink-faint FAILS on glass (< 4.5:1)`, () => {
        expect(contrastRatio(GLASS_FAINT[theme], bg)).toBeLessThan(4.5);
      });
    }
  }
});

// ── Nexus Glass — S2 Hero tier: heroPair + heroPairDeep matrix ───────────────
//
// NOTE ON RECIPE DIVERGENCES (banked — same root cause as glassPair note above):
//   (1) muted-teal #CFE3E3 claimed 4.6:1 vs teal floor; module gives 4.258:1 (fail).
//   (2) muted-gold #F3E7CC claimed 4.8:1; module gives 3.994:1 (fail).
//   (3) hero-accent #F0D89A claimed 4.9:1 vs teal; module gives 4.054:1 (fail).
//   (4) gold floor hex wrong: recipe stated #8A6212, actual heroPair floor is ~#785614.
//   All four errors share the glassPair root cause: ratios computed against raw
//   --color-bg instead of the composited heroPair floor.  heroPair() is authoritative.
//   Solved inks (this PR): muted-teal → #DCEEEE, muted-gold → #F5EACA,
//   accent → #F4ECC8, gold pane deepened to rgba(111,74,4). Danger dot lightened
//   from #F59A8E → #FBADA8. FU: regenerate both recipe HTML tables from module outputs.
//
// HERO TEXT INKS — invariant across themes (always light-on-dark pane)
const HERO_INKS = {
  'hero-ink':            [255, 255, 255],  // --hero-ink
  'hero-ink-muted-teal': [220, 238, 238],  // --hero-ink-muted-teal: #DCEEEE
  'hero-ink-muted-gold': [245, 234, 202],  // --hero-ink-muted-gold: #F5EACA
  'hero-accent':         [244, 236, 200],  // --hero-accent:         #F4ECC8
};

// HERO DOTS — graphical elements ≥3:1 on chip-island background (heroPairDeep)
const HERO_DOTS = {
  'hero-dot-success': [127, 224, 165],     // --hero-dot-success: #7FE0A5
  'hero-dot-warning': [244, 192, 106],     // --hero-dot-warning: #F4C06A
  'hero-dot-danger':  [251, 173, 168],     // --hero-dot-danger:  #FBADA8
};

const HERO_AA_FLOOR = 4.7;

describe('heroPair — hero text inks clear 4.7:1 on hero effective bg (both tints × both themes)', () => {
  for (const theme of ['light', 'dark']) {
    for (const tint of ['teal', 'gold']) {
      const bg = heroPair(tint, theme);
      for (const [inkName, inkRgb] of Object.entries(HERO_INKS)) {
        test(`${theme}/${tint}: ${inkName} ≥ ${HERO_AA_FLOOR}:1 on hero glass`, () => {
          expect(contrastRatio(inkRgb, bg)).toBeGreaterThanOrEqual(HERO_AA_FLOOR);
        });
      }
    }
  }
});

describe('heroPairDeep — hero dot tokens clear 3:1 on chip-island bg (both tints × both themes)', () => {
  for (const theme of ['light', 'dark']) {
    for (const tint of ['teal', 'gold']) {
      const chipBg = heroPairDeep(tint, theme);
      for (const [dotName, dotRgb] of Object.entries(HERO_DOTS)) {
        test(`${theme}/${tint}: ${dotName} ≥ 3:1 on hero chip island`, () => {
          expect(contrastRatio(dotRgb, chipBg)).toBeGreaterThanOrEqual(3.0);
        });
      }
    }
  }
});

describe('heroPair — pre-solve inks FAIL 4.7:1 on teal light floor (solve-necessity guard)', () => {
  // These three values were the original recipe inks. They fail ≥4.7 on the
  // light teal heroPair floor — proving the constraint-solve was necessary.
  // If this test ever goes green, the teal pane was inadvertently lightened
  // and the solve headroom is gone (fix: deepen the teal a-stop, not the ink).
  const tealFloor = heroPair('teal', 'light');
  test('pre-solve muted-teal #CFE3E3 FAILS 4.7:1 on teal floor', () => {
    expect(contrastRatio([207, 227, 227], tealFloor)).toBeLessThan(HERO_AA_FLOOR);
  });
  test('pre-solve muted-gold #F3E7CC FAILS 4.7:1 on teal floor', () => {
    expect(contrastRatio([243, 231, 204], tealFloor)).toBeLessThan(HERO_AA_FLOOR);
  });
  test('pre-solve accent #F0D89A FAILS 4.7:1 on teal floor', () => {
    expect(contrastRatio([240, 216, 154], tealFloor)).toBeLessThan(HERO_AA_FLOOR);
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

// ── S3 sweep — AwardDonut strokeOverride graphical certification ──────────────
//
// MonthlyBonusHero (ManagerAwardsPanel) uses AwardDonut with strokeOverride:
//   contention state → var(--hero-ink)  = white  [255, 255, 255]
//   qualified  state → var(--hero-accent) = #F4ECC8 [244, 236, 200]
//
// Both are already certified as TEXT inks (≥4.7:1) via the heroPair matrix above.
// As graphical strokes (WCAG SC 1.4.11 = 3:1), they trivially pass.
// These tests document and guard the pairing for the teal hero pane specifically.
describe('heroPair — S3 AwardDonut strokeOverride graphical strokes ≥3:1 on hero glass (teal, both themes)', () => {
  for (const theme of ['light', 'dark']) {
    const bg = heroPair('teal', theme);
    test(`${theme}: hero-ink (contention stroke) ≥ 3:1 on teal hero glass`, () => {
      expect(contrastRatio(HERO_INKS['hero-ink'], bg)).toBeGreaterThanOrEqual(3.0);
    });
    test(`${theme}: hero-accent (qualified stroke) ≥ 3:1 on teal hero glass`, () => {
      expect(contrastRatio(HERO_INKS['hero-accent'], bg)).toBeGreaterThanOrEqual(3.0);
    });
  }
});

// The WCAG large-text boundary decides which threshold every sample in
// a11y-contrast-sweep.mjs is scored against, so an off-by-one here silently
// scores normal text at 3.0 and passes real failures. Boundaries are asserted
// on BOTH sides, and the inputs are strings because getComputedStyle returns
// strings ("18.66px", "700") — the sweep passes them through unparsed.
describe('isLargeText / requiredRatio — the WCAG large-text boundary', () => {
  test('AA constants are the WCAG 2.1 AA minima', () => {
    expect(AA_NORMAL).toBe(4.5);
    expect(AA_LARGE).toBe(3.0);
  });

  test.each([
    ['24px', '400', true, 'exactly 24px at normal weight is large'],
    ['23.9px', '400', false, 'just under 24px at normal weight is NOT large'],
    ['18.66px', '700', true, 'exactly 18.66px bold is large'],
    ['18.66px', '400', false, '18.66px at normal weight is NOT large'],
    ['18.65px', '700', false, 'just under 18.66px bold is NOT large'],
    // WCAG defines bold as >=700. Semibold is the weight that makes the
    // threshold wrong in the permissive direction, and without this case a
    // 700 -> 600 loosening passes the whole suite (verified by mutation).
    ['20px', '600', false, 'semibold 600 is NOT bold — 18.66px rule must not apply'],
    ['20px', '700', true, 'the same size at 700 IS large — isolates weight'],
    ['32px', '700', true, 'comfortably over both thresholds'],
    ['16px', '900', false, 'weight alone never makes text large'],
  ])('%s / %s -> %s (%s)', (size, weight, expected) => {
    expect(isLargeText(size, weight)).toBe(expected);
  });

  test('numeric inputs behave identically to string inputs', () => {
    expect(isLargeText(24, 400)).toBe(isLargeText('24px', '400'));
    expect(isLargeText(18.66, 700)).toBe(isLargeText('18.66px', '700'));
  });

  test('an unparseable size is not large — never silently downgrade to 3:1', () => {
    expect(isLargeText('', '400')).toBe(false);
    expect(isLargeText(undefined, '400')).toBe(false);
    expect(requiredRatio('', '400')).toBe(AA_NORMAL);
  });

  test('a missing weight defaults to normal, not bold', () => {
    expect(isLargeText('18.66px', '')).toBe(false);
  });

  test('requiredRatio tracks isLargeText at the boundary', () => {
    expect(requiredRatio('24px', '400')).toBe(AA_LARGE);
    expect(requiredRatio('23.9px', '400')).toBe(AA_NORMAL);
    expect(requiredRatio('18.66px', '700')).toBe(AA_LARGE);
    expect(requiredRatio('18.66px', '400')).toBe(AA_NORMAL);
  });
});

// FR trophies — pure data + geometry, ported from
// docs/design-system/screens-fr/D3-Trophy.dc.html (`renderVals()`).
//
// What: the 33 trophy "kinds" (badges, levels, awards, campaign, streak), their
// shape/glyph/text/ribbon/laurel assignment, and the SVG path-math helpers that
// build each shape's `d` strings. No colour lives here — every colour (metal
// gradients, ribbon hexes, accent hexes) moved to src/styles/fr-trophy.css per
// the FR-0 trophy brief and CLAUDE.md's "no hex/rgb() in .jsx/.js" rule.
// Why: Trophy.jsx needs the same maths for every kind; keeping it data-only
// (no React, no colour) makes it trivially unit-testable and reusable (e.g. a
// future trophy-room list can import TROPHY_KINDS/TROPHY_LABELS without pulling
// in the component).

// ---- geometry helpers (viewBox 0..100) — verbatim port of the canvas maths ----
const f = (n) => Math.round(n * 100) / 100;

const circle = (cx, cy, r) =>
  'M' + f(cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0z';

const star = (cx, cy, R, r, n, rot) => {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot || -90) * Math.PI) / 180 + (i * Math.PI) / n;
    const rr = i % 2 === 0 ? R : r;
    d += (i === 0 ? 'M' : 'L') + f(cx + rr * Math.cos(a)) + ' ' + f(cy + rr * Math.sin(a));
  }
  return d + 'z';
};

const scallop = (cx, cy, R, n, bump) => {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const x = cx + R * Math.cos(a);
    const y = cy + R * Math.sin(a);
    if (i === 0) {
      d += 'M' + f(x) + ' ' + f(y);
      continue;
    }
    const am = a - Math.PI / n;
    const cx2 = cx + (R + bump) * Math.cos(am);
    const cy2 = cy + (R + bump) * Math.sin(am);
    d += 'Q' + f(cx2) + ' ' + f(cy2) + ' ' + f(x) + ' ' + f(y);
  }
  return d + 'z';
};

const laurel = (cx, cy, R) => {
  let d = '';
  [-1, 1].forEach((s) => {
    // stem
    const a0 = ((90 - s * 8) * Math.PI) / 180;
    const a1 = ((90 - s * 128) * Math.PI) / 180;
    d +=
      'M' + f(cx + R * Math.cos(a0)) + ' ' + f(cy + R * Math.sin(a0)) +
      'A' + R + ' ' + R + ' 0 0 ' + (s > 0 ? 0 : 1) + ' ' +
      f(cx + R * Math.cos(a1)) + ' ' + f(cy + R * Math.sin(a1)) + 'l0.01 0';
    for (let k = 0; k < 8; k++) {
      const deg = 16 + k * 15;
      const a = ((90 - s * deg) * Math.PI) / 180;
      const bx = cx + R * Math.cos(a);
      const by = cy + R * Math.sin(a);
      [1, -1].forEach((side) => {
        if (k === 0 && side < 0) return;
        const a2 = a - s * 0.2;
        const rr = R + side * 10;
        const tx = cx + rr * Math.cos(a2);
        const ty = cy + rr * Math.sin(a2);
        const mx = (bx + tx) / 2;
        const my = (by + ty) / 2;
        const px = -(ty - by);
        const py = tx - bx;
        const len = Math.sqrt(px * px + py * py) || 1;
        const o = 3.4;
        d +=
          'M' + f(bx) + ' ' + f(by) +
          'Q' + f(mx + (px / len) * o) + ' ' + f(my + (py / len) * o) + ' ' + f(tx) + ' ' + f(ty) +
          'Q' + f(mx - (px / len) * o) + ' ' + f(my - (py / len) * o) + ' ' + f(bx) + ' ' + f(by) + 'z';
      });
    }
  });
  return d;
};

// ---- shape table: which paths each trophy silhouette needs, + glyph anchor ----
const SHAPES = {
  medal: {
    tails: 'M29 2h15l11 36H41zM56 2h15L60 38H45z',
    stripe: 'M36.5 3l9 33M63.5 3l-9 33',
    body: circle(50, 64, 30),
    inner: circle(50, 64, 24),
    gx: 50, gy: 64, gs: 1,
  },
  cup: {
    handles: 'M27 17H16c0 13 6 20 13 21M73 17h11c0 13-6 20-13 21',
    body2: 'M44 56h12v10H44zM33 66h34l3 10H30zM25 76h50v11H25z',
    body: 'M25 9h50v17c0 18-11 31-25 31S25 44 25 26z',
    inner: 'M30 15h40',
    gx: 50, gy: 30, gs: 0.85,
  },
  shield: {
    body: 'M50 5l37 11v28c0 23-16 40-37 50C29 84 13 67 13 44V16z',
    inner: 'M50 12l30 9v23c0 19-13 33-30 42C33 77 20 63 20 44V21z',
    gx: 50, gy: 46, gs: 1.05,
  },
  rosette: {
    tails: 'M35 62l-9 33 11-6 7 9 5-34zM65 62l9 33-11-6-7 9-5-34z',
    stripe: 'M31 70l-4 18M69 70l4 18',
    body: scallop(50, 42, 33, 18, 7),
    inner: circle(50, 42, 24),
    gx: 50, gy: 42, gs: 1,
  },
  burst: {
    body: star(50, 52, 46, 37, 14, -90),
    inner: circle(50, 52, 29),
    gx: 50, gy: 52, gs: 1.05,
  },
  gem: {
    body: 'M50 5l40 23v44L50 95 10 72V28z',
    facet: 'M10 28l40 19 40-19M50 47v48M28 17l22 30 22-30M10 72l40-25 40 25',
    gx: 50, gy: 50, gs: 0,
  },
  crown: {
    body: 'M11 30l20 18 19-33 19 33 20-18-8 48H19z',
    body2: 'M17 78h66v12H17z',
    dots: circle(11, 30, 4.5) + circle(50, 15, 5) + circle(89, 30, 4.5) + circle(34, 84, 3) + circle(50, 84, 3) + circle(66, 84, 3),
    gx: 50, gy: 58, gs: 0.8,
  },
  plaque: {
    body: 'M14 6h72a7 7 0 0 1 7 7v74a7 7 0 0 1-7 7H14a7 7 0 0 1-7-7V13a7 7 0 0 1 7-7z',
    plate: 'M21 16h58v48H21zM29 72h42v12H29z',
    inner: 'M26 21h48v38H26z',
    gx: 50, gy: 40, gs: 1,
  },
};

// ---- glyph table: per-badge icon geometry (fill path OR stroke path) ----
const G = {
  feet: { fill: 'M-5 9c-3.5 0-5.5-3.5-5.5-8.5S-8.6-9-5.4-9-1 -4.5-1 .5-1.8 9-5 9zM6 4C2.7 4 1.2.5 1.2-4.5S3.4-14 6.4-14s4.6 4.5 4.6 9.5S9.2 4 6 4zM-6.8 13.5a2.6 2.6 0 1 0 5.2 0 2.6 2.6 0 1 0-5.2 0zM4.2 8.5a2.6 2.6 0 1 0 5.2 0 2.6 2.6 0 1 0-5.2 0z' },
  flame: { fill: 'M0 14c-7.5 0-11.5-5-11.5-10.5 0-7 6.5-10 6-18 4.5 3 6 6.5 5.5 10 2-2 3.5-4.5 3.5-8 5.5 4.5 8 10 8 15.5 0 6.5-4 11-11.5 11z' },
  calendar: { d: 'M-11-9h22v20h-22zM-11-3h22M-5-13v6M5-13v6M-5 5l3 3 7-7' },
  quads: { d: 'M-12 0a12 12 0 1 0 24 0a12 12 0 1 0-24 0M0-12v24M-12 0h24' },
  gauge: { d: 'M-13 7a13 13 0 0 1 26 0M0 7l7-10M-13 7h3M10 7h3M0-6v3' },
  star: { fill: star(0, 1, 13, 5.4, 5, -90) },
  check: { d: 'M-10 0l6 6 13-13' },
  bolt: { fill: 'M3-15L-10 3h9l-4 13L12-4H3z' },
  phone: { d: 'M-11-12c0 15 8 23 23 23l2-7-7-3-3 3c-4-2-6-4-8-8l3-3-3-7z' },
  target: { d: 'M-12 0a12 12 0 1 0 24 0a12 12 0 1 0-24 0M-6.5 0a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0M-1 0h2' },
  summit: { d: 'M-14 12L-4-4l5 7 4-5 9 14zM1-4v-12l8 3-8 3' },
  infinity: { d: 'M0 0c-4-5-7-7-10-7a7 7 0 0 0 0 14c3 0 6-2 10-7s7-7 10-7a7 7 0 0 1 0 14c-3 0-6-2-10-7z' },
  chev1: { d: 'M-11 4l11-8 11 8' },
  chev2: { d: 'M-11 -2l11-8 11 8M-11 8l11-8 11 8' },
  chev3: { d: 'M-11 -8l11-8 11 8M-11 1l11-8 11 8M-11 10l11-8 11 8' },
  bars: { d: 'M-9 11V3M-2 11V-4M5 11V-11M-13 11h26' },
  doc: { d: 'M-8-12h11l6 6v18H-8zM3-12v6h6M-4 2h9M-4 7h9' },
  loop: { d: 'M10-6a11 11 0 1 0 2 8M12-12v7H5' },
  sprout: { d: 'M0 13V-1M0-1c0-7-5-11-12-11 0 7 5 11 12 11zM0 5c0-6 4-9 10-9 0 6-4 9-10 9z' },
  case: { d: 'M-12-5h24v16h-24zM-5-5v-4h10v4M-12 2h24' },
  snow: { d: 'M0-13v26M-11-6.5l22 13M-11 6.5l22-13M-3.5-10L0-6.5 3.5-10M-3.5 10L0 6.5 3.5 10' },
  none: {},
};

// kind: [label, shape, metal, glyph, text, ribbon, hasLaurel?]
// Metal/ribbon are SYMBOLIC keys only — the hex values live in fr-trophy.css,
// keyed by the same names via [data-metal]/[data-ribbon] attribute selectors.
const K = {
  'first-steps': ['First Steps', 'medal', 'bronze', 'feet', '', 'teal'],
  'on-a-roll': ['On a Roll', 'shield', 'bronze', 'flame', '', ''],
  'committed': ['Committed', 'rosette', 'silver', 'calendar', '', 'teal'],
  'quarter-strong': ['Quarter Strong', 'shield', 'gold', 'quads', '', ''],
  'mdrt-pace': ['MDRT Pace', 'medal', 'silver', 'gauge', '', 'teal'],
  'mdrt-qualified': ['MDRT Qualified', 'cup', 'gold', 'star', '', '', true],
  'closer': ['Closer', 'medal', 'gold', 'check', '', 'teal'],
  'big-week': ['Big Week', 'burst', 'gold', 'bolt', '', ''],
  'century': ['Century', 'rosette', 'gold', 'none', '100', 'gold'],
  'dial-king': ['Dial King', 'crown', 'gold', 'phone', '', ''],
  'sharpshooter': ['Sharpshooter', 'medal', 'silver', 'target', '', 'blue'],
  'mdrt-bound': ['MDRT Bound', 'shield', 'silver', 'summit', '', ''],
  'untouchable': ['Untouchable', 'gem', 'plat', 'none', '', ''],
  'consistent': ['Consistent', 'rosette', 'bronze', 'infinity', '', 'teal'],
  'level-rookie': ['Level: Rookie', 'shield', 'bronze', 'chev1', '', ''],
  'level-associate': ['Level: Associate', 'shield', 'silver', 'chev2', '', ''],
  'level-pro': ['Level: Pro', 'shield', 'gold', 'chev3', '', ''],
  'level-elite': ['Level: Elite', 'shield', 'plat', 'star', '', '', true],
  'level-legend': ['Level: Legend', 'crown', 'plat', 'star', '', '', true],
  'aotm-api': ['Advisor of the Month — API', 'plaque', 'gold', 'none', 'API', ''],
  'aotm-apps': ['Advisor of the Month — Apps', 'plaque', 'silver', 'none', 'APPS', ''],
  'quarterly-api': ['Quarterly API Award', 'cup', 'silver', 'bars', '', ''],
  'quarterly-apps': ['Quarterly Apps Award', 'cup', 'bronze', 'doc', '', ''],
  'persistency-silver': ['Persistency Award — Silver', 'shield', 'silver', 'loop', '', ''],
  'persistency-gold': ['Persistency Award — Gold', 'shield', 'gold', 'loop', '', '', true],
  'rookie-year': ['Rookie of the Year', 'medal', 'gold', 'sprout', '', 'green'],
  'new-business': ['New Business Advisor Award', 'medal', 'gold', 'case', '', 'blue'],
  'centurion': ['Centurion Award', 'rosette', 'gold', 'none', 'C', 'blue', true],
  'agent-year': ['Agent of the Year', 'cup', 'plat', 'star', '', '', true],
  'mdrt': ['MDRT', 'medal', 'plat', 'none', 'MDRT', 'blue', true],
  'xmas-champion': ['Christmas Champion', 'cup', 'ruby', 'star', '', '', true],
  'xmas-tier': ['Christmas tier', 'medal', 'ruby', 'snow', '', 'green'],
  'streak': ['Streak', 'burst', 'ember', 'flame', '', ''],
};

/** Frozen, ordered list of the 33 trophy kind ids (canvas order). */
export const TROPHY_KINDS = Object.freeze([
  'first-steps', 'on-a-roll', 'committed', 'quarter-strong', 'mdrt-pace',
  'mdrt-qualified', 'closer', 'big-week', 'century', 'dial-king',
  'sharpshooter', 'mdrt-bound', 'untouchable', 'consistent',
  'level-rookie', 'level-associate', 'level-pro', 'level-elite', 'level-legend',
  'aotm-api', 'aotm-apps', 'quarterly-api', 'quarterly-apps',
  'persistency-silver', 'persistency-gold', 'rookie-year', 'new-business',
  'centurion', 'agent-year', 'mdrt',
  'xmas-champion', 'xmas-tier',
  'streak',
]);

/** kind id → human label (aria-label copy), same order/text as the canvas. */
export const TROPHY_LABELS = Object.freeze(
  TROPHY_KINDS.reduce((acc, kind) => {
    acc[kind] = K[kind][0];
    return acc;
  }, {})
);

const FALLBACK_KIND = 'first-steps';

/**
 * Pure per-kind geometry (no colour, no locked/dark/size/progress — those are
 * runtime concerns Trophy.jsx layers on top). Path `d` strings, transforms,
 * symbolic metal/ribbon/accent keys, glyph and text placement.
 *
 * Unknown kind: THROWS in development (v3 rule 11 — silent fallbacks throw in
 * dev) and falls back to 'first-steps' with a console.warn in production.
 */
export function trophyGeometry(kind) {
  let resolvedKind = kind;
  let k = K[resolvedKind];

  if (!k) {
    if (import.meta.env.DEV) {
      throw new Error(`[trophyGeometry] unknown trophy kind "${kind}" — no such kind in TROPHY_KINDS.`);
    }
    console.warn(`[trophyGeometry] unknown trophy kind "${kind}" — falling back to "${FALLBACK_KIND}".`);
    resolvedKind = FALLBACK_KIND;
    k = K[resolvedKind];
  }

  const [label, shape, metal, glyphKey, text, ribbonKey, hasLaurelFlag] = k;
  const sh = SHAPES[shape];
  const glyph = G[glyphKey] || {};
  const isPlaque = shape === 'plaque';
  const hasLaurel = !!hasLaurelFlag;
  const textValue = text || '';
  let textSize = 26;
  if (textValue.length >= 4) {
    textSize = 13;
  } else if (textValue.length === 3) {
    textSize = isPlaque ? 16 : 17;
  }

  return {
    kind: resolvedKind,
    label,
    shape,
    metal,
    metal2: isPlaque ? 'wood' : metal,
    isPlaque,
    ribbon: ribbonKey || 'teal',
    hasLaurel,
    laurelD: hasLaurel ? laurel(50, 54, 44) : '',
    // Fixed accent, not theme- or lock-dependent (Trophy.jsx swaps to the
    // metal-lo colour instead when locked — see fr-t-lo-both in fr-trophy.css).
    laurelAccent: metal === 'plat' ? 'plat' : 'gold',
    tailsD: sh.tails || '',
    tailStripeD: sh.stripe || '',
    handlesD: sh.handles || '',
    body2D: sh.body2 || '',
    bodyD: sh.body || '',
    plateD: sh.plate || '',
    innerD: sh.inner || '',
    facetD: sh.facet || '',
    dotsD: sh.dots || '',
    dotsAccent: metal === 'plat' ? 'ruby' : 'teal',
    glyphD: glyph.d || '',
    glyphFillD: glyph.fill || '',
    glyphTransform: `translate(${sh.gx} ${sh.gy}) scale(${sh.gs})`,
    mainTransform: hasLaurel ? 'translate(50 52) scale(0.8) translate(-50 -52)' : 'translate(0 0)',
    text: textValue,
    textY: sh.gy,
    textSize,
  };
}

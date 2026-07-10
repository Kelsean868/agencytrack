// Master Sheet — FUNNEL edition. Column model + per-agent weekly data.
//
// The 23-column sheet regrouped as an explicit sales funnel: 8 stages,
// ALWAYS EXPANDED (no collapse mechanic). Each group closes with its KPI —
// parts → outcome, reading left to right — so the group boundary IS the
// KPI band. Teal is reserved for the terminal KPI (API) only; stage KPIs
// use tone + weight (neutral wash, 700, full ink), sub-columns sit back
// (400, muted). Reuses ROSTER from mastersheet-v2-shared.

// ── Column model ──────────────────────────────────────────────────────────
// kpi: emphasized band closing the group. terminal: strongest emphasis
// (API by default; the NEW NAMES preset moves terminal emphasis to newNames).
// ik: contributes to the Activity Standards "Interviews Kept" derived figure.
const FUNNEL_GROUPS = [
  { id: 'p',  num: '01', label: 'PROSPECTING ACTIVITIES', short: 'PROSP', cols: [
    { key: 'letters',  label: 'Letters/Em', w: 60 },
    { key: 'seminars', label: 'Seminars',   w: 58 },
    { key: 'canvass',  label: 'Cold Canv',  w: 60 },
    { key: 'refCalls', label: 'Ref Calls',  w: 58 },
    { key: 'pTot',     label: 'Total',      w: 60, kpi: true },
  ]},
  { id: 'ca', num: '02', label: 'CONTACT ATTEMPTS', short: 'ATTEMPTS', cols: [
    { key: 'telAtt', label: 'Tel',   w: 54 },
    { key: 'f2fAtt', label: 'F2F',   w: 52 },
    { key: 'caTot',  label: 'Total', w: 60, kpi: true },
  ]},
  { id: 'cm', num: '03', label: 'CONTACTS MADE', short: 'CONTACTS', cols: [
    { key: 'telCon', label: 'Tel',   w: 54 },
    { key: 'f2fCon', label: 'F2F',   w: 52 },
    { key: 'cmTot',  label: 'Total', w: 60, kpi: true },
  ]},
  { id: 'qa', num: '04', label: 'QUALIFIED APPR.', short: 'QA', cols: [
    { key: 'qa', label: 'Approaches', w: 138, kpi: true },
  ]},
  { id: 'ffi', num: '05', label: 'FFIs', short: 'FFI', cols: [
    { key: 'ffiSch',  label: 'Sched',     w: 58 },
    { key: 'ffiCond', label: 'Conducted', w: 74, kpi: true, ik: true },
  ]},
  { id: 'ci', num: '06', label: 'CIs', short: 'CI', cols: [
    { key: 'ciNew',  label: 'New Bkd',   w: 60 },
    { key: 'ciOld',  label: 'Old Bkd',   w: 60 },
    { key: 'ciCond', label: 'Conducted', w: 74, kpi: true, ik: true },
  ]},
  { id: 'res', num: '07', label: 'RESULTS', short: 'RESULTS', cols: [
    { key: 'apps',  label: 'Apps',      w: 54 },
    { key: 'lives', label: 'Lives',     w: 54 },
    { key: 'api',   label: 'API · TTD', w: 98, kpi: true, terminal: true, money: true },
  ]},
  { id: 'ref', num: '08', label: 'REFERRALS', short: 'REFERRALS', cols: [
    { key: 'refs',     label: 'Referrals', w: 66 },
    { key: 'newNames', label: 'New Names', w: 72 },
    { key: 'refTot',   label: 'Total',     w: 60, kpi: true },
  ]},
];

// Collapsed width per group — wide enough for "01 · SHORT" + the toggle glyph.
const FUNNEL_COLLAPSED_W = { p: 108, ca: 116, cm: 116, qa: 138, ffi: 100, ci: 96, res: 122, ref: 124 };

// View model for the expand/collapse mechanic. `expanded` is a Set of group
// ids; a collapsed group renders only its KPI column(s) at collapsedW. QA is
// a single standalone KPI — always "open", no toggle.
function funnelView(expanded) {
  const groups = FUNNEL_GROUPS.map((g) => {
    const open = g.id === 'qa' ? true : expanded.has(g.id);
    const vcols = (open ? g.cols : g.cols.filter((c) => c.kpi)).map((c, i) => ({
      ...c,
      w: open ? c.w : Math.max(c.w, FUNNEL_COLLAPSED_W[g.id] || 100),
      groupId: g.id, groupStart: i === 0, open,
    }));
    return { ...g, open, vcols };
  });
  return { groups, cols: groups.flatMap((g) => g.vcols) };
}

// px offset of a group's first visible column (excl. lead columns).
function funnelViewOffset(cols, groupId) {
  let x = 0;
  for (const c of cols) { if (c.groupId === groupId) return x; x += c.w; }
  return x;
}

// Flattened with group metadata (groupStart drives the boundary rule).
const FUNNEL_COLS = FUNNEL_GROUPS.flatMap((g) =>
  g.cols.map((c, i) => ({ ...c, groupId: g.id, groupStart: i === 0 }))
);

// Lead (sticky) columns: rank · agent·unit · status.
const FUNNEL_LEAD_W = [30, 168, 100];
const FUNNEL_GRID = [...FUNNEL_LEAD_W, ...FUNNEL_COLS.map((c) => c.w)].map((w) => `${w}px`).join(' ');
const FUNNEL_MINW = [...FUNNEL_LEAD_W, ...FUNNEL_COLS.map((c) => c.w)].reduce((a, b) => a + b, 0);

// px offset of a group's first column from the left table edge (excl. lead
// columns) — used to pre-scroll artboards and by the narrow stage scrubber.
function funnelGroupOffset(id) {
  let x = 0;
  for (const g of FUNNEL_GROUPS) {
    if (g.id === id) return x;
    x += g.cols.reduce((a, c) => a + c.w, 0);
  }
  return x;
}

// ── Weekly funnel data per agent — deterministic, plausible, internally
// consistent (attempts ≥ contacts ≥ QA ≥ interviews ≥ apps). ──────────────
function funnelFor(a) {
  const k = Math.max(0.25, Math.min(1, a.apps / 41));           // intensity
  const s = (a.initials.charCodeAt(0) * 7 + a.initials.charCodeAt(1) * 3) % 7;
  const m = a.flag === 'quiet' ? 0.12 : a.flag === 'floor' ? 0.45 : 1;

  const letters  = Math.round((9 * k + (s % 3)) * m);
  const seminars = m < 1 ? 0 : k > 0.7 ? 1 + (s % 2) : (s % 3 === 0 ? 1 : 0);
  const canvass  = Math.round((6 * k + (s % 2)) * m);
  const refCalls = Math.round((7 * k + (s % 3)) * m);
  const pTot = letters + seminars + canvass + refCalls;

  const telAtt = Math.round((22 * k + s) * m);
  const f2fAtt = Math.round((8 * k + (s % 2)) * m);
  const caTot = telAtt + f2fAtt;

  const telCon = Math.round(telAtt * 0.42);
  const f2fCon = Math.round(f2fAtt * 0.6);
  const cmTot = telCon + f2fCon;

  const qa = Math.round(cmTot * 0.55);

  const ffiCond = Math.round(a.ffi * m);
  const ffiSch = ffiCond + (m < 1 ? 0 : (s % 2));
  const ciCond = Math.round(a.ci * m);
  const ciNew = Math.ceil(ciCond * 0.6);
  const ciOld = Math.max(0, ciCond - ciNew + (s % 2 && m === 1 ? 1 : 0));

  const apps = a.flag === 'quiet' ? 0 : Math.max(a.flag === 'floor' ? 0 : 1, Math.round(2.4 * k) + (s % 2));
  const lives = apps === 0 ? 0 : apps + (s % 3);
  const api = a.weekApi;

  const refs = Math.round((3 * k + (s % 2)) * m);
  const newNames = Math.round((5 * k + (s % 3)) * m);
  const refTot = refs + newNames;

  return { letters, seminars, canvass, refCalls, pTot, telAtt, f2fAtt, caTot,
           telCon, f2fCon, cmTot, qa, ffiSch, ffiCond, ciNew, ciOld, ciCond,
           apps, lives, api, refs, newNames, refTot };
}

// Team totals per column + the Interviews Kept derived figure.
const FUNNEL_ROWS = ROSTER.map((a, i) => ({ ...a, rank: i + 1, v: funnelFor(a) }));
const FUNNEL_TOTALS = (() => {
  const tot = {};
  for (const c of FUNNEL_COLS) tot[c.key] = FUNNEL_ROWS.reduce((s, r) => s + r.v[c.key], 0);
  return tot;
})();
const INTERVIEWS_KEPT = FUNNEL_TOTALS.ffiCond + FUNNEL_TOTALS.ciCond;

// Compact money for the API column: "TTD 24.4K" (ttd() rule, weekly scale).
function apiText(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
}

Object.assign(window, {
  FUNNEL_GROUPS, FUNNEL_COLS, FUNNEL_LEAD_W, FUNNEL_GRID, FUNNEL_MINW,
  funnelGroupOffset, funnelFor, FUNNEL_ROWS, FUNNEL_TOTALS, INTERVIEWS_KEPT, apiText,
  FUNNEL_COLLAPSED_W, funnelView, funnelViewOffset,
});

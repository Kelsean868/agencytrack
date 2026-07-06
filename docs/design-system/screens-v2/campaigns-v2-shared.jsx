// AgencyTrack — Campaigns v2. Shared data model + primitives.
//
// A campaign is a TIME-BOXED PUSH toward a target, scoped to where in the
// hierarchy it was created. Two structures (per the user's model + the real
// Christmas Campaign 2025 doc):
//   • 'qualify'   — hit a tier, win that tier's prize. Everyone who reaches a
//                   level wins it (the company default; Christmas Campaign).
//   • 'placement' — 1st / 2nd / 3rd, the way a manager often runs their own.
//
// Signature mechanic, lifted from the real doc: the PERSISTENCY GATE — a
// tiered multiplier on every payout (>=90% full · 85-89% half · 80-84% quarter
// · <80% disqualified). Production alone never wins; quality gates the prize.
//
// Visual grammar: teal = management/operations (progress, controls, structure)
// · gold = the prize & recognition layer (prize values, qualified, winners),
// matching the existing CampaignProgressStrip / November Sprint lens.
// Reuses app-tokens (ttd, icons), app-shell, manager-v2-shared (ManagerShell).

// ── The persistency gate — one source of truth ───────────────────────────
const PERS_GATE = [
  { min: 90, payout: 1.0,  label: '100%', tone: 'success' },
  { min: 85, payout: 0.5,  label: '50%',  tone: 'gold'    },
  { min: 80, payout: 0.25, label: '25%',  tone: 'warning' },
  { min: 0,  payout: 0,    label: 'DQ',   tone: 'danger'  },
];
function gateFor(pers) {
  return PERS_GATE.find((g) => pers >= g.min) || PERS_GATE[PERS_GATE.length - 1];
}

// ── Tier resolution — highest qualifying tier for a value (+ apps minimum) ──
function tierFor(value, apps, tiers) {
  // tiers are ordered high→low; first one cleared (value AND apps) wins.
  for (const tr of tiers) {
    if (value >= tr.api && apps >= (tr.apps || 0)) return tr;
  }
  return null;
}

// ── Scope / kind metadata ─────────────────────────────────────────────────
function kindMeta(t, kind) {
  switch (kind) {
    case 'Company':    return { fg: t.inkAccent, bg: t.inkAccentTint, label: 'Company-wide' };
    case 'Branch':     return { fg: t.teal,      bg: t.tealTint,      label: 'Branch' };
    case 'Unit':       return { fg: t.tealLight, bg: t.tealTint,      label: 'Unit' };
    case 'Individual': return { fg: t.gold,      bg: t.goldTint,      label: 'Individual' };
    default:           return { fg: t.inkMute,   bg: t.surfaceMute,   label: kind };
  }
}
function stateMeta(t, state) {
  switch (state) {
    case 'active':    return { fg: t.success, bg: t.successTint, label: 'Active',          dot: true };
    case 'ending':    return { fg: t.warning, bg: t.warningTint, label: 'Ending soon',     dot: true };
    case 'completed': return { fg: t.gold,    bg: t.goldTint,    label: 'Awaiting winners',dot: false };
    case 'draft':     return { fg: t.inkMute, bg: t.surfaceMute, label: 'Draft',           dot: false };
    default:          return { fg: t.inkMute, bg: t.surfaceMute, label: state,             dot: false };
  }
}
const METRIC_LABEL = {
  api: 'New API', apps: 'Applications', activity: 'Activity',
  persistency: 'Persistency', recruiting: 'Recruiting', custom: 'Custom',
};

// ── DATA — campaigns Trevor (South Branch BM) sees ────────────────────────
// 1) Christmas Campaign 2025 — the flagship company-wide qualify ladder, the
//    real doc. 2) South Sprint — Trevor's own branch qualify-target. 3) S·02
//    Closer's Cup — a unit placement race (1st/2nd/3rd). 4) Back-to-School —
//    completed, awaiting winner confirmation.

const XMAS_TIERS = [
  { level: 7, name: 'Pioneer',  api: 770_000, apps: 20, cash: 70_000, voucher: 3_500 },
  { level: 6, name: 'Elite',    api: 575_000, apps: 20, cash: 52_000, voucher: 2_500 },
  { level: 5, name: 'Premier',  api: 375_000, apps: 20, cash: 30_000, voucher: 2_500 },
  { level: 4, name: 'VIP',      api: 275_000, apps: 20, cash: 20_000, voucher: 2_000 },
  { level: 3, name: 'Champion', api: 200_000, apps: 20, cash: 7_000,  voucher: 2_000 },
  { level: 2, name: 'Pro',      api: 150_000, apps: 20, cash: 5_000,  voucher: 1_500 },
  { level: 1, name: 'Stella',   api: 100_000, apps: 20, cash: 3_000,  voucher: 0 },
];

// Campaign-period (Aug–Nov) settled API per agent + persistency average.
const XMAS_STANDINGS = [
  { name: 'Marsha Singh',    unit: 'S·02', initials: 'MS', api: 284_000, apps: 22, pers: 91 },
  { name: 'Anand Persad',    unit: 'S·01', initials: 'AP', api: 238_000, apps: 21, pers: 88 },
  { name: 'Selina Mohammed', unit: 'S·03', initials: 'SM', api: 206_000, apps: 20, pers: 87 },
  { name: 'Riaz Khan',       unit: 'S·02', initials: 'RK', api: 188_000, apps: 18, pers: 90 },
  { name: 'Kamla Singh',     unit: 'S·01', initials: 'KS', api: 164_000, apps: 19, pers: 86 },
  { name: 'Carla Joseph',    unit: 'S·02', initials: 'CJ', api: 142_000, apps: 16, pers: 89 },
  { name: 'Avinash Maharaj', unit: 'S·02', initials: 'AM', api: 119_000, apps: 15, pers: 84 },
  { name: 'Devin Lewis',     unit: 'S·02', initials: 'DL', api: 88_000,  apps: 12, pers: 76 },
  { name: 'Priya Naidu',     unit: 'S·01', initials: 'PN', api: 96_000,  apps: 14, pers: 72 },
];

// Resolve a standing → tier reached + gated payout. Shared by every surface.
function resolveStanding(s, tiers) {
  const tier = tierFor(s.api, s.apps, tiers);
  const gate = gateFor(s.pers);
  const grossCash = tier ? tier.cash : 0;
  const grossVoucher = tier ? tier.voucher : 0;
  return {
    ...s, tier, gate,
    cash: Math.round(grossCash * gate.payout),
    voucher: Math.round(grossVoucher * gate.payout),
    grossCash, grossVoucher,
    qualified: !!tier && gate.payout > 0,
  };
}

const CAMPAIGNS = [
  {
    id: 'xmas25', kiosk: true, meeting: true,
    name: 'Christmas Campaign 2025',
    kind: 'Company', state: 'ending', structure: 'qualify', metric: 'api',
    owner: 'Head of Sales · Felix Mahadeo',
    scopeLabel: 'All advisors · agency-wide',
    period: '1 Aug – 30 Nov 2025', daysLeft: 4, lengthLabel: '4 months',
    objective: { api: 25_000_000, apiNow: 21_400_000, apps: 2_500, appsNow: 2_180, pers: 90, persNow: 88 },
    gate: PERS_GATE,
    tiers: XMAS_TIERS,
    standings: XMAS_STANDINGS,
    prizeNote: 'Massy Stores vouchers + cash, paid Dec 2025. Tiered persistency applies to every payout.',
    accent: 'gold',
  },
  {
    id: 'south-sprint', kiosk: true, meeting: false,
    name: 'South Branch — December Sprint',
    kind: 'Branch', state: 'active', structure: 'qualify', metric: 'api',
    owner: 'You · Trevor Ramcharan',
    scopeLabel: 'South Branch · 28 advisors',
    period: '1 – 31 Dec 2025', daysLeft: 19, lengthLabel: '1 month',
    objective: { api: 1_400_000, apiNow: 612_000, apps: 140, appsNow: 58, pers: 85, persNow: 87 },
    gate: PERS_GATE,
    // single qualify target — everyone who clears it wins the same prize
    tiers: [{ level: 1, name: 'Finisher', api: 50_000, apps: 4, cash: 3_000, voucher: 0, perk: 'Half-day off + branch lunch' }],
    standings: [
      { name: 'Marsha Singh',    unit: 'S·02', initials: 'MS', api: 62_000, apps: 6, pers: 90 },
      { name: 'Anand Persad',    unit: 'S·01', initials: 'AP', api: 54_000, apps: 5, pers: 89 },
      { name: 'Riaz Khan',       unit: 'S·02', initials: 'RK', api: 48_000, apps: 5, pers: 91 },
      { name: 'Kamla Singh',     unit: 'S·01', initials: 'KS', api: 41_000, apps: 4, pers: 86 },
      { name: 'Carla Joseph',    unit: 'S·02', initials: 'CJ', api: 38_000, apps: 3, pers: 88 },
      { name: 'Avinash Maharaj', unit: 'S·02', initials: 'AM', api: 29_000, apps: 3, pers: 84 },
    ],
    prizeNote: 'Every advisor who settles TTD 50K in December wins — not a race. Qualify and the prize is yours.',
    accent: 'teal',
  },
  {
    id: 's02-cup', kiosk: true, meeting: true,
    name: "S·02 Closer's Cup",
    kind: 'Unit', state: 'active', structure: 'placement', metric: 'apps',
    owner: 'Riaz Khan · Unit Manager',
    scopeLabel: 'S·02 Unit · 5 advisors',
    period: '24 Nov – 21 Dec 2025', daysLeft: 19, lengthLabel: '4 weeks',
    objective: null,
    placements: [
      { rank: 1, prize: 2_000, label: '1st place' },
      { rank: 2, prize: 1_000, label: '2nd place' },
      { rank: 3, prize: 500,   label: '3rd place' },
    ],
    standings: [
      { name: 'Marsha Singh',    unit: 'S·02', initials: 'MS', api: 24_400, apps: 8, pers: 91 },
      { name: 'Carla Joseph',    unit: 'S·02', initials: 'CJ', api: 18_200, apps: 6, pers: 89 },
      { name: 'Avinash Maharaj', unit: 'S·02', initials: 'AM', api: 14_100, apps: 5, pers: 84 },
      { name: 'Devin Lewis',     unit: 'S·02', initials: 'DL', api: 9_600,  apps: 3, pers: 76 },
    ],
    prizeNote: 'Most applications settled by 21 Dec takes the Cup. Top three paid in the December incentive run.',
    accent: 'gold',
  },
  {
    id: 'b2s', kiosk: false, meeting: false,
    name: 'Back-to-School Drive',
    kind: 'Branch', state: 'completed', structure: 'qualify', metric: 'apps',
    owner: 'You · Trevor Ramcharan',
    scopeLabel: 'South Branch · 28 advisors',
    period: '1 – 30 Sep 2025', daysLeft: 0, lengthLabel: '1 month',
    objective: { api: 900_000, apiNow: 948_000, apps: 120, appsNow: 131, pers: 85, persNow: 88 },
    gate: PERS_GATE,
    tiers: [{ level: 1, name: 'Qualifier', api: 0, apps: 8, cash: 1_500, voucher: 0, perk: 'TTD 1,500 voucher' }],
    standings: [
      { name: 'Marsha Singh',    unit: 'S·02', initials: 'MS', api: 0, apps: 11, pers: 90 },
      { name: 'Anand Persad',    unit: 'S·01', initials: 'AP', api: 0, apps: 10, pers: 91 },
      { name: 'Selina Mohammed', unit: 'S·03', initials: 'SM', api: 0, apps: 9,  pers: 87 },
      { name: 'Kamla Singh',     unit: 'S·01', initials: 'KS', api: 0, apps: 8,  pers: 86 },
      { name: 'Jamal Khan',      unit: 'S·03', initials: 'JK', api: 0, apps: 9,  pers: 82 },
      { name: 'Priya Naidu',     unit: 'S·01', initials: 'PN', api: 0, apps: 8,  pers: 74 },
    ],
    prizeNote: 'Campaign closed 30 Sep. Confirm the winners below to release payouts to the December run.',
    accent: 'gold',
  },
];

function campaignById(id) { return CAMPAIGNS.find((c) => c.id === id); }

// Surfaces a campaign should appear on. Only live (active/ending) campaigns
// broadcast — the builder's visibility toggles drive the kiosk/meeting flags.
function isLive(c) { return c.state === 'active' || c.state === 'ending'; }
function kioskCampaigns()   { return CAMPAIGNS.filter((c) => c.kiosk && isLive(c)); }
function meetingCampaigns() { return CAMPAIGNS.filter((c) => c.meeting && isLive(c)); }

// Standings ranked by the campaign metric (shared by every surface).
function rankByMetric(c) {
  const key = c.metric === 'apps' ? 'apps' : 'api';
  return [...c.standings].sort((a, b) => b[key] - a[key]).map((s, i) => ({ ...s, rank: i + 1 }));
}

// ──────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ──────────────────────────────────────────────────────────────────────────

// Small mono eyebrow (campaigns-local; manager uses its own Eyebrow signature)
function CEyebrow({ t, color, children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: color || t.teal, fontFamily: APP_FONT_MONO,
    }}>{children}</div>
  );
}

function StateBadge({ t, state }) {
  const m = stateMeta(t, state);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999,
      background: m.bg, color: m.fg, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', fontFamily: APP_FONT_MONO,
    }}>
      {m.dot && <span className="a-breathe" style={{ width: 6, height: 6, borderRadius: '50%', background: m.fg }}></span>}
      {m.label}
    </span>
  );
}

function KindBadge({ t, kind }) {
  const m = kindMeta(t, kind);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
      background: m.bg, color: m.fg, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      fontFamily: APP_FONT_MONO,
    }}>{m.label}</span>
  );
}

// Avatar circle
function Ava({ t, initials, size = 34, tone = 'teal' }) {
  const fg = tone === 'gold' ? t.gold : t.teal;
  const bg = tone === 'gold' ? t.goldTint : t.tealTint;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, color: fg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38, fontFamily: APP_FONT_DISPLAY,
    }}>{initials}</div>
  );
}

// ── Persistency gate strip — the signature multiplier visual ──────────────
function PersGate({ t, gate = PERS_GATE, current = null, compact = false }) {
  const toneColor = (tone) => tone === 'success' ? t.success : tone === 'gold' ? t.gold : tone === 'warning' ? t.warning : t.danger;
  const activeIdx = current != null ? gate.findIndex((g) => current >= g.min) : -1;
  return (
    <div style={{ display: 'flex', gap: compact ? 5 : 7, alignItems: 'stretch' }}>
      {gate.map((g, i) => {
        const c = toneColor(g.tone);
        const on = i === activeIdx;
        const hi = i === 0 ? '≥90%' : i === 1 ? '85–89%' : i === 2 ? '80–84%' : '<80%';
        return (
          <div key={i} style={{
            flex: 1, padding: compact ? '7px 8px' : '9px 11px', borderRadius: 9,
            background: on ? c : (g.tone === 'danger' ? t.surfaceMute : `${c}14`),
            border: `1px solid ${on ? c : `${c}33`}`,
            position: 'relative',
          }}>
            <div style={{ fontSize: compact ? 8.5 : 9, fontWeight: 700, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO, color: on ? (g.tone === 'danger' ? '#fff' : '#fff') : c }}>{hi}</div>
            <div style={{ fontSize: compact ? 13 : 16, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 2, color: on ? '#fff' : c }}>{g.label}</div>
            {!compact && <div style={{ fontSize: 8.5, color: on ? 'rgba(255,255,255,0.85)' : t.inkFaint, marginTop: 1 }}>{i === 3 ? 'no payout' : 'of prize'}</div>}
            {on && <div style={{ position: 'absolute', top: -7, right: 8, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO, color: '#fff', background: c, padding: '1px 6px', borderRadius: 999, border: `1px solid ${t.surface}` }}>YOU</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Objective progress — company target bars (API / apps / persistency) ───
function ObjectiveBar({ t, label, now, target, fmt, accent }) {
  const pct = Math.min(100, Math.round((now / target) * 100));
  const c = accent || t.teal;
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: c, fontFamily: APP_FONT_MONO }}>{pct}%</span>
      </div>
      <div style={{ height: 7, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
        <div className="a-progress-grow" style={{ width: `${pct}%`, height: 7, background: `linear-gradient(90deg, ${t.tealDark}, ${c})`, borderRadius: 999 }}></div>
      </div>
      <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 5, fontFamily: APP_FONT_MONO }}>{fmt(now)} <span style={{ color: t.inkFaint }}>/ {fmt(target)}</span></div>
    </div>
  );
}

Object.assign(window, {
  PERS_GATE, gateFor, tierFor, kindMeta, stateMeta, METRIC_LABEL,
  XMAS_TIERS, XMAS_STANDINGS, resolveStanding, CAMPAIGNS, campaignById,
  isLive, kioskCampaigns, meetingCampaigns, rankByMetric,
  CEyebrow, StateBadge, KindBadge, Ava, PersGate, ObjectiveBar,
});

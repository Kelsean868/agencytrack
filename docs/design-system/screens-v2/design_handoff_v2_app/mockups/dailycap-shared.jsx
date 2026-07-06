// Daily Capture v2 — shared model, sample data, daily anchor, mode atoms.
//
// Daily Capture is the mobile-first quick log behind the central Submit FAB.
// Grounded in the repo:
//   • dailyActivityService → tenants/{t}/users/{uid}/dailyActivity/{date}
//   • loggingModeService → daily / weekly / HYBRID, with safe mid-week
//     transitions (daily entries aggregate into the weekly draft on Sunday;
//     a weekly draft converts to a dated catch-up daily entry when switching).
//   • A daily entry captures the SAME field set as the weekly report, per day.
//
// Reporting-mode governance (designed here — no UI existed):
//   tenant default → branch → unit → agent, each level can RECOMMEND (agent
//   may still change) or LOCK (agent can't). Most-specific wins unless a
//   higher level locked it. Every surface shows provenance.

// ── The full per-day field set (mirrors the weekly submission schema) ───────
const DC_FIELD_GROUPS = [
  { key: 'prospecting', label: 'Prospecting', tone: 'accent', fields: [
    { key: 'qualifiedApproaches', label: 'Qualified approaches', short: 'Approaches' },
    { key: 'newNames',            label: 'New names added',       short: 'New names' },
    { key: 'oldNames',            label: 'Old names worked',      short: 'Old names' },
    { key: 'serviceContacts',     label: 'Service contacts',      short: 'Service' },
  ] },
  { key: 'appointments', label: 'Appointments & FFI', tone: 'teal', fields: [
    { key: 'appointmentsSet', label: 'Appointments set',  short: 'Appts set' },
    { key: 'ffisScheduled',   label: 'FFIs scheduled',    short: 'FFI sched' },
    { key: 'ffiConducted',    label: 'FFIs conducted',    short: 'FFI done' },
  ] },
  { key: 'interviews', label: 'Interviews', tone: 'gold', fields: [
    { key: 'newCIBooked',          label: 'New CIs booked',         short: 'New CI' },
    { key: 'oldCIBooked',          label: 'Old CIs booked',         short: 'Old CI' },
    { key: 'ciConducted',          label: 'CIs conducted',          short: 'CI done' },
    { key: 'solutionPresentations',label: 'Solution presentations', short: 'Present.' },
  ] },
];

// Production block (currency / apps) — kept separate from the count steppers.
const DC_PRODUCTION = [
  { key: 'newBizApps', label: 'New business — apps', kind: 'count' },
  { key: 'newBizApi',  label: 'New business — API',  kind: 'money' },
  { key: 'pppApps',    label: 'PPP increases — apps',kind: 'count', advanced: true },
  { key: 'pppApi',     label: 'PPP increases — API', kind: 'money', advanced: true },
  { key: 'lumpsum',    label: 'Lumpsum — gross',     kind: 'money', advanced: true },
];

// ── Sample state — Marsha, Thu 27 Nov, mid-week, on DAILY mode ───────────────
const DAILY_SAMPLE = {
  agent: 'Marsha Singh',
  date: 'THU · 27 NOV',
  weekShort: 'WK 48',
  dayOfWeek: 'Thursday',

  mode: 'daily',                                  // effective mode
  modeProvenance: { source: 'self' },             // 'self' | { by, role, locked }

  streak: { current: 9, best: 14, loggedToday: false, milestone: 10 },

  // today's in-progress entry + a light per-day target for the anchor
  today: {
    entry: {
      qualifiedApproaches: 6, newNames: 3, oldNames: 5, serviceContacts: 4,
      appointmentsSet: 3, ffisScheduled: 2, ffiConducted: 1,
      newCIBooked: 2, oldCIBooked: 1, ciConducted: 2, solutionPresentations: 1,
      newBizApps: 1, newBizApi: 8400, pppApps: 0, pppApi: 0, lumpsum: 0,
    },
    target: { ffiConducted: 1, ciConducted: 2, appointmentsSet: 3, qualifiedApproaches: 6 },
    apiCredit: 8400,
  },

  // week-to-date totals vs the (manager-set) weekly target
  week: {
    api:   { cur: 18400, tgt: 18000 },
    apps:  { cur: 2,     tgt: 2 },
    ffi:   { cur: 4,     tgt: 4 },
    ci:    { cur: 2,     tgt: 2 },
    dials: { cur: 38,    tgt: 40 },
    daysLogged: 4, daysExpected: 4,
  },

  // ── Manager view: team reporting-mode control ──
  tenantDefault: 'weekly',
  team: [
    { name: 'Marsha Singh',    unit: 'S·02', mode: 'daily',  setBy: 'self',                       locked: false, lastLogged: 'Today' },
    { name: 'Anand Persad',    unit: 'S·01', mode: 'weekly', setBy: 'tenant default',             locked: false, lastLogged: 'Mon' },
    { name: 'Selina Mohammed', unit: 'S·03', mode: 'hybrid', setBy: 'self',                       locked: false, lastLogged: 'Today' },
    { name: 'Riaz Khan',       unit: 'S·02', mode: 'daily',  setBy: 'T. Ramcharan · Unit Mgr',    locked: true,  lastLogged: 'Today', assigned: true },
    { name: 'Jamal Khan',      unit: 'S·03', mode: 'daily',  setBy: 'T. Ramcharan · Unit Mgr',    locked: true,  lastLogged: '3d ago', assigned: true, behind: true },
    { name: 'Devin Lewis',     unit: 'S·02', mode: 'weekly', setBy: 'tenant default',             locked: false, lastLogged: 'Sun' },
  ],

  manager: { name: 'T. Ramcharan', role: 'Unit Manager' },
};

const DC_MODES = [
  { key: 'daily',  label: 'Daily',  Icon: 'IconClock',  blurb: 'Log a little every day' },
  { key: 'weekly', label: 'Weekly', Icon: 'IconWizard', blurb: 'One report each Sunday' },
  { key: 'hybrid', label: 'Hybrid', Icon: 'IconRepeat', blurb: 'Daily logging + weekly review' },
];
const DC_MODE_LABEL = { daily: 'Daily', weekly: 'Weekly', hybrid: 'Hybrid' };

// ── Format helpers ──────────────────────────────────────────────────────────
function dcK(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000)    return `${Math.round(n / 1000)}K`;
  if (n >= 1000)      return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}
function dcTtd(n) { return `TTD ${dcK(n)}`; }

// ── ModeBadge — current mode pill ───────────────────────────────────────────
function ModeBadge({ t, mode, size = 'sm' }) {
  const tone = mode === 'daily' ? t.teal : mode === 'weekly' ? t.inkAccent : t.gold;
  const tint = mode === 'daily' ? t.tealTint : mode === 'weekly' ? t.inkAccentTint : t.goldTint;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: size === 'sm' ? '2px 9px' : '4px 11px', borderRadius: 999,
      background: tint, color: tone,
      fontSize: size === 'sm' ? 9.5 : 11, fontWeight: 700,
      letterSpacing: '0.06em', fontFamily: APP_FONT_MONO, textTransform: 'uppercase',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: tone }}></span>
      {DC_MODE_LABEL[mode]}
    </span>
  );
}

// ── ProvenanceTag — who set the mode ────────────────────────────────────────
function ProvenanceTag({ t, prov }) {
  if (!prov || prov.source === 'self') {
    return <span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>YOUR CHOICE</span>;
  }
  const locked = prov.locked;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 9.5, fontWeight: 700, color: locked ? t.warning : t.gold,
      fontFamily: APP_FONT_MONO, letterSpacing: '0.04em',
    }}>
      {locked ? (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
      ) : null}
      {locked ? 'LOCKED' : 'SUGGESTED'} · {prov.by}
    </span>
  );
}

// ── DailyAnchorStrip — today + week-to-date, streak, mode ───────────────────
function DailyAnchorStrip({ t, data, mobile = true }) {
  const s = data.streak;
  const w = data.week;
  const apiPct = Math.min(100, Math.round((w.api.cur / w.api.tgt) * 100));
  return (
    <div className="a-card a-rise" style={{
      position: 'relative', overflow: 'hidden', flexShrink: 0,
      padding: mobile ? '14px 16px' : '18px 22px',
      background: t.surface, border: `1px solid ${t.teal}55`, borderRadius: 14,
      boxShadow: `0 6px 18px ${t.mode === 'light' ? 'rgba(1,105,111,0.08)' : 'rgba(0,0,0,0.4)'}`,
    }}>
      <div className="a-glow-soft" style={{ position: 'absolute', top: -70, right: -70, width: 220, height: 220, background: `radial-gradient(circle, ${t.tealTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Eyebrow t={t} color={t.teal}>{data.date}</Eyebrow>
            <ModeBadge t={t} mode={data.mode} />
          </div>
          <div style={{ fontSize: mobile ? 19 : 24, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.15, marginTop: 7 }}>
            {s.loggedToday ? 'Today\u2019s activity is logged' : 'Log today before you clock off'}
          </div>
          <div style={{ marginTop: 6 }}><ProvenanceTag t={t} prov={data.modeProvenance} /></div>
        </div>
        {/* Streak flame */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div className={s.current > 0 ? 'a-breathe' : ''} style={{
            width: 46, height: 46, borderRadius: 12, margin: '0 auto',
            background: s.current > 0 ? `linear-gradient(180deg, ${t.gold}, ${t.warning})` : t.surfaceMute,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: s.current > 0 ? `0 3px 10px ${t.warning}55` : 'none',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M12 2c-1 4-4 5-4 9 0 3 2 5 4 5s4-2 4-5c0-1 0-2 1-3 1 2 3 4 3 7 0 4-3 7-7 7-3.8 0-7-3-7-7 0-5 4-7 6-13z"/></svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 5, lineHeight: 1 }}>{s.current}</div>
          <div style={{ fontSize: 8.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em', marginTop: 2 }}>DAY STREAK</div>
        </div>
      </div>

      {/* Week-to-date bar */}
      <div style={{ position: 'relative', marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.1em' }}>WEEK TO DATE · {data.weekShort}</span>
          <span style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{dcTtd(w.api.cur)} / {dcTtd(w.api.tgt)}</span>
        </div>
        <div style={{ height: 7, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
          <div className="a-progress-grow" style={{ width: `${apiPct}%`, height: 7, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999, transformOrigin: 'left center' }}></div>
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
          {[
            { k: 'APPS', v: `${w.apps.cur}/${w.apps.tgt}`, ok: w.apps.cur >= w.apps.tgt },
            { k: 'FFI',  v: `${w.ffi.cur}/${w.ffi.tgt}`,   ok: w.ffi.cur >= w.ffi.tgt },
            { k: 'CI',   v: `${w.ci.cur}/${w.ci.tgt}`,     ok: w.ci.cur >= w.ci.tgt },
            { k: 'DIALS',v: `${w.dials.cur}/${w.dials.tgt}`,ok: w.dials.cur >= w.dials.tgt },
          ].map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.ok ? t.success : t.warning }}></span>
              <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>{c.k}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{c.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── DCManagerBanner — gold "you're setting team modes" clarifier ────────────
function DCManagerBanner({ t, data }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: t.goldTint, border: `1px solid ${t.gold}55`, borderRadius: 11, flexShrink: 0 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.gold, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>TR</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: t.ink }}>
          Setting reporting mode for your unit — a <span style={{ color: t.gold }}>suggestion</span> lets the agent change it; a <span style={{ color: t.warning }}>lock</span> holds it.
        </div>
        <div style={{ fontSize: 10, color: t.inkMute, marginTop: 2, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>
          MANAGER VIEW · {data.manager.name.toUpperCase()} · {data.manager.role.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  DC_FIELD_GROUPS, DC_PRODUCTION, DAILY_SAMPLE, DC_MODES, DC_MODE_LABEL,
  dcK, dcTtd, ModeBadge, ProvenanceTag, DailyAnchorStrip, DCManagerBanner,
});

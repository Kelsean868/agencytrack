// AgencyTrack — Weekly WARs v2. Shared data + primitives.
//
// WAR = Weekly Activity Report. The manager's edition of the agent weekly
// report: the regular production/activity KPIs PLUS managerial KPIs (the
// leadership cadence — 1:1s, joint field work, recruiting, training, unit
// meeting, dashboard review). A manager FILES their own WAR (reviewed one
// tier up) and REVIEWS the WARs of the leaders who report to them.
//
// Trevor (South Branch Manager) → reviews his 5 leadership reports
// (3 Unit Managers + 2 Supervisors) and files his own (to the Sales Manager).
//
// Targets are CONFIGURABLE by upper management — none are mandatory yet, so
// every KPI carries an optional target (null = "no minimum set"). Surfaces
// must read gracefully whether or not a target exists.
// Reuses app-tokens, app-shell, app-motion, manager-v2-shared, app-mobile.

// ── WAR KPI definitions ───────────────────────────────────────────────────
// kind: 'count' (actual vs optional numeric target) · 'check' (done / not).
// target null → no minimum set by admin yet.
const WAR_KPIS = [
  { key: 'oneonone', label: '1-on-1 reviews', kind: 'count', target: 4,    hint: 'Coaching sessions with agents' },
  { key: 'jfw',      label: 'Joint field work', kind: 'count', target: 4,  hint: 'Joint calls / field accompaniment' },
  { key: 'recruits', label: 'Recruiting touches', kind: 'count', target: null, hint: 'Feeds Monthly Recruiting' },
  { key: 'training', label: 'Training delivered', kind: 'count', target: 1, hint: 'Skills / product sessions' },
  { key: 'unitmtg',  label: 'Unit meeting', kind: 'check', target: null,   hint: 'Weekly team huddle held' },
  { key: 'dash',     label: 'Dashboard review', kind: 'check', target: null, hint: 'Reviewed team dashboard' },
];

// Production block — managers also sell (player-coach). Mirrors the agent
// weekly report's headline numbers, kept separate from team totals.
function warProduction(apiWeek, apps) { return { apiWeek, apps }; }

// ── The branch leadership team that files WARs (Trevor reviews these 5) ────
// status: 'filed' (submitted) · 'draft' (started) · 'missing' (not filed).
// kpis values align to WAR_KPIS order. prod = their own personal selling.
const WAR_TEAM = [
  {
    name: 'Riaz Khan', initials: 'RK', role: 'Unit Manager', unit: 'S·02',
    status: 'filed', filedOn: 'Mon 9:12 AM', reviewed: false,
    kpis: { oneonone: 4, jfw: 5, recruits: 2, training: 1, unitmtg: true, dash: true },
    prod: warProduction(14_600, 4), streak: 9,
    note: 'Strong week — Marsha on MDRT pace, two recruits progressing to interview.',
  },
  {
    name: 'Camille Rampersad', initials: 'CR', role: 'Unit Manager', unit: 'S·01',
    status: 'filed', filedOn: 'Mon 8:40 AM', reviewed: true,
    kpis: { oneonone: 4, jfw: 3, recruits: 1, training: 1, unitmtg: true, dash: true },
    prod: warProduction(9_200, 3), streak: 12,
    note: 'Priya Naidu persistency still a concern — coaching plan in place.',
  },
  {
    name: 'Anil Gosine', initials: 'AG', role: 'Unit Manager', unit: 'S·03',
    status: 'draft', filedOn: null, reviewed: false,
    kpis: { oneonone: 2, jfw: 2, recruits: 0, training: 0, unitmtg: true, dash: false },
    prod: warProduction(7_800, 2), streak: 0,
    note: 'Draft started Sun — 1-on-1s behind, Jamal Khan report still missing.',
  },
  {
    name: 'Renee Baptiste', initials: 'RB', role: 'Supervisor', unit: 'S·01',
    status: 'filed', filedOn: 'Mon 7:55 AM', reviewed: false,
    kpis: { oneonone: 3, jfw: 4, recruits: 1, training: 1, unitmtg: true, dash: true },
    prod: warProduction(6_400, 2), streak: 6,
    note: 'Ran the prospecting clinic — good turnout, two referrals into pipeline.',
  },
  {
    name: 'Kavi Persad', initials: 'KP', role: 'Team Lead', unit: 'S·03',
    status: 'missing', filedOn: null, reviewed: false,
    kpis: { oneonone: 0, jfw: 0, recruits: 0, training: 0, unitmtg: false, dash: false },
    prod: warProduction(0, 0), streak: 0,
    note: null,
  },
];

// Trevor's OWN WAR (he files up to the Sales Manager).
const MY_WAR = {
  name: 'Trevor Ramcharan', initials: 'TR', role: 'Branch Manager', unit: 'South Branch',
  status: 'draft', week: 'Week 48', filedOn: null, reviewed: false,
  kpis: { oneonone: 4, jfw: 3, recruits: 1, training: 1, unitmtg: true, dash: false },
  prod: warProduction(8_200, 2), streak: 7,
};

// 8-week filing history per leader (1 = filed, 0 = missed) → streak/consistency.
const WAR_HISTORY = {
  'Riaz Khan':        [1, 1, 1, 1, 1, 1, 1, 1],
  'Camille Rampersad':[1, 1, 1, 1, 1, 1, 1, 1],
  'Anil Gosine':      [1, 1, 0, 1, 1, 0, 1, 0],
  'Renee Baptiste':   [1, 0, 1, 1, 1, 1, 1, 1],
  'Kavi Persad':      [0, 1, 0, 0, 1, 0, 0, 0],
};

// ── Derived helpers ───────────────────────────────────────────────────────
function warCompletion(kpis) {
  // % of KPIs that hit target (count: >=target when target set, else any>0;
  // check: true). KPIs with no target count as met when there's any activity.
  let met = 0;
  for (const k of WAR_KPIS) {
    const v = kpis[k.key];
    if (k.kind === 'check') { if (v) met++; }
    else if (k.target != null) { if (v >= k.target) met++; }
    else { if (v > 0) met++; }
  }
  return Math.round((met / WAR_KPIS.length) * 100);
}
function warStatusMeta(t, status) {
  switch (status) {
    case 'filed':   return { fg: t.success, bg: t.successTint, label: 'Filed' };
    case 'draft':   return { fg: t.warning, bg: t.warningTint, label: 'Draft' };
    case 'missing': return { fg: t.danger,  bg: t.dangerTint,  label: 'Not filed' };
    default:        return { fg: t.inkMute, bg: t.surfaceMute, label: status };
  }
}
const WAR_FILED = WAR_TEAM.filter((m) => m.status === 'filed').length;
const WAR_PENDING_REVIEW = WAR_TEAM.filter((m) => m.status === 'filed' && !m.reviewed).length;
const WAR_NOT_FILED = WAR_TEAM.filter((m) => m.status !== 'filed').length;

// ──────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ──────────────────────────────────────────────────────────────────────────

function WAREyebrow({ t, color, children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: color || t.teal, fontFamily: APP_FONT_MONO }}>{children}</div>
  );
}

function WarStatusPill({ t, status }) {
  const m = warStatusMeta(t, status);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, background: m.bg, color: m.fg, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{m.label}</span>
  );
}

// Completion ring — small donut for % of KPIs met
function CompletionRing({ t, pct, size = 48, stroke = 5, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const c = color || (pct >= 80 ? t.success : pct >= 50 ? t.warning : t.danger);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.surfaceMute} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.26, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{pct}</div>
    </div>
  );
}

// KPI chip — actual vs target (or done/not for checks)
function WarKpiChip({ t, kpi, value, interactive = false }) {
  const isCheck = kpi.kind === 'check';
  const met = isCheck ? !!value : (kpi.target != null ? value >= kpi.target : value > 0);
  const noTarget = !isCheck && kpi.target == null;
  const fg = met ? t.success : value > 0 ? t.warning : t.inkFaint;
  const bg = met ? t.successTint : value > 0 ? t.warningTint : t.surfaceMute;
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', background: t.surface, border: `1px solid ${met ? fg + '44' : t.rule}`, borderRadius: 11 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkMute, letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kpi.label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 6 }}>
        {isCheck ? (
          <span style={{ fontSize: 16, fontWeight: 700, color: met ? t.success : t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{met ? '✓ Done' : '· Not yet'}</span>
        ) : (
          <>
            <span style={{ fontSize: 22, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 0.9 }}>{value}</span>
            <span style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, paddingBottom: 2 }}>{kpi.target != null ? `/ ${kpi.target}` : 'no min'}</span>
          </>
        )}
        <div style={{ flex: 1 }}></div>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: fg, marginBottom: 4 }}></span>
      </div>
      {!isCheck && kpi.target != null && (
        <div style={{ marginTop: 8, height: 3, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, Math.round((value / kpi.target) * 100))}%`, height: 3, background: fg, borderRadius: 999 }}></div>
        </div>
      )}
      {noTarget && <div style={{ marginTop: 8, height: 3, background: t.surfaceMute, borderRadius: 999 }}></div>}
    </div>
  );
}

// Filing-history dots (8 weeks) → consistency
function StreakDots({ t, history, label = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {history.map((v, i) => (
          <div key={i} title={`Week ${48 - (history.length - 1 - i)}`} style={{
            width: 8, height: 8, borderRadius: 2,
            background: v ? t.success : t.dangerTint,
            border: v ? 'none' : `1px solid ${t.danger}55`,
          }}></div>
        ))}
      </div>
      {label && <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginLeft: 3 }}>8 wks</span>}
    </div>
  );
}

Object.assign(window, {
  WAR_KPIS, warProduction, WAR_TEAM, MY_WAR, WAR_HISTORY,
  warCompletion, warStatusMeta, WAR_FILED, WAR_PENDING_REVIEW, WAR_NOT_FILED,
  WAREyebrow, WarStatusPill, CompletionRing, WarKpiChip, StreakDots,
});

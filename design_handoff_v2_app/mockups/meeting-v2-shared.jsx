// AgencyTrack — Meeting Mode v2. Shared theme, data, KPI defs, stage chrome.
//
// The full-screen "Start meeting" stand-up the Manager Dashboard launches. A
// guided, TV-friendly presentation (not a table) that carries the v2 grammar
// onto a projection surface:
//   • Opens on the team's REALITY (week pulse + cascade + who-needs-attention),
//     exception-first ordering through the run.
//   • Each agent step shows their WEEK: the company-floor activity KPIs (the
//     minimum set the manager can reorder) + the resulting New API & Apps.
//   • Gold = recognition only · teal = primary · amber/danger = exceptions.
//   • Manager-driving chrome: agenda rail, progress, quick actions, presenter
//     notes the room doesn't see. Projection = the same minus the chrome.
//
// Reuses app-tokens (APP_DARK/APP_LIGHT, icons, ttd) + app-motion (AmbientBg).
// Kiosk-style 16:9 projection frame.

const MTG_W = 1280;
const MTG_H = 720;

// Projection-tuned dark (deeper than the app's dark for a dim room) + the
// app's light for the open-slide light variant.
const MEETING_DARK = {
  ...APP_DARK,
  bg: '#120F0B', surface: '#1E1914', surfaceRaised: '#2A2319',
  surfaceSoft: '#19140F', surfaceMute: '#221C16',
};
const MEETING_LIGHT = APP_LIGHT;

// ──────────────────────────────────────────────────────────────────────────
// MEETING META — South Branch · Trevor Ramcharan · Week 48 Monday stand-up.
// ──────────────────────────────────────────────────────────────────────────
const MEETING = {
  branch: 'South Branch', week: 'Week 48', day: 'Monday', date: 'Mon · 30 Nov',
  manager: 'Trevor Ramcharan', managerInitials: 'TR',
  weekApi: 142_000, weekApps: 38, weekFfi: 47,
  ytdApi: 8_420_000, branchGoal: 12_000_000, companyFloor: 9_600_000, smTarget: 11_000_000,
  weeksLeft: 5, agents: 28, onPace: 18, needAttention: 5, toCelebrate: 3,
};

// ──────────────────────────────────────────────────────────────────────────
// COMPANY-FLOOR ACTIVITY KPIs — the minimum weekly set. The manager can
// reorder / choose which of the full collected set to project; `shown`
// captures the default ordered subset (= the company floor activity KPIs).
// ──────────────────────────────────────────────────────────────────────────
// Company minimum weekly activity floors (repo: weeklyActivityFloors.js —
// DEFAULT_WEEKLY_ACTIVITY_FLOORS). API & Applications are the result, shown in
// the hero; these 8 are the activity inputs projected as tiles. Interviews
// Kept = Fact Finds + Closing Interviews (the company's derived row).
const FLOOR_KPIS = [
  { key: 'calls',      label: 'Calls Made',         floor: 60 },
  { key: 'contacts',   label: 'Contacts Made',      floor: 40 },
  { key: 'appts',      label: 'Appointments',       floor: 20 },
  { key: 'interviews', label: 'Interviews Kept',    floor: 15 },
  { key: 'factfinds',  label: 'Fact Finds',         floor: 10 },
  { key: 'closing',    label: 'Closing Interviews', floor: 10 },
  { key: 'clients',    label: 'Clients Sold',       floor: 1 },
  { key: 'referrals',  label: 'Referrals',          floor: 100 },
];

// status of an actual against a floor: met / at (within 90%) / below.
function kpiStatus(actual, floor) {
  if (actual >= floor) return 'met';
  if (actual >= floor * 0.9) return 'at';
  return 'below';
}

// ──────────────────────────────────────────────────────────────────────────
// KPI ROLLUP — the full granular set the daily/weekly wizards capture rolls
// UP into the company-floor categories. We keep both: managers choose how much
// detail to show. Each floor category lists the granular children it's built
// from; granular values are derived from the floor actual by share (the mock
// doesn't re-enter every wizard field).
//   density 'condensed' → the floor categories (company template)
//   density 'coach'     → floor, with Contact + Closing expanded (the middle)
//   density 'full'      → every granular data point (master-sheet detail)
// ──────────────────────────────────────────────────────────────────────────
const KPI_GROUPS = [
  { key: 'calls',      label: 'Calls Made',         short: 'Calls', floor: 60,  kids: [['dials', 'Dials', 1]] },
  { key: 'contacts',   label: 'Contacts Made',      short: 'Cont',  floor: 40,  kids: [['telc', 'Tel Contacts', 0.62], ['f2f', 'F2F Approaches', 0.38]] },
  { key: 'appts',      label: 'Appointments',       short: 'Appt',  floor: 20,  kids: [['apptset', 'Appts Set', 0.6], ['ffisch', 'FFIs Scheduled', 0.4]] },
  { key: 'interviews', label: 'Interviews Kept',    short: 'Int',   floor: 15,  kids: [['ffik', 'Fact-Find Ints', 0.6], ['cik', 'Closing Ints', 0.4]] },
  { key: 'factfinds',  label: 'Fact Finds',         short: 'FF',    floor: 10,  kids: [['ffidone', 'FFIs Conducted', 1]] },
  { key: 'closing',    label: 'Closing Interviews', short: 'CI',    floor: 10,  kids: [['newci', 'New CI', 0.7], ['oldci', 'Old CI', 0.3]] },
  { key: 'clients',    label: 'Clients Sold',       short: 'Clts',  floor: 1,   kids: [['newcl', 'New Clients', 1]] },
  { key: 'referrals',  label: 'Referrals',          short: 'Ref',   floor: 100, kids: [['newnames', 'New Names', 1]] },
];
const KPI_BY = Object.fromEntries(KPI_GROUPS.map((g) => [g.key, g]));

// derive a group's granular children from its floor actual (last child gets the remainder)
function kidValues(act, g) {
  const base = act && act[g.key] != null ? act[g.key] : 0;
  let acc = 0;
  return g.kids.map((k, i) => {
    let v = i === g.kids.length - 1 ? base - acc : Math.round(base * k[2]);
    acc += v;
    return { key: k[0], label: k[1], value: Math.max(0, v), floor: Math.max(1, Math.round(g.floor * k[2])) };
  });
}

// resolve the ordered column set for a density. Each col: {key,label,short,floor,get(act)}
function resolveKpiCols(density) {
  const grp = (g) => ({ key: g.key, label: g.label, short: g.short, floor: g.floor, get: (act) => {
    if (!act) return 0;
    if (g.key === 'interviews' && act.interviews == null) return (act.factfinds || 0) + (act.closing || 0);
    return act[g.key] != null ? act[g.key] : 0;
  } });
  const kid = (g, i) => { const k = g.kids[i]; return { key: k[0], label: k[1], short: k[1], floor: Math.max(1, Math.round(g.floor * k[2])), get: (act) => kidValues(act, g)[i].value }; };
  if (density === 'full') {
    const out = [];
    KPI_GROUPS.forEach((g) => { if (g.key === 'interviews') return; g.kids.forEach((_, i) => out.push(kid(g, i))); });
    return out;
  }
  if (density === 'coach') {
    return [grp(KPI_BY.calls), kid(KPI_BY.contacts, 0), kid(KPI_BY.contacts, 1), grp(KPI_BY.appts), grp(KPI_BY.factfinds), kid(KPI_BY.closing, 0), grp(KPI_BY.clients), grp(KPI_BY.referrals)];
  }
  return KPI_GROUPS.map(grp); // condensed
}
function resolveTiles(act, density) {
  return resolveKpiCols(density).map((c) => ({ key: c.key, label: c.label, floor: c.floor, actual: c.get(act) }));
}
const KPI_DENSITY_LABEL = { condensed: 'Company floor', coach: "Coach's set", full: 'Full detail' };

// ──────────────────────────────────────────────────────────────────────────
// THE RUN — agents to step through, exception-first then on-pace, aligned to
// the dashboard's 5 exceptions + champions. act = this week's activity keyed
// to FLOOR_KPIS; ratios/eval feed the 1:1 deep step.
// ──────────────────────────────────────────────────────────────────────────
const RUN = [
  {
    id: 'devin', name: 'Devin Lewis', initials: 'DL', unit: 'S·02', level: 'L1',
    submitted: true, flag: 'floor', flagLabel: 'Below floor', tone: 'danger',
    reason: 'TTD 122k YTD · TTD 128k below the L1 tenure floor. 7 of 8 activity standards below floor this week.',
    headline: 'A pace problem, not a closing one — book more approaches. Pairing with Anand for joint calls.',
    note: 'Activity down two weeks running. Set a daily reporting cadence until he clears floor — recommend, don\u2019t lock.',
    weekApi: 3_400, apps: 1, spark: [38, 30, 22, 26, 18, 14],
    act: { calls: 44, contacts: 26, appts: 11, interviews: 9, factfinds: 6, closing: 3, clients: 1, referrals: 62 },
    ratios: [
      { label: 'Approach → FFI', value: '40%', tone: 'warning' },
      { label: 'FFI → CI', value: '50%', tone: 'warning' },
      { label: 'CI → App', value: '100%', tone: 'success' },
      { label: 'Closing ratio', value: '55%', tone: 'warning' },
    ],
    evalNote: 'Felt the FFIs went well but I\u2019m not booking enough approaches. Need to block call-time mornings.',
    evals: [
      { label: 'Planning', value: 6 }, { label: 'Time Mgmt', value: 4 },
      { label: 'Sales Perf.', value: 6 }, { label: 'Prospecting', value: 3 }, { label: 'Overall', value: 5 },
    ],
  },
  {
    id: 'avinash', name: 'Avinash Maharaj', initials: 'AM', unit: 'S·02', level: 'L2',
    submitted: true, flag: 'pace', flagLabel: 'Off pace', tone: 'warning',
    reason: '54% to commitment · TTD 96k to close in 6 weeks. Weekly activity is fine; the gap is cumulative.',
    headline: 'Strong week, but behind on the annual commitment. Map the 6-week close plan together.',
    note: 'Activity solid. Focus the 1:1 on the commitment gap, not this week\u2019s numbers.',
    weekApi: 9_400, apps: 2, spark: [44, 40, 46, 38, 41, 36],
    act: { calls: 61, contacts: 36, appts: 16, interviews: 12, factfinds: 7, closing: 5, clients: 2, referrals: 84 },
    ratios: [
      { label: 'Approach → FFI', value: '50%', tone: 'success' },
      { label: 'FFI → CI', value: '50%', tone: 'warning' },
      { label: 'CI → App', value: '100%', tone: 'success' },
      { label: 'Closing ratio', value: '65%', tone: 'success' },
    ],
    evalNote: 'I know I\u2019m behind for the year. If I hold this weekly pace I can still close it.',
    evals: [
      { label: 'Planning', value: 6 }, { label: 'Time Mgmt', value: 7 },
      { label: 'Sales Perf.', value: 7 }, { label: 'Prospecting', value: 6 }, { label: 'Overall', value: 7 },
    ],
  },
  {
    id: 'hema', name: 'Hema Lakhan', initials: 'HL', unit: 'S·01', level: 'L2',
    submitted: true, flag: 'quiet', flagLabel: 'Gone quiet', tone: 'warning',
    reason: 'No daily activity logged in 4 days. Last log Sun 22 Nov — usually a daily reporter.',
    headline: 'Out of character. Check in personally before coaching the numbers.',
    note: 'Quiet 4 days — unusual. Likely something off-system. Call her first.',
    weekApi: 4_100, apps: 0, spark: [22, 24, 20, 6, 0, 0],
    act: { calls: 14, contacts: 7, appts: 3, interviews: 3, factfinds: 2, closing: 1, clients: 0, referrals: 18 },
    ratios: [
      { label: 'Approach → FFI', value: '—', tone: 'mute' },
      { label: 'FFI → CI', value: '—', tone: 'mute' },
      { label: 'CI → App', value: '—', tone: 'mute' },
      { label: 'Closing ratio', value: '—', tone: 'mute' },
    ],
    evalNote: '',
    evals: [
      { label: 'Planning', value: 0 }, { label: 'Time Mgmt', value: 0 },
      { label: 'Sales Perf.', value: 0 }, { label: 'Prospecting', value: 0 }, { label: 'Overall', value: 0 },
    ],
  },
  {
    id: 'priya', name: 'Priya Naidu', initials: 'PN', unit: 'S·01', level: 'L1',
    submitted: true, flag: 'persist', flagLabel: 'Persistency', tone: 'warning',
    reason: '72% persistency · 8pp below the 80% threshold. 3 lapses this quarter, 1 in grace.',
    headline: 'Sales pace is fine — the leak is at the back end. Review the lapsing book together.',
    note: 'Coach conservation: call the 1 policy in grace this week. Strong activity otherwise.',
    weekApi: 6_800, apps: 1, spark: [84, 82, 79, 77, 74, 72],
    act: { calls: 58, contacts: 38, appts: 18, interviews: 13, factfinds: 9, closing: 4, clients: 1, referrals: 96 },
    ratios: [
      { label: 'Approach → FFI', value: '60%', tone: 'success' },
      { label: 'FFI → CI', value: '33%', tone: 'warning' },
      { label: 'CI → App', value: '100%', tone: 'success' },
      { label: 'Closing ratio', value: '60%', tone: 'success' },
    ],
    evalNote: 'Activity\u2019s there. I keep losing policies in month three — need a conservation routine.',
    evals: [
      { label: 'Planning', value: 7 }, { label: 'Time Mgmt', value: 6 },
      { label: 'Sales Perf.', value: 6 }, { label: 'Prospecting', value: 7 }, { label: 'Overall', value: 6 },
    ],
  },
  {
    id: 'jamal', name: 'Jamal Khan', initials: 'JK', unit: 'S·03', level: 'L2',
    submitted: false, flag: 'report', flagLabel: 'Report late', tone: 'warning',
    reason: 'Week 48 report not submitted — auto-nudged Sun 9 PM. 3 missed this quarter.',
    headline: 'No report to walk. Capture a verbal update in the room and a nudge to file by EOD.',
    note: 'Third miss this quarter. Set expectation in the room; nudge to file today.',
    weekApi: 7_200, apps: 1, spark: [1, 1, 0, 1, 0, 0],
    act: { calls: 0, contacts: 0, appts: 0, interviews: 0, factfinds: 0, closing: 0, clients: 0, referrals: 0 },
    ratios: [
      { label: 'Approach → FFI', value: '—', tone: 'mute' },
      { label: 'FFI → CI', value: '—', tone: 'mute' },
      { label: 'CI → App', value: '—', tone: 'mute' },
      { label: 'Closing ratio', value: '—', tone: 'mute' },
    ],
    evalNote: '',
    evals: [
      { label: 'Planning', value: 0 }, { label: 'Time Mgmt', value: 0 },
      { label: 'Sales Perf.', value: 0 }, { label: 'Prospecting', value: 0 }, { label: 'Overall', value: 0 },
    ],
  },
  {
    id: 'marsha', name: 'Marsha Singh', initials: 'MS', unit: 'S·02', level: 'L4',
    submitted: true, flag: null, flagLabel: 'On pace', tone: 'success',
    champion: 1, win: 'Top API this week · MDRT pace',
    reason: 'TTD 487k YTD · on MDRT pace. Led the branch in API again this week.',
    headline: 'Model week. Have her share how she\u2019s booking F2F approaches at this rate.',
    note: 'Recognize publicly. Ask her to demo her approach-booking routine to the unit.',
    weekApi: 24_400, apps: 4, spark: [19, 21, 20, 23, 22, 24],
    act: { calls: 92, contacts: 58, appts: 28, interviews: 25, factfinds: 14, closing: 11, clients: 4, referrals: 140 },
    ratios: [
      { label: 'Approach → FFI', value: '67%', tone: 'success' },
      { label: 'FFI → CI', value: '83%', tone: 'success' },
      { label: 'CI → App', value: '80%', tone: 'success' },
      { label: 'Closing ratio', value: '79%', tone: 'success' },
    ],
    evalNote: 'Mornings are call-blocks, no exceptions. Afternoons are FFIs. That rhythm is everything.',
    evals: [
      { label: 'Planning', value: 9 }, { label: 'Time Mgmt', value: 9 },
      { label: 'Sales Perf.', value: 8 }, { label: 'Prospecting', value: 9 }, { label: 'Overall', value: 9 },
    ],
  },
];

const CHAMPS = [
  { rank: 1, name: 'Marsha Singh',    unit: 'S·02', initials: 'MS', api: 24_400, note: 'MDRT pace' },
  { rank: 2, name: 'Anand Persad',    unit: 'S·01', initials: 'AP', api: 21_800, note: '4 apps · 91% pers.' },
  { rank: 3, name: 'Selina Mohammed', unit: 'S·03', initials: 'SM', api: 19_200, note: 'Best closing ratio' },
];

// ──────────────────────────────────────────────────────────────────────────
// STAGE — the 16:9 projection shell. Thin progress bar, header (identity ·
// counter · mode toggle · exit), optional agenda rail, content slot, footer.
// ──────────────────────────────────────────────────────────────────────────
function MeetingStage({ t, children, step, total, phase, mode = 'group', onRail = true, footer, bleed = null }) {
  const pct = total > 1 ? (step / (total - 1)) * 100 : 0;
  return (
    <div style={{
      width: MTG_W, height: MTG_H, background: t.bg, color: t.ink,
      fontFamily: APP_FONT_SANS, position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column',
    }}>
      <AmbientBg t={t} />
      {/* Full-stage background slot — e.g. the open-slide photo slideshow.
          Sits above the ambient, below the header/body/footer chrome. */}
      {bleed && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>{bleed}</div>
      )}
      {/* Progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: t.surfaceMute, zIndex: 6 }}>
        <div style={{ width: `${pct}%`, height: 3, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})` }}></div>
      </div>

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 4, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '18px 26px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AgencyLogo size={30} radius={8} /></div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>{MEETING.day} Stand-up</div>
            <div style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>{MEETING.branch.toUpperCase()} · {MEETING.week.toUpperCase()}</div>
          </div>
        </div>

        <div style={{ flex: 1 }}></div>

        {phase && (
          <div style={{ fontSize: 11, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.16em', fontFamily: APP_FONT_MONO, textTransform: 'uppercase' }}>{phase}</div>
        )}

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 999 }}>
          {[['group', 'Group'], ['solo', '1-on-1']].map(([k, l]) => {
            const on = k === mode;
            return (
              <div key={k} style={{ padding: '5px 13px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: on ? t.teal : 'transparent', color: on ? '#fff' : t.inkMute }}>{l}</div>
            );
          })}
        </div>

        {total != null && (
          <div style={{ fontSize: 12, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO, minWidth: 54, textAlign: 'right' }}>
            {String(step + 1).padStart(2, '0')} <span style={{ color: t.inkFaint }}>/ {String(total).padStart(2, '0')}</span>
          </div>
        )}

        <div style={{ width: 34, height: 34, borderRadius: '50%', background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkMute, flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </div>
      </div>

      {/* Body */}
      <div style={{ position: 'relative', zIndex: 2, flex: 1, minHeight: 0, display: 'flex' }}>
        {children}
      </div>

      {footer}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AGENDA RAIL — the run-list. Phases + the agent run, current highlighted,
// done checked, exceptions tagged. Persistent on agent steps.
// ──────────────────────────────────────────────────────────────────────────
function AgendaRail({ t, activeId, doneIds = [] }) {
  return (
    <div style={{ width: 256, flexShrink: 0, borderRight: `1px solid ${t.rule}`, background: t.surfaceSoft, display: 'flex', flexDirection: 'column', padding: '18px 14px' }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.16em', fontFamily: APP_FONT_MONO, padding: '0 6px 10px' }}>RUN OF SHOW</div>

      {/* Opened phases — the bird's-eye movement, done by the time we drill in */}
      <RailPhase t={t} label="Branch roll-up" done />
      <RailPhase t={t} label="Units" done />
      <RailPhase t={t} label="The numbers" done />

      <div style={{ fontSize: 9, fontWeight: 700, color: t.warning, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, padding: '12px 6px 6px' }}>NEEDS ATTENTION · 5</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {RUN.filter((r) => r.flag).map((r) => (
          <RailAgent key={r.id} t={t} r={r} active={r.id === activeId} done={doneIds.includes(r.id)} />
        ))}
      </div>

      <div style={{ fontSize: 9, fontWeight: 700, color: t.success, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, padding: '12px 6px 6px' }}>ON PACE · NEXT 3</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {RUN.filter((r) => !r.flag).map((r) => (
          <RailAgent key={r.id} t={t} r={r} active={r.id === activeId} done={doneIds.includes(r.id)} />
        ))}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <RailPhase t={t} label="Recognition" gold />
        <RailPhase t={t} label="Celebrations" gold />
        <RailPhase t={t} label="Within reach" gold />
        <RailPhase t={t} label="Wrap-up" />
      </div>
    </div>
  );
}

function RailPhase({ t, label, done, gold }) {
  const c = gold ? t.gold : done ? t.success : t.inkFaint;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', borderRadius: 8 }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: done ? t.successTint : gold ? t.goldTint : t.surfaceMute, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {done ? <IconCheck size={11} color={c} stroke={2.6} /> : gold ? <IconMedal size={11} color={c} /> : <IconCheck size={11} color={c} stroke={2} />}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: done ? t.inkMute : gold ? t.gold : t.inkMute }}>{label}</div>
    </div>
  );
}

function RailAgent({ t, r, active, done }) {
  const fg = r.tone === 'danger' ? t.danger : r.tone === 'success' ? t.success : t.warning;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 9, position: 'relative',
      background: active ? t.surface : 'transparent', border: active ? `1px solid ${t.rule}` : '1px solid transparent',
    }}>
      {active && <div style={{ position: 'absolute', left: 0, top: 7, bottom: 7, width: 3, background: fg, borderRadius: 999 }}></div>}
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: active ? `${fg}22` : t.surfaceMute, color: active ? fg : t.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 9.5, fontFamily: APP_FONT_DISPLAY, flexShrink: 0, opacity: done ? 0.55 : 1 }}>{r.initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: active ? 700 : 600, color: done ? t.inkFaint : t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
      </div>
      {done ? <IconCheck size={12} color={t.success} stroke={2.4} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: fg }}></div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// FOOTER — prev/next, segment indicator, quick actions, presenter notes peek.
// ──────────────────────────────────────────────────────────────────────────
function MeetingFooter({ t, step, total, actions = false, note }) {
  return (
    <div style={{ position: 'relative', zIndex: 4, flexShrink: 0, borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <NavBtn t={t} dir="left" />
      {/* Segments */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 999, background: i === step ? t.teal : i < step ? `${t.teal}66` : t.inkDim, transition: 'all 200ms' }}></div>
        ))}
      </div>

      {note && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginLeft: 8, padding: '7px 13px', background: t.surface, border: `1px dashed ${t.ruleStrong}`, borderRadius: 9, maxWidth: 420 }}>
          <span style={{ fontSize: 8.5, fontWeight: 700, color: t.gold, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, flexShrink: 0 }}>PRESENTER</span>
          <span style={{ fontSize: 11, color: t.inkMute, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</span>
        </div>
      )}

      <div style={{ flex: 1 }}></div>

      {actions && (
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { l: 'Leave note', Icon: IconBook, tone: 'teal' },
            { l: 'Recommend target', Icon: IconTarget, tone: 'teal' },
            { l: 'Nudge', Icon: IconWizard, tone: 'warn' },
          ].map((a) => {
            const fg = a.tone === 'warn' ? t.warning : t.teal;
            const bg = a.tone === 'warn' ? t.warningTint : t.tealTint;
            return (
              <div key={a.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', background: bg, border: `1px solid ${fg}33`, borderRadius: 9, fontSize: 12, fontWeight: 700, color: fg }}>
                <a.Icon size={14} color={fg} stroke={2} /> {a.l}
              </div>
            );
          })}
        </div>
      )}

      <NavBtn t={t} dir="right" primary />
    </div>
  );
}

function NavBtn({ t, dir, primary }) {
  const bg = primary ? t.teal : t.surface;
  const fg = primary ? '#fff' : t.ink;
  return (
    <div style={{ width: 42, height: 42, borderRadius: '50%', background: bg, border: primary ? 'none' : `1px solid ${t.ruleStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: fg, flexShrink: 0, boxShadow: primary ? `0 4px 12px ${t.teal}55` : 'none' }}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === 'left' ? 'M11 3L5 9l6 6' : 'M7 3l6 6-6 6'} />
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES — activity KPI tile, big trajectory spark, status dot.
// ──────────────────────────────────────────────────────────────────────────
function ActivityTile({ t, kpi, actual }) {
  const status = actual == null ? 'below' : kpiStatus(actual, kpi.floor);
  const fg = status === 'met' ? t.success : status === 'at' ? t.warning : t.danger;
  const bg = status === 'met' ? t.successTint : status === 'at' ? t.warningTint : t.dangerTint;
  const pct = Math.min(100, Math.round(((actual || 0) / kpi.floor) * 100));
  const fmt = (n) => kpi.unit === '%' ? `${n}%` : `${n}`;
  return (
    <div style={{ padding: '12px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.inkMute, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{kpi.label}</div>
        <div style={{ fontSize: 9, fontWeight: 700, color: fg, padding: '2px 7px', background: bg, borderRadius: 999, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO }}>{status === 'met' ? '✓' : status === 'at' ? '~' : '▾'}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 7 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 0.9 }}>{fmt(actual ?? 0)}</div>
        <div style={{ fontSize: 11, color: t.inkFaint, fontFamily: APP_FONT_MONO, paddingBottom: 2 }}>/ {fmt(kpi.floor)}</div>
      </div>
      <div style={{ marginTop: 9, height: 4, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
        <div className="a-progress-grow" style={{ width: `${pct}%`, height: 4, background: fg, borderRadius: 999 }}></div>
      </div>
    </div>
  );
}

// Larger spark for the projected agent step.
function BigSpark({ color, values, width = 132, height = 44 }) {
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 6) + 3;
    const y = (height - 5) - ((v - min) / range) * (height - 9) + 2.5;
    return [x, y];
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${d} L ${pts[pts.length - 1][0].toFixed(1)} ${height} L ${pts[0][0].toFixed(1)} ${height} Z`;
  const last = pts[pts.length - 1];
  const gid = 'bsg-' + Math.random().toString(36).slice(2, 8);
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// PHOTO FRAME — wraps the <image-slot> drop target (kiosk-welcome treatment).
// The manager drops a photo that persists (own meeting-mode ids, independent
// of kiosk). Empty = a readable affordance on a card, or nothing on a backdrop
// (so an un-filled deck looks exactly like the default ambient design).
// ──────────────────────────────────────────────────────────────────────────
function PhotoFrame({ t, id, caption = 'Drag a photo · or set in Tweaks', radius = 16, mute = false, subtle = false, style }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: radius, background: subtle ? 'transparent' : t.surfaceSoft, border: subtle ? 'none' : `1px solid ${t.rule}`, ...style }}>
      {!subtle && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, color: t.inkFaint, pointerEvents: 'none' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.6" /><path d="M21 15l-5-5L6 19" /></svg>
          <div style={{ fontSize: 10.5, fontWeight: 600, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em', maxWidth: '80%', textAlign: 'center', lineHeight: 1.4 }}>{caption}</div>
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, filter: mute ? 'grayscale(0.45) brightness(0.62)' : 'none' }}>
        <image-slot id={id} shape="rect" placeholder=" " style={{ width: '100%', height: '100%', display: 'block' }}></image-slot>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// RUN OF SHOW — full ordered slide list, so step index + total stay consistent
// as the deck grows. Bird's-eye movement (branch → units → the numbers) opens,
// then the agent drill, then recognition + wrap-up.
// ──────────────────────────────────────────────────────────────────────────
const MEETING_ORDER = [
  'agenda', 'branch', 'units', 'activity', 'production',
  ...RUN.map((r) => 'agent:' + r.id),
  'recognition', 'celebrations', 'awards', 'close',
];
const MEETING_STEPS = MEETING_ORDER.length;
function stepOf(slide) {
  let s = slide;
  if (s && s.indexOf('solo:') === 0) s = 'agent:' + s.slice(5);
  const i = MEETING_ORDER.indexOf(s);
  return i < 0 ? 0 : i;
}

Object.assign(window, {
  MTG_W, MTG_H, MEETING_DARK, MEETING_LIGHT, MEETING, FLOOR_KPIS, kpiStatus, RUN, CHAMPS,
  KPI_GROUPS, KPI_BY, kidValues, resolveKpiCols, resolveTiles, KPI_DENSITY_LABEL,
  MEETING_ORDER, MEETING_STEPS, stepOf, PhotoFrame,
  MeetingStage, AgendaRail, RailPhase, RailAgent, MeetingFooter, NavBtn, ActivityTile, BigSpark,
});

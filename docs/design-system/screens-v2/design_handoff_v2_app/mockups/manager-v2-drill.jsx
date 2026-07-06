// Manager Dashboard v2 — drill drawer content.
//
// Two manager-perspective surfaces that share the drawer/sheet chrome:
//   • AgentDrill — drilling into one agent reuses the agent surface grammar
//     (hero number, weekly-standard rows, goal cascade) in a READ-MOSTLY
//     coaching view, with the gold ownership banner + recommend/note/nudge
//     actions where the manager would act on the agent's behalf.
//   • RecommendGoal — the "recommend a target" manager action: recommend-vs-
//     lock, slider + direct numeric entry, cascade context, gold banner.

// The drilled agent (Devin Lewis — below floor, the most urgent exception).
const DRILL_AGENT = {
  name: 'Devin Lewis', unit: 'S·02', initials: 'DL', level: 'L1',
  contracted: 'Contracted Mar 2025',
  ytdApi: 122_000, floor: 250_000, commitment: 250_000,
  weekApi: 3_400, apps: 1, ci: 1, pers: 76, mode: 'Weekly',
};

// Devin's weekly standard — the 10 floors, expected vs actual.
const DRILL_STANDARD = [
  { label: 'Dials',          floor: 40,   actual: 31,   status: 'below' },
  { label: 'Tel Contacts',   floor: 10,   actual: 6,    status: 'below' },
  { label: 'F2F Approaches', floor: 5,    actual: 5,    status: 'at' },
  { label: 'FFIs Conducted', floor: 3,    actual: 2,    status: 'below' },
  { label: 'CIs Conducted',  floor: 2,    actual: 1,    status: 'below' },
  { label: 'Applications',   floor: 1,    actual: 1,    status: 'at' },
  { label: 'API',            floor: 4800, actual: 3400, status: 'below', unit: 'TTD' },
  { label: 'Persistency',    floor: 80,   actual: 76,   status: 'below', unit: '%' },
];

// Grouped activity for the stacked Weekly tab (depth view of one agent).
const DRILL_ACTIVITY = [
  { group: 'Prospecting', rows: [
    { label: 'Prospecting touches', floor: 30, actual: 22, status: 'below' },
    { label: 'New names sourced',   floor: 10, actual: 7,  status: 'below' },
  ]},
  { group: 'Contact', rows: [
    { label: 'Dials',          floor: 40, actual: 31, status: 'below' },
    { label: 'Tel contacts',   floor: 10, actual: 6,  status: 'below' },
    { label: 'F2F approaches', floor: 5,  actual: 5,  status: 'at' },
    { label: 'Contacts made',  floor: 12, actual: 8,  status: 'below' },
  ]},
  { group: 'FFI / CI', rows: [
    { label: 'FFIs conducted',      floor: 3, actual: 2, status: 'below' },
    { label: 'Solutions presented', floor: 2, actual: 2, status: 'at' },
    { label: 'CIs conducted',       floor: 2, actual: 1, status: 'below' },
  ]},
  { group: 'Sales', rows: [
    { label: 'Applications', floor: 1,    actual: 1,    status: 'at' },
    { label: 'Lives',        floor: 1,    actual: 1,    status: 'at' },
    { label: 'API',          floor: 4800, actual: 3400, status: 'below', unit: 'TTD' },
  ]},
  { group: 'Quality', rows: [
    { label: 'Persistency',   floor: 80, actual: 76, status: 'below', unit: '%' },
    { label: 'Closing ratio', floor: 60, actual: 55, status: 'below', unit: '%' },
  ]},
];

// Coaching notes (CoachingNotesModal lineage) — author, category, pinnable.
const DRILL_NOTES = [
  { id: 'n1', cat: 'concern', catLabel: 'Concern', author: 'Trevor R.', date: '24 Nov', pinned: true,
    body: 'Activity has dropped two weeks running. Dials and tel-contacts both below floor — this is a pace problem, not a closing one. Pairing him with Anand for joint calls this week.' },
  { id: 'n2', cat: 'action', catLabel: 'Action Item', author: 'Trevor R.', date: '24 Nov', pinned: false,
    body: 'Set a daily reporting cadence until he clears floor. Recommend, don\u2019t lock — keep it his call.' },
  { id: 'n3', cat: 'observation', catLabel: 'Observation', author: 'Riaz K.', date: '17 Nov', pinned: false,
    body: 'Strong on the FFI itself — warmth and rapport are there. The gap is at the top of the funnel: not enough approaches booked.' },
];

const NOTE_CAT = {
  observation: 'teal', goal: 'success', concern: 'warning', win: 'gold', action: 'ink',
};

// Joint-call prep (agent-authored, manager READ-ONLY) — the "Prospect Info" surface.
const DRILL_PREPS = [
  { id: 'p1', client: 'Anita Gopaul', appt: 'New CI', source: 'Referral', date: 'Fri 28 Nov · 2:00 PM',
    policy: 'Whole Life', age: '34', occ: 'Teacher', objections: ['Affordability', 'Spouse decision'] },
];

// Joint-call log (manager-authored observations after the call).
const DRILL_CALLS = [
  { id: 'c1', type: 'Observation', need: 'Income Protection', date: '21 Nov', kept: true, sale: false,
    coaching: 25, note: 'Devin led; I observed. Needs to slow the close — jumped to product before confirming the need. Booked a 2nd call.', prep: 'Anita Gopaul' },
  { id: 'c2', type: 'Demonstration', need: 'Education', date: '14 Nov', kept: true, sale: true,
    coaching: 40, note: 'I demonstrated the FFI; sale made. Good model for him on needs-first questioning.', prep: null },
];

function mgrTone(t, status) {
  if (status === 'met') return { fg: t.success, bg: t.successTint, label: '✓ MET' };
  if (status === 'at')  return { fg: t.warning, bg: t.warningTint, label: '~ AT' };
  return { fg: t.danger, bg: t.dangerTint, label: 'BELOW' };
}

function MgrStandardRow({ t, row }) {
  const { fg, bg, label } = mgrTone(t, row.status);
  const pct = Math.min(100, Math.round((row.actual / row.floor) * 100));
  const fmt = (n) => row.unit === 'TTD' ? `TTD ${(n / 1000).toFixed(1)}K` : row.unit === '%' ? `${n}%` : `${n}`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 50px 1fr 56px', alignItems: 'center', gap: 9, padding: '9px 18px', borderBottom: `1px solid ${t.rule}` }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{row.label}</div>
      <div style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO, textAlign: 'right' }}>{fmt(row.floor)}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, textAlign: 'right' }}>{fmt(row.actual)}</div>
      <div style={{ height: 4, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
        <div className="a-progress-grow" style={{ width: `${pct}%`, height: 4, background: fg, borderRadius: 999 }}></div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 9, fontWeight: 700, color: fg, padding: '2px 8px', background: bg, borderRadius: 999, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO, justifySelf: 'end' }}>{label}</div>
    </div>
  );
}

// Weekly tab — stacked, grouped activity breakdown + period chips. The
// per-agent depth view (the matrix is the compare-all breadth view).
function DrillWeekly({ t }) {
  const head = { padding: '8px 18px', display: 'grid', gridTemplateColumns: '1fr 50px 50px 1fr 56px', gap: 9, background: t.surfaceSoft, fontSize: 9, fontWeight: 700, color: t.inkMute, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, borderTop: `1px solid ${t.ruleStrong}`, borderBottom: `1px solid ${t.ruleStrong}`, flexShrink: 0 };
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px 10px', flexShrink: 0 }}>
        <GoldBanner t={t} title="Week 48 · in progress · read-only" body="Devin authors this report. You can coach the gaps, recommend a target, or nudge — you can't edit his numbers." />
        <div style={{ display: 'flex', gap: 6, marginTop: 11 }}>
          {['Day', 'Week', 'Month', 'Quarter', 'YTD'].map((p, i) => (
            <div key={p} style={{ padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700, fontFamily: APP_FONT_MONO, background: i === 1 ? t.tealTint : t.surfaceSoft, color: i === 1 ? t.teal : t.inkMute, border: `1px solid ${i === 1 ? t.teal + '44' : t.rule}` }}>{p}</div>
          ))}
        </div>
      </div>
      <div style={head}>
        <div>METRIC</div><div style={{ textAlign: 'right' }}>FLOOR</div><div style={{ textAlign: 'right' }}>ACTUAL</div><div></div><div style={{ textAlign: 'right' }}>STATUS</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {DRILL_ACTIVITY.map((g) => (
          <div key={g.group}>
            <div style={{ padding: '9px 18px 5px', fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{g.group}</div>
            {g.rows.map((r, i) => <MgrStandardRow key={i} t={t} row={r} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Tab bar shared by the drill drawer.
function DrillTabs({ t, active = 'overview' }) {
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'weekly',   label: 'Weekly' },
    { key: 'goals',    label: 'Goals' },
    { key: 'notes',    label: 'Notes' },
    { key: 'jointwork',label: 'Joint Work' },
  ];
  return (
    <div style={{ display: 'flex', gap: 2, padding: '0 14px', borderBottom: `1px solid ${t.rule}`, flexShrink: 0 }}>
      {tabs.map((tab) => {
        const on = tab.key === active;
        return (
          <div key={tab.key} style={{
            padding: '11px 9px 10px', fontSize: 12, fontWeight: 700,
            color: on ? t.teal : t.inkMute,
            borderBottom: `2px solid ${on ? t.teal : 'transparent'}`, marginBottom: -1, whiteSpace: 'nowrap',
          }}>{tab.label}</div>
        );
      })}
    </div>
  );
}

// Drawer header — agent identity + the exception that brought us here.
function DrillHeader({ t, agent }) {
  return (
    <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${t.rule}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{agent.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em', fontFamily: APP_FONT_DISPLAY }}>{agent.name}</div>
          <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>{agent.unit} · {agent.level} · {agent.contracted}</div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: t.dangerTint, border: `1px solid ${t.danger}33` }}>
          <IconAlert size={12} color={t.danger} stroke={2} />
          <span style={{ fontSize: 9.5, fontWeight: 700, color: t.danger, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>Below floor</span>
        </div>
      </div>
    </div>
  );
}

// Overview tab body — at-risk reasons + mini hero + actions.
function DrillOverview({ t, agent }) {
  const gap = agent.floor - agent.ytdApi;
  const pct = Math.round((agent.ytdApi / agent.floor) * 100);
  const actions = [
    { Icon: IconTarget, label: 'Recommend a target', sub: 'Suggest a goal — he confirms', accent: t.teal },
    { Icon: IconDownload, label: 'Download performance report', sub: 'His A4 PDF — pull it for the 1:1', accent: t.teal },
    { Icon: IconBook,   label: 'Leave a coaching note', sub: 'Private to the management line', accent: t.teal },
    { Icon: IconClock,  label: 'Recommend reporting mode', sub: 'Currently weekly · suggest daily', accent: t.teal },
    { Icon: IconWizard, label: 'Nudge for missing report', sub: 'Sends a reminder to log', accent: t.warning },
  ];
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <GoldBanner t={t}
        title="Coaching view — you're acting on Devin's behalf"
        body="This record is read-only. Targets and modes you set here are recommendations he reviews and accepts; he still owns his commitment." />

      {/* Mini hero — YTD vs floor */}
      <div style={{ padding: '14px 16px', background: t.dangerTint, border: `1px solid ${t.danger}33`, borderRadius: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.danger, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>YTD SETTLED API · BELOW FLOOR</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 6 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.026em', lineHeight: 1 }}>{ttd(agent.ytdApi)}</div>
          <div style={{ fontSize: 12, color: t.inkMute, paddingBottom: 2 }}>{ttd(gap)} below the {ttd(agent.floor)} floor</div>
        </div>
        <div style={{ marginTop: 12, height: 6, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
          <div className="a-progress-grow" style={{ width: `${pct}%`, height: 6, background: t.danger, borderRadius: 999 }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>
          <span>{pct}% of floor</span>
          <span>FLOOR · {ttd(agent.floor)}</span>
        </div>
      </div>

      {/* Why flagged */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>Why flagged</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[
            { t: 'Activity trending down', s: '6 of 8 standards below floor this week' },
            { t: 'Persistency slipping', s: `${agent.pers}% · 4pp below the 80% threshold` },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: t.warning, flexShrink: 0 }}></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{r.t}</div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{r.s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manager actions */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>What you can do</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {actions.map((a, i) => (
            <div key={i} className="a-card" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11, cursor: 'pointer' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: i === 4 ? t.warningTint : t.tealTint, color: a.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <a.Icon size={16} color={a.accent} stroke={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>{a.label}</div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{a.sub}</div>
              </div>
              <IconChevR size={14} color={t.inkFaint} stroke={2.4} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Composed drill content (header + tabs + body). tab switches the body.
function AgentDrill({ t, agent = DRILL_AGENT, tab = 'overview' }) {
  return (
    <>
      <DrillHeader t={t} agent={agent} />
      <DrillTabs t={t} active={tab} />
      {tab === 'weekly' ? (
        <DrillWeekly t={t} />
      ) : tab === 'goals' ? (
        <DrillGoals t={t} agent={agent} />
      ) : tab === 'notes' ? (
        <DrillNotes t={t} agent={agent} />
      ) : tab === 'jointwork' ? (
        <DrillJointWork t={t} agent={agent} />
      ) : (
        <DrillOverview t={t} agent={agent} />
      )}
    </>
  );
}

// Notes tab — coaching notes (read existing + an add affordance). The manager
// authors these; categories + pin mirror CoachingNotesModal.
function DrillNotes({ t, agent }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {DRILL_NOTES.map((n) => {
          const toneName = NOTE_CAT[n.cat] || 'teal';
          const fg = toneName === 'warning' ? t.warning : toneName === 'success' ? t.success : toneName === 'gold' ? t.gold : toneName === 'ink' ? t.inkMute : t.teal;
          const bg = toneName === 'warning' ? t.warningTint : toneName === 'success' ? t.successTint : toneName === 'gold' ? t.goldTint : toneName === 'ink' ? t.surfaceSoft : t.tealTint;
          return (
            <div key={n.id} style={{ padding: '12px 14px', background: t.surface, border: `1px solid ${n.pinned ? t.teal + '44' : t.rule}`, borderRadius: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: fg, background: bg, padding: '3px 8px', borderRadius: 999, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{n.catLabel}</span>
                <span style={{ fontSize: 10.5, color: t.inkFaint }}>{n.author} · {n.date}</span>
                {n.pinned && <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: t.teal, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>★ PINNED</span>}
              </div>
              <div style={{ fontSize: 12.5, color: t.ink, lineHeight: 1.5 }}>{n.body}</div>
            </div>
          );
        })}
      </div>
      {/* Add-note affordance */}
      <div style={{ padding: '12px 18px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft, flexShrink: 0, display: 'flex', gap: 9, alignItems: 'center' }}>
        <div style={{ flex: 1, padding: '10px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12, color: t.inkFaint }}>Add a coaching note…</div>
        <div style={{ padding: '10px 16px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700 }}>Add</div>
      </div>
    </div>
  );
}

// Joint Work tab — the read-only joint-call PREP (agent-authored) up top, and
// the manager's joint-call LOG below. Answers "where does joint work live".
function DrillJointWork({ t, agent }) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Upcoming prep — read-only */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>Upcoming prep · read-only</div>
          <div style={{ fontSize: 11, color: t.teal, fontWeight: 700 }}>Open in Prospect Prep →</div>
        </div>
        {DRILL_PREPS.map((p) => (
          <div key={p.id} style={{ padding: '13px 14px', background: t.tealTint, border: `1px solid ${t.teal}33`, borderRadius: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: t.teal, background: t.surface, padding: '3px 9px', borderRadius: 999, fontFamily: APP_FONT_MONO }}>{p.appt}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: t.success, background: t.successTint, padding: '3px 9px', borderRadius: 999, fontFamily: APP_FONT_MONO }}>{p.source}</span>
              <span style={{ fontSize: 11, color: t.inkMute, marginLeft: 'auto' }}>{p.date}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{p.client}</div>
            <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{p.age} yrs · {p.occ} · {p.policy}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
              {p.objections.map((o) => (
                <span key={o} style={{ fontSize: 9.5, fontWeight: 700, color: t.warning, background: t.warningTint, padding: '3px 9px', borderRadius: 999, fontFamily: APP_FONT_MONO }}>{o}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Joint-call log — manager-authored */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>Joint-call log · you authored</div>
          <div style={{ fontSize: 11, color: t.teal, fontWeight: 700 }}>+ Log a call</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {DRILL_CALLS.map((c) => (
            <div key={c.id} style={{ padding: '12px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: t.teal, background: t.tealTint, padding: '3px 9px', borderRadius: 999, fontFamily: APP_FONT_MONO }}>{c.type}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkMute, background: t.surfaceSoft, padding: '3px 9px', borderRadius: 999, fontFamily: APP_FONT_MONO }}>{c.need}</span>
                <span style={{ fontSize: 11, color: t.inkFaint, marginLeft: 'auto', fontFamily: APP_FONT_MONO }}>{c.date}</span>
              </div>
              <div style={{ fontSize: 12, color: t.ink, lineHeight: 1.5 }}>{c.note}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 9, fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO }}>
                <span style={{ color: c.kept ? t.success : t.warning }}>{c.kept ? '✓ Kept' : '— Not kept'}</span>
                <span style={{ color: c.sale ? t.success : t.inkMute }}>{c.sale ? '✓ Sale' : 'No sale'}</span>
                <span>{c.coaching} min coaching</span>
                {c.prep && <span style={{ color: t.teal }}>→ {c.prep}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Goals tab — the cascade for this agent, ending in the company floor.
function DrillGoals({ t, agent }) {
  const cascade = [
    { label: 'Personal commitment', value: 'Not set', tone: 'empty', note: 'Devin hasn’t committed for 2026 yet' },
    { label: 'Unit recommendation', value: ttd(320_000), tone: 'teal', note: 'S·02 · recommended by you' },
    { label: 'Branch floor', value: ttd(280_000), tone: 'ink', note: 'South Branch baseline' },
    { label: 'Company floor', value: ttd(agent.floor), tone: 'warning', note: 'L1 tenure · the hard minimum' },
  ];
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <GoldBanner t={t} title="The goal cascade — where you can recommend" body="Personal → Unit → Branch → company floor. You recommend at the unit tier; Devin sets his personal commitment." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cascade.map((c, i) => {
          const fg = c.tone === 'teal' ? t.teal : c.tone === 'warning' ? t.warning : c.tone === 'empty' ? t.inkFaint : t.ink;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: t.surface, border: `1px solid ${c.tone === 'empty' ? t.ruleStrong : t.rule}`, borderStyle: c.tone === 'empty' ? 'dashed' : 'solid', borderRadius: 11 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>{c.label}</div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{c.note}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: fg, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em' }}>{c.value}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 'auto', padding: '12px 16px', background: t.teal, color: '#fff', borderRadius: 11, fontSize: 13, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 12px ${t.teal}44` }}>
        Recommend a target for Devin <IconArrowR size={14} color="#fff" stroke={2.4} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// RECOMMEND-A-GOAL — manager-action drawer. recommend-vs-lock, slider +
// direct numeric entry, cascade context, gold ownership banner.
// ──────────────────────────────────────────────────────────────────────────
function RecommendGoal({ t, agent = DRILL_AGENT }) {
  const recommended = 320_000;
  const sliderPct = ((recommended - agent.floor) / (500_000 - agent.floor)) * 100;
  return (
    <>
      {/* Header */}
      <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${t.rule}`, flexShrink: 0 }}>
        <Eyebrow t={t} color={t.gold}>Manager action</Eyebrow>
        <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em', fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>Recommend a 2026 target</div>
        <div style={{ fontSize: 12, color: t.inkMute, marginTop: 3 }}>For {agent.name} · {agent.unit} · {agent.level}</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <GoldBanner t={t}
          title="A suggestion, not his commitment"
          body="Devin reviews this recommendation and accepts or adjusts it. Until he does, his goal is unchanged." />

        {/* Recommend vs Lock */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>How it applies</div>
          <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
            {[
              { label: 'Recommend', sub: 'He confirms', on: true },
              { label: 'Lock as floor', sub: 'Hard minimum', on: false },
            ].map((o) => (
              <div key={o.label} style={{ flex: 1, padding: '9px 12px', borderRadius: 7, textAlign: 'center', background: o.on ? t.surface : 'transparent', border: o.on ? `1px solid ${t.teal}44` : '1px solid transparent', boxShadow: o.on ? `0 1px 3px ${t.teal}22` : 'none' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: o.on ? t.teal : t.inkMute }}>{o.label}</div>
                <div style={{ fontSize: 10, color: t.inkFaint, marginTop: 1 }}>{o.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Target value — display + direct numeric entry */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>Recommended annual API</div>
            <div style={{ fontSize: 11, color: t.success, fontWeight: 600 }}>+28% on last year</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 34, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.026em', lineHeight: 1 }}>{ttd(recommended)}</div>
            <div style={{ flex: 1 }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, borderRadius: 9 }}>
              <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>TTD</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>320,000</span>
            </div>
          </div>
          {/* Slider track */}
          <div style={{ marginTop: 16, position: 'relative', height: 6, background: t.surfaceMute, borderRadius: 999 }}>
            <div style={{ width: `${sliderPct}%`, height: 6, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
            <div style={{ position: 'absolute', top: '50%', left: `${sliderPct}%`, transform: 'translate(-50%,-50%)', width: 18, height: 18, borderRadius: '50%', background: t.surface, border: `2px solid ${t.teal}`, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>
            <span style={{ color: t.warning }}>FLOOR · {ttd(agent.floor)}</span>
            <span>STRETCH · {ttd(500_000)}</span>
          </div>
        </div>

        {/* Cascade context */}
        <div style={{ padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>In context</div>
          {[
            { l: 'Company floor (L1)', v: ttd(agent.floor) },
            { l: 'S·02 unit average', v: ttd(358_000) },
            { l: 'Your recommendation', v: ttd(recommended), hi: true },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
              <span style={{ fontSize: 12, color: r.hi ? t.ink : t.inkMute, fontWeight: r.hi ? 700 : 500 }}>{r.l}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: r.hi ? t.teal : t.ink, fontFamily: APP_FONT_MONO }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 18px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft, display: 'flex', gap: 10, flexShrink: 0 }}>
        <div style={{ flex: '0 0 auto', padding: '11px 18px', background: t.surface, border: `1px solid ${t.ruleStrong}`, borderRadius: 9, fontSize: 13, fontWeight: 700, color: t.ink }}>Cancel</div>
        <div style={{ flex: 1, padding: '11px 18px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 12px ${t.teal}44` }}>
          Send recommendation to Devin <IconArrowR size={14} color="#fff" stroke={2.4} />
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  DRILL_AGENT, DRILL_STANDARD, DRILL_ACTIVITY, DRILL_NOTES, DRILL_PREPS, DRILL_CALLS,
  MgrStandardRow, DrillWeekly, DrillTabs, DrillHeader,
  DrillOverview, DrillGoals, DrillNotes, DrillJointWork, AgentDrill, RecommendGoal,
});

// Compliance v2 — who filed / who's late this week. WAR governance surface.
//
// v2 grammar: reality bar first (filed % · on-time · late · not-in), then the
// lead is exception-first — the agents who HAVEN'T submitted, with a one-tap
// Nudge (and "Nudge all"). Below, the full filing roster: status pill,
// submitted date, on-time streak. Clicking a row reuses the coaching drawer.
//
// Reuses ROSTER (mastersheet-v2-shared) + ManagerShell/ScopeSwitch + AgentDrill.

// Per-agent filing state this week, keyed off the roster.
// status: ontime | late | draft | missing
const FILING = {
  'Marsha Singh':    { status: 'ontime',  on: 'Mon 24 · 8:10 AM',  streak: 47 },
  'Anand Persad':    { status: 'ontime',  on: 'Sun 23 · 6:40 PM',  streak: 46 },
  'Selina Mohammed': { status: 'ontime',  on: 'Mon 24 · 7:55 AM',  streak: 31 },
  'Riaz Khan':       { status: 'ontime',  on: 'Mon 24 · 9:05 AM',  streak: 47 },
  'Kamla Singh':     { status: 'ontime',  on: 'Sun 23 · 9:20 PM',  streak: 22 },
  'Trevor Ramnauth': { status: 'ontime',  on: 'Mon 24 · 8:30 AM',  streak: 18 },
  'Carla Joseph':    { status: 'ontime',  on: 'Mon 24 · 8:45 AM',  streak: 12 },
  'Avinash Maharaj': { status: 'late',    on: 'Tue 25 · 2:15 PM',  streak: 0  },
  'Hema Lakhan':     { status: 'ontime',  on: 'Mon 24 · 7:40 AM',  streak: 9  },
  'Jamal Khan':      { status: 'missing', on: null,                streak: 0  },
  'Priya Naidu':     { status: 'late',    on: 'Tue 25 · 11:50 AM', streak: 0  },
  'Devin Lewis':     { status: 'draft',   on: null,                streak: 0  },
  'Nisha Ramdeen':   { status: 'ontime',  on: 'Mon 24 · 10:10 AM', streak: 14 },
  'Omar Ali':        { status: 'ontime',  on: 'Sun 23 · 5:30 PM',  streak: 11 },
};

function compStatus(t, s) {
  switch (s) {
    case 'late':    return { label: 'Late',    fg: t.warning, bg: t.warningTint };
    case 'draft':   return { label: 'Draft',   fg: t.warning, bg: t.warningTint };
    case 'missing': return { label: 'Missing', fg: t.danger,  bg: t.dangerTint };
    default:        return { label: 'On time', fg: t.success, bg: t.successTint };
  }
}

const COMP_ROWS = ROSTER.map((a) => ({ ...a, ...FILING[a.name] }));
const FILED = COMP_ROWS.filter((a) => a.status === 'ontime' || a.status === 'late').length;
const ONTIME = COMP_ROWS.filter((a) => a.status === 'ontime').length;
const LATE = COMP_ROWS.filter((a) => a.status === 'late').length;
const NOT_IN = COMP_ROWS.filter((a) => a.status === 'draft' || a.status === 'missing');
const FILED_PCT = Math.round((FILED / COMP_ROWS.length) * 100);

// ──────────────────────────────────────────────────────────────────────────
// REALITY BAR — filing state of the team this week
// ──────────────────────────────────────────────────────────────────────────
function ComplianceReality({ t }) {
  return (
    <div className="a-rise" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13, padding: '12px 16px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, color: t.ink, flexShrink: 0 }}>
        <IconClock size={14} color={t.inkMute} /> Week 48 · closes Sun 30
        <IconChevD size={12} color={t.inkMute} stroke={2.4} />
      </div>
      <ScopeSwitch t={t} active="branch" />
      <div style={{ width: 1, height: 30, background: t.rule }}></div>
      <div style={{ display: 'flex', gap: 22, flex: 1, minWidth: 0 }}>
        {[
          { k: 'FILED', v: `${FILED} / ${COMP_ROWS.length}`, c: t.ink, s: `${FILED_PCT}%` },
          { k: 'ON TIME', v: ONTIME, c: t.success },
          { k: 'LATE', v: LATE, c: t.warning },
          { k: 'NOT IN', v: NOT_IN.length, c: t.danger },
        ].map((m) => (
          <div key={m.k}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{m.k}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: m.c, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em' }}>{m.v}</div>
              {m.s && <div style={{ fontSize: 11, color: t.inkMute, fontWeight: 600 }}>{m.s}</div>}
            </div>
          </div>
        ))}
      </div>
      {/* Filed progress ring-ish bar */}
      <div style={{ width: 180, flexShrink: 0 }}>
        <div style={{ height: 8, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
          <div className="a-progress-grow" style={{ width: `${(ONTIME / COMP_ROWS.length) * 100}%`, height: 8, background: t.success }}></div>
          <div style={{ width: `${(LATE / COMP_ROWS.length) * 100}%`, height: 8, background: t.warning }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>
          <span>FILED {FILED_PCT}%</span>
          <span>TARGET 100%</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// NOT-IN LEAD — the agents who haven't submitted. Exception-first + Nudge.
// ──────────────────────────────────────────────────────────────────────────
function ComplianceLead({ t, onDrill }) {
  return (
    <div style={{ flexShrink: 0, background: t.warningTint, border: `1px solid ${t.warning}44`, borderRadius: 13, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div className="a-breathe" style={{ width: 28, height: 28, borderRadius: '50%', background: t.surface, border: `1px solid ${t.warning}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconAlert size={14} color={t.warning} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{NOT_IN.length} not in yet · stand-up is tomorrow</div>
        </div>
        <div style={{ padding: '8px 14px', background: t.warning, color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: `0 2px 6px ${t.warning}44` }}>
          <IconBell size={13} color="#fff" /> Nudge all
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {NOT_IN.map((a) => {
          const st = compStatus(t, a.status);
          return (
            <div key={a.name} onClick={() => onDrill && onDrill(a)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11, cursor: 'pointer' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{a.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{a.name}</div>
                <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{a.unit} · {a.status === 'draft' ? 'started, not submitted' : 'no report started'}</div>
              </div>
              <Pill t={t} color={st.fg} bg={st.bg}>{st.label}</Pill>
              <div style={{ padding: '6px 11px', background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, borderRadius: 8, fontSize: 11, fontWeight: 700, color: t.ink, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <IconBell size={12} color={t.inkMute} /> Nudge
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// FILING ROSTER — every agent's status, submitted time, on-time streak
// ──────────────────────────────────────────────────────────────────────────
const COMP_GRID = '34px 1.9fr 1fr 1.1fr 1fr 110px';

function ComplianceHeader({ t }) {
  const cell = { padding: '10px 14px', fontSize: 9.5, fontWeight: 700, color: t.inkMute, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, textAlign: 'left' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: COMP_GRID, borderBottom: `1px solid ${t.ruleStrong}`, background: t.surfaceSoft }}>
      <div style={{ ...cell, textAlign: 'center' }}>#</div>
      <div style={cell}>Agent · Unit</div>
      <div style={cell}>Status</div>
      <div style={cell}>Submitted</div>
      <div style={cell}>On-time streak</div>
      <div style={{ ...cell, textAlign: 'right', paddingRight: 16 }}>Action</div>
    </div>
  );
}

function ComplianceRow({ t, a, rank, zebra, onDrill }) {
  const st = compStatus(t, a.status);
  const notIn = a.status === 'draft' || a.status === 'missing';
  return (
    <div onClick={onDrill} className="ms-row" style={{ display: 'grid', gridTemplateColumns: COMP_GRID, alignItems: 'center', background: zebra ? t.surfaceRaised : t.surface, borderBottom: `1px solid ${t.rule}`, cursor: 'pointer' }}>
      <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{rank}</div>
      <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{a.initials}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap' }}>{a.name}</div>
          <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{a.unit} · {a.level}</div>
        </div>
      </div>
      <div style={{ padding: '12px 14px' }}><Pill t={t} color={st.fg} bg={st.bg}>{st.label}</Pill></div>
      <div style={{ padding: '12px 14px', fontSize: 12, color: a.on ? t.ink : t.inkFaint, fontFamily: APP_FONT_MONO }}>{a.on || '—'}</div>
      <div style={{ padding: '12px 14px', fontSize: 12, color: t.inkMute, fontFamily: APP_FONT_MONO }}>
        {a.streak > 0 ? `${a.streak} wk${a.streak === 1 ? '' : 's'}` : <span style={{ color: t.warning }}>broken</span>}
      </div>
      <div style={{ padding: '10px 16px', textAlign: 'right' }}>
        {notIn ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', background: t.warning, color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
            <IconBell size={12} color="#fff" /> Nudge
          </span>
        ) : (
          <span style={{ fontSize: 11, color: t.success, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <IconCheck size={13} color={t.success} stroke={2.4} /> Filed
          </span>
        )}
      </div>
    </div>
  );
}

function ComplianceTable({ t, onDrill }) {
  const rows = COMP_ROWS.map((a, i) => ({ ...a, rank: i + 1 }));
  return (
    <div style={{ flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <ComplianceHeader t={t} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {rows.map((a, i) => (
          <ComplianceRow key={a.name} t={t} a={a} rank={a.rank} zebra={i % 2 === 1} onDrill={() => onDrill && onDrill(a)} />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MOBILE CARD
// ──────────────────────────────────────────────────────────────────────────
function ComplianceMobileCard({ t, a, onDrill }) {
  const st = compStatus(t, a.status);
  const notIn = a.status === 'draft' || a.status === 'missing';
  return (
    <div onClick={onDrill} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', background: t.surface, border: `1px solid ${notIn ? st.fg + '33' : t.rule}`, borderRadius: 11 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{a.initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>{a.name}</div>
        <div style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{a.on || (a.status === 'draft' ? 'started, not submitted' : 'no report')}</div>
      </div>
      {notIn ? (
        <div style={{ padding: '7px 12px', background: t.warning, color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <IconBell size={12} color="#fff" /> Nudge
        </div>
      ) : (
        <Pill t={t} color={st.fg} bg={st.bg}>{st.label}</Pill>
      )}
    </div>
  );
}

Object.assign(window, {
  FILING, compStatus, COMP_ROWS, FILED, ONTIME, LATE, NOT_IN, FILED_PCT,
  ComplianceReality, ComplianceLead, ComplianceHeader, ComplianceRow, ComplianceTable, ComplianceMobileCard,
});

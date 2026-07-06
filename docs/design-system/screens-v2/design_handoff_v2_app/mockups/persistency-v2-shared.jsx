// Persistency v2 — monthly persistency tracking + entry (manager surface).
//
// Repo model: persistency is MONTHLY, manager-entered (six business inputs →
// derived %), manager-wins precedence over agent self-entry, three-band
// threshold (≥90% award gate · 80–89% watch · <80% below floor), role-scoped
// aggregation. v2 carries the grammar forward:
//   • Reality bar first: month · scope · aggregate % · trend · below-floor count.
//   • Exception-first: the at-risk book (below floor) leads, with Coach +
//     Playground actions.
//   • Roster: per-agent badge + gross/lapses + source (manager-locked vs self).
//
// Reuses ROSTER (mastersheet-v2-shared) + ManagerShell/ScopeSwitch/MgrSpark.

const PERS_MONTH = 'November 2025';
const PERS_GATE = 90;   // award-eligible
const PERS_FLOOR = 80;  // below = danger

function persBand(t, pct) {
  if (pct >= PERS_GATE) return { fg: t.success, bg: t.successTint, label: 'Award-eligible' };
  if (pct >= PERS_FLOOR) return { fg: t.warning, bg: t.warningTint, label: 'Watch' };
  return { fg: t.danger, bg: t.dangerTint, label: 'Below floor' };
}

// Per-agent monthly persistency, derived from the roster's pers value.
const PERS_ROWS = ROSTER.map((a) => {
  const gross = Math.round(a.ytdApi / 12 / 500) * 500;
  const lapses = Math.round(gross * (1 - a.pct0 ?? (1 - a.pers / 100) * gross));
  const lap = Math.round(gross * (1 - a.pers / 100));
  const reinst = Math.round(lap * 0.18);
  const net = gross - lap + reinst;
  return {
    name: a.name, unit: a.unit, initials: a.initials, level: a.level,
    pct: a.pers, gross, lapses: lap, reinst, net,
    by: a.name === 'Priya Naidu' ? 'self' : 'manager',
    edited: a.name === 'Priya Naidu' ? 'Self-entered 1 Dec' : 'Edited 2 Dec',
  };
});

const PERS_AGG = Math.round((PERS_ROWS.reduce((s, r) => s + r.pct, 0) / PERS_ROWS.length) * 10) / 10;
const PERS_BELOW_FLOOR = PERS_ROWS.filter((r) => r.pct < PERS_FLOOR);
const PERS_ELIGIBLE = PERS_ROWS.filter((r) => r.pct >= PERS_GATE).length;
const PERS_BELOW_GATE = PERS_ROWS.filter((r) => r.pct < PERS_GATE).length;
const PERS_LAPSES = PERS_ROWS.reduce((s, r) => s + r.lapses, 0);
const PERS_TREND = [82, 83, 85, 84, 86, 84];

// ──────────────────────────────────────────────────────────────────────────
// REALITY BAR — month · scope · aggregate % · trend · below-floor
// ──────────────────────────────────────────────────────────────────────────
function PersReality({ t }) {
  const band = persBand(t, PERS_AGG);
  return (
    <div className="a-rise" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13, padding: '12px 16px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, color: t.ink, flexShrink: 0 }}>
        <IconClock size={14} color={t.inkMute} /> {PERS_MONTH}
        <IconChevD size={12} color={t.inkMute} stroke={2.4} />
      </div>
      <ScopeSwitch t={t} active="branch" />
      <div style={{ width: 1, height: 30, background: t.rule }}></div>

      {/* Aggregate badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>BRANCH<br/>PERSISTENCY</div>
        <div style={{ fontSize: 30, fontWeight: 700, color: band.fg, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{PERS_AGG}%</div>
        <div style={{ marginLeft: 2 }}><MgrSpark color={band.fg} values={PERS_TREND} width={64} height={26} /></div>
      </div>

      <div style={{ flex: 1 }}></div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 22 }}>
        {[
          { k: 'BELOW FLOOR', v: PERS_BELOW_FLOOR.length, c: t.danger, s: '< 80%' },
          { k: 'AWARD-ELIGIBLE', v: PERS_ELIGIBLE, c: t.success, s: '≥ 90%' },
          { k: 'LAPSES · MTH', v: ttd(PERS_LAPSES), c: t.ink },
        ].map((m) => (
          <div key={m.k}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{m.k}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 3 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: m.c, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em' }}>{m.v}</div>
              {m.s && <div style={{ fontSize: 10, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{m.s}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AT-RISK LEAD — the book below floor. Exception-first.
// ──────────────────────────────────────────────────────────────────────────
function PersAtRisk({ t, onCoach, onPlayground }) {
  return (
    <div style={{ flexShrink: 0, background: t.dangerTint, border: `1px solid ${t.danger}33`, borderRadius: 13, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div className="a-breathe" style={{ width: 28, height: 28, borderRadius: '50%', background: t.surface, border: `1px solid ${t.danger}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconAlert size={14} color={t.danger} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{PERS_BELOW_FLOOR.length} below the {PERS_FLOOR}% floor · {PERS_BELOW_GATE} below the {PERS_GATE}% award gate</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {PERS_BELOW_FLOOR.map((r) => (
          <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{r.name}</div>
              <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{r.unit} · {ttd(r.lapses)} lapsed this month</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.danger, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em' }}>{r.pct}%</div>
            <div onClick={onPlayground} style={{ padding: '6px 11px', background: t.teal, color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
              <IconChart size={12} color="#fff" /> Playground
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ROSTER — per-agent persistency, gross/lapses, source, actions
// ──────────────────────────────────────────────────────────────────────────
const PERS_GRID = '34px 1.7fr 116px 1.05fr 0.95fr 1.15fr 158px';

function PersHeader({ t }) {
  const cell = { padding: '10px 14px', fontSize: 9.5, fontWeight: 700, color: t.inkMute, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, textAlign: 'left' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: PERS_GRID, borderBottom: `1px solid ${t.ruleStrong}`, background: t.surfaceSoft }}>
      <div style={{ ...cell, textAlign: 'center' }}>#</div>
      <div style={cell}>Agent · Unit</div>
      <div style={cell}>Persistency</div>
      <div style={{ ...cell, textAlign: 'right' }}>Gross settled</div>
      <div style={{ ...cell, textAlign: 'right' }}>Lapses</div>
      <div style={cell}>Source</div>
      <div style={{ ...cell, textAlign: 'right', paddingRight: 16 }}>Actions</div>
    </div>
  );
}

function PersRow({ t, r, rank, zebra, onEdit, onPlayground }) {
  const band = persBand(t, r.pct);
  return (
    <div className="ms-row" style={{ display: 'grid', gridTemplateColumns: PERS_GRID, alignItems: 'center', background: zebra ? t.surfaceRaised : t.surface, borderBottom: `1px solid ${t.rule}` }}>
      <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{rank}</div>
      <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap' }}>{r.name}</div>
          <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{r.unit} · {r.level}</div>
        </div>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: band.bg, color: band.fg, fontSize: 13, fontWeight: 700, fontFamily: APP_FONT_DISPLAY }}>{r.pct}%</span>
      </div>
      <div style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12.5, color: t.ink, fontFamily: APP_FONT_MONO }}>{ttd(r.gross)}</div>
      <div style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12.5, color: r.lapses > r.gross * 0.18 ? t.warning : t.inkMute, fontFamily: APP_FONT_MONO }}>{ttd(r.lapses)}</div>
      <div style={{ padding: '12px 14px' }}>
        {r.by === 'manager'
          ? <Pill t={t} color={t.teal} bg={t.tealTint}>Manager · locked</Pill>
          : <Pill t={t} color={t.inkMute} bg={t.surfaceSoft}>Self-entry</Pill>}
      </div>
      <div style={{ padding: '9px 16px', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <div onClick={onEdit} style={{ padding: '6px 11px', background: t.surface, border: `1px solid ${t.ruleStrong}`, borderRadius: 8, fontSize: 11, fontWeight: 700, color: t.ink, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
          <IconWizard size={12} color={t.inkMute} /> Edit
        </div>
        <div onClick={onPlayground} style={{ padding: '6px 11px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 8, fontSize: 11, fontWeight: 700, color: t.teal, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
          <IconChart size={12} color={t.teal} /> Play
        </div>
      </div>
    </div>
  );
}

function PersRoster({ t, onEdit, onPlayground }) {
  const rows = PERS_ROWS.map((r, i) => ({ ...r, rank: i + 1 }));
  return (
    <div style={{ flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Threshold legend */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '9px 16px', borderBottom: `1px solid ${t.rule}`, fontSize: 10.5, color: t.inkMute }}>
        {[
          { c: t.success, l: '≥ 90% award-eligible' },
          { c: t.warning, l: '80–89% watch' },
          { c: t.danger, l: '< 80% below floor' },
        ].map((x) => (
          <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: x.c }}></div>{x.l}
          </div>
        ))}
        <div style={{ flex: 1 }}></div>
        <span style={{ fontFamily: APP_FONT_MONO, fontSize: 10 }}>Manager entry overrides agent self-entry</span>
      </div>
      <PersHeader t={t} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {rows.map((r, i) => (
          <PersRow key={r.name} t={t} r={r} rank={r.rank} zebra={i % 2 === 1} onEdit={() => onEdit && onEdit(r)} onPlayground={() => onPlayground && onPlayground(r)} />
        ))}
      </div>
    </div>
  );
}

// Mobile card
function PersMobileCard({ t, r }) {
  const band = persBand(t, r.pct);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', background: t.surface, border: `1px solid ${r.pct < PERS_FLOOR ? t.danger + '33' : t.rule}`, borderRadius: 11 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>{r.name}</div>
        <div style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{r.unit} · {ttd(r.lapses)} lapsed · {r.by === 'manager' ? 'locked' : 'self-entry'}</div>
      </div>
      <span style={{ padding: '3px 10px', borderRadius: 999, background: band.bg, color: band.fg, fontSize: 13, fontWeight: 700, fontFamily: APP_FONT_DISPLAY }}>{r.pct}%</span>
    </div>
  );
}

Object.assign(window, {
  PERS_MONTH, PERS_GATE, PERS_FLOOR, persBand, PERS_ROWS, PERS_AGG, PERS_BELOW_FLOOR,
  PERS_ELIGIBLE, PERS_BELOW_GATE, PERS_LAPSES, PERS_TREND,
  PersReality, PersAtRisk, PersHeader, PersRow, PersRoster, PersMobileCard,
});

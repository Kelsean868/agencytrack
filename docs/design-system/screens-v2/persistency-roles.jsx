// Persistency Playground — role-scoped views + tenant admin shell.
// Agent (self), Unit Manager (their unit), Branch Manager (all units).
// Reuses the engine + AgentPlayground from persistency-lab.jsx.
// Adds the second tenant toggle: restatement scope (going-forward vs history).

// ── Org (mirrors repo ROSTER: 3 units · L1–L4 · pers = the v1 number) ────────
const ROSTER = [
  { name: 'Marsha Singh',    unit: 'S\u00b702', initials: 'MS', ytdApi: 487000, pers: 88, level: 'L4' },
  { name: 'Anand Persad',    unit: 'S\u00b701', initials: 'AP', ytdApi: 442000, pers: 91, level: 'L4' },
  { name: 'Selina Mohammed', unit: 'S\u00b703', initials: 'SM', ytdApi: 396000, pers: 87, level: 'L3' },
  { name: 'Riaz Khan',       unit: 'S\u00b702', initials: 'RK', ytdApi: 358000, pers: 90, level: 'L3' },
  { name: 'Kamla Singh',     unit: 'S\u00b701', initials: 'KS', ytdApi: 312000, pers: 86, level: 'L3' },
  { name: 'Trevor Ramnauth', unit: 'S\u00b703', initials: 'TR', ytdApi: 287000, pers: 89, level: 'L3' },
  { name: 'Carla Joseph',    unit: 'S\u00b702', initials: 'CJ', ytdApi: 268000, pers: 85, level: 'L2' },
  { name: 'Avinash Maharaj', unit: 'S\u00b702', initials: 'AM', ytdApi: 227000, pers: 84, level: 'L2' },
  { name: 'Hema Lakhan',     unit: 'S\u00b701', initials: 'HL', ytdApi: 231000, pers: 88, level: 'L2' },
  { name: 'Jamal Khan',      unit: 'S\u00b703', initials: 'JK', ytdApi: 198000, pers: 82, level: 'L2' },
  { name: 'Priya Naidu',     unit: 'S\u00b701', initials: 'PN', ytdApi: 156000, pers: 72, level: 'L1' },
  { name: 'Devin Lewis',     unit: 'S\u00b702', initials: 'DL', ytdApi: 122000, pers: 76, level: 'L1' },
  { name: 'Nisha Ramdeen',   unit: 'S\u00b703', initials: 'NR', ytdApi: 98000,  pers: 83, level: 'L1' },
  { name: 'Omar Ali',        unit: 'S\u00b701', initials: 'OA', ytdApi: 54000,  pers: 80, level: 'L1' },
];
const UNITS = ['S\u00b701', 'S\u00b702', 'S\u00b703'];
const UNIT_MGR = { 'S\u00b701': 'Kamla Singh', 'S\u00b702': 'Riaz Khan', 'S\u00b703': 'Selina Mohammed' };

// ── Per-agent synthetic policy book — reproduces v1 = roster pers exactly, ───
//    with lapse timing spread so v2 diverges. Priya uses the canonical BOOK.
function mulberry(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
function makeBook(a) {
  if (a.name === 'Priya Naidu') return BOOK.map((p) => ({ ...p }));
  const gross = Math.max(5000, Math.round(a.ytdApi / 12 / 100) * 100);
  const openApi = Math.round(gross * (1 - a.pers / 100) / 50) * 50;
  const rnd = mulberry(a.name);
  const policies = [{ id: 'active', name: 'Active policies', type: 'In force', api: gross - openApi, state: 'active' }];
  let remaining = openApi;
  const slots = [5, 11, 18];
  for (let i = 0; i < slots.length && remaining > 50; i++) {
    const last = i === slots.length - 1;
    let api = last ? remaining : Math.round(remaining * (0.35 + rnd() * 0.35) / 50) * 50;
    api = Math.min(api, remaining); if (api < 50) api = remaining;
    const lapseMonth = Math.min(22, slots[i] + Math.floor(rnd() * 3));
    policies.push({ id: 'p' + i, name: 'Policy ' + (i + 1), type: rnd() > 0.5 ? 'Whole Life' : 'Term',
      api, state: 'lapsed', lapseMonth, age: Math.min(23, lapseMonth + 2 + Math.floor(rnd() * 4)), reinstateMonth: null });
    remaining -= api;
  }
  return policies;
}
const BOOKS = Object.fromEntries(ROSTER.map((a) => [a.name, makeBook(a)]));

function applyAgentMoves(book, moves) {
  if (!moves) return book;
  return book.map((p) => (moves[p.id] && p.state === 'lapsed' && p.reinstateMonth == null) ? { ...p, reinstateMonth: p.age } : p);
}
const atRiskOf = (book) => book.filter((p) => p.state === 'lapsed' && p.reinstateMonth == null);

// ── Second tenant toggle: restatement scope ─────────────────────────────────
function RestateSeg({ t, value, onChange }) {
  const opts = [{ v: 'forward', label: 'Going forward' }, { v: 'history', label: 'Restate history' }];
  return (
    <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.12)', borderRadius: 9, padding: 3, gap: 3 }}>
      {opts.map((o) => {
        const on = value === o.v;
        return <div key={o.v} onClick={() => onChange(o.v)} style={{ padding: '7px 13px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          fontFamily: APP_FONT_DISPLAY, whiteSpace: 'nowrap', background: on ? '#fff' : 'transparent', color: on ? t.tealDark : 'rgba(255,255,255,0.8)',
          transition: 'all 160ms ease', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.18)' : 'none' }}>{o.label}</div>;
      })}
    </div>
  );
}

function RoleSeg({ t, role, onChange }) {
  const opts = [{ v: 'agent', label: 'Agent' }, { v: 'unit', label: 'Unit Manager' }, { v: 'branch', label: 'Branch Manager' }];
  return (
    <div style={{ display: 'inline-flex', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10, padding: 4, gap: 4 }}>
      {opts.map((o) => {
        const on = role === o.v;
        return <div key={o.v} onClick={() => onChange(o.v)} style={{ padding: '8px 16px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          background: on ? t.surface : 'transparent', color: on ? t.teal : t.inkMute, border: on ? `1px solid ${t.rule}` : '1px solid transparent',
          boxShadow: on ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', whiteSpace: 'nowrap' }}>{o.label}</div>;
      })}
    </div>
  );
}

// ── Scope aggregate tiles ────────────────────────────────────────────────────
function ScopeAgg({ t, label, now, proj }) {
  const projColor = bandColor(t, proj);
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, color: t.inkFaint, marginBottom: 11 }}>{label}</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
        <div style={{ flex: 1, padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>NOW</div>
          <div style={{ fontSize: 27, fontWeight: 800, color: bandColor(t, now), fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>{now.toFixed(1)}%</div>
          <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 3, fontFamily: APP_FONT_MONO }}>{bandLabel(now)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', color: t.inkFaint }}><IconArrowR size={18} color={t.inkFaint} stroke={2.2} /></div>
        <div style={{ flex: 1, padding: '12px 14px', background: projColor + '14', border: `1px solid ${projColor}44`, borderRadius: 11 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: projColor, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>PROJECTED</div>
          <div style={{ fontSize: 27, fontWeight: 800, color: projColor, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>{proj.toFixed(1)}%</div>
          <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 3, fontFamily: APP_FONT_MONO }}>{bandLabel(proj)}</div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', background: t.successTint, border: `1px solid ${t.success}33`, borderRadius: 11 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: t.success, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>GATE</div>
          <div style={{ fontSize: 27, fontWeight: 800, color: t.success, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>{GATE}%</div>
          <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 3, fontFamily: APP_FONT_MONO }}>award-eligible</div>
        </div>
      </div>
      <div style={{ position: 'relative', height: 8, background: t.surfaceMute, borderRadius: 999, marginTop: 14 }}>
        <div style={{ width: `${Math.min(100, proj)}%`, height: 8, background: projColor, borderRadius: 999, transition: 'width 320ms cubic-bezier(0.34,1,0.64,1)' }}></div>
        <div style={{ position: 'absolute', top: -3, left: `${GATE}%`, width: 2, height: 14, background: t.success, borderRadius: 999 }}></div>
        <div style={{ position: 'absolute', top: -3, left: `${FLOOR}%`, width: 2, height: 14, background: t.danger, borderRadius: 999 }}></div>
      </div>
    </div>
  );
}

// ── A coachable agent row (expandable → per-policy reinstate toggles) ─────────
function ManagerAgentRow({ t, model, agent, moves, setMoves, open, onOpen }) {
  const book = BOOKS[agent.name];
  const now = persistency(book, model);
  const proj = persistency(applyAgentMoves(book, moves), model);
  const coached = persistency(book.map((p) => p.state === 'lapsed' && p.reinstateMonth == null ? { ...p, reinstateMonth: p.age } : p), model);
  const projColor = bandColor(t, proj);
  const moved = proj !== now;
  const lapsed = atRiskOf(book);
  const headroom = coached - now;
  const toggle = (pid) => setMoves((m) => ({ ...m, [agent.name]: { ...(m[agent.name] || {}), [pid]: !((m[agent.name] || {})[pid]) } }));
  return (
    <div style={{ border: `1px solid ${moved ? t.success + '55' : t.rule}`, borderRadius: 12, background: t.surface, transition: 'border-color 180ms ease' }}>
      <div onClick={onOpen} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', cursor: lapsed.length ? 'pointer' : 'default' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{agent.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{agent.name} <span style={{ color: t.inkFaint, fontWeight: 500 }}>· {agent.unit} · {agent.level}</span></div>
          <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1, fontFamily: APP_FONT_MONO }}>{lapsed.length ? `${lapsed.length} at-risk · ${ttd(lapsed.reduce((s, p) => s + p.api, 0))}` : 'clean book'}</div>
        </div>
        {/* now → proj */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: bandColor(t, now), fontFamily: APP_FONT_DISPLAY }}>{now.toFixed(0)}%</span>
          {moved && <><IconArrowR size={13} color={t.inkFaint} stroke={2.2} /><span style={{ fontSize: 16, fontWeight: 800, color: projColor, fontFamily: APP_FONT_DISPLAY }}>{proj.toFixed(0)}%</span></>}
        </div>
        {lapsed.length > 0 && (
          <div style={{ width: 70, textAlign: 'right' }}>
            {!moved
              ? <span style={{ fontSize: 11, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO }}>+{headroom.toFixed(1)} pp</span>
              : <span style={{ fontSize: 10.5, fontWeight: 700, color: t.success, fontFamily: APP_FONT_MONO }}>coaching</span>}
          </div>
        )}
        {lapsed.length > 0 && <IconChevD size={15} color={t.inkFaint} stroke={2.2} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }} />}
      </div>
      {open && lapsed.length > 0 && (
        <div style={{ padding: '0 13px 13px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>Reinstate to model the recovery · {model}</div>
          {lapsed.map((p) => {
            const on = (moves[agent.name] || {})[p.id];
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: on ? t.successTint : t.surfaceSoft, border: `1px solid ${on ? t.success + '55' : t.rule}`, borderRadius: 9 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.ink }}>{p.name} · {p.type}</div>
                  <div style={{ fontSize: 10, color: t.inkMute, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{ttd(p.api)} · lapsed m{p.lapseMonth} · {p.age} mo in</div>
                </div>
                <div style={{ fontSize: 10, fontFamily: APP_FONT_MONO, color: t.inkMute }}>{model === 'v2' ? `credit ${rem(p.age)}mo` : `+${ttd(p.api)}`}</div>
                <div onClick={() => toggle(p.id)} style={{ width: 38, height: 22, borderRadius: 999, flexShrink: 0, cursor: 'pointer', background: on ? t.success : t.surfaceMute, border: `1px solid ${on ? 'transparent' : t.ruleStrong}`, position: 'relative', transition: 'background 160ms' }}>
                  <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.3)', transition: 'left 160ms' }}></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Scope playground (unit or branch) ────────────────────────────────────────
function ScopePlayground({ t, model, role }) {
  const scopeUnit = 'S\u00b701';
  const members = role === 'unit' ? ROSTER.filter((a) => a.unit === scopeUnit) : ROSTER;
  const [moves, setMoves] = React.useState({});
  const [openId, setOpenId] = React.useState(role === 'unit' ? 'Priya Naidu' : null);

  const meanPers = (withMoves) => {
    const vals = members.map((a) => persistency(withMoves ? applyAgentMoves(BOOKS[a.name], moves[a.name]) : BOOKS[a.name], model));
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };
  const aggNow = meanPers(false), aggProj = meanPers(true);

  const belowGate = members.filter((a) => persistency(BOOKS[a.name], model) < GATE)
    .sort((x, y) => persistency(BOOKS[x.name], model) - persistency(BOOKS[y.name], model));
  const onTrack = members.filter((a) => persistency(BOOKS[a.name], model) >= GATE);

  const title = role === 'unit' ? `Unit ${scopeUnit}` : 'South Branch';
  const sub = role === 'unit' ? `Your unit · ${members.length} agents · you are ${UNIT_MGR[scopeUnit]}` : `3 units · ${members.length} agents · branch manager view`;
  const eyebrow = role === 'unit' ? 'UNIT MANAGER · COACH YOUR AGENTS' : 'BRANCH MANAGER · COACH ACROSS UNITS';

  const rowsFor = (list) => list.map((a) => (
    <ManagerAgentRow key={a.name} t={t} model={model} agent={a} moves={moves} setMoves={setMoves}
      open={openId === a.name} onOpen={() => setOpenId((o) => o === a.name ? null : a.name)} />
  ));

  return (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: 'clamp(16px,3vw,32px)' }}>
      <div style={{ width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, color: t.teal }}>PERSISTENCY PLAYGROUND · {eyebrow}</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', color: t.ink, marginTop: 4 }}>{title} <span style={{ color: t.inkFaint, fontWeight: 500, fontSize: 16 }}>· {sub}</span></div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 999, fontSize: 11, fontWeight: 700, fontFamily: APP_FONT_MONO, color: t.inkMute }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: model === 'v2' ? t.teal : t.warning }}></span>
            MODEL: {model === 'v2' ? 'v2 · ROLLING 24-MO' : 'v1 · SETTLED RATIO'}
          </div>
        </div>

        <ScopeAgg t={t} label={`${role === 'unit' ? 'UNIT' : 'BRANCH'} PERSISTENCY · NOW → WITH YOUR COACHING MOVES`} now={aggNow} proj={aggProj} />
        <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: -8, lineHeight: 1.5 }}>
          Expand any agent and reinstate their at-risk policies to model the recovery — the {role === 'unit' ? 'unit' : 'branch'} average above updates live.
          {model === 'v2' && <span> Under v2, reinstating an <b style={{ color: t.ink }}>early</b> lapse recovers the most, and the window decays each month.</span>}
        </div>

        {/* below-gate (coachable) */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.danger, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 9 }}>★ Below the {GATE}% gate · {belowGate.length} agents</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{rowsFor(belowGate)}</div>
        </div>

        {/* on-track */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.success, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 9 }}>Award-eligible · {onTrack.length} agents</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{rowsFor(onTrack)}</div>
        </div>

        <div style={{ fontSize: 11, color: t.inkFaint, fontFamily: APP_FONT_MONO, textAlign: 'center', paddingTop: 4 }}>
          Illustrative books · each agent's v1 reproduces their roster persistency · v2 recomputes per-policy under the active tenant model.
        </div>
      </div>
    </div>
  );
}

// ── Top-level shell: admin bar (model + restatement) + role switch ───────────
function PersistencyLab() {
  const t = APP_LIGHT;
  const [model, setModel] = React.useState('v2');
  const [restate, setRestate] = React.useState('forward');
  const [role, setRole] = React.useState('agent');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: t.bg }}>
      {/* TENANT ADMIN BAR */}
      <div style={{ background: t.tealDark, color: '#fff', padding: '13px clamp(16px,4vw,40px)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AgencyLogo size={26} />
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>TENANT ADMIN · POLICY &amp; THRESHOLDS</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em', marginTop: 2, whiteSpace: 'nowrap' }}>Persistency calculation model</div>
          </div>
        </div>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: 999, fontSize: 10, fontWeight: 700, fontFamily: APP_FONT_MONO, color: 'rgba(255,255,255,0.8)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          COMPANY-LOCKED
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: APP_FONT_MONO, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em' }}>MODEL</span>
            <ModelSeg t={t} model={model} onChange={setModel} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: APP_FONT_MONO, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em' }}>RESTATEMENT</span>
            <RestateSeg t={t} value={restate} onChange={setRestate} />
          </div>
        </div>
      </div>

      {/* INFO STRIP */}
      <div style={{ background: model === 'v2' ? t.tealTint : t.warningTint, borderBottom: `1px solid ${t.rule}`, padding: '8px clamp(16px,4vw,40px)', fontSize: 11.5, color: model === 'v2' ? t.tealDark : t.warning, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <IconAlert size={13} color={model === 'v2' ? t.teal : t.warning} />
        <span>Tenant-wide · serving <b>{model === 'v2' ? 'v2 · rolling 24-month' : 'v1 · settled ratio'}</b> to every surface.</span>
        <span style={{ color: t.inkMute }}>·</span>
        <span style={{ color: t.inkMute }}>Restatement: <b style={{ color: model === 'v2' ? t.tealDark : t.warning }}>{restate === 'forward' ? 'going forward only — prior periods stay on v1' : 'history restated — all prior periods recomputed under the active model'}</b></span>
      </div>

      {/* ROLE SWITCH */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px clamp(16px,4vw,40px) 0', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: APP_FONT_MONO, color: t.inkFaint, letterSpacing: '0.12em' }}>VIEWING AS</span>
        <RoleSeg t={t} role={role} onChange={setRole} />
        <span style={{ fontSize: 11.5, color: t.inkMute }}>
          {role === 'agent' ? 'Improve your own persistency.' : role === 'unit' ? 'Improve your own + your unit\u2019s agents.' : 'Improve agents across every unit you run.'}
        </span>
      </div>

      {role === 'agent' ? <AgentPlayground t={t} model={model} /> : <ScopePlayground t={t} model={model} role={role} />}
    </div>
  );
}

Object.assign(window, { ROSTER, UNITS, BOOKS, makeBook, ScopePlayground, ManagerAgentRow, RestateSeg, RoleSeg, ScopeAgg, PersistencyLab });

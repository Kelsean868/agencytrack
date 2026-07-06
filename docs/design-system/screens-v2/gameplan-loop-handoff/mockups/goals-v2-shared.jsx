// Goals v2 — the goal cascade + per-tier goal-setting (manager surface).
//
// Repo model: a persistent Goal Cascade (Personal → Unit → Branch → SM →
// tenure-based company floor), sub-tabs (Agents / Unit / Branch / SM / Self),
// per-agent expandable goal rows with Above-floor / Below-floor / Not-set
// status vs a tenure-based API floor, provenance ("last set by"). v2 adds the
// recommend-vs-lock grammar (reuses RecommendGoal from manager-v2-drill).
//
// Reuses ROSTER (mastersheet-v2-shared) + ManagerShell/ScopeSwitch/GoldBanner.

const TENURE_FLOORS = { L1: 250_000, L2: 350_000, L3: 450_000, L4: 550_000 };
const COMPANY_MINS = { apps: 42, persistency: 90 };

// The cascade nodes (branch_manager frame; Branch is the manager's own tier).
const CASCADE = [
  { key: 'personal', label: 'Personal', sub: 'agent commitment', target: 420_000, ytd: 358_000 },
  { key: 'unit',     label: 'Unit · S·02', sub: 'rolled from agents', target: 2_200_000, ytd: 1_640_000 },
  { key: 'branch',   label: 'Branch · South', sub: 'your tier', target: 12_000_000, ytd: 8_420_000, me: true },
  { key: 'sm',       label: 'Sales Mgr', sub: 'rolls up branches', target: 11_000_000, ytd: 7_900_000 },
  { key: 'floor',    label: 'Company floor', sub: 'tenure minimum', target: 9_600_000, ytd: 8_420_000, floor: true },
];

// Per-agent annual goals vs their tenure floor.
const GOAL_ROWS = [
  { name: 'Marsha Singh',    unit: 'S·02', initials: 'MS', level: 'L4', target: 600_000, apps: 48, pers: 92, by: 'self',      set: true },
  { name: 'Anand Persad',    unit: 'S·01', initials: 'AP', level: 'L4', target: 580_000, apps: 46, pers: 91, by: 'Trevor R.', set: true },
  { name: 'Selina Mohammed', unit: 'S·03', initials: 'SM', level: 'L3', target: 480_000, apps: 44, pers: 90, by: 'Trevor R.', set: true },
  { name: 'Riaz Khan',       unit: 'S·02', initials: 'RK', level: 'L3', target: 460_000, apps: 43, pers: 90, by: 'self',      set: true },
  { name: 'Jamal Khan',      unit: 'S·03', initials: 'JK', level: 'L2', target: 360_000, apps: 42, pers: 88, by: 'Trevor R.', set: true },
  { name: 'Avinash Maharaj', unit: 'S·02', initials: 'AM', level: 'L2', target: 320_000, apps: 38, pers: 86, by: 'self',      set: true },
  { name: 'Priya Naidu',     unit: 'S·01', initials: 'PN', level: 'L1', target: 240_000, apps: 40, pers: 84, by: 'self',      set: true },
  { name: 'Devin Lewis',     unit: 'S·02', initials: 'DL', level: 'L1', target: 220_000, apps: 36, pers: 80, by: 'self',      set: true },
  { name: 'Nisha Ramdeen',   unit: 'S·03', initials: 'NR', level: 'L1', target: 260_000, apps: 42, pers: 88, by: 'Trevor R.', set: true },
  { name: 'Omar Ali',        unit: 'S·01', initials: 'OA', level: 'L1', target: 0,       apps: 0,  pers: 0,  by: null,        set: false },
];

function goalStatus(r) {
  if (!r.set) return 'unset';
  const floor = TENURE_FLOORS[r.level];
  if (r.target < floor || r.apps < COMPANY_MINS.apps || r.pers < COMPANY_MINS.persistency) return 'below';
  return 'above';
}
function statusChip(t, s) {
  if (s === 'above') return { fg: t.success, bg: t.successTint, label: 'Above floor' };
  if (s === 'below') return { fg: t.warning, bg: t.warningTint, label: 'Below floor' };
  return { fg: t.danger, bg: t.dangerTint, label: 'Not set' };
}

const GOAL_BELOW = GOAL_ROWS.filter((r) => goalStatus(r) === 'below').length;
const GOAL_UNSET = GOAL_ROWS.filter((r) => goalStatus(r) === 'unset').length;

// ──────────────────────────────────────────────────────────────────────────
// GOAL CASCADE — the anchor. Personal → Unit → Branch → SM → company floor.
// ──────────────────────────────────────────────────────────────────────────
function GoalCascade({ t }) {
  return (
    <div className="a-rise" style={{ flexShrink: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Eyebrow t={t}>Goal cascade · 2026</Eyebrow>
        <div style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO }}>Personal rolls up → company floor is the backstop</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
        {CASCADE.map((n, i) => {
          const pct = Math.round((n.ytd / n.target) * 100);
          const barC = n.floor ? t.warning : n.me ? t.teal : t.inkMute;
          return (
            <React.Fragment key={n.key}>
              <div style={{
                flex: 1, minWidth: 0, padding: '11px 13px', borderRadius: 11,
                background: n.me ? t.tealTint : t.surfaceSoft,
                border: `1px solid ${n.me ? t.teal + '55' : t.rule}`,
              }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: n.me ? t.teal : t.inkFaint, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 4 }}>{ttd(n.target)}</div>
                <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 1 }}>{n.sub}</div>
                <div style={{ marginTop: 8, height: 4, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                  <div className="a-progress-grow" style={{ width: `${Math.min(100, pct)}%`, height: 4, background: barC, borderRadius: 999 }}></div>
                </div>
                <div style={{ fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 4 }}>{pct}% YTD</div>
              </div>
              {i < CASCADE.length - 1 && (
                <div style={{ display: 'flex', alignItems: 'center', color: t.inkDim, flexShrink: 0 }}>
                  <IconChevR size={14} color={t.inkFaint} stroke={2.2} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// Sub-tab pills
function GoalSubTabs({ t, active = 'agents' }) {
  const tabs = [['agents', 'Agents'], ['unit', 'Unit'], ['branch', 'Branch'], ['sm', 'SM Target'], ['self', 'Self']];
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10, flexShrink: 0, alignSelf: 'flex-start' }}>
      {tabs.map(([k, l]) => {
        const on = k === active;
        return (
          <div key={k} style={{
            padding: '7px 16px', borderRadius: 7, fontSize: 12.5, fontWeight: 700,
            background: on ? t.surface : 'transparent', color: on ? t.teal : t.inkMute,
            boxShadow: on ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
            border: on ? `1px solid ${t.rule}` : '1px solid transparent',
          }}>{l}</div>
        );
      })}
    </div>
  );
}

// Company minimums strip
function MinimumsStrip({ t }) {
  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 18, padding: '10px 16px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 11.5, color: t.inkMute }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>Company minimums</span>
      <span>Annual API <b style={{ color: t.ink }}>tenure-based</b> (L1 {ttd(TENURE_FLOORS.L1)} → L4 {ttd(TENURE_FLOORS.L4)})</span>
      <span>Apps <b style={{ color: t.ink }}>{COMPANY_MINS.apps}</b></span>
      <span>Persistency <b style={{ color: t.ink }}>{COMPANY_MINS.persistency}%</b></span>
    </div>
  );
}

// Agent goal row — collapsed summary; one is expanded to show the targets.
function AgentGoalRow({ t, r, expanded, onSet }) {
  const status = goalStatus(r);
  const chip = statusChip(t, status);
  const floor = TENURE_FLOORS[r.level];
  return (
    <div style={{ background: t.surface, border: `1px solid ${expanded ? t.teal + '44' : t.rule}`, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{r.name}</span>
            <Pill t={t} color={chip.fg} bg={chip.bg}>{chip.label}</Pill>
          </div>
          <div style={{ fontSize: 11, color: t.inkMute, marginTop: 2 }}>
            {r.set
              ? <>Annual {ttd(r.target)} · Apps {r.apps} · Pers {r.pers}% · {r.by === 'self' ? 'self-set' : `set by ${r.by}`}</>
              : <>Tap to set 2026 targets · {r.level} floor {ttd(floor)}</>}
          </div>
        </div>
        <div onClick={onSet} style={{ padding: '7px 13px', background: t.teal, color: '#fff', borderRadius: 8, fontSize: 11.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0 }}>
          <IconTarget size={13} color="#fff" /> {r.set ? 'Adjust' : 'Set target'}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '4px 14px 14px', borderTop: `1px solid ${t.rule}` }}>
          {status === 'below' && (
            <div style={{ margin: '12px 0', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px', background: t.warningTint, border: `1px solid ${t.warning}44`, borderRadius: 8 }}>
              <IconAlert size={12} color={t.warning} />
              <span style={{ fontSize: 11, fontWeight: 700, color: t.warning }}>Annual API {ttd(r.target)} is below the {r.level} floor of {ttd(floor)}</span>
            </div>
          )}
          {/* Target fields (display) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
            {[
              { l: 'Annual API', v: ttd(r.target), warn: r.target < floor },
              { l: 'Annual Apps', v: r.apps, warn: r.apps < COMPANY_MINS.apps },
              { l: 'Persistency', v: `${r.pers}%`, warn: r.pers < COMPANY_MINS.persistency },
            ].map((f) => (
              <div key={f.l} style={{ padding: '10px 12px', background: t.surfaceSoft, border: `1px solid ${f.warn ? t.warning + '55' : t.rule}`, borderRadius: 9 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{f.l.toUpperCase()}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: f.warn ? t.warning : t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 3 }}>{f.v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 10 }}>
            {[['Monthly API', ttd(Math.round(r.target / 12))], ['Quarterly', ttd(Math.round(r.target / 4))], ['Weekly API', ttd(Math.round(r.target / 48))], ['Weekly Apps', Math.ceil(r.apps / 48 * 10) / 10]].map(([l, v]) => (
              <div key={l} style={{ padding: '9px 11px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{l.toUpperCase()}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, marginTop: 3 }}>{v}</div>
              </div>
            ))}
          </div>
          <div onClick={onSet} style={{ marginTop: 12, padding: '10px 14px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 3px 10px ${t.teal}44` }}>
            Recommend a revised target <IconArrowR size={13} color="#fff" stroke={2.4} />
          </div>
        </div>
      )}
    </div>
  );
}

function AgentGoalsList({ t, onSet }) {
  // Exception-first: below-floor + not-set first.
  const ordered = [...GOAL_ROWS].sort((a, b) => {
    const rank = { below: 0, unset: 1, above: 2 };
    return rank[goalStatus(a)] - rank[goalStatus(b)];
  });
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <MinimumsStrip t={t} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ordered.map((r, i) => (
          <AgentGoalRow key={r.name} t={t} r={r} expanded={i === 0} onSet={() => onSet && onSet(r)} />
        ))}
      </div>
    </div>
  );
}

// Tier goal form (Unit / Branch / SM) — provenance + recommend-vs-lock.
function TierGoalForm({ t, tier = 'branch' }) {
  const node = CASCADE.find((n) => n.key === tier) || CASCADE[2];
  const tierLabel = { unit: 'Unit · S·02', branch: 'South Branch', sm: 'Sales Manager' }[tier];
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em' }}>{tierLabel} goal · 2026</div>
            <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 2 }}>Last set by Trevor Ramcharan · 12 Nov · cascades down to units &amp; agents</div>
          </div>
          {/* recommend vs lock */}
          <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
            {[['Recommend', false], ['Lock', true]].map(([l, on]) => (
              <div key={l} style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: on ? t.surface : 'transparent', color: on ? t.teal : t.inkMute, border: on ? `1px solid ${t.teal}44` : '1px solid transparent' }}>{l}</div>
            ))}
          </div>
        </div>

        <GoldBanner t={t} title="Locked: this is the floor, not a suggestion" body="A locked tier goal becomes the minimum every unit and agent beneath it must meet. Switch to Recommend to let the level below propose their own." />

        <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[['Annual API (TTD)', ttd(node.target), true], ['Annual Apps', '512', false]].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 11, color: t.inkMute, marginBottom: 5 }}>{l}</div>
                <div style={{ height: 44, padding: '0 14px', display: 'flex', alignItems: 'center', background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, borderRadius: 9, fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
            {[['FFIs', '1,840'], ['CIs', '920'], ['Dials', '38,400']].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 11, color: t.inkMute, marginBottom: 5 }}>{l} <span style={{ color: t.inkFaint }}>(optional)</span></div>
                <div style={{ height: 40, padding: '0 12px', display: 'flex', alignItems: 'center', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 13, fontWeight: 600, color: t.ink, fontFamily: APP_FONT_MONO }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <div style={{ padding: '11px 20px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: `0 4px 12px ${t.teal}44` }}>
              <IconCheck size={14} color="#fff" stroke={2.4} /> Save &amp; cascade
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Self tab — the manager's own commitment (player-coach), separate from team.
function SelfGoalCard({ t }) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <GoldBanner t={t} title="Your personal commitment" body="As a producing manager you carry your own annual target. It's tracked separately and never rolled into the unit or branch totals." />
        <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, padding: '18px 20px' }}>
          <Eyebrow t={t}>Your annual target · 2026</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: 10 }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>{ttd(180_000)}</div>
            <div style={{ fontSize: 12.5, color: t.inkMute, paddingBottom: 4 }}>Annual API · 142K YTD · 79%</div>
          </div>
          <div style={{ marginTop: 14, height: 7, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
            <div className="a-progress-grow" style={{ width: '79%', height: 7, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <div style={{ padding: '10px 16px', background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, color: t.ink }}>Open Commission Playground</div>
            <div style={{ padding: '10px 16px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700 }}>Save my target</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mobile agent goal card
function GoalMobileCard({ t, r, onSet }) {
  const chip = statusChip(t, goalStatus(r));
  const floor = TENURE_FLOORS[r.level];
  return (
    <div onClick={onSet} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', background: t.surface, border: `1px solid ${goalStatus(r) !== 'above' ? chip.fg + '33' : t.rule}`, borderRadius: 11 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{r.name}</div>
        <div style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{r.set ? `${ttd(r.target)} · ${r.level} floor ${ttd(floor)}` : `not set · ${r.level} floor ${ttd(floor)}`}</div>
      </div>
      <Pill t={t} color={chip.fg} bg={chip.bg}>{chip.label}</Pill>
    </div>
  );
}

Object.assign(window, {
  TENURE_FLOORS, COMPANY_MINS, CASCADE, GOAL_ROWS, goalStatus, statusChip, GOAL_BELOW, GOAL_UNSET,
  GoalCascade, GoalSubTabs, MinimumsStrip, AgentGoalRow, AgentGoalsList, TierGoalForm, SelfGoalCard, GoalMobileCard,
});

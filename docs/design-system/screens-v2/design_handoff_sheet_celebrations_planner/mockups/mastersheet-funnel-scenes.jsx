// Master Sheet — FUNNEL edition. Composed scenes.
//
// Desktop: ManagerShell → reality bar (unchanged) · funnel action bar
// (VIEW totals↔details · RANK BY preset · UNIT segmented · FILTERS panel ·
// exceptions toggle) · active-filter chips · the grouped funnel table.
// Sorting is tri-state: click a column ↓, again ↑, third click returns to
// the default listing (YTD API rank). Every active filter renders as a
// dismissible chip so state is always visible and reversible.
// Narrow: ~834px strategy — condensed lead column, stage scrubber.

const FUNNEL_TOGGLABLE_IDS = FUNNEL_GROUPS.filter((g) => g.id !== 'qa').map((g) => g.id);
const FUNNEL_UNITS = ['all', 'S·01', 'S·02', 'S·03'];
const FUNNEL_STATUS_OPTS = [['ontrack', 'On track'], ['pace', 'Off pace'], ['quiet', 'Gone quiet'], ['report', 'Report late'], ['persistency', 'Pers. ↓'], ['floor', 'Below floor']];
const FUNNEL_LEVEL_OPTS = ['L1', 'L2', 'L3', 'L4'];
const FUNNEL_REPORT_OPTS = [['submitted', 'Submitted'], ['draft', 'Draft'], ['missing', 'Missing']];
const DEFAULT_FUNNEL_FILTERS = { statuses: [], levels: [], reports: [], noLogOnly: false };

function useFunnelExpanded(defaultExpanded = []) {
  const [expanded, setExpanded] = React.useState(() => new Set(defaultExpanded));
  const toggle = (id) => setExpanded((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const expandAll = () => setExpanded(new Set(FUNNEL_TOGGLABLE_IDS));
  const collapseAll = () => setExpanded(new Set());
  const allOpen = FUNNEL_TOGGLABLE_IDS.every((id) => expanded.has(id));
  const allClosed = expanded.size === 0;
  return { expanded, toggle, expandAll, collapseAll, allOpen, allClosed };
}

// Tri-state sort: click ↓ (desc) → click ↑ (asc) → click clears back to the
// default listing (YTD API rank).
function useFunnelSort(initial = null) {
  const [sort, setSort] = React.useState(initial);
  const onSort = (key) => setSort((prev) => {
    if (!prev || prev.key !== key) return { key, dir: 'desc' };
    if (prev.dir === 'desc') return { key, dir: 'asc' };
    return null;
  });
  return { sort, setSort, onSort };
}

function funnelFiltersCount(unit, filters) {
  return (unit !== 'all' ? 1 : 0) + filters.statuses.length + filters.levels.length + filters.reports.length + (filters.noLogOnly ? 1 : 0);
}

// ── Action bar ────────────────────────────────────────────────────────────
function FunnelActionBar({ t, exceptionsOn = false, preset = 'api', onPreset, unit = 'all', onUnit, ex, filtersCount = 0, filtersOpen = false, onToggleFilters }) {
  const opts = [['api', 'API'], ['newNames', 'NEW NAMES']];
  const seg = (on) => ({
    padding: '6px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO,
    background: on ? t.surface : 'transparent', color: on ? t.teal : t.inkMute,
    border: on ? `1px solid ${t.rule}` : '1px solid transparent',
    boxShadow: on ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  });
  const label = { fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO };
  const segWrap = { display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={label}>VIEW</span>
        <div style={segWrap}>
          <div style={seg(ex.allClosed)} onClick={ex.collapseAll}>TOTALS</div>
          <div style={seg(ex.allOpen)} onClick={ex.expandAll}>+ DETAILS</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={label}>RANK BY</span>
        <div style={segWrap}>
          {opts.map(([k, l]) => <div key={k} style={seg(k === preset)} onClick={onPreset ? () => onPreset(k) : undefined}>{l}</div>)}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={label}>UNIT</span>
        <div style={segWrap}>
          {FUNNEL_UNITS.map((u) => (
            <div key={u} style={seg(u === unit)} onClick={onUnit ? () => onUnit(u) : undefined}>{u === 'all' ? 'ALL' : u}</div>
          ))}
        </div>
      </div>

      {/* FILTERS — opens the panel; badge counts active filters */}
      <div onClick={onToggleFilters} style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px',
        background: filtersOpen || filtersCount > 0 ? t.tealTint : t.surface,
        border: `1px solid ${filtersOpen || filtersCount > 0 ? t.teal + '55' : t.rule}`, borderRadius: 9,
        cursor: 'pointer', userSelect: 'none',
      }}>
        <IconFilter size={13} color={filtersOpen || filtersCount > 0 ? t.teal : t.inkMute} />
        <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em', color: filtersOpen || filtersCount > 0 ? t.teal : t.inkMute }}>FILTERS</span>
        {filtersCount > 0 && (
          <span style={{ minWidth: 15, height: 15, borderRadius: 999, background: t.teal, color: t.mode === 'light' ? '#fff' : '#12100C', fontSize: 9, fontWeight: 700, fontFamily: APP_FONT_MONO, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{filtersCount}</span>
        )}
      </div>

      <div style={{ flex: 1 }}></div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px',
        background: exceptionsOn ? t.warningTint : t.surface,
        border: `1px solid ${exceptionsOn ? t.warning + '44' : t.rule}`, borderRadius: 9,
      }}>
        <div style={{ width: 28, height: 16, background: exceptionsOn ? t.warning : t.inkDim, borderRadius: 999, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 2, [exceptionsOn ? 'right' : 'left']: 2, width: 12, height: 12, borderRadius: '50%', background: t.surface }}></div>
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: exceptionsOn ? t.warning : t.inkMute, letterSpacing: '0.04em' }}>Exceptions</div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: exceptionsOn ? t.warning : t.inkFaint, fontFamily: APP_FONT_MONO }}>{EXC_COUNT}</div>
      </div>

      <div title="Search agent" style={{ width: 34, height: 32, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconSearch size={14} color={t.inkMute} />
      </div>
      <div title="Export CSV" style={{ width: 34, height: 32, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconDownload size={14} color={t.inkMute} />
      </div>
    </div>
  );
}

// ── Filters panel — live-apply popover ────────────────────────────────────
function FiltersPanel({ t, filters, setFilters, onClose, onReset }) {
  const chip = (on) => ({
    padding: '5px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.05em',
    background: on ? t.tealTint : t.surface, color: on ? t.teal : t.inkMute,
    border: `1px solid ${on ? t.teal + '55' : t.rule}`, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  });
  const eyebrow = { fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, marginBottom: 7 };
  const toggleIn = (arr, v) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  return (
    <div className="a-card" style={{
      position: 'absolute', top: 122, right: 0, width: 324, zIndex: 40,
      background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14,
      boxShadow: t.mode === 'light' ? '0 14px 34px rgba(38,35,28,0.14)' : '0 14px 34px rgba(0,0,0,0.55)',
      padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em' }}>Filters</div>
        <div style={{ flex: 1 }}></div>
        <div onClick={onReset} style={{ fontSize: 10, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em', cursor: 'pointer', userSelect: 'none', padding: '4px 8px' }}>RESET</div>
        <div onClick={onClose} style={{ padding: '5px 12px', background: t.teal, color: t.mode === 'light' ? '#fff' : '#12100C', borderRadius: 8, fontSize: 10.5, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em', cursor: 'pointer', userSelect: 'none' }}>DONE</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={eyebrow}>STATUS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {FUNNEL_STATUS_OPTS.map(([k, l]) => (
            <div key={k} style={chip(filters.statuses.includes(k))} onClick={() => setFilters({ ...filters, statuses: toggleIn(filters.statuses, k) })}>{l}</div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={eyebrow}>LEVEL</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {FUNNEL_LEVEL_OPTS.map((l) => (
            <div key={l} style={chip(filters.levels.includes(l))} onClick={() => setFilters({ ...filters, levels: toggleIn(filters.levels, l) })}>{l}</div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={eyebrow}>WEEKLY REPORT</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {FUNNEL_REPORT_OPTS.map(([k, l]) => (
            <div key={k} style={chip(filters.reports.includes(k))} onClick={() => setFilters({ ...filters, reports: toggleIn(filters.reports, k) })}>{l}</div>
          ))}
        </div>
      </div>

      <div onClick={() => setFilters({ ...filters, noLogOnly: !filters.noLogOnly })} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: filters.noLogOnly ? t.warningTint : t.surfaceSoft, border: `1px solid ${filters.noLogOnly ? t.warning + '44' : t.rule}`, borderRadius: 9, cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ width: 28, height: 16, background: filters.noLogOnly ? t.warning : t.inkDim, borderRadius: 999, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 2, [filters.noLogOnly ? 'right' : 'left']: 2, width: 12, height: 12, borderRadius: '50%', background: t.surface }}></div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: filters.noLogOnly ? t.warning : t.inkMute }}>No daily log this week only</div>
      </div>
    </div>
  );
}

// ── Active-filter chips — every active condition, dismissible ─────────────
function FunnelFilterChips({ t, unit, onClearUnit, filters, setFilters, sort, onClearSort }) {
  const chips = [];
  const push = (key, text, clear) => chips.push({ key, text, clear });
  if (sort) {
    const col = FUNNEL_COLS.find((c) => c.key === sort.key);
    const grp = FUNNEL_GROUPS.find((g) => g.id === col.groupId);
    push('sort', `SORT · ${grp.num} ${col.label.toUpperCase()} ${sort.dir === 'desc' ? '↓' : '↑'}`, onClearSort);
  }
  if (unit !== 'all') push('unit', `UNIT · ${unit}`, onClearUnit);
  if (filters.statuses.length) push('status', `STATUS · ${filters.statuses.map((k) => FUNNEL_STATUS_OPTS.find(([x]) => x === k)[1].toUpperCase()).join(' / ')}`, () => setFilters({ ...filters, statuses: [] }));
  if (filters.levels.length) push('level', `LEVEL · ${filters.levels.join(' ')}`, () => setFilters({ ...filters, levels: [] }));
  if (filters.reports.length) push('report', `REPORT · ${filters.reports.map((r) => r.toUpperCase()).join(' / ')}`, () => setFilters({ ...filters, reports: [] }));
  if (filters.noLogOnly) push('nolog', 'NO DAILY LOG', () => setFilters({ ...filters, noLogOnly: false }));
  if (chips.length === 0) return null;
  const clearAll = () => { setFilters({ ...DEFAULT_FUNNEL_FILTERS }); onClearUnit(); onClearSort(); };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', flexShrink: 0 }}>
      {chips.map((c) => (
        <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px 4px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 999, fontSize: 9.5, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
          {c.text}
          <span onClick={c.clear} title="Clear" style={{ width: 15, height: 15, borderRadius: '50%', background: t.surface, border: `1px solid ${t.ruleStrong}`, color: t.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, cursor: 'pointer', userSelect: 'none', lineHeight: 1 }}>×</span>
        </div>
      ))}
      {chips.length > 1 && (
        <div onClick={clearAll} style={{ fontSize: 9.5, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em', cursor: 'pointer', userSelect: 'none', padding: '4px 6px' }}>CLEAR ALL</div>
      )}
    </div>
  );
}

// ── Desktop scene ─────────────────────────────────────────────────────────
// ── Row → coaching drawer ───────────────────────────────────────────────
const FUNNEL_FLOORS = { L1: 250_000, L2: 300_000, L3: 380_000, L4: 450_000 };

// Adapt a roster row to the AgentDrill agent shape.
function funnelDrillAgent(a) {
  return { ...a, contracted: `${a.weeks} wks reporting`, floor: FUNNEL_FLOORS[a.level] || 250_000 };
}

function FunnelClosePill({ t, onClick }) {
  return (
    <div onClick={onClick} style={{
      position: 'absolute', top: 16, right: 16, zIndex: 5,
      display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px 8px 10px',
      background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, borderRadius: 999, cursor: 'pointer',
      color: t.ink, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', fontFamily: APP_FONT_SANS, userSelect: 'none',
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
      Close
    </div>
  );
}

// The drawer overlay — the shared 5-tab coaching drawer (AgentDrill), slid
// in over the sheet, with a pinned footer routing deeper: the agent's full
// performance report, or straight into a 1-on-1 meeting mode.
function FunnelDrillDrawer({ t, agent, tab = 'weekly', onClose, onOneOnOne }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)', animation: 'app-fade-in 280ms ease both', zIndex: 20 }}></div>
      <div className="a-card" style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 468,
        background: t.surface, borderLeft: `1px solid ${t.rule}`,
        boxShadow: t.mode === 'light' ? '-12px 0 32px rgba(40,37,29,0.08)' : '-12px 0 32px rgba(0,0,0,0.5)',
        zIndex: 21, display: 'flex', flexDirection: 'column',
        animation: 'kiosk-slide-r 320ms cubic-bezier(0.34, 1, 0.64, 1) both',
      }}>
        <FunnelClosePill t={t} onClick={onClose} />
        <AgentDrill t={t} agent={agent} tab={tab} />
        {/* Go-deeper footer — always visible, whatever tab is active */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 9, padding: '12px 16px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft }}>
          <a href="AgencyTrack Agent Report View v2.html" target="_blank" style={{
            flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: t.surface, border: `1px solid ${t.ruleStrong}`, borderRadius: 11, textDecoration: 'none',
            color: t.ink, fontSize: 12.5, fontWeight: 700, fontFamily: APP_FONT_SANS,
          }}>
            <IconChart size={14} color={t.inkMute} /> Full report <span style={{ color: t.inkFaint, fontSize: 11 }}>↗</span>
          </a>
          <div onClick={onOneOnOne} style={{
            flex: 1.2, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: t.teal, color: t.mode === 'light' ? '#FFFFFF' : '#12100C', borderRadius: 11,
            fontSize: 12.5, fontWeight: 700, cursor: 'pointer', userSelect: 'none',
            boxShadow: t.mode === 'light' ? '0 6px 16px rgba(1,105,111,0.28)' : 'none',
          }}>
            <IconUsers size={14} color={t.mode === 'light' ? '#FFFFFF' : '#12100C'} /> Start 1-on-1
          </div>
        </div>
      </div>
    </>
  );
}

// ── 1-on-1 meeting mode — full-frame takeover for a sit-down with one agent.
// Projector-friendly: the agent's week as 8 funnel stage tiles + the weekly
// standard strip. Entered from the coaching drawer's “Start 1-on-1”.
function FunnelOneOnOne({ t, agent, onExit }) {
  const v = agent.v;
  const pill = flagPill(t, agent.flag);
  const stages = FUNNEL_GROUPS.map((g) => ({ g, kpi: g.cols.filter((c) => c.kpi)[0], subs: g.cols.filter((c) => !c.kpi) }));
  const standards = [
    { label: 'Tel Attempts', floor: 20, actual: v.telAtt },
    { label: 'Tel Contacts', floor: 8,  actual: v.telCon },
    { label: 'F2F Attempts', floor: 5,  actual: v.f2fAtt },
    { label: 'Qual. Appr.',  floor: 6,  actual: v.qa },
    { label: 'FFIs Cond.',   floor: 3,  actual: v.ffiCond },
    { label: 'CIs Cond.',    floor: 2,  actual: v.ciCond },
    { label: 'Apps',         floor: 1,  actual: v.apps },
    { label: 'New Names',    floor: 5,  actual: v.newNames },
  ];
  return (
    <div style={{ width: '100%', height: '100%', background: t.bg, padding: '24px 28px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: APP_FONT_SANS }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{agent.initials}</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.18em', fontFamily: APP_FONT_MONO }}>1-ON-1 · WEEK 48 · SOUTH BRANCH</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 3 }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.025em', lineHeight: 1.05 }}>{agent.name}</div>
            <Pill t={t} color={pill.fg} bg={pill.bg}>{pill.label}</Pill>
          </div>
          <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 2 }}>{agent.unit} · {agent.level} · {agent.contracted} · YTD {ttd(agent.ytdApi)}</div>
        </div>
        <div style={{ flex: 1 }}></div>
        <div onClick={onExit} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px 10px 12px', background: t.surface, border: `1px solid ${t.ruleStrong}`, borderRadius: 999, cursor: 'pointer', color: t.ink, fontSize: 12.5, fontWeight: 700, userSelect: 'none' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          Exit 1-on-1
        </div>
      </div>

      {/* The week as 8 funnel stage tiles */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: '1fr 1fr', gap: 12 }}>
        {stages.map(({ g, kpi, subs }) => {
          const kpiVal = v[kpi.key];
          const isTerm = kpi.terminal;
          return (
            <div key={g.id} style={{ background: t.surface, border: `1px solid ${isTerm ? t.teal + '55' : t.rule}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, letterSpacing: '0.1em' }}>{g.num}</span>
                <span style={{ fontSize: 8.5, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.11em' }}>{g.label}</span>
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, color: isTerm ? t.teal : kpiVal === 0 ? t.inkFaint : t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.025em', marginTop: 8, lineHeight: 1 }}>
                {kpi.money ? ttd(kpiVal) : kpiVal === 0 ? '—' : kpiVal}
              </div>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, marginTop: 3 }}>{kpi.label.toUpperCase()}</div>
              {subs.length > 0 && (
                <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {subs.map((c) => (
                    <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontFamily: APP_FONT_MONO, color: t.inkMute }}>
                      <span>{c.label}</span>
                      <span style={{ color: v[c.key] === 0 ? t.inkFaint : t.ink, fontWeight: 700 }}>{v[c.key] === 0 ? '—' : v[c.key]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Weekly standard strip */}
      <div style={{ flexShrink: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '12px 16px' }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, marginBottom: 10 }}>THE WEEKLY STANDARD · ACTUAL / FLOOR</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 14 }}>
          {standards.map((s) => {
            const ok = s.actual >= s.floor;
            const c = ok ? t.success : t.warning;
            return (
              <div key={s.label}>
                <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' }}>{s.label.toUpperCase()}</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: APP_FONT_MONO, color: c, marginTop: 3 }}>{s.actual}<span style={{ color: t.inkFaint, fontWeight: 400 }}>/{s.floor}</span></div>
                <div style={{ height: 3, background: t.surfaceMute, borderRadius: 999, marginTop: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (s.actual / s.floor) * 100)}%`, height: 3, background: c, borderRadius: 999 }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FunnelDesktopScene({ t, exceptionsOn = false, preset: initialPreset = 'api', scrollToGroup = null, defaultExpanded = [], defaultFilters = null, filtersOpen: initialFiltersOpen = false, drillAgent: initialDrillAgent = null, drillTab = 'weekly', oneOnOne: initialOneOnOne = false }) {
  const ex = useFunnelExpanded(defaultExpanded);
  const [preset, setPreset] = React.useState(initialPreset);
  const [unit, setUnit] = React.useState('all');
  const [filters, setFilters] = React.useState({ ...DEFAULT_FUNNEL_FILTERS, ...(defaultFilters || {}) });
  const [filtersOpen, setFiltersOpen] = React.useState(initialFiltersOpen);
  const { sort, setSort, onSort } = useFunnelSort(initialPreset === 'newNames' ? { key: 'newNames', dir: 'desc' } : null);
  const [drill, setDrill] = React.useState(() => {
    if (!initialDrillAgent) return null;
    const a = FUNNEL_ROWS.find((r) => r.name === initialDrillAgent);
    return a ? funnelDrillAgent(a) : null;
  });
  const [oneOnOne, setOneOnOne] = React.useState(initialOneOnOne);
  if (oneOnOne && drill) return <FunnelOneOnOne t={t} agent={drill} onExit={() => setOneOnOne(false)} />;
  const pickPreset = (k) => { setPreset(k); setSort({ key: k === 'newNames' ? 'newNames' : 'api', dir: 'desc' }); };
  const terminalKey = preset === 'newNames' ? 'newNames' : 'api';
  return (
    <ManagerShell t={t} active="sheet" title="Master Sheet" subtitle={`${MGR.branch} · Week 48 · ${ROSTER.length} agents`}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 11, position: 'relative' }}>
        <MasterReality t={t} />
        <FunnelActionBar
          t={t} exceptionsOn={exceptionsOn}
          preset={preset} onPreset={pickPreset}
          unit={unit} onUnit={setUnit} ex={ex}
          filtersCount={funnelFiltersCount(unit, filters)}
          filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen((v) => !v)}
        />
        <FunnelFilterChips t={t} unit={unit} onClearUnit={() => setUnit('all')} filters={filters} setFilters={setFilters} sort={sort} onClearSort={() => setSort(null)} />
        <FunnelTable
          t={t}
          exceptionsOn={exceptionsOn}
          terminalKey={terminalKey}
          unit={unit}
          filters={filters}
          sort={sort}
          onSort={onSort}
          scrollToGroup={scrollToGroup}
          expanded={ex.expanded}
          onToggleGroup={ex.toggle}
          onDrill={(a) => setDrill(funnelDrillAgent(a))}
        />
        {filtersOpen && (
          <FiltersPanel t={t} filters={filters} setFilters={setFilters} onClose={() => setFiltersOpen(false)} onReset={() => { setFilters({ ...DEFAULT_FUNNEL_FILTERS }); setUnit('all'); }} />
        )}
        {drill && <FunnelDrillDrawer t={t} agent={drill} tab={drillTab} onClose={() => setDrill(null)} onOneOnOne={() => setOneOnOne(true)} />}
      </div>
    </ManagerShell>
  );
}

// ── Narrow viewport (~834px) — scroll by stage, not by pixel ─────────────
function StageScrubber({ t, active, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
      {FUNNEL_GROUPS.map((g) => {
        const on = g.id === active;
        return (
          <div key={g.id} onClick={onPick ? () => onPick(g.id) : undefined} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 999,
            background: on ? t.teal : t.surface, border: `1px solid ${on ? t.teal : t.rule}`,
            fontFamily: APP_FONT_MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.09em',
            color: on ? (t.mode === 'light' ? '#FFFFFF' : '#12100C') : t.inkMute, whiteSpace: 'nowrap',
            cursor: 'pointer', userSelect: 'none',
          }}>
            <span style={{ opacity: on ? 0.75 : 0.55 }}>{g.num}</span>{g.short}
          </div>
        );
      })}
    </div>
  );
}

function FunnelNarrowScene({ t, activeStage = 'ffi', defaultExpanded = [] }) {
  const ex = useFunnelExpanded(defaultExpanded);
  const [stage, setStage] = React.useState(activeStage);
  const [unit, setUnit] = React.useState('all');
  const [drill, setDrill] = React.useState(null);
  const [oneOnOne, setOneOnOne] = React.useState(false);
  const { sort, onSort } = useFunnelSort(null);
  const chip = (on) => ({
    padding: '4px 8px', borderRadius: 999, fontSize: 8.5, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em',
    background: on ? t.tealTint : t.surface, color: on ? t.teal : t.inkMute,
    border: `1px solid ${on ? t.teal + '55' : t.rule}`, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  });
  return (
    <div style={{ width: '100%', height: '100%', background: t.bg, display: 'flex', flexDirection: 'column', gap: 11, padding: 18, boxSizing: 'border-box', fontFamily: APP_FONT_SANS, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em' }}>Master Sheet</div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.13em', fontFamily: APP_FONT_MONO }}>SOUTH BRANCH · WEEK 48</div>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {FUNNEL_UNITS.map((u) => (
            <div key={u} style={chip(u === unit)} onClick={() => setUnit(u)}>{u === 'all' ? 'ALL' : u}</div>
          ))}
        </div>
        <div style={{ padding: '4px 10px', background: t.warningTint, color: t.warning, borderRadius: 999, fontSize: 9.5, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>{EXC_COUNT} EXCEPTIONS</div>
      </div>
      <StageScrubber t={t} active={stage} onPick={setStage} />
      <FunnelTable t={t} narrow scrollToGroup={stage} unit={unit} sort={sort} onSort={onSort} expanded={ex.expanded} onToggleGroup={ex.toggle} onDrill={(a) => setDrill(funnelDrillAgent(a))} />
      {drill && !oneOnOne && <FunnelDrillDrawer t={t} agent={drill} tab="weekly" onClose={() => setDrill(null)} onOneOnOne={() => setOneOnOne(true)} />}
      {drill && oneOnOne && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30 }}>
          <FunnelOneOnOne t={t} agent={drill} onExit={() => setOneOnOne(false)} />
        </div>
      )}
    </div>
  );
}

// ── Branch meeting mode — the sheet in the room ──────────────────────────
// Projection frame (1280×720, deep dark by default). The SAME interactive
// table: VIEW totals↔details, per-stage +/− toggles, header-click sorting,
// plus a live search — so the manager can work the sheet mid-meeting.
const FUNNEL_MTG_DARK = { ...APP_DARK, bg: '#120F0B', surface: '#1E1914', surfaceSoft: '#181410', surfaceRaised: '#241E16', surfaceMute: '#181410' };

function FunnelMeetingScene({ t = FUNNEL_MTG_DARK, defaultExpanded = [], defaultSearch = '', defaultSort = null }) {
  const ex = useFunnelExpanded(defaultExpanded);
  const { sort, setSort, onSort } = useFunnelSort(defaultSort);
  const [search, setSearch] = React.useState(defaultSearch);
  const [exceptionsOn, setExceptionsOn] = React.useState(false);
  const seg = (on) => ({
    padding: '7px 13px', borderRadius: 7, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO,
    background: on ? t.surface : 'transparent', color: on ? t.teal : t.inkMute,
    border: on ? `1px solid ${t.ruleStrong}` : '1px solid transparent',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  });
  return (
    <div style={{ width: '100%', height: '100%', background: t.bg, padding: '22px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: APP_FONT_SANS, position: 'relative', overflow: 'hidden' }}>
      {/* Meeting header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.2em', fontFamily: APP_FONT_MONO }}>MONDAY STAND-UP · WEEK 48 · SOUTH BRANCH</div>
          <div style={{ fontSize: 27, fontWeight: 800, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.025em', marginTop: 3 }}>The Master Sheet</div>
        </div>
        <div style={{ flex: 1 }}></div>

        {/* Live search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 38, background: t.surface, border: `1px solid ${search ? t.teal + '66' : t.rule}`, borderRadius: 10 }}>
          <IconSearch size={14} color={search ? t.teal : t.inkMute} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agent…"
            style={{ width: 150, background: 'transparent', border: 'none', outline: 'none', color: t.ink, fontSize: 12.5, fontWeight: 600, fontFamily: APP_FONT_SANS }}
          />
          {search && <span onClick={() => setSearch('')} style={{ color: t.inkFaint, cursor: 'pointer', fontSize: 13, userSelect: 'none', lineHeight: 1 }}>×</span>}
        </div>

        {/* VIEW toggle */}
        <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
          <div style={seg(ex.allClosed)} onClick={() => { ex.collapseAll(); }}>TOTALS</div>
          <div style={seg(ex.allOpen)} onClick={() => { ex.expandAll(); }}>+ DETAILS</div>
        </div>

        {/* Exceptions */}
        <div onClick={() => setExceptionsOn((v) => !v)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '0 13px', height: 38,
          background: exceptionsOn ? t.warningTint : t.surface,
          border: `1px solid ${exceptionsOn ? t.warning + '55' : t.rule}`, borderRadius: 10,
          cursor: 'pointer', userSelect: 'none',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em', color: exceptionsOn ? t.warning : t.inkMute }}>EXCEPTIONS</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: exceptionsOn ? t.warning : t.inkFaint, fontFamily: APP_FONT_MONO }}>{EXC_COUNT}</span>
        </div>
      </div>

      {/* The same interactive funnel table */}
      <FunnelTable
        t={t}
        exceptionsOn={exceptionsOn}
        search={search}
        sort={sort}
        onSort={onSort}
        expanded={ex.expanded}
        onToggleGroup={ex.toggle}
      />
    </div>
  );
}

Object.assign(window, {
  FunnelActionBar, FiltersPanel, FunnelFilterChips, FunnelDesktopScene, StageScrubber, FunnelNarrowScene,
  FunnelMeetingScene, FUNNEL_MTG_DARK,
  FunnelDrillDrawer, FunnelClosePill, funnelDrillAgent, FunnelOneOnOne,
  useFunnelExpanded, useFunnelSort, funnelFiltersCount,
  FUNNEL_UNITS, FUNNEL_STATUS_OPTS, FUNNEL_LEVEL_OPTS, FUNNEL_REPORT_OPTS, DEFAULT_FUNNEL_FILTERS,
});

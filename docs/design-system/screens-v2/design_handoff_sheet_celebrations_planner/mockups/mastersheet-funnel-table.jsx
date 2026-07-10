// Master Sheet — FUNNEL edition. The grouped table itself.
//
// Design decisions this file encodes:
//   • Collapsed by default: every stage shows only its KPI (Total /
//     Conducted / API) — the whole funnel fits without scroll. Expanding a
//     stage (group-header toggle, or VIEW · +DETAILS in the action bar)
//     reveals its sub-columns in place.
//   • KPI sits LAST in its group — parts → outcome, so every stage closes
//     with an emphasized band. The funnel culminates in API, the terminal KPI.
//   • Emphasis is weight + tone, not color alone: stage-KPI bands get a
//     neutral ink wash + 700 weight; sub-columns sit at 400/muted. Teal is
//     reserved for the terminal KPI band only.
//   • Group boundary rhythm: a stronger hairline opens each group; the KPI
//     band visually closes it. 23 columns scan as 8 stages.
//   • Two-tier sticky header (group row + sub-column row) survives both
//     horizontal AND vertical scroll; Agent + Status stay pinned left.
//   • Totals row pinned to the bottom — the branch's whole funnel in one line.

const FUNNEL_T1_H = 27;   // group header row height

function funnelWashes(t) {
  return {
    kpi:  t.mode === 'light' ? 'rgba(38,35,28,0.05)'  : 'rgba(240,235,224,0.055)',
    term: t.mode === 'light' ? 'rgba(1,105,111,0.085)' : 'rgba(74,181,184,0.11)',
  };
}

function funnelViewGrid(view, narrow) {
  const lead = narrow ? '178px' : FUNNEL_LEAD_W.map((w) => `${w}px`).join(' ');
  return `${lead} ${view.cols.map((c) => `${c.w}px`).join(' ')}`;
}

// Tiny "IK" tag — the affordance connecting FFI Conducted + CI Conducted to
// the Activity Standards "Interviews Kept" derived figure.
function IkTag({ t }) {
  return (
    <span style={{ marginLeft: 5, padding: '1px 3px', border: `1px solid ${t.ruleStrong}`, borderRadius: 4, fontSize: 7.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', verticalAlign: '1px' }}>IK</span>
  );
}

// One numeric body cell.
function FunnelCell({ t, col, value, terminalKey }) {
  const w = funnelWashes(t);
  const isTerm = col.key === terminalKey;
  const isKpi = col.kpi;
  const zero = value === 0;
  const base = {
    padding: '8px 9px', textAlign: 'right', whiteSpace: 'nowrap',
    fontFamily: APP_FONT_MONO, fontVariantNumeric: 'tabular-nums',
    borderLeft: col.groupStart ? `1px solid ${t.ruleStrong}` : 'none',
    alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
  };
  if (isTerm) {
    return (
      <div style={{ ...base, background: `linear-gradient(${w.term},${w.term})`, fontSize: 12, fontWeight: 700, color: t.teal }}>
        {col.money ? <span><span style={{ fontSize: 8.5, color: t.mode === 'light' ? '#01696F99' : '#4AB5B899', marginRight: 3, letterSpacing: '0.06em' }}>TTD</span>{apiText(value)}</span> : value}
      </div>
    );
  }
  if (isKpi) {
    return (
      <div style={{ ...base, background: `linear-gradient(${w.kpi},${w.kpi})`, fontSize: 12, fontWeight: 700, color: zero ? t.inkFaint : t.ink }}>
        {col.money ? <span><span style={{ fontSize: 8.5, color: t.inkFaint, marginRight: 3, letterSpacing: '0.06em' }}>TTD</span>{apiText(value)}</span> : (zero ? '—' : value)}
      </div>
    );
  }
  return (
    <div style={{ ...base, fontSize: 11.5, fontWeight: 400, color: zero ? t.inkFaint : t.inkMute }}>
      {zero ? '—' : value}
    </div>
  );
}

// ── Two-tier header ───────────────────────────────────────────────────────
function FunnelHead({ t, view, narrow = false, terminalKey = 'api', onToggleGroup, sort = null, onSort }) {
  const w = funnelWashes(t);
  const grid = funnelViewGrid(view, narrow);
  const leadLefts = narrow ? [0] : [0, FUNNEL_LEAD_W[0], FUNNEL_LEAD_W[0] + FUNNEL_LEAD_W[1]];
  const leadSpan = narrow ? 1 : 3;
  const sub = {
    padding: '6px 9px', fontSize: 8.5, fontWeight: 500, color: t.inkMute,
    letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO,
    textAlign: 'right', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
  };
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 5 }}>
      {/* Tier 1 — funnel stages; click a stage to expand / collapse it */}
      <div style={{ display: 'grid', gridTemplateColumns: grid, background: t.surfaceSoft, borderBottom: `1px solid ${t.rule}`, height: FUNNEL_T1_H, alignItems: 'stretch' }}>
        <div style={{ gridColumn: `span ${leadSpan}`, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, position: 'sticky', left: 0, background: t.surfaceSoft, zIndex: 6, borderRight: `1px solid ${t.ruleStrong}` }}>
          THE FUNNEL →
        </div>
        {view.groups.map((g) => {
          const togglable = g.id !== 'qa';
          return (
            <div
              key={g.id}
              onClick={togglable && onToggleGroup ? () => onToggleGroup(g.id) : undefined}
              title={togglable ? (g.open ? 'Collapse to total' : 'Expand details') : undefined}
              style={{ gridColumn: `span ${g.vcols.length}`, display: 'flex', alignItems: 'center', padding: '0 8px 0 10px', borderLeft: `1px solid ${t.ruleStrong}`, whiteSpace: 'nowrap', overflow: 'hidden', cursor: togglable ? 'pointer' : 'default', userSelect: 'none' }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, letterSpacing: '0.1em' }}>{g.num}</span>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.11em', marginLeft: 6 }}>{g.open ? g.label : g.short}</span>
              {togglable && (
                <span style={{ marginLeft: 'auto', width: 14, height: 14, borderRadius: 4, border: `1px solid ${t.ruleStrong}`, background: t.surface, color: t.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>
                  {g.open ? '−' : '+'}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Tier 2 — sub-columns */}
      <div style={{ display: 'grid', gridTemplateColumns: grid, background: t.surface, borderBottom: `1px solid ${t.ruleStrong}`, alignItems: 'stretch' }}>
        {narrow ? (
          <div style={{ ...sub, textAlign: 'left', justifyContent: 'flex-start', position: 'sticky', left: 0, background: t.surface, zIndex: 6, paddingLeft: 12, borderRight: `1px solid ${t.ruleStrong}` }}>Agent</div>
        ) : (
          <>
            <div style={{ ...sub, justifyContent: 'center', position: 'sticky', left: leadLefts[0], background: t.surface, zIndex: 6 }}>#</div>
            <div style={{ ...sub, textAlign: 'left', justifyContent: 'flex-start', position: 'sticky', left: leadLefts[1], background: t.surface, zIndex: 6 }}>Agent · Unit</div>
            <div style={{ ...sub, textAlign: 'left', justifyContent: 'flex-start', position: 'sticky', left: leadLefts[2], background: t.surface, zIndex: 6, borderRight: `1px solid ${t.ruleStrong}` }}>Status</div>
          </>
        )}
        {view.cols.map((c) => {
          const isTerm = c.key === terminalKey;
          const sorted = sort && sort.key === c.key;
          const sortable = !!onSort;
          const style = {
            ...sub,
            borderLeft: c.groupStart ? `1px solid ${t.ruleStrong}` : 'none',
            ...(isTerm ? { background: `linear-gradient(${w.term},${w.term})`, color: t.teal, fontWeight: 700 }
              : c.kpi ? { background: `linear-gradient(${w.kpi},${w.kpi})`, color: t.ink, fontWeight: 700 }
              : {}),
            ...(sortable ? { cursor: 'pointer', userSelect: 'none' } : {}),
          };
          return (
            <div key={c.key} style={style} onClick={sortable ? () => onSort(c.key) : undefined} title={sortable ? `Sort by ${c.label} — ↓, ↑, then back to default` : undefined}>
              {c.label}{c.ik ? <IkTag t={t} /> : null}
              {sortable && (sorted
                ? <span style={{ marginLeft: 4, fontSize: 9, color: isTerm ? t.teal : t.ink }}>{sort.dir === 'desc' ? '↓' : '↑'}</span>
                : c.kpi ? <span style={{ marginLeft: 4, fontSize: 9, color: t.inkDim }}>↕</span> : null)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Body row ──────────────────────────────────────────────────────────────
function FunnelRow({ t, a, zebra, view, narrow = false, terminalKey = 'api', onDrill }) {
  const pill = flagPill(t, a.flag);
  const rowBg = zebra ? t.surfaceRaised : t.surface;
  const grid = funnelViewGrid(view, narrow);
  return (
    <div className="ms-row" onClick={onDrill} style={{ display: 'grid', gridTemplateColumns: grid, alignItems: 'stretch', background: rowBg, borderBottom: `1px solid ${t.rule}`, cursor: 'pointer' }}>
      {narrow ? (
        <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', left: 0, background: rowBg, zIndex: 2, borderRight: `1px solid ${t.ruleStrong}` }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 9.5, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{a.initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: pill.fg, flexShrink: 0 }}></span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
            </div>
            <div style={{ fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1, paddingLeft: 11 }}>{a.unit}</div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: a.rank <= 3 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY, position: 'sticky', left: 0, background: rowBg, zIndex: 2 }}>{a.rank}</div>
          <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 9, position: 'sticky', left: FUNNEL_LEAD_W[0], background: rowBg, zIndex: 2 }}>
            <div style={{ width: 25, height: 25, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 9.5, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{a.initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.ink, letterSpacing: '-0.005em', whiteSpace: 'nowrap' }}>{a.name}</div>
              <div style={{ fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1, letterSpacing: '0.04em' }}>{a.unit}{!a.logged ? ' · NO LOG' : ''}</div>
            </div>
          </div>
          <div style={{ padding: '6px 9px', display: 'flex', alignItems: 'center', position: 'sticky', left: FUNNEL_LEAD_W[0] + FUNNEL_LEAD_W[1], background: rowBg, zIndex: 2, borderRight: `1px solid ${t.ruleStrong}`, boxShadow: t.mode === 'light' ? '6px 0 8px -6px rgba(38,35,28,0.10)' : '6px 0 8px -6px rgba(0,0,0,0.45)' }}>
            <Pill t={t} color={pill.fg} bg={pill.bg}>{pill.label}</Pill>
          </div>
        </>
      )}
      {view.cols.map((c) => (
        <FunnelCell key={c.key} t={t} col={c} value={a.v[c.key]} terminalKey={terminalKey} />
      ))}
    </div>
  );
}

// ── Totals row — pinned bottom ────────────────────────────────────────────
function FunnelTotals({ t, rows, view, narrow = false, terminalKey = 'api' }) {
  const w = funnelWashes(t);
  const grid = funnelViewGrid(view, narrow);
  const tot = {};
  for (const c of view.cols) tot[c.key] = rows.reduce((s, r) => s + r.v[c.key], 0);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: grid, alignItems: 'stretch', position: 'sticky', bottom: 0, zIndex: 4, background: t.surfaceSoft, borderTop: `1px solid ${t.ruleStrong}` }}>
      <div style={{ gridColumn: `span ${narrow ? 1 : 3}`, display: 'flex', alignItems: 'center', padding: '9px 12px', fontSize: 9, fontWeight: 700, color: t.inkMute, letterSpacing: '0.13em', fontFamily: APP_FONT_MONO, position: 'sticky', left: 0, background: t.surfaceSoft, zIndex: 5, borderRight: `1px solid ${t.ruleStrong}` }}>
        SOUTH BRANCH · {rows.length} AGENTS
      </div>
      {view.cols.map((c) => {
        const isTerm = c.key === terminalKey;
        return (
          <div key={c.key} style={{
            padding: '9px 9px', textAlign: 'right', fontFamily: APP_FONT_MONO, fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            borderLeft: c.groupStart ? `1px solid ${t.ruleStrong}` : 'none',
            fontSize: isTerm || c.kpi ? 12 : 11, fontWeight: isTerm || c.kpi ? 700 : 500,
            color: isTerm ? t.teal : c.kpi ? t.ink : t.inkMute,
            background: isTerm ? `linear-gradient(${w.term},${w.term})` : c.kpi ? `linear-gradient(${w.kpi},${w.kpi})` : 'transparent',
          }}>
            {c.money ? <span><span style={{ fontSize: 8.5, opacity: 0.6, marginRight: 3 }}>TTD</span>{apiText(tot[c.key])}</span> : tot[c.key]}
          </div>
        );
      })}
    </div>
  );
}

// ── The table card ────────────────────────────────────────────────────────
// `expanded` (Set of group ids) + `onToggleGroup` drive the collapse
// mechanic; `sort` ({key, dir}) + `onSort` drive KPI-header sorting;
// `unit` + `filters` ({statuses, levels, reports, noLogOnly}) narrow the
// roster. When uncontrolled, the table manages its own collapse state
// (default: all collapsed — totals only).
function FunnelTable({ t, exceptionsOn = false, narrow = false, terminalKey = 'api', scrollToGroup = null, unit = 'all', filters = null, sort = null, onSort, expanded, onToggleGroup, onDrill, search = '' }) {
  const [ownExpanded, setOwnExpanded] = React.useState(() => new Set());
  const exp = expanded || ownExpanded;
  const toggle = onToggleGroup || ((id) => setOwnExpanded((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  }));
  const view = funnelView(exp);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && scrollToGroup) ref.current.scrollLeft = funnelViewOffset(view.cols, scrollToGroup);
  }, [scrollToGroup, exp]);
  let rows = exceptionsOn ? FUNNEL_ROWS.filter((r) => r.flag) : FUNNEL_ROWS;
  if (search && search.trim()) rows = rows.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()));
  if (unit !== 'all') rows = rows.filter((r) => r.unit === unit);
  if (filters) {
    if (filters.statuses && filters.statuses.length) rows = rows.filter((r) => filters.statuses.includes(r.flag || 'ontrack'));
    if (filters.levels && filters.levels.length) rows = rows.filter((r) => filters.levels.includes(r.level));
    if (filters.reports && filters.reports.length) rows = rows.filter((r) => filters.reports.includes(r.report));
    if (filters.noLogOnly) rows = rows.filter((r) => !r.logged);
  }
  if (sort) rows = [...rows].sort((a, b) => (sort.dir === 'asc' ? -1 : 1) * (b.v[sort.key] - a.v[sort.key]));
  rows = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const minW = (narrow ? 178 : FUNNEL_LEAD_W.reduce((a, b) => a + b, 0)) + view.cols.reduce((a, c) => a + c.w, 0);
  return (
    <div style={{ flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div ref={ref} style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ minWidth: minW }}>
          <FunnelHead t={t} view={view} narrow={narrow} terminalKey={terminalKey} onToggleGroup={toggle} sort={sort} onSort={onSort} />
          {rows.length === 0 && (
            <div style={{ padding: '44px 20px', textAlign: 'center', position: 'sticky', left: 0, width: narrow ? 700 : 900 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>NO AGENTS MATCH THE CURRENT FILTERS</div>
              <div style={{ fontSize: 12, color: t.inkMute, marginTop: 6 }}>Clear a filter chip above to widen the roster.</div>
            </div>
          )}
          {rows.map((a, i) => (
            <FunnelRow key={a.name} t={t} a={a} zebra={i % 2 === 1} view={view} narrow={narrow} terminalKey={terminalKey} onDrill={onDrill ? () => onDrill(a) : undefined} />
          ))}
          <FunnelTotals t={t} rows={rows} view={view} narrow={narrow} terminalKey={terminalKey} />
        </div>
      </div>
      {/* Footer — counts, the IK derivation, coach hint */}
      <div style={{ flexShrink: 0, padding: '8px 14px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft, display: 'flex', alignItems: 'center', gap: 14, fontSize: 10.5, color: t.inkMute }}>
        <span>{rows.length} of {ROSTER.length} agents{unit !== 'all' ? ` · unit ${unit}` : ''}</span>
        <span style={{ fontFamily: APP_FONT_MONO, fontSize: 9.5, letterSpacing: '0.04em', color: t.inkFaint }}>
          <span style={{ padding: '1px 3px', border: `1px solid ${t.ruleStrong}`, borderRadius: 4, fontSize: 7.5, fontWeight: 700, marginRight: 5, letterSpacing: '0.08em' }}>IK</span>
          FFI + CI CONDUCTED = INTERVIEWS KEPT · {INTERVIEWS_KEPT} THIS WEEK
        </span>
        <div style={{ flex: 1 }}></div>
        <span style={{ fontFamily: APP_FONT_MONO, fontSize: 9.5, letterSpacing: '0.04em', color: t.inkFaint }}>SORT: CLICK A COLUMN ↓ · AGAIN ↑ · 3RD CLICK RESETS</span>
        <span style={{ fontFamily: APP_FONT_MONO, fontSize: 9.5, letterSpacing: '0.04em', color: t.inkFaint }}>+ / − TOGGLES STAGE DETAIL</span>
        {!narrow && <span style={{ fontFamily: APP_FONT_MONO, fontSize: 9.5, letterSpacing: '0.04em' }}>CLICK A ROW TO COACH →</span>}
      </div>
    </div>
  );
}

Object.assign(window, { FunnelHead, FunnelRow, FunnelTotals, FunnelTable, funnelWashes, funnelViewGrid, IkTag });

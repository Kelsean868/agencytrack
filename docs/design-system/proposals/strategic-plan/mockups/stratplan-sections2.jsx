// Strategic Plan — sections 04 Period Metrics · 05 Org Structure · 06 Recruitment.

// ── 04 · Period Metrics (quarter / half granularity) ──────────────────────
function SpPeriodTable({ t, granularity = 'quarter', size = 'app' }) {
  const S = SP_SZ[size];
  const rows = SP_PERIODS[granularity].concat([SP_PERIODS.fy]);
  const money = (k) => ttd(k * 1000);
  const stateChip = (state) => state === 'progress'
    ? <span style={{ fontFamily:APP_FONT_MONO, fontSize:S.th, letterSpacing:'0.1em', color:t.teal, background:t.tealTint, padding:'2px 7px', borderRadius:999, fontWeight:700 }}>IN PROGRESS</span>
    : state === 'future'
      ? <span style={{ fontFamily:APP_FONT_MONO, fontSize:S.th, letterSpacing:'0.1em', color:t.inkFaint, background:t.surfaceMute, padding:'2px 7px', borderRadius:999, fontWeight:700 }}>UPCOMING</span>
      : <span style={{ fontFamily:APP_FONT_MONO, fontSize:S.th, letterSpacing:'0.1em', color:t.success, fontWeight:700 }}>✓ CLOSED</span>;
  const cell = (goal, act, fmt, state, last) => {
    const closed = state === 'done' || state === 'fy';
    return [
      <SpTd key="g" t={t} size={size} mono last={last}>{fmt(goal)}</SpTd>,
      <SpTd key="a" t={t} size={size} mono strong color={act == null ? t.inkFaint : t.ink} last={last}>{act == null ? '—' : fmt(act)}</SpTd>,
      <SpTd key="v" t={t} size={size} last={last}>{closed && act != null ? <SpVar t={t} v={act - goal} fmt={fmt === money ? (x) => ttd(x * 1000) : undefined} size={size} /> : <span style={{ fontFamily:APP_FONT_MONO, fontSize:S.mono, color:t.inkFaint }}>—</span>}</SpTd>,
    ];
  };
  return (
    <SpTable t={t} size={size}>
      <thead>
        <tr>
          {[['',1],['APPS · SETTLED',3],['API · NET SETTLED (TTD)',3],['MANPOWER · LICENSED',3],['',1]].map(([g, span], i) => (
            <th key={i} colSpan={span} style={{ padding:'8px 9px 2px', fontSize:S.th-0.5, fontWeight:700, letterSpacing:'0.16em', fontFamily:APP_FONT_MONO, color:t.teal, textAlign: i===0 ? 'left' : 'center', background:t.surfaceSoft, whiteSpace:'nowrap' }}>{g}</th>
          ))}
        </tr>
        <tr>
          <SpTh t={t} size={size} align="left" w={size==='pres' ? 120 : 90}>Period</SpTh>
          <SpTh t={t} size={size}>Goal</SpTh><SpTh t={t} size={size}>Actual</SpTh><SpTh t={t} size={size}>Var</SpTh>
          <SpTh t={t} size={size}>Goal</SpTh><SpTh t={t} size={size}>Actual</SpTh><SpTh t={t} size={size}>Var</SpTh>
          <SpTh t={t} size={size}>Goal</SpTh><SpTh t={t} size={size}>Actual</SpTh><SpTh t={t} size={size}>Var</SpTh>
          <SpTh t={t} size={size} align="center" w={size==='pres' ? 130 : 110}>State</SpTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const isFy = r.p === 'FY', last = i === rows.length - 1;
          return (
            <tr key={r.p} style={isFy ? { background:t.surfaceSoft } : undefined}>
              <SpTd t={t} size={size} align="left" last={last}><span style={{ fontFamily:APP_FONT_MONO, fontWeight:700, fontSize:S.mono+1, color: isFy ? t.teal : t.ink, letterSpacing:'0.08em' }}>{isFy ? 'FY 2026' : r.p}</span></SpTd>
              {cell(r.apps[0], r.apps[1], (x) => x, isFy ? 'fy' : r.state, last)}
              {cell(r.api[0], r.api[1], money, isFy ? 'fy' : r.state, last)}
              {cell(r.man[0], r.man[1], (x) => x, isFy ? 'fy' : r.state, last)}
              <SpTd t={t} size={size} align="center" last={last}>{isFy ? <span style={{ fontFamily:APP_FONT_MONO, fontSize:S.th, letterSpacing:'0.1em', color:t.inkMute, fontWeight:700 }}>YTD</span> : stateChip(r.state)}</SpTd>
            </tr>
          );
        })}
      </tbody>
    </SpTable>
  );
}

function SpPeriodHero({ t, granularity = 'quarter', size = 'app' }) {
  const q = granularity === 'half' ? 'H1 closed −5.3% on API' : 'Q2 closed −9.5% on API';
  return (
    <GlassHero t={t} style={{ marginBottom:14 }}>
      <SpStatStrip t={t} size={size} items={[
        { k:'APPS · YTD VS GOAL', v:'294 / 270', sub:'+24 vs closed-period goals' },
        { k:'API · YTD VS GOAL', v:`${ttd(2736000)} / ${ttd(2890000)}`, sub:q, color:t.mode==='light' ? undefined : undefined },
        { k:'MANPOWER', v:'12 / 14', sub:'2 below plan · pipeline in §06', color:t.warning, accent:t.warning },
      ]} />
    </GlassHero>
  );
}

// ── 05 · Org Structure ────────────────────────────────────────────────────
function SpOrg({ t, size = 'app' }) {
  const S = SP_SZ[size];
  return (
    <div>
      <GlassHero t={t} style={{ marginBottom:14 }}>
        <SpStatStrip t={t} size={size} items={[
          { k:'UNITS', v:'3', sub:'unit managers reporting' },
          { k:'LICENSED ADVISORS', v:'12', sub:'4 per unit · goal 16 EOY' },
          { k:'ADMIN STAFF', v:'2', sub:'branch office · delivery register' },
          { k:'NEW CONTRACTS · 2026', v:'2', sub:'Ravi Maharaj · Nigel Baptiste' },
        ]} />
      </GlassHero>
      <div style={{ background:t.surface, border:`1px solid ${t.rule}`, borderRadius:14, padding:'16px 18px', marginBottom:14, display:'flex', alignItems:'center', gap:14 }}>
        <div style={{ width:38, height:38, borderRadius:12, background:t.tealTint, color:t.teal, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, fontFamily:APP_FONT_DISPLAY, flexShrink:0 }}>AP</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:S.name+1, fontWeight:700, color:t.ink }}>{SP_BRANCH.author}</div>
          <div style={{ fontSize:S.td-0.5, color:t.inkMute, marginTop:1 }}>Branch Manager · {SP_BRANCH.name}</div>
        </div>
        {SP_ADMIN.map((a) => (
          <div key={a.name} style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 12px', border:`1px solid ${t.rule}`, borderRadius:11, background:t.surfaceSoft }}>
            <div style={{ width:24, height:24, borderRadius:8, background:t.inkAccentTint, color:t.inkAccent, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:9.5, fontFamily:APP_FONT_DISPLAY }}>{spInitials(a.name)}</div>
            <div>
              <div style={{ fontSize:S.td, fontWeight:700, color:t.ink }}>{a.name}</div>
              <div style={{ fontSize:S.th+1, color:t.inkMute }}>{a.role}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
        {SP_UNITS.map((u) => {
          const agents = SP_AGENTS.filter((a) => a.unit === u.key);
          const unitApi = agents.reduce((s, a) => s + a.apiN, 0);
          return (
            <div key={u.key} style={{ background:t.surface, border:`1px solid ${t.rule}`, borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'13px 16px', borderBottom:`1px solid ${t.rule}`, background:t.surfaceSoft, display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:28, height:28, borderRadius:9, background:t.tealTint, color:t.teal, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:11, fontFamily:APP_FONT_DISPLAY, flexShrink:0 }}>{spInitials(u.um)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:S.td+1, fontWeight:700, color:t.ink }}>{u.name}</div>
                  <div style={{ fontSize:S.th+1.5, color:t.inkMute, marginTop:1 }}>{u.um} · Unit Manager</div>
                </div>
                <span style={{ fontFamily:APP_FONT_MONO, fontSize:S.th, letterSpacing:'0.1em', fontWeight:700, color:t.teal, background:t.tealTint, padding:'3px 8px', borderRadius:999 }}>{agents.length} ADVISORS</span>
              </div>
              {agents.map((a, i) => {
                const band = spBand(t, spPct(a));
                return (
                  <div key={a.name} style={{ display:'flex', alignItems:'center', gap:9, padding:'0 16px', height:S.rowH+4, borderBottom: i < agents.length-1 ? `1px solid ${t.rule}` : 'none' }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:band.c, flexShrink:0 }}></span>
                    <span style={{ flex:1, fontSize:S.td+0.5, fontWeight:600, color:t.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.name}</span>
                    <span style={{ fontFamily:APP_FONT_MONO, fontSize:S.th+1, color:t.inkFaint }}>’{String(a.since).slice(2)}</span>
                    <span style={{ fontFamily:APP_FONT_MONO, fontSize:S.mono, fontWeight:700, color:t.inkMute }}>{ttd(a.apiN * 1000)}</span>
                  </div>
                );
              })}
              <div style={{ padding:'9px 16px', borderTop:`1px solid ${t.rule}`, display:'flex', justifyContent:'space-between', background:t.surfaceSoft }}>
                <span style={{ fontFamily:APP_FONT_MONO, fontSize:S.th, letterSpacing:'0.12em', color:t.inkFaint, fontWeight:700 }}>UNIT · NET SETTLED</span>
                <span style={{ fontFamily:APP_FONT_MONO, fontSize:S.mono+0.5, fontWeight:700, color:t.teal }}>{ttd(unitApi * 1000)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 06 · Recruitment Pipeline ─────────────────────────────────────────────
function SpRecruit({ t, size = 'app' }) {
  const S = SP_SZ[size];
  const statusPill = (r) => r.status === 'hired'
    ? <SpStatus t={t} band={{ c:t.success, bg:t.successTint, label:'✓ HIRED' }} size={size} />
    : r.status === 'dropped'
      ? <SpStatus t={t} band={{ c:t.danger, bg:t.dangerTint, label:'DROPPED' }} size={size} />
      : <SpStatus t={t} band={{ c:t.teal, bg:t.tealTint, label:'IN PROGRESS' }} size={size} />;
  return (
    <div>
      <GlassHero t={t} style={{ marginBottom:14 }}>
        <SpStatStrip t={t} size={size} items={[
          { k:'CANDIDATES · ACTIVE', v:'7', sub:'across 8 pipeline stages' },
          { k:'LICENSED · YTD', v:'2', sub:'goal 4 by December' },
          { k:'SOURCED → LICENSED', v:'14%', sub:'14 sourced YTD · 2 licensed' },
          { k:'NEXT MILESTONE', v:'Panel 22 Jul', sub:'Vishal Samaroo · Unit 1' },
        ]} />
      </GlassHero>
      <SpTable t={t} size={size}>
        <thead><tr>
          <SpTh t={t} size={size} align="left" w={size==='pres' ? 200 : 170}>Candidate</SpTh>
          <SpTh t={t} size={size} align="left" w={80}>Unit</SpTh>
          <SpTh t={t} size={size} align="left" w={100}>Source</SpTh>
          {SP_STAGES.map((s) => <SpTh key={s} t={t} size={size} align="center" w={size==='pres' ? 52 : 44}>{s}</SpTh>)}
          <SpTh t={t} size={size} w={size==='pres' ? 140 : 120}>Complete</SpTh>
          <SpTh t={t} size={size} align="left" w={130}>Latest</SpTh>
          <SpTh t={t} size={size} align="center" w={size==='pres' ? 118 : 104}>Status</SpTh>
        </tr></thead>
        <tbody>
          {SP_RECRUITS.map((r, i) => {
            const last = i === SP_RECRUITS.length - 1;
            const pct = Math.round(r.stage / 8 * 100);
            const barC = r.status === 'dropped' ? t.inkFaint : r.status === 'hired' ? t.success : t.teal;
            return (
              <tr key={r.name} style={r.status === 'dropped' ? { opacity:0.55 } : undefined}>
                <SpTd t={t} size={size} align="left" strong last={last}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <SpAvatar t={t} name={r.name} size={size==='pres' ? 28 : 22} />
                    <span style={{ fontSize:S.name, fontWeight:700, color:t.ink }}>{r.name}</span>
                  </div>
                </SpTd>
                <SpTd t={t} size={size} align="left" last={last}>{r.unit}</SpTd>
                <SpTd t={t} size={size} align="left" last={last}>{r.src}</SpTd>
                {SP_STAGES.map((s, si) => {
                  const done = si < r.stage, current = si === r.stage && r.status === 'active';
                  return (
                    <td key={s} style={{ textAlign:'center', height:S.rowH, borderBottom: last ? 'none' : `1px solid ${t.rule}` }}>
                      {done
                        ? <span style={{ color: r.status === 'dropped' ? t.inkFaint : t.teal, fontSize:S.td, fontWeight:700 }}>✓</span>
                        : current
                          ? <span style={{ display:'inline-block', width:9, height:9, borderRadius:'50%', border:`2px solid ${t.teal}` }}></span>
                          : <span style={{ display:'inline-block', width:5, height:5, borderRadius:'50%', background:t.rule === '#E5E2DB' ? t.ruleStrong : 'rgba(240,235,224,0.2)' }}></span>}
                    </td>
                  );
                })}
                <SpTd t={t} size={size} last={last}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                    <div style={{ width:size==='pres' ? 64 : 52, height:4, background:t.surfaceMute, borderRadius:999, overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:4, background:barC, borderRadius:999 }}></div>
                    </div>
                    <span style={{ fontFamily:APP_FONT_MONO, fontSize:S.mono, fontWeight:700, color:t.inkMute, width:34, textAlign:'right' }}>{pct}%</span>
                  </div>
                </SpTd>
                <SpTd t={t} size={size} align="left" last={last}><span style={{ fontSize:S.td-1, color:t.inkMute }}>{r.note}</span></SpTd>
                <SpTd t={t} size={size} align="center" last={last}>{statusPill(r)}</SpTd>
              </tr>
            );
          })}
        </tbody>
      </SpTable>
      <div style={{ marginTop:10, fontSize:S.th+1.5, fontFamily:APP_FONT_MONO, letterSpacing:'0.08em', color:t.inkFaint }}>STAGES · {SP_STAGE_LEGEND.toUpperCase()}</div>
    </div>
  );
}

Object.assign(window, { SpPeriodTable, SpPeriodHero, SpOrg, SpRecruit });

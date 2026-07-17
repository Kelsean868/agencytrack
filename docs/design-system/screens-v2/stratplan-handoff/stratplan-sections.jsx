// Strategic Plan — the six dashboard sections + shared tables.
// All take t (palette) and size ('app'|'pres').

// ── Generic table shell ───────────────────────────────────────────────────
function SpTable({ t, size = 'app', children, style = {} }) {
  return (
    <div style={{ background:t.surface, border:`1px solid ${t.rule}`, borderRadius:14, overflow:'hidden', ...style }}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>{children}</table>
    </div>
  );
}
function SpTh({ t, size = 'app', w, align = 'right', children, group }) {
  const S = SP_SZ[size];
  return (
    <th style={{
      width:w, textAlign:align, padding: group ? '8px 9px 4px' : '7px 9px',
      fontSize:S.th, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase',
      fontFamily:APP_FONT_MONO, color:t.inkFaint, whiteSpace:'nowrap',
      borderBottom:`1px solid ${t.rule}`, background:t.surfaceSoft,
    }}>{children}</th>
  );
}
function SpTd({ t, size = 'app', align = 'right', mono, strong, color, children, last }) {
  const S = SP_SZ[size];
  return (
    <td style={{
      textAlign:align, padding:S.cellPad, height:S.rowH, whiteSpace:'nowrap',
      fontSize: mono ? S.mono : S.td, fontFamily: mono ? APP_FONT_MONO : APP_FONT_SANS,
      fontWeight: strong ? 700 : (mono ? 500 : 500), color: color || (strong ? t.ink : t.inkMute),
      borderBottom: last ? 'none' : `1px solid ${t.rule}`,
    }}>{children}</td>
  );
}

// ── 01 · Cover hero ───────────────────────────────────────────────────────
function SpCover({ t, granularity, size = 'app' }) {
  const hi = spHeroInk(t), hm = spHeroMute(t);
  const pct = Math.round(SP_BRANCH.ytd / (SP_BRANCH.quota * SP_ELAPSED) * 1000) / 10;
  const gLabel = granularity === 'half' ? 'H1 – H2' : 'Q1 – Q4';
  return (
    <GlassHero t={t} pad="30px 34px">
      <div style={{ display:'flex', alignItems:'flex-start', gap:28 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.2em', fontFamily:APP_FONT_MONO, color:hm }}>01 · STRATEGIC PLAN · {SP_BRANCH.period}</div>
          <div style={{ fontSize:42, fontWeight:800, letterSpacing:'-0.03em', fontFamily:APP_FONT_DISPLAY, color:hi, lineHeight:1.02, marginTop:12 }}>{SP_BRANCH.name}</div>
          <div style={{ fontSize:14, color:hm, marginTop:8, fontWeight:500 }}>{SP_BRANCH.region}</div>
          <div style={{ display:'flex', gap:26, marginTop:26, flexWrap:'wrap' }}>
            {[['PERIOD', `${SP_BRANCH.period} · ${gLabel}`], ['PREPARED BY', `${SP_BRANCH.author} · ${SP_BRANCH.role}`], ['TIMESTAMP', SP_BRANCH.generated]].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.18em', fontFamily:APP_FONT_MONO, color:hm }}>{k}</div>
                <div style={{ fontSize:12.5, fontWeight:700, color:hi, marginTop:4 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width:300, flexShrink:0, display:'flex', flexDirection:'column', gap:14, paddingLeft:26, borderLeft:`1px solid ${t.mode==='light' ? 'rgba(1,105,111,0.18)' : 'rgba(240,235,224,0.12)'}` }}>
          {[
            ['YTD · NET SETTLED API', ttd(SP_BRANCH.ytd * 1000), `of ${ttd(SP_BRANCH.quota * 1000)} annual quota`],
            ['PRORATED OBJECTIVE', `${pct}%`, '54.2% of year elapsed'],
            ['LICENSED ADVISORS', '12 / 16', 'EOY manpower goal'],
          ].map(([k, v, s]) => (
            <div key={k}>
              <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.16em', fontFamily:APP_FONT_MONO, color:hm }}>{k}</div>
              <div style={{ fontSize:26, fontWeight:800, letterSpacing:'-0.025em', fontFamily:APP_FONT_DISPLAY, color:hi, marginTop:3, lineHeight:1 }}>{v}</div>
              <div style={{ fontSize:10.5, color:hm, marginTop:3 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>
    </GlassHero>
  );
}

// ── 02 · Agent Performance Tracker ────────────────────────────────────────
function SpTrackerTable({ t, size = 'app' }) {
  const S = SP_SZ[size], pres = size === 'pres';
  const money = (k) => ttd(k * 1000);
  const groups = pres
    ? [['',2],['ACTIVITY FUNNEL',5],['APPLICATIONS',2],['API · SETTLEMENT',4],['OBJECTIVE',2],['',1]]
    : [['',2],['ACTIVITY FUNNEL',6],['APPLICATIONS',3],['API · SETTLEMENT',4],['OBJECTIVE',2],['QUALITY',1],['',1]];
  return (
    <SpTable t={t} size={size}>
      <thead>
        <tr>
          {groups.map(([g, span], i) => (
            <th key={i} colSpan={span} style={{
              padding:'8px 9px 2px', fontSize:S.th-0.5, fontWeight:700, letterSpacing:'0.16em',
              fontFamily:APP_FONT_MONO, color:t.teal, textAlign: i===0 ? 'left' : 'center',
              background:t.surfaceSoft, borderBottom:'none', whiteSpace:'nowrap',
            }}>{g}</th>
          ))}
        </tr>
        <tr>
          <SpTh t={t} size={size} align="left" w={pres ? 190 : 150}>Agent</SpTh>
          <SpTh t={t} size={size} align="center" w={pres ? 44 : 38}>Unit</SpTh>
          <SpTh t={t} size={size}>P.C</SpTh>
          <SpTh t={t} size={size}>Appt</SpTh>
          <SpTh t={t} size={size}>F.F.I</SpTh>
          <SpTh t={t} size={size}>C.I</SpTh>
          <SpTh t={t} size={size}>Sales</SpTh>
          {!pres && <SpTh t={t} size={size}>Close</SpTh>}
          <SpTh t={t} size={size}>Sub</SpTh>
          <SpTh t={t} size={size}>Set</SpTh>
          {!pres && <SpTh t={t} size={size}>NTU</SpTh>}
          <SpTh t={t} size={size} w={pres ? 100 : 88}>Submitted</SpTh>
          <SpTh t={t} size={size} w={pres ? 100 : 88}>Gross set</SpTh>
          <SpTh t={t} size={size} w={pres ? 100 : 88}>Net set</SpTh>
          <SpTh t={t} size={size} w={pres ? 100 : 88}>Obj · YTD</SpTh>
          <SpTh t={t} size={size} w={pres ? 66 : 54}>% Obj</SpTh>
          {!pres && <SpTh t={t} size={size} w={48}>Pers</SpTh>}
          <SpTh t={t} size={size} align="center" w={pres ? 104 : 90}>Status</SpTh>
        </tr>
      </thead>
      <tbody>
        {SP_AGENTS.map((r, i) => {
          const pct = spPct(r), band = spBand(t, pct);
          return (
            <tr key={r.name}>
              <SpTd t={t} size={size} align="left" strong>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <SpAvatar t={t} name={r.name} size={pres ? 28 : 22} />
                  <span style={{ fontSize:S.name, fontWeight:700, color:t.ink }}>{r.name}</span>
                </div>
              </SpTd>
              <SpTd t={t} size={size} align="center" mono>{r.unit}</SpTd>
              <SpTd t={t} size={size} mono>{r.pc}</SpTd>
              <SpTd t={t} size={size} mono>{r.ap}</SpTd>
              <SpTd t={t} size={size} mono>{r.ff}</SpTd>
              <SpTd t={t} size={size} mono>{r.ci}</SpTd>
              <SpTd t={t} size={size} mono strong color={t.ink}>{r.sl}</SpTd>
              {!pres && <SpTd t={t} size={size} mono>{Math.round(r.sl / r.ci * 100)}%</SpTd>}
              <SpTd t={t} size={size} mono>{r.asub}</SpTd>
              <SpTd t={t} size={size} mono>{r.aset}</SpTd>
              {!pres && <SpTd t={t} size={size} mono color={r.ntu >= 3 ? t.danger : undefined}>{r.ntu}</SpTd>}
              <SpTd t={t} size={size} mono>{money(r.apiSub)}</SpTd>
              <SpTd t={t} size={size} mono>{money(r.apiG)}</SpTd>
              <SpTd t={t} size={size} mono strong color={t.ink}>{money(r.apiN)}</SpTd>
              <SpTd t={t} size={size} mono>{money(Math.round(r.obj * SP_ELAPSED * 10) / 10)}</SpTd>
              <td style={{
                textAlign:'right', padding:S.cellPad, height:S.rowH, whiteSpace:'nowrap',
                fontSize:S.mono, fontFamily:APP_FONT_MONO, fontWeight:700,
                color:band.c, background:band.bg, borderBottom:`1px solid ${t.rule}`,
              }}>{pct}%</td>
              {!pres && <SpTd t={t} size={size} mono color={r.pers < 85 ? t.warning : undefined}>{r.pers}%</SpTd>}
              <SpTd t={t} size={size} align="center"><SpStatus t={t} band={band} size={size} /></SpTd>
            </tr>
          );
        })}
        <tr>
          <SpTd t={t} size={size} align="left" strong last><span style={{ fontFamily:APP_FONT_MONO, fontSize:S.th+1, letterSpacing:'0.14em', color:t.teal, fontWeight:700 }}>BRANCH · {SP_AGENTS.length} AGENTS</span></SpTd>
          <SpTd t={t} size={size} align="center" mono last>—</SpTd>
          <SpTd t={t} size={size} mono strong color={t.ink} last>{SP_TOTAL.pc}</SpTd>
          <SpTd t={t} size={size} mono strong color={t.ink} last>{SP_TOTAL.ap}</SpTd>
          <SpTd t={t} size={size} mono strong color={t.ink} last>{SP_TOTAL.ff}</SpTd>
          <SpTd t={t} size={size} mono strong color={t.ink} last>{SP_TOTAL.ci}</SpTd>
          <SpTd t={t} size={size} mono strong color={t.ink} last>{SP_TOTAL.sl}</SpTd>
          {!pres && <SpTd t={t} size={size} mono strong color={t.ink} last>{Math.round(SP_TOTAL.sl / SP_TOTAL.ci * 100)}%</SpTd>}
          <SpTd t={t} size={size} mono strong color={t.ink} last>{SP_TOTAL.asub}</SpTd>
          <SpTd t={t} size={size} mono strong color={t.ink} last>{SP_TOTAL.aset}</SpTd>
          {!pres && <SpTd t={t} size={size} mono strong color={t.ink} last>{SP_TOTAL.ntu}</SpTd>}
          <SpTd t={t} size={size} mono strong color={t.ink} last>{ttd(SP_TOTAL.apiSub * 1000)}</SpTd>
          <SpTd t={t} size={size} mono strong color={t.ink} last>{ttd(SP_TOTAL.apiG * 1000)}</SpTd>
          <SpTd t={t} size={size} mono strong color={t.teal} last>{ttd(SP_TOTAL.apiN * 1000)}</SpTd>
          <SpTd t={t} size={size} mono strong color={t.ink} last>{ttd(SP_TOTAL.obj * SP_ELAPSED * 1000)}</SpTd>
          <SpTd t={t} size={size} mono strong color={t.warning} last>93%</SpTd>
          {!pres && <SpTd t={t} size={size} mono strong color={t.ink} last>89.1%</SpTd>}
          <SpTd t={t} size={size} align="center" last><SpStatus t={t} band={spBand(t, 93)} size={size} /></SpTd>
        </tr>
      </tbody>
    </SpTable>
  );
}

function SpTrackerHero({ t, size = 'app' }) {
  return (
    <GlassHero t={t} style={{ marginBottom:14 }}>
      <SpStatStrip t={t} size={size} items={[
        { k:'AGENTS REPORTING', v:'12 / 12', sub:'all weekly reports in' },
        { k:'FUNNEL · CALLS → SALES', v:`${SP_TOTAL.pc.toLocaleString()} → ${SP_TOTAL.sl}`, sub:`${Math.round(SP_TOTAL.sl / SP_TOTAL.pc * 1000) / 10}% end-to-end` },
        { k:'NET SETTLED API · YTD', v:ttd(SP_TOTAL.apiN * 1000), sub:`of ${ttd(SP_TOTAL.obj * SP_ELAPSED * 1000)} prorated` },
        { k:'★ TOP PRODUCER', v:'Marsha Singh', sub:ttd(431000) + ' net settled', accent:t.gold, color:t.gold },
      ]} />
    </GlassHero>
  );
}

// ── 03 · Production Summary ───────────────────────────────────────────────
function SpProduction({ t, size = 'app' }) {
  const S = SP_SZ[size];
  const gap = SP_BRANCH.runRate - SP_BRANCH.quota; // −432K
  const cardHead = (txt) => (
    <div style={{ padding:'12px 16px 10px', fontSize:S.th+0.5, fontWeight:700, letterSpacing:'0.16em', fontFamily:APP_FONT_MONO, color:t.teal, borderBottom:`1px solid ${t.rule}`, background:t.surfaceSoft }}>{txt}</div>
  );
  return (
    <div>
      <GlassHero t={t} style={{ marginBottom:14 }}>
        <SpStatStrip t={t} size={size} items={[
          { k:'ANNUAL QUOTA', v:ttd(SP_BRANCH.quota * 1000), sub:'branch objective · FY 2026' },
          { k:'YTD NET SETTLED', v:ttd(SP_BRANCH.ytd * 1000), sub:'50.2% achieved · 54.2% elapsed' },
          { k:'RUN-RATE · EOY', v:ttd(SP_BRANCH.runRate * 1000), sub:'monthly run-rate TTD 454.0K' },
          { k:'GAP TO QUOTA', v:'−' + ttd(Math.abs(gap) * 1000), sub:'−7.3% vs annual objective', color:t.danger },
        ]} />
      </GlassHero>
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr', gap:14 }}>
        <div style={{ background:t.surface, border:`1px solid ${t.rule}`, borderRadius:14, overflow:'hidden' }}>
          {cardHead('MONTHLY PRORATED QUOTA · TTD')}
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              <SpTh t={t} size={size} align="left">Month</SpTh>
              <SpTh t={t} size={size}>Quota</SpTh>
              <SpTh t={t} size={size}>Net settled</SpTh>
              <SpTh t={t} size={size} w={70}>Var</SpTh>
            </tr></thead>
            <tbody>{SP_MONTHS.map(([m, v, mtd], i) => {
              const last = i === SP_MONTHS.length - 1;
              const varPct = Math.round((v - SP_MQUOTA) / SP_MQUOTA * 1000) / 10;
              return (
                <tr key={m}>
                  <SpTd t={t} size={size} align="left" strong last={last}>{m}{mtd && <span style={{ fontFamily:APP_FONT_MONO, fontSize:S.th, color:t.inkFaint, marginLeft:6, letterSpacing:'0.1em' }}>MTD</span>}</SpTd>
                  <SpTd t={t} size={size} mono last={last}>{ttd(SP_MQUOTA * 1000)}</SpTd>
                  <SpTd t={t} size={size} mono strong color={t.ink} last={last}>{ttd(v * 1000)}</SpTd>
                  <SpTd t={t} size={size} last={last}>{mtd ? <span style={{ fontFamily:APP_FONT_MONO, fontSize:S.mono, color:t.inkFaint }}>—</span> : <SpVar t={t} v={varPct} fmt={(x) => x + '%'} size={size} />}</SpTd>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <div style={{ background:t.surface, border:`1px solid ${t.rule}`, borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {cardHead('ANNUAL QUOTA VS RUN-RATE')}
          <div style={{ padding:'6px 16px 14px', flex:1, display:'flex', flexDirection:'column', justifyContent:'center' }}>
            {[
              ['Annual quota', ttd(SP_BRANCH.quota * 1000), t.ink],
              ['YTD net settled', ttd(SP_BRANCH.ytd * 1000), t.ink],
              ['Monthly run-rate', ttd(454000), t.ink],
              ['EOY projection', ttd(SP_BRANCH.runRate * 1000), t.teal],
              ['Gap to quota', '−' + ttd(Math.abs(gap) * 1000) + ' · −7.3%', t.danger],
            ].map(([k, v, c], i, arr) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'8px 0', borderBottom: i < arr.length-1 ? `1px solid ${t.rule}` : 'none' }}>
                <span style={{ fontSize:S.td, color:t.inkMute, fontWeight:500 }}>{k}</span>
                <span style={{ fontSize:S.mono+1, fontFamily:APP_FONT_MONO, fontWeight:700, color:c }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop:12, height:5, background:t.surfaceMute, borderRadius:999, overflow:'hidden' }}>
              <div style={{ width:'50.2%', height:5, background:`linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius:999 }}></div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
              <span style={{ fontSize:S.th, fontFamily:APP_FONT_MONO, letterSpacing:'0.12em', color:t.inkFaint }}>50.2% ACHIEVED</span>
              <span style={{ fontSize:S.th, fontFamily:APP_FONT_MONO, letterSpacing:'0.12em', color:t.warning }}>PROJECTED −7.3%</span>
            </div>
          </div>
        </div>
        <div style={{ background:t.surface, border:`1px solid ${t.rule}`, borderRadius:14, overflow:'hidden' }}>
          {cardHead('PERSISTENCY · FLOOR 85%')}
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              <SpTh t={t} size={size} align="left">Book</SpTh>
              <SpTh t={t} size={size}>13-mo</SpTh>
              <SpTh t={t} size={size}>25-mo</SpTh>
              <SpTh t={t} size={size} align="center" w={54}>Floor</SpTh>
            </tr></thead>
            <tbody>{SP_PERSIST.map(([n, a, b], i) => {
              const last = i === SP_PERSIST.length - 1;
              const ok = a >= 85 && b >= 85;
              return (
                <tr key={n} style={last ? { background:t.surfaceSoft } : undefined}>
                  <SpTd t={t} size={size} align="left" strong last={last}>{n}</SpTd>
                  <SpTd t={t} size={size} mono strong color={a < 85 ? t.danger : t.ink} last={last}>{a.toFixed(1)}%</SpTd>
                  <SpTd t={t} size={size} mono strong color={b < 85 ? t.warning : t.ink} last={last}>{b.toFixed(1)}%</SpTd>
                  <SpTd t={t} size={size} align="center" mono strong color={ok ? t.success : t.warning} last={last}>{ok ? '✓' : '!'}</SpTd>
                </tr>
              );
            })}</tbody>
          </table>
          <div style={{ padding:'10px 16px 12px', fontSize:S.th+1, color:t.inkMute, lineHeight:1.5, borderTop:`1px solid ${t.rule}` }}>Unit 2 sits below the 25-month floor — clawback exposure flagged to the CRO.</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SpTable, SpTh, SpTd, SpCover, SpTrackerTable, SpTrackerHero, SpProduction });

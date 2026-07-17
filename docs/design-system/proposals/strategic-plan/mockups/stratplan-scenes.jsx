// Strategic Plan — scenes: dashboard surface (light/dark) + presentation slides.

// Presentation palette — always-dark, higher contrast than app dark
const SP_PRES = Object.assign({}, APP_DARK, {
  bg:'#131009', surface:'#1E1913', surfaceRaised:'#292217', surfaceSoft:'#231D14', surfaceMute:'#2B241A',
  ink:'#F5F0E3', inkMute:'#C9BFAE', inkFaint:'#968B7B',
  rule:'rgba(245,240,227,0.10)', ruleStrong:'rgba(245,240,227,0.24)',
});

const SP_AGENDA = [
  ['01','Cover'],['02','Agent performance'],['03','Production summary'],
  ['04','Period metrics'],['05','Org structure'],['06','Recruitment pipeline'],
];

// ── Control-bar bits (44px touch targets) ─────────────────────────────────
function SpSelect({ t, label, value }) {
  return (
    <div style={{ height:44, display:'flex', alignItems:'center', gap:10, padding:'0 14px', background:t.surface, border:`1px solid ${t.rule}`, borderRadius:11, boxSizing:'border-box', cursor:'pointer' }}>
      <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.16em', fontFamily:APP_FONT_MONO, color:t.inkFaint }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:700, color:t.ink, whiteSpace:'nowrap' }}>{value}</span>
      <IconChevD size={14} color={t.inkMute} />
    </div>
  );
}
function SpSegmented({ t, options, active }) {
  return (
    <div style={{ height:44, display:'flex', alignItems:'center', gap:3, padding:3, background:t.surfaceSoft, border:`1px solid ${t.rule}`, borderRadius:11, boxSizing:'border-box' }}>
      {options.map((o) => {
        const on = o === active;
        return <div key={o} style={{ height:'100%', display:'flex', alignItems:'center', padding:'0 16px', borderRadius:8, fontSize:10.5, fontWeight:700, letterSpacing:'0.12em', fontFamily:APP_FONT_MONO, background: on ? t.teal : 'transparent', color: on ? (t.mode==='light' ? '#fff' : '#1A1612') : t.inkMute, cursor:'pointer' }}>{o}</div>;
      })}
    </div>
  );
}
function SpBtn({ t, children, solid, icon }) {
  return (
    <div style={{
      height:44, display:'flex', alignItems:'center', gap:8, padding:'0 18px', borderRadius:11, boxSizing:'border-box',
      background: solid ? t.teal : t.surface, cursor:'pointer',
      color: solid ? (t.mode==='light' ? '#fff' : '#1A1612') : t.ink,
      border: solid ? '1px solid transparent' : `1px solid ${t.ruleStrong}`,
      fontSize:13, fontWeight:700, whiteSpace:'nowrap',
      boxShadow: solid ? (t.mode==='light' ? '0 6px 16px rgba(1,105,111,0.28)' : '0 6px 16px rgba(74,181,184,0.22)') : 'none',
    }}>{icon}{children}</div>
  );
}
const IconPlay = (p) => <Icon {...p}><polygon points="7 5 19 12 7 19 7 5" /></Icon>;
const IconChevL = (p) => <Icon {...p}><polyline points="15 6 9 12 15 18" /></Icon>;

// ── Dashboard scene — the full scrollable manager surface ────────────────
function StratDashboard({ t, granularity = 'quarter' }) {
  const halfMode = granularity === 'half';
  return (
    <div style={{ width:APP_W, background:t.bg, color:t.ink, fontFamily:APP_FONT_SANS, position:'relative', overflow:'hidden' }}>
      <AmbientBg t={t} />
      <div style={{ position:'relative', zIndex:1 }}>
        {/* App bar */}
        <div style={{ height:64, background:t.surface, borderBottom:`1px solid ${t.rule}`, padding:'0 32px', display:'flex', alignItems:'center', gap:14, boxSizing:'border-box' }}>
          <AgencyLogo size={32} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15.5, fontWeight:700, color:t.ink, letterSpacing:'-0.012em', fontFamily:APP_FONT_DISPLAY }}>Strategic Plan</div>
            <div style={{ fontSize:11, color:t.inkMute, marginTop:1 }}>Reports · Branch strategic plan · {SP_BRANCH.period}</div>
          </div>
          <div style={{ width:36, height:36, borderRadius:9, border:`1px solid ${t.rule}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {t.mode === 'dark' ? <IconSun size={16} color={t.inkMute} /> : <IconMoon size={16} color={t.inkMute} />}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, paddingLeft:14, borderLeft:`1px solid ${t.rule}` }}>
            <SpAvatar t={t} name={SP_BRANCH.author} size={32} />
            <div>
              <div style={{ fontSize:12.5, fontWeight:700, color:t.ink }}>{SP_BRANCH.author}</div>
              <div style={{ fontSize:10.5, color:t.inkMute }}>Branch Manager</div>
            </div>
          </div>
        </div>
        {/* Control bar */}
        <div style={{ padding:'16px 32px', display:'flex', alignItems:'center', gap:10, borderBottom:`1px solid ${t.rule}`, background:t.mode==='light' ? 'rgba(255,255,255,0.55)' : 'rgba(37,32,25,0.55)', backdropFilter:'blur(10px)' }}>
          <SpSelect t={t} label="BRANCH" value="San Fernando" />
          <SpSelect t={t} label="YEAR" value="2026" />
          <SpSegmented t={t} options={['QUARTER','HALF']} active={halfMode ? 'HALF' : 'QUARTER'} />
          <div style={{ flex:1 }}></div>
          <SpBtn t={t} icon={<IconDownload size={15} color={t.ink} />}>Export PDF</SpBtn>
          <SpBtn t={t} solid icon={<IconPlay size={15} color={t.mode==='light' ? '#fff' : '#1A1612'} />}>Present</SpBtn>
        </div>
        {/* Sections */}
        <div style={{ padding:'26px 32px 48px', display:'flex', flexDirection:'column', gap:44 }}>
          <SpCover t={t} granularity={granularity} />
          <div>
            <SpSectionHead t={t} num="02" eyebrow="AGENT PERFORMANCE" title="Agent performance tracker"
              sub="Activity funnel and API production per agent — submitted, gross settled and net settled — banded against each agent's prorated annual objective. All figures TTD, net of clawbacks."
              right={<Pill t={t}>WEEK 29 · ALL REPORTS IN</Pill>} />
            <SpTrackerHero t={t} />
            <SpTrackerTable t={t} />
          </div>
          <div>
            <SpSectionHead t={t} num="03" eyebrow="PRODUCTION SUMMARY" title="Production summary"
              sub="Monthly prorated quota vs settled production, the annual run-rate projection, and persistency against the 85% company floor." />
            <SpProduction t={t} />
          </div>
          <div>
            <SpSectionHead t={t} num="04" eyebrow="PERIOD METRICS" title="Goal vs actual — by period"
              sub={halfMode ? 'Half-year view. APPS, net settled API and licensed manpower against the plan committed in January.' : 'Quarterly view. APPS, net settled API and licensed manpower against the plan committed in January.'}
              right={<Pill t={t}>{halfMode ? 'H1 – H2' : 'Q1 – Q4'}</Pill>} />
            <SpPeriodHero t={t} granularity={granularity} />
            <SpPeriodTable t={t} granularity={granularity} />
          </div>
          <div>
            <SpSectionHead t={t} num="05" eyebrow="ORG STRUCTURE" title="Organisation structure"
              sub="Branch leadership, unit managers and advisor rosters. Dots carry each advisor's objective band from §02." />
            <SpOrg t={t} />
          </div>
          <div>
            <SpSectionHead t={t} num="06" eyebrow="RECRUITMENT" title="Recruitment pipeline"
              sub="Candidates across the eight stages from sourced to licensed. Manpower goal requires four licensed hires by December." />
            <SpRecruit t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Presentation mode — full-screen dark slide with agenda rail ───────────
function StratSlide({ slide }) {
  const t = SP_PRES;
  const activeIdx = slide === 'tracker' ? 1 : 3;
  const meta = SP_AGENDA[activeIdx];
  return (
    <div style={{ width:1600, height:900, background:t.bg, color:t.ink, fontFamily:APP_FONT_SANS, display:'flex', overflow:'hidden', position:'relative' }}>
      {/* Agenda rail */}
      <div style={{ width:296, flexShrink:0, background:'#100D08', borderRight:`1px solid ${t.rule}`, display:'flex', flexDirection:'column', padding:'30px 20px 24px', boxSizing:'border-box' }}>
        <div style={{ display:'flex', alignItems:'center', gap:11, padding:'0 8px' }}>
          <AgencyLogo size={30} />
          <div>
            <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.2em', fontFamily:APP_FONT_MONO, color:t.teal }}>STRATEGIC PLAN · 2026</div>
            <div style={{ fontSize:14.5, fontWeight:800, fontFamily:APP_FONT_DISPLAY, color:t.ink, marginTop:2, letterSpacing:'-0.015em' }}>{SP_BRANCH.name}</div>
          </div>
        </div>
        <div style={{ marginTop:30, display:'flex', flexDirection:'column', gap:4, flex:1 }}>
          {SP_AGENDA.map(([num, label], i) => {
            const on = i === activeIdx;
            return (
              <div key={num} style={{ height:46, display:'flex', alignItems:'center', gap:13, padding:'0 14px', borderRadius:10, cursor:'pointer', position:'relative', background: on ? t.tealTint : 'transparent', boxSizing:'border-box' }}>
                {on && <div style={{ position:'absolute', left:0, top:9, bottom:9, width:3, background:t.teal, borderRadius:999 }}></div>}
                <span style={{ fontFamily:APP_FONT_MONO, fontSize:11, fontWeight:700, letterSpacing:'0.1em', color: on ? t.teal : t.inkFaint }}>{num}</span>
                <span style={{ fontSize:14, fontWeight: on ? 700 : 600, color: on ? t.teal : t.inkMute }}>{label}</span>
                {i === 1 && !on && <span style={{ marginLeft:'auto', fontFamily:APP_FONT_MONO, fontSize:9, color:t.inkFaint }}>✓</span>}
              </div>
            );
          })}
        </div>
        <div style={{ borderTop:`1px solid ${t.rule}`, paddingTop:16, display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <SpAvatar t={t} name={SP_BRANCH.author} size={28} />
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:t.ink }}>{SP_BRANCH.author}</div>
              <div style={{ fontSize:10, color:t.inkFaint }}>Branch Manager · presenting</div>
            </div>
          </div>
          <div style={{ fontFamily:APP_FONT_MONO, fontSize:9, letterSpacing:'0.14em', color:t.inkFaint }}>ESC · EXIT PRESENTATION</div>
        </div>
      </div>
      {/* Slide body */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', padding:'34px 44px 24px', boxSizing:'border-box' }}>
        <div style={{ display:'flex', alignItems:'flex-end', gap:20, marginBottom:18 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.2em', fontFamily:APP_FONT_MONO, color:t.teal }}>{meta[0]} · {slide === 'tracker' ? 'AGENT PERFORMANCE' : 'PERIOD METRICS'}</div>
            <div style={{ fontSize:40, fontWeight:800, letterSpacing:'-0.028em', fontFamily:APP_FONT_DISPLAY, color:t.ink, marginTop:6, lineHeight:1.04 }}>{slide === 'tracker' ? 'Agent performance tracker' : 'Goal vs actual — by quarter'}</div>
          </div>
          <div style={{ textAlign:'right', paddingBottom:6 }}>
            <div style={{ fontFamily:APP_FONT_MONO, fontSize:10, letterSpacing:'0.16em', color:t.inkFaint }}>YTD · SETTLED API</div>
            <div style={{ fontSize:26, fontWeight:800, fontFamily:APP_FONT_DISPLAY, color:t.teal, marginTop:3 }}>{ttd(SP_BRANCH.ytd * 1000)}</div>
          </div>
        </div>
        <div style={{ flex:1, minHeight:0 }}>
          {slide === 'tracker' ? (
            <div>
              <SpTrackerHero t={t} size="pres" />
              <SpTrackerTable t={t} size="pres" />
            </div>
          ) : (
            <div>
              <SpPeriodHero t={t} granularity="quarter" size="pres" />
              <SpPeriodTable t={t} granularity="quarter" size="pres" />
              <div style={{ display:'flex', gap:14, marginTop:14 }}>
                {[
                  ['APPS', 'Q2 closed −10 apps · recovered by Week 29 submissions', t.warning],
                  ['API', 'H1 gap −TTD 154.0K · run-rate projects −7.3% EOY', t.danger],
                  ['MANPOWER', 'Two hires from goal · two candidates past interview stage', t.teal],
                ].map(([k, v, c]) => (
                  <div key={k} style={{ flex:1, background:t.surface, border:`1px solid ${t.rule}`, borderRadius:14, padding:'16px 20px' }}>
                    <div style={{ fontFamily:APP_FONT_MONO, fontSize:10.5, fontWeight:700, letterSpacing:'0.18em', color:c }}>{k}</div>
                    <div style={{ fontSize:15, color:t.inkMute, marginTop:8, lineHeight:1.5, textWrap:'pretty' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Footer nav */}
        <div style={{ display:'flex', alignItems:'center', gap:16, paddingTop:16 }}>
          <div style={{ flex:1, fontFamily:APP_FONT_MONO, fontSize:9.5, letterSpacing:'0.16em', color:t.inkFaint }}>SAN FERNANDO BRANCH · FY 2026 · TATIL LIFE · SOUTH</div>
          <div style={{ fontFamily:APP_FONT_MONO, fontSize:11, letterSpacing:'0.14em', color:t.inkMute, fontWeight:700 }}>SLIDE {activeIdx + 1} / 6</div>
          <div style={{ display:'flex', gap:8 }}>
            {[IconChevL, IconChevR].map((Ic, i) => (
              <div key={i} style={{ width:48, height:48, borderRadius:'50%', border:`1px solid ${t.ruleStrong}`, background:t.surface, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                <Ic size={18} color={t.ink} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SP_PRES, StratDashboard, StratSlide, SpSelect, SpSegmented, SpBtn, IconPlay, IconChevL });

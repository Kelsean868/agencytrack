// ============================================================
// agentmore.jsx — remaining agent screens, in-system
// ============================================================

// ---------- WEEKLY WIZARD: Select Week (fix: bare picker -> launch surface) ----------
function WizardSelectWeek({ goTo }) {
  const weeks = [
    { label:'This week', d:'28-06-2026', status:'draft' },
    { label:'Last week', d:'21-06-2026', status:'submitted' },
    { label:'2 weeks ago', d:'14-06-2026', status:'draft' },
    { label:'3 weeks ago', d:'07-06-2026', status:'missing' },
  ];
  const [sel, setSel] = useState(0);
  const tag = { draft:['Draft in progress','warn'], submitted:['Submitted','ok'], missing:['Not filed','bad'] };
  return (
    <div className="page" style={{maxWidth:720}}>
      <div><Eyebrow tone="faint">Weekly Report</Eyebrow><h2 className="scr-title">Pick a reporting week</h2><p className="scr-sub">Select the Sunday this reporting week starts on — we'll pull in what you've already logged.</p></div>
      <div className="week-list">
        {weeks.map((w,i)=>(
          <button key={i} className={'week-card'+(sel===i?' is-sel':'')} onClick={()=>setSel(i)}>
            <div className="week-radio">{sel===i && <Icon name="check" size={13}/>}</div>
            <div style={{flex:1,textAlign:'left'}}><div style={{fontWeight:700,fontSize:14.5}}>{w.label}</div><div className="kpi-foot">Sun {w.d}</div></div>
            <span className={'risk risk--'+tag[w.status][1]}>{tag[w.status][0]}</span>
          </button>
        ))}
      </div>
      <Btn kind="primary" size="lg" iconAfter="arrow" onClick={()=>goTo('wizardstep')} style={{width:'100%'}}>Start report · Sun {weeks[sel].d}</Btn>
    </div>
  );
}

// ---------- WEEKLY WIZARD: Step (kept — the crafted live-rail surface) ----------
function WizardStep({ goTo }) {
  const phases = [['Activity',5,5],['Sales',3,3],['Reflection',2,3],['Goals',0,2]];
  return (
    <div className="page">
      <div className="wiz-head">
        <div><Eyebrow tone="faint">Step 7 · Sales</Eyebrow><h2 className="scr-title">New business this week</h2></div>
        <span className="save-chip"><Icon name="refresh" size={13}/> Saving…</span>
      </div>
      <div className="wiz-prog">{phases.map(([n,done,tot],i)=>(
        <div key={n} className="wiz-phase"><div className="wiz-phase-track">{Array.from({length:tot}).map((_,j)=><span key={j} className={j<done?'on':''}/>)}</div><Eyebrow tone={i===1?'primary':'faint'}>{n}</Eyebrow></div>
      ))}</div>
      <div className="wiz-body">
        <div className="card" style={{maxWidth:560}}>
          <span className="tag-teal">Closing interviews &amp; new business</span>
          {[['New CIs booked','Appointments booked this week with new prospects.'],['CIs conducted','Total closing interviews actually completed.'],['Applications written','New policy applications completed and submitted.'],['API written (TTD)','Annualised premium income from this week.']].map(([l,h],i)=>(
            <div key={i} className="wiz-field"><label className="field-label" style={{marginBottom:2}}>{l}</label><div className="kpi-foot" style={{marginBottom:8}}>{h}</div><input className="input" defaultValue={i===3?'':'0'} placeholder="0"/></div>
          ))}
        </div>
        <aside className="cap-rail" style={{alignSelf:'start'}}>
          <Eyebrow tone="faint">Your week so far <span className="live-dot">LIVE</span></Eyebrow>
          <div className="rail-num">{ttd(0)}</div>
          <div className="kpi-foot">Production API · est. commission {ttd(0)}</div>
          <div className="rail-mini">
            <div><Eyebrow tone="faint">Apps</Eyebrow><div className="rail-mini-num">0</div></div>
            <div><Eyebrow tone="faint">Conv.</Eyebrow><div className="rail-mini-num">0%</div></div>
            <div><Eyebrow tone="faint">Calls</Eyebrow><div className="rail-mini-num">2</div></div>
            <div><Eyebrow tone="faint">Names</Eyebrow><div className="rail-mini-num">0</div></div>
          </div>
          <div className="rail-note"><Icon name="refresh" size={13}/> Hours, ratings &amp; goals in 5 more steps</div>
        </aside>
      </div>
      <div className="wiz-foot">
        <Btn kind="ghost" size="lg" onClick={()=>goTo('selectweek')}>Change week</Btn>
        <span className="kpi-foot">Step 7 of 12</span>
        <Btn kind="primary" size="lg" iconAfter="arrow" onClick={()=>goTo('wizardreview')}>Next · Delivery &amp; service</Btn>
      </div>
    </div>
  );
}

// ---------- WEEKLY WIZARD: Review ----------
function WizardReview({ goTo }) {
  return (
    <div className="page" style={{maxWidth:820}}>
      <div className="wiz-head"><div><Eyebrow tone="faint">Step 12 · Goals</Eyebrow><h2 className="scr-title">Review &amp; submit</h2></div><span className="save-chip"><Icon name="check" size={13}/> Saved</span></div>
      <div className="hero" style={{background:'linear-gradient(135deg,var(--gold-soft),var(--card))',color:'var(--ink)',border:'1px solid color-mix(in oklab,var(--gold) 30%,var(--line))'}}>
        <div className="hero-main"><Eyebrow tone="gold">Your week</Eyebrow><div className="hero-num" style={{color:'var(--ink)'}}>{ttd(7777)}</div><div className="kpi-foot">Production API · 2 apps · 3 lives</div></div>
        <div className="hero-side" style={{borderLeft:'1px solid color-mix(in oklab,var(--gold) 25%,transparent)'}}><Eyebrow tone="gold">Est. commission</Eyebrow><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:900,fontSize:28,color:'var(--gold)'}}>{ttd(2722)}</div><div className="kpi-foot">at 35% rate</div></div>
      </div>
      {[['Production','Step 7',[['New business','2 apps · '+ttd(7777)],['PPP increases','0 apps'],['Lumpsums','TTD 778']]],['Activity','Step 3',[['Calls','2 across 5 categories'],['Names','0 new prospects'],['CIs','1 conducted'],['Conv.','50% CI→app']]],['Reflection','Step 10',[['Plan','8/10'],['Time','7/10'],['Sales','6/10'],['Overall','7/10']]]].map(([sec,step,rows])=>(
        <div key={sec} className="card">
          <div className="card-head"><Eyebrow tone="faint">{sec}</Eyebrow><button className="edit-chip">Edit · {step} <Icon name="chevron" size={13}/></button></div>
          <div className="rev-rows">{rows.map(([k,v])=><div key={k} className="rev-row"><span className="kpi-foot">{k}</span><b>{v}</b></div>)}</div>
        </div>
      ))}
      <div className="wiz-foot"><Btn kind="ghost" size="lg" onClick={()=>goTo('wizardstep')}>Back</Btn><span className="kpi-foot">Step 12 of 12</span><Btn kind="primary" size="lg" iconAfter="arrow" onClick={()=>goTo('celebration')}>Submit report</Btn></div>
    </div>
  );
}

// ---------- GAME PLAN ----------
function GamePlanScreen() {
  return (
    <div className="page">
      <div><h2 className="scr-title">Game Plan</h2><p className="scr-sub">Build your 2026 — what you need to earn, step by step. Visible to your managers.</p></div>
      <div className="card" style={{border:'1px solid color-mix(in oklab,var(--gold) 30%,var(--line))',background:'linear-gradient(150deg,var(--gold-soft),var(--card))'}}>
        <div className="card-head"><Eyebrow tone="gold">Your 2026 plan · <span style={{color:'var(--ink-faint)'}}>committed</span></Eyebrow><div style={{textAlign:'right'}}><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:900,fontSize:22}}>100%</div><div className="kpi-foot">3 of 3 steps</div></div></div>
        <div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:800,fontSize:22,margin:'4px 0 6px'}}>Earn <span style={{color:'var(--primary)'}}>{ttd(53333)}</span> in commission to cover your year</div>
        <div className="kpi-foot" style={{marginBottom:16}}>{ttd(103333)} gross need · {ttd(50000)} from renewals · {ttd(1200000)} API commitment</div>
        <div className="plan-stats">{[['After-tax need',ttd(100000)],['Renewals cover',ttd(50000)],['Commission need',ttd(53333)],['API commitment',ttd(1200000)]].map(([l,v])=><div key={l}><Eyebrow tone="faint">{l}</Eyebrow><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:800,fontSize:18,marginTop:4}}>{v}</div></div>)}</div>
      </div>
      <div className="plan-steps">{[['Money Needs','Allocated by line'],['Monthly Plan','Split into months'],['Review & Commit','Plan committed']].map(([t,s])=>(
        <div key={t} className="plan-step"><div className="plan-check"><Icon name="check" size={15}/></div><div><Eyebrow tone="faint">Done</Eyebrow><div style={{fontWeight:700,fontSize:14,marginTop:2}}>{t}</div><div className="kpi-foot">{s}</div></div></div>
      ))}</div>
    </div>
  );
}

// ---------- MONEY NEEDS (accordion) ----------
function MoneyNeedsScreen() {
  const secs = [['Fixed Expenses',1,6,'var(--primary)'],['Living Expenses',0,8,'var(--ink-faint)'],['Business Expenses',0,8,'var(--gold)'],['Savings & Accumulation',0,6,'var(--good)'],['Miscellaneous',0,6,'var(--ink-faint)']];
  const [open,setOpen] = useState(0);
  return (
    <div className="page" style={{maxWidth:860}}>
      <div className="card-head"><div><span style={{fontWeight:800,fontFamily:"'Cabinet Grotesk',sans-serif",fontSize:18}}>💰 Money Needs Worksheet</span> <span className="badge" style={{marginLeft:8}}>Filled 1/34</span></div><div className="sel">2026</div></div>
      <div className="card" style={{background:'var(--primary-soft)',border:'1px solid color-mix(in oklab,var(--primary) 22%,transparent)'}}><div style={{fontWeight:700,marginBottom:4}}>Design the life you want</div><div className="kpi-foot">You set your own income — there's no ceiling. Map out the life you actually want, and see exactly what you'll need to earn to fund it.</div></div>
      {secs.map(([t,f,tot,c],i)=>(
        <div key={t} className="acc">
          <button className="acc-head" onClick={()=>setOpen(open===i?-1:i)}>
            <span className="acc-dot" style={{background:c}}/><span style={{flex:1,textAlign:'left',fontWeight:700}}>{t}</span>
            <span className="kpi-foot">{f} of {tot} filled</span><Icon name="chevron" size={16} style={{transform:open===i?'rotate(90deg)':'',color:'var(--ink-faint)'}}/>
          </button>
          {open===i && <div className="acc-body">{Array.from({length:Math.min(tot,4)}).map((_,j)=><div key={j} className="acc-row"><span className="kpi-foot">Line item {j+1}</span><input className="input" style={{width:140}} placeholder="TTD 0"/></div>)}</div>}
        </div>
      ))}
      <div className="card"><div className="rev-row" style={{fontSize:16}}><b>Total annual budget</b><b style={{fontFamily:"'Cabinet Grotesk',sans-serif"}}>{ttd(100000)}</b></div><div className="rev-row"><span className="kpi-foot">= Income you must earn</span><b style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontSize:20}}>{ttd(103333)}</b></div></div>
    </div>
  );
}

// ---------- GOALS ----------
function GoalsScreen() {
  return (
    <div className="page">
      <Eyebrow tone="faint">Goal hierarchy</Eyebrow>
      <div className="hero"><div className="hero-main" style={{gridColumn:'1/-1'}}>
        <Eyebrow tone="onhero">Your commitment</Eyebrow><div className="hero-num">{ttd(1200000)}</div><div className="hero-meta">Annual API target</div>
        <div className="goal-bars">{[['API',44,ttd(532777)],['Apps',45,'45'],['Persistency',0,'—']].map(([l,p,v])=>(
          <div key={l} className="goal-bar-row"><span className="goal-bar-label">{l}</span><div className="goal-bar"><div style={{width:p+'%'}}/></div><span className="goal-bar-val">{v}</span></div>
        ))}</div>
      </div></div>
      <div className="card floor-card"><div className="card-head"><Eyebrow tone="faint" style={{color:'var(--bad)'}}>● Company floor</Eyebrow><b>{ttd(250000)}</b></div><div className="floor-bar"><div style={{width:'100%'}}/></div><div className="kpi-foot" style={{marginTop:6}}>YTD {ttd(532777)} · <span style={{color:'var(--good)',fontWeight:700}}>Met</span></div></div>
      <div className="alert" style={{background:'var(--amber-soft)'}}><div className="alert-ic"><Icon name="bell" size={16}/></div><div className="alert-body"><div className="alert-title">Rate not on file</div><div className="alert-sub">Income can't be derived without a blended commission rate. Ask your manager to set it.</div></div></div>
      <div><Eyebrow tone="gold" style={{marginBottom:10}}>🏆 Awards reach</Eyebrow>
        {[['Persistency Award — Silver',92,'Nearest'],['Persistency Award — Gold',95,null]].map(([t,p,tag])=>(
          <div key={t} className="card" style={{marginBottom:10}}><div className="card-head"><div style={{fontWeight:700}}>{t} {tag&&<span className="badge" style={{marginLeft:6}}>{tag}</span>}</div></div><div className="aw-bar"><div style={{width:p+'%',background:'var(--primary)'}}/></div><div className="kpi-foot" style={{marginTop:6}}>{p}% persistency needed · <i>estimated, pending Tatil Life confirmation</i></div></div>
        ))}
      </div>
    </div>
  );
}

// ---------- COMMISSION (playground) ----------
function CommissionScreen() {
  return (
    <div className="page">
      <div className="hero"><div className="hero-main">
        <Eyebrow tone="onhero">Your reality · 26 weeks left in 2026</Eyebrow>
        <div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:800,fontSize:26,margin:'14px 0 4px',lineHeight:1.2}}>On pace for <span style={{color:'var(--gold)'}}>{ttd(0)}</span> in commission this year</div>
        <div className="mm-stats" style={{gridTemplateColumns:'repeat(3,auto)',gap:12,marginTop:8,justifyContent:'start'}}>{[['YTD earned',ttd(0)],['Projected',ttd(0)],['Goal',ttd(420000)]].map(([l,v])=><div key={l} className="hero-chip"><Eyebrow tone="onhero">{l}</Eyebrow><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:800,fontSize:18,marginTop:3}}>{v}</div></div>)}</div>
      </div></div>
      <div className="card">
        <div className="card-head"><div><span style={{fontWeight:800,fontFamily:"'Cabinet Grotesk',sans-serif",fontSize:17}}>Commission Playground</span><div className="kpi-foot">Reverse-engineer the activity needed to hit your income goal</div></div></div>
        <div className="seg" style={{marginBottom:18}}><button className="is-on">Goal decomposition</button><button>Modal targeting</button></div>
        <Eyebrow tone="faint" style={{marginBottom:10}}>Income assumptions</Eyebrow>
        <div className="input-grid">{[['Income goal (TTD)','300000'],['Tax rate (%)','25'],['Renewal income (TTD)','0'],['Settlement rate (%)','90']].map(([l,v])=><div key={l}><label className="field-label">{l}</label><input className="input" defaultValue={v}/></div>)}</div>
        <Eyebrow tone="faint" style={{margin:'18px 0 10px'}}>Production assumptions</Eyebrow>
        <div className="input-grid input-grid--3">{[['Commission rate (%)','35'],['Avg policy API (TTD)','12000'],['Persistency (%)','90']].map(([l,v])=><div key={l}><label className="field-label">{l}</label><input className="input" defaultValue={v}/></div>)}</div>
        <div className="card" style={{background:'var(--gold-soft)',marginTop:18,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><Eyebrow tone="gold">Income goal · pre-tax target</Eyebrow></div><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:900,fontSize:24,color:'var(--gold)'}}>{ttd(300000)}</div></div>
      </div>
    </div>
  );
}

// ---------- PERSISTENCY ----------
function PersistencyScreen() {
  return (
    <div className="page" style={{maxWidth:900}}>
      <div className="sel" style={{width:'fit-content'}}>2026-07 <Icon name="chevron" size={14} style={{transform:'rotate(90deg)'}}/></div>
      <div className="hero"><div className="hero-main" style={{gridColumn:'1/-1'}}><Eyebrow tone="onhero">↗ Your persistency · 2026-07</Eyebrow><div style={{display:'flex',alignItems:'center',gap:14,marginTop:12}}><div className="ring-wrap" style={{width:56,height:56,background:'rgba(255,255,255,.1)',borderRadius:14,display:'grid',placeItems:'center'}}><Icon name="minus" size={22} style={{color:'var(--hero-faint)'}}/></div><div className="hero-meta">No record entered for this month yet.</div></div></div></div>
      <div className="two-col" style={{gridTemplateColumns:'1.4fr 1fr'}}>
        <div className="card"><Eyebrow tone="faint">12-month trend</Eyebrow><EmptyState icon="chart" title="No history yet" body="Your trend appears after the first month is entered."/></div>
        <div style={{display:'flex',flexDirection:'column',gap:'var(--gap)'}}>
          <div className="card"><div className="card-head"><Eyebrow tone="faint">Self-entry</Eyebrow></div><div className="kpi-foot" style={{marginBottom:12}}>Enter the six figures from the Tatil monthly report. Persistency is derived automatically.</div><Btn kind="primary" size="sm" icon="doc">Enter figures</Btn></div>
          <div className="card"><div className="card-head"><Eyebrow tone="faint">What-if calculator</Eyebrow></div><div className="kpi-foot" style={{marginBottom:12}}>Model new business, reinstatements and orphan adoptions.</div><Btn kind="ghost" size="sm">Open playground</Btn></div>
        </div>
      </div>
    </div>
  );
}

// ---------- POLICY LEDGER (empty w/ ghost) ----------
function PolicyLedgerScreen() {
  const stress = useStress();
  const HOLDERS = ['Anika Ramdeen','Devon Charles','Kwame Joseph','Priya Maharaj','Marcus Alleyne','Shivani Persad','Terrence Baptiste','Ayesha Khan','Rohan Boodram','Nia Providence','Kavita Sammy','Darius Mohammed'];
  const PLANS = ['Whole Life','Term 20','Universal','Endowment','Critical Illness','Term 10'];
  const STATUSES = [['Issued','ok'],['Underwriting','warn'],['Submitted','warn'],['Settled','ok'],['Lapsed','bad']];
  const tmpl = '2fr 1fr .9fr 1.1fr 1fr';
  const rows = useMemo(() => {
    const n = stress ? 120 : 9;
    return Array.from({ length: n }).map((_, i) => {
      const seed = ((i * 7919 + 104729) % 233280) / 233280;
      const h = HOLDERS[i % HOLDERS.length];
      const name = i < HOLDERS.length ? h : h + ' ' + String.fromCharCode(65 + (i % 26));
      const st = STATUSES[i % STATUSES.length];
      const dd = String(1 + (i % 28)).padStart(2, '0'), mm = String(1 + (i % 9)).padStart(2, '0');
      return { name, plan: PLANS[i % PLANS.length], api: Math.round(2200 + seed * 15800), status: st[0], risk: st[1], issued: `${dd}-${mm}-2026` };
    });
  }, [stress]);
  const totalApi = rows.reduce((a, r) => a + r.api, 0);
  const initials = n => n.split(' ').map(x => x[0]).join('').slice(0, 2);
  const pillCls = r => r === 'ok' ? 'is-in' : r === 'bad' ? 'is-bad' : 'is-warn';
  return (
    <div className="page">
      <div className="card-head"><h2 className="scr-title" style={{ margin: 0 }}>Policy Ledger</h2><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><span className="kpi-foot">{rows.length} policies · {ttd(totalApi)} API</span><Btn kind="primary" size="sm" icon="plus">New policy</Btn></div></div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="sheet-scroll sheet-scroll--live" role="region" aria-label="Policy ledger, scrollable">
          <div className="sheet-head" style={{ gridTemplateColumns: tmpl }}>{['Policyholder','Plan','API','Status','Issued'].map((c, i) => <div key={c} className={'sheet-col' + (i === 0 ? ' sheet-col--stick' : '')}>{c}</div>)}</div>
          {rows.map((r, ri) => (
            <div key={ri} className="sheet-row" style={{ gridTemplateColumns: tmpl }}>
              <div className="sheet-col sheet-col--stick sheet-agent"><span className="ava ava--xs">{initials(r.name)}</span>{r.name}</div>
              <div className="sheet-col" style={{ fontSize: 13 }}>{r.plan}</div>
              <div className="sheet-col sheet-num" style={{ fontSize: 13 }}>{ttd(r.api)}</div>
              <div className="sheet-col"><span className={'pill-status ' + pillCls(r.risk)}>{r.status}</span></div>
              <div className="sheet-col sheet-num" style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{r.issued}</div>
            </div>
          ))}
        </div>
        <div className="sheet-foot">{rows.length} policies{stress ? ' · stress load' : ''}</div>
      </div>
    </div>
  );
}

// ---------- HISTORY (heatmap) ----------
function HistoryScreen() {
  const cells = Array.from({length:52}).map((_,i)=> i<6 ? (i%2?3:2) : (i<26 && i%9===0?1:0));
  const shades = ['var(--line)','color-mix(in oklab,var(--primary) 25%,var(--card))','color-mix(in oklab,var(--primary) 55%,var(--card))','var(--primary)'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (
    <div className="page">
      <div className="hero"><div className="hero-main" style={{gridColumn:'1/-1'}}>
        <Eyebrow tone="onhero">Your year · 2026 · 6 of 52 weeks submitted</Eyebrow>
        <div className="hero-num" style={{fontSize:44}}>TTD 533K <span style={{fontSize:15,color:'var(--hero-faint)',fontFamily:"'Space Mono',monospace"}}>YTD · AVG 89K/WK</span></div>
        <div className="hero-meta">On track for TTD 4.62M if pace holds through year-end.</div>
        <div className="hist-chips">{[['Streak','1 wk'],['Best week','TTD 105K'],['Award weeks','6'],['Drafts','3']].map(([l,v])=><div key={l} className="hist-chip"><Eyebrow tone="onhero">{l}</Eyebrow><div style={{fontWeight:700,marginTop:3}}>{v}</div></div>)}</div>
      </div></div>
      <div className="card">
        <div className="card-head"><Eyebrow tone="faint">Year at a glance · 2026</Eyebrow><span className="kpi-foot">Target TTD 6.3K/wk</span></div>
        <div className="heat-months">{months.map(m=><span key={m}>{m}</span>)}</div>
        <div className="heatmap">{cells.map((c,i)=><span key={i} className="heat-cell" style={{background:shades[c]}} title={'Week '+(i+1)}/>)}</div>
        <div className="heat-legend"><span>&lt;60%</span><span className="heat-cell" style={{background:shades[1]}}/><span className="heat-cell" style={{background:shades[2]}}/><span className="heat-cell" style={{background:shades[3]}}/><span>≥100%</span></div>
      </div>
      <div className="seg"><button className="is-on">All weeks <span className="seg-badge">9</span></button><button>Submitted <span className="seg-badge muted">6</span></button><button>Draft <span className="seg-badge muted">3</span></button></div>
      {[['Sun 21 Jun','21-06-2026','Submitted','ok',['TTD 7.8K','0','0','0']],['Sun 14 Jun','14-06-2026','Draft','warn',['TTD 0','0','0','13']]].map(([d,dt,st,k,vals])=>(
        <div key={d} className="card"><div className="card-head"><div><b>{d}</b> <span className="kpi-foot">{dt}</span></div><span className={'risk risk--'+k}>{st}</span></div>
          <div className="hist-week">{['API','Apps','CIs','Dials'].map((l,i)=><div key={l} className="hist-week-stat"><Eyebrow tone="faint">{l}</Eyebrow><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:800,fontSize:17,marginTop:3}}>{vals[i]}</div></div>)}</div>
        </div>
      ))}
    </div>
  );
}

// ---------- PRODUCTION REPORT (agent) ----------
function AgentProductionScreen() {
  return (
    <div className="page">
      <div className="card-head" style={{justifyContent:'flex-end',gap:10}}><span className="badge" style={{background:'var(--amber-soft)',color:'var(--amber)'}}>Estimated</span><div className="seg"><button className="is-on">Week</button><button>MTD</button><button>Quarter</button><button>YTD</button></div></div>
      <div className="hero"><div className="hero-main"><div style={{display:'flex',alignItems:'center',gap:12}}><div className="ava" style={{width:44,height:44,background:'rgba(255,255,255,.15)',color:'var(--hero-ink)'}}>SA</div><div><div style={{fontWeight:800,fontSize:18}}>Smoke Agent</div><Eyebrow tone="onhero">Central Unit · this week</Eyebrow></div></div>
        <div className="mm-stats" style={{gridTemplateColumns:'repeat(3,auto)',gap:20,marginTop:16,justifyContent:'start'}}>{[['New API',ttd(0)],['Applications','0'],['Persistency','—']].map(([l,v])=><div key={l}><Eyebrow tone="onhero">{l}</Eyebrow><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:800,fontSize:22,marginTop:3}}>{v}</div></div>)}</div>
      </div><div className="hero-side"><Eyebrow tone="onhero">Branch rank</Eyebrow><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:900,fontSize:30}}>—/—</div></div></div>
      <div className="kpi-grid">{[['Week',ttd(0),'0 apps'],['Month',ttd(0),'0 apps'],['Quarter',ttd(0),'0 apps'],['Year',ttd(535777),'47 apps']].map(([l,v,f])=><div key={l} className="kpi" style={{gridColumn:'span 1'}}><Eyebrow tone="faint">{l}</Eyebrow><div className="kpi-big" style={{fontSize:26,marginTop:8}}>{v}</div><div className="kpi-foot">{f}</div></div>)}</div>
      <div className="card floor-card"><div className="card-head"><Eyebrow tone="faint">Year to date vs tenure floor</Eyebrow><span className="kpi-foot">{ttd(535777)} / {ttd(250000)}</span></div><div className="floor-bar"><div style={{width:'100%',background:'var(--good)'}}/></div><div className="kpi-foot" style={{marginTop:6,color:'var(--good)',fontWeight:700}}>✓ 100% — above floor</div></div>
    </div>
  );
}

// ---------- LEADERBOARD (empty) ----------
function LeaderboardScreen() {
  const stress = useStress();
  const NAMES = ['Anika Ramdeen','Devon Charles','Kwame Joseph','Priya Maharaj','Marcus Alleyne','Shivani Persad','Terrence Baptiste','Ayesha Khan','Rohan Boodram','Nia Providence','Kavita Sammy','Darius Mohammed','Leah Guerra','Omar Hosein','Simone Achong','Rajiv Balgobin'];
  const rows = useMemo(() => {
    const n = stress ? 50 : 8;
    const arr = Array.from({ length: n }).map((_, i) => {
      const seed = ((i * 6151 + 1) % 233280) / 233280;
      const base = NAMES[i % NAMES.length];
      const name = i < NAMES.length ? base : base + ' ' + String.fromCharCode(65 + (i % 26));
      return { name, api: Math.max(24000, Math.round(680000 - i * (stress ? 11500 : 62000) - seed * 12000)) };
    });
    arr.sort((a, b) => b.api - a.api);
    return arr;
  }, [stress]);
  const top = rows[0].api;
  const initials = n => n.split(' ').map(x => x[0]).join('').slice(0, 2);
  return (
    <div className="page">
      <div className="card-head"><div><Eyebrow tone="gold">★ Top of the board · YTD</Eyebrow><h2 className="scr-title" style={{ margin: '4px 0 0' }}>Who's leading the year</h2></div><div className="seg"><button>WK</button><button>MTD</button><button>QTD</button><button className="is-on">YTD</button></div></div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="lb-scroll" role="region" aria-label="Leaderboard, scrollable">
          {rows.map((r, i) => (
            <div key={i} className={'lb-row' + (i < 3 ? ' lb-row--top' : '')}>
              <div className={'lb-rank' + (i === 0 ? ' is-gold' : i === 1 ? ' is-silver' : i === 2 ? ' is-bronze' : '')}>{i + 1}</div>
              <span className="ava ava--xs">{initials(r.name)}</span>
              <div className="lb-name">{r.name}</div>
              <div className="lb-bar"><div style={{ width: (r.api / top * 100) + '%' }} /></div>
              <div className="lb-api">{ttd(r.api)}</div>
            </div>
          ))}
        </div>
        <div className="sheet-foot">{rows.length} agents ranked{stress ? ' · stress load' : ''}</div>
      </div>
    </div>
  );
}

// ---------- CAREER (ladder) ----------
function CareerScreen() {
  const levels = [['Salesperson','Your current level',0],['Advisor II','TTD 250K API · 2+ yrs',1],['Advisor III','TTD 350K API · 3+ yrs',1],['Advisor IV','TTD 450K API · 4+ yrs',1],['Senior Advisor','TTD 600K API · 5+ yrs',1],['Elite Advisor','TTD 800K API · 6+ yrs',1],['Legend','Pinnacle · 10+ yrs',1]];
  return (
    <div className="page">
      <div className="two-col" style={{gridTemplateColumns:'1.6fr 1fr',alignItems:'start'}}>
        <div className="card"><div className="card-head"><Eyebrow tone="faint">Your career ladder</Eyebrow><span className="kpi-foot">1 of 7 levels</span></div>
          <div className="ladder">{levels.map(([t,s,locked],i)=>(
            <div key={t} className={'ladder-item'+(i===0?' is-here':'')}>
              <div className={'ladder-node'+(i===0?' is-here':'')}>{i===0?<Icon name="trophy" size={16}/>:i+1}</div>
              <div><Eyebrow tone="faint">Level {i+1} {i===0&&<span style={{color:'var(--gold)'}}>· You are here</span>}</Eyebrow><div style={{fontWeight:700,fontSize:15,marginTop:2}}>{t}</div><div className="kpi-foot">{s}</div></div>
              {locked?<Icon name="shield" size={14} style={{marginLeft:'auto',color:'var(--ink-faint)'}}/>:null}
            </div>
          ))}</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'var(--gap)'}}>
          <div className="card"><Eyebrow tone="faint">Next milestone</Eyebrow><div style={{fontWeight:800,fontFamily:"'Cabinet Grotesk',sans-serif",fontSize:18,margin:'6px 0'}}>Level 2 — Advisor II</div><div className="aw-bar"><div style={{width:'62%',background:'var(--primary)'}}/></div><div className="kpi-foot" style={{marginTop:6}}>TTD 155K of TTD 250K API</div></div>
          <div className="card"><Eyebrow tone="faint">Trajectory · 8 quarters</Eyebrow><Sparkline points={[10,18,26,30,38,44,52,60]} w={220} h={44}/><div className="kpi-foot" style={{marginTop:6}}>On pace to reach Advisor II by Q2 2027.</div></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { WizardSelectWeek, WizardStep, WizardReview, GamePlanScreen, MoneyNeedsScreen, GoalsScreen, CommissionScreen, PersistencyScreen, PolicyLedgerScreen, HistoryScreen, AgentProductionScreen, LeaderboardScreen, CareerScreen });

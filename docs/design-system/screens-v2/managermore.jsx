// ============================================================
// managermore.jsx — remaining manager + admin screens, in-system
// ============================================================

// ---------- TEAM DASHBOARD (manager overview) ----------
function TeamDashboard() {
  const kpis = [['Compliance rate','25','down','58 vs last wk',[70,66,60,55,52,40,25]],['Weekly API',ttd(11110),'down','TTD 192K vs last wk',[80,72,60,44,30,20,11]],['Weekly apps','0','down','18 vs last wk',[18,14,10,6,3,1,0]],['Weekly FFI','0','flat','no change',[4,4,4,4,4,4,4]]];
  return (
    <div className="page">
      <div className="hero"><div className="hero-main"><Eyebrow tone="onhero">Team YTD · 2026</Eyebrow><div className="hero-num">{ttd(733110)}</div><div className="hero-meta">of {ttd(1200000)} annual goal · 6 advisors · {ttd(466890)} to go · 26w left</div><div className="hero-bar"><div className="hero-bar-fill" style={{width:'61%'}}/></div></div>
        <div className="hero-side"><Ring value={61} size={84} stroke={8} label="61%" color="var(--hero-ink)" track="rgba(255,255,255,.18)"/></div></div>
      <Eyebrow tone="faint">Team activity · last 4 weeks</Eyebrow>
      <div className="kpi-grid">{kpis.map(([l,v,d,f,pts])=>(
        <div key={l} className="kpi" style={{gridColumn:'span 1'}}><Eyebrow tone="faint">{l}</Eyebrow><div className="kpi-big" style={{fontSize:28,margin:'6px 0 4px'}}>{v}</div><Delta dir={d}>{f}</Delta><Sparkline points={pts} w={180} h={30} color={d==='down'?'var(--bad)':'var(--primary)'}/></div>
      ))}</div>
      <div className="two-col" style={{gridTemplateColumns:'1.5fr 1fr'}}>
        <div className="card"><div className="card-head"><Eyebrow tone="faint">Team activity</Eyebrow><span className="kpi-foot">last 14 days</span></div>
          <ul className="feed">{[['Smoke Unit Manager submitted their report','TTD 3,333 API · 0 apps · 21-06-2026'],['Anika Ramdeen submitted their report','TTD 7,777 API · 2 apps · 21-06-2026']].map(([a,b])=><li key={a}><span className="feed-dot ok"/><div><b>{a}</b><div className="kpi-foot">{b} <span className="risk risk--ok" style={{marginLeft:6}}>Submitted</span></div></div></li>)}</ul>
        </div>
        <div className="card"><div className="card-head"><Eyebrow tone="faint">Team badges</Eyebrow></div><div className="badge-card"><div className="badge-ring"><Icon name="target" size={22}/></div><div style={{fontWeight:700,fontSize:14}}>First Steps</div><div className="kpi-foot">× 6 advisors</div></div></div>
      </div>
    </div>
  );
}

// ---------- TEAM PERFORMANCE (grouped table + skeleton) ----------
function TeamPerformance() {
  const rows = [['Anika Ramdeen','4 yrs',148000,11,142000,10,92,'92%'],['Devon Charles','3 yrs',121500,9,118000,8,88,'71%'],['Priya Maharaj','6 yrs',96200,7,90000,6,94,'55%'],['Kwame Joseph','2 yrs',71000,5,68000,4,90,'41%'],['ReNelle Baptiste','1 yr',42800,3,40000,2,76,'25%']];
  return (
    <div className="page">
      <div><h2 className="scr-title">Team Performance Roster</h2><p className="scr-sub">Sort any column · click a header to toggle asc/desc.</p></div>
      <div className="card sheet-toolbar" style={{padding:14}}><Eyebrow tone="faint">Period</Eyebrow><div className="seg" style={{padding:3}}><button className="is-on">Year</button><button>Month</button><button>Week</button></div><div className="sel" style={{marginLeft:'auto'}}>2026</div></div>
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div className="sheet-scroll">
          <div className="perf-group"><span/><span/><span className="perf-gh">Submitted</span><span className="perf-gh">Issued / Settled</span><span/></div>
          <div className="sheet-head" style={{gridTemplateColumns:'1.6fr .7fr 1fr .7fr 1fr .7fr 1fr 1fr',minWidth:900}}>{['Name','Tenure','API sub.','Apps','API issued','Apps iss.','Persist.','% of goal'].map(c=><div key={c} className="sheet-col">{c}</div>)}</div>
          {rows.map(r=><div key={r[0]} className="sheet-row" style={{gridTemplateColumns:'1.6fr .7fr 1fr .7fr 1fr .7fr 1fr 1fr',minWidth:900,fontSize:13.5}}>
            <div style={{fontWeight:700}}>{r[0]}</div><div className="kpi-foot">{r[1]}</div><div>{ttd(r[2])}</div><div>{r[3]}</div><div>{ttd(r[4])}</div><div>{r[5]}</div><div>{r[6]}%</div><div style={{fontWeight:700,color:'var(--primary)'}}>{r[7]}</div>
          </div>)}
        </div>
        <div className="sheet-foot">5 team members · Name pinned · scroll for all 8 columns →</div>
      </div>
    </div>
  );
}

// ---------- SETTLEMENTS ----------
function SettlementsScreen() {
  const hist = [['Anika Ramdeen','June 2026',800000,66,95],['Devon Charles','June 2026',450000,38,88],['Priya Maharaj','June 2026',180000,15,76],['Kwame Joseph','June 2026',60000,5,64]];
  return (
    <div className="page">
      <div className="card"><div className="card-head"><span style={{fontWeight:800,fontFamily:"'Cabinet Grotesk',sans-serif",fontSize:17}}>Enter monthly settlements</span><Btn kind="ghost" size="sm" icon="users">Bulk entry</Btn></div>
        <div className="input-grid"><div><label className="field-label">Month</label><div className="input">July</div></div><div><label className="field-label">Year</label><div className="input">2026</div></div></div>
        <div style={{marginTop:14}}><label className="field-label">Agent</label><div className="input">Select agent…</div></div>
        <div className="input-grid input-grid--3" style={{marginTop:14}}>{[['Settled API (TTD)','0'],['Settled apps','0'],['Persistency %','0']].map(([l,v])=><div key={l}><label className="field-label">{l}</label><input className="input" placeholder={v}/></div>)}</div>
        <Btn kind="primary" size="lg" style={{width:'100%',marginTop:18}}>Save settlement</Btn>
      </div>
      <Eyebrow tone="faint">Settlement history</Eyebrow>
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div className="sheet-head" style={{gridTemplateColumns:'1.6fr 1fr 1fr .7fr .7fr 1fr'}}>{['Agent','Period','API','Apps','Persist','Date'].map(c=><div key={c} className="sheet-col">{c}</div>)}</div>
        {hist.map(r=><div key={r[0]} className="sheet-row" style={{gridTemplateColumns:'1.6fr 1fr 1fr .7fr .7fr 1fr',fontSize:13.5}}><div style={{fontWeight:700}}>{r[0]}</div><div className="kpi-foot">{r[1]}</div><div>{ttd(r[2])}</div><div>{r[3]}</div><div>{r[4]}%</div><div className="kpi-foot">17-06-2026</div></div>)}
      </div>
    </div>
  );
}

// ---------- POLICY RECONCILIATION (empty) ----------
function ReconciliationScreen() {
  const stress = useStress();
  const HOLDERS = ['Anika Ramdeen','Devon Charles','Kwame Joseph','Priya Maharaj','Marcus Alleyne','Shivani Persad','Terrence Baptiste','Ayesha Khan','Rohan Boodram','Nia Providence','Kavita Sammy','Darius Mohammed'];
  const PLANS = ['Whole Life','Term 20','Universal','Endowment','Critical Illness'];
  const tmpl = '1.7fr 1fr 1fr 1fr 1.1fr';
  const rows = useMemo(() => {
    const n = stress ? 90 : 7;
    return Array.from({ length: n }).map((_, i) => {
      const seed = ((i * 5417 + 733) % 233280) / 233280;
      const h = HOLDERS[i % HOLDERS.length];
      const name = i < HOLDERS.length ? h : h + ' ' + String.fromCharCode(65 + (i % 26));
      const ledger = Math.round(2400 + seed * 14200);
      const differs = i % 4 === 0;
      const carrier = differs ? ledger + Math.round((seed - 0.5) * 1800) : ledger;
      return { name, plan: PLANS[i % PLANS.length], ledger, carrier, differs, pol: 'TT' + (100482 + i * 37) };
    });
  }, [stress]);
  const flagged = rows.filter(r => r.differs).length;
  const initials = n => n.split(' ').map(x => x[0]).join('').slice(0, 2);
  return (
    <div className="page">
      <div className="card-head"><div><h2 className="scr-title" style={{ margin: 0 }}>Policy Reconciliation</h2><p className="scr-sub" style={{ margin: '4px 0 0' }}>Read Tatil's circular and key the confirmed figure per policy. Blank = agree with the ledger.</p></div><div className="seg"><button className="is-on">Confirm</button><button>Lapse</button></div></div>
      <div className="sheet-toolbar"><div className="sel">2026</div><div className="sel">Jul</div><div className="search" style={{ flex: 1, maxWidth: 'none' }}><Icon name="target" size={15} /><span>Search {rows.length} policies…</span></div></div>
      {flagged > 0 && <div className="sync-banner"><Icon name="bell" size={16} /> {flagged} {flagged === 1 ? 'policy differs' : 'policies differ'} from the carrier circular — review the highlighted rows.</div>}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="sheet-scroll sheet-scroll--live" role="region" aria-label="Reconciliation, scrollable">
          <div className="sheet-head" style={{ gridTemplateColumns: tmpl }}>{['Policyholder','Plan','Ledger API','Carrier API','Status'].map((c, i) => <div key={c} className={'sheet-col' + (i === 0 ? ' sheet-col--stick' : '')}>{c}</div>)}</div>
          {rows.map((r, ri) => (
            <div key={ri} className="sheet-row" style={{ gridTemplateColumns: tmpl, background: r.differs ? 'color-mix(in oklab,var(--amber) 7%,var(--card))' : undefined }}>
              <div className="sheet-col sheet-col--stick sheet-agent"><span className="ava ava--xs">{initials(r.name)}</span>{r.name}</div>
              <div className="sheet-col" style={{ fontSize: 13 }}>{r.plan}</div>
              <div className="sheet-col sheet-num" style={{ fontSize: 13 }}>{ttd(r.ledger)}</div>
              <div className="sheet-col sheet-num" style={{ fontSize: 13, fontWeight: r.differs ? 700 : 400, color: r.differs ? 'var(--amber)' : undefined }}>{ttd(r.carrier)}</div>
              <div className="sheet-col"><span className={'pill-status ' + (r.differs ? 'is-warn' : 'is-in')}>{r.differs ? 'Differs' : 'Agrees'}</span></div>
            </div>
          ))}
        </div>
        <div className="sheet-foot">{rows.length} policies · {flagged} flagged · {rows.length - flagged} agree{stress ? ' · stress load' : ''}</div>
      </div>
    </div>
  );
}

// ---------- TEAM WARS (filled, fix void) ----------
function TeamWarsScreen() {
  const mgrs = [['Smoke Branch Manager','Branch Manager',3,2,'ok'],['Central Unit Manager','Unit Manager',1,1,'watch'],['North Unit Manager','Unit Manager',0,0,'bad']];
  return (
    <div className="page">
      <div className="card-head"><div><h2 className="scr-title" style={{margin:0}}>Team Activity Reports</h2><p className="scr-sub" style={{margin:'4px 0 0'}}>Manager WARs for the selected week.</p></div><div className="sel">Week of 28-06-2026</div></div>
      {mgrs.map(([n,r,jfw,oneone,k])=>(
        <div key={n} className="card"><div className="card-head" style={{marginBottom:0}}><div style={{display:'flex',gap:12,alignItems:'center'}}><div className="ava">{n.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><div style={{fontWeight:700}}>{n}</div><Eyebrow tone="faint">{r}</Eyebrow></div></div>
          <div style={{display:'flex',gap:24,alignItems:'center'}}><div style={{textAlign:'right'}}><Eyebrow tone="faint">JFW</Eyebrow><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:800,fontSize:18}}>{jfw}</div></div><div style={{textAlign:'right'}}><Eyebrow tone="faint">1-on-1s</Eyebrow><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:800,fontSize:18}}>{oneone}</div></div><span className={'risk risk--'+k}>{k==='ok'?'Filed':k==='watch'?'Partial':'Not filed'}</span></div>
        </div></div>
      ))}
    </div>
  );
}

// ---------- TEAM GAMEPLANS (keep-list: privacy model) ----------
function TeamGameplansScreen() {
  const agents = [['Anika Ramdeen',true],['Devon Charles',true],['Priya Maharaj',false],['Kwame Joseph',false],['ReNelle Baptiste',true],['Marlon Ali',false]];
  const shared = agents.filter(a=>a[1]).length;
  return (
    <div className="page">
      <div className="card-head"><h2 className="scr-title" style={{margin:0}}>Team Plans</h2><span className="badge">Shared by the agent · read-only</span></div>
      <div className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><Eyebrow tone="faint">Plans shared</Eyebrow><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:900,fontSize:30}}>{shared} <span style={{fontSize:15,color:'var(--ink-faint)'}}>of 6 agents</span></div></div><div className="kpi-foot" style={{maxWidth:300,textAlign:'right'}}>Sharing is each agent's choice. You see the derived coaching figures only — never the household budget itself.</div></div>
      <div className="card" style={{padding:0,overflow:'hidden'}}>{agents.map(([n,sh])=>(
        <div key={n} className="nudge-row"><div className="ava">{n.split(' ').map(x=>x[0]).join('')}</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{n}</div><div className="kpi-foot">{sh?'Plan shared · 2026 worksheet':'Worksheet not shared with you'}</div></div>{sh?<Btn kind="ghost" size="sm" iconAfter="chevron">View plan</Btn>:<span className="risk" style={{background:'var(--line)',color:'var(--ink-faint)'}}>Not shared</span>}</div>
      ))}</div>
    </div>
  );
}

// ---------- KIOSK (finished generate-URL flow, fix) ----------
function KioskScreen() {
  const [gen,setGen] = useState(false);
  return (
    <div className="page" style={{maxWidth:760}}>
      <div><h2 className="scr-title">Kiosk Mode</h2><p className="scr-sub">Generate a secure URL to display the branch performance board on a TV. Tokens expire after one year.</p></div>
      <div className="card kiosk-card">
        <div className="kiosk-preview"><div className="kiosk-screen"><Eyebrow tone="onhero" style={{color:'#8fc6c3'}}>Smoke Test Branch</Eyebrow><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:900,fontSize:26,color:'#5cc7c9',marginTop:6}}>{ttd(733110)}</div><div className="kiosk-bars">{[70,52,88,40].map((h,i)=><span key={i} style={{height:h+'%'}}/>)}</div></div><div className="kpi-foot" style={{textAlign:'center',marginTop:10}}>Live TV preview</div></div>
        <div className="kiosk-side">
          {!gen ? <>
            <div style={{fontWeight:700,marginBottom:6}}>No active kiosk link</div>
            <div className="kpi-foot" style={{marginBottom:16}}>Generate a token to cast this board to any branch display. You can revoke it anytime.</div>
            <Btn kind="primary" size="lg" icon="plus" onClick={()=>setGen(true)}>Generate secure URL</Btn>
          </> : <>
            <Eyebrow tone="faint">Active link · expires 04-07-2027</Eyebrow>
            <div className="kiosk-url">https://kiosk.agencytrack.tt/b/9f2a…e71 <button className="nudge-btn" style={{padding:'5px 9px'}}><Icon name="doc" size={13}/> Copy</button></div>
            <div style={{display:'flex',gap:8,marginTop:14}}><Btn kind="ghost" size="sm" icon="refresh">Rotate</Btn><Btn kind="ghost" size="sm">Revoke</Btn></div>
          </>}
        </div>
      </div>
    </div>
  );
}

// ---------- AGENT OF THE MONTH ----------
function AgentOfMonthScreen() {
  const cats = [['Top API',['Anika Ramdeen','Devon Charles','Kwame Joseph']],['Most Apps',['Devon Charles','Anika Ramdeen','Priya Maharaj']],['Best Persistency',['Priya Maharaj','Anika Ramdeen','ReNelle Baptiste']]];
  const [pick,setPick] = useState({});
  return (
    <div className="page">
      <div className="card-head"><div><h2 className="scr-title" style={{margin:0}}>Agent of the Month</h2><p className="scr-sub" style={{margin:'4px 0 0'}}>Select one winner per category to display on the branch kiosk.</p></div><div className="seg"><button>2026-06</button><button className="is-on">2026-07</button></div></div>
      <div className="aom-grid">{cats.map(([cat,cands])=>(
        <div key={cat} className="card"><Eyebrow tone="gold">{cat}</Eyebrow>
          <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:8}}>{cands.map((c,i)=>(
            <button key={c} className={'aom-cand'+(pick[cat]===c?' is-pick':'')} onClick={()=>setPick(p=>({...p,[cat]:c}))}><div className={'mm-rank'+(i===0?' is-gold':'')} style={{width:26,height:26,fontSize:12}}>{i+1}</div><span style={{flex:1,textAlign:'left',fontWeight:600,fontSize:13.5}}>{c}</span>{pick[cat]===c && <Icon name="check" size={15} style={{color:'var(--gold)'}}/>}</button>
          ))}</div>
        </div>
      ))}</div>
    </div>
  );
}

// ---------- MY WAR (manager activity form) ----------
function MyWarScreen() {
  return (
    <div className="page" style={{maxWidth:720}}>
      <div className="wiz-head"><div><h2 className="scr-title" style={{margin:0}}>My Weekly Activity Report</h2><Eyebrow tone="faint" style={{marginTop:4}}>Draft · auto-saved</Eyebrow></div><div className="sel">Week of 28-06-2026</div></div>
      <div className="card"><Eyebrow tone="faint">Activities</Eyebrow>
        <div style={{marginTop:12}}>{[['One-on-one pipeline reviews'],['Names sourced'],['Initial interviews conducted'],['New recruits in first weeks'],['Training sessions delivered']].map(([l])=>(
          <div key={l} className="war-row"><span>{l}</span><input className="input" style={{width:90,textAlign:'center'}} placeholder="0"/></div>
        ))}</div>
        <div className="war-row"><label className="field-label" style={{margin:0}}>Training topic (optional)</label></div>
        <input className="input" placeholder="e.g. Objection handling" style={{marginTop:4}}/>
        <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:12}}>{['Unit / branch meeting held','Planning & dashboard review done'].map(l=><label key={l} className="check-row"><span className="cbox"/><span>{l}</span></label>)}</div>
      </div>
      <div className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><b>Joint Field Work (JFW)</b><div className="kpi-foot">from joint-call logs</div></div><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:800,fontSize:22}}>0</div></div>
    </div>
  );
}

// ---------- MANAGER PRODUCTION REPORT ----------
function MgrProductionScreen() {
  const units = [["Central Unit's team",0,2],["North Unit's team",0,6]];
  const top = ['Anika Ramdeen','Devon Charles','Kwame Joseph','Priya Maharaj','ReNelle Baptiste'];
  return (
    <div className="page">
      <div className="card-head" style={{justifyContent:'flex-end'}}><span className="badge" style={{background:'var(--amber-soft)',color:'var(--amber)'}}>Estimated</span><div className="seg" style={{marginLeft:10}}><button className="is-on">Week</button><button>MTD</button><button>Quarter</button><button>YTD</button></div></div>
      <div className="hero"><div className="hero-main" style={{gridColumn:'1/-1'}}><Eyebrow tone="onhero">Branch aggregate</Eyebrow>
        <div className="mm-stats" style={{gridTemplateColumns:'repeat(4,auto)',gap:28,marginTop:12,justifyContent:'start'}}>{[['Total API',ttd(0)],['Apps','0'],['Avg API / agent',ttd(0)],['Agents','14']].map(([l,v])=><div key={l}><Eyebrow tone="onhero">{l}</Eyebrow><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:900,fontSize:26,marginTop:4}}>{v}</div></div>)}</div>
      </div></div>
      <div className="card"><div className="card-head"><Eyebrow tone="faint">Unit leaderboard</Eyebrow><span className="kpi-foot">by avg API / agent</span></div>{units.map(([n,api,ag],i)=><div key={n} className="rank-row"><div className={'mm-rank'+(i===0?' is-gold':'')} style={{background:i===0?'':'var(--primary-soft)',color:i===0?'':'var(--primary)'}}>{i+1}</div><span style={{flex:1,fontWeight:600}}>{n}</span><span className="kpi-foot">{ag} agents</span><b style={{fontFamily:"'Cabinet Grotesk',sans-serif"}}>{ttd(api)}</b></div>)}</div>
      <div className="card"><div className="card-head"><Eyebrow tone="faint">Top 6 agents</Eyebrow></div>{top.map((n,i)=><div key={n} className="rank-row"><div className={'mm-rank'+(i===0?' is-gold':'')} style={{background:i===0?'':'var(--primary-soft)',color:i===0?'':'var(--primary)'}}>{i+1}</div><span style={{flex:1,fontWeight:600}}>{n}</span><b style={{fontFamily:"'Cabinet Grotesk',sans-serif"}}>{ttd(0)}</b><span className="kpi-foot" style={{minWidth:50,textAlign:'right'}}>0 apps</span></div>)}</div>
    </div>
  );
}

// ---------- CAMPAIGNS (considered empty) ----------
function CampaignsScreen() {
  return (
    <div className="page">
      <div className="card-head"><h2 className="scr-title" style={{margin:0}}>Campaigns</h2><Btn kind="primary" size="sm" icon="plus">New campaign</Btn></div>
      <div className="seg"><button className="is-on">Active</button><button>Upcoming</button><button>Ended</button></div>
      <div className="card"><EmptyState icon="bolt" title="No active campaigns" body="Launch a production sprint, recruiting drive, or persistency push. Agents see live standings on their dashboard and the branch kiosk." cta="Create a campaign"/></div>
    </div>
  );
}

// ---------- ADMIN: Branches ----------
function AdminBranches() {
  return (
    <div className="page">
      <div className="card"><div className="card-head"><div><span style={{fontWeight:800,fontFamily:"'Cabinet Grotesk',sans-serif",fontSize:17}}>Branches</span><div className="kpi-foot">Create and manage branch records for your tenant.</div></div><Btn kind="primary" size="sm" icon="plus">Add branch</Btn></div>
        <div className="sheet-scroll">
        <div className="sheet-head" style={{gridTemplateColumns:'2fr 1.4fr 1.4fr .8fr .8fr',marginTop:8}}>{['Name','Manager','Users','Status','Actions'].map(c=><div key={c} className="sheet-col">{c}</div>)}</div>
        <div className="sheet-row" style={{gridTemplateColumns:'2fr 1.4fr 1.4fr .8fr .8fr',fontSize:13.5}}><div style={{fontWeight:700}}>Smoke Test Branch</div><div className="kpi-foot">Smoke Branch Manager</div><div className="kpi-foot">14 users · 6 agents</div><div><span className="risk risk--ok">Active</span></div><div style={{display:'flex',gap:6}}><button className="nudge-btn" style={{padding:'5px 10px'}}>Edit</button></div></div>
        </div>
      </div>
    </div>
  );
}

// ---------- ADMIN: Users ----------
function AdminUsers() {
  const users = [['Smoke Agent','kelsean@…','Agent'],['Anika Ramdeen','anika@…','Agent'],['Smoke Branch Manager','branch@…','Branch Manager'],['Smoke Roster Four','—','Agent'],['Smoke Sales Manager','kyron@…','Sales Manager'],['Devon Charles','devon@…','Agent']];
  return (
    <div className="page">
      <div className="card-head"><Eyebrow tone="faint">User roster — 14 users</Eyebrow><div style={{display:'flex',gap:8}}><Btn kind="ghost" size="sm" icon="users">Bulk import</Btn><Btn kind="primary" size="sm" icon="plus">Add user</Btn></div></div>
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div className="sheet-head" style={{gridTemplateColumns:'2fr 1.6fr 1.2fr 1fr .8fr'}}>{['Name','Email','Role','Joined','Actions'].map(c=><div key={c} className="sheet-col">{c}</div>)}</div>
        {users.map((u,i)=><div key={i} className="sheet-row" style={{gridTemplateColumns:'2fr 1.6fr 1.2fr 1fr .8fr',fontSize:13.5,alignItems:'center'}}><div style={{display:'flex',gap:10,alignItems:'center'}}><div className="ava">{u[0].split(' ').map(x=>x[0]).slice(0,2).join('')}</div><b>{u[0]}</b></div><div className="kpi-foot">{u[1]}</div><div>{u[2]}</div><div className="kpi-foot">1{7+ (i%3)}-06-2026</div><div className="row-acts"><button className="row-act" aria-label={'Edit '+u[0]}><Icon name="doc" size={14}/></button><button className="row-act" aria-label={'Reset '+u[0]}><Icon name="refresh" size={14}/></button></div></div>)}
      </div>
    </div>
  );
}

// ---------- ADMIN: Config ----------
function AdminConfig() {
  const cfg = [['Company min · per agent',ttd(200000)+' / yr','All personal commitments meet this floor'],['Currency','TTD ($)','Trinidad & Tobago Dollar'],['Fiscal year','Jan — Dec','Calendar year alignment'],['Persistency floor','90%','Agents below trigger manager review'],['Week starts','Sunday','Reports submitted Sun — Sat'],['Working days','5 days','Mon — Fri'],['Self-registration','Disabled','Managers create all accounts'],['Policy plans','0 active','No pending items']];
  return (
    <div className="page">
      <div className="card-head"><div><span style={{fontWeight:800,fontFamily:"'Cabinet Grotesk',sans-serif",fontSize:17}}>Company configuration</span><div className="kpi-foot">Tenant-wide defaults · annual API minimum and weekly floors are editable.</div></div><Btn kind="ghost" size="sm" icon="doc">Edit config</Btn></div>
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>{cfg.map(([l,v,f])=><div key={l} className="kpi" style={{gridColumn:'span 1'}}><Eyebrow tone="faint">{l}</Eyebrow><div style={{fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:800,fontSize:20,margin:'6px 0 3px'}}>{v}</div><div className="kpi-foot">{f}</div></div>)}</div>
      <div className="card"><div className="card-head"><div><Eyebrow tone="faint">Manager activity standards</Eyebrow><div className="kpi-foot" style={{marginTop:2}}>Weekly targets per manager role — shown as actual / target on their WAR.</div></div><Btn kind="ghost" size="sm">Edit standards</Btn></div>
        {['Unit Managers','Branch Managers','Sales Managers'].map(r=><div key={r} className="rev-row"><b>{r}</b><span className="kpi-foot">No standards set</span></div>)}
      </div>
    </div>
  );
}

Object.assign(window, { TeamDashboard, TeamPerformance, SettlementsScreen, ReconciliationScreen, TeamWarsScreen, TeamGameplansScreen, KioskScreen, AgentOfMonthScreen, MyWarScreen, MgrProductionScreen, CampaignsScreen, AdminBranches, AdminUsers, AdminConfig });

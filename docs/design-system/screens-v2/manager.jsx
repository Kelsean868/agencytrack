// ============================================================
// manager.jsx — extends the Nexus system to manager/admin
// + previously weak surfaces (fixes 4.3, 4.4, UX-001, keep-list)
// ============================================================

const MANAGER_NAV = [
  { g:'My Production', items:[['doc','Weekly Report'],['bolt','Commission'],['book','Policy Ledger']] },
  { g:'My Team', items:[['home','Team Dashboard'],['calendar','Master Sheet'],['check','Compliance'],['book','Financing']] },
  { g:'Present', items:[['present','Meeting Mode'],['refresh','Kiosk']] },
];
const ADMIN_NAV = [
  { g:'Company', items:[['home','Dashboard'],['book','Branches'],['users','All Users']] },
  { g:'Configuration', items:[['doc','Company Config'],['bolt','Campaigns']] },
];

function RoleSidebar({ sections, active, onNav, role, collapsed, onToggle, onReorder }) {
  return (
    <aside className={'side' + (collapsed ? ' is-collapsed' : '')}>
      <div className="side-brand">
        <div className="side-mark"><Icon name="chart" size={16} /></div>
        <span>AgencyTrack</span>
      </div>
      <div className="side-role">{role}</div>
      <SideNavSections sections={sections} active={active} onNav={onNav} onReorder={onReorder} />
      <button className="side-collapse" onClick={onToggle} title="Collapse sidebar">
        <Icon name="chevron" size={16} style={{transform: collapsed ? '' : 'rotate(180deg)'}} /><span>Collapse</span>
      </button>
    </aside>
  );
}

// ---------- ADMIN DASHBOARD (fix 4.4: hero identity + warm role bars) ----------
function AdminDashboard() {
  const roles = [
    { name:'Agents', n:6, c:'var(--primary)' },
    { name:'Unit Managers', n:2, c:'oklch(0.58 0.09 195)' },
    { name:'Branch Managers', n:2, c:'oklch(0.56 0.09 165)' },
    { name:'Sales Managers', n:2, c:'oklch(0.62 0.09 90)' },
    { name:'Tenant Admins', n:2, c:'oklch(0.54 0.08 220)' },
  ];
  const total = 14, maxRole = 6;
  return (
    <div className="page">
      <div className="hero">
        <div className="hero-main">
          <Eyebrow tone="onhero">Total API · YTD · all branches</Eyebrow>
          <div className="hero-num">{ttd(733110)}</div>
          <div className="hero-meta">Across 1 active branch · 14 users · fiscal Jan–Dec 2026</div>
          <div className="hero-bar"><div className="hero-bar-fill" style={{width:'61%'}}/></div>
          <div className="hero-scale"><span>Tenant floor</span><span>61% of company goal</span><span>Goal</span></div>
        </div>
        <div className="hero-side">
          <Eyebrow tone="onhero">Health</Eyebrow>
          <Ring value={100} size={72} stroke={7} label="14/14" sub="active" color="var(--hero-ink)" track="rgba(255,255,255,.18)" />
          <div className="hero-side-txt" style={{fontSize:13}}>0 inactive users</div>
        </div>
      </div>

      <div className="kpi-grid">
        {[['Active Users','14 / 14','0 inactive','users'],['Active Branches','1','Smoke Test Branch','book'],['Policy Plans','0','no pending items','doc']].map(([e,v,f,ic])=>(
          <div key={e} className="kpi" style={{gridColumn:'span 1'}}>
            <div className="card-head" style={{marginBottom:6}}><Eyebrow tone="faint">{e}</Eyebrow><span className="kpi-ic"><Icon name={ic} size={16}/></span></div>
            <div className="kpi-big" style={{fontSize:34}}>{v}</div>
            <div className="kpi-foot" style={{marginTop:4}}>{f}</div>
          </div>
        ))}
        <div className="kpi" style={{gridColumn:'span 1'}}>
          <Eyebrow tone="faint">Fiscal Year</Eyebrow>
          <div className="kpi-big" style={{fontSize:26,marginTop:8}}>Jan — Dec</div>
          <div className="kpi-foot" style={{marginTop:4}}>calendar aligned</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-head"><Eyebrow tone="faint">Users by role</Eyebrow><span className="kpi-foot">Total: {total}</span></div>
          <div className="role-list">
            {roles.map(r=>(
              <div key={r.name} className="role-row">
                <div className="role-top"><span>{r.name}</span><b>{r.n}</b></div>
                <div className="role-bar"><div className="role-fill" style={{width:(r.n/maxRole*100)+'%',background:r.c}}/></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><Eyebrow tone="faint">Branch overview</Eyebrow><span className="kpi-foot">agent assignment</span></div>
          <div className="branch-item">
            <div><div style={{fontWeight:700,fontSize:15}}>Smoke Test Branch</div><div className="kpi-foot" style={{marginTop:2}}>Smoke Branch Manager</div></div>
            <span className="badge">6 agents</span>
          </div>
          <div className="branch-item is-add"><Icon name="plus" size={16}/> Add branch</div>
        </div>
      </div>
    </div>
  );
}

// ---------- COMPLIANCE (keep-list: operational excellence, in-system) ----------
function ComplianceScreen() {
  const agents = [
    ['Anika Ramdeen','never filed'],['Devon Charles','last filed 21-06-2026'],
    ['Priya Maharaj','Smoke Unit · last filed 10-05-2026'],['Kwame Joseph','Smoke Unit · last filed 10-05-2026'],
    ['ReNelle Baptiste','Smoke Unit · last filed 10-05-2026'],['Marlon Ali','Smoke Unit · last filed 10-05-2026'],
  ];
  return (
    <div className="page">
      <div className="seg"><button className="is-on">Filing <span className="seg-badge">8 not in</span></button><button>Plan adoption <span className="seg-badge muted">6 no plan</span></button></div>
      <div className="hero hero--flat">
        <div className="hero-main" style={{gridColumn:'1/-1'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
            <Eyebrow tone="onhero">Filing reality · this week</Eyebrow>
            <span className="eyebrow eyebrow--onhero">Sun 23:59 AST deadline</span>
          </div>
          <div className="filing-bar"><div className="filing-fill" style={{width:'0%'}}/></div>
          <div className="filing-stats">
            {[['Filed','0 / 8 · 0%','sq'],['On-time','0','ok'],['Late','0','warn'],['Not in','8','bad']].map(([l,v,k])=>(
              <div key={l} className="file-stat"><span className={'file-key '+k}/><div><div className="eyebrow eyebrow--onhero">{l}</div><div className="file-val">{v}</div></div></div>
            ))}
          </div>
        </div>
      </div>
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div className="nudge-head"><div className="sec-title" style={{color:'var(--bad)'}}><Icon name="bell" size={16}/> Haven't filed · 8 agents</div><Btn kind="primary" size="sm" icon="bell">Nudge all 8</Btn></div>
        {agents.map(([n,s])=>(
          <div key={n} className="nudge-row">
            <div className="ava">{n.split(' ').map(x=>x[0]).join('')}</div>
            <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{n}</div><div className="kpi-foot">{s}</div></div>
            <button className="nudge-btn"><Icon name="bell" size={14}/> Nudge</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- MASTER SHEET (fix UX-001: considered empty state + ghost) ----------
function MasterSheetScreen() {
  const cols = ['Agent','Status','Prosp. touches','Reached','Tel att.','F2F','Contacts','Qual. app.','FFI sched.'];
  const stress = useStress();
  const NAMES = ['Anika Ramdeen','Devon Charles','Kwame Joseph','Priya Maharaj','Marcus Alleyne','Shivani Persad','Terrence Baptiste','Ayesha Khan','Rohan Boodram','Nia Providence','Kavita Sammy','Darius Mohammed','Leah Guerra','Omar Hosein','Simone Achong','Rajiv Balgobin'];
  const agents = useMemo(() => {
    const n = stress ? 60 : 12;
    const rows = [];
    for (let i = 0; i < n; i++) {
      const seed = ((i * 9301 + 49297) % 233280) / 233280;
      const base = NAMES[i % NAMES.length];
      const name = i < NAMES.length ? base : base + ' ' + String.fromCharCode(65 + (i % 26));
      const submitted = (i * 7) % 5 !== 0;
      rows.push({
        name, submitted,
        vals: [Math.round(12 + seed * 44), Math.round(7 + seed * 26), Math.round(3 + seed * 16), Math.round(1 + seed * 9), Math.round(4 + seed * 21), Math.round(seed * 11), Math.round(seed * 7)],
      });
    }
    return rows;
  }, [stress]);
  const submitted = agents.filter(a => a.submitted).length;
  const initials = n => n.split(' ').map(x => x[0]).join('').slice(0, 2);
  return (
    <div className="page">
      <div className="sheet-toolbar">
        <div className="sel">This week — 28-06-2026 <Icon name="chevron" size={14} style={{ transform: 'rotate(90deg)' }} /></div>
        <div className="search" style={{ flex: 1, maxWidth: 'none' }}><Icon name="target" size={15} /><span>Search {agents.length} agents…</span></div>
        <Btn kind="ghost" size="sm" icon="doc">Export CSV</Btn>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="sheet-scroll sheet-scroll--live" role="region" aria-label="Master sheet, scrollable">
          <div className="sheet-head sheet-wide">{cols.map((c, i) => <div key={c} className={'sheet-col' + (i === 0 ? ' sheet-col--stick' : '')}>{c}</div>)}</div>
          {agents.map((a, ri) => (
            <div key={ri} className="sheet-row sheet-wide">
              <div className="sheet-col sheet-col--stick sheet-agent"><span className="ava ava--xs">{initials(a.name)}</span>{a.name}</div>
              <div className="sheet-col"><span className={'pill-status ' + (a.submitted ? 'is-in' : 'is-out')}>{a.submitted ? 'Submitted' : 'Draft'}</span></div>
              {a.vals.map((v, ci) => <div key={ci} className="sheet-col sheet-num">{v}</div>)}
            </div>
          ))}
        </div>
        <div className="sheet-foot">{agents.length} agents · {submitted} submitted · {agents.length - submitted} draft{stress ? ' · stress load' : ''}</div>
      </div>
    </div>
  );
}

// ---------- FINANCING (fix 4.3: context landing, not empty dropdown) ----------
function FinancingScreen() {
  const tabs = ['Terms','Monthly Ledger','Proration','Take-Home','Reconciliation','Risk','Escalations'];
  const [tab,setTab] = useState(0);
  const agents = [
    { n:'Anika Ramdeen', bal:42000, take:78, risk:'ok', next:'05-07-2026' },
    { n:'Devon Charles', bal:88500, take:61, risk:'watch', next:'05-07-2026' },
    { n:'Kwame Joseph', bal:126000, take:44, risk:'high', next:'05-07-2026' },
  ];
  return (
    <div className="page">
      <div className="fin-tabs">{tabs.map((t,i)=><button key={t} className={'fin-tab'+(i===tab?' is-on':'')} onClick={()=>setTab(i)}>{t}</button>)}</div>
      <div className="fin-summary">
        <div className="card fin-stat"><Eyebrow tone="faint">On financing</Eyebrow><div className="kpi-big" style={{fontSize:34}}>3<span className="kpi-unit">of 6</span></div><div className="kpi-foot">agents this branch</div></div>
        <div className="card fin-stat"><Eyebrow tone="faint">Outstanding</Eyebrow><div className="kpi-big" style={{fontSize:34}}>{ttd(256500)}</div><div className="kpi-foot">total branch balance</div></div>
        <div className="card fin-stat"><Eyebrow tone="faint">At risk</Eyebrow><div className="kpi-big" style={{fontSize:34,color:'var(--bad)'}}>1</div><div className="kpi-foot">below take-home floor</div></div>
      </div>
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div className="nudge-head"><Eyebrow tone="faint">Select an agent to view {tabs[tab].toLowerCase()}</Eyebrow><span className="kpi-foot">2026 agreements</span></div>
        {agents.map(a=>(
          <button key={a.n} className="fin-item">
            <div className="ava">{a.n.split(' ').map(x=>x[0]).join('')}</div>
            <div style={{flex:1,textAlign:'left'}}><div style={{fontWeight:700,fontSize:14}}>{a.n}</div><div className="kpi-foot">Balance {ttd(a.bal)} · next debit {a.next}</div></div>
            <div className="fin-take"><div className="eyebrow eyebrow--faint">Take-home</div><div className="fin-take-num">{a.take}%</div></div>
            <span className={'risk risk--'+a.risk}>{a.risk==='ok'?'On track':a.risk==='watch'?'Watch':'At risk'}</span>
            <Icon name="chevron" size={18} style={{color:'var(--ink-faint)'}}/>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- AWARDS (agent high-water, re-expressed in system, dark-first) ----------
function AwardsScreen() {
  const almost = [
    ['Persistency Award — Silver','Silver Trophy + Bonus',100],['Rookie of the Year','Rookie Trophy',100],
    ['New Business Advisor','New Advisor Trophy',100],['Bronze Club — Level 1','Bronze Club + Trip',97],
    ['Silver Club','Silver Club + Premium Trip',82],['Gold Club','Gold Club + Luxury Trip',82],
  ];
  return (
    <div className="page">
      <div className="hero" style={{gridTemplateColumns:'auto 1fr'}}>
        <Ring value={100} size={96} stroke={9} label="100%" color="var(--gold)" track="rgba(255,255,255,.16)"/>
        <div className="hero-main">
          <Eyebrow tone="gold">Almost there</Eyebrow>
          <div className="hero-side-txt" style={{fontSize:26,fontFamily:"'Cabinet Grotesk',sans-serif",fontWeight:800,margin:'6px 0'}}>Persistency Award — Silver</div>
          <div className="hero-meta">Silver Trophy + Bonus · gap {ttd(0)} to qualify</div>
        </div>
      </div>
      <div className="aw-tabs">{['All','Monthly','Quarterly','Annual','Club'].map((t,i)=><button key={t} className={i===0?'is-on':''}>{t}</button>)}<span className="kpi-foot" style={{marginLeft:'auto'}}>16 awards tracked</span></div>
      <div><Eyebrow tone="gold" style={{marginBottom:10}}>✓ Qualified · 1</Eyebrow>
        <div className="aw-card aw-card--gold">
          <div className="card-head"><div style={{fontWeight:800,fontFamily:"'Cabinet Grotesk',sans-serif",fontSize:17}}>MDRT</div><span className="badge" style={{background:'var(--gold-soft)',color:'var(--gold)'}}>Qualified</span></div>
          <div className="kpi-foot">MDRT Membership + Recognition</div>
          <div className="aw-num" style={{color:'var(--gold)'}}>100%</div>
          <div className="aw-bar"><div style={{width:'100%',background:'var(--gold)'}}/></div>
          <div className="kpi-foot" style={{marginTop:6}}>{ttd(532777)} of {ttd(500000)}</div>
        </div>
      </div>
      <div><Eyebrow tone="primary" style={{marginBottom:10}}>★ Almost there · 70%+ · 6</Eyebrow>
        <div className="aw-grid">
          {almost.map(([t,s,p])=>(
            <div key={t} className="aw-card">
              <div className="card-head"><div style={{fontWeight:800,fontFamily:"'Cabinet Grotesk',sans-serif",fontSize:15}}>{t}</div><span className="aw-pct">{p}%</span></div>
              <div className="kpi-foot">{s}</div>
              <div className="aw-bar"><div style={{width:p+'%',background:p>=100?'var(--gold)':'var(--primary)'}}/></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RoleSidebar, MANAGER_NAV, ADMIN_NAV, AdminDashboard, ComplianceScreen, MasterSheetScreen, FinancingScreen, AwardsScreen });

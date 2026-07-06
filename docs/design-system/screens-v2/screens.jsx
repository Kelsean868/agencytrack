// ============================================================
// screens.jsx — AgencyTrack screens with all audit fixes applied
// ============================================================

// ---------- LOGIN (fix cluster 1: identity + dark + intentional bg) ----------
function LoginScreen() {
  const [show, setShow] = useState(false);
  // Intentional, asymmetric brand motif — NOT a uniform icon grid.
  const motif = [
    { n: 'shield', x: 8, y: 16, s: 210, o: 0.05, rot: -8 },
    { n: 'chart', x: 74, y: 60, s: 320, o: 0.04, rot: 6 },
    { n: 'target', x: 60, y: 8, s: 120, o: 0.06, rot: 0 },
    { n: 'trophy', x: 20, y: 74, s: 150, o: 0.05, rot: -4 },
  ];
  return (
    <div className="login">
      <div className="login-motif" aria-hidden="true">
        {motif.map((m, i) => (
          <div key={i} style={{ position: 'absolute', left: m.x + '%', top: m.y + '%', opacity: m.o, transform: `rotate(${m.rot}deg)`, color: 'var(--primary)' }}>
            <Icon name={m.n} size={m.s} />
          </div>
        ))}
      </div>
      <div className="login-card">
        <div className="login-mark"><Icon name="chart" size={26} /></div>
        <Eyebrow tone="primary" style={{ marginTop: 18, textAlign: 'center' }}>Sales Portal · Tatil Life</Eyebrow>
        <h1 className="login-wordmark">AgencyTrack</h1>
        <label className="field-label">Email address</label>
        <input className="input" placeholder="you@youremail.com" defaultValue="kelsean@gmail.com" />
        <label className="field-label" style={{ marginTop: 14 }}>Password</label>
        <div className="input-wrap">
          <input className="input" type={show ? 'text' : 'password'} defaultValue="••••••••" />
          <button className="input-affix" onClick={() => setShow(s => !s)} aria-label="Toggle password">
            <Icon name={show ? 'moon' : 'sun'} size={16} />
          </button>
        </div>
        <Btn kind="primary" size="lg" style={{ width: '100%', marginTop: 20 }}>Sign in</Btn>
        <button className="link-btn">Forgot password?</button>
      </div>
    </div>
  );
}

// ---------- Shared app chrome (nav + topbar) ----------
const AGENT_NAV = [
  { g: 'Today', items: [['home','Dashboard'],['calendar','Daily Log'],['doc','Weekly Report'],['refresh','History']] },
  { g: 'Planning', items: [['chart','Game Plan'],['target','Goals']] },
  { g: 'Tools', items: [['bolt','Commission'],['refresh','Persistency'],['book','Policy Ledger'],['trophy','Awards']] },
];
function Sidebar({ active, onNav, sections, collapsed, onToggle, onReorder }) {
  return (
    <aside className={'side' + (collapsed ? ' is-collapsed' : '')}>
      <div className="side-brand">
        <div className="side-mark"><Icon name="chart" size={16} /></div>
        <span>AgencyTrack</span>
      </div>
      <SideNavSections sections={sections || AGENT_NAV} active={active} onNav={onNav} onReorder={onReorder} />
      <button className="side-collapse" onClick={onToggle} title="Collapse sidebar">
        <Icon name="chevron" size={16} style={{transform: collapsed ? '' : 'rotate(180deg)'}} /><span>Collapse</span>
      </button>
    </aside>
  );
}
function Topbar({ title, sub, theme, setTheme, onCmd }) {
  return (
    <div className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        <div className="topbar-sub">{sub}</div>
      </div>
      <div className="topbar-right">
        <button className="search" onClick={() => onCmd && onCmd('search')}><Icon name="target" size={15} /><span>Search or jump to…</span><kbd className="search-kbd">/</kbd></button>
        <button className="quick-create" onClick={() => onCmd && onCmd('create')} title="Quick create" aria-label="Quick create"><Icon name="plus" size={17} /></button>
        <button className="icon-btn" aria-label="Notifications, 4 unread"><Icon name="bell" size={18} /><span className="dot" aria-hidden="true">4</span></button>
        <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18} />
        </button>
      </div>
    </div>
  );
}

// ---------- AGENT DASHBOARD (fix cluster 2 + foundations) ----------
function DashboardScreen({ goTo }) {
  const ytd = 532777, goal = 1200000, pct = Math.round(ytd / goal * 100);
  const floor = 250000, mdrt = 688800;
  // Unified viz: every KPI uses a ring OR a labelled delta — one language.
  const stats = [
    { key: 'Activity', ring: 62, label: '62%', foot: 'of weekly pace', delta: ['up','trending'] },
    { key: 'Standard', ring: 0, label: '0/10', foot: 'standards met', delta: ['flat','no change'] },
    { key: 'Persistency', ring: 0, label: '—', foot: 'no data yet', delta: null },
    { key: 'Awards', ring: 100, label: '100%', foot: 'Persistency · Silver', gold: true, delta: ['up','nearest'] },
  ];
  return (
    <div className="page">
      {/* Alert banner — amber lifts correctly in dark */}
      <div className="alert">
        <div className="alert-ic"><Icon name="bell" size={16} /></div>
        <div className="alert-body">
          <div className="alert-title">You haven't logged today yet</div>
          <div className="alert-sub">30-second capture · rolls into your weekly report Sunday</div>
        </div>
        <Btn kind="amber" iconAfter="arrow" onClick={() => goTo('capture')}>Log today</Btn>
      </div>

      {/* Signature hero (kept — the identity anchor) */}
      <div className="hero">
        <div className="hero-main">
          <Eyebrow tone="onhero">YTD · Settled API</Eyebrow>
          <div className="hero-num">TTD <CountUp value={ytd}/></div>
          <div className="hero-meta">{pct}% of {ttd(goal)} goal · 26 weeks to year-end</div>
          <div className="hero-bar">
            <div className="hero-bar-fill" style={{ width: pct + '%' }} />
            <div className="hero-mark" style={{ left: (floor/goal*100) + '%' }} title="Company floor" />
            <div className="hero-mark hero-mark--mdrt" style={{ left: (mdrt/goal*100) + '%' }} title="MDRT" />
          </div>
          <div className="hero-scale"><span>Floor {ttd(floor)}</span><span>MDRT {ttd(mdrt)}</span><span>Goal</span></div>
        </div>
        <div className="hero-side">
          <Eyebrow tone="onhero">Next step</Eyebrow>
          <div className="hero-side-txt">Keep your streak going — submit this week's report.</div>
          <Btn kind="ghost-hero" iconAfter="arrow" onClick={() => goTo('celebration')}>Submit weekly report</Btn>
        </div>
      </div>

      {/* KPI row WITH RHYTHM: 2 feature cards + 4 stat cards, one viz language */}
      <div className="kpi-grid">
        <div className="kpi kpi--feature">
          <Eyebrow tone="faint">Action</Eyebrow>
          <div className="kpi-feature-row">
            <div><div className="kpi-big">2</div><div className="kpi-foot">things need you today</div></div>
            <Ring value={40} size={64} label="2" sub="due" color="var(--amber)" />
          </div>
          <div className="kpi-actions">
            <span className="chiplet"><Icon name="doc" size={13}/> Log activity</span>
            <span className="chiplet"><Icon name="check" size={13}/> Confirm 1 policy</span>
          </div>
        </div>
        <div className="kpi kpi--feature">
          <Eyebrow tone="faint">Streak</Eyebrow>
          <div className="kpi-feature-row">
            <div><div className="kpi-big">1<span className="kpi-unit">wk</span></div><div className="kpi-foot">personal best · 5 weeks</div></div>
            <div className="streak-flames">{[1,1,1,0,0].map((f,i)=><Icon key={i} name="flame" size={20} style={{opacity: f?1:0.22, color: f?'var(--amber)':'var(--ink-faint)'}}/>)}</div>
          </div>
          <div className="kpi-foot" style={{marginTop:10}}>Submit by Sunday to extend →</div>
        </div>
        {stats.map(s => (
          <div key={s.key} className="kpi">
            <Eyebrow tone="faint">{s.key}</Eyebrow>
            <div className="kpi-stat-row">
              <Ring value={s.ring} size={46} label={s.label} color={s.gold ? 'var(--gold)' : 'var(--primary)'} />
              <div className="kpi-stat-meta">
                <div className="kpi-foot">{s.foot}</div>
                {s.delta && <Delta dir={s.delta[0]}>{s.delta[1]}</Delta>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Points + Recent, width-constrained & filled (fix: dead whitespace) */}
      <div className="two-col">
        <div className="card">
          <div className="card-head"><Eyebrow tone="faint">My Points</Eyebrow><span className="badge">Associate</span></div>
          <div className="points-row">
            <div className="points-num">1,327</div>
            <div className="points-next"><div className="kpi-foot">149 pts to <b>Pro</b></div><div className="mini-bar"><div style={{width:'82%'}}/></div></div>
          </div>
          <div className="badge-row">
            {['First Steps','Closer','Big Week'].map(b => <span key={b} className="award-chip"><Icon name="trophy" size={12}/> {b}</span>)}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><Eyebrow tone="faint">Recent</Eyebrow><span className="kpi-foot">last 7 days</span></div>
          <ul className="feed">
            <li><span className="feed-dot ok"/><div><b>Weekly report submitted</b><div className="kpi-foot">TTD 7,777 API · 04-07-2026</div></div></li>
            <li><span className="feed-dot"/><div><b>3 activities logged</b><div className="kpi-foot">Prospecting · 02-07-2026</div></div></li>
            <li><span className="feed-dot gold"/><div><b>Badge earned — Big Week</b><div className="kpi-foot">30-06-2026</div></div></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------- DAILY CAPTURE (fix cluster 3: day-strip + live rail) ----------
function CaptureScreen() {
  const days = [ ['S',28],['M',29],['T',30],['W',1],['T',2],['F',3],['S',4] ];
  const activeIdx = 6;
  const fields = ['Prospecting letters sent','Seminars conducted','Dials (total calls)','Tel contacts (reached)','F2F attempts','Qualified approaches','New names added','Old names worked'];
  const [vals, setVals] = useState({0:2,1:2,2:2});
  const set = (i, d) => setVals(v => ({ ...v, [i]: Math.max(0, (v[i]||0) + d) }));
  const total = Object.values(vals).reduce((a,b)=>a+b,0);
  const pts = total * 4;
  const filled = Object.values(vals).filter(v=>v>0).length;
  const weeklyGoal = 120, weekSoFar = 56 + pts;
  return (
    <div className="page">
      <div className="cap-head">
        <div>
          <div className="topbar-title">Log Today <span className="pill">Daily</span> <span className="flame-inline"><Icon name="flame" size={14}/>1</span></div>
          <Eyebrow tone="faint" style={{marginTop:6}}>Saturday · 04-07-2026 · WK 27</Eyebrow>
        </div>
      </div>
      {/* Day strip — 7 equal cells, never wraps (fix: BUG-103) */}
      <div className="daystrip">
        {days.map(([d,n],i)=>(
          <button key={i} className={'day' + (i===activeIdx?' is-today':'') + (i<activeIdx?' is-past':'')}>
            <span className="day-d">{d}</span><span className="day-n">{n}</span>
            {i<activeIdx && <span className="day-dot"/>}
          </button>
        ))}
      </div>

      <div className="cap-body">
        {/* stepper column */}
        <div className="card cap-card">
          <div className="card-head"><div className="sec-title"><span className="sec-dot"/> Prospecting &amp; outreach</div><span className="kpi-foot">{filled}/8</span></div>
          {fields.map((f,i)=>(
            <div key={i} className={'stepper' + ((vals[i]||0)>0?' has-val':'')}>
              <span className="stepper-label">{f}</span>
              <div className="stepper-ctrl">
                <button className="step-btn" onClick={()=>set(i,-1)} aria-label="decrease"><Icon name="minus" size={16}/></button>
                <span className="step-val">{vals[i]||0}</span>
                <button className="step-btn" onClick={()=>set(i,1)} aria-label="increase"><Icon name="plus" size={16}/></button>
              </div>
            </div>
          ))}
        </div>
        {/* LIVE summary rail — turns dead space into function (fix: whitespace) */}
        <aside className="cap-rail">
          <Eyebrow tone="faint">Today so far <span className="live-dot">LIVE</span></Eyebrow>
          <div className="rail-num">{pts}<span className="kpi-unit">pts</span></div>
          <div className={'status-pill ' + (pts>=40?'ok':'warn')}>{pts>=40?'On pace':'Behind'}</div>
          <div className="rail-bar"><div className="rail-bar-fill" style={{width: Math.min(100, weekSoFar/weeklyGoal*100)+'%'}}/></div>
          <div className="kpi-foot" style={{marginTop:8}}>{weekSoFar} / {weeklyGoal} pts this week</div>
          <div className="rail-mini">
            <div><Eyebrow tone="faint">Activities</Eyebrow><div className="rail-mini-num">{total}</div></div>
            <div><Eyebrow tone="faint">Categories</Eyebrow><div className="rail-mini-num">{filled}</div></div>
          </div>
          <div className="rail-note"><Icon name="refresh" size={13}/> Rolls into your Week 27 report</div>
        </aside>
      </div>
      <div className="cap-foot">
        <Btn kind="primary" size="lg" iconAfter="arrow" style={{minWidth:340}}>Save today · {pts} pts</Btn>
      </div>
    </div>
  );
}

// ---------- CELEBRATION (fix 1.4: elevated reward moment, gold) ----------
function CelebrationScreen({ goTo }) {
  const [lit, setLit] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLit(true), 80); return () => clearTimeout(t); }, []);
  return (
    <div className={'celebrate' + (lit ? ' is-lit' : '')}>
      <div className="celebrate-rays" aria-hidden="true" />
      <Eyebrow tone="gold" style={{textAlign:'center'}}>Report submitted · WK 26</Eyebrow>
      <div className="celebrate-badge"><Icon name="trophy" size={40} /></div>
      <div className="celebrate-ship">You shipped</div>
      <div className="celebrate-num">{ttd(7777)}</div>
      <div className="celebrate-sub">Production API · 2 apps · week of 28-06-2026</div>
      <div className="celebrate-pts">
        <div className="celebrate-pts-head"><Eyebrow tone="primary">This week</Eyebrow><div className="celebrate-pts-num">+124 pts</div></div>
        <div className="celebrate-track"><div className="celebrate-track-fill" style={{width: lit ? '76%' : '0%'}} /></div>
        <div className="celebrate-pts-foot"><span>1,327</span><span>149 pts to <b>Pro</b></span></div>
      </div>
      <div className="celebrate-note">Your week is now in the team leaderboard pool · standings refresh hourly.</div>
      <Btn kind="primary" size="lg" iconAfter="arrow" onClick={() => goTo('dashboard')} style={{marginTop:22}}>Back to dashboard</Btn>
    </div>
  );
}

Object.assign(window, { LoginScreen, DashboardScreen, CaptureScreen, CelebrationScreen, Sidebar, Topbar });

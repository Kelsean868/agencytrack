// ============================================================
// nav.jsx — Zoho-borrowed navigation & cognitive-load layer
// CommandPalette (search + Quick Create) + progressive-disclosure record
// ============================================================

// ---------- COMMAND PALETTE (functional search + Quick Create) ----------
function CommandPalette({ open, mode, screens, roles, onGo, onClose }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const trapRef = useFocusTrap(open);
  useEffect(() => {
    if (open) { setQ(''); setTimeout(() => inputRef.current && inputRef.current.focus(), 30); }
  }, [open, mode]);
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;

  const roleSet = roles && roles.length ? roles : ['agent'];
  const quick = [
    ['plus','Log today\u2019s activity','capture', ['agent']],
    ['book','New policy','policyrecord', ['agent']],
    ['doc','Start weekly report','selectweek', ['agent']],
    ['bolt','Open commission playground','commission', ['agent']],
    ['book','Enter a settlement','settlements', ['manager']],
    ['present','Launch meeting mode','meeting', ['manager']],
    ['home','Add a branch','branches', ['admin']],
    ['users','Invite a user','users', ['admin']],
  ].filter(x => x[3].some(r => roleSet.includes(r)));
  const ql = q.trim().toLowerCase();
  const results = screens.filter(s => s.shell !== 'bare' && s.label.trim().toLowerCase().includes(ql));
  const quickF = quick.filter(x => x[1].toLowerCase().includes(ql));
  const showCreate = mode === 'create' || ql;

  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd" ref={trapRef} role="dialog" aria-modal="true" aria-label={mode === 'create' ? 'Quick create' : 'Search and jump to'} onClick={e => e.stopPropagation()}>
        <div className="cmd-input-row">
          <Icon name="target" size={18} style={{ color: 'var(--ink-faint)' }} />
          <input ref={inputRef} className="cmd-input" value={q} onChange={e => setQ(e.target.value)}
            placeholder={mode === 'create' ? 'What do you want to create?' : 'Search screens, agents, policies\u2026'} />
          <kbd className="cmd-esc">ESC</kbd>
        </div>
        <div className="cmd-body">
          {showCreate && quickF.length > 0 && (
            <div className="cmd-sec">
              <Eyebrow tone="faint">Quick create</Eyebrow>
              {quickF.map(([ic, label, id]) => (
                <button key={label} className="cmd-item" onClick={() => onGo(id)}>
                  <span className="cmd-ic cmd-ic--create"><Icon name={ic} size={15} /></span>
                  <span>{label}</span><Icon name="arrow" size={14} style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }} />
                </button>
              ))}
            </div>
          )}
          {mode !== 'create' && (
            <div className="cmd-sec">
              <Eyebrow tone="faint">{ql ? 'Screens' : 'Jump to'}</Eyebrow>
              {results.length ? results.slice(0, 8).map(s => (
                <button key={s.id} className="cmd-item" onClick={() => onGo(s.id)}>
                  <span className="cmd-ic"><Icon name={s.ic} size={15} /></span>
                  <span>{s.label.trim()}</span>
                  <span className="cmd-grp">{s.grp}</span>
                </button>
              )) : <div className="cmd-empty">No matches for “{q}”</div>}
            </div>
          )}
        </div>
        <div className="cmd-foot"><span>↑↓ to move</span><span>↵ to open</span><span>Global search &amp; create — from anywhere</span></div>
      </div>
    </div>
  );
}

// ---------- PROGRESSIVE-DISCLOSURE RECORD (Business Card + tabs + Smart View) ----------
function PolicyRecord() {
  const [tab, setTab] = useState('overview');
  const [smart, setSmart] = useState(true);
  const card = [['Policyholder','Anika Ramdeen'],['Plan','Whole Life · Platinum'],['API','TTD 148,000'],['Status','Issued'],['Renewal','12-03-2027']];
  const actions = [['bolt','Call'],['doc','Email'],['check','Check-in'],['book','Statement']];
  const stages = ['Application','Underwriting','Issued','Settled'];
  const stageAt = 2;
  const detail = [
    ['Policy', [['Policy number','TL-2026-04817'],['Plan','Whole Life · Platinum'],['Annual premium (API)','TTD 148,000'],['Mode','Annual'],['Lives covered','2'],['Rider(s)','']]],
    ['Parties', [['Policyholder','Anika Ramdeen'],['Beneficiary','Devon Ramdeen'],['Agent','Smoke Agent'],['Unit','Central'],['Medical exam','']]],
    ['Dates & money', [['Application date','18-02-2026'],['Issue date','04-03-2026'],['Settlement date',''],['Lumpsum','TTD 14,800'],['Outstanding','']]],
  ];
  const related = [
    ['doc','Note','Client prefers annual billing; follow up before renewal.','02-07-2026'],
    ['bolt','Call','Discussed rider add-on — interested for Q4.','28-06-2026'],
    ['doc','Email','Sent policy schedule + welcome pack.','05-03-2026'],
    ['check','Status','Policy issued by Tatil Life.','04-03-2026'],
    ['book','Application','Submitted with medical waiver.','18-02-2026'],
  ];
  const Field = ([k,v]) => (smart && !v) ? null : (
    <div key={k} className="rec-field"><span className="kpi-foot">{k}</span><b>{v || <span className="rec-empty">—</span>}</b></div>
  );

  return (
    <div className="page" style={{maxWidth:1000}}>
      {/* Top bar */}
      <div className="rec-top">
        <Eyebrow tone="faint">Policy</Eyebrow>
        <div style={{display:'flex',gap:8}}><Btn kind="ghost" size="sm" icon="doc">Edit</Btn><button className="nudge-btn" style={{padding:'8px 11px'}}><Icon name="chevron" size={15} style={{transform:'rotate(90deg)'}}/></button></div>
      </div>
      {/* Header */}
      <div className="rec-header">
        <div className="rec-ava">AR</div>
        <div style={{flex:1}}>
          <div className="rec-title">Anika Ramdeen</div>
          <div className="kpi-foot">Whole Life · Platinum · Tatil Life · Central Unit</div>
        </div>
        <div className="rec-actions">{actions.map(([ic,l])=><button key={l} className="rec-action"><Icon name={ic} size={16}/><span>{l}</span></button>)}</div>
      </div>
      {/* Tabs */}
      <div className="rtabs">{[['overview','Overview'],['details','Details'],['related','Related']].map(([id,l])=>(
        <button key={id} className={'rtab'+(tab===id?' is-on':'')} onClick={()=>setTab(id)}>{l}</button>
      ))}</div>

      {tab==='overview' && <>
        <div className="bcard">
          {card.map(([k,v],i)=><div key={k} className={'bcard-cell'+(i===0?' bcard-cell--lead':'')}><Eyebrow tone="faint">{k}</Eyebrow><div className="bcard-val">{v}</div></div>)}
        </div>
        <div className="card">
          <Eyebrow tone="faint">Policy stage</Eyebrow>
          <div className="blueprint">{stages.map((s,i)=>(
            <div key={s} className={'bp-step'+(i<=stageAt?' is-done':'')+(i===stageAt?' is-current':'')}>
              <div className="bp-node">{i<stageAt?<Icon name="check" size={13}/>:i+1}</div><span>{s}</span>
            </div>
          ))}</div>
        </div>
      </>}

      {tab==='details' && <>
        <div className="rec-smart">
          <label className="smart-toggle"><span className={'switch'+(smart?' on':'')}><span className="knob"/></span> Smart View <span className="kpi-foot">— hide empty fields</span></label>
        </div>
        {detail.map(([sec,rows])=>(
          <div key={sec} className="card"><Eyebrow tone="faint">{sec}</Eyebrow><div className="rec-fields">{rows.map(Field)}</div></div>
        ))}
      </>}

      {tab==='related' && (
        <div className="card">
          <div className="card-head"><Eyebrow tone="faint">Interactions</Eyebrow><span className="kpi-foot">all touchpoints · newest first</span></div>
          <div className="intxn">{related.map(([ic,type,txt,date],i)=>(
            <div key={i} className="intxn-row">
              <div className="intxn-ic"><Icon name={ic} size={14}/></div>
              <div><div style={{fontSize:13.5}}><b>{type}</b> — {txt}</div><div className="kpi-foot" style={{marginTop:2}}>{date}</div></div>
            </div>
          ))}</div>
        </div>
      )}
    </div>
  );
}

// ---------- SELLING MANAGER: one identity, two lenses, one switch ----------
function SellingManagerSidebar({ agentSections, mgrSections, active, lens, onLens, onNav, collapsed, onToggle, onReorder }) {
  const secs = lens === 'team' ? mgrSections : agentSections;
  return (
    <aside className={'side' + (collapsed ? ' is-collapsed' : '')}>
      <div className="side-brand"><div className="side-mark"><Icon name="chart" size={16} /></div><span>AgencyTrack</span></div>
      <div className="side-role">Selling Manager</div>
      <div className="lens-switch">
        <button className={'lens-btn' + (lens === 'book' ? ' is-on' : '')} onClick={() => onLens('book')} title="My Book"><Icon name="home" size={14} /><span>My Book</span></button>
        <button className={'lens-btn' + (lens === 'team' ? ' is-on' : '')} onClick={() => onLens('team')} title="My Team"><Icon name="users" size={14} /><span>My Team</span></button>
      </div>
      <SideNavSections sections={secs} active={active} onNav={onNav} onReorder={onReorder} />
      <button className="side-collapse" onClick={onToggle} title="Collapse sidebar">
        <Icon name="chevron" size={16} style={{ transform: collapsed ? '' : 'rotate(180deg)' }} /><span>Collapse</span>
      </button>
    </aside>
  );
}

Object.assign(window, { CommandPalette, PolicyRecord, SellingManagerSidebar });

// Set-up Wizard — orchestration shell: state, stepper, nav, skip/resume, persistence.

const { useState, useEffect } = React;
const LS_KEY = 'atrack_setup_wizard_v1';
const STEP_LABELS = ['About you', 'Money Needs', 'Game Plan', 'Goals', 'Profile'];
const PHASES = ['About you', 'Your plan', 'Your plan', 'Your plan', 'Finish'];
const OPTIONAL = [false, false, false, false, true];

const DEFAULTS = {
  agentNo: '', dob: '',
  expenses: 18000, savings: 84000, otherIncome: 0,
  apiCommit: 600000, pinnedAward: 'Silver Circle',
  name: '', avatar: 0, nudges: true, sysTheme: false,
};

function loadState() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
}

function WizardApp() {
  const saved = loadState();
  // view controls (not part of the user's saved data, but persisted for convenience)
  const [theme, setTheme] = useState(saved.theme || 'light');
  const [style, setStyle] = useState(saved.style || 'flat');
  const [device, setDevice] = useState(saved.device || 'desktop');
  const [returning, setReturning] = useState(false);
  const [mnView, setMnView] = useState('condensed');
  // -1 welcome · 0..4 steps · 5 completion · 6 home
  const [idx, setIdx] = useState(typeof saved.idx === 'number' ? saved.idx : -1);
  const [data, setData] = useState({ ...DEFAULTS, ...(saved.data || {}) });
  const [furthest, setFurthest] = useState(saved.furthest || 0);

  useEffect(() => {
    const persist = { idx, data, furthest, theme, device, style };
    try { localStorage.setItem(LS_KEY, JSON.stringify(persist)); } catch (e) {}
  }, [idx, data, furthest, theme, device, style]);

  const set = (patch) => setData((d) => ({ ...d, ...patch }));
  const calc = {
    needAnnual: Math.max(0, data.expenses * 12 + data.savings - data.otherIncome),
    get seedAPI() { return Math.round(this.needAnnual / BLENDED_RATE / 10000) * 10000; },
  };
  const progress = { done: Math.min(furthest, STEP_LABELS.length), total: STEP_LABELS.length, labels: STEP_LABELS };
  const complete = furthest >= STEP_LABELS.length;

  const goStep = (i) => { setReturning(false); setIdx(i); if (i >= 0 && i < STEP_LABELS.length) setFurthest((f) => Math.max(f, i)); };
  const next = () => { if (idx < STEP_LABELS.length) { setFurthest((f) => Math.max(f, idx + 1)); setIdx(idx + 1); } };
  const back = () => setIdx((i) => Math.max(-1, i - 1));
  const skipStep = () => next();
  const skipAll = () => { setReturning(false); setIdx(6); };
  const resume = () => { setReturning(false); setIdx(Math.min(furthest, STEP_LABELS.length - 1)); };

  const isStep = idx >= 0 && idx < STEP_LABELS.length;

  return (
    <div className="appwrap">
      {/* ── toolbar (chrome, outside the device frame) ── */}
      <div className="toolbar">
        <div className="tb-left">
          <span className="tb-dot"></span>
          <span className="tb-title">First-Login Set-up Wizard</span>
          <span className="tb-tag">interactive mockup</span>
        </div>
        <div className="tb-right">
          <Segmented label="Theme" value={theme} onChange={setTheme}
            opts={[{ v: 'light', icon: 'sun', t: 'Light' }, { v: 'dark', icon: 'moon', t: 'Dark' }]} />
          <Segmented label="Style" value={style} onChange={setStyle}
            opts={[{ v: 'flat', t: 'Flat' }, { v: 'glass', icon: 'sparkles', t: 'Glass' }]} />
          <Segmented label="Device" value={device} onChange={setDevice}
            opts={[{ v: 'desktop', icon: 'monitor', t: 'Desktop' }, { v: 'mobile', icon: 'smartphone', t: 'Mobile' }]} />
          <Segmented label="First login" value={returning ? 'ret' : 'new'} onChange={(v) => { setReturning(v === 'ret'); if (v === 'ret') { setIdx(-1); setFurthest((f) => Math.max(f, 3)); } }}
            opts={[{ v: 'new', t: 'New' }, { v: 'ret', t: 'Returning' }]} />
        </div>
      </div>

      {/* ── stage ── */}
      <div className="stage">
        <div className={'frame ' + (device === 'mobile' ? 'frame-phone' : 'frame-browser')}>
          {device === 'desktop'
            ? <div className="br-bar"><span className="br-dots"><i></i><i></i><i></i></span><span className="br-url">agencytrack.app/welcome</span></div>
            : <div className="ph-status"><span>9:41</span><span className="ph-notch"></span><span>●●● ▾ ▮</span></div>}
          <div className={'frame-screen wz ' + theme + ' dev-' + device + (style === 'glass' ? ' glass' : '')}>
            {idx === -1 && <WelcomeScreen device={device} returning={returning} progress={progress} onStart={() => goStep(0)} onResume={resume} onSkipAll={skipAll} />}

            {isStep && (
              <div className="stepframe">
                <div className="wz-head">
                  <div className="wzh-top"><span className="wzh-brand"><AtLogo /></span><span className="wzh-name">Set up your AgencyTrack</span><button className="wzh-x" onClick={skipAll} aria-label="Skip set-up"><Icon name="x" size={16} /></button></div>
                  <Stepper idx={idx} device={device} furthest={furthest} onJump={(i) => i <= furthest && goStep(i)} />
                </div>

                <div className="wz-body">
                  {idx === 0 && <IdentityStep data={data} set={set} device={device} />}
                  {idx === 1 && <MoneyNeedsStep data={data} set={set} calc={calc} device={device} mnView={mnView} setMnView={setMnView} />}
                  {idx === 2 && <GamePlanStep data={data} set={set} calc={calc} device={device} />}
                  {idx === 3 && <GoalsStep data={data} set={set} calc={calc} device={device} />}
                  {idx === 4 && <ProfileStep data={data} set={set} device={device} />}
                </div>

                <div className="wz-foot">
                  <button className="btn btn-ghost" onClick={back}><Icon name="chevronLeft" size={16} />Back</button>
                  <div className="wzf-right">
                    <button className="btn btn-text" onClick={skipStep}>{OPTIONAL[idx] ? 'Skip — use defaults' : 'Skip for now'}</button>
                    <button className="btn btn-primary" onClick={next}>{idx === STEP_LABELS.length - 1 ? 'Finish & review' : 'Continue'}<Icon name="arrowRight" size={16} /></button>
                  </div>
                </div>
              </div>
            )}

            {idx === 5 && <CompletionScreen data={data} calc={calc} device={device} onHome={() => setIdx(6)} onEdit={(s) => goStep(s)} />}
            {idx === 6 && <HomeMock data={data} calc={calc} complete={complete} progress={progress} device={device} onResume={resume} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Segmented({ label, value, onChange, opts }) {
  return (
    <div className="segmented">
      <span className="sg-l">{label}</span>
      <div className="sg-track">
        {opts.map((o) => (
          <button key={o.v} className={'sg-b ' + (value === o.v ? 'on' : '')} onClick={() => onChange(o.v)}>
            {o.icon && <Icon name={o.icon} size={13} />}{o.t}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stepper({ idx, device, furthest, onJump }) {
  if (device === 'mobile') {
    return (
      <div className="stepper-mini">
        <div className="sm-row"><span className="sm-phase">{PHASES[idx]}</span><span className="sm-count">Step {idx + 1} of {STEP_LABELS.length}</span></div>
        <div className="sm-track"><i style={{ width: ((idx + 1) / STEP_LABELS.length * 100) + '%' }}></i></div>
        <div className="sm-label">{STEP_LABELS[idx]}{OPTIONAL[idx] && <span className="sm-opt">optional</span>}</div>
      </div>
    );
  }
  return (
    <div className="stepper">
      {STEP_LABELS.map((l, i) => {
        const stt = i < idx ? 'done' : i === idx ? 'cur' : 'todo';
        const reachable = i <= furthest;
        return (
          <React.Fragment key={l}>
            <button className={'stp ' + stt + (reachable ? ' reach' : '')} onClick={() => reachable && onJump(i)} disabled={!reachable}>
              <span className="stp-dot">{i < idx ? <Icon name="check" size={12} stroke={2.8} /> : i + 1}</span>
              <span className="stp-l">{l}{OPTIONAL[i] && <em> · optional</em>}</span>
            </button>
            {i < STEP_LABELS.length - 1 && <span className={'stp-conn ' + (i < idx ? 'done' : '')}></span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<WizardApp />);

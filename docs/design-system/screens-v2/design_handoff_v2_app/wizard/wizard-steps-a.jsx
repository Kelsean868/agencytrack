// Set-up Wizard — step screens, part A: Welcome (+ resume) and Identity (net-new).

const AGENT_RE = /^\d{3}[A-Za-z]\d{2}$/;
const PLACEHOLDER_NO = '000A00'; // synthetic format hint — never a real agent number
const TAKEN_NOS = ['482K19']; // mock collision set

// classify an in-progress agent number into a validation state
function agentState(raw) {
  const v = (raw || '').trim().toUpperCase();
  if (!v) return { kind: 'empty' };
  if (TAKEN_NOS.includes(v)) return { kind: 'taken' };
  if (AGENT_RE.test(v)) return { kind: 'valid' };
  if (v === PLACEHOLDER_NO) return { kind: 'taken' }; // the sample is "already in use"
  return { kind: 'warn' }; // doesn't match the usual shape — soft warning, not a wall
}

/* ─────────────────────────── WELCOME ─────────────────────────── */
function WelcomeScreen({ device, returning, progress, onStart, onResume, onSkipAll }) {
  if (returning) {
    return (
      <div className="screen welcome resume">
        <div className="wel-inner">
          <div className="brandmark"><AtLogo /></div>
          <div className="wel-ey">Welcome back</div>
          <h1 className="wel-h">Pick up where you left off.</h1>
          <p className="wel-sub">Your set-up is part-done. Finish the last few steps and your dashboard fills in — or keep exploring and come back anytime.</p>
          <div className="resumecard">
            <div className="rc-top">
              <span className="rc-k">Set-up progress</span>
              <span className="rc-n">{progress.done} of {progress.total} done</span>
            </div>
            <div className="rc-track"><i style={{ width: (progress.done / progress.total * 100) + '%' }}></i></div>
            <div className="rc-steps">
              {progress.labels.map((l, i) => (
                <span key={l} className={'rc-chip ' + (i < progress.done ? 'done' : i === progress.done ? 'next' : 'todo')}>
                  {i < progress.done && <Icon name="check" size={11} stroke={2.6} />}{l}
                </span>
              ))}
            </div>
          </div>
          <div className="wel-cta">
            <button className="btn btn-primary" onClick={onResume}>Resume set-up<Icon name="arrowRight" size={17} /></button>
            <button className="btn btn-ghost" onClick={onSkipAll}>Explore on my own</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="screen welcome">
      <div className="wel-grid">
        <div className="wel-inner">
          <div className="brandmark"><AtLogo /></div>
          <div className="wel-ey">Welcome to AgencyTrack</div>
          <h1 className="wel-h">Let's get you set up.</h1>
          <p className="wel-sub">A few minutes now and you'll land in a product that already knows your numbers — a real commitment, a goal, and the gap to reach it. We'll walk it with you.</p>
          <div className="wel-meta">
            <span><Icon name="clock" size={14} />~4 minutes</span>
            <span className="dot">·</span>
            <span><Icon name="list" size={14} />5 steps</span>
            <span className="dot">·</span>
            <span><Icon name="check" size={14} />skip anytime</span>
          </div>
          <div className="wel-cta">
            <button className="btn btn-primary lg" onClick={onStart}>Get started<Icon name="arrowRight" size={18} /></button>
            <button className="btn btn-text" onClick={onSkipAll}>Skip for now</button>
          </div>
        </div>
        {device === 'desktop' && (
          <div className="wel-preview" aria-hidden="true">
            <div className="wp-tag">your dashboard, after set-up</div>
            <div className="wp-hero"><span className="wp-k">Personal commitment</span><span className="wp-v">TTD 600K</span></div>
            <div className="wp-row"><div className="wp-bar"><i style={{ width: '62%' }}></i></div><span>API</span></div>
            <div className="wp-row"><div className="wp-bar"><i style={{ width: '40%' }}></i></div><span>Income</span></div>
            <div className="wp-cards"><div className="wp-c"></div><div className="wp-c"></div></div>
            <div className="wp-award"><Icon name="award" size={15} /><span>Silver Circle · pinned</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── IDENTITY (net-new) ─────────────────────────── */
function IdentityStep({ data, set, device }) {
  const st = agentState(data.agentNo);
  const msg = {
    empty: { cls: 'hint', icon: 'info', text: <span>Six characters — <b>three digits, a letter, two digits</b>. You're transcribing the number Tatil issued you.</span> },
    valid: { cls: 'ok', icon: 'circleCheck', text: <span>Format looks right. <b>Saved once you continue.</b></span> },
    warn: { cls: 'warn', icon: 'alert', text: <span>This doesn't match the usual <b>000A00</b> format — double-check it. You can still continue.</span> },
    taken: { cls: 'err', icon: 'alert', text: <span>That number is <b>already in use</b>. Re-check it, or ask your manager to sort the conflict.</span> },
  }[st.kind];

  return (
    <div className="step-pad">
      <StepIntro icon="user" eyebrow="About you" title="Confirm your agent identity"
        sub="Two details Tatil already has on you. For the pilot you're entering them yourself — a manager can correct them later." />

      <div className={'idgrid ' + (device === 'mobile' ? 'stack' : '')}>
        <div className="field">
          <label className="fl">Agent number<span className="req">authoritative · set once</span></label>
          <div className={'input big mono ' + (st.kind === 'valid' ? 'ok' : st.kind === 'warn' ? 'warn' : st.kind === 'taken' ? 'err' : '')}>
            <input value={data.agentNo} maxLength={6} placeholder={PLACEHOLDER_NO} spellCheck={false}
              onChange={(e) => set({ agentNo: e.target.value.toUpperCase() })} aria-label="Agent number" />
            <span className="in-state">
              {st.kind === 'valid' && <Icon name="circleCheck" size={20} />}
              {st.kind === 'warn' && <Icon name="alert" size={20} />}
              {st.kind === 'taken' && <Icon name="alert" size={20} />}
              {(st.kind === 'empty') && <span className="mask">000A00</span>}
            </span>
          </div>
          <div className={'fmsg ' + msg.cls}><Icon name={msg.icon} size={14} />{msg.text}</div>
          <div className="lockline"><Icon name="lock" size={13} /> Locks after you save. A manager can correct it from your profile.</div>
        </div>

        <div className="field">
          <label className="fl">Date of birth<span className="req">set once</span></label>
          <div className="input big">
            <input type="date" value={data.dob} max="2008-01-01" min="1945-01-01"
              onChange={(e) => set({ dob: e.target.value })} aria-label="Date of birth" />
            <span className="in-state"><Icon name="calendar" size={19} /></span>
          </div>
          <div className="fmsg hint"><Icon name="info" size={14} />Used to confirm it's you. Lower-stakes, but also set once.</div>
        </div>
      </div>

      <div className="statesrow">
        <span className="sr-k">Validation states</span>
        <span className="sr-chip ok"><Icon name="circleCheck" size={12} />Valid</span>
        <span className="sr-chip warn"><Icon name="alert" size={12} />Format check</span>
        <span className="sr-chip err"><Icon name="alert" size={12} />In use</span>
        <span className="sr-note">type <code>000A00</code> to see the “in use” collision · any well-formed <code>NNNANN</code> validates</span>
      </div>
    </div>
  );
}

function AtLogo() {
  return (
    <svg width="40" height="40" viewBox="0 0 200 200" aria-label="AgencyTrack">
      <rect width="200" height="200" rx="46" className="lg-bg" />
      <rect x="58" y="104" width="20" height="46" rx="5" className="lg-bar" />
      <rect x="90" y="82" width="20" height="68" rx="5" className="lg-bar" />
      <rect x="122" y="58" width="20" height="92" rx="5" className="lg-bar" />
      <circle cx="132" cy="44" r="11" className="lg-dot" />
    </svg>
  );
}

function StepIntro({ icon, eyebrow, title, sub }) {
  return (
    <div className="stepintro">
      <span className="si-ic"><Icon name={icon} size={20} /></span>
      <div>
        <div className="si-ey">{eyebrow}</div>
        <h2 className="si-t">{title}</h2>
        {sub && <p className="si-s">{sub}</p>}
      </div>
    </div>
  );
}

Object.assign(window, { WelcomeScreen, IdentityStep, AtLogo, StepIntro, agentState });

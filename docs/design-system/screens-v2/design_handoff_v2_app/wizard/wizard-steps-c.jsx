// Set-up Wizard — step screens, part C: Goals, Profile, Completion, Home mock.

/* ─────────────────────────── GOALS ─────────────────────────── */
function GoalsStep({ data, set, calc, device }) {
  const api = data.apiCommit;
  const income = Math.round(api * BLENDED_RATE);
  const pinned = data.pinnedAward;
  const reachable = AWARD_TIERS.filter((t) => t.api > api).slice(0, 2);
  const qualified = [...AWARD_TIERS].reverse().find((t) => api >= t.api);

  return (
    <div className="step-pad">
      <StepIntro icon="trendingUp" eyebrow="Your plan · 3 of 3" title="Here's your goal — and what it unlocks"
        sub="With Goals v3 this is your committed goal, the gap to it, the income it earns, the awards in reach, and your MDRT track. Confirm it and pin a stretch to aim at." />

      <div className={'goalsgrid ' + (device === 'mobile' ? 'stack' : '')}>
        {/* committed goal + gap */}
        <div className="gcard hero">
          <span className="gc-k">Your committed goal · 2026</span>
          <div className="gc-big">{ttd(api)}<small>API</small></div>
          <div className="gc-gap">
            <div className="gc-gaptrack"><i style={{ width: '2%' }}></i></div>
            <div className="gc-gapmeta"><span>TTD 0 YTD · your year starts now</span><span>gap {ttd(api)}</span></div>
          </div>
          <div className="gc-inc"><Icon name="banknote" size={15} /><span>Earns about <b>{ttd(income)}</b>/yr at your blended rate</span></div>
        </div>

        {/* MDRT track */}
        <div className="gcard">
          <span className="gc-k"><Icon name="gauge" size={13} /> MDRT track <em>illustrative pilot thresholds</em></span>
          <div className="mdrt">
            {MDRT_TIERS.map((m) => {
              const p = Math.min(100, Math.round(income / m.income * 100));
              const hit = income >= m.income;
              return (
                <div className="mdrt-row" key={m.name}>
                  <span className="mdrt-n">{m.name}{hit && <Icon name="check" size={12} stroke={2.6} />}</span>
                  <div className="mdrt-track"><i className={hit ? 'hit' : ''} style={{ width: p + '%' }}></i></div>
                  <span className="mdrt-v">{ttd(m.income)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* awards — pin a stretch */}
      <div className="awards">
        <div className="aw-head"><Icon name="award" size={15} /><span className="aw-t">Awards in reach</span><span className="aw-s">pin one as your stretch — it'll greet you on your dashboard</span></div>
        <div className={'aw-tiers ' + (device === 'mobile' ? 'stack' : '')}>
          {qualified && (
            <div className="aw-tier qual">
              <div className="awt-l"><span className="awt-coin"><Icon name="check" size={13} stroke={2.6} /></span><div><div className="awt-n">{qualified.name}</div><div className="awt-thr">≥ {ttd(qualified.api)} · qualified</div></div></div>
            </div>
          )}
          {reachable.map((t) => {
            const isPin = pinned === t.name;
            return (
              <button key={t.name} className={'aw-tier reach ' + (isPin ? 'pinned' : '')} onClick={() => set({ pinnedAward: isPin ? null : t.name })}>
                <div className="awt-l"><span className="awt-coin"><Icon name={isPin ? 'pin' : 'circle'} size={13} /></span><div><div className="awt-n">{t.name}</div><div className="awt-thr">≥ {ttd(t.api)} · +{ttd(t.api - api)}</div></div></div>
                <span className="awt-pin">{isPin ? 'Pinned' : 'Pin'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── PROFILE (optional) ─────────────────────────── */
const AV_COLORS = ['#01696F', '#B07D1A', '#5A3FA0', '#2D7A4F', '#B45309'];
function ProfileStep({ data, set, device }) {
  const initials = (data.name || 'You').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="step-pad">
      <StepIntro icon="user" eyebrow="Finish · optional" title="Make it yours"
        sub="A couple of touches — nothing required. The full Settings screen has the rest; skip this and your defaults are fine." />

      <div className={'profgrid ' + (device === 'mobile' ? 'stack' : '')}>
        <div className="prof-left">
          <div className="field">
            <label className="fl">Display name</label>
            <div className="input big"><input value={data.name} placeholder="e.g. Anaya Mohan" onChange={(e) => set({ name: e.target.value })} aria-label="Display name" /></div>
          </div>
          <div className="field">
            <label className="fl">Avatar colour</label>
            <div className="avrow">
              <span className="avbig" style={{ background: AV_COLORS[data.avatar] }}>{initials}</span>
              <div className="avswatches">
                {AV_COLORS.map((c, i) => (
                  <button key={c} className={'avsw ' + (data.avatar === i ? 'on' : '')} style={{ background: c }} onClick={() => set({ avatar: i })} aria-label={'Avatar colour ' + (i + 1)}>{data.avatar === i && <Icon name="check" size={13} stroke={2.8} />}</button>
                ))}
                <button className="avsw upload" aria-label="Upload photo"><Icon name="camera" size={15} /></button>
              </div>
            </div>
          </div>
        </div>
        <div className="prof-right">
          <div className="prefrow"><div><div className="pref-t"><Icon name="bell" size={14} /> Pace nudges</div><div className="pref-s">Weekly "to finish this month" reminders</div></div><span className={'switch ' + (data.nudges ? 'on' : '')} onClick={() => set({ nudges: !data.nudges })}><i></i></span></div>
          <div className="prefrow"><div><div className="pref-t"><Icon name="moon" size={14} /> Match system theme</div><div className="pref-s">Follow light / dark automatically</div></div><span className={'switch ' + (data.sysTheme ? 'on' : '')} onClick={() => set({ sysTheme: !data.sysTheme })}><i></i></span></div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── COMPLETION (net-new payoff) ─────────────────────────── */
function CompletionScreen({ data, calc, onHome, onEdit, device }) {
  const api = data.apiCommit;
  const income = Math.round(api * BLENDED_RATE);
  const name = (data.name || '').trim().split(/\s+/)[0] || 'there';
  const items = [
    { icon: 'shieldCheck', k: 'Agent identity', v: data.agentNo ? data.agentNo.toUpperCase() : 'Set later', step: 0 },
    { icon: 'target', k: 'Personal commitment', v: ttd(api) + ' API', step: 2 },
    { icon: 'trendingUp', k: 'Your goal & gap', v: ttd(api) + ' · gap ' + ttd(api), step: 3 },
    { icon: 'banknote', k: 'Derived income', v: ttd(income) + '/yr', step: 3 },
    { icon: 'award', k: 'Stretch award', v: data.pinnedAward || 'None pinned', step: 3 },
  ];
  return (
    <div className="screen completion">
      <div className="cmp-spark s1"><Icon name="sparkles" size={20} /></div>
      <div className="cmp-spark s2"><Icon name="sparkles" size={14} /></div>
      <div className="cmp-spark s3"><Icon name="sparkles" size={16} /></div>
      <div className="cmp-inner">
        <div className="cmp-badge"><Icon name="check" size={30} stroke={2.6} /></div>
        <div className="cmp-ey">You're all set, {name}</div>
        <h1 className="cmp-h">Your AgencyTrack is live.</h1>
        <p className="cmp-sub">Here's what you just set up — it's already waiting on your dashboard.</p>
        <div className={'cmp-summary ' + (device === 'mobile' ? 'stack' : '')}>
          {items.map((it) => (
            <button className="cmp-item" key={it.k} onClick={() => onEdit(it.step)}>
              <span className="cmp-i"><Icon name={it.icon} size={17} /></span>
              <span className="cmp-l"><span className="cmp-k">{it.k}</span><span className="cmp-v">{it.v}</span></span>
              <span className="cmp-edit"><Icon name="pencil" size={13} /></span>
            </button>
          ))}
        </div>
        <button className="btn btn-primary lg" onClick={onHome}>Go to my dashboard<Icon name="arrowRight" size={18} /></button>
      </div>
    </div>
  );
}

/* ─────────────────────────── HOME MOCK (lands here) ─────────────────────────── */
function HomeMock({ data, calc, complete, progress, onResume, device }) {
  const api = data.apiCommit;
  const income = Math.round(api * BLENDED_RATE);
  const name = (data.name || '').trim().split(/\s+/)[0] || 'Agent';
  return (
    <div className="screen home">
      {!complete && (
        <div className="finishbar">
          <span className="fb-i"><Icon name="rocket" size={15} /></span>
          <div className="fb-t"><b>Finish setting up</b><span>{progress.done} of {progress.total} steps done — your dashboard fills in as you go</span></div>
          <div className="fb-track"><i style={{ width: (progress.done / progress.total * 100) + '%' }}></i></div>
          <button className="btn btn-primary sm" onClick={onResume}>Resume<Icon name="arrowRight" size={15} /></button>
        </div>
      )}
      <div className="home-top"><span className="home-hi">Good morning, {name}</span><span className="home-tab">Dashboard · Goals · Game Plan · More</span></div>
      <div className={'home-grid ' + (device === 'mobile' ? 'stack' : '')}>
        <div className="home-hero">
          <span className="hh-k">Personal commitment</span>
          <div className="hh-v">{complete ? ttd(api) : 'Not set'}<small>{complete ? 'API' : ''}</small></div>
          {complete ? <div className="hh-sub">{ttd(income)}/yr · {data.pinnedAward ? data.pinnedAward + ' pinned' : 'no stretch pinned'}</div> : <div className="hh-sub muted">Finish set-up to see your goal & gap</div>}
        </div>
        <div className="home-cards">
          <div className={'home-c ' + (complete ? '' : 'empty')}><span className="hc-k">Goal gap</span><span className="hc-v">{complete ? ttd(api) : '—'}</span></div>
          <div className={'home-c ' + (complete ? '' : 'empty')}><span className="hc-k">This month</span><span className="hc-v">{complete ? ttd(Math.round(api / 12)) : '—'}</span></div>
          <div className={'home-c ' + (complete ? '' : 'empty')}><span className="hc-k">Awards</span><span className="hc-v">{complete ? (data.pinnedAward || '—') : '—'}</span></div>
          <div className={'home-c ' + (complete ? '' : 'empty')}><span className="hc-k">MDRT</span><span className="hc-v">{complete ? (income >= 250000 ? 'On track' : '—') : '—'}</span></div>
        </div>
      </div>
      <div className="home-foot"><Icon name="info" size={13} />Mock dashboard — shows the “you land in a populated product” payoff{complete ? '' : ', and the resume affordance when set-up was skipped'}.</div>
    </div>
  );
}

Object.assign(window, { GoalsStep, ProfileStep, CompletionScreen, HomeMock });

// ============================================================
// meeting.jsx — Meeting Mode redesign (fix 4.1)
// Room-commanding warm-dark presentation surface.
// ============================================================
function MeetingMode({ exit }) {
  const [mode, setMode] = useState('group');
  const [slide, setSlide] = useState(0);

  const agents = [
    { name: 'Anika Ramdeen', unit: 'Central', api: 148000, apps: 11, pace: 92, up: true },
    { name: 'Devon Charles', unit: 'North', api: 121500, apps: 9, pace: 78, up: true },
    { name: 'Priya Maharaj', unit: 'Central', api: 96200, apps: 7, pace: 64, up: false },
    { name: 'Kwame Joseph', unit: 'South', api: 71000, apps: 5, pace: 51, up: true },
    { name: 'ReNelle Baptiste', unit: 'North', api: 42800, apps: 3, pace: 33, up: false },
    { name: 'Marlon Ali', unit: 'South', api: 18400, apps: 1, pace: 14, up: false },
  ];
  const totalApi = agents.reduce((a, b) => a + b.api, 0);
  const totalApps = agents.reduce((a, b) => a + b.apps, 0);
  const filed = 5, roster = 6;
  const trend = [42, 55, 61, 58, 73, 88, 96];
  const max = Math.max(...agents.map(a => a.api));

  return (
    <div className="mm">
      {/* header */}
      <div className="mm-top">
        <div className="mm-brand"><div className="mm-mark"><Icon name="chart" size={16} /></div> AgencyTrack</div>
        <div className="mm-toggle">
          <button className={mode === 'group' ? 'is-on' : ''} onClick={() => setMode('group')}><Icon name="chart" size={15}/> Group</button>
          <button className={mode === 'oneone' ? 'is-on' : ''} onClick={() => setMode('oneone')}><Icon name="users" size={15}/> 1-on-1</button>
        </div>
        <button className="mm-x" onClick={exit} aria-label="Exit meeting mode"><Icon name="arrow" size={18} style={{transform:'rotate(180deg)'}}/> Exit</button>
      </div>

      {/* branch identity line */}
      <div className="mm-branch">
        <div>
          <Eyebrow tone="onhero">Smoke Test Branch · Weekly Review</Eyebrow>
          <div className="mm-week">Week of 28-06-2026</div>
        </div>
        <div className="mm-filed">
          <Ring value={Math.round(filed/roster*100)} size={72} stroke={7} label={`${filed}/${roster}`} sub="filed" color="var(--mm-teal)" track="rgba(255,255,255,.1)" />
        </div>
      </div>

      {/* big anchored stat tiles */}
      <div className="mm-stats">
        <div className="mm-tile mm-tile--hero">
          <Eyebrow tone="onhero">Total API · this week</Eyebrow>
          <div className="mm-tile-num mm-teal">{ttd(totalApi)}</div>
          <div className="mm-tile-foot"><Delta dir="up">18% vs last week</Delta></div>
          <Sparkline points={trend} w={260} h={46} color="var(--mm-teal)" />
        </div>
        <div className="mm-tile">
          <Eyebrow tone="onhero">Apps sold</Eyebrow>
          <div className="mm-tile-num">{totalApps}</div>
          <div className="mm-tile-foot"><Delta dir="up">4 vs last week</Delta></div>
        </div>
        <div className="mm-tile">
          <Eyebrow tone="onhero">Avg closing</Eyebrow>
          <div className="mm-tile-num">61<span className="mm-pct">%</span></div>
          <div className="mm-tile-foot"><Delta dir="down">3 pts</Delta></div>
        </div>
        <div className="mm-tile mm-tile--gold">
          <Eyebrow tone="gold">Top performer</Eyebrow>
          <div className="mm-tile-name">Anika Ramdeen</div>
          <div className="mm-tile-foot mm-gold">{ttd(148000)} · 92% of pace</div>
        </div>
      </div>

      {/* live leaderboard rail */}
      <div className="mm-board">
        <div className="mm-board-head"><Eyebrow tone="onhero">Branch leaderboard · API this week</Eyebrow></div>
        {agents.map((a, i) => (
          <div key={a.name} className="mm-row">
            <div className={'mm-rank' + (i === 0 ? ' is-gold' : '')}>{i + 1}</div>
            <div className="mm-agent"><div className="mm-agent-name">{a.name}</div><div className="mm-agent-unit">{a.unit} Unit</div></div>
            <div className="mm-track"><div className="mm-track-fill" style={{ width: (a.api / max * 100) + '%' }} /></div>
            <div className="mm-agent-api">{ttd(a.api)}</div>
            <div className="mm-agent-apps">{a.apps} apps</div>
            <Delta dir={a.up ? 'up' : 'down'}>{a.pace}%</Delta>
          </div>
        ))}
      </div>

      {/* footer pager */}
      <div className="mm-foot">
        <button className="mm-nav" onClick={() => setSlide(s => Math.max(0, s - 1))} aria-label="Previous"><Icon name="chevron" size={22} style={{transform:'rotate(180deg)'}}/></button>
        <div className="mm-dots"><span className={slide===0?'on':''}/><span className={slide===1?'on':''}/></div>
        <button className="mm-nav" onClick={() => setSlide(s => Math.min(1, s + 1))} aria-label="Next"><Icon name="chevron" size={22}/></button>
      </div>
    </div>
  );
}
Object.assign(window, { MeetingMode });

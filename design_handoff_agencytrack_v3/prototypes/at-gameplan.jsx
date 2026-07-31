// Game Plan — the loop that makes logging worth doing.
//
// THE POINT. In the CRM the agents hate, data flows up and a scorecard comes back
// down. Here the agent's own logged activity re-solves the agent's own plan: settled
// production moves the gap, the gap divided by the weeks left becomes this week's
// required activity, and the shortfall drops into the action plan as blocks to book.
// The agent logs because the number they care about moves. That is the difference
// between an instrument and a tax.
//
// THE CHAIN IS RUN BACKWARDS. Not "here is your quota" but: this much API still to
// find, at your average case size that is this many sales, which at your close rate
// needs this many closing interviews, which needs this many fact finds, which needs
// this many approaches, which needs this many dials.
//
// AND IT USES THE AGENT'S OWN RATIOS. A prescription built on unit averages is just
// a quota with extra steps. Each link uses the agent's own conversion where they have
// enough volume to be meaningful, and the unit default where they do not — and every
// link SAYS which one it used, because a number you cannot interrogate is a number
// you do not trust.
const { Icon: GIcon } = window.AgencyTrackDesignSystem_ad1cd7;

const YEAR = { goal: 180000, week: 27, weeks: 52, avgCase: 3200 };
const settledOf = (store) => (store.policies || []).filter(p => p.status === 'settled').reduce((n, p) => n + p.api, 0);
const MIN_SAMPLE = 20;          // below this over the whole window, an agent's own ratio is noise

// Trailing stage counts, weeks 19–26, oldest first. The live week is appended, so
// logging still moves the ratios — it just cannot swing them on one day's numbers.
const HISTORY = [
  { PC: 88, AI: 19, FFI: 13, CI: 8, SALE: 3 },
  { PC: 104, AI: 24, FFI: 15, CI: 10, SALE: 5 },
  { PC: 71, AI: 16, FFI: 11, CI: 7, SALE: 3 },
  { PC: 96, AI: 23, FFI: 14, CI: 9, SALE: 4 },
  { PC: 112, AI: 26, FFI: 17, CI: 11, SALE: 5 },
  { PC: 64, AI: 14, FFI: 9, CI: 6, SALE: 2 },
  { PC: 92, AI: 21, FFI: 14, CI: 9, SALE: 4 },
  { PC: 99, AI: 22, FFI: 15, CI: 10, SALE: 4 },
];

// The ladder, top to bottom. `from`/`to` name the counted types either side.
const CHAIN = [
  { k: 'close', lab: 'Closing interview \u2192 sale', from: 'CI', to: 'SALE', def: 0.5 },
  { k: 'ffi', lab: 'Fact find \u2192 closing interview', from: 'FFI', to: 'CI', def: 0.7 },
  { k: 'ai', lab: 'Approach \u2192 fact find', from: 'AI', to: 'FFI', def: 0.6 },
  { k: 'dial', lab: 'Dial \u2192 approach', from: 'PC', to: 'AI', def: 0.2 },
];

const ttd = (n) => n >= 1000000 ? 'TTD ' + (n / 1000000).toFixed(2) + 'M'
  : n >= 1000 ? 'TTD ' + (n / 1000).toFixed(1) + 'K' : 'TTD ' + Math.round(n);

// Ratios from the ledger, with provenance.
//
// COHORTS, NOT CALENDAR WEEKS. Dividing one week's downstream stage by the same
// week's upstream stage is not a conversion rate — a fact find conducted in week 26
// produces its closing interview in week 27. Same-week pairs can exceed 100% (more
// closings than fact finds, because the fact finds were booked earlier), which then
// inverts the funnel: a prescription asking for more closing interviews than fact
// finds is not executable. So each link is measured over a trailing multi-week
// window with a one-period lag: downstream from periods 2..n over upstream from
// periods 1..n-1.
//
// And a ratio of exactly zero is not a rate either — 20 dials with no approach yet
// is ordinary mid-week state, not a 0% close rate — so it falls back to the unit
// default like any other thin sample. Substituting a token 1% instead would demand
// roughly twenty times the activity.
function ratios(store) {
  const rows = weekTotals(store);
  const live = {};
  ['PC', 'AI', 'FFI', 'CI', 'SALE'].forEach(t => { const r = rows.find(x => x.t === t); live[t] = r ? r.total : 0; });
  const periods = [...HISTORY, live];
  return CHAIN.map(c => {
    const denom = periods.slice(0, -1).reduce((n, p) => n + (p[c.from] || 0), 0);
    const num = periods.slice(1).reduce((n, p) => n + (p[c.to] || 0), 0);
    const usable = denom >= MIN_SAMPLE && num > 0;
    // Clamp in the COMPUTATION, not just the bar, so the number and the bar can
    // never disagree and the funnel can never invert.
    const own = usable ? Math.min(1, num / denom) : null;
    return { ...c, denom, num, weeks: periods.length, value: own == null ? c.def : own, mine: own != null };
  });
}

// Run the chain backwards from the money still to find.
function prescribe(store) {
  const rs = ratios(store);
  const settled = settledOf(store);
  const gap = Math.max(0, YEAR.goal - settled);
  const weeksLeft = Math.max(1, YEAR.weeks - YEAR.week);
  const apiWeek = gap / weeksLeft;
  const need = { SALE: apiWeek / YEAR.avgCase };
  const by = (k) => { const r = rs.find(x => x.k === k); return r.value > 0 ? r.value : r.def; };
  need.CI = need.SALE / by('close');
  need.FFI = need.CI / by('ffi');
  need.AI = need.FFI / by('ai');
  need.PC = need.AI / by('dial');
  const rows = weekTotals(store);
  const done = (t) => { const r = rows.find(x => x.t === t); return r ? r.total : 0; };
  const order = ['PC', 'AI', 'FFI', 'CI', 'SALE'];
  return {
    gap, weeksLeft, apiWeek, ratios: rs, settled,
    steps: order.map(t => {
      const req = Math.ceil(need[t] * 10) / 10;
      const have = done(t);
      return { t, lab: (COUNTED.find(c => c.t === t) || {}).lab || t, req, have, short: Math.max(0, Math.ceil(req - have)) };
    }),
  };
}

function GamePlanScreen({ store, onGoto }) {
  const { useState } = React;
  const p = prescribe(store);
  const [added, setAdded] = useState({});
  const pacedApi = YEAR.goal * (YEAR.week / YEAR.weeks);
  const ahead = p.settled - pacedApi;
  const totalShort = p.steps.reduce((n, s) => n + s.short, 0);

  const addBlocks = (s) => {
    const kind = { PC: ['PC', 0.5], AI: ['AI', 1], FFI: ['FFI', 1], CI: ['CI', 1.5], SALE: ['PAPER', 0.5] }[s.t];
    // A prescribed closing interview is 90 minutes, not the generic half hour — the
    // duration is part of what makes the block honest about the week it fills.
    for (let i = 0; i < Math.min(s.short, 6); i++) store.addTask(s.lab + ' \u00b7 from the plan', kind[0], kind[1]);
    setAdded(a => ({ ...a, [s.t]: Math.min(s.short, 6) }));
  };

  return (
    <div className="scr-wrap">
      <div className="scr-tool">
        <span className="scr-eyebrow">Game plan · the gap decides the week, not a quota</span>
        <span className="pl-stat">{p.weeksLeft} weeks left · {ttd(p.apiWeek)} a week to close it</span>
        <button className="pl-icbtn" onClick={() => onGoto('Weekly Numbers')}><GIcon name="chart" size={14} /> Where the numbers come from</button>
      </div>

      <div className="gp">
        <section className="gp-top">
          <div className="gp-money">
            <span className="gp-lab">SETTLED · YEAR TO DATE</span>
            <b className="gp-big">{ttd(p.settled)}</b>
            <span className="gp-of">of {ttd(YEAR.goal)} · {(store.policies || []).length} policies</span>
            <span className="gp-track">
              <i style={{ width: (p.settled / YEAR.goal * 100) + '%' }}></i>
              <em style={{ left: (YEAR.week / YEAR.weeks * 100) + '%' }} title={'On pace for week ' + YEAR.week + ' would be ' + ttd(pacedApi)}></em>
            </span>
            <span className={'gp-pace' + (ahead >= 0 ? ' is-up' : '')}>
              {ahead >= 0 ? ttd(ahead) + ' ahead of pace' : ttd(-ahead) + ' behind pace'}
            </span>
          </div>
          <div className="gp-gap">
            <span className="gp-lab">STILL TO FIND</span>
            <b className="gp-big">{ttd(p.gap)}</b>
            <span className="gp-of">over {p.weeksLeft} weeks · {ttd(p.apiWeek)} a week</span>
            <p className="gp-note">At your average case of {ttd(YEAR.avgCase)} that is <b>{(p.apiWeek / YEAR.avgCase).toFixed(1)} sales a week</b>. Everything below is that number run backwards through your own ratios.</p>
          </div>
        </section>

        <section className="mg-card">
          <div className="mg-card-h">
            <span className="pf-eb">YOUR CONVERSION, LINK BY LINK</span>
            <span className="mg-card-note">{p.ratios.filter(r => r.mine).length} of {p.ratios.length} from your own activity</span>
          </div>
          <div className="gp-chain">
            {p.ratios.map(r => (
              <div key={r.k} className="gp-link">
                <span className="gp-link-l"><b>{r.lab}</b>
                  <span>{r.mine ? r.num + ' of ' + r.denom + ' over ' + r.weeks + ' weeks, lagged' : 'not enough history yet — unit default'}</span>
                </span>
                <span className="gp-link-bar"><i style={{ width: Math.min(100, r.value * 100) + '%', background: r.mine ? 'var(--teal)' : 'var(--inkFaint)' }}></i></span>
                <b className="gp-link-n" style={{ color: r.mine ? 'var(--teal)' : 'var(--inkMute)' }}>{Math.round(r.value * 100)}<i>%</i></b>
                <span className={'gp-src' + (r.mine ? ' is-mine' : '')}>{r.mine ? 'YOURS' : 'DEFAULT'}</span>
              </div>
            ))}
          </div>
          <p className="rc-fine">A prescription built on unit averages is a quota with extra steps. Where you have worked enough volume for a ratio to mean something, the plan uses yours — which is also why logging changes the prescription: improve your close rate and the week in front of you gets shorter. Each link is measured across the trailing weeks with a one-period lag, because the fact find that produces this week's closing interview was conducted last week.</p>
        </section>

        <section className="mg-card">
          <div className="mg-card-h">
            <span className="pf-eb">WHAT THIS WEEK NEEDS</span>
            <span className="mg-card-note">{totalShort === 0 ? 'nothing outstanding' : totalShort + ' still to book'}</span>
          </div>
          <div className="gp-rows" role="table" aria-label="This week's prescription">
            <div className="gp-row gp-head" role="row">
              <span role="columnheader">Activity</span><span role="columnheader">Needed</span>
              <span role="columnheader">Counted so far</span><span role="columnheader">Short by</span><span role="columnheader">Put it in the plan</span>
            </div>
            {p.steps.map(s => (
              <div key={s.t} className="gp-row" role="row">
                <span className="tb-lab" role="cell"><b>{s.t}</b><span>{s.lab}</span></span>
                <span className="gp-num" role="cell"><b>{s.req}</b></span>
                <span className="gp-num" role="cell"><b style={{ color: 'var(--teal)' }}>{s.have}</b></span>
                <span className="gp-num" role="cell"><b style={{ color: s.short ? 'var(--warning)' : 'var(--success)' }}>{s.short || '\u2014'}</b></span>
                <span role="cell">
                  {s.short === 0 ? <span className="gp-done"><GIcon name="check" size={13} /> covered</span>
                    : added[s.t] ? <span className="gp-done"><GIcon name="check" size={13} /> {added[s.t]} added</span>
                      : <button className="mg-act" onClick={() => addBlocks(s)}>Add {Math.min(s.short, 6)} block{Math.min(s.short, 6) === 1 ? '' : 's'}</button>}
                </span>
              </div>
            ))}
          </div>
          <p className="rc-fine">Blocks land in the action plan unscheduled — the plan says what the week needs, you still decide when it happens. This is the whole loop: work the queue, the counts move, the ratios sharpen, the prescription changes, and next week's blocks are different because of what you actually did.</p>
        </section>
      </div>
    </div>
  );
}

Object.assign(window, { GamePlanScreen, prescribe, ratios, settledOf, YEAR, ttd });

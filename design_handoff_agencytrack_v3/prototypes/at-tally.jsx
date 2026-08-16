// Weekly numbers — how the two ways of recording activity become ONE report.
//
// THE PROBLEM. There are two honest paths into an activity count:
//   A. The lead is in the system. It gets called from the dialer, the call is
//      logged with a disposition and a duration, the appointment is booked and
//      kept. The count is DERIVED — the agent never types a number.
//   B. The lead is not in the system. Calls happen from the car, from a personal
//      phone, at a funeral, off a paper list. The agent knows they made 24 calls
//      and wants to say so without back-filling 24 records.
//
// THE RULE. Both land in the same ledger, per day per activity type, and the
// ledger never adds them blindly:
//   counted   = logged + declared
//   logged    = evidenced by a record. Read-only. The agent cannot type it down.
//   declared  = the EXTRA on top, typed by the agent. Never a total.
// So there is no double counting by construction — the agent is never entering a
// number that includes what the system already saw. The base is shown to them,
// greyed, and they add to it.
//
// THE ASYMMETRY THAT MATTERS. Declared activity satisfies the floor. It cannot
// feed contact rate, pipeline, or source reporting, because a bare count carries
// no disposition, no duration, no lead. The report says so per row instead of
// quietly averaging the two — and that split is the number a unit manager has
// never had: how much of a week is evidenced versus asserted.
const { Icon: TIcon } = window.AgencyTrackDesignSystem_ad1cd7;

// Counted activity types, in ladder order, with the weekly company floor. The
// floors are the repo's own numbers from COUNTERS rather than invented ones.
const COUNTED = [
  { t: 'PC', lab: 'Prospecting calls', floor: 20, feeds: 'contact rate' },
  { t: 'AI', lab: 'Approach interviews', floor: 4, feeds: 'pipeline' },
  { t: 'FFI', lab: 'Fact finds', floor: 4, feeds: 'pipeline' },
  { t: 'CI', lab: 'Closing interviews', floor: 3, feeds: 'pipeline' },
  { t: 'SALE', lab: 'Sales written', floor: 1, feeds: 'production' },
];
const TALLY_DAYS = WEEK_DAYS.slice(0, 6); // Mon–Sat; Sunday is not a working day

// Logged = evidenced by a record. Today reads the live store (call log + kept
// blocks); other days read the seeded week. Nothing here is typeable.
//
// UNITS. A call block is scheduled CAPACITY; a call is the activity. Counting one
// per PC block into the same total that receives one per call record would sum a
// container with its contents — a one-hour block whose subtitle reads "8 dials
// queued" would contribute 1 against a floor of 20.
//
// SCOPE. The container/contents choice is made PER BLOCK, never per day: each call
// record is attributed to the block whose window contains it, and that block counts
// max(its own recorded dial count, the calls itemised inside it). Calls that fall
// outside every block are ad-hoc and count individually. Scoping this to the day
// instead — "any itemised call disables all block counts" — makes the total go DOWN
// when an agent logs a call, which punishes the exact behaviour the ledger exists
// to reward. Per block, adding a call can only ever raise the total.
function pcBreakdown(store, day) {
  const evs = day === TODAY_KEY ? store.events : (WEEK_EVENTS[day] || []);
  const calls = day === TODAY_KEY ? store.calls : [];
  const blocks = evs.filter(e => (e.type === 'PC' || e.type === 'SC')
    && (e.isPast || e.isCompleted) && !['cancelled', 'postponed'].includes(e.status));
  const claimed = new Set();
  let inBlocks = 0;
  blocks.forEach(b => {
    const inside = calls.filter(c => c.atHour != null && c.atHour >= b.startHour && c.atHour < b.endHour);
    inside.forEach(c => claimed.add(c.id));
    inBlocks += Math.max(b.dials || 0, inside.length);
  });
  const adhoc = calls.filter(c => !claimed.has(c.id)).length;
  return { inBlocks, adhoc, total: inBlocks + adhoc, blockCount: blocks.length };
}

function loggedFor(store, day) {
  const out = {};
  COUNTED.forEach(c => { out[c.t] = 0; });
  const evs = day === TODAY_KEY ? store.events : (WEEK_EVENTS[day] || []);
  out.PC = pcBreakdown(store, day).total;
  evs.forEach(e => {
    const done = (e.isPast || e.isCompleted) && !['cancelled', 'postponed'].includes(e.status);
    if (!done || out[e.type] == null) return;
    if (e.type === 'PC' || e.type === 'SC') return;   // handled by pcBreakdown
    out[e.type] += 1;
  });
  return out;
}
const declaredFor = (store, day) => store.tally[day] || {};

function weekTotals(store) {
  const rows = COUNTED.map(c => ({ ...c, logged: 0, declared: 0 }));
  TALLY_DAYS.forEach(d => {
    const lg = loggedFor(store, d), dc = declaredFor(store, d);
    rows.forEach(r => { r.logged += lg[r.t] || 0; r.declared += dc[r.t] || 0; });
  });
  return rows.map(r => ({ ...r, total: r.logged + r.declared }));
}

function ProvBar({ logged, declared, floor }) {
  const total = logged + declared;
  const scale = Math.max(floor, total) || 1;
  // The floor tick sits OUTSIDE the clipping context. The fills need overflow:hidden
  // for their rounded ends, but an absolutely-positioned marker in that same box is
  // clipped by it — and at left:100% (every row at or under floor) it vanishes
  // completely, which is exactly where the floor matters most. Same structure
  // .gp-track already uses on Game Plan.
  return (
    <span className="tb-bar" title={logged + ' evidenced · ' + declared + ' declared · floor ' + floor}>
      <span className="tb-track">
        <i className="tb-log" style={{ width: (logged / scale * 100) + '%' }}></i>
        <i className="tb-dec" style={{ width: (declared / scale * 100) + '%' }}></i>
      </span>
      <em className="tb-floor" style={{ left: 'min(calc(100% - 2px), calc(' + (floor / scale * 100) + '% - 1px))' }}></em>
    </span>
  );
}

// Day entry. The logged column is greyed and read-only on purpose: an agent who
// could type over it would be able to erase a call the system watched.
function DayEntry({ store, day }) {
  const lg = loggedFor(store, day), dc = declaredFor(store, day);
  const pc = pcBreakdown(store, day);
  return (
    <div className="tb-day">
      <div className="tb-day-h">
        <span className="pf-eb">{day.toUpperCase()} · WHAT THE SYSTEM SAW, AND WHAT YOU ADD</span>
        <span className="tb-day-note">{day === TODAY_KEY ? 'today · live' : 'closed day'}</span>
      </div>
      <div className="tb-rows" role="table" aria-label={'Activity for ' + day}>
        <div className="tb-row tb-head" role="row">
          <span role="columnheader">Activity</span>
          <span role="columnheader">Evidenced</span>
          <span role="columnheader">You declare</span>
          <span role="columnheader">Counted</span>
        </div>
        {COUNTED.map(c => {
          const l = lg[c.t] || 0, d = dc[c.t] || 0;
          const src = c.t === 'PC'
            ? (pc.inBlocks && pc.adhoc ? pc.inBlocks + ' in blocks + ' + pc.adhoc + ' ad-hoc'
              : pc.adhoc ? 'ad-hoc calls' : 'call blocks')
            : 'kept appointments';
          return (
            <div key={c.t} className="tb-row" role="row">
              <span className="tb-lab" role="cell"><b>{c.t}</b><span>{c.lab}</span></span>
              <span className="tb-logged" role="cell" title={'Derived from ' + src + ' — not editable'}>
                {l}{l > 0 && <i>{src}</i>}
              </span>
              <span className="tb-in" role="cell">
                <input type="number" min="0" className="ap-in" value={d || ''} placeholder="0"
                  aria-label={'Declared ' + c.lab + ' on ' + day}
                  onChange={(e) => store.setTallyExtra(day, c.t, e.target.value)} />
              </span>
              <span className="tb-tot" role="cell"><b>{l + d}</b></span>
            </div>
          );
        })}
      </div>
      <p className="rc-fine">The evidenced column is read-only — it is the record, not an opinion. You are only ever adding the activity the system could not see, so the two can never double count. Calls are counted as calls: each call block counts whichever is higher — its own recorded dial count, or the calls you itemised inside it — and calls made outside any block are counted on their own. Working the dialer can only ever raise the number.</p>
    </div>
  );
}

function WeeklyReport({ store }) {
  const rows = weekTotals(store);
  const tot = rows.reduce((s, r) => ({ logged: s.logged + r.logged, declared: s.declared + r.declared }), { logged: 0, declared: 0 });
  const evidencedPct = tot.logged + tot.declared ? Math.round(tot.logged / (tot.logged + tot.declared) * 100) : 0;
  return (
    <div className="tb-week">
      <div className="tb-day-h">
        <span className="pf-eb">WEEK 27 · MON 29 – SAT 04</span>
        <span className="tb-prov">{evidencedPct}% of this week is evidenced<i></i></span>
      </div>
      <div className="tb-rows" role="table" aria-label="Weekly activity">
        <div className="tb-row tb-wrow tb-head" role="row">
          <span role="columnheader">Activity</span><span role="columnheader">Evidenced</span>
          <span role="columnheader">Declared</span><span role="columnheader">Counted</span>
          <span role="columnheader">Against floor</span><span role="columnheader">Feeds</span>
        </div>
        {rows.map(r => {
          const short = r.total < r.floor;
          return (
            <div key={r.t} className="tb-row tb-wrow" role="row">
              <span className="tb-lab" role="cell"><b>{r.t}</b><span>{r.lab}</span></span>
              <span className="tb-num tb-num-log" role="cell">{r.logged}</span>
              <span className="tb-num tb-num-dec" role="cell">{r.declared}</span>
              <span className="tb-num" role="cell"><b style={{ color: short ? 'var(--warning)' : 'var(--success)' }}>{r.total}</b><em>/{r.floor}</em></span>
              <span role="cell"><ProvBar logged={r.logged} declared={r.declared} floor={r.floor} /></span>
              <span className="tb-feeds" role="cell">{r.declared > 0 && r.feeds !== 'production'
                ? <span title={'Only the ' + r.logged + ' evidenced ' + r.t + ' can feed ' + r.feeds}>{r.logged} of {r.total} feed {r.feeds}</span>
                : <span>{r.feeds}</span>}</span>
            </div>
          );
        })}
      </div>
      <div className="tb-legend">
        <span><i className="tb-key tb-log"></i> Evidenced — a record exists: disposition, duration, the lead</span>
        <span><i className="tb-key tb-dec"></i> Declared — counted toward the floor, but carries no detail</span>
        <span><i className="tb-key tb-keyfloor"></i> Company floor</span>
      </div>
    </div>
  );
}

function WeeklyNumbersScreen({ store, onGoto }) {
  const { useState } = React;
  const [day, setDay] = useState(TODAY_KEY);
  const rows = weekTotals(store);
  const tot = rows.reduce((s, r) => ({ l: s.l + r.logged, d: s.d + r.declared }), { l: 0, d: 0 });
  return (
    <div className="scr-wrap">
      <div className="scr-tool">
        <span className="scr-eyebrow">Weekly numbers · one ledger, two ways in</span>
        <div className="seg-sm">
          {TALLY_DAYS.map(d => <button key={d} className={day === d ? 'is-on' : ''} onClick={() => setDay(d)}>{d.split(' ')[0]}</button>)}
        </div>
        <span className="pl-stat">{tot.l + tot.d} counted · {tot.l} evidenced · {tot.d} declared</span>
        <button className="pl-icbtn" onClick={() => onGoto('Dialer')}><TIcon name="users" size={14} /> Work the queue instead</button>
      </div>
      <div className="tb">
        <DayEntry store={store} day={day} />
        <WeeklyReport store={store} />
        <p className="rc-fine">Why both paths exist: an agent working a queue never types a number — the count is a by-product of doing the work, which is the version worth having. An agent on the road with a paper list still needs to be counted, and refusing to let them declare it does not produce better data, it produces a spreadsheet kept outside the system. Making the split visible is what keeps declaring honest: a week that is 30% evidenced is a conversation, not an accusation.</p>
      </div>
    </div>
  );
}

Object.assign(window, { WeeklyNumbersScreen, weekTotals, loggedFor, declaredFor, pcBreakdown, COUNTED, TALLY_DAYS });

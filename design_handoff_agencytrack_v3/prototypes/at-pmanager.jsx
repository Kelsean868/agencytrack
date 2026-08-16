// The producing manager's pipeline — one board, two lanes.
//
// WHY NOT TWO SCREENS. A producing manager sells AND manages, and the failure mode of
// the role is that unit work silently eats the week that personal production needed.
// Putting the two in separate places hides exactly that: you finish a day of joint
// calls and licence chasing having written nothing, and nothing on screen said so.
// So the manager lane sits ABOVE the same six-column board an agent gets, and the
// header states the split in hours.
//
// EVERY LANE ITEM IS DERIVED, not a second to-do list. It comes from state that
// already exists — escalations in the task list, recruits sitting at a stage that
// needs a manager, agents whose licence is outstanding or whose load is heavy. A
// manager who clears the lane has changed the underlying thing, not ticked a copy.
//
// THE BOUNDARY STILL HOLDS. Lane items name AGENTS freely — headcount performance is
// the manager's business — and name a PROSPECT only where the agent escalated one,
// which is the carve-out the visibility matrix already describes. There is no route
// here to another agent's pipeline.
const { Icon: PmIcon, Avatar: PmAvatar } = window.AgencyTrackDesignSystem_ad1cd7;

const LANE_KINDS = {
  escalation: { lab: 'ESCALATED', tone: 'var(--inkAccent)', bg: 'var(--inkAccentTint)', hrs: 1.5 },
  joint: { lab: 'JOINT CALL', tone: 'var(--goldInk)', bg: 'var(--goldTint)', hrs: 1.5 },
  licence: { lab: 'LICENCE', tone: 'var(--warning)', bg: 'var(--warningTint)', hrs: 0.5 },
  contract: { lab: 'CONTRACT', tone: 'var(--teal)', bg: 'var(--tealTint)', hrs: 1 },
  slow: { lab: 'RECRUIT SLOW', tone: 'var(--warning)', bg: 'var(--warningTint)', hrs: 0.5 },
  load: { lab: 'LOAD', tone: 'var(--inkMute)', bg: 'var(--surfaceMute)', hrs: 0.5 },
};

// One derivation, read off the store. Nothing here is stored separately.
function managerLane(store) {
  const out = [];
  // These two navigate to the Planner rather than completing anything. A joint call
  // exists to be SCHEDULED — it lands in the action plan as a 1.5h block by design —
  // and completeTask would delete that block, book nothing, and log the joint call as
  // done. On the one interaction the escalation carve-out exists to serve, a false
  // audit trail is worse than a no-op. The item clears when the block is genuinely
  // dragged onto the grid, which is what removes it from the task list.
  (store.tasks || []).forEach(t => {
    if (t.escalation) {
      const lead = (store.leads || []).find(l => l.id === t.leadId);
      out.push({ id: t.id, kind: 'escalation', who: lead ? lead.name : 'a prospect', what: t.note || 'Second pair of eyes asked for',
        sub: lead ? 'escalated by the agent \u00b7 ' + (lead.stage || 'Approach') : 'escalated', act: 'Schedule', screen: 'Planner' });
    } else if (t.jointWith) {
      out.push({ id: t.id, kind: 'joint', who: t.jointWith, what: t.note || 'Joint call agreed',
        sub: 'accepted \u00b7 in the action plan, needs a slot', act: 'Schedule', screen: 'Planner' });
    }
  });
  (store.recruits || []).forEach(rec => {
    if (rec.stage === 'Selected') out.push({ id: 'l-c-' + rec.id, kind: 'contract', who: rec.name,
      what: 'Selected \u2014 waiting on a contract and a user account', sub: rec.area + ' \u00b7 ' + rec.exam, act: 'Contract', screen: 'Recruiting' });
    else if (rec.stage === 'Contracted') out.push({ id: 'l-l-' + rec.id, kind: 'licence', who: rec.name,
      what: 'Contracted but not registered \u2014 cannot be given a single lead', sub: rec.days + ' days waiting', act: 'Register', screen: 'Recruiting' });
    else if (rec.days >= R_STALL_DAYS && rec.stage !== 'Producing') out.push({ id: 'l-s-' + rec.id, kind: 'slow', who: rec.name,
      what: rec.days + ' days at ' + rec.stage, sub: 'yours to unblock, not theirs', act: 'Open', screen: 'Recruiting' });
  });
  (store.agents || []).forEach(a => {
    // Skip anyone the recruit pass already raised: an unlicensed agent and a recruit
    // sitting at Contracted are the SAME fact from two sides, and listing both makes
    // the lane count lie about how much work is actually waiting.
    if (out.some(i => i.who === a.name)) return;
    if (a.canSell === false) out.push({ id: 'l-u-' + a.id, kind: 'licence', who: a.name,
      what: 'On the roster, not licensed \u2014 excluded from every lead split', sub: (a.agentCode || '') + ' \u00b7 ' + a.unit, act: 'Register', screen: 'Recruiting' });
    else if (a.active && a.open >= 18) out.push({ id: 'l-o-' + a.id, kind: 'load', who: a.name,
      what: a.open + ' open leads \u2014 heaviest in the unit', sub: 'a reassign frees the aging ones', act: 'Unit desk', screen: 'Unit Desk' });
  });
  return out;
}

function LaneCard({ item, onGoto }) {
  const k = LANE_KINDS[item.kind];
  return (
    <div className="pm-card" style={{ borderLeftColor: k.tone }}>
      <div className="pm-card-h">
        <span className="pm-kind" style={{ color: k.tone, background: k.bg }}>{k.lab}</span>
        <span className="pm-who" title={item.who}>{item.who}</span>
      </div>
      <span className="pm-what" title={item.what}>{item.what}</span>
      <div className="pm-foot">
        <span className="pm-sub" title={item.sub}>{item.sub}</span>
        <button className="mg-act pm-act" onClick={() => { if (item.screen) onGoto(item.screen); else if (item.run) item.run(); }}>{item.act}</button>
      </div>
    </div>
  );
}

// The manager ladder, read off the planner grid. Suggested targets only — nothing is
// reported against them, which is why the card says "suggested" and not "floor".
const MGR_LADDER = [
  { t: 'ONE', lab: 'One-on-ones', pref: 'mgrONE' },
  { t: 'JC', lab: 'Joint calls', pref: 'mgrJC' },
  { t: 'RI', lab: 'Recruiting interviews', pref: 'mgrRI' },
];
const isDev = (type) => !!(ACTIVITY_METADATA[type] || {}).dev;
const isMgr = (type) => !!(ACTIVITY_METADATA[type] || {}).mgr;

function ProducingManagerPipeline({ store, onGoto, prefs = {} }) {
  const { useState } = React;
  const [open, setOpen] = useState(true);
  const lane = managerLane(store);
  const unitHrs = lane.reduce((n, i) => n + LANE_KINDS[i.kind].hrs, 0);
  const live = (store.events || []).filter(e => e.type !== 'SUGGESTION' && !['cancelled', 'postponed'].includes(e.status));
  const hrsOf = (fn) => live.filter(e => fn(e.type)).reduce((n, e) => n + (e.endHour - e.startHour), 0);
  // Three ways a manager's week goes, not two. Overhead named separately is the whole
  // point — a week eaten by unit meetings should not read as "managing".
  const ownHrs = hrsOf(t => !isMgr(t));
  const devHrs = hrsOf(isDev);
  const ohHrs = hrsOf(t => isMgr(t) && !isDev(t));
  const total = ownHrs + devHrs + ohHrs || 1;
  const share = Math.round(ownHrs / total * 100);
  const devShare = Math.round(devHrs / total * 100);
  const ohShare = 100 - share - devShare;
  const booked = (t) => live.filter(e => e.type === t).length;
  const byKind = Object.keys(LANE_KINDS).map(k => ({ k, n: lane.filter(i => i.kind === k).length })).filter(x => x.n);

  return (
    <>
      <div className="pm-split">
        <span className="pm-split-b">
          <b>{ownHrs.toFixed(1)}h your own book · {devHrs.toFixed(1)}h developing the unit · {ohHrs.toFixed(1)}h overhead</b>
          <span>{unitHrs.toFixed(1)}h of unit work still waiting — {lane.length} item{lane.length === 1 ? '' : 's'} that only you can clear</span>
        </span>
        <span className="pm-split-bar" title={share + '% own production · ' + devShare + '% development · ' + ohShare + '% overhead'}>
          <i style={{ width: share + '%' }}></i>
          <i className="is-dev" style={{ width: devShare + '%' }}></i>
          <i className="is-oh" style={{ width: ohShare + '%' }}></i>
        </span>
        <b className="pm-split-n" style={{ color: share < 40 ? 'var(--warning)' : 'var(--success)' }}>{share}<i>%</i></b>
        <span className="pm-split-lab">yours</span>
      </div>

      {prefs.mgrFloors !== false && (
        <div className="pm-ladder">
          <span className="pf-eb">UNIT DEVELOPMENT · SUGGESTED, NOT REQUIRED</span>
          {MGR_LADDER.map(m => {
            const target = prefs[m.pref] || 0, n = booked(m.t);
            return (
              <span key={m.t} className="pm-lad" title={n + ' booked against a suggested ' + target + ' — nothing is reported against this'}>
                <b>{m.t}</b><span>{m.lab}</span>
                <i style={{ color: n >= target ? 'var(--success)' : 'var(--inkMute)' }}>{n}<em>/{target}</em></i>
              </span>
            );
          })}
          <span className="pm-lad-note">Suggestions you set, not standards anyone holds you to — change or switch them off in Customise.</span>
        </div>
      )}

      <section className={'pm-lane' + (open ? '' : ' is-closed')}>
        <button className="pm-lane-h" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <span className="pf-eb">UNIT WORK · ONLY YOU CAN DO THESE</span>
          <span className="pm-lane-tags">
            {byKind.map(x => <i key={x.k} style={{ color: LANE_KINDS[x.k].tone, background: LANE_KINDS[x.k].bg }}>{x.n} {LANE_KINDS[x.k].lab.toLowerCase()}</i>)}
          </span>
          <span className="pm-lane-x">{open ? 'Hide' : 'Show'}</span>
        </button>
        {open && (
          <div className="pm-lane-body">
            {lane.length === 0
              ? <span className="pk-empty">Nothing waiting on you — the whole week is yours to sell.</span>
              : lane.map(i => <LaneCard key={i.id} item={i} onGoto={onGoto} />)}
          </div>
        )}
      </section>

      <div className="pm-own">
        <span className="pf-eb">YOUR OWN BOOK · THE SAME PIPELINE EVERY AGENT WORKS</span>
      </div>
      <AgentBoard store={store} />
      <p className="rc-fine">A producing manager is not two jobs in two places. The lane above and the board below compete for one week, which is why the split is stated in hours at the top rather than left for you to work out in March. Every lane item is derived from something real \u2014 an escalation the agent raised, a recruit sitting unlicensed, a load that has gone heavy \u2014 so clearing one changes the thing itself: a joint call leaves the lane when it is scheduled on the grid, not when it is ticked. None of it opens another agent&rsquo;s pipeline; a prospect appears by name only where that agent escalated them to you.</p>
    </>
  );
}

Object.assign(window, { ProducingManagerPipeline, managerLane, LANE_KINDS, MGR_LADDER, isDev, isMgr });

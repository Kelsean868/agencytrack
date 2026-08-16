// Trust layer — the stall signal and the visibility matrix.
//
// WHY THE STALL SIGNAL IS NOT A CONTACT COUNTER. Insurance sales legitimately takes
// five to eight touches. A raw "you called this person 3 times" threshold fires
// constantly, agents learn to dismiss it, and it is wallpaper inside a month. The
// real signal is two conditions AND-ed, never either:
//     touches since the last stage advance   ×   days since the last stage advance
// A prospect contacted six times who moved Approach → FFI → CI is not stalled. One
// contacted four times who has not moved in three weeks is, however few the touches.
//
// This is DISTINCT from the archive cycle already in the dialer. That fires on
// consecutive NON-contacts — the prospect was never reached. This fires when contact
// IS happening and the stage is not moving. Different problems, different responses.
//
// WHOSE SIGNAL IT IS. Named and precise on the agent's own surface. The manager sees
// a per-agent COUNT and never a prospect, and that count appears on no comparative
// surface — no ranking, no leaderboard, no scorecard. A manager can ask "which ones";
// the system must not pre-answer it.
const { Icon: TrIcon, Avatar: TrAvatar } = window.AgencyTrackDesignSystem_ad1cd7;

// Tenant default until an agent has enough history to calibrate against their own
// median. Both conditions must be met.
const STALL_DEFAULT = { touches: 4, days: 14 };

function stallOf(lead, thresh = STALL_DEFAULT) {
  const t = lead.touchesSinceAdvance || 0, d = lead.daysSinceAdvance || 0;
  if (lead.status !== 'pending') return { stalled: false, t, d };
  // A snooze suppresses the nudge until its expiry instant, then the thread comes
  // back with its history intact. Treating the flag itself as suppression would make
  // a snooze permanent — a silent delete dressed as a deferral.
  if (lead.snoozedUntil && Date.now() < lead.snoozedUntil) return { stalled: false, t, d, snoozed: true };
  const stalled = t >= thresh.touches && d >= thresh.days;
  return { stalled, t, d, over: stalled ? Math.round((t / thresh.touches + d / thresh.days) / 2 * 100) - 100 : 0 };
}
const stalledLeads = (leads, thresh) => leads.filter(l => stallOf(l, thresh).stalled);

const ELIMINATE_REASONS = ['Cannot afford the premium', 'Not insurable', 'Already covered elsewhere', 'Wrong contact / bad referral', 'Said no, and meant it'];
const SNOOZE_OPTIONS = [[14, 'two weeks'], [30, 'a month'], [90, 'three months']];

// The agent's own card. Tone matters more than mechanics here: this is a second pair
// of eyes being offered, not a problem being reported. Dismissal is free and leaves
// no trace, and eliminating reads as a win because it clears the old-names pool.
function StallCard({ lead, store, onClose }) {
  const { useState } = React;
  const s = stallOf(lead);
  const [mode, setMode] = useState(null);
  const [why, setWhy] = useState('Stuck at ' + (lead.stage || 'approach') + ' — want a second voice');
  const [reason, setReason] = useState(ELIMINATE_REASONS[0]);
  return (
    <div className="st-card">
      <div className="st-h">
        <span className="st-ic"><TrIcon name="clock" size={16} /></span>
        <span className="st-b">
          <b>{lead.name.split(' ')[0]} has gone quiet</b>
          <span>{s.t} touches and {s.d} days at <em>{lead.stage}</em> without moving. Want a second pair of eyes?</span>
        </span>
        <button className="st-x" onClick={onClose} aria-label="Dismiss">
          <TrIcon name="plus" size={14} style={{ transform: 'rotate(45deg)' }} />
        </button>
      </div>

      {!mode && (
        <div className="st-acts">
          <button className="pb pb-pri" onClick={() => setMode('escalate')}>Ask for a joint call</button>
          <button className="pb pb-sec" onClick={() => setMode('eliminate')}>Clear it off the list</button>
          <button className="pb pb-ghost" onClick={() => setMode('snooze')}>Not yet — snooze</button>
        </div>
      )}

      {mode === 'escalate' && (
        <div className="st-form">
          <label className="fld"><span className="fld-lab">What you want help with</span>
            <input className="ap-in" value={why} onChange={(e) => setWhy(e.target.value)} />
          </label>
          <p className="ov-note">Only {lead.name} goes across, and only for this one appointment — it is not added to any company prospect list and it does not survive the joint call.</p>
          <div className="st-form-acts">
            <button className="pb pb-sec" onClick={() => setMode(null)}>Back</button>
            <button className="pb pb-pri" onClick={() => { store.escalateLead(lead.id, why); onClose(); }}>Send the request</button>
          </div>
        </div>
      )}

      {mode === 'eliminate' && (
        <div className="st-form">
          <label className="fld"><span className="fld-lab">Why it is not going anywhere</span>
            <select className="ap-in" value={reason} onChange={(e) => setReason(e.target.value)}>
              {ELIMINATE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <p className="ov-note">Clearing a dead thread is a win, not a loss — it takes {lead.name.split(' ')[0]} out of the old-names pool so the week's work is new names again.</p>
          <div className="st-form-acts">
            <button className="pb pb-sec" onClick={() => setMode(null)}>Back</button>
            <button className="pb pb-pri" onClick={() => { store.eliminateLead(lead.id, reason); onClose(); }}>Clear it</button>
          </div>
        </div>
      )}

      {mode === 'snooze' && (
        <div className="st-form">
          <span className="fld-lab">Come back to it in</span>
          <div className="st-snooze">
            {SNOOZE_OPTIONS.map(([d, l]) => (
              <button key={d} className="pb pb-sec" onClick={() => { store.snoozeLead(lead.id, d); onClose(); }}>{l}</button>
            ))}
          </div>
          <p className="ov-note">A snooze is recorded nowhere — it does not reach your manager and it is not counted anywhere, otherwise it would not be free to use. {lead.name.split(' ')[0]} comes back with the {s.t} touches and {s.d} days still on the record; the reminder is paused, not the history.</p>
        </div>
      )}
    </div>
  );
}

// A manager's joint-call offer, on the agent's surface. Declining creates nothing
// and records nothing.
function JointOffers({ store }) {
  if (!store.jointOffers.length) return null;
  return (
    <div className="jo">
      {store.jointOffers.map(o => (
        <div key={o.id} className="jo-row">
          <TrAvatar initials={o.agent.split(' ').map(w => w[0]).join('').slice(0, 2)} size={30} />
          <span className="jo-b"><b>{o.agent} is offering a joint call</b><span>{o.what}</span></span>
          <button className="pb pb-ghost jo-no" onClick={() => store.answerJointOffer(o.id, false)}>No thanks</button>
          <button className="pb pb-pri jo-yes" onClick={() => store.answerJointOffer(o.id, true)}>Accept</button>
        </div>
      ))}
    </div>
  );
}

// ── the visibility matrix ───────────────────────────────────────────────────
// The cheapest trust feature in the product: say plainly who sees what, before
// anyone asks. The perception problem this answers is not that the boundaries are
// wrong — it is that nobody was ever told what they are.
const ROLES = ['You', 'Unit manager', 'Branch manager', 'Tenant admin'];
const VIS = [
  { rec: 'Prospect names and numbers', note: 'Your list. The asset you built.', v: ['rw', 'no', 'no', 'no'],
    detail: 'Nobody above you can read, export or list your prospects — including the tenant admin, which is the company itself. A name reaches a manager only when you escalate it, and only for that one appointment.' },
  { rec: 'Activity counts', note: 'Dials, approaches, fact finds, closings.', v: ['rw', 'r', 'r', 'r'],
    detail: 'Counts and stages, never the people behind them. This is what the company asked for when they asked for conversion visibility — the ratios, by source, by period, by agent.' },
  { rec: 'Call notes and dispositions', note: 'What was said on a call.', v: ['rw', 'no', 'no', 'no'],
    detail: 'Your working notes. A disposition contributes to your counts; the note itself is not readable upward.' },
  { rec: 'Stalled-thread count', note: 'How many threads have gone quiet.', v: ['rw', 'r', 'no', 'no'],
    detail: 'Your unit manager sees a number, never which prospects. It appears on no ranking, leaderboard or scorecard — it exists to start a conversation, not to score you.' },
  { rec: 'Planner blocks', note: 'What you have booked and kept.', v: ['rw', 'r', 'r', 'no'],
    detail: 'Times, types and whether a block was kept. Client names on appointment blocks are masked upward unless you escalated that prospect.' },
  { rec: 'Escalated prospect', note: 'One prospect, for one joint call.', v: ['rw', 'r', 'no', 'no'],
    detail: 'Visible to the manager on that joint call only, tied to the appointment, and it expires with it. It never lands in a standing roster.' },
  { rec: 'Production and settled API', note: 'Policies written and paid.', v: ['rw', 'r', 'r', 'r'],
    detail: 'Commission-bearing business is company business — this is the one category that is fully visible upward, and always was.' },
  { rec: 'Declared activity', note: 'Numbers you entered by hand.', v: ['rw', 'r', 'r', 'r'],
    detail: 'Visible as a count alongside evidenced activity. Declaring is a normal way to record work done off-system, not a flag.' },
];
const CELL = { rw: ['Read + write', 'var(--teal)', 'var(--tealTint)'], r: ['Read only', 'var(--inkMute)', 'var(--surfaceMute)'], no: ['No access', 'var(--danger)', 'var(--dangerTint)'] };

// ── portability ─────────────────────────────────────────────────────────────
// The strongest trust signal in the product, and the one that costs the least: the
// agent can take the whole list out, whenever they like, without asking. A promise
// that prospect records belong to the agent is only worth something if they can
// leave with them — otherwise "yours" means "yours while you stay".
//
// The export obeys the same matrix as the screen above it. An agent exports their
// own prospects in full; a manager exporting the unit gets counts and stages and no
// names, because an export route that ignores the boundary IS the boundary being
// ignored.
const csvCell = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCsv = (headers, rows) => [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\n');

const EXPORTS = [
  {
    k: 'prospects', label: 'My prospects', role: 'agent',
    what: 'Every field, every record — names, numbers, email, area, need, source, stage, touch history and status.',
    rows: (store) => ({
      headers: ['Name', 'Phone', 'Email', 'Area', 'Need', 'Source', 'Source detail', 'Queue', 'Stage', 'Status', 'Attempts', 'Archive cycles', 'Touches since advance', 'Days since advance', 'Snoozed until', 'Last contact'],
      data: store.leads.map(l => [l.name, l.phone, l.email, l.location, l.need, l.source, l.sourceDetails, l.queue,
        l.stage || 'Approach', l.status, l.attempts, l.cycleCount, l.touchesSinceAdvance || 0, l.daysSinceAdvance || 0,
        l.snoozedUntil ? new Date(l.snoozedUntil).toISOString().slice(0, 10) : '', l.lastContact]),
    }),
  },
  {
    k: 'clients', label: 'My clients and policies', role: 'agent',
    what: 'Settled business — policy number, client, product, API, settle date and persistency standing.',
    rows: (store) => ({
      headers: ['Policy no', 'Client', 'Product', 'API (TTD)', 'Settled on', 'Status', 'Persistency'],
      data: (store.policies || []).map(p => [p.policyNo, p.client, p.product, p.api, p.settledOn, p.status, p.persistency]),
    }),
  },
  {
    k: 'calls', label: 'My call log', role: 'agent',
    what: 'Every call with its disposition, real duration, the note you wrote and how it was placed.',
    rows: (store) => ({
      headers: ['At', 'Name', 'Phone', 'Disposition', 'Seconds', 'Placed via', 'Note'],
      data: store.calls.map(c => [c.at, c.name, c.phone, c.disposition, c.seconds, c.via, c.notes]),
    }),
  },
  {
    k: 'planner', label: 'My planner blocks', role: 'agent',
    what: 'The whole week — every block you booked and whether you kept it, with the day, times, activity type and duration.',
    rows: (store) => ({
      // The week, not today. Same source pattern loggedFor and SmartWeek already use:
      // the live store for today, the seeded week for the rest. A file of one day's
      // blocks with no date on any row cannot be reconciled against anything.
      headers: ['Day', 'Title', 'Activity', 'Start', 'End', 'Hours', 'Outcome'],
      data: WEEK_DAYS.flatMap(day => (day === TODAY_KEY ? store.events : (WEEK_EVENTS[day] || []))
        .filter(e => e.type !== 'SUGGESTION')
        .map(e => [day, e.title, e.type, formatTime(e.startHour), formatTime(e.endHour),
          (e.endHour - e.startHour).toFixed(2), e.status || (e.isCompleted || e.isPast ? 'kept' : 'booked')])),
    }),
  },
  {
    k: 'activity', label: 'My activity ledger', role: 'agent',
    what: 'Evidenced and declared counts per day per activity type — the numbers behind the weekly report.',
    rows: (store) => ({
      headers: ['Day', 'Activity', 'Evidenced', 'Declared', 'Counted'],
      data: TALLY_DAYS.flatMap(d => {
        const lg = loggedFor(store, d), dc = declaredFor(store, d);
        return COUNTED.map(c => [d, c.t, lg[c.t] || 0, dc[c.t] || 0, (lg[c.t] || 0) + (dc[c.t] || 0)]);
      }),
    }),
  },
  {
    k: 'audit', label: 'My full audit log', role: 'agent',
    what: 'Every event the system recorded on your behalf, in order — the same feed the Activity screen shows.',
    rows: (store) => ({
      headers: ['At', 'Type', 'What happened'],
      data: store.activities.map(a => [a.at, a.type, a.message]),
    }),
  },
  {
    k: 'stalled', label: 'My stalled threads', role: 'agent',
    what: 'Threads that have stopped advancing — stage, touches and days since the last advance, and any snooze you set.',
    rows: (store) => ({
      headers: ['Name', 'Stage', 'Touches since advance', 'Days since advance', 'Snoozed until', 'Need', 'Phone'],
      data: stalledLeads(store.leads).map(l => [l.name, l.stage || 'Approach', l.touchesSinceAdvance || 0, l.daysSinceAdvance || 0,
        l.snoozedUntil ? new Date(l.snoozedUntil).toISOString().slice(0, 10) : '', l.need, l.phone]),
    }),
  },
  {
    k: 'escalated', label: 'My escalated prospects', role: 'agent',
    what: 'Prospects you asked for a second pair of eyes on, and what you asked for — the only records that ever cross to a manager.',
    rows: (store) => ({
      headers: ['Name', 'Stage', 'What you asked for', 'Joint call booked'],
      data: store.leads.filter(l => l.escalated).map(l => {
        const t = store.tasks.find(x => x.escalation && x.leadId === l.id);
        return [l.name, l.stage || 'Approach', t ? (t.note || '') : '', t ? 'in the action plan' : 'completed or cleared'];
      }),
    }),
  },
  {
    k: 'unit', label: 'Unit activity (counts only)', role: 'manager',
    what: 'Per-agent counts and stages. No prospect names — the export follows the same rules as the screen.',
    rows: (store) => ({
      headers: ['Agent', 'Area', 'Open leads', 'Active'],
      data: store.agents.map(a => [a.name, a.area, a.open, a.active ? 'yes' : 'no']),
    }),
  },
];

// The role gate is the point. An agent has no read on another agent's records in the
// matrix above, so the unit file must not be offered here — a screen whose whole
// argument is "enforced in the rules, not the UI" cannot ship a UI-only boundary.
function ExportPanel({ store, role = 'agent' }) {
  const { useState } = React;
  const [done, setDone] = useState({});
  const mine = EXPORTS.filter(e => e.role === role);
  const run = (e) => {
    const { headers, data } = e.rows(store);
    download('agencytrack-' + e.k + '-' + new Date().toISOString().slice(0, 10) + '.csv', toCsv(headers, data));
    setDone(d => ({ ...d, [e.k]: data.length }));
  };
  return (
    <section className="xp">
      <div className="xp-h">
        <span className="pf-eb">TAKE IT WITH YOU</span>
        <span className="xp-note">No request, no approval, no notice period</span>
      </div>
      <p className="xp-lede">{role === 'manager'
        ? 'A manager exports what a manager can read. Counts and stages leave the system freely; another agent’s prospect list does not leave at all, because it was never yours to take.'
        : 'Your prospect list is the equity in a commission career. It is only genuinely yours if you can walk out with it, so every record the table above grants you exports to a plain CSV on one tap — one file per record type, readable in Excel, in another system, or in nothing at all.'}</p>
      <div className="xp-rows">
        {mine.map(e => (
          <div key={e.k} className="xp-row">
            <span className="xp-b">
              <b>{e.label}<i className={'xp-role' + (e.role === 'manager' ? ' is-mgr' : '')}>{e.role === 'manager' ? 'UNIT' : 'YOURS'}</i></b>
              <span>{e.what}</span>
            </span>
            <button className="mg-act" onClick={() => run(e)}>
              {done[e.k] != null ? done[e.k] + ' rows exported' : 'Export CSV'}
            </button>
          </div>
        ))}
      </div>
      <p className="rc-fine">{role === 'manager'
        ? 'There is no agent-prospect export on this screen and no hidden one behind it. If you need a name, the agent escalates it to you — that is the only route, by design.'
        : 'Nothing is withheld or watered down on the way out — the files carry the same fields the app reads, including your notes, your touch history and what you asked a manager to help with. One file per record type the table grants you, with no exceptions to explain.'}</p>
    </section>
  );
}

function VisibilityScreen({ store, onGoto, role = 'agent' }) {
  const { useState } = React;
  const [open, setOpen] = useState('Prospect names and numbers');
  return (
    <div className="scr-wrap">
      <div className="scr-tool">
        <span className="scr-eyebrow">Who can see this · every record type, every role</span>
        <span className="pl-stat">4 roles · {VIS.length} record types</span>
      </div>
      <div className="vz">
        <p className="vz-lede">Your prospect list is yours. Nobody above you — not your unit manager, not the branch, not the company&rsquo;s own admin — can read it, list it or export it. What goes upward is what you did, not who you did it with. Below is the whole picture, stated plainly rather than left to be discovered.</p>
        <div className="vz-grid" role="table" aria-label="Visibility by record type and role">
          <div className="vz-row vz-head" role="row">
            <span role="columnheader">Record</span>
            {ROLES.map(r => <span key={r} role="columnheader">{r}</span>)}
          </div>
          {VIS.map(row => (
            <React.Fragment key={row.rec}>
              <div className={'vz-row' + (open === row.rec ? ' is-open' : '')} role="row"
                onClick={() => setOpen(o => o === row.rec ? null : row.rec)}>
                <span className="vz-rec" role="cell"><b>{row.rec}</b><span>{row.note}</span></span>
                {row.v.map((v, i) => {
                  const [lab, fg, bg] = CELL[v];
                  return <span key={i} className="vz-cell" role="cell" style={{ color: fg, background: bg }} title={ROLES[i] + ': ' + lab}>{lab}</span>;
                })}
              </div>
              {open === row.rec && <p className="vz-detail">{row.detail}</p>}
            </React.Fragment>
          ))}
        </div>
        <div className="vz-foot">
          <b>Two commitments behind this table</b>
          <span>It is enforced in the database rules, not in this screen — a manager with an export tool gets the same answer the table gives. And where the answer is &ldquo;no access&rdquo;, that includes the tenant admin: the company does not read agent prospect records, because it has no reporting reason to.</span>
        </div>
        <ExportPanel store={store} role={role} />
      </div>
    </div>
  );
}

Object.assign(window, { StallCard, JointOffers, VisibilityScreen, ExportPanel, EXPORTS, toCsv, stallOf, stalledLeads, STALL_DEFAULT, VIS, ROLES });

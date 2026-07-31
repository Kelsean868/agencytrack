// Activities — one list over Tasks, Appointments and Calls, with the saved views
// Zoho gets right (Today / Overdue / This week) and the thing it gets wrong.
//
// The gap worth beating: in Zoho a scheduled follow-up CALL closes as a task, so
// you cannot record the duration or the outcome from the reminder — the call
// ladder loses its own data. Here every open activity closes AS ITS OWN TYPE: a
// call row hands off to the dialer with the lead loaded, an appointment row opens
// on the planner grid, and only a plain task closes as a tick.
const { Icon: AVIcon, Avatar: AVAvatar } = window.AgencyTrackDesignSystem_ad1cd7;

const VIEWS = [
  ['today', 'Today'],
  ['must', 'Must do'],
  ['late', 'Overdue'],
  ['week', 'This week'],
  ['done', 'Closed'],
  ['all', 'Everything'],
];
const KINDS = [['all', 'All'], ['call', 'Calls'], ['appt', 'Appointments'], ['task', 'Tasks']];

// Tasks carry a `due` window from the follow-up block; anything without one is
// treated as today's work, which is what an unscheduled action plan item is.
const DUE_RANK = { today: 0, tomorrow: 1, week: 2, next: 3 };
// Kind is DERIVED from the activity metadata, never a hardcoded type list. A list
// silently desyncs the moment a code is added — which is what sent JC/ONE/RI/UM to
// the 'task' closer, and that closer deletes. A joint call is not a plain task.
const KIND_OF = (type) => {
  const m = ACTIVITY_METADATA[type] || {};
  if (m.icon === 'call') return 'call';
  if (m.icon === 'ladder' || m.icon === 'meeting' || m.mgr) return 'appt';
  return 'task';
};

function rows(store) {
  const out = [];
  store.tasks.forEach(t => out.push({
    id: t.id, kind: KIND_OF(t.type), type: t.type, title: t.title, leadId: t.leadId,
    when: t.due || 'today', state: 'open', dur: t.duration, priority: t.priority, jointWith: t.jointWith,
  }));
  store.events.filter(e => e.type !== 'SUGGESTION').forEach(e => out.push({
    id: e.id, kind: 'appt', type: e.type, title: e.title, leadId: e.leadId,
    when: 'today', booked: e.startHour, ends: e.endHour,
    state: e.isCompleted || e.isPast ? 'done' : ['cancelled', 'postponed'].includes(e.status) ? 'retired' : 'open',
    status: e.status, dur: e.endHour - e.startHour,
  }));
  store.calls.forEach(c => out.push({
    id: c.id, kind: 'call', type: 'PC', title: c.name, leadId: c.leadId, when: 'today',
    state: 'done', logged: c.disposition, seconds: c.seconds, notes: c.notes, at: c.at, via: c.via,
  }));
  return out;
}

const TONE = {
  call: ['var(--inkAccent)', 'var(--inkAccentTint)'],
  appt: ['var(--teal)', 'var(--tealTint)'],
  task: ['var(--inkMute)', 'var(--surfaceMute)'],
};

function ActivityRow({ r, store, onGoto, onOpenLead, currentHour = 24 }) {
  const [fg, bg] = TONE[r.kind];
  const lead = r.leadId ? store.leads.find(l => l.id === r.leadId) : null;
  const closer = r.state !== 'open' ? null
    : r.kind === 'call' ? { label: 'Open the dialer', run: () => { onOpenLead(r.leadId); onGoto('Dialer'); } }
      : r.kind === 'appt' ? (r.booked != null
        ? { label: 'On the grid', run: () => onGoto('Planner') }
        : { label: 'Book the time', run: () => onGoto('Planner') })
        : { label: 'Done', run: () => store.completeTask(r.id) };
  return (
    <div className={'av-row av-' + r.state} role="row">
      <span className="av-kind" role="cell" style={{ color: fg, background: bg }}>{r.type}</span>
      <span className="av-t" role="cell">
        <b title={r.title}>{r.title}</b>
        <span>
          {r.state === 'done' && r.logged ? r.logged + ' \u00b7 ' + (r.seconds ? Math.max(1, Math.round(r.seconds / 60)) + 'm' : 'no time logged') + ' \u00b7 ' + r.at
            : r.state === 'retired' ? (r.status || '').toUpperCase()
              : r.state === 'done' ? 'kept'
                : r.booked != null ? 'booked ' + formatTime(r.booked) + (r.ends != null && r.ends < currentHour ? ' · ran past ' + formatTime(r.ends) : '')
                  : 'unscheduled \u00b7 ' + (r.dur >= 1 ? r.dur + 'h' : '30m')}
          {r.jointWith ? ' \u00b7 with ' + r.jointWith : ''}
        </span>
      </span>
      <span className="av-who" role="cell">{lead ? <><AVAvatar initials={lead.name.split(' ').map(w => w[0]).join('').slice(0, 2)} size={22} /><span>{lead.name}</span></> : <em>—</em>}</span>
      <span className="av-when" role="cell">{r.state === 'open' ? FOLLOWUP_WHEN_LABEL[r.when] || r.when : ''}</span>
      <span className="av-note" role="cell" title={r.notes || ''}>{r.notes || ''}</span>
      <span className="av-act" role="cell">
        {closer && <button className="mg-act" onClick={closer.run}>{closer.label}</button>}
        {r.state === 'open' && r.priority === 'high' && <span className="av-hot" title="Must do today">HOT</span>}
      </span>
    </div>
  );
}

function ActivitiesScreen({ store, onGoto, onOpenLead, currentHour = 24 }) {
  const { useState, useMemo } = React;
  const [view, setView] = useState('today');
  const [kind, setKind] = useState('all');
  const all = useMemo(() => rows(store), [store.tasks, store.events, store.calls, store.leads]);

  // "Overdue" means the clock has passed it, not "important". A booked block whose
  // end time is behind the now line and is still open is genuinely late; a must-do
  // item with no time on it is a different problem, and conflating the two makes
  // the count mean nothing.
  const inView = (r, v) => {
    if (v === 'all') return true;
    if (v === 'done') return r.state !== 'open';
    if (r.state !== 'open') return false;
    if (v === 'late') return r.ends != null && r.ends < currentHour;
    if (v === 'must') return r.priority === 'high' && r.booked == null;
    if (v === 'today') return r.when === 'today';
    if (v === 'week') return DUE_RANK[r.when] <= 2;
    return true;
  };

  const shown = all.filter(r => (kind === 'all' || r.kind === kind) && inView(r, view))
    .sort((a, b) => (a.state === 'open' ? 0 : 1) - (b.state === 'open' ? 0 : 1)
      || (DUE_RANK[a.when] || 0) - (DUE_RANK[b.when] || 0)
      || (a.booked != null ? a.booked : 99) - (b.booked != null ? b.booked : 99));

  const count = (v) => all.filter(r => inView(r, v)).length;

  return (
    <div className="scr-wrap">
      <div className="scr-tool">
        <span className="scr-eyebrow">Activities · calls, appointments and tasks in one list</span>
        <div className="seg-sm">
          {VIEWS.map(([v, l]) => <button key={v} className={view === v ? 'is-on' : ''} onClick={() => setView(v)}>{l} <i className="av-n">{count(v)}</i></button>)}
        </div>
        <div className="seg-sm">
          {KINDS.map(([k, l]) => <button key={k} className={kind === k ? 'is-on' : ''} onClick={() => setKind(k)}>{l}</button>)}
        </div>
      </div>

      <div className="av" role="table" aria-label="Activities">
        <div className="av-row av-head" role="row">
          <span role="columnheader">Type</span><span role="columnheader">What</span><span role="columnheader">Who</span>
          <span role="columnheader">When</span><span role="columnheader">Note</span><span role="columnheader">Close it</span>
        </div>
        {shown.length === 0
          ? <div className="ap-empty"><span className="ap-empty-ic"><AVIcon name="check" size={26} /></span>
              <b>Nothing in this view</b><span>Work a call or book a slot and it lands here.</span></div>
          : shown.map(r => <ActivityRow key={r.kind + r.id} r={r} store={store} onGoto={onGoto} onOpenLead={onOpenLead} currentHour={currentHour} />)}
      </div>
      <p className="rc-fine">Every open row closes as its own type — a call hands off to the dialer with the lead loaded so the duration and outcome are still captured, an appointment goes to the grid, and only a plain task closes as a tick. That is the one place a general CRM leaks: a follow-up call closed as a task loses the call data the activity ladder is built on.</p>
    </div>
  );
}

Object.assign(window, { ActivitiesScreen, KIND_OF });

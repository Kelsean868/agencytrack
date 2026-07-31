// Manager surfaces — the Unit Desk. Four blocks, each answering a question a
// manager actually asks of a planner + calls system:
//   1. Is the unit hitting the floor today?          → floor board
//   2. Who needs me, and for what?                   → agent rows
//   3. What decision is waiting on me?               → exceptions
//   4. Where did the leads go?                       → distribution / imports
// Marsha Singh's numbers come from the live store (she is the signed-in agent);
// the rest of the unit is seeded, so the cross-module rules stay demonstrable.
const { Icon: MIcon, Avatar: MAvatar } = window.AgencyTrackDesignSystem_ad1cd7;

// The DS Icon resolves `name` BEFORE children, so <MIcon name="upload">…</MIcon>
// renders the grid fallback and ignores the paths. An off-set glyph must be passed
// as children with NO name attribute.
const IconUpload = (p) => <MIcon {...p}><path d="M12 16V4M12 4l-4 4M12 4l4 4" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></MIcon>;

const UNIT_SEED = {
  ag2: { dials: 24, reached: 9, appts: 3, planned: 6, kept: 5, oldest: 2, evidenced: 88, stalled: 1 },
  ag3: { dials: 7, reached: 1, appts: 0, planned: 7, kept: 2, oldest: 11, evidenced: 31, stalled: 6 },
  ag4: { dials: 19, reached: 8, appts: 2, planned: 5, kept: 5, oldest: 3, evidenced: 74, stalled: 2 },
  ag5: { dials: 0, reached: 0, appts: 0, planned: 4, kept: 0, oldest: 16, evidenced: 0, stalled: 0 },
};
// One shape for a unit metric row, so the fallback can never desync from the seed
// again — which is what left a newly promoted recruit with two blank cells: the
// literal fallback predated `evidenced` and `stalled` and was never updated.
const METRIC_ZERO = { dials: 0, reached: 0, appts: 0, planned: 0, kept: 0, oldest: 0, evidenced: 0, stalled: 0 };
const FLOOR = { dials: 20, appts: 2, adherence: 80 };

const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;

// A stat tile with its own benchmark bar — the number alone doesn't say whether
// it is good, so the floor line is part of the tile rather than a legend.
function FloorTile({ label, value, unit, of, floorLabel, tone }) {
  const p = Math.min(100, pct(value, of));
  const under = value < of;
  return (
    <div className="mg-tile">
      <span className="mg-tile-lab">{label}</span>
      <b className="mg-tile-n" style={{ color: under ? 'var(--warning)' : tone || 'var(--ink)' }}>{value}<i>{unit}</i></b>
      <span className="mg-tile-bar">
        <span className="mg-tile-track"><i style={{ width: p + '%', background: under ? 'var(--warning)' : tone || 'var(--teal)' }}></i></span>
        <em className="mg-tile-tick" title={floorLabel}></em>
      </span>
      <span className="mg-tile-foot">{floorLabel}</span>
    </div>
  );
}

function AgentRow({ ag, m, onJoint, onReassign, onNudge, lightest }) {
  const contact = pct(m.reached, m.dials);
  const adh = pct(m.kept, m.planned);
  const belowFloor = m.dials < FLOOR.dials;
  const staleLead = m.oldest >= 7;
  return (
    <div className={'mg-row' + (ag.active ? '' : ' is-off')} role="row">
      <span className="mg-who" role="cell">
        <MAvatar initials={ag.initials} size={32} />
        <span className="mg-who-b">
          {/* The badges are SIBLINGS of the truncating name, not children of it. Inside
              it they sat in an overflow:hidden 125px box, so the second badge clipped to
              0px — and its title with it, making licence state unreachable. */}
          <span className="mg-who-top">
            <b title={ag.name}>{ag.name}</b>
            {ag.canSell === false && <i className="mg-new is-unlic" title="Contracted with a user account, but not yet registered — cannot be assigned leads or write business">UNLICENSED</i>}
            {ag.newJoiner && ag.canSell !== false && <i className="mg-new" title="Promoted from the recruiting pipeline — a row of zeros is a start, not a shortfall">NEW</i>}
          </span>
          <span title={(ag.agentCode ? ag.agentCode + ' · ' : '') + ag.unit + ' · ' + ag.area + (ag.active ? '' : ' · inactive this week')}>{ag.agentCode ? ag.agentCode + ' · ' : ''}{ag.area}{ag.active ? '' : ' · inactive'}</span>
        </span>
      </span>
      <span className="mg-metric" role="cell">
        <b style={{ color: belowFloor ? 'var(--warning)' : 'var(--ink)' }}>{m.dials}</b>
        <span className="mg-mini"><i style={{ width: Math.min(100, pct(m.dials, FLOOR.dials)) + '%', background: belowFloor ? 'var(--warning)' : 'var(--teal)' }}></i></span>
        <em>of {FLOOR.dials}</em>
      </span>
      <span className="mg-metric" role="cell"><b>{contact}<i>%</i></b><em>{m.reached} reached</em></span>
      <span className="mg-metric" role="cell"><b style={{ color: m.appts >= FLOOR.appts ? 'var(--success)' : 'var(--ink)' }}>{m.appts}</b><em>appointments</em></span>
      <span className="mg-metric" role="cell">
        <b style={{ color: adh < FLOOR.adherence ? 'var(--warning)' : 'var(--success)' }}>{adh}<i>%</i></b>
        <em>{m.kept}/{m.planned} blocks kept</em>
      </span>
      <span className="mg-metric" role="cell"><b>{ag.open}</b><em>open leads</em></span>
      <span className="mg-metric" role="cell">
        <b style={{ color: staleLead ? 'var(--danger)' : 'var(--ink)' }}>{m.oldest}<i>d</i></b><em>oldest untouched</em>
      </span>
      <span className="mg-metric" role="cell"
        title="Share of this agent's counted activity that has a record behind it — the rest is declared. Not a score: declaring is a normal way to record work done off-system.">
        <b>{m.evidenced}<i>%</i></b><em>evidenced</em>
      </span>
      <span className="mg-metric" role="cell"
        title="Threads this agent has open that have stopped advancing. A count only — which prospects is theirs, not yours. Appears on no ranking or scorecard.">
        <b>{m.stalled}</b><em>gone quiet</em>
      </span>
      <span className="mg-acts" role="cell">
        <button className="mg-act" onClick={() => onJoint(ag)} title="Drop a joint call into this agent's action plan">Joint call</button>
        <button className="mg-act" onClick={() => onReassign(ag)} disabled={!ag.open || ag.canSell === false} title={ag.canSell === false ? 'Not licensed — cannot hold leads' : 'Move leads to ' + lightest}>Reassign</button>
        <button className="mg-act mg-act-q" onClick={() => onNudge(ag)} aria-label={'Nudge ' + ag.name} title="Send a nudge"><MIcon name="bell" size={13} /></button>
      </span>
    </div>
  );
}

function ManagerScreen({ store, onGoto }) {
  const { useState, useMemo } = React;
  const [ask, setAsk] = useState(null);       // {kind, ag}
  const [jointWhat, setJointWhat] = useState('Closing interview — needs a second voice');
  const [moveN, setMoveN] = useState(5);
  const [moveTo, setMoveTo] = useState('');

  // Marsha's live numbers, read out of the same store the agent screens write to.
  const liveDials = store.activities.filter(a => a.type === 'call_logged').length + 12;
  const liveReached = store.activities.filter(a => /Appointment Set|Callback Requested|Not Interested/.test(a.message)).length + 5;
  const liveAppts = store.activities.filter(a => /Appointment Set/.test(a.message)).length + 1;
  const liveKept = store.activities.filter(a => a.type === 'kept' || a.type === 'task_completed').length + 4;
  // Evidenced share for the signed-in agent, read off the same ledger the Weekly
  // Numbers screen uses — so the manager and the agent are looking at one figure.
  const wk = weekTotals(store);
  const wkL = wk.reduce((n, r) => n + r.logged, 0), wkD = wk.reduce((n, r) => n + r.declared, 0);
  const liveEvidenced = wkL + wkD ? Math.round(wkL / (wkL + wkD) * 100) : 0;
  const metrics = useMemo(() => ({
    ag1: { dials: liveDials, reached: liveReached, appts: liveAppts, planned: 7, kept: Math.min(7, liveKept), oldest: 1, evidenced: liveEvidenced, stalled: stalledLeads(store.leads).length },
    ...UNIT_SEED,
  }), [liveDials, liveReached, liveAppts, liveKept, liveEvidenced, store.leads]);

  const unit = store.agents.map(a => ({ ag: a, m: { ...METRIC_ZERO, ...(metrics[a.id] || {}) } }));
  const tot = unit.reduce((s, u) => ({
    dials: s.dials + u.m.dials, reached: s.reached + u.m.reached, appts: s.appts + u.m.appts,
    planned: s.planned + u.m.planned, kept: s.kept + u.m.kept,
  }), { dials: 0, reached: 0, appts: 0, planned: 0, kept: 0 });
  const active = store.agents.filter(a => a.active);
  // A new joiner is excluded from the exception list on the grounds that their zeros
  // are a start, not a shortfall — so they must also be out of the unit-floor
  // denominators, or promoting a recruit makes the unit look worse (62/80 → 62/100)
  // and the screen turns a promotion into a regression.
  const counted = active.filter(a => !a.newJoiner && a.canSell !== false);
  const lightest = active.slice().sort((a, b) => a.open - b.open)[0];

  // Exceptions — the manager's decision list. Each is a real condition read off
  // the unit, with one inline action, per the notification pattern.
  const exceptions = [
    ...unit.filter(u => u.ag.active && !u.ag.newJoiner && u.m.dials < FLOOR.dials * 0.5).map(u => ({
      id: 'x-floor-' + u.ag.id, tone: 'var(--warning)', kind: 'BELOW FLOOR',
      msg: u.ag.name + ' is at ' + u.m.dials + ' dials against a floor of ' + FLOOR.dials + '.',
      act: 'Nudge', run: () => store.nudge(u.ag.name, 'below the dial floor at midday'),
    })),
    ...unit.filter(u => u.m.oldest >= 7).map(u => ({
      id: 'x-stale-' + u.ag.id, tone: 'var(--danger)', kind: 'LEAD AGING',
      msg: u.ag.name + ' has a lead untouched for ' + u.m.oldest + ' days — ' + u.ag.open + ' open in total.',
      act: 'Reassign', run: () => setAsk({ kind: 'reassign', ag: u.ag }),
    })),
    ...unit.filter(u => u.ag.active && u.m.stalled >= 4).map(u => ({
      id: 'x-stall-' + u.ag.id, tone: 'var(--inkAccent)', kind: 'THREADS QUIET',
      msg: u.ag.name + ' has ' + u.m.stalled + ' threads that have stopped advancing. Which ones is theirs to say — offer the help, don’t ask for the list.',
      act: 'Offer a joint call', run: () => store.offerJointCall(u.ag.name, 'Some threads have gone quiet — want to work a couple together?'),
    })),
    ...unit.filter(u => u.ag.active && !u.ag.newJoiner && pct(u.m.kept, u.m.planned) < 50).map(u => ({
      id: 'x-adh-' + u.ag.id, tone: 'var(--warning)', kind: 'ADHERENCE',
      msg: u.ag.name + ' kept ' + u.m.kept + ' of ' + u.m.planned + ' planned blocks this week.',
      act: 'Book a joint call', run: () => setAsk({ kind: 'joint', ag: u.ag }),
    })),
    ...store.notifications.map(n => ({
      id: n.id, tone: n.kind === 'dead' ? 'var(--danger)' : 'var(--inkAccent)', kind: 'APPROVAL',
      msg: n.message + ' ' + n.title + '.', act: n.action, run: () => store.resolveNotification(n.id, true),
    })),
  ];

  const openAsk = (kind, ag) => {
    setAsk({ kind, ag });
    const to = active.filter(a => a.id !== ag.id && a.canSell !== false).sort((a, b) => a.open - b.open)[0];
    setMoveTo(to ? to.name : '');
    setMoveN(Math.min(5, ag.open || 1));
  };

  return (
    <div className="scr-wrap">
      <div className="scr-tool">
        <span className="scr-eyebrow">Unit desk · Tatil Life South · Wednesday 1 July</span>
        <span className="pl-stat">{active.length} active · {tot.dials} dials · {tot.appts} appointments</span>        <button className="pl-icbtn" onClick={() => onGoto('Bulk Import')}><IconUpload size={14} /> Import a list</button>
      </div>

      <div className="mg">
        <div className="mg-floor">
          <FloorTile label="Unit dials today" value={tot.dials} unit="" of={FLOOR.dials * counted.length} floorLabel={'floor is ' + FLOOR.dials + ' each · ' + FLOOR.dials * counted.length + ' for the unit' + (counted.length < active.length ? ' · new joiners excluded' : '')} />
          <FloorTile label="Contact rate" value={pct(tot.reached, tot.dials)} unit="%" of={35} floorLabel="35% is the unit benchmark" tone="var(--inkAccent)" />
          <FloorTile label="Appointments set" value={tot.appts} unit="" of={FLOOR.appts * counted.length} floorLabel={FLOOR.appts + ' each · ' + FLOOR.appts * counted.length + ' for the unit' + (counted.length < active.length ? ' · new joiners excluded' : '')} tone="var(--teal)" />
          <FloorTile label="Planner adherence" value={pct(tot.kept, tot.planned)} unit="%" of={FLOOR.adherence} floorLabel={FLOOR.adherence + '% is the standard'} tone="var(--success)" />
        </div>

        <section className="mg-card">
          <div className="mg-card-h"><span className="pf-eb">THE UNIT, AGENT BY AGENT</span><span className="mg-card-note">Lightest load: {lightest.name} at {lightest.open} open</span></div>
          <div className="mg-rows" role="table" aria-label="Unit performance">
            <div className="mg-row mg-rowhead" role="row">
              <span role="columnheader">Agent</span><span role="columnheader">Dials</span><span role="columnheader">Contact</span>
              <span role="columnheader">Appts</span><span role="columnheader">Adherence</span><span role="columnheader">Open</span>
              <span role="columnheader">Aging</span><span role="columnheader">Evidenced</span>
              <span role="columnheader">Gone quiet</span><span role="columnheader">Do something</span>
            </div>
            {unit.map(u => <AgentRow key={u.ag.id} ag={u.ag} m={u.m} lightest={lightest.name}
              onJoint={(ag) => openAsk('joint', ag)} onReassign={(ag) => openAsk('reassign', ag)}
              onNudge={(ag) => store.nudge(ag.name, 'check in — manager nudge from the unit desk')} />)}
          </div>
        </section>

        <div className="mg-two">
          <section className="mg-card">
            <div className="mg-card-h"><span className="pf-eb">WAITING ON YOU</span><span className="mg-card-note">{exceptions.length} open</span></div>
            <div className="mg-exc">
              {exceptions.length === 0
                ? <div className="ap-empty"><b>Nothing needs a decision</b><span>Floor met, no aging leads, no approvals pending.</span></div>
                : exceptions.map(x => (
                  <div key={x.id} className="mg-exc-row">
                    <span className="mg-exc-dot" style={{ background: x.tone }}></span>
                    <span className="mg-exc-kind" style={{ color: x.tone }}>{x.kind}</span>
                    <span className="mg-exc-msg">{x.msg}</span>
                    <button className="mg-act" onClick={x.run}>{x.act}</button>
                  </div>
                ))}
            </div>
          </section>

          <section className="mg-card">
            <div className="mg-card-h"><span className="pf-eb">LISTS THAT CAME IN</span><span className="mg-card-note">{store.batches.length} import{store.batches.length === 1 ? '' : 's'}</span></div>
            <div className="mg-batches">
              {store.batches.length === 0
                ? <div className="ap-empty"><span className="ap-empty-ic"><IconUpload size={22} /></span>
                    <b>No lists imported yet</b><span>Drop a spreadsheet and it splits across the unit.</span>
                    <button className="pb pb-pri" style={{ marginTop: 12 }} onClick={() => onGoto('Bulk Import')}>Import a list</button></div>
                : store.batches.map(b => (
                  <div key={b.id} className="mg-batch">
                    <span className="mg-batch-h"><b>{b.file}</b><i>{b.at}</i></span>
                    <span className="mg-batch-m">{b.count} leads → {b.queue}{b.skipped ? ' · ' + b.skipped + ' left out' : ''}</span>
                    <span className="mg-batch-split">
                      {Object.entries(b.perAgent).sort((x, y) => y[1] - x[1]).map(([n, c]) => (
                        <span key={n} className="mg-batch-ag">{n.split(' ')[0]} <i>{c}</i></span>
                      ))}
                    </span>
                    <button className="mg-act" onClick={() => store.undoImport(b.id)}>Undo</button>
                  </div>
                ))}
            </div>
          </section>
        </div>
        <p className="rc-fine">Every action here writes through the same sync store the agent screens use — a joint call lands in the agent's action plan as a real block to schedule, a reassign moves the lead out of one dialer queue and into another, and both show up in the activity feed.</p>
      </div>

      {ask && (
        <div className="ov" role="dialog" aria-modal="true" aria-label={ask.kind === 'joint' ? 'Book a joint call' : 'Reassign leads'} onClick={(e) => { if (e.target === e.currentTarget) setAsk(null); }}>
          <div className="ov-scrim"></div>
          <div className="ov-panel mg-ask">
            <div className="ov-head">
              <MAvatar initials={ask.ag.initials} size={34} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="ov-title">{ask.kind === 'joint' ? 'Joint call with ' + ask.ag.name : 'Move leads off ' + ask.ag.name}</span>
                <span className="ov-sub">{ask.ag.area} · {ask.ag.open} open leads</span>
              </span>
              <button className="ov-x" onClick={() => setAsk(null)} aria-label="Close"><MIcon name="plus" size={16} style={{ transform: 'rotate(45deg)' }} /></button>
            </div>
            <div className="ov-body">
              {ask.kind === 'joint' ? (
                <>
                  <label className="fld"><span className="fld-lab">What is the joint call for</span>
                    <select className="ap-in" value={jointWhat} onChange={(e) => setJointWhat(e.target.value)}>
                      <option>Closing interview — needs a second voice</option>
                      <option>Fact find — coaching on the questions</option>
                      <option>Annuity case — product depth</option>
                      <option>Objection handling — recent lost case</option>
                    </select>
                  </label>
                  <p className="ov-note">This is an offer, not a booking. {ask.ag.name.split(' ')[0]} can accept it — and it lands in their plan as a 1.5-hour block to schedule — or decline it, in which case nothing is created and nothing is recorded. A decline that trends somewhere is not a decline.</p>
                </>
              ) : (
                <>
                  <div className="mg-ask-grid">
                    <label className="fld"><span className="fld-lab">How many</span>
                      <input className="ap-in" type="number" min="1" max={ask.ag.open} value={moveN} onChange={(e) => setMoveN(Math.max(1, Math.min(ask.ag.open, Number(e.target.value) || 1)))} />
                    </label>
                    <label className="fld"><span className="fld-lab">To</span>
                      <select className="ap-in" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                        {active.filter(a => a.id !== ask.ag.id && a.canSell !== false).sort((a, b) => a.open - b.open).map(a => <option key={a.id} value={a.name}>{a.name} — {a.open} open</option>)}
                      </select>
                    </label>
                  </div>
                  <p className="ov-note">Oldest-first: the leads that have sat longest move, so a reassign clears the aging rather than skimming the fresh ones.</p>
                </>
              )}
            </div>
            <div className="ov-foot">
              <button className="pb pb-sec" onClick={() => setAsk(null)}>Cancel</button>
              <button className="pb pb-pri" onClick={() => {
                if (ask.kind === 'joint') store.offerJointCall(ask.ag.name, jointWhat);
                else store.reassignLeads(ask.ag.name, moveTo, moveN);
                setAsk(null);
              }}>{ask.kind === 'joint' ? 'Send the offer' : 'Move ' + moveN + ' to ' + moveTo.split(' ')[0]}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ManagerScreen, FLOOR });

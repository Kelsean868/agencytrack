// Prospect pipeline — a Kanban board over the stage data the app already keeps.
//
// WHAT IS TAKEN FROM ZOHO. The board shape: named stage columns, a count and a money
// total in each header, cards you drag between stages, and a won/lost end.
//
// WHAT IS DIFFERENT — and the biggest one is the object model. Zoho splits Contacts
// from Deals for a reason: a person has one relationship but can generate several
// cases. Here the pipeline is PER PROSPECT up to the closing interview and PER
// APPLICATION after it:
//
//   Approach · Fact find · Closing interview   \u2192  prospect cards (the person)
//   Application · Delivery · Client            \u2192  application cards (the case)
//
// So Marsha can have one prospect card for Kareem and two application cards under
// him — term on him, an annuity on his wife — each with its own policy number,
// premium, underwriting outcome and delivery. A board that only tracked the prospect
// could not represent that at all, and would have to pick one case to show.
//
// NO "LEADS" COLUMN, deliberately. An uncontacted lead is a list to work, not a case
// in progress, and it already has a home in the dialer queue. A Leads column would be
// a second place to work the same 25 imported names, and the board would be mostly
// holding pen. The board starts where contact has been made.
//
// THE LEDGER TIE. Delivery is the join. An application delivered and receipted writes
// a policy row, which is what the clients export reads and what moves the settled
// figure on the game plan. Nothing else in the app writes a policy.
//
// THE MANAGER SEES COLUMN COUNTS, NEVER CARDS — same rule as the stall count.
const { Icon: PpIcon, Avatar: PpAvatar } = window.AgencyTrackDesignSystem_ad1cd7;

const STAGES = [
  { k: 'Approach', lab: 'Approach', hint: 'Contact made, nothing booked', of: 'prospect' },
  { k: 'FFI', lab: 'Fact find', hint: 'Needs and numbers being gathered', of: 'prospect' },
  { k: 'CI', lab: 'Closing interview', hint: 'Recommendation on the table', of: 'prospect' },
  { k: 'App', lab: 'Application', hint: 'Signed \u00b7 with underwriting', of: 'application' },
  { k: 'Delivery', lab: 'Delivery', hint: 'Issued \u00b7 on the delivery register', of: 'application' },
  { k: 'Client', lab: 'Client', hint: 'Delivered \u00b7 in the ledger', of: 'application' },
];

const EXPECTED = { 'Whole Life': 4800, 'Term Life': 3200, 'IUL': 6400, 'Critical Illness': 3600, 'Annuity': 22000, 'Final Expense': 2400, 'Medicare': 1800, 'Undetermined': 3200 };
const expectedApi = (lead) => EXPECTED[lead.need] || 3200;

// ONE predicate for what is on the board, and PARKED is its single source of truth
// rather than a second hand-maintained list. In play is the inverse of parked, which
// keeps `worked` (called, still open) and `success` (appointment set) on the board.
const PARKED = { archived: 'Archived \u00b7 3 months', closed: 'Declined', dead: 'Dead', eliminated: 'Cleared off' };
const inPlay = (l) => !PARKED[l.status];
const parkedOf = (leads) => leads.filter(l => PARKED[l.status]);
// Prospect columns only ever hold prospects still in the prospect half.
const inStage = (leads, k) => leads.filter(l => inPlay(l) && (l.stage || 'Approach') === k);
const appsIn = (apps, k) => (apps || []).filter(a => a.stage === k);

function ProspectCard({ lead, onDragStart, onOpen }) {
  const s = stallOf(lead);
  return (
    <div className={'pk-card' + (s.stalled ? ' is-stalled' : '')} draggable
      onDragStart={(e) => onDragStart(e, { kind: 'lead', lead })} onClick={() => onOpen(lead)}
      title={lead.name + ' \u00b7 ' + lead.need}>
      <div className="pk-card-h">
        <PpAvatar initials={lead.name.split(' ').map(w => w[0]).join('').slice(0, 2)} size={26} />
        <span className="pk-nm" title={lead.name}>{lead.name}</span>
        {s.stalled && <span className="pk-flag" title={s.t + ' touches and ' + s.d + ' days without moving'}>QUIET</span>}
        {s.snoozed && <span className="pk-flag is-snz" title="Snoozed \u2014 the reminder is paused, the history is not">PAUSED</span>}
      </div>
      <div className="pk-meta">
        <span className="pk-need">{lead.need}</span>
        <span className="pk-api">{ttd(expectedApi(lead))}</span>
      </div>
      <div className="pk-foot">
        <span className="pk-src">{lead.source}</span>
        <span className="pk-age">{s.d ? s.d + 'd in stage' : 'new'}</span>
      </div>
    </div>
  );
}

// An application card is the case, not the person — so it carries the policy number
// and the underwriting standing rather than a source and a touch count.
function AppCard({ app, onDragStart, onOpen }) {
  return (
    <div className="pk-card is-app" draggable
      onDragStart={(e) => onDragStart(e, { kind: 'app', app })} onClick={() => onOpen(app)}
      title={app.client + ' \u00b7 ' + app.policyNo}>
      <div className="pk-card-h">
        <span className="pk-pol">{app.policyNo}</span>
        {app.stage === 'Delivery' && <span className="pk-flag is-del" title="Issued and awaiting delivery">DELIVER</span>}
        {app.stage === 'Client' && <span className="pk-flag is-won" title={'Delivered ' + app.deliveredOn}>SETTLED</span>}
      </div>
      <span className="pk-nm" title={app.client}>{app.client}</span>
      <div className="pk-meta">
        <span className="pk-need">{app.product}</span>
        <span className="pk-api">{ttd(app.api)}</span>
      </div>
      <div className="pk-foot">
        <span className="pk-src" title={app.underwriting}>{app.underwriting}</span>
        <span className="pk-age">{app.deliveredOn || app.issuedOn || app.appliedOn}</span>
      </div>
    </div>
  );
}

function AgentBoard({ store }) {
  const { useState } = React;
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [apply, setApply] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [appSheet, setAppSheet] = useState(null);

  const onDragStart = (e, payload) => { try { e.dataTransfer.effectAllowed = 'move'; } catch (x) {} setDrag(payload); };
  const drop = (k) => {
    setOver(null);
    const d = drag; setDrag(null);
    if (!d) return;
    const target = STAGES.find(s => s.k === k);
    if (d.kind === 'lead') {
      // Crossing into the application half creates a case rather than moving a person.
      if (target.of === 'application') setApply(d.lead);
      else store.advanceStage(d.lead.id, k);
      return;
    }
    if (target.of !== 'application') return;         // an application cannot go back to being a prospect
    if (k === 'Client') store.deliverApplication(d.app.id);
    else store.advanceApplication(d.app.id, k);
  };

  return (
    <>
      <div className="pk">
        {STAGES.map(st => {
          const leads = st.of === 'prospect' ? inStage(store.leads, st.k) : [];
          const apps = st.of === 'application' ? appsIn(store.applications, st.k) : [];
          const n = leads.length + apps.length;
          const value = leads.reduce((t, l) => t + expectedApi(l), 0) + apps.reduce((t, a) => t + a.api, 0);
          return (
            <section key={st.k} className={'pk-col' + (over === st.k ? ' is-over' : '') + (st.k === 'Client' ? ' is-won' : '') + (st.of === 'application' ? ' is-appcol' : '')}
              onDragOver={(e) => { e.preventDefault(); if (over !== st.k) setOver(st.k); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
              onDrop={(e) => { e.preventDefault(); drop(st.k); }}>
              <div className="pk-h">
                <span className="pk-h-t"><b>{st.lab}</b><i>{n}</i></span>
                <span className="pk-h-v">{ttd(value)}</span>
                <span className="pk-h-hint">{st.hint}</span>
              </div>
              <div className="pk-body">
                {n === 0
                  ? <span className="pk-empty">{over === st.k ? 'Drop to move here' : 'Nothing here'}</span>
                  : <>
                    {leads.map(l => <ProspectCard key={l.id} lead={l} onDragStart={onDragStart} onOpen={setSheet} />)}
                    {apps.map(a => <AppCard key={a.id} app={a} onDragStart={onDragStart} onOpen={setAppSheet} />)}
                  </>}
              </div>
            </section>
          );
        })}
      </div>
      <p className="rc-fine">The first three columns hold <b>people</b>; the last three hold <b>applications</b>, because one prospect can put in more than one case. Dragging a prospect into Application writes the case and asks for the premium; dragging that case into Delivery puts it on the delivery register; dragging it into Client delivers and receipts it, which is the only thing in the app that writes a policy into the ledger \u2014 and what moves the settled figure on your game plan.</p>
      <ParkedRow store={store} />

      {apply && <ApplySheet lead={apply} store={store} onClose={() => setApply(null)} />}
      {sheet && <CardSheet lead={sheet} store={store} onClose={() => setSheet(null)} onApply={() => { setSheet(null); setApply(sheet); }} />}
      {appSheet && <AppSheet app={appSheet} store={store} onClose={() => setAppSheet(null)} />}
    </>
  );
}

function ParkedRow({ store }) {
  const { useState } = React;
  const [open, setOpen] = useState(false);
  const rows = parkedOf(store.leads);
  if (!rows.length) return null;
  return (
    <div className={'pk-parked' + (open ? ' is-open' : '')}>
      <button className="pk-parked-h" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="pk-parked-n">{rows.length}</span>
        <b>Parked — off the board, still on the record</b>
        <span>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="pk-parked-list">
          {rows.map(l => (
            <span key={l.id} className="pk-parked-item" title={l.name + ' \u00b7 ' + PARKED[l.status] + (l.eliminatedFor ? ' \u00b7 ' + l.eliminatedFor : '')}>
              <b>{l.name}</b><i>{PARKED[l.status]}</i>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ApplySheet({ lead, store, onClose }) {
  const { useState } = React;
  const [api, setApi] = useState(expectedApi(lead));
  const [product, setProduct] = useState(lead.need === 'Undetermined' ? 'Whole Life' : lead.need);
  const [policyNo, setPolicyNo] = useState('TL-0' + (9300 + Math.floor(Math.random() * 600)));
  const existing = (store.applications || []).filter(a => a.leadId === lead.id);
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-label="Submit an application" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ov-scrim"></div>
      <div className="ov-panel pk-sheet">
        <div className="ov-head">
          <PpAvatar initials={lead.name.split(' ').map(w => w[0]).join('').slice(0, 2)} size={34} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="ov-title" style={{ display: 'block' }}>Application for {lead.name}</span>
            <span className="ov-sub" style={{ display: 'block' }}>{existing.length ? existing.length + ' already in progress for this prospect' : 'The case, not the person — a prospect can have several'}</span>
          </span>
          <button className="ov-x" onClick={onClose} aria-label="Close"><PpIcon name="plus" size={16} style={{ transform: 'rotate(45deg)' }} /></button>
        </div>
        <div className="ov-body">
          <div className="pk-grid">
            <label className="fld"><span className="fld-lab">Policy number</span>
              <input className="ap-in" value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} />
            </label>
            <label className="fld"><span className="fld-lab">Product</span>
              <select className="ap-in" value={product} onChange={(e) => setProduct(e.target.value)}>
                {NEED_OPTIONS.filter(n => n !== 'Undetermined').map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="fld"><span className="fld-lab">Annual premium (TTD)</span>
              <input className="ap-in" type="number" min="0" value={api} onChange={(e) => setApi(e.target.value)} />
            </label>
          </div>
          {existing.length > 0 && (
            <div className="pk-exist">
              {existing.map(a => <span key={a.id}>{a.policyNo} · {a.product} · {ttd(a.api)} · {a.stage}</span>)}
            </div>
          )}
          <p className="ov-note">Submitting does not settle anything. The case goes to Application with underwriting outstanding; it becomes a policy in the ledger only once it is issued, delivered and receipted.</p>
        </div>
        <div className="ov-foot">
          <button className="pb pb-sec" onClick={onClose}>Cancel</button>
          <button className="pb pb-pri" disabled={!policyNo.trim() || !Number(api)}
            onClick={() => { store.createApplication(lead.id, { policyNo: policyNo.trim(), product, api }); onClose(); }}>
            <PpIcon name="check" size={15} /> Submit the application
          </button>
        </div>
      </div>
    </div>
  );
}

function AppSheet({ app, store, onClose }) {
  const settled = app.stage === 'Client';
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-label={app.policyNo} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ov-scrim"></div>
      <div className="ov-panel pk-sheet">
        <div className="ov-head">
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="ov-title" style={{ display: 'block' }}>{app.policyNo}</span>
            <span className="ov-sub" style={{ display: 'block' }}>{app.client} · {app.product} · {ttd(app.api)}</span>
          </span>
          <button className="ov-x" onClick={onClose} aria-label="Close"><PpIcon name="plus" size={16} style={{ transform: 'rotate(45deg)' }} /></button>
        </div>
        <div className="ov-body">
          <div className="pk-trail">
            <span><b>Applied</b>{app.appliedOn}</span>
            <span className={app.issuedOn ? '' : 'is-pending'}><b>Issued</b>{app.issuedOn || 'with underwriting'}</span>
            <span className={app.deliveredOn ? '' : 'is-pending'}><b>Delivered</b>{app.deliveredOn || 'not yet'}</span>
          </div>
          <p className={'ov-note' + (settled ? '' : ' ov-note-warn')}>{settled
            ? 'Delivered and receipted. There is a policy row in the ledger for this case, and its premium is counted in your settled figure.'
            : 'Underwriting: ' + app.underwriting + '. Nothing counts as settled business until the policy is physically delivered and receipted — an undelivered policy is the commonest way a case is lost after it was already won.'}</p>
        </div>
        <div className="ov-foot">
          <button className="pb pb-sec" onClick={onClose}>Close</button>
          {app.stage === 'App' && <button className="pb pb-pri" onClick={() => { store.advanceApplication(app.id, 'Delivery'); onClose(); }}>Mark issued</button>}
          {app.stage === 'Delivery' && <button className="pb pb-pri" onClick={() => { store.deliverApplication(app.id); onClose(); }}>Delivered and receipted</button>}
        </div>
      </div>
    </div>
  );
}

function CardSheet({ lead, store, onClose, onApply }) {
  const s = stallOf(lead);
  const here = STAGES.findIndex(x => x.k === (lead.stage || 'Approach'));
  const mine = (store.applications || []).filter(a => a.leadId === lead.id);
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-label={lead.name} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ov-scrim"></div>
      <div className="ov-panel pk-sheet">
        <div className="ov-head">
          <PpAvatar initials={lead.name.split(' ').map(w => w[0]).join('').slice(0, 2)} size={34} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="ov-title" style={{ display: 'block' }}>{lead.name}</span>
            <span className="ov-sub" style={{ display: 'block' }}>{lead.need} · {lead.location} · {lead.phone}</span>
          </span>
          <button className="ov-x" onClick={onClose} aria-label="Close"><PpIcon name="plus" size={16} style={{ transform: 'rotate(45deg)' }} /></button>
        </div>
        <div className="ov-body">
          <div className="pk-steps">
            {STAGES.filter(st => st.of === 'prospect').map((st, i) => (
              <button key={st.k} className={'pk-step' + (i === here ? ' is-on' : i < here ? ' is-done' : '')}
                onClick={() => { store.advanceStage(lead.id, st.k); onClose(); }} title={'Move to ' + st.lab}>
                {st.lab}
              </button>
            ))}
          </div>
          {mine.length > 0 && (
            <div className="pk-exist">
              {mine.map(a => <span key={a.id}>{a.policyNo} · {a.product} · {ttd(a.api)} · {a.stage}</span>)}
            </div>
          )}
          <p className="ov-note">{s.stalled
            ? s.t + ' touches and ' + s.d + ' days at this stage without moving. Moving it clears that; so does clearing it off the list.'
            : s.d ? s.d + ' days at this stage, ' + s.t + ' touches since it last moved.' : 'Just entered this stage.'}</p>
        </div>
        <div className="ov-foot">
          <button className="pb pb-sec" onClick={onClose}>Close</button>
          <button className="pb pb-sec" onClick={() => { store.escalateLead(lead.id, 'Stuck at ' + (lead.stage || 'Approach')); onClose(); }}>Joint call</button>
          <button className="pb pb-pri" onClick={onApply}><PpIcon name="plus" size={15} /> {mine.length ? 'Another application' : 'Write an application'}</button>
        </div>
      </div>
    </div>
  );
}

function ManagerFunnel({ store }) {
  const cols = STAGES.map(st => ({
    st, n: st.of === 'prospect' ? inStage(store.leads, st.k).length : appsIn(store.applications, st.k).length,
  }));
  const max = Math.max(1, ...cols.map(c => c.n));
  return (
    <div className="pf">
      {cols.map(({ st, n }) => (
        <div key={st.k} className="pf-row">
          <span className="pf-lab"><b>{st.lab}</b><span>{st.hint}</span></span>
          <span className="pf-bar"><i style={{ width: (n / max * 100) + '%', background: st.k === 'Client' ? 'var(--success)' : st.of === 'application' ? 'var(--goldInk)' : 'var(--teal)' }}></i></span>
          <b className="pf-n">{n}</b>
        </div>
      ))}
      <p className="rc-fine">Counts, not cards. A prospect list is the agent&rsquo;s own — the visibility table says so and this screen keeps to it, so there is no drill-down here and none behind it. The teal bars count people, the gold ones count applications; a wide Delivery bar is the one worth asking about, because that is business already won and not yet banked.</p>
    </div>
  );
}

function PipelineScreen({ store, onGoto, role = 'agent', prefs = {} }) {
  const rows = store.leads.filter(inPlay);
  const apps = (store.applications || []).filter(a => a.stage !== 'Client');
  const value = rows.reduce((n, l) => n + expectedApi(l), 0) + apps.reduce((n, a) => n + a.api, 0);
  const toDeliver = appsIn(store.applications, 'Delivery').length;
  return (
    <div className="scr-wrap">
      <div className="scr-tool">
        <span className="scr-eyebrow">{role === 'manager' ? 'Unit funnel · shape only, no names' : role === 'pmanager' ? 'Producing manager · your book and the unit’s, in one week' : 'Pipeline · people, then applications'}</span>
        <span className="pl-stat">{rows.length} prospects · {apps.length} applications · {ttd(value)} in play</span>
        {toDeliver > 0 && <span className="pk-deliver-flag" title="Issued policies not yet delivered and receipted">{toDeliver} to deliver</span>}
        {role === 'agent' && <button className="pl-icbtn" onClick={() => onGoto('Lead Entry')}><PpIcon name="plus" size={14} /> Add a prospect</button>}      </div>
      {role === 'manager' ? <ManagerFunnel store={store} />
        : role === 'pmanager' ? <ProducingManagerPipeline store={store} onGoto={onGoto} prefs={prefs} />
          : <AgentBoard store={store} />}
    </div>
  );
}

Object.assign(window, { PipelineScreen, AgentBoard, ManagerFunnel, ParkedRow, STAGES, expectedApi, inStage, appsIn, inPlay, parkedOf, PARKED });

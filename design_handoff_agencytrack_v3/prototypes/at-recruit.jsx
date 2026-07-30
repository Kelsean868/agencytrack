// Recruiting pipeline — the same board shape as prospects, with the privacy answer
// deliberately INVERTED.
//
// A prospect is the agent's own asset: the board is theirs, and a manager sees counts
// only. A recruit is the COMPANY's relationship — the candidate applies to the agency,
// the agency interviews, contracts, licenses and pays them — so the manager's board is
// legitimately named, and there is nothing to hide behind a count. Running recruits
// through the prospect pipeline would collapse that distinction, which is the whole
// reason this is a separate object rather than a lead with a different stage.
//
// THE MIRROR OF THE LEDGER TIE. A prospect ends as a policy row; a recruit ends as a
// row in the unit ROSTER. "Producing" is the join, and it is deliberately the last
// stage rather than "Contracted" — a contracted recruit who never writes a case is a
// cost, not a hire, and a recruiting board that stops at the signature hides that.
//
// A SPONSORING AGENT sees only the people they brought in. That is the one place a
// recruit is partly the agent's own — they get credit for the referral and a view of
// how it is going, without a window into the unit's whole intake.
const { Icon: RcIcon, Avatar: RcAvatar } = window.AgencyTrackDesignSystem_ad1cd7;

const R_STAGES = [
  { k: 'Candidate', lab: 'Candidate', hint: 'Name in, not yet interviewed' },
  { k: 'Interview', lab: 'Career interview', hint: 'Sitting down with the unit' },
  { k: 'Selected', lab: 'Selected', hint: 'Offered \u00b7 exam and requirements' },
  { k: 'Contracted', lab: 'Contracted', hint: 'Signed with the company' },
  { k: 'Licensed', lab: 'Licensed', hint: 'Registered and ready to sell' },
  { k: 'Producing', lab: 'Producing', hint: 'First case written \u00b7 on the roster' },
];
const EXAM_TONE = (e) => /passed/.test(e) ? 'is-ok' : /booked/.test(e) ? 'is-soon' : '';
const rIn = (recruits, k) => (recruits || []).filter(r => r.stage === k);
// A recruit stuck this long at one stage is the recruiting equivalent of a stalled
// thread — and unlike prospects, the fix is almost always the manager's to make.
const R_STALL_DAYS = 21;

function RecruitCard({ rec, onDragStart, onOpen }) {
  const stuck = rec.days >= R_STALL_DAYS && rec.stage !== 'Producing';
  return (
    <div className={'pk-card is-rec' + (stuck ? ' is-stalled' : '')} draggable
      onDragStart={(e) => onDragStart(e, rec)} onClick={() => onOpen(rec)}
      title={rec.name + ' \u00b7 ' + rec.source}>
      <div className="pk-card-h">
        <RcAvatar initials={rec.name.split(' ').map(w => w[0]).join('').slice(0, 2)} size={26} />
        <span className="pk-nm" title={rec.name}>{rec.name}</span>
        {stuck && <span className="pk-flag" title={rec.days + ' days at this stage'}>SLOW</span>}
      </div>
      <div className="pk-meta">
        <span className="pk-need">{rec.area}</span>
        <span className={'rc-exam ' + EXAM_TONE(rec.exam)} title={'Licensing exam: ' + rec.exam}>{rec.exam}</span>
      </div>
      <div className="pk-foot">
        <span className="pk-src" title={rec.sponsor ? 'Sponsored by ' + rec.sponsor : rec.source}>{rec.sponsor ? rec.sponsor.split(' ')[0] + ' sponsored' : rec.source}</span>
        <span className="pk-age">{rec.days}d in stage</span>
      </div>
    </div>
  );
}

function RecruitSheet({ rec, store, onClose }) {
  const { useState } = React;
  const here = R_STAGES.findIndex(s => s.k === rec.stage);
  const stuck = rec.days >= R_STALL_DAYS && rec.stage !== 'Producing';
  const user = (store.agents || []).find(a => a.recruitId === rec.id);
  const [form, setForm] = useState({
    agentCode: 'A-' + (1400 + Math.floor(Math.random() * 200)),
    branch: BRANCHES[0].k, unit: BRANCHES[0].units[0], role: 'Associate',
    regNo: 'FSC-2' + (3000 + Math.floor(Math.random() * 900)),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v, ...(k === 'branch' ? { unit: (BRANCHES.find(b => b.k === v) || BRANCHES[0]).units[0] } : {}) }));
  const branch = BRANCHES.find(b => b.k === form.branch) || BRANCHES[0];

  // The three joins, in order. Contracting is where the person becomes a USER with a
  // place in the org; licensing is the gate that lets work be handed to them;
  // producing only retires the new-joiner grace.
  const step = rec.stage === 'Selected' ? 'contract' : rec.stage === 'Contracted' ? 'license' : rec.stage === 'Licensed' ? 'produce' : null;

  return (
    <div className="ov" role="dialog" aria-modal="true" aria-label={rec.name} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ov-scrim"></div>
      <div className="ov-panel pk-sheet">
        <div className="ov-head">
          <RcAvatar initials={rec.name.split(' ').map(w => w[0]).join('').slice(0, 2)} size={34} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="ov-title" style={{ display: 'block' }}>{rec.name}</span>
            <span className="ov-sub" style={{ display: 'block' }}>{rec.area} · {rec.phone} · {rec.source}</span>
          </span>
          <button className="ov-x" onClick={onClose} aria-label="Close"><RcIcon name="plus" size={16} style={{ transform: 'rotate(45deg)' }} /></button>
        </div>
        <div className="ov-body">
          <div className="pk-steps">
            {R_STAGES.map((st, i) => (
              <button key={st.k} className={'pk-step' + (i === here ? ' is-on' : i < here ? ' is-done' : '')}
                onClick={() => { if (i < here) { store.advanceRecruit(rec.id, st.k); onClose(); } }}
                disabled={i >= here}
                title={i > here ? 'Use the action below — moving forward creates or changes their user account' : i === here ? 'Where they are now' : 'Back to ' + st.lab}>
                {st.lab}
              </button>
            ))}
          </div>

          {user && (
            <div className="rc-user">
              <span className="pf-eb">USER ACCOUNT</span>
              <div className="pk-trail rc-trail">
                <span><b>Agent code</b>{user.agentCode}</span>
                <span><b>Unit</b>{user.unit}</span>
                <span><b>Branch</b>{user.branch}</span>
                <span className={user.licensed ? '' : 'is-pending'}><b>Licence</b>{user.regNo || 'not registered'}</span>
                <span className={user.canSell ? '' : 'is-pending'}><b>Can hold leads</b>{user.canSell ? 'yes' : 'not until licensed'}</span>
                <span className={user.producing ? '' : 'is-pending'}><b>In the unit floor</b>{user.producing ? 'yes' : 'not until producing'}</span>
              </div>
            </div>
          )}

          {!user && (
            <div className="pk-trail">
              <span><b>Source</b>{rec.source}</span>
              <span className={rec.sponsor ? '' : 'is-pending'}><b>Sponsor</b>{rec.sponsor || 'none — unit intake'}</span>
              <span className={/passed/.test(rec.exam) ? '' : 'is-pending'}><b>Exam</b>{rec.exam}</span>
            </div>
          )}

          {step === 'contract' && (
            <div className="rc-form">
              <span className="pf-eb">CONTRACT — CREATES THEIR USER ACCOUNT</span>
              <div className="pk-grid">
                <label className="fld"><span className="fld-lab">Agent code</span>
                  <input className="ap-in" value={form.agentCode} onChange={(e) => set('agentCode', e.target.value)} />
                </label>
                <label className="fld"><span className="fld-lab">Branch</span>
                  <select className="ap-in" value={form.branch} onChange={(e) => set('branch', e.target.value)}>
                    {BRANCHES.map(b => <option key={b.k} value={b.k}>{b.lab}</option>)}
                  </select>
                </label>
                <label className="fld"><span className="fld-lab">Unit</span>
                  <select className="ap-in" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                    {branch.units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
              </div>
              <p className="ov-note">This is the identity event, not Producing. {rec.name.split(' ')[0]} joins the roster now with a code, a login and a place in the unit — but cannot be assigned a single lead until the licence is registered, and is not counted in the unit floor until the first case is written.</p>
            </div>
          )}

          {step === 'license' && (
            <div className="rc-form">
              <span className="pf-eb">LICENCE — UNLOCKS LEAD ASSIGNMENT</span>
              <label className="fld"><span className="fld-lab">Registration number</span>
                <input className="ap-in" value={form.regNo} onChange={(e) => set('regNo', e.target.value)} />
              </label>
              <p className="ov-note">Until this is entered {rec.name.split(' ')[0]} is excluded from every distribution target — round robin, balance by load and the single-agent picker on bulk import all read the licence, so an unlicensed agent cannot be handed work by accident.</p>
            </div>
          )}

          {!step && (
            <p className={'ov-note' + (stuck ? ' ov-note-warn' : '')}>{stuck
              ? rec.days + ' days at ' + rec.stage + '. On the prospect side a stall is the agent\u2019s to resolve; here it is almost always yours \u2014 an exam not booked, a requirement not chased, an interview not scheduled.'
              : rec.days + ' days at ' + rec.stage + '.'}</p>
          )}
        </div>
        <div className="ov-foot">
          <button className="pb pb-sec" onClick={onClose}>Close</button>
          {rec.sponsor && <button className="pb pb-sec" onClick={() => { store.offerJointCall(rec.sponsor, 'Joint call with ' + rec.name.split(' ')[0] + ' \u2014 their recruit, your experience'); onClose(); }}>Joint call</button>}
          {rec.stage === 'Candidate' && <button className="pb pb-pri" onClick={() => { store.advanceRecruit(rec.id, 'Interview'); onClose(); }}>Book the interview</button>}
          {rec.stage === 'Interview' && <button className="pb pb-pri" onClick={() => { store.advanceRecruit(rec.id, 'Selected'); onClose(); }}>Select them</button>}
          {step === 'contract' && <button className="pb pb-pri" disabled={!form.agentCode.trim()} onClick={() => { store.contractRecruit(rec.id, form); onClose(); }}>Contract · create the account</button>}
          {step === 'license' && <button className="pb pb-pri" disabled={!form.regNo.trim()} onClick={() => { store.licenseRecruit(rec.id, form); onClose(); }}>Register the licence</button>}
          {step === 'produce' && <button className="pb pb-pri" onClick={() => { store.activateRecruit(rec.id); onClose(); }}>First case written</button>}
        </div>
      </div>
    </div>
  );
}

function RecruitBoard({ store, mine }) {
  const { useState } = React;
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [sheet, setSheet] = useState(null);
  const pool = mine ? (store.recruits || []).filter(r => r.sponsor === mine) : store.recruits;

  const drop = (k) => {
    setOver(null);
    const d = drag; setDrag(null);
    if (!d) return;
    const from = R_STAGES.findIndex(x => x.k === d.stage), to = R_STAGES.findIndex(x => x.k === k);
    // A forward move into Contracted / Licensed / Producing creates or changes a user
    // account, so it goes through the sheet. A drag cannot provision anybody.
    if (to > from && ['Contracted', 'Licensed', 'Producing'].includes(k)) { setSheet(d); return; }
    store.advanceRecruit(d.id, k);
  };

  return (
    <>
      <div className="pk">
        {R_STAGES.map(st => {
          const rows = rIn(pool, st.k);
          const slow = rows.filter(r => r.days >= R_STALL_DAYS && st.k !== 'Producing').length;
          return (
            <section key={st.k} className={'pk-col' + (over === st.k ? ' is-over' : '') + (st.k === 'Producing' ? ' is-won' : '')}
              onDragOver={(e) => { e.preventDefault(); if (over !== st.k) setOver(st.k); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
              onDrop={(e) => { e.preventDefault(); drop(st.k); }}>
              <div className="pk-h">
                <span className="pk-h-t"><b>{st.lab}</b><i>{rows.length}</i></span>
                <span className="pk-h-v">{slow ? slow + ' over ' + R_STALL_DAYS + ' days' : '\u2014'}</span>
                <span className="pk-h-hint">{st.hint}</span>
              </div>
              <div className="pk-body">
                {rows.length === 0
                  ? <span className="pk-empty">{over === st.k ? 'Drop to move here' : 'Nothing here'}</span>
                  : rows.map(r => <RecruitCard key={r.id} rec={r} onDragStart={(e, x) => { try { e.dataTransfer.effectAllowed = 'move'; } catch (z) {} setDrag(x); }} onOpen={setSheet} />)}
              </div>
            </section>
          );
        })}
      </div>
      <p className="rc-fine">{mine
        ? 'These are the people you brought in \u2014 your referrals only, not the unit\u2019s intake. You get credit for the introduction and a view of how it is going; the hiring decisions and the rest of the pipeline are the manager\u2019s.'
        : 'Named on purpose. A recruit applied to the agency, so this is the company\u2019s relationship rather than an agent\u2019s asset \u2014 the exact reverse of the prospect board, where a manager sees counts only. Dragging into Producing puts them on the unit roster, which is the recruiting equivalent of a policy reaching the ledger.'}</p>
      {sheet && <RecruitSheet rec={sheet} store={store} onClose={() => setSheet(null)} />}
    </>
  );
}

function RecruitScreen({ store, onGoto, role = 'manager' }) {
  const all = store.recruits || [];
  const mine = role === 'agent' ? 'Marsha Singh' : null;
  const pool = mine ? all.filter(r => r.sponsor === mine) : all;
  const producing = rIn(pool, 'Producing').length;
  const contracted = pool.filter(r => ['Contracted', 'Licensed'].includes(r.stage)).length;
  const slow = pool.filter(r => r.days >= R_STALL_DAYS && r.stage !== 'Producing').length;
  return (
    <div className="scr-wrap">
      <div className="scr-tool">
        <span className="scr-eyebrow">{mine ? 'My referrals · the people I brought in' : 'Recruiting · candidate to producing agent'}</span>
        <span className="pl-stat">{pool.length} in the pipeline · {contracted} signed not yet producing · {producing} producing</span>
        {slow > 0 && <span className="pk-deliver-flag" title={'Over ' + R_STALL_DAYS + ' days at one stage'}>{slow} slow</span>}
      </div>
      {pool.length === 0
        ? <div className="ap-empty" style={{ margin: 'auto', padding: '50px 20px' }}>
            <span className="ap-empty-ic"><RcIcon name="users" size={26} /></span>
            <b>No referrals of yours in the pipeline</b>
            <span>Recruits you introduce appear here, so you can see how your referral is progressing.</span>
          </div>
        : <RecruitBoard store={store} mine={mine} />}
    </div>
  );
}

Object.assign(window, { RecruitScreen, RecruitBoard, R_STAGES, rIn, R_STALL_DAYS });

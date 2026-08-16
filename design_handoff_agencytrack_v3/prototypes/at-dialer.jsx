// Dialer screen — ported from uploads/dialer-agencytrack-prototype.jsx onto DS
// tokens and the shared store. Call states ready → ringing → connected → wrapup,
// mute/pause, live timer, disposition + notes, and the 3-strike archive cycle
// (attempts >= 3 → archive; a lead already through 2 cycles is dead instead).
const { Icon, Avatar } = window.AgencyTrackDesignSystem_ad1cd7;
const { useState, useEffect, useRef } = React;

const IconPhone = (p) => <Icon {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></Icon>;
const IconPhoneOff = (p) => <Icon {...p}><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67" /><line x1="2" y1="2" x2="22" y2="22" /></Icon>;
const IconMic = (p) => <Icon {...p}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></Icon>;
const IconMicOff = (p) => <Icon {...p}><line x1="2" y1="2" x2="22" y2="22" /><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2M5 10v2a7 7 0 0 0 12 5" /><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" /><line x1="12" y1="19" x2="12" y2="22" /></Icon>;
const IconArchive = (p) => <Icon {...p}><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></Icon>;
const IconSkull = (p) => <Icon {...p}><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><path d="M8 20v2h8v-2M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4 2.5 5.5L8 20h8l.5-5.5C17.5 13 19 11.5 19 9a7 7 0 0 0-7-7z" /></Icon>;

const fmtDur = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

function QueueRow({ lead, active, onPick }) {
  const tone = lead.status === 'success' ? 'var(--success)' : lead.status === 'archived' ? 'var(--warning)'
    : lead.status === 'dead' ? 'var(--danger)' : lead.status === 'pending' ? 'var(--teal)' : 'var(--inkMute)';
  return (
    <button className={'qr' + (active ? ' is-active' : '')} onClick={() => onPick(lead.id)} aria-current={active ? 'true' : undefined}>
      <Avatar initials={lead.name.split(' ').map(w => w[0]).join('').slice(0, 2)} size={30} />
      <span className="qr-body">
        <span className="qr-nm" title={lead.name}>{lead.name}</span>
        <span className="qr-meta">{lead.need} · {lead.location}</span>
      </span>
      <span className="qr-right">
        <span className="qr-st" style={{ color: tone }}>{(lead.status || 'pending').toUpperCase()}</span>
        {lead.attempts > 0 && <span className="qr-att" title={lead.attempts + ' consecutive non-contacts'}>{lead.attempts}/3</span>}
      </span>
    </button>
  );
}

function DialerScreen({ store, onGoto, openLeadId, prefs = {}, currentHour }) {
  const { dialerQueue, leads, notifications } = store;
  const p = { liveNotes: true, talkTrack: true, followUpPrompt: true, archivePrompt: true, connectDefault: 'device', ...prefs };
  const [activeId, setActiveId] = useState(() => (dialerQueue[0] || leads[0] || {}).id);
  const [callState, setCallState] = useState('ready');
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dur, setDur] = useState(0);
  const [disposition, setDisposition] = useState('');
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState(p.connectDefault);
  const [followUp, setFollowUp] = useState(null);
  const [dismissed, setDismissed] = useState({});
  const stalled = stalledLeads(leads);
  const [sessionCalls, setSessionCalls] = useState(0);
  const [sessionSec, setSessionSec] = useState(0);
  const ring = useRef(null);

  const lead = leads.find(l => l.id === activeId) || leads[0];

  // Arriving from an Activities row: load that lead so the follow-up call is
  // closed as a call, with its duration and outcome, not ticked off as a task.
  useEffect(() => { if (openLeadId && leads.some(l => l.id === openLeadId)) setActiveId(openLeadId); }, [openLeadId]);

  useEffect(() => {
    let t;
    if (callState === 'connected' && !paused) t = setInterval(() => setDur(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [callState, paused]);
  useEffect(() => { const t = setInterval(() => setSessionSec(s => s + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => () => clearTimeout(ring.current), []);

  const start = () => { setCallState('ringing'); ring.current = setTimeout(() => setCallState('connected'), 1600); };
  const end = () => { clearTimeout(ring.current); setCallState('wrapup'); };

  const nonContact = NON_CONTACT.includes(disposition);
  const attemptsAfter = lead ? lead.attempts + (nonContact ? 1 : 0) : 0;
  const readyArchive = attemptsAfter >= 3 && lead && lead.cycleCount < 2;
  const readyDead = attemptsAfter >= 3 && lead && lead.cycleCount >= 2;

  const save = (opts = {}) => {
    if (!disposition || !lead) return;
    store.logCallOutcome(lead.id, disposition, { ...opts, notes, seconds: dur, via: method, atHour: currentHour, followUp: followUpPayload(lead, followUp) });
    setSessionCalls(c => c + 1);
    setDisposition(''); setNotes(''); setFollowUp(null); setCallState('ready'); setMuted(false); setPaused(false); setDur(0);
    const next = dialerQueue.find(l => l.id !== lead.id);
    if (next) setActiveId(next.id);
  };

  const worked = leads.filter(l => l.status !== 'pending').length;
  const wins = leads.filter(l => l.status === 'success').length;

  return (
    <div className="scr-wrap">
      <div className="scr-tool">
        <span className="scr-eyebrow">Call block · session {fmtDur(sessionSec)}</span>
        <span className="pl-stat">{dialerQueue.length} queued · {worked} worked · {wins} appointments</span>
        <button className="pl-icbtn" onClick={() => { store.finishCallBlock(Math.max(1, Math.round(sessionSec / 60)), sessionCalls); onGoto('Planner'); }}>
          <Icon name="check" size={14} /> Close block
        </button>
      </div>

      {notifications.length > 0 && p.archivePrompt && (
        <div className="dl-flags">
          {notifications.map(n => (
            <div key={n.id} className={'dl-flag' + (n.kind === 'dead' ? ' is-dead' : '')}>
              <span className="dl-flag-ic">{n.kind === 'dead' ? <IconSkull size={16} /> : <IconArchive size={16} />}</span>
              <span className="dl-flag-body"><b>{n.title}</b><span>{n.message}</span></span>
              <button className="pb pb-sec dl-flag-x" onClick={() => store.resolveNotification(n.id, false)}>Keep trying</button>
              <button className="pb pb-pri dl-flag-go" onClick={() => store.resolveNotification(n.id, true)}>{n.action}</button>
            </div>
          ))}
        </div>
      )}

      <JointOffers store={store} />
      {stalled.length > 0 && p.archivePrompt && (
        <div className="st-wrap">
          {stalled.filter(l => !dismissed[l.id]).slice(0, 1).map(l => (
            <StallCard key={l.id} lead={l} store={store} onClose={() => setDismissed(d => ({ ...d, [l.id]: true }))} />
          ))}
        </div>
      )}

      <div className="dl">
        {/* queue */}
        <aside className="dl-queue" aria-label="Call queue">
          <div className="dl-qh"><b>Queue</b><span>{dialerQueue.length} pending</span></div>
          <div className="dl-qlist">
            {leads.map(l => <QueueRow key={l.id} lead={l} active={l.id === activeId} onPick={setActiveId} />)}
          </div>
          <button className="pb pb-ghost dl-add" onClick={() => onGoto('Lead Entry')}><Icon name="plus" size={15} /> Add a lead</button>
        </aside>

        {/* call stage */}
        <div className="dl-stage">
          {!lead ? <div className="ap-empty"><b>Queue is clear</b><span>Add a lead to keep dialling.</span></div> : (
            <>
              <div className="dl-card">
                <div className="dl-who">
                  <Avatar initials={lead.name.split(' ').map(w => w[0]).join('').slice(0, 2)} size={54} />
                  <div style={{ minWidth: 0 }}>
                    <h2 className="dl-nm">{lead.name}</h2>
                    <div className="dl-sub">{lead.phone} · {lead.location}</div>
                    <div className="dl-chips">
                      <span className="dl-chip">{lead.need}</span>
                      <span className="dl-chip">{lead.source}</span>
                      <span className="dl-chip">{lead.queue}</span>
                      {lead.attempts > 0 && <span className="dl-chip dl-chip-warn">{lead.attempts} of 3 attempts</span>}
                      {lead.cycleCount > 0 && <span className="dl-chip dl-chip-warn">cycle {lead.cycleCount} of 2</span>}
                    </div>
                  </div>
                  <div className="dl-state">
                    <span className={'dl-badge dl-' + callState}>{callState === 'ready' ? 'READY' : callState === 'ringing' ? 'RINGING…' : callState === 'connected' ? 'CONNECTED' : 'WRAP-UP'}</span>
                    {(callState === 'connected' || callState === 'wrapup') && <span className="dl-timer">{fmtDur(dur)}</span>}
                  </div>
                </div>

                <div className="dl-controls">
                  {callState === 'ready' && (
                    <div className="dl-connect">
                      <ConnectPicker method={method} onMethod={setMethod} />
                      <PlaceCall lead={lead} method={method} onStart={start}
                        whatsAppText={'Good day ' + lead.name.split(' ')[0] + ' — Marsha here from Tatil Life South. Is now a good time for a quick word about your ' + lead.need.toLowerCase() + '?'} />
                    </div>
                  )}
                  {callState === 'ringing' && <button className="pb pb-sec dl-big" onClick={() => setCallState('ready')}><IconPhoneOff size={17} /> Cancel</button>}
                  {callState === 'connected' && (
                    <>
                      <button className="pb pb-sec dl-ic" onClick={() => setMuted(m => !m)} aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <IconMicOff size={17} /> : <IconMic size={17} />}</button>
                      <button className="pb pb-sec dl-ic" onClick={() => setPaused(p => !p)} aria-pressed={paused} aria-label={paused ? 'Resume timer' : 'Pause timer'}>{paused ? <IconPlay size={15} /> : <IconPause size={15} />}</button>
                      <button className="pb dl-end dl-big" onClick={end}><IconPhoneOff size={17} /> End call</button>
                    </>
                  )}
                  {callState === 'wrapup' && <span className="dl-wrapnote">Log the outcome to move to the next lead.</span>}
                </div>
              </div>

              {/* Live capture — notes and the talk track while the line is open, not
                  after. A note written mid-call is the one worth keeping. */}
              {(callState === 'ringing' || callState === 'connected') && (p.liveNotes || p.talkTrack) && (
                <div className={'dl-live' + (p.talkTrack && p.liveNotes ? '' : ' is-single')}>
                  {p.liveNotes && (
                  <div className="dl-live-notes">
                    <span className="pf-eb">NOTES · SAVING AS YOU TYPE</span>
                    <textarea className="dl-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder={'What ' + lead.name.split(' ')[0] + ' is telling you — dependants, existing cover, objections, the number they said…'}
                      aria-label="Call notes" autoFocus />
                    <span className="dl-live-count">{notes.trim() ? notes.trim().split(/\s+/).length + ' words on the record' : 'Nothing captured yet'}</span>
                  </div>
                  )}
                  {p.talkTrack && <TalkTrack need={lead.need} />}
                </div>
              )}

              {(callState === 'wrapup' || callState === 'ready') && (
                <div className="dl-wrap">
                  <span className="pf-eb">OUTCOME</span>
                  <div className="dl-disps">
                    {DISPOSITIONS.map(d => (
                      <button key={d} className={'dl-disp' + (disposition === d ? ' is-on' : '') + (NON_CONTACT.includes(d) ? ' is-nc' : '')}
                        onClick={() => setDisposition(d)} aria-pressed={disposition === d}>{d}</button>
                    ))}
                  </div>
                  <textarea className="dl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was said — this lands on the lead and in the activity feed…" aria-label="Call notes" />

                  {p.followUpPrompt && <FollowUp lead={lead} value={followUp} onChange={setFollowUp} />}


                  {readyArchive && (
                    <div className="dl-cycle">
                      <IconArchive size={16} />
                      <span>That's <b>3 consecutive non-contacts</b>. Archive {lead.name.split(' ')[0]} for 3 months and the attempt count resets for the next cycle.</span>
                    </div>
                  )}
                  {readyDead && (
                    <div className="dl-cycle is-dead">
                      <IconSkull size={16} />
                      <span>{lead.name.split(' ')[0]} has been through <b>2 archive cycles</b> with no contact. Mark the lead dead rather than archiving again.</span>
                    </div>
                  )}

                  <div className="dl-actions">
                    <button className="pb pb-pri" disabled={!disposition} onClick={() => save()}>
                      <Icon name="check" size={15} /> Save & next
                    </button>
                    {readyArchive && <button className="pb pb-sec" onClick={() => save({ archive: true })}><IconArchive size={15} /> Archive 3 months</button>}
                    {readyDead && <button className="pb pb-sec" onClick={() => save({ dead: true })}><IconSkull size={15} /> Mark dead</button>}
                  </div>
                  {followUp
                    ? <p className="ov-note"><Icon name="check" size={13} /> {followUpPayload(lead, followUp).title} — lands in the action plan for {FOLLOWUP_WHEN_LABEL[followUp.when]}, typed {followUpPayload(lead, followUp).type} so it counts toward the weekly floor.</p>
                    : <>
                      {disposition === 'Callback Requested' && <p className="ov-note"><Icon name="check" size={13} /> A "Call back {lead.name}" task will appear in the Planner's action plan.</p>}
                      {disposition === 'Appointment Set' && <p className="ov-note"><Icon name="check" size={13} /> This becomes a task in the action plan — drag it onto the Planner grid to book the time.</p>}
                    </>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DialerScreen, IconPhone, IconPhoneOff, IconArchive, IconSkull, fmtDur });

// Lead Entry screen — ported from uploads/lead-entry-agencytrack-prototype.jsx.
// Writes into the shared store, so a lead created here appears in the Dialer queue
// immediately. Queues can be created inline, and the recent list shows what the
// dialer will pick up next.
const { Icon, Avatar } = window.AgencyTrackDesignSystem_ad1cd7;
const { useState } = React;

const BLANK = { firstName: '', lastName: '', phone: '', email: '', location: '', need: 'Undetermined', source: 'Organic / Web', sourceDetails: '', queue: 'General Queue' };

function Field({ label, children, hint }) {
  return (
    <label className="fld">
      <span className="fld-lab">{label}</span>
      {children}
      {hint && <span className="fld-hint">{hint}</span>}
    </label>
  );
}

function LeadEntryScreen({ store, onGoto }) {
  const { queues, leads } = store;
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [newQueue, setNewQueue] = useState('');
  const [creatingQueue, setCreatingQueue] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const valid = form.firstName.trim() && form.lastName.trim() && form.phone.trim();

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setTimeout(() => {
      const lead = store.addLead(form);
      setSaving(false);
      setSaved(lead);
      setForm(f => ({ ...BLANK, queue: f.queue, source: f.source }));
      setTimeout(() => setSaved(null), 6000);
    }, 420);
  };

  const createQueue = () => {
    const n = newQueue.trim();
    if (!n || queues.includes(n)) return;
    store.addQueue(n);
    setForm(f => ({ ...f, queue: n }));
    setNewQueue(''); setCreatingQueue(false);
  };

  const recent = leads.slice(0, 6);

  return (
    <div className="scr-wrap">
      <div className="scr-tool">
        <span className="scr-eyebrow">New lead · goes straight to a call queue</span>
        <span className="pl-stat">{leads.filter(l => l.status === 'pending').length} pending in the dialer</span>
        <button className="pl-icbtn" onClick={() => onGoto('Dialer')}><IconPhone size={14} /> Open the dialer</button>
      </div>

      {saved && (
        <div className="le-toast">
          <span className="le-toast-ic"><Icon name="check" size={16} /></span>
          <span className="le-toast-body"><b>{saved.name} added to {saved.queue}</b><span>It's at the top of the dialer queue now.</span></span>
          <button className="pb pb-pri le-toast-go" onClick={() => onGoto('Dialer')}>Call now</button>
        </div>
      )}

      <div className="le">
        <form className="le-form" onSubmit={submit}>
          <div className="le-sec">
            <span className="pf-eb">WHO</span>
            <div className="le-grid">
              <Field label="First name"><input className="ap-in" value={form.firstName} onChange={set('firstName')} required /></Field>
              <Field label="Last name"><input className="ap-in" value={form.lastName} onChange={set('lastName')} required /></Field>
              <Field label="Phone" hint="The dialer calls this number"><input className="ap-in" value={form.phone} onChange={set('phone')} placeholder="(868) 000-0000" required /></Field>
              <Field label="Email"><input className="ap-in" type="email" value={form.email} onChange={set('email')} /></Field>
              <Field label="Area"><input className="ap-in" value={form.location} onChange={set('location')} placeholder="San Fernando" /></Field>
              <Field label="Need">
                <select className="ap-in" value={form.need} onChange={set('need')}>
                  {NEED_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <div className="le-sec">
            <span className="pf-eb">WHERE IT CAME FROM</span>
            <div className="le-grid">
              <Field label="Source" hint="Drives the source report">
                <select className="ap-in" value={form.source} onChange={set('source')}>
                  {SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Source detail" hint="Who referred, which seminar, which campaign">
                <input className="ap-in" value={form.sourceDetails} onChange={set('sourceDetails')} placeholder="Anand Persad" />
              </Field>
            </div>
          </div>

          <div className="le-sec">
            <span className="pf-eb">WHICH QUEUE</span>
            <div className="le-queues">
              {queues.map(q => (
                <button type="button" key={q} className={'le-q' + (form.queue === q ? ' is-on' : '')}
                  onClick={() => setForm(f => ({ ...f, queue: q }))} aria-pressed={form.queue === q}>
                  {q}<i>{leads.filter(l => l.queue === q && l.status === 'pending').length}</i>
                </button>
              ))}
              {creatingQueue ? (
                <span className="le-newq">
                  <input className="ap-in" value={newQueue} onChange={(e) => setNewQueue(e.target.value)} placeholder="Queue name" aria-label="New queue name" autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createQueue(); } if (e.key === 'Escape') setCreatingQueue(false); }} />
                  <button type="button" className="pb pb-pri le-newq-go" onClick={createQueue}><Icon name="check" size={14} /></button>
                </span>
              ) : (
                <button type="button" className="le-q le-q-add" onClick={() => setCreatingQueue(true)}><Icon name="plus" size={13} /> New queue</button>
              )}
            </div>
          </div>

          <div className="le-foot">
            <button className="pb pb-pri" type="submit" disabled={!valid || saving}>
              {saving ? 'Saving…' : <><Icon name="plus" size={15} /> Add to {form.queue}</>}
            </button>
            <button className="pb pb-sec" type="button" onClick={() => setForm(BLANK)}>Clear</button>
            {!store.online && <span className="le-offline">Offline — this will queue and send when the link returns.</span>}
          </div>
        </form>

        <aside className="le-side" aria-label="Recent leads">
          <div className="dl-qh"><b>Just added</b><span>{leads.length} total</span></div>
          <div className="dl-qlist">
            {recent.map(l => (
              <div key={l.id} className="qr" style={{ cursor: 'default' }}>
                <Avatar initials={l.name.split(' ').map(w => w[0]).join('').slice(0, 2)} size={30} />
                <span className="qr-body">
                  <span className="qr-nm">{l.name}</span>
                  <span className="qr-meta">{l.need} · {l.source}</span>
                </span>
                <span className="qr-right"><span className="qr-st" style={{ color: l.status === 'pending' ? 'var(--teal)' : 'var(--inkMute)' }}>{l.queue.split(' ')[0].toUpperCase()}</span></span>
              </div>
            ))}
          </div>
          <p className="rc-fine">Every lead here is what the dialer works through. Source and need come back out in the production report, so they are required at entry rather than patched later.</p>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { LeadEntryScreen });

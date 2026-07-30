// Call console pieces — how the call actually gets placed, and what gets captured
// while it is live. Two ideas from the research:
//
// 1. CONNECT METHOD. "Can the dialer ring the agent's own phone?" — yes, three
//    ways, and only one needs no backend. `tel:` hands the number to the device's
//    own dialer (native on mobile, needs a registered handler on desktop) and
//    `wa.me` opens WhatsApp — both ship today, both are already the pattern the
//    repo uses in RunningLateSheet. A bridge (provider dials the agent's mobile,
//    then joins the client) and an in-browser softphone both need a voice provider
//    and a server; they are shown here as real options with their cost stated, not
//    as buttons that quietly do nothing.
// 2. CAPTURE DURING, NOT AFTER. Zoho's call window takes the note and the
//    follow-up while the line is open. Notes written after hanging up are thinner,
//    and a follow-up deferred to a Tasks screen often never happens.
const { Icon: CCIcon } = window.AgencyTrackDesignSystem_ad1cd7;
const { useState } = React;

const IconWhatsApp = (p) => <CCIcon {...p}><path d="M20.5 3.5A11 11 0 0 0 3.2 17.1L2 22l5-1.3A11 11 0 1 0 20.5 3.5z" /><path d="M8.5 8.5c-.3 1.4.6 3 1.9 4.3 1.3 1.3 2.9 2.2 4.3 1.9l1-1.6-2-1-1 .8a7 7 0 0 1-2.4-2.4l.8-1-1-2-1.6 1z" /></CCIcon>;
const IconCopy = (p) => <CCIcon {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></CCIcon>;
const IconSpark = (p) => <CCIcon {...p}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></CCIcon>;

// Digits only, with the TT country code, for tel: and wa.me.
const dialDigits = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length === 10 ? '1' + d : d.length === 7 ? '1868' + d : d;
};

const CONNECT_METHODS = [
  { k: 'device', label: 'My phone', hint: 'Hands the number to this device\u2019s dialer', ready: true },
  { k: 'whatsapp', label: 'WhatsApp', hint: 'Opens the chat with a message ready', ready: true },
  { k: 'bridge', label: 'Ring me, then them', hint: 'Provider calls your mobile, then joins the client', ready: false,
    why: 'Needs a voice provider and a server endpoint. Best audio of the three \u2014 the leg to you is a normal GSM call, so it works on a weak data connection. Roughly TTD 0.20\u20130.60 a minute, both legs.' },
  { k: 'softphone', label: 'In the browser', hint: 'Talk through the laptop, no handset', ready: false,
    why: 'A WebRTC softphone needs a voice SDK, a token endpoint and a stable connection \u2014 it is the first thing to break on agency wifi. Worth it only once recording and coaching are wanted.' },
];

function ConnectPicker({ method, onMethod }) {
  return (
    <div className="cp" role="radiogroup" aria-label="How to connect">
      {CONNECT_METHODS.map(m => (
        <button key={m.k} role="radio" aria-checked={method === m.k} disabled={!m.ready}
          className={'cp-o' + (method === m.k ? ' is-on' : '') + (m.ready ? '' : ' is-soon')}
          onClick={() => m.ready && onMethod(m.k)} title={m.ready ? m.hint : m.why}>
          <b>{m.label}</b><span>{m.ready ? m.hint : 'Needs telephony'}</span>
        </button>
      ))}
    </div>
  );
}

// The place-the-call row. On `device` and `whatsapp` these are real links, so on a
// phone they genuinely open the dialer or WhatsApp; the console still tracks the
// call so the log and the follow-up are captured either way.
function PlaceCall({ lead, method, onStart, whatsAppText }) {
  const digits = dialDigits(lead.phone);
  const first = lead.name.split(' ')[0];
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard && navigator.clipboard.writeText(lead.phone).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };
  return (
    <div className="pc-row">
      {method === 'whatsapp' ? (
        <a className="pb pb-pri dl-big" href={'https://wa.me/' + digits + '?text=' + encodeURIComponent(whatsAppText)}
          target="_blank" rel="noopener noreferrer" onClick={onStart}>
          <IconWhatsApp size={17} /> Message {first}
        </a>
      ) : (
        <a className="pb pb-pri dl-big" href={'tel:+' + digits} onClick={onStart}>
          <IconPhone size={17} /> Call {first}
        </a>
      )}
      <button className="pb pb-sec dl-ic" onClick={copy} aria-label="Copy the number" title={copied ? 'Copied' : 'Copy ' + lead.phone}>
        {copied ? <CCIcon name="check" size={16} /> : <IconCopy size={16} />}
      </button>
      <span className="pc-note">{method === 'whatsapp'
        ? 'Opens WhatsApp with the message ready \u2014 send it, then log the outcome here.'
        : 'Opens this device\u2019s dialer. On a desktop without a softphone, copy the number instead.'}</span>
    </div>
  );
}

// Talk track — the objection rail. Not a script to read: three lines the agent has
// already lost a case to, so the answer is in front of them mid-call.
const TALK_TRACK = {
  'Whole Life': [['"I can\u2019t afford it right now."', 'Start at the premium they can hold. A small policy in force beats a large one they lapse in month four.'],
    ['"Let me talk to my wife."', 'Book the joint appointment on the spot \u2014 "what evening this week are you both home?"'],
    ['"I have coverage at work."', 'Group cover ends when the job does, and it is rarely enough. Ask what happens to it if they move.']],
  'Term Life': [['"Term is money down the drain."', 'It buys the years the children are dependent. Price the gap, not the product.'],
    ['"I\u2019ll do it next year."', 'Premium follows age and health. Quote the same cover one year older.'],
    ['"I\u2019m healthy, I don\u2019t need it."', 'Health is exactly why it is cheap today \u2014 underwriting is a door that closes.']],
  'Annuity': [['"I want to keep control of my money."', 'Show the income floor, not the lump sum. Control of a balance is not control of an income.'],
    ['"Rates might go up."', 'Ladder it \u2014 part now, part later. Waiting in full costs certain income for possible rate.'],
    ['"What if I die early?"', 'Walk the guarantee period. This is where the illustration earns its keep.']],
};
const DEFAULT_TRACK = [['"Send me something to read."', 'Agree \u2014 and book the appointment to walk it through. Paper alone closes nothing.'],
  ['"I\u2019m not interested."', 'Ask what they already have. "Not interested" is usually "not now" or "already covered".'],
  ['"Call me back next month."', 'Get a date and a reason. A vague callback is a no with a longer runway.']];

function TalkTrack({ need }) {
  const rows = TALK_TRACK[need] || DEFAULT_TRACK;
  const [open, setOpen] = useState(0);
  return (
    <div className="tt">
      <div className="tt-h"><IconSpark size={13} /><span className="pf-eb">IF THEY SAY…</span></div>
      {rows.map(([q, a], i) => (
        <div key={i} className={'tt-row' + (open === i ? ' is-open' : '')}>
          <button className="tt-q" onClick={() => setOpen(o => o === i ? -1 : i)} aria-expanded={open === i}>{q}</button>
          {open === i && <p className="tt-a">{a}</p>}
        </div>
      ))}
    </div>
  );
}

// Follow-up block — attached as you hang up, typed to the activity ladder so it
// counts toward the weekly floor rather than sitting as a loose reminder.
function FollowUp({ lead, value, onChange }) {
  const kinds = FOLLOWUP_KINDS;
  const k = kinds.find(x => x.k === (value && value.kind)) || null;
  const set = (patch) => onChange({ kind: (value && value.kind) || 'call', when: (value && value.when) || 'tomorrow', ...value, ...patch });
  return (
    <div className="fu">
      <div className="fu-h">
        <span className="pf-eb">NEXT STEP</span>
        {value && <button className="fu-clear" onClick={() => onChange(null)}>Clear</button>}
      </div>
      <div className="fu-kinds">
        {kinds.map(x => (
          <button key={x.k} className={'fu-k' + (value && value.kind === x.k ? ' is-on' : '')}
            onClick={() => set({ kind: x.k })} aria-pressed={!!(value && value.kind === x.k)}>{x.label}</button>
        ))}
      </div>
      {value && (
        <div className="fu-when">
          {Object.entries(FOLLOWUP_WHEN_LABEL).map(([w, l]) => (
            <button key={w} className={'fu-w' + (value.when === w ? ' is-on' : '')} onClick={() => set({ when: w })} aria-pressed={value.when === w}>{l}</button>
          ))}
          <span className="fu-preview">{k ? k.verb + ' ' + lead.name.split(' ')[0] + ' · ' + (k.duration >= 1 ? k.duration + 'h' : '30m') : ''}</span>
        </div>
      )}
    </div>
  );
}

const followUpPayload = (lead, v) => {
  if (!v) return null;
  const k = FOLLOWUP_KINDS.find(x => x.k === v.kind) || FOLLOWUP_KINDS[0];
  return { title: k.verb + ' ' + lead.name, type: k.type, duration: k.duration, when: v.when };
};

Object.assign(window, { ConnectPicker, PlaceCall, TalkTrack, FollowUp, followUpPayload, CONNECT_METHODS, dialDigits, IconWhatsApp, IconCopy, IconSpark, TALK_TRACK, DEFAULT_TRACK });

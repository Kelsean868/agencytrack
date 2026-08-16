// Planner v3 — data layer, taken from the handoff prototype
// (uploads/planner_handoff/planner-gemini-prototype.jsx + planner-agencytrack-theme.jsx).
// Decimal-hour event model, 8AM–5PM grid, ROW_HEIGHT 96, ACTIVITY_METADATA with
// four icon families + SUGGESTION as a first-class type.

const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 8 AM – 5 PM
const ROW_HEIGHT = 96;

const ACTIVITY_METADATA = {
  PC:    { label: 'Prospecting call', counts: true,  icon: 'call' },
  SC:    { label: 'Sales call',       counts: true,  icon: 'call' },
  SEM:   { label: 'Seminar',          counts: true,  icon: 'meeting' },
  TRADE: { label: 'Tradeshow',        counts: true,  icon: 'meeting' },
  AI:    { label: 'Approach interview', counts: true, icon: 'ladder' },
  FFI:   { label: 'Fact find',        counts: true,  icon: 'ladder' },
  CI:    { label: 'Closing interview',counts: true,  icon: 'ladder', money: true },
  SALE:  { label: 'Sale written',     counts: true,  icon: 'sale' },
  PROP:  { label: 'Proposal',         counts: false, icon: 'admin' },
  PAPER: { label: 'Paperwork',        counts: false, icon: 'admin' },
  COLL:  { label: 'Collection',       counts: false, icon: 'admin' },
  DEL:   { label: 'Delivery',         counts: false, icon: 'admin' },
  MTG:   { label: 'Meeting',          counts: false, icon: 'meeting' },
  // Manager ladder. These have their own codes because something counts them — not
  // toward the agent's floor, which is personal production, but toward unit
  // development. `dev: true` is countable coaching; UM is overhead, named separately
  // precisely so a week eaten by meetings reads as that rather than as generic time.
  JC:    { label: 'Joint call',       counts: false, icon: 'meeting', mgr: true, dev: true },
  ONE:   { label: 'One-on-one',       counts: false, icon: 'meeting', mgr: true, dev: true },
  RI:    { label: 'Recruiting interview', counts: false, icon: 'meeting', mgr: true, dev: true },
  UM:    { label: 'Unit meeting',     counts: false, icon: 'admin',   mgr: true, dev: false },
  TRAIN: { label: 'Training',         counts: false, icon: 'meeting' },
  ADMIN: { label: 'Admin',            counts: false, icon: 'admin' },
  FREE:  { label: 'Free block',       counts: false, icon: 'admin' },
  SUGGESTION: { label: 'Smart suggestion', counts: false, icon: 'suggestion' },
};

// Family tone. The handoff theme collapsed call/meeting/admin onto gold+teal with
// the note "violet isn't in tokens" — it IS: --inkAccent ships at DS parity
// (app-tokens.jsx APP_LIGHT.inkAccent #5A3FA0 / APP_DARK #A995E0), so the calls
// family keeps its own hue and the four families stay legible.
const FAMILY = {
  call:       { fg: 'var(--inkAccent)', bg: 'var(--inkAccentTint)', rule: 'var(--inkAccent)' },
  ladder:     { fg: 'var(--teal)',      bg: 'var(--tealTint)',      rule: 'var(--teal)' },
  sale:       { fg: 'var(--goldInk)',   bg: 'var(--goldTint)',      rule: 'var(--gold)' },
  meeting:    { fg: 'var(--inkMute)',   bg: 'var(--surfaceRaised)', rule: 'var(--ruleStrong)' },
  admin:      { fg: 'var(--inkMute)',   bg: 'var(--surfaceRaised)', rule: 'var(--ruleStrong)', dashed: true },
  suggestion: { fg: 'var(--goldInk)',   bg: 'var(--goldTint)',      rule: 'var(--gold)', dashed: true },
};

const famOf = (type) => FAMILY[(ACTIVITY_METADATA[type] || {}).icon || 'admin'];

const formatTime = (decimalHour) => {
  const hrs = Math.floor(decimalHour);
  const mins = Math.round((decimalHour - hrs) * 60);
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  const h = hrs > 12 ? hrs - 12 : (hrs === 0 ? 12 : hrs);
  return h + ':' + String(mins).padStart(2, '0') + ' ' + ampm;
};
const durLabel = (e) => {
  const m = Math.round((e.endHour - e.startHour) * 60);
  return m >= 60 ? (m % 60 === 0 ? (m / 60) + 'h' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm') : m + 'm';
};

// Wednesday 1 Jul 2026 · Marsha Singh · week 27
const INITIAL_EVENTS = [
  { id: 'e1', title: 'Unit standup', startHour: 8, endHour: 8.5, type: 'UM', isPast: true },
  { id: 'e2', title: 'Referral dials', startHour: 8.5, endHour: 9.5, type: 'PC', details: '8 dials queued · 4 reached', isPast: true, tag: 'South', dials: 8 },
  { id: 'e3', title: 'Kareem Mohammed', startHour: 9.5, endHour: 10.5, type: 'FFI', details: 'Site foreman · Marabella · 2nd meeting', isPlaying: true, tag: 'Marabella', prep: { read: true, route: true } },
  { id: 'e4', title: 'Log the fact find', startHour: 10.5, endHour: 11, type: 'PAPER', dependsOn: 'e3', details: 'Page 2 signature outstanding' },
  { id: 'e5', title: 'Sara Khan', startHour: 14, endHour: 15.5, type: 'CI', details: 'Platinum Edge · San Fernando', amount: 'TTD 3,100', status: 'cancelled' },
  { id: 'e6', title: 'Suggested: fill the freed slot', startHour: 14, endHour: 15.5, type: 'SUGGESTION', details: 'Nalini Baksh is due today and 12 min away' },
  { id: 'e7', title: 'TL-08512 delivery', startHour: 16.5, endHour: 17, type: 'DEL', details: 'Anand Persad · clawback closes in 4 days', urgent: 'Clawback 4d' },
  // A manager-coded block, so the three-way split and the unit ladder read off real
  // planner data rather than sitting at zero.
  { id: 'e8', title: 'Curtis Mohammed · one-on-one', startHour: 15.5, endHour: 16.25, type: 'ONE', details: 'Contact rate up, adherence slipping', tag: 'coaching' },
];

const INITIAL_TASKS = [
  { id: 't1', title: 'Rebook Terrence Ali', priority: 'high', type: 'FFI', duration: 1 },
  { id: 't2', title: 'Send Platinum Edge illustration', priority: 'high', type: 'PROP', duration: 0.5 },
  { id: 't3', title: 'Call Nalini Baksh back', priority: 'high', type: 'PC', duration: 0.5 },
  { id: 't4', title: 'Log Monday call notes', priority: 'low', type: 'ADMIN', duration: 0.5 },
  { id: 't5', title: 'Collect TL-08661 premium', priority: 'low', type: 'COLL', duration: 0.5 },
];

// Week — Mon 29 Jun → Sun 5 Jul. Horizontal scroll is acceptable (operator call),
// so all seven days render at a readable minimum column width.
const WEEK_DAYS = ['Mon 29', 'Tue 30', 'Wed 01', 'Thu 02', 'Fri 03', 'Sat 04', 'Sun 05'];
const TODAY_KEY = 'Wed 01';

const WEEK_EVENTS = {
  'Mon 29': [
    { id: 'm1', title: 'Cold list dials', startHour: 8.5, endHour: 9, type: 'PC', isPast: true, dials: 5 },
    { id: 'm2', title: 'Selina Mohammed', startHour: 10, endHour: 11, type: 'FFI', isPast: true },
    { id: 'm3', title: 'Anand Persad', startHour: 13.5, endHour: 15, type: 'CI', amount: 'TTD 4,850', isPast: true },
    { id: 'm4', title: 'TL-08661 written', startHour: 15.25, endHour: 15.75, type: 'SALE', amount: 'TTD 4,850', isPast: true },
    { id: 'm5', title: 'Submission paperwork', startHour: 16, endHour: 16.75, type: 'PAPER', isPast: true },
  ],
  'Tue 30': [
    { id: 'u1', title: 'Carla Joseph', startHour: 9, endHour: 9.75, type: 'AI', isPast: true },
    { id: 'u2', title: 'Devin Lewis', startHour: 11, endHour: 12, type: 'FFI', status: 'missed' },
    { id: 'u3', title: 'Unit training', startHour: 14, endHour: 16, type: 'TRAIN', isPast: true },
    { id: 'u4', title: 'Hema Lakhan renewal', startHour: 16.5, endHour: 17, type: 'SC', isPast: true },
  ],
  'Wed 01': INITIAL_EVENTS,
  'Thu 02': [
    { id: 'h1', title: 'Marsha Lall', startHour: 9, endHour: 10.5, type: 'CI', amount: 'TTD 2,400' },
    { id: 'h2', title: 'Ravi Sookdeo', startHour: 11.5, endHour: 12.5, type: 'AI', joint: 'Anil Boodram' },
    { id: 'h3', title: 'Build 3 proposals', startHour: 14.5, endHour: 15.5, type: 'PROP' },
    { id: 'h4', title: 'Suggested: prospecting hour', startHour: 16, endHour: 17, type: 'SUGGESTION', details: 'Best connect window on Thursdays' },
  ],
  'Fri 03': [
    { id: 'f1', title: 'Cold list dials', startHour: 8.5, endHour: 9.25, type: 'PC' },
    { id: 'f2', title: 'Nalini Baksh', startHour: 10, endHour: 11, type: 'FFI' },
    { id: 'f3', title: 'Branch meeting', startHour: 13, endHour: 14.5, type: 'MTG' },
    { id: 'f4', title: 'Terrence Ali', startHour: 15.5, endHour: 16.5, type: 'FFI', status: 'postponed' },
  ],
  'Sat 04': [
    { id: 's1', title: 'Retirement seminar', startHour: 9, endHour: 12, type: 'SEM', details: 'Gasparillo · 40 invited' },
    { id: 's2', title: 'Week close', startHour: 13, endHour: 14, type: 'ADMIN' },
  ],
  'Sun 05': [],
};

// Fill candidates for the freed 2:00 PM slot (the SUGGESTION block's payload).
const FILL_CANDIDATES = [
  { name: 'Nalini Baksh', type: 'FFI', stage: 'FFI booked · Fri', why: 'Follow-up due today · 11 days since contact', dist: 'San Fernando · same area', score: 92, api: 1800 },
  { name: 'Terrence Ali', type: 'FFI', stage: 'Postponed Fri 3:30 PM', why: 'Already postponed once — rebook before it dies', dist: 'Marabella · 12 min', score: 84, api: 2200 },
  { name: 'Rajesh Maharaj', type: 'AI', stage: 'Approach done', why: 'Asked to be called back this week', dist: 'San Fernando · same area', score: 71, api: 1200 },
];

const PREP = {
  e3: {
    who: 'Kareem Mohammed', stage: 'Fact find · 2nd meeting', age: 41, occ: 'Site foreman · Marabella',
    facts: [['Dependants', '2 children · 9 and 14'], ['Existing cover', 'TTD 150K group life'], ['Monthly capacity', 'TTD 900 – 1,200'], ['Referred by', 'Anand Persad']],
    lastNote: 'Wanted his wife present for the numbers. Nervous about medicals — brother was declined last year.',
    noteDate: '24 JUN · 11:40', objection: 'Medical underwriting anxiety',
    rehearse: 'Lead with the non-medical limit. Frame the medical as the route to a lower rate, not a hurdle.',
    bring: ['Fact find form (page 2 signature outstanding)', 'Platinum Edge illustration at TTD 1,000/mo', 'Non-medical limit table'],
  },
  h1: {
    who: 'Marsha Lall', stage: 'Closing interview', age: 34, occ: 'Teacher · Chaguanas',
    facts: [['Dependants', '1 child · 3'], ['Existing cover', 'None'], ['Monthly capacity', 'TTD 600'], ['Referred by', 'Selina Mohammed']],
    lastNote: 'Agreed the need at TTD 2,400 API. Wants to start after her July increment lands.',
    noteDate: '27 JUN · 16:05', objection: '"Let me start next month"',
    rehearse: 'Backdate to save age; the premium holds either way. Show the 12-month cost of waiting.',
    bring: ['Application form', 'Illustration TTD 2,400 API', 'Bank mandate'],
  },
};

const COUNTERS = [
  { type: 'PC', lab: 'Calls', booked: 14, floor: 20 },
  { type: 'AI', lab: 'A.I', booked: 3, floor: 4 },
  { type: 'FFI', lab: 'F.F.I', booked: 5, floor: 4 },
  { type: 'CI', lab: 'C.I', booked: 3, floor: 3 },
];

// Prep is a property of an appointment, so the checklist lives beside the activity
// metadata rather than being a screen of its own. NEEDS_PREP is the set of types where
// walking in cold actually costs you the case.
const PREP_ITEMS = [
  { k: 'read', lab: 'Fact find read back' },
  { k: 'illustration', lab: 'Illustration or quote ready' },
  { k: 'objection', lab: 'Likely objection thought through' },
  { k: 'route', lab: 'Route and arrival time confirmed' },
];
const NEEDS_PREP = ['AI', 'FFI', 'CI', 'JC'];
const prepState = (e) => {
  if (!NEEDS_PREP.includes(e.type)) return null;
  const done = PREP_ITEMS.filter(i => (e.prep || {})[i.k]).length;
  return { done, total: PREP_ITEMS.length, ready: done === PREP_ITEMS.length };
};

const TOMB_H = 26; // a retired event keeps a slim tombstone; its replacement takes the rest

// Slot layout with collision handling. When a retired event (cancelled/postponed)
// shares a slot with a live one, the retired record collapses to a tombstone at the
// top and the live block takes the remaining height — the cancellation stays on the
// record instead of being painted over. Any other collision splits side by side.
//
// Overlap is real interval overlap, not an exact start:end match. Booking directly
// on the grid makes partial overlaps (9:00–10:00 against 8:30–9:30) ordinary, and
// keying on the exact span silently stacked those at full width, one hiding the other.
function layoutSlots(events) {
  // 1. Exact-span retired+live pairs stay one unit so the tombstone rule survives.
  const byExact = new Map();
  events.forEach(ev => {
    const k = ev.startHour + ':' + ev.endHour;
    if (!byExact.has(k)) byExact.set(k, []);
    byExact.get(k).push(ev);
  });
  const units = [];
  byExact.forEach(list => {
    const retired = list.filter(e => e.status === 'cancelled' || e.status === 'postponed');
    const live = list.filter(e => !(e.status === 'cancelled' || e.status === 'postponed'));
    if (list.length > 1 && retired.length && live.length) {
      units.push({ start: list[0].startHour, end: list[0].endHour, retired, live });
    } else {
      list.forEach(e => units.push({ start: e.startHour, end: e.endHour, retired: [], live: [e] }));
    }
  });

  // 2. Cluster units by true overlap, then greedily column-pack inside each cluster.
  units.sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  let i = 0;
  while (i < units.length) {
    const cluster = [units[i]];
    let maxEnd = units[i].end;
    let j = i + 1;
    while (j < units.length && units[j].start < maxEnd) { cluster.push(units[j]); maxEnd = Math.max(maxEnd, units[j].end); j++; }
    const colEnds = [];
    cluster.forEach(u => {
      let c = colEnds.findIndex(end => end <= u.start);
      if (c === -1) { c = colEnds.length; colEnds.push(u.end); } else colEnds[c] = u.end;
      u.col = c;
    });
    const cols = colEnds.length;
    cluster.forEach(u => {
      const top0 = (u.start - 8) * ROW_HEIGHT;
      const full = (u.end - u.start) * ROW_HEIGHT;
      const w = 1 / cols, x = u.col / cols;
      if (u.retired.length) {
        u.retired.forEach((e, k) => out.push({ ev: e, top: top0 + k * (TOMB_H + 2), height: TOMB_H, w, x, tomb: true }));
        const off = u.retired.length * (TOMB_H + 2) + 2;
        u.live.forEach(e => out.push({ ev: e, top: top0 + off, height: Math.max(full - off, 40), w, x }));
      } else {
        u.live.forEach(e => out.push({ ev: e, top: top0, height: full, w, x }));
      }
    });
    i = j;
  }
  return out;
}

Object.assign(window, {
  HOURS, ROW_HEIGHT, TOMB_H, layoutSlots, ACTIVITY_METADATA, FAMILY, famOf, formatTime, durLabel,
  PREP_ITEMS, NEEDS_PREP, prepState, INITIAL_EVENTS, INITIAL_TASKS, WEEK_DAYS, TODAY_KEY, WEEK_EVENTS, FILL_CANDIDATES, PREP, COUNTERS,
});

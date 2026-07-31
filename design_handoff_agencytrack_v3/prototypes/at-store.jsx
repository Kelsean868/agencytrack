// AgencyTrack unified app — the shared sync store.
// Ports uploads/sync-service.js (pub/sub singleton + cross-module rules) into a
// React hook so Planner, Dialer and Lead Entry read and write ONE state.
//
// The rules that make it a system, all from sync-service.js:
//   · logCallOutcome  → activity feed; 3 consecutive non-contacts raises an
//                       "archive this lead" notification
//   · all calls for a task done → that planner task auto-completes
//   · completeTask on a call block → its pending calls auto-complete
//   · finishCallBlockSession → logs the block with its real duration
// Plus the dialer's own cycle model (uploads/dialer-agencytrack-prototype.jsx):
//   attempts >= 3 → archive (cycleCount + 1, attempts reset); a lead already
//   through 2 cycles is dead rather than archived again.

const NEED_OPTIONS = ['Whole Life', 'Term Life', 'IUL', 'Critical Illness', 'Annuity', 'Final Expense', 'Medicare', 'Undetermined'];
const SOURCE_OPTIONS = ['Referral', 'Marketing Campaign', 'Seminar', 'Organic / Web', 'Purchased Lead', 'Orphans', 'Existing Clients', 'Trade Shows'];
const NON_CONTACT = ['Left Voicemail', 'No Answer', 'Bad Number'];
const DISPOSITIONS = ['Appointment Set', 'Callback Requested', 'Not Interested', 'Left Voicemail', 'No Answer', 'Bad Number'];

// Follow-up windows. Zoho lets you attach a task/meeting/call as you hang up; the
// insurance version needs the same door but typed to the activity ladder, so the
// follow-up counts toward the weekly floor instead of being a loose to-do.
const FOLLOWUP_WHEN_LABEL = { today: 'later today', tomorrow: 'tomorrow', week: 'this week', next: 'next week' };
const FOLLOWUP_KINDS = [
  { k: 'call', label: 'Another call', type: 'PC', duration: 0.5, verb: 'Call' },
  { k: 'ai', label: 'Approach interview', type: 'AI', duration: 1, verb: 'A.I with' },
  { k: 'ffi', label: 'Fact find', type: 'FFI', duration: 1, verb: 'Fact find' },
  { k: 'ci', label: 'Closing interview', type: 'CI', duration: 1.5, verb: 'Close' },
  { k: 'prop', label: 'Send an illustration', type: 'PROP', duration: 0.5, verb: 'Illustration for' },
];

// Unit roster. `unit`/`branch`/`agentCode` are the org placement a recruit receives
// when they are CONTRACTED; `licensed` is the regulatory gate that follows it. Only a
// licensed agent can be assigned leads or write business — `canSell` is read by the
// bulk-import distribution, so the gate is enforced where the work is handed out
// rather than being a label on a row.
const BRANCHES = [
  { k: 'South', lab: 'South Branch', units: ['Tatil Life South', 'Tatil Life Central'] },
  { k: 'North', lab: 'North Branch', units: ['Tatil Life Port of Spain', 'Tatil Life East'] },
];
const AGENTS = [
  { id: 'ag1', name: 'Marsha Singh', initials: 'MS', area: 'San Fernando', open: 14, active: true, agentCode: 'A-1042', unit: 'Tatil Life South', branch: 'South', role: 'Senior associate', licensed: true, canSell: true, regNo: 'FSC-20418' },
  { id: 'ag2', name: 'Curtis Mohammed', initials: 'CM', area: 'Chaguanas', open: 6, active: true, agentCode: 'A-1188', unit: 'Tatil Life South', branch: 'South', role: 'Associate', licensed: true, canSell: true, regNo: 'FSC-21993' },
  { id: 'ag3', name: 'Deo Ramlogan', initials: 'DR', area: 'Couva', open: 21, active: true, agentCode: 'A-0977', unit: 'Tatil Life South', branch: 'South', role: 'Associate', licensed: true, canSell: true, regNo: 'FSC-19884' },
  { id: 'ag4', name: 'Kavita Joseph', initials: 'KJ', area: 'Marabella', open: 9, active: true, agentCode: 'A-1301', unit: 'Tatil Life South', branch: 'South', role: 'Associate', licensed: true, canSell: true, regNo: 'FSC-22740' },
  { id: 'ag5', name: 'Terrence Blaine', initials: 'TB', area: 'Princes Town', open: 3, active: false, agentCode: 'A-0844', unit: 'Tatil Life South', branch: 'South', role: 'Associate', licensed: true, canSell: true, regNo: 'FSC-18220' },
  // Seeded to match the recruits already past Contracted — the invariant is that a
  // recruit at or beyond that stage HAS a user account, and the seed has to hold it
  // too or every function keyed on recruitId silently matches nothing.
  { id: 'ag6', name: 'Denise Charles', initials: 'DC', area: 'Marabella', open: 0, active: true, newJoiner: true, agentCode: 'A-1355', unit: 'Tatil Life South', branch: 'South', role: 'Associate', licensed: false, canSell: false, sponsor: 'Kavita Joseph', recruitId: 'r5' },
  { id: 'ag7', name: 'Vishnu Persad', initials: 'VP', area: 'Princes Town', open: 0, active: true, newJoiner: true, agentCode: 'A-1298', unit: 'Tatil Life South', branch: 'South', role: 'Associate', licensed: true, canSell: true, regNo: 'FSC-22615', sponsor: 'Marsha Singh', recruitId: 'r6' },
];

const SEED_LEADS = [
  { id: 'l1', name: 'Alice Smith', phone: '(868) 620-4471', email: 'alice@example.com', need: 'Whole Life', source: 'Referral', location: 'San Fernando', queue: 'General Queue', status: 'pending', attempts: 2, cycleCount: 0, lastContact: '2 days ago', stage: 'FFI', touchesSinceAdvance: 6, daysSinceAdvance: 21 },
  { id: 'l2', name: 'Bob Johnson', phone: '(868) 771-2093', email: 'bob@example.com', need: 'Term Life', source: 'Seminar', location: 'Chaguanas', queue: 'General Queue', status: 'pending', attempts: 2, cycleCount: 2, lastContact: '1 week ago', stage: 'Approach', touchesSinceAdvance: 2, daysSinceAdvance: 8 },
  { id: 'l3', name: 'Charlie Davis', phone: '(868) 335-8814', email: 'charlie@example.com', need: 'Annuity', source: 'Trade Shows', location: 'Couva', queue: 'Annuity Prospects', status: 'pending', attempts: 0, cycleCount: 0, lastContact: 'New lead', stage: 'Approach', touchesSinceAdvance: 0, daysSinceAdvance: 0 },
  { id: 'l4', name: 'Nalini Baksh', phone: '(868) 482-1170', email: 'nalini@example.com', need: 'IUL', source: 'Referral', location: 'San Fernando', queue: 'Hot Leads', status: 'pending', attempts: 1, cycleCount: 1, lastContact: '3 days ago', stage: 'CI', touchesSinceAdvance: 5, daysSinceAdvance: 17 },
  { id: 'l5', name: 'Evan Wright', phone: '(868) 299-6035', email: 'evan@example.com', need: 'Term Life', source: 'Organic / Web', location: 'Marabella', queue: 'General Queue', status: 'pending', attempts: 0, cycleCount: 0, lastContact: 'New lead', stage: 'Approach', touchesSinceAdvance: 1, daysSinceAdvance: 3 },
];

// Settled business — the client side of the book, and the source of truth for the
// Game Plan's settled figure rather than a hard-coded total sitting beside it.
// `settledDaysAgo` drives the clawback clock: commission on a policy that lapses
// inside the window comes back off the agent, which is the most painful number in
// the business and the one a spreadsheet never warns you about in time.
const CLAWBACK_DAYS = 90;
const POLICIES = [
  { id: 'p1', policyNo: 'TL-08661', client: 'Anand Persad', product: 'Platinum Edge', api: 4850, settledOn: '14 Feb 2026', settledDaysAgo: 165, status: 'settled', persistency: 'in force', premium: 'paid' },
  { id: 'p2', policyNo: 'TL-08512', client: 'Selina Mohammed', product: 'Term Life 20', api: 12400, settledOn: '03 Mar 2026', settledDaysAgo: 148, status: 'settled', persistency: 'in force', premium: 'paid' },
  { id: 'p3', policyNo: 'TL-08744', client: 'Anil Boodram', product: 'Whole Life', api: 7600, settledOn: '27 Mar 2026', settledDaysAgo: 124, status: 'settled', persistency: 'in force', premium: 'paid' },
  { id: 'p4', policyNo: 'AN-01188', client: 'Carla Joseph', product: 'Destiny Deferred Annuity', api: 22000, settledOn: '18 Apr 2026', settledDaysAgo: 102, status: 'settled', persistency: 'in force', premium: 'paid' },
  { id: 'p5', policyNo: 'TL-08903', client: 'Devin Lewis', product: 'Term Life 20', api: 9800, settledOn: '06 May 2026', settledDaysAgo: 84, status: 'settled', persistency: 'lapse warning', premium: 'missed' },
  { id: 'p6', policyNo: 'TL-09014', client: 'Sara Khan', product: 'Platinum Edge', api: 15400, settledOn: '29 May 2026', settledDaysAgo: 61, status: 'settled', persistency: 'in force', premium: 'due' },
  { id: 'p7', policyNo: 'AN-01247', client: 'Hema Lakhan', product: 'Single Premium Immediate Annuity', api: 31200, settledOn: '11 Jun 2026', settledDaysAgo: 48, status: 'settled', persistency: 'in force', premium: 'paid' },
  { id: 'p8', policyNo: 'TL-09188', client: 'Kareem Mohammed', product: 'Whole Life', api: 15150, settledOn: '26 Jun 2026', settledDaysAgo: 33, status: 'settled', persistency: 'lapse warning', premium: 'due' },
];

// Every policy row is minted here, so a consumer can never read a field one of the
// two creators forgot to write. A just-receipted policy is paid and nought days old \u2014
// omitting either made The Book file it as a persistency problem the same second.
// Carrier settlement statements. The reconciliation surface exists because a
// commission the agency THINKS it earned and a commission the carrier actually PAID
// are different numbers, and the gap is where money quietly goes missing. Each line
// is what the carrier says; the app already knows what it expected.
const SETTLEMENTS = [
  { id: 's1', policyNo: 'TL-08661', paid: 1940, on: '28 Feb 2026', ref: 'STL-4471' },
  { id: 's2', policyNo: 'TL-08512', paid: 4960, on: '15 Mar 2026', ref: 'STL-4471' },
  { id: 's3', policyNo: 'TL-08744', paid: 3040, on: '10 Apr 2026', ref: 'STL-4508' },
  { id: 's4', policyNo: 'AN-01188', paid: 6600, on: '30 Apr 2026', ref: 'STL-4508' },   // annuity pays a lower rate
  { id: 's5', policyNo: 'TL-08903', paid: 2450, on: '20 May 2026', ref: 'STL-4552' },   // short: 3920 expected
  { id: 's6', policyNo: 'TL-09014', paid: 6160, on: '12 Jun 2026', ref: 'STL-4552' },
  { id: 's7', policyNo: 'AN-01301', paid: 1800, on: '12 Jun 2026', ref: 'STL-4552' },   // no such policy on the book
];

function newPolicy(fields) {
  return {
    id: 'p' + Date.now(), policyNo: '', client: '', product: '', api: 0,
    settledOn: '29 Jul 2026', settledDaysAgo: 0,
    status: 'settled', persistency: 'in force', premium: 'paid',
    ...fields,
  };
}

function useSyncStore() {
  const { useState, useCallback, useRef } = React;
  const [leads, setLeads] = useState(SEED_LEADS);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [queues, setQueues] = useState(['General Queue', 'Hot Leads', 'Annuity Prospects']);
  const [activities, setActivities] = useState([
    { id: 'a0', type: 'system', message: 'Session started · week 27', at: '8:02 AM' },
  ]);
  const [notifications, setNotifications] = useState([]);
  const [calls, setCalls] = useState([]);      // call log — one row per completed call
  const [jointOffers, setJointOffers] = useState([]);  // manager offers awaiting an answer
  const [policies, setPolicies] = useState(POLICIES);
  const [settlements, setSettlements] = useState(SETTLEMENTS);
  const [queries, setQueries] = useState([]);        // raised with the carrier
  // Recruits are the mirror image of prospects on privacy: a candidate is the
  // COMPANY's relationship, not an agent's asset, so a manager's recruiting board is
  // legitimately named. A sponsoring agent sees only the people they brought in.
  const [recruits, setRecruits] = useState([
    { id: 'r1', name: 'Rachel Sookram', phone: '(868) 620-9911', area: 'San Fernando', source: 'Agent referral', sponsor: 'Curtis Mohammed', stage: 'Candidate', days: 4, exam: 'not started' },
    { id: 'r2', name: 'Jerome Baptiste', phone: '(868) 771-3388', area: 'Chaguanas', source: 'Career fair', sponsor: null, stage: 'Candidate', days: 11, exam: 'not started' },
    { id: 'r3', name: 'Ayesha Khan', phone: '(868) 482-7712', area: 'Debe', source: 'Client referral', sponsor: 'Marsha Singh', stage: 'Interview', days: 6, exam: 'not started' },
    { id: 'r4', name: 'Terrence Lalla', phone: '(868) 335-4419', area: 'Couva', source: 'Advert', sponsor: null, stage: 'Selected', days: 9, exam: 'booked 14 Aug' },
    { id: 'r5', name: 'Denise Charles', phone: '(868) 299-8802', area: 'Marabella', source: 'Agent referral', sponsor: 'Kavita Joseph', stage: 'Contracted', days: 22, exam: 'passed', agentCode: 'A-1355', unit: 'Tatil Life South' },
    { id: 'r6', name: 'Vishnu Persad', phone: '(868) 653-1174', area: 'Princes Town', source: 'Agent referral', sponsor: 'Marsha Singh', stage: 'Licensed', days: 31, exam: 'passed · registered', agentCode: 'A-1298', unit: 'Tatil Life South', regNo: 'FSC-22615' },
  ]);
  // several — term on him, an annuity on her, a policy on a child — and each has its
  // own product, premium, underwriting outcome and delivery. A pipeline that tracked
  // only the prospect could not represent that at all.
  const [applications, setApplications] = useState([
    { id: 'ap1', leadId: null, client: 'Devin Lewis', product: 'Term Life', api: 5200, policyNo: 'TL-09210', stage: 'App', appliedOn: '21 Jul 2026', underwriting: 'referred · medical outstanding' },
    { id: 'ap2', leadId: null, client: 'Carla Joseph', product: 'Whole Life', api: 3900, policyNo: 'TL-09422', stage: 'Delivery', appliedOn: '09 Jul 2026', issuedOn: '24 Jul 2026', underwriting: 'issued standard' },
  ]);
  const [agents, setAgents] = useState(AGENTS);
  const [batches, setBatches] = useState([]);   // bulk imports, newest first
  // Declared activity: what the agent asserts happened off-system, per day per type.
  // Kept SEPARATE from the logged record rather than merged into it — the whole point
  // is that the report can still say which half is evidenced.
  const [tally, setTally] = useState({
    'Mon 29': { PC: 6 },
    'Tue 30': { PC: 4, AI: 1 },
    'Thu 02': { PC: 3 },
  });
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState([]);   // writes waiting on the network
  const [syncing, setSyncing] = useState(false);
  const onlineRef = useRef(true);
  onlineRef.current = online;

  const now = () => new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();

  const log = useCallback((type, message) => {
    setActivities(a => [{ id: 'a' + Date.now() + Math.random(), type, message, at: now() }, ...a].slice(0, 60));
  }, []);

  // Every mutation goes through here, so the offline queue is real rather than
  // decorative: offline writes land in `queued` and flush when the link returns.
  const commit = useCallback((label, fn) => {
    fn();
    if (onlineRef.current) {
      setSyncing(true);
      setTimeout(() => setSyncing(false), 650);
    } else {
      setQueued(q => [...q, { id: 'q' + Date.now() + Math.random(), label, at: now() }]);
    }
  }, []);

  const goOnline = useCallback((next) => {
    setOnline(next);
    if (next) {
      setQueued(q => {
        if (q.length) {
          setSyncing(true);
          setTimeout(() => setSyncing(false), 900);
          log('sync', 'Back online — flushed ' + q.length + ' queued write' + (q.length > 1 ? 's' : ''));
        }
        return [];
      });
    } else {
      log('sync', 'Offline — writes will queue until the link returns');
    }
  }, [log]);

  // ── Lead Entry → the dialer queue ─────────────────────────────────────────
  const addLead = useCallback((form) => {
    const lead = {
      id: 'l' + Date.now(),
      name: (form.firstName + ' ' + form.lastName).trim(),
      phone: form.phone, email: form.email, need: form.need,
      source: form.source, sourceDetails: form.sourceDetails,
      location: form.location || '—', queue: form.queue,
      status: 'pending', attempts: 0, cycleCount: 0, lastContact: 'New lead',
    };
    commit('Create lead ' + lead.name, () => {
      setLeads(l => [lead, ...l]);
      log('lead_created', 'New lead ' + lead.name + ' → ' + form.queue + ' (' + form.source + ')');
    });
    return lead;
  }, [commit, log]);

  // ── Bulk import → the dialer queue, split across the unit ─────────────────
  const addLeadsBulk = useCallback((rows, meta) => {
    const stamp = Date.now();
    const batchId = 'b' + stamp;
    const leads = rows.map((r, i) => ({
      id: 'l' + stamp + '-' + i,
      name: r.values.name, phone: r.values.phone, email: r.values.email,
      need: r.values.need, source: r.values.source, sourceDetails: r.values.sourceDetails,
      location: r.values.location || '—', queue: r.values.queue || meta.queue,
      assignedTo: r.values.assignedTo || null, notes: r.values.notes || '',
      status: 'pending', attempts: 0, cycleCount: 0, lastContact: 'Imported',
      batchId,
    }));
    const perAgent = {};
    leads.forEach(l => { const k = l.assignedTo || 'Unassigned'; perAgent[k] = (perAgent[k] || 0) + 1; });
    const batch = { id: batchId, file: meta.file, count: leads.length, skipped: meta.skipped, at: now(), perAgent, queue: meta.queue };
    commit('Import ' + leads.length + ' leads', () => {
      setLeads(l => [...leads, ...l]);
      setBatches(b => [batch, ...b]);
      setAgents(a => a.map(ag => perAgent[ag.name] ? { ...ag, open: ag.open + perAgent[ag.name] } : ag));
      log('import', 'Imported ' + leads.length + ' leads from ' + meta.file + ' → ' + meta.queue
        + (meta.skipped ? ' · ' + meta.skipped + ' row' + (meta.skipped > 1 ? 's' : '') + ' left out' : ''));
      Object.keys(perAgent).forEach(k => log('assign', k + ' picked up ' + perAgent[k] + ' lead' + (perAgent[k] > 1 ? 's' : '')));
    });
    return batch;
  }, [commit, log]);

  const undoImport = useCallback((batchId) => {
    commit('Undo import', () => {
      setBatches(b => {
        const hit = b.find(x => x.id === batchId);
        if (hit) {
          setLeads(l => l.filter(x => x.batchId !== batchId));
          setAgents(a => a.map(ag => hit.perAgent[ag.name] ? { ...ag, open: Math.max(0, ag.open - hit.perAgent[ag.name]) } : ag));
          log('import_undo', 'Rolled back the ' + hit.count + '-lead import from ' + hit.file);
        }
        return b.filter(x => x.id !== batchId);
      });
    });
  }, [commit, log]);

  const addQueue = useCallback((name) => {
    setQueues(q => q.includes(name) ? q : [...q, name]);
    log('queue', 'Created queue "' + name + '"');
  }, [log]);

  // ── Dialer → activity feed, planner tasks, archive cycle, call log ─────────
  // opts carries what the console captured DURING the call: notes, real duration,
  // and an explicit follow-up. Zoho's lesson is that the follow-up is part of
  // hanging up, not a separate trip to a Tasks screen afterwards.
  const logCallOutcome = useCallback((leadId, disposition, opts = {}) => {
    commit('Log call outcome', () => {
      setLeads(list => list.map(l => {
        if (l.id !== leadId) return l;
        const nonContact = NON_CONTACT.includes(disposition);
        const attempts = nonContact ? l.attempts + 1 : 0;
        let status = disposition === 'Appointment Set' ? 'success'
          : disposition === 'Not Interested' ? 'closed' : 'worked';
        let cycleCount = l.cycleCount;
        if (opts.archive) { status = 'archived'; cycleCount = l.cycleCount + 1; }
        if (opts.dead) status = 'dead';
        return { ...l, status, attempts: opts.archive ? 0 : attempts, cycleCount, lastOutcome: disposition, lastContact: 'Just now' };
      }));
      const lead = leads.find(l => l.id === leadId);
      const name = lead ? lead.name : 'lead';
      setCalls(c => [{
        id: 'c' + Date.now(), leadId, name, phone: lead ? lead.phone : '',
        disposition, seconds: opts.seconds || 0, notes: opts.notes || '',
        via: opts.via || 'device', at: now(), atHour: opts.atHour,
      }, ...c].slice(0, 80));
      log('call_logged', 'Logged call with ' + name + ' — ' + disposition
        + (opts.seconds ? ' (' + Math.round(opts.seconds / 60) + 'm)' : '')
        + (opts.notes ? ' · note saved' : ''));
      if (opts.archive) log('archive', name + ' archived for 3 months (cycle ' + ((lead ? lead.cycleCount : 0) + 1) + ' of 2)');
      if (opts.dead) log('dead', name + ' marked dead — two archive cycles with no contact');

      // 3 consecutive non-contacts → raise the archive prompt
      if (lead && NON_CONTACT.includes(disposition) && lead.attempts + 1 >= 3 && !opts.archive && !opts.dead) {
        setNotifications(n => [{
          id: 'n' + Date.now(), leadId,
          title: lead.cycleCount >= 2 ? 'Lead has run its cycles' : 'Action required',
          message: lead.name + ' has not responded to 3 consecutive attempts.',
          action: lead.cycleCount >= 2 ? 'Mark dead' : 'Archive for 3 months',
          kind: lead.cycleCount >= 2 ? 'dead' : 'archive',
        }, ...n]);
        log('system_flag', 'Auto-flagged ' + lead.name + ' after 3 failed attempts');
      }

      // An explicit follow-up beats the implicit one. When the console captured a
      // follow-up, that is what gets created — otherwise the disposition's default
      // still applies, so a hurried agent is never left with nothing scheduled.
      if (opts.followUp && lead) {
        const f = opts.followUp;
        setTasks(t => [...t, { id: 't-' + Date.now(), title: f.title, priority: f.when === 'today' ? 'high' : 'low',
          type: f.type, duration: f.duration || 0.5, leadId, due: f.when }]);
        log('sync_planner', 'Follow-up "' + f.title + '" → action plan (' + FOLLOWUP_WHEN_LABEL[f.when] + ')');
      } else if (disposition === 'Callback Requested' && lead) {
        setTasks(t => [...t, { id: 't-' + Date.now(), title: 'Call back ' + lead.name, priority: 'high', type: 'PC', duration: 0.5, leadId }]);
        log('sync_planner', 'Added "Call back ' + lead.name + '" to the action plan');
      }
      if (!opts.followUp && disposition === 'Appointment Set' && lead) {
        setTasks(t => [...t, { id: 't-' + Date.now(), title: lead.name + ' — ' + (lead.need || 'appointment'), priority: 'high', type: 'FFI', duration: 1, leadId }]);
        log('sync_planner', 'Added "' + lead.name + '" to the action plan — drag it onto the grid');
      }
    });
  }, [commit, log, leads]);

  const resolveNotification = useCallback((id, act) => {
    setNotifications(n => {
      const hit = n.find(x => x.id === id);
      if (hit && act) logCallOutcome(hit.leadId, hit.kind === 'dead' ? 'Bad Number' : 'No Answer', hit.kind === 'dead' ? { dead: true } : { archive: true });
      return n.filter(x => x.id !== id);
    });
  }, [logCallOutcome]);

  const finishCallBlock = useCallback((minutes, calls) => {
    commit('Close call block', () => log('call_block', 'Closed a ' + minutes + '-minute call block · ' + calls + ' call' + (calls === 1 ? '' : 's') + ' made'));
  }, [commit, log]);

  // ── Planner ───────────────────────────────────────────────────────────────
  const scheduleTask = useCallback((task, startHour) => {
    commit('Book ' + task.title, () => {
      setTasks(t => t.filter(x => x.id !== task.id));
      setEvents(e => [...e, { id: 'ev-' + Date.now(), title: task.title, startHour, endHour: startHour + task.duration, type: task.type, leadId: task.leadId }]);
      log('scheduled', 'Booked "' + task.title + '" at ' + formatTime(startHour));
    });
  }, [commit, log]);

  // Book a slot directly, without going through a task. The planner needs a way to
  // create an appointment you already have a time for — drag-to-schedule only covers
  // things that are already in the action plan.
  const addEvent = useCallback(({ title, type, startHour, duration }) => {
    commit('Book ' + title, () => {
      setEvents(e => [...e, { id: 'ev-' + Date.now(), title, startHour, endHour: startHour + duration, type }]);
      log('scheduled', 'Booked "' + title + '" at ' + formatTime(startHour));
    });
  }, [commit, log]);

  const completeTask = useCallback((taskId) => {
    commit('Complete task', () => {
      setTasks(t => {
        const hit = t.find(x => x.id === taskId);
        if (hit) log('task_completed', 'Completed "' + hit.title + '"');
        return t.filter(x => x.id !== taskId);
      });
    });
  }, [commit, log]);

  const setEventStatus = useCallback((eventId, action) => {
    commit(action + ' appointment', () => {
      setEvents(list => list.map(e => {
        if (e.id !== eventId) return e;
        if (action === 'Kept') return { ...e, isCompleted: true, isPlaying: false };
        if (action === 'Cancel') return { ...e, status: 'cancelled', isPlaying: false };
        if (action === 'Postpone') return { ...e, status: 'postponed', isPlaying: false };
        return e;
      }));
      const ev = events.find(e => e.id === eventId);
      if (ev) log(action === 'Kept' ? 'kept' : 'churn', action + ' — ' + ev.title);
    });
  }, [commit, log, events]);

  const togglePlay = useCallback((id) => setEvents(p => p.map(e => e.id === id ? { ...e, isPlaying: !e.isPlaying } : { ...e, isPlaying: false })), []);
  const addTask = useCallback((title, type, duration) => {
    commit('Add task', () => {
      setTasks(t => [...t, { id: 't-' + Date.now() + Math.random(), title, type, priority: 'low', duration: duration || 0.5 }]);
      log('task_added', 'Added "' + title + '" to the action plan');
    });
  }, [commit, log]);

  // ── Manager actions ───────────────────────────────────────────────────────
  // A joint call is a real MTG block, not a note: it lands in the agent's action
  // plan so it has to be scheduled, and it shows in the activity feed as coaching.
  const bookJointCall = useCallback((agentName, what) => {
    commit('Book joint call with ' + agentName, () => {
      setTasks(t => [...t, { id: 't-jc' + Date.now(), title: 'Joint call · ' + agentName, priority: 'high', type: 'JC', duration: 1.5, jointWith: agentName, note: what }]);
      log('joint_call', 'Joint call with ' + agentName + ' sent to the action plan — ' + what);
    });
  }, [commit, log]);

  const reassignLeads = useCallback((from, to, n) => {
    commit('Reassign ' + n + ' leads', () => {
      let moved = 0;
      setLeads(list => list.map(l => {
        if (moved < n && l.assignedTo === from && l.status === 'pending') { moved++; return { ...l, assignedTo: to }; }
        return l;
      }));
      setAgents(a => a.map(ag => ag.name === from ? { ...ag, open: Math.max(0, ag.open - n) } : ag.name === to ? { ...ag, open: ag.open + n } : ag));
      log('reassign', n + ' lead' + (n > 1 ? 's' : '') + ' moved from ' + from + ' to ' + to);
    });
  }, [commit, log]);

  const nudge = useCallback((agentName, why) => {
    commit('Nudge ' + agentName, () => log('nudge', 'Nudged ' + agentName + ' — ' + why));
  }, [commit, log]);

  const setTallyExtra = useCallback((day, type, n, note) => {
    const v = Math.max(0, Number(n) || 0);
    commit('Declare ' + type + ' on ' + day, () => {
      setTally(t => ({ ...t, [day]: { ...(t[day] || {}), [type]: v, ...(note ? { ['_note_' + type]: note } : {}) } }));
      log('declared', v === 0 ? 'Cleared declared ' + type + ' for ' + day
        : 'Declared ' + v + ' off-system ' + type + ' on ' + day + (note ? ' — ' + note : ''));
    });
  }, [commit, log]);

  // ── Stalled threads ──────────────────────────────────────────────────
  // Three responses, not one. Escalation is the only one that ever crosses a
  // boundary, and it carries ONE prospect bound to ONE appointment. Snooze and
  // eliminate are the agent's own housekeeping: eliminate is a win (it clears the
  // old-names pool), and a snooze is deliberately NOT written to the activity feed
  // — a dismissal a manager could count is not a free dismissal.
  const escalateLead = useCallback((leadId, why) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    commit('Escalate ' + lead.name, () => {
      setLeads(list => list.map(l => l.id === leadId ? { ...l, escalated: true } : l));
      setTasks(t => [...t, { id: 't-esc' + Date.now(), title: 'Joint call · ' + lead.name, priority: 'high',
        type: 'JC', duration: 1.5, leadId, escalation: true, note: why }]);
      log('escalated', 'Asked for a second pair of eyes on ' + lead.name + ' — ' + why);
    });
  }, [commit, log, leads]);

  const eliminateLead = useCallback((leadId, reason) => {
    const lead = leads.find(l => l.id === leadId);
    commit('Eliminate lead', () => {
      setLeads(list => list.map(l => l.id === leadId ? { ...l, status: 'eliminated', eliminatedFor: reason } : l));
      if (lead) log('eliminated', lead.name + ' cleared from the working list — ' + reason);
    });
  }, [commit, log, leads]);

  // No commit, no log: a snooze leaves no trace anywhere by design. But it stores an
  // EXPIRY INSTANT, not a duration, and it does not touch the accumulated history —
  // "come back to it in two weeks" has to actually come back, with its evidence
  // intact. Storing a duration and zeroing the touch count would make three taps a
  // permanent, unrecorded delete of the signal, which is the counter-reset the
  // whole design is trying not to build.
  const snoozeLead = useCallback((leadId, days) => {
    const until = Date.now() + days * 86400000;
    setLeads(list => list.map(l => l.id === leadId ? { ...l, snoozedUntil: until } : l));
  }, []);

  // ── Joint call as an OFFER ──────────────────────────────────────────
  // A manager-booked block that simply appears in the agent's plan is not an offer.
  // Accepting creates the block; declining creates nothing and records nothing —
  // if a decline trends anywhere it stops being declinable.
  const offerJointCall = useCallback((agentName, what) => {
    commit('Offer a joint call to ' + agentName, () => {
      setJointOffers(o => [{ id: 'jo' + Date.now(), agent: agentName, what, at: now() }, ...o]);
      log('joint_call', 'Offered ' + agentName + ' a joint call — ' + what);
    });
  }, [commit, log]);

  const answerJointOffer = useCallback((id, accept) => {
    setJointOffers(list => {
      const hit = list.find(o => o.id === id);
      if (hit && accept) {
        setTasks(t => [...t, { id: 't-jc' + Date.now(), title: 'Joint call · ' + hit.agent, priority: 'high',
          type: 'JC', duration: 1.5, jointWith: hit.agent, note: hit.what }]);
        log('joint_call', 'Accepted the joint call — ' + hit.what + ' · in the action plan to schedule');
      }
      return list.filter(o => o.id !== id);
    });
  }, [log]);

  // ── Pipeline ──────────────────────────────────────────────────────────
  // Advancing a stage is the event the stall detector is measuring against, so it
  // resets BOTH counters. That is the whole reason the signal is "touches since the
  // last advance" rather than "touches": movement clears it, activity alone does not.
  const advanceStage = useCallback((leadId, stage) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.stage === stage) return;
    commit('Move ' + lead.name + ' to ' + stage, () => {
      setLeads(list => list.map(l => l.id === leadId
        ? { ...l, stage, touchesSinceAdvance: 0, daysSinceAdvance: 0, snoozedUntil: null } : l));
      log('stage', lead.name + ': ' + (lead.stage || 'Approach') + ' → ' + stage);
    });
  }, [commit, log, leads]);

  // The end of the pipeline is a policy in the ledger, not a status flag — which is
  // also what makes the settled figure on the game plan move.
  const convertToClient = useCallback((leadId, policy) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    commit('Convert ' + lead.name, () => {
      setPolicies(p => [...p, newPolicy({
        policyNo: policy.policyNo, client: lead.name, product: policy.product,
        api: Number(policy.api) || 0, settledOn: policy.settledOn, fromLeadId: leadId,
      })]);
      setLeads(list => list.map(l => l.id === leadId ? { ...l, stage: 'Client', status: 'success' } : l));
      log('converted', lead.name + ' written as ' + policy.policyNo + ' · TTD ' + (Number(policy.api) || 0).toLocaleString());
    });
  }, [commit, log, leads]);

  // ── Applications ────────────────────────────────────────────────────────
  // The prospect half of the pipeline ends at the closing interview; from there the
  // thing moving is an APPLICATION. Delivery is a real stage, not paperwork after the
  // fact — an undelivered policy is the most common way business is lost after it was
  // already won, which is why the delivery register exists.
  const createApplication = useCallback((leadId, form) => {
    const lead = leads.find(l => l.id === leadId);
    // A policy number is the unique key of a policy, so a collision is not a cosmetic
    // clash — it corrupts the ledger that feeds the settled figure and the clients
    // export. Taken numbers are stepped past rather than trusted from the input.
    const taken = new Set([...policies.map(p => p.policyNo), ...applications.map(a => a.policyNo)]);
    let policyNo = String(form.policyNo || '').trim();
    if (taken.has(policyNo)) {
      const m = policyNo.match(/^(.*?)(\d+)$/);
      if (m) { let n = Number(m[2]); const w = m[2].length; do { n++; policyNo = m[1] + String(n).padStart(w, '0'); } while (taken.has(policyNo)); }
      else policyNo = policyNo + '-2';
    }
    const app = {
      id: 'ap' + Date.now(), leadId, client: lead ? lead.name : form.client,
      product: form.product, api: Number(form.api) || 0, policyNo,
      stage: 'App', appliedOn: '29 Jul 2026', underwriting: 'submitted',
    };
    commit('Submit application for ' + app.client, () => {
      setApplications(a => [...a, app]);
      if (lead) setLeads(list => list.map(l => l.id === leadId ? { ...l, stage: 'App', touchesSinceAdvance: 0, daysSinceAdvance: 0 } : l));
      log('applied', app.client + ' · ' + app.product + ' application submitted · ' + app.policyNo
        + (policyNo !== String(form.policyNo || '').trim() ? ' (renumbered — ' + form.policyNo + ' was taken)' : ''));
    });
    return app;
  }, [commit, log, leads, policies, applications]);

  const advanceApplication = useCallback((appId, stage) => {
    commit('Move application', () => {
      setApplications(list => list.map(a => {
        if (a.id !== appId) return a;
        if (stage === 'Delivery') { log('issued', a.client + ' · ' + a.policyNo + ' issued — on the delivery register'); return { ...a, stage, issuedOn: '29 Jul 2026', underwriting: 'issued standard' }; }
        log('stage', a.client + ' · ' + a.policyNo + ' → ' + stage);
        return { ...a, stage };
      }));
    });
  }, [commit, log]);

  // Delivered and receipted — this is the moment it becomes a policy in the ledger,
  // and the moment the settled figure on the game plan moves.
  const deliverApplication = useCallback((appId) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    commit('Deliver ' + app.policyNo, () => {
      setPolicies(p => [...p, newPolicy({
        policyNo: app.policyNo, client: app.client, product: app.product,
        api: app.api, fromLeadId: app.leadId, fromAppId: app.id,
      })]);
      setApplications(list => list.map(a => a.id === appId ? { ...a, stage: 'Client', deliveredOn: '29 Jul 2026' } : a));
      if (app.leadId) setLeads(list => list.map(l => l.id === app.leadId ? { ...l, stage: 'Client', status: 'success' } : l));
      log('converted', app.client + ' · ' + app.policyNo + ' delivered and receipted · TTD ' + app.api.toLocaleString());
    });
  }, [commit, log, applications]);

  const advanceRecruit = useCallback((id, stage) => {
    const rec = recruits.find(r => r.id === id);
    if (!rec || rec.stage === stage) return;
    commit('Move ' + rec.name + ' to ' + stage, () => {
      setRecruits(list => list.map(r => r.id === id ? { ...r, stage, days: 0 } : r));
      log('recruit', rec.name + ': ' + rec.stage + ' → ' + stage + (rec.sponsor ? ' · sponsored by ' + rec.sponsor : ''));
      // The Career interview STAGE and the RI calendar block are one event, not two
      // things to keep in step by hand — so moving them here books the interview, and
      // the unit ladder's RI row can finally be fed by the product itself.
      if (stage === 'Interview') {
        setTasks(t => [...t, { id: 't-ri' + Date.now(), title: 'Career interview · ' + rec.name,
          priority: 'high', type: 'RI', duration: 1, recruitId: id, note: rec.source + ' · ' + rec.area }]);
        log('recruit', 'Career interview for ' + rec.name + ' is in the action plan — drop it on the grid');
      }
    });
  }, [commit, log, recruits]);

  // Producing is a milestone on an EXISTING user, not the creation of one — the roster
  // row was written at Contracted and licensed at Licensed. All this does is retire
  // the new-joiner grace, which is what puts them into the unit-floor arithmetic.
  const activateRecruit = useCallback((id) => {
    const rec = recruits.find(r => r.id === id);
    if (!rec) return;
    commit('Activate ' + rec.name, () => {
      setAgents(a => a.some(x => x.recruitId === id)
        ? a.map(x => x.recruitId === id ? { ...x, newJoiner: false, producing: true } : x)
        : [...a, {
          id: 'ag' + Date.now(), name: rec.name, initials: rec.name.split(' ').map(w => w[0]).join('').slice(0, 2),
          area: rec.area, open: 0, active: true, producing: true,
          agentCode: rec.agentCode || 'A-' + (1400 + Math.floor(Math.random() * 200)),
          unit: rec.unit || 'Tatil Life South', branch: 'South', role: 'Associate',
          licensed: true, canSell: true, regNo: rec.regNo || 'FSC-2' + (3000 + Math.floor(Math.random() * 900)),
          sponsor: rec.sponsor, recruitId: id,
        }]);
      setRecruits(list => list.map(r => r.id === id ? { ...r, stage: 'Producing', days: 0 } : r));
      log('recruit', rec.name + ' wrote their first case — now counted in the unit floor' + (rec.sponsor ? ' · ' + rec.sponsor + ' sponsored' : ''));
    });
  }, [commit, log, recruits]);

  // ── Recruit → user ─────────────────────────────────────────────────────
  // Three separate events, not one. CONTRACTED is the identity event — the person
  // signs, gets an agent code, a login, a role, and a place in a unit under a branch;
  // they are on the roster from that moment. LICENSED is the regulatory gate that
  // grants `canSell`. PRODUCING is a performance milestone and grants nothing.
  // Collapsing them meant a recruit appeared on the roster with no placement at all.
  const contractRecruit = useCallback((recruitId, form) => {
    const rec = recruits.find(r => r.id === recruitId);
    if (!rec) return;
    commit('Contract ' + rec.name, () => {
      setAgents(a => [...a, {
        id: 'ag' + Date.now(), name: rec.name, initials: rec.name.split(' ').map(w => w[0]).join('').slice(0, 2),
        area: rec.area, open: 0, active: true, newJoiner: true,
        agentCode: form.agentCode, unit: form.unit, branch: form.branch, role: form.role || 'Associate',
        licensed: false, canSell: false, sponsor: rec.sponsor, recruitId,
      }]);
      setRecruits(list => list.map(r => r.id === recruitId ? { ...r, stage: 'Contracted', days: 0, agentCode: form.agentCode, unit: form.unit } : r));
      log('provisioned', rec.name + ' contracted as ' + form.agentCode + ' · ' + form.unit + ' (' + form.branch + ' branch) — account created, cannot be assigned leads until licensed');
    });
  }, [commit, log, recruits]);

  // Provision-or-refuse, never a silent no-op: if the account is missing the recruit
  // was never contracted, so licensing them has to create it rather than logging a
  // permission grant that landed on nothing.
  const licenseRecruit = useCallback((recruitId, form) => {
    const rec = recruits.find(r => r.id === recruitId);
    if (!rec) return;
    commit('License ' + rec.name, () => {
      setAgents(a => a.some(x => x.recruitId === recruitId)
        ? a.map(x => x.recruitId === recruitId ? { ...x, licensed: true, canSell: true, regNo: form.regNo } : x)
        : [...a, {
          id: 'ag' + Date.now(), name: rec.name, initials: rec.name.split(' ').map(w => w[0]).join('').slice(0, 2),
          area: rec.area, open: 0, active: true, newJoiner: true,
          agentCode: rec.agentCode || form.agentCode || 'A-' + (1400 + Math.floor(Math.random() * 200)),
          unit: rec.unit || 'Tatil Life South', branch: 'South', role: 'Associate',
          licensed: true, canSell: true, regNo: form.regNo, sponsor: rec.sponsor, recruitId,
        }]);
      setRecruits(list => list.map(r => r.id === recruitId ? { ...r, stage: 'Licensed', days: 0, exam: 'passed · registered', regNo: form.regNo } : r));
      log('provisioned', rec.name + ' registered as ' + form.regNo + ' — can now be assigned leads and write business');
    });
  }, [commit, log, recruits]);

  // ── Keeping the business ────────────────────────────────────────────────
  // A chase is an activity with a real outcome, so it books a collection block rather
  // than just flipping a flag — a premium is not saved by ticking a box.
  const chasePremium = useCallback((policyId) => {
    const p = policies.find(x => x.id === policyId);
    if (!p) return;
    commit('Chase ' + p.policyNo, () => {
      setTasks(t => [...t, { id: 't-col' + Date.now(), title: 'Collect · ' + p.client + ' (' + p.policyNo + ')',
        priority: 'high', type: 'COLL', duration: 0.5, policyId }]);
      log('persistency', 'Chasing ' + p.client + ' · ' + p.policyNo + ' — collection block in the action plan');
    });
  }, [commit, log, policies]);

  const resolvePersistency = useCallback((policyId) => {
    const p = policies.find(x => x.id === policyId);
    commit('Resolve persistency', () => {
      setPolicies(list => list.map(x => x.id === policyId ? { ...x, persistency: 'in force', premium: 'paid' } : x));
      if (p) log('persistency', p.client + ' · ' + p.policyNo + ' back in force — premium received'
        + (p.settledDaysAgo < CLAWBACK_DAYS ? ' · TTD ' + Math.round(p.api * 0.4).toLocaleString() + ' of commission no longer at risk' : ''));
    });
  }, [commit, log, policies]);

  // ── Commission reconciliation ───────────────────────────────────────────
  // A query is a real thing sent to the carrier, so it is recorded and stays open
  // until it is answered — the whole failure mode of commission chasing is that it
  // happens by phone and leaves no trace, so the same shortfall is argued twice.
  const raiseQuery = useCallback((row, note) => {
    commit('Query ' + row.policyNo, () => {
      setQueries(q => [{ id: 'q' + Date.now(), policyNo: row.policyNo, expected: row.expected, paid: row.paid,
        gap: row.gap, note, at: now(), status: 'open' }, ...q]);
      log('commission', 'Queried ' + row.policyNo + ' with the carrier — ' + (row.gap < 0 ? 'short by TTD ' : 'over by TTD ')
        + Math.abs(row.gap).toLocaleString() + (note ? ' · ' + note : ''));
    });
  }, [commit, log]);

  const closeQuery = useCallback((id, outcome) => {
    commit('Close query', () => {
      setQueries(list => {
        const hit = list.find(q => q.id === id);
        if (hit) log('commission', 'Query on ' + hit.policyNo + ' closed — ' + outcome);
        return list.map(q => q.id === id ? { ...q, status: outcome } : q);
      });
    });
  }, [commit, log]);

  // ── Prep ─────────────────────────────────────────────────────────────
  // Prep is a PROPERTY of an appointment, not an activity of its own. A prep block
  // booked separately is the first thing dropped when the day slips; prep attached to
  // the appointment travels with it. No code, no floor credit — a state the block
  // carries and shows.
  const togglePrep = useCallback((eventId, key) => {
    setEvents(list => list.map(e => e.id === eventId
      ? { ...e, prep: { ...(e.prep || {}), [key]: !(e.prep || {})[key] } } : e));
  }, []);

  const dialerQueue = leads.filter(l => l.status === 'pending');

  return {
    leads, dialerQueue, tasks, events, queues, activities, notifications, calls, tally, jointOffers, policies, applications, recruits, settlements, queries,
    agents, batches, online, queued, syncing,
    addLead, addLeadsBulk, undoImport, addQueue, logCallOutcome, resolveNotification, finishCallBlock,
    bookJointCall, reassignLeads, nudge, setTallyExtra,
    escalateLead, eliminateLead, snoozeLead, offerJointCall, answerJointOffer,
    advanceStage, convertToClient, createApplication, advanceApplication, deliverApplication,
    advanceRecruit, activateRecruit, contractRecruit, licenseRecruit,
    chasePremium, resolvePersistency, raiseQuery, closeQuery, togglePrep,
    scheduleTask, completeTask, addEvent, setEventStatus, togglePlay, addTask, goOnline, log,
  };
}

Object.assign(window, { useSyncStore, NEED_OPTIONS, SOURCE_OPTIONS, NON_CONTACT, DISPOSITIONS, SEED_LEADS, AGENTS, POLICIES, BRANCHES, CLAWBACK_DAYS, SETTLEMENTS,
  FOLLOWUP_WHEN_LABEL, FOLLOWUP_KINDS });

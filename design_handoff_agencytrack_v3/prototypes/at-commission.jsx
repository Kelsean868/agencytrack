// Commission reconciliation — the surface that makes this not a CRM.
//
// A CRM tracks activity. An agency-management system answers a harder question: did
// the carrier actually pay what the business earned? Those are two numbers, they
// disagree more often than anyone admits, and the disagreement is where money quietly
// goes missing — a rate applied wrong, a policy paid at annuity scale, a settlement
// line for a policy nobody recognises.
//
// THREE VERDICTS, and the vocabulary is the design system's own:
//   MATCH     — expected and paid agree within tolerance. Nothing to do.
//   CONFLICT  — they disagree. Short is money owed to the agent; over is a future
//               reversal, which is worse, because it will be taken back silently.
//   UNMATCHED — a settlement line with no policy, or a policy with no settlement.
//               Both directions matter and most systems only show one.
//
// A QUERY IS A RECORD, not a phone call. The failure mode of commission chasing is
// that it happens by phone and leaves no trace, so the same shortfall gets argued
// twice and the second time nobody remembers the first answer.
const { Icon: CmIcon } = window.AgencyTrackDesignSystem_ad1cd7;

// Commission rate by product family. The real schedule is a carrier contract; what
// matters here is that expected commission is COMPUTED from a rate the app holds,
// not typed in — otherwise reconciliation is just comparing two guesses.
const RATES = [
  { m: /annuity/i, rate: 0.30, lab: 'annuity' },
  { m: /term/i, rate: 0.40, lab: 'term' },
  { m: /./, rate: 0.40, lab: 'life' },
];
const rateFor = (product) => (RATES.find(r => r.m.test(product || '')) || RATES[RATES.length - 1]);
const TOLERANCE = 1;   // TTD — rounding, not a discrepancy

// One reconciliation pass, both directions.
function reconcile(store) {
  const policies = store.policies || [];
  const settlements = store.settlements || [];
  const rows = [];
  const seen = new Set();

  policies.forEach(p => {
    const r = rateFor(p.product);
    const expected = Math.round(p.api * r.rate);
    const lines = settlements.filter(s => s.policyNo === p.policyNo);
    lines.forEach(s => seen.add(s.id));
    const paid = lines.reduce((n, s) => n + s.paid, 0);
    const gap = paid - expected;
    rows.push({
      key: p.id, policyNo: p.policyNo, client: p.client, product: p.product, api: p.api,
      rate: r.rate, rateLab: r.lab, expected, paid, gap, lines,
      verdict: !lines.length ? 'unpaid' : Math.abs(gap) <= TOLERANCE ? 'match' : 'conflict',
      on: lines.length ? lines[lines.length - 1].on : null,
      ref: lines.length ? lines[lines.length - 1].ref : null,
    });
  });

  // The other direction: carrier lines with nothing on the book to attach to. Most
  // systems never show these, which is how a stranger's policy gets paid to a unit.
  settlements.filter(s => !seen.has(s.id)).forEach(s => rows.push({
    key: s.id, policyNo: s.policyNo, client: null, product: null, api: null,
    rate: null, expected: null, paid: s.paid, gap: null, lines: [s],
    verdict: 'orphan', on: s.on, ref: s.ref,
  }));

  return rows;
}

const VERDICT = {
  match: ['\u2713 MATCH', 'var(--success)', 'var(--successTint)'],
  conflict: ['CONFLICT', 'var(--danger)', 'var(--dangerTint)'],
  unpaid: ['NOT PAID YET', 'var(--warning)', 'var(--warningTint)'],
  orphan: ['UNMATCHED', 'var(--inkAccent)', 'var(--inkAccentTint)'],
};

function QueryRow({ row, store, onClose }) {
  const { useState } = React;
  const short = row.gap != null && row.gap < 0;
  const [note, setNote] = useState(row.verdict === 'orphan'
    ? 'No policy on our book with this number — whose is it?'
    : short ? 'Paid at ' + Math.round((row.paid / row.api) * 100) + '% against a contracted ' + Math.round(row.rate * 100) + '%'
      : 'Overpaid — flag before it is reversed');
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-label="Query the carrier" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ov-scrim"></div>
      <div className="ov-panel cm-sheet">
        <div className="ov-head">
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="ov-title" style={{ display: 'block' }}>Query {row.policyNo}</span>
            <span className="ov-sub" style={{ display: 'block' }}>{row.client || 'no matching policy'} · settlement {row.ref || '—'}</span>
          </span>
          <button className="ov-x" onClick={onClose} aria-label="Close"><CmIcon name="plus" size={16} style={{ transform: 'rotate(45deg)' }} /></button>
        </div>
        <div className="ov-body">
          <div className="cm-calc">
            <span><b>API</b>{row.api != null ? ttd(row.api) : '—'}</span>
            <span><b>Rate</b>{row.rate != null ? Math.round(row.rate * 100) + '% ' + row.rateLab : '—'}</span>
            <span><b>Expected</b>{row.expected != null ? ttd(row.expected) : '—'}</span>
            <span><b>Paid</b>{ttd(row.paid)}</span>
            <span className={row.gap != null && row.gap !== 0 ? 'is-gap' : ''}><b>Gap</b>{row.gap != null ? (row.gap > 0 ? '+' : '') + ttd(row.gap) : 'unmatched'}</span>
          </div>
          <label className="fld"><span className="fld-lab">What you are asking</span>
            <input className="ap-in" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <p className="ov-note">The query is recorded against this policy and stays open until it is answered. Commission chasing done by phone leaves no trace, so the same shortfall gets argued twice and the second time nobody remembers the first answer.</p>
        </div>
        <div className="ov-foot">
          <button className="pb pb-sec" onClick={onClose}>Cancel</button>
          <button className="pb pb-pri" onClick={() => { store.raiseQuery(row, note); onClose(); }}><CmIcon name="check" size={15} /> Raise the query</button>
        </div>
      </div>
    </div>
  );
}

function CommissionScreen({ store, onGoto }) {
  const { useState } = React;
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState(null);
  const rows = reconcile(store);
  const open = (store.queries || []).filter(q => q.status === 'open');
  const tally = { match: 0, conflict: 0, unpaid: 0, orphan: 0 };
  rows.forEach(r => { tally[r.verdict]++; });
  // Short-paid means the carrier settled and settled WRONG. A policy awaiting
  // settlement has a negative gap arithmetically but is not money owed — folding the
  // two together inflates the headline and buries the real shortfall.
  const owed = rows.filter(r => r.verdict === 'conflict' && r.gap < 0).reduce((n, r) => n + -r.gap, 0);
  const over = rows.filter(r => r.verdict === 'conflict' && r.gap > 0).reduce((n, r) => n + r.gap, 0);
  const shortRows = rows.filter(r => r.verdict === 'conflict' && r.gap < 0).length;
  const awaiting = rows.filter(r => r.verdict === 'unpaid').reduce((n, r) => n + r.expected, 0);
  const shown = filter === 'all' ? rows : filter === 'issues' ? rows.filter(r => r.verdict !== 'match') : rows.filter(r => r.verdict === filter);
  const queried = (no) => (store.queries || []).some(q => q.policyNo === no && q.status === 'open');

  return (
    <div className="scr-wrap">
      <div className="scr-tool">
        <span className="scr-eyebrow">Commission · what was earned against what was paid</span>
        <div className="seg-sm">
          {[['all', 'All ' + rows.length], ['issues', 'Needs a look ' + (rows.length - tally.match)], ['conflict', 'Conflict ' + tally.conflict], ['orphan', 'Unmatched ' + tally.orphan]]
            .map(([k, l]) => <button key={k} className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        {open.length > 0 && <span className="pk-deliver-flag" title="Queries raised with the carrier and not yet answered">{open.length} open quer{open.length === 1 ? 'y' : 'ies'}</span>}
      </div>

      <div className="bk">
        <div className="bk-tiles">
          <div className="bk-tile">
            <span className="gp-lab">SHORT-PAID TO YOU</span>
            <b className="gp-big" style={{ color: owed ? 'var(--danger)' : 'var(--success)' }}>{ttd(owed)}</b>
            <span className="gp-of">across {shortRows} settled polic{shortRows === 1 ? 'y' : 'ies'} · {ttd(awaiting)} still awaiting settlement</span>
          </div>
          <div className="bk-tile">
            <span className="gp-lab">OVERPAID · WILL BE REVERSED</span>
            <b className="gp-big" style={{ color: over ? 'var(--warning)' : 'var(--ink)' }}>{ttd(over)}</b>
            <span className="gp-of">flag it before the carrier takes it back quietly</span>
          </div>
          <div className="bk-tile">
            <span className="gp-lab">RECONCILED</span>
            <b className="gp-big" style={{ color: 'var(--success)' }}>{tally.match}<i style={{ fontSize: 16 }}>/{rows.length}</i></b>
            <span className="gp-of">{tally.unpaid} awaiting settlement · {tally.orphan} unmatched line{tally.orphan === 1 ? '' : 's'}</span>
          </div>
        </div>

        <section className="mg-card">
          <div className="mg-card-h"><span className="pf-eb">POLICY BY POLICY</span>
            <span className="mg-card-note">expected is computed from the contracted rate, never typed</span></div>
          <div className="cm-rows" role="table" aria-label="Commission reconciliation">
            <div className="cm-row cm-head" role="row">
              <span role="columnheader">Policy</span><span role="columnheader">Client</span>
              <span role="columnheader">API</span><span role="columnheader">Rate</span>
              <span role="columnheader">Expected</span><span role="columnheader">Paid</span>
              <span role="columnheader">Gap</span><span role="columnheader">Verdict</span><span role="columnheader"></span>
            </div>
            {shown.map(r => {
              const [lab, fg, bg] = VERDICT[r.verdict];
              return (
                <div key={r.key} className={'cm-row cm-' + r.verdict} role="row">
                  <span className="bk-pol" role="cell">{r.policyNo}</span>
                  <span className="bk-who" role="cell"><b title={r.client || 'not on the book'}>{r.client || <em>not on our book</em>}</b>
                    <span>{r.product || (r.ref ? 'settlement ' + r.ref : '')}</span></span>
                  <span className="cm-n" role="cell">{r.api != null ? ttd(r.api) : '\u2014'}</span>
                  <span className="cm-rate" role="cell" title={r.rateLab ? 'contracted ' + r.rateLab + ' rate' : 'no rate \u2014 no policy'}>{r.rate != null ? Math.round(r.rate * 100) + '%' : '\u2014'}</span>
                  <span className="cm-n" role="cell">{r.expected != null ? ttd(r.expected) : '\u2014'}</span>
                  <span className="cm-n" role="cell">{r.paid ? ttd(r.paid) : '\u2014'}</span>
                  <span className="cm-n cm-gap" role="cell" style={{ color: r.gap == null || r.verdict === 'unpaid' ? 'var(--inkMute)' : r.gap < 0 ? 'var(--danger)' : r.gap > 0 ? 'var(--warning)' : 'var(--inkMute)' }}>
                    {r.gap == null || r.verdict === 'unpaid' ? '\u2014' : r.gap === 0 ? '0' : (r.gap > 0 ? '+' : '\u2212') + ttd(Math.abs(r.gap)).replace('TTD ', '')}
                  </span>
                  <span className="cm-verdict" role="cell" style={{ color: fg, background: bg }}>{lab}</span>
                  <span role="cell">{r.verdict === 'match' ? <span className="gp-done"><CmIcon name="check" size={13} /></span>
                    : queried(r.policyNo) ? <span className="cm-open">queried</span>
                      : r.verdict === 'unpaid' ? <span className="cm-wait">waiting</span>
                        : <button className="mg-act" onClick={() => setQuery(r)}>Query</button>}</span>
                </div>
              );
            })}
          </div>
        </section>

        {(store.queries || []).length > 0 && (
          <section className="mg-card">
            <div className="mg-card-h"><span className="pf-eb">QUERIES WITH THE CARRIER</span>
              <span className="mg-card-note">{open.length} open of {(store.queries || []).length}</span></div>
            <div className="cm-queries">
              {(store.queries || []).map(q => (
                <div key={q.id} className={'cm-q' + (q.status === 'open' ? ' is-open' : '')}>
                  <span className="bk-pol">{q.policyNo}</span>
                  <span className="cm-q-b"><b>{q.note}</b>
                    <span>{q.gap != null ? (q.gap < 0 ? 'short by ' : 'over by ') + ttd(Math.abs(q.gap)) : 'unmatched'} · raised {q.at}</span></span>
                  {q.status === 'open'
                    ? <span className="cm-q-acts">
                      <button className="mg-act" onClick={() => store.closeQuery(q.id, 'paid in the next run')}>Carrier paid</button>
                      <button className="mg-act" onClick={() => store.closeQuery(q.id, 'rate was correct \u2014 our expectation was wrong')}>We were wrong</button>
                    </span>
                    : <span className="cm-q-done">{q.status}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="rc-fine">Expected commission is computed from the contracted rate against settled API \u2014 never typed in, because reconciliation between two typed numbers is just comparing two guesses. An overpayment matters more than a shortfall: a shortfall is money you can ask for, an overpayment is a reversal that will arrive without warning. And the unmatched line runs the other way \u2014 a carrier settlement with no policy on your book is somebody else&rsquo;s business paid into your unit, which no system that only reconciles forwards will ever show you.</p>
      </div>
      {query && <QueryRow row={query} store={store} onClose={() => setQuery(null)} />}
    </div>
  );
}

Object.assign(window, { CommissionScreen, reconcile, rateFor, RATES, VERDICT });

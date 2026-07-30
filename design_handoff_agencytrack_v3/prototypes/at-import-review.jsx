// Bulk lead import — step 3: review, distribute, commit.
// Errors are never importable; duplicates are skipped by default but can be taken
// anyway; distribution runs over the KEPT rows only, so the balance mode does not
// count rows you left out.
const { Icon: RIcon, Avatar: RAvatar } = window.AgencyTrackDesignSystem_ad1cd7;

const DIST_MODES = [
  ['column', 'From the file', 'Use the Assign-to column as it came in'],
  ['single', 'One agent', 'Everything to a single agent'],
  ['round', 'Round robin', 'Even split across the active unit'],
  ['balance', 'Balance the load', 'Lightest open-lead count gets fed first'],
];
const STATUS_TONE = {
  ready: ['var(--success)', 'READY'],
  warn: ['var(--warning)', 'CHECK'],
  dupe: ['var(--inkAccent)', 'DUPLICATE'],
  error: ['var(--danger)', 'CANNOT IMPORT'],
};

function SummaryChip({ tone, n, label, on, onClick }) {
  return (
    <button className={'bi-chip' + (on ? ' is-on' : '')} onClick={onClick} aria-pressed={on}
      style={{ '--chip': tone }} disabled={!n}>
      <b>{n}</b><span>{label}</span>
    </button>
  );
}

function ReviewStep({ rows, file, store, onGoto, onBack, result, setResult, onRestart }) {
  const { useState, useMemo } = React;
  const [skipped, setSkipped] = useState({});          // rid → true
  const [takeDupe, setTakeDupe] = useState({});        // rid → true (import anyway)
  const [mode, setMode] = useState('balance');
  const [single, setSingle] = useState(store.agents.filter(a => a.active)[0].name);
  const [queue, setQueue] = useState(store.queues[0]);
  const [filter, setFilter] = useState(null);
  const [committing, setCommitting] = useState(false);

  const tally = useMemo(() => {
    const t = { ready: 0, warn: 0, dupe: 0, error: 0 };
    rows.forEach(r => { t[rowStatus(r)]++; });
    return t;
  }, [rows]);

  // A row is kept unless it errored, was hand-skipped, or is a duplicate you
  // have not explicitly taken.
  const isKept = (r) => {
    const st = rowStatus(r);
    if (st === 'error') return false;
    if (skipped[r.rid]) return false;
    if (r.dupe && !takeDupe[r.rid]) return false;
    return true;
  };
  const keptRows = rows.filter(isKept);
  const assigned = useMemo(
    () => distribute(keptRows.map(r => ({ ...r, values: { ...r.values, queue: r.values.queue || queue } })), mode, store.agents, single),
    [keptRows, mode, store.agents, single, queue]
  );
  const split = useMemo(() => {
    const m = {};
    assigned.forEach(r => { const k = r.values.assignedTo || 'Unassigned'; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [assigned]);

  const shown = filter ? rows.filter(r => rowStatus(r) === filter) : rows;

  const commit = () => {
    setCommitting(true);
    setTimeout(() => {
      const batch = store.addLeadsBulk(assigned, { file, queue, skipped: rows.length - assigned.length });
      setCommitting(false);
      setResult(batch);
    }, 480);
  };

  if (result) {
    return (
      <div className="bi-pane">
        <div className="bi-done">
          <span className="bi-done-ic"><RIcon name="check" size={26} /></span>
          <b>{result.count} leads are in the dialer</b>
          <span>From <em>{result.file}</em> into {result.queue}{result.skipped ? ' · ' + result.skipped + ' row' + (result.skipped > 1 ? 's' : '') + ' left out' : ''}.</span>
          <div className="bi-done-split">
            {Object.entries(result.perAgent).sort((a, b) => b[1] - a[1]).map(([n, c]) => (
              <span key={n} className="bi-done-ag"><RAvatar initials={n.split(' ').map(w => w[0]).join('').slice(0, 2)} size={26} /><b>{n}</b><i>{c}</i></span>
            ))}
          </div>
          <div className="bi-done-acts">
            <button className="pb pb-pri" onClick={() => onGoto('Dialer')}>Start calling</button>
            <button className="pb pb-sec" onClick={() => onGoto('Activity')}>See what was recorded</button>
            <button className="pb pb-ghost" onClick={onRestart}>Import another list</button>
            <button className="bi-undo" onClick={() => { store.undoImport(result.id); setResult(null); }}>
              <RIcon name="repeat" size={13} /> Undo this import
            </button>
          </div>
        </div>
        <p className="rc-fine">Undo removes every lead from this batch and puts each agent's open count back where it was — the import is one reversible unit, not {result.count} separate writes to unpick by hand.</p>
      </div>
    );
  }

  return (
    <div className="bi-pane bi-review">
      <div className="bi-sum">
        <SummaryChip tone="var(--success)" n={tally.ready} label="clean" on={filter === 'ready'} onClick={() => setFilter(f => f === 'ready' ? null : 'ready')} />
        <SummaryChip tone="var(--warning)" n={tally.warn} label="need a look" on={filter === 'warn'} onClick={() => setFilter(f => f === 'warn' ? null : 'warn')} />
        <SummaryChip tone="var(--inkAccent)" n={tally.dupe} label="already known" on={filter === 'dupe'} onClick={() => setFilter(f => f === 'dupe' ? null : 'dupe')} />
        <SummaryChip tone="var(--danger)" n={tally.error} label="unusable" on={filter === 'error'} onClick={() => setFilter(f => f === 'error' ? null : 'error')} />
        <span className="bi-sum-note">{keptRows.length} of {rows.length} rows will import{filter ? ' · showing ' + shown.length + ' filtered' : ''}</span>
      </div>

      <div className="bi-dist">
        <div className="bi-dist-head">
          <span className="pf-eb">WHO WORKS THESE</span>
          <label className="bi-inline-fld"><span>Queue for rows with none</span>
            <select className="ap-in" value={queue} onChange={(e) => setQueue(e.target.value)}>
              {store.queues.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          </label>
        </div>
        <div className="bi-modes" role="radiogroup" aria-label="Distribution">
          {DIST_MODES.map(([v, l, d]) => (
            <button key={v} role="radio" aria-checked={mode === v} className={'bi-mode' + (mode === v ? ' is-on' : '')} onClick={() => setMode(v)}>
              <b>{l}</b><span>{d}</span>
            </button>
          ))}
        </div>
        {mode === 'single' && (
          <label className="bi-inline-fld bi-single"><span>Assign every lead to</span>
            <select className="ap-in" value={single} onChange={(e) => setSingle(e.target.value)}>
              {store.agents.filter(a => a.active && a.canSell !== false).map(a => <option key={a.id} value={a.name}>{a.name} — {a.open} open</option>)}
            </select>
          </label>
        )}
        {store.agents.some(a => a.active && a.canSell === false) && (
          <span className="bi-hintline">{store.agents.filter(a => a.active && a.canSell === false).map(a => a.name.split(' ')[0]).join(', ')} not licensed yet — excluded from every split.</span>
        )}
        <div className="bi-split" aria-label="Resulting split">
          {split.map(([n, c]) => {
            const ag = store.agents.find(a => a.name === n);
            const max = split[0][1] || 1;
            return (
              <div key={n} className="bi-split-row">
                <span className="bi-split-nm">{n}{ag ? <i>{ag.open} open now</i> : <i>no agent named in the file</i>}</span>
                <span className="bi-split-bar"><i style={{ width: (c / max * 100) + '%', background: n === 'Unassigned' ? 'var(--inkFaint)' : 'var(--teal)' }}></i></span>
                <b className="bi-split-n">+{c}</b>
              </div>
            );
          })}
          {!split.length && <span className="bi-warnline">Nothing is set to import yet.</span>}
        </div>
      </div>

      <div className="bi-rows" role="table" aria-label="Rows to import">
        <div className="bi-row bi-rowhead" role="row">
          <span role="columnheader">Row</span><span role="columnheader">Lead</span>
          <span role="columnheader">Phone</span><span role="columnheader">Need · source</span>
          <span role="columnheader">Assigned</span><span role="columnheader">Status</span><span role="columnheader">In</span>
        </div>
        {shown.map(r => {
          const st = rowStatus(r);
          const [tone, lab] = STATUS_TONE[st];
          const keep = isKept(r);
          const a = assigned.find(x => x.rid === r.rid);
          return (
            <div key={r.rid} className={'bi-row bi-row-' + st + (keep ? '' : ' is-out')} role="row">
              <span className="bi-rn" role="cell">{r.srcRow}</span>
              <span className="bi-rnm" role="cell" title={r.values.name}>{r.values.name || <em>no name</em>}</span>
              <span className="bi-rph" role="cell">{r.values.phone || <em>—</em>}</span>
              <span className="bi-rneed" role="cell">{r.values.need} · {r.values.source}</span>
              <span className="bi-rag" role="cell">{a ? (a.values.assignedTo || <em>unassigned</em>) : <em>—</em>}</span>
              <span className="bi-rst" role="cell">
                <b style={{ color: tone }}>{lab}</b>
                {r.issues.length > 0 && <span title={r.issues.map(i => i.msg).join(' · ')}>{r.issues.map(i => i.msg).join(' · ')}</span>}
              </span>
              <span className="bi-rkeep" role="cell">
                {st === 'error'
                  ? <span className="bi-rlock" title="A row with no name or no usable number cannot be called">—</span>
                  : r.dupe
                    ? <button className={'bi-tog' + (takeDupe[r.rid] ? ' is-on' : '')} aria-pressed={!!takeDupe[r.rid]}
                        onClick={() => setTakeDupe(t => ({ ...t, [r.rid]: !t[r.rid] }))}
                        title="Import this one anyway">{takeDupe[r.rid] ? 'Taking' : 'Skipping'}</button>
                    : <button className={'bi-tog' + (keep ? ' is-on' : '')} aria-pressed={keep}
                        onClick={() => setSkipped(s => ({ ...s, [r.rid]: !s[r.rid] }))}
                        title={keep ? 'Leave this row out' : 'Put this row back in'}>{keep ? 'In' : 'Out'}</button>}
              </span>
            </div>
          );
        })}
      </div>

      <div className="bi-foot">
        <button className="pb pb-sec" onClick={onBack}>Back to columns</button>
        <button className="pb pb-pri" onClick={commit} disabled={!keptRows.length || committing}>
          {committing ? 'Importing…' : <><RIcon name="plus" size={15} /> Import {keptRows.length} lead{keptRows.length === 1 ? '' : 's'}</>}
        </button>
        {tally.dupe > 0 && <span className="bi-warnline">{tally.dupe} number{tally.dupe > 1 ? 's are' : ' is'} already in the book — skipped unless you take {tally.dupe > 1 ? 'them' : 'it'}.</span>}
        {!store.online && <span className="bi-warnline">Offline — the import will queue and send when the link returns.</span>}
      </div>
    </div>
  );
}

Object.assign(window, { ReviewStep });

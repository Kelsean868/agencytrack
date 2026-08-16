// Bulk lead import — screen shell, file step and column-mapping step.
// Review, distribution and commit live in at-import-review.jsx.
const { Icon: BIIcon } = window.AgencyTrackDesignSystem_ad1cd7;

// `name` wins over children in the DS Icon, and neither `upload` nor `alert` is in
// its set — so both must be passed as children with NO name attribute or they
// silently render the grid fallback.
const BIUpload = (p) => <BIIcon {...p}><path d="M12 16V4M12 4l-4 4M12 4l4 4" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></BIIcon>;
const BIAlert = (p) => <BIIcon {...p}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16" x2="12" y2="16.01" /></BIIcon>;

// A realistic messy export: agency-style headers, TT numbers in four formats, two
// numbers already in the book, one repeated inside the file, blanks and off-list
// values. It exists so the flow can be exercised without hunting for a real file.
const SAMPLE_ROWS = [
  ['Anisa', 'Rampersad', '868-620-1188', 'anisa.r@gmail.com', 'san fernando', 'Whole Life', 'Seminar', 'Marabella town hall'],
  ['Devon', 'Charles', '(868) 771 4402', 'dcharles@outlook.com', 'Chaguanas', 'Term Life', 'Referral', 'Anand Persad'],
  ['Sherry-Ann', 'Baptiste', '6203991', '', 'Point Fortin', 'Annuity', 'Existing Clients', ''],
  ['Rakesh', 'Sookdeo', '18683358814', 'rakesh@example.com', 'couva', 'IUL', 'Trade Shows', 'Southex 2026'],
  ['Michelle', 'Alleyne', '868 299 7712', 'michelle.a@gmail.com', 'Marabella', 'Final Expense', 'Purchased Lead', 'Batch 41'],
  ['Kwesi', 'Thomas', '(868) 620-4471', 'kwesi@example.com', 'San Fernando', 'Term Life', 'Referral', 'Walk-in'],
  ['Priya', 'Maharaj', '868-482-3316', 'priya.m@example.com', 'Debe', 'Critical Illness', 'Facebook Ads', 'July campaign'],
  ['Andre', 'Gonzales', '7714402', 'andre.g@example.com', 'Chaguanas', 'Whole Life', 'Seminar', 'Chaguanas library'],
  ['Nisha', '', '868 660 1102', 'nisha@example.com', 'Princes Town', 'Term Life', 'Organic / Web', ''],
  ['', 'Baksh', '868 620 9087', '', 'Siparia', 'Annuity', 'Referral', 'Nalini Baksh'],
  ['Trevor', 'Small', 'N/A', 'trevor.small@example.com', 'La Romaine', 'Whole Life', 'Orphans', 'Lapsed 2019'],
  ['Camille', 'Pierre', '868-653-2214', 'camille.p@example', 'Gasparillo', 'Medicare', 'Marketing Campaign', 'Radio spot'],
  ['Dillon', 'Ramkissoon', '868 225 8890', 'dillon@example.com', 'Penal', 'IUL', 'Referral', 'Devon Charles'],
  ['Shanice', 'Williams', '(868) 771-2093', 'shanice.w@example.com', 'Chaguanas', 'Term Life', 'Seminar', 'Mid Centre'],
  ['Yusuf', 'Ali', '868-334-7761', 'yusuf.ali@example.com', 'San Fernando', 'Whole Life', 'Existing Clients', 'Policy 44192'],
  ['Renee', 'Boodram', '868 490 3327', 'renee.b@example.com', 'Fyzabad', 'Final Expense', 'Purchased Lead', 'Batch 41'],
  ['Jaden', 'Lewis', '868-778-5540', '', 'Marabella', 'Annuity', 'Trade Shows', 'Southex 2026'],
  ['Farah', 'Khan', '868 620 7719', 'farah.k@example.com', 'Debe', 'Term Life', 'Referral', 'Priya Maharaj'],
  ['Wendell', 'Cummings', '868-291-4408', 'wendell@example.com', 'Point Fortin', 'Whole Life', 'Organic / Web', ''],
  ['Alicia', 'Sampson', '868 355 1194', 'alicia.s@example.com', 'Couva', 'IUL', 'Seminar', 'Couva Rotary'],
  ['Marlon', 'Joseph', '868-661-9982', 'marlon.j@example.com', 'Princes Town', 'Medicare', 'Orphans', 'Lapsed 2021'],
  ['Simone', 'Guerra', '868 227 6653', 'simone.g@example.com', 'San Fernando', 'Term Life', 'Purchased Lead', 'Batch 42'],
  ['Roger', 'Bissessar', '868-778-3021', 'roger.b@example.com', 'Chaguanas', 'Annuity', 'Existing Clients', 'Policy 51007'],
  ['Tricia', 'Modeste', '868 620 5518', 'tricia.m@example.com', 'La Romaine', 'Final Expense', 'Referral', 'Camille Pierre'],
  ['Hakeem', 'Mohan', '868-499-2276', 'hakeem@example.com', 'Penal', 'Whole Life', 'Marketing Campaign', 'Radio spot'],
  ['Latoya', 'Frederick', '868 331 8804', 'latoya.f@example.com', 'Gasparillo', 'Term Life', 'Organic / Web', ''],
  ['Krishna', 'Persad', '868-620-3390', 'krishna.p@example.com', 'Siparia', 'IUL', 'Seminar', 'Siparia RC hall'],
  ['Denise', 'Applewhite', '868 772 4419', 'denise.a@example.com', 'Marabella', 'Annuity', 'Referral', 'Yusuf Ali'],
  ['Omar', 'Haynes', '868-556-7712', '', 'Fyzabad', 'Term Life', 'Purchased Lead', 'Batch 42'],
  ['Vanessa', 'Chow', '868 620 8830', 'vanessa.c@example.com', 'San Fernando', 'Whole Life', 'Trade Shows', 'Southex 2026'],
];
const SAMPLE_HEADERS = ['First Name', 'Surname', 'Cell #', 'E-Mail', 'Town', 'Product Interest', 'Lead Source', 'Referred By'];
const SAMPLE_CSV = () => [
  ['SOUTH UNIT — LEAD LIST EXPORT', '', '', '', '', '', '', ''],
  ['Generated 01/07/2026', '', '', '', '', '', '', ''],
  SAMPLE_HEADERS, ...SAMPLE_ROWS,
].map(r => r.map(c => /[",]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(',')).join('\n');

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type: type || 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const STEPS = [['source', 'File'], ['map', 'Columns'], ['review', 'Review & assign']];

function Stepper({ step }) {
  const at = STEPS.findIndex(s => s[0] === step);
  return (
    <ol className="bi-steps">
      {STEPS.map((s, i) => (
        <li key={s[0]} className={'bi-step' + (i === at ? ' is-on' : i < at ? ' is-done' : '')} aria-current={i === at ? 'step' : undefined}>
          <span className="bi-step-n">{i < at ? <BIIcon name="check" size={11} /> : i + 1}</span>{s[1]}
        </li>
      ))}
    </ol>
  );
}

function SourceStep({ onGrid, error, setError, busy, setBusy }) {
  const [over, setOver] = React.useState(false);
  const inputRef = React.useRef(null);

  const take = (file) => {
    if (!file) return;
    setError(null); setBusy(true);
    readImportFile(file)
      .then(res => { setBusy(false); onGrid(res, file.name); })
      .catch(err => { setBusy(false); setError(err.message); });
  };

  const loadSample = () => {
    const { grid, delimiter } = parseDelimited(SAMPLE_CSV());
    onGrid({ kind: 'csv', sheets: ['Sheet'], grids: { Sheet: grid }, delimiter }, 'south-unit-export.csv');
  };

  return (
    <div className="bi-pane">
      <div className={'bi-drop' + (over ? ' is-over' : '')}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files && e.dataTransfer.files[0]); }}>
        <span className="bi-drop-ic"><BIUpload size={26} /></span>
        <b>{busy ? 'Reading the file…' : 'Drop a spreadsheet here'}</b>
        <span>Excel (.xlsx / .xls) or CSV · up to a few thousand rows</span>
        <div className="bi-drop-acts">
          <button className="pb pb-pri" onClick={() => inputRef.current && inputRef.current.click()} disabled={busy}>Choose a file</button>
          <button className="pb pb-ghost" onClick={loadSample} disabled={busy}>Use a sample list</button>
        </div>
        <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls" hidden
          onChange={(e) => { take(e.target.files && e.target.files[0]); e.target.value = ''; }} />
      </div>
      {error && <div className="bi-err" role="alert"><BIAlert size={15} />{error}</div>}
      <div className="bi-note">
        <b>Column names don't have to match.</b>
        <span>Headers get read and matched on the next step — "Cell #", "Mobile" and "Contact Number" all land on Phone. Anything unmatched you set yourself, and anything you leave unset is ignored.</span>
        <div className="bi-note-acts">
          <button className="pb pb-sec" onClick={() => download('agencytrack-lead-template.csv', IMPORT_TEMPLATE)}>Download the template</button>
          <span className="bi-hintline">Excel is read on demand — CSV needs nothing.</span>
        </div>
      </div>
    </div>
  );
}

function MapStep({ file, res, sheet, setSheet, headerRow, setHeaderRow, map, setMap, rows, onBack, onNext }) {
  const grid = res.grids[sheet] || [];
  const headers = grid[headerRow] || [];
  const used = Object.values(map);
  const missing = REQUIRED_ONE_OF.filter(g => !g.some(k => used.includes(k)));
  const samples = (i) => grid.slice(headerRow + 1, headerRow + 4).map(r => String(r[i] == null ? '' : r[i]).trim()).filter(Boolean);

  return (
    <div className="bi-pane">
      <div className="bi-filebar">
        <span className="bi-filename"><BIIcon name="book" size={14} /> {file}</span>
        <span className="bi-fmeta">{grid.length - headerRow - 1} data rows · {headers.length} columns{res.delimiter ? ' · ' + res.delimiter + '-separated' : ''}</span>
        {res.sheets.length > 1 && (
          <label className="bi-inline-fld"><span>Sheet</span>
            <select className="ap-in" value={sheet} onChange={(e) => setSheet(e.target.value)}>
              {res.sheets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
        <label className="bi-inline-fld"><span>Header row</span>
          <select className="ap-in" value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))}>
            {grid.slice(0, Math.min(grid.length, 8)).map((r, i) => (
              <option key={i} value={i}>Row {i + 1} — {r.filter(Boolean).slice(0, 3).join(' / ').slice(0, 40) || 'blank'}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="bi-maplist" role="table" aria-label="Column mapping">
        <div className="bi-maprow bi-maphead" role="row"><span role="columnheader">Column in your file</span><span role="columnheader">First few values</span><span role="columnheader">Goes to</span></div>
        {headers.map((h, i) => {
          const s = samples(i);
          return (
            <div key={i} className={'bi-maprow' + (map[i] ? '' : ' is-off')} role="row">
              <span className="bi-mapname" role="cell" title={String(h)}>{String(h).trim() || <em>Column {i + 1}</em>}</span>
              <span className="bi-mapsample" role="cell">{s.length ? s.join(' · ') : <em>empty</em>}</span>
              <span role="cell">
                <select className="ap-in bi-mapsel" value={map[i] || ''} aria-label={'Map column ' + (String(h) || i + 1)}
                  onChange={(e) => setMap(m => {
                    const v = e.target.value, next = { ...m };
                    if (!v) delete next[i]; else { Object.keys(next).forEach(k => { if (next[k] === v) delete next[k]; }); next[i] = v; }
                    return next;
                  })}>
                  <option value="">Ignore this column</option>
                  {IMPORT_FIELDS.map(f => <option key={f.k} value={f.k}>{f.label}</option>)}
                </select>
              </span>
            </div>
          );
        })}
      </div>

      <div className="bi-foot">
        <button className="pb pb-sec" onClick={onBack}>Back</button>
        <button className="pb pb-pri" onClick={onNext} disabled={missing.length > 0}>
          Check {rows.length} row{rows.length === 1 ? '' : 's'}
        </button>
        {missing.length > 0
          ? <span className="bi-warnline">Still need a column for {missing.map(g => g.map(k => IMPORT_FIELDS.find(f => f.k === k).label).join(' or ')).join(' and ')}.</span>
          : <span className="bi-okline">Name and phone are covered — the rest is optional.</span>}
      </div>
    </div>
  );
}

function BulkImportScreen({ store, onGoto }) {
  const { useState, useMemo } = React;
  const [step, setStep] = useState('source');
  const [res, setRes] = useState(null);
  const [file, setFile] = useState('');
  const [sheet, setSheet] = useState('');
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const takeGrid = (r, name) => {
    const first = r.sheets.find(s => (r.grids[s] || []).length) || r.sheets[0];
    const grid = r.grids[first] || [];
    const hr = guessHeaderRow(grid);
    setRes(r); setFile(name); setSheet(first); setHeaderRow(hr);
    setMap(autoMap(grid[hr] || []));
    setStep('map');
  };

  const pickSheet = (s) => {
    const grid = res.grids[s] || [];
    const hr = guessHeaderRow(grid);
    setSheet(s); setHeaderRow(hr); setMap(autoMap(grid[hr] || []));
  };
  const pickHeaderRow = (i) => {
    const grid = res.grids[sheet] || [];
    setHeaderRow(i); setMap(autoMap(grid[i] || []));
  };

  const rows = useMemo(() => {
    if (!res) return [];
    return buildImportRows(res.grids[sheet] || [], headerRow, map, store.leads);
  }, [res, sheet, headerRow, map, store.leads]);

  const restart = () => { setRes(null); setFile(''); setMap({}); setResult(null); setStep('source'); };

  return (
    <div className="scr-wrap">
      <div className="scr-tool">
        <span className="scr-eyebrow">Bulk import · a list becomes worked queues</span>
        <Stepper step={result ? 'review' : step} />
        <span className="pl-stat">{store.leads.filter(l => l.status === 'pending').length} pending in the dialer</span>
        {res && !result && <button className="pl-icbtn" onClick={restart}>Start over</button>}
      </div>

      {step === 'source' && <SourceStep onGrid={takeGrid} error={error} setError={setError} busy={busy} setBusy={setBusy} />}
      {step === 'map' && res && (
        <MapStep file={file} res={res} sheet={sheet} setSheet={pickSheet} headerRow={headerRow} setHeaderRow={pickHeaderRow}
          map={map} setMap={setMap} rows={rows} onBack={restart} onNext={() => setStep('review')} />
      )}
      {step === 'review' && res && (
        <ReviewStep rows={rows} file={file} store={store} onGoto={onGoto} onBack={() => setStep('map')}
          result={result} setResult={setResult} onRestart={restart} />
      )}
    </div>
  );
}

Object.assign(window, { BulkImportScreen, SAMPLE_CSV, download });

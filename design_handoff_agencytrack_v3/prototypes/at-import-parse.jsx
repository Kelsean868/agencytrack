// Bulk lead import — parsing, column detection, normalisation and validation.
// Kept separate from the UI so the rules are readable on their own. Excel is read
// through SheetJS when it loaded; CSV/TSV is parsed here so the flow still works
// offline or if the CDN is blocked.

const IMPORT_FIELDS = [
  { k: 'fullName', label: 'Full name', aliases: ['name', 'full name', 'fullname', 'client', 'client name', 'lead name', 'contact', 'contact name', 'prospect'] },
  { k: 'firstName', label: 'First name', aliases: ['first', 'first name', 'firstname', 'fname', 'given name'] },
  { k: 'lastName', label: 'Last name', aliases: ['last', 'last name', 'lastname', 'lname', 'surname', 'family name'] },
  { k: 'phone', label: 'Phone', aliases: ['phone', 'phone number', 'mobile', 'mobile number', 'cell', 'cell #', 'cellphone', 'telephone', 'tel', 'contact number', 'number'] },
  { k: 'email', label: 'Email', aliases: ['email', 'e-mail', 'email address', 'mail'] },
  { k: 'location', label: 'Area', aliases: ['area', 'location', 'town', 'city', 'district', 'region', 'address', 'branch area'] },
  { k: 'need', label: 'Need', aliases: ['need', 'product', 'product interest', 'interest', 'coverage', 'plan', 'line'] },
  { k: 'source', label: 'Source', aliases: ['source', 'lead source', 'origin', 'channel', 'how did they hear'] },
  { k: 'sourceDetails', label: 'Source detail', aliases: ['source detail', 'source details', 'referred by', 'referrer', 'campaign', 'seminar', 'event', 'detail'] },
  { k: 'queue', label: 'Queue', aliases: ['queue', 'list', 'bucket', 'pool', 'campaign list'] },
  { k: 'assignedTo', label: 'Assign to', aliases: ['agent', 'assigned', 'assigned to', 'advisor', 'owner', 'rep', 'servicing agent'] },
  { k: 'notes', label: 'Note', aliases: ['note', 'notes', 'comment', 'comments', 'remarks'] },
];
const REQUIRED_ONE_OF = [['fullName', 'firstName'], ['phone']];

const norm = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ');

// ── CSV / TSV ───────────────────────────────────────────────────────────────
function sniffDelimiter(line) {
  const counts = [[',', 0], [';', 0], ['\t', 0], ['|', 0]];
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    if (q) continue;
    const hit = counts.find(c => c[0] === ch);
    if (hit) hit[1]++;
  }
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

function parseDelimited(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/)[0] || '';
  const d = sniffDelimiter(firstLine);
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (q) {
      if (c === '"') { if (clean[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === d) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c === '\r') { /* handled by \n */ }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const trimmed = rows.filter(r => r.some(v => String(v).trim() !== ''));
  const width = trimmed.reduce((m, r) => Math.max(m, r.length), 0);
  return { grid: trimmed.map(r => { const c = r.slice(); while (c.length < width) c.push(''); return c; }), delimiter: d === '\t' ? 'tab' : d };
}

// ── file → grid ─────────────────────────────────────────────────────────────
// SheetJS loads on demand, only when an actual .xlsx lands. Loading it up front
// blocks first paint on a CDN round trip the CSV path never needs, and a blocked
// CDN would hang the whole page rather than one file type.
let xlsxPromise = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxPromise) return xlsxPromise;
  xlsxPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    const bail = setTimeout(() => reject(new Error('timeout')), 8000);
    s.onload = () => { clearTimeout(bail); window.XLSX ? resolve(window.XLSX) : reject(new Error('missing')); };
    s.onerror = () => { clearTimeout(bail); reject(new Error('blocked')); };
    document.head.appendChild(s);
  }).catch(err => { xlsxPromise = null; throw err; });
  return xlsxPromise;
}

function readImportFile(file) {
  const name = (file.name || '').toLowerCase();
  const isSheet = /\.(xlsx|xlsm|xls)$/.test(name);
  const ready = isSheet ? loadXLSX().catch(() => null) : Promise.resolve(null);
  return ready.then(() => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('That file could not be read.'));
    fr.onload = () => {
      try {
        if (isSheet) {
          if (!window.XLSX) return reject(new Error('Excel support did not load. Save the sheet as CSV and drop that instead — every column maps the same way.'));
          const wb = window.XLSX.read(fr.result, { type: 'array' });
          const sheets = wb.SheetNames;
          const grids = {};
          sheets.forEach(sn => {
            const g = window.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false, defval: '', raw: false });
            grids[sn] = g.filter(r => r.some(v => String(v).trim() !== ''));
          });
          resolve({ kind: 'sheet', sheets, grids, delimiter: null });
        } else {
          const { grid, delimiter } = parseDelimited(fr.result);
          resolve({ kind: 'csv', sheets: ['Sheet'], grids: { Sheet: grid }, delimiter });
        }
      } catch (err) { reject(new Error('That file could not be parsed: ' + err.message)); }
    };
    if (isSheet) fr.readAsArrayBuffer(file); else fr.readAsText(file);
  }));
}

// ── header detection ────────────────────────────────────────────────────────
// The header is the first row where most cells are short, non-numeric labels —
// this survives the export preambles real agency spreadsheets carry.
function guessHeaderRow(grid) {
  for (let i = 0; i < Math.min(grid.length, 8); i++) {
    const r = grid[i].map(v => String(v).trim()).filter(Boolean);
    if (r.length < 2) continue;
    const labelish = r.filter(v => v.length <= 34 && !/^-?[\d.,$%]+$/.test(v)).length;
    if (labelish / r.length >= 0.7) return i;
  }
  return 0;
}

function autoMap(headers) {
  const map = {};
  const taken = new Set();
  headers.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    let hit = IMPORT_FIELDS.find(f => !taken.has(f.k) && f.aliases.includes(n));
    if (!hit) hit = IMPORT_FIELDS.find(f => !taken.has(f.k) && f.aliases.some(a => n === a + 's' || n.includes(a)));
    if (hit) { map[i] = hit.k; taken.add(hit.k); }
  });
  return map;
}

// ── value normalisation ─────────────────────────────────────────────────────
function normalizePhone(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return { value: '', ok: false, why: 'no phone number' };
  let d = s.replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  if (d.length === 7) d = '868' + d;                       // local TT number
  if (d.length !== 10) return { value: s, ok: false, why: 'phone is not a usable number' };
  const out = '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  return { value: out, ok: true, key: d };
}

const titleCase = (s) => String(s).trim().replace(/\s+/g, ' ').replace(/\b([a-z])(\w*)/gi, (m, a, b) => a.toUpperCase() + b.toLowerCase());

function closest(value, options) {
  const n = norm(value);
  if (!n) return null;
  let exact = options.find(o => norm(o) === n);
  if (exact) return exact;
  return options.find(o => norm(o).includes(n) || n.includes(norm(o))) || null;
}

// ── grid + map → validated rows ─────────────────────────────────────────────
function buildImportRows(grid, headerRow, map, existingLeads) {
  const bookKeys = new Map();
  existingLeads.forEach(l => { const p = normalizePhone(l.phone); if (p.ok) bookKeys.set(p.key, l.name); });
  const seen = new Map();
  const out = [];

  for (let r = headerRow + 1; r < grid.length; r++) {
    const raw = grid[r];
    const get = (fk) => { const idx = Object.keys(map).find(i => map[i] === fk); return idx == null ? '' : String(raw[idx] == null ? '' : raw[idx]).trim(); };
    if (!raw.some(v => String(v).trim() !== '')) continue;

    const issues = [];
    let first = get('firstName'), last = get('lastName');
    const full = get('fullName');
    if (!first && full) { const parts = full.split(/\s+/); first = parts.shift(); last = parts.join(' '); }
    if (!last && full && !get('firstName')) last = last || '';
    const name = titleCase([first, last].filter(Boolean).join(' '));
    if (!name) issues.push({ level: 'error', field: 'name', msg: 'no name' });

    const ph = normalizePhone(get('phone'));
    if (!ph.ok) issues.push({ level: 'error', field: 'phone', msg: ph.why });

    const email = get('email');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) issues.push({ level: 'warn', field: 'email', msg: 'email looks wrong — kept as typed' });

    let need = get('need'), needRaw = need;
    need = need ? closest(need, NEED_OPTIONS) : 'Undetermined';
    if (!need) { need = 'Undetermined'; issues.push({ level: 'warn', field: 'need', msg: '"' + needRaw + '" is not a need we track — set to Undetermined' }); }

    let source = get('source'), srcRaw = source;
    source = source ? closest(source, SOURCE_OPTIONS) : 'Purchased Lead';
    if (!source) { source = 'Purchased Lead'; issues.push({ level: 'warn', field: 'source', msg: '"' + srcRaw + '" is not a source we track — set to Purchased Lead' }); }

    let dupe = null;
    if (ph.ok) {
      if (bookKeys.has(ph.key)) { dupe = 'book'; issues.push({ level: 'dupe', field: 'phone', msg: 'already in the book as ' + bookKeys.get(ph.key) }); }
      else if (seen.has(ph.key)) { dupe = 'file'; issues.push({ level: 'dupe', field: 'phone', msg: 'repeated on row ' + (seen.get(ph.key) + 1) + ' of this file' }); }
      else seen.set(ph.key, r);
    }

    out.push({
      rid: 'r' + r, srcRow: r + 1, skip: false, dupe,
      values: {
        firstName: titleCase(first), lastName: titleCase(last), name,
        phone: ph.value, email, location: titleCase(get('location')) || '',
        need, source, sourceDetails: get('sourceDetails'), queue: get('queue'),
        assignedTo: get('assignedTo'), notes: get('notes'),
      },
      issues,
    });
  }
  return out;
}

const rowStatus = (row) => row.issues.some(i => i.level === 'error') ? 'error'
  : row.dupe ? 'dupe' : row.issues.length ? 'warn' : 'ready';

// ── distribution ────────────────────────────────────────────────────────────
// Distribution reads the LICENCE, not just the active flag. A contracted-but-unlicensed
// agent has a real user account and shows on the roster, and would otherwise be a
// perfectly ordinary distribution target — so the gate lives here, where work is
// actually handed out, rather than being a label on a row somewhere.
function distribute(rows, mode, agents, single) {
  if (mode === 'column') return rows;
  const pool = agents.filter(a => a.active && a.canSell !== false);
  if (!pool.length) return rows;
  if (mode === 'single') return rows.map(r => ({ ...r, values: { ...r.values, assignedTo: single } }));
  if (mode === 'round') {
    let i = 0;
    return rows.map(r => { const a = pool[i++ % pool.length]; return { ...r, values: { ...r.values, assignedTo: a.name } }; });
  }
  // balance: fill the lightest open load first, recomputing as we go
  const load = pool.map(a => ({ name: a.name, n: a.open }));
  return rows.map(r => {
    load.sort((a, b) => a.n - b.n);
    load[0].n += 1;
    return { ...r, values: { ...r.values, assignedTo: load[0].name } };
  });
}

const IMPORT_TEMPLATE = 'First Name,Last Name,Phone,Email,Area,Need,Source,Source Detail,Queue,Assign To,Note\nAnisa,Rampersad,(868) 620-1188,anisa@example.com,San Fernando,Whole Life,Seminar,Marabella town hall,Hot Leads,Marsha Singh,Wants cover before year end\n';

Object.assign(window, { IMPORT_FIELDS, REQUIRED_ONE_OF, IMPORT_TEMPLATE, readImportFile, loadXLSX, parseDelimited, guessHeaderRow, autoMap, buildImportRows, rowStatus, normalizePhone, distribute });

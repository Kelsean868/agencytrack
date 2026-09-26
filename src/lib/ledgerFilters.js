/**
 * ledgerFilters.js — L2, Policy Ledger filter/sort/export (docs/briefs/ledger-lens-build.md § L2).
 *
 * Pure functions only (no JSX, no SDK, no Firestore reads) so the filter sheet
 * (mobile), the filter rail (desktop), the active-filter chips row, the view
 * chips row and the desktop table's column counts can never disagree — every
 * one of them is built from the SAME `FILTER_SECTIONS` list and the SAME
 * `matchesFilters` predicate.
 *
 * Operates on `deriveAwardLens` ROWS — `{ policy, group, credit, reason, hoFlag }`
 * — never on raw policies, so "counts toward the SELECTED award" is always the
 * engine's own classification (L1's `awardLensForPolicy` / `deriveAwardLens`),
 * never re-derived here.
 *
 * ── Standing decision (brief § L2 point 2, "Standing decisions") — hide rather
 * than guess ──────────────────────────────────────────────────────────────────
 * Three brief-listed controls have NO backing signal anywhere in the current
 * data model, verified by grep before this file was written (Rule 17):
 *   - "Needs attention" (awaiting my confirmation / differs from head office /
 *     lapse risk) — no `needsAgentConfirmation`, no dual-source value compare,
 *     no risk score exists on a policy doc.
 *   - "Paid-to date" (Date-type filter) and "Next premium due" (sort) — no
 *     `paidToDate` / `nextPremiumDue` field exists on a policy doc; a policy's
 *     premium schedule beyond `proposedFrequency` is not tracked.
 * Per the brief's own rule ("Hide a built-in view whose data the app cannot
 * derive... rather than guess"), the same discipline is applied to filter/sort
 * OPTIONS: none of the six are exposed below. Bank in
 * docs/FOLLOW_UPS.md — this is provisional (Rule 23): it is overturned the day
 * any of the three underlying fields is added to the policy doc shape.
 */

import { toDateStr } from './policyCampaignLens';
import { policyValue } from './policyLedgerDerivation';
import { POLICY_STATUSES, POLICY_STATUS_LABELS } from '../constants/policyLifecycle';
import { STATUS_SOURCE_IMPORT } from './portfolioImport/oipaImportConfig';

// ─── Small display helpers ────────────────────────────────────────────────

/** Mirrors PolicyLedgerPanel's local FREQ_LABELS (proposedFrequency A/S/Q/M). */
export const FREQ_LABELS = { A: 'Annual', S: 'Semi-Annual', Q: 'Quarterly', M: 'Monthly' };

/** `whole_life` -> `Whole Life`. Used for the Product filter so a new
 * policyClass value needs no edit here — the label is derived, not enumerated. */
export function humanizeToken(value) {
  if (!value) return 'Unspecified';
  return String(value)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** YYYY-MM-DD -> DD-MM-YYYY for display. Returns '' for anything unparseable. */
export function toDisplayDate(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** DD-MM-YYYY -> YYYY-MM-DD for storage/comparison. Returns null when invalid. */
export function toStoredDate(display) {
  if (!display || typeof display !== 'string') return null;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(display.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo}-${d}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return iso;
}

// ─── Row field accessors ──────────────────────────────────────────────────

function rowIssueDate(row) { return toDateStr(row.policy?.dateIssued); }
function rowSubmitDate(row) { return toDateStr(row.policy?.dateSubmitted) ?? toDateStr(row.policy?.dateWritten); }
function rowApi(row) { return policyValue(row.policy); }
function rowOwnerName(row) { return String(row.policy?.ownerName ?? ''); }

/** Source tags — a row can carry more than one (self-confirmed AND not-on-HO). */
function sourceTags(row) {
  const tags = [row.policy?.statusSource === STATUS_SOURCE_IMPORT ? 'ho' : 'self'];
  if (row.hoFlag) tags.push('notOnHo');
  return tags;
}

function whoTag(row) { return row.policy?.isSelfOrFamily ? 'family' : 'clients'; }

// ─── Filter sections (single source for sheet, rail, chips, counts) ──────

const STATIC_SECTIONS = [
  {
    key: 'countsGroup',
    label: 'Counts toward',
    options: [
      { value: 'counting', label: 'Counting' },
      { value: 'pending', label: 'Submitted, not settled' },
      { value: 'not', label: 'Not counting' },
    ],
    tags: (row) => [row.group],
  },
  {
    key: 'status',
    label: 'Status',
    options: POLICY_STATUSES.map((s) => ({ value: s, label: POLICY_STATUS_LABELS[s] ?? s })),
    tags: (row) => [row.policy?.status].filter(Boolean),
  },
  {
    key: 'source',
    label: 'Source',
    options: [
      { value: 'ho', label: 'Head office' },
      { value: 'self', label: 'Self-confirmed' },
      { value: 'notOnHo', label: 'Not on head-office list' },
    ],
    tags: sourceTags,
  },
  {
    key: 'who',
    label: 'Who',
    options: [
      { value: 'clients', label: 'Clients' },
      { value: 'family', label: 'Family / self' },
    ],
    tags: (row) => [whoTag(row)],
  },
];

/**
 * buildFilterSections(rows) — STATIC_SECTIONS plus Product / Premium frequency,
 * whose options are the DISTINCT values actually present in `rows` (never a
 * hardcoded enum — see file header on the existing 3-way `policyClass`
 * duplication this deliberately does not add a 4th copy of).
 */
export function buildFilterSections(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const products = [...new Set(list.map((r) => r.policy?.policyClass).filter(Boolean))].sort();
  const freqs = [...new Set(list.map((r) => r.policy?.proposedFrequency).filter(Boolean))].sort();
  return [
    ...STATIC_SECTIONS,
    {
      key: 'product',
      label: 'Product',
      options: products.map((v) => ({ value: v, label: humanizeToken(v) })),
      tags: (row) => [row.policy?.policyClass].filter(Boolean),
    },
    {
      key: 'frequency',
      label: 'Premium frequency',
      options: freqs.map((v) => ({ value: v, label: FREQ_LABELS[v] ?? v })),
      tags: (row) => [row.policy?.proposedFrequency].filter(Boolean),
    },
  ];
}

/** The section keys that hold plain multi-select tag filters (everything
 * except date range and API min/max, which are handled separately below). */
export const TAG_SECTION_KEYS = ['countsGroup', 'status', 'source', 'who', 'product', 'frequency'];

/** A fresh, empty filter state. */
export function emptyFilterState() {
  return {
    countsGroup: new Set(),
    status: new Set(),
    source: new Set(),
    who: new Set(),
    product: new Set(),
    frequency: new Set(),
    dateType: 'issue', // 'issue' | 'submit'
    dateFrom: null, // YYYY-MM-DD | null
    dateTo: null,
    apiMin: null, // number | null
    apiMax: null,
  };
}

export function hasActiveFilters(state) {
  if (!state) return false;
  if (TAG_SECTION_KEYS.some((k) => (state[k]?.size ?? 0) > 0)) return true;
  return Boolean(state.dateFrom || state.dateTo || state.apiMin != null || state.apiMax != null);
}

/** matchesFilters(row, state, sections) — true iff `row` passes every active
 * section (empty section = "any"). `sections` is `buildFilterSections(rows)`
 * for the currently visible row set, so Product/Frequency options and
 * matching stay in lock-step. */
export function matchesFilters(row, state, sections) {
  for (const key of TAG_SECTION_KEYS) {
    const active = state[key];
    if (!active || active.size === 0) continue;
    const section = sections.find((s) => s.key === key);
    const tags = section ? section.tags(row) : [];
    if (!tags.some((t) => active.has(t))) return false;
  }

  const dateField = state.dateType === 'submit' ? rowSubmitDate(row) : rowIssueDate(row);
  if (state.dateFrom && (!dateField || dateField < state.dateFrom)) return false;
  if (state.dateTo && (!dateField || dateField > state.dateTo)) return false;

  const api = rowApi(row);
  if (state.apiMin != null && api < state.apiMin) return false;
  if (state.apiMax != null && api > state.apiMax) return false;

  return true;
}

export function filterRows(rows, state, sections) {
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((row) => matchesFilters(row, state, sections));
}

/** Per-option counts for the filter rail/sheet, computed against the row set
 * BEFORE this section's own filter is applied (so unchecking still shows what
 * would come back), but AFTER every other active section. */
export function optionCounts(rows, state, sections, sectionKey) {
  const otherState = { ...state, [sectionKey]: new Set() };
  const base = filterRows(rows, otherState, sections);
  const section = sections.find((s) => s.key === sectionKey);
  const counts = {};
  for (const opt of section?.options ?? []) counts[opt.value] = 0;
  for (const row of base) {
    for (const tag of section?.tags(row) ?? []) {
      if (tag in counts) counts[tag] += 1;
    }
  }
  return counts;
}

// ─── Sorts ─────────────────────────────────────────────────────────────────

// Missing dates always sort LAST regardless of direction — a policy with no
// issue date is not "oldest", it is unknown, and unknown must never look like
// the extreme of a real ordering.
function compareDatesDesc(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? 1 : a > b ? -1 : 0;
}

export const SORTS = [
  { key: 'issuedDesc', label: 'Newest issued first', compare: (a, b) => compareDatesDesc(rowIssueDate(a), rowIssueDate(b)) },
  { key: 'submittedDesc', label: 'Newest submitted first', compare: (a, b) => compareDatesDesc(rowSubmitDate(a), rowSubmitDate(b)) },
  { key: 'apiDesc', label: 'API — highest first', compare: (a, b) => rowApi(b) - rowApi(a) },
  { key: 'apiAsc', label: 'API — lowest first', compare: (a, b) => rowApi(a) - rowApi(b) },
  { key: 'nameAsc', label: 'Client name A–Z', compare: (a, b) => rowOwnerName(a).localeCompare(rowOwnerName(b)) },
];

export const DEFAULT_SORT_KEY = 'issuedDesc';

export function sortRows(rows, sortKey = DEFAULT_SORT_KEY) {
  const list = Array.isArray(rows) ? [...rows] : [];
  const sort = SORTS.find((s) => s.key === sortKey) ?? SORTS[0];
  return list.sort(sort.compare);
}

// ─── Built-in saved views ──────────────────────────────────────────────────

/**
 * BUILT_IN_VIEWS — brief-listed views. "Needs confirming" and "Lapse risk" are
 * DELIBERATELY ABSENT (see file header) rather than shown with a guessed or
 * always-zero count. "★ campaign" only appears when a campaign award exists.
 */
export function builtInViews({ hasCampaign = false, campaignLabel = null } = {}) {
  const views = [{ id: '__all__', label: 'All policies', builtin: true, filters: emptyFilterState() }];
  if (hasCampaign) {
    views.push({
      id: '__campaign__',
      label: campaignLabel ? `★ ${campaignLabel}` : '★ Campaign',
      builtin: true,
      filters: { ...emptyFilterState(), countsGroup: new Set(['counting', 'pending']) },
    });
  }
  return views;
}

// ─── Footer counts (desktop table + mobile summary) ────────────────────────

export function footerCounts(filteredRows) {
  const counting = filteredRows.filter((r) => r.group === 'counting');
  const pending = filteredRows.filter((r) => r.group === 'pending');
  const notCounting = filteredRows.filter((r) => r.group === 'not');
  const countingApi = counting.reduce((s, r) => s + (r.credit?.api ?? 0), 0);
  return {
    total: filteredRows.length,
    counting: counting.length,
    pending: pending.length,
    notCounting: notCounting.length,
    countingApi: Math.round(countingApi * 100) / 100,
  };
}

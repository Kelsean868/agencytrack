/**
 * parseOipaExport.js — pure parser for the OIPA/INGENIUM agent-portfolio export.
 *
 * PURE. No Firestore, no clock, no file IO, no `xlsx` dependency. It takes rows that
 * somebody else has already read off the sheet and returns `{ docs, report }`.
 *
 * WHY PURE, AND WHY IT MATTERS HERE:
 * the same parse has to run in three places — the P2 admin script (Node + a
 * spreadsheet reader), the P4 browser upload screen (File API), and the unit tests
 * (synthetic literals). A parser that reads the workbook itself can only be tested
 * against a workbook, and the only workbook that exercises the real rules is full of
 * real client names, which may never enter this repo. Handing the parser plain rows
 * is what lets the tests be synthetic and the paste-back numbers be real.
 *
 * THE INPUT CONTRACT:
 * `rows` is an array of objects keyed by the header strings OIPA writes in sheet row
 * 3 — see `OIPA_COLUMNS` for the exact spellings. Values may be strings, numbers,
 * `Date` objects, `null` or absent. Nothing here assumes a value is already clean.
 *
 * WHAT THE REPORT IS FOR:
 * the report is not logging. It is the artefact Kyron reads before authorising a
 * write, and it is the P0 paste-back. So every row that does NOT become a doc is
 * accounted for somewhere in it by policy number. A row that vanishes without a
 * line in the report is a bug, and `report.rowsAccountedFor` asserts exactly that.
 */

import {
  OIPA_COLUMNS,
  OIPA_SHADOW_SUB_STATUS,
  OIPA_AFR_PREFIX,
  OIPA_STATUS_FIRST,
  OIPA_SUB_STATUS_MAP,
  OIPA_STATUS_FALLBACK,
  OIPA_PLAN_PREFIXES,
  OIPA_PLAN_PREFIX_LENGTH,
  OIPA_PAYMENT_MODE_TO_FREQUENCY,
  OIPA_FIXED_DOC_FIELDS,
  OIPA_HEADER_ROW_INDEX,
  OIPA_EMPTY_IMPORT_CONFIG,
  normaliseImportConfig,
} from './oipaImportConfig.js';

/* ─────────────────────────── value normalisers ─────────────────────────── */

/** Trimmed string, or null for anything empty. Never returns the string "null". */
function str(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/**
 * Number, or null. Strips currency symbols, thousands separators and stray spaces,
 * because an export re-saved through Excel can hand back "1,200.00" as text.
 *
 * Returns null — never 0 — for a missing value. The distinction is load-bearing for
 * persistency: brief rule 5 keeps a lapse in the numerator when `totalPremiumPaid`
 * is MISSING, and would drop it if a missing value arrived as 0 and then compared
 * against `2 × API`. Coercing absent money to zero is how that rule silently inverts.
 */
function money(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * A `YYYY-MM-DD` date-only string, or null.
 *
 * WHY LOCAL DATE PARTS AND NOT `toISOString()`:
 * a spreadsheet reader builds a date cell as LOCAL midnight. In Trinidad (UTC−4,
 * no DST) local midnight is 04:00Z, so the UTC calendar day happens to agree and
 * `toISOString().slice(0, 10)` looks correct. Run the same import from a machine
 * east of UTC and local midnight falls on the PREVIOUS UTC day — every issue date
 * shifts back one day, and a policy issued on the 1st silently leaves the 24-month
 * persistency window. Reading local parts matches how the value was constructed and
 * is therefore correct in every timezone.
 *
 * The repo stores date-only values as `YYYY-MM-DD` strings and parses them at
 * TT-local midnight via `parseDateOnlyTT`, so this returns the string form and
 * leaves Timestamp conversion to the write layer (P2).
 */
function dateOnly(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  if (s === '') return null;
  // Already a date-only string, or an ISO timestamp whose date part we take as-is.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Reads one OIPA column off a row by its header spelling. */
function cell(row, key) {
  return row?.[OIPA_COLUMNS[key]];
}

/* ─────────────────────────── export-date helper ─────────────────────────── */

/**
 * Pulls the export date out of the sheet's title cell, e.g.
 * "OIPA Agent Portfolio (Kyron Marchan) @ 15.09.26" -> "2026-09-15".
 *
 * The title is `DD.MM.YY`. A two-digit year is expanded into the 2000s, which is
 * safe for a system that did not exist before 2000 and will be someone else's
 * problem in 2100. Returns null rather than guessing when the title does not match,
 * so the caller must supply `exportDate` explicitly instead of importing rows
 * stamped with a date nobody verified.
 */
export function parseExportDateFromTitle(title) {
  const s = str(title);
  if (!s) return null;
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{2})(?!\d)/);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `20${yy}-${mm}-${dd}`;
}

/**
 * Turns a sheet read as an array-of-arrays into the row objects this parser wants.
 * Lives here so the P2 script and the P4 upload screen share one definition of
 * "where the headers are" instead of each re-deriving it.
 *
 * Blank rows are dropped: the 15 Sep export carries two trailing blank rows, and a
 * blank row object would otherwise reach the parser as a row with no policy number.
 */
export function rowsFromSheetMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length <= OIPA_HEADER_ROW_INDEX) return [];
  const headerRow = matrix[OIPA_HEADER_ROW_INDEX] ?? [];
  const headers = headerRow.map((h, i) => (h == null || String(h).trim() === '' ? `__col${i}` : String(h).trim()));
  const isBlank = (r) => !Array.isArray(r) || r.every((c) => c == null || String(c).trim() === '');
  return matrix
    .slice(OIPA_HEADER_ROW_INDEX + 1)
    .filter((r) => !isBlank(r))
    .map((r) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = r[i] === undefined ? null : r[i]; });
      return o;
    });
}

/* ─────────────────────────── status mapping ─────────────────────────── */

/**
 * Maps an OIPA status pair onto an AgencyTrack policy status.
 *
 * Precedence is status-first, then sub status, then status-fallback. The reason the
 * `Declined` check cannot move below the sub-status lookup is written out in
 * `OIPA_STATUS_FIRST` — it is the one place where the less specific column wins, and
 * it is what makes the brief's denied = 3 and settled-plus-terminal = 18 both true.
 *
 * Returns null for a pair no rule covers. The caller reports it and drops the row
 * rather than defaulting: a status guessed wrong here becomes a wrong persistency
 * figure on a screen that gates awards, which is worse than a row that is visibly
 * missing from a report Kyron reads before authorising the write.
 */
export function mapOipaStatus(oipaStatus, oipaSubStatus) {
  const status = str(oipaStatus);
  const sub = str(oipaSubStatus);
  if (status && OIPA_STATUS_FIRST[status]) return { ...OIPA_STATUS_FIRST[status], via: 'status' };
  if (sub && OIPA_SUB_STATUS_MAP[sub]) return { ...OIPA_SUB_STATUS_MAP[sub], via: 'subStatus' };
  if (status && OIPA_STATUS_FALLBACK[status]) return { ...OIPA_STATUS_FALLBACK[status], via: 'statusFallback' };
  return null;
}

/** Resolves a plan code to its product identity. Unknown prefixes are pending, not errors. */
export function resolvePlan(planCode) {
  const code = str(planCode);
  const prefix = code ? code.slice(0, OIPA_PLAN_PREFIX_LENGTH).toUpperCase() : null;
  const hit = prefix ? OIPA_PLAN_PREFIXES[prefix] : null;
  if (!hit) {
    return {
      prefix,
      planName: null,
      policyClass: null,
      sourceSystem: null,
      planClassPending: true,
      classUnconfirmed: false,
      known: false,
    };
  }
  return {
    prefix,
    planName: hit.planName ?? null,
    policyClass: hit.policyClass ?? null,
    sourceSystem: hit.sourceSystem ?? null,
    planClassPending: Boolean(hit.planClassPending),
    classUnconfirmed: Boolean(hit.classUnconfirmed),
    known: true,
  };
}

/* ─────────────────────────── the parser ─────────────────────────── */

/**
 * @param {Array<Object>} rows      row objects keyed by OIPA header strings
 * @param {Object}        options
 * @param {string}        options.exportDate   `YYYY-MM-DD` — the "as at" date of the export
 * @param {string}        options.agentId      Firestore uid of the SERVICING agent
 * @param {string}        options.agentNumber  that agent's agent number, e.g. "011B94"
 * @param {string}        [options.importedAt] `YYYY-MM-DD` stamp; the caller owns the clock
 * @param {Object}        [options.importConfig] THIS AGENT's per-agent config —
 *        `{ overrides, selfOrFamily, testPolicyNumbers }`. Defaults to EMPTY, never
 *        to Kyron's seed: see the per-agent note in `oipaImportConfig.js`. The
 *        value is agent-writable, so it is normalised, never trusted as given.
 * @returns {{docs: Array<Object>, report: Object}}
 */
export function parseOipaExport(rows, options = {}) {
  const {
    exportDate, agentId, agentNumber, importedAt = null,
    importConfig = OIPA_EMPTY_IMPORT_CONFIG,
  } = options;
  const { overrides, selfOrFamily, testPolicyNumbers } = normaliseImportConfig(importConfig);
  const testNumbers = new Set(testPolicyNumbers);
  if (!str(exportDate)) throw new Error('parseOipaExport: exportDate is required');
  if (!str(agentId)) throw new Error('parseOipaExport: agentId is required');
  if (!str(agentNumber)) throw new Error('parseOipaExport: agentNumber is required');

  const input = Array.isArray(rows) ? rows : [];
  const numberOf = (row) => str(cell(row, 'policyNumber'));

  /* Pass 1 — split the rows before mapping anything.
   *
   * The AFR rule needs to know which numbers exist WITHOUT the prefix, so the whole
   * set has to be seen before any single row can be judged. */
  const nonAfrNumbers = new Set(
    input.map(numberOf).filter((n) => n && !n.startsWith(OIPA_AFR_PREFIX)),
  );

  const shadowPendingIssue = [];
  const shadowAfrTwins = [];
  const afrWithoutTwin = [];
  const testRecords = [];
  const missingPolicyNumber = [];
  const kept = [];

  for (const row of input) {
    const number = numberOf(row);
    if (!number) { missingPolicyNumber.push(row); continue; }

    const isAfr = number.startsWith(OIPA_AFR_PREFIX);
    const stripped = isAfr ? number.slice(OIPA_AFR_PREFIX.length) : number;

    // Brief rule 1, first half. Checked before the AFR rule so a row that is both
    // is counted once, under the reason that describes the whole 49-row set.
    if (str(cell(row, 'oipaSubStatus')) === OIPA_SHADOW_SUB_STATUS) {
      shadowPendingIssue.push(number);
      continue;
    }
    // Brief rule 1, second half: an AFR row is a shadow only when the real number
    // is also present. An AFR row with no twin is NOT dropped — it would be the only
    // record of that policy — but it is reported, because in the 15 Sep export every
    // AFR row is also `Pending Issue` and a survivor here means the shape changed.
    if (isAfr) {
      if (nonAfrNumbers.has(stripped)) { shadowAfrTwins.push(number); continue; }
      afrWithoutTwin.push(number);
    }
    // Brief rule 2.
    if (testNumbers.has(number)) { testRecords.push(number); continue; }

    kept.push({ row, number });
  }

  /* Pass 2 — one doc per policy number (brief rule 3).
   *
   * Duplicates are not expected: dropping the shadows leaves 234 distinct numbers in
   * the 15 Sep export. If a future export does carry one, pick deterministically
   * (latest Status Date, ties resolved by first appearance) and REPORT it, so the
   * choice is visible rather than depending on row order. */
  const byNumber = new Map();
  const duplicates = [];
  kept.forEach(({ row, number }, index) => {
    const existing = byNumber.get(number);
    if (!existing) { byNumber.set(number, { row, index }); return; }
    duplicates.push(number);
    const a = dateOnly(cell(existing.row, 'statusDate')) ?? '';
    const b = dateOnly(cell(row, 'statusDate')) ?? '';
    if (b > a) byNumber.set(number, { row, index });
  });

  /* Pass 3 — build the docs. */
  const docs = [];
  const unmappedStatus = [];
  const unknownPlanPrefixes = new Map();
  const planClassPending = [];
  const classUnconfirmed = [];
  const unknownPaymentModes = new Map();
  const overridesApplied = [];
  const statusCounts = {};
  const terminalReasonCounts = {};

  for (const { row } of byNumber.values()) {
    const policyNumber = numberOf(row);
    const oipaStatus = str(cell(row, 'oipaStatus'));
    const oipaSubStatus = str(cell(row, 'oipaSubStatus'));

    const mapped = mapOipaStatus(oipaStatus, oipaSubStatus);
    if (!mapped) {
      unmappedStatus.push({ policyNumber, oipaStatus, oipaSubStatus });
      continue;
    }

    const plan = resolvePlan(cell(row, 'plan'));
    if (!plan.known && plan.prefix) {
      unknownPlanPrefixes.set(plan.prefix, (unknownPlanPrefixes.get(plan.prefix) ?? 0) + 1);
    }
    if (plan.planClassPending) planClassPending.push(policyNumber);
    if (plan.classUnconfirmed) classUnconfirmed.push(policyNumber);

    const paymentMode = str(cell(row, 'paymentMode'));
    const proposedFrequency = paymentMode ? (OIPA_PAYMENT_MODE_TO_FREQUENCY[paymentMode] ?? null) : null;
    if (paymentMode && !proposedFrequency) {
      unknownPaymentModes.set(paymentMode, (unknownPaymentModes.get(paymentMode) ?? 0) + 1);
    }

    const writingAgentNumber = str(cell(row, 'writingAgentNumber'));

    const doc = {
      policyNumber,
      ownerName:   str(cell(row, 'ownerName')),
      insuredName: str(cell(row, 'insuredName')),

      planId:       str(cell(row, 'plan')),
      planName:     plan.planName,
      policyClass:  plan.policyClass,
      sourceSystem: plan.sourceSystem,

      proposedAPI:       money(cell(row, 'api')),
      proposedPremium:   money(cell(row, 'modalPremium')),
      proposedFrequency,
      proposedCoverage:  money(cell(row, 'sumInsured')),

      // `dateIssued` is the OIPA "Issue Date" and is the ONLY date any count keys
      // off: the Tatil memo reckons the 24-month persistency window from the ISSUE
      // month. `inforceDate` differs on 14 of the 229 rows in the 15 Sep export and
      // is carried for DISPLAY ONLY — no counter, window or aggregate may read it.
      // (Dispatcher ruling, 16 Sep 2026.)
      dateIssued:       dateOnly(cell(row, 'issueDate')),
      inforceDate:      dateOnly(cell(row, 'inforceDate')),
      paidToDate:       dateOnly(cell(row, 'paidToDate')),
      totalPremiumPaid: money(cell(row, 'totalPremiumPaid')),

      writingAgentNumber,
      writingAgentName:     str(cell(row, 'writingAgentName')),
      servicingAgentNumber: str(cell(row, 'servicingAgentNumber')),

      oipaStatus,
      oipaSubStatus,
      oipaStatusDate: dateOnly(cell(row, 'statusDate')),

      exportDate,
      importedAt,

      agentId,
      // Orphans and inherited policies are the ones where this is false, and brief
      // rule 1 of the persistency derivation keeps them out of the denominator.
      isWritingAgent: writingAgentNumber === str(agentNumber),
      isSelfOrFamily: selfOrFamily[policyNumber] === true,

      status: mapped.status,
      ...(mapped.terminalReason ? { terminalReason: mapped.terminalReason } : {}),
      ...(plan.planClassPending ? { planClassPending: true } : {}),
      ...OIPA_FIXED_DOC_FIELDS,
    };

    // Overrides land LAST and win over the export (brief rule 5). `note` is config
    // commentary for a human reading this file and is not written to Firestore.
    const override = overrides[policyNumber];
    if (override) {
      const { note, ...fields } = override;
      // A doc that was terminal for one reason and is overridden to a non-terminal
      // status must not keep the old reason hanging off it.
      if (fields.status && !fields.terminalReason) delete doc.terminalReason;
      Object.assign(doc, fields);
      overridesApplied.push({
        policyNumber,
        from: { oipaStatus, oipaSubStatus, mappedStatus: mapped.status },
        to: { status: doc.status, ...(doc.terminalReason ? { terminalReason: doc.terminalReason } : {}) },
        note,
      });
    }

    statusCounts[doc.status] = (statusCounts[doc.status] ?? 0) + 1;
    if (doc.terminalReason) {
      terminalReasonCounts[doc.terminalReason] = (terminalReasonCounts[doc.terminalReason] ?? 0) + 1;
    }
    docs.push(doc);
  }

  const settledWithTerminal = docs.filter((d) => d.status === 'settled' && d.terminalReason).length;

  const report = {
    exportDate,
    agentId,
    agentNumber: str(agentNumber),

    rows: input.length,
    shadows: shadowPendingIssue.length + shadowAfrTwins.length,
    shadowsPendingIssue: shadowPendingIssue.length,
    shadowsAfrTwins: shadowAfrTwins.length,
    afrWithoutTwin,
    testRecords: testRecords.length,
    testRecordNumbers: testRecords,
    missingPolicyNumber: missingPolicyNumber.length,
    duplicatePolicyNumbers: [...new Set(duplicates)],
    unmappedStatus,
    docs: docs.length,

    statusCounts,
    // `settled` in `statusCounts` is the WHOLE settled bucket. The brief reports the
    // terminal ones separately, so both numbers are given rather than leaving a
    // reader to subtract and get it wrong.
    settledWithTerminal,
    settledWithoutTerminal: (statusCounts.settled ?? 0) - settledWithTerminal,
    terminalReasonCounts,

    planClassPending,
    classUnconfirmed,
    unknownPlanPrefixes: Object.fromEntries(unknownPlanPrefixes),
    unknownPaymentModes: Object.fromEntries(unknownPaymentModes),
    overridesApplied,
    selfOrFamily: docs.filter((d) => d.isSelfOrFamily).map((d) => d.policyNumber),
    // WHICH per-agent config produced this parse. An import whose numbers surprise
    // somebody is read back from the report, and "what overrides were in force" is
    // the first question — so the answer travels WITH the plan rather than being
    // re-derived later from a doc that may since have been edited.
    importConfigApplied: {
      overrides: Object.keys(overrides).sort(),
      selfOrFamily: Object.keys(selfOrFamily).sort(),
      testPolicyNumbers: [...testPolicyNumbers].sort(),
    },
    writingAgentPolicies: docs.filter((d) => d.isWritingAgent).length,
    orphanPolicies: docs.filter((d) => !d.isWritingAgent).length,
  };

  // Every input row is either a doc or accounted for by one named reason. This is an
  // assertion expressed as data: if it is ever false, a row disappeared silently,
  // which is the one failure this report exists to make impossible.
  report.rowsAccountedFor =
    report.docs
    + report.shadows
    + report.testRecords
    + report.missingPolicyNumber
    + report.unmappedStatus.length
    + duplicates.length
    === report.rows;

  return { docs, report };
}

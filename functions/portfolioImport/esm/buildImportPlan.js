/**
 * buildImportPlan.js — decides what the OIPA import would WRITE, without writing.
 *
 * PURE. No Firestore, no clock, no IO. It takes the parser's docs plus whatever
 * already exists in the ledger and returns a create / update / skip plan. The
 * admin script does the IO; this module holds the decisions, so the decisions are
 * unit-testable and the dry run and the live run are provably the same logic.
 *
 * WHY THE DRY RUN AND THE LIVE RUN SHARE THIS MODULE:
 * a dry run that computes its plan differently from the writer is worse than no
 * dry run — it authorises a write that was never actually rehearsed. The script
 * builds the plan once and either prints it or applies it.
 *
 * THE IMPORT OWNS SOME FIELDS AND MUST NOT TOUCH THE REST.
 * On an update, only IMPORT_OWNED_FIELDS are written. Everything else on an
 * existing doc is left exactly as it is, because the ledger accumulates human
 * work the export knows nothing about: a CRO's delivery stamp, a manager's
 * settled confirmation, an agent's notes. A blind overwrite by policy number
 * would silently erase them, and nothing would error.
 */

import { OIPA_IMPORT_SOURCE } from './oipaImportConfig.js';

/**
 * Fields the import owns and may overwrite on a re-import. Everything absent
 * from this list survives an update untouched.
 *
 * `status` IS owned: a policy that lapsed since the last export must move. That
 * is also why the importer writes as an admin action — the agent path forbids
 * setting `lapsed` at all (H2c), and the client create rule accepts only
 * `status == 'written'`, so no client path could ever produce these docs.
 */
export const IMPORT_OWNED_FIELDS = Object.freeze([
  'ownerName', 'insuredName',
  'planId', 'planName', 'policyClass', 'sourceSystem',
  'proposedAPI', 'proposedPremium', 'proposedFrequency', 'proposedCoverage',
  'dateIssued', 'inforceDate', 'paidToDate', 'totalPremiumPaid',
  'writingAgentNumber', 'writingAgentName', 'servicingAgentNumber',
  'oipaStatus', 'oipaSubStatus', 'oipaStatusDate',
  'status', 'terminalReason', 'replacedBy', 'claimStatus', 'planClassPending',
  'isWritingAgent', 'isSelfOrFamily',
  'exportDate', 'importedAt', 'importSource',
]);

/**
 * Fields the import adds so the doc is a valid, READABLE policy — none of which
 * come from the export. Each one is here for a named reason, because a field
 * added "to be safe" is how a schema rots.
 *
 *   tenantId   — `getPoliciesForManager` filters on it; without it the doc is
 *                invisible to every manager query.
 *   createdAt  — every read query in `policiesService` is `orderBy('createdAt')`,
 *                and Firestore EXCLUDES docs missing the ordered field. Omit this
 *                and all 229 docs are silently invisible to the ledger UI. This is
 *                the single most load-bearing field in this list and it is not in
 *                the brief's rule-7 inventory.
 *   productLine — 'life' for every imported doc, CIB included (dispatcher ruling 5c).
 *   dateWritten / dateWrittenUnknown — the export has no written date. Left NULL
 *                with an explicit flag rather than back-filled from `dateIssued`,
 *                which would invent a fact (dispatcher ruling 5d).
 *   importSource — the tag every aggregating reader filters on (ruling 5e).
 */
export const IMPORT_ADDED_FIELDS_NOTE = Object.freeze({
  tenantId: 'required by getPoliciesForManager filters',
  createdAt: 'required by orderBy(createdAt) in every policies read query',
  productLine: "ruling 5c — 'life' for all, CIB included",
  dateWritten: 'ruling 5d — null, never back-filled from dateIssued',
  dateWrittenUnknown: 'ruling 5d — explicit flag',
  importSource: 'ruling 5e — the tag aggregating readers exclude on',
  unitId: 'read rules gate unit_manager on resource.data.unitId',
  branchId: 'getPoliciesForManager branch_manager arm filters on it',
  createdBy: 'audit — who ran the import',
});

/** Values that mean "absent" for comparison purposes. */
const isBlank = (v) => v === null || v === undefined || v === '';

/**
 * Compares one import-owned field. Returns true when the export's value differs
 * from what is stored.
 *
 * Blank-vs-blank counts as EQUAL so a doc does not show as changed merely
 * because `null` and `undefined` are different in JavaScript — that would make
 * every re-import report 229 updates and destroy the signal the dry run exists
 * to give.
 */
function fieldDiffers(next, prev) {
  if (isBlank(next) && isBlank(prev)) return false;
  if (typeof next === 'number' && typeof prev === 'number') {
    // Money is stored to 2dp; compare at that precision rather than on raw floats.
    return Math.abs(next - prev) >= 0.005;
  }
  return next !== prev;
}

/**
 * @param {Array<Object>} parsedDocs  the P0 parser's docs
 * @param {Object} options
 * @param {string} options.tenantId
 * @param {string} options.agentId          servicing agent uid
 * @param {string} options.agentNumber
 * @param {string} options.exportDate       `YYYY-MM-DD`
 * @param {string} options.importedAt       `YYYY-MM-DD` — caller owns the clock
 * @param {string} [options.unitId]
 * @param {string} [options.branchId]
 * @param {string} [options.createdBy]      uid or email of whoever ran the import
 * @param {Array<Object>} [options.existingDocs]  current ledger docs, each with
 *        `id` and `policyNumber`. Absent/empty means a first import.
 * @returns {{creates: Array, updates: Array, skips: Array, report: Object}}
 */
export function buildImportPlan(parsedDocs, options = {}) {
  const {
    tenantId, agentId, exportDate, importedAt,
    unitId = null, branchId = null, createdBy = null,
    existingDocs = [],
  } = options;

  if (!tenantId) throw new Error('buildImportPlan: tenantId is required');
  if (!agentId) throw new Error('buildImportPlan: agentId is required');
  if (!exportDate) throw new Error('buildImportPlan: exportDate is required');
  if (!importedAt) throw new Error('buildImportPlan: importedAt is required');

  const docs = Array.isArray(parsedDocs) ? parsedDocs : [];

  // Existing docs keyed by policy number — the idempotency key (brief hard rule).
  const existingByNumber = new Map();
  const duplicateExisting = [];
  for (const d of Array.isArray(existingDocs) ? existingDocs : []) {
    const n = d?.policyNumber;
    if (!n) continue;
    if (existingByNumber.has(n)) { duplicateExisting.push(n); continue; }
    existingByNumber.set(n, d);
  }

  const creates = [];
  const updates = [];
  const skips = [];

  for (const parsed of docs) {
    const { policyNumber } = parsed;
    const existing = existingByNumber.get(policyNumber);

    if (!existing) {
      // A create carries the owned fields PLUS the added ones. `createdAt` is a
      // placeholder the writer replaces with a server timestamp; it is present
      // here so the dry run shows the true field set.
      creates.push({
        policyNumber,
        doc: {
          ...parsed,
          sourceOfProspect: null,        // ruling 5b — never the agent pick list
          importSource: OIPA_IMPORT_SOURCE,
          importedAt,
          exportDate,
          productLine: 'life',           // ruling 5c
          dateWritten: null,             // ruling 5d
          dateWrittenUnknown: true,      // ruling 5d
          tenantId,
          agentId,
          unitId,
          branchId,
          createdBy,
          createdAt: '<serverTimestamp>',
        },
        history: { source: OIPA_IMPORT_SOURCE, exportDate, action: 'create' },
      });
      continue;
    }

    // Existing: compute the owned-field delta only.
    const changed = {};
    for (const key of IMPORT_OWNED_FIELDS) {
      const next = key === 'importSource' ? OIPA_IMPORT_SOURCE
        : key === 'importedAt' ? importedAt
          : key === 'exportDate' ? exportDate
            : parsed[key];
      if (fieldDiffers(next, existing[key])) changed[key] = next;
    }

    // `importedAt` and `exportDate` alone are not a real change: a re-run of the
    // SAME export on a later day would otherwise report 229 updates that carry
    // no new business fact. A doc counts as changed only when something the
    // export actually says about the policy moved.
    const substantive = Object.keys(changed).filter(
      (k) => k !== 'importedAt' && k !== 'importSource',
    );

    if (substantive.length === 0) {
      skips.push({ policyNumber, id: existing.id, reason: 'unchanged' });
      continue;
    }

    updates.push({
      policyNumber,
      id: existing.id,
      changed,
      changedKeys: Object.keys(changed).sort(),
      history: {
        source: OIPA_IMPORT_SOURCE,
        exportDate,
        action: 'update',
        fields: Object.keys(changed).sort(),
      },
    });
  }

  // Ledger docs the export no longer mentions. NOT deleted and NOT modified —
  // an export is a snapshot of one agent's book, and absence is not evidence of
  // deletion (a filter change upstream would silently wipe the ledger).
  const parsedNumbers = new Set(docs.map((d) => d?.policyNumber));
  const orphanedInLedger = [...existingByNumber.keys()].filter((n) => !parsedNumbers.has(n));

  return {
    creates,
    updates,
    skips,
    report: {
      tenantId,
      agentId,
      exportDate,
      importedAt,
      parsedDocs: docs.length,
      existingDocs: existingByNumber.size,
      creates: creates.length,
      updates: updates.length,
      skips: skips.length,
      duplicateExisting,
      orphanedInLedger,
      accountedFor: creates.length + updates.length + skips.length === docs.length,
      importOwnedFields: [...IMPORT_OWNED_FIELDS],
      addedFields: Object.keys(IMPORT_ADDED_FIELDS_NOTE),
    },
  };
}

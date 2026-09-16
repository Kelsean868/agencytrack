#!/usr/bin/env node
/**
 * import-oipa-portfolio.mjs — imports an OIPA/INGENIUM agent-portfolio export
 * into the agent's policy ledger.
 *
 *   node scripts/ops/import-oipa-portfolio.mjs --file <xlsx> --agent-email <email> [--live]
 *
 * DRY RUN IS THE DEFAULT. Without `--live` nothing is written and nothing is read
 * that could change state; the script prints the create / update / skip plan and
 * exits 0. `--live` additionally requires an interactive confirmation, because a
 * flag alone is one keystroke away from a 229-document write to production.
 *
 * WHAT THIS FILE IS RESPONSIBLE FOR: input/output only.
 *   parsing        -> src/lib/portfolioImport/parseOipaExport.js   (pure, tested)
 *   the decisions  -> src/lib/portfolioImport/buildImportPlan.js   (pure, tested)
 * The dry run and the live run build the SAME plan from the SAME module, so what
 * is printed is what would be written. A dry run computed by a different code
 * path is worse than none — it authorises a write that was never rehearsed.
 *
 * WHY THE ADMIN SDK AND NOT `createPolicy()`:
 * not a shortcut — a structural necessity. `firestore.rules` accepts a policy
 * create only when `status == 'written'`, and `policiesService.validate()` requires
 * `sourceOfProspect` to be in the agent pick list. Imported docs are historical:
 * they arrive settled, lapsed, ntu or denied, with no prospecting channel. No
 * client path can express them. (Dispatcher ruling 5b, 16 Sep 2026.)
 *
 * CREDENTIALS: ambient only. `admin.initializeApp()` with no argument, per
 * CLAUDE.md — never a service-account key file. `firebase-admin` resolves from
 * `functions/node_modules`, which is the canonical install path in this repo.
 */

import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import XLSX from 'xlsx';

import { parseOipaExport, rowsFromSheetMatrix, parseExportDateFromTitle } from '../../src/lib/portfolioImport/parseOipaExport.js';
import { buildImportPlan, IMPORT_ADDED_FIELDS_NOTE } from '../../src/lib/portfolioImport/buildImportPlan.js';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** firebase-admin lives only in functions/node_modules (CLAUDE.md). */
function loadAdmin() {
  try {
    return require(path.join(HERE, '../../functions/node_modules/firebase-admin'));
  } catch (err) {
    throw new Error(
      'Could not load firebase-admin from functions/node_modules. '
      + 'Run `npm install` inside functions/ first. Original: ' + err.message,
    );
  }
}

function parseArgs(argv) {
  const out = { live: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') out.file = argv[++i];
    else if (a === '--agent-email') out.agentEmail = argv[++i];
    else if (a === '--uid') out.uid = argv[++i];
    else if (a === '--tenant') out.tenant = argv[++i];
    else if (a === '--live') out.live = true;
    else if (a === '--yes') out.yes = true;      // for a non-interactive live run
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

const USAGE = `
import-oipa-portfolio.mjs — import an OIPA agent-portfolio export into the ledger

  --file <path>          the .xlsx export (required)
  --agent-email <email>  the SERVICING agent whose ledger this is
  --uid <uid>            the agent's uid, INSTEAD of --agent-email. Skips the Auth
                         lookup entirely, so the run needs Firestore access only —
                         useful where local ADC has no quota project set for
                         identitytoolkit. Requires --tenant.
  --tenant <tenantId>    required with --uid; otherwise read from Auth claims
  --live                 actually write. Without this, dry run only.
  --yes                  skip the interactive confirm (only with --live)
  --json                 print the plan report as JSON as well
  --help

Dry run is the default and writes nothing.
`;

/** Money/percent-free fixed-width formatting for the plan table. */
const pad = (s, n) => String(s).padEnd(n);

function readWorkbook(file) {
  const wb = XLSX.readFile(file, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1, raw: true, defval: null, blankrows: true,
  });
  return { sheetName, matrix };
}

/**
 * Resolves the agent by email through Auth, then reads the user doc for tenant,
 * unit, branch and agent number.
 *
 * Every one of those is needed for the written doc to be READABLE: the read rules
 * gate a unit_manager on `resource.data.unitId`, and `getPoliciesForManager`
 * filters on `tenantId` / `unitId` / `branchId`. A doc missing them is invisible
 * to the people who are supposed to see it.
 */
async function resolveAgent(admin, db, agentEmail, tenantOverride, uid) {
  // --uid path: read the user doc directly, no Auth call. Same Firestore reads and
  // the same derived fields; it simply does not need the identitytoolkit API,
  // which local user-credential ADC cannot reach without a quota project.
  if (uid) {
    if (!tenantOverride) throw new Error('--uid requires --tenant');
    const snap = await db.doc(`tenants/${tenantOverride}/users/${uid}`).get();
    if (!snap.exists) throw new Error(`no user doc at tenants/${tenantOverride}/users/${uid}`);
    const u = snap.data();
    return {
      uid,
      tenantId: tenantOverride,
      agentNumber: u.agentNumber ?? null,
      unitId: u.unitId ?? null,
      branchId: u.branchId ?? null,
      name: u.name ?? u.displayName ?? null,
      role: u.role ?? null,
      email: u.email ?? null,
      resolvedVia: 'uid',
    };
  }
  const user = await admin.auth().getUserByEmail(agentEmail);
  const claims = user.customClaims ?? {};
  const tenantId = tenantOverride ?? claims.tenantId;
  if (!tenantId) {
    throw new Error(
      `no tenantId for ${agentEmail} (custom claims: ${JSON.stringify(claims)}). `
      + 'Pass --tenant explicitly if this is intentional.',
    );
  }
  const snap = await db.doc(`tenants/${tenantId}/users/${user.uid}`).get();
  if (!snap.exists) throw new Error(`no user doc at tenants/${tenantId}/users/${user.uid}`);
  const u = snap.data();
  return {
    uid: user.uid,
    tenantId,
    agentNumber: u.agentNumber ?? null,
    unitId: u.unitId ?? null,
    branchId: u.branchId ?? null,
    name: u.name ?? u.displayName ?? null,
    role: u.role ?? claims.role ?? null,
    email: user.email ?? null,
    resolvedVia: 'email',
  };
}

/** Existing ledger docs for this agent, read once. Read-only in both modes. */
async function fetchExisting(db, tenantId, agentId) {
  const snap = await db.collection(`tenants/${tenantId}/policies`)
    .where('agentId', '==', agentId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function printPlan(parseReport, plan, agent, exportDate, opts) {
  const { report } = plan;

  console.log('\n================ OIPA PORTFOLIO IMPORT ================');
  console.log(`mode         ${opts.live ? 'LIVE (will write)' : 'DRY RUN (writes nothing)'}`);
  console.log(`file         ${opts.file}`);
  console.log(`export date  ${exportDate}`);
  console.log(`agent        ${agent.name ?? '(no name)'} <${agent.email ?? opts.agentEmail ?? '(email not read)'}>  [resolved via ${agent.resolvedVia}]`);
  console.log(`             uid ${agent.uid} | agentNumber ${agent.agentNumber ?? '(none)'} | role ${agent.role ?? '(none)'}`);
  console.log(`tenant       ${agent.tenantId}`);
  console.log(`unit/branch  ${agent.unitId ?? '(none)'} / ${agent.branchId ?? '(none)'}`);

  console.log('\n---- parse (P0) ----');
  console.log(`rows ${parseReport.rows} | shadows ${parseReport.shadows} `
    + `(Pending Issue ${parseReport.shadowsPendingIssue}, AFR twins ${parseReport.shadowsAfrTwins}) `
    + `| test records ${parseReport.testRecords} | docs ${parseReport.docs}`);
  console.log(`rowsAccountedFor ${parseReport.rowsAccountedFor}`);
  console.log(`statusCounts ${JSON.stringify(parseReport.statusCounts)}`);
  console.log(`  settled without terminal ${parseReport.settledWithoutTerminal} | with terminal ${parseReport.settledWithTerminal}`);
  console.log(`planClassPending ${JSON.stringify(parseReport.planClassPending)}`);
  console.log(`classUnconfirmed ${parseReport.classUnconfirmed.length} ${JSON.stringify(parseReport.classUnconfirmed)}`);
  console.log(`unknownPlanPrefixes ${JSON.stringify(parseReport.unknownPlanPrefixes)}`);
  console.log(`unmappedStatus ${JSON.stringify(parseReport.unmappedStatus)}`);
  if (parseReport.afrWithoutTwin.length) {
    console.log(`!! AFR rows with no twin (kept): ${JSON.stringify(parseReport.afrWithoutTwin)}`);
  }

  console.log('\n---- overrides applied ----');
  if (!parseReport.overridesApplied.length) console.log('(none)');
  for (const o of parseReport.overridesApplied) {
    console.log(`  ${pad(o.policyNumber, 12)} ${pad(`${o.from.oipaStatus}/${o.from.oipaSubStatus}`, 26)} `
      + `mapped ${pad(o.from.mappedStatus, 10)} -> ${JSON.stringify(o.to)}`);
    console.log(`               why: ${o.note}`);
  }

  console.log('\n---- write plan ----');
  console.log(`existing docs in ledger for this agent  ${report.existingDocs}`);
  console.log(`CREATE ${report.creates}   UPDATE ${report.updates}   SKIP(unchanged) ${report.skips}`);
  console.log(`accountedFor ${report.accountedFor}  (creates + updates + skips === parsed docs)`);
  if (report.duplicateExisting.length) {
    console.log(`!! duplicate policyNumbers ALREADY in the ledger: ${JSON.stringify(report.duplicateExisting)}`);
  }
  if (report.orphanedInLedger.length) {
    console.log(`note: ${report.orphanedInLedger.length} ledger doc(s) not in this export — left untouched, never deleted`);
    console.log(`      ${JSON.stringify(report.orphanedInLedger.slice(0, 10))}${report.orphanedInLedger.length > 10 ? ' …' : ''}`);
  }

  if (plan.updates.length) {
    console.log('\n---- updates, field by field ----');
    for (const u of plan.updates.slice(0, 25)) {
      console.log(`  ${pad(u.policyNumber, 12)} ${u.changedKeys.join(', ')}`);
    }
    if (plan.updates.length > 25) console.log(`  … and ${plan.updates.length - 25} more`);
  }

  console.log('\n---- the doc shape a CREATE would write ----');
  if (plan.creates.length) {
    const sample = plan.creates[0];
    const keys = Object.keys(sample.doc).sort();
    console.log(`field count ${keys.length}`);
    console.log(keys.join(', '));
    console.log('\nfields ADDED beyond the brief rule-7 inventory, and why:');
    for (const [k, why] of Object.entries(IMPORT_ADDED_FIELDS_NOTE)) {
      console.log(`  ${pad(k, 20)} ${why}`);
    }
  } else {
    console.log('(no creates in this plan)');
  }

  console.log('\nimport-owned fields (the only ones an UPDATE may overwrite):');
  console.log(`  ${report.importOwnedFields.join(', ')}`);
  console.log('  everything else on an existing doc survives untouched — a CRO delivery');
  console.log('  stamp, a manager confirmation and agent notes are not the export\'s to erase.');

  if (opts.json) {
    console.log('\n---- report JSON ----');
    console.log(JSON.stringify(report, null, 2));
  }
}

/**
 * Applies the plan. Batched, and a history doc per policy carries the provenance
 * the brief requires: `{ source: 'oipa_import', exportDate }`.
 *
 * 500 is Firestore's hard write limit per batch, and a create costs TWO writes
 * (the doc plus its history doc), so the chunk is sized on write count, not on
 * document count. Sizing it on documents is how a 229-doc import silently
 * exceeds the limit at ~250.
 */
async function applyPlan(admin, db, plan, tenantId) {
  const FieldValue = admin.firestore.FieldValue;
  const col = db.collection(`tenants/${tenantId}/policies`);
  const MAX_WRITES = 450; // headroom under 500

  const ops = [];
  for (const c of plan.creates) {
    ops.push({ kind: 'create', ...c });
  }
  for (const u of plan.updates) {
    ops.push({ kind: 'update', ...u });
  }

  let written = 0;
  let batch = db.batch();
  let writes = 0;

  const flush = async () => {
    if (writes === 0) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };

  for (const op of ops) {
    if (writes + 2 > MAX_WRITES) await flush();

    if (op.kind === 'create') {
      const ref = col.doc();
      const doc = { ...op.doc, createdAt: FieldValue.serverTimestamp() };
      batch.set(ref, doc);
      batch.set(ref.collection('history').doc(), {
        ...op.history,
        at: FieldValue.serverTimestamp(),
      });
      writes += 2;
    } else {
      const ref = col.doc(op.id);
      batch.update(ref, { ...op.changed, updatedAt: FieldValue.serverTimestamp() });
      batch.set(ref.collection('history').doc(), {
        ...op.history,
        at: FieldValue.serverTimestamp(),
      });
      writes += 2;
    }
    written++;
  }
  await flush();
  return written;
}

async function confirmLive(plan, agent) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const expected = 'yes';
  console.log(`\n!! LIVE WRITE to tenant ${agent.tenantId}, agent ${agent.uid}`);
  console.log(`!! ${plan.report.creates} creates, ${plan.report.updates} updates. This touches PRODUCTION data.`);
  const answer = await rl.question(`Type "${expected}" to proceed: `);
  rl.close();
  return answer.trim().toLowerCase() === expected;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(USAGE); return 0; }
  if (!opts.file) { console.error('--file is required\n' + USAGE); return 2; }
  if (!opts.agentEmail && !opts.uid) { console.error('one of --agent-email or --uid is required\n' + USAGE); return 2; }
  if (opts.uid && !opts.tenant) { console.error('--uid requires --tenant\n' + USAGE); return 2; }
  if (opts.yes && !opts.live) { console.error('--yes only makes sense with --live'); return 2; }

  const { sheetName, matrix } = readWorkbook(opts.file);
  const titleCell = matrix[0]?.[0];
  const exportDate = parseExportDateFromTitle(titleCell);
  if (!exportDate) {
    console.error(
      `could not read an export date from the sheet title cell (${JSON.stringify(titleCell)}). `
      + 'Expected a DD.MM.YY date in it.',
    );
    return 2;
  }
  console.log(`sheet "${sheetName}" | title ${JSON.stringify(titleCell)} | export date ${exportDate}`);

  const admin = loadAdmin();
  admin.initializeApp();                    // ambient credentials, never a key file
  const db = admin.firestore();

  const agent = await resolveAgent(admin, db, opts.agentEmail, opts.tenant, opts.uid);
  if (!agent.agentNumber) {
    console.error(
      `agent ${opts.agentEmail} has no agentNumber on the user doc. `
      + 'isWritingAgent cannot be computed without it — refusing rather than '
      + 'marking all 229 policies as somebody else\'s business.',
    );
    return 2;
  }

  const rows = rowsFromSheetMatrix(matrix);
  const { docs, report: parseReport } = parseOipaExport(rows, {
    exportDate,
    agentId: agent.uid,
    agentNumber: agent.agentNumber,
    importedAt: new Date().toISOString().slice(0, 10),
  });

  const existingDocs = await fetchExisting(db, agent.tenantId, agent.uid);

  const plan = buildImportPlan(docs, {
    tenantId: agent.tenantId,
    agentId: agent.uid,
    agentNumber: agent.agentNumber,
    exportDate,
    importedAt: new Date().toISOString().slice(0, 10),
    unitId: agent.unitId,
    branchId: agent.branchId,
    createdBy: opts.agentEmail ?? `uid:${agent.uid}`,
    existingDocs,
  });

  printPlan(parseReport, plan, agent, exportDate, opts);

  if (!plan.report.accountedFor) {
    console.error('\nREFUSING: creates + updates + skips does not equal the parsed doc count.');
    return 1;
  }
  if (parseReport.unmappedStatus.length) {
    console.error(`\nREFUSING: ${parseReport.unmappedStatus.length} row(s) have a status no rule maps. `
      + 'Add the mapping to oipaImportConfig.js first.');
    return 1;
  }

  if (!opts.live) {
    console.log('\nDRY RUN — nothing was written. Re-run with --live to apply.');
    return 0;
  }

  if (!opts.yes && !(await confirmLive(plan, agent))) {
    console.log('aborted — nothing written.');
    return 1;
  }

  const written = await applyPlan(admin, db, plan, agent.tenantId);
  console.log(`\nLIVE: applied ${written} operation(s) `
    + `(${plan.report.creates} creates, ${plan.report.updates} updates).`);
  return 0;
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((err) => {
    console.error('\nFAILED:', err.message);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  });

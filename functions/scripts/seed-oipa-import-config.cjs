#!/usr/bin/env node
/**
 * seed-oipa-import-config.cjs — writes ONE agent's portfolio-import config.
 *
 * Ruling 4 (17 Sep 2026): the overrides, the self/family list and the test-record
 * skip list are facts about ONE agent's book, not about the OIPA vocabulary. They
 * moved out of code into `tenants/{t}/users/{uid}/prefs/portfolioImport`. This
 * script seeds Kyron's current values into HIS doc. Every other agent's doc stays
 * absent, which the parser reads as empty.
 *
 * Usage (dry run prints the doc and writes nothing):
 *   node functions/scripts/seed-oipa-import-config.cjs --tenant tatillife_south --uid <uid>
 *   node functions/scripts/seed-oipa-import-config.cjs --tenant tatillife_south --uid <uid> --live
 *
 * Run from the repo root or from functions/ — firebase-admin resolves either way.
 * Ambient credentials only; never a key file.
 */

const path = require('node:path');
const { pathToFileURL } = require('node:url');

function loadAdmin() {
  try { return require('firebase-admin'); } catch { /* fall through */ }
  return require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
}

function parseArgs(argv) {
  const out = { live: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--tenant') out.tenant = argv[++i];
    else if (argv[i] === '--uid') out.uid = argv[++i];
    else if (argv[i] === '--live') out.live = true;
    else if (argv[i] === '--help' || argv[i] === '-h') out.help = true;
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.tenant || !opts.uid) {
    console.log('usage: seed-oipa-import-config.cjs --tenant <tenantId> --uid <uid> [--live]');
    return opts.help ? 0 : 2;
  }

  // The seed values live in the shared config module, so this script can never
  // hold a second, drifting copy of the overrides.
  const cfg = await import(
    pathToFileURL(path.join(__dirname, '..', 'portfolioImport', 'esm', 'oipaImportConfig.js')).href,
  );

  const doc = {
    overrides: cfg.OIPA_SEED_IMPORT_CONFIG.overrides,
    selfOrFamily: cfg.OIPA_SEED_IMPORT_CONFIG.selfOrFamily,
    testPolicyNumbers: [...cfg.OIPA_SEED_IMPORT_CONFIG.testPolicyNumbers],
    seededAt: new Date().toISOString(),
    seededBy: 'seed-oipa-import-config.cjs',
  };

  const target = `tenants/${opts.tenant}/users/${opts.uid}/prefs/${cfg.OIPA_IMPORT_CONFIG_PREF_ID}`;
  console.log(`target  ${target}`);
  console.log(JSON.stringify(doc, null, 2));

  if (!opts.live) {
    console.log('\nDRY RUN — nothing written. Re-run with --live to apply.');
    return 0;
  }

  const admin = loadAdmin();
  admin.initializeApp();
  // MERGE so an agent's own later edits to other fields on this doc survive a
  // re-seed. A blind set would silently discard them.
  await admin.firestore().doc(target).set(doc, { merge: true });
  console.log(`\nLIVE: wrote ${target}`);
  return 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });

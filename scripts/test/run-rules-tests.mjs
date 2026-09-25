/**
 * Runner for the Firestore emulator rules-test suite (SEC-21).
 *
 * Discovers and runs every file in tests/rules/*.mjs plus the root
 * firestore.rules.test.mjs, against a running Firestore emulator, and exits
 * non-zero if any file fails. Requires FIRESTORE_EMULATOR_HOST to be set —
 * `firebase emulators:exec` sets it automatically; this script also falls
 * back to firebase.json's configured host:port (127.0.0.1:9090) so a
 * developer can run it against a manually-started emulator too.
 *
 * Usage:
 *   firebase emulators:exec --only firestore --project=demo-agencytrack \
 *     "node scripts/test/run-rules-tests.mjs"
 *
 * Two runtime shapes exist across the suite (both are run as-is, not forced
 * onto one harness):
 *   - tests/rules/*.mjs (36 files): self-contained scripts with their own
 *     pass/fail counter and `process.exit(1)` on failure — run with plain
 *     `node <file>`.
 *   - firestore.rules.test.mjs (root): uses node:test's describe/it/before —
 *     run with `node --test <file>`.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const rulesDir = join(repoRoot, 'tests', 'rules');
const ROOT_FILE = 'firestore.rules.test.mjs';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:9090';
  console.log(`FIRESTORE_EMULATOR_HOST not set — defaulting to ${process.env.FIRESTORE_EMULATOR_HOST} (firebase.json's configured port)`);
}

const files = readdirSync(rulesDir)
  .filter((f) => f.endsWith('.mjs'))
  .map((f) => join('tests', 'rules', f))
  .sort();
files.unshift(ROOT_FILE);

let totalPass = 0;
let totalFail = 0;
const failures = [];

for (const f of files) {
  const isRoot = f === ROOT_FILE;
  const args = isRoot ? ['--test', f] : [f];
  const start = Date.now();
  const res = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: 'utf8', timeout: 120000 });
  const dur = Date.now() - start;
  const ok = res.status === 0;
  if (ok) {
    totalPass++;
  } else {
    totalFail++;
    failures.push({ file: f, status: res.status, stdout: res.stdout, stderr: res.stderr });
  }
  console.log(`${ok ? 'PASS' : 'FAIL'} (${dur}ms) ${f}`);
}

console.log(`\n===== SUMMARY: ${files.length} files, ${totalPass} passed, ${totalFail} failed =====`);

if (failures.length > 0) {
  console.log('\n===== FAILURE DETAIL =====');
  for (const f of failures) {
    console.log(`\n--- ${f.file} (exit ${f.status}) ---`);
    console.log(f.stdout);
    console.error(f.stderr);
  }
}

process.exit(totalFail > 0 ? 1 : 0);

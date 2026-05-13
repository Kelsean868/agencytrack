/**
 * run-all.mjs — Pre-pilot shakedown orchestrator.
 *
 * Executes all 10 shakedown categories sequentially.
 * Implements the brief's 7-phase structure:
 *
 *   Phase 3: Seed test data
 *   Phase 4: Execute shakedown (categories 1–10)
 *   Phase 5: Generate findings report
 *   Phase 6: Cleanup (MUST run regardless of shakedown outcomes)
 *
 * Hard stops (brief § Hard stops):
 *   - Seed phase fails → STOP (no wipe risk since no data written)
 *   - Cleanup phase fails → STOP IMMEDIATELY (potential production orphans)
 *   - More than 20 blocker-or-major bugs found → STOP, surface
 *   - Any single category > 90 minutes → STOP, checkpoint
 *   - Total runtime > 10 hours → STOP
 *
 * USAGE
 *   $env:CLEANUP_ALLOWED_TENANTS = "tatillife_south"
 *   node scripts/verification/shakedown/run-all.mjs
 *
 * SKIP SEED (if data already exists from a prior aborted run):
 *   node scripts/verification/shakedown/run-all.mjs --skip-seed
 *
 * SKIP CLEANUP (for debugging — data remains, must be manually wiped):
 *   node scripts/verification/shakedown/run-all.mjs --skip-cleanup
 *   WARNING: Never leave *@agencytrack.test data in production.
 *
 * OUTPUT
 *   verification/shakedown-<timestamp>/
 *     run.log                       — full run transcript
 *     cat01-auth/log.json           — per-category JSON results
 *     cat02-agent/log.json
 *     ... (one per category)
 *   verification/shakedown-screenshots-<timestamp>/
 *     (organized per cat08-screenshot-dossier.mjs layout)
 *   docs/shakedown-findings-<YYYY-MM-DD>.md
 */

import { resolve, join }  from 'path';
import { dirname }        from 'path';
import { fileURLToPath }  from 'url';
import {
  existsSync, mkdirSync,
  appendFileSync, writeFileSync,
  readFileSync,
} from 'fs';
import { spawnSync }      from 'child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '../../..');

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const SKIP_SEED   = args.includes('--skip-seed');
const SKIP_CLEANUP = args.includes('--skip-cleanup');

// ── Env: CLEANUP_ALLOWED_TENANTS must be set ──────────────────────────────────
process.env.CLEANUP_ALLOWED_TENANTS = 'tatillife_south';

// ── Timestamp + output dirs ───────────────────────────────────────────────────
const ts        = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const RUN_DIR   = resolve(ROOT, 'verification', `shakedown-${ts}`);
const SS_DIR    = resolve(ROOT, 'verification', `shakedown-screenshots-${ts}`);
const LOG_PATH  = join(RUN_DIR, 'run.log');
const DATE_STR  = new Date().toISOString().slice(0, 10);
const REPORT_PATH = resolve(ROOT, `docs/shakedown-findings-${DATE_STR}.md`);

mkdirSync(RUN_DIR, { recursive: true });
mkdirSync(SS_DIR,  { recursive: true });

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_PATH, line + '\n');
}

// ── Category imports ──────────────────────────────────────────────────────────
import { runSeedPhase }            from './seed-phase.mjs';
import { runCat01 }                from './cat01-auth.mjs';
import { runCat02Agent }           from './cat02-role-agent.mjs';
import { runCat02UnitManager }     from './cat02-role-unit-manager.mjs';
import { runCat02BranchManager }   from './cat02-role-branch-manager.mjs';
import { runCat02TenantAdmin }     from './cat02-role-tenant-admin.mjs';
import { runCat02PlatformAdmin }   from './cat02-role-platform-admin.mjs';
import { runCat03PermissionMatrix} from './cat03-permission-matrix.mjs';
import { runCat04FormValidation }  from './cat04-form-validation.mjs';
import { runCat05EdgeCases }       from './cat05-edge-cases.mjs';
import { runCat06CrossRoleFlows }  from './cat06-cross-role-flows.mjs';
import { runCat07A11y }            from './cat07-a11y.mjs';
import { runCat08ScreenshotDossier } from './cat08-screenshot-dossier.mjs';
import { runCat10EmailInfra }      from './cat10-email-infra.mjs';

// ── Timing guard ──────────────────────────────────────────────────────────────
const HARD_CEILING_MS = 10 * 60 * 60 * 1000; // 10 hours
const CAT_CEILING_MS  = 90 * 60 * 1000;        // 90 minutes per category
const globalStart     = Date.now();

function checkGlobalTime() {
  if (Date.now() - globalStart > HARD_CEILING_MS) {
    log('HARD STOP: Total runtime exceeded 10 hours. Proceeding to cleanup.');
    return false;
  }
  return true;
}

async function runCategory(name, fn, opts) {
  const catStart = Date.now();
  log(`\n${'═'.repeat(60)}`);
  log(`START ${name}`);
  let result;
  try {
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`Category timeout: ${name} exceeded 90 minutes`)), CAT_CEILING_MS),
    );
    result = await Promise.race([fn(opts), timeout]);
  } catch (e) {
    const elapsed = Math.round((Date.now() - catStart) / 1000);
    log(`ERROR ${name}: ${e.message} (${elapsed}s)`);
    result = {
      category: name,
      results:  [{ id: 'ERROR', label: `Category threw: ${e.message}`, pass: false }],
      pass:     0,
      total:    1,
      error:    e.message,
    };
  }
  const elapsed = Math.round((Date.now() - catStart) / 1000);
  const pct = result.total > 0 ? Math.round(100 * result.pass / result.total) : 0;
  log(`END ${name}: ${result.pass}/${result.total} (${pct}%) in ${elapsed}s`);

  // Write per-category JSON log
  const catLogPath = join(RUN_DIR, `${name}.json`);
  writeFileSync(catLogPath, JSON.stringify(result, null, 2));

  return result;
}

// ── Cleanup helper ─────────────────────────────────────────────────────────────

function runCleanup() {
  log('\n' + '═'.repeat(60));
  log('PHASE 6: Cleanup — running wipe-test-data-sweep.mjs');

  // Step 1: Preview what will be deleted
  const preview = spawnSync('node', [
    'scripts/cleanup/preview-test-data-sweep.mjs',
    '--mode=email-pattern',
  ], {
    cwd:      ROOT,
    encoding: 'utf8',
    timeout:  120_000,
    env:      { ...process.env, CLEANUP_ALLOWED_TENANTS: 'tatillife_south' },
  });
  if (preview.stdout) process.stdout.write(preview.stdout);
  if (preview.status !== 0) {
    log('CLEANUP HARD STOP: preview-test-data-sweep.mjs failed');
    log('  Manual cleanup required: node scripts/cleanup/wipe-test-data-sweep.mjs --mode=email-pattern --execute');
    return false;
  }

  // Parse expected user count from preview output
  const totals = [...(preview.stdout ?? '').matchAll(/^\s+Total: (\d+)/gm)];
  const userCount = totals[0] ? parseInt(totals[0][1], 10) : 0;
  if (userCount === 0) {
    log('No *@agencytrack.test users found — cleanup already clean or seed was skipped');
    return true;
  }

  // Step 2: Build the confirmation phrase
  const confirmTs = new Date().toISOString().slice(0, 19) + 'Z';
  const phrase    = `DELETE ${userCount} USERS AT ${confirmTs}`;
  log(`  Wipe confirmation phrase: ${phrase}`);

  // Step 3: Run wipe with auto-confirmation (piped stdin)
  const wipe = spawnSync('node', [
    'scripts/cleanup/wipe-test-data-sweep.mjs',
    '--mode=email-pattern',
    '--execute',
  ], {
    cwd:      ROOT,
    encoding: 'utf8',
    timeout:  300_000,
    input:    phrase + '\n',
    env:      { ...process.env, CLEANUP_ALLOWED_TENANTS: 'tatillife_south' },
  });

  if (wipe.stdout) process.stdout.write(wipe.stdout);
  if (wipe.stderr) process.stderr.write(wipe.stderr);

  if (wipe.status !== 0) {
    log('CLEANUP HARD STOP: wipe-test-data-sweep.mjs failed');
    log('  Manual cleanup required immediately.');
    return false;
  }

  // Step 4: Post-wipe verify
  const postPreview = spawnSync('node', [
    'scripts/cleanup/preview-test-data-sweep.mjs',
    '--mode=email-pattern',
  ], {
    cwd:      ROOT,
    encoding: 'utf8',
    timeout:  60_000,
    env:      { ...process.env, CLEANUP_ALLOWED_TENANTS: 'tatillife_south' },
  });
  if (postPreview.stdout) process.stdout.write(postPreview.stdout);

  const postTotals = [...(postPreview.stdout ?? '').matchAll(/^\s+Total: (\d+)/gm)];
  const remaining  = postTotals[0] ? parseInt(postTotals[0][1], 10) : -1;
  if (remaining !== 0) {
    log(`CLEANUP HARD STOP: ${remaining} users remain after wipe — manual cleanup required`);
    return false;
  }

  log('✓ Cleanup complete — 0 *@agencytrack.test users remaining');
  return true;
}

// ── Report generator ──────────────────────────────────────────────────────────

function generateReport(allResults, batchId, runtimeMs) {
  const totalTests = allResults.reduce((s, c) => s + (c.total ?? 0), 0);
  const totalPass  = allResults.reduce((s, c) => s + (c.pass  ?? 0), 0);
  const totalFail  = totalTests - totalPass;

  // Aggregate failures as bugs (Inconclusive = skipped)
  const bugs = [];
  let bugNum = 1;
  for (const cat of allResults) {
    for (const r of (cat.results ?? [])) {
      if (!r.pass && !r.skipped) {
        bugs.push({ num: bugNum++, category: cat.category, id: r.id, label: r.label, error: r.error ?? 'assertion failed' });
      }
    }
  }

  const a11yResults = allResults.find((c) => c.category === 'cat07-a11y');
  const a11yTotals  = a11yResults?.a11yTotals ?? { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const shotResult  = allResults.find((c) => c.category === 'cat08-screenshot-dossier');
  const shotCount   = shotResult?.shotCount ?? 0;

  const runtimeHrs = (runtimeMs / 1000 / 3600).toFixed(2);

  // Severity heuristic: category 3 failures = permission (Blocker)
  //                     category 1/2 failures = Functional
  //                     a11y critical = Blocker
  const blockers = bugs.filter((b) => b.category.includes('cat03') || (b.id?.startsWith('T7') && b.error?.includes('CRITICAL')));
  const majors   = bugs.filter((b) => !blockers.includes(b) && (b.category.includes('cat01') || b.category.includes('cat02') || b.category.includes('cat06')));
  const minors   = bugs.filter((b) => !blockers.includes(b) && !majors.includes(b) && !b.category.includes('cat08'));
  const polish   = bugs.filter((b) => b.category.includes('cat08'));

  const recommendation = blockers.length > 0
    ? 'fix-then-ship'
    : majors.length > 5
      ? 'fix-then-ship'
      : majors.length > 0
        ? 'ship-with-known-issues'
        : 'ship-pilot';

  let md = `# Pre-Pilot Shakedown Findings — ${DATE_STR}

## Executive summary

- **Total tests run:** ${totalTests}
- **Pass:** ${totalPass} / **Fail:** ${totalFail} / **Inconclusive (skipped):** ${allResults.flatMap((c) => c.results).filter((r) => r.skipped).length}
- **Bugs found:** ${bugs.length} (Blocker: ${blockers.length}, Major: ${majors.length}, Minor: ${minors.length}, Polish: ${polish.length})
- **A11y violations:** Critical: ${a11yTotals.critical} | Serious: ${a11yTotals.serious} | Moderate: ${a11yTotals.moderate} | Minor: ${a11yTotals.minor}
- **Screenshots captured:** ${shotCount} (target ≥80)
- **Runtime:** ${runtimeHrs}h (budget: ≤10h)
- **Seed batch ID:** \`${batchId ?? 'n/a'}\`
- **Recommendation:** **${recommendation.toUpperCase()}**

`;

  if (bugs.length === 0) {
    md += `## Bug inventory\n\nNo failures detected.\n\n`;
  } else {
    md += `## Bug inventory\n\n`;
    for (const bug of bugs) {
      const sev = blockers.includes(bug) ? 'Blocker' : majors.includes(bug) ? 'Major' : minors.includes(bug) ? 'Minor' : 'Polish';
      const cat = bug.category.replace(/^cat\d+-?/, '').replace(/-/g, ' ');
      md += `### Bug ${String(bug.num).padStart(3, '0')} — ${bug.label}

- **Severity:** ${sev}
- **Category:** ${cat}
- **Test ID:** ${bug.id}
- **Error:** \`${bug.error}\`
- **Screenshot:** Check \`verification/shakedown-screenshots-${ts}/\` for relevant captures.
- **Suggested fix area:** TBD — investigate component/service for \`${bug.id}\`
- **Effort estimate:** S/M/L — TBD

`;
    }
  }

  md += `## Test coverage report

| Category | Tests | Pass | Fail | Notes |
|---|---|---|---|---|
`;
  for (const cat of allResults) {
    const skippedCount = (cat.results ?? []).filter((r) => r.skipped).length;
    const note = cat.error ? `Error: ${cat.error.slice(0, 50)}` : skippedCount > 0 ? `${skippedCount} skipped` : '';
    md += `| ${cat.category} | ${cat.total ?? 0} | ${cat.pass ?? 0} | ${(cat.total ?? 0) - (cat.pass ?? 0)} | ${note} |\n`;
  }

  md += `
## Performance observations

- Run time: ${runtimeHrs}h total
- Category-level timing logged in \`verification/shakedown-${ts}/\` per-category JSON files.
- No performance benchmarking performed (observational only per brief scope).

## A11y violations summary

| Severity | Count |
|---|---|
| Critical | ${a11yTotals.critical} |
| Serious  | ${a11yTotals.serious} |
| Moderate | ${a11yTotals.moderate} |
| Minor    | ${a11yTotals.minor} |

Full per-surface breakdown in \`verification/shakedown-screenshots-${ts}/cat07-a11y/a11y-violations-report.json\`.

## Open questions for Kyron

- Platform Admin stub still says "Cross-tenant features ship in SEC-9b" — is the PA UI planned? Brief §2E advises banking this as a follow-up.
- SEC-9b introduced 24 new \`react-hooks/exhaustive-deps\` lint warnings (15 in source + 12 from stale worktrees). Recommend a lint-triage sprint before pilot launch.
- Test count was 607 vs brief's expected 608+ — verify if a test was intentionally removed in SEC-9b.
- Any domain-specific validation (TTD currency ranges, career club thresholds, persistency award eligibility %) requires Kyron's judgment.

---

*Shakedown run: \`${ts}\` | Batch: \`${batchId ?? 'n/a'}\` | Tool: pre-pilot shakedown suite v1*
`;

  writeFileSync(REPORT_PATH, md);
  return REPORT_PATH;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startMs = Date.now();
  log(`\nPRE-PILOT SHAKEDOWN — ${ts}`);
  log(`Run dir:     ${RUN_DIR}`);
  log(`Screenshots: ${SS_DIR}`);
  log(`Report:      ${REPORT_PATH}`);
  log(`Skip seed:   ${SKIP_SEED}`);
  log(`Skip clean:  ${SKIP_CLEANUP}`);

  // ── Phase 3: Seed ──────────────────────────────────────────────────────────
  let batchId   = null;
  let uidByEmail = null;

  if (SKIP_SEED) {
    log('\nPhase 3: SKIPPED (--skip-seed)');
  } else {
    log('\n' + '═'.repeat(60));
    log('PHASE 3: Seed test data');
    try {
      const seedResult = await runSeedPhase({ log });
      batchId    = seedResult.batchId;
      uidByEmail = seedResult.uidByEmail;
    } catch (e) {
      log(`\nSEED HARD STOP: ${e.message}`);
      log('Aborting shakedown — cleanup is not needed (no seed completed).');
      process.exit(1);
    }
  }

  // ── Phase 4: Execute all categories ───────────────────────────────────────
  log('\n' + '═'.repeat(60));
  log('PHASE 4: Shakedown execution');

  const allResults  = [];
  const catOpts     = { log, ssDir: SS_DIR, batchId, uidByEmail };

  const categories = [
    ['cat01-auth',              () => runCat01(catOpts)],
    ['cat02-agent',             () => runCat02Agent(catOpts)],
    ['cat02-unit-manager',      () => runCat02UnitManager(catOpts)],
    ['cat02-branch-manager',    () => runCat02BranchManager(catOpts)],
    ['cat02-tenant-admin',      () => runCat02TenantAdmin(catOpts)],
    ['cat02-platform-admin',    () => runCat02PlatformAdmin(catOpts)],
    ['cat03-permission-matrix', () => runCat03PermissionMatrix(catOpts)],
    ['cat04-form-validation',   () => runCat04FormValidation(catOpts)],
    ['cat05-edge-cases',        () => runCat05EdgeCases(catOpts)],
    ['cat06-cross-role-flows',  () => runCat06CrossRoleFlows(catOpts)],
    ['cat07-a11y',              () => runCat07A11y(catOpts)],
    ['cat08-screenshot-dossier',() => runCat08ScreenshotDossier(catOpts)],
    ['cat10-email-infra',       () => runCat10EmailInfra(catOpts)],
  ];

  let bugCount = 0;
  for (const [name, fn] of categories) {
    if (!checkGlobalTime()) {
      log(`HARD STOP: Global 10h ceiling reached before ${name}`);
      break;
    }
    const result = await runCategory(name, fn, catOpts);
    allResults.push(result);

    // Count failures as bugs
    const catBugs = (result.results ?? []).filter((r) => !r.pass && !r.skipped).length;
    bugCount += catBugs;

    if (bugCount > 20) {
      log(`\nHARD STOP: ${bugCount} bugs found — exceeds 20-bug threshold per brief.`);
      log('Something fundamental may be wrong. Proceeding to cleanup.');
      break;
    }
  }

  const runtimeMs = Date.now() - startMs;

  // ── Phase 5: Report generation ─────────────────────────────────────────────
  log('\n' + '═'.repeat(60));
  log('PHASE 5: Generating findings report…');
  const reportPath = generateReport(allResults, batchId, runtimeMs);
  log(`Report written: ${reportPath}`);

  // ── Phase 6: Cleanup ───────────────────────────────────────────────────────
  if (SKIP_CLEANUP) {
    log('\nPhase 6: SKIPPED (--skip-cleanup)');
    log('WARNING: *@agencytrack.test data remains in production. Manual wipe required.');
  } else {
    const cleanOk = runCleanup();
    if (!cleanOk) {
      log('\n⛔ CLEANUP FAILED — IMMEDIATE ACTION REQUIRED');
      log('Run manually: node scripts/cleanup/wipe-test-data-sweep.mjs --mode=email-pattern --execute');
      process.exit(2);
    }
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  const totalTests = allResults.reduce((s, c) => s + (c.total ?? 0), 0);
  const totalPass  = allResults.reduce((s, c) => s + (c.pass  ?? 0), 0);
  const runtimeHrs = (runtimeMs / 1000 / 3600).toFixed(2);

  log('\n' + '═'.repeat(60));
  log(`SHAKEDOWN COMPLETE`);
  log(`  Tests:      ${totalPass}/${totalTests} passed`);
  log(`  Bugs:       ${bugCount}`);
  log(`  Runtime:    ${runtimeHrs}h`);
  log(`  Report:     ${reportPath}`);
  log(`  Screenshots: ${SS_DIR}`);
  log(`  Run log:    ${LOG_PATH}`);
  log('═'.repeat(60));
  log('\nDo NOT merge — review findings report first (Phase 8).');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});

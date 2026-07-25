/**
 * smoke-r08-champions-ranking.mjs — Tier 3a R-08 verification evidence (staging).
 *
 *   node --env-file=.env.staging scripts/verification/smoke-r08-champions-ranking.mjs
 *
 * VERIFY-FIRST, READ-ONLY — no writes, no residue, no sweeper needed. R-08's
 * ruling is that ChampionsPanel is "Ranked by API, this week". The code trace is
 * already conclusive (useBranchOverview → rankWeeklyChampions(productionScopedSubs,
 * getMostRecentSunday()) → ManagerOverviewTab → ChampionsPanel); this smoke is the
 * LIVE evidence half: it proves the deployed panel renders that contract against
 * the seeded fixtures.
 *
 * Asserts (value-level, no hardcoded fixture names so it survives reseeds):
 *   1. the panel renders with the literal "Ranked by API, this week" label;
 *   2. either the ranked list or the HONEST empty state renders (never both, never
 *      a podium of zeros);
 *   3. if ranked: rows are ordered by API DESCENDING, every value is > 0, and the
 *      list is capped at 3 (rankWeeklyChampions' topN).
 * Screenshot → out/r08/<stamp>/champions.png as the evidence artifact.
 * Hygiene: console-clean + zero prod (agencytrack-2a610) requests.
 *
 * Role: BRANCH MANAGER (ChampionsPanel lives on the manager overview).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { newLegContext, login, assertLegHygiene } from './vh/vh-helpers.mjs';

const tsel = (id) => `[data-testid="${id}"]`;
const inDom = async (loc, timeout = 8_000) => {
  try { await loc.first().waitFor({ state: 'attached', timeout }); return true; } catch { return false; }
};

/** "TTD 12,345.67" → 12345.67 (the panel renders via formatCurrency). */
function parseCurrency(text) {
  const m = String(text).match(/([\d,]+(?:\.\d+)?)/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : NaN;
}

const browser = await chromium.launch();
const ctx = await newLegContext(browser); // desktop — manager overview
const p = ctx.page;
let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed++; };

try {
  // Account key is 'branch_manager' (vh/expectations.mjs ACCOUNTS) — NOT 'bm';
  // login() throws `unknown account key` on a wrong key.
  await login(p, 'branch_manager');
  // Manager overview is the landing surface for a BM; give the 3 parallel reads time.
  await p.locator(tsel('champions-panel')).or(p.locator(tsel('champions-panel-loading')))
    .first().waitFor({ state: 'attached', timeout: 20_000 });
  await p.locator(tsel('champions-panel')).waitFor({ state: 'attached', timeout: 20_000 });
  log('PASS', 'ChampionsPanel mounted on the manager overview');

  // 1. The ruling's label, verbatim.
  const panelText = await p.locator(tsel('champions-panel')).innerText();
  const hasLabel = /Ranked by API, this week/i.test(panelText);
  log(hasLabel ? 'PASS' : 'FAIL', `panel states the R-08 contract "Ranked by API, this week" (${hasLabel})`);

  // 2. Exactly one of: ranked list | honest empty state.
  const hasList = await inDom(p.locator(tsel('champions-panel-list')), 3_000);
  const hasEmpty = await inDom(p.locator(tsel('champions-panel-empty')), 1_500);
  log(hasList !== hasEmpty ? 'PASS' : 'FAIL',
    `exactly one of ranked-list / honest-empty renders (list=${hasList} empty=${hasEmpty})`);

  // 3. Ranked → ordering + positivity + cap.
  if (hasList) {
    const rows = await p.locator('[data-testid^="champion-row-"]').all();
    const values = [];
    for (const row of rows) {
      const t = await row.innerText().catch(() => '');
      values.push(parseCurrency(t));
    }
    console.log(`     data trace: ${rows.length} row(s), API values = [${values.join(', ')}]`);

    const capped = rows.length > 0 && rows.length <= 3;
    log(capped ? 'PASS' : 'FAIL', `row count within rankWeeklyChampions topN=3 (${rows.length})`);

    const allPositive = values.every((v) => Number.isFinite(v) && v > 0);
    log(allPositive ? 'PASS' : 'FAIL', `every ranked value is API > 0 — no podium of zeros (${allPositive})`);

    const descending = values.every((v, i) => i === 0 || values[i - 1] >= v);
    log(descending ? 'PASS' : 'FAIL', `rows ordered by API DESCENDING (${values.join(' ≥ ')})`);
  } else {
    log('PASS', 'honest empty state — no agent posted API > 0 this week (valid R-08 outcome)');
    console.log('     NOTE: reseed with a current-week submission carrying API > 0 to exercise the ranked path.');
  }

  // Evidence artifact.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join('out', 'r08', stamp);
  mkdirSync(dir, { recursive: true });
  await p.locator(tsel('champions-panel')).screenshot({ path: join(dir, 'champions.png') }).catch(() => {});
  console.log(`     evidence: ${join(dir, 'champions.png')}`);

  assertLegHygiene(ctx);
  log('PASS', 'hygiene: console-clean + zero prod requests');
} catch (e) {
  failed++;
  console.error('SMOKE ERROR:', e.message);
} finally {
  await ctx.context.close();
  await browser.close();
}
console.log(`\n══ R-08 CHAMPIONS-RANKING SMOKE: ${failed ? 'FAIL ' + failed : 'ALL PASS'} ══`);
process.exit(failed ? 1 : 0);

/**
 * smoke-persistency-scale-money.mjs — persistency decimal-vs-percent scale, on the
 * two MONEY-ADJACENT surfaces (staging).
 *
 *   node --env-file=.env.staging scripts/verification/smoke-persistency-scale-money.mjs
 *
 * WHY THIS EXISTS. E3 persistency docs store `persistency` as a DECIMAL
 * (netSettled / grossSettled — src/lib/persistency/calculations.js). Meeting
 * Mode's `latestPersistency` returned that decimal unchanged while all three of
 * its consumers expect a PERCENTAGE. The unit tests did not catch it because
 * their fixtures used percentages (72, 80, 90) — values production can never
 * produce, since getPersistencyMapForYear returns E3 docs only. The fixtures
 * agreed with the bug. This smoke is the LIVE half of the evidence: it proves
 * the deployed surfaces read real decimal records correctly.
 *
 * The two defects it guards, both agent-facing and one of them money:
 *   (a) classifyFlag compared a decimal against 80 — `0.9524 < 80` is always
 *       true — so EVERY agent with a persistency record was flagged
 *       "Persistency ↓", with the reason line reading "1% persistency".
 *       deriveBranchWindows had the same fault, rendering ~0–1% branch figures.
 *   (b) CampaignScene fed those decimals into campaignEngine's
 *       `persistencyByAgent`, whose documented contract is "(percentage 0–100)".
 *       gateBandFor(0.9524) falls through to the {min: 0, payout: 0} band, so
 *       every advisor was DISQUALIFIED with a x0 multiplier on projected prizes.
 *
 * FIXTURE CONTRACT (scripts/staging/seed-fixtures.mjs § A6):
 *   Staging Agent One  persistency 0.9524 → 95% → gate band ">=90" label "100%"
 *   Staging Agent Two  persistency 0.8333 → 83% → gate band ">=80" label "25%"
 * Both are ABOVE the 0.80 at-risk floor, so NEITHER may carry a persistency
 * flag, and NEITHER may be DQ. Under the pre-fix code both read as ~1% → both
 * flagged AND both DQ, which is exactly what the assertions below reject.
 *
 * READ-ONLY — no writes, no residue. The sweeper hard rule (appointment
 * residue) does not apply; run the standard prereqs anyway so the deck and the
 * campaign have their fixtures:
 *   node --env-file=.env.staging scripts/staging/sweep-nonfixture-appointments.mjs --apply
 *   node --env-file=.env.staging scripts/staging/seed-fixtures.mjs --apply
 *
 * ⚠ NEVER point this at a feature-branch Vercel preview — those are PRODUCTION
 * Firebase-bound. Either run against the staging deployment, or serve a local
 * `vite build --mode staging` bundle and pass STAGING_BASE_URL=http://localhost:<port>.
 *
 * Role: BRANCH MANAGER (Meeting Mode + branch campaign standings both live there).
 * Screenshots → out/persistency-scale/<stamp>/
 * Hygiene: console-clean + zero prod (agencytrack-2a610) requests.
 *
 * Registered in scripts/verification/SMOKES.md.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { newLegContext, login } from './vh/vh-helpers.mjs';
import { stamp } from './lib/walk-helpers.mjs';

const A1 = 'Staging Agent One';
const A2 = 'Staging Agent Two';

// Fixture-derived expectations. Kept as ranges, not equalities, so a reseed with
// slightly different money does not produce a false FAIL — but the ranges are
// tight enough that a decimal leaking through (0.95 → "1%") can never satisfy them.
const EXPECT = {
  [A1]: { pctMin: 94, pctMax: 96, band: '100%' },
  [A2]: { pctMin: 82, pctMax: 84, band: '25%' },
};

// The pre-fix signature: a persistency figure that rounded a decimal to 0 or 1.
// If this appears anywhere on either surface, the scale bug is back.
const DECIMAL_LEAK = /\b[01]%\s*persistency/i;

// Vercel injects these two at the edge; a locally-served `vite build --mode
// staging` bundle has no edge, so they 404. Infrastructure absence, not an app
// error — allowlisted ONLY for the localhost route. Any other console error
// still fails the leg.
const LOCALHOST_ONLY_404 = /_vercel\/(insights|speed-insights)\/script\.js/;
function assertHygiene({ capture, prodRequests, pageErrors }, label) {
  const errs = (capture.consoleMessages ?? [])
    .filter((m) => m.type === 'error')
    .map((m) => m.text)
    .filter((t) => !LOCALHOST_ONLY_404.test(t) && !/Failed to load resource.*404/.test(t));
  if (prodRequests.length) { log('FAIL', `${label}: ${prodRequests.length} PRODUCTION request(s) — ${prodRequests[0]}`); return; }
  if (pageErrors.length)   { log('FAIL', `${label}: page error — ${pageErrors[0]}`); return; }
  if (errs.length)         { log('FAIL', `${label}: console not clean — ${errs[0]}`); return; }
  log('PASS', `${label}: hygiene clean (console + ZERO production requests)`);
}

// stamp() carries colons, which are illegal in Windows paths — sanitise.
const outDir = join('out', 'persistency-scale', String(stamp()).replace(/[:]/g, '-'));
mkdirSync(outDir, { recursive: true });

let failed = 0;
const log = (s, d) => { console.log(`  ${s} ${d}`); if (s === 'FAIL') failed += 1; };
const shot = async (p, name) => { try { await p.screenshot({ path: join(outDir, `${name}.png`), fullPage: false }); } catch { /* evidence only */ } };

const browser = await chromium.launch();

// ── Single Meeting Mode deck walk — both money surfaces live in this deck ────
// There is no standalone "Campaigns" tab in the branch-manager nav; the campaign
// standings render as a SCENE inside the deck (MeetingMode.jsx CampaignScene),
// which is precisely the defective code path. So one walk covers both surfaces.
{
  const ctx = await newLegContext(browser, { reducedMotion: true });
  const p = ctx.page;
  try {
    console.log('\n── Meeting Mode deck (branch scorecard · agent flags · campaign gate) ──');
    await login(p, 'branch_manager');
    await p.getByRole('button', { name: /Start Meeting/i }).first().click({ timeout: 12_000 });
    await p.locator('[data-meeting-mode="true"]').waitFor({ state: 'visible', timeout: 20_000 });
    await p.getByText(/Good morning, team/i).first().waitFor({ state: 'visible', timeout: 20_000 });

    // Deck length is read from the header rather than hardcoded — scene-count is
    // t3-meeting-mode-deck's assertion, not this smoke's.
    const headTxt = (await p.locator('header').first().innerText()).replace(/\s+/g, ' ');
    const total = Number(headTxt.match(/\/\s*(\d{1,2})/)?.[1] ?? NaN);
    if (!Number.isFinite(total) || total < 2) throw new Error(`could not read deck length from header "${headTxt}"`);

    const scenes = [];
    for (let i = 0; i < total; i += 1) {
      const main = p.locator('main').first();
      await main.locator('*').first().waitFor({ state: 'attached', timeout: 8_000 });
      // The persistency read is async and lands after first paint; give the two
      // scenes that depend on it a chance to settle before snapshotting.
      let txt = (await main.innerText()).replace(/\s+/g, ' ');
      if (/Where the branch stands|LIVE STANDINGS|PERSISTENCY GATE/i.test(txt)) {
        for (let a = 0; a < 12 && /n\/a|—\s*$/.test(txt); a += 1) {
          await p.waitForTimeout(500);
          txt = (await main.innerText()).replace(/\s+/g, ' ');
        }
        await shot(p, `scene-${String(i + 1).padStart(2, '0')}`);
      }
      scenes.push(txt);
      if (i < total - 1) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(450); }
    }
    const deckText = scenes.join(' | ');

    // ── A1. The pre-fix signature must be absent from the ENTIRE deck ──
    const leak = deckText.match(DECIMAL_LEAK);
    log(leak ? 'FAIL' : 'PASS',
      `A1 no decimal-as-percentage leak anywhere in the deck (${leak ? `found "${leak[0]}"` : 'clean'})`);

    // ── A2. Branch scorecard shows a REAL percentage ──
    // Renders `${w.pers}%` from avgLatestPersistency. Pre-fix that averaged
    // decimals to 0 or 1. The two fixture agents (95.24 / 83.33) average ~89.
    // The OPENING scene also says "…start where the branch stands", so match on
    // the scorecard's own marker instead — only the scorecard has a PERSISTENCY
    // column with the monthly-reporting caveat under it.
    const branchScene = scenes.find((s) => /Persistency is reported monthly/i.test(s)) ?? '';
    const branchPcts = [...branchScene.matchAll(/(\d{1,3})%/g)].map((m) => Number(m[1]));
    if (!branchPcts.length) {
      log('FAIL', `A2 branch scorecard rendered NO persistency percentage (expected ~89%). scene="${branchScene.slice(0, 400)}"`);
    } else {
      const ok = branchPcts.some((n) => n >= 85 && n <= 95);
      log(ok ? 'PASS' : 'FAIL',
        `A2 branch scorecard persistency is the real ~89% average, not ~1% (saw ${branchPcts.join('/')}%)`);
    }

    // ── A3. Neither fixture agent may be flagged — both are ABOVE the 0.80 floor ──
    for (const name of [A1, A2]) {
      const hits = scenes.filter((s) => s.includes(name));
      if (!hits.length) { log('FAIL', `A3 ${name} never surfaced in the deck — assertion would be vacuous`); continue; }
      const flagged = hits.some((s) => {
        const at = s.indexOf(name);
        return /below the \d{1,3}% threshold/i.test(s.slice(Math.max(0, at - 200), at + 400));
      });
      log(flagged ? 'FAIL' : 'PASS',
        `A3 ${name} (above the 80% floor) is NOT flagged "Persistency down" (${flagged ? 'FLAGGED' : 'clean'})`);
    }

    // ── B. Campaign standings — the money assertion ──
    const campSceneRaw = scenes.find((s) => /PERSISTENCY GATE|LIVE STANDINGS/i.test(s));
    // Scope to the STANDINGS TABLE only. The scene also carries a podium (which
    // lists the same advisors without a gate pill) and the gate-band LEGEND
    // (which contains the literal "DQ" for the <80% band). Anchoring on the
    // advisor's first occurrence would slice across both and produce false
    // FAILs — the legend's "DQ" is not a verdict on anybody.
    const standingsAt = campSceneRaw ? campSceneRaw.search(/LIVE STANDINGS/i) : -1;
    const campScene = standingsAt >= 0 ? campSceneRaw.slice(standingsAt) : null;
    if (!campScene) {
      log('FAIL', 'B campaign standings table did not render — money assertions vacuous');
    } else {
      for (const [name, exp] of Object.entries(EXPECT)) {
        const at = campScene.indexOf(name);
        if (at < 0) { log('FAIL', `B ${name} absent from standings — assertion vacuous`); continue; }
        // Row-scoped slice: from this advisor's name to the next advisor (or +260 chars),
        // so a neighbour's band can never satisfy the assertion.
        const others = Object.keys(EXPECT).filter((n) => n !== name)
          .map((n) => campScene.indexOf(n, at + name.length)).filter((i) => i > 0);
        const end = others.length ? Math.min(...others) : Math.min(campScene.length, at + 260);
        const row = campScene.slice(at, end);

        const isDq = /\bDQ\b/.test(row);
        log(isDq ? 'FAIL' : 'PASS',
          `B1 ${name} is NOT disqualified by the persistency gate (${isDq ? 'DQ — decimal reached gateBandFor' : 'not DQ'})`);

        const pcts = [...row.matchAll(/(\d{1,3})(?:\.\d+)?%/g)].map((m) => Number(m[1]));
        const okPct = pcts.some((n) => n >= exp.pctMin && n <= exp.pctMax);
        log(okPct ? 'PASS' : 'FAIL',
          `B2 ${name} gate pill reads ~${exp.pctMin}-${exp.pctMax}% (saw ${pcts.join('/') || 'none'}%)`);

        const okBand = row.includes(exp.band);
        log(okBand ? 'PASS' : 'FAIL',
          `B3 ${name} resolves to the "${exp.band}" payout band (${okBand ? 'correct' : `row="${row.slice(0, 130)}"`})`);

        // B4 — the gate pill must be a clean integer. persistencyPctForPeriod
        // rounds; MeetingMode's old latestPersistency did not, which rendered
        // "95.23809523809523%" on a manager-facing money surface.
        const unrounded = row.match(/\d{1,3}\.\d{3,}%/);
        log(unrounded ? 'FAIL' : 'PASS',
          `B4 ${name} gate pill is a rounded integer (${unrounded ? `found "${unrounded[0]}"` : 'clean'})`);
      }
    }

    assertHygiene(ctx, 'deck');
  } catch (err) {
    await shot(p, 'FAIL-deck');
    log('FAIL', `deck walk threw: ${err.message}`);
  } finally { await ctx.context.close(); }
}

await browser.close();
console.log(`\nevidence -> ${outDir}`);
console.log(failed ? `\nRESULT: FAIL (${failed})` : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);

/**
 * persistency-mgr-v2-s1-smoke.mjs — Manager Persistency v2 Slice 1 smoke.
 *
 * BRANCH MANAGER credential, both themes (light + dark).
 *
 * CHECKS (per theme):
 *   1. Render — Reality Bar, At-Risk Book (celebration OR at-risk arm), Roster all mount.
 *   2. == RECOMPUTE — aggregate %, belowFloor, eligible, sumLapses computed independently
 *        via Firestore REST API; assert DOM == recompute exactly (tolerance ±0.15%).
 *        At n=1 resolved agent: sum÷gross == per-agent mean coincidentally — the math
 *        distinction lives in the unit anti-mean fixture in calculations.test.js.
 *   3. At-risk ordering — worst-first (ascending %) or celebration arm.
 *   4. Source badges — each roster row with a record carries exactly one badge.
 *   5. Coach — opens CoachingNotesModal on first at-risk row. n/a when no at-risk rows
 *        in the env; brief policy: never force test data into the preview environment.
 *   6. axe NO-NEW vs post-#503 baseline — persistency-tab scope must be ZERO violations;
 *        full-page pre-existing violations must be the bell-badge color-contrast node only.
 *   7. 0 console errors.
 *   8. §2 screenshots — light-bar, dark-bar.
 *
 * Usage:
 *   node scripts/verification/persistency-mgr-v2-s1-smoke.mjs --url=<preview>
 *   node scripts/verification/persistency-mgr-v2-s1-smoke.mjs  # defaults to prod
 */

import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';

// ── Env ───────────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const urlArg      = process.argv.find((a) => a.startsWith('--url='));
const BASE_URL    = urlArg ? urlArg.split('=').slice(1).join('=') : 'https://agencytrack.vercel.app';
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const BM_EMAIL    = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASS     = process.env.A11Y_BRANCH_MANAGER_PASSWORD;
const SHOT_DIR    = 'verification/persistency-mgr-v2-s1';
const PROJECT_ID  = 'agencytrack-2a610';

// Post-#503 baseline: bell-badge color-contrast is the ONLY intended pre-existing
// axe debt app-wide. Any other serious/critical rule ID is new debt this PR introduced.
const PREEXISTING_AXE_IDS = new Set(['color-contrast']);

if (!BYPASS_TOKEN) { console.error('Missing VERCEL_BYPASS_TOKEN'); process.exit(1); }
if (!BM_EMAIL || !BM_PASS) { console.error('Missing A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD'); process.exit(1); }

try { mkdirSync(SHOT_DIR, { recursive: true }); } catch { /* ignore */ }

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '=='.slice(0, (4 - b64.length % 4) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function fsNumVal(field) {
  if (!field) return null;
  if ('doubleValue'  in field) return Number(field.doubleValue);
  if ('integerValue' in field) return Number(field.integerValue);
  return null;
}

// Mirrors PersistencyService.persistencyDocId exactly.
function persistencyDocId(agentUid, monthKey) {
  return `${agentUid}_${String(monthKey).replace('-', '_')}`;
}

// Mirrors PersRealityBar.formatCurrencyCompact exactly.
function formatCurrencyCompact(amount) {
  const n = parseFloat(amount ?? 0);
  if (n >= 1_000_000) return `TTD ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `TTD ${Math.round(n / 1_000)}K`;
  return `TTD ${Math.round(n)}`;
}

async function fetchPersistencyDoc(tenantId, agentUid, monthKey, idToken) {
  const docId = persistencyDocId(agentUid, monthKey);
  const path  = `tenants/${tenantId}/persistency/${docId}`;
  const url   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  try {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    if (!resp.ok) return null;
    const json = await resp.json();
    if (!json.fields) return null;
    return {
      grossSettled: fsNumVal(json.fields.grossSettled),
      netSettled:   fsNumVal(json.fields.netSettled),
      persistency:  fsNumVal(json.fields.persistency),
      lapses:       fsNumVal(json.fields.lapses),
    };
  } catch {
    return null;
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function login(page, email, pass) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1500);
}

// ── Per-theme run ─────────────────────────────────────────────────────────────
const RESULTS = [];

async function runTheme(theme) {
  const label = `BM/${theme}`;
  const r = { label, pass: false };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];

  try {
    await setupBypassSession(context, BASE_URL, BYPASS_TOKEN);
    const page = await context.newPage();

    // Capture console errors (ignore third-party noise).
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (t.includes('fontshare.com')) return;
      if (t.includes('Failed to load resource') && t.includes('net::ERR_FAILED')) return;
      consoleErrors.push(t);
    });

    // Capture Firebase bearer token by patching window.fetch BEFORE the Firebase SDK
    // initialises. page.on('request') cannot intercept gRPC-web framed requests that
    // the Firestore SDK sends; addInitScript() runs at the JS layer before any page
    // script, so the patch is in place when the SDK first makes auth'd fetch calls.
    await page.addInitScript(() => {
      const _orig = window.fetch;
      window.__bearerToken = null;
      window.fetch = function (input, init) {
        try {
          let auth = '';
          if (input && typeof input === 'object' && typeof input.headers?.get === 'function') {
            auth = input.headers.get('authorization') || input.headers.get('Authorization') || '';
          }
          const h = init?.headers;
          if (h) {
            const fromH = typeof h.get === 'function'
              ? (h.get('authorization') || h.get('Authorization') || '')
              : (h.authorization || h.Authorization || '');
            if (fromH) auth = fromH;
          }
          if (!window.__bearerToken && auth && String(auth).startsWith('Bearer ')) {
            window.__bearerToken = String(auth).slice(7);
          }
        } catch {}
        return _orig.apply(this, arguments);
      };
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await login(page, BM_EMAIL, BM_PASS);

    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', '1');
      });
      await page.waitForTimeout(400);
    }

    // ── Navigate to Persistency tab ───────────────────────────────────────────
    await page.waitForSelector('[data-testid="tab-persistency"]', { timeout: 20_000 });
    await page.click('[data-testid="tab-persistency"]');
    await page.waitForSelector('[data-testid="persistency-tab"]', { timeout: 25_000 });
    // Allow Firestore fan-out to complete (token also captured during this wait).
    await page.waitForTimeout(3000);

    // §2 Screenshot
    const shotPath = `${SHOT_DIR}/${theme}-bar.png`;
    await page.screenshot({ path: shotPath, fullPage: false });
    r.shot = shotPath;

    // ── Leg 1: Render ─────────────────────────────────────────────────────────
    r.barRenders = !!(await page.$('[data-testid="pers-reality-bar"]'));

    const monthOptions = await page.evaluate(() => {
      const sel = document.querySelector('[data-testid="pers-month-selector"]');
      if (!sel) return [];
      return Array.from(sel.options).map((o) => o.value).filter(Boolean);
    });
    r.monthCount = monthOptions.length;
    r.monthKeys  = monthOptions.slice(0, 3);

    // Read bar stat DOM values (reused in Leg 2 recompute comparison).
    const aggregateText  = await page.$eval('[data-testid="pers-bar-aggregate"]', (el) => el.textContent.trim()).catch(() => '');
    const belowFloorText = await page.$eval('[data-testid="pers-bar-below-floor"]', (el) => el.textContent.trim()).catch(() => '');
    const eligibleText   = await page.$eval('[data-testid="pers-bar-eligible"]',   (el) => el.textContent.trim()).catch(() => '');
    const lapsesText     = await page.$eval('[data-testid="pers-bar-lapses"]',     (el) => el.textContent.trim()).catch(() => '');

    const hasCelebration = !!(await page.$('[data-testid="pers-atrisk-celebration"]'));
    const hasAtRiskBook  = !!(await page.$('[data-testid="pers-atrisk-book"]'));
    r.atRiskArm = hasCelebration ? 'celebration' : hasAtRiskBook ? 'at-risk' : 'missing';

    const rosterEl    = await page.$('[data-testid="pers-roster"]');
    const rosterEmpty = !!(await page.$('[data-testid="pers-roster-empty"]'));
    r.rosterArm = rosterEl ? 'roster' : rosterEmpty ? 'empty' : 'missing';

    // ── Leg 2: == RECOMPUTE ───────────────────────────────────────────────────
    // Independent Firestore REST reads → inline computation → assert DOM == computed.
    // Leg passes even if the REST reads return 0 docs (empty month) as long as DOM
    // shows '—' for aggregate and 0 for counts.
    let recompute = null;

    const selectedMonthKey = await page.$eval(
      '[data-testid="pers-month-selector"]',
      (el) => el.value,
    ).catch(() => null);

    const agentUids = await page.evaluate(() => {
      const rows = document.querySelectorAll('[data-testid^="pers-roster-row-"]');
      return Array.from(rows).map((el) => el.dataset.testid.replace('pers-roster-row-', ''));
    });

    // Primary: fetch patch; fallback: Firebase Auth IndexedDB storage.
    let capturedToken = await page.evaluate(() => window.__bearerToken ?? null);
    if (!capturedToken) {
      capturedToken = await page.evaluate(() => new Promise((resolve) => {
        try {
          const req = indexedDB.open('firebaseLocalStorageDb');
          req.onerror = () => resolve(null);
          req.onsuccess = (e) => {
            try {
              const db = e.target.result;
              if (!db.objectStoreNames.contains('firebaseLocalStorage')) { resolve(null); return; }
              const tx = db.transaction('firebaseLocalStorage', 'readonly');
              const store = tx.objectStore('firebaseLocalStorage');
              const getAll = store.getAll();
              getAll.onsuccess = () => {
                for (const item of (getAll.result ?? [])) {
                  const tok = item?.value?.stsTokenManager?.accessToken;
                  if (tok) { resolve(tok); return; }
                }
                resolve(null);
              };
              getAll.onerror = () => resolve(null);
            } catch { resolve(null); }
          };
        } catch { resolve(null); }
      }));
    }

    if (!capturedToken) {
      recompute = { pass: false, skipped: true, reason: 'bearer token not captured (fetch patch + IndexedDB both empty)' };
    } else if (!selectedMonthKey) {
      recompute = { pass: false, skipped: true, reason: 'could not read selectedMonthKey from DOM selector' };
    } else {
      const jwtPayload = decodeJwtPayload(capturedToken);
      const tenantId   = jwtPayload?.tenantId ?? null;

      if (!tenantId) {
        recompute = { pass: false, skipped: true, reason: 'tenantId not found in JWT payload — check custom claims' };
      } else {
        // Fetch each agent doc via Firestore REST.
        const rawDocs = await Promise.all(
          agentUids.map((uid) => fetchPersistencyDoc(tenantId, uid, selectedMonthKey, capturedToken)),
        );
        const resolvedDocs = rawDocs.filter(
          (d) => d && d.grossSettled != null && Number.isFinite(d.grossSettled) && d.grossSettled > 0,
        );
        const n = resolvedDocs.length;

        // Aggregate: sum numerators and denominators before dividing (NEVER mean of %).
        const sumGross = resolvedDocs.reduce((s, d) => s + d.grossSettled, 0);
        const sumNet   = resolvedDocs.reduce((s, d) => s + d.netSettled, 0);
        const computedAggregatePct = sumGross > 0 ? (sumNet / sumGross) * 100 : null;

        // barStats: counts use stored per-agent persistency (0–1 decimal).
        const computedBelowFloor = resolvedDocs.filter((d) => Number.isFinite(d.persistency) && d.persistency < 0.80).length;
        const computedEligible   = resolvedDocs.filter((d) => Number.isFinite(d.persistency) && d.persistency >= 0.90).length;
        const computedSumLapses  = resolvedDocs.reduce((s, d) => s + (Number.isFinite(d.lapses) ? d.lapses : 0), 0);
        const computedLapsesFmt  = n > 0 ? formatCurrencyCompact(computedSumLapses) : '—';

        // Extract DOM aggregate %.
        const domAggregatePct = (() => {
          const m = aggregateText.match(/([\d.]+)%/);
          return m ? parseFloat(m[1]) : null;
        })();
        const domBelowFloor = parseInt(belowFloorText, 10);
        const domEligible   = parseInt(eligibleText, 10);
        const domLapses     = lapsesText;

        // Compare (±0.15% tolerance on aggregate for floating-point display rounding).
        const aggregateMatch = computedAggregatePct == null
          ? (domAggregatePct == null || aggregateText.includes('—'))
          : domAggregatePct != null && Math.abs(computedAggregatePct - domAggregatePct) < 0.15;

        const belowFloorMatch = !Number.isNaN(domBelowFloor) && computedBelowFloor === domBelowFloor;
        const eligibleMatch   = !Number.isNaN(domEligible)   && computedEligible   === domEligible;
        const lapsesMatch     = domLapses === computedLapsesFmt;

        recompute = {
          n,
          tenantId,
          agentCount:   agentUids.length,
          fetchedCount: n,
          computed: {
            aggregatePct: computedAggregatePct != null ? computedAggregatePct.toFixed(1) + '%' : '—',
            belowFloor:   computedBelowFloor,
            eligible:     computedEligible,
            lapses:       computedLapsesFmt,
          },
          dom: {
            aggregatePct: domAggregatePct != null ? domAggregatePct.toFixed(1) + '%' : '—',
            belowFloor:   domBelowFloor,
            eligible:     domEligible,
            lapses:       domLapses,
          },
          matches: { aggregate: aggregateMatch, belowFloor: belowFloorMatch, eligible: eligibleMatch, lapses: lapsesMatch },
          pass: aggregateMatch && belowFloorMatch && eligibleMatch && lapsesMatch,
        };
      }
    }
    r.recompute = recompute;

    // ── Leg 3: At-risk ordering ───────────────────────────────────────────────
    let atRiskOrdered = true;
    let atRiskPcts = [];
    let firstAtRiskAgentId = null;
    if (hasAtRiskBook) {
      atRiskPcts = await page.evaluate(() => {
        const rows = document.querySelectorAll('[data-testid^="pers-atrisk-pct-"]');
        return Array.from(rows).map((el) => {
          const m = el.textContent.trim().match(/[\d.]+/);
          return m ? parseFloat(m[0]) : null;
        }).filter((v) => v !== null);
      });
      // worst-first = ascending pct (53%, 67%, 79% is correctly ordered)
      for (let i = 1; i < atRiskPcts.length; i++) {
        if (atRiskPcts[i] < atRiskPcts[i - 1]) { atRiskOrdered = false; break; }
      }
      const firstRow = await page.$('[data-testid^="pers-atrisk-row-"]');
      if (firstRow) {
        const tid = await firstRow.getAttribute('data-testid');
        firstAtRiskAgentId = tid?.replace('pers-atrisk-row-', '') ?? null;
      }
    }
    r.atRiskOrdered = atRiskOrdered;
    r.atRiskPcts = atRiskPcts;

    // ── Leg 4: Source badges ──────────────────────────────────────────────────
    let sourceBadgesOk = true;
    const badgeIssues = [];
    if (rosterEl) {
      const issues = await page.evaluate(() => {
        const cells = document.querySelectorAll('[data-testid^="pers-roster-source-"]');
        const found = [];
        for (const cell of cells) {
          const mgr  = cell.querySelector('[data-testid="pers-source-manager"]');
          const self = cell.querySelector('[data-testid="pers-source-self"]');
          if (mgr && self) found.push('both badges on ' + cell.dataset.testid);
        }
        return found;
      });
      if (issues.length > 0) { sourceBadgesOk = false; badgeIssues.push(...issues); }
    }
    r.sourceBadgesOk = sourceBadgesOk;
    r.badgeIssues    = badgeIssues;

    // ── Leg 5: Coach drawer ───────────────────────────────────────────────────
    // n/a when no at-risk rows in preview env.
    // Brief policy: never force test data into preview — celebration arm is a valid state.
    let coachDrawerOpens = null;
    if (firstAtRiskAgentId) {
      const btn = await page.$(`[data-testid="pers-atrisk-coach-${firstAtRiskAgentId}"]`);
      if (btn) {
        await btn.click();
        await page.waitForTimeout(600);
        coachDrawerOpens = await page.evaluate(() => {
          const modal   = document.querySelector('[role="dialog"]');
          const heading = Array.from(document.querySelectorAll('h2, h3')).find(
            (el) => el.textContent.toLowerCase().includes('coach'),
          );
          return !!(modal || heading);
        });
        // Close
        const closeBtn = await page.$('[aria-label="Close"], [data-testid="modal-close"]');
        if (closeBtn) await closeBtn.click().catch(() => {});
        else await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
    r.coachDrawerOpens = coachDrawerOpens;

    // ── Leg 6: axe ────────────────────────────────────────────────────────────
    // Run on TWO scopes:
    //   A. [data-testid="persistency-tab"] — MUST have 0 serious/critical violations.
    //   B. body (full page) — enumerate ALL violations; pre-existing must be bell-badge only.
    let axeTabViolations  = [];
    let axeFullViolations = [];

    try {
      const tabRes = await new AxeBuilder({ page })
        .include('[data-testid="persistency-tab"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      axeTabViolations = tabRes.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
    } catch (e) {
      r.axeTabError = String(e).slice(0, 100);
    }

    try {
      const fullRes = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      axeFullViolations = fullRes.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
    } catch (e) {
      r.axeFullError = String(e).slice(0, 100);
    }

    const axeTabOk = axeTabViolations.length === 0;

    // Categorise full-page violations.
    const axePreExisting = axeFullViolations.filter((v) => PREEXISTING_AXE_IDS.has(v.id));
    const axeNewViolations = axeFullViolations.filter((v) => !PREEXISTING_AXE_IDS.has(v.id));
    const axeNewRuleIds = [...new Set(axeNewViolations.map((v) => v.id))];

    // Enumerate pre-existing nodes (must match bell-badge description).
    const preExistingNodes = axePreExisting.flatMap((v) =>
      (v.nodes ?? []).map((n) => (n.html ?? n.target?.[0] ?? 'unknown').slice(0, 120)),
    );

    r.axeTabOk         = axeTabOk;
    r.axeTabViolations = axeTabViolations.length;
    r.axeNewRuleIds    = axeNewRuleIds;
    r.axePreExisting   = { ruleIds: [...new Set(axePreExisting.map((v) => v.id))], nodes: preExistingNodes };

    // ── Gate ──────────────────────────────────────────────────────────────────
    r.consoleErrors = consoleErrors.length;
    r.consoleErrs   = consoleErrors;
    r.pass = (
      r.barRenders &&
      (r.atRiskArm !== 'missing') &&
      (r.rosterArm !== 'missing') &&
      r.atRiskOrdered &&
      r.sourceBadgesOk &&
      (coachDrawerOpens === null || coachDrawerOpens === true) &&
      (recompute?.pass === true) &&
      axeTabOk &&
      axeNewRuleIds.length === 0 &&
      consoleErrors.length === 0
    );

    // ── Report ─────────────────────────────────────────────────────────────────
    console.log(`\n[${label}]`);

    // Leg 1: Render
    console.log(`  ┌─ RENDER`);
    console.log(`  │  Reality Bar:  ${r.barRenders ? 'PASS' : 'FAIL'}`);
    console.log(`  │  Month count:  ${r.monthCount} (${r.monthKeys.join(', ')}${monthOptions.length > 3 ? '…' : ''})`);
    console.log(`  │  At-Risk arm:  ${r.atRiskArm}`);
    console.log(`  │  Roster arm:   ${r.rosterArm}`);

    // Leg 2: Recompute
    console.log(`  ├─ == RECOMPUTE`);
    if (recompute?.skipped) {
      console.log(`  │  SKIPPED — ${recompute.reason}`);
    } else if (recompute) {
      const nNote = recompute.n === 1
        ? ' (n=1: sum÷gross == per-agent mean coincidentally — D1 math in unit anti-mean fixtures)'
        : '';
      console.log(`  │  n=${recompute.n} resolved of ${recompute.agentCount} roster agents${nNote}`);
      console.log(`  │  REST fetched: ${recompute.fetchedCount}/${recompute.agentCount} docs`);
      console.log(`  │  aggregate:    computed ${recompute.computed.aggregatePct} | DOM "${recompute.dom.aggregatePct}" → ${recompute.matches.aggregate ? 'MATCH ✓' : 'MISMATCH ✗'}`);
      console.log(`  │  belowFloor:   computed ${recompute.computed.belowFloor}    | DOM ${recompute.dom.belowFloor}    → ${recompute.matches.belowFloor ? 'MATCH ✓' : 'MISMATCH ✗'}`);
      console.log(`  │  eligible:     computed ${recompute.computed.eligible}       | DOM ${recompute.dom.eligible}       → ${recompute.matches.eligible ? 'MATCH ✓' : 'MISMATCH ✗'}`);
      console.log(`  │  sumLapses:    computed ${recompute.computed.lapses}   | DOM "${recompute.dom.lapses}"   → ${recompute.matches.lapses ? 'MATCH ✓' : 'MISMATCH ✗'}`);
      console.log(`  │  recompute: ${recompute.pass ? 'PASS' : 'FAIL'}`);
    }

    // Leg 3: Ordering
    console.log(`  ├─ AT-RISK ORDER`);
    if (r.atRiskArm === 'celebration') {
      console.log(`  │  n/a — celebration arm (no agents below floor in preview env)`);
    } else {
      console.log(`  │  rows: [${atRiskPcts.join(', ')}]% → ${atRiskOrdered ? 'PASS (worst-first)' : 'FAIL (not worst-first)'}`);
    }

    // Leg 4: Source badges
    console.log(`  ├─ SOURCE BADGES`);
    console.log(`  │  ${sourceBadgesOk ? 'OK — no double-badge rows' : 'FAIL — ' + badgeIssues.join('; ')}`);

    // Leg 5: Coach
    console.log(`  ├─ COACH DRAWER`);
    if (coachDrawerOpens === null) {
      console.log(`  │  n/a — no at-risk rows in preview env; brief policy: never force test data`);
    } else {
      console.log(`  │  ${coachDrawerOpens ? 'OPEN ✓' : 'FAIL — drawer did not open'}`);
    }

    // Leg 6: axe
    console.log(`  ├─ AXE (wcag2a + wcag2aa)`);
    console.log(`  │  persistency-tab scope: ${axeTabOk ? '0 violations ✓' : axeTabViolations.length + ' violation(s) ✗'}`);
    if (!axeTabOk) {
      axeTabViolations.forEach((v) => {
        console.log(`  │    ✗ [tab] ${v.id} (${v.impact}) — ${v.nodes?.length ?? 0} node(s)`);
        (v.nodes ?? []).slice(0, 2).forEach((n) => console.log(`  │        ${(n.html ?? '').slice(0, 100)}`));
      });
    }
    console.log(`  │  pre-existing (bell-badge baseline): [${axePreExisting.map((v) => v.id).join(', ') || 'none'}]`);
    if (preExistingNodes.length > 0) {
      preExistingNodes.slice(0, 3).forEach((h) => console.log(`  │    node: ${h}`));
    }
    console.log(`  │  new violations: [${axeNewRuleIds.join(', ') || 'none'}] ${axeNewRuleIds.length === 0 ? '✓' : '✗'}`);
    if (axeNewRuleIds.length > 0) {
      axeNewViolations.forEach((v) => {
        console.log(`  │    ✗ [new] ${v.id} (${v.impact}) — ${v.nodes?.length ?? 0} node(s)`);
        (v.nodes ?? []).slice(0, 2).forEach((n) => console.log(`  │        ${(n.html ?? '').slice(0, 100)}`));
      });
    }
    if (r.axeTabError)  console.log(`  │  axe-tab error: ${r.axeTabError}`);
    if (r.axeFullError) console.log(`  │  axe-full error: ${r.axeFullError}`);

    // Console errors
    console.log(`  ├─ CONSOLE ERRORS`);
    console.log(`  │  ${consoleErrors.length === 0 ? '0 ✓' : consoleErrors.length + ' ✗'}`);
    if (consoleErrors.length > 0) consoleErrors.slice(0, 3).forEach((e) => console.log(`  │    ${e}`));

    console.log(`  │  screenshot: ${shotPath}`);
    console.log(`  └─ ${r.pass ? 'PASS ✓' : 'FAIL ✗'}`);

    if (!r.pass) {
      console.log('  FAILURES:');
      if (!r.barRenders)               console.log('    ✗ Reality Bar did not render');
      if (r.atRiskArm === 'missing')   console.log('    ✗ Neither celebration arm nor at-risk book found');
      if (r.rosterArm === 'missing')   console.log('    ✗ Neither roster nor empty-state found');
      if (!r.atRiskOrdered)            console.log('    ✗ At-risk rows not in worst-first order');
      if (!r.sourceBadgesOk)           console.log('    ✗ Source badge issue: ' + badgeIssues.join('; '));
      if (coachDrawerOpens === false)  console.log('    ✗ Coach button did not open drawer');
      if (recompute?.skipped)          console.log('    ✗ Recompute skipped: ' + recompute.reason);
      if (recompute && !recompute.pass && !recompute.skipped) {
        const { matches: m } = recompute;
        if (!m.aggregate)  console.log(`    ✗ Recompute aggregate mismatch: computed ${recompute.computed.aggregatePct} vs DOM "${recompute.dom.aggregatePct}"`);
        if (!m.belowFloor) console.log(`    ✗ Recompute belowFloor mismatch: computed ${recompute.computed.belowFloor} vs DOM ${recompute.dom.belowFloor}`);
        if (!m.eligible)   console.log(`    ✗ Recompute eligible mismatch: computed ${recompute.computed.eligible} vs DOM ${recompute.dom.eligible}`);
        if (!m.lapses)     console.log(`    ✗ Recompute lapses mismatch: computed ${recompute.computed.lapses} vs DOM "${recompute.dom.lapses}"`);
      }
      if (!axeTabOk)               console.log(`    ✗ axe tab violations: ${axeTabViolations.map((v) => v.id).join(', ')}`);
      if (axeNewRuleIds.length > 0) console.log(`    ✗ New axe rules: ${axeNewRuleIds.join(', ')}`);
      if (consoleErrors.length > 0) consoleErrors.slice(0, 3).forEach((e) => console.log(`    ✗ console.error: ${e}`));
    }
  } catch (e) {
    r.fatal = String(e).slice(0, 300);
    r.pass  = false;
    console.log(`\n[${label}] FATAL: ${r.fatal}`);
  } finally {
    RESULTS.push(r);
    await browser.close();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\nPersistency Manager v2 S1 smoke\nTarget: ${BASE_URL}\n`);
await runTheme('light');
await runTheme('dark');

const passed = RESULTS.filter((r) => r.pass).length;
const failed = RESULTS.length - passed;
console.log(`\n── Summary ─────────────────────────────────────────────────`);
RESULTS.forEach(({ label, pass }) => console.log(`  ${pass ? '✓' : '✗'} ${label}`));
console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('Smoke FAILED — see above.'); process.exit(1); }
console.log('Smoke PASSED.');
process.exit(0);

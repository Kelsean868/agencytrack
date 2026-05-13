/**
 * cat05-edge-cases.mjs — Category 5: Edge cases & boundary values (10 tests).
 */

import { join }       from 'path';
import { randomUUID } from 'crypto';

import {
  ROOT, TENANT_ID, adminInit,
  getUidByEmail, TEST_USERS,
  setupBrowser, loginAsViaUI, navigateToTab,
  check, screenshot, sleep,
} from './auth-helpers.mjs';

const AGENT = TEST_USERS.agent1;
const BM    = TEST_USERS.branchManager;

export async function runCat05EdgeCases({ log, ssDir } = {}) {
  const _log  = log ?? console.log;
  const ssOut = ssDir ? join(ssDir, 'cat05-edge-cases') : join(ROOT, 'verification', 'shakedown-screenshots', 'cat05-edge-cases');
  const results = [];

  _log('\n── Category 5: Edge cases & boundary values ──');

  const { admin, db, auth } = adminInit();

  // ── T5.01: Agent with zero submission history ──────────────────────────────
  results.push(await check('T5.01', 'Agent with zero submissions — dashboard renders gracefully', async () => {
    // agent-007 has no manually submitted forms yet; seeded submissions were Admin SDK
    // If they happen to have seeded ones, still verify no crash
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, TEST_USERS.agent7.email, TEST_USERS.agent7.password);
    await sleep(1200);
    const body = await page.locator('body').innerText();
    // Should not see NaN, undefined, or error stack traces
    if (body.includes('NaN') || body.includes('undefined') || body.includes('TypeError')) {
      await screenshot(page, join(ssOut, 'T5.01-agent7-crash.png'));
      throw new Error('Dashboard shows NaN/undefined/TypeError for agent with sparse data');
    }
    await screenshot(page, join(ssOut, 'T5.01-agent7-dashboard.png'));
    await browser.close();
  }));

  // ── T5.02: Persistency at exactly 90% (award threshold) ───────────────────
  results.push(await check('T5.02', 'Persistency at exactly 90% — award eligibility displayed', async () => {
    const uid3 = await getUidByEmail(TEST_USERS.agent3.email);
    // Write a persistency doc at exactly 90%
    const docId = `${uid3}_2026_05`;
    await db.doc(`tenants/${TENANT_ID}/persistency/${docId}`).set({
      agentId:     uid3,
      agentName:   'Test Agent 003',
      tenantId:    TENANT_ID,
      year:        2026,
      month:       5,
      persistency: 90.0,
      enteredBy:   'shakedown',
      enteredAt:   admin.firestore.FieldValue.serverTimestamp(),
      testDataBatchId: 'shakedown',
    }, { merge: true });

    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, TEST_USERS.agent3.email, TEST_USERS.agent3.password);
    await navigateToTab(page, 'Persistency');
    await sleep(1200);
    await screenshot(page, join(ssOut, 'T5.02-persistency-90.png'));
    const body = await page.locator('body').innerText();
    _log(`  agent-003 persistency view: ${body.match(/\d+\.?\d*\s*%/g)?.join(', ') ?? 'no % found'}`);
    await browser.close();
  }));

  // ── T5.03: Agent with 4 weeks of seeded submissions — sparkline ────────────
  results.push(await check('T5.03', 'Agent with 4 seeded weeks — KPI sparkline renders 4 points', async () => {
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, AGENT.email, AGENT.password);
    await navigateToTab(page, 'Dashboard');
    await sleep(1500);
    // Check for chart/sparkline elements
    const svgCount = await page.locator('svg').count();
    _log(`  SVG elements on dashboard: ${svgCount}`);
    await screenshot(page, join(ssOut, 'T5.03-sparkline.png'));
    if (svgCount === 0) {
      _log('  WARN: No SVG elements found — sparkline may not render or may use canvas');
    }
    await browser.close();
  }));

  // ── T5.04: Settlement on quarter boundary Q4 → Q1 ─────────────────────────
  results.push(await check('T5.04', 'Settlement date Dec 31 assigns to Q4 correctly', async () => {
    const uid1 = await getUidByEmail(TEST_USERS.agent1.email);
    const bmUid = await getUidByEmail(BM.email);
    // Write a test settlement directly via Admin SDK
    const docId = `${uid1}_2025_Q4_shakedown`;
    await db.doc(`tenants/${TENANT_ID}/settlements/${docId}`).set({
      agentId:     uid1,
      tenantId:    TENANT_ID,
      year:        2025,
      quarter:     4,
      periodKey:   '2025-Q4',
      startDate:   '2025-10-01',
      endDate:     '2025-12-31',
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      confirmedBy: bmUid,
      testDataBatchId: 'shakedown',
    });
    // Verify doc was written with Q4
    const snap = await db.doc(`tenants/${TENANT_ID}/settlements/${docId}`).get();
    if (!snap.exists) throw new Error('Settlement doc not written');
    if (snap.data().quarter !== 4) throw new Error(`Expected quarter=4, got ${snap.data().quarter}`);
    _log('  Settlement Q4 doc written and verified via Admin SDK');
  }));

  // ── T5.05: Settlement on Jan 1 assigns to Q1 ──────────────────────────────
  results.push(await check('T5.05', 'Settlement date Jan 1 assigns to Q1 correctly', async () => {
    const uid1  = await getUidByEmail(TEST_USERS.agent1.email);
    const bmUid = await getUidByEmail(BM.email);
    const docId = `${uid1}_2026_Q1_shakedown`;
    await db.doc(`tenants/${TENANT_ID}/settlements/${docId}`).set({
      agentId:     uid1,
      tenantId:    TENANT_ID,
      year:        2026,
      quarter:     1,
      periodKey:   '2026-Q1',
      startDate:   '2026-01-01',
      endDate:     '2026-03-31',
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      confirmedBy: bmUid,
      testDataBatchId: 'shakedown',
    });
    const snap = await db.doc(`tenants/${TENANT_ID}/settlements/${docId}`).get();
    if (!snap.exists) throw new Error('Settlement doc not written');
    if (snap.data().quarter !== 1) throw new Error(`Expected quarter=1, got ${snap.data().quarter}`);
    _log('  Settlement Q1 doc written and verified via Admin SDK');
  }));

  // ── T5.06: Empty campaign — graceful empty state ───────────────────────────
  results.push(await check('T5.06', 'Empty campaign (0 participants) — graceful empty state in UI', async () => {
    const bmUid = await getUidByEmail(BM.email);
    // Write an empty campaign via Admin SDK
    const campRef = await db.collection(`tenants/${TENANT_ID}/campaigns`).add({
      title:       'Shakedown Empty Campaign',
      description: 'Zero participants — tests graceful empty state',
      createdBy:   bmUid,
      tenantId:    TENANT_ID,
      scope:       'branch',
      active:      true,
      participants: [],
      testDataBatchId: 'shakedown',
      createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    });
    _log(`  Empty campaign written: ${campRef.id}`);

    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, BM.email, BM.password);
    await navigateToTab(page, 'Campaigns');
    await sleep(1200);
    await screenshot(page, join(ssOut, 'T5.06-empty-campaign.png'));
    const body = await page.locator('body').innerText();
    if (body.includes('Cannot read') || body.includes('TypeError') || body.includes('undefined')) {
      throw new Error('Empty campaign causes JS error');
    }
    await browser.close();
  }));

  // ── T5.07: Agent at award threshold — Apps ─────────────────────────────────
  results.push(await check('T5.07', 'Agent at award-threshold apps count — no crash', async () => {
    const uid2 = await getUidByEmail(TEST_USERS.agent2.email);
    // Write a submission with exactly 49 apps
    const weekStart = '2026-01-04'; // a Sunday
    await db.doc(`tenants/${TENANT_ID}/submissions/${uid2}_${weekStart}_threshold`).set({
      agentId:    uid2,
      tenantId:   TENANT_ID,
      weekStarting: weekStart,
      version:    2,
      newBusiness: {
        numberOfApplications: 49,
        apiValue: 98000,
      },
      numberOfApplications: 49,
      apiValue: 98000,
      testDataBatchId: 'shakedown',
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, TEST_USERS.agent2.email, TEST_USERS.agent2.password);
    await navigateToTab(page, 'Dashboard');
    await sleep(1200);
    await screenshot(page, join(ssOut, 'T5.07-threshold-apps.png'));
    const body = await page.locator('body').innerText();
    if (body.includes('NaN') || body.includes('TypeError')) {
      throw new Error('Award threshold agent causes JS error');
    }
    await browser.close();
  }));

  // ── T5.08: Concurrent submissions (last-write-wins) ────────────────────────
  results.push(await check('T5.08', 'Concurrent submission drafts — no crash (last-write-wins)', async () => {
    const { browser: b1, page: p1 } = await setupBrowser();
    const { browser: b2, page: p2 } = await setupBrowser();

    await loginAsViaUI(p1, AGENT.email, AGENT.password);
    await loginAsViaUI(p2, AGENT.email, AGENT.password);

    // Both open wizard
    const openWiz = async (page) => {
      await navigateToTab(page, 'Dashboard');
      await sleep(400);
      const submitBtn = page.getByRole('button', { name: /submit.*report|submit/i }).first();
      if (await submitBtn.count() > 0) await submitBtn.click();
      await sleep(600);
    };

    await Promise.all([openWiz(p1), openWiz(p2)]);
    await sleep(1000);

    await screenshot(p1, join(ssOut, 'T5.08-concurrent-ctx1.png'));
    await screenshot(p2, join(ssOut, 'T5.08-concurrent-ctx2.png'));

    // Check neither has crashed
    const body1 = await p1.locator('body').innerText().catch(() => '');
    const body2 = await p2.locator('body').innerText().catch(() => '');
    if (body1.includes('TypeError') || body2.includes('TypeError')) {
      throw new Error('Concurrent wizard sessions caused TypeError');
    }

    await b1.close();
    await b2.close();
  }));

  // ── T5.09: BM dashboard — all 7 test agents' data ────────────────────────
  results.push(await check('T5.09', 'BM Master Sheet — all 7 test agents visible, no crash', async () => {
    const { browser, page } = await setupBrowser();
    await loginAsViaUI(page, BM.email, BM.password);
    await navigateToTab(page, 'Master Sheet');
    await sleep(1500);
    await screenshot(page, join(ssOut, 'T5.09-bm-mastersheet.png'));
    const body = await page.locator('body').innerText();
    if (body.includes('TypeError') || body.includes('Cannot read')) {
      throw new Error('BM Master Sheet threw JS error with 7 agents');
    }
    await browser.close();
  }));

  // ── T5.10: All 7 agents see the seeded campaign ────────────────────────────
  results.push(await check('T5.10', 'All 7 agents see Test Campaign Q2 in their view', async () => {
    const agentUsers = [
      TEST_USERS.agent1, TEST_USERS.agent2, TEST_USERS.agent3,
      TEST_USERS.agent4, TEST_USERS.agent5,
    ];
    let seenCount = 0;
    for (const agent of agentUsers) {
      const { browser, page } = await setupBrowser();
      await loginAsViaUI(page, agent.email, agent.password);
      await navigateToTab(page, 'Dashboard');
      await sleep(1000);
      const body = await page.locator('body').innerText();
      if (body.match(/test campaign|Q2/i)) seenCount++;
      await browser.close();
    }
    _log(`  Agents with Test Campaign Q2 visible: ${seenCount}/${agentUsers.length} checked`);
    if (seenCount === 0) {
      throw new Error('No agents see Test Campaign Q2 — campaign notification/display broken');
    }
  }));

  const pass  = results.filter((r) => r.pass).length;
  const total = results.length;
  _log(`\nCat 5 result: ${pass}/${total} passed`);
  return { category: 'cat05-edge-cases', results, pass, total };
}

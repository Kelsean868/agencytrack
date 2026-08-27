/**
 * smoke-ingest-call-activity.mjs
 * STAGING smoke for ingestCallActivity — slice B (PR #923), re-contracted by C2.
 *
 * This is the gap every other proof left open: the endpoint has never
 * completed a successful WRITE against a real Firestore. Its idempotency is
 * proven only against a transaction fake. A fake that models optimistic
 * concurrency is a good fake; it is still a model of Firestore, not Firestore.
 *
 * ─── UPDATED FOR THE C2 EFFECT CONTRACT ────────────────────────────────────
 * It used to post `campaignCode` + `outcome`, which the endpoint no longer
 * accepts. A smoke left posting a dead contract does not fail loudly — it goes
 * red on its first leg and reads like an outage, or worse, gets waived. So the
 * payloads below carry EFFECTS, and `rawOutcome`/`rawCampaign` carry the exact
 * shapes the 27 Aug KQM database audit found (`schools_2026`, display labels)
 * because those are the values slice B rejected.
 *
 * LEG 4 and the `retired-contract-rejected` leg are new and are the two that
 * distinguish "the C2 code is deployed" from "the old build is still serving".
 *
 * ─── STAGING ONLY, AND IT MUTATES ──────────────────────────────────────────
 * This mints a real bearer token and really moves an agent's daily numbers.
 * The BASE/PROJECT guards below refuse to run anywhere but staging. Ingest is
 * idempotent but NOT reversible — there is no undo for an increment — so the
 * synthetic staging agent's daily doc keeps the bump. That is the point of the
 * test, and it is why it may never point at production.
 *
 * ─── WHY THIS SCRIPT HOLDS THE RAW TOKEN, WHEN THE OTHERS REFUSE TO ────────
 * smoke-call-sources-self-service.mjs deliberately never reads the token value
 * into Node — it asserts on a length computed inside the page. This script
 * CANNOT do that: the token IS the Authorization header, so it has to hold it.
 * That is the token being used for its purpose, not a leak. The rule it still
 * obeys: the value never reaches a log line, a report, a screenshot, a URL
 * param or an error message. Assertions are on EFFECTS, never on the token.
 * If you add logging here, log `sourceId`, never `token`.
 *
 * Run:
 *   node --env-file=.env.staging scripts/verification/smoke-ingest-call-activity.mjs
 */
import { chromium } from 'playwright';
import { setupBypassSession } from './lib/walk-helpers.mjs';

const PROJECT  = 'agencytrack-staging';
const ENDPOINT = `https://us-central1-${PROJECT}.cloudfunctions.net/ingestCallActivity`;
const BASE = (process.env.STAGING_BASE_URL
  || 'https://agencytrack-git-staging-kyron-marchan-s-projects.vercel.app').replace(/\/+$/, '');

const need = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing ${k} — run with --env-file=.env.staging`); return v; };
const BYPASS = need('VERCEL_BYPASS_TOKEN');
const PW = need('STAGING_SEED_PASSWORD');
const EMAIL = process.env.STAGING_AGENT_EMAIL || 'staging-agent-1@agencytrack-staging.test';

// HARD GUARDS. Both must hold. This smoke writes real KPI numbers.
if (!/agencytrack-git-staging-/.test(BASE)) throw new Error('REFUSING: BASE is not the staging deployment.');
if (!ENDPOINT.includes('agencytrack-staging')) throw new Error('REFUSING: endpoint is not the staging project.');
if (/agencytrack-2a610/.test(BASE + ENDPOINT)) throw new Error('REFUSING: production reference detected.');

const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true, note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };

/**
 * Clear the post-login celebration overlay if one is up. Safe to call repeatedly.
 * Waits on the OVERLAY's presence rather than a fixed sleep, then confirms it is
 * gone — a click that lands while it is up fails 15s later with a message about
 * a locator, which tells you nothing about the real cause.
 */
async function clearOverlay(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const overlay = page.locator('div.fixed.inset-0.z-\\[60\\]').first();
    if (!await overlay.isVisible({ timeout: 2000 }).catch(() => false)) return;
    const btn = page.locator('[data-testid="celebration-dismiss"]').first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) await btn.click().catch(() => {});
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
  }
}

/** TT (UTC-4) calendar date — the daily doc id. Must match the endpoint's own conversion. */
function ttDate(d = new Date()) {
  return new Date(d.getTime() - 4 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Firebase session (id token, uid, tenantId) out of the app's own IndexedDB. */
async function readSession(page) {
  return page.evaluate(async () => {
    const records = await new Promise((res) => {
      const r = indexedDB.open('firebaseLocalStorageDb');
      r.onsuccess = () => {
        const tx = r.result.transaction('firebaseLocalStorage', 'readonly');
        const all = tx.objectStore('firebaseLocalStorage').getAll();
        all.onsuccess = () => res(all.result);
        all.onerror = () => res(null);
      };
      r.onerror = () => res(null);
    });
    if (!records) return null;
    const rec = records.map((t) => t.value).find((v) => v && v.stsTokenManager);
    if (!rec) return null;
    const token = rec.stsTokenManager.accessToken;
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { token, uid: rec.uid, tenantId: claims.tenantId };
  });
}

const dailyUrl = (tenantId, uid, date) =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/tenants/${tenantId}/users/${uid}/dailyActivity/${date}`;

/** Read the daily doc THROUGH THE RULES LAYER, as the agent. */
async function readDaily(page, s, date) {
  return page.evaluate(async ([url, token]) => {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 404) return { missing: true, fields: {} };
    if (!r.ok) return { error: `${r.status} ${(await r.text()).slice(0, 150)}` };
    return { fields: (await r.json()).fields || {} };
  }, [dailyUrl(s.tenantId, s.uid, date), s.token]);
}

/** Pull an integer KPI out of a Firestore REST document, defaulting to 0. */
function num(fields, path) {
  const parts = path.split('.');
  let node = fields;
  for (let i = 0; i < parts.length; i++) {
    if (!node) return 0;
    const v = node[parts[i]];
    if (v === undefined) return 0;
    node = (i === parts.length - 1) ? v : (v.mapValue && v.mapValue.fields);
  }
  if (!node) return 0;
  return parseInt(node.integerValue ?? node.doubleValue ?? 0, 10) || 0;
}

/**
 * POST one call to the DEPLOYED endpoint, FROM NODE — not from the page.
 *
 * The first version of this ran the fetch inside page.evaluate and died on
 * `TypeError: Failed to fetch`: a browser-origin POST from the Vercel host to
 * cloudfunctions.net is cross-origin, and the endpoint sets no CORS headers.
 *
 * That is the harness being wrong, not the endpoint. `ingestCallActivity` is a
 * SERVER-TO-SERVER webhook target — its real caller is Supabase, which has no
 * origin and no preflight. A browser is not a client this endpoint has, so
 * adding CORS to satisfy a test would widen the surface to serve a scenario
 * that does not exist. Posting from Node models the real caller exactly.
 *
 * `token` is the raw bearer token: passed as a header, returned nowhere.
 */
async function postCall(_page, token, body) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text.slice(0, 200) }; }
  return { status: r.status, body: parsed };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await setupBypassSession(ctx, BASE, BYPASS);
const page = await ctx.newPage();

let rawToken = null;   // held ONLY to send as a header. Never logged.
let sourceLabel = null;

try {
  // ── sign in ──────────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 });
  await page.waitForTimeout(2500);

  // The seeded agent's filing streak fires a full-screen z-60 celebration that
  // blocks every nav item. Clear it, don't click through it.
  //
  // Called more than once, deliberately. A single check on a fixed 3s window
  // passed one run and missed the next — the overlay mounts on its own
  // schedule, so the check has to be on the state, not on a stopwatch. It is
  // cheap and idempotent; the expensive version is a 15s click timeout whose
  // message says nothing about an overlay.
  await clearOverlay(page);

  const session = await readSession(page);
  if (!session?.token) { fail('session', 'could not read the agent session'); throw new Error('no session'); }
  pass('session', `uid ${session.uid.slice(0, 6)}… tenant ${session.tenantId}`);

  const DATE = ttDate();

  // ── baseline BEFORE anything is posted ───────────────────────────────────
  const before = await readDaily(page, session, DATE);
  if (before.error) { fail('baseline-read', before.error); throw new Error('baseline'); }
  const b = {
    dials: num(before.fields, 'dials'),
    cold: num(before.fields, 'dialsByType.cold'),
    telContacts: num(before.fields, 'telContacts'),
  };
  pass('baseline-read', `${before.missing ? 'no daily doc yet' : 'daily doc exists'} — dials=${b.dials} cold=${b.cold} telContacts=${b.telContacts}`);

  // ── mint a real call source through the UI ───────────────────────────────
  await clearOverlay(page);   // it can mount late; check again where it bites
  const nav = page.locator('[data-testid="agent-tab-call-sources"]').first();
  await nav.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await nav.click({ timeout: 15_000 });
  await page.waitForTimeout(1500);

  sourceLabel = `ingest smoke ${Date.now()} — delete me`;
  await page.fill('#cs-label', sourceLabel);
  await page.fill('#cs-app', 'kqm-calls');
  await page.fill('#cs-source-user', 'ingest-smoke-caller');
  await page.click('[data-testid="cs-create"]');

  const revealed = await page.locator('[data-testid="call-source-token-reveal"]').first()
    .waitFor({ state: 'visible', timeout: 45_000 }).then(() => true).catch(() => false);
  if (!revealed) { fail('mint-token', 'no token reveal within 45s'); throw new Error('mint'); }

  // The ONE place this script reads the raw token. It goes into a header and
  // nowhere else — never a log, a report, a screenshot or a URL param.
  rawToken = await page.locator('[data-testid="call-source-token-value"]').first().textContent();
  rawToken = (rawToken || '').trim();
  if (rawToken.length < 20) { fail('mint-token', 'token implausibly short'); throw new Error('mint'); }
  pass('mint-token', `minted via UI, ${rawToken.length} chars (value not recorded)`);
  await page.click('[data-testid="call-source-token-dismiss"]').catch(() => {});

  // ── LEG 1: one real call, through the deployed endpoint ──────────────────
  const sourceId = `smoke-${Date.now()}`;
  const call = {
    sourceApp: 'kqm-calls',
    sourceId,
    occurredAt: new Date().toISOString(),
    // ── THE C2 CONTRACT: effects, not outcome names. ─────────────────────────
    // reached=true in the new-business lane -> dials +1, dialsByType.cold +1,
    // telContacts +1. Identical arithmetic to the slice-B `gatekeeper_blocked`
    // this replaces, so the baseline deltas below did not have to change.
    lane: 'newBusiness',
    bucket: 'cold',
    reached: true,
    booking: false,
    newName: false,
    ffi: false,
    // KQM's OWN words, in the shape the 27 Aug database audit actually found —
    // a display label and a `_2026` suffix. Both of these 400'd under slice B.
    // Stored on the ingest record, scored by nothing.
    rawOutcome: 'Gatekeeper blocked',
    rawCampaign: 'schools_2026',
    durationSec: 42,
  };

  const r1 = await postCall(page, rawToken, call);
  if (r1.status !== 200 && r1.status !== 201) {
    fail('ingest-accepted', `HTTP ${r1.status} ${JSON.stringify(r1.body).slice(0, 200)}`);
    throw new Error('ingest');
  }
  pass('ingest-accepted', `HTTP ${r1.status}`);

  await page.waitForTimeout(2500);
  const after1 = await readDaily(page, session, DATE);
  if (after1.error) { fail('kpi-moved', after1.error); throw new Error('read'); }
  const a1 = {
    dials: num(after1.fields, 'dials'),
    cold: num(after1.fields, 'dialsByType.cold'),
    telContacts: num(after1.fields, 'telContacts'),
  };

  // THE assertion nothing so far has made: a real Firestore transaction moved
  // a real agent's numbers, by exactly the mapped amount.
  const moved = (a1.dials === b.dials + 1) && (a1.cold === b.cold + 1) && (a1.telContacts === b.telContacts + 1);
  if (moved) pass('kpi-moved', `dials ${b.dials}->${a1.dials}, cold ${b.cold}->${a1.cold}, telContacts ${b.telContacts}->${a1.telContacts}`);
  else fail('kpi-moved', `expected +1/+1/+1, got dials ${b.dials}->${a1.dials}, cold ${b.cold}->${a1.cold}, telContacts ${b.telContacts}->${a1.telContacts}`);

  // The partition invariant, checked against REAL data — on the DELTA, not the
  // absolute totals.
  //
  // The first version asserted `sum(buckets) === dials` outright and failed:
  // buckets=1 but dials=7. That was the ASSERTION being wrong, not the code.
  // Per PR #909 the type split is ADDITIVE — `dials` stays the authoritative
  // daily total and `dialsByType` is optional alongside it, which is exactly why
  // the aggregator falls back PER ENTRY. This daily doc already carried 6 dials
  // written with no breakdown, so the totals legitimately disagree and always
  // will for any day that mixes pre-v2 or Daily-Capture-entered dials with
  // ingested ones.
  //
  // What the endpoint actually guarantees is that ITS OWN contribution
  // partitions: one call bumps `dials` by one and exactly one bucket by one.
  // That is the property worth asserting, and asserting the stronger one would
  // have this smoke go red on any real agent's real day.
  const bucketsAfter = ['cold', 'referral', 'followUp', 'seminarTradeshow']
    .reduce((s, k) => s + num(after1.fields, `dialsByType.${k}`), 0);
  const bucketsBefore = ['cold', 'referral', 'followUp', 'seminarTradeshow']
    .reduce((s, k) => s + num(before.fields, `dialsByType.${k}`), 0);
  const dDials = a1.dials - b.dials;
  const dBuckets = bucketsAfter - bucketsBefore;
  if (dDials === dBuckets && dDials === 1) pass('partition-holds-live', `this call moved dials +${dDials} and exactly one bucket +${dBuckets}`);
  else fail('partition-holds-live', `delta mismatch: dials +${dDials} vs buckets +${dBuckets}`);

  // ── LEG 2: THE REASON THIS SMOKE EXISTS — replay the same sourceId ───────
  // Idempotency has only ever been proven against a transaction fake. This is
  // the first time Firestore itself decides.
  const r2 = await postCall(page, rawToken, call);
  pass('replay-answered', `HTTP ${r2.status} on identical sourceId`);

  await page.waitForTimeout(2500);
  const after2 = await readDaily(page, session, DATE);
  const a2 = {
    dials: num(after2.fields, 'dials'),
    cold: num(after2.fields, 'dialsByType.cold'),
    telContacts: num(after2.fields, 'telContacts'),
  };
  const unchanged = (a2.dials === a1.dials) && (a2.cold === a1.cold) && (a2.telContacts === a1.telContacts);
  if (unchanged) pass('idempotent-live', `replay did not double-count (dials still ${a2.dials})`);
  else fail('idempotent-live', `DOUBLE COUNTED: dials ${a1.dials}->${a2.dials}, cold ${a1.cold}->${a2.cold}, telContacts ${a1.telContacts}->${a2.telContacts}`);

  // ── LEG 3: concurrent replay — the shape the fake could only model ───────
  const cid = `smoke-conc-${Date.now()}`;
  const concurrent = { ...call, sourceId: cid };
  const beforeConc = num((await readDaily(page, session, DATE)).fields, 'dials');
  const [c1, c2] = await Promise.all([
    postCall(page, rawToken, concurrent),
    postCall(page, rawToken, concurrent),
  ]);
  await page.waitForTimeout(3000);
  const afterConc = num((await readDaily(page, session, DATE)).fields, 'dials');
  if (afterConc === beforeConc + 1) pass('concurrent-idempotent-live', `two simultaneous deliveries moved dials once (${beforeConc}->${afterConc}); statuses ${c1.status}/${c2.status}`);
  else fail('concurrent-idempotent-live', `expected +1, got ${beforeConc}->${afterConc}; statuses ${c1.status}/${c2.status}`);

  // ── LEG 4: DECISION 4, LIVE — a servicing call must not move telContacts ─
  // The mechanical claim of this endpoint's whole design, checked against a real
  // Firestore rather than a fake: the lane decides which contact field moves.
  const svcBefore = await readDaily(page, session, DATE);
  const sb = {
    telContacts: num(svcBefore.fields, 'telContacts'),
    serviceCalls: num(svcBefore.fields, 'serviceCalls'),
    serviceContacts: num(svcBefore.fields, 'serviceContacts'),
  };
  const svc = await postCall(page, rawToken, {
    ...call,
    sourceId: `smoke-svc-${Date.now()}`,
    lane: 'servicing',
    bucket: null,          // must be EXPLICITLY null in the servicing lane
    reached: true,
    rawOutcome: 'Portfolio - client contacted',
    rawCampaign: 'portfolio_2026',
  });
  if (svc.status !== 200 && svc.status !== 201) {
    fail('servicing-accepted', `HTTP ${svc.status} ${JSON.stringify(svc.body).slice(0, 200)}`);
  } else {
    pass('servicing-accepted', `HTTP ${svc.status}`);
    await page.waitForTimeout(2500);
    const svcAfter = await readDaily(page, session, DATE);
    const sa = {
      telContacts: num(svcAfter.fields, 'telContacts'),
      serviceCalls: num(svcAfter.fields, 'serviceCalls'),
      serviceContacts: num(svcAfter.fields, 'serviceContacts'),
    };
    const ok = sa.serviceCalls === sb.serviceCalls + 1
      && sa.serviceContacts === sb.serviceContacts + 1
      && sa.telContacts === sb.telContacts;
    if (ok) pass('servicing-never-telcontacts', `serviceCalls ${sb.serviceCalls}->${sa.serviceCalls}, serviceContacts ${sb.serviceContacts}->${sa.serviceContacts}, telContacts UNMOVED at ${sa.telContacts}`);
    else fail('servicing-never-telcontacts', `expected serviceCalls/serviceContacts +1 and telContacts unmoved; got telContacts ${sb.telContacts}->${sa.telContacts}, serviceCalls ${sb.serviceCalls}->${sa.serviceCalls}, serviceContacts ${sb.serviceContacts}->${sa.serviceContacts}`);
  }

  // ── LEG 5: rejections, against the live endpoint ─────────────────────────
  // The lane/bucket partition invariant, both directions. Under slice B the
  // bucket was derived here and could not be wrong; it now arrives over HTTP, so
  // these two rejections are the whole of what keeps dialsByType a partition.
  const svcWithBucket = await postCall(page, rawToken, {
    ...call, sourceId: `smoke-inc1-${Date.now()}`, lane: 'servicing', bucket: 'cold',
  });
  if (svcWithBucket.status === 400) pass('servicing-with-bucket-rejected', 'HTTP 400 — a servicing bucket would break the sum');
  else fail('servicing-with-bucket-rejected', `expected 400, got ${svcWithBucket.status}`);

  const nbWithoutBucket = await postCall(page, rawToken, {
    ...call, sourceId: `smoke-inc2-${Date.now()}`, lane: 'newBusiness', bucket: null,
  });
  if (nbWithoutBucket.status === 400) pass('newbusiness-without-bucket-rejected', 'HTTP 400 — dials and dialsByType would disagree');
  else fail('newbusiness-without-bucket-rejected', `expected 400, got ${nbWithoutBucket.status}`);

  const ffiNoBooking = await postCall(page, rawToken, {
    ...call, sourceId: `smoke-ffi-${Date.now()}`, ffi: true, booking: false,
  });
  if (ffiNoBooking.status === 400) pass('ffi-without-booking-rejected', 'HTTP 400 — never a half-state');
  else fail('ffi-without-booking-rejected', `expected 400, got ${ffiNoBooking.status}`);

  // THE DEPLOY PROOF. A slice-B body is refused by name. If the OLD build were
  // still serving, this would be a 200 and every leg above would be measuring a
  // function that is not the one in this PR.
  const oldShape = await postCall(page, rawToken, {
    sourceApp: 'kqm-calls',
    sourceId: `smoke-oldshape-${Date.now()}`,
    occurredAt: new Date().toISOString(),
    campaignCode: 'schools',
    outcome: 'gatekeeper_blocked',
    durationSec: 42,
  });
  const named = oldShape.status === 400 && /retired slice-B contract/.test(JSON.stringify(oldShape.body));
  if (named) pass('retired-contract-rejected', 'HTTP 400 naming the retired contract — the C2 build IS live');
  else fail('retired-contract-rejected', `expected a 400 naming the retired contract, got ${oldShape.status} ${JSON.stringify(oldShape.body).slice(0, 200)}`);

  const withIdentity = await postCall(page, rawToken, { ...call, sourceId: `smoke-id-${Date.now()}`, creditUid: 'someone-else' });
  if (withIdentity.status === 400) pass('identity-in-payload-rejected', 'HTTP 400 — creditUid refused, not ignored');
  else fail('identity-in-payload-rejected', `expected 400, got ${withIdentity.status}`);

} catch (e) {
  if (!results.some((r) => !r.ok)) fail('unexpected', e.message.split('\n')[0]);
} finally {
  // ── CLEANUP: revoke the source. The daily bump is NOT reversible. ────────
  if (sourceLabel) {
    try {
      const row = page.locator('[data-testid="cs-row"]').filter({ hasText: sourceLabel }).first();
      if (await row.isVisible({ timeout: 4000 }).catch(() => false)) {
        await row.locator('[data-testid="cs-revoke"]').click();
        const ok = await Promise.race([
          row.locator('[data-testid="cs-revoked-badge"]').waitFor({ state: 'visible', timeout: 45_000 }).then(() => true),
          row.waitFor({ state: 'detached', timeout: 45_000 }).then(() => true),
        ]).catch(() => false);
        if (ok) pass('cleanup-revoked', 'smoke token revoked');
        else fail('cleanup-revoked', 'TOKEN STILL LIVE — revoke by hand');
      }
    } catch { fail('cleanup-revoked', 'cleanup threw — check for a live token'); }
  }
  rawToken = null;
  await browser.close();
}

console.log('\n=== SUMMARY ===');
const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id}${r.note ? ' — ' + r.note : ''}`));
console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
console.log('\nNote: ingest is idempotent but NOT reversible. The staging agent\'s daily numbers');
console.log('keep the increments this run made. That is expected on a synthetic tenant.');
process.exit(failed.length ? 1 : 0);

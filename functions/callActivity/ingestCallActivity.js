'use strict';

/**
 * ingestCallActivity — POST /ingestCallActivity. Slice B.
 *
 * One HTTP request per call, from KQM Calls into AgencyTrack. The request
 * carries a bearer token and an outcome; this endpoint resolves the token to a
 * call source, maps the outcome through outcomeMap.js, and bumps that day's
 * dailyActivity doc. aggregateDailyToWeekly does the rest — fill the daily doc
 * and the weekly KPIs build themselves.
 *
 * THIS IS THE SLICE WHERE A WRONG DECISION BECOMES WRONG DATA. Slices A and
 * A-prime could be reversed in an afternoon because nothing depended on them.
 * From here on a mapping error writes numbers into a named agent's report, and
 * numbers are much harder to take back than code.
 *
 * ── IDENTITY COMES FROM THE TOKEN. NEVER FROM THE PAYLOAD ───────────────────
 * There is no agent identity in the request body, ever. The token resolves to a
 * callSources doc, that doc carries `creditUid`, and that is whose KPIs move.
 * Same principle A-prime enforced on creation, for the same reason: identity
 * that travels in a request body is identity a typo or a tampered field can
 * redirect.
 *
 * A body carrying creditUid / agentEmail / uid / tenantId is REJECTED with 400
 * rather than ignored. Ignoring it would let a caller believe it works, and a
 * caller who believes it works ships a build that depends on it.
 *
 * ── THE ADMIN SDK IS THE POINT ──────────────────────────────────────────────
 * firestore.rules:256-259 makes dailyActivity writable ONLY by the owning agent.
 * The calling software is not the agent and has no Firebase identity at all, so
 * this has to be a Cloud Function writing through the Admin SDK. That is why
 * this slice needs no rules change: it is not a client write.
 *
 * ── THIS IS A PUBLIC SURFACE ────────────────────────────────────────────────
 * Anyone can POST here. Everything below assumes a hostile caller: body size is
 * capped before parsing, every enum is rejected loudly rather than mapped to
 * zero, doc-id components are pattern-checked before they touch a path, the rate
 * limiter is per source doc, and every auth failure returns one identical
 * response so the endpoint cannot be used to enumerate valid tokens.
 *
 * ── THE RAW TOKEN NEVER APPEARS IN A LOG, A RESPONSE OR AN ERROR ────────────
 * It is unrecoverable by design and stays that way in the logs too. Diagnostics
 * name the source doc ID, which is not a credential.
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');

const { mapCall, isKnownOutcome, isKnownCampaign } = require('./outcomeMap');
const { resolveCallSource } = require('./resolveCallSource');

/**
 * Resolved from the environment, defaulting to the production tenant.
 *
 * ⚠ THE DEFAULT IS LOAD-BEARING: with no env var set, this is byte-identical to
 * the hardcoded constant it replaces, so production behaviour cannot drift.
 * Firebase loads `functions/.env.<projectId>` at deploy time, so the staging
 * project gets `staging_test` and production gets the default.
 *
 * WHY THIS STOPPED BEING A CONSTANT. It was hardcoded following the SEC-9c
 * convention in index.js:62, and banked as MEDIUM: "a second tenant's tokens
 * would 401 — failing closed, but silently". Running the staging smoke showed
 * that rating was too generous. The consequence is not a hypothetical second
 * tenant: a token minted in staging (tenant `staging_test`) resolves against
 * `tenants/tatillife_south/callSources/…`, which does not exist in the staging
 * project, so it 401s indistinguishably from a forged token. The endpoint was
 * therefore **impossible to exercise anywhere but production** — and the one
 * proof this slice still owes is a staging smoke. A constant that makes a
 * feature untestable outside production is not a deferred nicety.
 *
 * index.js:62 and aggregators/sundayDailyToWeekly.js:30 still hardcode it.
 * Deliberately not changed here: they are scheduled functions, and in staging
 * they simply find no data under the production tenant and do nothing. Banked
 * rather than swept in, so this diff stays inside its file inventory.
 */
const TENANT_ID = process.env.AGENCYTRACK_TENANT_ID || 'tatillife_south';

/** Trinidad is UTC-4 year round. No DST — that is why a constant is honest here. */
const TT_OFFSET_MS = 4 * 60 * 60 * 1000;

/** Source apps permitted to post. An allow-list, because it becomes a doc id. */
const ALLOWED_SOURCE_APPS = Object.freeze(['kqm-calls']);

/**
 * sourceId becomes half of a Firestore document id, so it is pattern-checked
 * before it is ever concatenated into a path. This removes the whole class:
 * a '/' would silently retarget the write, and '.' / '..' are illegal ids.
 */
const SOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** Reject before parsing. A call record is a few hundred bytes. */
const MAX_BODY_BYTES = 8 * 1024;

/**
 * Per-source rate limit. A human dialer with an assistant will not clear two a
 * second sustained; a retry storm or a runaway loop will. The counter lives on
 * the callSources doc and is advanced inside the SAME transaction as the KPI
 * bump, so it cannot be outrun by concurrency the way a separate check would be.
 */
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_PER_WINDOW = 120;

/**
 * The identity fields a caller must never send. Presence is a 400 — see header.
 */
const FORBIDDEN_BODY_FIELDS = Object.freeze([
  'creditUid',
  'agentEmail',
  'uid',
  'tenantId',
  'agentId',
]);

/**
 * The ONE response every authentication failure returns. Expired, revoked,
 * unknown and malformed are indistinguishable to the caller by construction:
 * there is a single object and a single status, so no future edit can
 * accidentally make one branch chattier than another.
 */
const AUTH_FAILURE_BODY = Object.freeze({ ok: false, error: 'unauthorized' });

/**
 * toTrinidadDateString — 'YYYY-MM-DD' in Trinidad time for an instant.
 *
 * ── THE TRAP THIS EXISTS TO AVOID ───────────────────────────────────────────
 * The daily doc id is a TRINIDAD date. A call at 20:30 TT on the 26th is 00:30
 * UTC on the 27th. Deriving the date from occurredAt in UTC puts the call on the
 * wrong DAY, and near month-end on the wrong MONTH — 31 Aug 21:00 TT would land
 * in September, moving a number out of the month a manager is reading.
 *
 * Convert to TT first, THEN format. Never format a UTC instant and adjust after.
 *
 * @param {string} iso ISO-8601 with offset
 * @returns {string|null} 'YYYY-MM-DD', or null when unparseable
 */
function toTrinidadDateString(iso) {
  if (typeof iso !== 'string' || iso.length === 0) return null;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;

  const tt = new Date(instant.getTime() - TT_OFFSET_MS);
  const yyyy = tt.getUTCFullYear();
  const mm = String(tt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(tt.getUTCDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

/**
 * getSundayOf — the Sunday that starts the week containing a 'YYYY-MM-DD'.
 *
 * A CJS twin of getSundayOf() in src/lib/schema/dailyActivity.js, restated for
 * the same reason validateToken.js restates validateTokenData: Cloud Functions
 * are CJS and cannot import the ESM src/ tree. The UTC-NOON ANCHOR is the part
 * that must not drift — anchoring at midnight makes the arithmetic sensitive to
 * an hour of offset, which is precisely the bug above in a different costume.
 *
 * The daily doc MUST carry weekStarting: sundayDailyToWeekly.js finds a week's
 * entries with where('weekStarting', '==', ...). A daily doc written without it
 * is invisible to the aggregator, and the agent's weekly numbers simply never
 * move — with nothing logged anywhere, because nothing failed.
 */
function getSundayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

/**
 * setNested — write `value` at a dotted path into a plain object, creating the
 * intermediate maps. 'dialsByType.cold' becomes { dialsByType: { cold: value } }.
 *
 * outcomeMap emits DOTTED paths because that is the canonical name of the field
 * and it makes the audit record and the write allow-list read like the schema.
 * Firestore's set() needs the NESTED form. This is the one place the two shapes
 * meet, so neither side has to know about the other.
 */
function setNested(target, dottedPath, value) {
  const parts = dottedPath.split('.');
  let node = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (typeof node[parts[i]] !== 'object' || node[parts[i]] === null) node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
  return target;
}

/**
 * validatePayload — PURE. Everything about the body that can be judged without
 * touching Firestore.
 *
 * Runs AFTER authentication, deliberately. An unauthenticated prober must only
 * ever see the one 401: if payload errors were reported first, the difference
 * between "your outcome is unknown" and "unauthorized" would tell them their
 * token resolved.
 *
 * @returns {{ok: true, value: object} | {ok: false, error: string}}
 */
function validatePayload(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }

  for (const field of FORBIDDEN_BODY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      // Named explicitly. A caller sending identity needs to know the endpoint
      // will never honour it, not merely that something was wrong.
      return { ok: false, error: 'identity is resolved from the token; remove "' + field + '"' };
    }
  }

  const { sourceApp, sourceId, occurredAt, campaignCode, outcome, durationSec } = body;

  if (!ALLOWED_SOURCE_APPS.includes(sourceApp)) {
    return { ok: false, error: 'unknown sourceApp' };
  }
  if (typeof sourceId !== 'string' || !SOURCE_ID_PATTERN.test(sourceId)) {
    return { ok: false, error: 'sourceId must match ' + String(SOURCE_ID_PATTERN) };
  }

  const date = toTrinidadDateString(occurredAt);
  if (!date) return { ok: false, error: 'occurredAt must be ISO-8601 with an offset' };

  if (!isKnownCampaign(campaignCode)) return { ok: false, error: 'unknown campaignCode' };
  if (!isKnownOutcome(outcome)) return { ok: false, error: 'unknown outcome' };

  // Optional, and only ever recorded as evidence — it never feeds a KPI. A
  // duration threshold must NEVER be used to infer that a person was reached:
  // a voicemail connects and accrues seconds. `reached` is the outcome's own
  // assertion, exactly as callRecord.js rules for verifications.
  let duration = null;
  if (durationSec !== undefined && durationSec !== null) {
    if (!Number.isFinite(durationSec) || durationSec < 0) {
      return { ok: false, error: 'durationSec must be a non-negative number' };
    }
    duration = Math.round(durationSec);
  }

  return {
    ok: true,
    value: { sourceApp, sourceId, date, weekStarting: getSundayOf(date), campaignCode, outcome, durationSec: duration },
  };
}

/** Bearer token from the Authorization header, or null. */
function bearerToken(req) {
  const header = req.get ? req.get('Authorization') : (req.headers || {}).authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)$/.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * applyCall — the transaction. The whole correctness argument of this slice
 * lives in the ordering of the lines below.
 *
 * ── IDEMPOTENCY IS NOT OPTIONAL, IT IS THE DELIVERY MODEL ───────────────────
 * Supabase webhooks retry. The offline outbox replays on sync. So the KPI bump
 * is conditional on an ingest record for (sourceApp, sourceId) not already
 * existing, and THAT CHECK IS INSIDE THE SAME TRANSACTION AS THE BUMP. Checking
 * first and writing second leaves a window in which two retries both pass the
 * check and the agent's numbers move twice. Firestore aborts and retries the
 * loser, which is exactly the behaviour wanted.
 *
 * ── INCREMENT, DO NOT READ-MODIFY-WRITE ─────────────────────────────────────
 * Two calls landing in the same second must both count. Every KPI moves via
 * FieldValue.increment; nothing reads the daily doc and writes it back whole.
 * increment() also treats a missing doc or field as 0, which is why a first call
 * of the day needs no create-then-update dance.
 *
 * ── ALL READS BEFORE ALL WRITES ─────────────────────────────────────────────
 * A Firestore transaction requires it. The three gets are grouped at the top
 * for that reason and not by taste.
 */
async function applyCall(db, { sourceRef, source, sourceId, payload, now }) {
  const creditUid = source.creditUid;
  const ingestRef = db.doc(
    'tenants/' + TENANT_ID + '/callActivity/' + payload.sourceApp + '__' + payload.sourceId,
  );
  const dailyRef = db.doc(
    'tenants/' + TENANT_ID + '/users/' + creditUid + '/dailyActivity/' + payload.date,
  );
  const weeklyRef = db.doc(
    'tenants/' + TENANT_ID + '/submissions/' + creditUid + '_' + payload.weekStarting,
  );

  return db.runTransaction(async (tx) => {
    // ---- reads -------------------------------------------------------------
    const ingestSnap = await tx.get(ingestRef);
    if (ingestSnap.exists) {
      // A replay. Not an error — the delivery model guarantees these — so it
      // answers 200 and the caller stops retrying. The KPI is untouched.
      return { applied: false, duplicate: true, date: payload.date };
    }

    const sourceSnap = await tx.get(sourceRef);
    const sourceNow = sourceSnap.exists ? sourceSnap.data() : {};

    const weeklySnap = await tx.get(weeklyRef);
    const submittedWeek = weeklySnap.exists && weeklySnap.data().status === 'submitted';

    // ---- rate limit --------------------------------------------------------
    const windowStart = Number(sourceNow.ingestWindowStart) || 0;
    const inWindow = now.getTime() - windowStart < RATE_WINDOW_MS;
    const windowCount = inWindow ? Number(sourceNow.ingestWindowCount) || 0 : 0;
    if (inWindow && windowCount >= RATE_MAX_PER_WINDOW) {
      return { applied: false, rateLimited: true };
    }

    // ---- writes ------------------------------------------------------------
    const { increments, lane, bucket } = mapCall(payload.campaignCode, payload.outcome);

    // Decision 3. The daily doc records what actually happened — that is the
    // truth of the day, and dropping it is the exact failure ruling D3
    // objected to. The submitted weekly stays EXACTLY as the agent signed it:
    // nothing below touches weeklyRef, and the Sunday aggregator already skips
    // a submitted week (sundayDailyToWeekly.js), so no later run moves it
    // either. Never silently move a number an agent submitted and a manager
    // may already have read. The discrepancy is RECORDED on the ingest record
    // instead, so it is visible rather than silent.
    tx.set(
      ingestRef,
      {
        tenantId: TENANT_ID,
        sourceApp: payload.sourceApp,
        sourceId: payload.sourceId,
        callSourceId: sourceId,
        creditUid,
        date: payload.date,
        weekStarting: payload.weekStarting,
        campaignCode: payload.campaignCode,
        outcome: payload.outcome,
        durationSec: payload.durationSec,
        lane,
        dialBucket: bucket,
        increments,
        landedInSubmittedWeek: submittedWeek,
        ingestedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: false },
    );

    // ── DOTTED PATHS ARE NOT NESTED FIELDS IN set(), ONLY IN update() ───────
    // set({ 'dialsByType.cold': ... }, { merge: true }) creates a TOP-LEVEL
    // field whose name literally contains a dot. It does not touch
    // dialsByType.cold, it does not error, and the aggregator — which reads
    // entry.dialsByType.cold — would simply never see it. The daily doc would
    // look plausible in the console and every call-type number would stay zero.
    //
    // update() DOES honour dotted paths, but throws when the doc is absent, and
    // the first call of any day arrives at an absent doc. So the patch is built
    // NESTED and written with merge, which deep-merges maps key by key and
    // creates the doc when it is missing.
    const dailyPatch = {
      // Identity/meta, written every time with merge so the first call of the
      // day creates a doc the aggregator can actually find. weekStarting is
      // load-bearing — see getSundayOf above. agentName is deliberately absent:
      // the aggregator reads it from the user doc, and fetching it here would
      // be a read per call for a field nothing consumes.
      version: 2,
      date: payload.date,
      weekStarting: payload.weekStarting,
      agentId: creditUid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    for (const [field, delta] of Object.entries(increments)) {
      setNested(dailyPatch, field, admin.firestore.FieldValue.increment(delta));
    }
    tx.set(dailyRef, dailyPatch, { merge: true });

    tx.update(sourceRef, {
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
      ingestWindowStart: inWindow ? windowStart : now.getTime(),
      ingestWindowCount: windowCount + 1,
    });

    return { applied: true, duplicate: false, date: payload.date, landedInSubmittedWeek: submittedWeek };
  });
}

const ingestCallActivity = functions.https.onRequest(async (req, res) => {
  // No CORS headers, deliberately. This is a server-to-server webhook; a browser
  // must not be able to call it with a token pasted into page script.
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST only' });
    return;
  }

  // Size first — cheapest rejection, and it leaks nothing about the token.
  const rawLength = req.rawBody ? req.rawBody.length : Number(req.get && req.get('content-length')) || 0;
  if (rawLength > MAX_BODY_BYTES) {
    res.status(413).json({ ok: false, error: 'body too large' });
    return;
  }

  const db = admin.firestore();
  const now = new Date();

  try {
    // ---- authenticate BEFORE looking at the payload ------------------------
    const token = bearerToken(req);
    const resolved = await resolveCallSource(db, TENANT_ID, token, now);
    if (!resolved.valid) {
      // The reason is LOGGED and never returned. One body, one status, for
      // every failure mode — so the endpoint cannot be used as an oracle for
      // which tokens exist.
      console.warn('[ingestCallActivity] auth rejected:', resolved.reason);
      res.status(401).json(AUTH_FAILURE_BODY);
      return;
    }

    const parsed = validatePayload(req.body);
    if (!parsed.ok) {
      console.warn(
        '[ingestCallActivity] bad payload source=' + resolved.sourceId + ': ' + parsed.error,
      );
      res.status(400).json({ ok: false, error: parsed.error });
      return;
    }

    const result = await applyCall(db, {
      sourceRef: resolved.ref,
      source: resolved.source,
      sourceId: resolved.sourceId,
      payload: parsed.value,
      now,
    });

    if (result.rateLimited) {
      console.warn('[ingestCallActivity] rate limited source=' + resolved.sourceId);
      res.status(429).json({ ok: false, error: 'rate limited' });
      return;
    }

    res.status(200).json({
      ok: true,
      applied: result.applied,
      duplicate: result.duplicate,
      date: result.date,
    });
  } catch (err) {
    // Never echo the error to the caller — it could carry a path, a doc id, or
    // in the worst case something derived from the token.
    console.error('[ingestCallActivity] error:', err);
    res.status(500).json({ ok: false, error: 'internal' });
  }
});

module.exports = {
  ingestCallActivity,
  // Exposed for tests. Pure halves stay testable without a database.
  toTrinidadDateString,
  getSundayOf,
  setNested,
  validatePayload,
  bearerToken,
  applyCall,
  TENANT_ID,
  RATE_MAX_PER_WINDOW,
  RATE_WINDOW_MS,
  MAX_BODY_BYTES,
  FORBIDDEN_BODY_FIELDS,
};

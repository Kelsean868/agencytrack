/**
 * E6 — Sunday daily→weekly aggregator.
 *
 * Schedule: '0 3 * * 1' = Monday 03:00 UTC = Sunday 23:00 Trinidad.
 *
 * For every agent in 'daily' or 'hybrid' loggingMode, sums their dailyActivity
 * docs for the week that just ended and writes the totals into the existing
 * weekly draft path with merge:true. Agent reviews + submits manually.
 *
 * Tenant scoping is single-tenant (TENANT_ID hardcoded in functions/index.js)
 * per SEC-9c — generalisation is its own ticket.
 *
 * Skip-write rules:
 *   - dailyEntries empty → no draft write (nothing to aggregate)
 *   - existing submission has status='submitted' → skip (don't clobber a
 *     submitted report)
 *
 * The pure aggregation lives in ./dailyToWeekly.js (CommonJS twin of the
 * canonical client copy in src/lib/schema/dailyActivity.aggregator.js).
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { aggregateDailyToWeekly } = require('./dailyToWeekly');

// Tenant id is shared across functions/index.js; aggregator is colocated in
// the same module-init context so we re-read it from the environment via the
// canonical const (set at index.js top-of-file). For now, hardcode the same
// value to avoid coupling to index.js's load order.
const TENANT_ID = 'tatillife_south';

/**
 * UTC-4 (Trinidad) → 'YYYY-MM-DD' for the Sunday at the start of the week
 * containing `date`. Mirrors getSundayOf() in src/lib/schema/dailyActivity.js
 * so the cron and the wizard agree on week boundaries.
 */
function getTriniSundayString(date) {
  const trini = new Date(date.getTime() - 4 * 60 * 60 * 1000);
  const day = trini.getUTCDay();
  const sunday = new Date(trini);
  sunday.setUTCDate(trini.getUTCDate() - day);
  const yyyy = sunday.getUTCFullYear();
  const mm = String(sunday.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(sunday.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns the weekStarting (Sunday) of the week that JUST ENDED at the time
 * the cron fires. Cron fires Sunday 23:00 TT — that's the END of the
 * week-being-aggregated whose weekStarting is THIS Sunday's date in TT.
 *
 * Wait: weekStarting in this codebase tags the Sunday that STARTS a 7-day
 * window. If today (TT) is Sunday May 17 23:00, dailyActivity entries logged
 * Mon May 11 → Sat May 16 are tagged weekStarting=2026-05-10 (the Sunday
 * BEFORE that Monday, per getSundayOf). So the week to aggregate is the
 * Sunday 7 days back from today's TT-Sunday — NOT today's Sunday itself.
 */
function resolveWeekToAggregate(now) {
  const todaySunday = getTriniSundayString(now);
  const d = new Date(todaySunday + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 7);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Build the firestore path for the aggregated weekly draft.
 */
function draftDocPath(tenantId, agentId, weekStarting) {
  return `tenants/${tenantId}/submissions/${agentId}_${weekStarting}`;
}

/**
 * Core orchestrator — exported so a future test harness or manual trigger
 * can call it without going through the cron wrapper.
 */
async function runAggregation({ tenantId, weekStarting, db, logger = console }) {
  const usersSnap = await db
    .collection(`tenants/${tenantId}/users`)
    .where('role', '==', 'agent')
    .get();

  const eligibleAgents = usersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.provisioning !== true)
    .filter((u) => {
      const mode = u.loggingMode || 'hybrid'; // existing-agent default per CONTEXT
      return mode === 'daily' || mode === 'hybrid';
    });

  let aggregated = 0;
  let skippedSubmitted = 0;
  let skippedEmpty = 0;

  for (const agent of eligibleAgents) {
    try {
      const dailySnap = await db
        .collection(`tenants/${tenantId}/users/${agent.id}/dailyActivity`)
        .where('weekStarting', '==', weekStarting)
        .get();

      if (dailySnap.empty) {
        skippedEmpty += 1;
        continue;
      }

      const draftRef = db.doc(draftDocPath(tenantId, agent.id, weekStarting));
      const existing = await draftRef.get();
      if (existing.exists && existing.data().status === 'submitted') {
        skippedSubmitted += 1;
        continue;
      }

      const dailyEntries = dailySnap.docs.map((d) => d.data());
      const rollup = aggregateDailyToWeekly(dailyEntries, agent.commissionRate);

      await draftRef.set(
        {
          ...rollup,
          userId: agent.id,
          agentId: agent.id,
          agentName: agent.name || agent.email || agent.id,
          weekStarting,
          status: 'draft',
          aggregatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      aggregated += 1;
    } catch (err) {
      logger.error(`[sundayAggregator] agent=${agent.id} failed:`, err);
    }
  }

  logger.log(
    `[sundayAggregator] week=${weekStarting} aggregated=${aggregated} ` +
      `skippedEmpty=${skippedEmpty} skippedSubmitted=${skippedSubmitted}`
  );
  return { aggregated, skippedEmpty, skippedSubmitted };
}

const aggregateDailyToWeeklyCron = functions.pubsub
  .schedule('0 3 * * 1') // Monday 03:00 UTC = Sunday 23:00 Trinidad
  .timeZone('UTC')
  .onRun(async () => {
    const weekStarting = resolveWeekToAggregate(new Date());
    try {
      await runAggregation({
        tenantId: TENANT_ID,
        weekStarting,
        db: admin.firestore(),
      });
    } catch (err) {
      console.error('[sundayAggregator] fatal:', err);
    }
  });

module.exports = {
  aggregateDailyToWeeklyCron,
  // Exposed for manual orchestration / tests.
  runAggregation,
  resolveWeekToAggregate,
  getTriniSundayString,
  draftDocPath,
};

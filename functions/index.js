const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();

const TENANT_ID  = 'tatillife_south';
const SUPER_ADMIN_UID = '4GeeZbhZBwdtGOLoJoggf4MQo142';

// ─────────────────────────────────────────────────────────────────────────────
// Helper — get Sunday date string for a given Date in Trinidad time (UTC-4)
// ─────────────────────────────────────────────────────────────────────────────
function getTriniSundayString(date) {
  // Shift to UTC-4 (Trinidad)
  const trini = new Date(date.getTime() - 4 * 60 * 60 * 1000);
  const day = trini.getUTCDay(); // 0 = Sunday
  const sunday = new Date(trini);
  sunday.setUTCDate(trini.getUTCDate() - day);
  const yyyy = sunday.getUTCFullYear();
  const mm   = String(sunday.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(sunday.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper — write a notification doc via Admin SDK
async function createAdminNotification(tenantId, userId, { type, title, body, link = null }) {
  await admin.firestore()
    .collection(`tenants/${tenantId}/notifications`)
    .add({
      userId,
      tenantId,
      type,
      title,
      body,
      link,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

// Helper — get all submitted agent UIDs for a given weekStarting
async function getSubmittedAgentIds(weekStarting) {
  const snap = await admin.firestore()
    .collection(`tenants/${TENANT_ID}/submissions`)
    .where('weekStarting', '==', weekStarting)
    .where('status', '==', 'submitted')
    .get();
  return new Set(snap.docs.map((d) => d.data().agentId ?? d.data().userId).filter(Boolean));
}

// Helper — get all agent user docs in the tenant
async function getAllAgents() {
  const snap = await admin.firestore()
    .collection(`tenants/${TENANT_ID}/users`)
    .where('role', '==', 'agent')
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING: Set custom claims
// ─────────────────────────────────────────────────────────────────────────────
exports.setUserClaims = functions.https.onCall(async (data, context) => {
  const callerIsSuperAdmin =
    (context.auth && context.auth.token.role === 'super_admin') ||
    (context.auth && context.auth.uid === SUPER_ADMIN_UID);

  if (!callerIsSuperAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only super_admin can set user claims.');
  }

  const { uid, role, tenantId } = data;
  if (!uid || !role || !tenantId) {
    throw new functions.https.HttpsError('invalid-argument', 'uid, role, and tenantId are required.');
  }

  await admin.auth().setCustomUserClaims(uid, { role, tenantId });
  return { success: true };
});

// EXISTING: Log new users
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  console.log('New user created — awaiting role assignment:', user.uid, user.email);
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: Sunday 6 PM Trinidad time (22:00 UTC) — submission reminder
// ─────────────────────────────────────────────────────────────────────────────
exports.sendSundayNudge = functions.pubsub
  .schedule('0 22 * * 0')
  .onRun(async () => {
    try {
      const weekStarting = getTriniSundayString(new Date());
      const submittedIds = await getSubmittedAgentIds(weekStarting);
      const agents       = await getAllAgents();

      const missing = agents.filter((a) => !submittedIds.has(a.id));
      await Promise.all(
        missing.map((a) =>
          createAdminNotification(TENANT_ID, a.id, {
            type:  'submission_reminder',
            title: 'Report Due Tomorrow',
            body:  'Your weekly report is due by Monday 9:00 AM. Submit now to stay on track.',
          }).catch(console.error)
        )
      );

      // Email stub — wire up nodemailer or Firebase Extension here when ready
      // missing.forEach(a => sendReminderEmail(a.email, 'Report Due Tomorrow').catch(console.error));

      console.log(`[sendSundayNudge] Notified ${missing.length} agents for week ${weekStarting}`);
    } catch (err) {
      console.error('[sendSundayNudge]', err);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: Monday 7 AM Trinidad time (11:00 UTC) — 2-hour warning
// ─────────────────────────────────────────────────────────────────────────────
exports.sendMondayNudge = functions.pubsub
  .schedule('0 11 * * 1')
  .onRun(async () => {
    try {
      const weekStarting = getTriniSundayString(new Date());
      const submittedIds = await getSubmittedAgentIds(weekStarting);
      const agents       = await getAllAgents();

      const missing = agents.filter((a) => !submittedIds.has(a.id));
      await Promise.all(
        missing.map((a) =>
          createAdminNotification(TENANT_ID, a.id, {
            type:  'submission_reminder',
            title: '2 Hours Left',
            body:  'Deadline is 9:00 AM today. Submit your report now.',
          }).catch(console.error)
        )
      );

      // Email stub
      // missing.forEach(a => sendReminderEmail(a.email, '2 Hours Left').catch(console.error));

      console.log(`[sendMondayNudge] Notified ${missing.length} agents for week ${weekStarting}`);
    } catch (err) {
      console.error('[sendMondayNudge]', err);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: Monday 9:01 AM Trinidad time (13:01 UTC) — flag missed deadlines
// ─────────────────────────────────────────────────────────────────────────────
exports.flagMissedDeadlines = functions.pubsub
  .schedule('1 13 * * 1')
  .onRun(async () => {
    try {
      const weekStarting = getTriniSundayString(new Date());
      const submittedIds = await getSubmittedAgentIds(weekStarting);
      const agents       = await getAllAgents();

      const missedAgents = agents.filter((a) => !submittedIds.has(a.id));
      if (missedAgents.length === 0) {
        console.log('[flagMissedDeadlines] No missed agents this week.');
        return;
      }

      // Get all managers in the tenant
      const managersSnap = await admin.firestore()
        .collection(`tenants/${TENANT_ID}/users`)
        .where('role', 'in', ['unit_manager', 'branch_manager', 'super_admin'])
        .get();
      const managers = managersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const branchManagerIds = new Set(
        managers.filter((m) => m.role === 'branch_manager' || m.role === 'super_admin').map((m) => m.id)
      );

      // Notify each missed agent + mark their draft
      await Promise.all(
        missedAgents.map(async (agent) => {
          // Mark any existing draft submission
          try {
            const draftSnap = await admin.firestore()
              .collection(`tenants/${TENANT_ID}/submissions`)
              .where('agentId', '==', agent.id)
              .where('weekStarting', '==', weekStarting)
              .where('status', '==', 'draft')
              .get();
            if (!draftSnap.empty) {
              await draftSnap.docs[0].ref.update({ missedDeadline: true });
            }
          } catch (e) {
            console.error(`[flagMissedDeadlines] Draft update failed for ${agent.id}:`, e);
          }

          // Notify the agent
          await createAdminNotification(TENANT_ID, agent.id, {
            type:  'deadline_missed',
            title: 'Deadline Missed',
            body:  'Your weekly report was not submitted by 9:00 AM. Your manager has been notified.',
          }).catch(console.error);

          // Notify unit managers for this agent
          const agentUnit = agent.unitId ?? null;
          const unitManagers = managers.filter(
            (m) => m.role === 'unit_manager' && (!agentUnit || m.unitId === agentUnit)
          );
          await Promise.all(
            unitManagers.map((m) =>
              createAdminNotification(TENANT_ID, m.id, {
                type:  'manager_alert',
                title: 'Agent Missed Deadline',
                body:  `${agent.name ?? agent.email ?? agent.id} did not submit their report this week.`,
              }).catch(console.error)
            )
          );
        })
      );

      // Notify each branch manager once (deduped by UID)
      await Promise.all(
        [...branchManagerIds].map((mid) =>
          createAdminNotification(TENANT_ID, mid, {
            type:  'manager_alert',
            title: 'Agents Missed Deadline',
            body:  `${missedAgents.length} agent${missedAgents.length !== 1 ? 's' : ''} did not submit a report this week.`,
          }).catch(console.error)
        )
      );

      console.log(`[flagMissedDeadlines] Processed ${missedAgents.length} missed agents for week ${weekStarting}`);
    } catch (err) {
      console.error('[flagMissedDeadlines]', err);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER: onWrite — update leaderboard when a submission becomes 'submitted'
// ─────────────────────────────────────────────────────────────────────────────
exports.onSubmissionWrite = functions.firestore
  .document('tenants/{tenantId}/submissions/{subId}')
  .onWrite(async (change, context) => {
    const after  = change.after.exists  ? change.after.data()  : null;
    const before = change.before.exists ? change.before.data() : null;

    // Only process when status transitions TO 'submitted'
    if (!after || after.status !== 'submitted') return;
    if (before && before.status === 'submitted') return;

    const tenantId = context.params.tenantId;
    const agentId  = after.agentId ?? after.userId;
    if (!agentId) return;

    try {
      // ── Compute points ────────────────────────────────────────────────────
      const dials =
        (parseFloat(after.referralCalls)        || 0) +
        (parseFloat(after.followUpCalls)         || 0) +
        (parseFloat(after.coldCalls)             || 0) +
        (parseFloat(after.seminarTradeshowCalls) || 0);
      const ffi  = parseFloat(after.ffiConducted)   || 0;
      const ci   = parseFloat(after.ciConducted)    || 0;
      const apps = parseFloat(after.applicationsSold || after.appsSold) || 0;
      const api  = parseFloat(after.apiSold)        || 0;

      const points =
        Math.floor(dials) * 1 +
        Math.floor(ffi)   * 5 +
        Math.floor(ci)    * 10 +
        Math.floor(apps)  * 25 +
        Math.floor(api / 1000);

      // ── Read current leaderboard doc ──────────────────────────────────────
      const lbRef  = admin.firestore().doc(`tenants/${tenantId}/leaderboard/${agentId}`);
      const lbSnap = await lbRef.get();
      const lb     = lbSnap.exists ? lbSnap.data() : {};

      const prevPoints = parseFloat(lb.points) || 0;
      const newPoints  = prevPoints + points;

      // ── Gamification level ────────────────────────────────────────────────
      const LEVELS = [
        { min: 0,    title: 'Rookie'    },
        { min: 100,  title: 'Associate' },
        { min: 250,  title: 'Pro'       },
        { min: 500,  title: 'Elite'     },
        { min: 1000, title: 'Legend'    },
      ];
      const levelEntry = [...LEVELS].reverse().find((l) => newPoints >= l.min) ?? LEVELS[0];
      const prevLevelEntry = [...LEVELS].reverse().find((l) => prevPoints >= l.min) ?? LEVELS[0];

      // ── Weekly streak ─────────────────────────────────────────────────────
      const weekStarting = after.weekStarting;
      let streak = 1;
      let checkWeek = weekStarting;
      for (let i = 0; i < 52; i++) {
        const d = new Date(checkWeek + 'T00:00:00');
        d.setDate(d.getDate() - 7);
        const prevWeek = d.toISOString().slice(0, 10);
        const prevSnap = await admin.firestore()
          .collection(`tenants/${tenantId}/submissions`)
          .where('agentId', '==', agentId)
          .where('weekStarting', '==', prevWeek)
          .where('status', '==', 'submitted')
          .limit(1)
          .get();
        if (prevSnap.empty) break;
        streak++;
        checkWeek = prevWeek;
      }

      // ── Badge eligibility ─────────────────────────────────────────────────
      const existingBadges = new Set(lb.badges ?? []);
      const newBadges = [];

      const addIfNew = (key) => {
        if (!existingBadges.has(key)) { existingBadges.add(key); newBadges.push(key); }
      };

      // first_submission
      if (!lb.badges || lb.badges.length === 0) addIfNew('first_submission');

      // Streak badges
      if (streak >= 4)  addIfNew('streak_4');
      if (streak >= 8)  addIfNew('streak_8');
      if (streak >= 13) addIfNew('streak_13');

      // Per-submission badges
      if (apps >= 5)   addIfNew('top_apps_week');
      if (api >= 20000) addIfNew('big_week');
      if (dials >= 100) addIfNew('century_dials');

      // YTD API badges
      const ytdSnap = await admin.firestore()
        .collection(`tenants/${tenantId}/submissions`)
        .where('agentId', '==', agentId)
        .where('status', '==', 'submitted')
        .get();
      const thisYear = new Date().getFullYear();
      const ytdAPI = ytdSnap.docs
        .filter((d) => d.data().weekStarting?.startsWith(String(thisYear)))
        .reduce((sum, d) => sum + (parseFloat(d.data().apiSold) || 0), 0);

      if (ytdAPI >= 500000) {
        addIfNew('mdrt_qualified');
      } else {
        const weekOfYear = Math.ceil(
          (Date.now() - new Date(thisYear, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        if (weekOfYear <= 26 && ytdAPI >= 250000) addIfNew('mdrt_pace');
      }

      // ── Write leaderboard doc ─────────────────────────────────────────────
      await lbRef.set(
        {
          userId:      agentId,
          tenantId,
          agentName:   after.agentName ?? lb.agentName ?? agentId,
          points:      newPoints,
          level:       LEVELS.indexOf(levelEntry) + 1,
          levelTitle:  levelEntry.title,
          badges:      [...existingBadges],
          weeklyStreak: streak,
          updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // ── Notifications ─────────────────────────────────────────────────────
      await Promise.all([
        // Badge earned notifications
        ...newBadges.map((key) =>
          createAdminNotification(tenantId, agentId, {
            type:  'badge_earned',
            title: 'Badge Earned!',
            body:  `You earned the "${key.replace(/_/g, ' ')}" badge. Keep it up!`,
          }).catch(console.error)
        ),
        // Level-up notification
        ...(levelEntry.title !== prevLevelEntry.title
          ? [createAdminNotification(tenantId, agentId, {
              type:  'level_up',
              title: 'Level Up!',
              body:  `You've reached ${levelEntry.title}! Keep submitting to climb higher.`,
            }).catch(console.error)]
          : []),
      ]);

      console.log(`[onSubmissionWrite] Agent ${agentId}: +${points} pts, streak ${streak}, new badges: ${newBadges.join(', ') || 'none'}`);
    } catch (err) {
      console.error('[onSubmissionWrite]', err);
    }
  });

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { isValidEmail } = require('./utils/validators');

// Load service account credentials when available (required for createCustomToken).
// The App Engine default service account lacks iam.serviceAccounts.signBlob by
// default; explicit credentials bypass that IAM limitation.
const saKeyPath = require('path').join(__dirname, 'service-account-key.json');
try {
  const serviceAccount = require(saKeyPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch {
  admin.initializeApp();
}

const { aggregateDailyToWeeklyCron } = require('./aggregators/sundayDailyToWeekly');
exports.aggregateDailyToWeekly = aggregateDailyToWeeklyCron;

// E5: TV Display Kiosk Mode — token-based public display
exports.validateKioskToken = require('./kiosk/validateToken').validateKioskToken;
exports.createKioskToken   = require('./kiosk/createToken').createKioskToken;
exports.revokeKioskToken   = require('./kiosk/revokeToken').revokeKioskToken;

// E6: Agent of the Month — manager-approved monthly recognition
exports.setAgentOfMonth          = require('./agentOfMonth/setAgentOfMonth').setAgentOfMonth;
exports.getAgentOfMonthCandidates = require('./agentOfMonth/getCandidates').getAgentOfMonthCandidates;

const TENANT_ID = 'tatillife_south'; // SEC-9c: hardcoded; scheduled-function isolation deferred

// CSV bulk-import allow-list. tenant_admin and platform_admin are explicitly
// excluded for security — those roles must be provisioned manually via the
// single-user UI (which has typed-confirmation guards).
const CSV_IMPORTABLE_ROLES = ['agent', 'unit_manager', 'branch_manager', 'sales_manager'];

// Hard limit on a single bulk-import call. Tatil pilot is ≈ 50–80 rows; the
// 500 ceiling fits comfortably inside the 540s Callable budget at the slow
// end of doCreateUser (~600–1200ms/row).
const MAX_BULK_ROWS = 500;

// Roles that may target a specific branchId on user creation (vs. inheriting
// the caller's branchId). Used by doCreateUser to decide whether to honor
// data.branchId. Mirrors the deriveOwnedBranchIds wildcard rule.
const CROSS_BRANCH_ROLES = ['platform_admin', 'tenant_admin', 'sales_manager'];

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

// Helper — get all agent user docs in the tenant (excludes provisioning)
async function getAllAgents() {
  const snap = await admin.firestore()
    .collection(`tenants/${TENANT_ID}/users`)
    .where('role', '==', 'agent')
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.provisioning !== true);
}

// ─────────────────────────────────────────────────────────────────────────────
// PR-2: User-management helpers
// ─────────────────────────────────────────────────────────────────────────────

// Who can create whom. Deactivation uses the same matrix (can-create ↔ can-deactivate).
const CREATION_MATRIX = {
  platform_admin: ['platform_admin', 'tenant_admin', 'sales_manager', 'branch_manager', 'unit_manager', 'agent'],
  tenant_admin:   ['tenant_admin', 'sales_manager', 'branch_manager', 'unit_manager', 'agent'],
  sales_manager:  ['branch_manager', 'unit_manager', 'agent'],
  branch_manager: ['unit_manager', 'agent'],
  unit_manager:   ['agent'],
};

function deriveOwnedBranchIds(targetRole, callerBranchId) {
  if (['platform_admin', 'tenant_admin', 'sales_manager'].includes(targetRole)) return ['*'];
  if (targetRole === 'branch_manager' || targetRole === 'unit_manager') return [callerBranchId];
  return null; // agents: field absent
}

function buildDocFields(targetRole, data, { newUid, callerTenant, derivedBranchId, derivedOwnedBranchIds, callerUid }) {
  // platform_admin lives outside tenants — no Firestore user doc.
  if (targetRole === 'platform_admin') return null;

  const doc = {
    uid:          newUid,
    tenantId:     callerTenant,
    role:         targetRole,
    name:         data.name,
    email:        data.email,
    branchId:     derivedBranchId,
    active:       true,
    provisioning: true,
    createdAt:    admin.firestore.FieldValue.serverTimestamp(),
    createdBy:    callerUid,
  };
  if (derivedOwnedBranchIds) doc.ownedBranchIds = derivedOwnedBranchIds;

  // Track C C2 — cross-role optional fields. Single-user flow never sets these,
  // so its behavior is unchanged. Bulk import populates them from CSV columns.
  if (typeof data.phone === 'string' && data.phone)             doc.phone = data.phone;
  if (typeof data.bio === 'string' && data.bio)                 doc.bio = data.bio;
  if (typeof data.careerLevel === 'string' && data.careerLevel) doc.careerLevel = data.careerLevel;

  // Track C C2 — bulk-import audit trail. Stamped only when the caller passes
  // them (bulkImportUsers always does; single-user flow never does).
  if (typeof data.csvImportBatchId === 'string' && data.csvImportBatchId) {
    doc.csvImportBatchId = data.csvImportBatchId;
  }
  if (data.importedFromCsv === true) {
    doc.importedFromCsv = true;
  }

  if (targetRole === 'agent') {
    doc.agentNumber       = data.agentNumber ?? '';
    doc.unitId            = data.unitId;
    doc.contractStartDate = data.contractStartDate ?? '';
    doc.hasSeenWelcome    = false;
  } else if (targetRole === 'unit_manager') {
    doc.unitId = newUid; // unit_manager's own UID is their unit identifier
    if (data.unitName) doc.unitName = data.unitName;
  }
  return doc;
}

function buildClaims(targetRole, { callerTenant, derivedBranchId, derivedOwnedBranchIds }) {
  // platform_admin has no tenant scope — claim shape is { role, tenantId: null }.
  if (targetRole === 'platform_admin') return { role: 'platform_admin', tenantId: null };
  const claims = { role: targetRole, tenantId: callerTenant, branchId: derivedBranchId };
  if (derivedOwnedBranchIds) claims.ownedBranchIds = derivedOwnedBranchIds;
  return claims;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core user-creation saga — called by createUser.
// ─────────────────────────────────────────────────────────────────────────────
async function doCreateUser(data, context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const callerRole   = context.auth.token.role;
  const callerUid    = context.auth.uid;
  const callerTenant = context.auth.token.tenantId;
  const targetRole   = data.role;

  // ── Input validation (before any I/O) ─────────────────────────────────────

  if (!CREATION_MATRIX[callerRole]?.includes(targetRole)) {
    throw new functions.https.HttpsError(
      'permission-denied', `${callerRole} cannot create ${targetRole}.`
    );
  }

  // Cross-tenant user creation via CF deferred to SEC-9b.
  // platform_admin accounts are provisioned via seed-platform-admin.cjs until then.
  if (callerRole === 'platform_admin') {
    throw new functions.https.HttpsError(
      'unimplemented',
      'Cross-tenant user creation ships in SEC-9b. Use seed-platform-admin.cjs to provision platform_admin accounts.'
    );
  }

  if (targetRole === 'tenant_admin' && data.confirmationPhrase !== 'CREATE TENANT ADMIN') {
    throw new functions.https.HttpsError(
      'invalid-argument', 'Typed confirmation required to create a tenant_admin account.'
    );
  }

  if (targetRole === 'agent' && !data.unitId) {
    throw new functions.https.HttpsError('invalid-argument', 'unitId is required for agent accounts.');
  }

  if (!data.name || !data.email) {
    throw new functions.https.HttpsError('invalid-argument', 'name and email are required.');
  }

  // ── Step 1: read caller profile — branchId derivation + email for audit ───
  const callerSnap = await admin.firestore()
    .doc(`tenants/${callerTenant}/users/${callerUid}`)
    .get();
  const callerData = callerSnap.exists ? callerSnap.data() : null;

  // Track C C2: cross-branch callers (tenant_admin / platform_admin / sales_manager)
  // may target a specific branchId on the new user — used by bulkImportUsers to
  // place each row into the branch resolved from its CSV branchName column.
  // bulkImportUsers validates data.branchId against the active-branch Set
  // before invoking; this honor is gated on caller role as defense-in-depth.
  // Single-user UI never passes data.branchId, so its behavior is unchanged.
  let derivedBranchId;
  if (data.branchId && CROSS_BRANCH_ROLES.includes(callerRole)) {
    derivedBranchId = data.branchId;
  } else {
    derivedBranchId = callerData?.branchId;
    if (!derivedBranchId) {
      console.warn('[createUser] caller missing branchId; falling back to tatil_south. Migration may not have run.');
      derivedBranchId = 'tatil_south';
    }
  }

  // ── Step 2: unit scoping — unit_manager can only create in their own unit ──
  if (callerRole === 'unit_manager') {
    const callerUnitId = callerData?.unitId;
    if (data.unitId !== callerUnitId) {
      throw new functions.https.HttpsError(
        'permission-denied', 'Unit managers can only create users in their own unit.'
      );
    }
  }

  // ── Step 3: email uniqueness ───────────────────────────────────────────────
  try {
    await admin.auth().getUserByEmail(data.email);
    throw new functions.https.HttpsError('already-exists', 'An account with this email already exists.');
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }

  const derivedOwnedBranchIds = deriveOwnedBranchIds(targetRole, derivedBranchId);

  // ── Saga step A: create Auth user ─────────────────────────────────────────
  const userRecord = await admin.auth().createUser({
    email:         data.email,
    displayName:   data.name,
    emailVerified: false,
  });
  const newUid = userRecord.uid;

  const docRef = admin.firestore().doc(`tenants/${callerTenant}/users/${newUid}`);

  // ── Saga step B: first Firestore write — provisioning: true ───────────────
  // Doc is hidden from all UI list reads by the provisioning !== true filter.
  await docRef.set(
    buildDocFields(targetRole, data, { newUid, callerTenant, derivedBranchId, derivedOwnedBranchIds, callerUid })
  );

  // ── Saga step C: set custom claims ────────────────────────────────────────
  // On failure: compensating delete of doc + auth user; throw to caller.
  try {
    await admin.auth().setCustomUserClaims(
      newUid,
      buildClaims(targetRole, { callerTenant, derivedBranchId, derivedOwnedBranchIds })
    );
  } catch (claimErr) {
    console.error('[createUser] setCustomUserClaims failed; running compensating delete:', claimErr);
    await docRef.delete().catch((e) => console.error('[saga] doc cleanup failed:', e));
    await admin.auth().deleteUser(newUid).catch((e) => console.error('[saga] auth cleanup failed:', e));
    throw new functions.https.HttpsError('internal', 'Account provisioning failed; please retry.');
  }

  // ── Saga step D (atomic): clear provisioning flag + audit log ─────────────
  // Atomic for all roles: a stranded provisioning:true doc is data-debt.
  // For tenant_admin: audit write failure also rolls back — an un-audited
  // admin account in the system is worse than a caller retry.
  try {
    await docRef.update({ provisioning: admin.firestore.FieldValue.delete() });

    if (['tenant_admin', 'platform_admin'].includes(targetRole)) {
      await admin.firestore().collection('auditAdminCreations').add({
        targetRole,
        tenantId:          callerTenant,
        creatorUid:        callerUid,
        creatorEmail:      callerData?.email ?? null,
        createdUid:        newUid,
        createdEmail:      data.email,
        createdName:       data.name,
        confirmationGiven: data.confirmationPhrase,
        ip:                context.rawRequest?.ip ?? null,
        userAgent:         context.rawRequest?.headers?.['user-agent'] ?? null,
        timestamp:         admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (sagaErr) {
    console.error('[createUser] saga step D failed; running compensating delete:', sagaErr);
    await docRef.delete().catch((e) => console.error('[saga] doc cleanup failed:', e));
    await admin.auth().deleteUser(newUid).catch((e) => console.error('[saga] auth cleanup failed:', e));
    throw new functions.https.HttpsError('internal', 'Account provisioning failed; please retry.');
  }

  // ── Side effects (best-effort, do not fail the saga) ──────────────────────
  // Password-reset email is dispatched client-side from agentManagementService.createUser
  // after this callable returns. The Admin SDK has no equivalent of
  // sendPasswordResetEmail (generatePasswordResetLink only returns a string with no
  // delivery), so the email is triggered from the caller's Firebase Auth client.
  await createAdminNotification(callerTenant, newUid, {
    type:  'account_created',
    title: 'Welcome to AgencyTrack',
    body:  'Your account has been created. Check your email to set your password and get started.',
  }).catch(console.error);

  console.log(`[createUser] Created ${targetRole} ${newUid} (${data.email}) by ${callerRole} ${callerUid}`);
  return { success: true, uid: newUid };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING: Set custom claims — tenant_admin / platform_admin only, operator
// escape hatch. SUPER_ADMIN_UID bypass removed in PR-2. Claims are now seeded
// via seed-first-tenant-admin.cjs for new tenants and maintained by createUser.
// ─────────────────────────────────────────────────────────────────────────────
exports.setUserClaims = functions.https.onCall(async (data, context) => {
  if (!context.auth || !['platform_admin', 'tenant_admin'].includes(context.auth.token.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Only tenant_admin or platform_admin can set user claims.');
  }

  const { uid, role, tenantId, branchId, ownedBranchIds } = data;
  if (!uid || !role || !tenantId) {
    throw new functions.https.HttpsError('invalid-argument', 'uid, role, and tenantId are required.');
  }

  const claims = { role, tenantId };
  if (branchId) claims.branchId = branchId;
  if (Array.isArray(ownedBranchIds)) claims.ownedBranchIds = ownedBranchIds;

  await admin.auth().setCustomUserClaims(uid, claims);
  return { success: true };
});

// EXISTING: Log new users — skip if profile already created by createUser
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  const existing = await admin.firestore()
    .doc(`tenants/${TENANT_ID}/users/${user.uid}`)
    .get()
    .catch(() => null);

  if (existing?.exists) {
    console.log('[onUserCreated] Profile already exists, skipping:', user.uid);
    return;
  }
  console.log('[onUserCreated] New user — awaiting role assignment:', user.uid, user.email);
});

// ─────────────────────────────────────────────────────────────────────────────
// PR-2: Polymorphic createUser — full creation matrix
// ─────────────────────────────────────────────────────────────────────────────
exports.createUser = functions.https.onCall(doCreateUser);

// ─────────────────────────────────────────────────────────────────────────────
// Track C C2: bulkImportUsers — wraps doCreateUser in a per-row loop.
//
// Caller (tenant_admin or platform_admin) uploads a CSV via the
// BulkImportUsersModal; the client pre-validates, resolves branchName →
// branchId against the active-branch Set, and POSTs the validated rows
// here. This Callable re-validates everything as defense-in-depth, then
// calls doCreateUser per row inside try/catch — a failure in row N does
// NOT affect row N+1. Returns per-row results; the client renders them
// in the Step 4 summary and offers a downloadable error CSV for re-import.
//
// Timeout extended to 540s (v1 max) to fit the worst-case 500-row import.
// Pilot CSV size (~ 50–80 rows) lands well under this; the extension is
// defensive coding for outliers.
//
// Password-reset emails dispatched client-side per row after the call
// returns — mirrors the HIGH#1 single-user path. The Admin SDK has no
// equivalent of sendPasswordResetEmail (generatePasswordResetLink only
// returns a string with no delivery), so client-side dispatch is the
// architectural floor.
// ─────────────────────────────────────────────────────────────────────────────
exports.bulkImportUsers = functions
  .runWith({ timeoutSeconds: 540, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }

    const callerRole   = context.auth.token.role;
    const callerUid    = context.auth.uid;
    const callerTenant = context.auth.token.tenantId;

    if (!['tenant_admin', 'platform_admin'].includes(callerRole)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only tenant_admin or platform_admin can bulk import users.'
      );
    }

    // platform_admin cross-tenant import deferred to SEC-9b (parallel to
    // doCreateUser's existing block). Pilot scope is single-tenant.
    if (callerRole === 'platform_admin') {
      throw new functions.https.HttpsError(
        'unimplemented',
        'Cross-tenant bulk import via CF deferred to SEC-9b. Use the tenant_admin path.'
      );
    }

    const users = Array.isArray(data?.users) ? data.users : null;
    if (!users) {
      throw new functions.https.HttpsError('invalid-argument', 'users array required.');
    }
    if (users.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'No rows to import.');
    }
    if (users.length > MAX_BULK_ROWS) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Maximum ${MAX_BULK_ROWS} rows per import.`
      );
    }

    const csvImportBatchId = typeof data?.csvImportBatchId === 'string' ? data.csvImportBatchId : null;
    if (!csvImportBatchId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'csvImportBatchId required (UUID v4 from client).'
      );
    }

    // ── Pre-flight: load active branches once, build Set, fail fast if empty.
    //   Single Firestore read for the whole import; per-row validation is
    //   then a Set.has() lookup. Q10 server backstop — Q10's client-side
    //   empty-state guard is the friendly path; this is the defense-in-depth.
    const branchSnap = await admin.firestore()
      .collection(`tenants/${callerTenant}/branches`)
      .where('isActive', '==', true)
      .get();

    if (branchSnap.empty) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No active branches in tenant. Create at least one branch first.'
      );
    }

    const activeBranchIds = new Set(branchSnap.docs.map((d) => d.id));

    console.log(
      `[bulkImportUsers] Starting import: ${users.length} rows, ` +
      `${activeBranchIds.size} active branches, batch ${csvImportBatchId}, ` +
      `caller ${callerRole} ${callerUid}`
    );

    // ── Per-row loop with try/catch. Each row's outcome is captured atomically.
    const results = [];
    for (let i = 0; i < users.length; i++) {
      const row = users[i] ?? {};
      const rowResult = {
        rowIndex: i,
        email: typeof row.email === 'string' ? row.email : '',
      };

      try {
        // Server-side defense-in-depth re-validation. Mirrors client checks
        // but cannot be bypassed by a malicious client.
        if (!isValidEmail(row.email)) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Invalid email format.'
          );
        }
        if (!CSV_IMPORTABLE_ROLES.includes(row.role)) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            `Role '${row.role ?? '(missing)'}' is not importable via CSV.`
          );
        }
        if (!row.branchId || !activeBranchIds.has(row.branchId)) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'branchId is not in the tenant\'s active branches.'
          );
        }

        // Hand off to the existing single-user saga. doCreateUser honors
        // data.branchId for cross-branch callers and stamps csvImportBatchId
        // + importedFromCsv on the user doc via buildDocFields.
        const result = await doCreateUser(
          { ...row, csvImportBatchId, importedFromCsv: true },
          context
        );

        rowResult.success = true;
        rowResult.uid = result.uid;
      } catch (err) {
        rowResult.success = false;
        rowResult.error = err?.message ?? String(err);
        rowResult.code = err?.code ?? null;
      }
      results.push(rowResult);
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;
    console.log(
      `[bulkImportUsers] Complete: ${successCount} succeeded, ${failureCount} failed, ` +
      `batch ${csvImportBatchId}`
    );

    return { results, csvImportBatchId };
  });

// ─────────────────────────────────────────────────────────────────────────────
// PR-2: deactivateUser — soft-delete (active: false) with immediate
// refresh-token revocation, or reactivation (active: true).
// ─────────────────────────────────────────────────────────────────────────────
exports.deactivateUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const callerRole   = context.auth.token.role;
  const callerUid    = context.auth.uid;
  const callerTenant = context.auth.token.tenantId;
  const { targetUid, active, reason } = data;

  if (!targetUid || typeof active !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'targetUid and active (boolean) are required.');
  }

  // Self-deactivation hard-blocked for any role
  if (targetUid === callerUid) {
    throw new functions.https.HttpsError('permission-denied', 'Cannot deactivate your own account.');
  }

  // Read target user doc — establishes tenant isolation + target role
  const targetRef  = admin.firestore().doc(`tenants/${callerTenant}/users/${targetUid}`);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Target user not found in this tenant.');
  }
  const targetData = targetSnap.data();

  // Belt-and-suspenders: doc tenantId must match caller's token tenantId
  if (targetData.tenantId !== callerTenant) {
    throw new functions.https.HttpsError('permission-denied', 'Cannot deactivate a user in a different tenant.');
  }

  const targetRole = targetData.role;

  // Deactivation matrix — same as creation matrix
  if (!CREATION_MATRIX[callerRole]?.includes(targetRole)) {
    throw new functions.https.HttpsError(
      'permission-denied', `${callerRole} cannot deactivate ${targetRole}.`
    );
  }

  const updatePayload = {
    active,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: callerUid,
  };
  if (reason !== undefined) {
    updatePayload.deactivationReason = active ? null : (reason ?? null);
  }

  await targetRef.update(updatePayload);

  if (!active) {
    // Revoke all refresh tokens — forces the deactivated user to sign out immediately.
    // Their next login attempt will fail because active:false blocks the app UI.
    await admin.auth().revokeRefreshTokens(targetUid);
    console.log(`[deactivateUser] Deactivated + revoked tokens for ${targetUid} (${targetRole}) by ${callerRole} ${callerUid}`);
  } else {
    console.log(`[deactivateUser] Reactivated ${targetUid} (${targetRole}) by ${callerRole} ${callerUid}`);
  }

  return { success: true };
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

      // Get all managers in the tenant (PR-3: tenant_admin replaces super_admin, exclude provisioning)
      const managersSnap = await admin.firestore()
        .collection(`tenants/${TENANT_ID}/users`)
        .where('role', 'in', ['unit_manager', 'branch_manager', 'sales_manager', 'tenant_admin'])
        .get();
      const managers = managersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.provisioning !== true);
      const branchManagerIds = new Set(
        managers.filter((m) => m.role === 'branch_manager' || m.role === 'tenant_admin').map((m) => m.id)
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
          userId:       agentId,
          tenantId,
          agentName:    after.agentName ?? lb.agentName ?? agentId,
          points:       newPoints,
          level:        LEVELS.indexOf(levelEntry) + 1,
          levelTitle:   levelEntry.title,
          badges:       [...existingBadges],
          weeklyStreak: streak,
          updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
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

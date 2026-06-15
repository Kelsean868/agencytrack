import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db, storage } from '../firebase';

export async function updateUserProfile(tenantId, uid, fields) {
  const docRef = doc(db, `tenants/${tenantId}/users/${uid}`);
  await updateDoc(docRef, { ...fields, updatedAt: serverTimestamp() });
}

// PR-4: client-side allowlist mirroring the tightened manager-update rule in
// firestore.rules. Defense-in-depth — the rules layer is authoritative, but
// catching disallowed fields client-side surfaces accidental misuse with a
// clear error message instead of a Firestore PERMISSION_DENIED. Keep this
// list in lockstep with firestore.rules `allow update` manager-path allowlist.
export const MANAGER_EDITABLE_FIELDS = Object.freeze([
  'name', 'phone', 'bio',
  'unitId', 'unitName',
  'agentNumber', 'contractStartDate',
  'canConfirmSettlements',
  'licenseStatus', 'cbttExamPassedDate', 'cbttExtensionGranted', 'licenseProfile',
]);

/**
 * updateUserFields(uid, fields)
 *
 * Manager-edit pathway for non-claim, non-lifecycle user fields. Writes
 * directly to the user doc with the standard updatedAt/updatedBy audit
 * stamp. Throws if any field outside the allowlist is included so the UI
 * cannot accidentally try to set role/branchId/active/email here.
 *
 * Role + branchId + ownedBranchIds: PR-4b (updateUser Cloud Function with
 * claim-refresh atomicity). Until that ships, those fields remain a
 * Firebase Console workaround.
 * `active` toggle: continues to flow through agentManagementService.deactivateUser.
 * `email` changes: deferred entirely.
 */
export async function updateUserFields(tenantId, uid, fields) {
  if (!uid) throw new Error('uid is required.');
  if (!fields || typeof fields !== 'object') throw new Error('fields object is required.');

  const keys = Object.keys(fields);
  if (keys.length === 0) throw new Error('No fields to update.');

  const disallowed = keys.filter((k) => !MANAGER_EDITABLE_FIELDS.includes(k));
  if (disallowed.length > 0) {
    throw new Error(
      `Disallowed field(s) for manager edit: ${disallowed.join(', ')}. ` +
      `Editable: ${MANAGER_EDITABLE_FIELDS.join(', ')}.`
    );
  }

  const callerUid = auth.currentUser?.uid;
  if (!callerUid) throw new Error('Not signed in.');

  const docRef = doc(db, `tenants/${tenantId}/users/${uid}`);
  await updateDoc(docRef, {
    ...fields,
    updatedAt: serverTimestamp(),
    updatedBy: callerUid,
  });
}

/**
 * setAppearOnLeaderboard(tenantId, uid, appear)
 *
 * Writes ONLY appearOnLeaderboard — BM self opt-in for the production
 * leaderboard. Must NOT be bundled with MANAGER_EDITABLE_FIELDS writes;
 * the rules hasOnly check is strict per field.
 */
export async function setAppearOnLeaderboard(tenantId, uid, appear) {
  if (!tenantId) throw new Error('tenantId is required.');
  if (!uid) throw new Error('uid is required.');
  const docRef = doc(db, `tenants/${tenantId}/users/${uid}`);
  await updateDoc(docRef, { appearOnLeaderboard: Boolean(appear) });
}

// PR-4b: claim-keyed fields that flow through the updateUser CF, NOT through
// updateUserFields. Kept separate from MANAGER_EDITABLE_FIELDS because the
// CF performs server-side validation + claim+doc atomicity that direct
// Firestore writes cannot.
export const CLAIM_KEYED_FIELDS = Object.freeze(['role', 'branchId']);

/**
 * callUpdateUser({ uid, updates, confirmationPhrase? })
 *
 * Invokes the updateUser Cloud Function for role/branchId edits. The CF
 * writes the new custom claims and Firestore doc atomically, then revokes
 * the target user's refresh tokens so the new permissions take effect on
 * their next sign-in (immediate forced sign-out, per Q1 lock).
 *
 * `updates` may include `role`, `branchId`, and optionally `unitId` (required
 * when demoting to agent). Other field names are rejected server-side.
 *
 * `confirmationPhrase` is required and must equal "PROMOTE TO TENANT ADMIN"
 * when updates.role === 'tenant_admin'.
 *
 * Returns the CF response: { success: true, updatedFields: [...] }.
 * Throws Firebase HttpsError on validation, permission, or saga failure;
 * EditUserDrawer maps the error codes to user-facing toast copy.
 */
export async function callUpdateUser({ uid, updates, confirmationPhrase } = {}) {
  if (!uid) throw new Error('uid is required.');
  if (!updates || typeof updates !== 'object') throw new Error('updates object is required.');

  const fns = getFunctions();
  const fn = httpsCallable(fns, 'updateUser');
  const payload = { uid, updates };
  if (confirmationPhrase) payload.confirmationPhrase = confirmationPhrase;
  const result = await fn(payload);
  return result.data;
}

/**
 * resendInvite(uid)
 *
 * Invokes the resendInviteEmail Cloud Function, which queues a fresh
 * password-reset email to the target user via the same mail/ template
 * path createUser uses (visual styling consistency) and writes an audit
 * entry to auditInviteResends. Replaces the prior client-side
 * sendPasswordReset() call from UserManagementPanel.
 *
 * Returns the CF response: { success: true, targetUid, targetEmail, emailQueued, emailError? }.
 * Throws Firebase HttpsError on auth / permission / not-found / mail-queue failure.
 */
export async function resendInvite(uid) {
  if (!uid) throw new Error('uid is required.');
  const fns = getFunctions();
  const fn = httpsCallable(fns, 'resendInviteEmail');
  const result = await fn({ uid });
  return result.data;
}

export async function getInviteLink(uid) {
  if (!uid) throw new Error('uid is required.');
  const fns = getFunctions();
  const fn = httpsCallable(fns, 'resendInviteEmail');
  const result = await fn({ uid, channel: 'link' });
  return result.data.link;
}

// Compress an image File/Blob to maxDim × maxDim, returns a Blob (image/jpeg)
export function compressImage(file, maxDim = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed'));
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Upload compressed blob to Storage, update photoURL in Firestore
// onProgress: (0–100) => void
export function uploadProfilePhoto(tenantId, uid, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `avatars/${tenantId}/${uid}.jpg`);
    const task = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });

    task.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        onProgress?.(pct);
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          await updateUserProfile(tenantId, uid, { photoURL: url });
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

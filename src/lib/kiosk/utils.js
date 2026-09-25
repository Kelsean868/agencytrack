// Pure utilities shared by Avatar.jsx and kiosk tests.
// Cloud Functions duplicate the validateTokenData logic inline (they run CJS, can't import from src/).

const PALETTE = [
  '#01696f', // primary teal
  '#6b3a2a', // warm brown
  '#2a4a7c', // deep blue
  '#4a2a7c', // purple
  '#2a7c4a', // forest green
  '#7c2a5a', // wine
  '#5a6b2a', // olive
  '#7c4a2a', // terracotta
];

function hashUid(uid) {
  let h = 0;
  for (let i = 0; i < (uid?.length ?? 0); i++) {
    h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function avatarColor(uid) {
  return PALETTE[hashUid(uid) % PALETTE.length];
}

export function deriveInitials(name) {
  if (!name?.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// SEC-012 — privacy-safe agent-name fallback for the kiosk wall.
//
// The kiosk auth context can `get` a single user doc (firestore.rules users
// `get` has a branch-scoped kiosk arm) but CANNOT `list` the users collection
// (the users `list` arm grants only `canManage` — the SHAKEDOWN-002 read-split
// intentionally dropped the kiosk list arm, and re-adding one would widen bulk
// email/phone enumeration to a lobby token). So `getKioskTenantUsers` is denied
// and KioskShell degrades `allUsers` to [], collapsing every roster-derived name
// to the generic "Agent".
//
// Submissions ALREADY carry `agentName` (written by submissionService
// submitReport / saveDraft) and are already kiosk-readable (branch-scoped
// submissions list). Building a name lookup from them adds NO new read surface
// and surfaces NO field beyond the display name the wall already shows — so it
// is a privacy-safe fallback that needs no rules change. Returns a
// Map<agentId, name>; first non-empty agentName per agent wins (a given agent's
// submissions all carry the same name).
export function buildSubmissionNameMap(submissions) {
  const map = new Map();
  for (const s of submissions ?? []) {
    const aid = s?.agentId ?? s?.userId;
    if (!aid || map.has(aid)) continue;
    const name = typeof s?.agentName === 'string' ? s.agentName.trim() : '';
    if (name) map.set(aid, name);
  }
  return map;
}

// Token validation — mirrors the logic in functions/kiosk/validateToken.js.
// `data` is the Firestore document data object. `now` is injectable for tests.
export function validateTokenData(data, tenantId, now = new Date()) {
  if (!data) return { valid: false, reason: 'invalid' };
  if (data.tenantId !== tenantId) return { valid: false, reason: 'invalid' };
  if (data.revokedAt) return { valid: false, reason: 'revoked' };
  // SEC-03: a token with no (or an unreadable) expiresAt is invalid — it used
  // to be valid forever. createKioskToken always writes one.
  if (!data.expiresAt) return { valid: false, reason: 'expired' };
  const expiry =
    typeof data.expiresAt.toDate === 'function'
      ? data.expiresAt.toDate()
      : new Date(data.expiresAt);
  if (Number.isNaN(expiry.getTime()) || expiry < now) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, tenantId: data.tenantId, branchId: data.branchId };
}

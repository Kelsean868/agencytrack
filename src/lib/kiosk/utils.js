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

// Token validation — mirrors the logic in functions/kiosk/validateToken.js.
// `data` is the Firestore document data object. `now` is injectable for tests.
export function validateTokenData(data, tenantId, now = new Date()) {
  if (!data) return { valid: false, reason: 'invalid' };
  if (data.tenantId !== tenantId) return { valid: false, reason: 'invalid' };
  if (data.revokedAt) return { valid: false, reason: 'revoked' };
  if (data.expiresAt) {
    const expiry =
      typeof data.expiresAt.toDate === 'function'
        ? data.expiresAt.toDate()
        : new Date(data.expiresAt);
    if (expiry < now) return { valid: false, reason: 'expired' };
  }
  return { valid: true, tenantId: data.tenantId, branchId: data.branchId };
}

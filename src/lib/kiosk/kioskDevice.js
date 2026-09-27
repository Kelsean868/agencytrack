/**
 * kioskDevice.js — the kiosk's device secret (P2e, audit 2026-09-24 SEC-04).
 *
 * The first time a kiosk link is opened, validateKioskToken binds it to that
 * device and returns a secret once. The kiosk keeps it here and presents it on
 * every later load; a link opened on any other device is refused.
 *
 * Stored in localStorage (the kiosk's Firebase Auth is in-memory on purpose,
 * but the page itself persists). Keyed per tenant + token, so a TV that has
 * shown two links keeps both pairings. Every access is guarded: a browser that
 * blocks storage (private window, storage disabled) reports `false` from
 * saveDeviceSecret so the kiosk can say plainly why it cannot stay paired.
 */

const PREFIX = 'agencytrack-kiosk-device';

function keyFor(tenantId, tokenId) {
  // The first 16 characters identify the link without writing the whole
  // bearer token into storage keys.
  return `${PREFIX}:${tenantId}:${String(tokenId).slice(0, 16)}`;
}

/** The stored secret for this link, or null. */
export function loadDeviceSecret(tenantId, tokenId) {
  try {
    return window.localStorage.getItem(keyFor(tenantId, tokenId));
  } catch {
    return null;
  }
}

/** Store the secret for this link. False when the browser will not keep it. */
export function saveDeviceSecret(tenantId, tokenId, secret) {
  try {
    const key = keyFor(tenantId, tokenId);
    window.localStorage.setItem(key, secret);
    return window.localStorage.getItem(key) === secret;
  } catch {
    return false;
  }
}

/**
 * appCheck.js — Firebase App Check for the web client (P2e, audit 2026-09-24
 * SEC-11). MONITOR MODE: this only makes the client ATTACH App Check tokens.
 * Nothing is enforced by this code — enforcement is a per-service switch in the
 * Firebase Console, turned on later by Kyron (docs/runbooks/app-check.md).
 *
 * The site key comes from VITE_APPCHECK_SITE_KEY (a reCAPTCHA Enterprise web
 * key). When it is empty App Check is skipped entirely and the app behaves
 * exactly as before — local dev, previews and tests need no key.
 *
 * A failure here must never stop the app: reCAPTCHA can be blocked by a network
 * or an extension. So init is wrapped; on failure we log and carry on, and every
 * Firebase call goes out without a token — which unenforced services accept.
 */
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const DEFAULT_DEPS = { initializeAppCheck, ReCaptchaEnterpriseProvider };

/**
 * initAppCheck(app, opts) — returns the AppCheck instance, or null when skipped
 * (no key, emulator mode) or when init failed.
 *
 * @param {import('firebase/app').FirebaseApp} app
 * @param {object} [opts]
 * @param {string} [opts.siteKey]    defaults to VITE_APPCHECK_SITE_KEY
 * @param {string} [opts.debugToken] defaults to VITE_APPCHECK_DEBUG_TOKEN (dev builds only)
 * @param {boolean} [opts.isDev]     defaults to import.meta.env.DEV
 * @param {boolean} [opts.emulator]  defaults to VITE_USE_FIREBASE_EMULATOR === 'true'
 * @param {object} [opts.deps]       injectable SDK functions (tests)
 */
export function initAppCheck(app, {
  siteKey = import.meta.env.VITE_APPCHECK_SITE_KEY,
  debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN,
  isDev = import.meta.env.DEV,
  emulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true',
  deps = DEFAULT_DEPS,
} = {}) {
  const key = typeof siteKey === 'string' ? siteKey.trim() : '';
  if (!key || emulator) return null;
  try {
    // Local dev: a debug token registered in the Console stands in for
    // reCAPTCHA. Never set in a production build.
    if (isDev && debugToken) {
      globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'true' ? true : debugToken;
    }
    return deps.initializeAppCheck(app, {
      provider: new deps.ReCaptchaEnterpriseProvider(key),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('[appCheck] App Check did not start; continuing without it.', err);
    return null;
  }
}

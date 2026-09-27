'use strict';

/**
 * appCheckMonitor.js — Firebase App Check in MONITOR mode for callables
 * (P2e, audit 2026-09-24 SEC-11).
 *
 * firebase-functions (v1 `onCall`) already verifies an App Check token when the
 * client sends one, and REJECTS only when `enforceAppCheck` is set. Nothing in
 * this codebase sets it, so a missing or invalid token is let through. This
 * wrapper adds the part Kyron needs before switching enforcement on: one
 * structured log line per call saying which function was hit and whether the
 * caller's App Check token was valid, missing or invalid.
 *
 * It NEVER rejects and never changes the handler's result. Enforcement is a
 * later, deliberate step (docs/runbooks/app-check.md): set
 * `enforceAppCheck: true` per function only after these logs show every real
 * caller arriving with `appCheck: 'valid'`.
 *
 * Exempt by design (brief § PR 2 Part 2.2) — not wrapped: `ingestCallActivity`
 * (server-to-server) and `validateKioskToken` (the kiosk validator). Both are
 * `onRequest`, where App Check does not apply anyway.
 *
 * Log query (Logs Explorer):  jsonPayload.message="appcheck-monitor"
 */
const logger = require('firebase-functions/logger');

/** 'valid' | 'missing' | 'invalid' for one callable invocation. */
function appCheckStatus(context) {
  if (context && context.app) return 'valid';
  const raw = context && context.rawRequest;
  let header;
  if (raw && typeof raw.header === 'function') header = raw.header('X-Firebase-AppCheck');
  else if (raw && raw.headers) header = raw.headers['x-firebase-appcheck'];
  return header ? 'invalid' : 'missing';
}

/**
 * withAppCheckMonitor(fnName, handler) — the callable handler, unchanged, plus
 * the monitor log line. Logging can never break the call.
 */
function withAppCheckMonitor(fnName, handler) {
  return function appCheckMonitored(data, context) {
    try {
      logger.info('appcheck-monitor', { fn: fnName, appCheck: appCheckStatus(context) });
    } catch {
      // A logging failure must never block the function.
    }
    return handler(data, context);
  };
}

module.exports = { withAppCheckMonitor, appCheckStatus };

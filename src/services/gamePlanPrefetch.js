// gamePlanPrefetch — POC (feat/gp-prefetch): warm the 3 Game Plan year-docs into
// Firestore's local cache so the gated Game Plan entrance
// (feat/gp-data-gated-entrance) lands on populated content, beating the 400ms cap
// even on field networks. Field re-measurement of PR #826 showed the game-plan
// critical path is ~1 Firestore round-trip (contentReady ≈ 324ms + RTT), so at
// Slow 4G the cap fires 100% of cold loads. Warming the cache before the user
// taps Game Plan removes that round-trip.
//
// WHY LISTENERS, not a one-time getDoc: getDoc('default') re-validates against the
// server when ONLINE (it prefers server, using cache only as an offline fallback),
// so a one-time getDoc prefetch would warm the cache but the later Game Plan getDoc
// would still round-trip. An ACTIVE onSnapshot listener keeps the doc consistent in
// the local cache, so a subsequent getDoc for the same doc resolves from cache
// without a round-trip. The listeners must stay alive until the Game Plan read
// happens — AgentDashboard stays mounted across tab switches, so the caller keeps
// them alive for the dashboard's lifetime and unsubscribes on unmount.
//
// The doc paths MUST mirror the read paths in moneyNeedsService / yearPlanService /
// monthlyPlanService (all `tenants/{tid}/users/{uid}/{col}/{year}` via getDoc). If
// those move, update here too — a prefetch that warms a different path is useless.
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// year-doc collections read on Game Plan mount, in the order GamePlanScreen loads them.
export const GAME_PLAN_YEAR_COLLECTIONS = ['moneyNeeds', 'yearPlan', 'monthlyPlan'];

/**
 * Attach lightweight listeners on the current-year Game Plan docs to keep them
 * warm in the local cache. Idempotent per call; returns an unsubscribe that tears
 * down every listener. Failure-silent by design — a prefetch that errors must
 * never surface or block anything; Game Plan still fetches on mount as fallback.
 *
 * @returns {() => void} unsubscribe
 */
export function prefetchGamePlanYearDocs(tenantId, uid, year) {
  const parsedYear = parseInt(year, 10);
  if (!tenantId || !uid || !parsedYear) return () => {};

  const unsubs = GAME_PLAN_YEAR_COLLECTIONS.map((col) => {
    try {
      const ref = doc(db, 'tenants', tenantId, 'users', uid, col, String(parsedYear));
      // No-op snapshot/error handlers: we only want the cache kept warm, not to
      // consume the data here. Errors (permissions, offline) are swallowed.
      return onSnapshot(ref, () => {}, () => {});
    } catch {
      return () => {};
    }
  });

  return () => unsubs.forEach((u) => { try { u(); } catch { /* noop */ } });
}

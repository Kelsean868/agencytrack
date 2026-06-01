/**
 * Wizard v2 PR2 — Live-compute config (named constants).
 *
 * Re-exports the canonical lumpsum rate constants from `weeklyReport.js` so
 * the WeekSoFarPanel + computeWizardLive lib have ONE named import surface.
 * Per brief decision (E), rates must not be hardcoded in the panel.
 *
 * If/when these rates change, the change happens in `weeklyReport.js` (the
 * canonical source) and propagates everywhere via this re-export. The wizard
 * panel + the leaderboard CF + `sanitize()` all stay in sync by construction.
 *
 * The agent's personal commissionRate is NOT a constant — it's read from
 * userProfile at render time (already in scope via useAuth(), per Phase 1
 * source-verify).
 */

export {
  /** Fraction of lumpsum grossAmount credited as API (= 10%). */
  LMPS_CREDIT_RATE,
  /** Fixed lumpsum commission rate (= 0.5%); NOT the agent's personal rate. */
  LMPS_COMMISSION_RATE,
} from './weeklyReport.js';

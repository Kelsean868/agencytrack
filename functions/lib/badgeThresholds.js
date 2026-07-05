'use strict';

// Badge eligibility thresholds (TTD API) consumed by `onSubmissionWrite`
// (functions/index.js). Named constants so the comparison sites never inline a
// magic number.
//
// ⚠ DUPLICATION RISK (flagged per the L1-1 brief): `MDRT_QUALIFIED_API` mirrors
// the frontend canonical `src/config/mdrtThresholds/2026.js`
// `MDRT_THRESHOLDS_2026.mdrt` (688,800). functions/ CANNOT import from src/, so
// the value is duplicated here. On the annual MDRT bump, update BOTH files — a
// drift means the server `mdrt_qualified` badge and the client MDRT tracker
// disagree on who qualifies (a money/eligibility inconsistency).
module.exports = {
  // T&T 2026 MDRT premium-method requirement. Previously (wrongly) 500,000 — that
  // 500k was a legitimate Tatil floor mislabelled as MDRT; it now gates the
  // tenure floor marker (TENURE_FLOOR_API) instead.
  MDRT_QUALIFIED_API: 688_800,

  // MDRT half-year pace target: the T&T MDRT commission-method requirement, which
  // is exactly half of the premium-method MDRT (688,800 / 2). Gates `mdrt_pace`
  // (YTD API >= this by week 26). Owner decision 2026-07-05: replaces the legacy
  // 250,000 (which was half of the OLD mislabelled-500k MDRT).
  MDRT_PACE_API: 344_400,

  // Tatil tenured-agent production floor. Once an agent is >= TENURE_FLOOR_YEARS
  // from their contract date (as of today), they are held to this YTD-API floor;
  // reaching it earns the tenure floor marker. This is the legitimate 500k that
  // was previously mislabelled as the MDRT threshold.
  TENURE_FLOOR_API: 500_000,
  TENURE_FLOOR_YEARS: 5,
};

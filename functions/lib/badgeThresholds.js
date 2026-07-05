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
  // tenure floor marker instead (see badgeThresholds Commit 2 / index.js).
  MDRT_QUALIFIED_API: 688_800,
};

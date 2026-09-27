'use strict';

// Keep canonical values in sync with src/constants/brand.js
const BRAND_NAME    = 'AgencyTrack';
const FROM_EMAIL    = 'notifications@agencytrack.app';
const CONTACT_EMAIL = 'hello@agencytrack.app';
const APP_URL       = 'https://portal.agencytrack.app';

// P2e (audit 2026-09-24 SEC-04): the ONLY origins a browser may call the kiosk
// validator from. The one list — validateKioskToken reads it from here.
//   APP_URL                         production app
//   https://agencytrack.vercel.app  the Vercel production domain
//   http://localhost:5173           `npm run dev`
const ALLOWED_ORIGINS = Object.freeze([
  APP_URL,
  'https://agencytrack.vercel.app',
  'http://localhost:5173',
]);

module.exports = { BRAND_NAME, FROM_EMAIL, CONTACT_EMAIL, APP_URL, ALLOWED_ORIGINS };

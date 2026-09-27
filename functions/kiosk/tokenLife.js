'use strict';

// The one constant for kiosk token lifetime (SEC-03, P2e SEC-04). createKioskToken
// sets the first expiry from it; validateKioskToken renews a rolling token by it
// on every successful use.
const KIOSK_TOKEN_TTL_DAYS = 90;
const KIOSK_TOKEN_TTL_MS = KIOSK_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

module.exports = { KIOSK_TOKEN_TTL_DAYS, KIOSK_TOKEN_TTL_MS };

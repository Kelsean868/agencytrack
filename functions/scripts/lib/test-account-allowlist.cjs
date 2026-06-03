/**
 * test-account-allowlist.cjs — SINGLE safety surface for the test-tenant
 * prod-write seed scripts.
 *
 * Extracted (byte-identical) from seed-leaderboard-test-data.cjs (PR #410) so
 * that BOTH the leaderboard seed AND the demo-surfaces seed share ONE allowlist
 * definition + ONE pre-write hard-stop. Any account outside this allowlist
 * triggers a hard stop before ANY write, in either script.
 *
 * IMPORTANT: this module is the canonical allowlist. Do NOT re-declare the
 * allowlist inline in any seed script — require it from here.
 *
 * Rule references: Rule 12 (hard stop), Rule 17 (single source of truth).
 */

'use strict';

// Allowlist of test-account email domains/exact addresses. ANY user
// outside this allowlist triggers a hard stop before ANY write.
//
// Two layers:
//   (a) DOMAIN/PATTERN allowlist — broad-but-controlled patterns that
//       cover whole classes of test accounts (the PR-F @agencytrack.test
//       roster, Tatil staff at @tatillife.com, and the `kelsean+...@gmail.com`
//       Gmail-aliasing convention used for role test accounts).
//   (b) EXACT-UID+EMAIL allowlist — specific accounts that don't match
//       any pattern but are confirmed test/dispatcher accounts. Each
//       entry pairs the UID with the email (defense-in-depth — both
//       must match before a user is considered allowlisted, so even if
//       a recycled UID later gets a different email, the safety gate
//       still fires).
const TEST_EMAIL_ALLOWLIST = {
  domains: [
    '@agencytrack.test',  // PR-F roster
    '@tatillife.com',     // platform_admin (Kyron)
  ],
  exact: [
    'kelsean@gmail.com',          // test agent (J0j4...)
    'kelsean+tenantadmin@gmail.com', // tenant_admin
    'kelsean+platformadmin@gmail.com',
  ],
};

// Exact UID+email pairs confirmed as test/dispatcher accounts on
// 2026-05-31 dispatcher disposition (P5b seed PR pre-review). Each pair
// must match BOTH the UID and the email exactly; if Firebase ever recycles
// a UID with a different email, the gate fires again.
const TEST_ACCOUNT_UID_EMAIL_PAIRS = [
  // PR4b test agent — appeared as rank 5 ("PR4b Test Agent") in P5-prep
  // prod smoke; Gmail-aliased kelsean+pr4b-prod-spot-check; confirmed by
  // dispatcher 2026-05-31 P5b seed PR pre-review.
  { uid: '5P00quqxhrPbvfjV2wMBNr1hURJ3', email: 'kelsean6+pr4b-prod-spot-check@gmail.com' },
  // Letitia test agent — appeared as rank 3 ("Letitia Agent") in P5-prep
  // prod smoke; non-aliased Gmail "letitiaagent" naming; confirmed by
  // dispatcher 2026-05-31 P5b seed PR pre-review.
  { uid: '6AUDnVBcdmM9pj8g6ZyIi1j1i0r2', email: 'letitiaagent@gmail.com' },
  // Test agent "Kegan And Peele" — appeared as rank 1 ("Kegan And Peele")
  // in P5-prep prod smoke; uses alt Gmail kelsean6; confirmed by dispatcher
  // 2026-05-31 P5b seed PR pre-review.
  { uid: 'SIdMIRqVTYbOIE8zuCnIXliywU93', email: 'kelsean6@gmail.com' },
  // Dispatcher's sales_manager account — used as the A11Y_SALES_MANAGER_*
  // smoke credential; appeared as the SM regression mount in P5
  // manager-nav-swap smoke (champion-cards=3 on the OLD points board);
  // confirmed by dispatcher 2026-05-31 P5b seed PR pre-review.
  { uid: 'da0XaHhB4wTYlXDnQmAJ6TRIPTn1', email: 'kyronmarchan@gmail.com' },
];

function isAllowlistedTestUser(user) {
  if (!user || !user.email) return false;
  const email = user.email.toLowerCase().trim();
  const uid   = user.id;

  // Layer (a) — domain/pattern allowlist
  if (TEST_EMAIL_ALLOWLIST.exact.includes(email)) return true;
  for (const d of TEST_EMAIL_ALLOWLIST.domains) {
    if (email.endsWith(d)) return true;
  }
  // Gmail-aliasing convention for role test accounts: kelsean+<role>@gmail.com
  // (e.g., kelsean+tenantadmin, kelsean+pr4b, etc.). Pattern is strict — any
  // OTHER `+`-aliased Gmail outside this prefix does NOT match.
  if (/^kelsean\+[^@]+@gmail\.com$/.test(email)) return true;

  // Layer (b) — exact UID+email pair allowlist (dispatcher-confirmed)
  for (const pair of TEST_ACCOUNT_UID_EMAIL_PAIRS) {
    if (pair.uid === uid && pair.email.toLowerCase() === email) return true;
  }

  return false;
}

/**
 * assertNoNonTestUsers — pre-write hard stop.
 *
 * Lists every user doc in the tenant and fails fast (process.exit(1)) if ANY
 * email is not on the allowlist. Returns { users, usersByEmail } on success.
 * This is the standing "no real users in tatillife_south" lock — shared so
 * both seed scripts enforce the identical gate.
 */
async function assertNoNonTestUsers(db, tenantId) {
  const usersSnap = await db.collection(`tenants/${tenantId}/users`).get();
  const users     = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const nonTest   = users.filter((u) => u.email && !isAllowlistedTestUser(u));
  if (nonTest.length > 0) {
    console.error(`✗ HARD STOP — found ${nonTest.length} non-test email(s) in ${tenantId}:`);
    for (const u of nonTest) console.error(`    - uid=${u.id} role=${u.role} email=${u.email}`);
    console.error('  Cannot proceed. The tenant must have only test accounts.');
    process.exit(1);
  }
  const usersByEmail = new Map();
  for (const u of users) {
    if (u.email) usersByEmail.set(u.email.toLowerCase().trim(), u);
  }
  return { users, usersByEmail };
}

module.exports = {
  TEST_EMAIL_ALLOWLIST,
  TEST_ACCOUNT_UID_EMAIL_PAIRS,
  isAllowlistedTestUser,
  assertNoNonTestUsers,
};

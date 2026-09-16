/**
 * oipaImportConfig.js — the ONE config file for the OIPA/INGENIUM portfolio import.
 *
 * Every list the kickoff brief marks "config" lives here and nowhere else. Adding a
 * plan prefix, a test record or an override must be a change to THIS file only —
 * `parseOipaExport.js` reads these tables and holds no policy-specific knowledge.
 *
 * WHY A SEPARATE FILE AND NOT CONSTANTS IN THE PARSER:
 * These lists are business facts that change without the parsing logic changing
 * (Kyron confirms what PSU is; the CRO rules on a status; a new plan prefix ships).
 * A prefix list embedded in a parser grows a twin the first time a second surface
 * needs it — the failure mode the v3 linked-agent rules name directly
 * (`ACTIVITY_METADATA` is the only source of truth for activity codes).
 *
 * Source of truth for the rules encoded here:
 * docs/briefs/oipa-portfolio-import-kickoff.md
 */

/** Sheet layout of the OIPA agent-portfolio export: title row 1, blank row 2, headers row 3. */
export const OIPA_HEADER_ROW_INDEX = 2; // zero-based index into the array-of-arrays

/**
 * Column headers as OIPA spells them, mapped to the doc field they feed.
 * Verified against the 15 Sep 2026 export: the header row carries these exact strings.
 */
export const OIPA_COLUMNS = Object.freeze({
  policyNumber:         'Policy Number',
  oipaStatus:           'Policy Status',
  oipaSubStatus:        'Policy Sub Status',
  ownerName:            'Policy Owner',
  insuredName:          'Insured',
  paymentMode:          'Payment Mode',
  api:                  'API',
  plan:                 'Plan',
  statusDate:           'Status Date',
  issueDate:            'Issue Date',
  inforceDate:          'Inforce Date',
  paidToDate:           'Paid To Date',
  totalPremiumPaid:     'Total Premium Paid Issue To Date',
  modalPremium:         'Modal Premium',
  sumInsured:           'Sum Insured',
  writingAgentNumber:   'Writing Agent Number',
  writingAgentName:     'Writing Agent Name',
  servicingAgentNumber: 'Servicing Agent Number',
});

/**
 * Columns deliberately NOT imported. Listed rather than merely omitted so the
 * exclusion is reviewable: the brief limits the import to the fields above, and
 * client contact details, DOB and income must never reach Firestore through here.
 */
export const OIPA_COLUMNS_EXCLUDED = Object.freeze([
  'Owner OIPAClient Number', 'Owner Ingenium Client Number',
  'Insured OIPA Client Number', 'Insured Ingenium Client Number',
  'Payment Method', 'Issue Age', 'Gender', 'Date Of Birth',
  'Premium Due Date', 'Premium Payment End Date', 'Total Amount Due',
  'Address Line1', 'Address Line2', 'Address Line3', 'City', 'Country Code',
  'Email', 'Home Phone', 'Mobile Phone', 'Suspense',
  'Writing Agent Company', 'Writing Agency', 'Servicing Agent Name',
  'Servicing Agent Company', 'Servicing Agency',
  'Mortality', 'Annual Income', 'Occupation',
]);

/** Sub status marking an OIPA shadow row — the pre-issue twin of a real policy row. */
export const OIPA_SHADOW_SUB_STATUS = 'Pending Issue';

/** Prefix OIPA puts on the reissue twin of an existing policy number. */
export const OIPA_AFR_PREFIX = 'AFR';

/**
 * CONFIG — test records to skip. Real policy numbers that exist only because
 * someone was testing the source system.
 */
export const OIPA_TEST_POLICY_NUMBERS = Object.freeze([
  'SPI2500081', 'SPI2500082', 'SPI2500083', 'SPI2500084', 'FNE2500067',
]);

/**
 * CONFIG — Policy Status values checked BEFORE the sub status.
 *
 * ORDER IS LOAD-BEARING, and the brief's own expected counts are what pin it down.
 *
 * THE TRAP: `NL` appears in the brief twice — once implicitly via `Declined`
 * (Policy Status) and once explicitly in the settled-plus-terminal sub-status list.
 *
 * MEASURED ON THE 15 SEP 2026 EXPORT (229 docs), which is what settles the order:
 * all 3 `NL` rows carry Policy Status `Declined`, and the terminal sub statuses
 * supply 17 more (Surrendered 8, Deceased 4, Commutation 4, Claim Paid 1).
 *   status-first  -> denied 3,  settled-plus-terminal 18 (17 + the FNE2500031 claim)
 *   subStatus-first -> denied 0,  settled-plus-terminal 21
 * The brief expects denied 3 AND settled-plus-terminal 18, so only status-first
 * reproduces both. Confirmed by dispatcher ruling, 16 Sep 2026.
 *
 * Everywhere else the sub status is the more specific signal and wins: a
 * `Terminated` row is a lapse, an NTU or a surrender depending only on its sub
 * status, so `Terminated` must never be read straight off the status column.
 */
export const OIPA_STATUS_FIRST = Object.freeze({
  Declined: { status: 'denied' },
});

/** CONFIG — Policy Sub Status values. The main map. */
export const OIPA_SUB_STATUS_MAP = Object.freeze({
  'Premium Paying':       { status: 'settled' },
  Grace:                  { status: 'settled' },
  Lapsed:                 { status: 'lapsed' },
  'Not Taken':            { status: 'ntu' },
  Withdrawn:              { status: 'ntu' },
  'Insufficient Premium': { status: 'ntu' },
  Cancelled:              { status: 'ntu' },
  Pending:                { status: 'submitted' },
  Surrendered:            { status: 'settled', terminalReason: 'surrendered' },
  Deceased:               { status: 'settled', terminalReason: 'deceased' },
  Commutation:            { status: 'settled', terminalReason: 'commutation' },
  'Claim Paid':           { status: 'settled', terminalReason: 'claim_paid' },
  NL:                     { status: 'settled', terminalReason: 'nl' },
});

/** CONFIG — Policy Status values checked only when the sub status did not match. */
export const OIPA_STATUS_FALLBACK = Object.freeze({
  Active:     { status: 'settled' },
  Grace:      { status: 'settled' },
  Terminated: { status: 'lapsed' },
  Pending:    { status: 'submitted' },
});

/**
 * Sub statuses where the policy was NEVER placed — no money ever came in, so the
 * policy must not enter the persistency denominator. Read by P1; defined here
 * because it is a property of the OIPA vocabulary, not of the formula.
 */
export const OIPA_NEVER_PLACED_SUB_STATUSES = Object.freeze(['Withdrawn', 'Insufficient Premium']);

/**
 * CONFIG — per-policy overrides. An override wins over the export until Kyron
 * removes it. Each carries a `note` so a future reader knows why it is here and can
 * tell a stale override from a live one.
 */
export const OIPA_POLICY_OVERRIDES = Object.freeze({
  DAN2602390: {
    status: 'ntu',
    replacedBy: 'DAN2602403',
    note: 'Replaced by DAN2602403. Export still shows it Pending; it was never placed.',
  },
  FNE2500031: {
    status: 'settled',
    terminalReason: 'deceased',
    claimStatus: 'pending',
    note: 'Died inside the grace period; death claim being submitted. This is NOT a lapse.',
  },
  TRM2501670: {
    status: 'lapsed',
    note: 'Stays lapsed. Client will take a NEW policy, not a reinstatement — never link the two.',
  },
});

/**
 * CONFIG — self / family policies. Removes campaign credit ONLY. These policies
 * still count for persistency, so nothing in the persistency derivation may read
 * this flag. The `false` entry is deliberate: TRM2602866 is listed so nobody
 * assumes every TRM in this range is family.
 */
export const OIPA_SELF_OR_FAMILY = Object.freeze({
  FNE2600720: true,  // Kyron
  TRM2501755: true,  // Kyron's sister
  TRM2602866: false, // explicitly NOT family
});

/**
 * CONFIG — plan prefix to product identity.
 *
 * `planClassPending: true` means "we do not know yet" and is NOT an error: an
 * unknown prefix imports with nulls and a pending flag rather than failing the
 * import, so one new product can never block a whole portfolio.
 *
 * `classUnconfirmed: true` means the class was read off the plan code rather than
 * confirmed by Kyron. The parser surfaces these in its report (brief rule 6) so
 * they get reviewed before anyone trusts them.
 */
export const OIPA_PLAN_PREFIXES = Object.freeze({
  RAE: { planName: 'Rest Assured I',         policyClass: 'whole_life',       sourceSystem: 'INGENIUM' },
  LCT: { planName: 'Level Convertible Term', policyClass: 'term',             sourceSystem: 'INGENIUM' },
  CBU: { planName: 'Cash Builder',           policyClass: 'annuity',          sourceSystem: 'INGENIUM' },
  CBA: { planName: 'Annuity (pre-Destiny)',  policyClass: 'annuity',          sourceSystem: 'INGENIUM' },
  CIB: { planName: 'LifeSpan Gold',          policyClass: 'critical_illness', sourceSystem: 'INGENIUM' },
  DNU: { planName: 'Destiny Annuity',        policyClass: 'annuity',          sourceSystem: 'OIPA' },
  DNA: { planName: 'Destiny Annuity',        policyClass: 'annuity',          sourceSystem: 'OIPA' },
  // ULG / ULI: class read from the plan code, not confirmed by Kyron. Every ULG/ULI
  // policy number in the 15 Sep export is a legacy `U00…` number, which is why the
  // source system is INGENIUM with no flag while the CLASS carries one.
  ULG: { planName: null, policyClass: 'universal_life', sourceSystem: 'INGENIUM', classUnconfirmed: true },
  ULI: { planName: null, policyClass: 'universal_life', sourceSystem: 'INGENIUM', classUnconfirmed: true },
  // PSU: open question 1. Both policies are old and commuted. Nulls until answered.
  PSU: { planName: null, policyClass: null, sourceSystem: null, planClassPending: true },
  // IMA / IMU appear only on the skipped test records. Mapped so that if they ever
  // show up on a real policy the import reports them instead of inventing a class.
  IMA: { planName: null, policyClass: null, sourceSystem: null, planClassPending: true },
  IMU: { planName: null, policyClass: null, sourceSystem: null, planClassPending: true },
});

/** How many leading characters of the plan code form the prefix. */
export const OIPA_PLAN_PREFIX_LENGTH = 3;

/** CONFIG — Payment Mode to the frequency letter policiesService accepts. */
export const OIPA_PAYMENT_MODE_TO_FREQUENCY = Object.freeze({
  Monthly:       'M',
  Annual:        'A',
  'Semi-Annual': 'S',
  Quarterly:     'Q',
});

/**
 * CONFIG — fixed field values every imported doc carries.
 *
 * `sourceOfProspect` is NULL, deliberately (dispatcher ruling 5b, 16 Sep 2026).
 * `PROSPECTING_SOURCES` is the pick list an AGENT chooses from when logging a sale;
 * an imported historical policy was never prospected through any of those channels,
 * and adding a `portfolio_import` option would put a non-choice in a human's
 * dropdown forever. Provenance is carried by `importSource` on the written doc
 * instead — see `buildImportPlan.js`.
 *
 * This also means no imported doc could ever be written through
 * `policiesService.createPolicy`: its validator requires `sourceOfProspect` to be
 * in the enum, and `firestore.rules` requires `status == 'written'` on create. The
 * importer therefore writes with the Admin SDK and its own validator — not a
 * convenience, a structural necessity.
 */
export const OIPA_FIXED_DOC_FIELDS = Object.freeze({
  newBusinessType:  'nb_ordinary',
  sourceOfProspect: null,
});

/** Provenance stamp for the history doc the importer writes per policy (P2). */
export const OIPA_IMPORT_SOURCE = 'oipa_import';

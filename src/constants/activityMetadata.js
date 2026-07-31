/**
 * ACTIVITY_METADATA — the single source of truth for activity codes (v3 rule 1).
 *
 * Colours, classifiers, counters, filters, picker groups, Daily-Capture seeding
 * and prep-capability all derive from this table. Adding a new code must require
 * ZERO edits anywhere else in `src/` — the one honest exception is the pair of
 * `d.type in [...]` allowlists in `firestore.rules`, which cannot import JS and
 * is therefore GUARDED rather than derived (see the `live` field below and
 * `src/utils/__tests__/activity-rules-mirror-guard.test.js`).
 *
 * Every regression in the v3 prototype came from a hardcoded list of codes that
 * had a twin somewhere else; three of them surfaced to a manager as a false fact
 * about a named agent. `src/utils/__tests__/activity-code-twin-guard.test.js`
 * fails the suite if a twin reappears.
 *
 * FIELD-NAME CONVENTION — READ BEFORE "TIDYING" THESE NAMES.
 * `label` is the SHORT (≤5 char) chip form ('P.C'); `name` is the full name
 * ('Prospecting call'). That is the opposite of what the words suggest, and it is
 * deliberate: it matches the live consumer shape of `APPOINTMENT_TYPES`
 * ({ key, label, name }), so the derivation is a straight pass-through with no
 * inversion to get wrong at a call site. The ≤5-char budget is load-bearing, not
 * cosmetic — see the dense week-card comment in plannerService.js before
 * lengthening any label.
 *
 * This file is a LEAF: it imports nothing from `src/services/` or
 * `src/components/`. That is what dissolves the
 * `planner.helpers` → `recurrence.helpers` → `plannerService` cycle documented at
 * planner.helpers.js:445 instead of closing it.
 *
 * ── Fields ──────────────────────────────────────────────────────────────────
 *   label            ≤5-char chip form (see convention note above)
 *   name             full human name
 *   family           'call' | 'ladder' | 'sale' | 'support' | 'meeting' |
 *                    'admin' | 'suggestion'. Drives hue AND is the grouping key
 *                    later phases read (ledger rows, hours split, activity
 *                    filters) — so AI/FFI/CI stay one 'ladder' family even
 *                    though CI renders differently. See `emphasis`.
 *   counts           counts as SELLING ACTIVITY (today's SELLING_TYPE_KEYS
 *                    semantics — NOT "counts toward a floor row")
 *   emphasis         'tint' (default, may be omitted) | 'fill'. Declared, not
 *                    derived: "CI is the money type" is a design decision that
 *                    nothing semantic implies.
 *   icon             lucide-react export name
 *   mgr              manager-ladder activity
 *   dev              development hours — coaching, excluded from own production
 *   prepCapable      gets the 4-item prep checklist (AI/FFI/CI/JC only)
 *   seedsDailyField  Daily Capture field this seeds, or null for "seeds nothing"
 *   callAttributed   optional, omit for false. The code's blocks are scheduled
 *                    CAPACITY, not activity: the ledger counts the CALLS inside
 *                    the block window (`max(block.dials, itemised)`) rather than
 *                    counting the block as one. Summing one-per-block into the
 *                    same total that receives one-per-call would sum a container
 *                    with its contents. All `callAttributed` codes are attributed
 *                    JOINTLY — a call record carries no type of its own, so it
 *                    inherits the type of whichever block claims it, which makes
 *                    any per-type split non-monotonic under block-adds. Consumed
 *                    by `src/lib/activityLedger.js`; never write a literal
 *                    ['PC','SC'] anywhere.
 *   pickerGroup      booking-sheet group key. ABSENT (not null) on codes that are
 *                    not yet bookable — see `live`.
 *   pickerOrder      optional within-group sort override; defaults to table order
 *   live             see below
 *
 * ── `live` ──────────────────────────────────────────────────────────────────
 * true = this code is present in BOTH `firestore.rules` allowlists on the
 * DEPLOYED ruleset. `TYPE_KEYS`, `APPOINTMENT_TYPES` and `PICKER_GROUPS` derive
 * from `live === true`. Flipping a code to true REQUIRES adding it to both rules
 * literals in the same human-merge PR, followed by the dispatcher's
 * `firebase deploy`.
 *
 * Why this field exists: `TYPE_KEYS` is a client-side WRITE GATE
 * (plannerService.js `buildCreatePayload`, appointmentTemplateService.js
 * `buildTemplatePayload` — both `TYPE_KEYS.includes(type) ? type : 'PC'`). A code
 * that is in TYPE_KEYS but not in the deployed rules is written to Firestore and
 * REJECTED there; today the same call safely coerces to 'PC'. `live` keeps
 * not-yet-shipped codes visible to this table (and to the guards, and to the
 * briefs that will ship them) while inert in every live export.
 *
 * The five non-live codes deliberately carry NO `pickerGroup` key. The contract
 * test at plannerService.test.js:99-105 asserts every APPOINTMENT_TYPES entry has
 * a picker group, so flipping one live without assigning a group fails loudly
 * rather than silently landing it in the most permissive group.
 */

import { devAssertKnown } from '../utils/devAssertKnown';

/**
 * Ordered booking-sheet group metadata. Group keys + display labels only — this
 * holds NO activity codes, so it is not a twin of the table. Order here is the
 * picker's mode order.
 */
export const PICKER_GROUP_DEFS = Object.freeze([
  { key: 'prospect', label: 'Prospect' },
  { key: 'support', label: 'Support' },
  { key: 'block', label: 'Block' },
]);

/**
 * The table. Key order for the 16 live codes IS the picker/legend display order
 * (`APPOINTMENT_TYPES` derives from it directly); the five not-yet-live codes are
 * appended and contribute nothing to that order. Do not rename, re-key or drop
 * any of the 16 — they exist in live Firestore documents and in both rules
 * allowlists.
 */
export const ACTIVITY_METADATA = Object.freeze({
  // ── Selling ladder ─────────────────────────────────────────────────────────
  // PC and SC are `callAttributed`: their blocks are scheduled CAPACITY, and the
  // ledger counts the CALLS inside them rather than the blocks themselves. See
  // the `callAttributed` note above and `src/lib/activityLedger.js`.
  PC: Object.freeze({
    label: 'P.C', name: 'Prospecting call', family: 'call', counts: true,
    icon: 'Phone', mgr: false, dev: false, prepCapable: false,
    seedsDailyField: 'dials', pickerGroup: 'prospect', callAttributed: true, live: true,
  }),
  // `name` carries the parenthetical because "Seen call" reads to a new manager
  // as "I saw them in person". It is a historical term — an agent had "seen" a
  // prospect once they answered the door — and the modern meaning is simply
  // CONTACT MADE, by any channel. It is NOT a service call (`serviceCalls` in the
  // weekly submission is servicing existing clients, ratified as excluded from
  // every funnel sum). `label` stays 'S.C': it is the agents' own vocabulary.
  SC: Object.freeze({
    label: 'S.C', name: 'Seen call (contact made)', family: 'call', counts: true,
    icon: 'PhoneCall', mgr: false, dev: false, prepCapable: false,
    seedsDailyField: 'telContacts', pickerGroup: 'prospect', callAttributed: true, live: true,
  }),
  AI: Object.freeze({
    label: 'A.I', name: 'Approach interview', family: 'ladder', counts: true,
    icon: 'UserPlus', mgr: false, dev: false, prepCapable: true,
    seedsDailyField: 'qualifiedApproaches', pickerGroup: 'prospect', live: true,
  }),
  FFI: Object.freeze({
    label: 'F.F.I', name: 'Fact-finding interview', family: 'ladder', counts: true,
    icon: 'ClipboardList', mgr: false, dev: false, prepCapable: true,
    seedsDailyField: 'ffiConducted', pickerGroup: 'prospect', live: true,
  }),
  // The money type: same 'ladder' family as AI/FFI (so "show me ladder activity"
  // never loses the closing interview), distinguished by emphasis alone.
  CI: Object.freeze({
    label: 'C.I', name: 'Closing interview', family: 'ladder', counts: true,
    emphasis: 'fill',
    icon: 'Handshake', mgr: false, dev: false, prepCapable: true,
    seedsDailyField: 'ciConducted', pickerGroup: 'prospect', live: true,
  }),
  SALE: Object.freeze({
    label: 'Sale', name: 'Life / annuity written', family: 'sale', counts: true,
    icon: 'Award', mgr: false, dev: false, prepCapable: false,
    // SALE seeds Daily Capture as apps + API, handled separately from the flat
    // count fields — so it maps to no single field here.
    seedsDailyField: null, pickerGroup: 'prospect', live: true,
  }),
  // Legacy catch-all block. Stays LAST in the Block group (it keeps its
  // FREE_BLOCK_LABELS chip row) despite sitting 7th in table order.
  FREE: Object.freeze({
    label: 'Free', name: 'Training · seminar · prospecting time · personal',
    family: 'admin', counts: false,
    icon: 'Clock', mgr: false, dev: false, prepCapable: false,
    seedsDailyField: null, pickerGroup: 'block', pickerOrder: 99, live: true,
  }),

  // ── Support work — client-linked, but not itself a selling interview ────────
  PROP: Object.freeze({
    label: 'Prop', name: 'Solution / proposal writing', family: 'support', counts: false,
    icon: 'FileText', mgr: false, dev: false, prepCapable: false,
    seedsDailyField: null, pickerGroup: 'support', live: true,
  }),
  PAPER: Object.freeze({
    label: 'Paper', name: 'Writing / submitting applications', family: 'support', counts: false,
    icon: 'FileSignature', mgr: false, dev: false, prepCapable: false,
    seedsDailyField: null, pickerGroup: 'support', live: true,
  }),
  COLL: Object.freeze({
    label: 'Coll', name: 'Premium collection', family: 'support', counts: false,
    icon: 'Wallet', mgr: false, dev: false, prepCapable: false,
    seedsDailyField: null, pickerGroup: 'support', live: true,
  }),
  DEL: Object.freeze({
    label: 'Del', name: 'Policy delivery', family: 'support', counts: false,
    icon: 'Package', mgr: false, dev: false, prepCapable: false,
    seedsDailyField: null, pickerGroup: 'support', live: true,
  }),

  // ── Blocks — booked time that is not a client appointment ──────────────────
  // SEM/TRADE are prospecting activity, so they belong to the CALLS family and
  // COUNT, even though the picker files them under Block. Grouping answers
  // "where does the agent find it"; `counts` answers "does it count".
  SEM: Object.freeze({
    label: 'Sem', name: 'Company seminar', family: 'call', counts: true,
    icon: 'Presentation', mgr: false, dev: false, prepCapable: false,
    seedsDailyField: null, pickerGroup: 'block', live: true,
  }),
  TRADE: Object.freeze({
    label: 'Trade', name: 'Tradeshow', family: 'call', counts: true,
    icon: 'Store', mgr: false, dev: false, prepCapable: false,
    seedsDailyField: null, pickerGroup: 'block', live: true,
  }),
  MTG: Object.freeze({
    label: 'Mtg', name: 'Branch meeting', family: 'meeting', counts: false,
    icon: 'Users', mgr: false, dev: false, prepCapable: false,
    seedsDailyField: null, pickerGroup: 'block', live: true,
  }),
  TRAIN: Object.freeze({
    label: 'Train', name: 'Training / CPD', family: 'admin', counts: false,
    icon: 'GraduationCap', mgr: false, dev: false, prepCapable: false,
    seedsDailyField: null, pickerGroup: 'block', live: true,
  }),
  ADMIN: Object.freeze({
    label: 'Admin', name: 'Admin work', family: 'admin', counts: false,
    icon: 'Briefcase', mgr: false, dev: false, prepCapable: false,
    seedsDailyField: null, pickerGroup: 'block', live: true,
  }),

  // ── NOT YET LIVE ───────────────────────────────────────────────────────────
  // Present so the table is the whole vocabulary, inert until their own briefs
  // ship them. No `pickerGroup` key by design — see the `live` note in the header.
  // Each flip to `live: true` also adds the code to BOTH firestore.rules
  // allowlists in the same human-merge PR.

  // Coaching activity: manager-ladder AND development hours, so it never inflates
  // the manager's own production. Booking coaching must not raise "% yours".
  JC: Object.freeze({
    label: 'J.C', name: 'Joint call', family: 'meeting', counts: false,
    icon: 'UsersRound', mgr: true, dev: true, prepCapable: true,
    seedsDailyField: null, live: false, // → Phase 5.3
  }),
  ONE: Object.freeze({
    label: '1:1', name: 'One-on-one', family: 'meeting', counts: false,
    icon: 'UserCheck', mgr: true, dev: true, prepCapable: false,
    seedsDailyField: null, live: false, // → Phase 5.2
  }),
  RI: Object.freeze({
    label: 'R.I', name: 'Recruiting interview', family: 'meeting', counts: false,
    icon: 'UserSearch', mgr: true, dev: true, prepCapable: false,
    seedsDailyField: null, live: false, // → Phase 5.4
  }),
  // Overhead, named separately from generic admin precisely so a week eaten by
  // meetings reads as that. `mgr` but NOT `dev` — it is not coaching.
  UM: Object.freeze({
    label: 'U.M', name: 'Unit meeting', family: 'admin', counts: false,
    icon: 'Users', mgr: true, dev: false, prepCapable: false,
    seedsDailyField: null, live: false, // → Phase 5.2
  }),
  // Not a real activity — a system proposal. `counts: false` is what excludes it
  // from every count, hours total and "booked" figure; never filter it out at a
  // call site. Must never become agent-bookable.
  SUGGESTION: Object.freeze({
    label: 'Sugg', name: 'System-proposed slot', family: 'suggestion', counts: false,
    icon: 'Sparkles', mgr: false, dev: false, prepCapable: false,
    seedsDailyField: null, live: false, // → Phase 2.3
  }),
});

/** Every code in the table, live or not, in table order. */
export const ALL_CODES = Object.freeze(Object.keys(ACTIVITY_METADATA));

/**
 * Codes present in the deployed firestore.rules allowlists, in table order.
 * This is the set every live export derives from.
 */
export const LIVE_CODES = Object.freeze(
  ALL_CODES.filter((code) => ACTIVITY_METADATA[code].live),
);

/**
 * Live codes that count as SELLING ACTIVITY. The one set both `plannerService`'s
 * `SELLING_TYPE_KEYS` and `src/lib/activityLedger.js` derive from — the ledger
 * cannot import the service (that boundary is what P0-C establishes), and a
 * second `filter(counts)` in the ledger would be a twin guarded only by a test.
 *
 * LIVE, not ALL: a non-live code cannot produce records (it is absent from
 * `TYPE_KEYS`, and `createAppointment` coerces an unknown type to 'PC'), so
 * counting over all 21 would put a permanent zero row for a code that cannot
 * have data onto a manager-facing ledger.
 */
export const COUNTED_LIVE_CODES = Object.freeze(
  LIVE_CODES.filter((code) => ACTIVITY_METADATA[code].counts),
);

/**
 * Counted live codes whose blocks are attributed by CALL rather than by block.
 * These are pooled into ONE ledger row (see `weekTotals`), never split per code.
 *
 * Filtered from COUNTED_LIVE_CODES, not LIVE_CODES, and the distinction is not
 * cosmetic: `pcBreakdown` selects its block set from this list, so a code that
 * was `callAttributed: true` but `counts: false` would feed the pooled CALLS
 * total while being absent from `LEDGER_ROW_KEYS` — non-counted activity
 * silently inflating a counted, manager-facing figure. Pinned by
 * `activityMetadata.contract.test.js`.
 */
export const CALL_ATTRIBUTED_CODES = Object.freeze(
  COUNTED_LIVE_CODES.filter((code) => ACTIVITY_METADATA[code].callAttributed === true),
);

/** True when `code` is a known activity code (live or not). */
export function isKnownCode(code) {
  return Object.prototype.hasOwnProperty.call(ACTIVITY_METADATA, code);
}

/**
 * Border style is DERIVED from `counts`, never stored: solid counts toward
 * selling activity, dashed does not. The chip LABEL says what it is; the border
 * style says whether it counts. Because this is derived, the two can no longer
 * drift — which is why plannerTone.js no longer carries a "keep in step with
 * SELLING_TYPE_KEYS" warning.
 */
export function borderStyleOf(code) {
  devAssertKnown(ACTIVITY_METADATA, code, 'ACTIVITY_METADATA');
  return ACTIVITY_METADATA[code]?.counts ? 'solid' : 'dashed';
}

/**
 * Emphasis for a code. `emphasis` is optional BY DESIGN — omitting it means
 * 'tint', which is why the `??` here is a documented default rather than a
 * lookup-miss fallback. The miss that would matter (an unknown code) is what
 * devAssertKnown reports.
 */
export function emphasisOf(code) {
  devAssertKnown(ACTIVITY_METADATA, code, 'ACTIVITY_METADATA');
  return ACTIVITY_METADATA[code]?.emphasis ?? 'tint';
}

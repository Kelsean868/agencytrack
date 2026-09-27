/**
 * settledProvenance.js — where a settled production figure's statuses came from.
 *
 * Kyron, 26 Sep 2026 (audit 2026-09-24 BUG-01, option B): agent-declared settled
 * policies KEEP counting toward heroes, campaigns and awards. Instead of hiding
 * them, every surface that shows a settled production total says how much of it
 * head office reported and how much the agent declared:
 *
 *     "3 from head office · 2 self-confirmed"
 *
 * "From head office" = the OIPA import set the policy's current status
 * (`statusSource === 'oipa_import'`). "Self-confirmed" = every other settled
 * policy: a person keyed the status. The two always sum to `count`.
 *
 * ONE helper so every surface counts the same way (Home hero, Policy Ledger,
 * award card, Campaign, Awards tab). Callers pass the policies that make up the
 * figure they show — never a wider list — so the line describes that figure.
 *
 * Pure; no SDK, no JSX. Lives apart from ledgerProduction.js so the campaign
 * lens (policyCampaignLens.js, which ledgerProduction imports) can use it too.
 */
import { STATUS_SOURCE_IMPORT } from './portfolioImport/oipaImportConfig';

/** True when head office (the OIPA import) set this policy's current status. */
export function isFromHeadOffice(policy) {
  return policy?.statusSource === STATUS_SOURCE_IMPORT;
}

/**
 * settledProvenance(policies) — { count, fromHeadOffice, selfConfirmed } over
 * the given policies. Nullish entries are skipped.
 */
export function settledProvenance(policies) {
  let fromHeadOffice = 0;
  let selfConfirmed = 0;
  for (const p of Array.isArray(policies) ? policies : []) {
    if (!p) continue;
    if (isFromHeadOffice(p)) fromHeadOffice += 1;
    else selfConfirmed += 1;
  }
  return { count: fromHeadOffice + selfConfirmed, fromHeadOffice, selfConfirmed };
}

/**
 * The provenance line: "[n] from head office · [n] self-confirmed".
 * Null when nothing is settled — there is nothing to attribute.
 *
 * @param {{count:number, fromHeadOffice:number, selfConfirmed:number}|null} counts
 */
export function provenanceLine(counts) {
  if (!counts || !(counts.count > 0)) return null;
  const ho = Number(counts.fromHeadOffice) || 0;
  const self = Number(counts.selfConfirmed) || 0;
  return `${ho} from head office · ${self} self-confirmed`;
}

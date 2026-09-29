/**
 * reinstatementDeclaration.js — FR-6 "Mark reinstated" (Option A).
 *
 * An agent can DECLARE that a lapsed policy has been reinstated, while head
 * office still shows it lapsed (docs/audits/fr-6-mark-reinstated-recon.md § 3
 * Option A; Kyron ruling R-b, 29-09-2026). The declaration is three fields on
 * the policy doc; status, statusSource and every money field stay as the
 * import left them (firestore.rules Arm G).
 *
 * Readers show a declaration BESIDE the evidenced figure, never inside it, and
 * it never feeds money (awards, financing, commission). When the next export
 * moves the policy to `settled`, the reinstatement is evidenced and the
 * declaration is moot: every reader ignores it once `status !== 'lapsed'`.
 * Nothing here is stored; every value is derived at read time.
 *
 * PURE: no SDK, no JSX, no clock (callers pass today's TT date).
 */
import { ymdTT, parseDateOnlyTT } from '../../utils/dateInputs';

/** The only three fields firestore.rules Arm G lets the owner write. */
export const REINSTATEMENT_DECLARATION_FIELDS = Object.freeze([
  'reinstatementDeclaredAt', 'reinstatementDeclaredBy', 'reinstatementNote',
]);

/** Arm G's note limit (characters). */
export const REINSTATEMENT_NOTE_MAX = 200;

/** History `event` values (Arm G history arm allowlist). */
export const REINSTATEMENT_EVENTS = Object.freeze({
  declared: 'reinstatement_declared',
  withdrawn: 'reinstatement_withdrawn',
});

/**
 * A declaration older than this many days, with the policy still lapsed, reads
 * "Not confirmed by head office after 60 days". The recon proposes 60 and marks
 * it a ruling for Kyron; ONE constant so a ruling changes one line. Derived,
 * never stored (v3 non-negotiable 2).
 */
export const REINSTATEMENT_UNCONFIRMED_DAYS = 60;

/** Roles firestore.rules Arm G admits (isAgent() || isProducingManager()). */
const DECLARING_ROLES = new Set(['agent', 'unit_manager', 'branch_manager']);

const MS_PER_DAY = 86400000;

/**
 * True when the policy carries a declaration that still matters: it is lapsed
 * (an export that moved it to settled evidences the reinstatement, so the
 * declaration is moot) and a declaration is on it.
 */
export function hasLiveDeclaration(policy) {
  if (policy?.status !== 'lapsed') return false;
  return policy.reinstatementDeclaredAt != null || policy.reinstatementDeclaredBy != null;
}

/** A Firestore Timestamp / Date / millis / ISO value as a Date, or null. */
function toInstant(v) {
  if (v == null) return null;
  if (typeof v?.toDate === 'function') {
    try { return v.toDate(); } catch { return null; }
  }
  if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000);
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The TT calendar day the declaration was made (`YYYY-MM-DD`), or null. */
export function declarationDate(policy) {
  const d = toInstant(policy?.reinstatementDeclaredAt);
  return d ? ymdTT(d) : null;
}

/**
 * Whole days since the declaration, on TT calendar days, or null when either
 * date is unreadable.
 */
export function declarationAgeDays(policy, todayTT) {
  const on = declarationDate(policy);
  if (!on || typeof todayTT !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(todayTT)) return null;
  return Math.round((parseDateOnlyTT(todayTT).getTime() - parseDateOnlyTT(on).getTime()) / MS_PER_DAY);
}

/**
 * Still lapsed more than REINSTATEMENT_UNCONFIRMED_DAYS after the declaration:
 * head office has not confirmed it.
 */
export function declarationUnconfirmed(policy, todayTT) {
  if (!hasLiveDeclaration(policy)) return false;
  const age = declarationAgeDays(policy, todayTT);
  return age != null && age > REINSTATEMENT_UNCONFIRMED_DAYS;
}

/**
 * The view of one policy's declaration a screen needs, or null when there is
 * no live declaration.
 */
export function declarationView(policy, todayTT) {
  if (!hasLiveDeclaration(policy)) return null;
  return {
    on: declarationDate(policy),
    by: policy.reinstatementDeclaredBy ?? null,
    note: typeof policy.reinstatementNote === 'string' && policy.reinstatementNote ? policy.reinstatementNote : null,
    unconfirmed: declarationUnconfirmed(policy, todayTT),
  };
}

/**
 * JS mirror of Arm G for the UI: may this signed-in user declare (or withdraw)
 * on this policy? Owner only, agent or producing manager, lapsed only. The
 * rules decide; this only hides a control the rules would refuse.
 */
export function canDeclareReinstatement(policy, { uid, role } = {}) {
  return Boolean(uid)
    && DECLARING_ROLES.has(role)
    && policy?.agentId === uid
    && policy?.status === 'lapsed';
}

/** "12 Oct 2026" from `YYYY-MM-DD`, or "—". */
export function declarationDateLabel(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? ''));
  if (!m) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

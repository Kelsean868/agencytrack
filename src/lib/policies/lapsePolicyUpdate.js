import { STATUS_SOURCE_MANAGER } from '../portfolioImport/oipaImportConfig.js';

/**
 * buildLapseUpdate — the settled → lapsed policy update and its history
 * `changedFields`, exactly as `lapsePolicy` (src/services/policiesService.js)
 * writes them. PURE: the caller passes the server-timestamp sentinel and
 * today's date, so the Firestore emulator rules test
 * (tests/rules/policies.rules.test.mjs, "F-1") imports THIS function and sends
 * the app's own payload — never a hand-written superset (audit A-1: the old
 * rules test added provenance the app never sent, so it passed while the app
 * was denied).
 *
 * P4e status provenance: firestore.rules Arm D requires
 * `setsOwnStatusProvenance()`, and rules see the document AFTER the write, so
 * a lapse that omits `statusSource` / `statusSetBy` keeps the OLD provenance
 * and is denied unless the same manager set the settled status. Stamped here
 * exactly as `transitionPolicyStatus` stamps them (the history `changedFields`
 * carries statusSource and statusSetBy, as there).
 *
 * @param {{ managerUid: string, fields: { dateLapsed: *, lapseReason?: string },
 *           today: string, statusUpdatedAt: * }} args
 *   today — YYYY-MM-DD in Trinidad time (getTodayTT()).
 * @returns {{ policyUpdate: object, changedFields: object }}
 */
export function buildLapseUpdate({ managerUid, fields, today, statusUpdatedAt }) {
  if (!managerUid) throw new Error('buildLapseUpdate: managerUid is required');
  if (!today) throw new Error('buildLapseUpdate: today is required');
  const policyUpdate = {
    status:          'lapsed',
    statusUpdatedAt,
    dateLapsed:      fields.dateLapsed,
    statusSource:    STATUS_SOURCE_MANAGER,
    statusSetBy:     managerUid,
    statusAsOf:      today,
  };
  const changedFields = {
    dateLapsed:   fields.dateLapsed,
    statusSource: STATUS_SOURCE_MANAGER,
    statusSetBy:  managerUid,
  };
  const reason = fields.lapseReason?.trim();
  if (reason) {
    policyUpdate.lapseReason = reason;
    changedFields.lapseReason = reason;
  }
  return { policyUpdate, changedFields };
}

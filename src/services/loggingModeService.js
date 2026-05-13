/**
 * Mode-switch orchestration for E6 logging mode.
 *
 * Two non-trivial transitions during a partially-logged week:
 *
 *   daily → weekly (or hybrid → weekly):
 *     If the agent has any daily entries for the current week, sum them
 *     into the weekly draft so they don't lose data when they switch off
 *     daily mode.
 *
 *   weekly → daily (or hybrid → daily):
 *     If the agent has a non-empty weekly draft, that draft is converted
 *     to a single dated catch-up daily entry. Future days log per-day as
 *     normal. The weekly draft is then deleted so the Sunday aggregator
 *     can rebuild it cleanly from daily entries.
 *
 * Hybrid switches don't trigger either path — the agent just gains both
 * CTAs going forward.
 */

import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getDailyEntriesForWeek, saveDailyEntry } from './dailyActivityService';
import { aggregateDailyToWeekly } from '../lib/schema/dailyActivity.aggregator';
import { getMostRecentSunday } from '../utils/dateHelpers';

function submissionRef(tenantId, uid, weekStarting) {
  return doc(db, `tenants/${tenantId}/submissions/${uid}_${weekStarting}`);
}

/**
 * True if a weekly draft has any production or activity value worth
 * carrying over via catch-up. A draft with all zeros is cosmetically
 * present but informationally empty — no need to convert.
 */
export function draftHasContent(draft) {
  if (!draft) return false;
  const numericKeys = [
    'qualifiedApproaches',
    'appointmentsSet',
    'ffisScheduled',
    'ffiConducted',
    'solutionPresentations',
    'newCIBooked',
    'oldCIBooked',
    'ciConducted',
    'serviceContacts',
    'namesFromOther',
    'oldNamesPool',
    'totalProductionCredit',
  ];
  if (numericKeys.some((k) => parseFloat(draft[k]) > 0)) return true;
  if (parseFloat(draft.newBusiness?.api) > 0) return true;
  if (parseFloat(draft.newBusiness?.apps) > 0) return true;
  if (parseFloat(draft.pppIncreases?.apiIncrease) > 0) return true;
  if (parseFloat(draft.pppIncreases?.apps) > 0) return true;
  if (parseFloat(draft.lumpsums?.grossAmount) > 0) return true;
  return false;
}

/**
 * Daily → Weekly mid-week handoff. Fetches all daily entries for the
 * current week, aggregates them, and writes the result into the weekly
 * draft path with merge:true so any agent-edited fields are preserved.
 *
 * No-op if there are no daily entries.
 *
 * Returns { aggregated: true|false, count: <num daily entries> }.
 */
export async function aggregateCurrentWeekDaily(tenantId, uid, agentName, commissionRate) {
  const weekStarting = getMostRecentSunday();
  const dailies = await getDailyEntriesForWeek(tenantId, uid, weekStarting);
  if (dailies.length === 0) return { aggregated: false, count: 0, weekStarting };

  const rollup = aggregateDailyToWeekly(dailies, commissionRate);
  const ref = submissionRef(tenantId, uid, weekStarting);
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data().status === 'submitted') {
    return { aggregated: false, count: dailies.length, weekStarting, alreadySubmitted: true };
  }

  await setDoc(
    ref,
    {
      ...rollup,
      userId: uid,
      agentId: uid,
      agentName,
      weekStarting,
      status: 'draft',
      aggregatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return { aggregated: true, count: dailies.length, weekStarting };
}

/**
 * Weekly → Daily mid-week handoff. Converts the current weekly draft into
 * a single dated catch-up dailyActivity entry, then deletes the draft so
 * the Sunday aggregator can rebuild it cleanly from per-day entries
 * going forward.
 *
 * No-op if the draft is empty (no values to carry over) or if the draft
 * is already submitted.
 *
 * Returns { catchUp: true|false, weekStarting }.
 */
export async function catchUpWeeklyToDaily(tenantId, uid, agentName, today) {
  const weekStarting = getMostRecentSunday();
  const ref = submissionRef(tenantId, uid, weekStarting);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { catchUp: false, weekStarting, reason: 'no-draft' };

  const draft = snap.data();
  if (draft.status === 'submitted') {
    return { catchUp: false, weekStarting, reason: 'already-submitted' };
  }
  if (!draftHasContent(draft)) {
    // Nothing useful to carry over — just delete the empty draft.
    await deleteDoc(ref);
    return { catchUp: false, weekStarting, reason: 'empty-draft' };
  }

  const catchUpEntry = {
    qualifiedApproaches:    parseInt(draft.qualifiedApproaches, 10)    || 0,
    appointmentsSet:        parseInt(draft.appointmentsSet, 10)        || 0,
    ffisScheduled:          parseInt(draft.ffisScheduled, 10)          || 0,
    ffiConducted:           parseInt(draft.ffiConducted, 10)           || 0,
    solutionPresentations:  parseInt(draft.solutionPresentations, 10)  || 0,
    newCIBooked:            parseInt(draft.newCIBooked, 10)            || 0,
    oldCIBooked:            parseInt(draft.oldCIBooked, 10)            || 0,
    ciConducted:            parseInt(draft.ciConducted, 10)            || 0,

    newBusiness: {
      apps: parseInt(draft.newBusiness?.apps, 10) || 0,
      api:  parseFloat(draft.newBusiness?.api)    || 0,
    },
    pppIncreases: {
      apps:        parseInt(draft.pppIncreases?.apps, 10)            || 0,
      apiIncrease: parseFloat(draft.pppIncreases?.apiIncrease)       || 0,
    },
    lumpsums: {
      grossAmount: parseFloat(draft.lumpsums?.grossAmount) || 0,
    },

    newNamesAdded:   parseInt(draft.namesFromOther, 10)        || 0,
    oldNamesWorked:  parseInt(draft.oldNamesPool, 10)          || 0,
    serviceContacts: parseInt(draft.serviceContacts, 10)       || 0,

    isCatchUp:        true,
    catchUpStartDate: weekStarting,
    catchUpEndDate:   today,
  };

  await saveDailyEntry(tenantId, uid, agentName, today, catchUpEntry);
  await deleteDoc(ref);
  return { catchUp: true, weekStarting, today };
}

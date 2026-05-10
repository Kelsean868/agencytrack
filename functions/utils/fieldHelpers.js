/**
 * CJS field-extraction helpers for Cloud Functions.
 * Mirrors the logic in src/utils/extractFields.js — keep in sync if that file changes.
 */

function p(v) {
  return parseFloat(v) || 0;
}

/**
 * Total production API for a single submission.
 * V2-first: reads totalProductionCredit when stored, derives from sub-objects, falls back to V1.
 */
function extractTotalProductionCredit(sub) {
  if (!sub) return 0;
  if (sub.totalProductionCredit !== undefined) return Number(sub.totalProductionCredit) || 0;
  if (sub.newBusiness !== undefined) {
    return (Number(sub.newBusiness?.api) || 0) +
           (Number(sub.pppIncreases?.apiIncrease) || 0) +
           (Number(sub.lumpsums?.apiCredit) || 0);
  }
  return p(sub.apiSold || sub.api || sub.annualPremium);
}

/**
 * Total apps for a single submission (NB apps + PPP apps).
 */
function extractTotalApps(sub) {
  if (!sub) return 0;
  if (sub.newBusiness !== undefined) {
    return (Number(sub.newBusiness?.apps) || 0) + (Number(sub.pppIncreases?.apps) || 0);
  }
  return p(sub.applicationsSold || sub.appsSold);
}

/**
 * Activity totals for a single submission.
 * Returns { totalNewNames, totalTelAttempts, ffiConducted, ciConducted, activityTotal }.
 */
function extractActivityFields(sub) {
  if (!sub) return { totalNewNames: 0, totalTelAttempts: 0, ffiConducted: 0, ciConducted: 0, activityTotal: 0 };

  const totalNewNames =
    p(sub.namesFromColdCanvass) + p(sub.referralsObtained) +
    p(sub.namesFromSeminarsConducted) + p(sub.namesFromSeminarsAttended) +
    p(sub.namesFromTradeshowsConducted) + p(sub.namesFromTradeshowsAttended) +
    p(sub.namesFromOther);

  const totalTelAttempts =
    p(sub.referralCalls) + p(sub.coldCalls) + p(sub.followUpCalls) + p(sub.seminarTradeshowCalls);

  const ffiConducted = p(sub.ffiConducted);
  const ciConducted = p(sub.ciConducted);

  return {
    totalNewNames,
    totalTelAttempts,
    ffiConducted,
    ciConducted,
    activityTotal: totalNewNames + totalTelAttempts + ffiConducted + ciConducted,
  };
}

/**
 * Aggregate totals across an array of submissions for a single agent.
 */
function aggregateAgentTotals(submissions) {
  let totalApi = 0;
  let totalApps = 0;
  let activityTotal = 0;

  for (const sub of submissions) {
    totalApi += extractTotalProductionCredit(sub);
    totalApps += extractTotalApps(sub);
    const act = extractActivityFields(sub);
    activityTotal += act.activityTotal;
  }

  return { totalApi, totalApps, activityTotal };
}

module.exports = { extractTotalProductionCredit, extractTotalApps, extractActivityFields, aggregateAgentTotals };

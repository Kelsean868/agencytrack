import { formatCurrency } from './formatters';

export function extractFields(d) {
  if (!d) return {};
  const p = (v) => parseFloat(v) || 0;

  let f;

  if (d.step1 !== undefined) {
    // Nested schema — future format
    const s1 = d.step1 || {};
    const s2 = d.step2 || {};
    const s3 = d.step3 || {};
    const s4 = d.step4 || {};
    const s6 = d.step6 || {};
    const s7 = d.step7 || {};
    const s8 = d.step8 || {};
    const s9 = d.step9 || {};
    f = {
      prospectingLettersSent:      p(s1.prospectingLettersSent),
      f2fAttempts:                 p(s1.f2fAttempts),
      f2fContacts:                 p(s1.f2fContacts),
      namesFromColdCanvass:        p(s1.namesFromColdCanvass),
      referralsObtained:           p(s1.referralsObtained),
      namesFromSeminarsConducted:  p(s1.namesFromSeminarsConducted),
      namesFromSeminarsAttended:   p(s1.namesFromSeminarsAttended),
      namesFromTradeshowsConducted: p(s1.namesFromTradeshowsConducted),
      namesFromTradeshowsAttended: p(s1.namesFromTradeshowsAttended),
      namesFromOther:              p(s1.namesFromOther),
      referralCalls:               p(s2.referralCalls),
      followUpCalls:               p(s2.followUpCalls),
      coldCalls:                   p(s2.coldCalls),
      seminarTradeshowCalls:       p(s2.seminarTradeshowCalls),
      serviceCalls:                p(s2.serviceCalls),
      telContacts:                 p(s2.telContacts),
      appointmentsSet:             p(s2.appointmentsSet),
      qualifiedApproaches:         p(s3.qualifiedApproaches),
      ffisScheduled:               p(s3.ffisScheduled),
      ffiConducted:                p(s3.ffiConducted),
      solutionPresentations:       p(s3.solutionPresentations),
      newCIBooked:                 p(s4.newCIBooked),
      oldCIBooked:                 p(s4.oldCIBooked),
      ciConducted:                 p(s4.ciConducted),
      applicationsSold:            p(s4.applicationsSold),
      livesSold:                   p(s4.livesSold),
      apiSold:                     p(s4.apiSold),
      policiesDelivered:           p(s6.policiesDelivered),
      serviceContacts:             p(s6.serviceContacts),
      officeHours:                 p(s7.officeHours),
      fieldHours:                  p(s7.fieldHours),
      planningEffectiveness:       p(s8.planningEffectiveness || s8.ratingPlanning),
      timeManagement:              p(s8.timeManagement || s8.ratingTimeManagement),
      salesPerformance:            p(s8.salesPerformance || s8.ratingSalesPerformance),
      prospectingEffort:           p(s8.prospectingEffort || s8.ratingProspecting),
      overallRating:               p(s8.overallRating || s8.ratingOverall),
      evaluationNotes:             s8.evaluationNotes || s8.notes || '',
      targetAPI:                   p(s9.targetAPI),
      targetAppsSold:              p(s9.targetAppsSold),
      goalNotes:                   s9.goalNotes || '',
      // Social & Content — stored flat even in nested schema submissions
      socialPostsTotal:            p(d.socialPostsTotal),
      socialEngagementTotal:       p(d.socialEngagementTotal),
      socialInboxEnquiries:        p(d.socialInboxEnquiries),
      namesFromSocial:             p(d.namesFromSocial),
      socialPlatformBreakdown:     d.socialPlatformBreakdown ?? {},
    };
  } else {
    // Flat schema — current wizard + legacy submissions
    f = {
      prospectingLettersSent:      p(d.prospectingLettersSent),
      f2fAttempts:                 p(d.f2fAttempts),
      f2fContacts:                 p(d.f2fContacts),
      namesFromColdCanvass:        p(d.namesFromColdCanvass),
      referralsObtained:           p(d.referralsObtained),
      namesFromSeminarsConducted:  p(d.namesFromSeminarsConducted),
      namesFromSeminarsAttended:   p(d.namesFromSeminarsAttended),
      namesFromTradeshowsConducted: p(d.namesFromTradeshowsConducted),
      namesFromTradeshowsAttended: p(d.namesFromTradeshowsAttended),
      namesFromOther:              p(d.namesFromOther),
      referralCalls:               p(d.referralCalls),
      followUpCalls:               p(d.followUpCalls),
      coldCalls:                   p(d.coldCalls),
      seminarTradeshowCalls:       p(d.seminarTradeshowCalls),
      serviceCalls:                p(d.serviceCalls),
      // telContacts not saved directly; qualifiedApproaches is best available proxy
      telContacts:                 p(d.telContacts || d.qualifiedApproaches),
      appointmentsSet:             p(d.appointmentsSet),
      qualifiedApproaches:         p(d.qualifiedApproaches),
      ffisScheduled:               p(d.ffisScheduled),
      ffiConducted:                p(d.ffiConducted),
      solutionPresentations:       p(d.solutionPresentations),
      newCIBooked:                 p(d.newCIBooked),
      oldCIBooked:                 p(d.oldCIBooked),
      ciConducted:                 p(d.ciConducted),
      applicationsSold:            d.version === 2 ? p(d.newBusiness?.apps) : p(d.applicationsSold || d.appsSold),
      livesSold:                   p(d.livesSold),
      apiSold:                     d.version === 2 ? p(d.newBusiness?.api)  : p(d.apiSold || d.api || d.annualPremium),
      policiesDelivered:           p(d.policiesDelivered),
      serviceContacts:             p(d.serviceContacts),
      officeHours:                 p(d.officeHours),
      fieldHours:                  p(d.fieldHours),
      // Self-eval — fallback to actual stored field names (ratingPlanning etc.)
      planningEffectiveness:       p(d.planningEffectiveness || d.ratingPlanning),
      timeManagement:              p(d.timeManagement || d.ratingTimeManagement),
      salesPerformance:            p(d.salesPerformance || d.ratingSalesPerformance),
      prospectingEffort:           p(d.prospectingEffort || d.ratingProspecting),
      overallRating:               p(d.overallRating || d.ratingOverall),
      evaluationNotes:             d.evaluationNotes || d.notes || '',
      targetAPI:                   p(d.targetAPI),
      targetAppsSold:              p(d.targetAppsSold),
      goalNotes:                   d.goalNotes || '',
      // Social & Content
      socialPostsTotal:            p(d.socialPostsTotal),
      socialEngagementTotal:       p(d.socialEngagementTotal),
      socialInboxEnquiries:        p(d.socialInboxEnquiries),
      namesFromSocial:             p(d.namesFromSocial),
      socialPlatformBreakdown:     d.socialPlatformBreakdown ?? {},
    };
  }

  // Derived totals (same formula for both schema variants)
  f.totalTelAttempts =
    f.referralCalls + f.coldCalls + f.followUpCalls + f.seminarTradeshowCalls;
  f.totalNewNames = computeTotalNewNames(f);
  f.prospectingTouches =
    f.f2fAttempts + f.referralCalls + f.coldCalls +
    f.followUpCalls + f.seminarTradeshowCalls + f.prospectingLettersSent;

  return f;
}

// ────────────────────────────────────────────────────────────────────────
// Canonical NEW NAMES total. 7 channels — referralsObtained + cold canvass
// + other + the 4 seminar/tradeshow yield fields. INTENTIONALLY EXCLUDES
// namesFromSocial (pending decision — tracked as MEDIUM FU in
// FOLLOW_UPS.md "Social-channel inclusion in canonical aggregations").
//
// Single source of truth for the kiosk activity panel (`names` row), the
// manager Master Sheet "New Names" column, the awards activity floor
// (`referralsNewLeads`), the CF `activityTotal`, the dashboard
// WeeklyStandardCard, and the Wizard v2 NAMES scorecard. Do NOT define
// alternate 7-field sums elsewhere — import this function.
//
// Accepts any object that exposes the 7 source fields; tolerates missing
// keys via `?? 0` so it works on both raw wizard formData and an extracted
// fields object. Returns a plain number.
// ────────────────────────────────────────────────────────────────────────
export function computeTotalNewNames(source) {
  if (!source) return 0;
  const p = (v) => Number(v) || 0;
  return (
    p(source.namesFromColdCanvass) +
    p(source.referralsObtained) +
    p(source.namesFromSeminarsConducted) +
    p(source.namesFromSeminarsAttended) +
    p(source.namesFromTradeshowsConducted) +
    p(source.namesFromTradeshowsAttended) +
    p(source.namesFromOther)
  );
}

// Total Production API — NB.api + PPP.apiIncrease + LMPS.apiCredit
// V2-first: reads the pre-computed stored field when available; derives from sub-objects
// if stored field is absent; falls back to V1 apiSold alias for legacy docs.
export function extractTotalProductionCredit(submission) {
  if (!submission) return 0;
  if (submission.totalProductionCredit !== undefined) {
    return Number(submission.totalProductionCredit) || 0;
  }
  if (submission.newBusiness !== undefined) {
    const nb   = Number(submission.newBusiness?.api) || 0;
    const ppp  = Number(submission.pppIncreases?.apiIncrease) || 0;
    const lmps = Number(submission.lumpsums?.apiCredit) || 0;
    return nb + ppp + lmps;
  }
  return Number(submission.apiSold) || Number(submission.api) || Number(submission.annualPremium) || 0;
}

// Total commission earned — NB commission + LMPS commission (PPP excluded per production rules)
// V2-first: reads stored field when available; derives from sub-objects if not.
// commissionRate is a percentage integer (e.g. 35 = 35%).
export function extractTotalCommission(submission, commissionRate = 0) {
  if (!submission) return 0;
  if (submission.totalCommission !== undefined) {
    return Number(submission.totalCommission) || 0;
  }
  const rateDecimal = (Number(commissionRate) || 0) / 100;
  if (submission.newBusiness !== undefined) {
    const nb       = Number(submission.newBusiness?.api) || 0;
    const lmpsComm = Number(submission.lumpsums?.commission) || 0;
    return nb * rateDecimal + lmpsComm;
  }
  const v1Api = Number(submission.apiSold) || 0;
  return v1Api * rateDecimal;
}

// 8 coaching ratios — returns 0–100 integer or null when denominator is 0
export function computeRatios(f) {
  const r = (num, den) => (den > 0 ? Math.round((num / den) * 100) : null);
  const personsReached = f.telContacts + f.f2fContacts;
  return {
    contactRate:        r(personsReached, f.prospectingTouches),
    approachRate:       r(f.qualifiedApproaches, personsReached),
    ffiConversion:      r(f.ffiConducted, f.appointmentsSet),
    presentationRate:   r(f.solutionPresentations, f.ffiConducted),
    ciBookingRate:      r(f.ciConducted, f.solutionPresentations),
    closingRatio:       r(f.applicationsSold, f.ciConducted),
    livesPerSale:
      f.applicationsSold > 0
        ? Math.round((f.livesSold / f.applicationsSold) * 10) / 10
        : null,
    activityEfficiency:
      f.qualifiedApproaches > 0
        ? Math.round(f.apiSold / f.qualifiedApproaches)
        : null,
  };
}

// Industry-standard traffic-light thresholds (adjustable in future)
export const RATIO_THRESHOLDS = {
  contactRate:        { green: 40,   amber: 25   },
  approachRate:       { green: 50,   amber: 30   },
  ffiConversion:      { green: 70,   amber: 50   },
  presentationRate:   { green: 70,   amber: 50   },
  ciBookingRate:      { green: 60,   amber: 40   },
  closingRatio:       { green: 50,   amber: 30   },
  livesPerSale:       { green: 1.5,  amber: 1.1  },
  activityEfficiency: { green: 5000, amber: 2000 },
};

export const RATIO_LABELS = {
  contactRate:        { label: 'Contact Rate',        desc: 'Persons Reached / Prospecting Touches' },
  approachRate:       { label: 'Approach Rate',        desc: 'Qual. Approaches / Persons Reached' },
  ffiConversion:      { label: 'FFI Show Rate',        desc: 'FFI Conducted / Appointments Set' },
  presentationRate:   { label: 'Presentation Rate',   desc: 'Solutions Presented / FFI Conducted' },
  ciBookingRate:      { label: 'CI Booking Rate',      desc: 'CI Conducted / Solutions Presented' },
  closingRatio:       { label: 'Closing Ratio',        desc: 'Sales / CI Conducted' },
  livesPerSale:       { label: 'Lives per Sale',       desc: 'Lives Sold / Applications Sold' },
  activityEfficiency: { label: 'Activity Efficiency',  desc: 'API / Qual. Approaches (TTD)' },
};

export const RATIO_KEY_ORDER = [
  'contactRate', 'approachRate', 'ffiConversion', 'presentationRate',
  'ciBookingRate', 'closingRatio', 'livesPerSale', 'activityEfficiency',
];

export function ratioColorClass(key, value) {
  if (value === null) return 'text-white/40';
  const t = RATIO_THRESHOLDS[key];
  if (!t) return 'text-white';
  if (value >= t.green) return 'text-success-ink';
  if (value >= t.amber) return 'text-warning-ink';
  return 'text-danger-ink';
}

export function formatRatioValue(key, value) {
  if (value === null) return '—';
  if (key === 'livesPerSale') return value.toFixed(1);
  if (key === 'activityEfficiency') return formatCurrency(value);
  return `${value}%`;
}

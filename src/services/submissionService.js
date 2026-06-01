import {
  doc, setDoc, getDoc, serverTimestamp,
  collection, query, where, orderBy, limit, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  computeLumpsumCredit,
  computeLumpsumCommission,
  computeTotalProductionCredit,
  computeTotalCommission,
} from '../lib/schema/weeklyReport.computations';

function submissionDocId(uid, weekStarting) {
  return `${uid}_${weekStarting}`;
}

export function sanitize(data, commissionRate = 0) {
  const int   = (v) => parseInt(v   ?? 0, 10) || 0;
  const float = (v) => parseFloat(v ?? 0)     || 0;

  const nb   = data.newBusiness  ?? {};
  const ppp  = data.pppIncreases ?? {};
  const lmps = data.lumpsums     ?? {};
  const spb  = data.socialPlatformBreakdown ?? {};

  const lmpsGross      = float(lmps.grossAmount);
  const lmpsApiCredit  = computeLumpsumCredit(lmpsGross);
  const lmpsCommission = computeLumpsumCommission(lmpsGross);

  const productionShape = {
    newBusiness:  { apps: int(nb.apps),  api: float(nb.api) },
    pppIncreases: { apps: int(ppp.apps), apiIncrease: float(ppp.apiIncrease) },
    lumpsums:     { grossAmount: lmpsGross, apiCredit: lmpsApiCredit, commission: lmpsCommission },
  };

  return {
    // Step 1 — Prospecting
    prospectingLettersSent:        int(data.prospectingLettersSent),
    prospectingEmailsSent:         int(data.prospectingEmailsSent),
    seminarsConducted:             int(data.seminarsConducted),
    namesFromSeminarsConducted:    int(data.namesFromSeminarsConducted),
    seminarsAttended:              int(data.seminarsAttended),
    namesFromSeminarsAttended:     int(data.namesFromSeminarsAttended),
    tradeshowsConducted:           int(data.tradeshowsConducted),
    namesFromTradeshowsConducted:  int(data.namesFromTradeshowsConducted),
    tradeshowsAttended:            int(data.tradeshowsAttended),
    namesFromTradeshowsAttended:   int(data.namesFromTradeshowsAttended),
    f2fAttempts:                   int(data.f2fAttempts),
    f2fContacts:                   int(data.f2fContacts),
    // Step 2 — Telephone Activity
    referralCalls:                 int(data.referralCalls),
    followUpCalls:                 int(data.followUpCalls),
    coldCalls:                     int(data.coldCalls),
    seminarTradeshowCalls:         int(data.seminarTradeshowCalls),
    serviceCalls:                  int(data.serviceCalls),
    // Step 3 — Approaches & FFI
    qualifiedApproaches:           int(data.qualifiedApproaches),
    appointmentsSet:               int(data.appointmentsSet),
    ffisScheduled:                 int(data.ffisScheduled),
    ffiConducted:                  int(data.ffiConducted),
    solutionPresentations:         int(data.solutionPresentations),
    // Step 4 — Closing Interviews & Sales (V2 shape)
    newCIBooked:                   int(data.newCIBooked),
    oldCIBooked:                   int(data.oldCIBooked),
    ciConducted:                   int(data.ciConducted),
    livesSold:                     int(data.livesSold),
    ...productionShape,
    totalProductionCredit:         computeTotalProductionCredit(productionShape),
    totalCommission:               computeTotalCommission(productionShape, commissionRate / 100),
    version:                       2,
    // Step 5 — New Names & Pipeline
    referralsSought:               int(data.referralsSought),
    referralsObtained:             int(data.referralsObtained),
    namesFromColdCanvass:          int(data.namesFromColdCanvass),
    namesFromOther:                int(data.namesFromOther),
    oldNamesPool:                  int(data.oldNamesPool),
    portfolioClientsIdentified:    int(data.portfolioClientsIdentified),
    // Step 6 — Deliveries & Service
    policiesReceived:              int(data.policiesReceived),
    policiesDelivered:             int(data.policiesDelivered),
    policiesOutstanding:           int(data.policiesOutstanding),
    hasServiceWork:                Boolean(data.hasServiceWork),
    serviceContacts:               int(data.serviceContacts),
    premiumCollectionMeetings:     int(data.premiumCollectionMeetings),
    withdrawalsLoans:              int(data.withdrawalsLoans),
    surrenders:                    int(data.surrenders),
    policyChanges:                 int(data.policyChanges),
    annualReviews:                 int(data.annualReviews),
    orphanReviews:                 int(data.orphanReviews),
    orphansAdopted:                int(data.orphansAdopted),
    reinstatementsSubmitted:       int(data.reinstatementsSubmitted),
    reinstatementAPI:              float(data.reinstatementAPI),
    renewalPremiumsCollected:      float(data.renewalPremiumsCollected),
    // Step 7 — Time Management
    officeHours:                   int(data.officeHours),
    fieldHours:                    int(data.fieldHours),
    // Step 8 — Self-Evaluation
    ratingPlanning:                int(data.ratingPlanning),
    ratingTimeManagement:          int(data.ratingTimeManagement),
    ratingSalesPerformance:        int(data.ratingSalesPerformance),
    ratingProspecting:             int(data.ratingProspecting),
    ratingOverall:                 int(data.ratingOverall),
    notes:                         String(data.notes ?? ''),
    // Step 9 — Next Week Goals
    targetDials:                   int(data.targetDials),
    targetTelContacts:             int(data.targetTelContacts),
    targetF2FAttempts:             int(data.targetF2FAttempts),
    targetFFI:                     int(data.targetFFI),
    targetCI:                      int(data.targetCI),
    targetAppsSold:                int(data.targetAppsSold),
    targetAPI:                     float(data.targetAPI),
    goalNotes:                     String(data.goalNotes ?? ''),
    // Social & Content (StepSocialMedia — v2 step 4)
    // Mirrors INITIAL_DATA in WizardForm.jsx ordering (flat keys then nested).
    // All five fields are whole-number counts → int() like other activity counters.
    socialPostsTotal:              int(data.socialPostsTotal),
    socialEngagementTotal:         int(data.socialEngagementTotal),
    socialInboxEnquiries:          int(data.socialInboxEnquiries),
    namesFromSocial:               int(data.namesFromSocial),
    socialPlatformBreakdown: {
      facebook:  int(spb.facebook),
      instagram: int(spb.instagram),
      whatsapp:  int(spb.whatsapp),
      linkedin:  int(spb.linkedin),
    },
  };
}

export async function saveDraft(tenantId, uid, agentName, weekStarting, data, commissionRate = 0, unitId = null) {
  const ref = doc(db, `tenants/${tenantId}/submissions/${submissionDocId(uid, weekStarting)}`);
  await setDoc(
    ref,
    { ...sanitize(data, commissionRate), userId: uid, agentId: uid, agentName, unitId, weekStarting, status: 'draft', updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function submitReport(tenantId, uid, agentName, weekStarting, data, commissionRate = 0, unitId = null) {
  const ref = doc(db, `tenants/${tenantId}/submissions/${submissionDocId(uid, weekStarting)}`);
  await setDoc(ref, {
    ...sanitize(data, commissionRate),
    userId: uid,
    agentId: uid,
    agentName,
    unitId,
    weekStarting,
    status: 'submitted',
    updatedAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
  });
}

export async function getDraft(tenantId, uid, weekStarting) {
  const ref = doc(db, `tenants/${tenantId}/submissions/${submissionDocId(uid, weekStarting)}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function getLastSubmission(tenantId, uid) {
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('agentId', '==', uid),
    orderBy('weekStarting', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].data();
}

export async function getAgentSubmissions(tenantId, uid) {
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('agentId', '==', uid),
    orderBy('weekStarting', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

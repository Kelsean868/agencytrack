import {
  doc, setDoc, getDoc, serverTimestamp,
  collection, query, where, orderBy, limit, getDocs,
} from 'firebase/firestore';
import { db, tenantId } from '../firebase';

function submissionDocId(uid, weekStarting) {
  return `${uid}_${weekStarting}`;
}

function sanitize(data) {
  const int   = (v) => parseInt(v   ?? 0, 10) || 0;
  const float = (v) => parseFloat(v ?? 0)     || 0;

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
    // Step 4 — Closing Interviews & Sales
    newCIBooked:                   int(data.newCIBooked),
    oldCIBooked:                   int(data.oldCIBooked),
    ciConducted:                   int(data.ciConducted),
    applicationsSold:              int(data.applicationsSold),
    livesSold:                     int(data.livesSold),
    apiSold:                       float(data.apiSold),
    estimatedCommissions:          float(data.estimatedCommissions),
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
  };
}

export async function saveDraft(uid, weekStarting, data) {
  const ref = doc(db, `tenants/${tenantId}/submissions/${submissionDocId(uid, weekStarting)}`);
  await setDoc(
    ref,
    { ...sanitize(data), userId: uid, agentId: uid, weekStarting, status: 'draft', updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function submitReport(uid, weekStarting, data) {
  const ref = doc(db, `tenants/${tenantId}/submissions/${submissionDocId(uid, weekStarting)}`);
  await setDoc(ref, {
    ...sanitize(data),
    userId: uid,
    agentId: uid,
    weekStarting,
    status: 'submitted',
    updatedAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
  });
}

export async function getDraft(uid, weekStarting) {
  const ref = doc(db, `tenants/${tenantId}/submissions/${submissionDocId(uid, weekStarting)}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function getLastSubmission(uid) {
  const q = query(
    collection(db, `tenants/${tenantId}/submissions`),
    where('agentId', '==', uid),
    orderBy('weekStarting', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].data();
}

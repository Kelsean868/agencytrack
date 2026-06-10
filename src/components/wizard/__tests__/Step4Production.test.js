import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  doc:           vi.fn(() => ({})),
  setDoc:        vi.fn(() => Promise.resolve()),
  getDoc:        vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  serverTimestamp: vi.fn(() => null),
  collection:    vi.fn(() => ({})),
  query:         vi.fn(() => ({})),
  where:         vi.fn(() => ({})),
  orderBy:       vi.fn(() => ({})),
  limit:         vi.fn(() => ({})),
  getDocs:       vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
}));

import { sanitize } from '../../../services/submissionService';

const BASE = {
  newBusiness:  { apps: 0, api: 0 },
  pppIncreases: { apps: 0, apiIncrease: 0 },
  lumpsums:     { grossAmount: 0 },
  newCIBooked: 0, oldCIBooked: 0, ciConducted: 0, livesSold: 0,
  referralCalls: 0, followUpCalls: 0, coldCalls: 0, seminarTradeshowCalls: 0, serviceCalls: 0,
  qualifiedApproaches: 0, appointmentsSet: 0, ffisScheduled: 0, ffiConducted: 0,
  solutionPresentations: 0, prospectingLettersSent: 0, prospectingEmailsSent: 0,
  seminarsConducted: 0, namesFromSeminarsConducted: 0,
  tradeshowsAttended: 0, namesFromTradeshowsAttended: 0, f2fAttempts: 0, f2fContacts: 0,
  referralsSought: 0, referralsObtained: 0, namesFromColdCanvass: 0, namesFromOther: 0,
  oldNamesPool: 0, portfolioClientsIdentified: 0, policiesReceived: 0, policiesDelivered: 0,
  policiesOutstanding: 0, hasServiceWork: false, serviceContacts: 0,
  premiumCollectionMeetings: 0, withdrawalsLoans: 0, surrenders: 0, policyChanges: 0,
  annualReviews: 0, orphanReviews: 0, orphansAdopted: 0, reinstatementsSubmitted: 0,
  reinstatementAPI: 0, renewalPremiumsCollected: 0, officeHours: 0, fieldHours: 0,
  ratingPlanning: 0, ratingTimeManagement: 0, ratingSalesPerformance: 0,
  ratingProspecting: 0, ratingOverall: 0, notes: '',
  targetDials: 0, targetTelContacts: 0, targetF2FAttempts: 0,
  targetFFI: 0, targetCI: 0, targetAppsSold: 0, targetAPI: 0, goalNotes: '',
};

describe('sanitize — V2 output shape', () => {
  it('initial formData produces version:2 with all three zeroed sub-objects', () => {
    const out = sanitize(BASE, 0);
    expect(out.version).toBe(2);
    expect(out.newBusiness).toEqual({ apps: 0, api: 0 });
    expect(out.pppIncreases).toEqual({ apps: 0, apiIncrease: 0 });
    expect(out.lumpsums).toEqual({ grossAmount: 0, apiCredit: 0, commission: 0 });
  });

  it('does NOT write flat applicationsSold / apiSold / estimatedCommissions', () => {
    const out = sanitize(BASE, 0);
    expect(out).not.toHaveProperty('applicationsSold');
    expect(out).not.toHaveProperty('apiSold');
    expect(out).not.toHaveProperty('estimatedCommissions');
  });

  it('NB api + commissionRate (percentage) → correct totalCommission', () => {
    const data = { ...BASE, newBusiness: { apps: 2, api: 20000 } };
    const out = sanitize(data, 35);
    expect(out.totalCommission).toBeCloseTo(7000);
  });

  it('LMPS gross → apiCredit (10%) and commission (0.5%) in lumpsums sub-object', () => {
    const data = { ...BASE, lumpsums: { grossAmount: 50000 } };
    const out = sanitize(data, 0);
    expect(out.lumpsums.apiCredit).toBe(5000);
    expect(out.lumpsums.commission).toBe(250);
  });

  it('totalProductionCredit = NB.api + PPP.apiIncrease + LMPS.apiCredit', () => {
    const data = {
      ...BASE,
      newBusiness:  { apps: 2, api: 20000 },
      pppIncreases: { apps: 1, apiIncrease: 5000 },
      lumpsums:     { grossAmount: 50000 },
    };
    const out = sanitize(data, 0);
    expect(out.totalProductionCredit).toBe(30000);
  });

  it('LMPS commission excluded from totalCommission; NB commission included', () => {
    const data = {
      ...BASE,
      newBusiness: { apps: 1, api: 20000 },
      lumpsums:    { grossAmount: 50000 },
    };
    const out = sanitize(data, 50);
    expect(out.totalCommission).toBe(10250);
  });

  it('non-Step-4 fields (referralCalls, qualifiedApproaches) are preserved', () => {
    const data = { ...BASE, referralCalls: 12, qualifiedApproaches: 8 };
    const out = sanitize(data, 0);
    expect(out.referralCalls).toBe(12);
    expect(out.qualifiedApproaches).toBe(8);
  });

  it('missing pppIncreases/lumpsums sub-objects default to zeros (no crash)', () => {
    const data = { ...BASE };
    delete data.pppIncreases;
    delete data.lumpsums;
    const out = sanitize(data, 0);
    expect(out.pppIncreases).toEqual({ apps: 0, apiIncrease: 0 });
    expect(out.lumpsums).toEqual({ grossAmount: 0, apiCredit: 0, commission: 0 });
  });
});

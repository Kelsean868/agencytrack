import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockCallable: vi.fn(),
}));
const { mockGetDoc, mockSetDoc, mockGetDocs, mockCallable } = hoisted;

vi.mock('firebase/firestore', () => ({
  doc: (_db, path) => ({ __ref: path }),
  getDoc: (...args) => hoisted.mockGetDoc(...args),
  setDoc: (...args) => hoisted.mockSetDoc(...args),
  serverTimestamp: () => '__SERVER_TIMESTAMP__',
  collection: (_db, path) => ({ __collection: path }),
  query: (ref, ...constraints) => ({ __collection: ref.__collection, __constraints: constraints }),
  where: (field, op, val) => ({ __where: { field, op, val } }),
  documentId: () => ({ __documentId: true }),
  getDocs: (...args) => hoisted.mockGetDocs(...args),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: (_functions, _name) => hoisted.mockCallable,
}));

import {
  getCompanyMinimums, setCompanyMinimums, getGoalHierarchy,
  getSalesManagerGoals, setSalesManagerGoals, getSalesManagerUid,
  setGoals,
  getGoals,
  getGoalsForAgents,
  getUnitGoals, setUnitGoals,
  getBranchGoals, setBranchGoals,
} from '../goalsService';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../utils/weeklyActivityFloors';
import { DEFAULT_TENURE_API_FLOORS } from '../../utils/tenureFloors';

beforeEach(() => {
  mockGetDoc.mockReset();
  mockSetDoc.mockReset();
  mockGetDocs.mockReset();
  mockCallable.mockReset();
});

describe('getCompanyMinimums — weeklyActivityFloors defaults', () => {
  it('returns Appendix A defaults when no companyMinimums doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    const result = await getCompanyMinimums('tenant1');
    expect(result.weeklyActivityFloors).toEqual(DEFAULT_WEEKLY_ACTIVITY_FLOORS);
    expect(result.annualAPI).toBe(200000);
    expect(result.annualApps).toBe(40);
    expect(result.persistency).toBe(90);
  });

  it('preserves a fully-seeded weeklyActivityFloors block from Firestore', async () => {
    const seeded = {
      annualAPI: 250000,
      annualApps: 50,
      persistency: 92,
      updatedBy: 'kyron',
      updatedAt: '__TS__',
      weeklyActivityFloors: { ...DEFAULT_WEEKLY_ACTIVITY_FLOORS, callsMade: 80 },
    };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => seeded });

    const result = await getCompanyMinimums('tenant1');
    expect(result.weeklyActivityFloors.callsMade).toBe(80); // override preserved
    expect(result.weeklyActivityFloors.api).toBe(4800);     // default still in place
    expect(result.annualAPI).toBe(250000);
    expect(result.updatedBy).toBe('kyron');
  });

  it('shallow-merges: stored partial block keeps defaults for absent keys', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        annualAPI: 200000,
        weeklyActivityFloors: { callsMade: 100 }, // partial override
      }),
    });

    const result = await getCompanyMinimums('tenant1');
    expect(result.weeklyActivityFloors.callsMade).toBe(100);
    expect(result.weeklyActivityFloors.telContacts).toBe(40);
    expect(result.weeklyActivityFloors.api).toBe(4800);
  });

  it('a stored companyMinimums doc without weeklyActivityFloors still gets defaults', async () => {
    // Pre-existing tenants seeded only with annualAPI/Apps/persistency (B5 era).
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ annualAPI: 200000, annualApps: 42, persistency: 90 }),
    });

    const result = await getCompanyMinimums('tenant1');
    expect(result.weeklyActivityFloors).toEqual(DEFAULT_WEEKLY_ACTIVITY_FLOORS);
  });
});

describe('getCompanyMinimums — tenureApiFloors defaults', () => {
  it('returns the brief seed table when no companyMinimums doc exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    const result = await getCompanyMinimums('tenant1');
    expect(result.tenureApiFloors).toEqual(DEFAULT_TENURE_API_FLOORS);
  });

  it('shallow-merges: stored partial tenureApiFloors keeps defaults for absent bands', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        annualAPI: 200000,
        tenureApiFloors: { band0_lt12: 175000 },
      }),
    });

    const result = await getCompanyMinimums('tenant1');
    expect(result.tenureApiFloors.band0_lt12).toBe(175000);
    expect(result.tenureApiFloors.band_gt60).toBe(500000);
  });

  it('a stored companyMinimums doc without tenureApiFloors still gets defaults', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ annualAPI: 200000, annualApps: 42, persistency: 90 }),
    });

    const result = await getCompanyMinimums('tenant1');
    expect(result.tenureApiFloors).toEqual(DEFAULT_TENURE_API_FLOORS);
  });
});

describe('getGoalHierarchy — companyFloor.api resolves per-agent from tenure', () => {
  // The hierarchy reads: getCompanyMinimums (companyMinimums doc),
  // getBranchGoals (branch year doc), getUnitGoals (unit year doc),
  // getGoals (agent goals doc), and the agent user doc. Order of getDoc()
  // calls is non-deterministic (Promise.all), so we drive by path.
  const wireDocs = (docsByPath) => {
    mockGetDoc.mockImplementation((ref) => {
      const path = ref?.__ref ?? '';
      const data = docsByPath[path];
      return Promise.resolve({
        exists: () => data !== undefined,
        data: () => data,
      });
    });
  };

  it('agent < 12 months → companyFloor.api = 150000', async () => {
    // Anchor against a contractStartDate close enough to "today" that
    // months-of-service is < 12 regardless of when this test runs.
    const today = new Date();
    const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    wireDocs({
      'tenants/t1/config/companyMinimums': {
        annualAPI: 999999, annualApps: 42, persistency: 90,
      },
      'tenants/t1/users/agent1': { contractStartDate: startDate },
    });

    const result = await getGoalHierarchy('t1', null, 2026, 'agent1');
    expect(result.companyFloor.api).toBe(150000);
    expect(result.companyFloor.apps).toBe(42);
  });

  it('agent > 60 months → companyFloor.api = 500000', async () => {
    wireDocs({
      'tenants/t1/config/companyMinimums': {
        annualAPI: 999999, annualApps: 42, persistency: 90,
      },
      'tenants/t1/users/agent1': { contractStartDate: '2015-01-01' },
    });

    const result = await getGoalHierarchy('t1', null, 2026, 'agent1');
    expect(result.companyFloor.api).toBe(500000);
  });

  it('agent with missing contractStartDate → flat 200k fallback', async () => {
    wireDocs({
      'tenants/t1/config/companyMinimums': {
        annualAPI: 999999, annualApps: 42, persistency: 90,
      },
      'tenants/t1/users/agent1': { /* no contractStartDate */ },
    });

    const result = await getGoalHierarchy('t1', null, 2026, 'agent1');
    expect(result.companyFloor.api).toBe(200000);
  });
});

describe('setCompanyMinimums — preserves weeklyActivityFloors via merge', () => {
  it('writes only annualAPI fields when no floors provided; merge: true preserves existing floors block', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setCompanyMinimums('tenant1', { annualAPI: 250000 }, 'kyron-uid');

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [ref, payload, opts] = mockSetDoc.mock.calls[0];
    expect(ref.__ref).toBe('tenants/tenant1/config/companyMinimums');
    expect(payload).toEqual({
      annualAPI: 250000,
      updatedBy: 'kyron-uid',
      updatedAt: '__SERVER_TIMESTAMP__',
    });
    expect(opts).toEqual({ merge: true });
    // When floors are not passed, the payload omits weeklyActivityFloors.
    // Firestore merge: true preserves whatever is already on the doc.
    expect(payload).not.toHaveProperty('weeklyActivityFloors');
  });

  it('rejects non-positive annualAPI without writing', async () => {
    await expect(setCompanyMinimums('tenant1', { annualAPI: 0 }, 'kyron-uid'))
      .rejects.toThrow(/positive/i);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

describe('setCompanyMinimums — weeklyActivityFloors validation and write (Track E b)', () => {
  const VALID_FLOORS = {
    callsMade: 60,
    telContacts: 40,
    appointmentsScheduled: 20,
    interviewsKept: 15,
    factFindsCompleted: 10,
    closingInterviewsKept: 10,
    applicationsSubmitted: 1,
    clientsSold: 1,
    api: 4800,
    referralsNewLeads: 100,
  };

  it('writes weeklyActivityFloors block when valid floors are provided', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setCompanyMinimums('tenant1', { annualAPI: 250000, weeklyActivityFloors: VALID_FLOORS }, 'kyron-uid');

    const [, payload, opts] = mockSetDoc.mock.calls[0];
    expect(opts).toEqual({ merge: true });
    expect(payload.weeklyActivityFloors).toEqual(VALID_FLOORS);
    expect(payload.annualAPI).toBe(250000);
  });

  it('accepts decimal value for api floor', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setCompanyMinimums('tenant1', {
      annualAPI: 200000,
      weeklyActivityFloors: { ...VALID_FLOORS, api: 4800.5 },
    }, 'uid');
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.weeklyActivityFloors.api).toBe(4800.5);
  });

  it('rejects non-integer value for non-api floor key', async () => {
    await expect(setCompanyMinimums('tenant1', {
      annualAPI: 200000,
      weeklyActivityFloors: { ...VALID_FLOORS, callsMade: 60.5 },
    }, 'uid')).rejects.toThrow(/whole number/i);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('rejects negative floor value', async () => {
    await expect(setCompanyMinimums('tenant1', {
      annualAPI: 200000,
      weeklyActivityFloors: { ...VALID_FLOORS, callsMade: -1 },
    }, 'uid')).rejects.toThrow(/non-negative/i);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('rejects zero api floor', async () => {
    await expect(setCompanyMinimums('tenant1', {
      annualAPI: 200000,
      weeklyActivityFloors: { ...VALID_FLOORS, api: 0 },
    }, 'uid')).rejects.toThrow(/positive/i);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('accepts zero for non-api floor (allows disabling a floor)', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setCompanyMinimums('tenant1', {
      annualAPI: 200000,
      weeklyActivityFloors: { ...VALID_FLOORS, referralsNewLeads: 0 },
    }, 'uid');
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.weeklyActivityFloors.referralsNewLeads).toBe(0);
  });
});

describe('getSalesManagerGoals', () => {
  it('returns doc data when the doc exists', async () => {
    const docData = { api: 500000, apps: 60, smUid: 'sm1', year: 2026, tenantId: 't1' };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => docData });
    const result = await getSalesManagerGoals('t1', 'sm1', 2026);
    expect(result).toEqual(docData);
    expect(mockGetDoc.mock.calls[0][0].__ref).toBe('tenants/t1/salesManagerGoals/sm1_2026');
  });

  it('returns null when the doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    const result = await getSalesManagerGoals('t1', 'sm1', 2026);
    expect(result).toBeNull();
  });
});

describe('setSalesManagerGoals', () => {
  it('writes to the correct doc path with parsed payload', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setSalesManagerGoals('t1', 'sm1', 2026,
      { api: '500000', apps: '60', ffiConducted: '10', ciConducted: '8', dials: '0' },
      { setBy: 'uid-sm', setByName: 'Sam Manager' },
    );
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [ref, payload] = mockSetDoc.mock.calls[0];
    expect(ref.__ref).toBe('tenants/t1/salesManagerGoals/sm1_2026');
    expect(payload.api).toBe(500000);
    expect(payload.apps).toBe(60);
    expect(payload.ffiConducted).toBe(10);
    expect(payload.ciConducted).toBe(8);
    expect(payload.smUid).toBe('sm1');
    expect(payload.year).toBe(2026);
    expect(payload.tenantId).toBe('t1');
    expect(payload.setBy).toBe('uid-sm');
    expect(payload.setByName).toBe('Sam Manager');
    expect(payload.setAt).toBe('__SERVER_TIMESTAMP__');
    // dials is 0 so it should NOT be included (conditional write)
    expect(payload).not.toHaveProperty('dials');
  });

  it('omits optional activity fields when zero', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setSalesManagerGoals('t1', 'sm1', 2026,
      { api: '400000', apps: '50' },
      { setBy: 'uid', setByName: 'SM' },
    );
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload).not.toHaveProperty('ffiConducted');
    expect(payload).not.toHaveProperty('ciConducted');
    expect(payload).not.toHaveProperty('dials');
  });
});

describe('getSalesManagerUid', () => {
  it('returns null when CF reports no sales_manager', async () => {
    mockCallable.mockResolvedValue({ data: { smUid: null } });
    const result = await getSalesManagerUid('t1');
    expect(result).toBeNull();
  });

  it('returns the uid from the CF response', async () => {
    mockCallable.mockResolvedValue({ data: { smUid: 'sm-uid-abc' } });
    const result = await getSalesManagerUid('t1');
    expect(result).toBe('sm-uid-abc');
  });
});

describe('getGoalHierarchy — salesManagerTarget tier', () => {
  const wireDocs = (docsByPath) => {
    mockGetDoc.mockImplementation((ref) => {
      const path = ref?.__ref ?? '';
      const data = docsByPath[path];
      return Promise.resolve({ exists: () => data !== undefined, data: () => data });
    });
  };

  it('returns salesManagerTarget: null when smUid is not passed', async () => {
    wireDocs({ 'tenants/t1/config/companyMinimums': { annualAPI: 200000, annualApps: 42 } });
    const result = await getGoalHierarchy('t1', null, 2026, null);
    expect(result.salesManagerTarget).toBeNull();
  });

  it('returns populated salesManagerTarget when smUid is passed and doc exists', async () => {
    wireDocs({
      'tenants/t1/config/companyMinimums': { annualAPI: 200000, annualApps: 42 },
      'tenants/t1/salesManagerGoals/sm1_2026': { api: 600000, apps: 70, ffiConducted: 12, ciConducted: 10, dials: 500 },
    });
    const result = await getGoalHierarchy('t1', null, 2026, null, 'sm1');
    expect(result.salesManagerTarget).toEqual({ api: 600000, apps: 70, ffiConducted: 12, ciConducted: 10, dials: 500 });
  });

  it('returns salesManagerTarget: null when smUid is passed but SM doc does not exist', async () => {
    wireDocs({ 'tenants/t1/config/companyMinimums': { annualAPI: 200000, annualApps: 42 } });
    const result = await getGoalHierarchy('t1', null, 2026, null, 'sm1');
    expect(result.salesManagerTarget).toBeNull();
  });
});

// ── setGoals — targetLocked field ─────────────────────────────────────────────

describe('setGoals — targetLocked field', () => {
  beforeEach(() => {
    mockSetDoc.mockResolvedValue(undefined);
  });

  it('does NOT write targetLocked when not provided in data (preserves existing flag)', async () => {
    await setGoals('t1', 'a1', { targetAnnualAPI: 200000, targetWeeklyAPI: 3800 }, 'mgr', 'Mgr');
    const [, payload] = mockSetDoc.mock.calls[0];
    expect('targetLocked' in payload).toBe(false);
  });

  it('writes targetLocked: true when data.targetLocked is true', async () => {
    await setGoals('t1', 'a1', { targetAnnualAPI: 300000, targetWeeklyAPI: 5700, targetLocked: true }, 'mgr', 'Mgr');
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.targetLocked).toBe(true);
  });

  it('coerces a non-boolean truthy value for targetLocked to false (strict === check)', async () => {
    await setGoals('t1', 'a1', { targetAnnualAPI: 200000, targetWeeklyAPI: 3800, targetLocked: 1 }, 'mgr', 'Mgr');
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.targetLocked).toBe(false);
  });
});

// ── setGoals — cascade-floor enforcement ─────────────────────────────────────

describe('setGoals — cascade-floor (agent personal commitment vs locked target)', () => {
  // Wires getDoc to return path-keyed docs. Handles companyMinimums, user doc,
  // and existing goals doc in the same mockGetDoc call.
  const wirePersonal = (existingGoals, mins = { annualAPI: 200000, annualApps: 42, persistency: 90 }) => {
    mockGetDoc.mockImplementation((ref) => {
      const path = ref?.__ref ?? '';
      const docs = {
        'tenants/t1/config/companyMinimums': mins,
        'tenants/t1/users/a1': {},         // contractStartDate absent → flat 200k floor
        'tenants/t1/goals/a1': existingGoals,
      };
      const data = docs[path];
      return Promise.resolve({ exists: () => data !== undefined, data: () => data });
    });
    mockSetDoc.mockResolvedValue(undefined);
  };

  it('rejects personalAnnualAPI below a locked manager target', async () => {
    wirePersonal({ targetLocked: true, targetAnnualAPI: 300000 });
    await expect(
      setGoals('t1', 'a1', { personalAnnualAPI: 250000 }, 'a1', 'Agent'),
    ).rejects.toThrow(/manager locked target/i);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('accepts personalAnnualAPI at exactly the locked manager target', async () => {
    wirePersonal({ targetLocked: true, targetAnnualAPI: 300000 });
    await expect(
      setGoals('t1', 'a1', { personalAnnualAPI: 300000 }, 'a1', 'Agent'),
    ).resolves.toBeUndefined();
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.personalAnnualAPI).toBe(300000);
  });

  it('allows personalAnnualAPI below an unlocked (recommended) target', async () => {
    // target is 500k but unlocked; company floor is 200k; personal 250k should pass
    wirePersonal({ targetLocked: false, targetAnnualAPI: 500000 });
    await expect(
      setGoals('t1', 'a1', { personalAnnualAPI: 250000 }, 'a1', 'Agent'),
    ).resolves.toBeUndefined();
  });

  it('company floor still enforced when locked target is below the company floor', async () => {
    // locked target = 100k < company floor 200k → effective floor = 200k, source = company minimum
    wirePersonal({ targetLocked: true, targetAnnualAPI: 100000 });
    await expect(
      setGoals('t1', 'a1', { personalAnnualAPI: 150000 }, 'a1', 'Agent'),
    ).rejects.toThrow(/company minimum/i);
  });

  it('rejects personalAnnualApps below a locked manager target for apps', async () => {
    wirePersonal({ targetLocked: true, targetAnnualApps: 60 });
    await expect(
      setGoals('t1', 'a1', { personalAnnualApps: 50 }, 'a1', 'Agent'),
    ).rejects.toThrow(/manager locked target/i);
  });

  it('rejects personalAnnualPersistency below a locked manager target for persistency', async () => {
    wirePersonal({ targetLocked: true, targetAnnualPersistency: 95 });
    await expect(
      setGoals('t1', 'a1', { personalAnnualPersistency: 92 }, 'a1', 'Agent'),
    ).rejects.toThrow(/manager locked target/i);
  });

  it('uses max() — locked target beats company floor when higher', async () => {
    // company floor 200k, locked target 300k → error message names "manager locked target"
    wirePersonal({ targetLocked: true, targetAnnualAPI: 300000 });
    const err = await setGoals('t1', 'a1', { personalAnnualAPI: 250000 }, 'a1', 'Agent').catch((e) => e);
    expect(err.message).toMatch(/TTD 300,000/);
    expect(err.message).toMatch(/manager locked target/i);
  });

  it('propagates agent-doc read error instead of silently using flat fallback', async () => {
    // A Firestore error on the agent doc must NOT silently fall back to the 200k
    // flat floor — a tenure-based floor could be higher than 200k, and swallowing
    // the error would allow a below-floor commitment to be written. Surface the error.
    mockGetDoc.mockImplementation((ref) => {
      const path = ref?.__ref ?? '';
      if (path === 'tenants/t1/users/a1') {
        return Promise.reject(new Error('Missing or insufficient permissions.'));
      }
      const docs = {
        'tenants/t1/config/companyMinimums': { annualAPI: 200000, annualApps: 42, persistency: 90 },
        'tenants/t1/goals/a1': {},
      };
      const data = docs[path];
      return Promise.resolve({ exists: () => data !== undefined, data: () => data });
    });
    mockSetDoc.mockResolvedValue(undefined);
    await expect(
      setGoals('t1', 'a1', { personalAnnualAPI: 150000 }, 'a1', 'Agent'),
    ).rejects.toThrow(/Missing or insufficient permissions/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

// ── getGoals ──────────────────────────────────────────────────────────────────

describe('getGoals', () => {
  it('returns doc data when the goals doc exists', async () => {
    const data = { personalAnnualAPI: 240000, personalAnnualApps: 42 };
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => data });
    const result = await getGoals('t1', 'agent1');
    expect(result).toEqual(data);
    expect(mockGetDoc).toHaveBeenCalledWith({ __ref: 'tenants/t1/goals/agent1' });
  });

  it('returns null when the goals doc does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    const result = await getGoals('t1', 'agent1');
    expect(result).toBeNull();
  });
});

// ── getGoalsForAgents (EFF-007) ─────────────────────────────────────────────────

describe('getGoalsForAgents', () => {
  it('returns {} for an empty agent list without querying', async () => {
    const map = await getGoalsForAgents('t1', []);
    expect(map).toEqual({});
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('fetches ≤30 agents in a single documentId() in query, keyed by doc id', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'a1', data: () => ({ personalAnnualAPI: 240000 }) },
        { id: 'a3', data: () => ({ personalAnnualAPI: 300000 }) },
        // a2 has no goal doc → simply absent from the results
      ],
    });

    const map = await getGoalsForAgents('t1', ['a1', 'a2', 'a3']);

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(Object.keys(map).sort()).toEqual(['a1', 'a3']);
    expect(map.a1).toEqual({ personalAnnualAPI: 240000 });
    expect(map.a2).toBeUndefined(); // missing key — caller defaults to null (matches getGoals)
  });

  it('splits >30 agents into multiple documentId() in batches', async () => {
    const ids = Array.from({ length: 31 }, (_, i) => `agent${i}`);
    mockGetDocs
      .mockResolvedValueOnce({ docs: [{ id: 'agent0',  data: () => ({ personalAnnualAPI: 1 }) }] })
      .mockResolvedValueOnce({ docs: [{ id: 'agent30', data: () => ({ personalAnnualAPI: 2 }) }] });

    const map = await getGoalsForAgents('t1', ids);

    expect(mockGetDocs).toHaveBeenCalledTimes(2); // 31 ids → two batches (30 + 1)
    expect(map.agent0).toEqual({ personalAnnualAPI: 1 });
    expect(map.agent30).toEqual({ personalAnnualAPI: 2 });
  });

  it('skips a batch whose query is rejected, keeping the surviving batch (per-batch isolation)', async () => {
    const ids = Array.from({ length: 31 }, (_, i) => `agent${i}`);
    mockGetDocs
      .mockRejectedValueOnce(new Error('PERMISSION_DENIED'))                                       // batch 1 (agent0..agent29)
      .mockResolvedValueOnce({ docs: [{ id: 'agent30', data: () => ({ personalAnnualAPI: 9 }) }] }); // batch 2 (agent30)

    const map = await getGoalsForAgents('t1', ids);

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(map.agent0).toBeUndefined();                    // rejected batch skipped, no throw
    expect(map.agent30).toEqual({ personalAnnualAPI: 9 });  // surviving batch still present
  });
});

// ── getUnitGoals ──────────────────────────────────────────────────────────────

describe('getUnitGoals', () => {
  it('returns doc data when the unit goals doc exists', async () => {
    const data = { unitId: 'u1', year: 2026, api: 500000, apps: 84 };
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => data });
    const result = await getUnitGoals('t1', 'u1', 2026);
    expect(result).toEqual(data);
    expect(mockGetDoc).toHaveBeenCalledWith({ __ref: 'tenants/t1/unitGoals/u1_2026' });
  });

  it('returns null when the unit goals doc does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    const result = await getUnitGoals('t1', 'u1', 2026);
    expect(result).toBeNull();
  });
});

// ── setUnitGoals ──────────────────────────────────────────────────────────────

describe('setUnitGoals', () => {
  it('writes to the correct doc path with parsed payload', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setUnitGoals('t1', 'u1', 2026,
      { api: '500000', apps: '84' },
      { locked: true, setBy: 'mgr1', setByName: 'Manager', setByRole: 'branch_manager' },
    );
    expect(mockSetDoc).toHaveBeenCalledWith(
      { __ref: 'tenants/t1/unitGoals/u1_2026' },
      expect.objectContaining({
        unitId: 'u1',
        year: 2026,
        tenantId: 't1',
        api: 500000,
        apps: 84,
        locked: true,
        setBy: 'mgr1',
        setByName: 'Manager',
        setByRole: 'branch_manager',
        setAt: '__SERVER_TIMESTAMP__',
      }),
    );
  });

  it('defaults locked to false when meta.locked is absent', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setUnitGoals('t1', 'u1', 2026,
      { api: 500000, apps: 84 },
      { setBy: 'mgr1', setByName: 'Manager', setByRole: 'unit_manager' },
    );
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.locked).toBe(false);
  });

  it('omits optional activity fields when zero', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setUnitGoals('t1', 'u1', 2026,
      { api: 500000, apps: 84, ffiConducted: 0, ciConducted: 0, dials: 0 },
      { setBy: 'mgr1', setByName: 'Manager', setByRole: 'unit_manager' },
    );
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('ffiConducted');
    expect(payload).not.toHaveProperty('ciConducted');
    expect(payload).not.toHaveProperty('dials');
  });

  it('omits optional activity fields when absent from input', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setUnitGoals('t1', 'u1', 2026,
      { api: 500000, apps: 84 },
      { setBy: 'mgr1', setByName: 'Manager', setByRole: 'unit_manager' },
    );
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('ffiConducted');
    expect(payload).not.toHaveProperty('ciConducted');
    expect(payload).not.toHaveProperty('dials');
  });

  it('includes optional activity fields when non-zero', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setUnitGoals('t1', 'u1', 2026,
      { api: 500000, apps: 84, ffiConducted: 20, ciConducted: 15, dials: 50 },
      { setBy: 'mgr1', setByName: 'Manager', setByRole: 'branch_manager' },
    );
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.ffiConducted).toBe(20);
    expect(payload.ciConducted).toBe(15);
    expect(payload.dials).toBe(50);
  });

  it('coerces string numeric values via parseFloat', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setUnitGoals('t1', 'u1', 2026,
      { api: '480000', apps: '72' },
      { setBy: 'mgr1', setByName: 'Manager', setByRole: 'unit_manager' },
    );
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.api).toBe(480000);
    expect(payload.apps).toBe(72);
  });
});

// ── getBranchGoals ────────────────────────────────────────────────────────────

describe('getBranchGoals', () => {
  it('returns doc data when the branch goals doc exists', async () => {
    const data = { year: 2026, tenantId: 't1', api: 1200000, apps: 200 };
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => data });
    const result = await getBranchGoals('t1', 2026);
    expect(result).toEqual(data);
    expect(mockGetDoc).toHaveBeenCalledWith({ __ref: 'tenants/t1/branchGoals/2026' });
  });

  it('returns null when the branch goals doc does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    const result = await getBranchGoals('t1', 2026);
    expect(result).toBeNull();
  });
});

// ── setBranchGoals ────────────────────────────────────────────────────────────

describe('setBranchGoals', () => {
  it('writes to the correct doc path with parsed payload', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setBranchGoals('t1', 2026,
      { api: '1200000', apps: '200' },
      { locked: true, setBy: 'bm1', setByName: 'Branch Manager' },
    );
    expect(mockSetDoc).toHaveBeenCalledWith(
      { __ref: 'tenants/t1/branchGoals/2026' },
      expect.objectContaining({
        year: 2026,
        tenantId: 't1',
        api: 1200000,
        apps: 200,
        locked: true,
        setBy: 'bm1',
        setByName: 'Branch Manager',
        setAt: '__SERVER_TIMESTAMP__',
      }),
    );
  });

  it('defaults locked to false when meta.locked is absent', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setBranchGoals('t1', 2026,
      { api: 1200000, apps: 200 },
      { setBy: 'bm1', setByName: 'Branch Manager' },
    );
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.locked).toBe(false);
  });

  it('omits optional activity fields when zero', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setBranchGoals('t1', 2026,
      { api: 1200000, apps: 200, ffiConducted: 0, ciConducted: 0, dials: 0 },
      { setBy: 'bm1', setByName: 'Branch Manager' },
    );
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('ffiConducted');
    expect(payload).not.toHaveProperty('ciConducted');
    expect(payload).not.toHaveProperty('dials');
  });

  it('omits optional activity fields when absent from input', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setBranchGoals('t1', 2026,
      { api: 1200000, apps: 200 },
      { setBy: 'bm1', setByName: 'Branch Manager' },
    );
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('ffiConducted');
    expect(payload).not.toHaveProperty('ciConducted');
    expect(payload).not.toHaveProperty('dials');
  });

  it('includes optional activity fields when non-zero', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await setBranchGoals('t1', 2026,
      { api: 1200000, apps: 200, ffiConducted: 40, ciConducted: 30, dials: 100 },
      { setBy: 'bm1', setByName: 'Branch Manager' },
    );
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.ffiConducted).toBe(40);
    expect(payload.ciConducted).toBe(30);
    expect(payload.dials).toBe(100);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDoc = vi.fn();
const doc = vi.fn((db, path) => ({ db, path }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  doc: (...args) => doc(...args),
  getDoc: (...args) => getDoc(...args),
}));
vi.mock('../kioskFirebase', () => ({ kioskAuth: {}, kioskDb: { name: 'kiosk-db' } }));
vi.mock('../../../services/agentOfMonthService', () => ({
  getCurrentMonthKey: vi.fn(), getPrevMonthKey: vi.fn(), isWithinEditWindow: vi.fn(),
}));
vi.mock('../../../utils/dateInputs', () => ({ getTodayTT: vi.fn() }));

import { getKioskLeaderboardAggregate } from '../kioskServices';

describe('getKioskLeaderboardAggregate (FR Leaderboard L-3)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('does one getDoc of tenants/{tid}/leaderboards/{branchId} through the kiosk db', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ week: [], sources: { api: 'ledger' } }) });
    const data = await getKioskLeaderboardAggregate('t1', 'b1');
    expect(getDoc).toHaveBeenCalledTimes(1);
    expect(doc).toHaveBeenCalledWith({ name: 'kiosk-db' }, 'tenants/t1/leaderboards/b1');
    expect(data).toEqual({ week: [], sources: { api: 'ledger' } });
  });

  it('returns null when the doc does not exist yet', async () => {
    getDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    expect(await getKioskLeaderboardAggregate('t1', 'b1')).toBeNull();
  });

  it('returns null without reading when tenant or branch is missing', async () => {
    expect(await getKioskLeaderboardAggregate('t1', '')).toBeNull();
    expect(await getKioskLeaderboardAggregate(undefined, 'b1')).toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('lets a denied read throw (the shell keeps the last good board)', async () => {
    getDoc.mockRejectedValue(new Error('permission-denied'));
    await expect(getKioskLeaderboardAggregate('t1', 'b1')).rejects.toThrow('permission-denied');
  });
});

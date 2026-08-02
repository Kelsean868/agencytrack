/**
 * commit() — the mutation seam.
 *
 * The two behaviours worth pinning hardest are the ones a future edit is most
 * likely to break: that the ORIGINAL error survives on `.cause` (a caller must
 * still be able to branch on a domain error), and that the syncing counter
 * returns to zero on the failure path as reliably as on the success path.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { commit, isSyncing, CommitFailedError, resetSyncingForTests } from '../commit';
import { getEntries, clearEntries } from '../../services/activityLogService';

beforeEach(() => {
  clearEntries();
  resetSyncingForTests();
});

describe('success path', () => {
  it('returns whatever fn resolves to', async () => {
    await expect(commit('save', async () => 'result')).resolves.toBe('result');
  });

  it('accepts a synchronous fn as well as an async one', async () => {
    await expect(commit('save', () => 42)).resolves.toBe(42);
  });

  it('appends ONE activity entry carrying the label', async () => {
    await commit('Saved the week plan', async () => null);
    const entries = getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: 'commit', message: 'Saved the week plan' });
  });

  it('clears the syncing flag afterwards', async () => {
    await commit('save', async () => null);
    expect(isSyncing()).toBe(false);
  });

  it('reports syncing WHILE in flight', async () => {
    let observed = null;
    await commit('save', async () => { observed = isSyncing(); });
    expect(observed).toBe(true);
    expect(isSyncing()).toBe(false);
  });
});

describe('failure path — typed error, never a bare throw', () => {
  it('throws CommitFailedError, not the raw error', async () => {
    const boom = new Error('firestore exploded');
    await expect(commit('save the plan', async () => { throw boom; }))
      .rejects.toBeInstanceOf(CommitFailedError);
  });

  it('sets .name explicitly (matches the commitPlanService idiom)', async () => {
    const err = await commit('save', async () => { throw new Error('x'); }).catch((e) => e);
    expect(err.name).toBe('CommitFailedError');
  });

  it('preserves the ORIGINAL error on .cause — domain errors stay branchable', async () => {
    class BelowApiFloorError extends Error {
      constructor() { super('below floor'); this.name = 'BelowApiFloorError'; this.floor = 100; }
    }
    const domain = new BelowApiFloorError();

    const err = await commit('commit plan', async () => { throw domain; }).catch((e) => e);

    expect(err).toBeInstanceOf(CommitFailedError);
    expect(err.cause).toBe(domain);                          // identity, not a copy
    expect(err.cause).toBeInstanceOf(BelowApiFloorError);    // still branchable
    expect(err.cause.floor).toBe(100);                       // structured data intact
  });

  it('carries the label, and surfaces the underlying message', async () => {
    const err = await commit('save the plan', async () => { throw new Error('network down'); })
      .catch((e) => e);
    expect(err.label).toBe('save the plan');
    expect(err.message).toContain('save the plan');
    expect(err.message).toContain('network down');
  });

  it('degrades to a usable message when the cause has none', async () => {
    const err = await commit('save', async () => { throw undefined; }).catch((e) => e);
    expect(err.message).toContain('save');
    expect(err.message).toContain('The operation failed.');
  });

  it('CLEARS the syncing flag on failure — the leak that would matter most', async () => {
    await commit('save', async () => { throw new Error('x'); }).catch(() => {});
    expect(isSyncing()).toBe(false);
  });

  it('does NOT append an activity entry when the mutation failed', async () => {
    await commit('save', async () => { throw new Error('x'); }).catch(() => {});
    expect(getEntries()).toEqual([]);
  });
});

describe('concurrency — why the counter is not a boolean', () => {
  it('stays syncing until the LAST concurrent commit settles', async () => {
    let releaseFirst;
    const first = new Promise((r) => { releaseFirst = r; });

    const slow = commit('slow', async () => { await first; });
    const fast = commit('fast', async () => 'done');
    await fast;

    // A boolean flag would have been cleared by `fast` here, falsely reporting
    // "saved" while `slow` is still writing.
    expect(isSyncing()).toBe(true);

    releaseFirst();
    await slow;
    expect(isSyncing()).toBe(false);
  });

  it('a failing commit does not strand the counter for a concurrent one', async () => {
    const failing = commit('bad', async () => { throw new Error('x'); }).catch(() => {});
    const ok = commit('good', async () => 'v');
    await Promise.all([failing, ok]);
    expect(isSyncing()).toBe(false);
  });
});

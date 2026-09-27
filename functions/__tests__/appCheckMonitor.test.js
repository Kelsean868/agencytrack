'use strict';

// P2e (SEC-11) — App Check MONITOR mode on callables: log, never reject.

const mockInfo = jest.fn();
jest.mock('firebase-functions/logger', () => ({ info: (...a) => mockInfo(...a) }));

const { withAppCheckMonitor, appCheckStatus } = require('../lib/appCheckMonitor');

const req = (headers = {}) => ({ header: (h) => headers[h] });

beforeEach(() => mockInfo.mockReset());

describe('appCheckStatus', () => {
  it('valid when the SDK verified a token (context.app set)', () => {
    expect(appCheckStatus({ app: { appId: 'x' }, rawRequest: req() })).toBe('valid');
  });
  it('invalid when a token was sent but did not verify', () => {
    expect(appCheckStatus({ rawRequest: req({ 'X-Firebase-AppCheck': 'bad' }) })).toBe('invalid');
    expect(appCheckStatus({ rawRequest: { headers: { 'x-firebase-appcheck': 'bad' } } })).toBe('invalid');
  });
  it('missing when no token was sent (or no request at all, e.g. unit tests)', () => {
    expect(appCheckStatus({ rawRequest: req() })).toBe('missing');
    expect(appCheckStatus({})).toBe('missing');
    expect(appCheckStatus(undefined)).toBe('missing');
  });
});

describe('withAppCheckMonitor', () => {
  it('passes data/context through and returns the handler result unchanged — for every status', async () => {
    const handler = jest.fn(async (data) => ({ ok: data.n }));
    const wrapped = withAppCheckMonitor('fnX', handler);
    for (const context of [{ app: {} }, { rawRequest: req({ 'X-Firebase-AppCheck': 'bad' }) }, {}]) {
      await expect(wrapped({ n: 7 }, context)).resolves.toEqual({ ok: 7 });
    }
    expect(handler).toHaveBeenCalledTimes(3);
    expect(mockInfo.mock.calls.map((c) => c[1])).toEqual([
      { fn: 'fnX', appCheck: 'valid' },
      { fn: 'fnX', appCheck: 'invalid' },
      { fn: 'fnX', appCheck: 'missing' },
    ]);
  });

  it('a logging failure never blocks the call', async () => {
    mockInfo.mockImplementation(() => { throw new Error('logger down'); });
    const wrapped = withAppCheckMonitor('fnY', async () => 'done');
    await expect(wrapped({}, {})).resolves.toBe('done');
  });

  it('handler errors propagate exactly as before (the wrapper adds none of its own)', async () => {
    const err = Object.assign(new Error('nope'), { code: 'permission-denied' });
    const wrapped = withAppCheckMonitor('fnZ', async () => { throw err; });
    await expect(wrapped({}, {})).rejects.toBe(err);
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadDeviceSecret, saveDeviceSecret } from '../kioskDevice';

// P2e (SEC-04) — the kiosk keeps its pairing secret per tenant + link.

describe('kioskDevice', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('round-trips a secret per tenant + link', () => {
    expect(loadDeviceSecret('t1', 'tokenA'.repeat(4))).toBeNull();
    expect(saveDeviceSecret('t1', 'tokenA'.repeat(4), 's1')).toBe(true);
    expect(saveDeviceSecret('t1', 'tokenB'.repeat(4), 's2')).toBe(true);
    expect(loadDeviceSecret('t1', 'tokenA'.repeat(4))).toBe('s1');
    expect(loadDeviceSecret('t1', 'tokenB'.repeat(4))).toBe('s2');
    expect(loadDeviceSecret('t2', 'tokenA'.repeat(4))).toBeNull();
  });

  it('never writes the whole bearer token into the storage key', () => {
    const token = 'f'.repeat(64);
    saveDeviceSecret('t1', token, 's1');
    const keys = Object.keys(window.localStorage);
    expect(keys.some((k) => k.includes(token))).toBe(false);
  });

  it('reports false (never throws) when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded'); });
    expect(saveDeviceSecret('t1', 'tok', 's1')).toBe(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(loadDeviceSecret('t1', 'tok')).toBeNull();
  });
});

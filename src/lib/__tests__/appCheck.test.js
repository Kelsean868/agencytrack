import { describe, it, expect, vi, afterEach } from 'vitest';
import { initAppCheck } from '../appCheck';

// P2e (SEC-11) — App Check in monitor mode. The app must load with the site key
// EMPTY (App Check skipped) and SET (App Check started), and a failed start must
// never stop the app.

function fakeDeps({ throws = false } = {}) {
  const initializeAppCheck = vi.fn((app, opts) => {
    if (throws) throw new Error('reCAPTCHA blocked');
    return { app, opts };
  });
  class ReCaptchaEnterpriseProvider {
    constructor(key) { this.key = key; }
  }
  return { initializeAppCheck, ReCaptchaEnterpriseProvider };
}

const APP = { name: '[DEFAULT]' };

describe('initAppCheck', () => {
  afterEach(() => {
    delete globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN;
  });

  it('site key EMPTY → skipped: returns null and never touches the SDK', () => {
    for (const siteKey of ['', '   ', undefined, null]) {
      const deps = fakeDeps();
      expect(initAppCheck(APP, { siteKey, deps })).toBeNull();
      expect(deps.initializeAppCheck).not.toHaveBeenCalled();
    }
  });

  it('site key SET → starts with reCAPTCHA Enterprise and auto-refresh', () => {
    const deps = fakeDeps();
    const result = initAppCheck(APP, { siteKey: 'site-key-123', isDev: false, deps });
    expect(deps.initializeAppCheck).toHaveBeenCalledTimes(1);
    const [app, opts] = deps.initializeAppCheck.mock.calls[0];
    expect(app).toBe(APP);
    expect(opts.provider).toBeInstanceOf(deps.ReCaptchaEnterpriseProvider);
    expect(opts.provider.key).toBe('site-key-123');
    expect(opts.isTokenAutoRefreshEnabled).toBe(true);
    expect(result).not.toBeNull();
  });

  it('a failed start (reCAPTCHA blocked) returns null instead of throwing — the app still loads', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deps = fakeDeps({ throws: true });
    expect(() => initAppCheck(APP, { siteKey: 'site-key-123', deps })).not.toThrow();
    expect(initAppCheck(APP, { siteKey: 'site-key-123', deps })).toBeNull();
    warn.mockRestore();
  });

  it('emulator builds skip App Check even with a key', () => {
    const deps = fakeDeps();
    expect(initAppCheck(APP, { siteKey: 'site-key-123', emulator: true, deps })).toBeNull();
    expect(deps.initializeAppCheck).not.toHaveBeenCalled();
  });

  it('the debug token is set only in dev builds', () => {
    initAppCheck(APP, { siteKey: 'k', isDev: false, debugToken: 'dbg', deps: fakeDeps() });
    expect(globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
    initAppCheck(APP, { siteKey: 'k', isDev: true, debugToken: 'dbg', deps: fakeDeps() });
    expect(globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe('dbg');
    initAppCheck(APP, { siteKey: 'k', isDev: true, debugToken: 'true', deps: fakeDeps() });
    expect(globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(true);
  });
});

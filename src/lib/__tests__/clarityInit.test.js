// Clarity privacy-gate test (Rule 23).
//
// The load-bearing guarantee: initClarity() must NOT fire Clarity.init unless
// BOTH the build is PROD and VITE_CLARITY_PROJECT_ID is present. Every test and
// every Preview build runs with the gate CLOSED — so these assertions also prove
// why preview smokes see zero clarity.ms traffic. If a refactor let init fire
// without the env var, the no-op cases below go red.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { initMock } = vi.hoisted(() => ({ initMock: vi.fn() }));

vi.mock('@microsoft/clarity', () => ({
  default: { init: initMock },
}));

import { initClarity } from '../clarityInit.js';

describe('initClarity — privacy gate', () => {
  beforeEach(() => {
    initMock.mockClear();
    vi.unstubAllEnvs();
    // Pin the gate inputs to a known-closed baseline so a developer's local
    // .env.local (which Vitest loads) can't leak a real VITE_CLARITY_PROJECT_ID
    // into the PROD-stubbed cases and flip the gate open (Gemini #786).
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is a no-op when VITE_CLARITY_PROJECT_ID is absent (the test/preview state)', () => {
    // Default env under vitest: PROD=false, no project id.
    const result = initClarity();
    expect(result).toBeNull();
    expect(initMock).not.toHaveBeenCalled();
  });

  it('is a no-op in a PROD build when the project id is absent', () => {
    vi.stubEnv('PROD', true);
    const result = initClarity();
    expect(result).toBeNull();
    expect(initMock).not.toHaveBeenCalled();
  });

  it('is a no-op when a project id is set but the build is not PROD (preview)', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'test-pid-123');
    const result = initClarity();
    expect(result).toBeNull();
    expect(initMock).not.toHaveBeenCalled();
  });

  it('initializes Clarity ONLY when the build is PROD AND a project id is present', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'test-pid-123');
    const result = initClarity();
    expect(result).toBe('test-pid-123');
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock).toHaveBeenCalledWith('test-pid-123');
  });
});

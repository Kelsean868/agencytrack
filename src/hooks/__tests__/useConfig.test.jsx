// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({ getConfigDoc: vi.fn() }));

// ConfigProvider imports getConfigDoc from configService; that is the only
// dependency we need to control. Mock the whole module to a single fn.
vi.mock('../../services/configService', () => ({ getConfigDoc: hoisted.getConfigDoc }));

import { ConfigProvider } from '../../context/ConfigProvider';
import { useConfig } from '../useConfig';

const wrapper = ({ children }) => <ConfigProvider tenantId="t1">{children}</ConfigProvider>;

beforeEach(() => {
  vi.clearAllMocks();
  // Default hydration: settings has a nested feature flag; other docs empty.
  hoisted.getConfigDoc.mockImplementation(async (_tid, id) =>
    id === 'settings' ? { featureFlags: { awardsProvenance: true } } : {},
  );
});

describe('useConfig', () => {
  it('outside a provider → codeDefault (fail-closed, no throw)', () => {
    const { result } = renderHook(() => useConfig('settings.featureFlags.awardsProvenance', 'DEF'));
    expect(result.current).toBe('DEF');
  });

  it('returns codeDefault before hydration, then the hydrated value once loaded', async () => {
    const { result } = renderHook(() => useConfig('settings.featureFlags.awardsProvenance', false), { wrapper });
    // Before hydration resolves, docs are {} → codeDefault.
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('absent path (missing intermediate/leaf) → codeDefault', async () => {
    const { result } = renderHook(() => useConfig('settings.featureFlags.nope', 'fallback'), { wrapper });
    await waitFor(() => expect(hoisted.getConfigDoc).toHaveBeenCalled());
    expect(result.current).toBe('fallback');
  });

  it('resolves through a non-hydrated docId to codeDefault', async () => {
    const { result } = renderHook(() => useConfig('doesNotExist.some.key', 42), { wrapper });
    await waitFor(() => expect(hoisted.getConfigDoc).toHaveBeenCalled());
    expect(result.current).toBe(42);
  });

  it('reads a value from a plain-legacy nested doc (managerActivityStandards)', async () => {
    hoisted.getConfigDoc.mockImplementation(async (_tid, id) =>
      id === 'managerActivityStandards' ? { unit_manager: { jfwCount: 5 } } : {},
    );
    const { result } = renderHook(
      () => useConfig('managerActivityStandards.unit_manager.jfwCount', 0),
      { wrapper },
    );
    await waitFor(() => expect(result.current).toBe(5));
  });
});

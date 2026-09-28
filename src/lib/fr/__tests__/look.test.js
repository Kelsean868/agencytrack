import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  resolveLook, readLookOptIn, setLookOptIn, applyLookAttr, useLookOptIn, LOOK_KEY, LOOK_ATTR,
} from '../look';

describe('resolveLook (FR-D3 gate)', () => {
  it('is nexus for every non-agent role, whatever the flag or opt-in', () => {
    for (const role of ['unit_manager', 'branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin', 'cro', null, undefined]) {
      expect(resolveLook({ role, flagOn: true, optIn: true })).toBe('nexus');
    }
  });
  it('is nexus for an agent with the flag off and no opt-in', () => {
    expect(resolveLook({ role: 'agent' })).toBe('nexus');
    expect(resolveLook({ role: 'agent', flagOn: false, optIn: false })).toBe('nexus');
  });
  it('is fr for an agent with the tenant flag on', () => {
    expect(resolveLook({ role: 'agent', flagOn: true })).toBe('fr');
  });
  it('is fr for an agent who opted in', () => {
    expect(resolveLook({ role: 'agent', optIn: true })).toBe('fr');
  });
  it('only an explicit true counts', () => {
    expect(resolveLook({ role: 'agent', flagOn: 'true', optIn: 1 })).toBe('nexus');
  });
});

describe('opt-in storage + attribute', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute(LOOK_ATTR);
  });
  it('reads false by default and true after setLookOptIn(true)', () => {
    expect(readLookOptIn()).toBe(false);
    setLookOptIn(true);
    expect(localStorage.getItem(LOOK_KEY)).toBe('fr');
    expect(readLookOptIn()).toBe(true);
    setLookOptIn(false);
    expect(localStorage.getItem(LOOK_KEY)).toBeNull();
  });
  it('applyLookAttr sets and clears data-look', () => {
    applyLookAttr('fr');
    expect(document.documentElement.getAttribute('data-look')).toBe('fr');
    applyLookAttr('nexus');
    expect(document.documentElement.hasAttribute('data-look')).toBe(false);
  });
  it('useLookOptIn updates every mounted consumer', () => {
    const a = renderHook(() => useLookOptIn());
    const b = renderHook(() => useLookOptIn());
    act(() => a.result.current[1](true));
    expect(a.result.current[0]).toBe(true);
    expect(b.result.current[0]).toBe(true);
  });
  it('never throws when storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readLookOptIn()).toBe(false);
    spy.mockRestore();
  });
});

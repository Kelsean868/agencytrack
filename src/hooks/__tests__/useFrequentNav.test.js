// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import useFrequentNav, { frequentKey } from '../useFrequentNav';

const NAV = [
  { id: 'a', tabId: 'a', label: 'A' },
  { id: 'b', tabId: 'b', label: 'B' },
  { id: 'c', tabId: 'c', label: 'C' },
  { id: 'soon', tabId: 'soon', label: 'Soon', disabled: true },
];

// Visit sequence a → b → a → b → a  ⟹  a:3, b:2 (distinct consecutive tabs so each
// rerender fires the increment effect).
function visitABABA(props) {
  const { result, rerender } = renderHook((p) => useFrequentNav(p), {
    initialProps: { ...props, activeTab: 'a' },
  });
  rerender({ ...props, activeTab: 'b' });
  rerender({ ...props, activeTab: 'a' });
  rerender({ ...props, activeTab: 'b' });
  rerender({ ...props, activeTab: 'a' });
  return { result, rerender };
}

describe('useFrequentNav', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns most-visited descriptors, highest count first', () => {
    const { result } = visitABABA({ scopeId: 'u1', navItems: NAV, excludeTabIds: [], limit: 3 });
    expect(result.current.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('persists counts to a per-user localStorage key', () => {
    visitABABA({ scopeId: 'u1', navItems: NAV, excludeTabIds: [], limit: 3 });
    const stored = JSON.parse(localStorage.getItem(frequentKey('u1')));
    expect(stored).toEqual({ a: 3, b: 2 });
  });

  it('excludes tabIds already surfaced elsewhere (bottom nav / pinned)', () => {
    const { result } = visitABABA({ scopeId: 'u1', navItems: NAV, excludeTabIds: ['a'], limit: 3 });
    expect(result.current.map((i) => i.id)).toEqual(['b']);
  });

  it('honors the limit', () => {
    const { result } = visitABABA({ scopeId: 'u1', navItems: NAV, excludeTabIds: [], limit: 1 });
    expect(result.current.map((i) => i.id)).toEqual(['a']);
  });

  it('only surfaces tabIds resolvable in the current role nav', () => {
    // Visit a tab that is not in NAV — it is counted but never surfaced.
    const { result, rerender } = renderHook((p) => useFrequentNav(p), {
      initialProps: { scopeId: 'u1', navItems: NAV, excludeTabIds: [], limit: 3, activeTab: 'ghost' },
    });
    rerender({ scopeId: 'u1', navItems: NAV, excludeTabIds: [], limit: 3, activeTab: 'a' });
    expect(result.current.find((i) => i.tabId === 'ghost')).toBeUndefined();
  });

  it('never surfaces a disabled (Soon) item even when visited', () => {
    const { result } = renderHook((p) => useFrequentNav(p), {
      initialProps: { scopeId: 'u1', navItems: NAV, excludeTabIds: [], limit: 3, activeTab: 'soon' },
    });
    expect(result.current.find((i) => i.id === 'soon')).toBeUndefined();
  });

  it('does nothing without a scopeId (tracking disabled)', () => {
    const { result } = visitABABA({ scopeId: undefined, navItems: NAV, excludeTabIds: [], limit: 3 });
    expect(result.current).toEqual([]);
    expect(localStorage.length).toBe(0);
  });

  it('never writes one user\'s counts under another user\'s key on switch', () => {
    // u1 builds history (a → b).
    const { rerender } = renderHook((p) => useFrequentNav(p), {
      initialProps: { scopeId: 'u1', navItems: NAV, excludeTabIds: [], limit: 3, activeTab: 'a' },
    });
    rerender({ scopeId: 'u1', navItems: NAV, excludeTabIds: [], limit: 3, activeTab: 'b' });
    const u1Before = localStorage.getItem(frequentKey('u1'));
    expect(JSON.parse(u1Before)).toEqual({ a: 1, b: 1 });

    // Switch to u2 and navigate — must not touch u1's stored counts.
    rerender({ scopeId: 'u2', navItems: NAV, excludeTabIds: [], limit: 3, activeTab: 'c' });
    rerender({ scopeId: 'u2', navItems: NAV, excludeTabIds: [], limit: 3, activeTab: 'b' });

    expect(localStorage.getItem(frequentKey('u1'))).toBe(u1Before);
    const u2 = JSON.parse(localStorage.getItem(frequentKey('u2')));
    expect(u2).toEqual({ c: 1, b: 1 });
  });

  it('re-reads counts when the active user changes', () => {
    localStorage.setItem(frequentKey('u2'), JSON.stringify({ c: 5 }));
    const { result, rerender } = renderHook((p) => useFrequentNav(p), {
      initialProps: { scopeId: 'u1', navItems: NAV, excludeTabIds: [], limit: 3, activeTab: 'a' },
    });
    rerender({ scopeId: 'u2', navItems: NAV, excludeTabIds: [], limit: 3, activeTab: 'a' });
    // u2's stored history (c:5) plus this session's 'a' visit → c ranks first.
    expect(result.current[0].id).toBe('c');
  });
});

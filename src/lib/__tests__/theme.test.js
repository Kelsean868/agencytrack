// @vitest-environment jsdom
//
// theme — single source of truth for light / dark / system (Fable Tier 2 · 2.4).
// Covers: mode read + legacy fallback, resolveDark (incl. System via matchMedia),
// applyTheme DOM/storage effects, the in-tab broadcast, and the useTheme hook
// round-trip (System resolves via a matchMedia mock).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  readThemeMode, resolveDark, applyTheme, setThemeMode, useTheme,
  THEME_KEY, LEGACY_DARK_KEY,
} from '../theme';

function mockMatchMedia(matches) {
  const listeners = new Set();
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: (_evt, cb) => listeners.add(cb),
    removeEventListener: (_evt, cb) => listeners.delete(cb),
    dispatchEvent: () => {},
  }));
  return { fire: () => listeners.forEach((cb) => cb()) };
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  delete window.matchMedia;
});
afterEach(() => { delete window.matchMedia; });

describe('readThemeMode', () => {
  it('defaults to light when nothing is stored', () => {
    expect(readThemeMode()).toBe('light');
  });
  it('reads the canonical agencytrack-theme value', () => {
    localStorage.setItem(THEME_KEY, 'system');
    expect(readThemeMode()).toBe('system');
  });
  it('falls back to the legacy agencytrack-dark flag', () => {
    localStorage.setItem(LEGACY_DARK_KEY, '1');
    expect(readThemeMode()).toBe('dark');
    localStorage.setItem(LEGACY_DARK_KEY, '0');
    expect(readThemeMode()).toBe('light');
  });
});

describe('resolveDark', () => {
  it('resolves explicit modes', () => {
    expect(resolveDark('dark')).toBe(true);
    expect(resolveDark('light')).toBe(false);
  });
  it('resolves System via matchMedia', () => {
    mockMatchMedia(true);
    expect(resolveDark('system')).toBe(true);
    mockMatchMedia(false);
    expect(resolveDark('system')).toBe(false);
  });
  it('treats System as light when matchMedia is unavailable', () => {
    expect(resolveDark('system')).toBe(false);
  });
});

describe('applyTheme', () => {
  it('adds the dark class and mirrors both storage keys for dark', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(localStorage.getItem(LEGACY_DARK_KEY)).toBe('1');
  });
  it('removes the dark class and mirrors 0 for light', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(LEGACY_DARK_KEY)).toBe('0');
  });
  it('resolves System to the OS preference', () => {
    mockMatchMedia(true);
    applyTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe('system');
    expect(localStorage.getItem(LEGACY_DARK_KEY)).toBe('1');
  });
});

describe('setThemeMode', () => {
  it('broadcasts an in-tab theme-change event', () => {
    const spy = vi.fn();
    window.addEventListener('agencytrack-theme-change', spy);
    setThemeMode('dark');
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('agencytrack-theme-change', spy);
  });
  it('ignores invalid modes', () => {
    setThemeMode('rainbow');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });
});

describe('useTheme', () => {
  it('reads the initial mode and round-trips setMode (dark applies the class)', () => {
    localStorage.setItem(THEME_KEY, 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('light');
    expect(result.current.isDark).toBe(false);

    act(() => result.current.setMode('dark'));
    expect(result.current.mode).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('resolves System via matchMedia and reports isDark from the OS', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setMode('system'));
    expect(result.current.mode).toBe('system');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('keeps two mounted hooks in sync via the broadcast (single source of truth)', () => {
    const a = renderHook(() => useTheme());
    const b = renderHook(() => useTheme());
    act(() => a.result.current.setMode('dark'));
    expect(b.result.current.mode).toBe('dark');
  });
});

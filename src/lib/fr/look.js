/**
 * FR look — the switch (FR-D3, docs/briefs/fr-agent-redesign-program.md).
 *
 * The agent "Free Redesign" renders only when BOTH hold:
 *   • the signed-in role is `agent`, AND
 *   • this browser's per-user opt-in `localStorage['agencytrack-look'] === 'fr'`
 *     (or, later, a tenant-wide switch — `flagOn` is its input; the flip PR
 *     wires it, because a Company Config toggle needs a rules allowlist change).
 * Anything else ⇒ Nexus v2, exactly as before. The attribute
 * `html[data-look="fr"]` scopes the FR tokens (src/styles/fr-look.css).
 *
 * Mirrors src/lib/theme.js: pure readers + an apply + an event so every
 * mounted consumer re-reads after a change in Settings.
 */
import { useCallback, useEffect, useState } from 'react';

export const LOOK_KEY = 'agencytrack-look';
export const LOOK_EVENT = 'agencytrack-look-change';
export const LOOK_ATTR = 'data-look';
export const FR = 'fr';

/** Read this browser's opt-in. Never throws. */
export function readLookOptIn() {
  try {
    return localStorage.getItem(LOOK_KEY) === FR;
  } catch {
    return false;
  }
}

/**
 * resolveLook — the gate, as a pure function.
 * @param {{ role?: string|null, flagOn?: boolean, optIn?: boolean }} input
 * @returns {'fr'|'nexus'}
 */
export function resolveLook({ role, flagOn = false, optIn = false } = {}) {
  if (role !== 'agent') return 'nexus';
  return flagOn === true || optIn === true ? FR : 'nexus';
}

/** Set or clear the attribute on <html>. Never throws. */
export function applyLookAttr(look) {
  try {
    const el = document.documentElement;
    if (look === FR) el.setAttribute(LOOK_ATTR, FR);
    else el.removeAttribute(LOOK_ATTR);
  } catch {
    /* no document (non-DOM env) */
  }
}

/** Persist the opt-in and tell mounted consumers. */
export function setLookOptIn(on) {
  try {
    if (on) localStorage.setItem(LOOK_KEY, FR);
    else localStorage.removeItem(LOOK_KEY);
  } catch {
    /* storage unavailable — the event still updates this session */
  }
  try {
    window.dispatchEvent(new CustomEvent(LOOK_EVENT, { detail: !!on }));
  } catch {
    /* CustomEvent unsupported */
  }
}

/** Settings control state: [optIn, setOptIn]. */
export function useLookOptIn() {
  const [optIn, setOptInState] = useState(() => readLookOptIn());
  useEffect(() => {
    const sync = () => setOptInState(readLookOptIn());
    window.addEventListener(LOOK_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(LOOK_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const setOptIn = useCallback((on) => {
    setLookOptIn(on);
    setOptInState(!!on);
  }, []);
  return [optIn, setOptIn];
}

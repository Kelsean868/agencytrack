/**
 * useLook() — which look the signed-in user gets: 'fr' | 'nexus' (FR-D3).
 *
 * Owns the <html data-look> attribute after auth resolves: sets it for an
 * agent who opted in, and REMOVES it for everyone else (so a manager on a
 * shared browser never inherits an agent's opt-in). src/main.jsx sets it early
 * from the opt-in alone to avoid a flash; this hook is the authority once the
 * role is known.
 *
 * No tenant-wide flag in this program: making a flag togglable from Company
 * Config needs a firestore.rules allowlist change (ccfgFlagKeysAllowed), which
 * the FR brief keeps out of scope. The tenant switch lands with the flip PR.
 */
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { applyLookAttr, resolveLook, useLookOptIn } from '../lib/fr/look';

export default function useLook() {
  const { role, loading } = useAuth();
  const [optIn] = useLookOptIn();
  const look = resolveLook({ role, optIn });

  useEffect(() => {
    if (loading) return;
    applyLookAttr(look);
  }, [look, loading]);

  return look;
}

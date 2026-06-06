import React, { useEffect, useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { kioskAuth } from '../../lib/kiosk/kioskFirebase';
import { VALIDATE_TOKEN_URL } from '../../lib/kiosk/kioskConfig';
import KioskShell from './KioskShell';

function parseKioskPath(pathname) {
  // /kiosk/:tenantId/:token
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'kiosk' || parts.length < 3) return null;
  return { tenantId: parts[1], tokenId: parts[2] };
}

export default function KioskRoute() {
  const [state, setState] = useState('loading'); // loading | valid | invalid
  const [kioskMeta, setKioskMeta] = useState(null);

  useEffect(() => {
    const parsed = parseKioskPath(window.location.pathname);
    if (!parsed) {
      setState('invalid');
      return;
    }

    const { tenantId, tokenId } = parsed;

    fetch(`${VALIDATE_TOKEN_URL}?tenant=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(tokenId)}`)
      .then((r) => r.json())
      .then(async (data) => {
        if (!data.valid) {
          setState('invalid');
          return;
        }
        // Sign into the secondary in-memory auth instance so the default auth
        // (shared per-origin) is not clobbered and the manager's tab is unaffected.
        await signInWithCustomToken(kioskAuth, data.customToken);
        setKioskMeta({ tenantId: data.tenantId, branchId: data.branchId });
        setState('valid');
      })
      .catch(() => setState('invalid'));
  }, []);

  if (state === 'loading') {
    return (
      <div className="fixed inset-0 bg-presentation flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-presentation-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="fixed inset-0 bg-presentation flex flex-col items-center justify-center gap-4">
        <p className="text-presentation-text text-2xl font-semibold">Display unavailable</p>
        <p className="text-presentation-muted text-base">Contact your manager to get a new kiosk URL.</p>
      </div>
    );
  }

  return <KioskShell tenantId={kioskMeta.tenantId} branchId={kioskMeta.branchId} />;
}

import React, { useEffect, useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, setRuntimeTenantId } from '../../firebase';
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
        // Sign into Firebase Auth with the custom token so Firestore reads work.
        await signInWithCustomToken(auth, data.customToken);
        // Populate the runtime tenantId holder so service functions work.
        setRuntimeTenantId(data.tenantId);
        setKioskMeta({ tenantId: data.tenantId, branchId: data.branchId });
        setState('valid');
      })
      .catch(() => setState('invalid'));
  }, []);

  if (state === 'loading') {
    return (
      <div className="fixed inset-0 bg-[#1a1612] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4ab5b8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="fixed inset-0 bg-[#1a1612] flex flex-col items-center justify-center gap-4">
        <p className="text-[#f0ebe0] text-2xl font-semibold">Display unavailable</p>
        <p className="text-[#b8aea0] text-base">Contact your manager to get a new kiosk URL.</p>
      </div>
    );
  }

  return <KioskShell tenantId={kioskMeta.tenantId} branchId={kioskMeta.branchId} />;
}

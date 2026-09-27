import React, { useEffect, useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { kioskAuth } from '../../lib/kiosk/kioskFirebase';
import { VALIDATE_TOKEN_URL } from '../../lib/kiosk/kioskConfig';
import { loadDeviceSecret, saveDeviceSecret } from '../../lib/kiosk/kioskDevice';
import KioskShell from './KioskShell';

function parseKioskPath(pathname) {
  // /kiosk/:tenantId/:token
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'kiosk' || parts.length < 3) return null;
  return { tenantId: parts[1], tokenId: parts[2] };
}

export default function KioskRoute() {
  const [state, setState] = useState('loading'); // loading | valid | invalid | device | storage
  const [kioskMeta, setKioskMeta] = useState(null);

  useEffect(() => {
    const parsed = parseKioskPath(window.location.pathname);
    if (!parsed) {
      setState('invalid');
      return;
    }

    const { tenantId, tokenId } = parsed;

    // P2e (SEC-04): present this device's pairing secret when it has one. The
    // first open of a link has none; the validator then binds this device and
    // returns the secret once, which we keep.
    const deviceSecret = loadDeviceSecret(tenantId, tokenId);
    const deviceParam = deviceSecret ? `&device=${encodeURIComponent(deviceSecret)}` : '';

    fetch(`${VALIDATE_TOKEN_URL}?tenant=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(tokenId)}${deviceParam}`)
      .then((r) => r.json())
      .then(async (data) => {
        if (!data.valid) {
          setState(data.reason === 'device' ? 'device' : 'invalid');
          return;
        }
        if (data.deviceSecret && !saveDeviceSecret(tenantId, tokenId, data.deviceSecret)) {
          // Paired, but this browser will not keep the pairing — the next load
          // would be refused. Say so now rather than fail mysteriously later.
          setState('storage');
          return;
        }
        if (!data.customToken) {
          // Malformed response: valid:true but no token — degrade gracefully.
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

  if (state === 'invalid' || state === 'device' || state === 'storage') {
    const detail = state === 'device'
      ? 'This kiosk link is paired with another screen. Ask your manager for a new link for this one.'
      : state === 'storage'
        ? 'This browser will not keep the kiosk pairing (private window or storage blocked). Open the link in a normal window.'
        : 'Contact your manager to get a new kiosk URL.';
    return (
      <div className="fixed inset-0 bg-presentation flex flex-col items-center justify-center gap-4" data-testid={`kiosk-${state}`}>
        <p className="text-presentation-text text-2xl font-semibold">Display unavailable</p>
        <p className="text-presentation-muted text-base text-center max-w-xl px-6">{detail}</p>
      </div>
    );
  }

  return <KioskShell tenantId={kioskMeta.tenantId} branchId={kioskMeta.branchId} />;
}

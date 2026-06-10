import React, { useState, useEffect } from 'react';
import { applyActionCode } from 'firebase/auth';
import { auth } from '../../firebase';

// Animated insurance-iconography backdrop — matches LoginScreen/ResetPasswordHandler.
// LoginPattern extraction is a banked LOW FU.
const GLYPHS = {
  phone:     <g><rect x="6" y="2" width="20" height="28" rx="3" /><line x1="13" y1="25" x2="19" y2="25" /></g>,
  handshake: <g><path d="M2 13l7-4 5 3 5-3 7 4v8H2z" /><path d="M9 9l4-4 5 3" /></g>,
  doc:       <g><rect x="5" y="2" width="22" height="28" rx="3" /><line x1="10" y1="10" x2="22" y2="10" /><line x1="10" y1="16" x2="22" y2="16" /><line x1="10" y1="22" x2="17" y2="22" /></g>,
  dollar:    <g><circle cx="16" cy="16" r="13" /><path d="M11 12h8a3 3 0 0 1 0 6h-6a3 3 0 0 0 0 6h8M16 6v3M16 23v3" /></g>,
  calendar:  <g><rect x="4" y="5" width="24" height="23" rx="3" /><line x1="4" y1="12" x2="28" y2="12" /><line x1="11" y1="2" x2="11" y2="8" /><line x1="21" y1="2" x2="21" y2="8" /></g>,
  shield:    <g><path d="M16 3l11 4v7c0 7-5 11-11 13C10 25 5 21 5 14V7l11-4z" /><path d="M11 15l3 3 6-6" /></g>,
  target:    <g><circle cx="16" cy="16" r="13" /><circle cx="16" cy="16" r="7" /><circle cx="16" cy="16" r="1.5" /></g>,
  chart:     <g><line x1="4" y1="27" x2="28" y2="27" /><rect x="7" y="16" width="4" height="11" /><rect x="14" y="9" width="4" height="18" /><rect x="21" y="13" width="4" height="14" /></g>,
};
const ROWS = [
  ['phone', 'handshake', 'doc',    'dollar',    'calendar', 'shield'],
  ['target','chart',     'shield', 'phone',     'doc',      'handshake'],
  ['dollar','calendar',  'phone',  'target',    'handshake','chart'],
  ['doc',   'shield',    'chart',  'calendar',  'target',   'dollar'],
];
const ROW_CONFIG = [
  { dir: 'left',  durationMs: 30000 },
  { dir: 'right', durationMs: 36000 },
  { dir: 'left',  durationMs: 42000 },
  { dir: 'right', durationMs: 48000 },
];

function LoginPattern() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.13] dark:opacity-[0.18]"
      style={{ zIndex: 0 }}
    >
      {ROW_CONFIG.map((cfg, ri) => {
        const kinds = ROWS[ri % ROWS.length];
        const cells = Array.from({ length: 12 }, (_, i) => kinds[i % kinds.length]);
        return (
          <div
            key={ri}
            className={`absolute inset-x-0 motion-reduce:animate-none ${cfg.dir === 'left' ? 'animate-login-drift-l' : 'animate-login-drift-r'}`}
            style={{
              top: `${ri * 116}px`,
              height: 116,
              display: 'flex',
              alignItems: 'center',
              gap: 108,
              paddingLeft: cfg.dir === 'right' ? 140 : 0,
              animationDuration: `${cfg.durationMs}ms`,
            }}
          >
            {cells.map((kind, ci) => (
              <svg
                key={ci}
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                {GLYPHS[kind]}
              </svg>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function EmailVerificationHandler({ oobCode }) {
  // phase: verifying → success | invalid
  const [phase, setPhase] = useState('verifying');

  useEffect(() => {
    let isMounted = true;
    applyActionCode(auth, oobCode)
      .then(() => {
        if (isMounted) setPhase('success');
      })
      .catch(() => {
        if (isMounted) setPhase('invalid');
      });
    return () => { isMounted = false; };
  }, [oobCode]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface relative overflow-hidden">
      <LoginPattern />

      <main
        className="card w-full max-w-sm bg-card/80 backdrop-blur-md"
        style={{ position: 'relative', zIndex: 1 }}
        data-testid="verify-handler-card"
      >
        <div className="text-center mb-8">
          <img
            src="/icons.svg"
            alt=""
            width="64"
            height="64"
            className="mx-auto mb-4"
          />
          <h1 className="text-2xl text-ink mb-1">AgencyTrack</h1>
          <p className="text-sm text-ink-muted">Tatil Life — Sales Portal</p>
        </div>

        {phase === 'verifying' && (
          <div className="flex flex-col items-center gap-4 py-4" data-testid="verify-phase-verifying">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-ink-muted">Verifying link…</p>
          </div>
        )}

        {phase === 'success' && (
          <div className="space-y-4" data-testid="verify-phase-success">
            <p className="text-sm text-success-ink" role="status">
              Email address updated. You can now sign in with your new address.
            </p>
            <button
              type="button"
              onClick={() => window.location.replace('/')}
              className="btn-primary w-full"
            >
              Sign in
            </button>
          </div>
        )}

        {phase === 'invalid' && (
          <div className="space-y-4" data-testid="verify-phase-invalid">
            <p className="text-sm text-danger-ink" role="alert">
              This link has expired or already been used. Request a new one from your profile settings.
            </p>
            <button
              type="button"
              onClick={() => window.location.replace('/')}
              className="btn-primary w-full"
            >
              Back to sign in
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

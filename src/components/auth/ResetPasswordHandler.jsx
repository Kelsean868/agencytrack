import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../../firebase';

// Animated insurance-iconography backdrop — matches LoginScreen visually.
// LoginPattern is not exported from LoginScreen; duplicating here avoids
// touching that component. Extraction to a shared file is a follow-up (LOW).
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

function getConfirmError(code) {
  switch (code) {
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
      return 'This link has expired or already been used. Request a new one from the sign-in page.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact your manager.';
    case 'auth/user-not-found':
      return 'No account found for this link.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Something went wrong. Try again or request a new link from sign-in.';
  }
}

export default function ResetPasswordHandler({ oobCode }) {
  // phase: verifying → ready | invalid
  // from ready: submitting → success | ready (with error)
  const [phase, setPhase] = useState('verifying');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    verifyPasswordResetCode(auth, oobCode)
      .then(emailFromCode => {
        setEmail(emailFromCode);
        setPhase('ready');
      })
      .catch(() => {
        setPhase('invalid');
      });
  }, [oobCode]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password.trim()) return;
    setError('');
    setPhase('submitting');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setPhase('success');
    } catch (err) {
      setError(getConfirmError(err.code));
      setPhase('ready');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface relative overflow-hidden">
      <LoginPattern />

      <main
        className="card w-full max-w-sm bg-card/80 backdrop-blur-md"
        style={{ position: 'relative', zIndex: 1 }}
        data-testid="reset-handler-card"
      >
        <div className="text-center mb-8">
          <img
            src="/icons.svg"
            alt="AgencyTrack"
            width="64"
            height="64"
            className="mx-auto mb-4"
          />
          <h1 className="text-2xl text-ink mb-1">AgencyTrack</h1>
          <p className="text-sm text-ink-muted">Tatil Life — Sales Portal</p>
        </div>

        {phase === 'verifying' && (
          <div className="flex flex-col items-center gap-4 py-4" data-testid="reset-phase-verifying">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-ink-muted">Verifying link…</p>
          </div>
        )}

        {phase === 'invalid' && (
          <div className="space-y-4" data-testid="reset-phase-invalid">
            <p className="text-sm text-danger-ink" role="alert">
              This link has expired or already been used. Request a new one from the sign-in page.
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

        {(phase === 'ready' || phase === 'submitting') && (
          <form onSubmit={handleSubmit} noValidate className="space-y-4" data-testid="reset-phase-ready">
            {email && (
              <p className="text-sm text-ink-muted">
                Setting password for{' '}
                <span className="font-medium text-ink">{email}</span>
              </p>
            )}

            <div>
              <label htmlFor="new-password" className="label">New password</label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-12"
                  placeholder="At least 6 characters"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  data-testid="reset-password-toggle"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {showPassword
                    ? <EyeOff size={18} aria-hidden="true" />
                    : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-danger-ink" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={phase === 'submitting'}
              className="btn-primary w-full"
            >
              {phase === 'submitting' ? 'Setting password…' : 'Set password'}
            </button>
          </form>
        )}

        {phase === 'success' && (
          <div className="space-y-4" data-testid="reset-phase-success">
            <p className="text-sm text-success-ink" role="status">
              Password set! You can now sign in with your new password.
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
      </main>
    </div>
  );
}

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { signIn, sendPasswordReset } from '../../services/authService';

function getErrorMessage(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts — try again later.';
    case 'auth/user-disabled':
      return 'This account is disabled. Contact your manager.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    default:
      return 'Sign-in failed. Try again.';
  }
}

// Track J System Screens v2 — animated insurance-iconography backdrop.
//
// 4 rows of glyphs (alternating directions), drifting via CSS keyframes that
// live on the Tailwind animation extend so they tree-shake correctly. Each
// row uses a different set of glyphs and a slightly different duration so
// the overall field doesn't beat in lockstep.
//
// The single glyph SVGs are defined inline (not lucide) to keep stroke width,
// cap/join, and per-row scale visually consistent without bringing in 8 icon
// imports we use nowhere else.
//
// Performance: each row is a single absolutely-positioned flex strip wider
// than the viewport; CSS `transform: translateX(...)` is GPU-accelerated and
// `prefers-reduced-motion` pauses the animation.
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

function LoginPattern() {
  // Per-row direction + duration so the field doesn't beat in lockstep.
  const ROW_CONFIG = [
    { dir: 'left',  durationMs: 30000 },
    { dir: 'right', durationMs: 36000 },
    { dir: 'left',  durationMs: 42000 },
    { dir: 'right', durationMs: 48000 },
  ];
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.13] dark:opacity-[0.18]"
      style={{ zIndex: 0 }}
      data-testid="login-pattern"
    >
      {ROW_CONFIG.map((cfg, ri) => {
        const kinds = ROWS[ri % ROWS.length];
        // Repeat the row enough to cover the widest viewport + drift extent.
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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResetSent(false);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // AuthContext onAuthStateChanged handles navigation
    } catch (err) {
      setError(getErrorMessage(err.code));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Enter your email address above, then click "Forgot password?"');
      return;
    }
    setError('');
    setResetSent(false);
    setResetLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setResetSent(true);
    } catch {
      setError('Could not send reset email. Check the address and try again.');
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface relative overflow-hidden">

      {/* Track J — animated insurance-iconography backdrop (replaces the
          previous static SVG repeating-pattern). Refracts behind the
          liquid-glass card via backdrop-filter. */}
      <LoginPattern />

      {/* Liquid-glass card — Track J v2.
          backdrop-blur lifts the card off the drifting glyph field;
          backgroundColor uses an alpha-modulated surface token so the
          glass tint reads in both themes without raw rgba. */}
      <main
        className="card w-full max-w-sm bg-card/80 backdrop-blur-md"
        style={{ position: 'relative', zIndex: 1 }}
        data-testid="login-card"
      >

        {/* Brand */}
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

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="label">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input"
              placeholder="you@tatillife.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="label">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input pr-12"
                placeholder="••••••••"
              />
              {/* Track J — password reveal toggle (UI-only). Toggles the
                  input's `type` between password/text without touching the
                  auth flow. 44px tap target inside the input chrome. */}
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                data-testid="login-password-toggle"
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

          {resetSent && (
            <p className="text-sm text-success-ink" role="status">
              Reset email sent — check your inbox.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Forgot password — inline only, no modal/redirect */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetLoading}
            className="text-sm text-ink-muted hover:text-primary transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {resetLoading ? 'Sending…' : 'Forgot password?'}
          </button>
        </div>

      </main>

    </div>
  );
}

import { useState } from 'react';
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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

      {/* SVG repeating pattern background */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none dark:opacity-50" style={{ zIndex: 0 }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="login-bg-pattern" x="0" y="0" width="180" height="120" patternUnits="userSpaceOnUse">
              {/* Phone */}
              <g transform="translate(20,18)" fill="rgba(1,105,111,0.07)">
                <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6zm0 2h12v16H6V4zm6 13a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
              </g>
              {/* Handshake */}
              <g transform="translate(100,18)" fill="rgba(1,105,111,0.07)">
                <path d="M2 10h3l2-2h4l2 2h3v6H2v-6zm1 2v2h14v-2H14l-2-2H8L6 12H3zm9-7l-2 2H8L6 5l2-3h4l2 3z" />
              </g>
              {/* Document / clipboard */}
              <g transform="translate(20,70)" fill="rgba(1,105,111,0.07)">
                <path d="M8 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-3M8 2v4h8V2M8 2h8M7 12h10M7 16h7" stroke="rgba(1,105,111,0.07)" strokeWidth="2" strokeLinecap="round" fill="none"/>
              </g>
              {/* Dollar / currency */}
              <g transform="translate(100,70)" fill="rgba(1,105,111,0.07)">
                <path d="M12 2v2M12 20v2M7 7h8a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8" stroke="rgba(1,105,111,0.07)" strokeWidth="2" strokeLinecap="round" fill="none"/>
              </g>
              {/* Calendar */}
              <g transform="translate(58,18)" fill="rgba(1,105,111,0.07)">
                <path d="M8 2v2M16 2v2M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="rgba(1,105,111,0.07)" strokeWidth="2" strokeLinecap="round" fill="none"/>
              </g>
              {/* Shield */}
              <g transform="translate(58,70)" fill="rgba(1,105,111,0.07)">
                <path d="M12 2l9 4v5c0 5-3.8 9.3-9 11C6.8 20.3 3 16 3 11V6l9-4z" stroke="rgba(1,105,111,0.07)" strokeWidth="2" strokeLinejoin="round" fill="none"/>
                <path d="M9 12l2 2 4-4" stroke="rgba(1,105,111,0.07)" strokeWidth="2" strokeLinecap="round" fill="none"/>
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#login-bg-pattern)" />
        </svg>
      </div>

      <div className="card w-full max-w-sm" style={{ position: 'relative', zIndex: 1 }}>

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-primary">
            <span className="text-white text-2xl font-bold font-display">AT</span>
          </div>
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
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-danger" role="alert">{error}</p>
          )}

          {resetSent && (
            <p className="text-sm text-success" role="status">
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

      </div>

    </div>
  );
}

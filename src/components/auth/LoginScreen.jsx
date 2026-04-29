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
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="card w-full max-w-sm">

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

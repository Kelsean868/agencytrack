import React, { useState } from 'react';
import { X, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { requestEmailUpdate } from '../../services/authService';
import { isValidEmail } from '../../utils/validators';

export default function EmailUpdateModal({ onClose }) {
  const { user, tenantId } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail,         setNewEmail]        = useState('');
  const [submitting,       setSubmitting]       = useState(false);
  const [success,          setSuccess]          = useState(false);
  const [error,            setError]            = useState(null);

  function friendlyError(err) {
    const code = err?.code ?? '';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'Incorrect password. Please try again.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'That email address is already associated with another account.';
    }
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network error. Please check your connection and try again.';
    }
    return 'Something went wrong. Please try again.';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Current password is required.');
      return;
    }
    if (!isValidEmail(newEmail)) {
      setError('Please enter a valid new email address.');
      return;
    }
    if (newEmail.toLowerCase() === (user?.email ?? '').toLowerCase()) {
      setError('New email must be different from your current email.');
      return;
    }

    setSubmitting(true);
    try {
      await requestEmailUpdate(user, currentPassword, newEmail, tenantId);
      setSuccess(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-update-modal-title"
    >
      <div className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-sm p-6 border border-border">

        <div className="flex items-start justify-between mb-1">
          <h2 id="email-update-modal-title" className="text-lg font-bold text-ink">Update Email</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle size={40} className="text-primary" />
            <p className="text-sm font-semibold text-ink">Verification email sent</p>
            <p className="text-xs text-ink-muted leading-relaxed">
              We've sent a confirmation link to{' '}
              <span className="font-semibold text-ink">{newEmail}</span>.
              Your email will update once you click the link.
              Until then, keep signing in with your current email.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full btn-primary"
            >
              Got it
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <p className="text-sm text-ink-muted mb-5">
              Confirm your current password, then enter the new email address.
              A verification link will be sent before the change takes effect.
            </p>

            {error && (
              <div className="flex items-start gap-2 p-3 mb-4 rounded-xl bg-danger/10 border border-danger/20" role="alert">
                <AlertCircle size={16} className="text-danger mt-0.5 shrink-0" />
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-4 mb-5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-muted" htmlFor="email-update-current-pw">
                  Current password
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                  <input
                    id="email-update-current-pw"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={submitting}
                    className="h-11 w-full pl-9 pr-3 rounded-lg border border-border bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-muted" htmlFor="email-update-new-email">
                  New email address
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                  <input
                    id="email-update-new-email"
                    type="email"
                    autoComplete="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={submitting}
                    className="h-11 w-full pl-9 pr-3 rounded-lg border border-border bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                    placeholder="new@example.com"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-primary mb-3 disabled:opacity-60"
            >
              {submitting ? 'Sending verification…' : 'Send verification email'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full text-center text-sm text-ink-muted hover:text-ink transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

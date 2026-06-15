import React, { useState } from 'react';
import { User } from 'lucide-react';

export default function WizardProfile({ userProfile, onSave, onSkip, saving }) {
  const [phone, setPhone] = useState(userProfile?.phone ?? '');
  const [bio,   setBio]   = useState(userProfile?.bio   ?? '');
  const [error, setError] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    await onSave({ phone: phone.trim(), bio: bio.trim() });
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8 max-w-md mx-auto w-full">
      <div className="flex flex-col gap-2 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <User size={22} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-ink font-display">
          A little about you
        </h2>
        <p className="text-sm text-ink-muted">
          Optional — add your contact number and a short bio. You can update
          these anytime from your profile.
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wiz-phone" className="text-sm font-semibold text-ink">
            Phone number
          </label>
          <input
            id="wiz-phone"
            type="tel"
            inputMode="tel"
            placeholder="e.g. 868-XXX-XXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="wiz-bio" className="text-sm font-semibold text-ink">
            Short bio
          </label>
          <textarea
            id="wiz-bio"
            rows={3}
            placeholder="Tell your team something about yourself…"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
          <p className="text-xs text-ink-muted text-right">{bio.length}/300</p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger font-medium">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold py-3 min-h-[44px] transition-opacity disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save & Continue'}
        </button>

        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-ink-muted hover:text-ink transition-colors min-h-[44px]"
        >
          Skip for now
        </button>
      </form>
    </div>
  );
}

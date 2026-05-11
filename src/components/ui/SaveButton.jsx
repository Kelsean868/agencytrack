import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

export default function SaveButton({
  onClick,
  saving = false,
  savedAt = null,       // Date | null — set by consumer after successful save; drives 3s "Saved" flash
  error = null,         // string | null — shown inline below button
  label = 'Save',
  savingLabel = 'Saving…',
  savedLabel = 'Saved',
  icon,                 // ReactNode — shown in idle state before label
  className = '',       // applied to outer wrapper (layout: self-start, shrink-0, etc.)
  disabled = false,
}) {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!savedAt) { setShowSaved(false); return; }
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const isSaved = showSaved && !saving;

  return (
    <div className={['inline-flex flex-col gap-0.5', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        onClick={onClick}
        disabled={saving || disabled}
        className={[
          'inline-flex items-center justify-center gap-2 font-medium px-5 rounded-lg transition-colors',
          'min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50',
          isSaved
            ? 'bg-success/15 text-success hover:bg-success/20'
            : 'bg-primary dark:bg-primary-dark text-white hover:bg-[color:var(--color-primary-dark)]',
        ].join(' ')}
      >
        {saving
          ? savingLabel
          : isSaved
            ? <><Check size={16} />{savedLabel}</>
            : <>{icon}{label}</>}
      </button>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}

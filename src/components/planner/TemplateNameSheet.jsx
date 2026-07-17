import React, { useState } from 'react';
import { X, Loader2, Bookmark } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';

/**
 * TemplateNameSheet — Run 9 A4 "Save as template" name prompt. Raised from the
 * churn dialog's Save-as-template action; pre-filled with a sensible default
 * name (`<TYPE> · <h:mm A>`) the agent can edit before saving. The parent owns
 * the Firestore write (via onSave) and passes `saving`. Mobile bottom-sheet ↔
 * desktop centered dialog (§4 dialog contract via useFocusTrap).
 */
export default function TemplateNameSheet({ defaultName = '', saving = false, onSave, onClose }) {
  const trapRef = useFocusTrap({ onEscape: onClose, escapeDisabled: saving });
  const [name, setName] = useState(defaultName);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !saving;

  const handleSave = () => {
    if (!canSave) return;
    onSave(trimmed);
  };

  const titleId = 'template-name-title';
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="template-name-sheet"
        className="relative w-full sm:max-w-xs bg-card rounded-t-2xl sm:rounded-2xl shadow-lg p-4 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bookmark size={18} className="text-primary" aria-hidden="true" />
            <h2 id={titleId} className="text-base font-bold text-ink">Save as template</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-ink-muted hover:bg-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="template-name-input" className="text-sm font-medium text-ink">Template name</label>
          <input
            id="template-name-input"
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            data-testid="template-name-input"
            placeholder="e.g. Morning FFI block"
            className="h-11 px-3 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-xl border border-border text-ink font-semibold text-sm hover:bg-surface transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            data-testid="template-name-save"
            className="flex-1 min-h-[44px] rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm hover:bg-primary/90 dark:hover:bg-primary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save template'}
          </button>
        </div>
      </div>
    </div>
  );
}

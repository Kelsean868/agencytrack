import React, { useState } from 'react';
import { MessageSquarePlus, Loader2 } from 'lucide-react';

/**
 * NotesThread — E4 per-appointment timestamped notes thread. Renders the merged
 * thread (legacy `note` first, then `notes[]` oldest→newest via
 * `readNoteThread`), a "THIS MEETING" tag on notes taken while the appt was
 * active (`during`), and an add-note field. The parent owns the write
 * (`onAdd(text)` → `addAppointmentNote`) and passes `saving`; `onAdd` absent =
 * read-only (used for the prospect-history surfacing on the booking sheet).
 */
function formatNoteTime(at) {
  if (!at) return '';
  try {
    return new Date(at).toLocaleDateString('en-TT', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch { return ''; }
}

export default function NotesThread({
  thread = [], onAdd, saving = false, duringActive = false, label = 'Notes',
}) {
  const [text, setText] = useState('');
  const submit = () => {
    const t = text.trim();
    if (!t || saving) return;
    onAdd?.(t);
    setText('');
  };

  return (
    <div data-testid="notes-thread" className="flex flex-col gap-2">
      <span className="block text-xs font-semibold text-ink-muted uppercase tracking-wide">{label}</span>

      {thread.length === 0 ? (
        <p data-testid="notes-empty" className="text-xs text-ink-muted italic">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {thread.map((n, i) => (
            <li
              key={n.at ?? `legacy-${i}`}
              data-testid="note-entry"
              className="rounded-lg bg-card-raised border border-border px-3 py-2"
            >
              <p className="text-sm text-ink whitespace-pre-wrap break-words">{n.text}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {n.during && (
                  <span
                    data-testid="note-this-meeting"
                    className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 rounded px-1.5 py-0.5"
                  >
                    This meeting
                  </span>
                )}
                {n.fromDate && (
                  <span className="text-[10px] font-mono uppercase tracking-wide text-ink-muted">{n.fromDate}</span>
                )}
                <span className="text-[11px] text-ink-muted">
                  {n.legacy ? 'Earlier' : formatNoteTime(n.at)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {onAdd && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="note-add-input" className="sr-only">Add a note</label>
          <textarea
            id="note-add-input"
            data-testid="note-add-input"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder={duringActive ? 'Add a note from this meeting…' : 'Add a note…'}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || saving}
            data-testid="note-add-btn"
            className="self-end inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <MessageSquarePlus size={14} aria-hidden="true" />}
            Add note
          </button>
        </div>
      )}
    </div>
  );
}

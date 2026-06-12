import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, MessageSquare, Pencil, Check, ChevronDown, Phone, UserSearch, Bookmark } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  addCoachingNote,
  getCoachingNotes,
  updateCoachingNote,
  pinCoachingNote,
  COACHING_CATEGORIES,
} from '../../services/coachingNotesService';
import JointCallsTab from './JointCallsTab';
import ProspectInfoTab from './ProspectInfoTab';

// Category display config — label + Tailwind badge classes (Nexus-token-safe)
const CATEGORY_CONFIG = {
  observation: { label: 'Observation', cls: 'bg-primary/10 text-primary' },
  goal:        { label: 'Goal',        cls: 'bg-success/10 text-success-ink' },
  concern:     { label: 'Concern',     cls: 'bg-warning/10 text-warning-ink' },
  win:         { label: 'Win',         cls: 'bg-success/15 text-success-ink font-semibold' },
  action_item: { label: 'Action Item', cls: 'bg-ink-muted/10 text-ink-muted' },
};

function CategoryBadge({ category }) {
  const cfg = CATEGORY_CONFIG[category] ?? { label: category, cls: 'bg-border text-ink-muted' };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function formatNoteDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-TT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function NoteCard({ note, isAuthor, onEditSaved }) {
  const [editing, setEditing]   = useState(false);
  const [editBody, setEditBody] = useState(note.body);
  const [editCat, setEditCat]   = useState(note.category);
  const [pinned, setPinned]     = useState(note.isPinned ?? false);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const { tenantId } = useAuth();

  const togglePin = async () => {
    const next = !pinned;
    setPinned(next);
    try {
      await pinCoachingNote({ tenantId, agentId: note.agentId, noteId: note.id, isPinned: next });
      onEditSaved({ ...note, isPinned: next });
    } catch {
      setPinned(!next);
    }
  };

  const saveEdit = async () => {
    if (!editBody.trim()) return;
    setSaving(true);
    setErr('');
    try {
      await updateCoachingNote({
        tenantId,
        agentId: note.agentId,
        noteId:  note.id,
        body:    editBody,
        category: editCat,
      });
      setEditing(false);
      onEditSaved({ ...note, body: editBody.trim(), category: editCat });
    } catch (err) {
      console.error('Failed to update coaching note:', err);
      setErr('Save failed — check connection.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditBody(note.body);
    setEditCat(note.category);
    setErr('');
    setEditing(false);
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-card-raised">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <select
              value={editCat}
              onChange={(e) => setEditCat(e.target.value)}
              className="h-7 px-2 rounded-lg border border-border bg-card text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Note category"
            >
              {COACHING_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          ) : (
            <CategoryBadge category={note.category} />
          )}
          <span className="text-[11px] text-ink-muted">
            {note.authorName} · {formatNoteDate(note.createdAt)}
          </span>
        </div>
        {isAuthor && !editing && (
          <div className="flex items-center gap-1">
            <button
              onClick={togglePin}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-primary hover:bg-primary/10 transition-colors"
              aria-label={pinned ? 'Unpin note' : 'Pin note'}
            >
              <Bookmark size={14} className={pinned ? 'fill-primary text-primary' : ''} />
            </button>
            <button
              onClick={() => setEditing(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-primary hover:bg-primary/10 transition-colors"
              aria-label="Edit note"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-ink text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Edit note body"
          />
          {err && <p className="text-xs text-danger-ink">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={cancelEdit}
              className="min-h-[44px] px-4 rounded-lg border border-border text-sm text-ink hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              disabled={saving || !editBody.trim()}
              className="min-h-[44px] px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Check size={14} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink whitespace-pre-wrap break-words">{note.body}</p>
      )}
    </div>
  );
}

export default function CoachingNotesModal({ agentId, agentName, agentUnitId, onClose }) {
  const { user, userProfile, role, tenantId } = useAuth();
  const [notes, setNotes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // F2: tab selection — Notes (F1) is the default.
  const [activeTab, setActiveTab] = useState('notes');

  // Add-note form
  const [category, setCategory]     = useState('observation');
  const [body, setBody]             = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError]     = useState('');

  const closeRef = useRef(null);

  // Load notes on mount
  useEffect(() => {
    if (!agentId || !role) return;
    setLoading(true);
    setError('');
    getCoachingNotes({ tenantId, agentId, callerRole: role, callerUid: user?.uid })
      .then(setNotes)
      .catch((err) => {
        console.error('Failed to load coaching notes:', err);
        setError('Failed to load notes. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [tenantId, agentId, role, user?.uid]);

  // Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Auto-focus close button on mount
  useEffect(() => { closeRef.current?.focus(); }, []);

  const handleAdd = useCallback(async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setAddError('');
    try {
      await addCoachingNote({
        tenantId,
        agentId,
        agentUnitId,
        authorUid:  user.uid,
        authorName: userProfile?.name ?? userProfile?.email ?? 'Manager',
        authorRole: role,
        category,
        body,
      });
      setBody('');
      setCategory('observation');
      // Reload to include server-set createdAt
      const updated = await getCoachingNotes({
        tenantId, agentId, callerRole: role, callerUid: user?.uid,
      });
      setNotes(updated);
    } catch (err) {
      console.error('Failed to add coaching note:', err);
      setAddError('Failed to add note — check connection.');
    } finally {
      setSubmitting(false);
    }
  }, [tenantId, agentId, agentUnitId, user, userProfile, role, category, body]);

  const handleEditSaved = useCallback((updatedNote) => {
    setNotes((prev) => prev.map((n) => (n.id === updatedNote.id ? updatedNote : n)));
  }, []);

  // Pinned notes bubble to the top; Firestore order (authorRoleRank asc, createdAt desc)
  // is preserved within each group.
  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)),
    [notes],
  );

  return (
    <>
      {/* Backdrop — aria-hidden so screen readers skip it; click closes modal */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coaching-notes-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-card rounded-2xl shadow-lg border border-border overflow-hidden pointer-events-auto">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-primary" aria-hidden="true" />
              <h2 id="coaching-notes-title" className="text-base font-semibold text-ink">
                Coaching
              </h2>
              <span className="text-sm text-ink-muted">— {agentName}</span>
            </div>
            <button
              ref={closeRef}
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors"
              aria-label="Close coaching notes"
            >
              <X size={18} />
            </button>
          </div>

          {/* F2: tab strip */}
          <div role="tablist" aria-label="Coaching surfaces" className="flex border-b border-border flex-shrink-0 bg-card">
            <button
              role="tab"
              aria-selected={activeTab === 'notes'}
              aria-controls="coaching-notes-panel"
              onClick={() => setActiveTab('notes')}
              className={`min-h-[44px] flex-1 flex items-center justify-center gap-2 px-4 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'notes'
                  ? 'text-primary border-primary'
                  : 'text-ink-muted border-transparent hover:text-ink'
              }`}
            >
              <MessageSquare size={14} aria-hidden="true" />
              Notes
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'jointCalls'}
              aria-controls="coaching-jointcalls-panel"
              onClick={() => setActiveTab('jointCalls')}
              className={`min-h-[44px] flex-1 flex items-center justify-center gap-2 px-4 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'jointCalls'
                  ? 'text-primary border-primary'
                  : 'text-ink-muted border-transparent hover:text-ink'
              }`}
            >
              <Phone size={14} aria-hidden="true" />
              Joint Calls
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'prospectInfo'}
              aria-controls="coaching-prospect-info-panel"
              onClick={() => setActiveTab('prospectInfo')}
              className={`min-h-[44px] flex-1 flex items-center justify-center gap-2 px-4 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'prospectInfo'
                  ? 'text-primary border-primary'
                  : 'text-ink-muted border-transparent hover:text-ink'
              }`}
            >
              <UserSearch size={14} aria-hidden="true" />
              Prospect Info
            </button>
          </div>

          {activeTab === 'jointCalls' ? (
            <div
              id="coaching-jointcalls-panel"
              role="tabpanel"
              aria-labelledby="coaching-jointcalls-tab"
              className="flex-1 flex flex-col min-h-0"
            >
              <JointCallsTab agentId={agentId} agentUnitId={agentUnitId} />
            </div>
          ) : activeTab === 'prospectInfo' ? (
            <div
              id="coaching-prospect-info-panel"
              role="tabpanel"
              aria-labelledby="coaching-prospect-info-tab"
              className="flex-1 flex flex-col min-h-0"
            >
              <ProspectInfoTab agentId={agentId} />
            </div>
          ) : (
            <>
          {/* Note list — scrollable */}
          <div
            id="coaching-notes-panel"
            role="tabpanel"
            aria-labelledby="coaching-notes-tab"
            className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-0">
            {loading && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-border/40 animate-pulse" />
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="p-3 rounded-xl border border-danger/30 bg-danger/10 text-sm text-danger-ink">
                {error}
              </div>
            )}

            {!loading && !error && notes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-ink-muted">
                <MessageSquare size={32} className="opacity-30" aria-hidden="true" />
                <p className="text-sm">No coaching notes yet.</p>
                <p className="text-xs">Add the first note below.</p>
              </div>
            )}

            {!loading && !error && sortedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isAuthor={note.authorUid === user?.uid}
                onEditSaved={handleEditSaved}
              />
            ))}
          </div>

          {/* Add-note form */}
          <form
            onSubmit={handleAdd}
            className="flex flex-col gap-3 px-5 py-4 border-t border-border flex-shrink-0 bg-card"
          >
            <div className="relative inline-flex self-start">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-11 pl-3 pr-8 rounded-xl border border-border bg-card text-ink text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                aria-label="Note category"
              >
                {COACHING_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a coaching note…"
              rows={3}
              maxLength={2000}
              required
              className="w-full px-3 py-2 rounded-xl border border-border bg-card text-ink text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-ink-muted/60"
              aria-label="Coaching note body"
            />

            {addError && (
              <p className="text-xs text-danger-ink" role="alert">{addError}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !body.trim()}
              className="min-h-[44px] w-full rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Adding…' : 'Add Note'}
            </button>
          </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}

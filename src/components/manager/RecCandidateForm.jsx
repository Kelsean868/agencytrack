// RecCandidateForm — item 2.2 new-candidate creation drawer, opened from the
// board's "Add candidate" affordance. Name is required; stage defaults to
// 'sourced'. The creator self-owns (ownerUid pinned to the caller by the
// service + rule). §4 dialog contract via useFocusTrap.
import React, { useState } from 'react';
import { X } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import { RECRUITING_STAGES, createCandidate } from '../../services/recruitingService';

export default function RecCandidateForm({ tenantId, meta, onClose, onCreated }) {
  const modalRef = useFocusTrap({ onEscape: onClose });
  const [form, setForm] = useState({
    name: '', source: '', referrerName: '', stage: 'sourced', phone: '', note: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
  const nameValid = form.name.trim().length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nameValid || saving) return;
    setSaving(true);
    setError('');
    try {
      await createCandidate(tenantId, form, meta);
      await onCreated?.();
      onClose?.();
    } catch (err) {
      console.error('[RecCandidateForm] create failed', err);
      setError('Could not add the candidate — check your connection and try again.');
      setSaving(false);
    }
  };

  const field = 'w-full h-11 px-3 rounded-lg bg-card-raised border border-border text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 sheet-backdrop" aria-hidden="true" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex max-w-full">
        <form
          ref={modalRef}
          onSubmit={handleSubmit}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rec-form-title"
          data-testid="rec-candidate-form"
          className="w-screen max-w-md h-full flex flex-col bg-card border-l border-border shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
            <h2 id="rec-form-title" className="font-display font-extrabold text-base text-ink">Add candidate</h2>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="space-y-1">
              <label htmlFor="rec-name" className="block text-sm font-medium text-ink">
                Name <span className="text-danger-ink">*</span>
              </label>
              <input id="rec-name" type="text" value={form.name} onChange={set('name')} disabled={saving}
                required maxLength={200} placeholder="Candidate's full name" className={field} />
            </div>

            <div className="space-y-1">
              <label htmlFor="rec-stage" className="block text-sm font-medium text-ink">Starting stage</label>
              <select id="rec-stage" value={form.stage} onChange={set('stage')} disabled={saving} className={field}>
                {RECRUITING_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="rec-source" className="block text-sm font-medium text-ink">
                Source <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <input id="rec-source" type="text" value={form.source} onChange={set('source')} disabled={saving}
                maxLength={200} placeholder="e.g. Agent referral, Career fair, LinkedIn" className={field} />
            </div>

            <div className="space-y-1">
              <label htmlFor="rec-referrer" className="block text-sm font-medium text-ink">
                Referred by <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <input id="rec-referrer" type="text" value={form.referrerName} onChange={set('referrerName')} disabled={saving}
                maxLength={200} placeholder="Who named them" className={field} />
            </div>

            <div className="space-y-1">
              <label htmlFor="rec-phone" className="block text-sm font-medium text-ink">
                Phone <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <input id="rec-phone" type="tel" value={form.phone} onChange={set('phone')} disabled={saving}
                maxLength={40} placeholder="Contact number" className={field} />
            </div>

            <div className="space-y-1">
              <label htmlFor="rec-note" className="block text-sm font-medium text-ink">
                Note <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <textarea id="rec-note" value={form.note} onChange={set('note')} disabled={saving} rows={3} maxLength={2000}
                placeholder="Any context on this candidate"
                className="w-full px-3 py-2 rounded-lg bg-card-raised border border-border text-ink text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60" />
            </div>

            {error && <p className="text-sm text-danger-ink" role="alert" data-testid="rec-form-error">{error}</p>}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-border px-5 py-4 flex gap-3">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 h-11 rounded-xl bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Cancel
            </button>
            <button type="submit" disabled={saving || !nameValid} data-testid="rec-form-submit"
              className="flex-1 h-11 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              {saving ? 'Adding…' : 'Add candidate'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

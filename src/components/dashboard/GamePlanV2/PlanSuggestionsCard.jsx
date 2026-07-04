import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { listPlanSuggestions, markSuggestionSeen } from '../../../services/planSuggestionsService';

// PR-B3 — PlanSuggestionsCard (agent Game Plan hub).
//
// Shows plan-level suggestions an upline manager raised on this agent's plan
// (the manager→agent suggest-back loop). Newest-first; unread ('open')
// suggestions are visually emphasized; simply viewing the card acks them
// (open→seen, best-effort) so the emphasis clears on the next hub load.
// Suggestions are advice — the agent still commits their own plan.
//
// Clarity (#786): suggestion notes discuss the agent's financial plan, so the
// card container carries data-clarity-mask="True" (a MASKED_SURFACES guard entry
// backs it — see clarity-mask-guard.test.js + docs/clarity-integration.md).
//
// Quiet by design: loading, empty, and denied all render NOTHING — no nagging
// zero-state, no error alarm (this is the agent's own data on their own hub).

const ROLE_LABELS = {
  unit_manager: 'Unit Manager',
  branch_manager: 'Branch Manager',
  sales_manager: 'Sales Manager',
  tenant_admin: 'Admin',
  platform_admin: 'Admin',
};

function roleLabel(role) {
  return ROLE_LABELS[role] ?? 'Manager';
}

// createdAt is a Firestore Timestamp (or null). House format: DD-MM-YYYY.
function formatDDMMYYYY(ts) {
  const d = ts?.toDate?.() ?? (ts instanceof Date ? ts : null);
  if (!d || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export default function PlanSuggestionsCard({ tenantId, agentId }) {
  const [items, setItems] = useState(null); // null = loading; [] = loaded-empty
  const ackedOnce = useRef(false);

  useEffect(() => {
    if (!tenantId || !agentId) { setItems([]); return; }
    let alive = true;
    (async () => {
      try {
        const { items: loaded = [] } = await listPlanSuggestions({ tenantId, agentId });
        if (!alive) return;
        setItems(loaded);
        // Viewing acks the unread ones (best-effort, fire-and-forget). Fire once —
        // the local list keeps its loaded 'open' status so the emphasis stays
        // visible THIS render; the ack lands so the next hub load shows them seen.
        if (!ackedOnce.current) {
          ackedOnce.current = true;
          loaded
            .filter((s) => s.status === 'open')
            .forEach((s) => {
              markSuggestionSeen({ tenantId, agentId, suggestionId: s.id }).catch(() => {});
            });
        }
      } catch {
        // Quiet by design: a read failure renders nothing, never an alarm and
        // never a thrown effect that could blank the whole Game Plan hub.
        if (alive) setItems([]);
      }
    })();
    return () => { alive = false; };
  }, [tenantId, agentId]);

  // Quiet: nothing while loading, nothing when empty (no nagging zero-state).
  if (!items || items.length === 0) return null;

  const unreadCount = items.filter((s) => s.status === 'open').length;

  return (
    <div
      data-clarity-mask="True"
      data-testid="plan-suggestions-card"
      className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={15} className="text-primary shrink-0" aria-hidden="true" />
        <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">
          From your manager
        </p>
        {unreadCount > 0 && (
          <span
            data-testid="plan-suggestions-unread-count"
            className="ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wide bg-primary/10 text-primary border border-primary/30"
          >
            {unreadCount} new
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-2.5">
        {items.map((s) => {
          const unread = s.status === 'open';
          return (
            <li
              key={s.id}
              data-testid="plan-suggestion-item"
              data-unread={unread ? 'true' : 'false'}
              className={`rounded-xl border p-3 ${
                unread
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card-raised'
              }`}
            >
              <div className="flex items-start gap-2">
                {unread && (
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                    aria-hidden="true"
                    data-testid="plan-suggestion-unread-dot"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-relaxed text-ink ${unread ? 'font-semibold' : 'font-normal'}`}>
                    {s.note}
                  </p>
                  <p className="mt-1.5 text-[11px] text-ink-muted">
                    {`${s.raisedByName || 'Manager'} · ${roleLabel(s.raisedByRole)}${formatDDMMYYYY(s.createdAt) ? ` · ${formatDDMMYYYY(s.createdAt)}` : ''}`}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

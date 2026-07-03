// Track K · K10b — FinancingEscalationInbox (the BM's escalation inbox).
//
// A Branch Manager (same-branch), or SM/TA/PA, reads the escalations a Unit
// Manager raised on their agents' financing and ACKNOWLEDGES them. Open-first;
// the acknowledged section is collapsed. The read is branch-scoped by the rules
// (resource.data.branchId == callerBranchId) and by the query
// (where('branchId','==',branchId)) — the K10b composite index backs it.
//
// Mounted as the FinancingTab { id:'escalations' } subview (BM-only gating
// inherited from the tab). Acknowledge is the BM's action; the write is
// field-restricted to the ack triple by the rules.
import React, { useState, useEffect, useCallback } from 'react';
import { Flag, Check, AlertTriangle, RefreshCw, ChevronDown, Inbox } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  listBranchEscalations,
  acknowledgeFinancingEscalation,
  escalationReasonLabel,
} from '../../services/financingEscalationService';
import { initials } from '../../utils/formatters';

// Relative age ("just now" / "3h ago" / "2d ago") from a Firestore Timestamp.
function ageLabel(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const ms = Date.now() - d.getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function EscalationCard({ esc, onAcknowledge, acking }) {
  const isOpen = esc.status === 'open';
  return (
    <div
      className={`rounded-xl border bg-card overflow-hidden ${isOpen ? 'border-warning/40' : 'border-border'}`}
      data-testid={`financing-escalation-card-${esc.id}`}
      data-status={esc.status}
    >
      <div className="flex items-start gap-3 p-4 flex-wrap">
        <span className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-sm shrink-0">
          {initials(esc.agentName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-ink truncate">{esc.agentName}</p>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wide bg-primary/10 text-primary">
              {escalationReasonLabel(esc.reason)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">
            Raised by {esc.raisedByName ?? 'Unit Manager'} · {ageLabel(esc.createdAt)}
          </p>
          {esc.note ? (
            <p className="mt-2 text-sm text-ink whitespace-pre-wrap break-words">{esc.note}</p>
          ) : null}
        </div>
        {isOpen ? (
          <button
            type="button"
            onClick={() => onAcknowledge(esc)}
            disabled={acking}
            data-testid={`financing-escalation-ack-${esc.id}`}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
          >
            <Check size={15} aria-hidden="true" /> {acking ? 'Acknowledging…' : 'Acknowledge'}
          </button>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold font-mono uppercase tracking-wide bg-surface-muted text-ink-muted border border-border shrink-0"
            data-testid={`financing-escalation-acked-${esc.id}`}
          >
            <Check size={11} aria-hidden="true" /> Acknowledged
          </span>
        )}
      </div>
    </div>
  );
}

export default function FinancingEscalationInbox() {
  const { user, tenantId, branchId } = useAuth();
  const [state, setState] = useState({ status: 'loading' });
  const [ackingId, setAckingId] = useState(null);
  const [showAcked, setShowAcked] = useState(false);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    if (!tenantId || !branchId) { setState({ status: 'ready', items: [] }); return; }
    try {
      const items = await listBranchEscalations({ tenantId, branchId });
      setState({ status: 'ready', items });
    } catch (e) {
      console.error('[FinancingEscalationInbox] load failed', e);
      setState({ status: 'error' });
    }
  }, [tenantId, branchId]);

  useEffect(() => { load(); }, [load]);

  const handleAcknowledge = useCallback(async (esc) => {
    setAckingId(esc.id);
    try {
      await acknowledgeFinancingEscalation({
        tenantId,
        escalationId: esc.id,
        acknowledgedByUid: user.uid,
      });
      // Optimistic local flip — no re-fetch needed.
      setState((prev) => prev.status === 'ready'
        ? { ...prev, items: prev.items.map((it) => it.id === esc.id ? { ...it, status: 'acknowledged', acknowledgedByUid: user.uid } : it) }
        : prev);
    } catch (e) {
      console.error('[FinancingEscalationInbox] acknowledge failed', e);
      // Surface via a full reload so the card returns to its true state.
      load();
    } finally {
      setAckingId(null);
    }
  }, [tenantId, user, load]);

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-3" data-testid="financing-escalation-inbox" data-loading="true">
        <div className="h-6 w-40 rounded-lg bg-border/40 animate-pulse" />
        <div className="h-24 rounded-xl bg-border/30 animate-pulse" />
        <div className="h-24 rounded-xl bg-border/30 animate-pulse" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-4" data-testid="financing-escalation-inbox" data-loading="false">
        <div className="p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger-ink text-sm flex items-center justify-between gap-3 flex-wrap">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={16} aria-hidden="true" /> We couldn't load your branch's escalations right now.
          </span>
          <button
            type="button"
            onClick={load}
            data-testid="financing-escalation-retry"
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            <RefreshCw size={14} aria-hidden="true" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const items = state.items ?? [];
  const openItems = items.filter((it) => it.status === 'open');
  const ackedItems = items.filter((it) => it.status !== 'open');

  return (
    <div className="flex flex-col gap-4" data-testid="financing-escalation-inbox" data-loading="false">
      <div className="flex items-center gap-2">
        <Flag size={16} className="text-primary" aria-hidden="true" />
        <h3 className="font-display font-extrabold text-base text-ink">Escalations</h3>
        {openItems.length > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-warning/15 text-warning-ink text-xs font-bold"
            data-testid="financing-escalation-open-count"
          >
            {openItems.length}
          </span>
        )}
      </div>

      {openItems.length === 0 ? (
        <div className="p-8 rounded-xl border border-border bg-card-raised text-center" data-testid="financing-escalation-empty">
          <Inbox size={28} className="mx-auto text-ink-muted opacity-40" aria-hidden="true" />
          <p className="mt-2 text-ink font-semibold">No open escalations.</p>
          <p className="text-sm text-ink-muted">Your Unit Managers' financing flags land here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-testid="financing-escalation-open-list">
          {openItems.map((esc) => (
            <EscalationCard key={esc.id} esc={esc} onAcknowledge={handleAcknowledge} acking={ackingId === esc.id} />
          ))}
        </div>
      )}

      {ackedItems.length > 0 && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowAcked((v) => !v)}
            data-testid="financing-escalation-acked-toggle"
            aria-expanded={showAcked}
            className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            <ChevronDown size={14} className={`transition-transform ${showAcked ? 'rotate-180' : ''}`} aria-hidden="true" />
            Acknowledged ({ackedItems.length})
          </button>
          {showAcked && (
            <div className="flex flex-col gap-3" data-testid="financing-escalation-acked-list">
              {ackedItems.map((esc) => (
                <EscalationCard key={esc.id} esc={esc} onAcknowledge={handleAcknowledge} acking={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

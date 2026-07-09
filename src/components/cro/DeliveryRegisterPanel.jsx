import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, PackageCheck, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDeliverablePolicies, recordPolicyDelivery } from '../../services/policiesService';
import { listBranches } from '../../services/branchService';
import { deriveClawback, toTTDayString } from '../../utils/clawbackClock';
import { formatCurrency, formatDateDisplay } from '../../utils/formatters';
import useToast from '../../hooks/useToast';
import { Skeleton } from '../ui/PanelSkeleton';
import ClawbackChip from './ClawbackChip';
import MarkDeliveredDialog from './MarkDeliveredDialog';

/**
 * DeliveryRegisterPanel — the CRO's primary surface (Tier-3 3.1).
 *
 * The "delivery book": every SETTLED policy in the tenant, split into
 * undelivered (`policyDeliveryDate == null`) vs delivered, each carrying the
 * 30-day clawback clock derived from `dateIssued` (display-only). The CRO marks
 * a policy delivered — writing the three contract fields via
 * recordPolicyDelivery (rules Arm E).
 *
 * Design intent: docs/design-system/screens-v2/cro-v2-delivery.jsx. That mockup
 * models a richer received→notified→collected→out lifecycle keyed off a
 * fabricated head-office `sent` date; the REAL policies schema has only the
 * settled status + a delivery date, so this register is the honest two-state
 * (To deliver / Delivered) reduction the locked contract supports. Agent and
 * branch identities render from the stored ids/numbers — the CRO role cannot
 * list users, so agent NAMES are not resolvable (branch names are, via the
 * tenant-wide branches read).
 *
 * Four-states, tokens, 44px targets, §4 dialog on the confirm sheet.
 */

const FILTERS = [
  { key: 'todeliver', label: 'To deliver' },
  { key: 'atrisk',    label: 'At risk' },
  { key: 'delivered', label: 'Delivered' },
];

function SummaryTile({ label, count, tone }) {
  const dotClass = {
    teal:    'bg-primary',
    warning: 'bg-warning',
    success: 'bg-success',
  }[tone] ?? 'bg-ink-dim';
  return (
    <div className="card flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted whitespace-nowrap">{label}</span>
      </div>
      <p className="text-2xl font-bold text-ink mt-2 tabular-nums">{count}</p>
    </div>
  );
}

export default function DeliveryRegisterPanel() {
  const { tenantId, user } = useAuth();
  const toast = useToast();

  const [policies, setPolicies] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [branchMap, setBranchMap] = useState({});
  const [filter, setFilter] = useState('todeliver');

  const [dialogPolicy, setDialogPolicy] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');

  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(false);
    try {
      // Branch names are a best-effort legibility aid — CRO has tenant-wide
      // branches read, but a branches failure must not sink the register.
      const [pols, branches] = await Promise.all([
        getDeliverablePolicies(tenantId),
        listBranches(tenantId).catch(() => []),
      ]);
      if (!isMountedRef.current) return;
      setPolicies(pols);
      const map = {};
      for (const b of branches ?? []) map[b.id] = b.name;
      setBranchMap(map);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Failed to load delivery register:', err);
      setError(true);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const { undelivered, delivered, atRisk, counts } = useMemo(() => {
    const list = Array.isArray(policies) ? policies : [];
    const undel = [];
    const del = [];
    for (const p of list) {
      if (p.policyDeliveryDate == null) undel.push(p);
      else del.push(p);
    }
    // Undelivered: most urgent first (fewest days left / most overdue).
    undel.sort((a, b) => {
      const ca = deriveClawback(a.dateIssued);
      const cb = deriveClawback(b.dateIssued);
      const da = ca.daysLeft == null ? Infinity : ca.daysLeft;
      const db = cb.daysLeft == null ? Infinity : cb.daysLeft;
      return da - db;
    });
    // Delivered: most recently delivered first.
    del.sort((a, b) => {
      const sa = toTTDayString(a.policyDeliveryDate) ?? '';
      const sb = toTTDayString(b.policyDeliveryDate) ?? '';
      return sb.localeCompare(sa);
    });
    const risk = undel.filter((p) => {
      const c = deriveClawback(p.dateIssued);
      return c.overdue || c.atRisk;
    });
    return {
      undelivered: undel,
      delivered: del,
      atRisk: risk,
      counts: { todeliver: undel.length, atrisk: risk.length, delivered: del.length },
    };
  }, [policies]);

  const visible = filter === 'delivered' ? delivered : filter === 'atrisk' ? atRisk : undelivered;

  const openDialog = (policy) => { setDialogError(''); setDialogPolicy(policy); };
  const closeDialog = () => { if (!saving) { setDialogPolicy(null); setDialogError(''); } };

  const handleConfirm = async (deliveryDate) => {
    if (!dialogPolicy) return;
    setSaving(true);
    setDialogError('');
    try {
      await recordPolicyDelivery(tenantId, dialogPolicy.id, { deliveredBy: user?.uid, deliveryDate });
      // Patch local state in place (no reload) — flip the delivered marker.
      if (isMountedRef.current) {
        setPolicies((prev) => (prev ?? []).map((p) => (
          p.id === dialogPolicy.id
            ? { ...p, policyDeliveryDate: toTTDayString(deliveryDate), deliveredBy: user?.uid }
            : p
        )));
        setDialogPolicy(null);
      }
      toast.show({ message: 'Policy marked delivered', variant: 'success' });
    } catch (err) {
      console.error('Failed to record delivery:', err);
      if (isMountedRef.current) {
        setDialogError(
          err?.code === 'permission-denied'
            ? 'Permission denied — only a CRO can confirm delivery.'
            : (err?.message || 'Could not record delivery. Check your connection and try again.')
        );
      }
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  // ── Four-states ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-4" data-testid="delivery-register-loading">
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 flex-1 rounded-xl" />)}
        </div>
        <Skeleton className="h-9 w-64 rounded-lg" />
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 p-8 rounded-xl bg-danger/10 border border-danger/30 text-center"
        data-testid="delivery-register-error"
      >
        <AlertTriangle size={28} className="text-danger-ink" aria-hidden="true" />
        <p className="text-sm text-danger-ink font-medium">Couldn&apos;t load the delivery register — check your connection and try again.</p>
        <button
          type="button"
          onClick={load}
          className="min-h-[44px] px-4 rounded-lg bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary tiles */}
      <div className="flex gap-3">
        <SummaryTile label="To deliver" count={counts.todeliver} tone="teal" />
        <SummaryTile label="At risk" count={counts.atrisk} tone="warning" />
        <SummaryTile label="Delivered" count={counts.delivered} tone="success" />
      </div>

      {/* Filter tabs */}
      <div
        className="inline-flex gap-1 p-1 rounded-lg bg-card-raised border border-border w-fit"
        role="tablist"
        aria-label="Delivery register filter"
      >
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(f.key)}
              className={[
                'min-h-[44px] px-3 rounded-md text-sm font-semibold transition-colors inline-flex items-center gap-1.5',
                on ? 'bg-card text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              {f.label}
              <span className="text-[11px] tabular-nums text-ink-faint">{counts[f.key]}</span>
            </button>
          );
        })}
      </div>

      {/* Empty state (per filter) */}
      {visible.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 p-10 rounded-xl border border-border bg-card text-center"
          data-testid="delivery-register-empty"
        >
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            {filter === 'delivered' ? <PackageCheck size={24} aria-hidden="true" /> : <BookOpen size={24} aria-hidden="true" />}
          </div>
          <p className="text-sm font-medium text-ink">
            {filter === 'delivered'
              ? 'No policies delivered yet.'
              : filter === 'atrisk'
                ? 'No policies at risk — nothing near the 30-day deadline.'
                : 'No settled policies awaiting delivery.'}
          </p>
          <p className="text-xs text-ink-muted max-w-sm">
            {filter === 'todeliver'
              ? 'Settled policies appear here for delivery confirmation once agents settle them.'
              : 'Switch filters to view the rest of the register.'}
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Policy owner</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Policy #</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Agent</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Branch</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Issued</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted whitespace-nowrap">30-day clock</th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const isDelivered = p.policyDeliveryDate != null;
                const clock = deriveClawback(p.dateIssued, { delivered: isDelivered });
                const issuedStr = toTTDayString(p.dateIssued);
                const deliveredStr = toTTDayString(p.policyDeliveryDate);
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0 align-middle" data-testid="delivery-row">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-ink truncate max-w-[180px]">{p.ownerName ?? p.insuredName ?? '—'}</div>
                      {p.insuredName && p.insuredName !== p.ownerName && (
                        <div className="text-[11px] text-ink-muted truncate max-w-[180px]">insured: {p.insuredName}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-ink tabular-nums">{p.policyNumber ?? '—'}</div>
                      {p.productLine && <div className="text-[11px] text-ink-muted capitalize">{p.productLine}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-ink tabular-nums">{p.agentNumber ?? '—'}</div>
                      {p.settledAPI != null && <div className="text-[11px] text-ink-muted">{formatCurrency(p.settledAPI)}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">{branchMap[p.branchId] ?? p.branchId ?? '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="text-ink tabular-nums">{issuedStr ? formatDateDisplay(issuedStr) : '—'}</div>
                      {!isDelivered && clock.valid && (
                        <div className="text-[11px] text-ink-muted tabular-nums">{clock.daysSinceIssue}d ago</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <ClawbackChip dateIssued={p.dateIssued} delivered={isDelivered} />
                      {isDelivered && deliveredStr && (
                        <div className="text-[11px] text-ink-muted tabular-nums mt-0.5">{formatDateDisplay(deliveredStr)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {isDelivered ? (
                        <span className="text-[11px] text-ink-muted">✓ Delivered</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openDialog(p)}
                          className="min-h-[44px] px-3 rounded-lg bg-primary dark:bg-primary-dark text-white text-xs font-semibold hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 whitespace-nowrap"
                          data-testid="mark-delivered-btn"
                        >
                          Mark delivered
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialogPolicy && (
        <MarkDeliveredDialog
          policy={dialogPolicy}
          onConfirm={handleConfirm}
          onCancel={closeDialog}
          saving={saving}
          error={dialogError}
        />
      )}
    </div>
  );
}

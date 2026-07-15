import React from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { PROSPECTING_SOURCE_LABELS } from '../../../services/prospectInfoService';
import { LEGAL_AGENT_TRANSITIONS, POLICY_STATUS_LABELS } from '../../../constants/policyLifecycle';
import { policyToken, policyPillLabel, isConfirmed } from '../../../lib/policyStatusTokens';
import { lifecycleNodes } from '../../../lib/policyLedgerDerivation';

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d?.getTime?.())) return '—';
  return d.toLocaleDateString('en-TT', { day: 'numeric', month: 'short' });
}

/** MiniLifecycle — 4 dots + connectors reflecting the derived lifecycle. */
function MiniLifecycle({ policy }) {
  const nodes = lifecycleNodes(policy);
  return (
    <div className="flex items-center gap-[3px] mb-2.5" aria-hidden="true">
      {nodes.map((n, i) => (
        <React.Fragment key={n.key}>
          {i > 0 && (
            <span className={`w-3.5 h-[1.5px] ${nodes[i - 1].state === 'done' ? 'bg-primary' : 'bg-ink-faint/35'}`} />
          )}
          <span
            className={
              n.state === 'done'
                ? 'w-2 h-2 rounded-full bg-primary'
                : n.state === 'cur'
                ? 'w-2 h-2 rounded-full bg-gold shadow-[0_0_6px_var(--color-gold-tint)]'
                : 'w-2 h-2 rounded-full border-[1.5px] border-ink-faint/60'
            }
          />
        </React.Fragment>
      ))}
    </div>
  );
}

/** Contextual (display-only) action hint — the real mutation lives in the drawer. */
function actionHint(policy) {
  if (isConfirmed(policy)) return null;
  if (policy.status === 'settled') return 'Awaiting manager';
  const next = (LEGAL_AGENT_TRANSITIONS[policy.status] ?? [])[0];
  if (!next) return null;
  return `Move to ${POLICY_STATUS_LABELS[next] ?? next} →`;
}

/**
 * PolicyCard — Tier 2 restyled card. The whole card is the drawer trigger.
 * No nested interactive elements (the action hint is display-only).
 */
export default function PolicyCard({ policy, onOpen }) {
  const t = policyToken(policy);
  const hint = actionHint(policy);
  const noNumber = !policy.policyNumber;

  return (
    <button
      type="button"
      onClick={() => onOpen(policy)}
      className="card bg-card text-left w-full p-[15px_17px_13px] hover:border-primary/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      data-testid={`policy-card-${policy.id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0">
          <span className="text-[15px] font-bold tracking-[-0.005em] text-ink">{policy.ownerName}</span>
          <span className={`font-mono text-[10px] font-bold tracking-[0.06em] ml-2.5 ${noNumber ? 'text-warning-ink' : 'text-ink-muted'}`}>
            {noNumber ? '# PENDING' : `#${policy.policyNumber}`}
          </span>
          {(policy.planName || (policy.insuredName && policy.insuredName !== policy.ownerName)) && (
            <p className="text-[11px] text-ink-muted mt-0.5 truncate">
              {policy.insuredName && policy.insuredName !== policy.ownerName ? `Insured · ${policy.insuredName} · ` : ''}
              {policy.planName}
            </p>
          )}
        </div>
        <span className={`shrink-0 px-2.5 py-[3px] rounded-full font-mono text-[10px] font-bold tracking-[0.1em] uppercase ${t.tint} ${t.text}`}>
          {policyPillLabel(policy)}
        </span>
      </div>

      <MiniLifecycle policy={policy} />

      <div className="flex items-baseline gap-3.5 flex-wrap">
        <div>
          <p className="font-display font-extrabold text-[17px] tracking-tight leading-none text-ink">{formatCurrency(policy.proposedAPI)}</p>
          <p className="font-mono text-[9px] text-ink-muted tracking-[0.08em] mt-0.5">API</p>
        </div>
        <span className="w-px h-[22px] bg-border" />
        <div>
          <p className="text-[11.5px] text-ink">{PROSPECTING_SOURCE_LABELS[policy.sourceOfProspect] || policy.sourceOfProspect || '—'}</p>
          <p className="font-mono text-[9px] text-ink-muted tracking-[0.08em] mt-0.5">SOURCE</p>
        </div>
        <span className="w-px h-[22px] bg-border" />
        <div>
          <p className="text-[11.5px] text-ink">
            {policy.cashWithApp?.collected
              ? (policy.cashWithApp.amount != null ? formatCurrency(policy.cashWithApp.amount) : 'Yes')
              : 'No'}
          </p>
          <p className="font-mono text-[9px] text-ink-muted tracking-[0.08em] mt-0.5">CASH W/ APP</p>
        </div>
        <div className="flex-1" />
        {hint && (
          <span className={`px-3 py-1.5 rounded-lg text-[11.5px] font-bold ${t.tint} ${t.text}`}>{hint}</span>
        )}
        <span className="font-mono text-[10.5px] text-ink-muted">{fmtDate(policy.dateWritten)}</span>
      </div>
    </button>
  );
}

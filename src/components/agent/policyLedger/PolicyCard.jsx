import React from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { PROSPECTING_SOURCE_LABELS } from '../../../services/prospectInfoService';
import { LEGAL_AGENT_TRANSITIONS, POLICY_STATUS_LABELS } from '../../../constants/policyLifecycle';
import { policyToken, policyPillLabel, isConfirmed, needsManagerConfirmation } from '../../../lib/policyStatusTokens';
import { lifecycleNodes } from '../../../lib/policyLedgerDerivation';
import { formatWhole } from '../../../lib/awardLensView';

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
  // A status that came from the head-office export has no manager step waiting
  // on it, so there is no action for the agent to take and no hint to give. The
  // provenance line lives in the drill drawer (`importedStatusNote`); a second
  // copy here would just be noise on every card.
  if (policy.status === 'settled') {
    return needsManagerConfirmation(policy) ? 'Awaiting manager' : null;
  }
  const next = (LEGAL_AGENT_TRANSITIONS[policy.status] ?? [])[0];
  if (!next) return null;
  return `Move to ${POLICY_STATUS_LABELS[next] ?? next} →`;
}

const LENS_CREDIT_LABEL = { campaign: 'Campaign credit', mdrt: 'MDRT credit' };

/**
 * AwardWindowChips — L3 (docs/briefs/ledger-lens-build.md § L3): gold chips
 * naming every award window this policy counts toward, grey "Will count
 * toward" chips for one still submitted-not-settled. `windows` is an
 * `awardWindowsForPolicy` result (src/lib/ledgerProduction.js) — the exact
 * rows the "Counts toward" lens itself reads, so the chips and the lens can
 * never disagree. A policy with no open window (NTU, outside every window,
 * family excluded from everything but MDRT with MDRT also out of reach)
 * renders nothing.
 */
export function AwardWindowChips({ windows }) {
  const counting = (windows ?? []).filter((w) => w.group === 'counting');
  const pending = (windows ?? []).filter((w) => w.group === 'pending');
  if (counting.length === 0 && pending.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1.5" data-testid="award-window-chips">
      {counting.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-muted">Counts toward</span>
          {counting.map((w) => (
            <span
              key={w.key}
              className="rounded-full bg-gold-tint px-[7px] py-[3px] font-mono text-[10px] font-semibold text-gold-ink"
              data-testid={`award-window-chip-${w.key}`}
            >
              {w.label}
            </span>
          ))}
        </div>
      )}
      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-muted">Will count toward</span>
          {pending.map((w) => (
            <span
              key={w.key}
              className="rounded-full bg-surface-muted px-[7px] py-[3px] font-mono text-[10px] font-semibold text-ink-muted"
              data-testid={`award-window-chip-${w.key}`}
            >
              {w.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * LensFooter — the award lens line under a card (L1): the credit this policy
 * earns toward the selected award, "Counts when settled", or the engine's
 * reason it does not count. Every string here comes from `deriveAwardLens`;
 * nothing is decided in the card.
 */
function LensFooter({ lensRow, awardKind }) {
  const { group, credit, reason, hoFlag } = lensRow;
  const label = LENS_CREDIT_LABEL[awardKind] ?? 'Your credit';
  let value;
  if (group === 'counting') {
    const apps = credit.apps === 1 ? '1 app' : `${credit.apps} apps`;
    value = <span className="text-[13px] font-bold text-primary tabular-nums">{formatWhole(credit.api)} · {apps}</span>;
  } else if (group === 'pending') {
    value = <span className="text-[13px] font-bold text-warning-ink">Counts when settled</span>;
  } else {
    value = <span className="min-w-0 text-right text-[13px] font-semibold text-warning-ink">{reason}</span>;
  }
  return (
    <div className="mt-2.5 flex flex-col gap-1 border-t border-border pt-2" data-testid={`policy-card-lens-${group}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="shrink-0 text-xs text-ink-muted">{label}</span>
        {value}
      </div>
      {hoFlag && (
        <span className="text-xs font-semibold text-warning-ink" data-testid="policy-card-ho-flag">
          Not on the head-office list yet — check with HO
        </span>
      )}
    </div>
  );
}

/**
 * PolicyCard — Tier 2 restyled card. The whole card is the drawer trigger.
 * No nested interactive elements (the action hint is display-only).
 *
 * `lensRow` (optional, L1) — this policy's row from `deriveAwardLens` for the
 * award selected in the ledger's "Counts toward" lens; `awardKind` names that
 * award. Absent ⇒ the card renders exactly as before.
 *
 * `awardWindows` (optional, L3) — this policy's `awardWindowsForPolicy` rows;
 * renders the gold/grey "Counts toward" chip row. Absent ⇒ no chip row.
 */
export default function PolicyCard({ policy, onOpen, lensRow = null, awardKind = null, awardWindows = null }) {
  const t = policyToken(policy);
  const hint = actionHint(policy);
  const noNumber = !policy.policyNumber;
  const pendingFrame = lensRow?.group === 'pending' ? ' border-dashed border-primary/40' : '';

  return (
    <button
      type="button"
      onClick={() => onOpen(policy)}
      className={`card bg-card text-left w-full p-[15px_17px_13px] hover:border-primary/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40${pendingFrame}`}
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
      {awardWindows && <AwardWindowChips windows={awardWindows} />}
      {lensRow && <LensFooter lensRow={lensRow} awardKind={awardKind} />}
    </button>
  );
}

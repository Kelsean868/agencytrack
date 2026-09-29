import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { outlookDateLabel } from '../persistency/outlookLabels';

/**
 * CampaignPolicyList — "Policies in this campaign" (FR round 2, R2-4).
 *
 * PRESENTATIONAL. `groups` is `buildCampaignPolicyGroups(lens, policies)` —
 * the SAME lens the progress block above reads, so the Counting and Waiting
 * totals printed here are the campaign's own API / applications figures.
 *
 * Status changes never happen here. A row whose status the Policy ledger's
 * drawer would let the agent change carries a "Change status" button that
 * hands the policy id to `onOpenPolicy`; the dashboard then opens the Policy
 * ledger with that policy's drawer open, and the change runs through the
 * ledger's own path (transitionPolicyStatus). Without `onOpenPolicy` the list
 * is read-only. Head-office statuses the ledger shows as final say so and
 * offer nothing.
 */

function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

const GROUP_DOT = {
  counting: 'bg-success',
  waiting: 'bg-primary',
  notCounting: 'bg-ink-dim',
};

function PolicyRow({ row, group, onOpenPolicy }) {
  const label = row.client ?? 'Unnamed client';
  const dateText = row.date ? `${row.dateBasis} ${outlookDateLabel(row.date)}` : (row.dateBasis === 'Issued' ? 'Not issued yet' : 'No date recorded');
  // The credit line shows only when the campaign's credit differs from the
  // policy's own API or from one application (a replacement's difference, a
  // Platinum Edge with no API credit) — otherwise it would just repeat the row.
  const creditDiffers = group !== 'notCounting'
    && (row.creditApi !== row.policyApi || row.creditApps !== 1);
  const creditVerb = group === 'counting' ? 'Counts' : 'Would add';

  return (
    <li
      className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0"
      data-testid={`campaign-policy-row-${row.id}`}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold text-ink" title={label}>{label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-ink" data-testid={`campaign-policy-row-api-${row.id}`}>
          {formatCurrency(row.policyApi)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        <span className="font-mono">{row.policyNumber ? `#${row.policyNumber}` : '# pending'}</span>
        {/* Each separator is bound to the item AFTER it, so a wrapped line
            never ends on a dangling "·" at phone width. */}
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-ink" data-testid={`campaign-policy-row-status-${row.id}`}>{row.statusLabel}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2">
          <span aria-hidden="true">·</span>
          <span>{dateText}</span>
        </span>
        {/* Last, so it wraps onto its own line with no separator to strand. */}
        {row.headOffice && (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-ink-muted">Head office</span>
        )}
      </div>
      {group === 'notCounting' && row.reason && (
        <p className="text-xs text-ink-muted" data-testid={`campaign-policy-row-reason-${row.id}`}>{row.reason}</p>
      )}
      {creditDiffers && (
        <p className="text-xs text-ink-muted" data-testid={`campaign-policy-row-credit-${row.id}`}>
          {creditVerb} {formatCurrency(row.creditApi)} · {plural(row.creditApps, 'app')} — {row.reason}
        </p>
      )}
      {onOpenPolicy && row.canChangeStatus ? (
        <button
          type="button"
          onClick={() => onOpenPolicy(row.id)}
          className="-ml-1 inline-flex min-h-[44px] w-fit items-center gap-1 rounded-lg px-1 text-[13px] font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Change status of ${label}${row.policyNumber ? `, policy ${row.policyNumber}` : ''}`}
          data-testid={`campaign-policy-row-change-${row.id}`}
        >
          Change status
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      ) : row.headOffice && !row.canChangeStatus ? (
        <p className="text-xs text-ink-muted" data-testid={`campaign-policy-row-locked-${row.id}`}>
          Status set by head office — it cannot be changed here.
        </p>
      ) : null}
    </li>
  );
}

function GroupHeader({ name, count, summary, testId }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" data-testid={testId}>
      <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
        <span className={`h-2 w-2 shrink-0 rounded-full ${GROUP_DOT[name]}`} aria-hidden="true" />
        {name === 'counting' ? 'Counting' : name === 'waiting' ? 'Waiting' : 'Not counting'}
        <span className="font-medium text-ink-muted">· {plural(count, 'policy', 'policies')}</span>
      </span>
      {summary && <span className="text-xs font-semibold tabular-nums text-ink" data-testid={`${testId}-total`}>{summary}</span>}
    </div>
  );
}

function RowList({ rows, group, onOpenPolicy, empty }) {
  if (rows.length === 0) return <p className="py-2 text-xs text-ink-muted">{empty}</p>;
  return (
    <ul className="mt-1 flex flex-col">
      {rows.map((row) => <PolicyRow key={row.id} row={row} group={group} onOpenPolicy={onOpenPolicy} />)}
    </ul>
  );
}

/**
 * @param {{ groups: object|null, exportDate?: string|null, onOpenPolicy?: ((id: string) => void)|null, showNotCounting?: boolean }} props
 *   `showNotCounting` only sets the fold's INITIAL state (the FR harness opens it
 *   to show every group); the app leaves it folded — on a live ledger it holds
 *   most of the book.
 */
export default function CampaignPolicyList({ groups, exportDate = null, onOpenPolicy = null, showNotCounting = false }) {
  if (!groups) return null;
  const { counting, waiting, notCounting } = groups;
  return (
    <section aria-labelledby="campaign-policies-heading" className="flex flex-col gap-2.5" data-testid="campaign-policies">
      <div className="flex flex-col gap-0.5">
        <h2 id="campaign-policies-heading" className="font-display text-lg font-bold text-ink">Policies in this campaign</h2>
        <p className="text-xs text-ink-muted">
          From your policy ledger{exportDate ? `, as at ${outlookDateLabel(exportDate)}` : ''}. The Counting total is your progress above.
        </p>
      </div>
      <div className="flex flex-col gap-4 rounded-[18px] border border-border bg-card p-4">
        <div className="flex flex-col gap-1" data-testid="campaign-policies-counting">
          <GroupHeader
            name="counting"
            count={counting.rows.length}
            summary={`${plural(counting.apps, 'app')} · ${formatCurrency(counting.api)}`}
            testId="campaign-policies-counting-header"
          />
          <RowList rows={counting.rows} group="counting" onOpenPolicy={onOpenPolicy} empty="Nothing counts yet." />
        </div>
        <div className="flex flex-col gap-1 border-t border-border pt-3" data-testid="campaign-policies-waiting">
          <GroupHeader
            name="waiting"
            count={waiting.rows.length}
            summary={`would add ${plural(waiting.apps, 'app')} · ${formatCurrency(waiting.api)}`}
            testId="campaign-policies-waiting-header"
          />
          <RowList rows={waiting.rows} group="waiting" onOpenPolicy={onOpenPolicy} empty="Nothing waiting to settle." />
        </div>
        <details className="group border-t border-border pt-3" open={showNotCounting || undefined} data-testid="campaign-policies-not-counting">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
            <div className="min-w-0 flex-1">
              <GroupHeader name="notCounting" count={notCounting.rows.length} summary={null} testId="campaign-policies-not-counting-header" />
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-primary">
              <span className="group-open:hidden">Show</span>
              <span className="hidden group-open:inline">Hide</span>
              <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" />
            </span>
          </summary>
          <RowList rows={notCounting.rows} group="notCounting" onOpenPolicy={onOpenPolicy} empty="None." />
        </details>
      </div>
    </section>
  );
}

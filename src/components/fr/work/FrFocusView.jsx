import React from 'react';
import { Phone, PhoneOff, Plus, Check } from 'lucide-react';
import { CARD, EYEBROW, FOCUS, SKELETON, TileGrid } from '../money/moneyParts';
import ReinstatementPlanner from '../money/ReinstatementPlanner';

/**
 * FrFocusView — FR "Focus" (FR-4, FR-D11): one mode at a time.
 *   Calls      today's planner call blocks (capacity) and prospect items with
 *              a tel: link, plus today's counts from the daily entry. Outcomes
 *              are captured by the EXISTING Daily Capture sheet ("Log today")
 *              — this screen writes nothing.
 *   Paperwork  own policies still in the pipeline, oldest first, with age.
 *   Win-back   the FR-3 reinstatement planner (read-only).
 * PURE: props only.
 *
 * @param {{
 *   mode: 'calls'|'paperwork'|'winback', onMode: (m) => void,
 *   calls: object|null, callsLoading?: boolean, callsError?: boolean, onRetryCalls?: () => void,
 *   paperwork: object[]|null, plan: object|null,
 *   onLogToday?: () => void, onOpenLedger?: () => void, onOpenPlanner?: () => void,
 * }} props
 */
const MODES = [
  { id: 'calls', label: 'Calls' },
  { id: 'paperwork', label: 'Paperwork' },
  { id: 'winback', label: 'Win-back' },
];

const STAGE_LABEL = { written: 'Written', submitted: 'Submitted', rated: 'Rated', postponed: 'Postponed' };
const money = (n) => (n == null ? '—' : `TTD ${Number(n).toLocaleString('en-TT', { maximumFractionDigits: 0 })}`);

function ModeSwitch({ mode, onMode }) {
  return (
    <div role="group" aria-label="Focus mode" className="flex w-full gap-1 rounded-full bg-fr-sunk p-1 sm:w-auto">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          aria-pressed={mode === m.id}
          onClick={() => onMode(m.id)}
          data-testid={`focus-mode-${m.id}`}
          className={`${FOCUS} min-h-[44px] flex-1 rounded-full px-4 text-[14px] font-semibold transition-colors sm:flex-none ${mode === m.id ? 'bg-fr-accent text-fr-on-accent' : 'text-ink-muted hover:text-ink'}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function Calls({ calls, loading, error, onRetry, onLogToday, onOpenPlanner }) {
  if (loading) {
    return <div className={`${CARD} p-5`} aria-busy="true"><div className={`h-5 w-1/2 ${SKELETON}`} /><div className={`mt-4 h-24 ${SKELETON}`} /></div>;
  }
  if (error) {
    return (
      <div className={`${CARD} p-5`}>
        <p role="alert" className="text-[14px] font-semibold text-ink">Today’s plan did not load.</p>
        <button type="button" onClick={onRetry} className={`mt-2 inline-flex min-h-[44px] items-center rounded-lg px-2 text-[14px] font-bold text-primary underline underline-offset-2 ${FOCUS}`}>Retry</button>
      </div>
    );
  }
  const tiles = [
    { id: 'dials', label: 'Dials today', value: calls.counts.dials, unit: 'count', note: calls.logged ? 'From your daily log' : 'Not logged yet today' },
    { id: 'contacts', label: 'Contacts today', value: calls.counts.contacts, unit: 'count', note: calls.logged ? 'From your daily log' : null },
  ];
  return (
    <div className="flex flex-col gap-4">
      <TileGrid tiles={tiles} label="Today’s calls so far" />
      <button
        type="button"
        onClick={onLogToday}
        className={`${FOCUS} inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-full bg-primary px-5 text-[14px] font-bold text-white dark:bg-primary-dark`}
        data-testid="focus-log-today"
      >
        <Plus size={16} aria-hidden="true" />
        Log today’s calls
      </button>

      <section className={`${CARD} p-5`} aria-label="Who to call today">
        <h3 className="font-display text-[18px] font-bold text-ink">
          {calls.calls.length ? `${calls.calls.length} ${calls.calls.length === 1 ? 'person' : 'people'} to call today` : 'No calls with a client planned today'}
        </h3>
        <p className="mt-1 text-[13px] text-ink-muted">Calls go through your own phone. Outcomes go in your daily log.</p>
        {calls.calls.length ? (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {calls.calls.map((c) => (
              <li key={c.id} className="flex min-w-0 items-center gap-3 py-2.5" data-testid={`focus-call-${c.id}`}>
                <span className="w-12 flex-none font-mono text-[12px] tabular-nums text-ink-muted">{c.time ?? '—'}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-ink" title={c.name ?? ''}>{c.name ?? 'Client'}</span>
                  <span className="truncate text-[12px] text-ink-muted" title={c.label}>{c.label}{c.done ? ' · done' : ''}</span>
                </span>
                {c.done ? <Check size={16} aria-label="Done" className="flex-none text-primary" /> : null}
                {c.tel ? (
                  <a
                    href={c.tel}
                    className={`${FOCUS} inline-flex min-h-[44px] min-w-[44px] flex-none items-center justify-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-bold text-primary`}
                    aria-label={`Call ${c.name ?? 'client'}`}
                  >
                    <Phone size={16} aria-hidden="true" />
                    <span className="hidden sm:inline">Call</span>
                  </a>
                ) : (
                  <span className="inline-flex flex-none items-center gap-1 text-[12px] text-ink-muted" title="No phone number on file">
                    <PhoneOff size={14} aria-hidden="true" />No number
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={`${CARD} p-5`} aria-label="Call blocks today">
        <h3 className="font-display text-[16px] font-bold text-ink">Call blocks on your calendar</h3>
        {calls.blocks.length ? (
          <ul className="mt-2 flex flex-col gap-1 text-[13px] text-ink">
            {calls.blocks.map((b) => (
              <li key={b.id} className="flex gap-3" data-testid={`focus-block-${b.id}`}>
                <span className="w-12 font-mono text-[12px] tabular-nums text-ink-muted">{b.time ?? '—'}</span>
                <span>{b.label}{b.durationMin ? ` · ${b.durationMin} min` : ''}{b.note ? ` · ${b.note}` : ''}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[13px] text-ink-muted">None today.</p>
        )}
        <p className="mt-2 text-[12px] text-ink-muted">A block is time set aside; the calls you make in it are counted in your daily log, not here.</p>
        <button type="button" onClick={onOpenPlanner} className={`mt-1 inline-flex min-h-[44px] items-center rounded-lg px-1 text-[13px] font-bold text-primary ${FOCUS}`}>Open your week</button>
      </section>
    </div>
  );
}

function Paperwork({ rows, onOpenLedger }) {
  if (!rows) return <div className={`${CARD} p-5`} aria-busy="true"><div className={`h-24 ${SKELETON}`} /></div>;
  return (
    <section className={`${CARD} p-5`} aria-label="Paperwork">
      <h3 className="font-display text-[18px] font-bold text-ink">
        {rows.length ? `${rows.length} ${rows.length === 1 ? 'policy' : 'policies'} still in the pipeline` : 'Nothing waiting in the pipeline'}
      </h3>
      <p className="mt-1 text-[13px] text-ink-muted">Oldest first. Age counts from the day it went in (written, if not yet submitted).</p>
      {rows.length ? (
        <ul className="mt-3 flex flex-col divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex min-w-0 items-baseline gap-3 py-2.5" data-testid={`focus-paper-${r.id}`}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold text-ink" title={r.name ?? r.policyNumber ?? ''}>{r.name ?? r.policyNumber ?? 'Policy'}</span>
                <span className="text-[12px] text-ink-muted">{STAGE_LABEL[r.status] ?? r.status}{r.policyNumber && r.name ? ` · ${r.policyNumber}` : ''}</span>
              </span>
              <span className="flex-none whitespace-nowrap text-[13px] tabular-nums text-ink">{money(r.api)}</span>
              <span className="w-20 flex-none whitespace-nowrap text-right text-[12px] tabular-nums text-ink-muted">{r.ageDays == null ? '—' : `${r.ageDays} ${r.ageDays === 1 ? 'day' : 'days'}`}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" onClick={onOpenLedger} className={`mt-2 inline-flex min-h-[44px] items-center rounded-lg px-1 text-[13px] font-bold text-primary ${FOCUS}`}>Open the policy ledger</button>
    </section>
  );
}

export default function FrFocusView({
  mode = 'calls', onMode, calls, callsLoading = false, callsError = false, onRetryCalls,
  paperwork, plan, onLogToday, onOpenLedger, onOpenPlanner, reinstateActions = null,
}) {
  return (
    <div className="flex flex-col gap-4 lg:gap-5" data-testid="fr-focus">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={EYEBROW}>Work · Focus</p>
          <h2 className="font-display text-[28px] font-bold leading-tight text-ink lg:text-[32px]">One thing at a time</h2>
        </div>
        <ModeSwitch mode={mode} onMode={onMode} />
      </header>
      {mode === 'calls' ? (
        <Calls calls={calls} loading={callsLoading || (!calls && !callsError)} error={callsError} onRetry={onRetryCalls} onLogToday={onLogToday} onOpenPlanner={onOpenPlanner} />
      ) : mode === 'paperwork' ? (
        <Paperwork rows={paperwork} onOpenLedger={onOpenLedger} />
      ) : (
        <ReinstatementPlanner plan={plan} actions={reinstateActions} />
      )}
    </div>
  );
}

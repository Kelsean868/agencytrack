import React, { useRef } from 'react';
import { AlertCircle, BarChart3 } from 'lucide-react';
import MedalCoin from '../../ui/MedalCoin';
import Trophy from '../trophies/Trophy';
import { Donut } from '../charts';

/**
 * FrLeaderboardView — the FR Leaderboard (R2-11; three boards in FR
 * Leaderboard L-2, canvas D3-Leaderboard / M3-Leaderboard v43). PURE: props
 * only. The container (FrLeaderboard) runs the same hook as the Nexus surface
 * (useProductionLeaderboard) and shapes the chosen board with
 * src/lib/fr/leaderboardModel.js `boardView`. Every value, column and line of
 * copy comes from `boardConfig` (src/lib/fr/leaderboardBoards.js) — the view
 * never branches on which board is showing.
 *
 * Layout (ONE is rendered, chosen by `layout`):
 *   desktop  board column (champions · podium · everyone else) + a 340px
 *            "You" inspector (standing, to pass, rank per period, share).
 *   tablet   the "You" block as a card first, then the board.
 *   phone    period · your standing · podium · everyone else · champions;
 *            the pinned "You" bar (slot) stays above the bottom nav.
 *
 * @param {object} props
 * @param {'desktop'|'tablet'|'phone'} props.layout
 * @param {'loading'|'error'|'empty'|'ready'} props.status
 * @param {string} [props.errorCode]
 * @param {Function} props.onRetry
 * @param {{id:string,label:string}[]} props.boards   board switch, in order (Activity · API · Apps)
 * @param {string} props.board           the chosen board id
 * @param {Function} props.onBoard
 * @param {object} props.boardConfig     LEADERBOARD_BOARDS[board]
 * @param {{k:string,label:string}[]} props.periods
 * @param {string} props.period          'WK' | 'MTD' | 'QTD' | 'YTD'
 * @param {Function} props.onPeriod
 * @param {React.ReactNode} [props.scopeControl]  rendered exactly when the Nexus surface renders it
 * @param {string} props.scopeLine
 * @param {string} props.title
 * @param {string} props.periodWord      e.g. "the year"
 * @param {object} props.champions      championsModel()
 * @param {object[]} props.podium       ranking entries 1–3
 * @param {object[]} props.rows         { type:'row', entry, pct, isYou } | { type:'gap', text } | { type:'unranked' }
 * @param {string|null} props.viewerUid
 * @param {object} props.you            { rank, of, value, movedNote }
 * @param {object|null} props.toPass    toPass()
 * @param {object[]} props.rankCols     rankColumns()
 * @param {object|null} props.share     shareOfScope()
 * @param {'branch'|'unit'} [props.scope]
 * @param {string|null} props.updated
 * @param {React.ReactNode} [props.mobileYouBar]
 * @param {Function} [props.onOpenTrophies]
 */

const CARD = 'rounded-[20px] border border-border bg-card';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const EYEBROW = 'font-mono text-[11px] font-semibold uppercase tracking-[0.1em]';

function initialsOf(name) {
  if (!name || typeof name !== 'string') return '?';
  return name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function PeriodRadios({ periods, period, onPeriod }) {
  const refs = useRef([]);
  const idx = periods.findIndex((p) => p.k === period);
  const move = (to) => {
    const next = (to + periods.length) % periods.length;
    onPeriod(periods[next].k);
    refs.current[next]?.focus();
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(idx + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(idx - 1); }
  };
  return (
    <div role="radiogroup" aria-label="Period" className="flex gap-0.5 rounded-xl bg-fr-sunk p-1">
      {periods.map((p, i) => {
        const on = p.k === period;
        return (
          <button
            key={p.k}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={p.label}
            tabIndex={on ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => onPeriod(p.k)}
            className={`${FOCUS} min-h-[44px] min-w-[52px] rounded-[9px] px-3 text-[13px] font-bold transition-colors ${
              on ? 'bg-card text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
            data-testid={`fr-leaderboard-period-${p.k.toLowerCase()}`}
          >
            {p.k}
          </button>
        );
      })}
    </div>
  );
}

// The board switch (D10, canvas v43): a radiogroup before the Period radios,
// arrow keys move the choice. Phone: full width, three equal columns.
function BoardRadios({ boards, board, onBoard, phone }) {
  const refs = useRef([]);
  const idx = boards.findIndex((b) => b.id === board);
  const move = (to) => {
    const next = (to + boards.length) % boards.length;
    onBoard(boards[next].id);
    refs.current[next]?.focus();
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(idx + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(idx - 1); }
  };
  return (
    <div
      role="radiogroup"
      aria-label="Board"
      className={`gap-0.5 rounded-xl bg-fr-sunk p-1 ${phone ? 'grid w-full grid-cols-3' : 'flex'}`}
      data-testid="fr-leaderboard-boards"
    >
      {boards.map((b, i) => {
        const on = b.id === board;
        return (
          <button
            key={b.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => onBoard(b.id)}
            className={`${FOCUS} min-h-[44px] rounded-[9px] px-3.5 font-extrabold transition-colors ${phone ? 'text-[14px]' : 'min-w-[64px] text-[13px]'} ${
              on ? 'bg-fr-accent text-fr-on-accent' : 'text-ink-muted hover:text-ink'
            }`}
            data-testid={`fr-leaderboard-board-${b.id}`}
          >
            {b.label}
          </button>
        );
      })}
    </div>
  );
}

function Champions({ champions, compact }) {
  return (
    // fr-fit-any-width: the strip follows the BOARD's width. Under 42rem (beside
    // the 340px "you" column on a narrow window) the heading takes its own row
    // so the three champion cards keep room for their figures.
    <section aria-label="Last week's champions" className={compact ? 'flex flex-col gap-2' : 'grid grid-cols-1 gap-3 @[30rem]/board:grid-cols-3 @[42rem]/board:grid-cols-[180px_repeat(3,minmax(0,1fr))]'} data-testid="fr-leaderboard-champions">
      <div className={`flex flex-col justify-center gap-0.5 ${compact ? '' : '@[30rem]/board:col-span-3 @[42rem]/board:col-span-1'}`}>
        <span className={`${EYEBROW} text-gold-ink`}>{champions.heading}</span>
        <span className="text-[12px] text-ink-muted">Whole company · last full week</span>
      </div>
      <div className={compact ? 'flex flex-col gap-2' : 'contents'}>
        {champions.cards.map((c) => (
          <div key={c.key} className="flex min-w-0 items-center gap-2.5 rounded-[14px] border border-border bg-card px-3 py-2.5" data-testid={`fr-leaderboard-champion-${c.key}`}>
            <Trophy kind={c.kind} size={40} locked={!c.name} className="flex-none" />
            <span className="flex min-w-0 flex-col">
              <span className="text-[11px] font-bold text-ink-muted">{c.title}</span>
              {c.name ? (
                <>
                  <span className="truncate text-[14px] font-bold text-ink" title={c.name}>{c.name}</span>
                  <span className="whitespace-nowrap text-[12px] font-bold tabular-nums text-gold-ink">{c.value}</span>
                </>
              ) : (
                <span className="text-[13px] text-ink-muted">No winner this week</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

const PODIUM_ORDER = [1, 0, 2];
const PODIUM_LABEL = ['1st', '2nd', '3rd'];
const BLOCK_H = ['h-[92px]', 'h-[66px]', 'h-[48px]'];

function Podium({ podium, viewerUid, period, title, config }) {
  return (
    <section aria-label="Podium" className={`${CARD} flex flex-col gap-2 overflow-hidden bg-fr-pane px-4 pt-4 sm:px-6`} data-testid="fr-leaderboard-podium">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className={`${EYEBROW} text-gold-ink`}>Top of the board · {period} · {config.label}</span>
        <h2 className="font-display text-[20px] font-extrabold leading-tight text-ink sm:text-[22px]">{title}</h2>
      </div>
      <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
        {PODIUM_ORDER.map((i) => {
          const e = podium[i];
          if (!e) return <div key={i} aria-hidden="true" />;
          const isYou = e.agentId === viewerUid;
          return (
            <div key={e.agentId} className="flex min-w-0 flex-col items-center gap-1 text-center" data-testid={`fr-podium-rank-${e.rank}`}>
              {isYou ? <span className="rounded-full bg-fr-accent px-2 text-[11px] font-extrabold leading-5 text-fr-on-accent">YOU</span> : null}
              <MedalCoin rank={i + 1} size={i === 0 ? 44 : 36} glow={i === 0} />
              <span className={`flex items-center justify-center rounded-full bg-fr-accent-tint font-display font-extrabold text-primary ${i === 0 ? 'h-14 w-14 text-[18px]' : 'h-11 w-11 text-[15px]'} ${isYou ? 'ring-2 ring-primary' : ''}`}>
                {initialsOf(e.name)}
              </span>
              <span className="w-full truncate text-[14px] font-extrabold text-ink" title={e.name}>{e.name}</span>
              <span className="w-full truncate text-[12px] text-ink-muted">{[e.unitName, config.second(e)].filter(Boolean).join(' · ')}</span>
              <span className={`whitespace-nowrap font-display font-extrabold tabular-nums ${i === 0 ? 'text-[20px] text-gold-ink sm:text-[24px]' : 'text-[15px] text-ink sm:text-[18px]'}`}>
                {config.format(e[config.metric])}
              </span>
              <span className={`mt-1 flex w-full justify-center rounded-t-[14px] pt-2 font-display text-[22px] font-extrabold text-ink-muted ${BLOCK_H[i]} ${i === 0 ? 'bg-fr-gold-tint' : 'bg-fr-sunk'}`}>
                {PODIUM_LABEL[i]}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// The desktop row grid. The second column holds a count (Apps) on two boards
// and a TTD figure (Settled API) on the Apps board, so it widens there.
const ROW_GRID = 'grid-cols-[44px_minmax(0,1fr)_64px_minmax(120px,240px)_120px]';
const ROW_GRID_WIDE = 'grid-cols-[44px_minmax(0,1fr)_112px_minmax(120px,240px)_120px]';

function Row({ entry, pct, isYou, phone, config }) {
  const value = config.format(entry[config.metric]);
  const bar = (
    <span role="img" aria-label={`${Math.round(pct)}% of the leader`} className="block h-2.5 overflow-hidden rounded-full bg-fr-sunk">
      <span className="block h-full rounded-full bg-fr-accent fr-glide-w" style={{ width: `${pct}%` }} />
    </span>
  );
  const who = (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-[12px] font-extrabold ${isYou ? 'bg-fr-accent text-fr-on-accent' : 'bg-fr-sunk text-ink-muted'}`}>{initialsOf(entry.name)}</span>
      <span className="flex min-w-0 flex-col">
        <span className={`truncate text-[14px] text-ink ${isYou ? 'font-extrabold' : 'font-semibold'}`} title={entry.name}>{isYou ? `You · ${entry.name}` : entry.name}</span>
        {entry.unitName ? <span className="truncate text-[12px] text-ink-muted">{entry.unitName}</span> : null}
      </span>
    </span>
  );
  if (phone) {
    return (
      <li className={`flex flex-col gap-1.5 border-t border-border px-4 py-3 ${isYou ? 'bg-fr-accent-tint ring-2 ring-inset ring-primary' : ''}`} data-testid={`fr-leaderboard-row-${entry.rank}`} data-you={isYou ? 'true' : undefined}>
        <div className="flex items-center gap-3">
          <span className="w-8 flex-none font-mono text-[14px] font-bold tabular-nums text-ink-muted">{entry.rank}</span>
          <span className="min-w-0 flex-1">{who}</span>
          <span className="flex-none whitespace-nowrap text-[14px] font-extrabold tabular-nums text-ink">{value}</span>
        </div>
        <div className="flex items-center gap-3 pl-11">
          <span className="min-w-0 flex-1">{bar}</span>
          <span className="flex-none whitespace-nowrap text-[12px] tabular-nums text-ink-muted">{config.second(entry)}</span>
        </div>
      </li>
    );
  }
  return (
    <li
      className={`grid min-h-[52px] ${config.wideSecond ? ROW_GRID_WIDE : ROW_GRID} items-center gap-3 border-t border-border px-4 ${isYou ? 'bg-fr-accent-tint ring-2 ring-inset ring-primary' : ''}`}
      data-testid={`fr-leaderboard-row-${entry.rank}`}
      data-you={isYou ? 'true' : undefined}
    >
      <span className="font-mono text-[14px] font-bold tabular-nums text-ink-muted">{entry.rank}</span>
      {who}
      <span className="truncate whitespace-nowrap text-right text-[13px] tabular-nums text-ink-muted" title={config.second(entry)}>{config.secondShort(entry)}</span>
      {bar}
      <span className="whitespace-nowrap text-right text-[14px] font-extrabold tabular-nums text-ink">{value}</span>
    </li>
  );
}

function EveryoneElse({ rows, phone, config }) {
  if (!rows.length) return null;
  return (
    <section aria-label="Everyone else" className={`${CARD} overflow-hidden`} data-testid="fr-leaderboard-rows">
      {phone ? null : (
        <div className={`grid h-10 ${config.wideSecond ? ROW_GRID_WIDE : ROW_GRID} items-center gap-3 bg-fr-sunk px-4 text-[12px] font-bold text-ink-muted`} aria-hidden="true">
          <span>Rank</span><span>Agent</span><span className="text-right">{config.secondColumn}</span><span>Against the leader</span><span className="text-right">{config.column}</span>
        </div>
      )}
      <ol className="flex flex-col">
        {rows.map((r) => {
          if (r.type === 'gap') {
            return <li key={`gap-${r.text}`} className="flex h-8 items-center justify-center border-t border-border text-[12px] text-ink-muted" data-testid="fr-leaderboard-gap">{r.text}</li>;
          }
          if (r.type === 'unranked') {
            return (
              <li key="unranked" className="border-t border-border bg-fr-accent-tint px-4 py-3 text-[13px] text-ink ring-2 ring-inset ring-primary" data-testid="fr-leaderboard-unranked">
                <strong>You</strong> — not on the board yet for this period.
              </li>
            );
          }
          return <Row key={r.entry.agentId} entry={r.entry} pct={r.pct} isYou={r.isYou} phone={phone} config={config} />;
        })}
      </ol>
    </section>
  );
}

function YouBlock({ you, toPass, rankCols, share, period, asCard, onOpenTrophies, branchWide, config, scope }) {
  const maxOf = Math.max(1, ...rankCols.map((c) => c.of || 0));
  const rankAria = rankCols.map((c) => `${c.label} ${c.rank == null ? 'not ranked' : `#${c.rank}`}`).join(', ');
  return (
    <aside
      aria-label="You"
      className={`flex min-w-0 flex-col gap-4 ${asCard ? `${CARD} p-4` : 'rounded-[20px] border border-border bg-fr-pane p-5'}`}
      data-testid="fr-leaderboard-you"
    >
      <span className={`${EYEBROW} text-primary`}>Your standing · {period}</span>
      {branchWide ? (
        <p className="-mt-2 text-[12px] text-ink-muted" data-testid="fr-leaderboard-branch-note">
          Your rank, the agent to pass and the rank per period are across the whole branch; the board and your share follow the unit you picked.
        </p>
      ) : null}
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[48px] font-extrabold leading-none tabular-nums text-ink" data-testid="fr-leaderboard-you-rank">
          {you.rank == null ? '—' : `#${you.rank}`}
        </span>
        <span className="flex flex-col gap-0.5">
          {you.rank == null ? (
            <span className="text-[14px] font-bold text-ink">Not on the board yet</span>
          ) : (
            <span className="text-[14px] font-bold text-ink">of {you.of} agents</span>
          )}
          <span className="whitespace-nowrap text-[13px] tabular-nums text-ink-muted" data-testid="fr-leaderboard-you-value">{config.format(you.value ?? 0)}{config.youSuffix}</span>
        </span>
      </div>
      {you.movedNote ? <p className="-mt-2 text-[12px] text-ink-muted" data-testid="fr-leaderboard-moved">{you.movedNote}</p> : null}

      {toPass ? (
        <div className="flex flex-col gap-2 rounded-[16px] border border-border bg-card p-3.5" data-testid="fr-leaderboard-topass">
          {toPass.lead ? (
            <>
              <span className="text-[12px] font-bold text-ink-muted">{branchWide ? 'To pass the next agent in the branch' : 'To pass the next agent'}</span>
              <span className="font-display text-[22px] font-extrabold text-ink">You lead</span>
            </>
          ) : (
            <>
              <span className="text-[12px] font-bold text-ink-muted">{branchWide ? 'To pass the next agent in the branch' : 'To pass the next agent'}</span>
              <span className="whitespace-nowrap font-display text-[24px] font-extrabold tabular-nums text-ink">{config.format(toPass.tied ? 1 : toPass.gap)}</span>
              <span className="text-[13px] text-ink-muted">
                {toPass.tied
                  ? (toPass.aboveName ? `Tied with ${toPass.aboveName} (#${toPass.aboveRank}) · 1 more to pass` : `Tied with #${toPass.aboveRank} · 1 more to pass`)
                  : (toPass.aboveName ? `to pass ${toPass.aboveName} (#${toPass.aboveRank})` : `to pass #${toPass.aboveRank}`)}
              </span>
              <span role="img" aria-label={`You are at ${Math.round(toPass.pct)}% of #${toPass.aboveRank}'s ${config.noun}`} className="block h-3 overflow-hidden rounded-full bg-fr-sunk">
                <span className="block h-full rounded-full bg-fr-accent fr-glide-w" style={{ width: `${toPass.pct}%` }} />
              </span>
            </>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5 rounded-[16px] border border-border bg-card p-3.5">
        <span className="text-[12px] font-bold text-ink-muted">{branchWide ? 'Your branch rank in each period' : 'Your rank in each period'}</span>
        <div role="img" aria-label={rankAria} className="grid h-[110px] grid-cols-4 items-end gap-2.5" data-testid="fr-leaderboard-rankcols">
          {rankCols.map((c) => {
            const h = c.rank == null ? 6 : Math.max(10, Math.round(((maxOf - c.rank + 1) / maxOf) * 72));
            return (
              <span key={c.id} className="flex flex-col items-center gap-1" data-testid={`fr-leaderboard-rankcol-${c.id}`}>
                <span className={`text-[13px] font-extrabold tabular-nums ${c.active ? 'text-primary' : 'text-ink'}`}>{c.rank == null ? '—' : `#${c.rank}`}</span>
                <span className={`w-full rounded-t-[8px] rounded-b-[3px] fr-glide-h ${c.active ? 'bg-fr-accent' : 'bg-fr-ghost'}`} style={{ height: `${h}px` }} />
                <span className="text-[11px] font-bold text-ink-muted">{c.label}</span>
              </span>
            );
          })}
        </div>
        <span className="text-[12px] text-ink-muted">Taller is better.</span>
      </div>

      {share ? (
        <div className="flex flex-col gap-3 rounded-[16px] border border-border bg-card p-3.5" data-testid="fr-leaderboard-share">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[14px] font-bold text-ink">{scope === 'unit' ? `Your share of the unit's ${config.noun}` : `Your share of branch ${config.noun}`}</span>
            <span className="text-[13px] tabular-nums text-ink-muted">{config.format(share.mine)} of {config.format(share.total)}</span>
          </span>
          <Donut
            size={96}
            thickness={12}
            parts={[
              { key: 'you', label: 'You', value: share.mine },
              { key: 'rest', label: 'Everyone else', value: Math.max(0, share.total - share.mine) },
            ]}
            centerValue={share.pctLabel}
            format={config.format}
          />
        </div>
      ) : null}

      {onOpenTrophies ? (
        <button type="button" onClick={onOpenTrophies} className={`${FOCUS} min-h-[44px] rounded-xl border border-border bg-card px-4 text-[14px] font-bold text-ink hover:bg-fr-sunk`}>
          Awards you can win from here
        </button>
      ) : null}
    </aside>
  );
}

function StatusBlock({ status, errorCode, onRetry, periodWord, config }) {
  if (status === 'loading') {
    return (
      <section aria-label="Loading rankings" aria-busy="true" className={`${CARD} flex flex-col gap-3 p-5`} data-testid="fr-leaderboard-loading">
        <span className="text-[14px] text-ink-muted">Loading rankings…</span>
        {[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-10 rounded-[10px] bg-fr-sunk motion-safe:animate-pulse" />)}
      </section>
    );
  }
  if (status === 'error') {
    return (
      <section role="alert" className="flex flex-wrap items-center gap-3.5 rounded-[20px] border border-fr-warm bg-fr-warm-tint p-5" data-testid="fr-leaderboard-error">
        <AlertCircle size={22} aria-hidden="true" className="flex-none text-fr-warm" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="text-[15px] text-ink">Couldn&apos;t load the leaderboard</strong>
          <span className="text-[13px] text-ink-muted">
            {errorCode === 'permission-denied'
              ? "You don't have access to this branch's rankings."
              : 'Try again in a moment — the leaderboard refreshes hourly.'}
          </span>
        </span>
        <button type="button" onClick={onRetry} className={`${FOCUS} min-h-[44px] rounded-xl bg-fr-accent px-[18px] text-[14px] font-bold text-fr-on-accent`}>
          Retry
        </button>
      </section>
    );
  }
  return (
    <section className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-border bg-card px-5 py-10 text-center" data-testid="fr-leaderboard-empty">
      <BarChart3 size={28} aria-hidden="true" className="text-ink-muted" />
      <strong className="text-[16px] text-ink">{config.emptyTitle(periodWord)}</strong>
      <span className="max-w-md text-[13px] text-ink-muted">{config.emptyLine}</span>
    </section>
  );
}

export default function FrLeaderboardView(props) {
  const {
    layout, status, errorCode, onRetry, boards, board, onBoard, boardConfig: config,
    periods, period, onPeriod, scopeControl, scopeLine, title, periodWord,
    champions, podium, rows, viewerUid, you, toPass, rankCols, share, scope = 'branch', updated, mobileYouBar, onOpenTrophies,
    branchWide = false,
  } = props;
  if (!['desktop', 'tablet', 'phone'].includes(layout)) throw new Error(`FrLeaderboardView: unknown layout "${layout}"`);
  if (!['loading', 'error', 'empty', 'ready'].includes(status)) throw new Error(`FrLeaderboardView: unknown status "${status}"`);
  if (!config) throw new Error('FrLeaderboardView: boardConfig is required');
  const phone = layout === 'phone';
  const ready = status === 'ready';

  const header = (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2" data-testid="fr-leaderboard-header">
      <h1 className="font-display text-[20px] font-bold text-ink">Leaderboard</h1>
      <BoardRadios boards={boards} board={board} onBoard={onBoard} phone={phone} />
      <PeriodRadios periods={periods} period={period} onPeriod={onPeriod} />
      {scopeControl}
      <span className="min-w-0 text-[13px] text-ink-muted" data-testid="fr-leaderboard-scope-line">{scopeLine}</span>
    </div>
  );
  // D11: the board's footer, then the shared tail, then when it was updated.
  const footer = ready ? (
    <p className="text-[12px] text-ink-muted" data-testid="fr-leaderboard-footer">
      {`${config.footer} ${config.footerTail}`}
      {updated ? ` Updated ${updated}.` : ''}
    </p>
  ) : null;
  const youBlock = (asCard) => (
    <YouBlock you={you} toPass={toPass} rankCols={rankCols} share={share} period={period} asCard={asCard} onOpenTrophies={onOpenTrophies} branchWide={branchWide} config={config} scope={scope} />
  );
  const statusBlock = <StatusBlock status={status} errorCode={errorCode} onRetry={onRetry} periodWord={periodWord} config={config} />;
  const podiumBlock = <Podium podium={podium} viewerUid={viewerUid} period={period} title={title} config={config} />;

  if (phone) {
    return (
      <div className="flex min-w-0 flex-col gap-4 pb-24" data-testid="fr-leaderboard" data-layout="phone" data-board={board}>
        {header}
        {ready ? youBlock(true) : null}
        {ready ? podiumBlock : statusBlock}
        {ready ? <EveryoneElse rows={rows} phone config={config} /> : null}
        {footer}
        {status === 'error' ? null : <Champions champions={champions} compact />}
        {ready ? mobileYouBar : null}
      </div>
    );
  }

  const boardColumn = (
    <div className="@container/board flex min-w-0 flex-1 flex-col gap-[18px]">
      {status === 'error' ? null : <Champions champions={champions} />}
      {layout === 'tablet' && ready ? youBlock(true) : null}
      {ready ? podiumBlock : statusBlock}
      {ready ? <EveryoneElse rows={rows} config={config} /> : null}
      {footer}
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="fr-leaderboard" data-layout={layout} data-board={board}>
      {header}
      {layout === 'desktop' ? (
        <div className="flex min-w-0 items-start gap-5">
          {boardColumn}
          {ready ? <div className="sticky top-4 w-[340px] flex-none">{youBlock(false)}</div> : null}
        </div>
      ) : boardColumn}
    </div>
  );
}

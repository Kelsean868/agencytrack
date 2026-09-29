import React, { useEffect, useRef, useState } from 'react';
import Trophy from '../trophies/Trophy';
import { Bullet, ChartCard, Donut, MeterList } from '../charts';
import { CARD, EYEBROW, FOCUS, SKELETON } from '../money/moneyParts';

/**
 * FrTrophyRoomView — FR "Trophy room" (FR-5). PURE: props only (plus which
 * trophy is selected, a view concern).
 *
 * Glanceable first row (R2-5): FR-kit ChartCards — your level (Donut: points
 * toward the next), earned vs locked (Donut), award progress (MeterList). Then
 * your report streak and what is closest to unlocking. Then the shelves — the engine's
 * badges and the five levels — and a detail panel that says how each one is
 * earned. Everything shown is what the points engine recorded
 * (competeModel.trophyRoom); nothing here earns or awards anything.
 *
 * @param {{ room: object|null, loading?: boolean, error?: boolean, onRetry?: () => void }} props
 */
const n = (v) => Number(v).toLocaleString('en-TT');

/** Level Donut parts: points into this level and what is left to the next one. */
function levelParts(room) {
  if (!room.next) return [{ key: 'in', label: 'Points', value: room.points }];
  return [
    { key: 'in', label: 'This level', value: Math.max(0, room.points - room.level.threshold) },
    { key: 'left', label: `To ${room.next.title}`, value: room.toNext },
  ];
}

function LevelCard({ room }) {
  const parts = levelParts(room);
  const table = {
    caption: room.next ? 'Points toward your next level' : 'Your points at the top level',
    columns: [{ key: 'label', label: 'Part' }, { key: 'value', label: 'Points', format: n }],
    rows: parts.map((p) => ({ key: p.key, label: p.label, value: p.value })),
  };
  return (
    <div className="min-w-0" data-testid="trophy-level">
      <ChartCard title={`Your level: ${room.level.title}`} subtitle={room.next ? 'Points toward the next level' : 'Your points at the top level'} table={table}>
        <Donut parts={parts} size={132} thickness={16} centerValue={room.level.title} centerLabel={`${n(room.points)} pts`} format={n} />
        <p className="mt-3 text-[12px] text-ink-muted" data-testid="trophy-level-next">
          {room.next ? `${n(room.toNext)} points to ${room.next.title}.` : 'You are at the top level.'}
        </p>
      </ChartCard>
    </div>
  );
}

/** Earned vs still locked, by shelf (badges, levels, awards). At most four parts. */
function earnedParts(room) {
  const earnedOf = (list) => list.filter((t) => t.earned).length;
  const parts = [
    { key: 'badges', label: 'Badges', value: earnedOf(room.badges) },
    { key: 'levels', label: 'Levels', value: earnedOf(room.levels) },
  ];
  if (room.awards?.length) parts.push({ key: 'awards', label: 'Awards', value: earnedOf(room.awards) });
  parts.push({ key: 'locked', label: 'Locked', value: room.total - room.earnedCount });
  return parts;
}

function EarnedCard({ room }) {
  const parts = earnedParts(room);
  const table = {
    caption: 'Trophies earned and still locked',
    columns: [{ key: 'label', label: 'Group' }, { key: 'value', label: 'Count', format: n }],
    rows: parts.map((p) => ({ key: p.key, label: p.label, value: p.value })),
  };
  return (
    <div className="min-w-0" data-testid="trophy-earned">
      <ChartCard title={`${room.earnedCount} of ${room.total} earned`} subtitle="Earned badges, levels and qualified awards against what is still locked" table={table}>
        <Donut parts={parts} size={132} thickness={16} centerValue={room.earnedCount} centerLabel={`of ${room.total}`} format={n} />
      </ChartCard>
    </div>
  );
}

/** Progress toward each award's first requirement, as a percentage (qualified = 100%). */
function AwardProgressCard({ room, awardsState, onRetryAwards }) {
  const items = (room.awards ?? []).filter((a) => a.earned || a.progress != null);
  const qualified = (room.awards ?? []).filter((a) => a.earned).length;
  const pctOf = (a) => (a.earned ? 100 : a.progress);
  const table = {
    caption: 'Award progress',
    columns: [
      { key: 'label', label: 'Award' },
      { key: 'progress', label: 'Progress', format: (v) => `${v}%` },
      { key: 'status', label: 'Status' },
    ],
    rows: items.map((a) => ({ key: a.key, label: a.label, progress: pctOf(a), status: a.earned ? 'Qualified' : 'In progress' })),
  };
  let body;
  if (awardsState === 'error') {
    body = (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p className="text-[13px] text-ink">Your award progress did not load.</p>
        {onRetryAwards ? (
          <button type="button" onClick={onRetryAwards} className={`${FOCUS} inline-flex min-h-[44px] items-center rounded-lg border border-border px-4 text-[14px] font-semibold text-ink`}>Retry</button>
        ) : null}
      </div>
    );
  } else if (awardsState === 'loading') {
    body = <div aria-busy="true" className={`h-24 ${SKELETON}`} />;
  } else if (!items.length) {
    body = <p className="text-[13px] text-ink-muted">No award has measured progress for you right now.</p>;
  } else {
    body = <MeterList items={items.map((a) => ({ key: a.key, label: a.label, value: pctOf(a), target: 100, format: (v) => `${v}%` }))} />;
  }
  const ready = awardsState === 'ready';
  return (
    <div className="min-w-0" data-testid="trophy-award-progress">
      <ChartCard
        title={ready && (room.awards ?? []).length ? `${qualified} of ${room.awards.length} awards qualified` : 'Award progress'}
        subtitle="Progress toward each award. Decided when the period closes."
        table={ready && items.length ? table : undefined}
      >
        {body}
      </ChartCard>
    </div>
  );
}

function StreakCard({ room }) {
  return (
    <section className={`${CARD} flex min-w-0 items-center gap-4 p-4`} aria-label="Report streak" data-testid="trophy-streak">
      <Trophy kind="streak" size={64} locked={!room.streak} />
      <div className="min-w-0">
        <p className={EYEBROW}>Report streak</p>
        <p className="font-display text-[22px] font-bold leading-tight tabular-nums text-ink">
          {room.streak == null ? '—' : `${room.streak} ${room.streak === 1 ? 'week' : 'weeks'}`}
        </p>
        <p className="text-[12px] text-ink-muted">
          {room.streak == null
            ? 'Starts with your first weekly report.'
            : room.nextStreak
              ? `Weeks in a row with a report · next badge at ${room.nextStreak}`
              : 'Weeks in a row with a report · every streak badge earned'}
        </p>
      </div>
    </section>
  );
}

function Closest({ items, onSelect }) {
  return (
    <section className={`${CARD} flex min-w-0 flex-col gap-3 p-4`} aria-label="Closest to unlocking" data-testid="trophy-closest">
      <p className={EYEBROW}>Closest to unlocking</p>
      {items.length ? (
        <ul className="flex flex-col gap-3">
          {items.map((t) => (
            <li key={t.key}>
              <button type="button" onClick={() => onSelect(t.key)} className={`${FOCUS} block min-h-[44px] w-full rounded-lg text-left`}>
                <Bullet value={t.progress} max={100} label={t.label} valueText={`${t.progress}%`} tone="gold" height={8} />
                {t.left ? <span className="mt-1 block text-[12px] text-ink-muted">{t.left}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-muted">Nothing measured yet — streak and level progress show here once you report.</p>
      )}
    </section>
  );
}

function Shelf({ title, note, items, selected, onSelect }) {
  const earned = items.filter((t) => t.earned).length;
  return (
    <section className={`${CARD} flex min-w-0 flex-col gap-3 p-4`} aria-label={title} data-testid={`trophy-shelf-${title.toLowerCase()}`}>
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-[18px] font-bold text-ink">{title}</h3>
        <span className="flex-none text-[12px] tabular-nums text-ink-muted">{earned} of {items.length}</span>
      </header>
      {note ? <p className="-mt-2 text-[12px] text-ink-muted">{note}</p> : null}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {items.map((t) => (
          <li key={t.key} className="min-w-0">
            <button
              type="button"
              aria-pressed={selected === t.key}
              onClick={() => onSelect(t.key)}
              data-testid={`trophy-${t.key}`}
              className={`${FOCUS} flex w-full min-w-0 flex-col items-center gap-1 rounded-xl p-2 transition-colors ${selected === t.key ? 'bg-fr-sunk' : 'hover:bg-fr-sunk'}`}
            >
              <Trophy kind={t.kind} size={64} locked={!t.earned} progress={t.progress} />
              <span className="w-full truncate text-center text-[12px] font-semibold text-ink" title={t.label}>{t.label}</span>
              <span className="text-center text-[11px] leading-snug text-ink-muted">{t.earned ? (t.earnedText ?? 'Earned') : t.progress != null ? `${t.progress}% there` : 'Locked'}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Awards group while the policy ledger loads, or when it failed (FR-5b D6). */
function AwardsPending({ state, onRetry }) {
  return (
    <section className={`${CARD} flex min-w-0 flex-col gap-3 p-4`} aria-label="Awards" data-testid="trophy-shelf-awards">
      <h3 className="font-display text-[18px] font-bold text-ink">Awards</h3>
      {state === 'error' ? (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="text-[13px] text-ink">Your award progress did not load.</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className={`${FOCUS} inline-flex min-h-[44px] items-center rounded-lg border border-border px-4 text-[14px] font-semibold text-ink`}>Retry</button>
          ) : null}
        </div>
      ) : (
        <div aria-busy="true" className={`h-24 ${SKELETON}`} />
      )}
    </section>
  );
}

const Detail = React.forwardRef(function Detail({ item }, ref) {
  if (!item) return null;
  return (
    <aside ref={ref} className={`${CARD} flex min-w-0 flex-col items-center gap-3 p-5 text-center lg:sticky lg:top-4`} aria-label="Trophy detail" data-testid="trophy-detail">
      <Trophy kind={item.kind} size={112} locked={!item.earned} progress={item.progress} />
      <div>
        <p className={EYEBROW}>{item.group}</p>
        <h3 className="font-display text-[22px] font-bold leading-tight text-ink">{item.label}</h3>
        <p className="mt-1 text-[13px] font-semibold text-ink-muted">
          {item.earned ? (item.earnedText ?? 'Earned') : item.progress != null ? `Locked · ${item.progress}% there` : 'Locked'}
        </p>
        {!item.earned && item.left ? <p className="text-[12px] text-ink-muted">{item.left}</p> : null}
      </div>
      <div className="w-full rounded-lg bg-fr-sunk p-3 text-left">
        <p className={EYEBROW}>How you earn it</p>
        <p className="mt-1 text-[14px] text-ink">{item.how}</p>
      </div>
    </aside>
  );
});

/**
 * @param {{
 *   room: object|null, loading?: boolean, error?: boolean, onRetry?: () => void,
 *   awardsState?: 'ready'|'loading'|'error', onRetryAwards?: () => void,
 * }} props  awardsState: the award group's own state (the policy ledger read),
 *   separate from the badges/levels doc (FR-5b D6).
 */
export default function FrTrophyRoomView({ room, loading = false, error = false, onRetry, awardsState = 'ready', onRetryAwards }) {
  const [selected, setSelected] = useState(null);
  const detailRef = useRef(null);
  // Phone / tablet: the detail sits below the shelves, so a tap would change
  // something off-screen. Bring it into view on an actual selection (never on
  // first render); on desktop it is the sticky column beside the shelves.
  useEffect(() => {
    if (selected == null || typeof window === 'undefined' || !window.matchMedia) return;
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    detailRef.current?.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [selected]);

  if (error) {
    return (
      <div role="alert" className={`${CARD} flex flex-col items-start gap-3 p-5`} data-testid="fr-trophies">
        <p className="text-[14px] text-ink">Your trophies did not load.</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className={`${FOCUS} inline-flex min-h-[44px] items-center rounded-lg border border-border px-4 text-[14px] font-semibold text-ink`}>Retry</button>
        ) : null}
      </div>
    );
  }
  if (loading || !room) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" data-testid="fr-trophies">
        <div className="grid gap-3 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className={`h-28 ${SKELETON}`} />)}</div>
        <div className={`h-64 ${SKELETON}`} />
      </div>
    );
  }

  const all = [...room.badges, ...room.levels, ...(room.awards ?? [])];
  const current = all.find((t) => t.key === selected) ?? room.closest[0] ?? room.badges.find((t) => t.earned) ?? room.badges[0];

  return (
    <div className="flex flex-col gap-4 lg:gap-5" data-testid="fr-trophies">
      <header>
        <p className={EYEBROW}>Compete · Trophy room</p>
        <h2 className="font-display text-[28px] font-bold leading-tight text-ink lg:text-[32px]">Trophy room</h2>
        <p className="mt-1 text-[13px] text-ink-muted" data-testid="trophy-count">{room.earnedCount} of {room.total} earned</p>
      </header>
      <div className="grid gap-3 lg:grid-cols-3 lg:items-start" data-testid="trophy-hero">
        <LevelCard room={room} />
        <EarnedCard room={room} />
        <AwardProgressCard room={room} awardsState={awardsState} onRetryAwards={onRetryAwards} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <StreakCard room={room} />
        <Closest items={room.closest} onSelect={setSelected} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Shelf title="Badges" note="From your weekly reports." items={room.badges} selected={current?.key} onSelect={setSelected} />
          <Shelf title="Levels" note="Points build up over time toward levels." items={room.levels} selected={current?.key} onSelect={setSelected} />
          {awardsState !== 'ready' ? (
            <AwardsPending state={awardsState} onRetry={onRetryAwards} />
          ) : room.awards?.length ? (
            <Shelf title="Awards" note="Qualification for the current period — awards are decided when the period closes." items={room.awards} selected={current?.key} onSelect={setSelected} />
          ) : null}
          {room.other.length ? (
            <p className="text-[13px] text-ink-muted" data-testid="trophy-other">Also earned: {room.other.map((o) => o.label).join(', ')}</p>
          ) : null}
        </div>
        <Detail ref={detailRef} item={current} />
      </div>
      <p className="text-[12px] text-ink-muted">
        Badges, points and levels are the ones the app already awards from your weekly reports. Awards use the same figures as the Awards screen, where each one is shown in full.
      </p>
    </div>
  );
}

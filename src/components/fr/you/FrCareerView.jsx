import React from 'react';
import { Check, Pencil, Lock, AlertCircle } from 'lucide-react';
import { Columns, Donut } from '../charts';
import { formatCurrency } from '../../../utils/formatters';

/**
 * FrCareerView — the FR Career screen (R2-10, canvas D3-Career / M3-Career).
 * PURE: props only. The container (FrCareer) computes everything with the
 * Nexus portal's own logic (src/lib/career/careerModel.js via
 * src/lib/fr/careerViewModel.js) and the shared useCareerCommitment hook.
 *
 * Layout (ONE is rendered, chosen by `layout`):
 *   desktop  main column + a 340px "Selected level" inspector; the ladder is
 *            horizontal and each coin is aria-pressed.
 *   tablet   one column; the selected level's panel sits under the ladder.
 *   phone    the ladder is vertical; each coin is aria-expanded and the
 *            selected level opens inline under it.
 */

const CARD = 'rounded-[20px] border border-border bg-card';
const H2 = 'font-display text-[17px] font-bold leading-snug text-ink';
const EYEBROW = 'font-mono text-[11px] font-semibold uppercase tracking-[0.1em]';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const BTN_QUIET = `${FOCUS} inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 text-[13px] font-bold text-ink hover:bg-fr-sunk disabled:opacity-60`;
const BTN_PRIMARY = `${FOCUS} inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-fr-accent px-4 text-[13px] font-bold text-fr-on-accent hover:opacity-90 disabled:opacity-60`;

function Coin({ coin, selected, onSelect, phone, controls }) {
  const face = coin.state === 'achieved'
    ? 'bg-fr-accent text-fr-on-accent'
    : coin.state === 'current'
      ? 'bg-fr-gold-tint text-gold-ink ring-2 ring-gold'
      : 'bg-fr-sunk text-ink-muted';
  const a11y = phone ? { 'aria-expanded': selected, 'aria-controls': controls } : { 'aria-pressed': selected };
  return (
    <button
      type="button"
      onClick={() => onSelect(coin.level)}
      aria-label={`Level ${coin.level} — ${coin.title}, ${coin.sub}`}
      className={`${FOCUS} flex min-h-[44px] items-center gap-3 rounded-2xl p-1.5 text-left ${phone ? 'w-full' : 'flex-col text-center'} ${selected ? 'bg-fr-accent-tint' : 'hover:bg-fr-sunk'}`}
      data-testid={`fr-career-coin-${coin.level}`}
      data-state={coin.state}
      {...a11y}
    >
      <span className={`flex h-12 w-12 flex-none items-center justify-center rounded-full font-display text-[18px] font-extrabold ${face}`}>
        {coin.state === 'achieved' ? <Check size={22} aria-hidden="true" /> : coin.state === 'locked' ? <span className="flex items-center gap-0.5">{coin.level}<Lock size={11} aria-hidden="true" /></span> : coin.level}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-bold text-ink" title={coin.title}>{coin.title}</span>
        <span className={`text-[11.5px] tabular-nums ${coin.state === 'current' ? 'font-bold text-gold-ink' : 'text-ink-muted'}`}>{coin.sub}</span>
      </span>
    </button>
  );
}

function LevelPanelBody({ panel }) {
  return (
    <div className="flex flex-col gap-3" data-testid={`fr-career-panel-${panel.level}`}>
      <span className={`${EYEBROW} text-gold-ink`}>{panel.kicker}</span>
      <h2 className="font-display text-[22px] font-extrabold leading-tight text-ink">Level {panel.level} · {panel.title}</h2>
      <p className="text-[13px] text-ink-muted">{panel.tagline}</p>
      <span className="text-[12px] font-bold text-ink-muted">What it takes · {panel.toClear}</span>
      <ul className="flex flex-col gap-2.5">
        {panel.criteria.map((c) => (
          <li key={c.key} className="flex flex-col gap-1" data-testid={`fr-career-criterion-${c.key}`}>
            <span className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                {c.cleared ? <Check size={14} aria-hidden="true" className="text-primary" /> : <AlertCircle size={14} aria-hidden="true" className="text-fr-warm" />}
                {c.label}
              </span>
              <span className="whitespace-nowrap text-[12.5px] tabular-nums text-ink-muted">{c.value} / {c.target}</span>
            </span>
            <span className="block h-2 overflow-hidden rounded-full bg-fr-sunk">
              <span className={`block h-full rounded-full fr-glide-w ${c.cleared ? 'bg-fr-accent' : 'bg-fr-warm'}`} style={{ width: `${c.pct}%` }} />
            </span>
          </li>
        ))}
      </ul>
      {panel.unlocks.length ? (
        <>
          <span className={`${EYEBROW} mt-1 text-gold-ink`}>What you unlock</span>
          <ul className="flex flex-col gap-2">
            {panel.unlocks.map((u) => (
              <li key={u.label} className="flex flex-col rounded-[12px] bg-fr-gold-tint px-3 py-2">
                <span className="text-[13px] font-bold text-ink">{u.label}</span>
                <span className="text-[12px] text-ink-muted">{u.detail}</span>
              </li>
            ))}
          </ul>
        </>
      ) : <span className="text-[12.5px] text-ink-muted">Where everyone starts.</span>}
    </div>
  );
}

function Ladder({ coins, selected, onSelect, layout, panel, current }) {
  const phone = layout === 'phone';
  return (
    <section aria-labelledby="fr-career-ladder-h" className={`${CARD} @container flex min-w-0 flex-col gap-4 p-4 sm:p-5`} data-testid="fr-career-ladder">
      <div>
        <h2 id="fr-career-ladder-h" className={H2}>Your career ladder</h2>
        <p className="text-[12px] text-ink-muted">{current} of 7 levels · tap a level to see what it takes</p>
      </div>
      {phone ? (
        <ol className="flex flex-col gap-1">
          {coins.map((coin) => (
            <li key={coin.level} className="flex flex-col">
              <Coin coin={coin} selected={selected === coin.level} onSelect={onSelect} phone controls={`fr-career-inline-${coin.level}`} />
              {selected === coin.level ? (
                <div id={`fr-career-inline-${coin.level}`} className="mb-2 ml-3 border-l-2 border-border pl-4 pt-2">
                  <LevelPanelBody panel={panel} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        // fr-fit-any-width: seven across needs ~46rem of card; narrower (beside
        // the sidebar) the ladder runs 4 + 3, still in order, never cut.
        <ol className="grid grid-cols-4 gap-1 @[46rem]:grid-cols-7">
          {coins.map((coin) => (
            <li key={coin.level} className="min-w-0">
              <Coin coin={coin} selected={selected === coin.level} onSelect={onSelect} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Ring({ ring }) {
  const r = 42;
  const len = 2 * Math.PI * r;
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center" data-testid={`fr-career-ring-${ring.key}`} data-cleared={ring.cleared ? 'true' : 'false'}>
      <svg width="96" height="96" viewBox="0 0 104 104" role="img" aria-label={`${ring.label}: ${ring.pct}% — ${ring.value} of ${ring.target}, ${ring.cleared ? 'cleared' : 'to go'}`}>
        <circle cx="52" cy="52" r={r} fill="none" className="stroke-fr-sunk" strokeWidth="10" />
        <circle
          cx="52" cy="52" r={r} fill="none" strokeWidth="10" strokeLinecap="round" transform="rotate(-90 52 52)"
          className={`${ring.cleared ? 'stroke-fr-accent' : 'stroke-fr-warm'} transition-[stroke-dasharray] duration-[480ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none`}
          style={{ strokeDasharray: `${(ring.pct / 100) * len} ${len}` }}
        />
        <text x="52" y="50" textAnchor="middle" className="fill-ink font-display text-[19px] font-extrabold">{ring.pct}%</text>
        <text x="52" y="68" textAnchor="middle" className="fill-ink-muted text-[11px] font-semibold">{ring.cleared ? 'cleared' : 'to go'}</text>
      </svg>
      <span className="text-[13px] font-bold text-ink">{ring.label}</span>
      <span className="whitespace-nowrap text-[12px] tabular-nums text-ink-muted">{ring.value} of {ring.target}</span>
    </div>
  );
}

function NextLevel({ next }) {
  if (next.top) {
    return (
      <section aria-label="Next level" className={`${CARD} flex flex-col gap-1 p-5`} data-testid="fr-career-next">
        <span className={`${EYEBROW} text-gold-ink`}>Level 7 · Legend</span>
        <h2 className={H2}>Top level reached</h2>
      </section>
    );
  }
  return (
    <section aria-label="Next level" className={`${CARD} flex min-w-0 flex-col gap-3 p-4 sm:p-5`} data-testid="fr-career-next">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className={`${EYEBROW} text-gold-ink`}>Next · Level {next.level}</span>
        <h2 className={H2}>{next.title}</h2>
        <span className="text-[12px] tabular-nums text-ink-muted" data-testid="fr-career-cleared">{next.cleared} of {next.rings.length} cleared</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {next.rings.map((ring) => <Ring key={ring.key} ring={ring} />)}
      </div>
    </section>
  );
}

function PaceCard({ pace, gap, onPlan }) {
  if (pace.top) return null;
  return (
    <section aria-label="When you get there" className={`${CARD} flex min-w-0 flex-col gap-2 p-4 sm:p-5`} data-testid="fr-career-pace">
      <span className="text-[12px] font-bold text-ink-muted">At your pace</span>
      {pace.estimate ? (
        <>
          <span className="font-display text-[26px] font-extrabold leading-tight text-ink" data-testid="fr-career-estimate">{pace.estimate}</span>
          <span className="text-[12.5px] leading-snug text-ink-muted">{pace.basis}</span>
        </>
      ) : (
        <span className="text-[13px] text-ink-muted" data-testid="fr-career-estimate">{pace.basis}</span>
      )}
      {gap ? (
        <div className="mt-1 flex flex-col gap-1 border-t border-border pt-2.5" data-testid="fr-career-gap">
          <span className="text-[12px] font-bold text-ink-muted">Biggest gap</span>
          <span className="text-[13px] leading-snug text-ink"><strong>{gap.label}.</strong> {gap.text}</span>
        </div>
      ) : null}
      <button type="button" onClick={onPlan} className={`${BTN_PRIMARY} mt-1`}>Plan it in the Game plan</button>
    </section>
  );
}

function Trajectory({ series }) {
  const data = series.map((q, i) => ({
    key: q.key ?? `pad-${i}`,
    label: q.key ? `Q${Number(q.key.slice(-1)) + 1} ’${q.key.slice(2, 4)}` : '—',
    value: q.value,
    highlight: i === series.length - 1,
  }));
  const any = series.some((q) => q.value > 0);
  return (
    <section aria-labelledby="fr-career-traj-h" className={`${CARD} flex min-w-0 flex-col gap-3 p-4 sm:p-5`} data-testid="fr-career-trajectory">
      <div>
        <h2 id="fr-career-traj-h" className={H2}>Trajectory</h2>
        <p className="text-[12px] text-ink-muted">Quarterly API · last 8 quarters · TTD thousands</p>
      </div>
      {any ? (
        <>
          <Columns data={data} height={120} format={(v) => `${v}k`} />
          <p className="sr-only" data-testid="fr-career-trajectory-text">
            {data.map((d) => `${d.label}: TTD ${d.value} thousand`).join('; ')}
          </p>
        </>
      ) : (
        <p className="py-4 text-[13px] text-ink-muted">Submit weekly reports to see your trajectory.</p>
      )}
    </section>
  );
}

function CommitRow({ row }) {
  const max = Math.max(row.actual ?? 0, row.mine ?? 0, row.manager ?? 0, row.floor ?? 0, 1) * 1.08;
  const at = (v) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="flex flex-col gap-1.5" data-testid={`fr-career-commit-${row.key}`}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-bold text-ink">{row.label}</span>
        <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-ink">{row.mine ? row.fmt(row.mine) : 'Not set'}</span>
      </span>
      <span role="img" aria-label={row.aria} className="relative block h-3 rounded-full bg-fr-sunk">
        <span className="absolute inset-y-0 left-0 block rounded-full bg-fr-accent fr-glide-w" style={{ width: at(row.actual ?? 0) }} />
        {row.floor ? <span className="absolute -top-1 block h-5 w-0.5 bg-ink-muted" style={{ left: at(row.floor) }} /> : null}
        {row.manager ? <span className="absolute -top-1.5 block h-6 w-0.5 bg-gold" style={{ left: at(row.manager) }} /> : null}
        {row.mine ? <span className="absolute -top-1.5 block h-6 w-1 rounded bg-ink" style={{ left: at(row.mine) }} /> : null}
      </span>
      <span className="text-[12px] tabular-nums text-ink-muted">
        {row.fmt(row.actual ?? 0)} now · floor {row.fmt(row.floor ?? 0)}{row.manager ? ` · manager target ${row.fmt(row.manager)}` : ''}
      </span>
      {row.belowFloor ? <span className="text-[12px] font-semibold text-fr-warm">Your commitment is below the company floor.</span> : null}
    </div>
  );
}

function Commitment({ commitment }) {
  const c = commitment;
  return (
    <section aria-labelledby="fr-career-commit-h" className={`${CARD} flex min-w-0 flex-col gap-3 p-4 sm:p-5`} data-testid="fr-career-commitment">
      <div>
        <h2 id="fr-career-commit-h" className={H2}>Your annual commitment</h2>
        <p className="text-[12px] text-ink-muted">{c.year} · this year so far against your commitment, your manager&apos;s target and the company floor</p>
      </div>
      {!c.loaded ? (
        <div className="flex flex-col gap-3" aria-busy="true" data-testid="fr-career-commit-loading">
          {[0, 1, 2].map((i) => <span key={i} className="h-10 rounded-[10px] bg-fr-sunk motion-safe:animate-pulse" />)}
        </div>
      ) : c.loadFailed ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[14px] bg-fr-warm-tint p-3.5" data-testid="fr-career-commit-error">
          <span className="min-w-0 flex-1 text-[13px] text-ink">Couldn&apos;t load your goals.</span>
          <button type="button" onClick={c.retry} className={BTN_QUIET}>Retry</button>
        </div>
      ) : c.editing ? (
        <div className="flex flex-col gap-3" data-testid="fr-career-commit-form">
          {[
            { key: 'personalAnnualAPI', label: 'Annual API (TTD)', step: 1000 },
            { key: 'personalAnnualApps', label: 'Annual Applications', step: 1 },
            { key: 'personalAnnualPersistency', label: 'Persistency %', step: 1 },
          ].map((f) => (
            <label key={f.key} htmlFor={`fr-cp-${f.key}`} className="flex flex-col gap-1 text-[12.5px] font-bold text-ink">
              {f.label}
              <input
                id={`fr-cp-${f.key}`}
                type="number"
                min={0}
                step={f.step}
                value={c.draft[f.key]}
                onChange={(e) => c.setDraft((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="h-11 rounded-[10px] border border-border bg-card px-2.5 text-[14px] font-semibold tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          ))}
          {c.saveError ? <p role="alert" className="rounded-[12px] bg-fr-warm-tint px-3 py-2 text-[12px] text-ink">{c.saveError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { c.setEditing(false); c.setSaveError(''); }} className={BTN_QUIET} aria-label="Cancel editing goals">Cancel</button>
            <button type="button" onClick={c.handleSave} disabled={c.saving} className={BTN_PRIMARY}>{c.saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-muted" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-full bg-fr-accent" />this year so far</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-1 rounded bg-ink" />your commitment</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-0.5 bg-gold" />manager target</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-0.5 bg-ink-muted" />company floor</span>
          </p>
          {c.rows.map((row) => <CommitRow key={row.key} row={row} />)}
        </div>
      )}
      {c.showNudge && c.pendingDraft ? (
        <div role="alert" className="flex flex-col gap-2 rounded-[14px] bg-fr-warm-tint p-3.5" data-testid="fr-career-nudge">
          <p className="text-[13px] font-bold text-ink">Commitment below Money Needs</p>
          <p className="text-[12.5px] leading-snug text-ink">
            Your commitment ({formatCurrency(parseFloat(c.pendingDraft.personalAnnualAPI) || 0)}) is below
            your Money Needs requirement ({formatCurrency(c.moneyNeedsRequired)}). Save anyway?
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { c.setShowNudge(false); c.doSave(c.pendingDraft); c.setPendingDraft(null); }} disabled={c.saving} className={BTN_PRIMARY}>Yes, continue</button>
            <button type="button" onClick={() => { c.setShowNudge(false); c.setPendingDraft(null); }} className={BTN_QUIET}>Cancel</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TrophiesCard({ trophies, onOpenTrophies }) {
  return (
    <section aria-label="Badges and trophies" className={`${CARD} flex min-w-0 flex-col items-start gap-4 p-4 sm:p-5 md:flex-row md:items-center`} data-testid="fr-career-trophies">
      {trophies.loading ? (
        <span className="h-[72px] w-[72px] rounded-full bg-fr-sunk motion-safe:animate-pulse" aria-busy="true" />
      ) : trophies.error ? (
        <span className="flex items-center gap-2 text-[13px] text-ink">
          Couldn&apos;t load your trophies.
          <button type="button" onClick={trophies.onRetry} className={BTN_QUIET}>Retry</button>
        </span>
      ) : (
        <Donut
          size={72}
          thickness={9}
          parts={[
            { key: 'earned', label: 'Earned', value: trophies.earned },
            { key: 'left', label: 'Still to earn', value: Math.max(0, trophies.total - trophies.earned) },
          ]}
          centerValue={`${trophies.earned}/${trophies.total}`}
        />
      )}
      <span className="flex w-full min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-bold text-ink">Badges and trophies live in the Trophy room</span>
        <span className="text-[12.5px] text-ink-muted">One place for badges, levels and awards — the same rules the points engine uses.</span>
      </span>
      <button type="button" onClick={onOpenTrophies} className={BTN_QUIET}>Open the Trophy room</button>
    </section>
  );
}

export default function FrCareerView({
  layout, header, coins, selected, onSelect, panel, next, pace, gap, onPlan, series, commitment, trophies, onOpenTrophies,
}) {
  if (!['desktop', 'tablet', 'phone'].includes(layout)) throw new Error(`FrCareerView: unknown layout "${layout}"`);
  const phone = layout === 'phone';
  const head = (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2" data-testid="fr-career-header">
      <h1 className="font-display text-[20px] font-bold text-ink">Career</h1>
      <span className="min-w-0 text-[13px] text-ink-muted">
        Level {header.level} · {header.title}{header.years != null ? ` · ${header.years.toFixed(1)} years of service` : ''}
      </span>
      <span className="flex-1" />
      <button
        type="button"
        onClick={() => commitment.setEditing(!commitment.editing)}
        disabled={!commitment.loaded || commitment.loadFailed}
        className={BTN_QUIET}
        aria-pressed={commitment.editing}
      >
        <Pencil size={14} aria-hidden="true" />
        {commitment.editing ? 'Stop editing' : 'Edit my goals'}
      </button>
    </div>
  );
  const ladder = <Ladder coins={coins} selected={selected} onSelect={onSelect} layout={layout} panel={panel} current={header.level} />;
  const body = (
    <>
      <div className={phone ? 'flex flex-col gap-4' : 'grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'}>
        <NextLevel next={next} />
        <PaceCard pace={pace} gap={gap} onPlan={onPlan} />
      </div>
      <div className={phone ? 'flex flex-col gap-4' : 'grid grid-cols-1 gap-4 xl:grid-cols-2'}>
        <Trajectory series={series} />
        <Commitment commitment={commitment} />
      </div>
      <TrophiesCard trophies={trophies} onOpenTrophies={onOpenTrophies} />
    </>
  );

  if (layout === 'desktop') {
    return (
      <div className="flex min-w-0 flex-col gap-4" data-testid="fr-career" data-layout="desktop">
        {head}
        <div className="flex min-w-0 items-start gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-4">{ladder}{body}</div>
          <aside aria-label="Selected level" className="sticky top-4 w-[340px] flex-none rounded-[20px] border border-border bg-fr-pane p-5" data-testid="fr-career-inspector">
            <LevelPanelBody panel={panel} />
          </aside>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="fr-career" data-layout={layout}>
      {head}
      {ladder}
      {layout === 'tablet' ? (
        <aside aria-label="Selected level" className={`${CARD} p-4`} data-testid="fr-career-inspector"><LevelPanelBody panel={panel} /></aside>
      ) : null}
      {body}
    </div>
  );
}


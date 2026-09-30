/* eslint-disable react-refresh/only-export-components -- DEV-only harness registry:
   scenes are exported as data (an array of { id, render }), not as components. */
import ScenePage from '../ScenePage';
import React from 'react';
import {
  ChartCard, Bullet, MeterList, Columns, GateBars, Line, Sparkline, Donut,
} from '../../charts';
import Trophy from '../../trophies/Trophy';
import { TROPHY_KINDS } from '../../trophies/trophyKinds';
import SwipePager from '../../pager/SwipePager';
import { formatCurrency, formatCompactTTD } from '../../../../utils/formatters';
import { formatPersistencyPct } from '../../../../lib/persistency/persistencyRounding';

/**
 * FR-0 harness scenes: tokens, chart kit (desktop + phone), trophies, pager.
 * SAMPLE data only — the 27-09-2026 figures used on the design canvas.
 */

const WEEKLY_MINIMUMS = [
  { label: 'Calls', target: 60 },
  { label: 'Contacts', target: 40 },
  { label: 'Appointments set', target: 20 },
  { label: 'Interviews kept', target: 15 },
  { label: 'Fact finds', target: 10 },
  { label: 'Closing interviews', target: 10 },
  { label: 'Applications', target: 1 },
];
const WEEK_A = [38, 22, 9, 7, 4, 3, 0];
const WEEK_B = [61, 35, 14, 11, 8, 6, 1];

const WEEKS = ['W29', 'W30', 'W31', 'W32', 'W33', 'W34', 'W35', 'W36', 'W37', 'W38', 'W39', 'W40'];
const API_A = [0, 12400, 0, 18300, 0, 9800, 0, 0, 22600, 0, 24046, 0];
const API_B = [0, 12400, 0, 18300, 0, 9800, 0, 0, 22600, 0, 24046, 36000];

const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
const PERS_A = [91.2, 90.8, 90.4, 89.9, 89.1, 88.7, 88.2, 87.9, 87.5, 87.1, 86.8, 86.6];
const PERS_B = [91.2, 90.8, 90.4, 89.9, 89.1, 88.7, 88.2, 87.9, 87.5, 87.1, 86.8, 90.1];

function Frame({ children, phone = false }) {
  return (
    <ScenePage as="div" className={phone ? 'mx-auto w-[390px] px-4 py-4' : 'mx-auto max-w-[1220px] px-8 py-8'}>
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">FR harness · SAMPLE data</p>
      {children}
    </ScenePage>
  );
}

function TokensScene() {
  const swatches = [
    ['bg-surface', 'Page'], ['bg-card', 'Card'], ['bg-fr-sunk', 'Sunk'], ['bg-fr-side', 'Sidebar'],
    ['bg-fr-accent', 'Accent'], ['bg-fr-accent-tint', 'Accent tint'], ['bg-fr-ghost', 'Waiting'],
    ['bg-fr-warm', 'Warm'], ['bg-fr-warm-tint', 'Warm tint'], ['bg-fr-gold', 'Gold'], ['bg-fr-gold-tint', 'Gold tint'],
  ];
  const series = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'];
  return (
    <Frame>
      <h1 className="mt-2 font-display text-[40px] font-bold leading-tight">Glanceable, calm, yours</h1>
      <p className="mt-2 max-w-xl text-[15px] text-ink-muted">
        Bricolage Grotesque for headings and big numbers, Onest for reading, JetBrains Mono for small labels.
      </p>
      <p className="mt-6 font-display text-[30px] font-bold tabular-nums">TTD 87,146</p>
      <p className="text-[13px] text-ink-muted">Settled API this year · 5 applications</p>
      <div className="mt-8 grid grid-cols-4 gap-3 md:grid-cols-6">
        {swatches.map(([cls, name]) => (
          <div key={cls} className="rounded-[14px] border border-border bg-card p-2">
            <div className={`h-12 rounded-[10px] border border-border ${cls}`} />
            <p className="mt-1.5 text-[12px] font-semibold">{name}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-2" aria-label="Chart series, fixed order">
        {series.map((cls, i) => (
          <div key={cls} className={`flex h-10 w-16 items-end rounded-[8px] p-1 ${cls}`}>
            <span className="rounded bg-card px-1 text-[11px] font-semibold">{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" className="min-h-[48px] rounded-[14px] bg-fr-accent px-5 font-semibold text-fr-on-accent">Start a call session</button>
        <button type="button" className="min-h-[48px] rounded-[14px] border border-border bg-card px-5 font-semibold">Adjust</button>
        <span className="inline-flex min-h-[32px] items-center rounded-full bg-fr-warm-tint px-3 text-[13px] font-semibold text-fr-warm">Persistency 86.6% · gate 90%</span>
        <span className="inline-flex min-h-[32px] items-center rounded-full bg-fr-gold-tint px-3 text-[13px] font-semibold text-fr-gold">Christmas campaign · Champion</span>
      </div>
    </Frame>
  );
}

function ChartGrid({ variant, phone = false }) {
  const b = variant === 'B';
  const week = b ? WEEK_B : WEEK_A;
  const api = b ? API_B : API_A;
  const pers = b ? PERS_B : PERS_A;
  const settled = b ? 123146 : 87146;
  const cumulative = api.reduce((acc, v) => [...acc, (acc.at(-1) || 0) + v], []);
  const pace = WEEKS.map((_, i) => Math.round((688800 / 52) * (i + 29)));
  const table = (rows) => ({
    columns: [{ key: 'label', label: 'Week' }, { key: 'value', label: 'API', align: 'right' }],
    rows,
  });
  return (
    <div className={phone ? 'mt-3 grid gap-4' : 'mt-4 grid grid-cols-2 gap-5'}>
      <ChartCard
        title={b ? 'TTD 123,146 in — 18% of MDRT' : 'TTD 87,146 settled — 13% of MDRT'}
        subtitle="Settled API this year vs the MDRT 2026 threshold, with submitted business waiting"
      >
        <Bullet
          label="MDRT 2026"
          value={settled}
          ghostValue={b ? 0 : 36000}
          target={688800}
          max={700000}
          valueText={formatCurrency(settled)}
          targetText="MDRT 688,800"
        />
      </ChartCard>
      <ChartCard title={b ? 'Calls done — 4 of 7 minimums met' : 'Calls are 22 short this week'} subtitle="This week vs the company weekly minimums">
        <MeterList items={WEEKLY_MINIMUMS.map((m, i) => ({ key: m.label, label: m.label, value: week[i], target: m.target, tone: 'warm' }))} />
      </ChartCard>
      <ChartCard
        title={b ? 'Best week of the quarter: TTD 36,000' : 'Two strong weeks in the last four'}
        subtitle="Weekly API, last 12 weeks"
        table={table(WEEKS.map((w, i) => ({ label: w, value: formatCurrency(api[i]) })))}
      >
        <Columns
          data={WEEKS.map((w, i) => ({ key: w, label: w, value: api[i], highlight: i === WEEKS.length - 1 || api[i] > 20000 }))}
          target={4800 * 3}
          targetLabel="3× weekly minimum"
          format={formatCompactTTD}
        />
      </ChartCard>
      <ChartCard
        title={b ? 'September back over the 90% gate' : 'Persistency slipped under the gate in January'}
        subtitle="Persistency by month, 24-month model"
        table={{ columns: [{ key: 'label', label: 'Month' }, { key: 'value', label: 'Persistency', align: 'right' }], rows: MONTHS.map((m, i) => ({ label: m, value: formatPersistencyPct(pers[i]) })) }}
      >
        <GateBars data={MONTHS.map((m, i) => ({ key: m, label: m, value: pers[i], projected: b && i === MONTHS.length - 1 }))} gate={90} domain={[80, 95]} />
      </ChartCard>
      <ChartCard title="On pace for TTD 402K — MDRT needs 688.8K" subtitle="Cumulative API vs the straight-line MDRT pace">
        <Line
          series={[{ key: 'api', label: 'Your API', values: cumulative, tone: 1 }]}
          labels={WEEKS}
          target={b ? 150000 : 100000}
          targetLabel="Pace"
          format={formatCompactTTD}
        />
        <p className="mt-2 text-[12px] text-ink-muted">Pace line today: {formatCompactTTD(pace.at(-1))}</p>
      </ChartCard>
      <ChartCard title="Life carries the year" subtitle="Settled API by line">
        <Donut
          parts={[
            { key: 'life', label: 'Life', value: b ? 98000 : 71146 },
            { key: 'ah', label: 'A&H', value: b ? 15146 : 10000 },
            { key: 'general', label: 'General', value: b ? 10000 : 6000 },
          ]}
          centerLabel="Settled"
          centerValue={formatCompactTTD(settled)}
          format={formatCompactTTD}
        />
      </ChartCard>
      <div className={phone ? 'grid grid-cols-2 gap-3' : 'col-span-2 grid grid-cols-4 gap-3'}>
        {[['Calls', b ? [40, 52, 61] : [40, 52, 38]], ['Fact finds', b ? [6, 9, 8] : [6, 9, 4]], ['Apps', [1, 0, b ? 1 : 0]], ['API', [9800, 22600, b ? 36000 : 24046]]].map(([label, vals]) => (
          <div key={label} className="rounded-[18px] border border-border bg-card p-4">
            <p className="text-[13px] text-ink-muted">{label}</p>
            <p className="font-display text-[26px] font-bold tabular-nums">{vals.at(-1).toLocaleString('en-TT')}</p>
            <Sparkline values={[...vals, ...vals, ...vals, ...vals]} label={`${label}, last 12 weeks`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartsScene({ variant }) {
  return (
    <Frame>
      <h1 className="mt-2 font-display text-[28px] font-bold">Chart kit</h1>
      <ChartGrid variant={variant} />
    </Frame>
  );
}

function ChartsPhoneScene({ variant }) {
  return (
    <Frame phone>
      <h1 className="mt-2 font-display text-[28px] font-bold">Chart kit</h1>
      <ChartGrid variant={variant} phone />
    </Frame>
  );
}

function TrophiesScene({ variant }) {
  const b = variant === 'B';
  return (
    <Frame>
      <h1 className="mt-2 font-display text-[28px] font-bold">Trophies</h1>
      <ul className="mt-4 grid grid-cols-6 gap-4 md:grid-cols-8">
        {TROPHY_KINDS.map((kind, i) => {
          const locked = i % 3 === 2;
          return (
            <li key={kind} className="flex flex-col items-center gap-1 rounded-[18px] border border-border bg-card p-3">
              <Trophy kind={kind} size={88} locked={locked} progress={locked ? (b ? 80 : 35) : null} />
              <span className="text-center text-[11px] text-ink-muted">{kind}</span>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

function Card({ title, lines, tall = false }) {
  return (
    <div className="mb-3 rounded-[18px] border border-border bg-card p-4">
      <h3 className="font-display text-[20px] font-bold">{title}</h3>
      {Array.from({ length: lines }).map((_, i) => (
        <p key={i} className="mt-2 text-[14px] text-ink-muted">
          {tall ? 'Longer page: ' : ''}Line {i + 1} of sample text on this page.
        </p>
      ))}
    </div>
  );
}

function PagerScene() {
  const pages = [
    { id: 'today', label: 'Today', content: <div className="px-4"><Card title="The answer at a glance" lines={3} /><Card title="Next action" lines={2} /></div> },
    { id: 'week', label: 'Week', content: <div className="px-4"><Card title="This week" lines={10} tall /><Card title="Minimums" lines={8} tall /></div> },
    { id: 'money', label: 'Money', content: <div className="px-4"><Card title="Money" lines={4} /></div> },
    { id: 'campaign', label: 'Campaign', content: <div className="px-4"><Card title="Christmas campaign" lines={6} /></div> },
  ];
  return (
    <div className="mx-auto w-[390px] py-4">
      <div className="px-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">FR harness · SAMPLE data</p>
        <h1 className="mt-1 font-display text-[28px] font-bold">Today</h1>
      </div>
      <SwipePager pages={pages} ariaLabel="Today pages" width={390} />
      <div className="px-4 pt-2 text-[12px] text-ink-muted" data-testid="after-pager">Content after the pager starts here.</div>
    </div>
  );
}

export const FOUNDATION_SCENES = [
  { id: 'tokens', title: 'Tokens and type', slice: 'FR-0', viewport: 'desktop', render: TokensScene },
  { id: 'charts', title: 'Chart kit', slice: 'FR-0', viewport: 'desktop', hasVariants: true, render: ChartsScene },
  { id: 'charts-phone', title: 'Chart kit (phone)', slice: 'FR-0', viewport: 'phone', hasVariants: true, render: ChartsPhoneScene },
  { id: 'trophies', title: 'Trophies (33)', slice: 'FR-0', viewport: 'desktop', hasVariants: true, render: TrophiesScene },
  { id: 'pager', title: 'Swipe pages', slice: 'FR-0', viewport: 'phone', pager: true, render: PagerScene },
];

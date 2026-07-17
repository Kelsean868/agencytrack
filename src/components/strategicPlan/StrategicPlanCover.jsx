import React from 'react';
import { fmtTTD, fmtPct } from './planFormat';

// Track K — Strategic Plan · Cover (hero, deck §01). Two-column glass hero: branch
// identity + prepared-by on the left, headline stats on the right.
function periodLabel(period) {
  if (!period) return '';
  const g = period.granularity === 'half' ? 'H1 – H2' : 'Q1 – Q4';
  return `${period.year} · ${g}`;
}

export default function StrategicPlanCover({ plan }) {
  // Loading: render a slim hero skeleton rather than "Branch" + placeholder metrics
  // as if they were loaded content.
  if (plan?.loading || !plan?.meta) {
    return (
      <section data-testid="sp-cover" className="rounded-2xl p-6 glass hero teal shadow-sm" aria-busy="true">
        <div className="h-3 w-40 rounded bg-[--hero-ink]/15" />
        <div className="mt-3 h-8 w-64 rounded bg-[--hero-ink]/15" />
        <div className="mt-4 h-3 w-28 rounded bg-[--hero-ink]/10" />
      </section>
    );
  }
  const meta = plan?.meta;
  const prod = plan?.production;
  const pm = plan?.periodMetrics;
  const pace = plan?.agents?.summary?.pacePct;
  const generated = meta?.generatedAt ? new Date(meta.generatedAt) : null;

  const stats = [
    {
      k: 'YTD · Net settled API',
      v: fmtTTD(prod?.annual?.apiNetSettled),
      s: prod?.annual?.apiQuota != null ? `of ${fmtTTD(prod.annual.apiQuota)} annual quota` : 'no quota set',
    },
    {
      k: 'Prorated objective',
      v: pace != null ? fmtPct(pace) : '—',
      s: prod?.elapsedPct != null ? `${fmtPct(prod.elapsedPct)} of year elapsed` : '',
    },
    {
      k: 'Licensed advisors',
      v: pm?.manpowerGoal != null ? `${pm.manpowerActual} / ${pm.manpowerGoal}` : String(pm?.manpowerActual ?? '—'),
      s: pm?.manpowerGoal != null ? 'EOY manpower goal' : 'goal not set',
    },
  ];

  return (
    <section data-testid="sp-cover" className="relative overflow-hidden rounded-2xl p-6 glass hero teal shadow-sm">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[--hero-ink-muted-teal]">
            01 · Strategic Plan · {meta?.period?.year ?? ''}
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[--hero-ink]" data-testid="sp-cover-branch">
            {meta?.branchName ?? 'Branch'}
          </h1>
          <p className="mt-1 text-sm text-[--hero-ink-muted-teal]">{periodLabel(meta?.period)}</p>
          <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2">
            {[
              ['Prepared by', meta?.authorName ? `${meta.authorName} · Branch Manager` : '—'],
              ['Timestamp', generated ? generated.toLocaleDateString('en-TT', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[--hero-ink-muted-teal]">{k}</div>
                <div className="mt-1 text-sm font-semibold text-[--hero-ink]">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex w-full flex-col gap-4 border-t border-[--hero-ink]/15 pt-4 md:w-72 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          {stats.map((it) => (
            <div key={it.k}>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[--hero-ink-muted-teal]">{it.k}</div>
              <div className="mt-0.5 font-display text-2xl font-extrabold tracking-tight text-[--hero-ink] leading-none">{it.v}</div>
              {it.s && <div className="mt-1 text-[11px] text-[--hero-ink-muted-teal]">{it.s}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

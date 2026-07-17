import React from 'react';

// Track K — Strategic Plan · Cover (hero). Branch name, period, author, timestamp.
function periodLabel(period) {
  if (!period) return '';
  const g = period.granularity === 'half' ? 'Half-year' : 'Quarterly';
  return `${period.year} · ${g} plan`;
}

export default function StrategicPlanCover({ meta }) {
  const generated = meta?.generatedAt ? new Date(meta.generatedAt) : null;
  return (
    <section
      data-testid="sp-cover"
      className="relative overflow-hidden rounded-2xl p-6 glass hero teal shadow-sm"
    >
      <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[--hero-ink-muted-teal]">
        Agency Strategic Plan
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-[--hero-ink]" data-testid="sp-cover-branch">
        {meta?.branchName ?? 'Branch'}
      </h1>
      <p className="mt-1 text-sm text-[--hero-ink-muted-teal]">{periodLabel(meta?.period)}</p>
      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-[--hero-ink]">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[--hero-ink-muted-teal]">Agency Manager</div>
          <div className="font-semibold">{meta?.authorName ?? '—'}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[--hero-ink-muted-teal]">Generated</div>
          <div className="font-semibold">
            {generated ? generated.toLocaleDateString('en-TT', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
          </div>
        </div>
      </div>
    </section>
  );
}

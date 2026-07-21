import React from 'react';
import { CandidateAvatar, StagePill } from '../manager/recruitingVisuals';
import { STAGE_KEYS } from '../../services/recruitingService';
import { SectionCard, SectionState } from './SectionState';
import { StatHero } from './planPrimitives';
import { fmtPct } from './planFormat';

// Track K — Recruitment Pipeline (deck §06). Glass-hero + candidate rows reusing
// the shared recruiting visuals (CandidateAvatar / StagePill) plus a horizontal
// 8-stage indicator and completion bar. 8 stages: sourced → licensed.

function StageDots({ stageIndex, hired, dropped }) {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {STAGE_KEYS.map((k, i) => {
        // A hired candidate has completed the final (licensed) stage — fill it too.
        const done = i < stageIndex || (hired && i === stageIndex);
        const here = i === stageIndex && !dropped && !hired;
        return (
          <span
            key={k}
            className={
              done ? (dropped ? 'h-1.5 w-1.5 rounded-full bg-ink-dim' : `h-1.5 w-1.5 rounded-full ${hired ? 'bg-success' : 'bg-primary'}`)
                : here ? 'h-2 w-2 rounded-full border-2 border-primary'
                  : 'h-1 w-1 rounded-full bg-ink-dim'
            }
          />
        );
      })}
    </div>
  );
}

export default function RecruitmentPipeline({ recruitment, loading, error, onRetry }) {
  const rec = recruitment;
  const heroItems = rec ? [
    { k: 'Candidates · active', v: String(rec.total), sub: 'across 8 stages' },
    { k: 'Licensed · YTD', v: String(rec.hired), sub: 'contracted & licensed' },
    { k: 'Sourced → licensed', v: rec.conversionPct != null ? fmtPct(rec.conversionPct) : '—', sub: 'conversion' },
    rec.nextMilestone
      ? { k: 'Next milestone', v: rec.nextMilestone.name, sub: rec.nextMilestone.note || rec.nextMilestone.stage }
      : { k: 'Next milestone', v: '—', sub: 'no active candidates' },
  ] : [];

  return (
    <div className="space-y-3.5">
      {!loading && !error && rec && !rec.empty && <StatHero items={heroItems} testid="sp-recruitment-hero" />}
      <SectionCard
        id="recruitment"
        num="06"
        title="Recruitment Pipeline"
        subtitle={rec ? `${rec.total} active candidate${rec.total === 1 ? '' : 's'} · ${rec.hired} licensed` : 'Candidate pipeline'}
      >
        <SectionState
          loading={loading}
          error={error}
          empty={!loading && !error && (!rec || rec.empty)}
          emptyLabel="No recruiting candidates in this branch yet."
          onRetry={onRetry}
        >
          {rec && (
            <div className="space-y-5">
              {/* Stage counts */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                {rec.byStage.map((s) => (
                  <div key={s.key} className="rounded-lg border border-border bg-surface-muted/40 px-2 py-2 text-center">
                    <div className="text-lg font-bold tabular-nums text-ink">{s.count}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-muted">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Candidate rows */}
              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG scrollable-region-focusable */}
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Recruitment candidates table">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted">
                      <th className="py-2 pr-3 font-semibold">Candidate</th>
                      <th className="px-2 py-2 font-semibold">Source</th>
                      <th className="px-2 py-2 font-semibold">Recruiter</th>
                      <th className="px-2 py-2 font-semibold">Progress</th>
                      <th className="px-2 py-2 text-right font-semibold">Complete</th>
                      <th className="px-2 py-2 text-center font-semibold">Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rec.rows.map((c) => (
                      <tr key={c.id} data-testid={`sp-candidate-${c.id}`} className="border-b border-border/50">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <CandidateAvatar name={c.name} stage={c.stage} size="sm" />
                            <span className="font-medium text-ink">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-ink-muted">{c.source || '—'}</td>
                        <td className="px-2 py-2 text-ink-muted">{c.ownerName || '—'}</td>
                        <td className="px-2 py-2"><StageDots stageIndex={c.stageIndex} hired={c.hired} dropped={false} /></td>
                        <td className="px-2 py-2 text-right font-mono text-xs tabular-nums text-ink-muted">{c.completePct}%</td>
                        <td className="px-2 py-2 text-center"><StagePill stage={c.stage} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionState>
      </SectionCard>
    </div>
  );
}

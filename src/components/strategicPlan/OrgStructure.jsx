import React from 'react';
import { SectionCard, SectionState } from './SectionState';
import { StatHero, PlanAvatar } from './planPrimitives';
import { fmtTTD, fmtYears } from './planFormat';

// Track K — Org Structure (deck §05). Branch → units tree: BM + admin bar, then a
// card per unit (head avatar, advisor rows with net API, unit-net footer). Live
// units grouped on unitId (RULING 3). Age/sex columns omitted — not on the user doc.

export default function OrgStructure({ orgStructure, loading, error, onRetry }) {
  const org = orgStructure;
  const heroItems = org ? [
    { k: 'Units', v: String(org.unitCount), sub: 'unit managers reporting' },
    { k: 'Licensed advisors', v: String(org.licensedAdvisors), sub: 'across all units' },
    { k: 'Admin staff', v: String(org.adminCount), sub: 'branch office' },
    { k: `New contracts · ${new Date().getFullYear()}`, v: String(org.newContracts.length), sub: org.newContracts.slice(0, 2).join(' · ') || 'none this year' },
  ] : [];

  return (
    <div className="space-y-3.5">
      {!loading && !error && org && !org.empty && <StatHero items={heroItems} testid="sp-org-hero" />}
      <SectionCard
        id="org"
        num="05"
        title="Organisation Structure"
        subtitle={org ? `${org.unitCount} unit${org.unitCount === 1 ? '' : 's'} · ${org.adminCount} admin` : 'Units & advisors'}
      >
        <SectionState
          loading={loading}
          error={error}
          empty={!loading && !error && (!org || org.empty)}
          emptyLabel="No units configured for this branch yet."
          onRetry={onRetry}
        >
          {org && (
            <div className="space-y-4">
              {/* BM + admin bar */}
              {(org.author || org.admins.length > 0) && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-muted/40 p-4">
                  {org.author && (
                    <div className="flex items-center gap-3">
                      <PlanAvatar name={org.author.name} size="lg" />
                      <div>
                        <div className="font-semibold text-ink">{org.author.name}</div>
                        <div className="text-xs text-ink-muted">{org.author.title} · Agency Manager</div>
                      </div>
                    </div>
                  )}
                  <div className="ml-auto flex flex-wrap gap-2">
                    {org.admins.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
                        <PlanAvatar name={a.name} size="sm" />
                        <div>
                          <div className="text-xs font-semibold text-ink">{a.name}</div>
                          <div className="text-[10px] text-ink-muted">{a.title}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unit cards */}
              <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {org.units.map((unit) => (
                  <div key={unit.unitId} data-testid={`sp-unit-${unit.unitId}`} className="overflow-hidden rounded-xl border border-border">
                    <div className="flex items-center gap-2.5 border-b border-border bg-surface-muted/50 px-4 py-3">
                      {unit.headName ? <PlanAvatar name={unit.headName} /> : null}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">{unit.unitName}</div>
                        <div className="truncate text-[11px] text-ink-muted">
                          {unit.headName ? `${unit.headName} · ${unit.headTitle}` : 'No unit head'}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                        {unit.advisorCount} adv
                      </span>
                    </div>
                    {unit.advisors.length > 0 ? (
                      <ul>
                        {unit.advisors.map((a) => (
                          <li key={a.id} className="flex items-center gap-2 border-b border-border/50 px-4 py-2 last:border-0">
                            <span className="flex-1 truncate text-sm text-ink">{a.name}</span>
                            <span className="font-mono text-[10px] text-ink-muted">{a.contractYear ? `’${a.contractYear.slice(2)}` : fmtYears(a.experienceYears)}</span>
                            <span className="font-mono text-xs font-semibold tabular-nums text-ink-muted">{fmtTTD(a.netApi)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="px-4 py-3 text-xs text-ink-muted">Head-only unit — no advisors yet.</div>
                    )}
                    <div className="flex items-center justify-between border-t border-border bg-surface-muted/50 px-4 py-2.5">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">Unit · net settled</span>
                      <span className="font-mono text-xs font-bold tabular-nums text-primary">{fmtTTD(unit.ytdNetApi)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionState>
      </SectionCard>
    </div>
  );
}

// History v2 — filter row, week card with KPI grid, drill drawer content.

// ──────────────────────────────────────────────────────────────────────────
// HistoryFilterRow — year + status + month + search + award toggle.
// ──────────────────────────────────────────────────────────────────────────
function HistoryFilterRow({ t, activeStatus = 'all', activeMonth = 'all', awardOnly = false, mobile = false }) {
  const statuses = [
    { key: 'all',       label: 'All weeks', count: HIST_WEEKS.length },
    { key: 'submitted', label: 'Submitted', count: HIST_WEEKS.filter(w => w.status === 'submitted').length },
    { key: 'draft',     label: 'Draft',     count: HIST_WEEKS.filter(w => w.status === 'draft').length },
    { key: 'unlocked',  label: 'Unlocked',  count: HIST_WEEKS.filter(w => w.status === 'unlocked').length },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 8 : 12, flexWrap: 'wrap' }}>
      {/* Status segmented */}
      <div style={{
        display: 'flex', gap: 4, padding: 4,
        background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10,
      }}>
        {statuses.map(s => {
          const isActive = s.key === activeStatus;
          return (
            <div key={s.key} style={{
              padding: mobile ? '6px 10px' : '7px 13px',
              borderRadius: 7,
              fontSize: 12, fontWeight: 700, color: isActive ? t.ink : t.inkMute,
              background: isActive ? t.surface : 'transparent',
              border: isActive ? `1px solid ${t.rule}` : '1px solid transparent',
              boxShadow: isActive ? '0 1px 2px rgba(40,37,29,0.04)' : 'none',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}>
              {s.label}
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '0 6px', borderRadius: 999,
                background: isActive ? t.tealTint : 'transparent',
                color: isActive ? t.teal : t.inkFaint,
                fontFamily: APP_FONT_MONO,
              }}>{s.count}</span>
            </div>
          );
        })}
      </div>

      {!mobile && (
        <>
          {/* Year dropdown */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '7px 11px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9,
            fontSize: 12, fontWeight: 700, color: t.ink,
          }}>
            2026
            <IconChevD size={11} color={t.inkMute} stroke={2.4} />
          </div>

          {/* Month dropdown */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '7px 11px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9,
            fontSize: 12, fontWeight: 700, color: t.inkMute,
          }}>
            All months
            <IconChevD size={11} color={t.inkMute} stroke={2.4} />
          </div>

          {/* Award-eligible toggle */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '7px 11px',
            background: awardOnly ? t.goldTint : t.surface,
            border: `1px solid ${awardOnly ? t.gold + '55' : t.rule}`,
            borderRadius: 9,
            fontSize: 12, fontWeight: 700, color: awardOnly ? t.gold : t.inkMute,
          }}>
            <div style={{
              width: 24, height: 14, borderRadius: 999,
              background: awardOnly ? t.gold : t.surfaceMute,
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: 2, left: awardOnly ? 12 : 2,
                width: 10, height: 10, borderRadius: '50%', background: t.surface,
                transition: 'left 180ms ease',
              }}></div>
            </div>
            ★ AWARD WEEKS
          </div>

          <div style={{ flex: 1 }}></div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9,
            width: 220,
          }}>
            <IconSearch size={13} color={t.inkMute} />
            <div style={{ flex: 1, fontSize: 12, color: t.inkFaint }}>Search notes, goals…</div>
          </div>

          {/* Download */}
          <div style={{
            padding: '8px 13px', background: t.teal, color: '#fff',
            borderRadius: 9, fontSize: 12, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            boxShadow: `0 2px 6px ${t.teal}44`,
          }}>
            <IconDownload size={13} color="#fff" />
            Download report
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MiniSpark — 5-bar spark showing API trailing into this week.
// ──────────────────────────────────────────────────────────────────────────
function MiniSpark({ t, values, current, tone = 'teal' }) {
  const max = Math.max(...values, current, 1);
  const color = tone === 'gold' ? t.gold : t.teal;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22 }}>
      {values.map((v, i) => (
        <div key={i} style={{
          width: 4, height: Math.max(2, (v / max) * 22),
          background: color, opacity: 0.45 + (i / values.length) * 0.4,
          borderRadius: 1,
        }}></div>
      ))}
      <div style={{
        width: 5, height: Math.max(2, (current / max) * 22),
        background: color, borderRadius: 1,
        boxShadow: `0 0 4px ${color}88`,
      }}></div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Delta — small WoW arrow + value chip.
// ──────────────────────────────────────────────────────────────────────────
function Delta({ t, value, isPercent = false }) {
  if (value === 0 || value === null || value === undefined) return null;
  const up = value > 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      padding: '1px 6px', borderRadius: 999,
      background: up ? t.successTint : t.warningTint,
      color: up ? t.success : t.warning,
      fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
      fontFamily: APP_FONT_MONO,
    }}>
      {up ? '▲' : '▼'} {Math.abs(value)}{isPercent ? '%' : ''}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// WeekCard — big card with status header, 4-up KPI grid, spark + ratings.
// ──────────────────────────────────────────────────────────────────────────
function WeekCard({ t, week, prevWeek, animClass, active = false, mobile = false, sparkValues }) {
  const isUnlocked = week.status === 'unlocked';
  const isDraft = week.status === 'draft';
  const statusFg = isUnlocked ? t.warning : isDraft ? t.warning : t.success;
  const statusBg = isUnlocked ? t.warningTint : isDraft ? t.warningTint : t.successTint;
  const statusLabel = isUnlocked ? 'UNLOCKED' : isDraft ? 'DRAFT' : 'SUBMITTED';

  const apiDelta   = prevWeek ? Math.round((week.api - prevWeek.api) / 100) * 100 : 0;
  const appsDelta  = prevWeek ? week.apps - prevWeek.apps : 0;
  const cisDelta   = prevWeek ? week.cis  - prevWeek.cis  : 0;
  const callsDelta = prevWeek ? week.calls - prevWeek.calls : 0;

  return (
    <div className={`a-card ${animClass || ''}`} style={{
      padding: mobile ? '13px 14px' : '16px 18px',
      background: t.surface,
      border: `1px solid ${active ? t.teal + '88' : isUnlocked ? t.warning + '44' : t.rule}`,
      borderRadius: 12, cursor: 'pointer',
      boxShadow: active ? `0 0 0 1px ${t.teal}33` : 'none',
      position: 'relative',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: mobile ? 14 : 15, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em' }}>
              {weekLabel(week)}
            </div>
            {week.isBest && (
              <span style={{
                padding: '2px 8px', borderRadius: 999,
                background: t.goldTint, color: t.gold,
                fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO,
              }}>★ BEST WEEK</span>
            )}
            {week.isAwardEligible && !week.isBest && (
              <span style={{
                padding: '2px 8px', borderRadius: 999,
                background: t.goldTint, color: t.gold,
                fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO,
              }}>AWARD-ELIGIBLE</span>
            )}
          </div>
          {week.note && (
            <div style={{ fontSize: 11, color: t.inkMute, marginTop: 4, lineHeight: 1.4, fontStyle: 'italic' }}>
              "{week.note}"
            </div>
          )}
          {isUnlocked && week.unlockedBy && (
            <div style={{ fontSize: 10.5, color: t.warning, marginTop: 4, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
              UNLOCKED BY {week.unlockedBy.toUpperCase()} · NEEDS RESUBMIT
            </div>
          )}
        </div>
        <div style={{
          padding: '3px 9px', borderRadius: 999,
          background: statusBg, color: statusFg,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO,
          flexShrink: 0,
        }}>{statusLabel}</div>
      </div>

      {/* KPI 4-up grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: mobile ? 6 : 10 }}>
        {[
          { eye: 'API',   value: fmtTtdShort(week.api), prefix: 'TTD', delta: Math.round(apiDelta / 100), deltaLabel: apiDelta !== 0 ? (apiDelta > 0 ? `+${fmtTtdShort(Math.abs(apiDelta))}` : `-${fmtTtdShort(Math.abs(apiDelta))}`) : null },
          { eye: 'APPS',  value: week.apps, delta: appsDelta },
          { eye: 'CIs',   value: week.cis,  delta: cisDelta },
          { eye: 'CALLS', value: week.calls, delta: callsDelta },
        ].map((k, i) => (
          <div key={i} style={{
            padding: '8px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.14em' }}>{k.eye}</span>
              {k.delta !== 0 && k.delta != null && (
                <span style={{
                  padding: '1px 5px', borderRadius: 999,
                  background: k.delta > 0 ? t.successTint : t.warningTint,
                  color: k.delta > 0 ? t.success : t.warning,
                  fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em', fontFamily: APP_FONT_MONO,
                }}>{k.delta > 0 ? '▲' : '▼'} {k.deltaLabel || Math.abs(k.delta)}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 6 }}>
              {k.prefix && <span style={{ fontSize: 8.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>{k.prefix}</span>}
              <span style={{
                fontSize: mobile ? 16 : 18, fontWeight: 700, color: t.ink,
                fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.018em', lineHeight: 1,
              }}>{k.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Foot row — spark + ratings + view chevron */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.12em' }}>5-WK API</span>
          <MiniSpark t={t} values={sparkValues || [12000, 18000, 15000, 22000]} current={week.api} />
        </div>
        {week.overall > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.12em' }}>RATING</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{
                  width: 4, height: 10,
                  background: i < week.overall ? t.teal : t.surfaceMute,
                  borderRadius: 1,
                }}></div>
              ))}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{week.overall}/10</span>
          </div>
        )}
        <div style={{ flex: 1 }}></div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 11px', background: t.surfaceSoft, border: `1px solid ${t.rule}`,
          borderRadius: 999, color: t.inkMute,
          fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
        }}>
          {isDraft ? 'CONTINUE' : isUnlocked ? 'OPEN TO EDIT' : 'VIEW DETAIL'}
          <IconChevR size={10} color={t.inkMute} stroke={2.4} />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// DrillDrawerContent — what the drawer renders. Hero + sections + footer CTA.
// ──────────────────────────────────────────────────────────────────────────
function HistoryDrillContent({ t, week, prevWeek, managerView = false }) {
  const isUnlocked = week.status === 'unlocked';
  const isDraft    = week.status === 'draft';
  const isSubmitted = week.status === 'submitted';

  // Hero KPIs
  const heroKpis = [
    { eye: 'API',   value: fmtTtdK(week.api), tone: t.teal, delta: prevWeek ? week.api - prevWeek.api : 0, isCurrency: true },
    { eye: 'APPS',  value: week.apps,        tone: t.gold, delta: prevWeek ? week.apps - prevWeek.apps : 0 },
    { eye: 'CIs',   value: week.cis,         tone: t.ink,  delta: prevWeek ? week.cis - prevWeek.cis : 0 },
    { eye: 'CALLS', value: week.calls,       tone: t.ink,  delta: prevWeek ? week.calls - prevWeek.calls : 0 },
  ];

  return (
    <>
      {/* Header */}
      <div style={{ padding: '22px 22px 16px', borderBottom: `1px solid ${t.rule}` }}>
        <Eyebrow t={t} color={isUnlocked ? t.warning : isDraft ? t.warning : t.teal}>
          {isUnlocked ? `UNLOCKED BY ${week.unlockedBy?.toUpperCase()}` : isDraft ? 'DRAFT · NOT SUBMITTED' : `SUBMITTED · ${week.month} 2026`}
        </Eyebrow>
        <div style={{
          fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em',
          fontFamily: APP_FONT_DISPLAY, marginTop: 6,
        }}>{weekLabel(week)}</div>
        {week.note && (
          <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>
            "{week.note}"
          </div>
        )}

        {/* Hero KPI 4-up */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
          {heroKpis.map((k, i) => (
            <div key={i} style={{
              padding: '10px 12px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: k.tone, fontFamily: APP_FONT_MONO, letterSpacing: '0.14em' }}>{k.eye}</span>
                {k.delta !== 0 && (
                  <span style={{
                    padding: '1px 6px', borderRadius: 999,
                    background: k.delta > 0 ? t.successTint : t.warningTint,
                    color: k.delta > 0 ? t.success : t.warning,
                    fontSize: 9, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em',
                  }}>
                    {k.delta > 0 ? '▲' : '▼'} {k.isCurrency ? fmtTtdShort(Math.abs(k.delta)) : Math.abs(k.delta)}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 20, fontWeight: 700, color: t.ink,
                fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1, marginTop: 7,
              }}>{k.value}</div>
              <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em', marginTop: 5 }}>vs prev week</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px 18px' }}>
        <DrillSection t={t} eyebrow="PRODUCTION" rows={[
          { label: 'New business apps',   value: week.apps },
          { label: 'New business API',    value: fmtTtdK(week.api), big: true },
          { label: 'Lives sold',          value: Math.max(week.apps, week.apps + 1) },
          { label: 'Avg policy size',     value: fmtTtdK(week.api / Math.max(week.apps, 1)) },
        ]} />
        <DrillSection t={t} eyebrow="ACTIVITY" rows={[
          { label: 'Total calls',        value: week.calls },
          { label: 'Referral calls',     value: Math.round(week.calls * 0.35) },
          { label: 'Follow-up calls',    value: Math.round(week.calls * 0.40) },
          { label: 'Cold calls',         value: Math.round(week.calls * 0.25) },
          { label: 'F2F approaches',     value: Math.max(0, week.calls - 30) },
        ]} />
        <DrillSection t={t} eyebrow="INTERVIEWS" rows={[
          { label: 'FFIs scheduled',     value: week.ffi },
          { label: 'FFIs conducted',     value: Math.max(0, week.ffi - 1) },
          { label: 'New CIs booked',     value: Math.round(week.cis * 0.6) },
          { label: 'Old CIs booked',     value: Math.round(week.cis * 0.4) },
          { label: 'CIs conducted',      value: week.cis },
        ]} />
        {week.overall > 0 && (
          <DrillSection t={t} eyebrow="REFLECTION" rows={[
            { label: 'Planning',          value: `${Math.max(4, week.overall - 1)}/10` },
            { label: 'Time management',   value: `${Math.max(4, week.overall - 2)}/10` },
            { label: 'Sales',             value: `${Math.min(10, week.overall + 1)}/10` },
            { label: 'Prospecting',       value: `${week.overall}/10` },
            { label: 'Overall',           value: `${week.overall}/10`, big: true },
          ]} />
        )}
        <DrillSection t={t} eyebrow="NEXT WEEK GOALS SET" rows={[
          { label: 'Target calls',  value: Math.round(week.calls * 1.1) },
          { label: 'Target FFI',    value: week.ffi + 1 },
          { label: 'Target CI',     value: week.cis + 1 },
          { label: 'Target apps',   value: week.apps + 1 },
          { label: 'Target API',    value: fmtTtdK(Math.round(week.api * 1.15 / 1000) * 1000), big: true },
        ]} />
      </div>

      {/* Footer CTA */}
      <div style={{
        padding: '14px 22px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0,
      }}>
        {!managerView && isSubmitted && (
          <>
            <div style={{ fontSize: 11.5, color: t.inkMute, lineHeight: 1.4 }}>Locked record · download a copy</div>
            <div style={{
              padding: '9px 14px', background: t.teal, color: '#fff', borderRadius: 9,
              fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7,
              boxShadow: `0 2px 6px ${t.teal}44`,
            }}>
              <IconDownload size={13} color="#fff" /> Download PDF
            </div>
          </>
        )}
        {!managerView && isDraft && (
          <>
            <div style={{ fontSize: 11.5, color: t.inkMute, lineHeight: 1.4 }}>Draft saved · resume any time</div>
            <div style={{
              padding: '9px 16px', background: t.teal, color: '#fff', borderRadius: 9,
              fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7,
              boxShadow: `0 2px 6px ${t.teal}44`,
            }}>
              Continue editing
              <IconArrowR size={13} color="#fff" stroke={2.4} />
            </div>
          </>
        )}
        {!managerView && isUnlocked && (
          <>
            <div style={{ fontSize: 11.5, color: t.warning, lineHeight: 1.4 }}>
              Manager unlocked this week · update + resubmit
            </div>
            <div style={{
              padding: '9px 16px', background: t.warning, color: '#fff', borderRadius: 9,
              fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7,
              boxShadow: `0 2px 6px ${t.warning}44`,
            }}>
              Edit + resubmit
              <IconArrowR size={13} color="#fff" stroke={2.4} />
            </div>
          </>
        )}
        {managerView && isSubmitted && (
          <>
            <div style={{ fontSize: 11.5, color: t.inkMute, lineHeight: 1.4 }}>Submitted on Mon 04 Nov · 14:22</div>
            <div style={{
              padding: '9px 16px', background: t.warning, color: '#fff', borderRadius: 9,
              fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7,
              boxShadow: `0 2px 6px ${t.warning}44`,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Unlock for resubmit
            </div>
          </>
        )}
        {managerView && isUnlocked && (
          <>
            <div style={{ fontSize: 11.5, color: t.warning, lineHeight: 1.4 }}>
              Unlocked by you · {week.agent || 'Marsha'} hasn't resubmitted
            </div>
            <div style={{
              padding: '9px 16px', background: t.surface, border: `1px solid ${t.ruleStrong}`, color: t.ink,
              borderRadius: 9, fontSize: 12.5, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}>
              Re-lock this week
            </div>
          </>
        )}
      </div>
    </>
  );
}

function DrillSection({ t, eyebrow, rows }) {
  return (
    <div className="a-fade-up" style={{ marginTop: 14 }}>
      <Eyebrow t={t} color={t.inkMute}>{eyebrow}</Eyebrow>
      <div style={{ marginTop: 8, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 10, overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '9px 12px',
            background: r.big ? t.tealTint : 'transparent',
            borderBottom: i < rows.length - 1 ? `1px solid ${t.rule}` : 'none',
          }}>
            <span style={{ fontSize: 11.5, color: r.big ? t.ink : t.inkMute, fontWeight: r.big ? 700 : 500 }}>{r.label}</span>
            <span style={{
              fontSize: r.big ? 14 : 12.5,
              fontWeight: 700, color: r.big ? t.teal : t.ink,
              fontFamily: r.big ? APP_FONT_DISPLAY : APP_FONT_SANS,
              letterSpacing: r.big ? '-0.012em' : 'normal',
            }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  HistoryFilterRow, MiniSpark, Delta, WeekCard, HistoryDrillContent, DrillSection,
});

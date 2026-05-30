// Policy Ledger v2 — pipeline-first design with drill-drawer transitions
//
// Tier 1 (Pipeline strip): 5 stage tiles showing count + TTD per status,
//                          plus a YTD total hero on the right.
// Tier 2 (Card feed):      filter chips + searchable cards, each carrying
//                          its mini-lifecycle indicator.
// Tier 3 (Drill drawer):   visual lifecycle bar with dates, full policy
//                          details, history timeline, footer "Move to [next]"
//                          button that morphs the drawer into an inline
//                          transition form (option B from the recommendation).

// Lifecycle stages (happy path)
const STAGES = [
{ key: 'submitted', label: 'Submitted' },
{ key: 'rated', label: 'Rated' },
{ key: 'settled', label: 'Settled' },
{ key: 'confirmed', label: 'Confirmed' }];


const STATUS_COLOR = {
  submitted: 'teal',
  rated: 'teal',
  postponed: 'warning',
  settled: 'success',
  confirmed: 'gold',
  ntu: 'danger',
  denied: 'danger',
  lapsed: 'inkFaint'
};

function statusFg(status, t) {
  const c = STATUS_COLOR[status];
  if (c === 'teal') return t.teal;
  if (c === 'success') return t.success;
  if (c === 'gold') return t.gold;
  if (c === 'warning') return t.warning;
  if (c === 'danger') return t.danger;
  return t.inkFaint;
}
function statusBg(status, t) {
  const c = STATUS_COLOR[status];
  if (c === 'teal') return t.tealTint;
  if (c === 'success') return t.successTint;
  if (c === 'gold') return t.goldTint;
  if (c === 'warning') return t.warningTint;
  if (c === 'danger') return t.dangerTint;
  return t.surfaceMute;
}

// ── Mock policies ─────────────────────────────────────────────────────────
const POLICIES = [
{ id: '1', policyNumber: null, owner: 'Anjali Persaud', insured: 'Anjali Persaud', api: 24000, premium: 2000, freq: 'M', product: 'Life', planClass: 'Whole Life', plan: 'Tatil Whole Life Premier', written: '14 Nov', source: 'Referral', cash: 500, status: 'submitted', dates: { submitted: '14 Nov' } },
{ id: '2', policyNumber: 'TL-2026-08471', owner: 'Devon Holder', insured: 'Marisa Holder', api: 18600, premium: 1550, freq: 'M', product: 'Life', planClass: 'Term', plan: 'Tatil Term 20', written: '8 Nov', source: 'Cold call', cash: null, status: 'rated', dates: { submitted: '8 Nov', rated: '12 Nov' } },
{ id: '3', policyNumber: 'TL-2026-08503', owner: 'Kareem Mohammed', insured: 'Kareem Mohammed', api: 32400, premium: 2700, freq: 'M', product: 'Life', planClass: 'Universal Life', plan: 'Platinum Edge', written: '24 Oct', source: 'Social · IG', cash: 800, status: 'rated', dates: { submitted: '24 Oct', rated: '4 Nov' } },
{ id: '4', policyNumber: 'TL-2026-08390', owner: 'Lisa Maraj', insured: 'Lisa Maraj', api: 21600, premium: 1800, freq: 'M', product: 'Life', planClass: 'Whole Life', plan: 'Tatil Whole Life Premier', written: '12 Sep', source: 'Referral', cash: 1200, status: 'settled', dates: { submitted: '12 Sep', rated: '24 Sep', settled: '18 Oct' } },
{ id: '5', policyNumber: 'TL-2026-08245', owner: 'Naomi Hosein', insured: 'Naomi Hosein', api: 48000, premium: 4000, freq: 'M', product: 'Life', planClass: 'Universal Life', plan: 'Platinum Edge', written: '2 Aug', source: 'Referral', cash: 2000, status: 'confirmed', dates: { submitted: '2 Aug', rated: '14 Aug', settled: '20 Sep', confirmed: '14 Oct' }, confirmedBy: 'T. Ramcharan' },
{ id: '6', policyNumber: 'TL-2026-08102', owner: 'Brent Maharaj', insured: 'Brent Maharaj', api: 16800, premium: 1400, freq: 'M', product: 'Life', planClass: 'Term', plan: 'Tatil Term 10', written: '15 Jul', source: 'Cold call', cash: null, status: 'lapsed', dates: { submitted: '15 Jul', lapsed: '8 Oct' } }];


// Pipeline summary tiles
const PIPELINE_STAGES = [
{ key: 'submitted', label: 'Submitted', shortLabel: 'Submitted', status: 'submitted' },
{ key: 'rated', label: 'Rated', shortLabel: 'Rated', status: 'rated' },
{ key: 'settled', label: 'Awaiting confirm', shortLabel: 'Awaiting', status: 'settled' },
{ key: 'confirmed', label: 'Confirmed', shortLabel: 'Confirmed', status: 'confirmed' },
{ key: 'closed', label: 'Closed · Lapsed', shortLabel: 'Closed', status: 'lapsed' }];


// Lens definition — a campaign/award filter applied to the ledger.
const NOVEMBER_SPRINT_LENS = {
  name: 'November Sprint',
  kind: 'Campaign',
  endsIn: '2 weeks left',
  progress: 78,
  counts: { covered: 8, needed: 12 },
  api: { current: 39000, target: 50000 },
  contributions: {
    '1': { state: 'pending', reason: 'Will count if settled by Nov 30' },
    '2': { state: 'pending', reason: 'Awaiting settlement' },
    '3': { state: 'pending', reason: 'Awaiting settlement' },
    '4': { state: 'counts', value: 21600 },
    '5': { state: 'counts', value: 48000 },
    '6': { state: 'excluded', reason: 'Policy lapsed' }
  }
};

function summarizePipeline(policies) {
  const summary = {};
  for (const stage of PIPELINE_STAGES) {
    if (stage.key === 'closed') {
      const closed = policies.filter((p) => ['lapsed', 'ntu', 'denied'].includes(p.status));
      summary[stage.key] = { count: closed.length, api: closed.reduce((s, p) => s + p.api, 0) };
    } else {
      const inStage = policies.filter((p) => p.status === stage.key);
      summary[stage.key] = { count: inStage.length, api: inStage.reduce((s, p) => s + p.api, 0) };
    }
  }
  return summary;
}

function fmtTTD(n) {
  if (n >= 1_000_000) return `TTD ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `TTD ${(n / 1_000).toFixed(1)}K`;
  return `TTD ${n.toLocaleString()}`;
}

// ──────────────────────────────────────────────────────────────────────────
// PipelineStrip — 5 tiles + total YTD hero
// ──────────────────────────────────────────────────────────────────────────
function ContributionBadge({ t, contribution }) {
  const s = contribution.state;
  const cfg = s === 'counts' ?
  { fg: t.success, bg: t.successTint, icon: '✓', label: `COUNTS · TTD ${(contribution.value / 1000).toFixed(1)}K` } :
  s === 'pending' ?
  { fg: t.warning, bg: t.warningTint, icon: '◯', label: 'PENDING' } :
  { fg: t.inkFaint, bg: t.surfaceMute, icon: '✕', label: 'EXCLUDED' };
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999,
      background: cfg.bg, color: cfg.fg,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
      fontFamily: APP_FONT_MONO
    }}>
      <span style={{ fontSize: 11 }}>{cfg.icon}</span>
      {cfg.label}
    </div>);

}

function CampaignProgressStrip({ t, lens, mobile = false }) {
  return (
    <div className="a-card a-rise" style={{
      padding: mobile ? '14px 16px' : '20px 22px',
      background: t.surface, border: `1px solid ${t.gold}66`, borderRadius: 14,
      display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden',
      boxShadow: `0 8px 24px rgba(245, 158, 11, 0.14)`
    }}>
      <div className="a-glow-soft" style={{
        position: 'absolute', top: -80, right: -80, width: 320, height: 320,
        background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 65%)`,
        pointerEvents: 'none'
      }}></div>

      <div style={{ position: 'relative' }}>
        <Eyebrow t={t} color={t.gold}>★ LENS · {lens.kind.toUpperCase()} PROOF</Eyebrow>
        <div style={{
          fontSize: mobile ? 20 : 24, fontWeight: 700, color: t.ink,
          letterSpacing: '-0.018em', lineHeight: 1.1, marginTop: 4, fontFamily: APP_FONT_DISPLAY
        }}>{lens.name}</div>
        <div style={{ fontSize: 11, color: t.inkMute, marginTop: 4, letterSpacing: '0.02em' }}>
          Viewing your policies through {lens.kind.toLowerCase()} eligibility rules
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, position: 'relative', flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{
            fontSize: mobile ? 32 : 38, fontWeight: 700, color: t.gold,
            letterSpacing: '-0.028em', lineHeight: 1, fontFamily: APP_FONT_DISPLAY
          }}>{lens.progress}%</div>
          <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.1em', marginTop: 5 }}>OF GOAL</div>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ height: 8, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
            <div className="a-progress-grow" style={{
              width: `${lens.progress}%`, height: 8,
              background: `linear-gradient(90deg, ${t.gold}, ${t.tealLight})`,
              borderRadius: 999, transformOrigin: 'left center'
            }}></div>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 8,
            fontSize: 10, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em',
            flexWrap: 'wrap', gap: 6
          }}>
            <span>{lens.counts.covered}/{lens.counts.needed} settled · TTD {(lens.api.current / 1000).toFixed(0)}K of {(lens.api.target / 1000).toFixed(0)}K</span>
            <span style={{ color: t.gold, fontWeight: 700 }}>{lens.endsIn}</span>
          </div>
        </div>
      </div>

      {!mobile &&
      <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <div style={{
          padding: '9px 14px', background: t.surface, border: `1px solid ${t.rule}`,
          color: t.inkMute, borderRadius: 9, fontSize: 12, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
        }}>
            Switch lens <IconChevD size={11} color={t.inkMute} stroke={2.4} />
          </div>
          <div style={{
          padding: '9px 16px', background: t.teal, color: '#fff', borderRadius: 9,
          fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6,
          boxShadow: `0 2px 6px ${t.teal}44`, whiteSpace: 'nowrap'
        }}>
            <IconDownload size={13} color="#fff" /> Export proof
          </div>
        </div>
      }

      {mobile &&
      <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <div style={{
          flex: 1, padding: '10px 12px', background: t.surface, border: `1px solid ${t.rule}`,
          color: t.inkMute, borderRadius: 9, fontSize: 11.5, fontWeight: 700, textAlign: 'center'
        }}>Switch lens</div>
          <div style={{
          flex: 1.4, padding: '10px 12px', background: t.teal, color: '#fff', borderRadius: 9,
          fontSize: 11.5, fontWeight: 700, textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: `0 2px 6px ${t.teal}44`
        }}>
            <IconDownload size={12} color="#fff" /> Export proof
          </div>
        </div>
      }
    </div>);

}

function PipelineStrip({ t, summary, mobile = false }) {
  const totalAPI = Object.values(summary).reduce((s, v) => s + v.api, 0);
  const inFlightAPI = summary.submitted.api + summary.rated.api + summary.settled.api;

  return (
    <div className="a-card a-rise" style={{
      padding: mobile ? '14px 16px' : '20px 22px',
      background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14,
      display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden'
    }}>
      <div className="a-glow-soft" style={{
        position: 'absolute', top: -80, right: -80, width: 320, height: 320,
        background: `radial-gradient(circle, ${t.tealTint} 0%, transparent 65%)`,
        pointerEvents: 'none'
      }}></div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', position: 'relative', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Eyebrow t={t}>Your policy pipeline</Eyebrow>
          <div style={{
            fontSize: mobile ? 22 : 26, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.018em', lineHeight: 1.1, marginTop: 4, fontFamily: APP_FONT_DISPLAY
          }}>
            {POLICIES.length} policies in motion
          </div>
        </div>
        {!mobile &&
        <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10.5, color: t.inkFaint, fontWeight: 700, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>TOTAL · YTD</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: t.teal, letterSpacing: '-0.022em', lineHeight: 1, fontFamily: APP_FONT_DISPLAY, marginTop: 4 }}>
              {fmtTTD(totalAPI)}
            </div>
            <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 4 }}>
              {fmtTTD(inFlightAPI)} in flight
            </div>
          </div>
        }
      </div>

      {/* Stage tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? 'repeat(5, 1fr)' : 'repeat(5, 1fr)',
        gap: mobile ? 6 : 10, position: 'relative'
      }}>
        {PIPELINE_STAGES.map((stage, i) => {
          const data = summary[stage.key];
          const fg = statusFg(stage.status, t);
          const bg = statusBg(stage.status, t);
          return (
            <div key={stage.key} className={`a-fade-up a-d-${i + 1}`} style={{
              padding: mobile ? '10px 8px' : '14px 14px',
              background: t.surfaceSoft, border: `1px solid ${t.rule}`,
              borderRadius: 10,
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: fg, marginBottom: 8,
                boxShadow: stage.key !== 'closed' ? `0 0 6px ${fg}88` : 'none'
              }}></div>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: mobile ? '0.08em' : '0.12em',
                color: t.inkFaint, fontFamily: APP_FONT_MONO,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                minHeight: 11
              }}>{(mobile ? stage.shortLabel : stage.label).toUpperCase()}</div>
              <div style={{
                fontSize: mobile ? 18 : 22, fontWeight: 700, color: t.ink,
                letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 8,
                minHeight: mobile ? 18 : 22
              }}>{data.count}</div>
              <div style={{
                fontSize: mobile ? 9.5 : 10.5, color: t.inkMute, marginTop: 6,
                fontFamily: APP_FONT_MONO, letterSpacing: '0.02em',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
              }}>
                {fmtTTD(data.api)}
              </div>
            </div>);

        })}
      </div>

      {/* Flow bar — desktop only. Visualises commissionable / awaiting confirm / in-flight share. */}
      {!mobile && (() => {
        const confirmed = summary.confirmed.api;
        const settled = summary.settled.api;
        const inFlight = summary.submitted.api + summary.rated.api;
        const active = confirmed + settled + inFlight;
        if (active === 0) return null;
        const pct = (n) => (n / active) * 100;
        return (
          <div style={{ position: 'relative', marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>POLICY FLOW · ACTIVE BOOK</div>
              <div style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_SANS }}>
                <span style={{ color: t.ink, fontWeight: 700 }}>{fmtTTD(inFlight)}</span> in flight · push these to settle
              </div>
            </div>
            <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', background: t.surfaceMute, gap: 2 }}>
              {confirmed > 0 && (
                <div title={`Confirmed · ${fmtTTD(confirmed)}`} className="a-progress-grow" style={{
                  width: `${pct(confirmed)}%`, height: 14,
                  background: `linear-gradient(90deg, ${t.gold}, #f4cf69)`,
                  borderRadius: 999, transformOrigin: 'left center',
                }}></div>
              )}
              {settled > 0 && (
                <div title={`Awaiting confirm · ${fmtTTD(settled)}`} className="a-progress-grow a-d-1" style={{
                  width: `${pct(settled)}%`, height: 14,
                  background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`,
                  borderRadius: 999, transformOrigin: 'left center',
                }}></div>
              )}
              {inFlight > 0 && (
                <div title={`In flight · ${fmtTTD(inFlight)}`} className="a-progress-grow a-d-2" style={{
                  width: `${pct(inFlight)}%`, height: 14,
                  background: t.inkDim,
                  borderRadius: 999, transformOrigin: 'left center',
                }}></div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 9, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: t.gold }}></div>
                <span style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
                  COMMISSIONABLE · <span style={{ color: t.ink, fontWeight: 700 }}>{fmtTTD(confirmed)}</span> · {Math.round(pct(confirmed))}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: t.teal }}></div>
                <span style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
                  AWAITING CONFIRM · <span style={{ color: t.ink, fontWeight: 700 }}>{fmtTTD(settled)}</span> · {Math.round(pct(settled))}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: t.inkDim }}></div>
                <span style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
                  IN FLIGHT · <span style={{ color: t.ink, fontWeight: 700 }}>{fmtTTD(inFlight)}</span> · {Math.round(pct(inFlight))}%
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>);

}

// ──────────────────────────────────────────────────────────────────────────
// MiniLifecycle — small lifecycle indicator on each card
// ──────────────────────────────────────────────────────────────────────────
function MiniLifecycle({ t, status }) {
  const stages = ['submitted', 'rated', 'settled', 'confirmed'];
  const idx = stages.indexOf(status);
  const isClosed = ['lapsed', 'ntu', 'denied'].includes(status);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {stages.map((s, i) =>
      <React.Fragment key={s}>
          <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isClosed ? t.inkDim : i < idx ? t.teal : i === idx ? t.gold : 'transparent',
          border: !isClosed && i > idx ? `1.5px solid ${t.inkDim}` : 'none',
          boxShadow: !isClosed && i === idx ? `0 0 6px ${t.gold}88` : 'none'
        }}></div>
          {i < stages.length - 1 &&
        <div style={{
          width: 14, height: 1.5,
          background: !isClosed && i < idx ? t.teal : t.inkDim,
          opacity: !isClosed && i < idx ? 1 : 0.35
        }}></div>
        }
        </React.Fragment>
      )}
      {isClosed &&
      <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>
          CLOSED
        </span>
      }
    </div>);

}

// ──────────────────────────────────────────────────────────────────────────
// FilterRow — chips + search
// ──────────────────────────────────────────────────────────────────────────
function FilterRow({ t, activeFilter = 'all', mobile = false, lens = null }) {
  const filters = lens ?
  [
  { key: 'all', label: 'All', count: POLICIES.length },
  { key: 'counts', label: 'Counts', count: Object.values(lens.contributions).filter((c) => c.state === 'counts').length },
  { key: 'pending', label: 'Pending', count: Object.values(lens.contributions).filter((c) => c.state === 'pending').length },
  { key: 'excluded', label: 'Excluded', count: Object.values(lens.contributions).filter((c) => c.state === 'excluded').length }] :

  [
  { key: 'all', label: 'All', count: POLICIES.length },
  { key: 'inflight', label: 'In flight', count: POLICIES.filter((p) => ['submitted', 'rated', 'settled'].includes(p.status)).length },
  { key: 'attention', label: 'Action needed', count: POLICIES.filter((p) => p.status === 'settled').length },
  { key: 'confirmed', label: 'Confirmed', count: POLICIES.filter((p) => p.status === 'confirmed').length },
  { key: 'closed', label: 'Closed', count: POLICIES.filter((p) => ['lapsed', 'ntu', 'denied'].includes(p.status)).length }];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 8 : 12, flexWrap: 'wrap' }}>
      <div style={{
        display: 'flex', gap: 4, padding: 4,
        background: t.surfaceSoft, border: `1px solid ${t.rule}`,
        borderRadius: 10, flexWrap: mobile ? 'wrap' : 'nowrap'
      }}>
        {filters.map((f) => {
          const active = f.key === activeFilter;
          return (
            <div key={f.key} style={{
              padding: mobile ? '6px 10px' : '7px 13px',
              borderRadius: 7,
              fontSize: 12, fontWeight: 700, letterSpacing: '0.005em',
              background: active ? t.surface : 'transparent',
              color: active ? t.ink : t.inkMute,
              border: active ? `1px solid ${t.rule}` : 'none',
              boxShadow: active ? `0 1px 2px rgba(0,0,0,0.04)` : 'none',
              display: 'flex', alignItems: 'center', gap: 6,
              whiteSpace: 'nowrap', cursor: 'pointer'
            }}>
              {f.label}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '0 6px',
                background: active ? t.tealTint : 'transparent', color: active ? t.teal : t.inkFaint,
                borderRadius: 999, fontFamily: APP_FONT_MONO
              }}>{f.count}</span>
            </div>);

        })}
      </div>
      {!mobile &&
      <div style={{ flex: 1 }}></div>
      }
      {!mobile &&
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', background: t.surface, border: `1px solid ${t.rule}`,
        borderRadius: 9, width: 220
      }}>
          <IconSearch size={14} color={t.inkMute} />
          <div style={{ flex: 1, fontSize: 12.5, color: t.inkFaint }}>Search owner, plan…</div>
        </div>
      }
      {!mobile &&
      <div style={{
        padding: '8px 14px', background: t.teal, color: '#fff',
        borderRadius: 9, fontSize: 12.5, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        boxShadow: `0 2px 6px ${t.teal}44`
      }}>
          <IconPlus size={14} color="#fff" stroke={2.4} /> New policy
        </div>
      }
    </div>);

}

// ──────────────────────────────────────────────────────────────────────────
// PolicyCard — list row
// ──────────────────────────────────────────────────────────────────────────
function StatusPill({ t, status, label }) {
  const fg = statusFg(status, t);
  const bg = statusBg(status, t);
  return (
    <div style={{
      padding: '3px 9px', borderRadius: 999,
      background: bg, color: fg,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
      fontFamily: APP_FONT_MONO
    }}>{(label || status).toUpperCase()}</div>);

}

function PolicyCard({ t, p, animClass, active = false, onClick, mobile = false, contribution = null }) {
  const cashLabel = p.cash ? `TTD ${p.cash.toLocaleString()}` : '—';
  const showAction = p.status === 'settled' || p.status === 'rated';
  return (
    <div onClick={onClick} className={`a-card ${animClass || ''}`} style={{
      padding: mobile ? '14px 14px 12px' : '16px 18px 14px',
      background: t.surface, border: `1px solid ${active ? t.teal + '88' : t.rule}`,
      borderRadius: 12, cursor: 'pointer',
      boxShadow: active ? `0 0 0 1px ${t.teal}33` : 'none'
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: mobile ? 14 : 15, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em' }}>{p.owner}</div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              color: p.policyNumber ? t.inkMute : t.warning,
              fontFamily: APP_FONT_MONO
            }}>{p.policyNumber ? `#${p.policyNumber}` : '# PENDING'}</div>
          </div>
          <div style={{ fontSize: 11, color: t.inkMute, marginTop: 3 }}>
            {p.insured !== p.owner ? `Insured · ${p.insured} · ` : ''}{p.plan}
          </div>
        </div>
        <StatusPill t={t} status={p.status} />
      </div>

      {/* Mini lifecycle */}
      <div style={{ marginBottom: contribution ? 8 : 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <MiniLifecycle t={t} status={p.status} />
        {contribution && <ContributionBadge t={t} contribution={contribution} />}
      </div>

      {/* Detail row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: mobile ? 10 : 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{
            fontSize: 17, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.012em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1
          }}>{fmtTTD(p.api)}</div>
          <div style={{ fontSize: 9.5, color: t.inkFaint, marginTop: 3, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em' }}>API · {fmtTTD(p.premium)}/{p.freq}</div>
        </div>
        {!mobile &&
        <>
            <div style={{ width: 1, height: 22, background: t.rule }}></div>
            <div>
              <div style={{ fontSize: 11.5, color: t.ink }}>{p.source}</div>
              <div style={{ fontSize: 9.5, color: t.inkFaint, marginTop: 3, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em' }}>SOURCE</div>
            </div>
            <div style={{ width: 1, height: 22, background: t.rule }}></div>
            <div>
              <div style={{ fontSize: 11.5, color: t.ink }}>{cashLabel}</div>
              <div style={{ fontSize: 9.5, color: t.inkFaint, marginTop: 3, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em' }}>CASH W/ APP</div>
            </div>
          </>
        }
        <div style={{ flex: 1 }}></div>
        {showAction &&
        <div style={{
          padding: '6px 12px', background: t.tealTint, color: t.teal,
          border: `1px solid ${t.teal}33`, borderRadius: 8,
          fontSize: 11.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5
        }}>
            {p.status === 'settled' ? 'Pending manager' : `Move to ${STAGES[STAGES.findIndex((s) => s.key === p.status) + 1]?.label || 'next'}`}
            <IconChevR size={12} color={t.teal} stroke={2.4} />
          </div>
        }
        <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
          {p.written}
        </div>
      </div>
    </div>);

}

// ──────────────────────────────────────────────────────────────────────────
// LifecycleBar — full lifecycle visualization for drill drawer
// ──────────────────────────────────────────────────────────────────────────
function LifecycleBar({ t, status, dates }) {
  const idx = STAGES.findIndex((s) => s.key === status);
  const isClosed = ['lapsed', 'ntu', 'denied'].includes(status);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginTop: 8 }}>
      {STAGES.map((s, i) => {
        const isPast = !isClosed && i < idx;
        const isCurrent = !isClosed && i === idx;
        return (
          <React.Fragment key={s.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 80, position: 'relative', zIndex: 1 }}>
              <div className={isCurrent ? 'a-glow-soft' : ''} style={{
                width: 28, height: 28, borderRadius: '50%',
                background: isPast ? t.teal : isCurrent ? t.gold : t.surface,
                border: !isPast && !isCurrent ? `1.5px solid ${t.inkDim}` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isCurrent ? `0 0 0 4px ${t.goldTint}, 0 0 16px rgba(245,158,11,0.45)` : 'none'
              }}>
                {isPast && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                {isCurrent && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }}></div>}
              </div>
              <div style={{ fontSize: 11, color: isCurrent ? t.gold : isPast ? t.teal : t.inkFaint, fontWeight: 700, marginTop: 8, letterSpacing: '0.01em' }}>{s.label}</div>
              <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 2, letterSpacing: '0.04em' }}>
                {dates[s.key] || '—'}
              </div>
            </div>
            {i < STAGES.length - 1 &&
            <div style={{ flex: 1, height: 2, background: isPast ? t.teal : t.inkDim, opacity: isPast ? 1 : 0.3, marginTop: 13 }}></div>
            }
          </React.Fragment>);

      })}
    </div>);

}

// ──────────────────────────────────────────────────────────────────────────
// Drill drawer content
// ──────────────────────────────────────────────────────────────────────────
function PolicyDrillDetail({ t, policy, dropdownOpen = false }) {
  const isClosed = ['lapsed', 'ntu', 'denied'].includes(policy.status);
  const isConfirmed = policy.status === 'confirmed';
  const nextStage = STAGES[STAGES.findIndex((s) => s.key === policy.status) + 1];

  return (
    <>
      {/* Header */}
      <div style={{ padding: '22px 22px 16px', borderBottom: `1px solid ${t.rule}` }}>
        <Eyebrow t={t} color={statusFg(policy.status, t)}>Policy · {policy.product}</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY }}>
            {policy.owner}
          </div>
          <div style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
            color: policy.policyNumber ? t.inkMute : t.warning,
            fontFamily: APP_FONT_MONO,
            padding: '3px 8px',
            background: policy.policyNumber ? t.surfaceSoft : t.warningTint,
            border: `1px solid ${policy.policyNumber ? t.rule : t.warning + '33'}`,
            borderRadius: 999
          }}>{policy.policyNumber ? `#${policy.policyNumber}` : '# PENDING'}</div>
        </div>
        <div style={{ fontSize: 12, color: t.inkMute, marginTop: 6 }}>
          {policy.insured !== policy.owner ? `Insured · ${policy.insured} · ` : ''}{policy.plan}
        </div>

        {/* Status + API */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <StatusPill t={t} status={policy.status} />
          <div style={{ fontSize: 22, fontWeight: 700, color: t.teal, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{fmtTTD(policy.api)}</div>
          <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>API</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Lifecycle bar */}
        <div style={{ padding: '14px 22px 18px' }}>
          <Eyebrow t={t} color={t.inkMute}>Lifecycle</Eyebrow>
          <LifecycleBar t={t} status={policy.status} dates={policy.dates} />
        </div>

        {/* Manager confirmation card */}
        {isConfirmed && policy.confirmedBy &&
        <div style={{ padding: '0 22px 14px' }}>
            <div style={{
            padding: '12px 14px', background: t.goldTint, border: `1px solid ${t.gold}33`,
            borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12
          }}>
              <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: t.gold, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>Confirmed by {policy.confirmedBy}</div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>Settled value matches your submission</div>
              </div>
            </div>
          </div>
        }

        {/* Policy details grid */}
        <div style={{ padding: '4px 22px 18px' }}>
          <Eyebrow t={t} color={t.inkMute}>Details</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            {[
            { label: 'PRODUCT', value: `${policy.product} · ${policy.planClass}` },
            { label: 'PREMIUM', value: `${fmtTTD(policy.premium)}/${policy.freq}` },
            { label: 'API', value: fmtTTD(policy.api) },
            { label: 'SOURCE', value: policy.source },
            { label: 'CASH W/ APP', value: policy.cash ? `TTD ${policy.cash.toLocaleString()}` : 'None' },
            { label: 'WRITTEN', value: policy.written }].
            map((r) =>
            <div key={r.label} style={{
              padding: '10px 12px', background: t.surfaceSoft, border: `1px solid ${t.rule}`,
              borderRadius: 9
            }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{r.label}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, marginTop: 3, letterSpacing: '-0.005em' }}>{r.value}</div>
              </div>
            )}
          </div>
        </div>

        {/* History timeline */}
        <div style={{ padding: '4px 22px 22px' }}>
          <Eyebrow t={t} color={t.inkMute}>History</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 10, position: 'relative' }}>
            {Object.entries(policy.dates).reverse().map(([stage, date], i, arr) => {
              const fg = statusFg(stage, t);
              return (
                <div key={stage} style={{ display: 'flex', gap: 12, paddingBottom: i < arr.length - 1 ? 14 : 0, position: 'relative' }}>
                  {/* Connector line */}
                  {i < arr.length - 1 &&
                  <div style={{ position: 'absolute', left: 9, top: 22, bottom: 0, width: 2, background: t.rule }}></div>
                  }
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: fg, flexShrink: 0, marginTop: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: i === 0 ? `0 0 8px ${fg}44` : 'none', zIndex: 1, position: 'relative'
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }}></div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <StatusPill t={t} status={stage} />
                      <span style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>{date}</span>
                    </div>
                    <div style={{ fontSize: 11, color: t.inkMute, marginTop: 4 }}>
                      {stage === 'submitted' && 'Logged in policy ledger'}
                      {stage === 'rated' && 'Underwriting approved · standard rate'}
                      {stage === 'settled' && 'Issued · awaiting manager confirmation'}
                      {stage === 'confirmed' && `Manager confirmed · ${policy.confirmedBy || 'verified'}`}
                      {stage === 'lapsed' && 'Policy lapsed · premium not received'}
                    </div>
                  </div>
                </div>);

            })}
          </div>
        </div>
      </div>

      {/* Footer — transition action */}
      {!isClosed && !isConfirmed && nextStage &&
      <div style={{
        padding: '14px 22px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
      }}>
          <div style={{ fontSize: 11.5, color: t.inkMute, lineHeight: 1.4 }}>
            Next step: {nextStage.label.toLowerCase()}
          </div>
          {/* Split-button: primary action + dropdown for alternative transitions */}
          <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 9, boxShadow: `0 2px 6px ${t.teal}44`, position: 'relative' }}>
            <div style={{
              padding: '9px 14px 9px 16px', background: t.teal, color: '#fff',
              borderTopLeftRadius: 9, borderBottomLeftRadius: 9,
              fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6,
              whiteSpace: 'nowrap', cursor: 'pointer',
            }}>
              Move to {nextStage.label}
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.22)' }}></div>
            <div style={{
              padding: '9px 12px', background: t.teal, color: '#fff',
              borderTopRightRadius: 9, borderBottomRightRadius: 9,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
              <IconChevD size={14} color="#fff" stroke={2.6} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }} />
            </div>

            {/* Open dropdown menu */}
            {dropdownOpen && (
              <div className="a-fade-up" style={{
                position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
                minWidth: 240,
                background: t.surface, border: `1px solid ${t.ruleStrong}`,
                borderRadius: 11, padding: 6,
                boxShadow: t.mode === 'light'
                  ? '0 12px 28px rgba(40,37,29,0.16), 0 2px 6px rgba(40,37,29,0.08)'
                  : '0 12px 28px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.4)',
                zIndex: 30,
              }}>
                <div style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em',
                  color: t.inkFaint, fontFamily: APP_FONT_MONO,
                  padding: '8px 12px 6px',
                }}>OTHER STATUS</div>
                {[
                  { key: 'postponed', label: 'Postponed',     desc: 'Carrier paused for underwriting', tone: 'warning' },
                  { key: 'ntu',       label: 'Not Taken Up',  desc: 'Client withdrew the application', tone: 'danger' },
                  { key: 'denied',    label: 'Denied',        desc: 'Carrier declined the policy',     tone: 'danger' },
                  { key: 'lapsed',    label: 'Lapsed',        desc: 'Premium not received \u00b7 from Settled', tone: 'danger' },
                ].map((opt) => {
                  const fg = opt.tone === 'warning' ? t.warning : t.danger;
                  const bg = opt.tone === 'warning' ? t.warningTint : t.dangerTint;
                  return (
                    <div key={opt.key} style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', background: fg, flexShrink: 0,
                      }}></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em' }}>{opt.label}</div>
                        <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1, lineHeight: 1.35 }}>{opt.desc}</div>
                      </div>
                      <div style={{
                        padding: '2px 7px', borderRadius: 999,
                        background: bg, color: fg,
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO,
                      }}>{opt.label.split(' ').map(w => w[0]).join('').toUpperCase()}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      }
      {isConfirmed &&
      <div style={{
        padding: '14px 22px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft,
        fontSize: 11.5, color: t.inkMute
      }}>
          ✓ Lifecycle complete. Settled value locked in for awards + persistency.
        </div>
      }
    </>);

}

// ──────────────────────────────────────────────────────────────────────────
// Desktop composed screen
// ──────────────────────────────────────────────────────────────────────────
function PolicyLedgerV2({ t, drawerPolicyId = null, lens = null, drawerDropdownOpen = false }) {
  const summary = summarizePipeline(POLICIES);
  const drawerPolicy = drawerPolicyId ? POLICIES.find((p) => p.id === drawerPolicyId) : null;
  const subtitle = lens ?
  `Viewing through "${lens.name}" lens · 6 policies tracked` :
  'Marsha Singh · 6 policies tracked · YTD 2026';

  return (
    <AppShell t={t} active="ledger" title="Policy Ledger" subtitle={subtitle}>
      <div style={{ height: '100%', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {lens ?
            <CampaignProgressStrip t={t} lens={lens} /> :
            <PipelineStrip t={t} summary={summary} />}

            <FilterRow t={t} activeFilter={lens ? 'counts' : 'all'} lens={lens} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {POLICIES.map((p, i) =>
              <PolicyCard
                key={p.id}
                t={t}
                p={p}
                animClass={`a-fade-up a-d-${Math.min(i + 1, 8)}`}
                active={drawerPolicyId === p.id}
                contribution={lens?.contributions[p.id]} />

              )}
            </div>
          </div>
        </div>

        {drawerPolicy &&
        <>
            <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)',
            animation: 'app-fade-in 280ms ease both', zIndex: 20
          }}></div>
            <div className="a-card" style={{
            position: 'absolute', top: 0, right: 0, bottom: 0,
            width: 480, background: t.surface, borderLeft: `1px solid ${t.rule}`,
            boxShadow: t.mode === 'light' ? '-12px 0 32px rgba(40,37,29,0.08)' : '-12px 0 32px rgba(0,0,0,0.5)',
            zIndex: 21, display: 'flex', flexDirection: 'column',
            animation: 'kiosk-slide-r 320ms cubic-bezier(0.34, 1, 0.64, 1) both'
          }}>
              {/* Close bar — dedicated top strip so the close pill never overlaps header content */}
              <div style={{
              display: 'flex', justifyContent: 'flex-end',
              padding: '14px 14px 0', flexShrink: 0
            }}>
                <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 14px 8px 10px',
                background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`,
                borderRadius: 999, cursor: 'pointer',
                color: t.ink, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em'
              }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Close
                </div>
              </div>
              <PolicyDrillDetail t={t} policy={drawerPolicy} dropdownOpen={drawerDropdownOpen} />
            </div>
          </>
        }
      </div>
    </AppShell>);

}

// ──────────────────────────────────────────────────────────────────────────
// Mobile composed screen
// ──────────────────────────────────────────────────────────────────────────
function PolicyLedgerV2Mobile({ t, sheetPolicyId = null, lens = null }) {
  const summary = summarizePipeline(POLICIES);
  const sheetPolicy = sheetPolicyId ? POLICIES.find((p) => p.id === sheetPolicyId) : null;
  const sub = lens ? `${lens.name.toUpperCase()} · LENS` : '6 POLICIES · YTD 2026';

  return (
    <MFrame t={t}>
      <MHeader t={t} title="Policy Ledger" sub={sub} />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lens ?
          <CampaignProgressStrip t={t} lens={lens} mobile /> :
          <PipelineStrip t={t} summary={summary} mobile />}
          <FilterRow t={t} activeFilter={lens ? 'counts' : 'all'} mobile lens={lens} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {POLICIES.slice(0, 4).map((p, i) =>
            <PolicyCard key={p.id} t={t} p={p} animClass={`a-fade-up a-d-${i + 1}`} mobile contribution={lens?.contributions[p.id]} />
            )}
          </div>
        </div>
      </MContent>
      <MNav t={t} active="more" />

      {sheetPolicy &&
      <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 25, animation: 'app-fade-in 240ms ease both' }}></div>
          <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: 720, background: t.surface,
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          borderTop: `1px solid ${t.rule}`,
          boxShadow: '0 -12px 32px rgba(0,0,0,0.25)',
          zIndex: 26, display: 'flex', flexDirection: 'column',
          animation: 'kiosk-rise 320ms cubic-bezier(0.34, 1, 0.64, 1) both',
          overflow: 'hidden'
        }}>
            <div style={{ position: 'relative', padding: '12px 16px 6px' }}>
              <div style={{ width: 40, height: 4, background: t.inkDim, borderRadius: 999, margin: '0 auto' }}></div>
              <div style={{
              position: 'absolute', top: 8, right: 12,
              width: 32, height: 32, borderRadius: '50%',
              background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: t.ink, cursor: 'pointer'
            }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            </div>
            <PolicyDrillDetail t={t} policy={sheetPolicy} />
          </div>
        </>
      }
    </MFrame>);

}

Object.assign(window, { PolicyLedgerV2, PolicyLedgerV2Mobile, NOVEMBER_SPRINT_LENS });
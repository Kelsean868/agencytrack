// AgencyTrack — Kiosk campaign leaderboards. Dark theatrical panels that join
// the wall rotation when a campaign's "Show on kiosk" toggle is on.
//
// One template, two reads:
//   • qualify  (Christmas Campaign) — ranked by API; each agent shows the tier
//     they've reached + the gated prize. The room sees who's already won.
//   • placement (S·02 Closer's Cup) — ranked by apps; top three take the cash.
//
// Reads the live campaign DATA from campaigns-v2-shared (campaignById,
// resolveStanding, gateFor, rankByMetric, PERS_GATE) and renders it in the
// KIOSK token system. Money via ttdK. No app-token fonts used here.

const PAD_C = 60;

// Compact persistency-gate ribbon for the dark surface
function KioskGateRibbon({ gate }) {
  const tone = (g) => g.tone === 'success' ? KIOSK.success : g.tone === 'gold' ? KIOSK.gold : g.tone === 'warning' ? KIOSK.warning : KIOSK.danger;
  const hi = ['≥90%', '85–89%', '80–84%', '<80%'];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {gate.map((g, i) => {
        const c = tone(g);
        return (
          <div key={i} style={{ flex: 1, padding: '8px 10px', borderRadius: 10, background: g.tone === 'danger' ? 'rgba(224,122,106,0.08)' : `${c}1f`, border: `1px solid ${c}3a` }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: c, fontFamily: KIOSK_FONT_MONO }}>{hi[i]}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: c, fontFamily: KIOSK_FONT_DISPLAY, marginTop: 2 }}>{g.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function RefCampaignLeaderboard({ campaignId = 'xmas25' } = {}) {
  const c = (typeof campaignById === 'function' && campaignById(campaignId)) || null;
  if (!c) return <KioskFrame><div style={{ padding: 60, color: KIOSK.textMute }}>No campaign.</div></KioskFrame>;

  const isQualify = c.structure === 'qualify';
  const ranked = rankByMetric(c);
  const podium = ranked.slice(0, 3);
  const tail = ranked.slice(3, 7);
  const metricVal = (s) => c.metric === 'apps' ? `${s.apps}` : ttdK(s.api);
  const metricUnit = c.metric === 'apps' ? 'apps' : '';

  // Prize for a standing
  function prizeFor(s) {
    if (isQualify) {
      const r = resolveStanding(s, c.tiers);
      return r.qualified ? { label: r.tier.name, cash: r.cash, won: true } : { label: 'Not yet', cash: 0, won: false };
    }
    const place = c.placements.find((p) => p.rank === s.rank);
    const gate = gateFor(s.pers);
    return place ? { label: `${s.rank===1?'1st':s.rank===2?'2nd':'3rd'} place`, cash: Math.round(place.prize * gate.payout), won: true } : { label: '—', cash: 0, won: false };
  }

  const kindLabel = c.kind === 'Company' ? '★ Company campaign' : c.kind === 'Branch' ? '★ Branch campaign' : c.kind === 'Unit' ? '★ Unit campaign' : '★ Campaign';
  const maxMetric = c.metric === 'apps' ? ranked[0].apps : ranked[0].api;
  const targetForBar = isQualify && c.tiers.length ? (c.metric === 'apps' ? c.tiers[0].apps : c.tiers[0].api) : maxMetric;

  return (
    <KioskFrame>
      <div style={{ padding: `42px ${PAD_C}px 34px`, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        {/* Header */}
        <div className="k-fade-up" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <KioskEyebrow color={KIOSK.gold}>{kindLabel}</KioskEyebrow>
            <KioskTitle size={52}>{c.name}</KioskTitle>
            <div style={{ fontSize: 15, color: KIOSK.textMute, marginTop: 10, fontFamily: KIOSK_FONT_MONO }}>{c.scopeLabel} · {c.period}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 16px', background: 'rgba(242,106,85,0.14)', border: `1px solid ${KIOSK.hot}55`, borderRadius: 999 }}>
              <div className="k-pulse-dot" style={{ width: 9, height: 9, borderRadius: '50%', background: KIOSK.hot, boxShadow: `0 0 10px ${KIOSK.hotGlow}` }}></div>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: KIOSK.text, fontFamily: KIOSK_FONT_MONO }}>{c.daysLeft} DAYS LEFT</span>
            </div>
            <div style={{ fontSize: 13, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO }}>
              {isQualify ? `Qualify to win · ${ranked.filter((s)=>prizeFor(s).won).length} already in` : 'Top three take the cash'}
            </div>
          </div>
        </div>

        {/* Body — podium + tail (left), prize + gate (right) */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 22, minHeight: 0 }}>
          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
            {/* Podium */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr 1fr', gap: 12, alignItems: 'end' }}>
              {[podium[1], podium[0], podium[2]].map((s, i) => {
                if (!s) return <div key={i}></div>;
                const center = i === 1;
                const pr = prizeFor(s);
                const ringC = s.rank === 1 ? KIOSK.gold : s.rank === 2 ? KIOSK.silver : KIOSK.bronze;
                return (
                  <div key={s.name} className={center ? 'k-scale-in' : 'k-fade-up'} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    padding: center ? '22px 14px 18px' : '16px 12px 14px',
                    background: center ? 'rgba(232,183,62,0.10)' : KIOSK.bgSecondary,
                    border: `1px solid ${center ? KIOSK.gold + '55' : KIOSK.rule}`,
                    borderRadius: 18, backdropFilter: 'blur(8px)',
                  }}>
                    <Medal rank={s.rank} size={center ? 66 : 52} />
                    <Avatar name={s.name} size={center ? 60 : 48} ring={ringC} glowStrong={center} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: center ? 21 : 17, fontWeight: 700, color: KIOSK.text, fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.02em' }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO, marginTop: 2 }}>{s.unit}</div>
                    </div>
                    <div style={{ fontSize: center ? 30 : 24, fontWeight: 800, color: center ? KIOSK.gold : KIOSK.text, fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {metricVal(s)}<span style={{ fontSize: 13, color: KIOSK.textFaint, fontWeight: 600 }}> {metricUnit}</span>
                    </div>
                    {pr.won && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(232,183,62,0.16)', borderRadius: 999 }}>
                        <span style={{ fontSize: 12, color: KIOSK.gold }}>★</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: KIOSK.gold, fontFamily: KIOSK_FONT_MONO }}>{pr.label} · {ttdK(pr.cash)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tail */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
              {tail.map((s) => {
                const pr = prizeFor(s);
                const pct = Math.min(100, Math.round(((c.metric === 'apps' ? s.apps : s.api) / targetForBar) * 100));
                return (
                  <div key={s.name} className="k-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', background: KIOSK.bgSecondary, border: `1px solid ${KIOSK.rule}`, borderRadius: 12 }}>
                    <div style={{ width: 26, fontSize: 18, fontWeight: 800, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_DISPLAY }}>{s.rank}</div>
                    <Avatar name={s.name} size={38} />
                    <div style={{ width: 180, flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: KIOSK.text }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: KIOSK.textFaint, fontFamily: KIOSK_FONT_MONO }}>{s.unit}</div>
                    </div>
                    <div style={{ flex: 1, height: 8, background: 'rgba(244,239,227,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                      <div className="k-progress-grow" style={{ width: `${pct}%`, height: 8, background: pr.won ? `linear-gradient(90deg, ${KIOSK.tealDeep}, ${KIOSK.gold})` : `linear-gradient(90deg, ${KIOSK.tealDeep}, ${KIOSK.teal})`, borderRadius: 999 }}></div>
                    </div>
                    <div style={{ width: 96, textAlign: 'right', fontSize: 16, fontWeight: 800, color: KIOSK.text, fontFamily: KIOSK_FONT_DISPLAY }}>{metricVal(s)}</div>
                    <div style={{ width: 80, textAlign: 'right', fontSize: 12, fontWeight: 700, color: pr.won ? KIOSK.gold : KIOSK.textDim, fontFamily: KIOSK_FONT_MONO }}>{pr.won ? ttdK(pr.cash) : '—'}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT — prize + gate (+ objective for qualify) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
            {/* Prize headline */}
            <div className="k-slide-r" style={{ padding: '20px 22px', background: 'rgba(232,183,62,0.08)', border: `1px solid ${KIOSK.gold}44`, borderRadius: 18 }}>
              <KioskEyebrow color={KIOSK.gold}>★ The prize</KioskEyebrow>
              {isQualify ? (
                <>
                  <div style={{ fontSize: 34, fontWeight: 800, color: KIOSK.gold, fontFamily: KIOSK_FONT_DISPLAY, letterSpacing: '-0.025em', marginTop: 10, lineHeight: 1 }}>Up to {ttdK(c.tiers[0].cash)}</div>
                  <div style={{ fontSize: 14, color: KIOSK.textMute, marginTop: 8, lineHeight: 1.5 }}>
                    {c.tiers.length > 1 ? `${c.tiers.length} tiers — reach a level, win its cash${c.tiers[0].voucher ? ' + voucher' : ''}.` : `Settle the target and the prize is yours${c.tiers[0].perk ? ` — ${c.tiers[0].perk.toLowerCase()}` : ''}.`}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  {c.placements.map((p) => (
                    <div key={p.rank} style={{ flex: 1, textAlign: 'center', padding: '12px 6px', background: 'rgba(255,248,232,0.05)', border: `1px solid ${KIOSK.rule}`, borderRadius: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: p.rank===1?KIOSK.gold:p.rank===2?KIOSK.silver:KIOSK.bronze, fontFamily: KIOSK_FONT_MONO }}>{p.rank===1?'1ST':p.rank===2?'2ND':'3RD'}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: KIOSK.text, fontFamily: KIOSK_FONT_DISPLAY, marginTop: 4 }}>{ttdK(p.prize)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Objective (qualify/company) */}
            {c.objective && (
              <div className="k-slide-r" style={{ padding: '16px 20px', background: KIOSK.bgSecondary, border: `1px solid ${KIOSK.rule}`, borderRadius: 16 }}>
                <KioskEyebrow color={KIOSK.teal}>Branch progress</KioskEyebrow>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, marginBottom: 7 }}>
                  <span style={{ fontSize: 13, color: KIOSK.textMute, fontFamily: KIOSK_FONT_MONO }}>SETTLED API</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: KIOSK.tealBright, fontFamily: KIOSK_FONT_MONO }}>{Math.round((c.objective.apiNow / c.objective.api) * 100)}%</span>
                </div>
                <div style={{ height: 9, background: 'rgba(244,239,227,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                  <div className="k-progress-grow" style={{ width: `${Math.min(100, Math.round((c.objective.apiNow / c.objective.api) * 100))}%`, height: 9, background: `linear-gradient(90deg, ${KIOSK.tealDeep}, ${KIOSK.tealBright})`, borderRadius: 999 }}></div>
                </div>
                <div style={{ fontSize: 13, color: KIOSK.textMute, marginTop: 8, fontFamily: KIOSK_FONT_MONO }}>{ttdK(c.objective.apiNow)} <span style={{ color: KIOSK.textDim }}>of {ttdK(c.objective.api)}</span></div>
              </div>
            )}

            {/* Persistency gate */}
            {c.gate && (
              <div className="k-slide-r" style={{ padding: '16px 20px', background: KIOSK.bgSecondary, border: `1px solid ${KIOSK.gold}33`, borderRadius: 16 }}>
                <KioskEyebrow color={KIOSK.gold}>★ Persistency gate</KioskEyebrow>
                <div style={{ fontSize: 12.5, color: KIOSK.textMute, margin: '8px 0 12px', lineHeight: 1.5 }}>Every payout scales by quality. Below 80% disqualifies.</div>
                <KioskGateRibbon gate={c.gate} />
              </div>
            )}
          </div>
        </div>
      </div>
    </KioskFrame>
  );
}

// Convenience wrappers — the two flagged for the wall
function RefCampaignCompany()  { return <RefCampaignLeaderboard campaignId="xmas25" />; }
function RefCampaignManager()  { return <RefCampaignLeaderboard campaignId="s02-cup" />; }

Object.assign(window, { RefCampaignLeaderboard, RefCampaignCompany, RefCampaignManager, KioskGateRibbon });

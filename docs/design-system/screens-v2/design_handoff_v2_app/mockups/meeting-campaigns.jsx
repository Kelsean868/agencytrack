// AgencyTrack — Meeting Mode campaign slide. Joins the Monday stand-up run of
// show (after "Within reach") for any campaign whose "Show in meeting" toggle
// is on. Projection-scale leaderboard inside the MeetingStage frame.
//
// Composes MeetingStage + MeetingFooter (from meeting-v2-shared) directly so it
// stays decoupled from the 15-step composer. Reads live campaign data from
// campaigns-v2-shared. Same app-token vocabulary as the rest of the meeting.

function CampaignMeetingBody({ t, campaignId }) {
  const c = campaignById(campaignId);
  if (!c) return null;
  const isQualify = c.structure === 'qualify';
  const ranked = rankByMetric(c).slice(0, 6);
  const accent = c.accent === 'gold' ? t.gold : t.teal;

  function resolveRow(s) {
    if (isQualify) {
      const r = resolveStanding(s, c.tiers);
      return { won: r.qualified, label: r.tier ? r.tier.name : 'below', cash: r.cash, gate: r.gate };
    }
    const place = c.placements.find((p) => p.rank === s.rank);
    const gate = gateFor(s.pers);
    return { won: !!place, label: place ? `${s.rank}${s.rank===1?'st':s.rank===2?'nd':'rd'}` : '—', cash: place ? Math.round(place.prize * gate.payout) : 0, gate };
  }

  const kindLabel = c.kind === 'Company' ? 'Company campaign' : c.kind === 'Branch' ? 'Branch campaign' : c.kind === 'Unit' ? 'Unit campaign' : 'Campaign';

  return (
    <div style={{ flex: 1, minHeight: 0, padding: '30px 40px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.gold, fontFamily: APP_FONT_MONO }}>★ {kindLabel}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO }}>· {c.daysLeft} days left</span>
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: t.ink, letterSpacing: '-0.025em', fontFamily: APP_FONT_DISPLAY, marginTop: 8, lineHeight: 1 }}>{c.name}</div>
          <div style={{ fontSize: 15, color: t.inkMute, marginTop: 8 }}>{c.scopeLabel} · {isQualify ? 'qualify to win — not a race' : 'top three take the cash'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{isQualify ? 'TOP PRIZE' : '1ST PLACE'}</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 4 }}>{ttd(isQualify ? c.tiers[0].cash : c.placements[0].prize)}</div>
        </div>
      </div>

      {/* Body: standings (left) + prize/gate (right) */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 22 }}>
        {/* Standings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0 }}>
          {ranked.map((s) => {
            const r = resolveRow(s);
            const gateC = r.gate.tone === 'success' ? t.success : r.gate.tone === 'gold' ? t.gold : r.gate.tone === 'warning' ? t.warning : t.danger;
            return (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 18px', background: r.won ? t.goldTint : t.surface, border: `1px solid ${r.won ? t.gold + '44' : t.rule}`, borderRadius: 13 }}>
                <div style={{ width: 28, fontSize: 22, fontWeight: 800, color: s.rank <= 3 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{s.rank}</div>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: r.won ? t.gold : t.tealTint, color: r.won ? '#fff' : t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{s.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.ink }}>{s.name}</div>
                  <div style={{ fontSize: 12.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{s.unit}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: gateC, fontFamily: APP_FONT_MONO }}>{s.pers}%</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: gateC, fontFamily: APP_FONT_MONO, padding: '2px 7px', borderRadius: 999, background: r.gate.tone === 'danger' ? t.dangerTint : `${gateC}1f` }}>{r.gate.label}</span>
                </div>
                <div style={{ width: 110, textAlign: 'right', fontSize: 20, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>
                  {c.metric === 'apps' ? `${s.apps}` : ttd(s.api)}
                </div>
                <div style={{ width: 96, textAlign: 'right', fontSize: 14, fontWeight: 700, color: r.won ? t.gold : t.inkDim, fontFamily: APP_FONT_MONO }}>{r.won ? ttd(r.cash) : '—'}</div>
              </div>
            );
          })}
        </div>

        {/* Prize + gate + objective */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
          <div style={{ padding: '18px 20px', background: t.goldTint, border: `1px solid ${t.gold}44`, borderRadius: 15 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', color: t.gold, fontFamily: APP_FONT_MONO }}>★ THE PRIZE</span>
            {isQualify ? (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {c.tiers.slice(0, 4).map((tr) => (
                  <div key={tr.level} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{tr.name}</span>
                    <span style={{ fontSize: 13, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{ttd(tr.api)} → <span style={{ color: t.gold, fontWeight: 700 }}>{ttd(tr.cash)}</span></span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 12, display: 'flex', gap: 9 }}>
                {c.placements.map((p) => (
                  <div key={p.rank} style={{ flex: 1, textAlign: 'center', padding: '12px 6px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: p.rank===1?t.gold:t.inkMute, fontFamily: APP_FONT_MONO }}>{p.rank===1?'1ST':p.rank===2?'2ND':'3RD'}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 4 }}>{ttd(p.prize)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {c.objective && (
            <div style={{ padding: '16px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 15 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', color: t.teal, fontFamily: APP_FONT_MONO }}>BRANCH PROGRESS</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '12px 0 7px' }}>
                <span style={{ fontSize: 13, color: t.inkMute, fontFamily: APP_FONT_MONO }}>SETTLED API</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: accent, fontFamily: APP_FONT_MONO }}>{Math.round((c.objective.apiNow / c.objective.api) * 100)}%</span>
              </div>
              <div style={{ height: 9, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Math.round((c.objective.apiNow / c.objective.api) * 100))}%`, height: 9, background: `linear-gradient(90deg, ${t.tealDark || t.teal}, ${accent})`, borderRadius: 999 }}></div>
              </div>
              <div style={{ fontSize: 13, color: t.inkMute, marginTop: 8, fontFamily: APP_FONT_MONO }}>{ttd(c.objective.apiNow)} of {ttd(c.objective.api)}</div>
            </div>
          )}

          {c.gate && (
            <div style={{ padding: '16px 20px', background: t.surface, border: `1px solid ${t.gold}33`, borderRadius: 15 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', color: t.gold, fontFamily: APP_FONT_MONO }}>★ PERSISTENCY GATE</span>
              <div style={{ display: 'flex', gap: 7, marginTop: 12 }}>
                {c.gate.map((g, i) => {
                  const gc = g.tone === 'success' ? t.success : g.tone === 'gold' ? t.gold : g.tone === 'warning' ? t.warning : t.danger;
                  const hi = ['≥90%', '85–89%', '80–84%', '<80%'][i];
                  return (
                    <div key={i} style={{ flex: 1, padding: '8px 6px', textAlign: 'center', borderRadius: 9, background: g.tone === 'danger' ? t.dangerTint : `${gc}1f`, border: `1px solid ${gc}3a` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: gc, fontFamily: APP_FONT_MONO }}>{hi}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: gc, fontFamily: APP_FONT_DISPLAY, marginTop: 2 }}>{g.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Standalone scene — composes the stage + footer so it slots into the run
// without editing the 15-step composer. step/total position the progress bar.
function CampaignMeetingScene({ t, campaignId = 'xmas25', chrome = true, step = 14, total = 16 }) {
  const c = campaignById(campaignId);
  const note = c && c.structure === 'placement'
    ? "Read the top three. Remind the room it's apps that win the Cup — and persistency that pays it."
    : "Name who's already qualified, then who's one good week away. The gate is real — quality, not just volume.";
  return (
    <MeetingStage t={t} step={step} total={total} phase="Campaign standings" mode="group"
      footer={<MeetingFooter t={t} step={step} total={total} note={chrome ? note : undefined} />}>
      <CampaignMeetingBody t={t} campaignId={campaignId} />
    </MeetingStage>
  );
}

Object.assign(window, { CampaignMeetingBody, CampaignMeetingScene });

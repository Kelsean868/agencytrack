// AgencyTrack — Campaigns v2. Agent mobile surfaces (390×844).
//   • AgentCampaignsList   — the campaigns I'm in, my progress in each
//   • AgentCampaignDetail  — one campaign from my seat: tier reached, gate
//                            health, prize locked, what's next.
// Agent POV = Marsha Singh (the standings leader). Uses MFrame + MNav.
// Gold = my prize / what I've locked · teal = progress & structure.

const AGENT_ME = 'Marsha Singh';

// My standing inside a campaign (resolved against its tiers/gate).
function myStanding(c) {
  const me = c.standings.find((s) => s.name === AGENT_ME);
  if (!me) return null;
  if (c.structure === 'qualify') return { ...resolveStanding(me, c.tiers), raw: me };
  const ranked = rankStandings(c);
  const mine = ranked.find((s) => s.name === AGENT_ME);
  const place = c.placements.find((p) => p.rank === mine.rank);
  const gate = gateFor(me.pers);
  return { ...mine, gate, place, cash: place ? Math.round(place.prize * gate.payout) : 0, qualified: !!place, raw: me };
}

// Next tier above the one reached (qualify only).
function nextTier(c, st) {
  if (c.structure !== 'qualify' || c.tiers.length < 2) return null;
  const idx = st.tier ? c.tiers.findIndex((tr) => tr.level === st.tier.level) : c.tiers.length;
  return idx > 0 ? c.tiers[idx - 1] : null;
}

// ── List item ─────────────────────────────────────────────────────────────
function AgentCampMiniCard({ t, c, onOpen }) {
  const st = myStanding(c);
  const accent = c.accent === 'gold' ? t.gold : t.teal;
  return (
    <div onClick={onOpen} className="a-card" style={{
      flexShrink: 0, padding: '15px 16px', background: t.surface,
      border: `1px solid ${c.state === 'ending' ? t.gold + '44' : t.rule}`, borderRadius: 15,
      position: 'relative', overflow: 'hidden',
    }}>
      {c.accent === 'gold' && <div className="a-glow-soft" style={{ position: 'absolute', top: -60, right: -50, width: 180, height: 180, background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <StateBadge t={t} state={c.state} />
        <KindBadge t={t} kind={c.kind} />
        <div style={{ flex: 1 }}></div>
        <span style={{ fontSize: 10, fontWeight: 700, color: c.state === 'ending' ? t.warning : t.inkFaint, fontFamily: APP_FONT_MONO }}>{c.daysLeft}D LEFT</span>
      </div>
      <div style={{ position: 'relative', fontSize: 17, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.15 }}>{c.name}</div>

      {/* My status line */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '11px 13px', background: st.qualified ? t.goldTint : t.surfaceSoft, border: `1px solid ${st.qualified ? t.gold + '44' : t.rule}`, borderRadius: 11 }}>
        {st.qualified
          ? <IconTrophy size={20} color={t.gold} />
          : <IconTarget size={20} color={t.teal} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>
            {c.structure === 'placement'
              ? (st.qualified ? `${ordinal(st.rank)} place · ${st.apps} apps` : `Rank ${st.rank}`)
              : (st.qualified ? `${st.tier.name} tier reached` : 'Not yet qualified')}
          </div>
          <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>
            {st.qualified ? `${ttd(st.cash)}${st.voucher ? ` + ${ttd(st.voucher)} voucher` : ''} locked` : `${c.metric === 'apps' ? st.raw.apps + ' apps' : ttd(st.raw.api)} so far`}
          </div>
        </div>
        <span style={{ transform: '', display: 'inline-flex' }}><IconChevR size={16} color={t.inkFaint} stroke={2.4} /></span>
      </div>
    </div>
  );
}

function ordinal(n) { return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`; }

// ── AGENT LIST SCENE ──────────────────────────────────────────────────────
function AgentCampaignsList({ t, onOpen }) {
  const mine = CAMPAIGNS.filter((c) => c.state !== 'completed' && c.standings.some((s) => s.name === AGENT_ME));
  const lockedTotal = mine.reduce((sum, c) => { const st = myStanding(c); return sum + (st.qualified ? st.cash : 0); }, 0);
  return (
    <MFrame t={t}>
      {/* Header */}
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '8px 18px 12px', background: t.surface, borderBottom: `1px solid ${t.rule}`, zIndex: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY }}>Campaigns</div>
        <div style={{ fontSize: 12, color: t.inkMute, marginTop: 1 }}>{mine.length} live · {ttd(lockedTotal)} locked in so far</div>
      </div>

      {/* Scroll body */}
      <div style={{ position: 'absolute', top: 110, left: 0, right: 0, bottom: 92, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Locked-in hero */}
        <div className="a-card a-rise" style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', padding: '16px 18px', background: t.surface, border: `1px solid ${t.gold}55`, borderRadius: 16 }}>
          <div className="a-glow-soft" style={{ position: 'absolute', top: -70, right: -50, width: 220, height: 220, background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
          <div style={{ position: 'relative' }}>
            <CEyebrow t={t} color={t.gold}>★ Locked in across campaigns</CEyebrow>
            <div style={{ fontSize: 38, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 8 }}>{ttd(lockedTotal)}</div>
            <div style={{ fontSize: 12, color: t.inkMute, marginTop: 6 }}>at your current persistency — keep it above 90% to bank the full amount.</div>
          </div>
        </div>

        {mine.map((c) => <AgentCampMiniCard key={c.id} t={t} c={c} onOpen={() => onOpen(c.id)} />)}
      </div>

      <MNav t={t} active="ranks" />
    </MFrame>
  );
}

// ── AGENT DETAIL SCENE ────────────────────────────────────────────────────
function AgentCampaignDetail({ t, id, onBack }) {
  const c = campaignById(id);
  const st = myStanding(c);
  const nt = nextTier(c, st);
  const ranked = rankStandings(c);
  const gateC = st.gate.tone === 'success' ? t.success : st.gate.tone === 'gold' ? t.gold : st.gate.tone === 'warning' ? t.warning : t.danger;
  const metricVal = c.metric === 'apps' ? st.raw.apps : st.raw.api;
  const gapToNext = nt ? nt.api - st.raw.api : 0;

  return (
    <MFrame t={t}>
      {/* Header */}
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '8px 16px 12px', background: t.surface, borderBottom: `1px solid ${t.rule}`, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div onClick={onBack} style={{ width: 32, height: 32, borderRadius: 9, background: t.surfaceSoft, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><IconChevR size={16} color={t.inkMute} stroke={2.4} /></span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
          <div style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{c.daysLeft} days left · {c.period.split('–')[1]}</div>
        </div>
      </div>

      {/* Scroll body */}
      <div style={{ position: 'absolute', top: 102, left: 0, right: 0, bottom: 92, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {/* My standing hero */}
        <div className="a-card a-rise" style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', padding: '18px 20px', background: t.surface, border: `1px solid ${t.gold}55`, borderRadius: 18 }}>
          <div className="a-glow-soft" style={{ position: 'absolute', top: -80, right: -50, width: 240, height: 240, background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
          <div style={{ position: 'relative' }}>
            <CEyebrow t={t} color={t.gold}>★ Your prize, locked in</CEyebrow>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 8 }}>
              <div style={{ fontSize: 40, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 0.95 }}>{ttd(st.cash)}</div>
              {st.voucher > 0 && <div style={{ fontSize: 14, color: t.inkMute, paddingBottom: 5 }}>+ {ttd(st.voucher)} voucher</div>}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 11, padding: '6px 12px', background: t.gold, color: '#fff', borderRadius: 999 }}>
              <IconTrophy size={13} color="#fff" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {c.structure === 'placement' ? `${ordinal(st.rank)} place` : `${st.tier.name} tier`}
              </span>
            </div>
          </div>
        </div>

        {/* Persistency gate health */}
        <div className="a-card" style={{ flexShrink: 0, padding: '15px 17px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 15 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
            <CEyebrow t={t} color={t.gold}>★ Persistency gate</CEyebrow>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: gateC, fontFamily: APP_FONT_MONO }}>You · {st.raw.pers}% → {st.gate.label}</span>
          </div>
          <PersGate t={t} gate={c.gate} current={st.raw.pers} compact />
          <div style={{ fontSize: 11, color: t.inkMute, marginTop: 11, lineHeight: 1.5 }}>
            {st.gate.payout === 1
              ? 'You\'re in the top band — every dollar of your prize pays out in full.'
              : `At ${st.raw.pers}% you'd bank ${st.gate.label} of the prize. Lift above 90% to unlock the full amount.`}
          </div>
        </div>

        {/* Next tier */}
        {nt && (
          <div className="a-card" style={{ flexShrink: 0, padding: '15px 17px', background: t.surface, border: `1px solid ${t.teal}33`, borderRadius: 15 }}>
            <CEyebrow t={t} color={t.teal}>Reach for {nt.name}</CEyebrow>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em' }}>{ttd(gapToNext)}</span>
              <span style={{ fontSize: 12, color: t.inkMute }}>more API for {ttd(nt.cash)}</span>
            </div>
            <div style={{ marginTop: 11, height: 7, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
              <div className="a-progress-grow" style={{ width: `${Math.min(100, Math.round((st.raw.api / nt.api) * 100))}%`, height: 7, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>
              <span>{ttd(st.raw.api)} now</span><span>{ttd(nt.api)} · {nt.name}</span>
            </div>
          </div>
        )}

        {/* Mini standings */}
        <div className="a-card" style={{ flexShrink: 0, padding: '15px 17px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 15 }}>
          <CEyebrow t={t} color={t.teal}>Where you stand</CEyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 11 }}>
            {ranked.slice(0, 5).map((s) => {
              const me = s.name === AGENT_ME;
              return (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: me ? t.goldTint : 'transparent', border: `1px solid ${me ? t.gold + '44' : 'transparent'}` }}>
                  <div style={{ width: 18, fontSize: 12, fontWeight: 700, color: s.rank <= 3 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{s.rank}</div>
                  <Ava t={t} initials={s.initials} size={28} tone={me ? 'gold' : 'teal'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: me ? 700 : 600, color: t.ink }}>{me ? 'You' : s.name}</div>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{c.metric === 'apps' ? `${s.apps}` : ttd(s.api)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: 10.5, color: t.inkFaint, fontStyle: 'italic', lineHeight: 1.5, padding: '0 4px 4px' }}>{c.prizeNote}</div>
      </div>

      <MNav t={t} active="ranks" />
    </MFrame>
  );
}

Object.assign(window, {
  AGENT_ME, myStanding, nextTier, ordinal,
  AgentCampMiniCard, AgentCampaignsList, AgentCampaignDetail,
});

// AgencyTrack — Campaigns v2. Desktop manager surfaces.
//   • CampaignsIndex     — manage all campaigns, grouped by state, + New
//   • CampaignDetail     — one campaign: objective, structure, live standings
//   • CampaignBuilder    — create / edit (scope · metric · structure · prizes)
//   • AwardWinners       — completed campaign: gate applied, confirm payouts
// All wrap ManagerShell (active='campaigns'). teal = ops · gold = prize layer.

// ── Sort standings by the campaign metric, attach rank ────────────────────
function rankStandings(c) {
  const key = c.metric === 'apps' ? 'apps' : 'api';
  return [...c.standings].sort((a, b) => b[key] - a[key]).map((s, i) => ({ ...s, rank: i + 1 }));
}

// ── New-campaign CTA button ───────────────────────────────────────────────
function NewCampaignBtn({ t, onClick }) {
  return (
    <div onClick={onClick} className="a-card" style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px',
      background: t.teal, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700,
      cursor: 'pointer', boxShadow: `0 2px 8px ${t.teal}44`, flexShrink: 0,
    }}>
      <IconPlus size={16} color="#fff" stroke={2.4} /> New campaign
    </div>
  );
}

// ── Index card ────────────────────────────────────────────────────────────
function CampaignCard({ t, c, onOpen }) {
  const ranked = rankStandings(c);
  const accent = c.accent === 'gold' ? t.gold : t.teal;
  const tintBorder = c.state === 'completed' ? `${t.gold}66` : c.accent === 'gold' ? `${t.gold}44` : t.rule;

  // Headline metric: qualified count (qualify) or leader (placement)
  let resolved = [];
  if (c.structure === 'qualify') resolved = ranked.map((s) => resolveStanding(s, c.tiers));
  const qualifiedCount = resolved.filter((r) => r.qualified).length;
  const leader = ranked[0];

  // Prize headline
  const prizeHead = c.structure === 'placement'
    ? `${ttd(c.placements[0].prize)} top prize`
    : c.tiers.length === 1
      ? `${ttd(c.tiers[0].cash)}${c.tiers[0].perk ? ' + perk' : ''} · qualify to win`
      : `Up to ${ttd(c.tiers[0].cash)} + voucher`;

  return (
    <div onClick={onOpen} className="a-card a-rise" style={{
      background: t.surface, border: `1px solid ${tintBorder}`, borderRadius: 16,
      padding: '18px 20px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0,
      boxShadow: c.state === 'ending' ? `0 8px 24px ${t.gold}1f` : undefined,
    }}>
      {c.accent === 'gold' && (
        <div className="a-glow-soft" style={{ position: 'absolute', top: -70, right: -60, width: 240, height: 240, background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
      )}

      {/* Header */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
          <StateBadge t={t} state={c.state} />
          <KindBadge t={t} kind={c.kind} />
          <div style={{ flex: 1 }}></div>
          <span style={{ fontSize: 10.5, color: c.state === 'ending' ? t.warning : t.inkFaint, fontWeight: 700, fontFamily: APP_FONT_MONO }}>
            {c.state === 'completed' ? 'CLOSED' : `${c.daysLeft}D LEFT`}
          </span>
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.15 }}>{c.name}</div>
        <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 3 }}>{c.scopeLabel} · {c.period}</div>
      </div>

      {/* Body — objective progress OR placement leader */}
      <div style={{ position: 'relative' }}>
        {c.objective ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' }}>
                {c.metric === 'apps' ? 'APPLICATIONS' : 'API TARGET'}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: accent, fontFamily: APP_FONT_MONO }}>
                {Math.round(((c.metric === 'apps' ? c.objective.appsNow : c.objective.apiNow) / (c.metric === 'apps' ? c.objective.apps : c.objective.api)) * 100)}%
              </span>
            </div>
            <div style={{ height: 7, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
              <div className="a-progress-grow" style={{
                width: `${Math.min(100, Math.round(((c.metric === 'apps' ? c.objective.appsNow : c.objective.apiNow) / (c.metric === 'apps' ? c.objective.apps : c.objective.api)) * 100))}%`,
                height: 7, background: `linear-gradient(90deg, ${t.tealDark}, ${accent})`, borderRadius: 999,
              }}></div>
            </div>
            <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 5, fontFamily: APP_FONT_MONO }}>
              {c.metric === 'apps'
                ? `${c.objective.appsNow} / ${c.objective.apps} apps`
                : `${ttd(c.objective.apiNow)} / ${ttd(c.objective.api)}`}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_MONO, width: 26 }}>1ST</div>
            <Ava t={t} initials={leader.initials} size={32} tone="gold" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{leader.name}</div>
              <div style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{leader.apps} apps · leading</div>
            </div>
          </div>
        )}
      </div>

      {/* Footer — qualified count + prize. Stacked so long prize copy never
          collides with the avatar stack on a narrow (1/3-width) card. */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 13, borderTop: `1px solid ${t.rule}` }}>
        {c.structure === 'qualify' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', flexShrink: 0 }}>
              {resolved.filter((r) => r.qualified).slice(0, 4).map((r, i) => (
                <div key={i} style={{ marginLeft: i ? -9 : 0, border: `2px solid ${t.surface}`, borderRadius: '50%' }}><Ava t={t} initials={r.initials} size={24} tone="gold" /></div>
              ))}
            </div>
            <span style={{ fontSize: 11.5, color: t.inkMute, whiteSpace: 'nowrap' }}>
              <span style={{ color: t.ink, fontWeight: 700 }}>{qualifiedCount}</span> qualified so far
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 11.5, color: t.inkMute }}><span style={{ color: t.ink, fontWeight: 700 }}>{ranked.length}</span> in the race</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: t.gold }}>
          <span style={{ display: 'inline-flex', flexShrink: 0 }}><IconTrophy size={14} color={t.gold} /></span>
          <span style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.3 }}>{prizeHead}</span>
        </div>
      </div>
    </div>
  );
}

// ── INDEX SCENE ─────────────────────────────────────────────────────────
function CampaignsIndex({ t, onOpen, onNew }) {
  const active = CAMPAIGNS.filter((c) => c.state === 'active' || c.state === 'ending');
  const completed = CAMPAIGNS.filter((c) => c.state === 'completed');
  const tabs = ['All campaigns', 'Mine', 'Company', 'Past'];

  return (
    <ManagerShell t={t} active="campaigns" title="Campaigns" subtitle="Time-boxed pushes toward a target — run your own, or track the company's.">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
        {/* Header strip */}
        <div className="a-card a-rise" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '15px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
          <div style={{ display: 'flex', gap: 22 }}>
            {[
              { k: 'RUNNING', v: active.length, c: t.success },
              { k: 'AWAITING WINNERS', v: completed.length, c: t.gold },
              { k: 'YOU RUN', v: CAMPAIGNS.filter((c) => c.owner.startsWith('You')).length, c: t.teal },
            ].map((s) => (
              <div key={s.k}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.c, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, marginTop: 4 }}>{s.k}</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }}></div>
          <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
            {tabs.map((tab, i) => (
              <div key={tab} style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                background: i === 0 ? t.surface : 'transparent', color: i === 0 ? t.teal : t.inkMute,
                border: i === 0 ? `1px solid ${t.rule}` : '1px solid transparent',
              }}>{tab}</div>
            ))}
          </div>
          <NewCampaignBtn t={t} onClick={onNew} />
        </div>

        {/* Scroll body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, paddingRight: 4 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <CEyebrow t={t} color={t.success}>● Running now</CEyebrow>
              <span style={{ fontSize: 11, color: t.inkFaint }}>{active.length} campaigns</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {active.map((c) => <CampaignCard key={c.id} t={t} c={c} onOpen={() => onOpen(c.id)} />)}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <CEyebrow t={t} color={t.gold}>★ Awaiting winners</CEyebrow>
              <span style={{ fontSize: 11, color: t.inkFaint }}>confirm payouts to release</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {completed.map((c) => <CampaignCard key={c.id} t={t} c={c} onOpen={() => onOpen(c.id)} />)}
            </div>
          </div>
        </div>
      </div>
    </ManagerShell>
  );
}

// ── Tier ladder (qualify structure) ───────────────────────────────────────
function TierLadder({ t, c, resolved }) {
  const multi = c.tiers.length > 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {c.tiers.map((tr) => {
        const reached = resolved.filter((r) => r.tier && r.tier.level === tr.level && r.qualified);
        return (
          <div key={tr.level} style={{
            display: 'flex', alignItems: 'center', gap: 13, padding: '11px 14px',
            background: reached.length ? t.goldTint : t.surfaceSoft,
            border: `1px solid ${reached.length ? t.gold + '44' : t.rule}`, borderRadius: 11,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: reached.length ? t.gold : t.surfaceMute, color: reached.length ? '#fff' : t.inkFaint,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, fontFamily: APP_FONT_DISPLAY,
            }}>{multi ? `L${tr.level}` : '✓'}</div>
            <div style={{ width: 150, flexShrink: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{tr.name}</div>
              <div style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO }}>
                {tr.api > 0 ? `${ttd(tr.api)} · ${tr.apps} apps` : `${tr.apps} apps`}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {reached.length ? reached.slice(0, 6).map((r, i) => (
                <div key={i} style={{ marginLeft: i ? -8 : 0, border: `2px solid ${t.goldTint}`, borderRadius: '50%' }}><Ava t={t} initials={r.initials} size={24} tone="gold" /></div>
              )) : <span style={{ fontSize: 11, color: t.inkFaint, fontStyle: 'italic' }}>none yet</span>}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY }}>{ttd(tr.cash)}</div>
              <div style={{ fontSize: 10, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{tr.voucher ? `+ ${ttd(tr.voucher)} voucher` : tr.perk || 'cash prize'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Placement podium (placement structure) ────────────────────────────────
function PlacementPodium({ t, c, ranked }) {
  const order = [ranked[1], ranked[0], ranked[2]]; // 2-1-3 podium order
  const heights = { 1: 96, 2: 72, 3: 56 };
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 14, padding: '8px 0 0' }}>
      {order.map((s) => {
        if (!s) return null;
        const place = c.placements.find((p) => p.rank === s.rank);
        const isFirst = s.rank === 1;
        return (
          <div key={s.rank} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 130 }}>
            <Ava t={t} initials={s.initials} size={isFirst ? 50 : 40} tone="gold" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: isFirst ? 13.5 : 12, fontWeight: 700, color: t.ink }}>{s.name}</div>
              <div style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{s.apps} apps</div>
            </div>
            <div style={{
              width: '100%', height: heights[s.rank], borderRadius: '10px 10px 0 0',
              background: isFirst ? `linear-gradient(180deg, ${t.gold}, ${t.gold}cc)` : t.goldTint,
              border: `1px solid ${t.gold}55`, borderBottom: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            }}>
              <div style={{ fontSize: isFirst ? 26 : 20, fontWeight: 800, color: isFirst ? '#fff' : t.gold, fontFamily: APP_FONT_DISPLAY }}>{s.rank}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: isFirst ? '#fff' : t.gold, fontFamily: APP_FONT_MONO }}>{ttd(place.prize)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Standings table ───────────────────────────────────────────────────────
function StandingsTable({ t, c, ranked, award = false }) {
  const isQualify = c.structure === 'qualify';
  return (
    <div style={{ border: `1px solid ${t.rule}`, borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', background: t.surfaceSoft, borderBottom: `1px solid ${t.rule}` }}>
        <div style={{ width: 30, fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>#</div>
        <div style={{ flex: 1, fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>ADVISOR</div>
        <div style={{ width: 110, textAlign: 'right', fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{c.metric === 'apps' ? 'APPS' : 'CAMPAIGN API'}</div>
        <div style={{ width: 90, textAlign: 'center', fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>PERSISTENCY</div>
        {isQualify && <div style={{ width: 110, textAlign: 'center', fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>TIER</div>}
        <div style={{ width: 120, textAlign: 'right', fontSize: 9, fontWeight: 700, color: t.gold, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{award ? 'PAYOUT' : 'PROJECTED'}</div>
      </div>
      {ranked.map((s, i) => {
        const r = isQualify ? resolveStanding(s, c.tiers) : null;
        const place = !isQualify ? c.placements.find((p) => p.rank === s.rank) : null;
        const gate = gateFor(s.pers);
        const gateC = gate.tone === 'success' ? t.success : gate.tone === 'gold' ? t.gold : gate.tone === 'warning' ? t.warning : t.danger;
        const win = isQualify ? r.qualified : !!place;
        const payout = isQualify ? r.cash + r.voucher : (place ? Math.round(place.prize * gate.payout) : 0);
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', padding: '10px 16px',
            background: i % 2 === 0 ? t.surface : t.surfaceSoft,
            borderBottom: i < ranked.length - 1 ? `1px solid ${t.rule}` : 'none',
            opacity: gate.payout === 0 ? 0.62 : 1,
          }}>
            <div style={{ width: 30, fontSize: 13, fontWeight: 700, color: s.rank <= 3 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{s.rank}</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Ava t={t} initials={s.initials} size={30} tone={win ? 'gold' : 'teal'} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{s.name}</div>
                <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{s.unit}</div>
              </div>
            </div>
            <div style={{ width: 110, textAlign: 'right', fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>
              {c.metric === 'apps' ? s.apps : ttd(s.api)}
            </div>
            <div style={{ width: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: gateC, fontFamily: APP_FONT_MONO }}>{s.pers}%</span>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: gateC, fontFamily: APP_FONT_MONO, padding: '1px 5px', borderRadius: 999, background: gate.tone === 'danger' ? t.dangerTint : `${gateC}1f` }}>{gate.label}</span>
            </div>
            {isQualify && (
              <div style={{ width: 110, textAlign: 'center' }}>
                {r.tier ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.qualified ? t.gold : t.inkMute, fontFamily: APP_FONT_MONO }}>{r.tier.name}</span>
                ) : (
                  <span style={{ fontSize: 11, color: t.inkFaint, fontStyle: 'italic' }}>below L1</span>
                )}
              </div>
            )}
            <div style={{ width: 120, textAlign: 'right' }}>
              {gate.payout === 0 ? (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: t.danger, fontFamily: APP_FONT_MONO }}>DISQUALIFIED</span>
              ) : win ? (
                <span style={{ fontSize: 13.5, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY }}>{ttd(payout)}</span>
              ) : (
                <span style={{ fontSize: 11, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── DETAIL / STANDINGS SCENE ──────────────────────────────────────────────
function CampaignDetail({ t, id, onBack }) {
  const c = campaignById(id);
  const ranked = rankStandings(c);
  const resolved = c.structure === 'qualify' ? ranked.map((s) => resolveStanding(s, c.tiers)) : [];
  const accent = c.accent === 'gold' ? t.gold : t.teal;
  const isOwner = c.owner.startsWith('You') || c.kind === 'Unit';

  return (
    <ManagerShell t={t} active="campaigns" title="Campaigns" subtitle="Live standings & structure">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Back + actions */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>
            <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><IconChevR size={15} color={t.inkMute} stroke={2.4} /></span> All campaigns
          </div>
          <div style={{ flex: 1 }}></div>
          {isOwner && c.state !== 'completed' && (
            <>
              <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>Pause</div>
              <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12, fontWeight: 700, color: t.teal, cursor: 'pointer' }}>Edit campaign</div>
            </>
          )}
          {c.state === 'completed' && (
            <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: t.gold, color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: `0 2px 8px ${t.gold}55` }}>
              <IconTrophy size={14} color="#fff" /> Confirm winners
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, overflow: 'hidden' }}>
          {/* LEFT — hero + structure */}
          <div style={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 4 }}>
            {/* Hero */}
            <div className="a-card a-rise" style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', padding: '18px 20px', background: t.surface, border: `1px solid ${c.accent === 'gold' ? t.gold + '55' : t.rule}`, borderRadius: 16 }}>
              {c.accent === 'gold' && <div className="a-glow-soft" style={{ position: 'absolute', top: -80, right: -60, width: 280, height: 280, background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <StateBadge t={t} state={c.state} />
                <KindBadge t={t} kind={c.kind} />
              </div>
              <div style={{ position: 'relative', fontSize: 24, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.1 }}>{c.name}</div>
              <div style={{ position: 'relative', fontSize: 11.5, color: t.inkMute, marginTop: 5, lineHeight: 1.5 }}>
                {c.scopeLabel}<br />{c.period} · {c.lengthLabel} · by {c.owner}
              </div>
              {c.state !== 'completed' && (
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 12, padding: '7px 12px', background: c.state === 'ending' ? t.warningTint : t.tealTint, border: `1px solid ${c.state === 'ending' ? t.warning + '44' : t.teal + '33'}`, borderRadius: 9 }}>
                  <IconClock size={13} color={c.state === 'ending' ? t.warning : t.teal} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.state === 'ending' ? t.warning : t.teal }}>{c.daysLeft} days left to qualify</span>
                </div>
              )}
            </div>

            {/* Objective */}
            {c.objective && (
              <div className="a-card" style={{ flexShrink: 0, padding: '16px 18px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
                <CEyebrow t={t} color={t.teal}>Campaign objective</CEyebrow>
                <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
                  <ObjectiveBar t={t} label="SETTLED API" now={c.objective.apiNow} target={c.objective.api} fmt={ttd} accent={accent} />
                  <ObjectiveBar t={t} label="APPLICATIONS" now={c.objective.appsNow} target={c.objective.apps} fmt={(n) => n.toLocaleString()} accent={accent} />
                </div>
                <div style={{ marginTop: 14, paddingTop: 13, borderTop: `1px solid ${t.rule}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>COMPANY PERSISTENCY → {c.objective.pers}% GOAL</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: c.objective.persNow >= c.objective.pers ? t.success : t.warning, fontFamily: APP_FONT_MONO }}>{c.objective.persNow}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Persistency gate */}
            {c.gate && (
              <div className="a-card" style={{ flexShrink: 0, padding: '16px 18px', background: t.surface, border: `1px solid ${t.gold}44`, borderRadius: 14 }}>
                <CEyebrow t={t} color={t.gold}>★ Persistency gate</CEyebrow>
                <div style={{ fontSize: 11, color: t.inkMute, margin: '6px 0 12px', lineHeight: 1.5 }}>
                  Every payout is scaled by the advisor's average persistency for the period. Below 80% disqualifies.
                </div>
                <PersGate t={t} gate={c.gate} />
              </div>
            )}
          </div>

          {/* RIGHT — structure + standings */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 4 }}>
            <div className="a-card" style={{ flexShrink: 0, padding: '16px 18px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 13 }}>
                <CEyebrow t={t} color={t.gold}>{c.structure === 'qualify' ? '★ Prize ladder · qualify to win' : '★ Podium · top three win'}</CEyebrow>
                <span style={{ fontSize: 11, color: t.inkMute }}>{c.structure === 'qualify' ? `${c.tiers.length} tier${c.tiers.length > 1 ? 's' : ''}` : 'placement race'}</span>
              </div>
              {c.structure === 'qualify'
                ? <TierLadder t={t} c={c} resolved={resolved} />
                : <PlacementPodium t={t} c={c} ranked={ranked} />}
            </div>

            <div className="a-card" style={{ flexShrink: 0, padding: '16px 18px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 13 }}>
                <CEyebrow t={t} color={t.teal}>Live standings</CEyebrow>
                <span style={{ fontSize: 11, color: t.inkMute }}>{ranked.length} advisors · sorted by {METRIC_LABEL[c.metric].toLowerCase()}</span>
              </div>
              <StandingsTable t={t} c={c} ranked={ranked} />
              <div style={{ fontSize: 10.5, color: t.inkFaint, marginTop: 11, fontStyle: 'italic', lineHeight: 1.5 }}>{c.prizeNote}</div>
            </div>
          </div>
        </div>
      </div>
    </ManagerShell>
  );
}

Object.assign(window, {
  rankStandings, NewCampaignBtn, CampaignCard, CampaignsIndex,
  TierLadder, PlacementPodium, StandingsTable, CampaignDetail,
});

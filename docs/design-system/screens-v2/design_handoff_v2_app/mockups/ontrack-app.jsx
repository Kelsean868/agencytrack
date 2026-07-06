// AgencyTrack — the whole app, assembled. An Agent Home hub that ties the
// surfaces into one product, + an information-architecture map showing how
// every screen fits the loop (Plan → Work → Report → Compete → Recognize).
// Reuses app-mobile (MFrame), planner-shared, ontrack-shared, campaigns-v2,
// app-shell (Topbar/AmbientBg/Eyebrow/AgencyLogo), planner-desktop (frame).

// Simple app bottom-nav for the hub (Home · Planner · [+] · Game Plan · More).
function AppNav({ t, active = 'home' }) {
  const tabs = [
    { key: 'home', label: 'Home', Icon: IconHome },
    { key: 'planner', label: 'Planner', Icon: IconClock },
    { key: 'add', label: 'Log', Icon: IconPlus, fab: true },
    { key: 'plan', label: 'Game Plan', Icon: IconTarget },
    { key: 'more', label: 'More', Icon: IconGrid },
  ];
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 24, background: t.surface, borderTop: `1px solid ${t.rule}`, boxShadow: t.mode === 'light' ? '0 -2px 16px rgba(40,37,29,0.06)' : '0 -2px 16px rgba(0,0,0,0.4)', zIndex: 15 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', padding: '8px 8px 10px' }}>
        {tabs.map((tab) => {
          const on = active === tab.key;
          if (tab.fab) return (
            <div key={tab.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div className="a-fab-pulse" style={{ width: 58, height: 58, borderRadius: '50%', background: `linear-gradient(180deg, ${t.tealLight} 0%, ${t.teal} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginTop: -30, '--fab-glow-1': `${t.teal}66`, '--fab-glow-2': `${t.teal}55`, boxShadow: `0 6px 16px ${t.teal}66, 0 2px 4px rgba(40,37,29,0.18)`, border: `3px solid ${t.surface}` }}><tab.Icon size={25} color="#fff" stroke={2.5} /></div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.teal }}>{tab.label}</div>
            </div>
          );
          return (
            <div key={tab.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 54 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <tab.Icon size={21} color={on ? t.teal : t.inkFaint} stroke={2} />
                {on && <div style={{ position: 'absolute', inset: -7, background: t.tealTint, borderRadius: 999, zIndex: -1, width: 34, height: 34, top: -6.5, left: '50%', transform: 'translateX(-50%)' }} />}
              </div>
              <div style={{ fontSize: 10, fontWeight: on ? 700 : 600, color: on ? t.teal : t.inkMute }}>{tab.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AGENT HOME (mobile hub) ────────────────────────────────────────────────
function AgentHome({ t }) {
  const ot = OT;
  return (
    <MFrame t={t}>
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '12px 18px 10px', zIndex: 6, background: t.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: t.inkMute }}>Good morning,</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1.05 }}>Marsha</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.surface, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}><IconBell size={17} color={t.inkMute} /><div style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: '50%', background: t.danger, border: `2px solid ${t.surface}` }} /></div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY }}>MS</div>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 104, left: 0, right: 0, bottom: 0, overflow: 'hidden', padding: '0 18px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* On-Track band — the hero condensed, the front-and-center thing */}
          <div className="a-card" style={{ padding: '15px 16px', background: t.teal, borderRadius: 15, color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -30, width: 150, height: 150, background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 65%)' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, opacity: 0.85 }}>ON TRACK FOR · CHAMPION</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: APP_FONT_MONO, opacity: 0.85 }}>{ot.weeksLeft} WKS LEFT</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 7 }}>
                <div style={{ fontSize: 30, fontWeight: 700, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>{ttd(ot.gapApi)}</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>· {ot.gapApps} apps to the prize</div>
              </div>
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.14)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
                <IconBolt size={15} color="#fff" stroke={2.2} />
                <div style={{ flex: 1, fontSize: 11.5, fontWeight: 600 }}>This week: aim <b>2 C.I</b> · you've booked 1</div>
                <div style={{ fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>Game Plan <IconChevR size={12} color="#fff" stroke={2.4} /></div>
              </div>
            </div>
          </div>

          {/* Today (from planner) */}
          <div>
            <PLabel t={t} right={<span style={{ fontSize: 10.5, fontWeight: 700, color: t.teal }}>Open planner →</span>}>Today · 6 booked</PLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { time: '10:00', code: 'CI', who: 'Anand Maharaj', note: 'Whole Life close · TTD 18.4K' },
                { time: '1:30', code: 'AI', who: 'Nisha Persad', note: 'Referral · approach' },
              ].map((a, i) => (
                <div key={i} className="a-card" style={{ padding: '11px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, width: 40, flexShrink: 0 }}>{a.time}</div>
                  <ActChip t={t} type={a.code} size="s" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.who}</div>
                    <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Two nudges: fill the gap (hit-list) + persistency */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="a-card" style={{ padding: '13px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconRepeat size={16} color={t.teal} stroke={2} /></div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginTop: 9 }}>3 to call</div>
              <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2 }}>Hit-list · close the C.I gap</div>
            </div>
            <div className="a-card" style={{ padding: '13px 14px', background: t.warningTint, border: `1px solid ${t.warning}33`, borderRadius: 13 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: t.surface, color: t.warning, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconShield size={16} color={t.warning} stroke={2} /></div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginTop: 9 }}>88% → 90%</div>
              <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2 }}>Reinstate to bank full prize</div>
            </div>
          </div>

          {/* Quick links to the rest of the app */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { Icon: IconTarget, label: 'Money\nNeeds', c: t.gold },
              { Icon: IconBook, label: 'Policy\nLedger', c: t.teal },
              { Icon: IconTrophy, label: 'Campaigns', c: t.inkAccent },
              { Icon: IconChart, label: 'Reports', c: t.inkMute },
            ].map((q, i) => (
              <div key={i} className="a-card" style={{ padding: '12px 8px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <q.Icon size={20} color={q.c} stroke={1.9} />
                <div style={{ fontSize: 10, fontWeight: 700, color: t.ink, textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.2 }}>{q.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <AppNav t={t} active="home" />
    </MFrame>
  );
}

// ── WHOLE-APP MAP — the information architecture, grouped by the loop ───────
function AppMap({ t }) {
  const stages = [
    { stage: 'PLAN', tone: t.gold, q: 'Why & how much', surfaces: [
      { name: 'Money Needs', note: 'income → API → activity baseline', live: true },
      { name: 'Goals', note: 'company · branch · unit · personal' },
      { name: 'Game Plan / On-Track ★', note: 'campaign tier → this week\u2019s prescription', live: true, star: true },
    ]},
    { stage: 'WORK', tone: t.teal, q: 'Who & when', surfaces: [
      { name: 'Hit-list ★', note: 'prospects · cross-sell · reinstatements', live: true, star: true },
      { name: 'Planner', note: 'book the week · work the day', live: true },
      { name: 'Prep card', note: 'history · objections · confirm' },
    ]},
    { stage: 'REPORT', tone: t.inkAccent, q: 'What happened', surfaces: [
      { name: 'Daily Capture', note: 'log activity · pace vs target' },
      { name: 'Policy Ledger', note: 'submitted → settled API' },
      { name: 'Reconciliation', note: 'vs Tatil settlement report' },
      { name: 'Persistency', note: 'the quality gate + reinstatement lever' },
    ]},
    { stage: 'COMPETE', tone: t.warning, q: 'How am I tracking', surfaces: [
      { name: 'Campaigns', note: 'tiers · standings · persistency gate' },
      { name: 'Leaderboard / Kiosk', note: 'reconciled production only' },
    ]},
    { stage: 'RECOGNIZE', tone: t.success, q: 'Reward', surfaces: [
      { name: 'Awards', note: 'annual ruleset · projection' },
      { name: 'Payouts', note: 'campaign cash + vouchers' },
    ]},
  ];
  return (
    <div style={{ width: 1320, minHeight: 860, background: t.bg, color: t.ink, fontFamily: APP_FONT_SANS, position: 'relative', overflow: 'hidden', boxSizing: 'border-box', padding: '28px 32px' }}>
      <AmbientBg t={t} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <AgencyLogo size={30} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em' }}>AgencyTrack — one loop, end to end</div>
            <div style={{ fontSize: 12, color: t.inkMute, marginTop: 1 }}>Every surface is the same unit (a client interaction → a settled, persisting policy) at a different stage. ★ = the new connective tissue.</div>
          </div>
        </div>

        {/* the five stages as columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 18 }}>
          {stages.map((col, ci) => (
            <div key={ci} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: col.tone, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: APP_FONT_MONO }}>{ci + 1}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: col.tone, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{col.stage}</div>
              </div>
              <div style={{ fontSize: 10.5, color: t.inkFaint, marginBottom: 10, paddingLeft: 30 }}>{col.q}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.surfaces.map((s, si) => (
                  <div key={si} style={{ padding: '12px 13px', background: s.star ? `${col.tone}12` : t.surface, border: `1.5px solid ${s.star ? `${col.tone}66` : t.rule}`, borderRadius: 12, position: 'relative' }}>
                    {s.live && <div style={{ position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: '50%', background: col.tone }} />}
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, paddingRight: 14, letterSpacing: '-0.01em' }}>{s.name}</div>
                    <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 3, lineHeight: 1.35 }}>{s.note}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* the loop arrow + back-edges */}
        <div style={{ marginTop: 20, padding: '16px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Eyebrow t={t}>The loop</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, fontWeight: 600, color: t.inkMute }}>
              {['Money Needs / Campaign goal', 'this-week prescription', 'Hit-list', 'Planner', 'Settled in Ledger', 'Campaign tier × persistency gate', 'Prize → Award'].map((step, i, arr) => (
                <React.Fragment key={i}>
                  <span style={{ color: t.ink, fontWeight: 700 }}>{step}</span>
                  {i < arr.length - 1 && <IconArrowR size={13} color={t.teal} stroke={2.4} />}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: t.inkMute }}><span style={{ width: 18, height: 0, borderTop: `2px dashed ${t.warning}` }} /> persistency short → <b style={{ color: t.ink }}>reinstatement hit-list</b> (defends the gate)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: t.inkMute }}><span style={{ width: 18, height: 0, borderTop: `2px dashed ${t.teal}` }} /> settled production → <b style={{ color: t.ink }}>updates the prescription</b> (less to do next week)</div>
          </div>
        </div>

        {/* role note */}
        <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
          {[
            { r: 'Agent', d: 'runs the whole loop on a phone' },
            { r: 'Selling manager', d: 'same loop + Coach & Recruit streams + team coaching' },
            { r: 'Branch manager', d: 'aggregate on-track / at-risk across the unit, campaigns, events' },
          ].map((x, i) => (
            <div key={i} style={{ flex: 1, padding: '11px 14px', background: t.surfaceSoft, borderRadius: 11, border: `1px solid ${t.rule}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.ink }}>{x.r}</div>
              <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2 }}>{x.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AppNav, AgentHome, AppMap });

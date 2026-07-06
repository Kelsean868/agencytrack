// Production Report v2 — composed role views.
//
//   role = agent | unit | branch | sm
//   • agent → AgentProductionView (own production, rank, period breakdown)
//   • unit  → table scoped to the manager's unit (S·02)
//   • branch→ table scoped to the whole branch (all roster) + leaderboard
//   • sm    → branch-level table across all branches + agency totals
//
// Manager roles render in ManagerShell (active="production"); the agent renders
// in the agent AppShell (the report they pull from their dashboard/history).

// Build ranked production rows for a set of roster agents at a period.
function prodRows(agents, periodKey, meName) {
  return agents
    .map((a) => { const p = prodFor(a, periodKey); return { name: a.name, unit: a.unit, initials: a.initials, flag: a.flag, apps: p.apps, api: p.api, pers: p.pers, me: a.name === meName }; })
    .sort((x, y) => y.api - x.api)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

function sumRows(rows) {
  return { api: rows.reduce((s, r) => s + r.api, 0), apps: rows.reduce((s, r) => s + r.apps, 0), pers: Math.round(rows.reduce((s, r) => s + r.pers, 0) / (rows.length || 1)) };
}

// ── Control row: period toggle (left) · data source + download (right) ─────
function ProdControls({ t, period, scopeNote, dlLabel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
      <TimePeriodToggle t={t} active={period} />
      <div style={{ fontSize: 11.5, color: t.inkMute }}>{periodDef(period).sub}{scopeNote ? ` · ${scopeNote}` : ''}</div>
      <div style={{ flex: 1 }}></div>
      <DataSourceBadge t={t} period={period} />
      <DownloadReportBtn t={t} label={dlLabel} />
    </div>
  );
}

// ── AGENT VIEW ─────────────────────────────────────────────────────────────
function AgentProductionView({ t, period = 'month', meName = 'Carla Joseph' }) {
  const me = ROSTER.find((a) => a.name === meName) || ROSTER[6];
  const ranked = prodRows(ROSTER, period);
  const myRank = ranked.find((r) => r.name === meName);
  const mine = prodFor(me, period);
  const floor = { L1: 250_000, L2: 350_000, L3: 450_000, L4: 550_000 }[me.level];
  // neighbours around me for the mini board
  const idx = ranked.findIndex((r) => r.name === meName);
  const around = ranked.slice(Math.max(0, idx - 1), idx + 2);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ProdControls t={t} period={period} dlLabel="Download my report" />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14 }}>
        {/* Left — my production */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* hero */}
          <div className="a-rise" style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16, padding: '20px 22px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: t.teal, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, fontFamily: APP_FONT_DISPLAY }}>{me.initials}</div>
              <div>
                <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em' }}>{me.name}</div>
                <div style={{ fontSize: 12, color: t.inkMute }}>{me.unit} · {me.level} · {periodDef(period).label.toLowerCase()}</div>
              </div>
              <div style={{ flex: 1 }}></div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>BRANCH RANK</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY }}>{myRank.rank}<span style={{ fontSize: 13, color: t.inkMute }}> / 28</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 30, marginTop: 20 }}>
              {[{ k: 'NEW API', v: ttd(mine.api) }, { k: 'APPLICATIONS', v: mine.apps }, { k: 'PERSISTENCY', v: `${mine.pers}%` }].map((m) => (
                <div key={m.k}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{m.k}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.025em', marginTop: 4, lineHeight: 1 }}>{m.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* the 4 windows */}
          <div className="a-rise a-d-1" style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>WHAT I DID · WEEK → YEAR</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {PR_PERIODS.map((p) => {
                const v = prodFor(me, p.key);
                const on = p.key === period;
                return (
                  <div key={p.key} style={{ padding: '12px 13px', background: on ? t.tealTint : t.surface, border: `1px solid ${on ? t.teal + '55' : t.rule}`, borderRadius: 11 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: on ? t.teal : t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{p.label.toUpperCase()}</div>
                    <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 4 }}>{ttd(v.api)}</div>
                    <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2, fontFamily: APP_FONT_MONO }}>{v.apps} apps</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* vs floor */}
          <div className="a-rise a-d-2" style={{ flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 9 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>YEAR-TO-DATE VS {me.level} TENURE FLOOR</div>
              <div style={{ fontSize: 12.5, color: t.inkMute }}>{ttd(me.ytdApi)} of {ttd(floor)}</div>
            </div>
            <div style={{ position: 'relative', height: 9, background: t.surfaceMute, borderRadius: 999 }}>
              <div className="a-progress-grow" style={{ width: `${Math.min(100, Math.round((me.ytdApi / floor) * 100))}%`, height: 9, background: me.ytdApi >= floor ? `linear-gradient(90deg, ${t.tealDark}, ${t.teal})` : t.warning, borderRadius: 999 }}></div>
            </div>
            <div style={{ fontSize: 11.5, color: me.ytdApi >= floor ? t.success : t.warning, fontWeight: 600, marginTop: 9 }}>
              {me.ytdApi >= floor ? `✓ ${Math.round((me.ytdApi / floor) * 100)}% — above floor` : `${Math.round((me.ytdApi / floor) * 100)}% — keep pushing to clear floor`}
            </div>
          </div>
        </div>

        {/* Right — where I rank */}
        <div style={{ width: 300, flexShrink: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '16px 16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <IconTrophy size={15} color={t.gold} />
            <div style={{ fontSize: 10.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>WHERE YOU RANK</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {around.map((r) => (
              <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 10, background: r.me ? t.tealTint : 'transparent', border: r.me ? `1px solid ${t.teal}44` : '1px solid transparent' }}>
                <div style={{ width: 20, textAlign: 'center', fontSize: 14, fontWeight: 800, color: r.rank <= 3 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{r.rank}</div>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: r.me ? t.teal : t.tealTint, color: r.me ? '#fff' : t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: r.me ? 800 : 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.me ? 'You' : r.name}</div>
                  <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{r.unit}</div>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{ttd(r.api)}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 14, fontSize: 11.5, color: t.inkMute, lineHeight: 1.5 }}>
            You're <span style={{ color: t.ink, fontWeight: 700 }}>{myRank.rank}{myRank.rank === 1 ? 'st' : myRank.rank === 2 ? 'nd' : myRank.rank === 3 ? 'rd' : 'th'}</span> of 28 in {ANCHOR ? 'South Branch' : 'the branch'} this {period === 'year' ? 'year' : period}. {ttd(ranked[Math.max(0, idx - 1)].api - myRank.api)} behind the next spot.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MANAGER VIEW (unit / branch) ───────────────────────────────────────────
function TeamProductionView({ t, period = 'week', scope = 'branch' }) {
  const agents = scope === 'unit' ? ROSTER.filter((a) => a.unit === 'S·02') : ROSTER;
  const rows = prodRows(agents, period);
  const tot = sumRows(rows);
  const maxApi = Math.max(...rows.map((r) => r.api), 1);
  const scopeName = scope === 'unit' ? 'Unit S·02' : 'South Branch';
  const headcount = scope === 'unit' ? 10 : 28;
  const onPace = rows.filter((r) => !r.flag).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ProdControls t={t} period={period} scopeNote={`${scopeName} · ${headcount} agents`} dlLabel={scope === 'unit' ? 'Download unit report' : 'Download branch report'} />
      <ProdTotals t={t} items={[
        { k: 'NEW API', v: ttd(tot.api), accent: t.teal },
        { k: 'APPLICATIONS', v: tot.apps },
        { k: 'AVG PERSISTENCY', v: `${tot.pers}%`, color: tot.pers >= 85 ? t.success : t.warning },
        { k: 'ON PACE', v: `${onPace}`, sub: `of ${rows.length}`, color: t.success },
      ]} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14 }}>
        <ProductionTable t={t} rows={rows} period={period} maxApi={maxApi} />
        <RankedLeaderboard t={t} title={`TOP — ${periodDef(period).label.toUpperCase()}`} rows={rows} />
      </div>
    </div>
  );
}

// ── SALES-MANAGER VIEW (agency, by branch) ─────────────────────────────────
function AgencyProductionView({ t, period = 'week' }) {
  const rows = PR_BRANCHES
    .map((b) => { const p = branchProd(b, period); return { name: b.name, mgr: b.mgr, initials: b.initials, agents: b.agents, units: b.units, apps: p.apps, api: p.api, pers: p.pers, me: false }; })
    .sort((x, y) => y.api - x.api)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const tot = { api: rows.reduce((s, r) => s + r.api, 0), apps: rows.reduce((s, r) => s + r.apps, 0), agents: rows.reduce((s, r) => s + r.agents, 0), pers: Math.round(rows.reduce((s, r) => s + r.pers, 0) / rows.length) };
  const maxApi = Math.max(...rows.map((r) => r.api), 1);
  const lbRows = rows.map((r) => ({ name: r.name, mgr: r.mgr, initials: r.initials, api: r.api }));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ProdControls t={t} period={period} scopeNote={`All branches · ${tot.agents} agents`} dlLabel="Download agency report" />
      <ProdTotals t={t} items={[
        { k: 'AGENCY NEW API', v: ttd(tot.api), accent: t.teal },
        { k: 'APPLICATIONS', v: tot.apps },
        { k: 'AVG PERSISTENCY', v: `${tot.pers}%`, color: tot.pers >= 85 ? t.success : t.warning },
        { k: 'BRANCHES', v: `${rows.length}`, sub: `${tot.agents} agents` },
      ]} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14 }}>
        <BranchTable t={t} rows={rows} maxApi={maxApi} />
        <RankedLeaderboard t={t} title={`BRANCH RANK — ${periodDef(period).label.toUpperCase()}`} rows={lbRows} />
      </div>
    </div>
  );
}

// ── COMPOSERS ──────────────────────────────────────────────────────────────
function ProdReportDesktop({ t, role = 'branch', period }) {
  if (role === 'agent') {
    return (
      <AppShell t={t} active="history" title="Production Report" subtitle="Your settled production · pulled from your dashboard">
        <AgentProductionView t={t} period={period || 'month'} />
      </AppShell>
    );
  }
  const map = { unit: { active: 'production', title: 'Production Report', sub: 'Unit S·02 · Riaz Khan', persona: UM_PERSONA, teamView: true },
                branch: { active: 'production', title: 'Production Report', sub: 'South Branch · 2026', persona: MGR, teamView: true },
                sm: { active: 'production', title: 'Production Report', sub: 'All branches · Sales Manager', persona: MGR, teamView: true } };
  const cfg = map[role] || map.branch;
  return (
    <ManagerShell t={t} active="production" title={cfg.title} subtitle={cfg.sub} persona={cfg.persona} teamView={cfg.teamView}>
      {role === 'sm' ? <AgencyProductionView t={t} period={period || 'week'} />
        : <TeamProductionView t={t} period={period || 'week'} scope={role} />}
    </ManagerShell>
  );
}

// ── MOBILE (branch manager) ────────────────────────────────────────────────
function ProdReportMobile({ t, period = 'week' }) {
  const rows = prodRows(ROSTER, period);
  const tot = sumRows(rows);
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Production" sub="SOUTH BRANCH" />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* period chips */}
          <div style={{ display: 'flex', gap: 6 }}>
            {PR_PERIODS.map((p) => {
              const on = p.key === period;
              return <div key={p.key} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 9, fontSize: 11.5, fontWeight: 700, background: on ? t.teal : t.surfaceSoft, color: on ? '#fff' : t.inkMute, border: `1px solid ${on ? t.teal : t.rule}` }}>{p.short}</div>;
            })}
          </div>
          {/* totals */}
          <div className="a-card a-rise" style={{ padding: '15px 16px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{periodDef(period).label.toUpperCase()} · NEW API</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.025em', marginTop: 4 }}>{ttd(tot.api)}</div>
            <div style={{ fontSize: 12, color: t.inkMute, marginTop: 2 }}>{tot.apps} applications · {tot.pers}% avg persistency</div>
          </div>
          {/* download */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', background: t.teal, color: '#fff', borderRadius: 11, fontSize: 13, fontWeight: 700, boxShadow: `0 3px 10px ${t.teal}44` }}>
            <IconDownload size={15} color="#fff" /> Download branch report
          </div>
          {/* ranked list */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>RANKED · {periodDef(period).label.toUpperCase()}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {rows.slice(0, 8).map((r) => {
                const pill = flagPill(t, r.flag);
                return (
                  <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                    <div style={{ width: 18, textAlign: 'center', fontSize: 13, fontWeight: 800, color: r.rank <= 3 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{r.rank}</div>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                      <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{r.unit} · {r.apps} apps</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{ttd(r.api)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </MContent>
      <ManagerMNav t={t} active="home" />
    </MFrame>
  );
}

Object.assign(window, {
  prodRows, sumRows, ProdControls,
  AgentProductionView, TeamProductionView, AgencyProductionView,
  ProdReportDesktop, ProdReportMobile,
});

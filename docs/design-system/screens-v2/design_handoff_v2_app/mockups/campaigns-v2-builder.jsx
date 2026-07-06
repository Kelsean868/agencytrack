// AgencyTrack — Campaigns v2. Builder (create/edit) + Award winners.
//   • CampaignBuilder — scope · metric · structure · dates · prize ladder,
//     with a live preview. Scope is capped at the creator's tier (a Branch
//     Manager can't launch agency-wide — that option is locked).
//   • AwardWinners — a closed campaign with the persistency gate applied,
//     payouts computed, and a confirm-to-release panel.

// Draft the builder renders (a new South-Branch qualify campaign).
const BUILDER_DRAFT = {
  name: 'Q1 Fast Start', kind: 'Branch', state: 'draft', structure: 'qualify', metric: 'api',
  owner: 'You · Trevor Ramcharan', scopeLabel: 'South Branch · 28 advisors',
  period: '1 Jan – 31 Mar 2026', daysLeft: 90, lengthLabel: '3 months', accent: 'gold',
  kiosk: true, meeting: false,
  objective: { api: 4_200_000, apiNow: 0, apps: 420, appsNow: 0, pers: 85, persNow: 0 },
  gate: PERS_GATE,
  tiers: [
    { level: 3, name: 'Gold',   api: 250_000, apps: 20, cash: 10_000, voucher: 1_000 },
    { level: 2, name: 'Silver', api: 150_000, apps: 15, cash: 5_000,  voucher: 0 },
    { level: 1, name: 'Bronze', api: 75_000,  apps: 8,  cash: 2_000,  voucher: 0 },
  ],
  standings: [],
  prizeNote: 'Draft — not yet launched.',
};

// Segmented selector (single choice)
function Segments({ t, options, value }) {
  return (
    <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = o.key === value;
        const locked = o.locked;
        return (
          <div key={o.key} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700,
            background: on ? t.surface : 'transparent',
            color: locked ? t.inkDim : on ? t.teal : t.inkMute,
            border: on ? `1px solid ${t.rule}` : '1px solid transparent',
            boxShadow: on ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            cursor: locked ? 'not-allowed' : 'pointer',
          }}>
            {o.icon && <o.icon size={14} color={locked ? t.inkDim : on ? t.teal : t.inkMute} stroke={2} />}
            {o.label}
            {locked && <span style={{ fontSize: 9, fontWeight: 700, color: t.inkDim, fontFamily: APP_FONT_MONO, padding: '1px 5px', background: t.surfaceMute, borderRadius: 999 }}>SM+</span>}
          </div>
        );
      })}
    </div>
  );
}

function FieldLabel({ t, children, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: t.ink, letterSpacing: '0.02em' }}>{children}</span>
      {hint && <span style={{ fontSize: 10.5, color: t.inkFaint }}>{hint}</span>}
    </div>
  );
}

function CampaignBuilder({ t, onBack }) {
  const d = BUILDER_DRAFT;
  return (
    <ManagerShell t={t} active="campaigns" title="Campaigns" subtitle="New campaign">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Back + save */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>
            <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><IconChevR size={15} color={t.inkMute} stroke={2.4} /></span> All campaigns
          </div>
          <div style={{ flex: 1 }}></div>
          <div className="a-card" style={{ padding: '8px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>Save draft</div>
          <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: `0 2px 8px ${t.teal}44` }}>
            <IconBolt size={14} color="#fff" /> Launch campaign
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 18, overflow: 'hidden' }}>
          {/* LEFT — form */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 6 }}>
            {/* Basics */}
            <div className="a-card" style={{ flexShrink: 0, padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
              <CEyebrow t={t} color={t.teal}>1 · The basics</CEyebrow>
              <div style={{ marginTop: 14 }}>
                <FieldLabel t={t}>Campaign name</FieldLabel>
                <div style={{ padding: '11px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10, fontSize: 15, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{d.name}</div>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
                <div style={{ flex: 1 }}>
                  <FieldLabel t={t}>Starts</FieldLabel>
                  <div style={{ padding: '10px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10, fontSize: 13, color: t.ink, fontFamily: APP_FONT_MONO }}>01 Jan 2026</div>
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel t={t}>Ends</FieldLabel>
                  <div style={{ padding: '10px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10, fontSize: 13, color: t.ink, fontFamily: APP_FONT_MONO }}>31 Mar 2026</div>
                </div>
                <div style={{ width: 120 }}>
                  <FieldLabel t={t}>Length</FieldLabel>
                  <div style={{ padding: '10px 14px', background: t.tealTint, border: `1px solid ${t.teal}33`, borderRadius: 10, fontSize: 13, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO }}>3 months</div>
                </div>
              </div>
            </div>

            {/* Scope */}
            <div className="a-card" style={{ flexShrink: 0, padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
              <CEyebrow t={t} color={t.teal}>2 · Who's in it</CEyebrow>
              <div style={{ fontSize: 11, color: t.inkMute, margin: '6px 0 12px' }}>You can run campaigns at or below your level. Agency-wide is reserved for the Sales Manager.</div>
              <Segments t={t} value="branch" options={[
                { key: 'agency', label: 'Whole agency', icon: IconGrid, locked: true },
                { key: 'branch', label: 'South Branch', icon: IconUsers },
                { key: 'unit', label: 'A unit', icon: IconUsers },
                { key: 'picked', label: 'Hand-picked', icon: IconPlus },
                { key: 'individual', label: '1-on-1', icon: IconTarget },
              ]} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, padding: '10px 13px', background: t.tealTint, border: `1px solid ${t.teal}33`, borderRadius: 10 }}>
                <IconUsers size={16} color={t.teal} />
                <span style={{ fontSize: 12, color: t.ink }}><span style={{ fontWeight: 700 }}>28 advisors</span> across S·01, S·02, S·03 will be entered automatically.</span>
              </div>
            </div>

            {/* Metric + structure */}
            <div className="a-card" style={{ flexShrink: 0, padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
              <CEyebrow t={t} color={t.teal}>3 · What it measures</CEyebrow>
              <div style={{ marginTop: 13 }}>
                <FieldLabel t={t} hint="the number standings are ranked by">Metric</FieldLabel>
                <Segments t={t} value="api" options={[
                  { key: 'api', label: 'New API' },
                  { key: 'apps', label: 'Applications' },
                  { key: 'activity', label: 'Activity' },
                  { key: 'persistency', label: 'Persistency' },
                  { key: 'recruiting', label: 'Recruiting' },
                  { key: 'custom', label: 'Custom' },
                ]} />
              </div>
              <div style={{ marginTop: 16 }}>
                <FieldLabel t={t} hint="how advisors win">Structure</FieldLabel>
                <div style={{ display: 'flex', gap: 12 }}>
                  {[
                    { key: 'qualify', title: 'Qualify target', body: 'Hit a tier, win its prize. Everyone who reaches it wins — not a race.', on: true },
                    { key: 'placement', title: '1st · 2nd · 3rd', body: 'A race. The top three by the metric take the prizes.', on: false },
                  ].map((o) => (
                    <div key={o.key} style={{
                      flex: 1, padding: '13px 15px', borderRadius: 11, cursor: 'pointer',
                      background: o.on ? t.tealTint : t.surfaceSoft,
                      border: `1.5px solid ${o.on ? t.teal : t.rule}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${o.on ? t.teal : t.inkDim}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {o.on && <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.teal }}></div>}
                        </div>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{o.title}</span>
                      </div>
                      <div style={{ fontSize: 11, color: t.inkMute, marginTop: 6, lineHeight: 1.5 }}>{o.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Prize ladder editor */}
            <div className="a-card" style={{ flexShrink: 0, padding: '18px 20px', background: t.surface, border: `1px solid ${t.gold}44`, borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <CEyebrow t={t} color={t.gold}>4 · ★ Prize ladder</CEyebrow>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: t.teal, cursor: 'pointer' }}><IconPlus size={13} color={t.teal} stroke={2.4} /> Add tier</div>
              </div>
              <div style={{ fontSize: 11, color: t.inkMute, marginBottom: 13 }}>Each tier needs a target and a prize. Minimum apps keep it honest.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {d.tiers.map((tr) => (
                  <div key={tr.level} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: t.gold, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>L{tr.level}</div>
                    <div style={{ width: 110, fontSize: 13, fontWeight: 700, color: t.ink }}>{tr.name}</div>
                    <div style={{ display: 'flex', gap: 7, flex: 1 }}>
                      {[
                        { l: 'API', v: ttd(tr.api) },
                        { l: 'APPS', v: tr.apps },
                        { l: 'CASH', v: ttd(tr.cash), gold: true },
                        { l: 'VOUCHER', v: tr.voucher ? ttd(tr.voucher) : '—', gold: true },
                      ].map((f) => (
                        <div key={f.l} style={{ flex: 1, padding: '6px 9px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 8 }}>
                          <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>{f.l}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: f.gold ? t.gold : t.ink, fontFamily: APP_FONT_MONO, marginTop: 2 }}>{f.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Persistency gate */}
            <div className="a-card" style={{ flexShrink: 0, padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <CEyebrow t={t} color={t.gold}>5 · ★ Persistency gate</CEyebrow>
                  <div style={{ fontSize: 11, color: t.inkMute, marginTop: 5 }}>Scale payouts by quality. Standard company tiers — on by default.</div>
                </div>
                <div style={{ width: 44, height: 26, borderRadius: 999, background: t.teal, position: 'relative', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff' }}></div>
                </div>
              </div>
              <PersGate t={t} gate={d.gate} />
            </div>

            {/* Visibility — where the leaderboard broadcasts */}
            <div className="a-card" style={{ flexShrink: 0, padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, marginBottom: 8 }}>
              <CEyebrow t={t} color={t.teal}>6 · Where it shows</CEyebrow>
              <div style={{ fontSize: 11, color: t.inkMute, margin: '6px 0 13px' }}>Broadcast this campaign's live leaderboard on the branch wall display and/or inside the Monday meeting run-of-show. You can change this any time while it runs.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  { key: 'kiosk', icon: IconGrid, label: 'Kiosk wall display', sub: 'Rotates with the leaderboards on the branch TV', on: d.kiosk },
                  { key: 'meeting', icon: IconUsers, label: 'Meeting mode', sub: 'Adds a slide to the stand-up, after Within reach', on: d.meeting },
                ].map((row) => (
                  <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: row.on ? t.tealTint : t.surfaceSoft, border: `1px solid ${row.on ? t.teal + '44' : t.rule}`, borderRadius: 11 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: row.on ? t.teal : t.surfaceMute, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {row.icon ? <row.icon size={17} color={row.on ? '#fff' : t.inkFaint} /> : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{row.label}</div>
                      <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{row.sub}</div>
                    </div>
                    <div style={{ width: 44, height: 26, borderRadius: 999, background: row.on ? t.teal : t.surfaceMute, position: 'relative', flexShrink: 0, transition: 'background 160ms' }}>
                      <div style={{ position: 'absolute', top: 3, left: row.on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 160ms', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — live preview */}
          <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
            <CEyebrow t={t} color={t.inkFaint}>Live preview</CEyebrow>
            <CampaignCard t={t} c={d} onOpen={() => {}} />
            <div className="a-card" style={{ padding: '15px 17px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
              <CEyebrow t={t} color={t.teal}>At a glance</CEyebrow>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
                {[
                  ['Scope', 'South Branch · 28 advisors'],
                  ['Runs', '1 Jan – 31 Mar 2026 (3 mo)'],
                  ['Wins by', 'Qualify target · New API'],
                  ['Tiers', '3 · Bronze / Silver / Gold'],
                  ['Max prize', 'TTD 10K + TTD 1K voucher'],
                  ['Gate', '≥80% persistency required'],
                  ['Shows on', 'Kiosk wall'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 11.5, color: t.inkMute }}>{k}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: t.ink, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Awards link — the rule that ties campaigns to the annual awards */}
            <div className="a-card" style={{ padding: '13px 15px', background: t.goldTint, border: `1px solid ${t.gold}44`, borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IconBolt size={16} color={t.gold} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.ink }}>Counts toward annual awards</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>Settled API rolls into agents' Eagles Club / MDRT progress</div>
                </div>
                <div style={{ width: 44, height: 26, borderRadius: 999, background: t.gold, position: 'relative', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff' }}></div>
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: t.inkMute, lineHeight: 1.5, marginTop: 9, paddingTop: 9, borderTop: `1px solid ${t.gold}33` }}>
                Turn off to make this a <span style={{ color: t.ink, fontWeight: 600 }}>Standalone</span> campaign — its production won't roll into annual awards. Launch notifies all 28 advisors and pins it to their dashboards.
              </div>
            </div>
          </div>
        </div>
      </div>
    </ManagerShell>
  );
}

// ── AWARD WINNERS — closed campaign, gate applied, confirm payouts ────────
function AwardWinners({ t, id, onBack }) {
  const c = campaignById(id);
  const ranked = rankStandings(c);
  const resolved = ranked.map((s) => resolveStanding(s, c.tiers));
  const winners = resolved.filter((r) => r.qualified);
  const dq = resolved.filter((r) => !r.qualified);
  const totalCash = winners.reduce((s, r) => s + r.cash, 0);
  const totalVoucher = winners.reduce((s, r) => s + r.voucher, 0);

  return (
    <ManagerShell t={t} active="campaigns" title="Campaigns" subtitle="Confirm winners">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>
            <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><IconChevR size={15} color={t.inkMute} stroke={2.4} /></span> All campaigns
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, overflow: 'hidden' }}>
          {/* LEFT — summary + confirm */}
          <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 4 }}>
            <div className="a-card a-rise" style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', padding: '18px 20px', background: t.surface, border: `1px solid ${t.gold}55`, borderRadius: 16 }}>
              <div className="a-glow-soft" style={{ position: 'absolute', top: -80, right: -60, width: 280, height: 280, background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
              <div style={{ position: 'relative' }}>
                <StateBadge t={t} state="completed" />
                <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, marginTop: 10 }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 4 }}>{c.scopeLabel} · {c.period}</div>
              </div>
            </div>

            <div className="a-card" style={{ flexShrink: 0, padding: '16px 18px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
              <CEyebrow t={t} color={t.gold}>★ Payout summary</CEyebrow>
              <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
                <div style={{ flex: 1, padding: '12px 14px', background: t.goldTint, border: `1px solid ${t.gold}33`, borderRadius: 11 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{winners.length}</div>
                  <div style={{ fontSize: 10, color: t.inkMute, marginTop: 4 }}>advisors qualified</div>
                </div>
                <div style={{ flex: 1, padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{dq.length}</div>
                  <div style={{ fontSize: 10, color: t.inkMute, marginTop: 4 }}>fell short / DQ'd</div>
                </div>
              </div>
              <div style={{ marginTop: 14, paddingTop: 13, borderTop: `1px solid ${t.rule}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: t.inkMute }}>Total cash</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY }}>{ttd(totalCash)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: t.inkMute }}>Total vouchers</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY }}>{totalVoucher ? ttd(totalVoucher) : '—'}</span>
                </div>
              </div>
            </div>

            <GoldBanner t={t} title="Gate applied automatically" body="Payouts already scaled by each advisor's average persistency. Two advisors fell below 80% and are disqualified — review before you confirm." />

            <div className="a-card" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 16px', background: t.gold, color: '#fff', borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 14px ${t.gold}55` }}>
              <IconCheck size={16} color="#fff" stroke={2.4} /> Confirm &amp; release {ttd(totalCash)} to Dec run
            </div>
          </div>

          {/* RIGHT — final standings */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', paddingRight: 4 }}>
            <div className="a-card" style={{ padding: '16px 18px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 13 }}>
                <CEyebrow t={t} color={t.teal}>Final standings · gate applied</CEyebrow>
                <span style={{ fontSize: 11, color: t.inkMute }}>{ranked.length} advisors</span>
              </div>
              <StandingsTable t={t} c={c} ranked={ranked} award />
              <div style={{ fontSize: 10.5, color: t.inkFaint, marginTop: 11, fontStyle: 'italic', lineHeight: 1.5 }}>{c.prizeNote}</div>
            </div>
          </div>
        </div>
      </div>
    </ManagerShell>
  );
}

Object.assign(window, { BUILDER_DRAFT, Segments, FieldLabel, CampaignBuilder, AwardWinners });

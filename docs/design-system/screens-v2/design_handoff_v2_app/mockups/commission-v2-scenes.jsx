// Commission v2 — scenes (desktop + mobile wrappers, 4 artboards).
//
// Desktop uses AppShell with active="commission". Mobile uses MFrame +
// MHeader + MContent + MNav. Both render an AnchorStrip → tab pills →
// either CommGoalDecomp or CommModalTargeting.

// ──────────────────────────────────────────────────────────────────────────
// Sidebar active key — the repo's sidebar has 'commission' as a Tools item
// (IconBolt). We pass `active="commission"` so the sidebar highlights it.
// app-shell.jsx's Sidebar already wires this up.
// ──────────────────────────────────────────────────────────────────────────

function CommDesktopScene({ t, tab = 'goal', cadence = 'weekly', managerView = false }) {
  const data = COMM_SAMPLE;
  const decomp = commDecompose(managerView
    ? { ...data.decomp, incomeGoal: data.manager.suggestedIncomeGoal }
    : data.decomp);
  const headerTitle = managerView ? `${data.agent} · Commission planning` : 'Commission';
  const headerSub = managerView
    ? `Viewing as ${data.manager.name} · ${data.manager.role.toLowerCase()} · suggest a goal back`
    : `${data.agent} · ${data.year} planning · personal commitment goals`;
  return (
    <AppShell t={t} active="commission" title={headerTitle} subtitle={headerSub}>
      <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Manager view banner — appears above the anchor so the viewer never
            mistakes whose playground they're inside. */}
        {managerView && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px',
            background: t.goldTint, border: `1px solid ${t.gold}55`, borderRadius: 11,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: t.gold, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY,
              flexShrink: 0,
            }}>{data.manager.name.split(' ').slice(-1)[0][0]}{data.manager.name.split(' ')[0][0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em' }}>
                You're in {data.agent.split(' ')[0]}'s playground — your changes here become a <span style={{ color: t.gold }}>suggested goal</span>, not her commitment.
              </div>
              <div style={{ fontSize: 10, color: t.inkMute, marginTop: 2, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>
                MANAGER VIEW · {data.manager.name.toUpperCase()} · {data.manager.role.toUpperCase()}
              </div>
            </div>
            <div style={{
              padding: '6px 12px', background: t.surface, border: `1px solid ${t.rule}`,
              borderRadius: 999, color: t.inkMute,
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              EXIT VIEW
            </div>
          </div>
        )}

        <AnchorStrip
          t={t}
          anchor={data.anchor}
          goal={managerView ? data.manager.suggestedIncomeGoal : data.decomp.incomeGoal}
        />

        {/* Tab pills + scenarios row.
            In manager view, the chip set is "Marsha's commitment · Your suggestion" instead
            of the agent's saved scenarios — both rows live in the same slot, swapped by intent. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <CommTabPills t={t} active={tab} />
          {!managerView && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.14em' }}>SCENARIOS</span>
              {data.saved.map((s, i) => (
                <div key={s} style={{
                  padding: '6px 11px',
                  background: i === 1 ? t.tealTint : t.surfaceSoft,
                  border: i === 1 ? `1px solid ${t.teal}66` : `1px solid ${t.rule}`,
                  borderRadius: 999,
                  fontSize: 11, fontWeight: 700, color: i === 1 ? t.teal : t.inkMute,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  {i === 1 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.teal }}></span>}
                  {s}
                </div>
              ))}
              <div style={{
                padding: '6px 11px',
                background: t.surface, border: `1px dashed ${t.ruleStrong}`,
                borderRadius: 999, color: t.inkMute,
                fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <IconPlus size={11} color={t.inkMute} stroke={2.4} />
                Save scenario
              </div>
            </div>
          )}
          {managerView && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.14em' }}>VIEWING</span>
              <div style={{
                padding: '6px 11px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 999,
                fontSize: 11, fontWeight: 700, color: t.inkMute, display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.teal }}></span>
                Her commitment · {ttdWith(data.decomp.incomeGoal)}
              </div>
              <div style={{
                padding: '6px 11px', background: t.goldTint, border: `1px solid ${t.gold}55`, borderRadius: 999,
                fontSize: 11, fontWeight: 700, color: t.gold, display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.gold }}></span>
                Your suggestion · {ttdWith(data.manager.suggestedIncomeGoal)}
              </div>
            </div>
          )}
        </div>

        {/* Tab content */}
        {tab === 'goal' && <CommGoalDecomp t={t} data={data} decomp={decomp} cadence={cadence} managerView={managerView} />}
        {tab === 'modal' && <CommModalTargeting t={t} data={data} />}
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mobile scene
// ──────────────────────────────────────────────────────────────────────────
function CommMobileScene({ t, tab = 'goal', cadence = 'weekly' }) {
  const data = COMM_SAMPLE;
  const decomp = commDecompose(data.decomp);
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Commission" sub={`${data.year} PLANNING · ${data.weekShort}`} />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AnchorStrip t={t} anchor={data.anchor} goal={data.decomp.incomeGoal} mobile />
          {/* Compact tab pill row */}
          <div style={{
            display: 'flex', gap: 4, padding: 4,
            background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10,
          }}>
            {[
              { key: 'goal',  label: 'Goal decomp' },
              { key: 'modal', label: 'Modal targeting' },
            ].map(p => {
              const isActive = p.key === tab;
              return (
                <div key={p.key} style={{
                  flex: 1, padding: '7px 10px', borderRadius: 7,
                  background: isActive ? t.surface : 'transparent',
                  border: isActive ? `1px solid ${t.rule}` : '1px solid transparent',
                  color: isActive ? t.ink : t.inkMute,
                  fontSize: 11.5, fontWeight: 700, textAlign: 'center',
                  boxShadow: isActive ? '0 1px 2px rgba(40,37,29,0.04)' : 'none',
                }}>{p.label}</div>
              );
            })}
          </div>

          {tab === 'goal' && <CommGoalDecomp t={t} data={data} decomp={decomp} cadence={cadence} mobile />}
          {tab === 'modal' && <CommModalTargeting t={t} data={data} mobile />}
        </div>
      </MContent>
      <MNav t={t} active="more" />
    </MFrame>
  );
}

Object.assign(window, { CommDesktopScene, CommMobileScene });

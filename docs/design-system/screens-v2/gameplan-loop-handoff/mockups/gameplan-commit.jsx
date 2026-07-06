// Game Plan v2 — Step 4 · Review & Commit page (implements the Step 4 build sheet).
//
//   ReviewCommitPage — variant ∈ 'review' | 'confirm' | 'done'
//     review  : read-only plan recap (hero + per-line + 12-month) + consequence
//               + Goals cascade + the deliberate "Commit my plan" CTA.
//     confirm : the deliberate moment — recap table + Yes/Not-yet, over a dimmed plan.
//     done    : terminal committed state — dated seal, live target, loop 4/4·100%.
//
// Reads the existing drafts only (yearPlan + monthly + goalsCommitment); the
// real write (Goals personalCommitment + status flip) is annotated, not enacted.

function ReviewCommitPage({ t, data, mobile = false, variant = 'review' }) {
  const yp = data.yearPlan;
  const lines = yp.profiles.composite.lines;
  const totalApi = lines.reduce((s, l) => s + l.api, 0);
  const awardApi = lines.filter((l) => l.award).reduce((s, l) => s + l.api, 0);
  const awardPct = totalApi > 0 ? Math.round((awardApi / totalApi) * 100) : 0;
  const apps = data.goalsCommitment.apps;
  const commitApi = data.goalsCommitment.api;

  if (variant === 'confirm') return <CommitOverlay t={t} data={data} mobile={mobile} mode="confirm" body={<PlanReview t={t} data={data} lines={lines} totalApi={totalApi} awardApi={awardApi} awardPct={awardPct} apps={apps} commitApi={commitApi} mobile={mobile} dim />} />;
  if (variant === 'done')    return <CommitOverlay t={t} data={data} mobile={mobile} mode="done"    body={<PlanReview t={t} data={data} lines={lines} totalApi={totalApi} awardApi={awardApi} awardPct={awardPct} apps={apps} commitApi={commitApi} mobile={mobile} dim />} />;

  // ── review (default) ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: 16, alignItems: 'flex-start' }}>
        {/* LEFT — read-only plan recap */}
        <div style={{ flex: mobile ? undefined : 1.32, minWidth: 0, width: mobile ? '100%' : undefined, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: t.teal, background: t.tealTint, padding: '3px 8px', borderRadius: 999, fontFamily: APP_FONT_MONO }}>
              <IconClock size={10} color={t.teal} stroke={2.2} /> READ-ONLY
            </span>
            <span style={{ fontSize: 11, color: t.inkMute, lineHeight: 1.4 }}>
              Read from your drafts. To change a number, re-open <b style={{ color: t.ink }}>Year Plan</b> or <b style={{ color: t.ink }}>Monthly</b> — this screen reviews, it doesn't edit.
            </span>
          </div>
          <PlanReview t={t} data={data} lines={lines} totalApi={totalApi} awardApi={awardApi} awardPct={awardPct} apps={apps} commitApi={commitApi} mobile={mobile} />
        </div>

        {/* RIGHT — consequence + cascade + action */}
        <div style={{ flex: mobile ? undefined : 1, minWidth: 0, width: mobile ? '100%' : undefined, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <CommitMeansCard t={t} commitApi={commitApi} />
          <GoalsCascade t={t} commitApi={commitApi} />

          <div style={{ marginTop: mobile ? 0 : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, fontSize: 10.5, color: t.inkMute, lineHeight: 1.4 }}>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', color: t.success, background: t.successTint, padding: '2px 7px', borderRadius: 999, flexShrink: 0, fontFamily: APP_FONT_MONO }}>NO APPROVAL</span>
              <span>Your own layer — committing is immediate, no manager sign-off.</span>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <div style={{ padding: '12px 16px', borderRadius: 10, border: `1px solid ${t.ruleStrong}`, background: t.surface, color: t.inkMute, fontSize: 12.5, fontWeight: 700 }}>Back to plan</div>
              <div style={{ flex: 1, padding: '12px 16px', borderRadius: 10, background: t.teal, color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: `0 4px 14px ${t.teal}55` }}>
                <IconShield size={14} color="#fff" stroke={2.2} /> Commit my plan
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plan recap: hero + per-line + 12-month shape ──
function PlanReview({ t, data, lines, totalApi, awardApi, awardPct, apps, commitApi, mobile, dim = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13, opacity: dim ? 0.5 : 1, filter: dim ? 'saturate(0.7)' : 'none' }}>
      {/* hero */}
      <div style={{ border: `1px solid ${t.teal}55`, background: t.tealTint, borderRadius: 13, padding: '15px 16px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.teal, fontFamily: APP_FONT_MONO }}>Your {data.year} plan · annual target</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 7 }}>
          <span style={{ fontSize: 36, fontWeight: 700, color: t.teal, letterSpacing: '-0.03em', lineHeight: 1, fontFamily: APP_FONT_DISPLAY }}>{pTtd(commitApi)}</span>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: t.tealDark || t.teal, fontFamily: APP_FONT_MONO }}>API</span>
        </div>
        <div style={{ display: 'flex', gap: 22, marginTop: 13, flexWrap: 'wrap' }}>
          {[
            { k: `${apps}`, l: 'implied apps / yr' },
            { k: pTtd(data.money.commissionNeed), l: 'est. commission' },
            { k: `${awardPct}%`, l: 'award-eligible API' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.25 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em', fontFamily: APP_FONT_DISPLAY }}>{s.k}</span>
              <span style={{ fontSize: 11, color: t.inkMute }}>{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* per-line */}
      <div style={{ border: `1px solid ${t.rule}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: t.surfaceSoft, borderBottom: `1px solid ${t.rule}` }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.inkMute, fontFamily: APP_FONT_MONO }}>Per-line · from Year Plan</span>
          <span style={{ marginLeft: 'auto', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em', color: t.teal, fontFamily: APP_FONT_MONO }}>EDIT IN YEAR PLAN →</span>
        </div>
        {lines.map((l, i) => (
          <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 13px', borderTop: i ? `1px solid ${t.rule}` : 'none' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: toneColor(t, l.tone), flexShrink: 0 }}></span>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: t.ink }}>{l.label}</span>
            <span style={{ fontFamily: APP_FONT_MONO, fontSize: 10, color: t.inkFaint, width: 38, textAlign: 'right' }}>{l.pct}%</span>
            <span style={{ fontFamily: APP_FONT_DISPLAY, fontWeight: 700, fontSize: 13, width: 78, textAlign: 'right', letterSpacing: '-0.01em', color: t.ink }}>{pTtd(l.api)}</span>
            <span style={{ fontFamily: APP_FONT_MONO, fontSize: 10, color: t.inkMute, width: 54, textAlign: 'right' }}>{l.cases} cases</span>
          </div>
        ))}
      </div>

      {/* 12-month shape */}
      <div style={{ border: `1px solid ${t.rule}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: t.surfaceSoft, borderBottom: `1px solid ${t.rule}` }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.inkMute, fontFamily: APP_FONT_MONO }}>12-month shape · from Monthly Plan</span>
          <span style={{ marginLeft: 'auto', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em', color: t.teal, fontFamily: APP_FONT_MONO }}>EDIT IN MONTHLY →</span>
        </div>
        <div style={{ padding: '12px 13px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 54 }}>
            {data.monthly.months.map((m) => {
              const max = Math.max(...data.monthly.months.map((x) => x.target));
              const h = Math.max(4, (m.target / max) * 54);
              return <div key={m.m} style={{ flex: 1, height: h, borderRadius: '2px 2px 0 0', background: m.future ? t.ruleStrong : t.teal, opacity: m.future ? 0.55 : 0.85 }}></div>;
            })}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
            {data.monthly.months.map((m) => (
              <span key={m.m} style={{ flex: 1, fontFamily: APP_FONT_MONO, fontSize: 7, color: t.inkFaint, textAlign: 'center' }}>{m.m[0]}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── "What committing means" — plain-words consequence ──
function CommitMeansCard({ t, commitApi }) {
  return (
    <div style={{ border: `1px solid ${t.gold}55`, background: t.goldTint, borderRadius: 13, padding: '15px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.gold, fontFamily: APP_FONT_MONO }}>
        <IconAlert size={12} color={t.gold} stroke={2.2} /> What committing means
      </div>
      <div style={{ fontSize: 14, color: t.ink, marginTop: 9, lineHeight: 1.5 }}>
        This sets your <b>personal annual target</b> to <span style={{ fontFamily: APP_FONT_DISPLAY, fontWeight: 700, color: t.gold }}>{pTtd(commitApi)} API</span> and starts tracking you against it.
      </div>
      <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          'Writes your Personal Commitment into Goals — the target the app paces you against.',
          'Marks your plan committed — Game Plan reads 4 of 4, 100%.',
          'You can re-open and amend later.',
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11.5, color: t.inkMute, alignItems: 'flex-start' }}>
            <IconCheck size={12} color={t.gold} stroke={2.6} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Goals cascade — where the write lands ──
function GoalsCascade({ t, commitApi }) {
  const layers = [
    { n: 'Company Floor', v: 'set by HQ', mine: false },
    { n: 'Sales Manager', v: 'rolled down', mine: false },
    { n: 'Branch', v: 'rolled down', mine: false },
    { n: 'Unit', v: 'rolled down', mine: false },
    { n: 'Personal Commitment', v: pTtd(commitApi), mine: true },
  ];
  return (
    <div style={{ border: `1px solid ${t.rule}`, borderRadius: 13, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: t.surfaceSoft, borderBottom: `1px solid ${t.rule}` }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.inkMute, fontFamily: APP_FONT_MONO }}>Where it writes · Goals cascade</span>
        <span style={{ marginLeft: 'auto', fontSize: 8, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>5 LAYERS</span>
      </div>
      <div style={{ padding: '8px 13px' }}>
        {layers.map((l, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: l.mine ? '9px 13px' : '7px 0',
            background: l.mine ? t.tealTint : 'transparent',
            margin: l.mine ? '0 -13px' : 0,
            borderTop: l.mine ? `1px solid ${t.teal}44` : 'none',
            borderBottom: l.mine ? `1px solid ${t.teal}44` : 'none',
          }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginLeft: 3, background: l.mine ? t.teal : t.inkDim, boxShadow: l.mine ? `0 0 0 3px ${t.tealTint}` : 'none' }}></span>
            <span style={{ flex: 1, fontSize: l.mine ? 12.5 : 11.5, fontWeight: l.mine ? 700 : 400, color: l.mine ? (t.tealDark || t.teal) : t.inkMute }}>{l.n}</span>
            <span style={{ fontFamily: APP_FONT_MONO, fontSize: l.mine ? 11 : 9.5, fontWeight: l.mine ? 700 : 400, color: l.mine ? t.teal : t.inkFaint }}>{l.v}</span>
            {l.mine && <span style={{ fontFamily: APP_FONT_MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: '0.06em', color: '#fff', background: t.teal, padding: '2px 7px', borderRadius: 999, marginLeft: 8 }}>YOU WRITE THIS</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Confirm + Done overlays ──
function CommitOverlay({ t, data, mobile, mode, body }) {
  return (
    <div style={{ position: 'relative', minHeight: mobile ? undefined : 520 }}>
      {body}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(38,35,28,0.34)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 2, borderRadius: 12 }}>
        {mode === 'confirm' ? <ConfirmCard t={t} data={data} /> : <DoneCard t={t} data={data} />}
      </div>
    </div>
  );
}

function ConfirmCard({ t, data }) {
  const commitApi = data.goalsCommitment.api;
  return (
    <div style={{ width: 380, maxWidth: '94%', marginTop: 34, background: t.surface, border: `1px solid ${t.ruleStrong}`, borderRadius: 16, boxShadow: '0 24px 60px rgba(38,35,28,0.3)', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 14px', textAlign: 'center' }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 11px' }}>
          <IconShield size={22} color={t.teal} stroke={2} />
        </div>
        <div style={{ fontFamily: APP_FONT_DISPLAY, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: t.ink }}>Commit your {data.year} plan?</div>
        <div style={{ fontSize: 12.5, color: t.inkMute, marginTop: 7, lineHeight: 1.5 }}>
          Your personal annual target becomes <span style={{ fontFamily: APP_FONT_DISPLAY, fontWeight: 700, color: t.teal }}>{pTtd(commitApi)} API</span>. The app paces you against it all year. You can re-open and amend later.
        </div>
      </div>
      <div style={{ margin: '0 20px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {[
          ['Annual API target', pTtd(commitApi)],
          ['Implied apps / yr', `${data.goalsCommitment.apps}`],
          ['Writes to', 'Personal Commitment'],
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: t.inkMute }}>
            <span style={{ flex: 1 }}>{r[0]}</span>
            <span style={{ fontFamily: APP_FONT_MONO, fontWeight: 700, color: t.ink }}>{r[1]}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: t.inkMute }}>
          <span style={{ flex: 1 }}>Plan status</span>
          <span style={{ fontFamily: APP_FONT_MONO, fontWeight: 700, color: t.success }}>→ Committed</span>
        </div>
      </div>
      <div style={{ padding: '15px 20px 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ padding: 13, borderRadius: 11, background: t.teal, color: '#fff', fontSize: 13.5, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: `0 4px 14px ${t.teal}55` }}>
          <IconShield size={14} color="#fff" stroke={2.2} /> Yes — commit my plan
        </div>
        <div style={{ padding: 11, borderRadius: 11, border: `1px solid ${t.ruleStrong}`, background: t.surface, color: t.inkMute, fontSize: 12.5, fontWeight: 700, textAlign: 'center' }}>Not yet</div>
        <div style={{ fontFamily: APP_FONT_MONO, fontSize: 8.5, color: t.inkFaint, textAlign: 'center', lineHeight: 1.5 }}>Writes Goals + flips both plan statuses atomically · Trinidad time</div>
      </div>
    </div>
  );
}

function DoneCard({ t, data }) {
  const commitApi = data.goalsCommitment.api;
  return (
    <div style={{ width: 380, maxWidth: '94%', marginTop: 34, background: t.surface, border: `1px solid ${t.success}55`, borderRadius: 16, boxShadow: '0 24px 60px rgba(38,35,28,0.3)', overflow: 'hidden' }}>
      <div style={{ background: `linear-gradient(160deg, ${t.success}, ${t.success}cc)`, padding: '22px 20px 18px', textAlign: 'center', color: '#fff' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.16)', border: '2px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 11px' }}>
          <IconCheck size={26} color="#fff" stroke={2.6} />
        </div>
        <div style={{ fontFamily: APP_FONT_DISPLAY, fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>Plan committed</div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', marginTop: 6, fontFamily: APP_FONT_MONO, letterSpacing: '0.03em' }}>12 JUN {data.year} · 3:42 PM AST</div>
      </div>
      <div style={{ padding: '16px 20px 18px' }}>
        <div style={{ textAlign: 'center', paddingBottom: 14, borderBottom: `1px solid ${t.rule}` }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.inkFaint, fontFamily: APP_FONT_MONO }}>Your {data.year} personal commitment</div>
          <div style={{ fontFamily: APP_FONT_DISPLAY, fontWeight: 700, fontSize: 30, color: t.teal, letterSpacing: '-0.028em', marginTop: 5, lineHeight: 1 }}>{pTtd(commitApi)} API</div>
          <div style={{ fontSize: 11, color: t.inkMute, marginTop: 5 }}>Now live in Goals · the app is pacing you against it.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', color: t.inkFaint, fontFamily: APP_FONT_MONO }}>PLANNING LOOP</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.success, marginTop: 2 }}>Complete · 4 of 4</div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: `conic-gradient(${t.success} 100%, ${t.surfaceMute} 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: APP_FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: t.success }}>100%</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
          <div style={{ flex: 1, padding: 11, borderRadius: 10, background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, color: t.inkMute, fontSize: 12, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <IconRepeat size={12} color={t.inkMute} stroke={2.2} /> Re-open to amend
          </div>
          <div style={{ flex: 1, padding: 11, borderRadius: 10, background: t.teal, color: '#fff', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>Back to Game Plan</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ReviewCommitPage });

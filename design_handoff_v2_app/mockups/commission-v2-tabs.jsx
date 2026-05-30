// Commission v2 — tab contents.
//
// ActivityLadder        — the 7-stage cascade for Goal Decomposition.
// ModeMixSlider         — colored-region drag track for Modal Targeting.
// ModeBreakdownTiles    — 4-up tiles showing per-mode API + commission.
// CashFlowChart         — stacked-by-mode bars + cumulative line overlay.
// InsightCard           — commentary that reads the chosen mix.
// CommGoalDecomp        — full Goal Decomposition tab content (assumptions
//                          panel on the left, ladder on the right).
// CommModalTargeting    — full Modal Targeting tab content (target hero,
//                          mode-mix slider, breakdown tiles, cash flow,
//                          insight).

// ──────────────────────────────────────────────────────────────────────────
// Stage definitions for the activity ladder.
// Each stage knows: how to read its value from the decompose() result,
// the transform formula label, and the tone.
// ──────────────────────────────────────────────────────────────────────────
function buildLadderStages(t, decomp, cadence) {
  const cad = COMM_CADENCES.find(c => c.key === cadence) || COMM_CADENCES[0];
  const div = cad.div;
  const isCurrency = (key) => ['incomeGoal','apiToWrite','apiToSettle'].includes(key);
  return [
    { key: 'incomeGoal',  label: 'Income goal',     value: decomp.incomeGoal / div,   transform: 'starts here',              tone: t.gold, isCurrency: true },
    { key: 'apiToWrite',  label: 'API to write',    value: decomp.apiToWrite / div,   transform: '÷ commission × ÷ persistency', tone: t.teal, isCurrency: true, hero: true },
    { key: 'apiToSettle', label: 'API to settle',   value: decomp.apiToSettle / div,  transform: `× ${COMM_SAMPLE.decomp.settlementRate}% settlement rate`, tone: t.teal, isCurrency: true },
    { key: 'apps',        label: 'Applications',    value: decomp.apps / div,         transform: `÷ TTD ${ttdCompact(COMM_SAMPLE.decomp.avgPolicyAPI)} avg API per policy`, tone: t.teal },
    { key: 'cis',         label: 'Closing interviews', value: decomp.cis / div,       transform: `× ${COMM_SAMPLE.decomp.ciToSaleRatio} CIs per sale`, tone: t.ink, isHistory: true },
    { key: 'dials',       label: 'Dials',           value: decomp.dials / div,        transform: `× ${COMM_SAMPLE.decomp.dialsToCIRatio} dials per CI`,  tone: t.ink, isHistory: true },
    { key: 'prospects',   label: 'Prospects',       value: decomp.prospects / div,    transform: `× ${COMM_SAMPLE.decomp.prospectRatio} prospects per dial`, tone: t.inkMute },
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// ActivityLadder — vertical 7-stage cascade with transforms on connectors.
// Each row shows a number and the formula that produced it from the row above.
// ──────────────────────────────────────────────────────────────────────────
function ActivityLadder({ t, decomp, cadence = 'annual', mobile = false }) {
  const stages = buildLadderStages(t, decomp, cadence);
  const cad = COMM_CADENCES.find(c => c.key === cadence) || COMM_CADENCES[0];
  const cadLabel = cad.label.toUpperCase();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {stages.map((s, i) => {
        const isLast = i === stages.length - 1;
        return (
          <React.Fragment key={s.key}>
            <div className={`a-fade-up a-d-${Math.min(i + 1, 8)}`} style={{
              display: 'flex', alignItems: 'stretch',
              background: t.surface, border: `1px solid ${s.hero ? s.tone + '66' : t.rule}`,
              borderRadius: 11,
              boxShadow: s.hero ? `0 0 0 3px ${s.tone}11, 0 4px 14px ${s.tone}22` : 'none',
              overflow: 'hidden',
            }}>
              {/* Color rail */}
              <div style={{ width: 4, background: s.tone, flexShrink: 0 }}></div>
              {/* Body */}
              <div style={{ flex: 1, padding: mobile ? '10px 14px' : '12px 16px', display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: s.tone, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800, fontFamily: APP_FONT_MONO,
                      flexShrink: 0,
                    }}>{i + 1}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.tone, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, textTransform: 'uppercase' }}>{s.label}</span>
                    {s.isHistory && (
                      <span style={{
                        padding: '1px 6px', borderRadius: 999,
                        background: t.tealTint, color: t.teal,
                        fontSize: 8.5, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em',
                      }}>FROM HISTORY</span>
                    )}
                  </div>
                  {/* The transform formula appears beneath the label so the chain is readable on one row */}
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 4, fontFamily: APP_FONT_MONO, letterSpacing: '0.02em', lineHeight: 1.3 }}>
                    {s.transform}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: s.hero ? (mobile ? 26 : 30) : (mobile ? 20 : 24),
                    fontWeight: 700, color: t.ink,
                    fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1,
                  }}>
                    {s.isCurrency ? ttdWith(s.value) : fmtNum(s.value)}
                  </div>
                  <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.12em', marginTop: 4 }}>
                    PER {cadLabel}
                  </div>
                </div>
              </div>
            </div>
            {!isLast && (
              <div style={{
                width: 4, height: 12, background: t.rule,
                marginLeft: mobile ? 28 : 32, opacity: 0.6,
              }}></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// GoalDecomp tab content
// ──────────────────────────────────────────────────────────────────────────
function CommGoalDecomp({ t, data, decomp, cadence = 'weekly', mobile = false, managerView = false }) {
  return (
    <div style={mobile ? { display: 'flex', flexDirection: 'column', gap: 18 } : { display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, alignItems: 'flex-start' }}>
      {/* Assumptions column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AssumeGroup t={t} label="INCOME">
          <AssumeRow t={t} label="Income goal"      value="300K" prefix="TTD" focused />
          <AssumeRow t={t} label="Tax rate"         value="25" unit="%" />
          <AssumeRow t={t} label="Renewal income"   value="50K" prefix="TTD" hint="From existing book" />
          <AssumeRow t={t} label="Settlement rate"  value="90" unit="%" />
        </AssumeGroup>
        <AssumeGroup t={t} label="PRODUCTION">
          <AssumeRow t={t} label="Commission rate"  value="35" unit="%" />
          <AssumeRow t={t} label="Avg policy API"   value="12K" prefix="TTD" />
          <AssumeRow t={t} label="Persistency"      value="90" unit="%" />
        </AssumeGroup>
        <AssumeGroup t={t} label="ACTIVITY RATIOS">
          <AssumeRow t={t} label="CIs per sale"     value="2.0" badge="HISTORY" hint="Last 11 weeks of data" />
          <AssumeRow t={t} label="Dials per CI"     value="2.5" badge="HISTORY" />
          <AssumeRow t={t} label="Prospects per dial" value="2.0" />
        </AssumeGroup>

        {/* Save CTAs */}
        {!mobile && !managerView && (
          <div style={{
            padding: '12px 14px', background: t.tealTint, border: `1px solid ${t.teal}33`, borderRadius: 11,
            display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, letterSpacing: '0.14em' }}>READY TO COMMIT?</div>
            <div style={{ fontSize: 11.5, color: t.ink, lineHeight: 1.4 }}>
              Setting this as your goal updates your dashboard, awards pacers, and your manager's gap view.
            </div>
            <div style={{
              padding: '10px 14px', background: t.teal, color: '#fff', borderRadius: 9,
              fontSize: 12.5, fontWeight: 700, textAlign: 'center',
              boxShadow: `0 4px 12px ${t.teal}55`, marginTop: 2,
            }}>Set as my goal</div>
            <div style={{
              padding: '8px 14px', background: 'transparent', color: t.teal,
              border: `1px solid ${t.teal}66`, borderRadius: 9,
              fontSize: 11.5, fontWeight: 700, textAlign: 'center',
            }}>Save assumptions only</div>
          </div>
        )}

        {/* Manager-view CTA — replaces the agent's commit card when a manager
            is using the playground to suggest a goal back to the agent. */}
        {!mobile && managerView && (
          <div style={{
            padding: '14px 16px', background: t.goldTint, border: `1px solid ${t.gold}55`, borderRadius: 11,
            display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_MONO, letterSpacing: '0.14em' }}>
              SUGGEST A GOAL · MANAGER VIEW
            </div>
            <div style={{ fontSize: 11.5, color: t.ink, lineHeight: 1.5 }}>
              Marsha currently committed to <b>TTD 300K</b>. Send your numbers as a stretch suggestion — she has to accept it.
            </div>
            <div style={{
              padding: '8px 10px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 8,
              fontSize: 11, color: t.inkMute, lineHeight: 1.5, fontStyle: 'italic',
            }}>
              "{data.manager.note}"
              <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em', marginTop: 4 }}>
                — {data.manager.name} · {data.manager.role.toUpperCase()}
              </div>
            </div>
            <div style={{
              padding: '10px 14px', background: t.gold, color: '#fff', borderRadius: 9,
              fontSize: 12.5, fontWeight: 700, textAlign: 'center',
              boxShadow: `0 4px 12px ${t.gold}55`, marginTop: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              Send suggestion to Marsha
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
            <div style={{
              padding: '8px 14px', background: 'transparent', color: t.inkMute,
              border: `1px solid ${t.ruleStrong}`, borderRadius: 9,
              fontSize: 11.5, fontWeight: 700, textAlign: 'center',
            }}>Back to Marsha's profile</div>
          </div>
        )}
      </div>

      {/* Ladder column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Eyebrow t={t} color={t.teal}>YOUR ACTIVITY LADDER</Eyebrow>
          <CadenceChips t={t} active={cadence} compact={mobile} />
        </div>
        <div style={{ fontSize: 11.5, color: t.inkMute, lineHeight: 1.5 }}>
          {cadence === 'weekly' && (
            <>
              To earn <b style={{ color: t.ink }}>TTD 300K</b> after tax in 2026, here's what each week needs to look like. The two activity ratios came from your last 11 weeks.
            </>
          )}
          {cadence !== 'weekly' && (
            <>To earn <b style={{ color: t.ink }}>TTD 300K</b> after tax, here's the chain at your selected cadence.</>
          )}
        </div>
        <ActivityLadder t={t} decomp={decomp} cadence={cadence} mobile={mobile} />

        {mobile && (
          <div style={{
            padding: '12px 14px', background: t.tealTint, border: `1px solid ${t.teal}33`, borderRadius: 11,
            display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6,
          }}>
            <div style={{
              padding: '10px 14px', background: t.teal, color: '#fff', borderRadius: 9,
              fontSize: 12.5, fontWeight: 700, textAlign: 'center',
              boxShadow: `0 4px 12px ${t.teal}55`,
            }}>Set as my goal</div>
            <div style={{
              padding: '8px 14px', color: t.teal,
              border: `1px solid ${t.teal}66`, borderRadius: 9,
              fontSize: 11.5, fontWeight: 700, textAlign: 'center',
            }}>Save assumptions only</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ModeMixSlider — colored 4-region track. Each mode owns a labelled slice.
// Drag handles between regions rebalance weights.
// ──────────────────────────────────────────────────────────────────────────
const MODE_COLORS = (t) => ({
  annual:     t.gold,
  semiAnnual: t.teal,
  quarterly:  t.inkAccent || '#A995E0',
  monthly:    t.inkMute,
});
function ModeMixSlider({ t, mix, mobile = false }) {
  const colors = MODE_COLORS(t);
  // Cumulative left-edges for the handles
  let cumulative = 0;
  const segments = COMM_MODES.map(m => {
    const left = cumulative;
    const width = mix[m] * 100;
    cumulative += width;
    return { mode: m, left, width, right: cumulative };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Labels above */}
      <div style={{ position: 'relative', height: 20 }}>
        {segments.map(s => (
          <div key={s.mode} style={{
            position: 'absolute', left: `${s.left}%`, width: `${s.width}%`,
            top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: colors[s.mode], fontSize: 10, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.1em',
            overflow: 'hidden', whiteSpace: 'nowrap',
          }}>
            {COMM_MODE_SHORT[s.mode]} · {Math.round(s.width)}%
          </div>
        ))}
      </div>
      {/* Track */}
      <div style={{ position: 'relative', height: mobile ? 22 : 28, borderRadius: 999, overflow: 'hidden', background: t.surfaceMute, display: 'flex' }}>
        {segments.map(s => (
          <div key={s.mode} className="a-progress-grow" style={{
            width: `${s.width}%`, height: '100%',
            background: `linear-gradient(180deg, ${colors[s.mode]}DD, ${colors[s.mode]})`,
            borderRight: `2px solid ${t.surface}`, transformOrigin: 'left center',
          }}></div>
        ))}
        {/* Drag handles between segments */}
        {segments.slice(0, -1).map(s => (
          <div key={s.mode + '-handle'} className="a-glow-soft" style={{
            position: 'absolute', left: `${s.right}%`, top: -4, bottom: -4,
            width: 12, marginLeft: -6,
            background: t.surface, border: `2px solid ${t.ink}`, borderRadius: 4,
            boxShadow: '0 2px 4px rgba(40,37,29,0.18)', cursor: 'ew-resize',
          }}></div>
        ))}
      </div>
      {/* Sub copy */}
      <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em', textAlign: 'center', marginTop: 2 }}>
        DRAG HANDLES TO REBALANCE · ANNUAL PAYS UPFRONT · MONTHLY PAYS 1/12 PER MONTH
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ModeBreakdownTiles — 4 tiles, one per mode: weight, API, commission.
// ──────────────────────────────────────────────────────────────────────────
function ModeBreakdownTiles({ t, breakdown, mobile = false }) {
  const colors = MODE_COLORS(t);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8 }}>
      {breakdown.map((b, i) => (
        <div key={b.mode} className={`a-fade-up a-d-${i + 1}`} style={{
          padding: '11px 13px', background: t.surface,
          border: `1px solid ${t.rule}`,
          borderLeft: `3px solid ${colors[b.mode]}`,
          borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: colors[b.mode], letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{COMM_MODE_LABEL[b.mode].toUpperCase()}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>{Math.round(b.weight * 100)}%</div>
          </div>
          <div style={{ fontSize: mobile ? 17 : 20, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1, marginTop: 7 }}>
            {ttdWith(b.modeApi)}
          </div>
          <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em', marginTop: 4 }}>API to write</div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.rule}`, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.12em' }}>EARNS</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: colors[b.mode], fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em' }}>{ttdWith(b.commission)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// CashFlowChart — stacked-by-mode bars + cumulative line overlay.
// Months 1-12 across the bottom; SVG dimensions adjust to viewport.
// ──────────────────────────────────────────────────────────────────────────
function CashFlowChart({ t, forecast, mobile = false }) {
  const colors = MODE_COLORS(t);
  const W = mobile ? 320 : 720;
  const H = mobile ? 180 : 220;
  const padL = 36, padR = 16, padT = 14, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxBar = Math.max(...forecast.map(m => m.total), 1);
  // Cumulative for the line
  let cum = 0;
  const cumValues = forecast.map(m => { cum += m.total; return cum; });
  const maxCum = cumValues[cumValues.length - 1] || 1;

  const bw = innerW / 12;
  const barInnerW = bw * 0.66;
  const barX = (i) => padL + i * bw + (bw - barInnerW) / 2;

  // Line path
  const linePts = cumValues.map((v, i) => {
    const x = padL + i * bw + bw / 2;
    const y = padT + innerH - (v / maxCum) * innerH;
    return [x, y];
  });
  const linePath = linePts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

  // Y grid (4 ticks)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(p => ({
    y: padT + innerH - p * innerH,
    label: ttdCompact(p * maxBar),
  }));

  const monthLabels = ['J','F','M','A','M','J','J','A','S','O','N','D'];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* Grid + Y labels */}
      {ticks.map((tk, i) => (
        <g key={i}>
          <line x1={padL} y1={tk.y} x2={W - padR} y2={tk.y} stroke={t.rule} strokeWidth={1} strokeDasharray={i === 0 ? '' : '2 4'} />
          <text x={padL - 6} y={tk.y + 3} fontSize={9} fill={t.inkFaint} textAnchor="end" fontFamily={APP_FONT_MONO}>{tk.label}</text>
        </g>
      ))}
      {/* Stacked bars */}
      {forecast.map((m, i) => {
        const x = barX(i);
        let yCursor = padT + innerH;
        const segs = [];
        ['monthly', 'quarterly', 'semiAnnual', 'annual'].forEach(mode => {
          const v = m[mode];
          if (v <= 0) return;
          const h = (v / maxBar) * innerH;
          yCursor -= h;
          segs.push({ mode, y: yCursor, h });
        });
        return (
          <g key={i}>
            {segs.map(s => (
              <rect key={s.mode}
                x={x} y={s.y} width={barInnerW} height={s.h}
                fill={colors[s.mode]}
                rx={1.5}
              />
            ))}
          </g>
        );
      })}
      {/* Cumulative line overlay */}
      <path d={linePath} fill="none" stroke={t.gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="a-line-draw" strokeDasharray={maxCum * 2} strokeDashoffset={maxCum * 2} />
      {linePts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill={t.gold} stroke={t.surface} strokeWidth={1.5} />
      ))}
      {/* Month labels */}
      {monthLabels.map((m, i) => (
        <text key={i} x={barX(i) + barInnerW / 2} y={H - 12} fontSize={10} fontWeight={600} fill={t.inkFaint} textAnchor="middle" fontFamily={APP_FONT_MONO}>{m}</text>
      ))}
      {/* Last-point cumulative label */}
      <text x={linePts[11][0] - 4} y={linePts[11][1] - 8} fontSize={10} fontWeight={700} fill={t.gold} textAnchor="end" fontFamily={APP_FONT_MONO}>
        TOTAL · {ttdWith(maxCum)}
      </text>
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// InsightCard — reads the mix and explains the trade-off.
// ──────────────────────────────────────────────────────────────────────────
function buildInsight(mix) {
  const annual = mix.annual || 0;
  const monthly = mix.monthly || 0;
  if (annual >= 0.5) return {
    title: 'Cash arrives fast', tone: 'gold',
    bullets: [
      'Annual-heavy mix pays full first-year commission upfront.',
      'You hit the monthly target with the least API written.',
      'Renewal stream the following year is smaller — keep new business steady.',
    ],
  };
  if (monthly >= 0.5) return {
    title: 'Cash arrives steady', tone: 'teal',
    bullets: [
      'Monthly-heavy mix smooths commission across 12 months.',
      'Smaller cheque in month 1 — needs more total API written.',
      'Lowers persistency risk and builds long-term renewals.',
    ],
  };
  return {
    title: 'Balanced mix',  tone: 'ink',
    bullets: [
      'Roughly the same in month 1 as you collect over the year.',
      'Diversified across modes — cushions if one mode dips.',
      'Watch the semi-annual second payment in month 7.',
    ],
  };
}

function InsightCard({ t, mix, mobile = false }) {
  const ins = buildInsight(mix);
  const tone = ins.tone === 'gold' ? t.gold : ins.tone === 'teal' ? t.teal : t.ink;
  const bg = ins.tone === 'gold' ? t.goldTint : ins.tone === 'teal' ? t.tealTint : t.surfaceSoft;
  return (
    <div style={{
      padding: mobile ? '12px 14px' : '14px 18px',
      background: bg, border: `1px solid ${tone}33`, borderRadius: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: tone, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
            <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12" y2="16.01" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em' }}>{ins.title}</div>
      </div>
      <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ins.bullets.map((b, i) => (
          <li key={i} style={{ fontSize: 11.5, color: t.inkMute, lineHeight: 1.5, paddingLeft: 14, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, top: 8, width: 5, height: 5, borderRadius: '50%', background: tone }}></span>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// CommModalTargeting — full tab
// ──────────────────────────────────────────────────────────────────────────
function CommModalTargeting({ t, data, mobile = false }) {
  const { targetCommission, commissionRate, mix } = data.modal;
  const totalApi = commReverseCalc({ targetCommission, mix, rate: commissionRate });
  const breakdown = commModeBreakdown({ totalApi, mix, rate: commissionRate });
  const forecast = commCashFlow({ totalApi, mix, rate: commissionRate });
  const total12mo = forecast.reduce((s, m) => s + m.total, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 14 : 18 }}>
      {/* Hero card — target commission + API required */}
      <div className="a-card a-rise" style={{
        position: 'relative', overflow: 'hidden',
        padding: mobile ? '16px 18px' : '20px 24px',
        flexShrink: 0,
        background: t.surface, border: `1px solid ${t.teal}55`, borderRadius: 14,
        boxShadow: `0 6px 18px ${t.mode === 'light' ? 'rgba(1,105,111,0.10)' : 'rgba(0,0,0,0.4)'}`,
      }}>
        <div className="a-glow-soft" style={{
          position: 'absolute', top: -70, right: -70, width: 240, height: 240,
          background: `radial-gradient(circle, ${t.tealTint} 0%, transparent 65%)`, pointerEvents: 'none',
        }}></div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <Eyebrow t={t} color={t.teal}>I WANT TO EARN</Eyebrow>
            <div style={{ fontSize: mobile ? 26 : 32, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.026em', lineHeight: 1, marginTop: 6 }}>
              {ttdWith(targetCommission)}
              <span style={{ fontSize: mobile ? 13 : 15, color: t.inkMute, fontFamily: APP_FONT_SANS, fontWeight: 600, marginLeft: 6, letterSpacing: '-0.005em' }}>this month</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 100 }}></div>
          <div style={{ textAlign: 'right' }}>
            <Eyebrow t={t} color={t.gold}>I MUST WRITE</Eyebrow>
            <div style={{ fontSize: mobile ? 30 : 38, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.028em', lineHeight: 1, marginTop: 6 }}>
              {ttdWith(totalApi)}
            </div>
            <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 5, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>API · at {commissionRate}% commission</div>
          </div>
        </div>
      </div>

      {/* Mode mix */}
      <div style={{
        padding: mobile ? '14px 16px' : '18px 22px',
        background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <Eyebrow t={t} color={t.inkMute}>YOUR MODE MIX</Eyebrow>
            <div style={{ fontSize: 13, color: t.inkMute, marginTop: 4, lineHeight: 1.4 }}>
              How you split this month's API across payment frequencies.
            </div>
          </div>
          <div style={{
            padding: '4px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`,
            borderRadius: 999, color: t.inkMute,
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
          }}>RESET TO LAST MONTH</div>
        </div>
        <ModeMixSlider t={t} mix={mix} mobile={mobile} />
        <div style={{ marginTop: 16 }}>
          <ModeBreakdownTiles t={t} breakdown={breakdown} mobile={mobile} />
        </div>
      </div>

      {/* Cash-flow + insight */}
      <div style={{
        padding: mobile ? '14px 16px' : '18px 22px',
        background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <Eyebrow t={t} color={t.gold}>12-MONTH CASH FLOW</Eyebrow>
            <div style={{ fontSize: 13, color: t.inkMute, marginTop: 4, lineHeight: 1.4 }}>
              When commission lands each month, by mode. Line traces cumulative across the year.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_MONO, letterSpacing: '0.14em' }}>YEAR TOTAL</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.018em', lineHeight: 1, marginTop: 4 }}>{ttdWith(total12mo)}</div>
          </div>
        </div>
        <CashFlowChart t={t} forecast={forecast} mobile={mobile} />
        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {COMM_MODES.map(m => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: MODE_COLORS(t)[m] }}></div>
              <span style={{ fontSize: 9.5, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em' }}>{COMM_MODE_LABEL[m].toUpperCase()}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 2, background: t.gold, borderRadius: 1 }}></div>
            <span style={{ fontSize: 9.5, color: t.gold, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em' }}>CUMULATIVE</span>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <InsightCard t={t} mix={mix} mobile={mobile} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  ActivityLadder, CommGoalDecomp, ModeMixSlider, ModeBreakdownTiles,
  CashFlowChart, InsightCard, CommModalTargeting, buildInsight,
});

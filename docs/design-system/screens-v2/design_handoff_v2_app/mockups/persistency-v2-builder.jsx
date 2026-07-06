// Persistency v2 — builder. The interactive surface that lives under the
// anchor strip: target slider, lever groups, formula visualization, projected
// badge with award-gate halo, paths-to-target cards, trend chart with projected
// ghost line.

// ──────────────────────────────────────────────────────────────────────────
// LeverSlider — a polished single slider row. Pure-presentational here
// (no value changes), but visually conveys the position with a dot + filled
// track + readout.
// ──────────────────────────────────────────────────────────────────────────
function LeverSlider({ t, label, hint, value, min = 0, max = 500000, sign = '+', tone = 'success', step, focused = false }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const trackColor = tone === 'danger' ? t.warning : tone === 'gold' ? t.gold : t.success;
  return (
    <div style={{ padding: '11px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1, paddingTop: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em' }}>{label}</div>
          {hint && <div style={{ fontSize: 10, color: t.inkMute, marginTop: 2, lineHeight: 1.35 }}>{hint}</div>}
        </div>
        {/* Editable input-style readout — slider and number entry are bound */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 5,
          padding: '5px 9px',
          background: t.surface,
          border: `1px solid ${focused ? trackColor : t.ruleStrong}`,
          borderRadius: 7,
          boxShadow: focused ? `0 0 0 3px ${trackColor}22` : 'none',
          flexShrink: 0,
          cursor: 'text',
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: value > 0 ? trackColor : t.inkFaint, fontFamily: APP_FONT_MONO, lineHeight: 1 }}>{sign === '−' ? '−' : '+'}</span>
          <span style={{ fontSize: 8.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em', lineHeight: 1 }}>TTD</span>
          <span style={{
            fontSize: 16, fontWeight: 700, color: value > 0 ? t.ink : t.inkFaint,
            fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em', lineHeight: 1,
          }}>{value > 0 ? ttdCompact(value) : '0'}</span>
          {focused && (
            <span style={{
              display: 'inline-block', width: 2, height: 14,
              background: trackColor,
              marginLeft: 1,
              animation: 'app-glow-soft 1.1s ease-in-out infinite',
              flexShrink: 0,
            }}></span>
          )}
        </div>
      </div>
      <div style={{ position: 'relative', marginTop: 10, height: 6 }}>
        <div style={{ position: 'absolute', inset: 0, background: t.surfaceMute, borderRadius: 999 }}></div>
        <div className="a-progress-grow" style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct * 100}%`,
          background: `linear-gradient(90deg, ${trackColor}AA, ${trackColor})`,
          borderRadius: 999, transformOrigin: 'left center',
        }}></div>
        <div style={{
          position: 'absolute', left: `calc(${pct * 100}% - 7px)`, top: -4,
          width: 14, height: 14, background: t.surface,
          border: `2px solid ${trackColor}`, borderRadius: '50%',
          boxShadow: `0 2px 4px rgba(40,37,29,0.18)`,
        }}></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>
        <span>0 · drag or type</span>
        <span>{ttdCompact(max)}</span>
      </div>
    </div>
  );
}

// LeverGroup — a labelled group of sliders. Visually tags whether the group
// adds to gross, adds to net, or hurts persistency, so the mental model maps
// to the formula.
function LeverGroup({ t, label, formula, tone, children }) {
  const c = tone === 'danger' ? t.warning : tone === 'gold' ? t.gold : t.success;
  return (
    <div style={{
      padding: '14px 16px', background: t.surface, border: `1px solid ${t.rule}`,
      borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 6, height: 24, borderRadius: 3, background: c, flexShrink: 0,
          }}></span>
          <div style={{
            fontSize: 11, fontWeight: 700, color: c,
            letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, textTransform: 'uppercase',
          }}>{label}</div>
        </div>
        <div style={{ fontSize: 10, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>{formula}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{children}</div>
    </div>
  );
}

// TargetSlider — special top-row slider. Includes 90% award-gate marker.
function TargetSlider({ t, value, min = 0.80, max = 1.0, focused = false }) {
  const pct = (value - min) / (max - min);
  const gatePct = (0.90 - min) / (max - min);
  return (
    <div style={{
      padding: '12px 16px', background: t.surface, border: `1px solid ${t.gold}55`, borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Eyebrow t={t} color={t.gold}>YOUR TARGET</Eyebrow>
        {/* Editable input-style readout */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 4,
          padding: '5px 10px',
          background: t.surface,
          border: `1px solid ${focused ? t.gold : t.ruleStrong}`,
          borderRadius: 7,
          boxShadow: focused ? `0 0 0 3px ${t.gold}22` : 'none',
          cursor: 'text',
        }}>
          <span style={{
            fontSize: 20, fontWeight: 700, color: t.ink,
            fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.018em', lineHeight: 1,
          }}>{(value * 100).toFixed(1)}</span>
          <span style={{ fontSize: 11, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>%</span>
          {focused && (
            <span style={{
              display: 'inline-block', width: 2, height: 16,
              background: t.gold, marginLeft: 1,
              animation: 'app-glow-soft 1.1s ease-in-out infinite',
            }}></span>
          )}
        </div>
      </div>
      <div style={{ position: 'relative', marginTop: 12, height: 8 }}>
        <div style={{ position: 'absolute', inset: 0, background: t.surfaceMute, borderRadius: 999 }}></div>
        <div className="a-progress-grow" style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct * 100}%`,
          background: `linear-gradient(90deg, ${t.gold}AA, ${t.gold})`,
          borderRadius: 999, transformOrigin: 'left center',
        }}></div>
        {/* Gate marker at 90% */}
        <div style={{ position: 'absolute', left: `${gatePct * 100}%`, top: -6, bottom: -6, width: 2, background: t.gold, borderRadius: 1 }}></div>
        <div style={{
          position: 'absolute', left: `calc(${gatePct * 100}% - 24px)`, bottom: -22,
          fontSize: 9, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_MONO, letterSpacing: '0.1em',
          whiteSpace: 'nowrap',
        }}>★ AWARD GATE</div>
        {/* Thumb */}
        <div style={{
          position: 'absolute', left: `calc(${pct * 100}% - 8px)`, top: -4,
          width: 16, height: 16, background: t.surface,
          border: `2px solid ${t.gold}`, borderRadius: '50%',
          boxShadow: `0 2px 4px rgba(176,125,26,0.3)`,
        }}></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26, fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>
        <span>80% · drag or type</span>
        <span>100%</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// LeverBuilder — full panel of: target + 3 grouped lever blocks.
// `mode` switches between 'simple' and 'advanced' — Simple hides Orphans and
// Good Business Falling Off.
// ──────────────────────────────────────────────────────────────────────────
function LeverBuilder({ t, levers, target, mode = 'simple', focusedKey = null }) {
  const isAdvanced = mode === 'advanced';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TargetSlider t={t} value={target} focused={focusedKey === 'target'} />

      <LeverGroup t={t} label="Adds to GROSS ▲" formula="more business → bigger denominator" tone="success">
        <LeverSlider t={t} label="New business to place"
          hint="The clean NB you're confident will settle this period."
          value={levers.newBusinessPlanned} max={500000} sign="+" tone="success"
          focused={focusedKey === 'newBusinessPlanned'} />
        {isAdvanced && (
          <LeverSlider t={t} label="Orphan policies adopted"
            hint="Same math as NB, but comes from inherited inactive clients."
            value={levers.newOrphansAdopted} max={300000} sign="+" tone="success"
            focused={focusedKey === 'newOrphansAdopted'} />
        )}
        {isAdvanced && (
          <LeverSlider t={t} label="Good business falling off"
            hint="Rolling 12-mo window: look on your monthly persistency report."
            value={levers.goodBusinessFallingOff} max={300000} sign="−" tone="danger"
            focused={focusedKey === 'goodBusinessFallingOff'} />
        )}
      </LeverGroup>

      <LeverGroup t={t} label="Adds to NET ▲" formula="reinstatements only" tone="success">
        <LeverSlider t={t} label="Reinstatements planned"
          hint="Lapsed policies you'll bring back this period."
          value={levers.newReinstatementsPlanned} max={200000} sign="+" tone="success"
          focused={focusedKey === 'newReinstatementsPlanned'} />
      </LeverGroup>

      <LeverGroup t={t} label="Hurts PERSISTENCY ▼" formula="anticipated lapses" tone="danger">
        <LeverSlider t={t} label="New lapses anticipated"
          hint="Premium-at-risk clients you can't save."
          value={levers.newLapsesAnticipated} max={150000} sign="−" tone="danger"
          focused={focusedKey === 'newLapsesAnticipated'} />
      </LeverGroup>

      {!isAdvanced && (
        <div style={{
          padding: '10px 12px', background: t.surfaceSoft, border: `1px dashed ${t.ruleStrong}`,
          borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', background: t.tealTint, color: t.teal,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12" y2="16.01" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <div style={{ flex: 1, fontSize: 11, color: t.inkMute, lineHeight: 1.45 }}>
            Simple uses last month's gross as the baseline — close enough for strategy. Switch to Advanced when you have your monthly report.
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// FormulaChain — visualizes the math. Two side-by-side composition cards
// (Gross / Net) with positive and negative contributions clearly labelled.
// Below: the division explicit.
// ──────────────────────────────────────────────────────────────────────────
function FormulaChain({ t, current, levers, projection, mobile = false }) {
  const grossRows = [
    { label: 'Current gross',          value: current.grossSettled,        sign: '',  tone: t.teal },
    { label: 'New business planned',   value: levers.newBusinessPlanned,   sign: '+', tone: t.success, hideIfZero: true },
    { label: 'Orphans adopted',        value: levers.newOrphansAdopted,    sign: '+', tone: t.success, hideIfZero: true },
    { label: 'Good business fall-off', value: -levers.goodBusinessFallingOff, sign: '−', tone: t.warning, hideIfZero: true },
  ].filter(r => !r.hideIfZero || r.value !== 0);
  const netRows = [
    { label: 'From gross',           value: projection.projectedGross,        sign: '',  tone: t.teal },
    { label: 'Existing lapses',      value: -current.lapses,                  sign: '−', tone: t.warning },
    { label: 'Existing reinstatements', value: current.reinstatements,         sign: '+', tone: t.success },
    { label: 'New lapses',           value: -levers.newLapsesAnticipated,     sign: '−', tone: t.warning, hideIfZero: true },
    { label: 'New reinstatements',   value: levers.newReinstatementsPlanned,  sign: '+', tone: t.success, hideIfZero: true },
  ].filter(r => !r.hideIfZero || r.value !== 0);

  const card = (eyebrow, total, rows) => (
    <div style={{
      flex: 1, padding: '14px 16px', background: t.surface,
      border: `1px solid ${t.rule}`, borderRadius: 12,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Eyebrow t={t} color={t.inkMute}>{eyebrow}</Eyebrow>
        <div style={{
          fontSize: mobile ? 20 : 24, fontWeight: 700, color: t.ink,
          fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1,
        }}>TTD {ttdCompact(total)}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((r, i) => {
          const absV = Math.abs(r.value);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 8px', borderRadius: 7,
              background: r.sign === '+' ? t.successTint : r.sign === '−' ? t.warningTint : t.surfaceSoft,
            }}>
              <span style={{ fontSize: 11, color: t.ink, fontWeight: 600 }}>
                <span style={{ color: r.tone, fontFamily: APP_FONT_MONO, fontWeight: 800, marginRight: 4 }}>{r.sign || '='}</span>
                {r.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: r.tone, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em' }}>
                {ttdCompact(absV)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: mobile ? 'flex' : 'grid', flexDirection: 'column', gridTemplateColumns: mobile ? undefined : '1fr 1fr', gap: 10 }}>
        {card('GROSS SETTLED', projection.projectedGross, grossRows)}
        {card('NET SETTLED', projection.projectedNet, netRows)}
      </div>
      {/* Division row */}
      <div style={{
        padding: '10px 16px', background: t.surfaceSoft, border: `1px dashed ${t.ruleStrong}`,
        borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        fontSize: mobile ? 11.5 : 13, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em',
        flexWrap: 'wrap',
      }}>
        <span><b style={{ color: t.ink }}>NET</b> {ttdCompact(projection.projectedNet)}</span>
        <span>÷</span>
        <span><b style={{ color: t.ink }}>GROSS</b> {ttdCompact(projection.projectedGross)}</span>
        <span>=</span>
        <span style={{
          padding: '2px 10px', background: t.tealTint, color: t.teal, borderRadius: 999,
          fontWeight: 700, fontSize: mobile ? 12 : 14,
        }}>{persPctFmt(projection.projectedPersistency)}</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// ProjectedBadge — large color-coded result. When ≥90%, wraps in a gold halo
// that pulses (using the kiosk halo grammar) and adds an AWARD-ELIGIBLE strip.
// ──────────────────────────────────────────────────────────────────────────
function ProjectedBadge({ t, projection, target, currentPct, mobile = false }) {
  const v = projection.projectedPersistency;
  const meetsGate = v >= 0.90;
  const onTarget = v >= target;
  const delta = v - currentPct;
  const fg = meetsGate ? t.success : v >= 0.85 ? t.warning : t.danger;
  const bg = meetsGate ? t.successTint : v >= 0.85 ? t.warningTint : t.dangerTint;
  return (
    <div className={meetsGate ? 'a-card' : 'a-card'} style={{
      position: 'relative',
      padding: mobile ? '14px 16px' : '18px 22px',
      flexShrink: 0,
      background: t.surface,
      border: `1px solid ${meetsGate ? t.gold + '88' : fg + '33'}`,
      borderRadius: 14,
      boxShadow: meetsGate
        ? `0 0 0 3px ${t.goldTint}, 0 8px 24px ${t.mode === 'light' ? 'rgba(176,125,26,0.18)' : 'rgba(0,0,0,0.5)'}`
        : 'none',
      overflow: 'hidden',
    }}>
      {meetsGate && (
        <div className="a-glow-soft" style={{
          position: 'absolute', inset: -20, borderRadius: 20,
          background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 50%)`,
          pointerEvents: 'none', opacity: 0.6,
        }}></div>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0 }}>
          <Eyebrow t={t} color={fg}>PROJECTED PERSISTENCY</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
            <div style={{
              fontSize: mobile ? 44 : 58, fontWeight: 700, color: fg,
              fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.034em', lineHeight: 1,
            }}>{persPctFmt(v)}</div>
            {delta !== 0 && (
              <div style={{
                padding: '3px 9px', borderRadius: 999,
                background: delta > 0 ? t.successTint : t.warningTint,
                color: delta > 0 ? t.success : t.warning,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO,
                whiteSpace: 'nowrap',
              }}>
                {delta > 0 ? '▲' : '▼'} {Math.abs(delta * 100).toFixed(1)}PP
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          {meetsGate ? (
            <div style={{
              padding: '10px 14px', background: t.goldTint, border: `1px solid ${t.gold}55`,
              borderRadius: 11, display: 'flex', alignItems: 'center', gap: 11,
            }}>
              <div className="a-breathe" style={{
                width: 32, height: 32, borderRadius: '50%',
                background: `radial-gradient(circle at 30% 25%, #FFE48A 0%, ${t.gold} 65%, #8E5A0F 100%)`,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 14, flexShrink: 0,
                boxShadow: '0 4px 10px rgba(176,125,26,0.35), inset 0 1px 4px rgba(255,255,255,0.4)',
              }}>★</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.gold, letterSpacing: '-0.005em' }}>Award-eligible</div>
                <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2 }}>{onTarget ? 'On track for your stretch target too.' : `Above the 90% gate · ${((v - 0.9) * 100).toFixed(1)}pp buffer.`}</div>
              </div>
            </div>
          ) : (
            <div style={{
              padding: '10px 14px', background: t.warningTint, border: `1px solid ${t.warning}33`,
              borderRadius: 11, display: 'flex', alignItems: 'center', gap: 11,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: t.surface, border: `1px solid ${t.warning}44`,
                color: t.warning, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <IconAlert size={15} color={t.warning} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.warning, letterSpacing: '-0.005em' }}>{((0.9 - v) * 100).toFixed(1)}pp below the award gate</div>
                <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2 }}>Use a lever below to close the gap.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// PathsToTarget — 4 cards: NB, Reinstatements, Orphans, Combined.
// Each card carries an "effort" badge (LOW/MED/HIGH) computed from how
// large the required value is relative to current gross.
// ──────────────────────────────────────────────────────────────────────────
function effortLabel(value, currentGross) {
  if (value === Infinity) return { label: 'NOT VIABLE', color: 'danger' };
  if (value === 0)        return { label: 'ALREADY THERE', color: 'success' };
  const ratio = value / currentGross;
  if (ratio < 0.05) return { label: 'LOW EFFORT', color: 'success' };
  if (ratio < 0.20) return { label: 'MED EFFORT', color: 'warning' };
  return { label: 'HIGH EFFORT', color: 'danger' };
}

function PathCard({ t, eyebrow, value, hint, recommended = false, effort, valueLabel, mobile = false }) {
  const e = effort || effortLabel(value, 1000000);
  const eColor = e.color === 'danger' ? t.danger : e.color === 'warning' ? t.warning : t.success;
  return (
    <div style={{
      padding: mobile ? '12px 14px' : '14px 16px',
      background: recommended ? t.tealTint : t.surface,
      border: `1px solid ${recommended ? t.teal + '66' : t.rule}`,
      borderRadius: 11,
      position: 'relative', overflow: 'hidden',
      boxShadow: recommended ? `0 0 0 3px ${t.tealTint}` : 'none',
    }}>
      {recommended && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          padding: '3px 10px',
          background: t.teal, color: '#fff',
          fontSize: 9, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.14em',
          borderBottomLeftRadius: 9,
        }}>★ RECOMMENDED</div>
      )}
      <Eyebrow t={t} color={recommended ? t.teal : t.inkMute}>{eyebrow}</Eyebrow>
      <div style={{
        fontSize: mobile ? 17 : 20, fontWeight: 700, color: t.ink,
        fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1.05, marginTop: 7,
      }}>{valueLabel}</div>
      {hint && <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 6, lineHeight: 1.4 }}>{hint}</div>}
      <div style={{ marginTop: 8 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 8px', borderRadius: 999,
          background: e.color === 'danger' ? t.dangerTint : e.color === 'warning' ? t.warningTint : t.successTint,
          color: eColor,
          fontSize: 9, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.1em',
        }}>{e.label}</span>
      </div>
    </div>
  );
}

function PathsToTarget({ t, shortfall, combined, current, mobile = false }) {
  // Format value labels
  const nbLabel = shortfall.nbNeeded === Infinity ? '—' : `+TTD ${ttdCompact(shortfall.nbNeeded)}`;
  const orphLabel = shortfall.noNeeded === Infinity ? '—' : `+TTD ${ttdCompact(shortfall.noNeeded)}`;
  const reinsLabel = `+TTD ${ttdCompact(shortfall.nrNeeded)}`;
  const combinedLabel = `${ttdCompact(combined.nb)} NB · ${ttdCompact(combined.reins)} reinstmts · ${ttdCompact(combined.orphans)} orphans`;

  const baseGross = current.grossSettled;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <Eyebrow t={t}>PATHS TO TARGET · SINGLE LEVER VS BALANCED</Eyebrow>
        <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>BELOW = MINIMUM TO REACH 90%</span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 8,
      }}>
        <PathCard t={t} eyebrow="VIA NEW BUSINESS"
          hint="Place this much clean NB and the rest stays the same."
          valueLabel={nbLabel}
          effort={effortLabel(shortfall.nbNeeded, baseGross)} mobile={mobile} />
        <PathCard t={t} eyebrow="VIA REINSTATEMENTS"
          hint="Bring this much lapsed business back this period."
          valueLabel={reinsLabel}
          effort={effortLabel(shortfall.nrNeeded, baseGross)} mobile={mobile} />
        <PathCard t={t} eyebrow="VIA ORPHAN ADOPTION"
          hint="Same math as NB — counts toward gross."
          valueLabel={orphLabel}
          effort={effortLabel(shortfall.noNeeded, baseGross)} mobile={mobile} />
        <PathCard t={t} eyebrow="BALANCED MIX" recommended
          hint="Split the work — most agents won't hit any single lever's full number."
          valueLabel={combinedLabel}
          effort={{ label: 'REALISTIC', color: 'success' }} mobile={mobile} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// TrendChart — 6 months + projected ghost point at the right.
// ──────────────────────────────────────────────────────────────────────────
function PersTrendChart({ t, trend, projectedValue, mobile = false }) {
  const W = mobile ? 320 : 700;
  const H = mobile ? 140 : 180;
  const padL = 38, padR = 56, padT = 14, padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const points = trend.map(p => p.value);
  const lo = 0.80, hi = 1.00;
  const x = (i, total) => padL + (i / (total - 1)) * innerW;
  const y = (v) => padT + innerH - ((v - lo) / (hi - lo)) * innerH;
  const linePath = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i, points.length)} ${y(v)}`).join(' ');
  const lastIdx = points.length - 1;
  const projectedX = padL + innerW + 30;
  const projectedY = y(projectedValue);
  const projectedPath = `M ${x(lastIdx, points.length)} ${y(points[lastIdx])} L ${projectedX} ${projectedY}`;
  const yTicks = [0.80, 0.85, 0.90, 0.95, 1.00];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* Gridlines + Y labels */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={y(v)} x2={W - padR + 28} y2={y(v)}
            stroke={v === 0.90 ? t.gold : t.rule}
            strokeWidth={v === 0.90 ? 1.4 : 1}
            strokeDasharray={v === 0.90 ? '4 4' : i === 0 ? '' : '2 4'} />
          <text x={padL - 6} y={y(v) + 3} fontSize={9} fill={v === 0.90 ? t.gold : t.inkFaint} textAnchor="end" fontFamily={APP_FONT_MONO} fontWeight={v === 0.90 ? 700 : 400}>
            {(v * 100).toFixed(0)}%
          </text>
        </g>
      ))}
      {/* History line */}
      <path d={linePath} fill="none" stroke={t.teal} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      {/* Points */}
      {points.map((v, i) => (
        <circle key={i} cx={x(i, points.length)} cy={y(v)} r={i === lastIdx ? 4 : 3}
          fill={i === lastIdx ? t.teal : t.surface}
          stroke={t.teal} strokeWidth={1.8} />
      ))}
      {/* Projected ghost line */}
      <path d={projectedPath} fill="none" stroke={projectedValue >= 0.90 ? t.success : t.warning} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
      <circle cx={projectedX} cy={projectedY} r={5}
        fill={projectedValue >= 0.90 ? t.success : t.warning}
        stroke={t.surface} strokeWidth={2} />
      <text x={projectedX + 4} y={projectedY - 8} fontSize={10} fontWeight={700}
        fill={projectedValue >= 0.90 ? t.success : t.warning}
        textAnchor="start" fontFamily={APP_FONT_MONO}>
        IF YOU EXECUTE
      </text>
      <text x={projectedX + 4} y={projectedY + 14} fontSize={11} fontWeight={700}
        fill={t.ink}
        textAnchor="start" fontFamily={APP_FONT_DISPLAY}>
        {persPctFmt(projectedValue)}
      </text>
      {/* X axis labels */}
      {trend.map((p, i) => (
        <text key={i} x={x(i, points.length)} y={H - 8} fontSize={10} fontWeight={600}
          fill={i === lastIdx ? t.ink : t.inkFaint}
          textAnchor="middle" fontFamily={APP_FONT_MONO}>
          {p.month}
        </text>
      ))}
      {/* Vertical separator before projection */}
      <line x1={x(lastIdx, points.length) + 10} y1={padT} x2={x(lastIdx, points.length) + 10} y2={H - padB}
        stroke={t.ruleStrong} strokeDasharray="2 3" opacity={0.6} />
      <text x={projectedX} y={H - 8} fontSize={9} fontWeight={700}
        fill={t.inkFaint}
        textAnchor="middle" fontFamily={APP_FONT_MONO} letterSpacing="0.04em">
        PROJ.
      </text>
    </svg>
  );
}

Object.assign(window, {
  LeverSlider, LeverGroup, TargetSlider, LeverBuilder,
  FormulaChain, ProjectedBadge, PathsToTarget, PersTrendChart,
  effortLabel, PathCard,
});

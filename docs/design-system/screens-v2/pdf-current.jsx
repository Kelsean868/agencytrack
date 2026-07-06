// Faithful recreation of the existing AgentReportDocument PDF for side-by-side
// comparison. Compressed to 2 pages from the original ~3 pages so the
// before/after fits cleanly on the canvas.

const CUR = {
  primary:       '#01696f',
  primaryDark:   '#014e52',
  primaryLight:  '#d6ebec',
  surface:       '#ffffff',
  surfaceRaised: '#f9f8f5',
  border:        '#e5e2db',
  text:          '#28251d',
  textMuted:     '#6b6560',
  success:       '#2d7a4f',
  successBg:     '#e3f1e9',
  warning:       '#b45309',
  warningBg:     '#fef3e7',
  danger:        '#c0392b',
  dangerBg:      '#fadedb',
  focusBg:       '#f0fafa',
  achievedBg:    '#d1fae5',
  achievedFg:    '#065f46',
  inProgressBg:  '#e0f5f5',
  white:         '#ffffff',
};

// Inline SVG sparkline (matches the react-pdf Sparkline component)
function CurSparkline({ values, width, height, color }) {
  if (!values || values.length < 2) {
    return (
      <svg width={width} height={height}>
        <line x1={0} y1={height/2} x2={width} y2={height/2} stroke={CUR.border} strokeWidth={1} />
      </svg>
    );
  }
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const d = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
  return <svg width={width} height={height}><path d={d} stroke={color} strokeWidth={1.5} fill="none" /></svg>;
}

function CurPill({ label, bg, fg, width, minHeight = 20 }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '4px 10px', borderRadius: 999,
      background: bg, color: fg,
      fontSize: 8, fontWeight: 700,
      minHeight, width,
      lineHeight: 1, letterSpacing: 0,
    }}>{label}</div>
  );
}

function CurrentPage1() {
  const PAGE_PAD = 32;
  const CONTENT_W = A4_W - PAGE_PAD * 2;
  return (
    <div style={{
      width: A4_W, height: A4_H, background: CUR.surface, color: CUR.text,
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", fontSize: 10,
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Header band */}
      <div style={{
        background: CUR.primary, padding: '22px 32px',
        borderBottom: `4px solid ${CUR.primaryDark}`,
      }}>
        <div style={{ color: CUR.white, fontSize: 8, letterSpacing: 0.8, opacity: 0.65, fontWeight: 700, marginBottom: 4 }}>AGENCYTRACK</div>
        <div style={{ color: CUR.white, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Marsha Singh</div>
        <div style={{ color: CUR.white, fontSize: 9, opacity: 0.85 }}>agent  ·  Generated November 26, 2026  ·  Last 12 Weeks</div>
        <div style={{ color: CUR.white, fontSize: 9, opacity: 0.85, marginTop: 2 }}>Agent #8821  ·  14 months in service  ·  Persistency 88%</div>
      </div>

      {/* Executive summary */}
      <div style={{ padding: `18px ${PAGE_PAD}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {/* Hero */}
          <div style={{
            width: CONTENT_W * 0.58 - 7,
            background: CUR.primary, borderRadius: 10, padding: 16, marginRight: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ color: CUR.white, fontSize: 8, opacity: 0.7, fontWeight: 700, letterSpacing: 0.8 }}>YTD API · SETTLED</div>
            </div>
            <div style={{ color: CUR.white, fontSize: 26, fontWeight: 700, marginBottom: 4 }}>TTD 487,000</div>
            <div style={{ color: CUR.white, fontSize: 8, opacity: 0.75, marginBottom: 2 }}>Submitted: TTD 502,400</div>
            <div style={{ color: CUR.white, fontSize: 8, opacity: 0.85, marginBottom: 10 }}>Goal: TTD 600,000  |  TTD 113,000 remaining</div>
            <CurSparkline values={[14000, 18400, 16800, 23400]} width={180} height={36} color={CUR.white} />
          </div>
          {/* Stacked */}
          <div style={{ flex: 1 }}>
            {[
              { label: 'YTD APPS · SETTLED',   value: '41',      spark: [3, 4, 3, 5] },
              { label: 'WEEKS SUBMITTED',      value: '38',      spark: [1, 2, 3, 4] },
              { label: 'AVG API / APP',        value: 'TTD 11,878', spark: [10000, 11500, 12100, 11878] },
            ].map((card, i) => (
              <div key={card.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: CUR.surfaceRaised, borderRadius: 8,
                border: `0.5px solid ${CUR.border}`, padding: 10,
                marginBottom: i < 2 ? 6 : 0, height: '31%',
              }}>
                <div>
                  <div style={{ fontSize: 7, color: CUR.textMuted, fontWeight: 700, letterSpacing: 0.6, marginBottom: 2 }}>{card.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{card.value}</div>
                </div>
                <CurSparkline values={card.spark} width={90} height={24} color={CUR.primary} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Production Breakdown */}
      <div style={{ padding: `18px ${PAGE_PAD}px 0` }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: CUR.text,
          paddingBottom: 4, marginBottom: 8, borderBottom: `1.5px solid ${CUR.border}`,
        }}>Production Breakdown</div>
        <div style={{
          display: 'flex', borderBottom: `1px solid ${CUR.border}`,
          paddingBottom: 4, marginBottom: 4,
        }}>
          <div style={{ width: 52, fontSize: 7, fontWeight: 700, color: CUR.textMuted }}></div>
          <div style={{ flex: 1, fontSize: 7, fontWeight: 700, color: CUR.textMuted, textAlign: 'right' }}>NB Apps</div>
          <div style={{ flex: 2, fontSize: 7, fontWeight: 700, color: CUR.textMuted, textAlign: 'right' }}>NB API</div>
          <div style={{ flex: 1, fontSize: 7, fontWeight: 700, color: CUR.textMuted, textAlign: 'right' }}>PPP Apps</div>
          <div style={{ flex: 2, fontSize: 7, fontWeight: 700, color: CUR.textMuted, textAlign: 'right' }}>PPP Inc.</div>
          <div style={{ flex: 2, fontSize: 7, fontWeight: 700, color: CUR.textMuted, textAlign: 'right' }}>LMPS (10%)</div>
          <div style={{ flex: 2, fontSize: 7, fontWeight: 700, color: CUR.primary, textAlign: 'right' }}>Total API</div>
        </div>
        {[
          { label: 'Weekly', nbApps: 3,  nbApi: 18400,  pppApps: 1, pppInc: 4200,  lmpsCredit: 800,   total: 23400 },
          { label: 'MTD',    nbApps: 11, nbApi: 62200,  pppApps: 3, pppInc: 12400, lmpsCredit: 2800,  total: 77400 },
          { label: 'YTD',    nbApps: 38, nbApi: 482000, pppApps: 14, pppInc: 51400, lmpsCredit: 18200, total: 551600 },
        ].map((row, i) => (
          <div key={row.label} style={{
            display: 'flex', alignItems: 'center',
            background: i % 2 === 0 ? CUR.surfaceRaised : CUR.surface,
            padding: '5px 4px', borderRadius: 4,
          }}>
            <div style={{ width: 52, fontSize: 8, fontWeight: 700 }}>{row.label}</div>
            <div style={{ flex: 1, fontSize: 8, textAlign: 'right' }}>{row.nbApps}</div>
            <div style={{ flex: 2, fontSize: 8, textAlign: 'right' }}>TTD {row.nbApi.toLocaleString()}</div>
            <div style={{ flex: 1, fontSize: 8, textAlign: 'right' }}>{row.pppApps}</div>
            <div style={{ flex: 2, fontSize: 8, textAlign: 'right' }}>TTD {row.pppInc.toLocaleString()}</div>
            <div style={{ flex: 2, fontSize: 8, textAlign: 'right' }}>TTD {row.lmpsCredit.toLocaleString()}</div>
            <div style={{ flex: 2, fontSize: 8, fontWeight: 700, color: CUR.primary, textAlign: 'right' }}>TTD {row.total.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Career Level Progress */}
      <div style={{ padding: `18px ${PAGE_PAD}px 0` }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: CUR.text,
          paddingBottom: 4, marginBottom: 8, borderBottom: `1.5px solid ${CUR.border}`,
        }}>Career Level Progress</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: CUR.primary, padding: '6px 14px', borderRadius: 999,
            color: CUR.white, fontSize: 9, fontWeight: 700,
            marginRight: 12, height: 26,
          }}>Level 4 — Senior Associate</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: CUR.textMuted }}>Progress to Level 5 — Manager</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: CUR.primary }}>97%</div>
            </div>
            <div style={{ height: 6, background: CUR.border, borderRadius: 3 }}>
              <div style={{ width: '97%', height: 6, background: CUR.primary, borderRadius: 3 }}></div>
            </div>
            <div style={{ marginTop: 4, fontSize: 8, color: CUR.textMuted }}>TTD 487,000 of TTD 500,000 needed for Level 5 — 24 more apps required</div>
          </div>
        </div>
      </div>

      {/* YTD API vs Targets */}
      <div style={{ padding: `18px ${PAGE_PAD}px 0` }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: CUR.text,
          paddingBottom: 4, marginBottom: 8, borderBottom: `1.5px solid ${CUR.border}`,
        }}>YTD API vs Targets</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: CONTENT_W - 36, height: 22, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, background: CUR.border, borderRadius: 4 }}></div>
            <div style={{ position: 'absolute', left: 0, top: 0, width: '64%', height: 22, background: CUR.primary, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }}></div>
            <div style={{ position: 'absolute', left: '64%', top: 0, width: '15%', height: 22, background: CUR.primaryLight, opacity: 0.7 }}></div>
            {/* Markers */}
            <div style={{ position: 'absolute', left: '38%', top: 0, width: 1.2, height: 22, background: CUR.text }}></div>
            <div style={{ position: 'absolute', left: '88%', top: 0, width: 1.2, height: 22, background: CUR.success }}></div>
            <div style={{ position: 'absolute', left: '73%', top: 0, width: 1.2, height: 22, background: CUR.warning }}></div>
          </div>
          <div style={{ width: 36, textAlign: 'right', fontSize: 9, fontWeight: 700 }}>79%</div>
        </div>
        <div style={{ display: 'flex', marginTop: 6 }}>
          <div style={{ fontSize: 7, color: CUR.text, marginRight: 12 }}>Floor: TTD 250,000</div>
          <div style={{ fontSize: 7, color: CUR.success, marginRight: 12 }}>Goal: TTD 600,000</div>
          <div style={{ fontSize: 7, color: CUR.warning }}>MDRT: TTD 500,000</div>
        </div>
        <div style={{ fontSize: 9, color: CUR.textMuted, marginTop: 6 }}>
          <span style={{ color: CUR.primary, fontWeight: 700 }}>TTD 553,200</span>
          {' achieved '}
          <span style={{ fontSize: 8, color: CUR.textMuted }}>(TTD 487,000 settled · TTD 66,200 pending)</span>
          {' · 92% of goal · TTD 46,800 remaining'}
        </div>
      </div>
    </div>
  );
}

function CurrentPage2() {
  const PAGE_PAD = 32;
  const CONTENT_W = A4_W - PAGE_PAD * 2;
  // chart data
  const weeks = ['10/13','10/20','10/27','11/03','11/10','11/17'];
  const ds = {
    dials:    [42, 38, 51, 47, 44, 49],
    contacts: [10, 9, 13, 12, 11, 12],
    f2f:      [5, 4, 7, 6, 6, 6],
    apps:     [2, 1, 3, 2, 3, 2],
  };
  const maxV = Math.max(...ds.dials);
  const ML = 28, MR = 8, MT = 10, MB = 8;
  const cw = CONTENT_W, ch = 150;
  const pw = cw - ML - MR, ph = ch - MT - MB;
  const xFor = i => ML + (i / (weeks.length - 1)) * pw;
  const yFor = v => MT + ph - (v / maxV) * ph;
  const linePath = arr => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ');

  return (
    <div style={{
      width: A4_W, height: A4_H, background: CUR.surface, color: CUR.text,
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", fontSize: 10,
      overflow: 'hidden',
    }}>
      {/* Weekly Activity Trend */}
      <div style={{ padding: `18px ${PAGE_PAD}px 0` }}>
        <div style={{
          fontSize: 11, fontWeight: 700,
          paddingBottom: 4, marginBottom: 8, borderBottom: `1.5px solid ${CUR.border}`,
        }}>Weekly Activity Trend — Last 12 Weeks</div>
        <svg width={cw} height={ch}>
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
            <line key={i} x1={ML} y1={MT + p * ph} x2={ML + pw} y2={MT + p * ph} stroke={CUR.border} strokeWidth={0.5} />
          ))}
          <line x1={ML} y1={MT} x2={ML} y2={MT + ph} stroke={CUR.textMuted} strokeWidth={0.5} />
          <line x1={ML} y1={MT + ph} x2={ML + pw} y2={MT + ph} stroke={CUR.textMuted} strokeWidth={0.5} />
          <path d={linePath(ds.dials)}    stroke={CUR.primary} strokeWidth={1.5} fill="none" />
          <path d={linePath(ds.contacts)} stroke={CUR.success} strokeWidth={1.5} fill="none" />
          <path d={linePath(ds.f2f)}      stroke={CUR.warning} strokeWidth={1.5} fill="none" />
          <path d={linePath(ds.apps)}     stroke={CUR.danger}  strokeWidth={1.5} fill="none" />
        </svg>
        <div style={{ display: 'flex', marginLeft: ML, marginTop: 2 }}>
          {weeks.map(w => <div key={w} style={{ flex: 1, textAlign: 'center', fontSize: 7, color: CUR.textMuted }}>{w}</div>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
          {[
            { color: CUR.primary, label: 'Dials' },
            { color: CUR.success, label: 'Tel Contacts' },
            { color: CUR.warning, label: 'F2F' },
            { color: CUR.danger,  label: 'Apps' },
          ].map(ln => (
            <div key={ln.label} style={{ display: 'flex', alignItems: 'center', margin: '0 8px' }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: ln.color, marginRight: 4 }}></div>
              <div style={{ fontSize: 8, color: CUR.textMuted }}>{ln.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Funnel */}
      <div style={{ padding: `12px ${PAGE_PAD}px 0` }}>
        <div style={{
          fontSize: 11, fontWeight: 700,
          paddingBottom: 4, marginBottom: 8, borderBottom: `1.5px solid ${CUR.border}`,
        }}>Activity Funnel (Avg per Week)</div>
        {[
          { label: 'Dials', value: 45.2, conv: 24, bench: 20, onTrack: true,  pct: 100 },
          { label: 'Tel Contacts', value: 10.8, conv: 53, bench: 40, onTrack: true,  pct: 24 },
          { label: 'F2F', value: 5.7, conv: 51, bench: 50, onTrack: true,  pct: 13 },
          { label: 'FFI', value: 2.9, conv: 64, bench: 60, onTrack: true,  pct: 6.5 },
          { label: 'CI', value: 1.9, conv: 79, bench: 70, onTrack: true,  pct: 4.2 },
          { label: 'Apps', value: 1.5, conv: null, bench: 0, onTrack: true,  pct: 3.3 },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
            <div style={{ width: 80, textAlign: 'right', fontSize: 9, color: CUR.textMuted, paddingRight: 8 }}>{s.label}</div>
            <div style={{ flex: 1, height: 14, background: CUR.surfaceRaised, borderRadius: 4 }}>
              <div style={{ width: `${s.pct}%`, height: 14, background: s.onTrack ? CUR.primary : CUR.border, borderRadius: 4 }}></div>
            </div>
            <div style={{ width: 50, textAlign: 'right', fontSize: 9, fontWeight: 700, paddingRight: 8 }}>{s.value.toFixed(1)}</div>
            {s.conv !== null
              ? <CurPill label={`${s.conv}%`} bg={s.onTrack ? CUR.successBg : CUR.dangerBg} fg={s.onTrack ? CUR.success : CUR.danger} width={56} />
              : <div style={{ width: 56 }}></div>}
          </div>
        ))}
      </div>

      {/* Conversion Ratio Scorecard */}
      <div style={{ padding: `12px ${PAGE_PAD}px 0` }}>
        <div style={{
          fontSize: 11, fontWeight: 700,
          paddingBottom: 4, marginBottom: 8, borderBottom: `1.5px solid ${CUR.border}`,
        }}>Conversion Ratio Scorecard</div>
        <div style={{ display: 'flex', background: CUR.primary, padding: '6px 8px' }}>
          <div style={{ flex: 2, color: CUR.white, fontSize: 8, fontWeight: 700, letterSpacing: 0.6 }}>RATIO</div>
          <div style={{ flex: 1, color: CUR.white, fontSize: 8, fontWeight: 700 }}>YOUR RATE</div>
          <div style={{ flex: 1, color: CUR.white, fontSize: 8, fontWeight: 700 }}>BENCHMARK</div>
          <div style={{ width: 100, color: CUR.white, fontSize: 8, fontWeight: 700 }}>STATUS</div>
        </div>
        {[
          { label: 'Dial → Contact', val: '24%',    bench: '20%+', on: true },
          { label: 'Contact → F2F',  val: '53%',    bench: '40%+', on: true },
          { label: 'F2F → FFI',      val: '51%',    bench: '50%+', on: true },
          { label: 'FFI → CI',       val: '64%',    bench: '60%+', on: true },
          { label: 'CI → App',       val: '79%',    bench: '70%+', on: true },
          { label: 'Avg API / App',  val: 'TTD 11,878', bench: 'TTD 8,000+', on: true },
        ].map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', padding: '4px 8px',
            background: i % 2 === 0 ? CUR.surfaceRaised : CUR.surface,
            borderBottom: `0.5px solid ${CUR.border}`,
          }}>
            <div style={{ flex: 2, fontSize: 9, fontWeight: 700 }}>{r.label}</div>
            <div style={{ flex: 1, fontSize: 9, fontWeight: 700, color: r.on ? CUR.success : CUR.danger }}>{r.val}</div>
            <div style={{ flex: 1, fontSize: 9, color: CUR.textMuted }}>{r.bench}</div>
            <div style={{ width: 100 }}>
              <CurPill label={r.on ? 'On Track' : 'Below'} bg={r.on ? CUR.successBg : CUR.dangerBg} fg={r.on ? CUR.success : CUR.danger} width={88} />
            </div>
          </div>
        ))}
      </div>

      {/* Focus This Week */}
      <div style={{ padding: `12px ${PAGE_PAD}px 0` }}>
        <div style={{
          border: `1.5px solid ${CUR.primary}`, borderRadius: 8,
          padding: 14, background: CUR.focusBg,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: CUR.primary, marginBottom: 8 }}>Focus This Week</div>
          {[
            'Great work — all your ratios are on track. Focus on increasing your dial volume to grow production.',
          ].map((b, i, arr) => (
            <div key={i} style={{ display: 'flex', marginBottom: i < arr.length - 1 ? 4 : 0 }}>
              <div style={{ width: 12, fontSize: 9, color: CUR.primary, fontWeight: 700 }}>•</div>
              <div style={{ flex: 1, fontSize: 9, color: CUR.text, lineHeight: 1.4 }}>{b}</div>
            </div>
          ))}
        </div>
      </div>

      {/* footer band */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 32px', background: CUR.surfaceRaised, borderTop: `2px solid ${CUR.primary}`,
      }}>
        <div style={{ fontSize: 8, color: CUR.textMuted }}>AgencyTrack · Tatil Life · Confidential</div>
        <div style={{ fontSize: 8, color: CUR.textMuted }}>Page 2 of 3</div>
      </div>
    </div>
  );
}

Object.assign(window, { CurrentPage1, CurrentPage2 });

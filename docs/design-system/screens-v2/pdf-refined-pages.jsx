// Refined Agent Performance Report — content pages 02 / 03 / 04.
// Rebuilt to MIRROR the live in-app AgentReportView (agentreport-v2.jsx):
//   p2 → hero (New API / Applications / Persistency / Closing) + four time
//        windows (This week → This year) + production breakdown
//   p3 → this week's activity vs the company floor (the 8 canonical KPIs) +
//        6-week API trajectory + coaching ratios + YTD vs L4 tenure floor
//   p4 → career level + award progress (canonical set) + coaching note + focus
// All wrapped in <PdfPage runningHeader pageNumber totalPages>.

// ── Canonical company-floor activity set ──────────────────────────────────
// Source of truth: meeting-v2-shared.jsx → KPI_GROUPS / resolveTiles. Fixed
// order, fixed weekly minimums. New API (TTD 4,800) and Applications (1) are
// the *results*, shown in the hero — these eight are the activity inputs.
const AGENT_FLOOR_KPIS = [
  { key: 'calls',      label: 'Calls Made',         floor: 60 },
  { key: 'contacts',   label: 'Contacts Made',      floor: 40 },
  { key: 'appts',      label: 'Appointments',       floor: 20 },
  { key: 'interviews', label: 'Interviews Kept',    floor: 15 },
  { key: 'factfinds',  label: 'Fact Finds',         floor: 10 },
  { key: 'closing',    label: 'Closing Interviews', floor: 10 },
  { key: 'clients',    label: 'Clients Sold',       floor: 1 },
  { key: 'referrals',  label: 'Referrals',          floor: 100 },
];
const AGENT_API_FLOOR = 4800;   // weekly New API floor
const AGENT_TENURE_FLOORS = { L1: 250000, L2: 350000, L3: 450000, L4: 550000 };

// Marsha Singh — the report subject. Activity matches her RUN record
// (meeting-v2-shared.jsx RUN → 'marsha'); production windows mirror prodFor().
const AGENT = {
  name: 'Marsha Singh', level: 'L4', levelName: 'Senior Associate',
  weekApi: 24400, weekApps: 4, ytdApi: 487000, ytdApps: 41,
  pers: 88, conv: 79,
  act: { calls: 92, contacts: 58, appts: 28, interviews: 25, factfinds: 14, closing: 11, clients: 4, referrals: 140 },
  ratios: [
    { label: 'Approach → FFI', value: '67%', tone: 'success' },
    { label: 'FFI → CI',       value: '83%', tone: 'success' },
    { label: 'CI → App',       value: '80%', tone: 'success' },
    { label: 'Closing ratio',  value: '79%', tone: 'success' },
  ],
  spark: [19000, 21000, 20000, 23000, 22000, 24400],
  windows: [
    { label: 'This week',    api: 24400,  apps: 4 },
    { label: 'This month',   api: 69200,  apps: 6 },
    { label: 'This quarter', api: 199700, apps: 17 },
    { label: 'This year',    api: 487000, apps: 41 },
  ],
  note: 'Model week — every activity standard cleared. Recognise publicly and ask her to demo the morning call-block / afternoon-FFI rhythm to the unit.',
};

function kpiBand(actual, floor) {
  if (actual >= floor) return 'met';
  if (actual >= floor * 0.9) return 'at';
  return 'below';
}

// ── Hero stat (mirrors ARStat) ────────────────────────────────────────────
function HeroStat({ eyebrow, value, sub, color }) {
  return (
    <div>
      <div style={{ fontSize: 8, color: PDF.inkFaint, fontWeight: 700, letterSpacing: '0.16em', fontFamily: MONO }}>{eyebrow}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: color || PDF.ink, letterSpacing: '-0.025em', lineHeight: 1, fontFamily: SERIF_DISPLAY }}>{value}</div>
      </div>
      {sub && <div style={{ fontSize: 8.5, color: PDF.inkMute, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ── Time-window tile (mirrors ARWindows) ──────────────────────────────────
function WindowTile({ label, api, apps, active }) {
  return (
    <div style={{
      padding: '11px 13px',
      background: active ? PDF.tealTint : PDF.paper,
      border: `1px solid ${active ? PDF.teal + '66' : PDF.rule}`,
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 7.5, fontWeight: 700, color: active ? PDF.teal : PDF.inkFaint, letterSpacing: '0.1em', fontFamily: MONO, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: PDF.ink, fontFamily: SERIF_DISPLAY, letterSpacing: '-0.02em', marginTop: 4 }}>{ttd(api)}</div>
      <div style={{ fontSize: 8.5, color: PDF.inkMute, marginTop: 2, fontFamily: MONO }}>{apps} apps</div>
    </div>
  );
}

// ── Floor tile (print twin of the app's ActivityTile) ─────────────────────
function FloorTile({ label, actual, floor }) {
  const band = kpiBand(actual, floor);
  const fg = band === 'met' ? PDF.success : band === 'at' ? PDF.warning : PDF.danger;
  const bg = band === 'met' ? PDF.successTint : band === 'at' ? PDF.warningTint : PDF.dangerTint;
  const pct = Math.min(100, Math.round((actual / floor) * 100));
  const mark = band === 'met' ? '✓' : band === 'at' ? '~' : '▾';
  return (
    <div style={{ padding: '10px 12px', background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 7.5, fontWeight: 700, color: PDF.inkMute, letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: MONO }}>{label}</div>
        <div style={{ fontSize: 8, fontWeight: 700, color: fg, padding: '1px 6px', background: bg, borderRadius: 999, fontFamily: MONO }}>{mark}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, marginTop: 6 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: PDF.ink, fontFamily: SERIF_DISPLAY, letterSpacing: '-0.02em', lineHeight: 0.9 }}>{actual}</div>
        <div style={{ fontSize: 9, color: PDF.inkFaint, fontFamily: MONO, paddingBottom: 2 }}>/ {floor}</div>
      </div>
      <div style={{ marginTop: 8, height: 4, background: PDF.paperPanel, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: 4, background: fg, borderRadius: 999 }}></div>
      </div>
    </div>
  );
}

// ── Coaching ratio cell (mirrors ARRatios) ────────────────────────────────
function RatioCell({ label, value, tone }) {
  const c = tone === 'success' ? PDF.success : tone === 'warning' ? PDF.warning : tone === 'mute' ? PDF.inkFaint : PDF.teal;
  return (
    <div style={{ padding: '9px 11px', background: PDF.paperPanel, border: `1px solid ${PDF.rule}`, borderRadius: 9 }}>
      <div style={{ fontSize: 8.5, color: PDF.inkMute, fontFamily: MONO }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: SERIF_DISPLAY, letterSpacing: '-0.02em', marginTop: 3 }}>{value}</div>
    </div>
  );
}

// ── PAGE 2 — Snapshot: hero + windows + production breakdown ──────────────
function RefinedPage2() {
  const a = AGENT;
  return (
    <PdfPage runningHeader pageNumber={2} totalPages={4}>
      <div style={{ padding: `20px ${PAD}px 0` }}>
        <SectionMark n="01" title="The week, and the year so far" subtitle="This week's production against the company floor, and the year to date." />

        {/* Hero — New API / Applications / Persistency / Closing ratio */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 24,
          padding: '16px 18px', background: PDF.paper,
          border: `1px solid ${PDF.rule}`, borderRadius: 12,
        }}>
          <HeroStat eyebrow="NEW API · THIS WEEK" value={ttd(a.weekApi)} sub={`vs TTD ${AGENT_API_FLOOR.toLocaleString()} weekly floor`} />
          <HeroStat eyebrow="APPLICATIONS" value={a.weekApps} sub="vs 1 weekly floor" />
          <div style={{ flex: 1 }}></div>
          <HeroStat eyebrow="PERSISTENCY" value={`${a.pers}%`} sub="vs 80% threshold" color={a.pers >= 90 ? PDF.success : a.pers >= 80 ? PDF.ink : PDF.warning} />
          <HeroStat eyebrow="CLOSING RATIO" value={`${a.conv}%`} sub="CI → App" color={a.conv >= 70 ? PDF.success : PDF.ink} />
        </div>

        {/* Four time windows */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
          {a.windows.map((w) => (
            <WindowTile key={w.label} label={w.label} api={w.api} apps={w.apps} active={w.label === 'This year'} />
          ))}
        </div>
      </div>

      {/* Section 02 — Production breakdown */}
      <div style={{ padding: `22px ${PAD}px 0` }}>
        <SectionMark n="02" title="Production breakdown" subtitle="New Business, Persistency Premium Plus, and Lumpsum credits — this week, this month, and this year." />

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: SANS }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${PDF.ruleStrong}` }}>
              <th style={{ textAlign: 'left',  padding: '8px 6px', fontSize: 8, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em', width: 90 }}>PERIOD</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 8, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>NB APPS</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 8, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>NB API</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 8, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>PPP APPS</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 8, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>PPP INC.</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 8, color: PDF.inkMute, fontWeight: 700, letterSpacing: '0.1em' }}>LMPS (10%)</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 8, color: PDF.teal,    fontWeight: 700, letterSpacing: '0.1em' }}>TOTAL API</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'This week',  nbApps: 3,  nbApi: 19400,  pppApps: 1,  pppInc: 4200,  lmps: 800,   total: 24400 },
              { label: 'This month', nbApps: 11, nbApi: 58200,  pppApps: 3,  pppInc: 8400,  lmps: 2600,  total: 69200 },
              { label: 'This year',  nbApps: 34, nbApi: 421000, pppApps: 7,  pppInc: 51400, lmps: 14600, total: 487000 },
            ].map((r, i, arr) => (
              <tr key={r.label} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${PDF.rule}` : 'none' }}>
                <td style={{ padding: '8px 6px', fontWeight: 700, fontSize: 10 }}>{r.label}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: PDF.ink, fontFamily: MONO, fontSize: 10 }}>{r.nbApps}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: PDF.ink, fontFamily: MONO, fontSize: 10 }}>{r.nbApi.toLocaleString()}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: PDF.ink, fontFamily: MONO, fontSize: 10 }}>{r.pppApps}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: PDF.ink, fontFamily: MONO, fontSize: 10 }}>{r.pppInc.toLocaleString()}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: PDF.ink, fontFamily: MONO, fontSize: 10 }}>{r.lmps.toLocaleString()}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: PDF.teal, fontFamily: MONO, fontWeight: 700, fontSize: 10.5 }}>{r.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 8.5, color: PDF.inkFaint, marginTop: 8, fontStyle: 'italic' }}>
          All values in TTD. Lumpsum credits applied at 10% per Tatil Life production policy.
        </div>
      </div>

      {/* Section 03 — YTD vs targets bar */}
      <div style={{ padding: `18px ${PAD}px 0` }}>
        <SectionMark n="03" title="Year-to-date vs targets" subtitle="Settled and pending settlement, against the L4 tenure floor, MDRT, and your annual goal." />

        {/* max scale = TTD 600k goal */}
        <div style={{ position: 'relative', height: 28, marginTop: 12 }}>
          <div style={{ position: 'absolute', inset: 0, background: PDF.rule, borderRadius: 6 }}></div>
          <div style={{ position: 'absolute', left: 0, top: 0, width: '81%', height: 28, background: PDF.teal, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }}></div>
          <div style={{ position: 'absolute', left: '81%', top: 0, width: '11%', height: 28, background: PDF.tealMid, opacity: 0.55 }}></div>
          {[
            { x: 83, color: PDF.warning },   // MDRT 500k
            { x: 92, color: PDF.ink },       // L4 floor 550k
          ].map((m, i) => (
            <div key={i} style={{ position: 'absolute', left: `${m.x}%`, top: -3, bottom: -3, width: 1.5, background: m.color }}></div>
          ))}
        </div>

        <div style={{ position: 'relative', height: 22, marginTop: 4 }}>
          {[
            { x: 83, label: 'MDRT',     value: 'TTD 500k', color: PDF.warning },
            { x: 92, label: 'L4 Floor', value: 'TTD 550k', color: PDF.ink },
            { x: 100, label: 'Goal',    value: 'TTD 600k', color: PDF.success, right: true },
          ].map((m, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${m.x}%`, top: 0,
              transform: m.right ? 'translateX(-100%)' : 'translateX(-50%)',
              textAlign: m.right ? 'right' : 'center',
            }}>
              <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.1em', color: m.color, textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ fontSize: 8.5, color: PDF.inkMute, fontFamily: MONO, marginTop: 1 }}>{m.value}</div>
            </div>
          ))}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 18,
          padding: '12px 14px', background: PDF.paperPanel,
          borderRadius: 10, border: `1px solid ${PDF.rule}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: PDF.teal }}></div>
            <div style={{ fontSize: 9, color: PDF.inkMute }}>Settled · TTD 487,000</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: PDF.tealMid, opacity: 0.55 }}></div>
            <div style={{ fontSize: 9, color: PDF.inkMute }}>Pending · TTD 66,200</div>
          </div>
          <div style={{ flex: 1 }}></div>
          <div style={{ fontSize: 9, color: PDF.ink }}>
            <span style={{ color: PDF.teal, fontWeight: 700 }}>TTD 553,200</span> achieved · <span style={{ color: PDF.inkFaint }}>clears the L4 floor with pending</span>
          </div>
        </div>
      </div>
    </PdfPage>
  );
}

// ── PAGE 3 — This week vs the floor + trajectory + ratios + tenure ────────
function RefinedPage3() {
  const a = AGENT;
  const floor = AGENT_TENURE_FLOORS[a.level];
  const floorPct = Math.min(100, Math.round((a.ytdApi / floor) * 100));

  // 6-week trajectory spark
  const sp = a.spark;
  const W = A4_W - PAD * 2, sh = 60;
  const min = Math.min(...sp), max = Math.max(...sp), r = max - min || 1;
  const sparkPts = sp.map((v, i) => {
    const x = (i / (sp.length - 1)) * (W * 0.52 - 12) + 6;
    const y = sh - 6 - ((v - min) / r) * (sh - 16) + 4;
    return [x, y];
  });
  const sparkD = sparkPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const sparkArea = `${sparkD} L ${sparkPts[sparkPts.length - 1][0].toFixed(1)} ${sh} L ${sparkPts[0][0].toFixed(1)} ${sh} Z`;
  const last = sparkPts[sparkPts.length - 1];

  return (
    <PdfPage runningHeader pageNumber={3} totalPages={4}>
      <div style={{ padding: `22px ${PAD}px 0` }}>
        <SectionMark n="04" title="This week's activity, vs the company floor" subtitle="The eight company-floor activity standards in fixed order. Each bar fills to its weekly minimum; ✓ met · ~ within 90% · ▾ below." />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
          {AGENT_FLOOR_KPIS.map((k) => (
            <FloorTile key={k.key} label={k.label} actual={a.act[k.key]} floor={k.floor} />
          ))}
        </div>
      </div>

      {/* Section 05 — Trajectory + coaching ratios */}
      <div style={{ padding: `22px ${PAD}px 0` }}>
        <SectionMark n="05" title="Trajectory & coaching ratios" subtitle="Weekly New API over the last six weeks, and the conversion ratios behind it." />

        <div style={{ display: 'flex', gap: 12 }}>
          {/* Trajectory */}
          <div style={{ flex: 1.05, padding: '14px 16px', background: PDF.paperPanel, border: `1px solid ${PDF.rule}`, borderRadius: 12 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: PDF.inkFaint, letterSpacing: '0.14em', fontFamily: MONO, marginBottom: 8 }}>6-WEEK API TRAJECTORY</div>
            <svg width={W * 0.52} height={sh} style={{ display: 'block', overflow: 'visible' }}>
              <defs><linearGradient id="ar-spark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={PDF.teal} stopOpacity="0.20" /><stop offset="1" stopColor={PDF.teal} stopOpacity="0" /></linearGradient></defs>
              <path d={sparkArea} fill="url(#ar-spark)" />
              <path d={sparkD} fill="none" stroke={PDF.teal} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={last[0]} cy={last[1]} r="3" fill={PDF.teal} />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 8, color: PDF.inkFaint, fontFamily: MONO }}>
              <span>6 wks ago</span><span>{ttd(a.weekApi)} this wk</span>
            </div>
          </div>

          {/* Coaching ratios 2×2 */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, alignContent: 'start' }}>
            {a.ratios.map((rt) => <RatioCell key={rt.label} label={rt.label} value={rt.value} tone={rt.tone} />)}
          </div>
        </div>
      </div>

      {/* Section 06 — Tenure floor */}
      <div style={{ padding: `22px ${PAD}px 0` }}>
        <SectionMark n="06" title="Year-to-date vs L4 tenure floor" subtitle="Each career level carries a YTD API floor: L1 250K · L2 350K · L3 450K · L4 550K." />

        <div style={{ padding: '14px 16px', background: PDF.paper, border: `1px solid ${PDF.rule}`, borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: PDF.inkFaint, letterSpacing: '0.12em', fontFamily: MONO }}>YTD SETTLED VS L4 FLOOR</div>
            <div style={{ fontSize: 11, color: PDF.inkMute, fontFamily: MONO }}>{ttd(a.ytdApi)} / {ttd(floor)}</div>
          </div>
          <div style={{ height: 8, background: PDF.paperPanel, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${floorPct}%`, height: 8, background: `linear-gradient(90deg, ${PDF.tealDark}, ${PDF.teal})`, borderRadius: 999 }}></div>
          </div>
          <div style={{ fontSize: 9.5, color: PDF.warning, fontWeight: 600, marginTop: 8 }}>
            {floorPct}% on settled API — TTD 66,200 in pending settlements clears the L4 floor.
          </div>
        </div>
      </div>
    </PdfPage>
  );
}

// ── PAGE 4 — Career, Awards, Coaching note, Focus ─────────────────────────
function RefinedPage4() {
  return (
    <PdfPage runningHeader pageNumber={4} totalPages={4}>
      <div style={{ padding: `18px ${PAD}px 0` }}>
        <SectionMark n="07" title="Career level" subtitle="The Tatil Life career ladder is based on YTD API and applications. Each rung unlocks new responsibilities and rewards." />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 18,
          padding: '18px 20px', background: PDF.paperCream,
          border: `1px solid ${PDF.rule}`, borderRadius: 12,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `radial-gradient(circle at 32% 28%, #fde68a 0%, ${PDF.gold} 50%, #92400e 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.18), inset 0 2px 4px rgba(255,255,255,0.4), 0 4px 14px rgba(176,125,26,0.35)',
            color: 'white', fontSize: 11, fontWeight: 800, letterSpacing: '-0.04em',
            fontFamily: SERIF_DISPLAY, position: 'relative',
          }}>
            <span style={{ position: 'relative', zIndex: 1 }}>L4</span>
            <span style={{ position: 'absolute', top: '6%', left: '18%', width: '38%', height: '24%', borderRadius: '50%', background: 'rgba(255,255,255,0.42)', filter: 'blur(2px)' }}></span>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 8.5, color: PDF.gold, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 3 }}>Current level</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.018em', fontFamily: SERIF_DISPLAY }}>Senior Associate · L4</div>
            <div style={{ fontSize: 9.5, color: PDF.inkMute, marginTop: 2 }}>Achieved 14 March 2026 — earned at TTD 450,000 YTD API and 38 applications.</div>
          </div>

          <div style={{ width: 220 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <div style={{ fontSize: 9, color: PDF.inkMute }}>To Level 5 · Manager</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: PDF.teal, fontFamily: MONO }}>89%</div>
            </div>
            <div style={{ height: 6, background: PDF.rule, borderRadius: 3 }}>
              <div style={{ width: '89%', height: 6, background: PDF.teal, borderRadius: 3 }}></div>
            </div>
            <div style={{ fontSize: 8, color: PDF.inkFaint, marginTop: 5 }}>TTD 63,000 &amp; 24 apps from the next rung</div>
          </div>
        </div>
      </div>

      {/* Section 08 — Award progress (canonical set) */}
      <div style={{ padding: `18px ${PAD}px 0` }}>
        <SectionMark n="08" title="Award progress" subtitle="The four Tatil Life recognition programmes, as tracked in AgencyTrack." />

        {[
          { name: 'Eagles Club',       sub: 'Bermuda incentive trip · TTD 420,000 settled API', pct: 100, status: 'Achieved',    color: PDF.success, bg: PDF.successTint },
          { name: 'Q4 Champion',       sub: 'TTD 5,000 bonus · TTD 150,000 quarter API',        pct: 100, status: 'Achieved',    color: PDF.success, bg: PDF.successTint },
          { name: 'MDRT 2026',         sub: 'Million Dollar Round Table · TTD 500,000 API',     pct: 97,  status: 'In progress', color: PDF.teal,    bg: PDF.tealTint },
          { name: 'Activity Producer', sub: 'Annual plaque · 2,000 activities YTD',             pct: 84,  status: 'In progress', color: PDF.teal,    bg: PDF.tealTint },
        ].map((aw, i, arr) => (
          <div key={aw.name} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '8px 0',
            borderBottom: i < arr.length - 1 ? `1px solid ${PDF.rule}` : 'none',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: aw.pct === 100 ? PDF.success : aw.color }}></div>
            <div style={{ width: 168 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: PDF.ink, letterSpacing: '-0.01em' }}>{aw.name}</div>
              <div style={{ fontSize: 8.5, color: PDF.inkFaint, marginTop: 1 }}>{aw.sub}</div>
            </div>
            <div style={{ flex: 1, height: 5, background: PDF.rule, borderRadius: 3 }}>
              <div style={{ width: `${aw.pct}%`, height: 5, background: aw.color, borderRadius: 3 }}></div>
            </div>
            <div style={{ width: 36, textAlign: 'right', fontSize: 10, color: PDF.ink, fontFamily: MONO }}>{aw.pct}%</div>
            <div style={{ width: 90, display: 'flex', justifyContent: 'flex-end' }}>
              <Pill color={aw.color} bg={aw.bg}>{aw.status}</Pill>
            </div>
          </div>
        ))}
      </div>

      {/* Section 09 — Coaching note (mirrors the live gold note) */}
      <div style={{ padding: `18px ${PAD}px 0` }}>
        <div style={{
          padding: '14px 16px', background: PDF.goldTint,
          border: `1px solid ${PDF.gold}55`, borderRadius: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span style={{ fontSize: 11, color: PDF.gold }}>★</span>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: PDF.gold, letterSpacing: '0.14em', fontFamily: MONO }}>COACHING NOTE · TREVOR RAMCHARAN</div>
          </div>
          <div style={{ fontSize: 11, color: PDF.ink, lineHeight: 1.5 }}>{AGENT.note}</div>
        </div>
      </div>

      {/* Focus callout */}
      <div style={{ padding: `14px ${PAD}px 0` }}>
        <div style={{ padding: '12px 16px', background: PDF.teal, borderRadius: 12, color: PDF.paper }}>
          <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.75)', fontWeight: 700, letterSpacing: '0.16em', fontFamily: MONO, marginBottom: 6 }}>FOCUS · Q4 2026</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: PDF.paper, letterSpacing: '-0.012em', lineHeight: 1.3, fontFamily: SERIF_DISPLAY }}>
            One strong closing week locks MDRT 2026 &mdash; and the TTD 66,000 already pending carries her past the L4 550K floor.
          </div>
        </div>
      </div>
    </PdfPage>
  );
}

Object.assign(window, {
  AGENT_FLOOR_KPIS, AGENT_API_FLOOR, AGENT_TENURE_FLOORS, AGENT, kpiBand,
  HeroStat, WindowTile, FloorTile, RatioCell,
  RefinedPage2, RefinedPage3, RefinedPage4,
});

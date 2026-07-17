// Strategic Plan — shared data + primitives. Loads after app-tokens/app-motion/app-shell.

// ── Sample data — San Fernando Branch, Tatil Life · South, FY 2026 ────────
const SP_ELAPSED = 0.542; // mid-July proration of the annual objective

// unit: '1'|'2'|'3' · money in TTD thousands
const SP_AGENTS = [
  { name:'Marsha Singh',    unit:'1', since:2018, pc:412, ap:168, ff:96, ci:74, sl:41, asub:44, aset:41, ntu:3, apiSub:486, apiG:452, apiN:431, obj:720, pers:91.4 },
  { name:'Anil Boodram',    unit:'1', since:2020, pc:355, ap:132, ff:78, ci:55, sl:29, asub:31, aset:28, ntu:3, apiSub:344, apiG:318, apiN:296, obj:560, pers:88.9 },
  { name:'Sara Khan',       unit:'1', since:2021, pc:298, ap:121, ff:70, ci:52, sl:30, asub:32, aset:30, ntu:2, apiSub:337, apiG:312, apiN:301, obj:520, pers:90.2 },
  { name:'Ravi Maharaj',    unit:'1', since:2024, pc:205, ap:74,  ff:39, ci:24, sl:11, asub:12, aset:10, ntu:2, apiSub:128, apiG:112, apiN:98,  obj:400, pers:84.1 },
  { name:'Selina Mohammed', unit:'2', since:2016, pc:388, ap:155, ff:91, ci:68, sl:37, asub:39, aset:37, ntu:2, apiSub:428, apiG:401, apiN:384, obj:640, pers:92.6 },
  { name:'Kareem Mohammed', unit:'2', since:2019, pc:312, ap:118, ff:66, ci:47, sl:25, asub:27, aset:24, ntu:3, apiSub:271, apiG:248, apiN:232, obj:480, pers:87.3 },
  { name:'Alicia Ramdeen',  unit:'2', since:2022, pc:268, ap:102, ff:58, ci:41, sl:22, asub:24, aset:22, ntu:2, apiSub:246, apiG:228, apiN:214, obj:420, pers:89.8 },
  { name:'Nigel Baptiste',  unit:'2', since:2024, pc:224, ap:80,  ff:42, ci:27, sl:13, asub:14, aset:12, ntu:2, apiSub:142, apiG:129, apiN:117, obj:400, pers:82.7 },
  { name:'Priya Sookdeo',   unit:'3', since:2017, pc:341, ap:139, ff:82, ci:61, sl:33, asub:35, aset:33, ntu:2, apiSub:372, apiG:349, apiN:334, obj:560, pers:93.1 },
  { name:'Marlon Charles',  unit:'3', since:2021, pc:289, ap:108, ff:61, ci:44, sl:23, asub:25, aset:23, ntu:2, apiSub:258, apiG:237, apiN:221, obj:440, pers:86.4 },
  { name:'Candice Ramlal',  unit:'3', since:2023, pc:246, ap:92,  ff:51, ci:35, sl:18, asub:19, aset:17, ntu:2, apiSub:189, apiG:171, apiN:158, obj:400, pers:85.9 },
  { name:'Josh Ramkissoon', unit:'3', since:2022, pc:231, ap:88,  ff:49, ci:34, sl:17, asub:18, aset:17, ntu:1, apiSub:186, apiG:174, apiN:165, obj:340, pers:88.0 },
];
const SP_TOTAL = SP_AGENTS.reduce((a, r) => ({
  pc:a.pc+r.pc, ap:a.ap+r.ap, ff:a.ff+r.ff, ci:a.ci+r.ci, sl:a.sl+r.sl,
  asub:a.asub+r.asub, aset:a.aset+r.aset, ntu:a.ntu+r.ntu,
  apiSub:a.apiSub+r.apiSub, apiG:a.apiG+r.apiG, apiN:a.apiN+r.apiN, obj:a.obj+r.obj,
}), { pc:0,ap:0,ff:0,ci:0,sl:0,asub:0,aset:0,ntu:0,apiSub:0,apiG:0,apiN:0,obj:0 });

const SP_BRANCH = {
  name:'San Fernando Branch', region:'Tatil Life · South Region',
  author:'Anand Persad', role:'Branch Manager',
  period:'FY 2026', generated:'Generated 17 Jul 2026 · 09:42 AST',
  quota: SP_TOTAL.obj, ytd: SP_TOTAL.apiN,
  runRate: Math.round(SP_TOTAL.apiN / 6.5 * 12), // 5,448K
};

const SP_UNITS = [
  { key:'1', name:'Unit 1 · Marabella',    um:'Carla Joseph' },
  { key:'2', name:'Unit 2 · Gulf View',    um:'Devin Lewis' },
  { key:'3', name:'Unit 3 · Princes Town', um:'Hema Lakhan' },
];
const SP_ADMIN = [
  { name:'Natasha Ali',   role:'Branch administrator' },
  { name:'Keisha Charles', role:'Delivery register · CRO liaison' },
];

const SP_MONTHS = [ // [month, net settled K, mtd?]  quota = 490K/mo prorated
  ['Jan',452],['Feb',431],['Mar',522],['Apr',468],['May',448],['Jun',415],['Jul',215,true],
];
const SP_MQUOTA = 490;

const SP_PERSIST = [ // [row, 13-mo, 25-mo]  floor 85
  ['Unit 1 · Marabella',91.0,88.3],['Unit 2 · Gulf View',87.8,84.6],
  ['Unit 3 · Princes Town',88.4,86.1],['Branch overall',89.1,86.3],
];

const SP_PERIODS = {
  quarter: [
    { p:'Q1', apps:[130,136], api:[1420,1405], man:[13,12], state:'done' },
    { p:'Q2', apps:[140,130], api:[1470,1331], man:[14,12], state:'done' },
    { p:'Q3', apps:[145,28],  api:[1490,215],  man:[15,12], state:'progress' },
    { p:'Q4', apps:[150,null],api:[1500,null], man:[16,null],state:'future' },
  ],
  half: [
    { p:'H1', apps:[270,266], api:[2890,2736], man:[14,12], state:'done' },
    { p:'H2', apps:[295,28],  api:[2990,215],  man:[16,12], state:'progress' },
  ],
  fy: { p:'FY', apps:[565,294], api:[5880,2951], man:[16,12], state:'progress' },
};

const SP_STAGES = ['SRC','SCR','APT','INT','OFR','EXM','CON','LIC'];
const SP_STAGE_LEGEND = 'Sourced · Screened · Aptitude · Interview · Offer · Licensing exam · Contracted · Licensed';
const SP_RECRUITS = [
  { name:'Aaliyah Hosein',    unit:'Unit 2', src:'Referral',    stage:8, status:'hired',   note:'Licensed 02 Jun' },
  { name:'Marcus Dindial',    unit:'Unit 1', src:'Career fair', stage:6, status:'active',  note:'Exam sat 12 Jul' },
  { name:'Renee Gopaul',      unit:'Unit 3', src:'Referral',    stage:5, status:'active',  note:'Offer extended' },
  { name:'Vishal Samaroo',    unit:'Unit 1', src:'Walk-in',     stage:4, status:'active',  note:'Panel 22 Jul' },
  { name:'Jerome Cudjoe',     unit:'Unit 3', src:'Referral',    stage:4, status:'dropped', note:'Withdrew 30 Jun' },
  { name:'Tenille Alexander', unit:'Unit 2', src:'Career fair', stage:3, status:'active',  note:'Aptitude 19 Jul' },
  { name:'Brandon Assang',    unit:'Unit 1', src:'Referral',    stage:2, status:'active',  note:'Screen complete' },
  { name:'Shivani Rampersad', unit:'Unit 2', src:'Walk-in',     stage:1, status:'active',  note:'Sourced 14 Jul' },
];

// ── Helpers ───────────────────────────────────────────────────────────────
function spPct(r) { return Math.round(r.apiN / (r.obj * SP_ELAPSED) * 100); }
function spBand(t, pct) {
  if (pct >= 100) return { c:t.success, bg:t.successTint, label:'ON PACE' };
  if (pct >= 85)  return { c:t.warning, bg:t.warningTint, label:'AT FLOOR' };
  return { c:t.danger, bg:t.dangerTint, label:'BELOW' };
}
function spInitials(n) { return n.split(' ').map(w => w[0]).slice(0,2).join(''); }
function spHeroInk(t)  { return t.mode === 'light' ? '#013D40' : '#E4F5F5'; }
function spHeroMute(t) { return t.mode === 'light' ? 'rgba(1,61,64,0.62)' : 'rgba(228,245,245,0.60)'; }

// Size scale — app (dashboard) vs pres (projected slide)
const SP_SZ = {
  app:  { eyebrow:10.5, secTitle:21, secSub:11.5, statLabel:9.5, statVal:24, statSub:10.5, th:9,  td:11.5, name:12.5, rowH:34, mono:10.5, cellPad:'0 9px' },
  pres: { eyebrow:13,   secTitle:38, secSub:15,   statLabel:10.5, statVal:26, statSub:12, th:10.5, td:14, name:15,  rowH:40, mono:12.5, cellPad:'0 11px' },
};

// ── Glass hero (teal) — the one glass card per section summary ───────────
function GlassHero({ t, children, pad = '18px 22px', style = {} }) {
  const L = t.mode === 'light';
  return (
    <div style={{
      position:'relative', borderRadius:18, padding:pad, overflow:'hidden',
      background: L
        ? 'linear-gradient(135deg, rgba(1,105,111,0.15), rgba(1,105,111,0.02) 58%), rgba(255,255,255,0.62)'
        : 'linear-gradient(135deg, rgba(74,181,184,0.17), rgba(74,181,184,0.02) 58%), rgba(32,27,21,0.55)',
      backdropFilter:'blur(18px) saturate(135%)', WebkitBackdropFilter:'blur(18px) saturate(135%)',
      border:`1px solid ${L ? 'rgba(1,105,111,0.30)' : 'rgba(240,235,224,0.16)'}`,
      boxShadow: L
        ? 'inset 0 1px 0 rgba(255,255,255,0.55), 0 14px 34px rgba(38,35,28,0.09)'
        : 'inset 0 1px 0 rgba(255,255,255,0.07), 0 18px 44px rgba(0,0,0,0.38)',
      ...style,
    }}>{children}</div>
  );
}

// Stat strip inside a glass hero — hero ink stays in here
function SpStatStrip({ t, items, size = 'app' }) {
  const S = SP_SZ[size], hi = spHeroInk(t), hm = spHeroMute(t);
  return (
    <div style={{ display:'flex', alignItems:'stretch', gap:0 }}>
      {items.map((it, i) => (
        <div key={i} style={{
          flex: it.flex || 1, minWidth:0, padding:'2px 22px',
          borderLeft: i ? `1px solid ${t.mode==='light' ? 'rgba(1,105,111,0.18)' : 'rgba(240,235,224,0.12)'}` : 'none',
          paddingLeft: i ? 22 : 0,
        }}>
          <div style={{ fontSize:S.statLabel, fontWeight:700, letterSpacing:'0.16em', fontFamily:APP_FONT_MONO, color: it.accent || hm, whiteSpace:'nowrap' }}>{it.k}</div>
          <div style={{ fontSize:S.statVal, fontWeight:800, letterSpacing:'-0.025em', fontFamily:APP_FONT_DISPLAY, color: it.color || hi, marginTop:6, lineHeight:1, whiteSpace:'nowrap' }}>{it.v}</div>
          {it.sub && <div style={{ fontSize:S.statSub, color:hm, marginTop:5, whiteSpace:'nowrap' }}>{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// Section header — numbered mono eyebrow + display title
function SpSectionHead({ t, num, eyebrow, title, sub, right, size = 'app' }) {
  const S = SP_SZ[size];
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:16, marginBottom:14 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:S.eyebrow, fontWeight:700, letterSpacing:'0.18em', fontFamily:APP_FONT_MONO, color:t.teal, textTransform:'uppercase' }}>{num} · {eyebrow}</div>
        <div style={{ fontSize:S.secTitle, fontWeight:800, letterSpacing:'-0.025em', fontFamily:APP_FONT_DISPLAY, color:t.ink, marginTop:5, lineHeight:1.08 }}>{title}</div>
        {sub && <div style={{ fontSize:S.secSub, color:t.inkMute, marginTop:5, maxWidth:720, lineHeight:1.5, textWrap:'pretty' }}>{sub}</div>}
      </div>
      {right && <div style={{ flexShrink:0 }}>{right}</div>}
    </div>
  );
}

// Status pill (mono uppercase, banded)
function SpStatus({ t, band, size = 'app' }) {
  return (
    <span style={{
      display:'inline-block', padding: size==='pres' ? '4px 10px' : '2px 8px', borderRadius:999,
      fontSize: size==='pres' ? 11 : 8.5, fontWeight:700, letterSpacing:'0.1em',
      fontFamily:APP_FONT_MONO, color:band.c, background:band.bg, whiteSpace:'nowrap',
    }}>{band.label}</span>
  );
}

// Signed variance, colored
function SpVar({ t, v, fmt, size = 'app' }) {
  const S = SP_SZ[size];
  if (v == null) return <span style={{ color:t.inkFaint, fontFamily:APP_FONT_MONO, fontSize:S.mono }}>—</span>;
  const pos = v >= 0;
  const txt = fmt ? fmt(Math.abs(v)) : Math.abs(v);
  return <span style={{ color: pos ? t.success : t.danger, fontFamily:APP_FONT_MONO, fontSize:S.mono, fontWeight:700 }}>{pos ? '+' : '−'}{txt}</span>;
}

// Initials tile (person = circle)
function SpAvatar({ t, name, size = 26, dark }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', background:t.tealTint, color:t.teal,
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      fontWeight:700, fontSize:size*0.38, fontFamily:APP_FONT_DISPLAY,
    }}>{spInitials(name)}</div>
  );
}

Object.assign(window, {
  SP_ELAPSED, SP_AGENTS, SP_TOTAL, SP_BRANCH, SP_UNITS, SP_ADMIN, SP_MONTHS, SP_MQUOTA,
  SP_PERSIST, SP_PERIODS, SP_STAGES, SP_STAGE_LEGEND, SP_RECRUITS,
  spPct, spBand, spInitials, spHeroInk, spHeroMute, SP_SZ,
  GlassHero, SpStatStrip, SpSectionHead, SpStatus, SpVar, SpAvatar,
});

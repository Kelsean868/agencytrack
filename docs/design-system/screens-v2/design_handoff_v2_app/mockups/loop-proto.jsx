// AgencyTrack — The Loop, interactive. One phone you actually drive: anchor a
// campaign tier → see this week's prescription → fill the gap from the hit-list
// → book it → log the sale (Written) → push it Submitted → Settled → the tier
// clears and the prescription re-solves. State propagates across the whole loop.
// Reuses app-tokens (APP_LIGHT/DARK, icons, ttd) + app-mobile (MFrame, M_W/M_H).

const { useReducer, useEffect } = React;
const LS_KEY = 'agencytrack_loop_v1';

// ── Domain constants ───────────────────────────────────────────────────────
const TIER = { name: 'Champion', api: 200_000, apps: 20, cash: 7_000, voucher: 2_000 };
const NEXT_TIER = { name: 'VIP', api: 275_000, apps: 20, cash: 20_000, voucher: 2_000 };
const WEEKS_LEFT = 6;
const BASE = { api: 184_000, apps: 19 };   // settled before this session
const PERS = 88;

// Prospects the hit-list offers to close the C.I gap.
const PROSPECTS = [
  { id: 'anand',  name: 'Anand Maharaj', why: 'F.F.I done · Whole Life 250K · ready to close', api: 18_400, product: 'Whole Life', premium: 1_533, freq: 'Monthly', hot: true },
  { id: 'kavita', name: 'Kavita Ramlogan', why: 'Owns Life · gap: Critical Illness rider', api: 6_200, product: 'Critical Illness', premium: 517, freq: 'Monthly' },
  { id: 'dexter', name: 'Dexter Charles', why: 'Pension transfer · callback due', api: 14_000, product: 'Annuity', premium: 14_000, freq: 'Annually' },
];
const FREQ_MULT = { Monthly: 12, Quarterly: 4, 'Semi-Annually': 2, Annually: 1 };
function calcApi(premium, freq) { return Math.round(premium * (FREQ_MULT[freq] || 1)); }

// ── State ──────────────────────────────────────────────────────────────────
const initial = {
  screen: 'plan',
  bookedCI: 0,                 // C.I booked into the planner this week
  appts: [],                   // [{id, prospectId, name, code, done}]
  records: [],                 // [{id, client, product, premium, freq, api, type, status, policyNo}]
  selectedProspect: null,      // for booking / logging
  saleClient: null,            // prospect being logged
  draftApps: [],               // applications staged in the log sheet
  toast: null,
  theme: 'light',
};

function load() {
  try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s && s.records) return { ...initial, ...s, toast: null }; } catch (e) {}
  return initial;
}

function reducer(state, a) {
  switch (a.type) {
    case 'GOTO': return { ...state, screen: a.screen };
    case 'THEME': return { ...state, theme: state.theme === 'light' ? 'dark' : 'light' };
    case 'RESET': return { ...initial, theme: state.theme };
    case 'BOOK_CI': {
      const p = a.prospect;
      return {
        ...state,
        bookedCI: state.bookedCI + 1,
        appts: [...state.appts, { id: 'ap_' + p.id, prospectId: p.id, name: p.name, code: 'CI', done: false }],
        screen: 'planner',
        toast: { kind: 'ok', msg: `Booked C.I — ${p.name}, Wed 10:00` },
      };
    }
    case 'OPEN_SALE': {  // from a kept appt → start logging, prefilled
      const p = PROSPECTS.find((x) => x.id === a.prospectId);
      return {
        ...state, screen: 'logsale', saleClient: p,
        draftApps: [{ uid: 1, product: p.product, premium: p.premium, freq: p.freq, type: 'Ordinary', policyNo: '' }],
      };
    }
    case 'ADD_APP': {
      const uid = (state.draftApps.at(-1)?.uid || 0) + 1;
      return { ...state, draftApps: [...state.draftApps, { uid, product: 'Critical Illness', premium: 400, freq: 'Monthly', type: 'Ordinary', policyNo: '' }] };
    }
    case 'EDIT_APP': {
      return { ...state, draftApps: state.draftApps.map((d) => d.uid === a.uid ? { ...d, [a.key]: a.value } : d) };
    }
    case 'REMOVE_APP': return { ...state, draftApps: state.draftApps.filter((d) => d.uid !== a.uid) };
    case 'SAVE_SALE': {
      const recs = state.draftApps.map((d, i) => ({
        id: 'rec_' + Date.now() + '_' + i,
        client: state.saleClient.name,
        product: d.product, premium: d.premium, freq: d.freq, type: d.type,
        api: d.type === 'Replacement' ? 0 : calcApi(d.premium, d.freq),
        apiRaw: calcApi(d.premium, d.freq),
        countsApps: d.type !== 'Replacement',
        status: 'written', policyNo: d.policyNo || '',
        apptId: 'ap_' + state.saleClient.id,
      }));
      // mark the appt done
      const appts = state.appts.map((ap) => ap.prospectId === state.saleClient.id ? { ...ap, done: true } : ap);
      return { ...state, records: [...state.records, ...recs], appts, screen: 'ledger', draftApps: [], saleClient: null,
        toast: { kind: 'ok', msg: `${recs.length} application${recs.length > 1 ? 's' : ''} written` } };
    }
    case 'SET_STATUS': {
      return {
        ...state,
        records: state.records.map((r) => r.id === a.id ? { ...r, status: a.status, policyNo: a.policyNo ?? r.policyNo } : r),
        toast: { kind: 'ok', msg: a.status === 'submitted' ? 'Submitted to head office' : 'Settled — credited to your campaign' },
      };
    }
    case 'CLEAR_TOAST': return { ...state, toast: null };
    default: return state;
  }
}

// ── Derived ────────────────────────────────────────────────────────────────
function derive(state) {
  const sum = (st, key) => state.records.filter((r) => r.status === st).reduce((s, r) => s + (key === 'apps' ? (r.countsApps ? 1 : 0) : r.api), 0);
  const settledApi = BASE.api + sum('settled', 'api');
  const settledApps = BASE.apps + sum('settled', 'apps');
  const submittedApi = sum('submitted', 'api');
  const writtenApi = sum('written', 'api');
  const champCleared = settledApi >= TIER.api && settledApps >= TIER.apps;
  const target = champCleared ? NEXT_TIER : TIER;
  const gapApi = Math.max(0, target.api - settledApi);
  const gapApps = Math.max(0, target.apps - settledApps);
  // backward-solve: apps gap / weeks → sales/wk → C.I/wk (close 50%)
  const needCI = Math.max(gapApps > 0 ? 1 : 0, Math.ceil((gapApps / WEEKS_LEFT) / 0.5));
  return { settledApi, settledApps, submittedApi, writtenApi, champCleared, target, gapApi, gapApps, needCI };
}

// ── Loop rail (above the phone) ────────────────────────────────────────────
const STAGES = ['Goal', 'This week', 'Hit-list', 'Book', 'Write', 'Submit', 'Settle', 'Cleared'];
function stageIndex(state, d) {
  if (state.screen === 'plan') return d.champCleared ? 7 : (d.gapApps === 0 ? 7 : 1);
  if (state.screen === 'hitlist') return 2;
  if (state.screen === 'planner') return 3;
  if (state.screen === 'logsale') return 4;
  if (state.screen === 'ledger') {
    const r = state.records;
    if (r.some((x) => x.status === 'settled')) return 6;
    if (r.some((x) => x.status === 'submitted')) return 5;
    return 4;
  }
  return 0;
}
function LoopRail({ t, idx }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 560 }}>
      {STAGES.map((s, i) => {
        const on = i === idx, done = i < idx;
        return (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: on ? t.teal : done ? t.tealTint : t.surfaceSoft, border: `1px solid ${on ? t.teal : done ? `${t.teal}44` : t.rule}` }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: on ? 'rgba(255,255,255,0.25)' : done ? t.teal : t.surface, color: on ? '#fff' : done ? '#fff' : t.inkFaint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, fontFamily: APP_FONT_MONO }}>{done ? '✓' : i + 1}</div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: on ? '#fff' : done ? t.teal : t.inkMute, fontFamily: APP_FONT_MONO, whiteSpace: 'nowrap' }}>{s}</span>
            </div>
            {i < STAGES.length - 1 && <div style={{ width: 8, height: 1.5, background: done ? t.teal : t.rule }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Small UI helpers ────────────────────────────────────────────────────────
function Btn({ t, children, onClick, kind = 'primary', icon, pulse }) {
  const s = { primary: { bg: t.teal, fg: '#fff', bd: 'none' }, secondary: { bg: t.surface, fg: t.ink, bd: `1px solid ${t.rule}` }, ghost: { bg: 'transparent', fg: t.teal, bd: `1px solid ${t.teal}55` } }[kind];
  return (
    <div onClick={onClick} className={pulse ? 'a-fab-pulse' : ''} style={{ cursor: 'pointer', minHeight: 46, padding: '12px 16px', background: s.bg, color: s.fg, border: s.bd, borderRadius: 12, fontSize: 14, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, userSelect: 'none', boxShadow: pulse ? `0 4px 14px ${t.teal}55` : 'none' }}>
      {children}{icon}
    </div>
  );
}
function Chip({ t, code, size = 'm' }) {
  const map = { CI: { fg: '#fff', bg: t.teal, solid: true }, FFI: { fg: t.teal, bg: t.tealTint }, AI: { fg: t.teal, bg: t.tealTint }, PC: { fg: t.inkAccent, bg: t.inkAccentTint } };
  const lab = { CI: 'C.I', FFI: 'F.F.I', AI: 'A.I', PC: 'P.C' }[code];
  const c = map[code] || map.CI;
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: size === 's' ? '2px 6px' : '3px 8px', borderRadius: 6, fontSize: size === 's' ? 9.5 : 10.5, fontWeight: 700, letterSpacing: '0.04em', fontFamily: APP_FONT_MONO, color: c.fg, background: c.bg, border: c.solid ? 'none' : `1px solid ${c.fg}2e` }}>{lab}</span>;
}
function Coach({ t, children }) {
  return (
    <div className="a-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: t.ink, color: t.bg, borderRadius: 999, fontSize: 11.5, fontWeight: 700, alignSelf: 'flex-start' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.teal }} className="a-breathe" />{children}
    </div>
  );
}
const ttdL = (n) => 'TTD ' + n.toLocaleString();

// ── Screen header ───────────────────────────────────────────────────────────
function Head({ t, eyebrow, title, onBack, right }) {
  return (
    <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '12px 18px 10px', background: t.bg, zIndex: 6, display: 'flex', alignItems: 'center', gap: 11 }}>
      {onBack && <div onClick={onBack} style={{ cursor: 'pointer', width: 34, height: 34, borderRadius: 10, background: t.surface, border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ display: 'flex', transform: 'scaleX(-1)' }}><IconChevR size={16} color={t.ink} stroke={2.2} /></span></div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{eyebrow}</div>}
        <div style={{ fontSize: 21, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.05, marginTop: 2 }}>{title}</div>
      </div>
      {right}
    </div>
  );
}
function Body({ children, top = 100 }) {
  return <div style={{ position: 'absolute', top, left: 0, right: 0, bottom: 0, overflowY: 'auto', overflowX: 'hidden', padding: '4px 18px 28px' }}>{children}</div>;
}

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ t, toast }) {
  if (!toast) return null;
  return (
    <div className="a-fade-up" style={{ position: 'absolute', top: 92, left: 18, right: 18, zIndex: 40, padding: '11px 14px', background: t.success, color: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 9, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      <IconCheck size={16} color="#fff" stroke={2.6} /><div style={{ flex: 1, fontSize: 12.5, fontWeight: 700 }}>{toast.msg}</div>
    </div>
  );
}

// ═══ SCREENS ════════════════════════════════════════════════════════════════
function PlanScreen({ t, state, d, dispatch }) {
  const cleared = d.champCleared;
  const tgt = d.target;
  const pctS = (d.settledApi / tgt.api) * 100, pctSub = (d.submittedApi / tgt.api) * 100, pctW = (d.writtenApi / tgt.api) * 100;
  return (
    <>
      <Head t={t} eyebrow={`CHRISTMAS · ${WEEKS_LEFT} WEEKS LEFT`} title={cleared ? `Aiming ${tgt.name}` : `${tgt.name} tier`}
        right={<div style={{ width: 34, height: 34, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, fontFamily: APP_FONT_DISPLAY }}>MS</div>} />
      <Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cleared && (
            <div className="a-scale-in" style={{ padding: '13px 15px', background: t.gold, color: '#fff', borderRadius: 13, display: 'flex', alignItems: 'center', gap: 11 }}>
              <IconTrophy size={22} color="#fff" stroke={2} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700 }}>Champion cleared! 🎉</div><div style={{ fontSize: 11, opacity: 0.9, marginTop: 1 }}>{ttdL(TIER.cash)} + voucher banked. Now aiming {NEXT_TIER.name}.</div></div>
            </div>
          )}
          {/* gap meter */}
          <div style={{ padding: '14px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>SETTLED API → {tgt.name.toUpperCase()}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>{ttdL(d.settledApi)} <span style={{ color: t.inkFaint }}>/ {ttdL(tgt.api)}</span></span>
            </div>
            <div style={{ height: 11, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${Math.min(100, pctS)}%`, background: t.teal }} />
              <div style={{ width: `${Math.min(100 - pctS, pctSub)}%`, background: `repeating-linear-gradient(45deg, ${t.teal}66, ${t.teal}66 4px, ${t.teal}33 4px, ${t.teal}33 8px)` }} />
              <div style={{ width: `${Math.min(100 - pctS - pctSub, pctW)}%`, background: `${t.teal}22` }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              {[['Settled', t.teal], ['Submitted', `repeating-linear-gradient(45deg, ${t.teal}66, ${t.teal}66 3px, ${t.teal}22 3px, ${t.teal}22 6px)`], ['Written', `${t.teal}22`]].map(([l, c]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 9, height: 9, borderRadius: 2, background: c }} /><span style={{ fontSize: 10.5, color: t.inkMute }}>{l}</span></div>
              ))}
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: d.gapApps ? t.warning : t.success, fontFamily: APP_FONT_MONO }}>{d.gapApps ? `${ttdL(d.gapApi)} · ${d.gapApps} app${d.gapApps > 1 ? 's' : ''} to go` : 'tier reached'}</span>
            </div>
          </div>

          {/* this week prescription */}
          <div style={{ padding: '14px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginBottom: 4 }}>To stay on track, this week</div>
            <div style={{ fontSize: 11, color: t.inkMute, marginBottom: 13, lineHeight: 1.45 }}>{d.gapApps || 1} app over {WEEKS_LEFT} weeks → at your close ratio that's <b style={{ color: t.ink }}>{d.needCI} C.I</b> this week.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 42 }}><Chip t={t} code="CI" size="s" /></div>
              <div style={{ flex: 1, height: 8, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (state.bookedCI / Math.max(1, d.needCI)) * 100)}%`, height: 8, background: state.bookedCI >= d.needCI ? t.success : t.warning, borderRadius: 999 }} />
              </div>
              <div style={{ fontFamily: APP_FONT_MONO, fontSize: 12, fontWeight: 700, color: state.bookedCI >= d.needCI ? t.success : t.warning, minWidth: 68, textAlign: 'right' }}>{state.bookedCI}<span style={{ color: t.inkFaint }}> / {d.needCI}/wk</span></div>
            </div>
            {state.bookedCI < d.needCI ? (
              <div style={{ marginTop: 13 }}><Btn t={t} pulse onClick={() => dispatch({ type: 'GOTO', screen: 'hitlist' })} icon={<IconArrowR size={15} color="#fff" stroke={2.4} />}>Fill the C.I gap from your list</Btn></div>
            ) : (
              <div style={{ marginTop: 13, padding: '10px 12px', background: t.successTint, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
                <IconCheck size={15} color={t.success} stroke={2.4} /><span style={{ fontSize: 12, fontWeight: 700, color: t.ink }}>This week's C.I booked — work the day in the planner.</span>
              </div>
            )}
          </div>

          {/* persistency gate */}
          <div style={{ padding: '12px 14px', background: t.warningTint, border: `1px solid ${t.warning}33`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconShield size={16} color={t.warning} stroke={2} />
            <div style={{ flex: 1, fontSize: 11.5, color: t.ink, fontWeight: 600 }}>Persistency {PERS}% → 50% payout. Reinstate {ttdL(17_500)} to bank the full prize.</div>
          </div>

          <div style={{ fontSize: 10.5, color: t.inkFaint, textAlign: 'center', lineHeight: 1.5 }}>Settled production flows back here — clear a sale and this prescription re-solves.</div>
        </div>
      </Body>
    </>
  );
}

function HitListScreen({ t, state, dispatch }) {
  return (
    <>
      <Head t={t} onBack={() => dispatch({ type: 'GOTO', screen: 'plan' })} eyebrow="CHRISTMAS · CLOSE-READY" title="Hit list" />
      <Body>
        <Coach t={t}>Pick a close-ready prospect → Book C.I</Coach>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
          {PROSPECTS.map((p) => (
            <div key={p.id} style={{ padding: '12px 14px', background: t.surface, border: `1px solid ${p.hot ? `${t.teal}55` : t.rule}`, borderRadius: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Chip t={t} code="CI" size="s" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{p.name}</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.why}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY }}>{ttdL(p.api)}</div>
              </div>
              <div style={{ marginTop: 10 }}><Btn t={t} kind={p.hot ? 'primary' : 'secondary'} onClick={() => dispatch({ type: 'BOOK_CI', prospect: p })} icon={<IconPlus size={14} color={p.hot ? '#fff' : t.ink} stroke={2.4} />}>Book C.I</Btn></div>
            </div>
          ))}
        </div>
      </Body>
    </>
  );
}

function PlannerScreen({ t, state, dispatch }) {
  const pending = state.appts.find((a) => !a.done);
  return (
    <>
      <Head t={t} onBack={() => dispatch({ type: 'GOTO', screen: 'plan' })} eyebrow="TUE · 23 JUN" title="Today" />
      <Body>
        <Coach t={t}>Tap your booked C.I → Sale written</Coach>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* a couple of fixed appts for context */}
          {[{ time: '8:30', code: 'FFI', who: 'Kavita Ramlogan', done: true }, { time: '11:30', code: 'AI', who: 'Nisha Persad' }].map((a, i) => (
            <div key={i} style={{ padding: '11px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 11, opacity: 0.75 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, width: 38 }}>{a.time}</span>
              <Chip t={t} code={a.code} size="s" />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.ink }}>{a.who}</div>
              {a.done && <span style={{ fontSize: 9.5, fontWeight: 700, color: t.success, fontFamily: APP_FONT_MONO }}>KEPT</span>}
            </div>
          ))}
          {/* the freshly booked C.I — actionable */}
          {state.appts.map((ap) => (
            <div key={ap.id} className="a-rise" style={{ padding: '13px 14px', background: t.surface, border: `1.5px solid ${ap.done ? t.rule : t.teal}`, borderRadius: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, width: 38 }}>10:00</span>
                <Chip t={t} code="CI" size="s" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{ap.name}</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>Closing interview · your office</div>
                </div>
                {ap.done && <span style={{ fontSize: 9.5, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_MONO }}>SALE</span>}
              </div>
              {!ap.done && (
                <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
                  <div style={{ flex: 1 }}><Btn t={t} pulse onClick={() => dispatch({ type: 'OPEN_SALE', prospectId: ap.prospectId })} icon={<IconCheck size={14} color="#fff" stroke={2.4} />}>Sale written</Btn></div>
                  <div style={{ width: 100 }}><Btn t={t} kind="secondary" onClick={() => {}}>Reschedule</Btn></div>
                </div>
              )}
            </div>
          ))}
          {!state.appts.length && <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: t.inkMute }}>No C.I booked yet — go back and book one from the hit-list.</div>}
        </div>
      </Body>
    </>
  );
}

function LogSaleScreen({ t, state, dispatch }) {
  const c = state.saleClient;
  const total = state.draftApps.reduce((s, d) => s + (d.type === 'Replacement' ? 0 : calcApi(d.premium, d.freq)), 0);
  const Field = ({ label, children }) => (<div><div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, marginBottom: 5 }}>{label}</div>{children}</div>);
  const sel = (val, opts, on) => (
    <select value={val} onChange={(e) => on(e.target.value)} style={{ width: '100%', padding: '9px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_SANS, appearance: 'none' }}>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  return (
    <>
      <Head t={t} onBack={() => dispatch({ type: 'GOTO', screen: 'planner' })} eyebrow="LOG THE SALE" title={c ? c.name : 'Sale'} />
      <Body>
        <Coach t={t}>One client can write several apps · policy # optional</Coach>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {state.draftApps.map((dft, i) => {
            const api = calcApi(dft.premium, dft.freq);
            const credited = dft.type === 'Replacement' ? 0 : api;
            return (
              <div key={dft.uid} style={{ padding: '13px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 11 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }}>Application {i + 1}</span>
                  <div style={{ flex: 1 }} />
                  {state.draftApps.length > 1 && <span onClick={() => dispatch({ type: 'REMOVE_APP', uid: dft.uid })} style={{ cursor: 'pointer', fontSize: 11, fontWeight: 700, color: t.danger }}>Remove</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                  <Field label="PRODUCT">{sel(dft.product, ['Whole Life', 'Term', 'Critical Illness', 'Annuity', 'Education'], (v) => dispatch({ type: 'EDIT_APP', uid: dft.uid, key: 'product', value: v }))}</Field>
                  <Field label="TYPE">{sel(dft.type, ['Ordinary', 'Replacement', 'SPIA', 'Increase'], (v) => dispatch({ type: 'EDIT_APP', uid: dft.uid, key: 'type', value: v }))}</Field>
                  <Field label="PREMIUM (TTD)"><input type="number" value={dft.premium} onChange={(e) => dispatch({ type: 'EDIT_APP', uid: dft.uid, key: 'premium', value: +e.target.value || 0 })} style={{ width: '100%', padding: '9px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO }} /></Field>
                  <Field label="FREQUENCY">{sel(dft.freq, ['Monthly', 'Quarterly', 'Semi-Annually', 'Annually'], (v) => dispatch({ type: 'EDIT_APP', uid: dft.uid, key: 'freq', value: v }))}</Field>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, padding: '9px 11px', background: t.tealTint, borderRadius: 9 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO }}>API = {dft.premium.toLocaleString()} × {FREQ_MULT[dft.freq]}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: dft.type === 'Replacement' ? t.warning : t.teal, fontFamily: APP_FONT_DISPLAY }}>{dft.type === 'Replacement' ? 'diff only' : ttdL(api)}</span>
                </div>
                <Field label="POLICY # (optional — add later)"><input value={dft.policyNo} placeholder="leave blank → Pending #" onChange={(e) => dispatch({ type: 'EDIT_APP', uid: dft.uid, key: 'policyNo', value: e.target.value })} style={{ width: '100%', marginTop: 9, padding: '9px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: t.ink, fontFamily: APP_FONT_MONO }} /></Field>
              </div>
            );
          })}
          <div onClick={() => dispatch({ type: 'ADD_APP' })} style={{ cursor: 'pointer', padding: '11px', borderRadius: 11, border: `1.5px dashed ${t.ruleStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: t.teal, fontWeight: 700, fontSize: 12.5 }}>
            <IconPlus size={14} color={t.teal} stroke={2.4} /> Add another application
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
            <span style={{ fontSize: 12, color: t.inkMute }}>{state.draftApps.length} app{state.draftApps.length > 1 ? 's' : ''} · total API</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY }}>{ttdL(total)}</span>
          </div>
          <Btn t={t} onClick={() => dispatch({ type: 'SAVE_SALE' })} icon={<IconCheck size={15} color="#fff" stroke={2.4} />}>Save as Written</Btn>
        </div>
      </Body>
    </>
  );
}

const STATUS_META = (t) => ({
  written:   { label: 'Written',   fg: t.warning, bg: t.warningTint },
  submitted: { label: 'Submitted', fg: t.inkAccent, bg: t.inkAccentTint },
  settled:   { label: 'Settled',   fg: t.success, bg: t.successTint },
});
function LedgerScreen({ t, state, d, dispatch }) {
  const meta = STATUS_META(t);
  const counts = ['written', 'submitted', 'settled'].map((st) => {
    const recs = state.records.filter((r) => r.status === st);
    return { st, n: recs.length, api: recs.reduce((s, r) => s + r.api, 0) };
  });
  const nextAction = (r) => {
    if (r.status === 'written') return { label: 'Submit', to: 'submitted' };
    if (r.status === 'submitted') return { label: r.policyNo ? 'Settle' : 'Add # & settle', to: 'settled' };
    return null;
  };
  return (
    <>
      <Head t={t} onBack={() => dispatch({ type: 'GOTO', screen: 'plan' })} eyebrow="POLICY LEDGER" title="Pipeline" />
      <Body>
        {/* pipeline header = the filter/segments */}
        <div style={{ display: 'flex', gap: 8 }}>
          {counts.map((c) => (
            <div key={c.st} style={{ flex: 1, padding: '10px 11px', background: meta[c.st].bg, borderRadius: 11, border: `1px solid ${meta[c.st].fg}2e` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: meta[c.st].fg, letterSpacing: '0.08em', fontFamily: APP_FONT_MONO }}>{meta[c.st].label.toUpperCase()}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 4, lineHeight: 1 }}>{c.n}</div>
              <div style={{ fontSize: 9, color: t.inkMute, marginTop: 3, fontFamily: APP_FONT_MONO }}>{ttdL(c.api)}</div>
            </div>
          ))}
        </div>
        {state.records.some((r) => r.status !== 'settled') && <div style={{ marginTop: 12 }}><Coach t={t}>Advance each app: Written → Submitted → Settled</Coach></div>}
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {state.records.length === 0 && <div style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: t.inkMute }}>No applications yet. Log a sale from the planner.</div>}
          {[...state.records].reverse().map((r) => {
            const m = meta[r.status]; const act = nextAction(r);
            return (
              <div key={r.id} style={{ padding: '12px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{r.client}</div>
                    <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{r.product} · {r.type}{r.policyNo ? ` · #${r.policyNo}` : ' · Pending #'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY }}>{r.type === 'Replacement' ? 'diff' : ttdL(r.api)}</div>
                  </div>
                  <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 9, fontWeight: 700, color: m.fg, background: m.bg, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>{m.label.toUpperCase()}</span>
                </div>
                {act && (
                  <div style={{ marginTop: 10 }}>
                    <Btn t={t} pulse kind={r.status === 'submitted' ? 'primary' : 'secondary'}
                      onClick={() => dispatch({ type: 'SET_STATUS', id: r.id, status: act.to, policyNo: act.to === 'settled' && !r.policyNo ? 'TL-' + Math.floor(1000 + Math.random() * 8999) : r.policyNo })}
                      icon={<IconArrowR size={13} color={r.status === 'submitted' ? '#fff' : t.ink} stroke={2.4} />}>{act.label}</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {state.records.some((r) => r.status === 'settled') && (
          <div style={{ marginTop: 14 }}>
            <Btn t={t} kind="ghost" onClick={() => dispatch({ type: 'GOTO', screen: 'plan' })} icon={<IconArrowR size={14} color={t.teal} stroke={2.2} />}>Back to Game Plan — see it update</Btn>
          </div>
        )}
      </Body>
    </>
  );
}

// ═══ APP ═════════════════════════════════════════════════════════════════════
function App() {
  const [state, dispatch] = useReducer(reducer, null, load);
  const t = state.theme === 'dark' ? APP_DARK : APP_LIGHT;
  const d = derive(state);

  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { if (state.toast) { const id = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2600); return () => clearTimeout(id); } }, [state.toast]);

  const Screen = { plan: PlanScreen, hitlist: HitListScreen, planner: PlannerScreen, logsale: LogSaleScreen, ledger: LedgerScreen }[state.screen];

  return (
    <div style={{ minHeight: '100vh', background: state.theme === 'dark' ? '#1a1714' : '#f0eee9', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px 40px', gap: 16, transition: 'background 0.3s' }}>
      {/* controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 560 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>AgencyTrack · the loop</div>
        <div style={{ flex: 1 }} />
        <div onClick={() => dispatch({ type: 'THEME' })} style={{ cursor: 'pointer', padding: '7px 12px', borderRadius: 9, background: t.surface, border: `1px solid ${t.rule}`, fontSize: 11.5, fontWeight: 700, color: t.inkMute }}>{state.theme === 'dark' ? '☀ Light' : '☾ Dark'}</div>
        <div onClick={() => dispatch({ type: 'RESET' })} style={{ cursor: 'pointer', padding: '7px 12px', borderRadius: 9, background: t.surface, border: `1px solid ${t.rule}`, fontSize: 11.5, fontWeight: 700, color: t.inkMute }}>↺ Reset</div>
      </div>

      {/* loop rail */}
      <LoopRail t={t} idx={stageIndex(state, d)} />

      {/* phone */}
      <div style={{ position: 'relative' }}>
        <MFrame t={t}>
          <Toast t={t} toast={state.toast} />
          <Screen t={t} state={state} d={d} dispatch={dispatch} />
        </MFrame>
      </div>

      <div style={{ fontSize: 11, color: t.inkMute, maxWidth: 460, textAlign: 'center', lineHeight: 1.5 }}>
        Follow the pulsing button to walk the loop. Book a C.I → mark it a sale → push it Written → Submitted → Settled → watch the tier clear and the Game Plan re-solve. Your progress persists; <b style={{ color: t.ink }}>Reset</b> to start over.
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

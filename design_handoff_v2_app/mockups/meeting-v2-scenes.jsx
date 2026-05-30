// AgencyTrack — Meeting Mode v2. Composed desktop slides.
//
// MeetingScene(slide) picks the body + footer and wraps it in MeetingStage.
// slide ids:  'agenda' · 'agent:<id>' · 'solo:<id>' · 'recognition' · 'close'
// Run of show (total 9):  agenda · 6 agents · recognition · wrap-up.

const RUN_TOTAL = RUN.length + 3; // agenda + agents + recognition + close

function runIndex(id) { return RUN.findIndex((r) => r.id === id) + 1; }
function doneBefore(idx) { return RUN.slice(0, Math.max(0, idx - 1)).map((r) => r.id); }

// ──────────────────────────────────────────────────────────────────────────
// AGENDA — the open. Team reality first: greeting + week pulse + cascade, and
// the three counts that frame the meeting. Full-bleed (no rail).
// ──────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// Open-slide backdrop — kiosk welcome treatment. Empty → renders nothing, so
// the dynamic AmbientBg shows. With photos → a FULL-BLEED slideshow: up to 10
// photos crossfading with alternating Ken Burns, heavily muted, under a
// readability scrim. Sources come from `srcs` (demo) or from up to 10
// persistent image-slots the manager drops photos into (filmstrip tray).
// ─────────────────────────────────────────────────────────────────
const OPEN_SLOT_COUNT = 10;
const OPEN_SLOT_PREFIX = 'mtg-open-photo-';
const OPEN_KENBURNS = ['kiosk-ken-burns', 'kiosk-ken-burns-alt'];

function OpenSlideshow({ t, srcs = null, interval = 6500 }) {
  const [liveSrcs, setLiveSrcs] = React.useState([]);
  const [idx, setIdx] = React.useState(0);
  const dark = t.mode !== 'light';

  // Editable: read the up-to-10 dropped photos straight from the image-slot
  // sidecar so it works whether or not the Tweaks panel (where the drop slots
  // live) is mounted, and survives reloads. Poll so new drops get picked up.
  React.useEffect(() => {
    if (srcs) return;
    let alive = true, last = '';
    const pull = () => {
      // Mounted slots (Tweaks panel open) read instantly; the sidecar covers
      // the closed-panel / post-reload case. Union them, slot 1..10 in order.
      const mounted = {};
      document.querySelectorAll(`image-slot[id^="${OPEN_SLOT_PREFIX}"]`).forEach((s) => {
        if (!s.hasAttribute('data-filled')) return;
        const img = s.shadowRoot && s.shadowRoot.querySelector('img');
        const u = img && img.getAttribute('src');
        if (u && /^data:image\//i.test(u)) mounted[s.id] = u;
      });
      const finish = (sidecar) => {
        if (!alive) return;
        const urls = [];
        for (let i = 1; i <= OPEN_SLOT_COUNT; i++) {
          const id = `${OPEN_SLOT_PREFIX}${i}`;
          let u = mounted[id];
          if (!u && sidecar) { const v = sidecar[id]; u = typeof v === 'string' ? v : (v && v.u); }
          if (u && /^data:image\//i.test(u)) urls.push(u);
        }
        const key = urls.join('|');
        if (key !== last) { last = key; setLiveSrcs(urls); }
      };
      fetch('.image-slots.state.json', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => finish(j))
        .catch(() => finish(null));
    };
    pull();
    const tmr = setInterval(pull, 2000);
    return () => { alive = false; clearInterval(tmr); };
  }, [srcs]);

  const photos = srcs || liveSrcs;

  React.useEffect(() => {
    if (photos.length < 2) return;
    const tmr = setInterval(() => setIdx((i) => (i + 1) % photos.length), interval);
    return () => clearInterval(tmr);
  }, [photos.length, interval]);

  const filter = dark
    ? 'grayscale(55%) brightness(0.5) contrast(0.95) blur(1px)'
    : 'grayscale(35%) brightness(1.0) contrast(0.95) blur(1px)';
  const scrim = dark
    ? 'linear-gradient(102deg, rgba(0,0,0,0.74) 0%, rgba(0,0,0,0.52) 42%, rgba(0,0,0,0.34) 100%)'
    : `linear-gradient(102deg, ${t.bg}f0 0%, ${t.bg}b3 42%, ${t.bg}73 100%)`;
  const bottomScrim = `linear-gradient(0deg, ${t.bg} 0%, ${t.bg}00 30%)`;
  const topScrim = `linear-gradient(180deg, ${t.bg} 0%, ${t.bg}00 15%)`;

  if (!photos.length) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {photos.map((src, i) => (
        <div key={src + i} style={{
          position: 'absolute', inset: 0, backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center',
          filter, opacity: i === idx ? 1 : 0, transition: 'opacity 1600ms ease-in-out',
          animation: i === idx ? `${OPEN_KENBURNS[i % 2]} 16s ease-out forwards` : 'none', transformOrigin: 'center center',
        }}></div>
      ))}
      <div style={{ position: 'absolute', inset: 0, background: scrim }}></div>
      <div style={{ position: 'absolute', inset: 0, background: topScrim }}></div>
      <div style={{ position: 'absolute', inset: 0, background: bottomScrim }}></div>
    </div>
  );
}

// The up-to-10 photo drop slots — live in the Tweaks panel so the slide stays
// clean. OpenSlideshow reads them by id prefix.
function OpenPhotoSlots({ t }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
      {Array.from({ length: OPEN_SLOT_COUNT }).map((_, i) => (
        <div key={i} style={{ aspectRatio: '3 / 2', borderRadius: 7, overflow: 'hidden', border: `1px dashed ${t ? t.ruleStrong : '#ccc'}` }}>
          <image-slot id={`${OPEN_SLOT_PREFIX}${i + 1}`} shape="rounded" radius="6" fit="cover" placeholder="+" style={{ width: '100%', height: '100%', display: 'block' }}></image-slot>
        </div>
      ))}
    </div>
  );
}

function AgendaBody({ t }) {
  const pct = Math.round((MEETING.ytdApi / MEETING.branchGoal) * 100);
  const floorPct = (MEETING.companyFloor / MEETING.branchGoal) * 100;
  const smPct = (MEETING.smTarget / MEETING.branchGoal) * 100;
  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
      <div style={{ position: 'relative', zIndex: 2, height: '100%', boxSizing: 'border-box', display: 'flex', gap: 30, padding: '20px 40px 28px' }}>
      {/* Left — reality */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.teal, letterSpacing: '0.18em', fontFamily: APP_FONT_MONO }}>{MEETING.day.toUpperCase()} STAND-UP · {MEETING.week.toUpperCase()} · 30 NOV</div>
        <div className="a-rise" style={{ fontSize: 50, fontWeight: 700, color: t.ink, letterSpacing: '-0.03em', lineHeight: 1.0, marginTop: 12, fontFamily: APP_FONT_DISPLAY }}>Good morning, team.</div>
        <div className="a-rise a-d-1" style={{ fontSize: 18, color: t.inkMute, marginTop: 12, lineHeight: 1.4, maxWidth: 520 }}>
          Five to review, <span style={{ color: t.warning, fontWeight: 700 }}>two critical</span>, and <span style={{ color: t.gold, fontWeight: 700 }}>three to celebrate</span>. Let's start where the branch actually stands.
        </div>

        {/* Week pulse */}
        <div className="a-rise a-d-2" style={{ display: 'flex', gap: 40, marginTop: 30 }}>
          {[
            { k: 'WEEK API', v: ttd(MEETING.weekApi) },
            { k: 'APPLICATIONS', v: MEETING.weekApps },
            { k: 'FFIs', v: MEETING.weekFfi },
          ].map((m) => (
            <div key={m.k}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{m.k}</div>
              <div style={{ fontSize: 38, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.025em', marginTop: 5, lineHeight: 1 }}>{m.v}</div>
            </div>
          ))}
        </div>

        {/* Cascade */}
        <div className="a-rise a-d-3" style={{ marginTop: 'auto', maxWidth: 600 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 9 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>SETTLED API · YEAR SO FAR</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em' }}>{ttd(MEETING.ytdApi)}</div>
            <div style={{ fontSize: 12.5, color: t.inkMute }}>{pct}% of {ttd(MEETING.branchGoal)} · {MEETING.weeksLeft} weeks left</div>
          </div>
          <div style={{ position: 'relative', height: 9, background: t.surfaceMute, borderRadius: 999 }}>
            <div className="a-progress-grow" style={{ width: `${pct}%`, height: 9, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
            <div style={{ position: 'absolute', top: -3, left: `${floorPct}%`, width: 2, height: 15, background: t.warning, borderRadius: 999 }}></div>
            <div style={{ position: 'absolute', top: -3, left: `${smPct}%`, width: 2, height: 15, background: t.inkFaint, borderRadius: 999 }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
            <span>TTD 0</span>
            <span style={{ color: t.warning }}>FLOOR · {ttd(MEETING.companyFloor)}</span>
            <span>SM · {ttd(MEETING.smTarget)}</span>
            <span>GOAL · {ttd(MEETING.branchGoal)}</span>
          </div>
        </div>
      </div>

      {/* Right — counts + run preview */}
      <div style={{ width: 392, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <AgendaCount t={t} v={MEETING.onPace} sub={`of ${MEETING.agents} on pace`} fg={t.success} bg={t.successTint} Icon={IconCheck} />
          <AgendaCount t={t} v={MEETING.needAttention} sub="need attention" fg={t.warning} bg={t.warningTint} Icon={IconAlert} breathe />
        </div>
        <div className="a-rise a-d-2" style={{ flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>WHO WE'LL COVER</div>
            <div style={{ fontSize: 11, color: t.inkMute }}>exception-first</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {RUN.map((r) => {
              const fg = r.tone === 'danger' ? t.danger : r.tone === 'success' ? t.success : t.warning;
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 6px' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${fg}1f`, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: t.ink }}>{r.name}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: fg, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{r.flagLabel}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function AgendaCount({ t, v, sub, fg, bg, Icon, breathe }) {
  return (
    <div className="a-rise a-d-1" style={{ flex: 1, padding: '14px 16px', background: bg, border: `1px solid ${fg}33`, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className={breathe ? 'a-breathe' : ''} style={{ width: 34, height: 34, borderRadius: '50%', background: t.surface, border: `1px solid ${fg}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color={fg} stroke={2} />
      </div>
      <div>
        <div style={{ fontSize: 30, fontWeight: 700, color: fg, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{v}</div>
        <div style={{ fontSize: 11, color: t.inkMute, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AGENT STEP (group depth) — the week: activity KPIs + resulting New API/Apps.
// ──────────────────────────────────────────────────────────────────────────
function AgentMain({ t, r, density = 'condensed' }) {
  const fg = r.tone === 'danger' ? t.danger : r.tone === 'success' ? t.success : t.warning;
  const exc = !!r.flag;
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '20px 30px 22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: `${fg}1f`, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 19, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: t.ink, letterSpacing: '-0.025em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{r.name}</div>
          <div style={{ fontSize: 13, color: t.inkMute, marginTop: 4 }}>{r.unit} · {r.level} · Week ending 30 Nov</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 999, background: r.submitted ? t.successTint : t.warningTint, border: `1px solid ${(r.submitted ? t.success : t.warning)}33`, fontSize: 11, fontWeight: 700, color: r.submitted ? t.success : t.warning, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
            {r.submitted ? '✓ Submitted' : '— Not submitted'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 999, background: `${fg}1f`, border: `1px solid ${fg}33`, fontSize: 11, fontWeight: 700, color: fg, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {r.flagLabel}
          </span>
        </div>
      </div>

      {/* Exception banner / win callout */}
      {exc ? (
        <div style={{ display: 'flex', gap: 11, alignItems: 'center', marginTop: 14, padding: '11px 15px', background: r.tone === 'danger' ? t.dangerTint : t.warningTint, border: `1px solid ${fg}33`, borderRadius: 12, flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: t.surface, border: `1px solid ${fg}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconAlert size={13} color={fg} />
          </div>
          <div style={{ fontSize: 13, color: t.ink, lineHeight: 1.4 }}>{r.reason}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 11, alignItems: 'center', marginTop: 14, padding: '11px 15px', background: t.goldTint, border: `1px solid ${t.gold}44`, borderRadius: 12, flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: t.surface, border: `1px solid ${t.gold}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconMedal size={14} color={t.gold} />
          </div>
          <div style={{ fontSize: 13, color: t.ink, lineHeight: 1.4 }}><span style={{ fontWeight: 700, color: t.gold }}>★ {r.win}.</span> {r.reason}</div>
        </div>
      )}

      {/* Hero — week result + trajectory */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 16, padding: '14px 18px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>NEW API · THIS WEEK</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.026em', lineHeight: 1, marginTop: 5 }}>{ttd(r.weekApi)}</div>
        </div>
        <div style={{ width: 1, height: 44, background: t.rule }}></div>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>APPS</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.026em', lineHeight: 1, marginTop: 5 }}>{r.apps}</div>
        </div>
        <div style={{ flex: 1 }}></div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, marginBottom: 4 }}>6-WEEK API TREND</div>
          <BigSpark color={fg} values={r.spark} />
        </div>
      </div>

      {/* Activity KPI grid — granular wizard KPIs rolled to the company floor */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '16px 0 10px', flexShrink: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>THIS WEEK'S ACTIVITY · VS COMPANY FLOOR</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.inkMute, fontWeight: 600 }}>
          <IconSettings size={13} color={t.inkMute} /> {KPI_DENSITY_LABEL[density]} · customize
        </div>
      </div>
      {(() => {
        const tiles = resolveTiles(r.act, density);
        const perRow = tiles.length <= 8 ? 4 : 5;
        const rows = Math.ceil(tiles.length / perRow);
        return (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${perRow}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 10 }}>
            {tiles.map((k) => <ActivityTile key={k.key} t={t} kpi={k} actual={k.actual} />)}
          </div>
        );
      })()}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 1-on-1 STEP — single agent, fuller coaching. No rail (focused). Activity
// condensed + coaching ratios + self-evaluation + headline + quick actions.
// ──────────────────────────────────────────────────────────────────────────
function OneOnOneBody({ t, r }) {
  const fg = r.tone === 'danger' ? t.danger : r.tone === 'success' ? t.success : t.warning;
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 22, padding: '20px 40px 24px' }}>
      {/* Left — identity + headline + activity recap */}
      <div style={{ flex: 1.15, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.gold, letterSpacing: '0.16em', fontFamily: APP_FONT_MONO }}>1-ON-1 · PRIVATE COACHING</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: `${fg}1f`, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{r.initials}</div>
          <div>
            <div style={{ fontSize: 32, fontWeight: 700, color: t.ink, letterSpacing: '-0.025em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1 }}>{r.name}</div>
            <div style={{ fontSize: 12.5, color: t.inkMute, marginTop: 4 }}>{r.unit} · {r.level} · {r.flagLabel}</div>
          </div>
        </div>

        {/* Coaching headline */}
        <div style={{ marginTop: 16, padding: '14px 16px', background: t.tealTint, border: `1px solid ${t.teal}33`, borderRadius: 13 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, marginBottom: 6 }}>THE COACHING POINT</div>
          <div style={{ fontSize: 16, color: t.ink, lineHeight: 1.45, fontWeight: 600 }}>{r.headline}</div>
        </div>

        {/* Self-evaluation */}
        <div style={{ marginTop: 16, flex: 1, minHeight: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, marginBottom: 10 }}>AGENT SELF-EVALUATION</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {r.evals.map((e) => {
              const v = e.value;
              const barC = v >= 7 ? t.success : v >= 4 ? t.warning : v > 0 ? t.danger : t.inkDim;
              return (
                <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 92, fontSize: 12.5, color: t.inkMute, flexShrink: 0 }}>{e.label}</div>
                  <div style={{ flex: 1, height: 7, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                    <div className="a-progress-grow" style={{ width: `${(v / 10) * 100}%`, height: 7, background: barC, borderRadius: 999 }}></div>
                  </div>
                  <div style={{ width: 40, textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: v > 0 ? t.ink : t.inkFaint, fontFamily: APP_FONT_MONO }}>{v > 0 ? `${v}/10` : '—'}</div>
                </div>
              );
            })}
          </div>
          {r.evalNote && (
            <div style={{ marginTop: 14, fontSize: 13.5, color: t.inkMute, fontStyle: 'italic', lineHeight: 1.5, paddingLeft: 14, borderLeft: `2px solid ${t.rule}` }}>"{r.evalNote}"</div>
          )}
        </div>
      </div>

      {/* Right — week result + coaching ratios + manager note */}
      <div style={{ width: 396, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, padding: '13px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>NEW API · WK</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 5 }}>{ttd(r.weekApi)}</div>
          </div>
          <div style={{ flex: 1, padding: '13px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>APPS</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 5 }}>{r.apps}</div>
          </div>
        </div>

        {/* Coaching ratios */}
        <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, marginBottom: 11 }}>COACHING RATIOS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {r.ratios.map((rt) => {
              const c = rt.tone === 'success' ? t.success : rt.tone === 'warning' ? t.warning : rt.tone === 'mute' ? t.inkFaint : t.teal;
              return (
                <div key={rt.label} style={{ padding: '10px 12px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 9.5, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>{rt.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 3 }}>{rt.value}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Manager note (gold ownership) */}
        <div style={{ marginTop: 'auto', padding: '13px 15px', background: t.goldTint, border: `1px solid ${t.gold}44`, borderRadius: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <IconShield size={13} color={t.gold} />
            <div style={{ fontSize: 9, fontWeight: 700, color: t.gold, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>YOUR COACHING NOTE · A SUGGESTION, NOT HIS COMMITMENT</div>
          </div>
          <div style={{ fontSize: 13, color: t.ink, lineHeight: 1.45 }}>{r.note}</div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// RECOGNITION — gold. Podium top 3 + team badge tally.
// ──────────────────────────────────────────────────────────────────────────
function RecognitionBody({ t }) {
  const order = [2, 1, 3]; // visual podium: 2nd · 1st · 3rd
  const heights = { 1: 150, 2: 112, 3: 92 };
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 40px 22px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: t.gold, letterSpacing: '0.2em', fontFamily: APP_FONT_MONO, flexShrink: 0 }}>★ THIS WEEK'S RECOGNITION</div>
      <div className="a-rise" style={{ fontSize: 36, fontWeight: 700, color: t.ink, letterSpacing: '-0.025em', fontFamily: APP_FONT_DISPLAY, marginTop: 6, flexShrink: 0 }}>Recognize the room.</div>

      {/* Recognition — producers (API) beside activity leaders (effort) */}
      <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', gap: 30, marginTop: 12 }}>
        {/* Top producers · API */}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: t.gold, letterSpacing: '0.16em', fontFamily: APP_FONT_MONO, marginBottom: 6 }}>★ TOP PRODUCERS · API</div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 18 }}>
        {order.map((rank) => {
          const c = CHAMPS.find((x) => x.rank === rank);
          const isFirst = rank === 1;
          return (
            <div key={rank} className="a-rise" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 210 }}>
              <div style={{ width: isFirst ? 70 : 56, height: isFirst ? 70 : 56, borderRadius: '50%', background: t.goldTint, color: t.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: isFirst ? 24 : 18, fontFamily: APP_FONT_DISPLAY, border: `2px solid ${t.gold}55`, marginBottom: 10, boxShadow: isFirst ? `0 0 0 6px ${t.goldTint}` : 'none' }}>{c.initials}</div>
              <div style={{ fontSize: isFirst ? 19 : 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em' }}>{c.name}</div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 2 }}>{c.unit} · {c.note}</div>
              <div style={{
                width: '100%', height: heights[rank], marginTop: 12, borderRadius: '12px 12px 0 0',
                background: isFirst ? `linear-gradient(180deg, ${t.gold}, ${t.goldTint})` : t.surface,
                border: `1px solid ${isFirst ? t.gold : t.rule}`, borderBottom: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 14,
              }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: isFirst ? '#fff' : t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.03em' }}>{rank}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: isFirst ? '#fff' : t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 5 }}>{ttd(c.api)}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: isFirst ? 'rgba(255,255,255,0.8)' : t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, marginTop: 2 }}>WEEK API</div>
              </div>
            </div>
          );
        })}
          </div>
        </div>

        {/* Most active · effort — recognized in parallel with the producers */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: t.teal, letterSpacing: '0.16em', fontFamily: APP_FONT_MONO, marginBottom: 6 }}>▲ MOST ACTIVE · THE WEEK</div>
          <div style={{ flex: 1, minHeight: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '6px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {[...MEETING_SHEET].sort((a, b) => activityScore(b) - activityScore(a)).slice(0, 5).map((a, i) => (
              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 8px', borderBottom: i < 4 ? `1px solid ${t.rule}` : 'none' }}>
                <div style={{ width: 20, textAlign: 'center', fontSize: 14, fontWeight: 800, color: i === 0 ? t.teal : t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{i + 1}</div>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{a.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{a.unit} · {a.act.calls} calls · {a.act.factfinds} FF · {a.act.closing} CI</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 19, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{activityScore(a)}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, marginTop: 2 }}>TOUCHES</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* On the rise — most improved */}
      <div className="a-rise a-d-2" style={{ flexShrink: 0, width: '100%', marginTop: 14, padding: '12px 18px', background: t.tealTint, border: `1px solid ${t.teal}33`, borderRadius: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: t.teal }}>▲</span>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: t.teal, letterSpacing: '0.16em', fontFamily: APP_FONT_MONO }}>ON THE RISE · MOST IMPROVED — KEEP GOING</div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {MOVERS.map((m) => (
            <div key={m.name} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 11, padding: '8px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{m.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                <div style={{ fontSize: 10.5, color: t.inkMute }}>{m.note}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <BigSpark color={t.success} values={m.spark} width={56} height={26} />
                <span style={{ fontSize: 11, fontWeight: 700, color: t.success, fontFamily: APP_FONT_MONO }}>{m.delta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// CLOSE — wrap-up. What was reviewed + actions captured in the room.
// ──────────────────────────────────────────────────────────────────────────
function CloseBody({ t }) {
  const actions = [
    { Icon: IconBook, fg: t.teal, text: 'Coaching note left for Devin Lewis', sub: 'Daily reporting cadence until he clears floor' },
    { Icon: IconTarget, fg: t.teal, text: '6-week close plan flagged for Avinash', sub: 'TTD 96k to commitment' },
    { Icon: IconWizard, fg: t.warning, text: 'Nudge sent to Jamal Khan', sub: 'File Week 48 report by EOD' },
    { Icon: IconMedal, fg: t.gold, text: 'Marsha Singh recognized', sub: 'Sharing her approach-booking routine Thursday' },
  ];
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 36, padding: '24px 48px 28px', alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.teal, letterSpacing: '0.2em', fontFamily: APP_FONT_MONO }}>STAND-UP COMPLETE</div>
        <div className="a-rise" style={{ fontSize: 52, fontWeight: 700, color: t.ink, letterSpacing: '-0.03em', lineHeight: 1.0, marginTop: 12, fontFamily: APP_FONT_DISPLAY }}>That's the room.</div>
        <div className="a-rise a-d-1" style={{ fontSize: 17, color: t.inkMute, marginTop: 14, lineHeight: 1.5, maxWidth: 440 }}>
          Six agents reviewed, four actions captured. {MEETING.branch} is <span style={{ color: t.ink, fontWeight: 700 }}>{Math.round((MEETING.ytdApi / MEETING.branchGoal) * 100)}%</span> to goal with {MEETING.weeksLeft} weeks left. Next stand-up Monday, 8:30 AM.
        </div>
        <div className="a-rise a-d-2" style={{ display: 'flex', gap: 28, marginTop: 28 }}>
          {[
            { k: 'REVIEWED', v: '6' },
            { k: 'ACTIONS', v: '4' },
            { k: 'RECOGNIZED', v: '3', gold: true },
          ].map((m) => (
            <div key={m.k}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{m.k}</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: m.gold ? t.gold : t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.025em', marginTop: 5, lineHeight: 1 }}>{m.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions captured */}
      <div style={{ width: 420, flexShrink: 0, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 16, padding: '18px 20px' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, marginBottom: 14 }}>ACTIONS CAPTURED IN THE ROOM</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {actions.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${a.fg}1f`, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <a.Icon size={15} color={a.fg} stroke={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{a.text}</div>
                <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 2, lineHeight: 1.35 }}>{a.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// COMPOSER — pick the slide, wire the stage + footer.
// ──────────────────────────────────────────────────────────────────────────
function MeetingScene({ t, slide = 'agenda', mode = 'group', chrome = true, actGroup = 'unit', actSort = 'api', photoSrcs = null, kpiDensity = 'condensed' }) {
  const total = MEETING_STEPS;
  const step = stepOf(slide);
  const nt = (s) => (chrome ? s : null); // presenter note only when chrome on

  // agenda
  if (slide === 'agenda') {
    return (
      <MeetingStage t={t} step={step} total={total} phase="Branch roll-up" mode={mode}
        bleed={<OpenSlideshow t={t} srcs={photoSrcs} />}
        footer={<MeetingFooter t={t} step={step} total={total} note={nt("Open on the branch's reality. Name the two critical agents before diving in.")} />}>
        <AgendaBody t={t} />
      </MeetingStage>
    );
  }
  // branch scorecard
  if (slide === 'branch') {
    return (
      <MeetingStage t={t} step={step} total={total} phase="Branch roll-up" mode={mode}
        footer={<MeetingFooter t={t} step={step} total={total} note={nt('Lead with the year so far vs goal; let the room feel the 5 weeks left.')} />}>
        <BranchBody t={t} />
      </MeetingStage>
    );
  }
  // units
  if (slide === 'units') {
    return (
      <MeetingStage t={t} step={step} total={total} phase="Units" mode={mode}
        footer={<MeetingFooter t={t} step={step} total={total} note={nt('S·03 is behind on goal pace — flag it, then move to the numbers.')} />}>
        <UnitsBody t={t} />
      </MeetingStage>
    );
  }
  // activity master sheet
  if (slide === 'activity') {
    return (
      <MeetingStage t={t} step={step} total={total} phase="The numbers · activity" mode={mode}
        footer={<MeetingFooter t={t} step={step} total={total} note={nt("Scan the floor breaches — they're who we'll stop on next.")} />}>
        <ActivitySheetBody t={t} group={actGroup} sort={actSort} density={kpiDensity} />
      </MeetingStage>
    );
  }
  // production master sheet
  if (slide === 'production') {
    return (
      <MeetingStage t={t} step={step} total={total} phase="The numbers · production" mode={mode}
        footer={<MeetingFooter t={t} step={step} total={total} note={nt('This is the report they know — point out the year total and the leaders.')} />}>
        <ProductionSheetBody t={t} />
      </MeetingStage>
    );
  }
  // recognition
  if (slide === 'recognition') {
    return (
      <MeetingStage t={t} step={step} total={total} phase="Recognition" mode={mode}
        footer={<MeetingFooter t={t} step={step} total={total} note={nt('Let them clap. Ask Marsha to say one sentence on her routine.')} />}>
        <RecognitionBody t={t} />
      </MeetingStage>
    );
  }
  // celebrations — birthdays & anniversaries
  if (slide === 'celebrations') {
    return (
      <MeetingStage t={t} step={step} total={total} phase="Celebrations" mode={mode}
        footer={<MeetingFooter t={t} step={step} total={total} note={nt('Read the names out — a round of applause for the anniversaries.')} />}>
        <CelebrationsBody t={t} />
      </MeetingStage>
    );
  }
  // awards within reach
  if (slide === 'awards') {
    return (
      <MeetingStage t={t} step={step} total={total} phase="Within reach" mode={mode}
        footer={<MeetingFooter t={t} step={step} total={total} note={nt('Name names — tell each one exactly what closes the gap this month.')} />}>
        <AwardsReachBody t={t} />
      </MeetingStage>
    );
  }
  // close
  if (slide === 'close') {
    return (
      <MeetingStage t={t} step={step} total={total} phase="Wrap-up" mode={mode}
        footer={<MeetingFooter t={t} step={step} total={total} />}>
        <CloseBody t={t} />
      </MeetingStage>
    );
  }
  // solo 1-on-1
  if (slide.indexOf('solo:') === 0) {
    const r = RUN.find((x) => x.id === slide.slice(5)) || RUN[0];
    return (
      <MeetingStage t={t} step={step} total={total} phase={`1-on-1 · ${r.unit}`} mode="solo"
        footer={<MeetingFooter t={t} step={step} total={total} actions={chrome} note={nt(r.note)} />}>
        <OneOnOneBody t={t} r={r} />
      </MeetingStage>
    );
  }
  // agent step (group)
  const r = RUN.find((x) => x.id === slide.replace('agent:', '')) || RUN[0];
  return (
    <MeetingStage t={t} step={step} total={total} phase={r.flag ? 'Needs attention' : 'On pace'} mode={mode}
      footer={<MeetingFooter t={t} step={step} total={total} actions={chrome && !!r.flag} note={nt(r.note)} />}>
      <AgendaRail t={t} activeId={r.id} doneIds={doneBefore(runIndex(r.id))} />
      <AgentMain t={t} r={r} density={kpiDensity} />
    </MeetingStage>
  );
}

Object.assign(window, {
  RUN_TOTAL, runIndex, doneBefore, OpenSlideshow, OpenPhotoSlots,
  AgendaBody, AgendaCount, AgentMain, OneOnOneBody, RecognitionBody, CloseBody, MeetingScene,
});

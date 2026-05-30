// Weekly Report Wizard v2 — desktop chrome, mobile chrome, mid-step content,
// review-and-submit screen, and the submission celebration.
//
// Composition:
//   WizardFrameDesktop(t, step, autosaveState, children, hideSidePanel)
//   WizardFrameMobile(t, step, autosaveState, children, sidePanelMode)
//   Step7_NewBusiness({t, data, live})         — the mid-step content (was Step 6 in earlier draft)
//   ReviewSubmit({t, data, live, mobile})      — Step 12
//   Celebration({t, data, live})               — desktop dark moment

// ──────────────────────────────────────────────────────────────────────────
// One-time CSS — confetti + sparkle + halo (reused from kiosk grammar, but
// scoped here so this design file is self-contained).
// ──────────────────────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('wizard-v2-styles')) {
  const s = document.createElement('style');
  s.id = 'wizard-v2-styles';
  s.textContent = `
    @keyframes wiz-confetti-fall {
      0%   { transform: translateY(-40px) rotate(0deg);   opacity: 0; }
      8%   { opacity: 0.9; }
      90%  { opacity: 0.9; }
      100% { transform: translateY(820px) rotate(640deg); opacity: 0; }
    }
    @keyframes wiz-halo-gold {
      0%, 100% { box-shadow: 0 0 0 0 rgba(232,183,62,0.55), inset 0 0 0 2px rgba(232,183,62,0.95); }
      50%      { box-shadow: 0 0 0 18px rgba(232,183,62,0), inset 0 0 0 2px rgba(232,183,62,0.95); }
    }
    @keyframes wiz-sparkle {
      0%, 100% { transform: scale(0.5); opacity: 0.15; }
      50%      { transform: scale(1);   opacity: 1; }
    }
    @keyframes wiz-badge-land {
      from { transform: scale(0.6); opacity: 0; }
      60%  { transform: scale(1.08); opacity: 1; }
      to   { transform: scale(1); opacity: 1; }
    }
    @keyframes wiz-count-up {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .wiz-halo-gold { animation: wiz-halo-gold 2.8s ease-out infinite; }
    .wiz-sparkle   { animation: wiz-sparkle 2.2s ease-in-out infinite; }
    .wiz-badge-land { animation: wiz-badge-land 700ms cubic-bezier(0.34, 1.6, 0.64, 1) both; }
    .wiz-count-up  { animation: wiz-count-up 520ms cubic-bezier(0.34, 1.4, 0.64, 1) both; }
  `;
  document.head.appendChild(s);
}

// ──────────────────────────────────────────────────────────────────────────
// WizardFrameDesktop — full-screen take-over modal on top of the app shell.
// We render a faint AppShell + Sidebar dimmed in the background for context,
// then overlay the wizard surface with chrome at top + content + side panel.
// ──────────────────────────────────────────────────────────────────────────
function WizardFrameDesktop({ t, step, autosaveState = 'saved', autosaveStamp = '12s ago', children, sidePanel, footer }) {
  const stepMeta = WIZARD_STEPS.find(s => s.n === step) || WIZARD_STEPS[0];
  return (
    <div style={{
      width: APP_W, height: APP_H, background: t.bg, color: t.ink,
      fontFamily: APP_FONT_SANS, position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
    }}>
      <AmbientBg t={t} />

      {/* Dimmed AppShell hint — so user feels the wizard takes over the app */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35, filter: 'blur(0px)', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ display: 'flex', height: '100%' }}>
          <Sidebar t={t} active="wizard" />
        </div>
      </div>

      {/* Scrim */}
      <div style={{ position: 'absolute', inset: 0, background: t.mode === 'light' ? 'rgba(247,246,242,0.78)' : 'rgba(26,22,18,0.78)', backdropFilter: 'blur(2px)', zIndex: 1 }}></div>

      {/* Wizard surface */}
      <div className="a-rise" style={{
        position: 'absolute', top: 20, left: 20, right: 20, bottom: 20,
        background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 18,
        boxShadow: t.mode === 'light'
          ? '0 24px 60px rgba(40,37,29,0.12), 0 6px 18px rgba(40,37,29,0.06)'
          : '0 24px 60px rgba(0,0,0,0.5), 0 6px 18px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 2,
      }}>
        {/* Chrome row */}
        <div style={{
          padding: '18px 26px 14px', display: 'flex', alignItems: 'center', gap: 18,
          borderBottom: `1px solid ${t.rule}`, flexShrink: 0,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: t.tealTint,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <IconWizard size={20} color={t.teal} stroke={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, textTransform: 'uppercase' }}>
              Weekly Report · {WIZARD_SAMPLE.weekLabel}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, letterSpacing: '-0.012em', fontFamily: APP_FONT_DISPLAY, marginTop: 2 }}>
              {WIZARD_SAMPLE.agent} · <span style={{ color: t.teal }}>{stepMeta.title}</span>
            </div>
          </div>
          <AutosaveChip t={t} state={autosaveState} stamp={autosaveStamp} />
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 14px 8px 10px',
            background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`,
            borderRadius: 999, color: t.ink, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Close
          </div>
        </div>

        {/* Phase progress strip */}
        <div style={{ padding: '14px 26px 16px', borderBottom: `1px solid ${t.rule}`, flexShrink: 0 }}>
          <PhaseProgress t={t} currentStep={step} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ flex: 1, padding: '24px 28px 18px', display: 'flex', flexDirection: 'column', gap: 18, overflow: 'hidden', minWidth: 0 }}>
            {children}
          </div>
          {sidePanel && (
            <div style={{ width: 340, padding: '24px 26px 18px 0', flexShrink: 0, borderLeft: `1px solid ${t.rule}`, paddingLeft: 24, background: t.surfaceSoft }}>
              {sidePanel}
            </div>
          )}
        </div>

        {/* Footer nav */}
        {footer && (
          <div style={{
            padding: '14px 26px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function WizardFooter({ t, prevLabel = 'Back', nextLabel = 'Next', stepInfo, primaryColor }) {
  const primary = primaryColor || t.teal;
  return (
    <>
      <div style={{
        padding: '9px 14px', borderRadius: 10,
        background: t.surface, border: `1px solid ${t.rule}`,
        color: t.ink, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.02em',
        display: 'inline-flex', alignItems: 'center', gap: 7,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        {prevLabel}
      </div>
      <div style={{ flex: 1, fontSize: 11, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.1em', textAlign: 'center' }}>
        {stepInfo}
      </div>
      <div style={{
        padding: '10px 18px', borderRadius: 10,
        background: primary, color: '#fff',
        fontSize: 13, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', gap: 8,
        boxShadow: `0 4px 12px ${primary}44`,
      }}>
        {nextLabel}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Step 7 content — New Business this week. The flagship mid-flow step.
// Shown in both desktop and mobile mocks (same fields, different layout).
// ──────────────────────────────────────────────────────────────────────────
function Step7_NewBusiness({ t, data, live, mobile = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 12 : 14, overflowY: 'auto' }}>
      <StepTitle
        t={t}
        eyebrow="Step 7 · Sales"
        title="New business this week"
        sub={mobile ? 'The policies you wrote. Watch your Production API tick up live as you type.' : 'The policies you wrote this week. Watch your Production API tick up live on the right as you type.'}
      />

      {/* Primary fields — 3 inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <NumField t={t}
          label="Applications written"
          hint="New policy applications completed and submitted."
          value={data.newBusinessApps}
          lastWeek={2}
        />
        <NumField t={t}
          label="Lives sold"
          hint="Total lives covered across all applications this week."
          value={data.newBusinessLives}
        />
        {/* Currency field — actively focused, mid-type */}
        <CurrencyField t={t}
          label="New business API"
          hint="Annual Premium Income from new business. Lumpsums and PPP are added separately below."
          value={data.newBusinessAPI}
          lastWeek={data.lastWeek.api}
          focused
          big
        />
      </div>

      {/* PPP — collapsed pill */}
      <div style={{
        padding: '12px 14px', background: t.surfaceSoft, border: `1px dashed ${t.ruleStrong}`,
        borderRadius: 11, display: 'flex', alignItems: 'center', gap: 11,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: t.surface, border: `1px solid ${t.rule}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconPlus size={14} color={t.teal} stroke={2.4} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>Add PPP increases</div>
          <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>1 added so far · TTD 6K total increase</div>
        </div>
        <span style={{ fontSize: 10, color: t.gold, fontWeight: 700, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>1 ON FILE</span>
      </div>

      {/* Lumpsums — expanded with live calc visible */}
      <div style={{
        padding: '14px 16px', background: t.surface, border: `1px solid ${t.teal}33`,
        borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>LUMPSUMS</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginTop: 3 }}>Gross amount collected</div>
            <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2 }}>10% counts toward Production API · 0.5% commission</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em' }}>
            {ttd(data.lumpsumGross)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.rule}` }}>
          <div style={{ flex: 1, padding: '8px 10px', background: t.tealTint, borderRadius: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_MONO, letterSpacing: '0.12em' }}>API CREDIT</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 4, letterSpacing: '-0.012em' }}>{ttd(live.lumpsumCredit)}</div>
          </div>
          <div style={{ flex: 1, padding: '8px 10px', background: t.goldTint, borderRadius: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_MONO, letterSpacing: '0.12em' }}>COMMISSION</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 4, letterSpacing: '-0.012em' }}>{ttd(live.lumpsumComm)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Review & Submit (Step 12) — restructured. Hero summary at the top, then
// sectioned scorecards, each with an inline "Edit" pill.
// ──────────────────────────────────────────────────────────────────────────
function ReviewSubmit({ t, data, live, mobile = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 12 : 16, overflowY: 'auto' }}>
      <StepTitle
        t={t}
        eyebrow="Step 12 · Goals"
        title="Ready to submit"
        sub={mobile ? 'Last look before it lands on the dashboard.' : 'Last look before your week lands on the dashboard. Tap Edit to jump back to any step.'}
      />

      {/* Hero — Production + Commission */}
      <div style={{
        padding: '18px 20px', background: t.surface, border: `1px solid ${t.gold}55`, borderRadius: 14,
        position: 'relative', overflow: 'hidden',
        boxShadow: `0 8px 24px ${t.mode === 'light' ? 'rgba(176,125,26,0.10)' : 'rgba(0,0,0,0.4)'}`,
      }}>
        <div className="a-glow-soft" style={{
          position: 'absolute', top: -60, right: -60, width: 220, height: 220,
          background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 65%)`,
          pointerEvents: 'none',
        }}></div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.gold, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>YOUR WEEK · {data.weekShort}</div>
            <div style={{ fontSize: mobile ? 30 : 36, fontWeight: 700, color: t.ink, letterSpacing: '-0.028em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 8 }}>
              {ttd(live.totalProductionAPI)}
            </div>
            <div style={{ fontSize: 11, color: t.inkMute, marginTop: 5, letterSpacing: '0.02em' }}>Production API · {live.totalApps} apps · {data.newBusinessLives} lives</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>EST. COMMISSION</div>
            <div style={{ fontSize: mobile ? 22 : 26, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1, marginTop: 8 }}>{ttd(live.totalComm)}</div>
            <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 5, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>at {data.commissionRate}% · +{ttd(live.totalProductionAPI - data.lastWeek.api)} vs last wk</div>
          </div>
        </div>
      </div>

      {/* Production line items */}
      <ReviewSection t={t} eyebrow="PRODUCTION" backToStep={7} mobile={mobile}>
        {[
          { label: 'New business', value: `${data.newBusinessApps} apps · ${ttd(data.newBusinessAPI)}`, big: true },
          { label: 'PPP increases', value: `${data.pppApps} app · ${ttd(data.pppAPIInc)} API` },
          { label: `Lumpsums (10% of ${ttd(data.lumpsumGross)})`, value: ttd(live.lumpsumCredit) },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 2 ? `1px solid ${t.rule}` : 'none' }}>
            <span style={{ fontSize: 12, color: t.inkMute }}>{r.label}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, fontFamily: r.big ? APP_FONT_DISPLAY : APP_FONT_SANS, letterSpacing: '-0.005em' }}>{r.value}</span>
          </div>
        ))}
      </ReviewSection>

      {/* Activity scorecards 2x2 */}
      <ReviewSection t={t} eyebrow="ACTIVITY" backToStep={3} mobile={mobile}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 2 }}>
          {[
            { eye: 'CALLS',  value: data.totalCalls, sub: 'across 5 categories' },
            { eye: 'NAMES',  value: data.newNames, sub: 'new prospects added' },
            { eye: 'CIs',    value: data.ciConducted, sub: `${data.newCIBooked} new + ${data.oldCIBooked} old booked` },
            { eye: 'CONV.',  value: `${live.ciConv}%`, sub: 'CI → app' },
          ].map((k, i) => (
            <div key={i} style={{ padding: '10px 12px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.14em' }}>{k.eye}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.018em', lineHeight: 1, marginTop: 6 }}>{k.value}</div>
              <div style={{ fontSize: 10, color: t.inkMute, marginTop: 4 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </ReviewSection>

      {/* Reflection — ratings strip */}
      <ReviewSection t={t} eyebrow="REFLECTION" backToStep={10} mobile={mobile}>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, marginBottom: 8 }}>
          {[
            { lbl: 'Plan',     val: 7 },
            { lbl: 'Time',     val: 6 },
            { lbl: 'Sales',    val: 8 },
            { lbl: 'Prospect', val: 7 },
            { lbl: 'Overall',  val: 7, hero: true },
          ].map((r, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: r.hero ? t.tealTint : t.surfaceSoft, border: `1px solid ${r.hero ? t.teal + '44' : t.rule}`, borderRadius: 9 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: r.hero ? t.teal : t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{r.lbl.toUpperCase()}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: r.hero ? t.teal : t.ink, fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 5, letterSpacing: '-0.018em' }}>
                {r.val}<span style={{ fontSize: 10, color: t.inkFaint, fontWeight: 600, fontFamily: APP_FONT_MONO, marginLeft: 1 }}>/10</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: t.inkMute, lineHeight: 1.45, marginTop: 4, padding: '8px 10px', background: t.surfaceSoft, borderRadius: 8, fontStyle: 'italic' }}>
          "Strong week on referrals — the Persaud family follow-up turned into 2 apps. Need to block field hours better next week."
        </div>
      </ReviewSection>

      {/* Goals strip */}
      <ReviewSection t={t} eyebrow="NEXT WEEK GOALS" backToStep={11} mobile={mobile}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 2 }}>
          {[
            { lbl: 'CALLS', val: 55 },
            { lbl: 'FFI',   val: 6 },
            { lbl: 'CI',    val: 5 },
            { lbl: 'API',   val: 'TTD 24K' },
          ].map((k, i) => (
            <div key={i} style={{ padding: '8px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.14em' }}>{k.lbl}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 4, letterSpacing: '-0.012em' }}>{k.val}</div>
            </div>
          ))}
        </div>
      </ReviewSection>
    </div>
  );
}

function ReviewSection({ t, eyebrow, children, backToStep, mobile }) {
  return (
    <div className="a-fade-up" style={{
      padding: '14px 16px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Eyebrow t={t} color={t.inkMute}>{eyebrow}</Eyebrow>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 9px', background: t.tealTint, color: t.teal,
          border: `1px solid ${t.teal}33`, borderRadius: 999,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
        }}>
          Edit · Step {backToStep}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </div>
      </div>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Submission Celebration — kiosk-grade moment. Confetti + halo + count-up.
// "Your stats landed on the dashboard" is shown as a faint dashboard echo
// behind so the agent feels the link to the next surface.
// ──────────────────────────────────────────────────────────────────────────
function CelebrationConfetti({ count = 36 }) {
  // Deterministic positions so the screenshot looks consistent.
  const colors = ['#E0AA3E', '#4AB5B8', '#F26A55', '#A995E0', '#5DB876'];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 4 }}>
      {Array.from({ length: count }).map((_, i) => {
        const left = (i * 97) % 100;
        const delay = (i * 0.21) % 4.2;
        const dur = 3.6 + (i % 5) * 0.4;
        const sz = 6 + (i % 4) * 2;
        const color = colors[i % colors.length];
        const rect = i % 3 === 0;
        return (
          <div key={i} style={{
            position: 'absolute', top: -20, left: `${left}%`,
            width: sz, height: rect ? sz * 0.5 : sz, background: color,
            borderRadius: rect ? 1 : '50%',
            animation: `wiz-confetti-fall ${dur}s linear ${delay}s infinite`,
            opacity: 0.9,
          }}></div>
        );
      })}
    </div>
  );
}

function CelebrationSparkles({ count = 14 }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
      {Array.from({ length: count }).map((_, i) => {
        const left = 8 + (i * 53) % 84;
        const top  = 12 + (i * 71) % 70;
        const delay = (i * 0.31) % 2.2;
        return (
          <div key={i} className="wiz-sparkle" style={{
            position: 'absolute', left: `${left}%`, top: `${top}%`,
            width: 14, height: 14,
            animationDelay: `${delay}s`,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E0AA3E" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="3" x2="12" y2="21" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
              <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function Celebration({ t, data, live, mobile = false }) {
  return (
    <div style={{
      width: mobile ? M_W : APP_W, height: mobile ? M_H : APP_H,
      background: t.bg, position: 'relative', overflow: 'hidden',
      fontFamily: APP_FONT_SANS, color: t.ink,
      borderRadius: mobile ? 44 : 0,
      boxSizing: 'border-box',
      boxShadow: mobile ? (t.mode === 'light' ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'inset 0 0 0 1px rgba(255,255,255,0.06)') : 'none',
    }}>
      <AmbientBg t={t} />

      {/* Background dashboard echo — gives the "landed on the dashboard" feel */}
      {!mobile && (
        <div style={{ position: 'absolute', inset: 40, opacity: 0.18, filter: 'blur(2px)', pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, padding: 40 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 90, background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12 }}></div>
            ))}
          </div>
        </div>
      )}

      {/* Confetti + sparkles */}
      <CelebrationConfetti count={mobile ? 22 : 38} />
      <CelebrationSparkles count={mobile ? 10 : 16} />

      {/* Center stack */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', zIndex: 5, padding: mobile ? '60px 24px' : '40px',
      }}>
        {/* Top eyebrow */}
        <div className="a-fade-up" style={{
          fontSize: 11, fontWeight: 700, color: t.teal,
          letterSpacing: '0.22em', fontFamily: APP_FONT_MONO, textTransform: 'uppercase', marginBottom: 18,
        }}>WEEKLY REPORT · SUBMITTED</div>

        {/* Submission badge with gold halo */}
        <div className="wiz-badge-land" style={{ position: 'relative', marginBottom: 22 }}>
          <div className="wiz-halo-gold" style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
          }}></div>
          <div style={{
            width: mobile ? 130 : 170, height: mobile ? 130 : 170,
            borderRadius: '50%',
            background: `radial-gradient(circle at 30% 25%, #FFE48A 0%, ${t.gold} 55%, #8E5A0F 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
            color: '#fff',
            boxShadow: '0 12px 32px rgba(176,125,26,0.45), inset 0 4px 12px rgba(255,255,255,0.4), inset 0 -8px 20px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', fontFamily: APP_FONT_MONO, opacity: 0.85 }}>WEEK</div>
            <div style={{ fontSize: mobile ? 50 : 64, fontWeight: 800, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 2 }}>48</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', fontFamily: APP_FONT_MONO, opacity: 0.85, marginTop: 4 }}>2026 · SUBMITTED</div>
          </div>
        </div>

        {/* Headline */}
        <div className="wiz-count-up" style={{
          fontSize: mobile ? 26 : 38, fontWeight: 700, color: t.ink,
          letterSpacing: '-0.028em', fontFamily: APP_FONT_DISPLAY,
          lineHeight: 1.05, textAlign: 'center', maxWidth: mobile ? 320 : 540,
          animationDelay: '300ms',
        }}>Nice work, {data.agent.split(' ')[0]}.</div>
        <div className="wiz-count-up" style={{
          fontSize: mobile ? 13 : 15, color: t.inkMute,
          marginTop: 10, textAlign: 'center', maxWidth: mobile ? 320 : 520, lineHeight: 1.5,
          animationDelay: '420ms',
        }}>
          Your week landed on the dashboard. {ttd(live.totalProductionAPI)} of Production API in the books.
        </div>

        {/* Count-up stats row */}
        <div className="wiz-count-up" style={{
          display: 'flex', gap: mobile ? 12 : 22, marginTop: mobile ? 24 : 32, alignItems: 'stretch',
          animationDelay: '540ms',
        }}>
          {[
            { eye: 'PRODUCTION API', value: ttd(live.totalProductionAPI), tone: t.teal },
            { eye: 'APPS WRITTEN',   value: live.totalApps, tone: t.gold },
            { eye: 'EST. COMMISSION', value: ttd(live.totalComm), tone: t.teal },
          ].map((k, i) => (
            <div key={i} style={{
              padding: mobile ? '12px 16px' : '16px 22px',
              background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12,
              minWidth: mobile ? 94 : 160, textAlign: 'center',
              boxShadow: t.mode === 'light' ? '0 4px 12px rgba(40,37,29,0.05)' : '0 4px 12px rgba(0,0,0,0.4)',
            }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: k.tone, fontFamily: APP_FONT_MONO, letterSpacing: '0.14em' }}>{k.eye}</div>
              <div style={{ fontSize: mobile ? 18 : 24, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1, marginTop: 8 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="wiz-count-up" style={{
          display: 'flex', gap: 10, marginTop: mobile ? 24 : 36,
          animationDelay: '700ms',
        }}>
          <div style={{
            padding: '11px 18px', background: t.surface, border: `1px solid ${t.rule}`,
            color: t.ink, borderRadius: 10, fontSize: 12.5, fontWeight: 700,
          }}>View submission</div>
          <div style={{
            padding: '11px 20px', background: t.teal, color: '#fff', borderRadius: 10,
            fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: `0 6px 16px ${t.teal}55`,
          }}>
            Back to dashboard
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>

        {/* Floating "landed on dashboard" tag */}
        {!mobile && (
          <div className="wiz-count-up" style={{
            marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '7px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`,
            borderRadius: 999, color: t.inkMute, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
            animationDelay: '860ms',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.success, boxShadow: `0 0 8px ${t.success}` }}></span>
            Your stats are now visible on the team leaderboard.
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mobile wizard frame — sticky chrome + live strip + sticky bottom nav.
// ──────────────────────────────────────────────────────────────────────────
function WizardFrameMobile({ t, step, autosaveState = 'saved', autosaveStamp = '12s', children, footerLabel = 'Next', showLiveStrip = true, data, live }) {
  const stepMeta = WIZARD_STEPS.find(s => s.n === step) || WIZARD_STEPS[0];
  return (
    <MFrame t={t}>
      {/* Header replaces MHeader to fit wizard chrome */}
      <div style={{
        position: 'absolute', top: 44, left: 0, right: 0,
        padding: '12px 18px 12px', background: t.bg, zIndex: 5,
        borderBottom: `1px solid ${t.rule}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, textTransform: 'uppercase' }}>
              Weekly Report · {data.weekShort}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em', marginTop: 2, fontFamily: APP_FONT_DISPLAY }}>
              {stepMeta.title}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <AutosaveChip t={t} state={autosaveState} stamp={autosaveStamp} />
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: t.ink,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>
        </div>
        <PhaseProgress t={t} currentStep={step} />
      </div>

      {/* Content */}
      <div style={{
        position: 'absolute', top: 168, left: 0, right: 0, bottom: showLiveStrip ? 152 : 92,
        overflow: 'hidden', padding: '14px 18px 0',
      }}>
        {children}
      </div>

      {/* Live strip — bottom of content area, compact */}
      {showLiveStrip && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 88,
          padding: '10px 18px', background: t.surface, borderTop: `1px solid ${t.rule}`,
          zIndex: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>PRODUCTION API · LIVE</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.022em', lineHeight: 1 }}>{ttd(live.totalProductionAPI)}</span>
                <span style={{
                  padding: '1px 6px', borderRadius: 999, background: t.successTint, color: t.success,
                  fontSize: 9, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em',
                }}>▲ {ttd(live.totalProductionAPI - data.lastWeek.api)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { lbl: 'APPS', val: live.totalApps },
                { lbl: 'CI %', val: `${live.ciConv}%` },
                { lbl: 'COMM', val: ttd(live.totalComm) },
              ].map((k, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>{k.lbl}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em', marginTop: 3 }}>{k.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav — Back / Next */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '12px 18px 30px', background: t.surface, borderTop: `1px solid ${t.rule}`,
        display: 'flex', gap: 10, zIndex: 9,
      }}>
        <div style={{
          padding: '12px 16px', background: t.surfaceSoft, border: `1px solid ${t.rule}`,
          color: t.ink, borderRadius: 10, fontSize: 13, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </div>
        <div style={{
          flex: 1, padding: '12px 16px', background: t.teal, color: '#fff',
          borderRadius: 10, fontSize: 13.5, fontWeight: 700, textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: `0 4px 12px ${t.teal}55`,
        }}>
          {footerLabel}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Composed top-level scenes used by the design canvas
// ──────────────────────────────────────────────────────────────────────────
function WizardDesktopMidStep({ t }) {
  const data = WIZARD_SAMPLE;
  const live = computeWizardLive(data);
  return (
    <WizardFrameDesktop
      t={t}
      step={7}
      autosaveState="saved"
      autosaveStamp="12s ago"
      sidePanel={<WeekSoFarPanel t={t} data={data} live={live} variant="desktop" />}
      footer={<WizardFooter t={t} prevLabel="Back" nextLabel="Next · Delivery & service" stepInfo="STEP 7 OF 12 · ~3 MIN LEFT" />}
    >
      <Step7_NewBusiness t={t} data={data} live={live} />
    </WizardFrameDesktop>
  );
}

function WizardDesktopCelebration({ t }) {
  const data = WIZARD_SAMPLE;
  const live = computeWizardLive(data);
  return <Celebration t={t} data={data} live={live} />;
}

function WizardMobileMidStep({ t }) {
  const data = WIZARD_SAMPLE;
  const live = computeWizardLive(data);
  return (
    <WizardFrameMobile t={t} step={7} data={data} live={live}>
      <div style={{ height: '100%', overflowY: 'auto' }}>
        <Step7_NewBusiness t={t} data={data} live={live} mobile />
      </div>
    </WizardFrameMobile>
  );
}

function WizardMobileReview({ t }) {
  const data = WIZARD_SAMPLE;
  const live = computeWizardLive(data);
  return (
    <WizardFrameMobile t={t} step={12} data={data} live={live} showLiveStrip={false} footerLabel="Submit report">
      <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 6 }}>
        <ReviewSubmit t={t} data={data} live={live} mobile />
      </div>
    </WizardFrameMobile>
  );
}

Object.assign(window, {
  WizardFrameDesktop, WizardFrameMobile, WizardFooter,
  Step7_NewBusiness, ReviewSubmit, Celebration,
  WizardDesktopMidStep, WizardDesktopCelebration,
  WizardMobileMidStep, WizardMobileReview,
});

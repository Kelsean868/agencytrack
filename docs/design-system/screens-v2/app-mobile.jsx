// Mobile app screens — same 5 screens reflowed for 390×844 mobile.

const M_W = 390;
const M_H = 844;

// ──────────────────────────────────────────────────────────────────────────
// Mobile frame chrome — status bar + content slot + home indicator
// ──────────────────────────────────────────────────────────────────────────
function MFrame({ t, time = "9:41", children }) {
  return (
    <div style={{
      width: M_W, height: M_H, background: t.bg,
      position: 'relative', overflow: 'hidden',
      fontFamily: APP_FONT_SANS, color: t.ink,
      borderRadius: 44,
      boxShadow: t.mode === 'light' ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
      boxSizing: 'border-box',
    }}>
      <AmbientBg t={t} />
      {/* Status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', fontSize: 15, fontWeight: 600,
        color: t.ink, letterSpacing: '-0.005em', zIndex: 30,
      }}>
        <span>{time}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="18" height="11" viewBox="0 0 18 11" fill={t.ink}>
            <rect x="0"  y="7" width="3" height="4" rx="0.5" />
            <rect x="5"  y="5" width="3" height="6" rx="0.5" />
            <rect x="10" y="2" width="3" height="9" rx="0.5" />
            <rect x="15" y="0" width="3" height="11" rx="0.5" />
          </svg>
          <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
            <rect x="0.5" y="0.5" width="22" height="12" rx="3" stroke={t.ink} strokeOpacity="0.4" />
            <rect x="2"   y="2"   width="19" height="9"  rx="1.5" fill={t.ink} />
            <rect x="24"  y="4"   width="2"  height="5"  rx="0.6" fill={t.ink} fillOpacity="0.4" />
          </svg>
        </div>
      </div>
      {children}
      {/* Home indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 134, height: 5, background: t.ink, borderRadius: 999, opacity: 0.85, zIndex: 30,
      }}></div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Bottom nav — 4 tabs + central Submit FAB
// ──────────────────────────────────────────────────────────────────────────
function MNav({ t, active = 'home' }) {
  const tabs = [
    { key: 'home',    label: 'Home',    Icon: IconHome },
    { key: 'history', label: 'History', Icon: IconHistory },
    { key: 'submit',  label: 'Submit',  Icon: IconPlus, fab: true },
    { key: 'ranks',   label: 'Ranks',   Icon: IconTrophy },
    { key: 'more',    label: 'More',    Icon: IconGrid },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 28,
      background: t.surface, borderTop: `1px solid ${t.rule}`,
      boxShadow: t.mode === 'light' ? '0 -2px 16px rgba(40,37,29,0.06)' : '0 -2px 16px rgba(0,0,0,0.4)',
      zIndex: 15,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', padding: '8px 12px 12px' }}>
        {tabs.map(tab => {
          const isActive = active === tab.key;
          const isFab = tab.fab;
          return (
            <div key={tab.key} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, minHeight: 56,
            }}>
              {isFab ? (
                <>
                  <div className="a-fab-pulse" style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: `linear-gradient(180deg, ${t.tealLight} 0%, ${t.teal} 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', marginTop: -32,
                    '--fab-glow-1': `${t.teal}66`,
                    '--fab-glow-2': `${t.teal}55`,
                    boxShadow: `0 6px 16px ${t.teal}66, 0 2px 4px rgba(40,37,29,0.18), inset 0 1px 0 rgba(255,255,255,0.25)`,
                    border: `3px solid ${t.surface}`,
                  }}>
                    <tab.Icon size={26} color="#fff" stroke={2.5} />
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: t.teal, marginTop: 2 }}>{tab.label}</div>
                </>
              ) : (
                <>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <tab.Icon size={22} color={isActive ? t.teal : t.inkFaint} stroke={2} />
                    {isActive && <div style={{ position: 'absolute', inset: -7, background: t.tealTint, borderRadius: 999, zIndex: -1, width: 36, height: 36, top: -7, left: '50%', transform: 'translateX(-50%)' }}></div>}
                  </div>
                  <div style={{
                    fontSize: 10.5, fontWeight: isActive ? 700 : 600,
                    color: isActive ? t.teal : t.inkMute,
                  }}>{tab.label}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mobile page header — sticky-ish title row + bell + avatar
// ──────────────────────────────────────────────────────────────────────────
function MHeader({ t, title, sub, badge = 3 }) {
  return (
    <div style={{
      position: 'absolute', top: 44, left: 0, right: 0,
      padding: '16px 20px 12px', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between',
      background: t.bg, zIndex: 5,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: t.inkFaint,
          letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO,
        }}>{sub}</div>
        <div style={{
          fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em',
          fontFamily: APP_FONT_DISPLAY, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: t.surface,
          border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.inkMute, position: 'relative',
        }}>
          <IconBell size={17} color={t.inkMute} />
          {badge > 0 && (
            <div style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: '50%', background: t.danger, border: `2px solid ${t.surface}` }}></div>
          )}
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: t.tealTint,
          color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY,
        }}>MS</div>
      </div>
    </div>
  );
}

// Mobile content wrapper — scroll area between header and nav
function MContent({ children, headerHeight = 116 }) {
  return (
    <div style={{
      position: 'absolute', top: headerHeight, left: 0, right: 0, bottom: 92,
      overflow: 'hidden', padding: '0 20px',
    }}>{children}</div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 01 · AGENT DASHBOARD (mobile)
// ──────────────────────────────────────────────────────────────────────────
function MAgentDashboard({ t }) {
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Hi, Marsha" sub="THU · 26 NOV" />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Needs attention */}
          <div style={{
            padding: '12px 14px', background: t.warningTint,
            border: `1px solid ${t.warning}33`, borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 11,
          }}>
            <div className="a-breathe" style={{ width: 32, height: 32, borderRadius: '50%', background: t.surface, border: `1px solid ${t.warning}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconAlert size={15} color={t.warning} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>Weekly report opens Sunday</div>
              <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>~5 min · last 2 min Mon</div>
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: t.warning, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>3d</div>
          </div>

          {/* This week — 2×2 grid */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>This week</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {[
                { eyebrow: 'API',     value: 'TTD 24.4K', sub: '3 apps',         accent: t.teal },
                { eyebrow: 'APPS',    value: '3',         sub: '2 NB · 1 PPP',   accent: t.gold },
                { eyebrow: 'FFI',     value: '4',         sub: '80% of std',     accent: t.teal },
                { eyebrow: 'CI',      value: '2',         sub: '100% closing',   accent: t.success },
              ].map((k, i) => (
                <div key={i} style={{
                  padding: '12px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11,
                }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: k.accent, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{k.eyebrow}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: t.ink, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 6 }}>{k.value}</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Looking Ahead widget */}
          <div style={{
            padding: '16px 16px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>LOOKING AHEAD · 2026</div>
              <div style={{ fontSize: 10.5, color: t.inkFaint, fontWeight: 600 }}>5 weeks left</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, letterSpacing: '-0.012em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.25 }}>TTD 113K to close the year on goal</div>
            <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 4 }}>Two more apps puts you in L4 territory.</div>
            <div style={{ marginTop: 12, height: 5, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
              <div className="a-progress-grow" style={{ width: '81%', height: 5, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: t.inkMute, fontFamily: APP_FONT_MONO }}>
              <span>TTD 487K</span>
              <span>Goal · TTD 600K</span>
            </div>
          </div>

          {/* Recent */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>Recent</div>
            {[
              { color: t.success, Icon: IconCheck, text: 'Weekly report submitted', sub: 'Mon · TTD 21.8K' },
              { color: t.gold,    Icon: IconMedal, text: 'Eagles Club pacer hit',   sub: '68% to goal' },
            ].map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 4px' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${a.color}22`, color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <a.Icon size={13} color={a.color} stroke={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{a.text}</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{a.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </MContent>
      <MNav t={t} active="home" />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 02 · LOOKING AHEAD (mobile) — vertical stepper
// ──────────────────────────────────────────────────────────────────────────
function MLookingAhead({ t }) {
  const steps = [
    { n: 1, label: 'Money Needs',    state: 'done',    desc: 'Lifestyle + business + savings' },
    { n: 2, label: 'Year Plan',      state: 'active',  desc: 'Split TTD 487K across product lines' },
    { n: 3, label: 'Monthly Plan',   state: 'pending', desc: 'Turn yearly targets into weekly actions' },
    { n: 4, label: 'Self-Improvement', state: 'pending', desc: 'Set 3 growth goals for the year' },
    { n: 5, label: 'Review & Track', state: 'pending', desc: 'Adjust as life changes' },
  ];
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Looking Ahead" sub="2026 PLANNING" />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Commission gap callout */}
          <div style={{
            padding: '14px 16px', background: t.tealTint, border: `1px solid ${t.teal}44`, borderRadius: 12,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>COMMISSION GAP</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 6 }}>TTD 487K</div>
            <div style={{ fontSize: 11, color: t.inkMute, marginTop: 4 }}>From Step 1 · this is your annual target</div>
          </div>

          {/* Vertical stepper */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
            {steps.map((s, i) => {
              const isActive = s.state === 'active';
              const isDone   = s.state === 'done';
              return (
                <div key={s.n} style={{
                  display: 'flex', gap: 14, padding: '12px 4px',
                  alignItems: 'flex-start', position: 'relative',
                }}>
                  {/* Vertical line */}
                  {i < steps.length - 1 && (
                    <div style={{
                      position: 'absolute', left: 17, top: 38, bottom: -4, width: 2,
                      background: isDone ? t.success : t.rule,
                    }}></div>
                  )}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: isActive ? t.teal : isDone ? t.success : t.surfaceMute,
                    color: (isActive || isDone) ? '#fff' : t.inkMute,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY,
                    flexShrink: 0, zIndex: 1, position: 'relative',
                    boxShadow: isActive ? `0 0 0 3px ${t.tealTint}` : 'none',
                  }}>
                    {isDone ? <IconCheck size={16} color="#fff" stroke={2.6} /> : s.n}
                  </div>
                  <div style={{
                    flex: 1,
                    padding: isActive ? '8px 14px 10px' : '6px 0',
                    background: isActive ? t.surface : 'transparent',
                    border: isActive ? `1px solid ${t.teal}44` : 'none',
                    borderRadius: isActive ? 10 : 0,
                    boxShadow: isActive ? `0 2px 6px ${t.teal}11` : 'none',
                  }}>
                    <div style={{
                      fontSize: 9.5, fontWeight: 700, color: isActive ? t.teal : t.inkFaint,
                      letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO,
                    }}>{isDone ? 'Complete' : isActive ? 'Current step' : `Step ${s.n}`}</div>
                    <div style={{
                      fontSize: 15, fontWeight: 700, color: isActive ? t.ink : isDone ? t.ink : t.inkMute,
                      letterSpacing: '-0.005em', marginTop: 3, fontFamily: APP_FONT_DISPLAY,
                    }}>{s.label}</div>
                    <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 4, lineHeight: 1.45 }}>{s.desc}</div>
                    {isActive && (
                      <div style={{
                        marginTop: 10, padding: '10px 14px', background: t.teal, color: '#fff',
                        borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        boxShadow: `0 2px 6px ${t.teal}44`,
                      }}>
                        Continue <IconArrowR size={13} color="#fff" stroke={2.4} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </MContent>
      <MNav t={t} active="more" />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 03 · MONEY NEEDS (mobile)
// ──────────────────────────────────────────────────────────────────────────
function MMoneyNeeds({ t }) {
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Money Needs" sub="STEP 1 · LOOKING AHEAD" />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Commission gap hero card */}
          <div style={{
            padding: '16px 18px', background: t.warningTint,
            border: `1px solid ${t.warning}44`, borderRadius: 14,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.warning, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>YOUR COMMISSION TARGET</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: t.warning, letterSpacing: '-0.028em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 8 }}>TTD 487K</div>
            <div style={{ fontSize: 11.5, color: t.ink, marginTop: 6, lineHeight: 1.5 }}>What you need from commissions after PAYE covers TTD 233K of your TTD 720K total need.</div>
          </div>

          {/* Two summary tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <div style={{ padding: '12px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: t.ink, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>TOTAL NEEDED</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>TTD 720K</div>
              <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 4 }}>2026 total</div>
            </div>
            <div style={{ padding: '12px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: t.success, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>BY PAYE</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>TTD 233K</div>
              <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 4 }}>Salary · steady</div>
            </div>
          </div>

          {/* Expense accordions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginTop: 4 }}>Expense categories</div>

            {/* Expanded first */}
            <div style={{ background: t.surface, border: `1px solid ${t.teal}33`, borderRadius: 11, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${t.rule}` }}>
                <IconChevD size={14} color={t.teal} stroke={2.4} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>Fixed Household</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>TTD 24,800<span style={{ color: t.inkMute, fontWeight: 500, fontSize: 10, marginLeft: 4 }}>/mo</span></div>
              </div>
              <div style={{ padding: '4px 14px 10px' }}>
                {[
                  { label: 'Rent / mortgage', value: '12,500' },
                  { label: 'Groceries',       value: '4,200' },
                  { label: 'Utilities',       value: '2,800' },
                ].map((line, i, arr) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < arr.length - 1 ? `1px solid ${t.rule}` : 'none' }}>
                    <div style={{ fontSize: 12, color: t.ink }}>{line.label}</div>
                    <div style={{ padding: '3px 9px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 6, fontSize: 11, fontWeight: 600, color: t.ink, fontFamily: APP_FONT_MONO }}>TTD {line.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Collapsed */}
            {[
              { label: 'Lifestyle & Family', value: 'TTD 6,400' },
              { label: 'Business Expenses',  value: 'TTD 4,200' },
              { label: 'Savings & Debt',     value: 'TTD 8,600' },
            ].map((c, i) => (
              <div key={i} style={{
                padding: '12px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <IconChevR size={14} color={t.inkMute} stroke={2.4} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.ink }}>{c.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{c.value}<span style={{ color: t.inkMute, fontWeight: 500, fontSize: 10, marginLeft: 4 }}>/mo</span></div>
              </div>
            ))}
          </div>

          {/* Send to Year Plan CTA */}
          <div style={{
            marginTop: 4, padding: '14px 16px', background: t.teal, color: '#fff',
            borderRadius: 11, fontSize: 13.5, fontWeight: 700, textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: `0 4px 12px ${t.teal}44`,
          }}>
            Send to Year Plan <IconArrowR size={14} color="#fff" stroke={2.4} />
          </div>
        </div>
      </MContent>
      <MNav t={t} active="more" />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 04 · MANAGER DASHBOARD (mobile)
// ──────────────────────────────────────────────────────────────────────────
function MManagerDashboard({ t }) {
  return (
    <MFrame t={t}>
      <MHeader t={t} title="South Branch" sub="THU · 26 NOV" />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Needs attention - vertical stack of 3 */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.warning, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>★ Needs attention · 3</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { kind: 'BELOW FLOOR', agent: 'Devin Lewis',  detail: 'TTD 128k below floor', color: t.danger, bg: t.dangerTint, Icon: IconAlert },
                { kind: 'MISSED WAR',  agent: 'Jamal Khan',   detail: '3 missed this quarter', color: t.warning, bg: t.warningTint, Icon: IconClock },
                { kind: 'PERSISTENCY', agent: 'Priya Naidu',  detail: '72% · 8pp below', color: t.warning, bg: t.warningTint, Icon: IconRepeat },
              ].map((c, i) => (
                <div key={i} style={{
                  padding: '11px 13px', background: c.bg, borderRadius: 11,
                  border: `1px solid ${c.color}33`,
                  display: 'flex', alignItems: 'center', gap: 11,
                }}>
                  <div className="a-breathe" style={{ width: 30, height: 30, borderRadius: '50%', background: t.surface, border: `1px solid ${c.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <c.Icon size={14} color={c.color} stroke={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: c.color, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{c.kind}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginTop: 1 }}>{c.agent}</div>
                    <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{c.detail}</div>
                  </div>
                  <IconChevR size={14} color={t.inkFaint} stroke={2.4} />
                </div>
              ))}
            </div>
          </div>

          {/* Branch KPI 2×2 */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>This year · branch</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {[
                { eyebrow: 'YTD API',       value: 'TTD 8.42M', sub: '70% of goal', accent: t.teal, progress: 70 },
                { eyebrow: 'APPS',          value: '612',       sub: '+22% LY',     accent: t.gold },
                { eyebrow: 'AGENTS',        value: '28',        sub: '6 on MDRT',   accent: t.teal },
                { eyebrow: 'COMPLIANCE',    value: '92%',       sub: '26 of 28',    accent: t.success },
              ].map((k, i) => (
                <div key={i} style={{
                  padding: '12px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11,
                }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: k.accent, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{k.eyebrow}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 6 }}>{k.value}</div>
                  <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 4 }}>{k.sub}</div>
                  {k.progress !== undefined && (
                    <div style={{ marginTop: 8, height: 4, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                      <div className="a-progress-grow" style={{ width: `${k.progress}%`, height: 4, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Top 3 this week */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>Top performers · this week</div>
            <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11, overflow: 'hidden' }}>
              {[
                { rank: 1, name: 'Marsha Singh',    unit: 'S·02', api: 24400 },
                { rank: 2, name: 'Anand Persad',    unit: 'S·01', api: 21800 },
                { rank: 3, name: 'Selina Mohammed', unit: 'S·03', api: 19200 },
              ].map((a, i, arr) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderBottom: i < arr.length - 1 ? `1px solid ${t.rule}` : 'none',
                }}>
                  <div style={{ width: 22, textAlign: 'center', fontSize: 12, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY }}>{a.rank}</div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY }}>{a.name.split(' ').map(s=>s[0]).join('')}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{a.unit}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY }}>{ttd(a.api)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MContent>
      <MNav t={t} active="home" />
    </MFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 05 · MASTERSHEET (mobile) — card list (tables don't fit mobile)
// ──────────────────────────────────────────────────────────────────────────
function MMasterSheet({ t }) {
  const agents = [
    { rank: 1, name: 'Marsha Singh',    unit: 'S·02', api: 487000, apps: 41, conv: 79, pers: 88, level: 'L4', flag: null },
    { rank: 2, name: 'Anand Persad',    unit: 'S·01', api: 442000, apps: 36, conv: 81, pers: 91, level: 'L4', flag: null },
    { rank: 3, name: 'Selina Mohammed', unit: 'S·03', api: 396000, apps: 38, conv: 71, pers: 87, level: 'L3', flag: null },
    { rank: 4, name: 'Riaz Khan',       unit: 'S·02', api: 358000, apps: 30, conv: 76, pers: 90, level: 'L3', flag: null },
    { rank: 9, name: 'Jamal Khan',      unit: 'S·03', api: 198000, apps: 18, conv: 58, pers: 82, level: 'L2', flag: 'compliance' },
    { rank: 11,name: 'Devin Lewis',     unit: 'S·02', api: 122000, apps: 12, conv: 62, pers: 76, level: 'L1', flag: 'floor' },
  ];
  const presets = ['All', 'Prod.', 'Recruit.', 'Compl.', 'Pers.'];
  const maxApi = agents[0].api;

  return (
    <MFrame t={t}>
      <MHeader t={t} title="Master Sheet" sub="WEEK 48 · 28 AGENTS" />
      <MContent headerHeight={140}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
          {/* Presets scrollable row */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
            {presets.map((p, i) => (
              <div key={p} style={{
                flex: 1, padding: '6px 8px', borderRadius: 7,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.005em',
                background: i === 1 ? t.surface : 'transparent',
                color: i === 1 ? t.ink : t.inkMute,
                boxShadow: i === 1 ? `0 1px 2px rgba(0,0,0,0.04)` : 'none',
                border: i === 1 ? `1px solid ${t.rule}` : 'none',
                textAlign: 'center',
              }}>{p}</div>
            ))}
          </div>

          {/* Exceptions toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 12px', background: t.warningTint, border: `1px solid ${t.warning}44`, borderRadius: 9,
          }}>
            <div style={{ width: 28, height: 16, background: t.warning, borderRadius: 999, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: '50%', background: t.surface }}></div>
            </div>
            <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: t.warning, letterSpacing: '0.04em' }}>Show only exceptions</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO }}>3</div>
          </div>

          {/* Agent cards */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {agents.map(a => {
              const persColor = a.pers >= 90 ? t.success : a.pers >= 80 ? t.ink : t.warning;
              return (
                <div key={a.rank} style={{
                  padding: '11px 13px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, textAlign: 'center', fontSize: 11, fontWeight: 700, color: a.rank <= 3 ? t.gold : t.inkFaint, fontFamily: APP_FONT_DISPLAY }}>{a.rank}</div>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY }}>{a.name.split(' ').map(s=>s[0]).join('')}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>{a.name}</div>
                      <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{a.unit} · {a.level}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY }}>{ttd(a.api)}</div>
                      <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{a.apps} APPS</div>
                    </div>
                  </div>
                  {/* Bottom row: bar + status pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <div style={{ flex: 1, height: 3, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                      <div className="a-progress-grow" style={{ width: `${(a.api / maxApi) * 100}%`, height: 3, background: a.flag === 'floor' ? t.warning : t.teal, borderRadius: 999 }}></div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: a.conv >= 70 ? t.success : t.inkMute, fontFamily: APP_FONT_MONO }}>CI {a.conv}%</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: persColor, fontFamily: APP_FONT_MONO }}>P {a.pers}%</div>
                    {a.flag === 'floor' ? (
                      <Pill t={t} color={t.danger} bg={t.dangerTint}>FLOOR</Pill>
                    ) : a.flag === 'compliance' ? (
                      <Pill t={t} color={t.warning} bg={t.warningTint}>COMPL.</Pill>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </MContent>
      <MNav t={t} active="home" />
    </MFrame>
  );
}

Object.assign(window, {
  M_W, M_H,
  MAgentDashboard, MLookingAhead, MMoneyNeeds, MManagerDashboard, MMasterSheet,
});

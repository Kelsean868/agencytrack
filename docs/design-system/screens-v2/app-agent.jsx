// Agent-facing screens — Dashboard, Looking Ahead overview, Money Needs.

// ──────────────────────────────────────────────────────────────────────────
// AGENT DASHBOARD
// ──────────────────────────────────────────────────────────────────────────
function AgentDashboard({ t }) {
  return (
    <AppShell t={t} active="home" title="Dashboard" subtitle="Marsha Singh · Thursday 26 November 2026">
      <div style={{ height: '100%', overflowY: 'hidden', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Top — greeting + Needs Attention */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY }}>
              Hi, Marsha.
            </div>
            <div style={{ fontSize: 13, color: t.inkMute, marginTop: 4 }}>
              Five weeks to close the year. You're on MDRT pace.
            </div>
          </div>
          {/* Needs attention */}
          <div style={{
            padding: '12px 14px', background: t.warningTint, borderRadius: 11,
            border: `1px solid ${t.warning}33`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div className="a-breathe" style={{
              width: 36, height: 36, borderRadius: '50%', background: t.surface,
              border: `1px solid ${t.warning}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconAlert size={17} color={t.warning} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>Weekly report opens Sunday</div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>~5 min · last 2 minutes Mon 8:42</div>
            </div>
            <div style={{
              padding: '6px 12px', background: t.warning, color: t.surface,
              borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: APP_FONT_SANS,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Start <IconArrowR size={13} color={t.surface} stroke={2.4} />
            </div>
          </div>
        </div>

        {/* This week KPI strip */}
        <div>
          <Eyebrow t={t}>This week</Eyebrow>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <Scorecard t={t} eyebrow="API"            value="TTD 24.4K"  sub="3 apps · 2 lives"              accent={t.teal}    big />
            <Scorecard t={t} eyebrow="Applications"   value="3"          sub="2 NB · 1 PPP"                  accent={t.gold} />
            <Scorecard t={t} eyebrow="FFI conducted"  value="4"          sub="80% of weekly standard"        accent={t.teal} />
            <Scorecard t={t} eyebrow="CI conducted"   value="2"          sub="100% closing rate"             accent={t.success} />
          </div>
        </div>

        {/* Looking Ahead widget + Recent + Awards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, flex: 1, minHeight: 0 }}>
          {/* Looking Ahead big card */}
          <div style={{
            padding: '20px 22px', background: t.surface, border: `1px solid ${t.rule}`,
            borderRadius: 14, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <Eyebrow t={t}>Looking Ahead · 2026</Eyebrow>
              <div style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO }}>5 weeks to year-end</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.15 }}>
              TTD 113K to close the year on goal.
            </div>
            <div style={{ fontSize: 13, color: t.inkMute, marginTop: 6 }}>
              Two more applications puts you in Level 4 territory.
            </div>
            {/* Mini progress bar */}
            <div style={{ marginTop: 16, marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: t.inkMute, marginBottom: 6, fontFamily: APP_FONT_MONO }}>
                <span>TTD 487K · 81%</span>
                <span>Goal · TTD 600K</span>
              </div>
              <div style={{ height: 6, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                <div className="a-progress-grow" style={{ width: '81%', height: 6, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
              </div>
            </div>
            <div style={{ flex: 1 }}></div>
            {/* Next steps */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <div style={{
                flex: 1, padding: '10px 12px', background: t.surfaceSoft, borderRadius: 9,
                border: `1px solid ${t.rule}`,
              }}>
                <div style={{ fontSize: 9.5, color: t.inkFaint, fontWeight: 700, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>STEP 1 · DONE</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.ink, marginTop: 4 }}>Money Needs</div>
              </div>
              <div style={{
                flex: 1, padding: '10px 12px', background: t.tealTint, borderRadius: 9,
                border: `1px solid ${t.teal}44`,
              }}>
                <div style={{ fontSize: 9.5, color: t.teal, fontWeight: 700, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>STEP 2 · NOW</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.ink, marginTop: 4 }}>Year Plan</div>
              </div>
              <div style={{
                flex: 1, padding: '10px 12px', background: t.surfaceSoft, borderRadius: 9,
                border: `1px solid ${t.rule}`,
              }}>
                <div style={{ fontSize: 9.5, color: t.inkFaint, fontWeight: 700, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>STEP 3</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.inkMute, marginTop: 4 }}>Monthly Plan</div>
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div style={{
            padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`,
            borderRadius: 14, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <Eyebrow t={t}>Recent</Eyebrow>
              <div style={{ fontSize: 11, color: t.teal, fontWeight: 700 }}>View all</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              {[
                { color: t.success,   Icon: IconCheck, text: 'Weekly report submitted',     sub: 'Mon 24 Nov · TTD 21.8K API' },
                { color: t.gold,      Icon: IconMedal, text: 'Eagles Club pacer milestone', sub: '68% to goal · keep pushing' },
                { color: t.teal,      Icon: IconBolt,  text: '12-week streak',              sub: 'You\u2019ve submitted every week' },
                { color: t.inkAccent, Icon: IconShield,text: 'Promoted to Senior Associate',sub: '14 Mar 2026' },
              ].map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: `${a.color}22`, color: a.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <a.Icon size={15} color={a.color} stroke={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{a.text}</div>
                    <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{a.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// LOOKING AHEAD — wizard overview / home
// ──────────────────────────────────────────────────────────────────────────
function LookingAhead({ t }) {
  const steps = [
    { n: 1, label: 'Money Needs',    state: 'done' },
    { n: 2, label: 'Year Plan',      state: 'active' },
    { n: 3, label: 'Monthly Plan',   state: 'pending' },
    { n: 4, label: 'Self-Improvement', state: 'pending' },
    { n: 5, label: 'Review & Track', state: 'pending' },
  ];
  return (
    <AppShell t={t} active="lookahead" title="Looking Ahead 2026" subtitle="Plan your income, activities, and growth for the year.">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Header + commission gap pill */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <Eyebrow t={t} color={t.gold}>★ Annual planning · 2026</Eyebrow>
            <div style={{ fontSize: 32, fontWeight: 700, color: t.ink, letterSpacing: '-0.025em', fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>
              Plan the year ahead.
            </div>
          </div>
          <div style={{
            padding: '10px 16px', background: t.tealTint, border: `1px solid ${t.teal}33`,
            borderRadius: 11, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>COMMISSION GAP</div>
            <div style={{ width: 1, height: 16, background: t.teal, opacity: 0.3 }}></div>
            <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY }}>TTD 487,000</div>
          </div>
        </div>

        {/* Stepper */}
        <div style={{
          padding: '16px 18px', background: t.surface, border: `1px solid ${t.rule}`,
          borderRadius: 12, display: 'flex', alignItems: 'center', gap: 0, position: 'relative',
        }}>
          {steps.map((s, i) => {
            const isActive = s.state === 'active';
            const isDone   = s.state === 'done';
            return (
              <React.Fragment key={s.n}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: i === steps.length - 1 ? '0 0 auto' : '1 1 auto' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: isActive ? t.teal : isDone ? t.success : t.surfaceMute,
                    color: (isActive || isDone) ? t.surface : t.inkMute,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY,
                    flexShrink: 0,
                    border: isActive ? `2px solid ${t.surface}` : 'none',
                    boxShadow: isActive ? `0 0 0 2px ${t.teal}, 0 2px 8px ${t.teal}33` : 'none',
                  }}>
                    {isDone ? <IconCheck size={15} color={t.surface} stroke={2.6} /> : s.n}
                  </div>
                  <div>
                    <div style={{
                      fontSize: 12.5, fontWeight: 700,
                      color: isActive ? t.teal : isDone ? t.ink : t.inkMute,
                      letterSpacing: '-0.005em',
                    }}>{s.label}</div>
                    <div style={{
                      fontSize: 9.5, color: t.inkFaint, marginTop: 1,
                      letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO,
                    }}>{isDone ? 'Complete' : isActive ? 'Current' : 'Pending'}</div>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: isDone ? t.success : t.rule, margin: '0 16px' }}></div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Two-column overview */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 18, flex: 1, minHeight: 0 }}>

          {/* Left — process bullets */}
          <div style={{ padding: '22px 24px' }}>
            <Eyebrow t={t} color={t.inkMute}>The journey</Eyebrow>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, letterSpacing: '-0.012em', fontFamily: APP_FONT_DISPLAY, marginTop: 8 }}>
              Five steps from income target to weekly action.
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                'Estimate how much income you need to cover your lifestyle and business.',
                'Split that target across Life, A&H, Property, Motor.',
                'Turn yearly targets into monthly and weekly activity goals.',
                'Track progress every week and adjust as life changes.',
              ].map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: t.tealTint, color: t.teal,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY,
                    flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ fontSize: 13.5, color: t.ink, lineHeight: 1.55, paddingTop: 1 }}>{line}</div>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 22, padding: '12px 14px', background: t.surfaceSoft,
              border: `1px solid ${t.rule}`, borderRadius: 10,
              fontSize: 12, color: t.inkMute, lineHeight: 1.55,
            }}>
              <span style={{ color: t.ink, fontWeight: 600 }}>For your personal planning.</span>
              {' '}Not for client planning — Looking Ahead is your agency-side income roadmap, not a CRM.
            </div>
          </div>

          {/* Right — current step card */}
          <div style={{
            padding: '24px 26px', background: t.surface, border: `1px solid ${t.teal}44`,
            borderRadius: 14, boxShadow: `0 0 0 1px ${t.tealTint}, 0 8px 24px ${t.teal}11`,
            display: 'flex', flexDirection: 'column',
          }}>
            <Eyebrow t={t}>Step 2 · Year Plan</Eyebrow>
            <div style={{ fontSize: 26, fontWeight: 700, color: t.ink, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY, marginTop: 8, lineHeight: 1.12 }}>
              Split your TTD 487K commission target across the four lines.
            </div>
            <div style={{ fontSize: 13.5, color: t.inkMute, marginTop: 10, lineHeight: 1.55 }}>
              You'll set a percentage share for Life, A&H, Property and Motor. The tool then computes API targets, cases needed, and suggested weekly appointments per line.
            </div>

            {/* Line preview */}
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { line: 'Life', share: 60, color: t.teal },
                { line: 'A&H',  share: 20, color: t.gold },
                { line: 'Property', share: 10, color: t.success },
                { line: 'Motor',    share: 10, color: t.inkAccent },
              ].map(l => (
                <div key={l.line} style={{
                  padding: '10px 12px', background: t.surfaceSoft, borderRadius: 9,
                  border: `1px solid ${t.rule}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }}></div>
                  <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{l.line}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: l.color, fontFamily: APP_FONT_MONO }}>{l.share}%</div>
                </div>
              ))}
            </div>

            <div style={{ flex: 1 }}></div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <div style={{
                padding: '11px 18px', background: t.teal, color: t.surface,
                borderRadius: 10, fontSize: 13, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: `0 2px 6px ${t.teal}44`,
              }}>
                Open Year Plan <IconArrowR size={14} color={t.surface} stroke={2.4} />
              </div>
              <div style={{
                padding: '11px 18px', background: t.surface, border: `1px solid ${t.rule}`,
                color: t.inkMute, borderRadius: 10, fontSize: 13, fontWeight: 700,
              }}>Skip for now</div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MONEY NEEDS
// ──────────────────────────────────────────────────────────────────────────
function MoneyNeeds({ t }) {
  return (
    <AppShell t={t} active="money" title="Money Needs" subtitle="Step 1 · Looking Ahead 2026 — personal income planning, not client analysis.">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* 3-card summary strip */}
        <div style={{ display: 'flex', gap: 14 }}>
          <Scorecard t={t} eyebrow="TOTAL NEEDED · 2026" value="TTD 720K" sub="Lifestyle + business + savings" accent={t.ink} big />
          <Scorecard t={t} eyebrow="COVERED BY PAYE" value="TTD 233K" sub="Salary and other steady income" accent={t.success} big />
          <div style={{
            flex: 1, padding: '14px 16px',
            background: t.warningTint, border: `1px solid ${t.warning}44`, borderRadius: 11,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.warning, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>COMMISSION GAP · YOUR TARGET</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: t.warning, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 8 }}>TTD 487K</div>
            <div style={{ fontSize: 11, color: t.ink, marginTop: 5 }}>This becomes your annual commission target</div>
          </div>
        </div>

        {/* Two-column body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18, flex: 1, minHeight: 0 }}>

          {/* Left — expense accordions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
            <Eyebrow t={t}>Expense categories</Eyebrow>

            {/* Fixed Household — expanded */}
            <div style={{ background: t.surface, border: `1px solid ${t.teal}33`, borderRadius: 11, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${t.rule}` }}>
                <IconChevD size={15} color={t.teal} stroke={2.4} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>Fixed Household</div>
                  <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>Rent, utilities, school fees, groceries</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em' }}>TTD 24,800<span style={{ color: t.inkMute, fontWeight: 500, fontSize: 11, marginLeft: 4 }}>/mo</span></div>
              </div>
              <div style={{ padding: '8px 16px 14px' }}>
                {[
                  { label: 'Rent / mortgage', value: '12,500' },
                  { label: 'Groceries', value: '4,200' },
                  { label: 'Utilities (light, water, internet)', value: '2,800' },
                  { label: 'School fees', value: '3,800' },
                  { label: 'Insurance (vehicle, home)', value: '1,500' },
                ].map((line, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: i < arr.length - 1 ? `1px solid ${t.rule}` : 'none',
                  }}>
                    <div style={{ fontSize: 12.5, color: t.ink }}>{line.label}</div>
                    <div style={{
                      padding: '4px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`,
                      borderRadius: 7, fontSize: 12, fontWeight: 600, color: t.ink, fontFamily: APP_FONT_MONO,
                    }}>TTD {line.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lifestyle — collapsed */}
            {[
              { label: 'Lifestyle & Family',  sub: 'Entertainment, vacations, hobbies', value: 'TTD 6,400' },
              { label: 'Business Expenses',   sub: 'Fuel, parking, marketing, licenses', value: 'TTD 4,200' },
              { label: 'Savings & Debt',      sub: 'Loan repayments, emergency fund',    value: 'TTD 8,600' },
            ].map((c, i) => (
              <div key={i} style={{
                padding: '14px 16px', background: t.surface, border: `1px solid ${t.rule}`,
                borderRadius: 11, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              }}>
                <IconChevR size={15} color={t.inkMute} stroke={2.4} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{c.sub}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em' }}>{c.value}<span style={{ color: t.inkMute, fontWeight: 500, fontSize: 11, marginLeft: 4 }}>/mo</span></div>
              </div>
            ))}
          </div>

          {/* Right — Your Plan sticky card */}
          <div style={{
            padding: '20px 22px', background: t.surface, border: `1px solid ${t.rule}`,
            borderRadius: 14, display: 'flex', flexDirection: 'column',
          }}>
            <Eyebrow t={t}>Your Plan · 2026</Eyebrow>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Total monthly',  value: 'TTD 44,000' },
                { label: 'Annual expenses', value: 'TTD 528K' },
                { label: 'Savings & growth', value: 'TTD 192K' },
              ].map((line, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 12, color: t.inkMute, letterSpacing: '0.04em' }}>{line.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{line.value}</div>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: t.rule, margin: '16px 0' }}></div>

            <div style={{
              padding: '14px 14px', background: t.tealTint, borderRadius: 10,
              border: `1px solid ${t.teal}44`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>NET COMMISSION GAP</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: t.teal, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 6 }}>TTD 487K</div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 5, lineHeight: 1.5 }}>
                After PAYE coverage. This is what you need in commissions for the year.
              </div>
            </div>

            <div style={{ flex: 1 }}></div>

            <div style={{
              marginTop: 18, padding: '12px 16px', background: t.teal, color: t.surface,
              borderRadius: 10, fontSize: 13, fontWeight: 700, textAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: `0 2px 6px ${t.teal}44`,
            }}>
              Send to Year Plan <IconArrowR size={14} color={t.surface} stroke={2.4} />
            </div>
            <div style={{
              marginTop: 8, fontSize: 11.5, color: t.inkMute, textAlign: 'center',
              textDecoration: 'underline', textDecorationColor: t.inkDim,
            }}>Adjust commission assumptions</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

Object.assign(window, { AgentDashboard, LookingAhead, MoneyNeeds });

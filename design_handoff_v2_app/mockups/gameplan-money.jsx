// Game Plan v2 — Money Needs (step 1), rebuilt as a PRE-SEEDED CHECKLIST.
//
// The source worksheet ships ~34 standard budget line items across 5 groups
// plus 3 detail calculators. Agents shouldn't have to remember them — so we
// pre-fill the familiar names and the agent just types amounts (or clears
// what doesn't apply). Every row: name · amount · how-paid (freq) · annualized.
//
// Summary chain mirrors the worksheet exactly:
//   After-Tax total → + PAYE → Pre-Tax → − Renewal income → 1st-Year
//   Commissions Required → Commission Targets by line (→ Year Plan).

// ── How-paid pill (looks like a select) ─────────────────────────────────────
function FreqPill({ t, freq }) {
  const short = { M: 'Monthly', Q: 'Quarterly', S: 'Semi-Ann', A: 'Annually' }[freq];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px',
      background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 7,
      fontSize: 10.5, fontWeight: 600, color: t.inkMute, fontFamily: APP_FONT_SANS, whiteSpace: 'nowrap',
    }}>
      {short}
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke={t.inkFaint} strokeWidth="1.8" strokeLinecap="round"><path d="M2 4l4 4 4-4" /></svg>
    </div>
  );
}

// ── One budget line: name · amount field · freq · annualized ────────────────
function MoneyLineRow({ t, item, last, fresh }) {
  const amt = fresh ? 0 : (parseFloat(item.amount) || 0);
  const empty = amt === 0;
  const annual = annualize(amt, item.freq);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0', borderBottom: last ? 'none' : `1px solid ${t.rule}`,
    }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: empty ? t.inkFaint : t.ink, fontWeight: empty ? 500 : 600 }}>{item.label}</div>
      {/* amount field */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 30, width: 116,
        borderRadius: 8, border: `1px solid ${empty ? t.rule : t.ruleStrong}`,
        background: empty ? t.surfaceSoft : t.surface, overflow: 'hidden', flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: t.inkFaint, paddingLeft: 8, fontFamily: APP_FONT_MONO }}>TTD</span>
        <span style={{ flex: 1, textAlign: 'right', paddingRight: 9, fontSize: 13, fontWeight: 700, color: empty ? t.inkDim : t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em' }}>
          {empty ? '0' : pNum(amt)}
        </span>
      </div>
      <FreqPill t={t} freq={item.freq} />
      <span style={{ width: 64, textAlign: 'right', fontSize: 10.5, color: empty ? t.inkDim : t.inkMute, fontFamily: APP_FONT_MONO, flexShrink: 0 }}>
        {empty ? '—' : `${pTtd(annual)}`}
      </span>
    </div>
  );
}

// ── Expense group (accordion) ───────────────────────────────────────────────
function MoneyGroup({ t, group, expanded, fresh }) {
  const total = fresh ? 0 : groupAnnual(group.items);
  const filled = fresh ? 0 : filledCount(group.items);
  const c = toneColor(t, group.tone);
  return (
    <div className="a-card" style={{ flexShrink: 0, background: t.surface, border: `1px solid ${expanded ? c + '44' : t.rule}`, borderRadius: 11, overflow: 'hidden' }}>
      <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: expanded ? `1px solid ${t.rule}` : 'none' }}>
        {expanded ? <IconChevD size={14} color={c} stroke={2.4} /> : <IconChevR size={14} color={t.inkMute} stroke={2.4} />}
        <div style={{ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }}></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{group.label}</div>
        </div>
        <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em', marginRight: 4 }}>
          {filled}/{group.items.length} filled
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{fresh ? '—' : pTtd(total)}<span style={{ color: t.inkMute, fontWeight: 500, fontSize: 10, marginLeft: 4 }}>/yr</span></div>
      </div>
      {expanded && (
        <div style={{ padding: '2px 14px 12px' }}>
          {/* column header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0 2px' }}>
            <div style={{ flex: 1, fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>ITEM</div>
            <div style={{ width: 116, textAlign: 'center', fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>AMOUNT</div>
            <div style={{ width: 78, textAlign: 'center', fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>HOW PAID</div>
            <div style={{ width: 64, textAlign: 'right', fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>ANNUAL</div>
          </div>
          {group.items.map((item, i) => (
            <MoneyLineRow key={i} t={t} item={item} fresh={fresh} last={false} />
          ))}
          {/* add your own */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, padding: '6px 10px', border: `1px dashed ${t.ruleStrong}`, borderRadius: 8, color: t.inkMute, fontSize: 11, fontWeight: 700, alignSelf: 'flex-start', width: 'fit-content' }}>
            <IconPlus size={12} color={t.inkMute} stroke={2.4} /> Add your own item
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detail calculator row (collapsed by default; pre-seeded items inside) ───
function SubCalcRow({ t, calc, expanded, fresh }) {
  const total = fresh ? 0 : groupAnnual(calc.items);
  return (
    <div className="a-card" style={{ flexShrink: 0, background: t.surface, border: `1px solid ${expanded ? t.inkAccent + '44' : t.rule}`, borderRadius: 11, overflow: 'hidden' }}>
      <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {expanded ? <IconChevD size={14} color={t.inkAccent} stroke={2.4} /> : <IconChevR size={14} color={t.inkMute} stroke={2.4} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>{calc.label}</div>
          <div style={{ fontSize: 9.5, color: t.inkFaint, marginTop: 1, fontFamily: APP_FONT_MONO }}>
            {calc.items.length} items{calc.rollsInto ? ` · rolls into ${calc.rollsInto}` : calc.split ? ` · ${calc.split}` : ''}
          </div>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{fresh ? '—' : pTtd(total)}<span style={{ color: t.inkMute, fontWeight: 500, fontSize: 10, marginLeft: 4 }}>/yr</span></div>
      </div>
      {expanded && (
        <div style={{ padding: '2px 14px 12px', borderTop: `1px solid ${t.rule}` }}>
          {calc.items.map((item, i, arr) => (
            <MoneyLineRow key={i} t={t} item={item} fresh={fresh} last={i === arr.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── The page ────────────────────────────────────────────────────────────────
function MoneyNeedsPage({ t, data, mobile = false, fresh = false }) {
  const m = data.money;
  const afterTax = fresh ? 0 : m.groups.reduce((s, g) => s + groupAnnual(g.items), 0);
  const paye = fresh ? 0 : m.paye;
  const gross = afterTax + paye;
  const renewals = fresh ? 0 : m.renewalLines.reduce((s, r) => s + r.amount, 0);
  const commNeed = Math.max(0, gross - renewals);
  const totalItems = m.groups.reduce((s, g) => s + g.items.length, 0);
  const totalFilled = fresh ? 0 : m.groups.reduce((s, g) => s + filledCount(g.items), 0);
  const targetsTotal = m.commissionTargets.reduce((s, x) => s + x.amount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Helper banner — the "we pre-filled it" promise */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 15px', flexShrink: 0,
        background: t.tealTint, border: `1px solid ${t.teal}33`, borderRadius: 11,
      }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: t.surface, border: `1px solid ${t.teal}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconCheck size={15} color={t.teal} stroke={2.4} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>
            {fresh ? 'Start from the standard checklist — nothing to remember.' : "We pre-filled the items most agents have. Just edit the amounts."}
          </div>
          <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2 }}>
            {totalItems} standard line items across 5 groups + 3 detail calculators. Clear anything that doesn’t apply, or add your own.
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.1em' }}>FILLED</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.teal, fontFamily: APP_FONT_DISPLAY, marginTop: 2 }}>{totalFilled}/{totalItems}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: 16, alignItems: 'flex-start' }}>
        {/* Groups + detail calculators */}
        <div style={{ flex: mobile ? undefined : 1.55, minWidth: 0, width: mobile ? '100%' : undefined, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {m.groups.map((g, gi) => (
            <MoneyGroup key={g.key} t={t} group={g} expanded={gi === 0} fresh={fresh} />
          ))}

          <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, marginTop: 6, marginBottom: 1 }}>DETAIL CALCULATORS · OPTIONAL</div>
          {m.subCalcs.map((calc, ci) => (
            <SubCalcRow key={calc.key} t={t} calc={calc} expanded={!mobile && ci === 0} fresh={fresh} />
          ))}
        </div>

        {/* Summary chain + targets */}
        <div style={{ flex: mobile ? undefined : 1, minWidth: 0, width: mobile ? '100%' : undefined, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Chain */}
          <div className="a-card" style={{ flexShrink: 0, padding: '16px 18px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13 }}>
            <Eyebrow t={t} color={t.teal}>YOUR NUMBER, STEP BY STEP</Eyebrow>
            <div style={{ marginTop: 12 }}>
              {[
                { label: 'Total after-tax need',        value: fresh ? '—' : pTtd(afterTax) },
                { label: '+ Estimated PAYE tax',        value: fresh ? '—' : pTtd(paye), mute: true },
                { label: 'Total pre-tax requirement',   value: fresh ? '—' : pTtd(gross), strong: true },
                { label: '− Renewal income',            value: fresh ? '—' : pTtd(renewals), mute: true },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${t.rule}` }}>
                  <span style={{ fontSize: 12, color: r.strong ? t.ink : t.inkMute, fontWeight: r.strong ? 700 : 500 }}>{r.label}</span>
                  <span style={{ fontSize: r.strong ? 14 : 12.5, fontWeight: 700, color: r.mute ? t.inkMute : t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em' }}>{r.value}</span>
                </div>
              ))}
            </div>
            {/* renewal sub-lines */}
            {!fresh && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {m.renewalLines.map((r) => (
                  <span key={r.label} style={{ fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO, padding: '2px 7px', background: t.surfaceSoft, borderRadius: 6, border: `1px solid ${t.rule}` }}>
                    {r.label} {pK(r.amount)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Required commissions */}
          <div className="a-card" style={{ flexShrink: 0, padding: '16px 18px', background: t.surface, border: `1px solid ${t.gold}55`, borderRadius: 13, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 130, height: 130, background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
            <Eyebrow t={t} color={t.gold}>1ST-YEAR COMMISSIONS REQUIRED</Eyebrow>
            <div style={{ fontSize: 32, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.028em', lineHeight: 1, marginTop: 8 }}>{fresh ? 'TTD —' : pTtd(commNeed)}</div>
            {/* targets by line */}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>TARGETS BY LINE → YEAR PLAN</div>
              {m.commissionTargets.map((x) => (
                <div key={x.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, color: t.ink }}>{x.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{fresh ? '—' : pTtd(x.amount)}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: '11px 16px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 12px ${t.teal}44` }}>
              Send to Year Plan <IconArrowR size={14} color="#fff" stroke={2.4} />
            </div>
          </div>

          {/* Share toggle */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
            <div style={{ width: 32, height: 18, background: m.shared ? t.teal : t.surfaceMute, borderRadius: 999, position: 'relative', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, [m.shared ? 'right' : 'left']: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff' }}></div>
            </div>
            <div style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: t.ink }}>Share with my Unit & Branch Manager</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MoneyNeedsPage, MoneyGroup, MoneyLineRow, SubCalcRow, FreqPill });

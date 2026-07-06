// Set-up Wizard — step screens, part B: Money Needs + Game Plan (condensed,
// each framing the live tool; Money Needs carries the condensed↔full toggle for Q1).

function MiniNumber({ label, hint, value, onChange, prefix = 'TTD', step = 1000 }) {
  return (
    <div className="field">
      <label className="fl">{label}{hint && <span className="req">{hint}</span>}</label>
      <div className="input big">
        <span className="in-prefix">{prefix}</span>
        <input type="number" value={value} step={step} min={0} inputMode="numeric"
          onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))} aria-label={label} />
      </div>
    </div>
  );
}

/* ─────────────────────────── MONEY NEEDS (condensed) ─────────────────────────── */
function MoneyNeedsStep({ data, set, calc, device, mnView, setMnView }) {
  const need = calc.needAnnual;
  return (
    <div className="step-pad">
      <StepIntro icon="wallet" eyebrow="Your plan · 1 of 3" title="What do you need to earn?"
        sub="The quick version of Money Needs — the figure your year has to cover. Refine it line-by-line in the full tool whenever you like." />

      <div className="framepick">
        <span className="fp-k">Onboarding view</span>
        <div className="seg">
          <button className={'seg-b ' + (mnView === 'condensed' ? 'on' : '')} onClick={() => setMnView('condensed')}>Condensed<span className="rec">recommended</span></button>
          <button className={'seg-b ' + (mnView === 'full' ? 'on' : '')} onClick={() => setMnView('full')}>Full panel</button>
        </div>
        <span className="fp-note">{mnView === 'condensed'
          ? 'Lighter, faster — three inputs to a number. The escape hatch covers depth.'
          : 'The whole live panel, dropped in. Consistent, but heavier for a brand-new user.'}</span>
      </div>

      {mnView === 'condensed' ? (
        <div className={'mn-cond ' + (device === 'mobile' ? 'stack' : '')}>
          <div className="mn-fields">
            <MiniNumber label="Monthly living costs" hint="rent, bills, family" value={data.expenses} onChange={(v) => set({ expenses: v })} />
            <MiniNumber label="Annual savings + goals" hint="what you want to put away" value={data.savings} onChange={(v) => set({ savings: v })} />
            <MiniNumber label="Other income" hint="offsets the need" value={data.otherIncome} onChange={(v) => set({ otherIncome: v })} />
          </div>
          <div className="mn-out">
            <div className="mn-out-k">Commission you need this year</div>
            <div className="mn-out-v">{ttd(need)}</div>
            <div className="mn-out-f">= (monthly costs × 12) + savings − other income</div>
            <div className="mn-hatch"><Icon name="arrowRight" size={14} />Open the full Money Needs tool anytime to break this down by category.</div>
          </div>
        </div>
      ) : (
        <div className="mn-full">
          <div className="mnf-head"><Icon name="layers" size={14} />Full Money Needs panel (live component, dropped into the step)</div>
          <div className="mnf-grid">
            {['Housing', 'Utilities', 'Food & household', 'Transport', 'Family & education', 'Insurance & health', 'Debt & loans', 'Savings target', 'Discretionary', 'Annual lump sums', 'Existing income', 'Tax provision'].map((c) => (
              <div className="mnf-row" key={c}><span className="mnf-l">{c}</span><span className="mnf-i">TTD <i>—</i></span></div>
            ))}
          </div>
          <div className="mnf-foot"><span>12+ line items · monthly/annual toggles · category breakdowns</span><span className="mnf-total">Need {ttd(need)}</span></div>
          <div className="mn-hatch warn"><Icon name="alert" size={14} />Heavier first-run surface — more fields than a new user needs to get moving. Shown here so the tradeoff is visible.</div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── GAME PLAN (condensed) ─────────────────────────── */
function GamePlanStep({ data, set, calc, device }) {
  const { apiCommit } = data;
  const apps = Math.round(apiCommit / AVG_POLICY);
  const income = Math.round(apiCommit * BLENDED_RATE);
  const seed = calc.seedAPI;
  const tier = [...AWARD_TIERS].reverse().find((t) => apiCommit >= t.api);
  const next = AWARD_TIERS.find((t) => t.api > apiCommit);
  const min = 100000, max = 1500000;
  const pct = ((apiCommit - min) / (max - min)) * 100;

  return (
    <div className="step-pad">
      <StepIntro icon="target" eyebrow="Your plan · 2 of 3" title="Turn that into a production goal"
        sub="Game Plan in one move: how much API you'll write to earn it. We seed from your Money Needs — adjust, then commit. The per-line and monthly breakdown live in the full Game Plan." />

      <div className="seedline"><Icon name="info" size={14} />To earn <b>{ttd(calc.needAnnual)}</b> you'll write about <b>{ttd(seed)}</b> in API at your <b>50% blended rate</b>. That's your starting point.</div>

      <div className={'gp-wrap ' + (device === 'mobile' ? 'stack' : '')}>
        <div className="gp-slider-card">
          <div className="gp-sl-top"><span className="gp-sl-k">Annual API you'll commit to</span><span className="gp-sl-v">{ttd(apiCommit)}</span></div>
          <input className="range" type="range" min={min} max={max} step={10000} value={apiCommit}
            onChange={(e) => set({ apiCommit: parseInt(e.target.value, 10) })} aria-label="Annual API commitment" />
          <div className="gp-sl-scale"><span>{ttd(min)}</span><span className="seedmark" style={{ left: ((seed - min) / (max - min) * 100) + '%' }}>seed {ttd(seed)}</span><span>{ttd(max)}</span></div>
        </div>
        <div className="gp-derived">
          <div className="gp-d"><span className="gp-dk">Applications</span><span className="gp-dv">{apps}</span><span className="gp-ds">API ÷ {ttd(AVG_POLICY)} avg policy</span></div>
          <div className="gp-d"><span className="gp-dk">Est. income</span><span className="gp-dv">{ttd(income)}</span><span className="gp-ds">at 50% blended</span></div>
          <div className="gp-d award"><span className="gp-dk"><Icon name="award" size={13} />Award reach</span><span className="gp-dv sm">{tier ? tier.name : 'Below first tier'}</span><span className="gp-ds">{next ? `+${ttd(next.api - apiCommit)} to ${next.name}` : 'top tier'}</span></div>
        </div>
      </div>

      <div className="commitnote"><Icon name="check" size={14} />Continuing <b>commits this as your Personal Commitment</b> — the same value the rest of the app tracks you against. You can re-open Game Plan to change it.</div>
    </div>
  );
}

Object.assign(window, { MoneyNeedsStep, GamePlanStep, MiniNumber });

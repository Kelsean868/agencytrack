// Game Plan v2 — hub cascade visualization derivations (item 2.11).
//
// Pure, Firebase-free helpers so the segment math is unit-testable in isolation.
// They derive ENTIRELY from data the hub already loads (yearPlan.lines +
// monthlyPlan targets + submission-bucketed actuals) — no new fetch, no store.
// Design intent: gameplan-loop-handoff/mockups/gameplan-pages.jsx
// (`AllocationBar`, `MiniMonthStrip`, "Before you commit" checklist).

const num = (v) => parseFloat(v) || 0;

// The 3 canonical loop lines (yearPlanService.LINE_KEYS), each with a decoration
// tone reused by the segmented AllocationBar + its legend dots.
export const CASCADE_LINE_META = Object.freeze([
  { key: 'life',    label: 'Life',    dot: 'bg-primary' },
  { key: 'ah',      label: 'A&H',     dot: 'bg-gold'    },
  { key: 'general', label: 'General', dot: 'bg-success' },
]);

/**
 * allocationSegments — split the planned annual API across the enabled loop
 * lines. Mirrors the mockup's `AllocationBar`: one segment per funded line,
 * width = its share of the total targetAPI.
 *
 * Round-trip friendly: Σ segment.targetAPI === total (the sum of enabled,
 * funded lines) and Σ segment.pct === 100 (within float epsilon) whenever
 * total > 0. Disabled lines (`enabled === false`) and zero-API lines are
 * dropped — honest data, no zero-width segments.
 *
 * @returns {{ segments: Array<{key,label,dot,targetAPI,pct}>, total:number }}
 */
export function allocationSegments(lines, lineKeys = CASCADE_LINE_META.map((m) => m.key)) {
  const meta = Object.fromEntries(CASCADE_LINE_META.map((m) => [m.key, m]));
  const funded = lineKeys
    .map((key) => {
      const line = lines?.[key];
      const enabled = line?.enabled !== false;
      const targetAPI = enabled ? num(line?.targetAPI) : 0;
      return {
        key,
        label: meta[key]?.label ?? key,
        dot: meta[key]?.dot ?? 'bg-ink-muted',
        targetAPI,
      };
    })
    .filter((e) => e.targetAPI > 0);
  const total = funded.reduce((s, e) => s + e.targetAPI, 0);
  const segments = funded.map((e) => ({
    ...e,
    pct: total > 0 ? (e.targetAPI / total) * 100 : 0,
  }));
  return { segments, total };
}

/**
 * miniMonthBuckets — 12 buckets for the mockup's `MiniMonthStrip`. Past +
 * current months render their ACTUAL (history-bucketed); future months render
 * their TARGET. Height is a % of the max across every target/actual so the
 * tallest bar fills the strip; a 6% floor keeps a $0 month visible.
 *
 * @param {Array<number|string>} targets  monthlyPlan.targets (per-month API)
 * @param {Array<number|string>} actuals  submission actuals bucketed by month
 * @param {number} currentMonthIndex      0-based current month (TT)
 * @returns {Array<{monthIndex,kind,value,target,actual,heightPct}>} length 12
 */
export function miniMonthBuckets(targets = [], actuals = [], currentMonthIndex = 0) {
  const t = Array.from({ length: 12 }, (_, i) => num(targets[i]));
  const a = Array.from({ length: 12 }, (_, i) => num(actuals[i]));
  const max = Math.max(1, ...t, ...a);
  return t.map((tv, i) => {
    const kind = i < currentMonthIndex ? 'past' : i === currentMonthIndex ? 'current' : 'future';
    const value = kind === 'future' ? tv : a[i];
    return {
      monthIndex: i,
      kind,
      value,
      target: tv,
      actual: a[i],
      heightPct: Math.max(6, Math.min(100, (value / max) * 100)),
    };
  });
}

/**
 * commitChecklist — the mockup's "Before you commit" readiness list. Every item
 * is COMPLETION-DERIVED from the loop's step-completion flags (never stored).
 *
 * The mockup's 4th "Review with your manager" item is intentionally omitted:
 * there is no stored manager-review signal on the plan, so its done-state is not
 * honestly derivable (skip-logged in the 2.11 report).
 */
export function commitChecklist({ moneyNeedsFilled, yearPlanFilled, monthlyPlanFilled } = {}) {
  return [
    { key: 'moneyNeeds', label: 'Money Needs worksheet', done: !!moneyNeedsFilled },
    { key: 'yearPlan',   label: 'Year Plan line split',  done: !!yearPlanFilled },
    { key: 'monthly',    label: 'Monthly breakdown',     done: !!monthlyPlanFilled },
  ];
}

// Whether every readiness item is done (the commit CTA is then "ready").
export function commitReady(flags) {
  return commitChecklist(flags).every((i) => i.done);
}

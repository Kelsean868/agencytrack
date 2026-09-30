// Money needs — pieces shared by the Nexus panel (MoneyNeedsPanel) and the FR
// port (src/components/fr/money/FrMoneyNeeds*). R2-9 MOVED these here verbatim
// from MoneyNeedsPanel.jsx so both looks read one list and one build-up; no
// value, label or formula changed.

// Checklist restyle (Game Plan v2 Slice 1): each group leads with a colored
// dot, mirroring the build annotation's group key. Presentation only — no
// data-model change.
export const EXPENSE_GROUPS = [
  { key: 'fixedExpenses',       label: 'Fixed Expenses',         dot: 'bg-primary'    },
  { key: 'livingExpenses',      label: 'Living Expenses',        dot: 'bg-ink-muted'  },
  { key: 'businessExpenses',    label: 'Business Expenses',      dot: 'bg-gold'       },
  { key: 'savingsAccumulation', label: 'Savings & Accumulation', dot: 'bg-success'    },
  { key: 'miscellaneous',       label: 'Miscellaneous',          dot: 'bg-ink-faint'  },
];

export const FREQUENCY_OPTIONS = [
  { value: 'M', label: 'Monthly'    },
  { value: 'Q', label: 'Quarterly'  },
  { value: 'S', label: 'Semi-Annual'},
  { value: 'A', label: 'Annual'     },
];

/**
 * payeBuildUp — the read-only income build-up PAYESummary prints, derived from
 * existing worksheet fields only (moved out of PAYESummary unchanged).
 *
 * @param {object|null} worksheet
 * @returns {{ totalAnnualAfterTax:number, totalAnnualPreTax:number,
 *             payeGrossUp:number, renewals:number, commissionsRequired:number }}
 */
export function payeBuildUp(worksheet) {
  const { totalAnnualAfterTax = 0, totalAnnualPreTax = 0 } = worksheet ?? {};
  const payeGrossUp = Math.max(0, totalAnnualPreTax - totalAnnualAfterTax);
  const renewals = parseFloat(worksheet?.estimatedRenewalIncome?.total) || 0;
  const commissionsRequired = Math.max(0, totalAnnualPreTax - renewals);
  return { totalAnnualAfterTax, totalAnnualPreTax, payeGrossUp, renewals, commissionsRequired };
}

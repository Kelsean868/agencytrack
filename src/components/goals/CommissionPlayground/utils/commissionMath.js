// Tatil Life modal first-payment ratios.
// Annual pays full first-year commission upfront; other modes pay on the
// first client payment only (client pays 1/N of annual premium at inception).
export const FIRST_PAYMENT_RATIO = {
  annual:     1.0,
  semiAnnual: 0.5,
  quarterly:  0.25,
  monthly:    1 / 12,
};

const MODES = Object.keys(FIRST_PAYMENT_RATIO);

function weightedRatioSum(modeMix) {
  return MODES.reduce(
    (sum, mode) => sum + (modeMix[mode] ?? 0) * FIRST_PAYMENT_RATIO[mode],
    0,
  );
}

// Forward: how much commission does TotalAPI generate this month?
// commissionRate is 0–100 (percentage), e.g. 35 means 35%.
export function commissionThisMonth({ totalApi, modeMix, commissionRate }) {
  return totalApi * (commissionRate / 100) * weightedRatioSum(modeMix);
}

// Reverse: how much API must be sold to earn targetCommission this month?
export function reverseCalc({ targetCommission, modeMix, commissionRate }) {
  const C = commissionRate / 100;
  const w = weightedRatioSum(modeMix);
  if (C === 0 || w === 0) return 0;
  return targetCommission / (C * w);
}

// Per-mode breakdown of API and commission for a given totalApi.
export function modeBreakdown({ totalApi, modeMix, commissionRate }) {
  const C = commissionRate / 100;
  return MODES.map((mode) => {
    const weight = modeMix[mode] ?? 0;
    const modeApi = totalApi * weight;
    return {
      mode,
      weight,
      modeApi,
      commission: modeApi * C * FIRST_PAYMENT_RATIO[mode],
    };
  });
}

// 12-month cash-flow forecast showing when commission payments arrive.
// Assumes policies are sold and incepted in month 1.
//   Annual:     full payment month 1 only
//   Semi-annual: half in month 1, half in month 7
//   Quarterly:  quarter in months 1, 4, 7, 10
//   Monthly:    twelfth in each of months 1–12
export function cashFlowForecast({ totalApi, modeMix, commissionRate }) {
  const C = commissionRate / 100;
  const months = Array(12).fill(0);

  const a = totalApi * (modeMix.annual     ?? 0) * C;
  const s = totalApi * (modeMix.semiAnnual ?? 0) * C;
  const q = totalApi * (modeMix.quarterly  ?? 0) * C;
  const m = totalApi * (modeMix.monthly    ?? 0) * C;

  months[0] += a;

  months[0] += s * 0.5;
  months[6] += s * 0.5;

  [0, 3, 6, 9].forEach((i) => { months[i] += q * 0.25; });

  for (let i = 0; i < 12; i++) {
    months[i] += m / 12;
  }

  return months.map((amount, i) => ({ month: i + 1, amount }));
}

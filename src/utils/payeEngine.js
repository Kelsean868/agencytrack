export const DEFAULT_PAYE_CONFIG = {
  method: 'reverse-progressive-chargeable',
  currency: 'TTD',
  personalAllowance: 90000,
  chargeableBrackets: [
    { upToChargeable: 1000000, rate: 0.25 },
    { upToChargeable: null,    rate: 0.30 },
  ],
};

/**
 * Gross income → annual PAYE tax.
 * chargeable = max(0, gross − allowance); walk brackets in chargeable terms.
 */
export function computePAYE(grossIncome, config = DEFAULT_PAYE_CONFIG) {
  const gross = parseFloat(grossIncome);
  if (!isFinite(gross) || gross <= 0) return 0;

  const { personalAllowance, chargeableBrackets } = config;
  const chargeable = Math.max(0, gross - personalAllowance);

  let tax = 0;
  let prevFloor = 0;

  for (const { upToChargeable, rate } of chargeableBrackets) {
    if (upToChargeable === null) {
      tax += Math.max(0, chargeable - prevFloor) * rate;
      break;
    }
    const sliceTop = Math.min(chargeable, upToChargeable);
    if (sliceTop > prevFloor) tax += (sliceTop - prevFloor) * rate;
    prevFloor = upToChargeable;
    if (chargeable <= upToChargeable) break;
  }

  return tax;
}

/**
 * After-tax (net) income → required gross income.
 * Inverts the band walk: gross = grossAtBandFloor + (net − netAtBandFloor) / (1 − rate).
 * For net ≤ allowance: gross = net (zero tax zone).
 */
export function grossFromNet(netIncome, config = DEFAULT_PAYE_CONFIG) {
  const net = parseFloat(netIncome);
  if (!isFinite(net) || net <= 0) return 0;

  const { personalAllowance, chargeableBrackets } = config;

  if (net <= personalAllowance) return net;

  let grossAtBandFloor = personalAllowance;
  let netAtBandFloor = personalAllowance;
  let prevFloor = 0;

  for (const { upToChargeable, rate } of chargeableBrackets) {
    if (upToChargeable === null) {
      return grossAtBandFloor + (net - netAtBandFloor) / (1 - rate);
    }

    const bandWidth = upToChargeable - prevFloor;
    const netAtBandCeiling = netAtBandFloor + bandWidth * (1 - rate);
    const grossAtBandCeiling = grossAtBandFloor + bandWidth;

    if (net <= netAtBandCeiling) {
      return grossAtBandFloor + (net - netAtBandFloor) / (1 - rate);
    }

    prevFloor = upToChargeable;
    grossAtBandFloor = grossAtBandCeiling;
    netAtBandFloor = netAtBandCeiling;
  }

  return net;
}

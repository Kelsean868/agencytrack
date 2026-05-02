const METRIC_DEFS = [
  { metric: 'api',          label: 'API',   isCurrency: true,  required: true  },
  { metric: 'apps',         label: 'Apps',  isCurrency: false, required: true  },
  { metric: 'ffiConducted', label: 'FFIs',  isCurrency: false, required: false },
  { metric: 'ciConducted',  label: 'CIs',   isCurrency: false, required: false },
  { metric: 'dials',        label: 'Dials', isCurrency: false, required: false },
];

function safe(v) { return typeof v === 'number' && v > 0 ? v : null; }

function gap(actual, target) {
  if (target === null) return null;
  return target - actual;
}

function pct(actual, target) {
  if (!target || target <= 0) return null;
  return Math.min(100, Math.round((actual / target) * 100));
}

/**
 * computeGapAnalysis(hierarchy, ytdTotals)
 *
 * hierarchy: { companyFloor, branchTarget, unitTarget, personal }
 * ytdTotals: { api, apps, ffiConducted, ciConducted, dials }
 */
export function computeGapAnalysis(hierarchy, ytdTotals) {
  if (!hierarchy) return [];
  const { companyFloor, branchTarget, unitTarget, personal } = hierarchy;
  const totals = ytdTotals ?? {};

  return METRIC_DEFS
    .filter(({ metric, required }) => {
      if (required) return true;
      // Only include optional metrics if at least one level has a non-null target
      return (
        safe(personal?.[metric])      !== null ||
        safe(unitTarget?.[metric])    !== null ||
        safe(branchTarget?.[metric])  !== null ||
        safe(companyFloor?.[metric])  !== null
      );
    })
    .map(({ metric, label, isCurrency }) => {
      const actual      = parseFloat(totals[metric]) || 0;
      const personalVal = safe(personal?.[metric]);
      const unitVal     = safe(unitTarget?.[metric]);
      const branchVal   = safe(branchTarget?.[metric]);
      const floorVal    = safe(companyFloor?.[metric]);

      return {
        metric,
        label,
        isCurrency,
        actual,
        personal:     personalVal,
        unitTarget:   unitVal,
        branchTarget: branchVal,
        companyFloor: floorVal,
        gaps: {
          toPersonal: gap(actual, personalVal),
          toUnit:     gap(actual, unitVal),
          toBranch:   gap(actual, branchVal),
          toFloor:    gap(actual, floorVal),
        },
        pcts: {
          ofPersonal: pct(actual, personalVal),
          ofUnit:     pct(actual, unitVal),
          ofBranch:   pct(actual, branchVal),
          ofFloor:    pct(actual, floorVal),
        },
      };
    });
}

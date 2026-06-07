/**
 * Track J — Agent Awards v2 grouping logic.
 *
 * Pure function shared between the agent + manager panels. Split from
 * awardPrimitives.jsx because `react-refresh/only-export-components` requires
 * JSX modules to export components only.
 */

export function groupByProgress(awards = []) {
  const qualified    = awards.filter((a) => a.eligible);
  const inContention = awards.filter((a) => !a.eligible && a.inContention);
  const notYet       = awards.filter((a) => !a.eligible && !a.inContention);

  const almostThere = inContention.filter((a) => a.progressPercent >= 70);
  const makingProgress = inContention
    .filter((a) => a.progressPercent >= 30 && a.progressPercent < 70)
    .concat(notYet.filter((a) => a.progressPercent >= 30));
  const justStarting = notYet.filter((a) => a.progressPercent < 30);

  const hero = inContention
    .slice()
    .sort((a, b) => b.progressPercent - a.progressPercent)[0] ?? null;

  return { hero, qualified, almostThere, makingProgress, justStarting };
}

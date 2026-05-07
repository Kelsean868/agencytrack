const CIRCUMFERENCE = 2 * Math.PI * 42;

export default function GoalDonut({ percent = 0, period = 'goal' }) {
  const safePercent = Math.max(0, percent);
  const visualPercent = Math.min(safePercent, 100);
  const offset = CIRCUMFERENCE * (1 - visualPercent / 100);
  const displayPercent = Math.round(safePercent);

  return (
    <svg
      className="hero-donut"
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${displayPercent}% of ${period} goal`}
    >
      <circle className="donut-bg" cx="50" cy="50" r="42" />
      <circle
        className="donut-fg"
        cx="50"
        cy="50"
        r="42"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
      />
      <text
        x="50"
        y="52"
        textAnchor="middle"
        fontSize="22"
        dominantBaseline="middle"
        aria-hidden="true"
      >
        {displayPercent}%
      </text>
    </svg>
  );
}

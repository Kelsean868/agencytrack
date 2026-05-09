import { rebalance } from '../utils/modeMixBalancer';

const MODE_LABELS = {
  annual:     'Annual',
  semiAnnual: 'Semi-Annual',
  quarterly:  'Quarterly',
  monthly:    'Monthly',
};

export default function ModeMixSlider({ modeMix, onChange }) {
  const handleChange = (mode, rawPct) => {
    onChange(rebalance(modeMix, mode, parseFloat(rawPct) / 100));
  };

  return (
    <div className="flex flex-col gap-3">
      {Object.keys(MODE_LABELS).map((mode) => {
        const pct = Math.round((modeMix[mode] ?? 0) * 100);
        return (
          <div key={mode} className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label className="text-xs text-ink-muted">{MODE_LABELS[mode]}</label>
              <span className="text-xs font-semibold text-ink tabular-nums w-8 text-right">{pct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={pct}
              onChange={(e) => handleChange(mode, e.target.value)}
              className="w-full h-2 accent-primary"
              aria-label={`${MODE_LABELS[mode]} mix percentage`}
            />
          </div>
        );
      })}
      <p className="text-[11px] text-ink-muted">Sliders auto-balance to 100%</p>
    </div>
  );
}

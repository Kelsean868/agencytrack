export default function NumericField({ label, name, value, onChange, min = 0, max, help }) {
  const handleInput = (e) => {
    const v = parseInt(e.target.value, 10);
    onChange(name, isNaN(v) ? 0 : Math.max(min, v));
  };

  const decrement = () => onChange(name, Math.max(min, (value ?? 0) - 1));
  const increment = () => {
    const next = (value ?? 0) + 1;
    onChange(name, max != null ? Math.min(max, next) : next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">{label}</label>
      {help && <p className="text-xs text-ink-muted -mt-0.5">{help}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={decrement}
          className="w-11 h-11 rounded-lg border border-border bg-white text-ink text-xl font-bold flex items-center justify-center hover:bg-surface active:scale-95 transition-transform"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={value ?? 0}
          onChange={handleInput}
          min={min}
          max={max}
          className="flex-1 h-11 text-center text-lg font-semibold text-ink border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={increment}
          className="w-11 h-11 rounded-lg border border-border bg-white text-ink text-xl font-bold flex items-center justify-center hover:bg-surface active:scale-95 transition-transform"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

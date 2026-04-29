import { formatCurrency } from '../../utils/formatters';

export default function CurrencyField({ label, name, value, onChange, help }) {
  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    const v = parseFloat(raw);
    onChange(name, isNaN(v) ? 0 : v);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">{label}</label>
      {help && <p className="text-xs text-ink-muted -mt-0.5">{help}</p>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted pointer-events-none">
          TTD
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={value === 0 ? '' : value}
          onChange={handleChange}
          placeholder="0.00"
          className="w-full h-11 pl-14 pr-4 text-lg font-semibold text-ink border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      {value > 0 && <p className="text-xs text-ink-muted">{formatCurrency(value)}</p>}
    </div>
  );
}

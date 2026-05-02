import { useState } from 'react';
import { X } from 'lucide-react';

const OPTIONS = [
  { value: 4,      label: 'Last 4 Weeks'  },
  { value: 8,      label: 'Last 8 Weeks'  },
  { value: 12,     label: 'Last 12 Weeks' },
  { value: 'year', label: 'Full Year'     },
];

export default function ReportRangeModal({ onGenerate, onClose }) {
  const [selected, setSelected] = useState(12);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">

        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-ink">Generate Performance Report</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-ink-muted mb-5">Select the period to include in your report</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                selected === opt.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-ink-muted border-border hover:border-primary/40 hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => onGenerate(selected)}
          className="btn-primary w-full mb-3"
        >
          Generate &amp; Download
        </button>
        <button
          onClick={onClose}
          className="w-full text-center text-sm text-ink-muted hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

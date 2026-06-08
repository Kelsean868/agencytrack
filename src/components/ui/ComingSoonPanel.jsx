import React from 'react';
import { Clock } from 'lucide-react';

export default function ComingSoonPanel({ label = 'This feature' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card-raised">
        <Clock className="h-7 w-7 text-ink-muted" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-ink">{label}</p>
        <p className="text-sm text-ink-muted">Coming soon</p>
      </div>
    </div>
  );
}

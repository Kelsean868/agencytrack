import React from 'react';
import { formatTenureStr, formatContractDateStr } from './tenureUtils';

export default function TenureCell({ contractDate }) {
  const tenure = formatTenureStr(contractDate);
  const dateStr = formatContractDateStr(contractDate);
  if (!tenure) {
    return <span className="text-ink-muted font-mono text-xs">—</span>;
  }
  return (
    <div data-testid="tenure-cell">
      <div className="font-bold text-sm text-ink leading-snug">{tenure}</div>
      <div className="font-mono text-[9.5px] text-ink-muted mt-0.5">{dateStr}</div>
    </div>
  );
}

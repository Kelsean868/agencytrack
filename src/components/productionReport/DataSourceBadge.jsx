import React from 'react';

// Mirrors the inline DataSourceBadge in AgentAwardsPanel.jsx — moved to shared location.
export default function DataSourceBadge({ source }) {
  if (source === 'confirmed') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary"
        title="Values taken from confirmed settlement records"
      >
        Confirmed
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/15 text-warning-ink"
      title="Values computed from submitted reports — not yet confirmed in settlements"
    >
      Estimated
    </span>
  );
}

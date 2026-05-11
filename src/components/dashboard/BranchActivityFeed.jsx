import React from 'react';
import ActivityFeed from './ActivityFeed';

export default function BranchActivityFeed({ events, loading }) {
  if (loading) {
    return (
      <div className="card">
        <div className="h-3 w-36 rounded bg-border/30 animate-pulse mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-border/30 animate-pulse mb-3" />
        ))}
      </div>
    );
  }

  return (
    <ActivityFeed
      events={events}
      heading="Team Activity"
      subHeading="Last 14 days"
    />
  );
}

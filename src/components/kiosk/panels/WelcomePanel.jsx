import React, { useState, useEffect } from 'react';

const QUOTES = [
  'Consistency is the key to excellence.',
  'Every call brings you closer to the close.',
  'Activity today builds your pipeline tomorrow.',
  'Champions train even on difficult days.',
  'One more appointment can change your entire week.',
  'The harder you work, the luckier you get.',
  'Success is earned, not given.',
];

export default function WelcomePanel() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const dateStr = now.toLocaleDateString('en-TT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-TT', {
    hour: '2-digit', minute: '2-digit',
  });

  const quote = QUOTES[now.getDate() % QUOTES.length];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-8 p-10">
      <p className="text-8xl font-display font-bold text-primary text-center">{greeting}</p>
      <p className="text-4xl text-ink-muted text-center">{dateStr}</p>
      <p className="text-7xl font-display font-bold text-ink">{timeStr}</p>
      <div className="mt-8 max-w-3xl text-center">
        <p className="text-2xl text-ink-muted italic">&ldquo;{quote}&rdquo;</p>
      </div>
      <p
        className="mt-4 text-xl text-ink-muted opacity-50 motion-reduce:animate-none animate-kiosk-breathe"
        data-testid="welcome-brand-mark"
      >
        AgencyTrack · Tatil Life
      </p>
    </div>
  );
}

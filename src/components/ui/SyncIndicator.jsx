import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function SyncIndicator() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online',  up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (online) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/15 text-warning text-xs font-semibold">
      <WifiOff size={13} />
      <span>Offline</span>
    </div>
  );
}

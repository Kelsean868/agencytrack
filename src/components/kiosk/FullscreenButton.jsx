import React, { useEffect, useState } from 'react';
import { Maximize2 } from 'lucide-react';

export default function FullscreenButton() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    function onFullscreenChange() {
      setVisible(!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  function handleClick() {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  }

  if (!visible) return null;

  return (
    <button
      onClick={handleClick}
      aria-label="Enter fullscreen"
      className="absolute bottom-6 right-6 z-50 flex items-center gap-2 bg-black/30 hover:bg-black/50 text-white/70 hover:text-white rounded-lg px-4 py-2.5 text-sm transition-colors backdrop-blur-sm"
    >
      <Maximize2 size={16} />
      <span>Enter fullscreen</span>
    </button>
  );
}

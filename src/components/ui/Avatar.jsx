import React, { useState, useEffect } from 'react';
import { deriveInitials } from '../../lib/kiosk/utils';

const SIZE_PX = { sm: 32, md: 36, lg: 40, xl: 48 };

// Preload via Image API to detect load failure without attaching onError to the
// rendered <img> element (which would trigger jsx-a11y/no-noninteractive-element-interactions).
export default function Avatar({ src, name = '', size = 'md', onClick, className = '' }) {
  const [imgReady, setImgReady] = useState(false);
  const px = SIZE_PX[size] ?? SIZE_PX.md;
  const initials = deriveInitials(name);

  useEffect(() => {
    if (!src) {
      setImgReady(false);
      return;
    }
    let active = true;
    const img = new Image();
    img.onload = () => { if (active) setImgReady(true); };
    img.onerror = () => { if (active) setImgReady(false); };
    img.src = src;
    return () => { active = false; };
  }, [src]);

  const dimStyle = { width: px, height: px };
  const circleClass = [
    'rounded-full shrink-0 flex items-center justify-center',
    'bg-primary dark:bg-primary-dark text-white font-bold select-none',
    className,
  ].filter(Boolean).join(' ');

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={name}
        onClick={onClick}
        className={`${circleClass} cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
        style={dimStyle}
      >
        {src && imgReady ? (
          <img src={src} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          <span style={{ fontSize: Math.round(px * 0.36) }}>{initials}</span>
        )}
      </button>
    );
  }

  if (src && imgReady) {
    return (
      <img
        src={src}
        alt={name}
        className={['rounded-full shrink-0 object-cover', className].filter(Boolean).join(' ')}
        style={dimStyle}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name}
      className={circleClass}
      style={{ ...dimStyle, fontSize: Math.round(px * 0.36) }}
    >
      {initials}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { avatarColor, deriveInitials } from '../../lib/kiosk/utils';

const SIZE_PX = { sm: 24, md: 32, lg: 48, tv: 60, aom: 200 };

// Preload via Image API to detect load failure without attaching onError to the
// rendered <img> element (which would trigger jsx-a11y/no-noninteractive-element-interactions).
export default function Avatar({ agent = {}, size = 'md' }) {
  const [imgReady, setImgReady] = useState(false);
  const px = SIZE_PX[size] ?? SIZE_PX.md;
  const { uid = '', name = '', photoURL } = agent;

  useEffect(() => {
    if (!photoURL) {
      setImgReady(false);
      return;
    }
    let active = true;
    const img = new Image();
    img.onload = () => { if (active) setImgReady(true); };
    img.onerror = () => { if (active) setImgReady(false); };
    img.src = photoURL;
    return () => { active = false; };
  }, [photoURL]);

  const circleStyle = {
    width: px,
    height: px,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: avatarColor(uid),
    // Fixed white initials on the saturated avatarColor() background —
    // intentional in both themes (worst-case white-on-palette contrast 5.15:1,
    // AA-safe). Not a theme token: the circle bg is always a dark accent hue.
    color: '#fff',
    fontSize: Math.round(px * 0.36),
    fontWeight: 700,
  };

  if (photoURL && imgReady) {
    return (
      <img
        src={photoURL}
        alt={name || 'Agent'}
        style={{
          width: px,
          height: px,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }

  return <div style={circleStyle}>{deriveInitials(name)}</div>;
}

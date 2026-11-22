import React, { useState } from 'react';
import usePlayerPhoto from '../hooks/usePlayerPhoto';
import { isCutout, sizedPhoto } from '../api/playerPhotos';

const initials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
};

/**
 * Foto circular del jugador. Sin foto muestra el dorsal (o sus iniciales),
 * así nunca queda un círculo vacío.
 */
export default function PlayerAvatar({ name, team, headshot = null, jersey, color, size = 28, priority = 0, className = '' }) {
  const url = usePlayerPhoto(name, team, headshot, priority);
  const [broken, setBroken] = useState(null);
  const ok = Boolean(url) && broken !== url;
  const cutout = ok && isCutout(url);

  return (
    <span
      className={`pa${ok ? ' has-photo' : ''}${cutout ? ' cutout' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--pa-size': `${size}px`, ...(color ? { '--pa-color': color } : {}) }}
      aria-hidden="true"
    >
      {ok ? (
        <img
          src={sizedPhoto(url, cutout ? size * 3.4 : size * 2)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken(url)}
        />
      ) : (
        <b>{jersey ?? initials(name)}</b>
      )}
    </span>
  );
}

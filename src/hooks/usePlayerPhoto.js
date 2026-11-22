import { useEffect, useState } from 'react';
import { cachedPlayerPhoto, fetchPlayerPhoto } from '../api/playerPhotos';

/**
 * Foto de un jugador: la de ESPN si viene en el partido; si no, la de
 * TheSportsDB (caché del navegador o cola de búsquedas). null = sin foto.
 */
export default function usePlayerPhoto(name, team, headshot = null, priority = 0) {
  const key = `${name}|${team}`;
  const [found, setFound] = useState({ key: null, url: null });
  const cached = headshot ? headshot : cachedPlayerPhoto(name, team);

  useEffect(() => {
    if (headshot || !name || cachedPlayerPhoto(name, team) !== undefined) return undefined;
    let alive = true;
    fetchPlayerPhoto(name, team, priority).then((url) => {
      if (alive) setFound({ key, url });
    });
    return () => { alive = false; };
  }, [key, name, team, headshot, priority]);

  if (cached !== undefined) return cached;
  return found.key === key ? found.url : null;
}

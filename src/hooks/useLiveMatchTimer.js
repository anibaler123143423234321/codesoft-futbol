import { useState, useEffect, useRef } from 'react';

/**
 * High-Precision Real-Time Match Chronometer with Seconds (MM:SS)
 * Ticks continuously during live matches and synchronizes with API updates.
 */
export function useLiveMatchTimer(match) {
  const isFinished = match?.status === 'finished';
  const isHalftime = match?.minute === 'HT' || match?.rawEspnStatus?.name?.includes('HALFTIME') || match?.rawEspnStatus?.detail === 'HT';
  const hasGoalsOrMinutes = (match?.homeTeam?.score > 0 || match?.awayTeam?.score > 0) || (match?.scorers && match?.scorers.length > 0) || (match?.minute && match?.minute !== 'Hoy' && match?.minute !== 'Por Iniciar' && !match?.minute.includes('AM') && !match?.minute.includes('PM') && !match?.minute.includes(':'));
  const isLive = (match?.status === 'live' || hasGoalsOrMinutes) && !isFinished;
  const isScheduled = !isLive && !isFinished;

  const getInitialSeconds = () => {
    if (typeof match?.clockSeconds === 'number' && match.clockSeconds > 0) {
      return match.clockSeconds;
    }
    if (match?.minute && typeof match.minute === 'string') {
      if (match.minute === 'HT') return 45 * 60;
      const matchMin = match.minute.match(/(\d+)/);
      if (matchMin) {
        const mins = parseInt(matchMin[1], 10);
        return mins * 60;
      }
    }
    return 0;
  };

  const [seconds, setSeconds] = useState(getInitialSeconds);
  const baseTimeRef = useRef(Date.now());
  const baseSecRef = useRef(getInitialSeconds());

  useEffect(() => {
    const sec = getInitialSeconds();
    setSeconds(sec);
    baseTimeRef.current = Date.now();
    baseSecRef.current = sec;
  }, [match?.id, match?.minute, match?.clockSeconds, match?.status]);

  useEffect(() => {
    if (!isLive || isHalftime || isFinished || isScheduled) return;

    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - baseTimeRef.current) / 1000);
      setSeconds(baseSecRef.current + elapsedSeconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive, isHalftime, isFinished, isScheduled, match?.id]);

  const formatTime = () => {
    if (isFinished) return 'FT';
    if (isHalftime) return 'HT';
    if (isScheduled) return match?.timeStr || match?.date || 'Hoy';

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formattedMins = mins < 10 ? `0${mins}` : `${mins}`;
    const formattedSecs = secs < 10 ? `0${secs}` : `${secs}`;

    return `${formattedMins}:${formattedSecs}`;
  };

  return {
    formattedTime: formatTime(),
    seconds,
    isLive,
    isHalftime,
    isFinished,
    isScheduled
  };
}

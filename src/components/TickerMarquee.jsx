import React from 'react';
import { sounds } from '../utils/soundEffects';
import { pressable } from '../utils/a11y';

export default function TickerMarquee({ matches = [], onSelectMatch }) {
  if (!matches || matches.length === 0) return null;

  // Duplicate list to create a seamless infinite loop
  const displayItems = [...matches, ...matches];

  return (
    <div className="ticker-container" id="top-marquee-ticker">
      <div className="ticker-track">
        {displayItems.map((m, index) => {
          const isLive = m.status === 'live';
          const state = isLive
            ? (m.minute && m.minute !== 'FT' ? m.minute : 'En vivo')
            : m.status === 'finished' ? 'Final' : m.timeStr;
          return (
            <div
              key={`${m.id}-${index}`}
              className={`ticker-item ${isLive ? 'is-live' : ''}`} {...pressable}
              onClick={() => {
                sounds.playClick();
                onSelectMatch(m);
              }}
            >
              {isLive && <span className="live-dot" aria-hidden="true" />}
              <span className="ticker-team">{m.homeTeam?.shortName || m.homeTeam?.name}</span>
              <span className="score-badge">
                {m.homeTeam?.score ?? 0}<i>-</i>{m.awayTeam?.score ?? 0}
              </span>
              <span className="ticker-team">{m.awayTeam?.shortName || m.awayTeam?.name}</span>
              {state && <span className="ticker-state">{state}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

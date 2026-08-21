import React from 'react';
import { Radio } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

export default function TickerMarquee({ matches = [], onSelectMatch }) {
  if (!matches || matches.length === 0) return null;

  // Duplicate list to create a seamless infinite loop
  const displayItems = [...matches, ...matches];

  return (
    <div className="ticker-container" id="top-marquee-ticker">
      <div className="ticker-track">
        {displayItems.map((m, index) => {
          const isLive = m.status === 'live';
          return (
            <div
              key={`${m.id}-${index}`}
              className="ticker-item"
              onClick={() => {
                sounds.playClick();
                onSelectMatch(m);
              }}
            >
              {isLive ? (
                <span className="live-dot" />
              ) : (
                <Radio size={12} style={{ color: 'var(--text-muted)' }} />
              )}
              <span style={{ fontWeight: 600, color: '#fff' }}>
                {m.homeTeam?.shortName || m.homeTeam?.name}
              </span>
              <span className="score-badge">
                {m.homeTeam?.score ?? 0} - {m.awayTeam?.score ?? 0}
              </span>
              <span style={{ fontWeight: 600, color: '#fff' }}>
                {m.awayTeam?.shortName || m.awayTeam?.name}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                ({m.minute || m.timeStr})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

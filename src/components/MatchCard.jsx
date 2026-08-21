import React from 'react';
import { Play, Sparkles, Tv } from 'lucide-react';
import TeamLogo from './TeamLogo';
import { sounds } from '../utils/soundEffects';

export default function MatchCard({ match, onSelectMatch, onOpenPickModal }) {
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';

  const handleClick = (e) => {
    sounds.playClick();
    onSelectMatch(match);
  };

  const handlePickClick = (e) => {
    e.stopPropagation();
    onOpenPickModal(match);
  };

  return (
    <div 
      className={`match-card ${isLive ? 'is-live' : ''}`}
      onClick={handleClick}
      id={`match-card-${match.id}`}
    >
      {/* Top Header: League & Status */}
      <div className="match-card-top">
        <span className="match-league-label">{match.leagueName || 'LALIGA'}</span>
        
        <span className={`match-status-badge ${isLive ? 'live' : isFinished ? 'finished' : 'scheduled'}`}>
          {isLive && <span className="live-dot" />}
          <span>{isLive ? match.timeStr : isFinished ? 'FINALIZADO' : match.timeStr}</span>
        </span>
      </div>

      {/* Center: Teams & Score */}
      <div className="match-teams-row">
        {/* Home */}
        <div className="match-team-block">
          <TeamLogo
            src={match.homeTeam?.logo}
            alt={match.homeTeam?.name}
            size={44}
            isHome={true}
          />
          <span className="match-team-title" title={match.homeTeam?.name}>
            {match.homeTeam?.shortName || match.homeTeam?.name}
          </span>
        </div>

        {/* Score or VS */}
        <div className="match-score-center">
          {isLive || isFinished ? (
            <div className="match-score-text">
              <span>{match.homeTeam?.score ?? 0}</span>
              <span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>-</span>
              <span>{match.awayTeam?.score ?? 0}</span>
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-score)', fontSize: '1.2rem', color: 'var(--text-muted)' }}>
              VS
            </div>
          )}
          {match.scorers && match.scorers.length > 0 && isLive && (
            <span style={{ fontSize: '0.68rem', color: 'var(--cyan-neon)' }}>
              ⚽ {match.scorers[match.scorers.length - 1].player.split(' ').pop()} {match.scorers[match.scorers.length - 1].minute}
            </span>
          )}
        </div>

        {/* Away */}
        <div className="match-team-block">
          <TeamLogo
            src={match.awayTeam?.logo}
            alt={match.awayTeam?.name}
            size={44}
            isHome={false}
          />
          <span className="match-team-title" title={match.awayTeam?.name}>
            {match.awayTeam?.shortName || match.awayTeam?.name}
          </span>
        </div>
      </div>

      {/* Bottom: Action badge & AI quick pick */}
      <div className="match-card-bottom">
        <span className={`match-action-pill ${isLive ? 'live' : isFinished ? 'finished' : 'scheduled'}`}>
          {isLive ? (
            <>
              <span className="live-dot" />
              <span>SEGUIR EN VIVO</span>
            </>
          ) : isFinished ? (
            <span>RESUMEN FINAL</span>
          ) : (
            <span>HORARIO: {match.date || 'Hoy'}</span>
          )}
        </span>

        {match.aiPick && (
          <span 
            className="match-quick-pick" 
            onClick={handlePickClick}
            title="Ver predicción IA"
          >
            <Sparkles size={12} />
            <span>Pick IA: @{match.aiPick.cuota}</span>
          </span>
        )}
      </div>
    </div>
  );
}

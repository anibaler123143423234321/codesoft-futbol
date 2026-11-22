import React from 'react';
import { Ball } from './SportIcon';
import { Sparkles } from 'lucide-react';
import TeamLogo from './TeamLogo';
import { sounds } from '../utils/soundEffects';
import { pressable } from '../utils/a11y';

const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toFixed(2) : '—');

export default function MatchCard({ match, onSelectMatch, onOpenPickModal }) {
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';

  const odds = match.oddsInfo?.hasMoneyline ? match.oddsInfo : null;

  const handleClick = () => {
    sounds.playClick();
    onSelectMatch(match);
  };

  const handlePickClick = (e) => {
    e.stopPropagation();
    onOpenPickModal(match);
  };

  return (
    <div 
      className={`match-card ${isLive ? 'is-live' : ''}`} {...pressable} 
      onClick={handleClick}
      id={`match-card-${match.id}`}
    >
      {/* Top Header: League & Status */}
      <div className="match-card-top">
        <span className="match-league-label">{match.leagueName || 'Fútbol'}</span>
        
        <span className={`match-status-badge ${isLive ? 'live' : isFinished ? 'finished' : 'scheduled'}`}>
          {isLive && <span className="live-dot" />}
          <span>{isLive ? `En vivo${match.minute ? ` · ${match.minute}` : ''}` : isFinished ? 'Finalizado' : match.timeStr}</span>
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
            <div className="match-vs">vs</div>
          )}
          {match.scorers && match.scorers.length > 0 && isLive && (
            <span className="match-last-scorer">
              <Ball size={11} /> {match.scorers[match.scorers.length - 1].player.split(' ').pop()} {match.scorers[match.scorers.length - 1].minute}
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

      {/* Abajo: acción, o las cuotas 1X2 si el partido aún no empieza */}
      <div className="match-card-bottom">
        {!isLive && !isFinished && odds ? (
          <div className="match-odds-row" aria-label={`Cuotas de ${odds.provider}`}>
            <span><small>1</small>{fmt(odds.homeOdds)}</span>
            <span><small>X</small>{fmt(odds.drawOdds)}</span>
            <span><small>2</small>{fmt(odds.awayOdds)}</span>
          </div>
        ) : (
          <span className={`match-action-pill ${isLive ? 'live' : isFinished ? 'finished' : 'scheduled'}`}>
            {isLive ? (
              <>
                <span className="live-dot" />
                <span>Seguir en vivo</span>
              </>
            ) : isFinished ? (
              <span>Ver resumen</span>
            ) : (
              <span>Ver previa</span>
            )}
          </span>
        )}

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

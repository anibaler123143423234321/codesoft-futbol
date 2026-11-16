import React, { useState, useMemo } from 'react';
import { Trophy } from 'lucide-react';
import TeamLogo from './TeamLogo';
import { sounds } from '../utils/soundEffects';

export default function PredictionPoll({ match }) {
  const pollKey = `poll_vote_${match?.id}`;
  const [hasVoted, setHasVoted] = useState(() => {
    return localStorage.getItem(pollKey) || null;
  });


  const homeName = match?.homeTeam?.shortName || match?.homeTeam?.name || 'Local';
  const awayName = match?.awayTeam?.shortName || match?.awayTeam?.name || 'Visita';

  // Probabilidad implícita en las cuotas reales del proveedor (sin margen de la casa).
  // Si el partido no tiene cuotas no se muestra ningún porcentaje.
  const oddsInfo = match?.oddsInfo;
  const probabilities = useMemo(() => {
    if (!oddsInfo?.hasMoneyline) return null;
    const pHome = 1 / oddsInfo.homeOdds;
    const pDraw = 1 / oddsInfo.drawOdds;
    const pAway = 1 / oddsInfo.awayOdds;
    const sum = pHome + pDraw + pAway;
    const home = Math.round((pHome / sum) * 100);
    const draw = Math.round((pDraw / sum) * 100);
    return { home, draw, away: 100 - home - draw };
  }, [oddsInfo?.hasMoneyline, oddsInfo?.homeOdds, oddsInfo?.drawOdds, oddsInfo?.awayOdds]);
  const pct = (side) => (probabilities ? `${probabilities[side]}%` : '—');
  const voteLabel = { home: homeName, draw: 'Empate', away: awayName }[hasVoted];

  const handleVote = (option) => {
    if (hasVoted) return;
    sounds.playClick();
    setHasVoted(option);
    localStorage.setItem(pollKey, option);
  };

  return (
    <div className="sofa-prediction-widget" id="poll-widget-container">
      {/* SofaScore-style Header with Trophy Icon */}
      <div className="sofa-poll-header">
        <div>
          <h4 className="sofa-poll-title">¿Quién ganará?</h4>
          <span className="sofa-poll-subtitle">
            {hasVoted
              ? `Tu pronóstico: ${voteLabel}`
              : probabilities
                ? `Probabilidad según cuotas de ${oddsInfo.provider} · tocá para votar`
                : 'Sin cuotas publicadas · tocá para dejar tu pronóstico'}
          </span>
        </div>
        <Trophy size={20} className="sofa-poll-trophy" />
      </div>

      {/* SofaScore-style Rounded Pill Buttons Row */}
      <div className="sofa-poll-pills-row">
        {/* Home Option */}
        <button
          className={`sofa-poll-pill ${hasVoted === 'home' ? 'voted' : ''}`}
          onClick={() => handleVote('home')}
          title={homeName}
        >
          <div className="sofa-pill-left">
            <TeamLogo
              src={match?.homeTeam?.logo}
              alt={homeName}
              size={20}
              isHome={true}
            />
          </div>
          <span className="sofa-pill-pct">{pct('home')}</span>
        </button>

        {/* Draw Option */}
        <button
          className={`sofa-poll-pill draw ${hasVoted === 'draw' ? 'voted' : ''}`}
          onClick={() => handleVote('draw')}
          title="Empate"
        >
          <div className="sofa-pill-left">
            <span className="sofa-draw-x">X</span>
          </div>
          <span className="sofa-pill-pct">{pct('draw')}</span>
        </button>

        {/* Away Option */}
        <button
          className={`sofa-poll-pill ${hasVoted === 'away' ? 'voted' : ''}`}
          onClick={() => handleVote('away')}
          title={awayName}
        >
          <div className="sofa-pill-left">
            <TeamLogo
              src={match?.awayTeam?.logo}
              alt={awayName}
              size={20}
              isHome={false}
            />
          </div>
          <span className="sofa-pill-pct">{pct('away')}</span>
        </button>
      </div>
    </div>
  );
}

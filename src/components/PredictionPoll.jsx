import React, { useState, useMemo } from 'react';
import { Trophy, Check } from 'lucide-react';
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

  const options = [
    { key: 'home', name: homeName, logo: match?.homeTeam?.logo, isHome: true },
    { key: 'draw', name: 'Empate' },
    { key: 'away', name: awayName, logo: match?.awayTeam?.logo, isHome: false },
  ];
  const favorite = probabilities
    ? options.reduce((best, o) => (probabilities[o.key] > probabilities[best] ? o.key : best), 'home')
    : null;

  return (
    <div className={`sofa-prediction-widget ${hasVoted ? 'has-voted' : ''}`} id="poll-widget-container">
      <div className="sofa-poll-header">
        <div>
          <h4 className="sofa-poll-title">¿Quién ganará?</h4>
          <span className="sofa-poll-subtitle">
            {hasVoted
              ? `Tu pronóstico: ${voteLabel}`
              : probabilities
                ? `Probabilidad según ${oddsInfo.provider} · toca para votar`
                : 'Sin cuotas publicadas · toca para votar'}
          </span>
        </div>
        <Trophy size={18} className="sofa-poll-trophy" aria-hidden="true" />
      </div>

      <div className="sofa-poll-pills-row" role="group" aria-label="Elige quién gana">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`sofa-poll-pill ${o.key === 'draw' ? 'draw' : ''} ${hasVoted === o.key ? 'voted' : ''} ${favorite === o.key ? 'fav' : ''}`}
            onClick={() => handleVote(o.key)}
            disabled={Boolean(hasVoted) && hasVoted !== o.key}
            aria-pressed={hasVoted === o.key}
            title={o.name}
          >
            <span className="sofa-pill-left">
              {o.key === 'draw'
                ? <span className="sofa-draw-x">X</span>
                : <TeamLogo src={o.logo} alt="" size={20} isHome={o.isHome} />}
            </span>
            <span className="sofa-pill-pct">{pct(o.key)}</span>
            <span className="sofa-pill-name">
              {hasVoted === o.key && <Check size={12} aria-label="Tu voto" />}
              {o.name}
            </span>
          </button>
        ))}
      </div>

      {probabilities && (
        <div className="sofa-poll-bar" aria-hidden="true">
          <i className="home" style={{ flexGrow: probabilities.home }} />
          <i className="draw" style={{ flexGrow: probabilities.draw }} />
          <i className="away" style={{ flexGrow: probabilities.away }} />
        </div>
      )}
    </div>
  );
}

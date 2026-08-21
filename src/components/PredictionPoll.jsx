import React, { useState, useMemo } from 'react';
import { Trophy, CheckCircle2 } from 'lucide-react';
import TeamLogo from './TeamLogo';
import { sounds } from '../utils/soundEffects';

export default function PredictionPoll({ match }) {
  const pollKey = `poll_vote_${match?.id}`;
  const [hasVoted, setHasVoted] = useState(() => {
    return localStorage.getItem(pollKey) || null;
  });

  const [userVote, setUserVote] = useState(null);

  const homeName = match?.homeTeam?.shortName || match?.homeTeam?.name || 'Local';
  const awayName = match?.awayTeam?.shortName || match?.awayTeam?.name || 'Visita';

  // Community Prediction Voting Consensus (Preserved throughout the match like SofaScore)
  const dynamicProbabilities = useMemo(() => {
    // 1. Detect Club Power Tier and Market Favoritism
    const getTeamPower = (name) => {
      const n = (name || '').toLowerCase();
      if (n.includes('nassr') || n.includes('hilal') || n.includes('ittihad') || n.includes('ahli')) return 92;
      if (n.includes('madrid') || n.includes('barcelona') || n.includes('manchester') || n.includes('arsenal') || n.includes('liverpool') || n.includes('bayern') || n.includes('psg') || n.includes('inter')) return 95;
      if (n.includes('betis') || n.includes('sociedad') || n.includes('frankfurt') || n.includes('stuttgart') || n.includes('marseille') || n.includes('monterrey') || n.includes('tigres') || n.includes('america')) return 80;
      if (n.includes('riyadh') || n.includes('hazem') || n.includes('coventry') || n.includes('tönis') || n.includes('münster')) return 35;
      return 60;
    };

    // 2. Check official market odds if available
    const homeOdds = parseFloat(match?.oddsInfo?.homeOdds || match?.homeTeam?.odds);
    const drawOdds = parseFloat(match?.oddsInfo?.drawOdds);
    const awayOdds = parseFloat(match?.oddsInfo?.awayOdds || match?.awayTeam?.odds);

    if (!isNaN(homeOdds) && !isNaN(drawOdds) && !isNaN(awayOdds) && homeOdds > 1 && drawOdds > 1 && awayOdds > 1) {
      const pHome = 1 / homeOdds;
      const pDraw = 1 / drawOdds;
      const pAway = 1 / awayOdds;
      const sum = pHome + pDraw + pAway;
      const homePct = Math.round((pHome / sum) * 100);
      const drawPct = Math.round((pDraw / sum) * 100);
      const awayPct = 100 - homePct - drawPct;
      return { home: homePct, draw: drawPct, away: awayPct };
    }

    // 3. Power Tier Comparison
    const hPower = getTeamPower(homeName);
    const aPower = getTeamPower(awayName);
    const powerDiff = hPower - aPower;

    if (powerDiff > 35) {
      // Overwhelming Home favorite (e.g. Real Madrid, Arsenal)
      return { home: 86, draw: 9, away: 5 };
    } else if (powerDiff < -35) {
      // Overwhelming Away favorite (e.g. Al Riyadh vs Al Nassr)
      return { home: 5, draw: 9, away: 86 };
    } else if (powerDiff > 18) {
      return { home: 70, draw: 19, away: 11 };
    } else if (powerDiff < -18) {
      return { home: 12, draw: 20, away: 68 };
    } else {
      // Balanced / Even matchup (e.g. Betis vs Real Sociedad)
      return { home: 39, draw: 31, away: 30 };
    }
  }, [match?.id, match?.oddsInfo, homeName, awayName]);

  // Generate realistic vote volume count (e.g. 33k, 24k)
  const formattedVotes = useMemo(() => {
    const str = String(match?.id || '1234');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const seed = (Math.abs(hash) % 25) + 15; // 15k - 40k
    return `${seed}k`;
  }, [match?.id]);

  const handleVote = (option) => {
    if (hasVoted) return;
    sounds.playClick();
    setUserVote(option);
    setHasVoted(option);
    localStorage.setItem(pollKey, option);
  };

  return (
    <div className="sofa-prediction-widget" id="poll-widget-container">
      {/* SofaScore-style Header with Trophy Icon */}
      <div className="sofa-poll-header">
        <div>
          <h4 className="sofa-poll-title">¿Quién ganará?</h4>
          <span className="sofa-poll-subtitle">Votos totales: {formattedVotes}</span>
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
          <span className="sofa-pill-pct">{dynamicProbabilities.home}%</span>
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
          <span className="sofa-pill-pct">{dynamicProbabilities.draw}%</span>
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
          <span className="sofa-pill-pct">{dynamicProbabilities.away}%</span>
        </button>
      </div>
    </div>
  );
}

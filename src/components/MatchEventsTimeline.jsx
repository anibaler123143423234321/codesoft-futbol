export default function MatchEventsTimeline({ match }) {
  const scorers = match?.scorers || [];
  const isLive = match?.status === 'live';
  const isFinished = match?.status === 'finished';
  const isScheduled = match?.status === 'scheduled' || (!isLive && !isFinished);

  const homeScore = Number(match?.homeTeam?.score || 0);
  const awayScore = Number(match?.awayTeam?.score || 0);
  const totalGoals = homeScore + awayScore;

  const homeLinescores = match?.linescores?.home || [];
  const awayLinescores = match?.linescores?.away || [];
  const hasLinescores = homeLinescores.length > 0 && awayLinescores.length > 0;

  if (totalGoals === 0 && !hasLinescores) {
    return null;
  }

  const homeScorers = scorers.filter(s => s.team === 'home');
  const awayScorers = scorers.filter(s => s.team === 'away');

  const homeName = match?.homeTeam?.shortName || match?.homeTeam?.name || 'Local';
  const awayName = match?.awayTeam?.shortName || match?.awayTeam?.name || 'Visita';

  return (
    <div className="match-scorers-timeline">
      {/* Home Scorers List */}
      <div className="scorers-team-side home">
        {homeScorers.length > 0 ? (
          homeScorers.map((s, idx) => (
            <div key={idx} className="scorer-item home">
              <span className="scorer-minute">{s.minute}</span>
              <span className="scorer-name">{s.player}</span>
              <span style={{ fontSize: '0.8rem' }}>⚽</span>
            </div>
          ))
        ) : homeScore > 0 ? (
          <div className="scorer-item home">
            <span className="scorer-minute">{homeLinescores[0] ? `1T: ${homeLinescores[0]}` : `${homeScore}`}</span>
            <span className="scorer-name">⚽ {homeScore} {homeScore === 1 ? 'Gol' : 'Goles'} de {homeName}</span>
          </div>
        ) : null}
      </div>

      {/* Center Half-time Breakdown */}
      {hasLinescores && (isLive || isFinished) && (
        <div className="scorers-center-pill">
          <span style={{ fontWeight: 800, color: 'var(--gold-neon)' }}>Parciales:</span>
          <span>1T ({homeLinescores[0] || 0} - {awayLinescores[0] || 0})</span>
          {homeLinescores.length > 1 && (
            <span>· 2T ({homeLinescores[1] || 0} - {awayLinescores[1] || 0})</span>
          )}
        </div>
      )}

      {/* Away Scorers List */}
      <div className="scorers-team-side away">
        {awayScorers.length > 0 ? (
          awayScorers.map((s, idx) => (
            <div key={idx} className="scorer-item away">
              <span style={{ fontSize: '0.8rem' }}>⚽</span>
              <span className="scorer-minute">{s.minute}</span>
              <span className="scorer-name">{s.player}</span>
            </div>
          ))
        ) : awayScore > 0 ? (
          <div className="scorer-item away">
            <span className="scorer-name">⚽ {awayScore} {awayScore === 1 ? 'Gol' : 'Goles'} de {awayName}</span>
            <span className="scorer-minute">{awayLinescores[0] ? `1T: ${awayLinescores[0]}` : `${awayScore}`}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

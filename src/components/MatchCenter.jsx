import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Clock, ChevronRight, Check, ExternalLink } from 'lucide-react';
import TacticalWorkspace from './TacticalWorkspace';
import LiveStatsBars from './LiveStatsBars';
import PredictionPoll from './PredictionPoll';
import CommunityChat from './CommunityChat';
import TeamLogo from './TeamLogo';
import LiveOddsPanel from './LiveOddsPanel';
import { YellowCard, RedCard, CornerFlag, Ball } from './SportIcon';
import { sounds } from '../utils/soundEffects';
import { useLiveMatchTimer } from '../hooks/useLiveMatchTimer';
import { useMatchSounds, useLivePlaySounds } from '../hooks/useMatchSounds';
import { useLiveOdds } from '../hooks/useLiveOdds';
import { useLivePitch } from '../hooks/useLivePitch';
import { useMarketLock } from '../hooks/useMarketLock';
import { useLivePlayLog } from '../hooks/useLivePlayLog';
import { useLiveScoreboard } from '../hooks/useLiveScoreboard';
import { shouldWatchSource } from '../utils/liveBridge';
import { withLiveMarket, oddsOf, summarizePlays } from '../utils/liveMarket';

export default function MatchCenter({ 
  match, 
  liveMatches = [], 
  onSelectMatch, 
  onBack,
}) {
  const { formattedTime, isLive, isFinished, isScheduled } = useLiveMatchTimer(match);
  // Se sigue la fuente aunque ESPN ya marque el final: puede seguir en tiempo añadido
  const watchSource = isLive || shouldWatchSource(match);
  // Con los mercados cerrados las cuotas se leen más seguido, para reabrir apenas la fuente repreció
  const [oddsFast, setOddsFast] = useState(false);
  const odds = useLiveOdds(match, watchSource, { everyMs: oddsFast ? 4000 : undefined });
  const livePitch = useLivePitch(match, watchSource);
  const marketLock = useMarketLock(livePitch.events, odds.data);
  useEffect(() => setOddsFast(marketLock.locked), [marketLock.locked]);
  const sourceLive = livePitch.status === 'ok' || odds.status === 'ok';
  // Marcador: la fuente en vivo suma el gol antes que ESPN; el sonido sigue a ese marcador
  const board = useLiveScoreboard(match, odds.data, sourceLive);
  const soundMatch = useMemo(() => (match ? {
    ...match,
    homeTeam: { ...match.homeTeam, score: board.home },
    awayTeam: { ...match.awayTeam, score: board.away },
  } : match), [match, board.home, board.away]);
  // Con jugadas en vivo suenan ellas (llegan antes); si no, el marcador hace de respaldo
  const playsFlowing = livePitch.status === 'ok' && livePitch.events.length > 0;
  useMatchSounds(soundMatch, { live: isLive || sourceLive, quiet: playsFlowing });
  useLivePlaySounds(livePitch.events, playsFlowing);
  // La IA del panel razona con las cuotas en vivo; espera su primera respuesta antes de analizar
  const { data: oddsData, history: oddsHistory } = odds;
  // Todo lo que la IA puede citar: cuotas de todos los mercados, jugadas de los últimos minutos y
  // si los mercados están cerrados. Con el 1X2 sin precio se usa la última lectura abierta.
  const playLog = useLivePlayLog(livePitch.events, livePitch.eventId);
  const [lastOdds, setLastOdds] = useState(null);
  useEffect(() => {
    const o = oddsOf(oddsData);
    if (o) setLastOdds({ ...o, eventId: oddsData.eventId });
  }, [oddsData]);
  const plays = useMemo(() => summarizePlays(playLog, oddsData || {}), [playLog, oddsData]);
  // La IA lee el mismo marcador, minuto y goleadores que muestra la cabecera
  // En minutos ("54:11" → "54'"), para no rearmar los datos de la IA cada segundo
  const aiClock = String((!isLive && sourceLive && oddsData?.clock?.display) || formattedTime || '').replace(/^(\d+):\d{2}$/, "$1'");
  const scoreboard = useMemo(
    () => ({ home: board.home, away: board.away, clock: aiClock, scorers: board.scorers }),
    [board.home, board.away, aiClock, board.scorers],
  );
  const aiMatch = useMemo(
    () => withLiveMarket(match, { data: oddsData, history: oddsHistory, lock: marketLock, plays, lastOdds, scoreboard }),
    [match, oddsData, oddsHistory, marketLock, plays, lastOdds, scoreboard],
  );
  // Cuando las cuotas vuelven a ser actuales (mercados reabiertos tras un gol, penal, VAR o roja,
  // o la fuente se puso al día con el marcador), la IA vuelve a analizar
  const [reanalyze, setReanalyze] = useState(0);
  const frozen = Boolean(aiMatch?.liveMarket?.frozen);
  const wasFrozen = useRef(frozen);
  useEffect(() => {
    if (wasFrozen.current && !frozen) setReanalyze((n) => n + 1);
    wasFrozen.current = frozen;
  }, [frozen]);
  const aiReady = !watchSource || Boolean(oddsData) || !['checking', 'searching', 'opening'].includes(odds.status);
  if (!match) return null;
  const summary = matchSummary(match, sourceLive ? odds.data : null);
  const liveNow = isLive || sourceLive;
  // Si ESPN ya dio el final (o no empezó) pero la fuente sigue en juego, manda el reloj de la fuente
  const clockText = (!isLive && sourceLive && odds.data?.clock?.display) || formattedTime;
  const showScore = !isScheduled || sourceLive;
  const ht = match.linescores;
  const halftime = (ht?.home?.length > 1 || isFinished) && ht?.home?.[0] != null && ht?.away?.[0] != null
    ? `1T ${ht.home[0]}-${ht.away[0]}`
    : null;
  const hasScorers = board.scorers.home.length > 0 || board.scorers.away.length > 0;

  return (
    <div className="match-center-container" id="match-center-view">
      {/* Unified Compact Top Bar: Navigation + League + Status */}
      <div className="mc-top-bar">
        <button
          className="btn-secondary mc-back-btn"
          onClick={() => {
            sounds.playClick();
            onBack();
          }}
        >
          <ArrowLeft size={13} />
          <span>Volver a cartelera</span>
        </button>

        <div className="mc-top-status-pills">
          <span className="match-league-label">{match.leagueName || 'Fútbol internacional'}</span>
          {match.espnLink && (
            <a className="mc-espn-link" href={match.espnLink} target="_blank" rel="noreferrer">
              ESPN <ExternalLink size={11} />
            </a>
          )}
          {isScheduled && !sourceLive && (
            <span className="pill-badge-gold">
              <Clock size={12} /> {formattedTime}
            </span>
          )}
          {liveNow && (
            <span className="pill-badge-red">
              <span className="live-dot" /> En vivo · {clockText}
            </span>
          )}
          {isFinished && !sourceLive && (
            <span className="pill-badge-green">
              <Check size={12} /> Finalizado
            </span>
          )}
        </div>

        {liveMatches.length > 0 && match.id !== liveMatches[0].id && (
          <button 
            className="btn-primary mc-switch-match-btn" 
            onClick={() => onSelectMatch(liveMatches[0])}
          >
            <span>Ver {liveMatches[0].homeTeam?.shortName} vs {liveMatches[0].awayTeam?.shortName}</span>
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Main Scoreboard Header */}
      <div className="match-center-header">
        {/* Home Team */}
        <div className="mc-team-side home">
          <div className="mc-team-info home">
            <h2 className="mc-team-name" title={match.homeTeam?.name}>
              {match.homeTeam?.name}
            </h2>
          </div>
          
          <TeamLogo
            src={match.homeTeam?.logo}
            alt={match.homeTeam?.name}
            size={56}
            isHome={true}
          />
        </div>

        {/* Center Score & Status */}
        <div className="mc-score-center-box">
          <div className="mc-live-indicator">
            {board.goalSide ? (
              <span className="mc-goal-badge" key={board.goalKey} role="status">GOL</span>
            ) : liveNow ? (
              <>
                <span className="live-dot" />
                <span>En vivo</span>
              </>
            ) : isFinished ? (
              <span className="mc-state-final">Finalizado</span>
            ) : (
              <span className="mc-state-soon">
                <Clock size={12} />
                <span>Por iniciar</span>
              </span>
            )}
          </div>

          <div className="mc-scoreboard">
            {!showScore ? (
              <span className="mc-score-vs">VS</span>
            ) : (
              <>
                <span key={`h${board.home}`} className={board.goalSide === 'home' ? 'is-goal' : undefined}>{board.home}</span>
                <span className="mc-score-dash">-</span>
                <span key={`a${board.away}`} className={board.goalSide === 'away' ? 'is-goal' : undefined}>{board.away}</span>
              </>
            )}
          </div>

          {!(isFinished && !sourceLive) && (
            <div className="mc-clock-time">
              {clockText}
            </div>
          )}
        </div>

        {/* Away Team */}
        <div className="mc-team-side away">
          <TeamLogo
            src={match.awayTeam?.logo}
            alt={match.awayTeam?.name}
            size={56}
            isHome={false}
          />
          
          <div className="mc-team-info away">
            <h2 className="mc-team-name" title={match.awayTeam?.name}>
              {match.awayTeam?.name}
            </h2>
          </div>
        </div>

        {(hasScorers || halftime) && (
          <div className="mc-scorers" aria-label="Goles">
            <ul className="home">
              {board.scorers.home.map((g) => (
                <li key={g.key}>
                  <b>{g.name}</b>
                  {g.tag && <em>({g.tag})</em>}
                  <span>{g.minutes.join(', ')}</span>
                  <Ball size={12} />
                </li>
              ))}
            </ul>
            <span className="mc-scorers-ht">{halftime}</span>
            <ul className="away">
              {board.scorers.away.map((g) => (
                <li key={g.key}>
                  <Ball size={12} />
                  <b>{g.name}</b>
                  {g.tag && <em>({g.tag})</em>}
                  <span>{g.minutes.join(', ')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showScore && summary && (
          <div className="mc-summary" aria-label="Tarjetas y córners">
            <span title="Tarjetas amarillas">
              <YellowCard size={16} label="Amarillas" />
              <b>{summary.yellow[0]}-{summary.yellow[1]}</b>
              <small>Amarillas</small>
            </span>
            {(summary.red[0] > 0 || summary.red[1] > 0) && (
              <span title="Tarjetas rojas">
                <RedCard size={16} label="Rojas" />
                <b>{summary.red[0]}-{summary.red[1]}</b>
                <small>Rojas</small>
              </span>
            )}
            {summary.corners && (
              <span title="Córners">
                <CornerFlag size={16} label="Córners" />
                <b>{summary.corners[0]}-{summary.corners[1]}</b>
                <small>Córners</small>
              </span>
            )}
            {summary.xg && (
              <span title="Goles esperados (xG)">
                <em className="mc-xg">xG</em>
                <b>{summary.xg[0].toFixed(2)}-{summary.xg[1].toFixed(2)}</b>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Panel táctico: video + cancha 2D + jugadas + línea de tiempo */}
      <TacticalWorkspace
        match={match}
        aiMatch={aiMatch}
        aiReady={aiReady}
        aiRefreshKey={reanalyze}
        liveOddsData={odds.data}
        livePitch={livePitch}
        sourceLive={sourceLive}
      />

      {/* Two Column Layout: Left (Stats) / Right (Poll & Chat) */}
      <div className="match-center-layout">
        {/* Left Column */}
        <div className="main-match-col">
          {/* Cuotas y estadísticas en vivo (vía extensión CodeSoft Cuotas en Vivo) */}
          <LiveOddsPanel match={match} isLive={isLive || sourceLive} isFinished={isFinished} odds={odds} lock={marketLock} />

          {/* SofaScore-Style Match Hub: Statistics, H2H, Incidents, Rosters, Info */}
          <LiveStatsBars
            stats={match.stats}
            scorers={match.scorers || []}
            rosters={match.rosters || []}
            commentary={match.commentary || []}
            gameInfo={match.gameInfo || {}}
            linescores={match.linescores || {}}
            h2h={match.h2hHistory || []}
            recentForm={match.recentForm || {
              home: { form: match.homeTeam?.form, games: match.homeTeam?.recentGames },
              away: { form: match.awayTeam?.form, games: match.awayTeam?.recentGames }
            }}
            homeName={match.homeTeam?.shortName || match.homeTeam?.name}
            awayName={match.awayTeam?.shortName || match.awayTeam?.name}
            homeLogo={match.homeTeam?.logo}
            awayLogo={match.awayTeam?.logo}
            homeScore={match.homeTeam?.score || 0}
            awayScore={match.awayTeam?.score || 0}
            matchStatus={match.status}
            leagueName={match.leagueName}
          />
        </div>

        {/* Right Column: Prediction Poll & Live Chat */}
        <div className="side-panel">
          <PredictionPoll match={match} />
          <CommunityChat />
        </div>
      </div>
    </div>
  );
}

const count = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);

/** Tarjetas y córners para la fila bajo el marcador: primero la fuente en vivo, si no ESPN. */
function matchSummary(match, live) {
  const pick = (liveKey, espnKey) => {
    const lh = count(live?.home?.stats?.[liveKey]);
    const la = count(live?.away?.stats?.[liveKey]);
    if (lh != null && la != null) return [lh, la];
    if (!espnKey) return null;
    return [count(match.homeTeam?.[espnKey]) ?? 0, count(match.awayTeam?.[espnKey]) ?? 0];
  };
  // Córners de ESPN: vienen en las estadísticas del resumen, no en el equipo
  const espnCorners = (match.stats?.defense || []).find((r) => r.label === 'CÓRNERS GANADOS');
  const espnPair = espnCorners && count(espnCorners.home) != null && count(espnCorners.away) != null
    ? [count(espnCorners.home), count(espnCorners.away)]
    : null;
  return {
    yellow: pick('yellowCards', 'yellowCards'),
    red: pick('redCards', 'redCards'),
    corners: pick('corners', null) || espnPair,
    xg: pick('xG', null),
  };
}

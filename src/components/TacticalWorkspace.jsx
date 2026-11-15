import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Sparkles, Radio, Crosshair, Tv, Maximize2, Minimize2, Pin, Activity } from 'lucide-react';
import { sounds } from '../utils/soundEffects';
import { useLiveMatchTimer } from '../hooks/useLiveMatchTimer';
import { fetchEspnLatestVideos } from '../api/espnApi';
import SignalPlayer from './SignalPlayer';
import '../tactical.css';

const CATEGORIES = [
  { key: 'goal', label: 'Goles', color: '#22c55e' },
  { key: 'shot', label: 'Tiros', color: '#a78bfa' },
  { key: 'corner', label: 'Córners', color: '#38bdf8' },
  { key: 'foul', label: 'Faltas', color: '#f59e0b' },
  { key: 'card', label: 'Tarjetas', color: '#facc15' },
  { key: 'offside', label: 'Fuera de juego', color: '#fb7185' },
  { key: 'sub', label: 'Cambios', color: '#94a3b8' },
];
const CAT_BY_KEY = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

const TYPE_ES = {
  'Goal': 'Gol',
  'Goal - Header': 'Gol de cabeza',
  'Goal - Free-kick': 'Gol de tiro libre',
  'Penalty - Scored': 'Gol de penal',
  'Penalty - Saved': 'Penal atajado',
  'Penalty - Missed': 'Penal fallado',
  'Own Goal': 'Autogol',
  'Shot On Target': 'Tiro al arco',
  'Shot Off Target': 'Tiro desviado',
  'Shot Blocked': 'Tiro bloqueado',
  'Shot Hit Woodwork': 'Tiro al palo',
  'Corner Awarded': 'Córner',
  'Foul': 'Falta',
  'Handball': 'Mano',
  'Offside': 'Fuera de juego',
  'Yellow Card': 'Tarjeta amarilla',
  'Red Card': 'Tarjeta roja',
  'Substitution': 'Cambio',
  'Kickoff': 'Inicio del partido',
  'Halftime': 'Descanso',
  'Start 2nd Half': 'Inicio 2.º tiempo',
  'End Regular Time': 'Final del tiempo regular',
  'Start Delay': 'Pausa',
  'End Delay': 'Reanudación',
};

const HOME_COLOR = '#ff5a6e';
const AWAY_COLOR = '#4d8dff';
const PITCH_W = 105;
const PITCH_H = 68;

// Coordenadas Opta (0-100 desde el arco propio) → cancha con el local atacando a la derecha
function toPitch(team, x, y) {
  if (x == null || y == null) return null;
  const px = team === 'away' ? 100 - x : x;
  const py = team === 'away' ? y : 100 - y;
  return { x: (px / 100) * PITCH_W, y: (py / 100) * PITCH_H };
}

function fmtDuration(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

export default function TacticalWorkspace({ match, onOpenPickModal }) {
  const { formattedTime, seconds, isLive, isFinished, isScheduled, isHalftime } = useLiveMatchTimer(match);

  const isHalf = isHalftime || 
    formattedTime === 'HT' || 
    match?.minute === 'HT' || 
    match?.status === 'halftime' || 
    match?.rawEspnStatus?.detail === 'HT' || 
    match?.rawEspnStatus?.name?.includes('HALFTIME');

  const plays = match.plays || [];
  const matchVideos = match.videos || [];
  const [latestVideos, setLatestVideos] = useState([]);
  const [brokenIds, setBrokenIds] = useState(() => new Set());
  const hasMatchVideos = matchVideos.length > 0;
  const videos = (hasMatchVideos ? matchVideos : latestVideos).filter(v => !brokenIds.has(v.id));

  // Respaldo: si el partido no tiene clips propios, mostrar los últimos videos de fútbol de ESPN
  useEffect(() => {
    let alive = true;
    fetchEspnLatestVideos().then(list => { if (alive) setLatestVideos(list); });
    return () => { alive = false; };
  }, []);

  const homeName = match.homeTeam?.shortName || match.homeTeam?.name || 'Local';
  const awayName = match.awayTeam?.shortName || match.awayTeam?.name || 'Visitante';

  const [signalMode, setSignalMode] = useState('livestream');
  const [signalTrigger, setSignalTrigger] = useState(0);

  const handleWatchLive = () => {
    sounds.playClick();
    setSignalMode('livestream');
    setSignalTrigger(prev => prev + 1);
  };

  const [pitchMode, setPitchMode] = useState('betano'); // 'betano' o 'dots'
  const [isPitchExpanded, setIsPitchExpanded] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [follow, setFollow] = useState(true);
  const [teamFilter, setTeamFilter] = useState('all');
  const [playerFilter, setPlayerFilter] = useState(null);
  const [hiddenCats, setHiddenCats] = useState(() => new Set());
  const [tab, setTab] = useState('jugadas');
  const listRef = useRef(null);

  // Al cambiar de partido se reinicia la selección
  useEffect(() => {
    setSelectedId(null);
    setFollow(true);
    setTeamFilter('all');
    setPlayerFilter(null);
  }, [match.id]);

  const visiblePlays = useMemo(
    () => plays.filter(p =>
      p.category !== 'other' &&
      !hiddenCats.has(p.category) &&
      (teamFilter === 'all' || p.team === teamFilter) &&
      (!playerFilter || p.player === playerFilter)
    ),
    [plays, hiddenCats, teamFilter, playerFilter]
  );

  // En vivo: seguir la última jugada mientras el usuario no elija otra
  useEffect(() => {
    if (follow && isLive && visiblePlays.length > 0) {
      setSelectedId(visiblePlays[visiblePlays.length - 1].id);
    }
  }, [follow, isLive, visiblePlays]);

  const selected = visiblePlays.find(p => p.id === selectedId) || null;

  // Datos dinámicos para el Radar Táctico estilo Betano
  const activePlay = selected || (visiblePlays.length > 0 ? visiblePlays[visiblePlays.length - 1] : null);

  const betanoEventData = useMemo(() => {
    // 1. Estado de Descanso / Entretiempo (cuando no se está inspeccionando una jugada pasada específica)
    if (isHalf && !selected) {
      return {
        actionTitle: 'DESCANSO',
        isHalftime: true,
        isDangerous: false,
        team: 'center',
        teamName: 'Entretiempo',
        player: 'Fin del 1.er Tiempo',
        minute: `HT · Marcador: ${match.homeTeam?.score ?? 0} - ${match.awayTeam?.score ?? 0}`,
        text: 'Pausa de descanso',
        ball: { x: 52.5, y: 34 },
        target: { x: 52.5, y: 34 },
      };
    }

    // 2. Estado de Partido Finalizado
    if (isFinished && !selected) {
      return {
        actionTitle: 'FINALIZADO',
        isFinished: true,
        isDangerous: false,
        team: 'center',
        teamName: 'Partido Finalizado',
        player: `Resultado Final: ${match.homeTeam?.score ?? 0} - ${match.awayTeam?.score ?? 0}`,
        minute: 'FT · Tiempo Completo',
        text: 'Fin del partido',
        ball: { x: 52.5, y: 34 },
        target: { x: 52.5, y: 34 },
      };
    }

    // 3. Estado de Partido Por Iniciar
    if (isScheduled && !selected) {
      return {
        actionTitle: 'POR INICIAR',
        isScheduled: true,
        isDangerous: false,
        team: 'center',
        teamName: 'Próximo Encuentro',
        player: `${homeName} vs ${awayName}`,
        minute: formattedTime,
        text: 'El partido todavía no empieza',
        ball: { x: 52.5, y: 34 },
        target: { x: 52.5, y: 34 },
      };
    }

    if (!activePlay) {
      return {
        actionTitle: isLive ? 'Ataque' : 'Posesión',
        isDangerous: false,
        team: 'home',
        teamName: homeName,
        player: homeName,
        minute: formattedTime,
        ball: { x: 52.5, y: 34 },
        target: { x: 75, y: 34 },
      };
    }

    const team = activePlay.team || 'home';
    const teamName = team === 'away' ? awayName : homeName;
    const player = activePlay.player || teamName;
    const cat = activePlay.category || 'other';
    const typeText = (activePlay.typeText || '').toLowerCase();

    let actionTitle = 'Ataque';
    let isDangerous = false;

    if (cat === 'goal') {
      actionTitle = '¡GOL!';
      isDangerous = true;
    } else if (cat === 'shot') {
      if (typeText.includes('target') || typeText.includes('arco')) {
        actionTitle = 'Tiro al Arco';
      } else if (typeText.includes('blocked') || typeText.includes('bloqueado')) {
        actionTitle = 'Tiro Bloqueado';
      } else {
        actionTitle = 'Tiro';
      }
      isDangerous = true;
    } else if (cat === 'corner') {
      actionTitle = 'Córner';
      isDangerous = true;
    } else if (cat === 'foul') {
      actionTitle = 'Tiro Libre';
    } else if (cat === 'offside') {
      actionTitle = 'Fuera de Juego';
    } else if (cat === 'card') {
      actionTitle = 'Tarjeta';
    } else {
      const xCoord = activePlay.x != null ? activePlay.x : 50;
      if (xCoord > 65) {
        actionTitle = 'Ataque Peligroso';
        isDangerous = true;
      } else {
        actionTitle = 'Ataque';
      }
    }

    const basePos = toPitch(team, activePlay.x ?? 50, activePlay.y ?? 50) || {
      x: team === 'away' ? 32 : 73,
      y: 34,
    };

    const endPos = (activePlay.x2 != null && activePlay.y2 != null)
      ? toPitch(team, activePlay.x2, activePlay.y2)
      : { x: team === 'away' ? 0 : 105, y: 34 };

    return {
      actionTitle,
      isDangerous,
      team,
      teamName,
      player,
      minute: activePlay.minute || formattedTime,
      text: activePlay.text || '',
      ball: basePos,
      target: endPos,
    };
  }, [activePlay, homeName, awayName, isLive, isHalf, isFinished, isScheduled, selected, match, formattedTime]);


  const playersByTeam = useMemo(() => {
    const acc = { home: new Map(), away: new Map() };
    plays.forEach(p => {
      if (!p.player || !p.team || p.category === 'other') return;
      acc[p.team].set(p.player, (acc[p.team].get(p.player) || 0) + 1);
    });
    const sort = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { home: sort(acc.home), away: sort(acc.away) };
  }, [plays]);

  const metrics = useMemo(() => CATEGORIES.map(c => ({
    ...c,
    home: plays.filter(p => p.category === c.key && p.team === 'home').length,
    away: plays.filter(p => p.category === c.key && p.team === 'away').length,
  })), [plays]);

  const lastSeconds = plays.length ? plays[plays.length - 1].seconds : 0;
  const totalSeconds = Math.max(90 * 60, lastSeconds, isLive ? seconds : 0);
  const playheadSeconds = selected ? selected.seconds : (isLive ? seconds : isFinished ? totalSeconds : 0);
  const pct = (s) => `${Math.min(100, (s / totalSeconds) * 100)}%`;

  const selectPlay = (p) => {
    sounds.playClick();
    setFollow(false);
    setSelectedId(p.id);
    setTab('jugadas');
  };

  const toggleCat = (key) => {
    setHiddenCats(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Mantener visible en la lista la jugada seleccionada
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-play="${selectedId}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const selPos = selected ? toPitch(selected.team, selected.x, selected.y) : null;
  const selPos2 = selected ? toPitch(selected.team, selected.x2, selected.y2) : null;

  const noPlaysMsg = isScheduled
    ? 'El partido todavía no empieza. Las jugadas aparecerán aquí en cuanto ruede la pelota.'
    : 'ESPN no publica jugada a jugada con coordenadas para este partido.';

  return (
    <section className="tw" aria-label="Panel táctico">
      {/* Barra superior */}
      <div className="tw-topbar">
        <div className="tw-scorechips">
          <span className="tw-teamchip"><i style={{ background: HOME_COLOR }} />{homeName}</span>
          <span className="tw-clock">
            {isScheduled ? 'VS' : `${match.homeTeam?.score ?? 0} - ${match.awayTeam?.score ?? 0}`}
            <small>{formattedTime}</small>
          </span>
          <span className="tw-teamchip">{awayName}<i style={{ background: AWAY_COLOR }} /></span>
        </div>
        <div className="tw-source">
          <strong>Panel táctico</strong>
          <span>datos reales ESPN · {plays.length} eventos</span>
        </div>
        <div className="tw-actions">
          <button
            className={`tw-pill tw-pill-live ${signalMode === 'livestream' ? 'on' : ''}`}
            onClick={handleWatchLive}
            title="Buscar y ver transmisión en vivo de este partido"
          >
            <Tv size={13} /> Ver en vivo
          </button>
          {isLive && (
            <button
              className={`tw-pill ${follow ? 'on' : ''}`}
              onClick={() => { sounds.playClick(); setFollow(true); }}
              title="Seguir la última jugada táctica"
            >
              <Radio size={13} /> Jugadas
            </button>
          )}
          {match.espnLink && (
            <a className="tw-pill" href={match.espnLink} target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> ESPN
            </a>
          )}
          <button className="tw-pill tw-pill-primary" onClick={() => onOpenPickModal(match)}>
            <Sparkles size={13} /> Análisis con IA
          </button>
        </div>
      </div>

      <div className={`tw-grid ${isPitchExpanded ? 'tw-pitch-expanded' : ''}`}>
        {/* Video / señal */}
        <div className="tw-panel tw-video">
          <SignalPlayer
            match={match}
            externalMode={signalMode}
            onModeChange={setSignalMode}
            searchTrigger={signalTrigger}
            clips={videos}
            clipsAreMatch={hasMatchVideos}
            onClipError={(id) => setBrokenIds(prev => new Set(prev).add(id))}
            emptyText={isLive
              ? 'ESPN todavía no publicó clips de este partido. Conectá tu propia señal desde las pestañas de arriba.'
              : 'No hay clips oficiales para este partido. Conectá tu propia señal desde las pestañas de arriba.'}
            scoreOverlay={(
              <span className="sp-score">
                <span>{formattedTime}</span>
                <b>{homeName}</b>
                <em>{isScheduled ? 'vs' : `${match.homeTeam?.score ?? 0} - ${match.awayTeam?.score ?? 0}`}</em>
                <b>{awayName}</b>
              </span>
            )}
          />
        </div>

        {/* Cancha 2D + jugadores */}
        <div className="tw-panel tw-pitchcol">
          {/* Barra de control superior de la cancha estilo Betano */}
          <div className="betano-controls-bar">
            <div className="betano-mode-tabs">
              <button
                type="button"
                className={`betano-tab ${pitchMode === 'betano' ? 'active' : ''}`}
                onClick={() => { sounds.playClick(); setPitchMode('betano'); }}
              >
                <Activity size={12} /> Cancha Betano
              </button>
              <button
                type="button"
                className={`betano-tab ${pitchMode === 'dots' ? 'active' : ''}`}
                onClick={() => { sounds.playClick(); setPitchMode('dots'); }}
              >
                <Crosshair size={12} /> Jugadas ({visiblePlays.length})
              </button>
            </div>

            <div className="betano-status-actions">
              <button
                type="button"
                className={`betano-btn-expand ${isPitchExpanded ? 'active' : ''}`}
                onClick={() => { sounds.playClick(); setIsPitchExpanded(prev => !prev); }}
                title={isPitchExpanded ? "Vista normal" : "Expandir cancha"}
              >
                {isPitchExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                <span>{isPitchExpanded ? 'Reducir' : 'Expandir'}</span>
              </button>
              <button
                type="button"
                className={`betano-btn-pin ${follow ? 'active' : ''}`}
                onClick={() => { sounds.playClick(); setFollow(prev => !prev); }}
                title="Fijar evento o seguir en vivo automáticamente"
              >
                <Pin size={12} />
                <span>{follow ? 'En vivo' : 'Fijado'}</span>
              </button>
            </div>
          </div>

          <div className="tw-pitch">
            <svg viewBox={`-3 -3 ${PITCH_W + 6} ${PITCH_H + 6}`} preserveAspectRatio="xMidYMid meet">
              <rect x="-3" y="-3" width={PITCH_W + 6} height={PITCH_H + 6} fill="#0d6b3a" />
              {Array.from({ length: 10 }).map((_, i) => (
                <rect key={i} x={i * 10.5} y="0" width="10.5" height={PITCH_H} fill={i % 2 ? '#0f7440' : '#0d6b3a'} />
              ))}
              <g fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.35">
                <rect x="0" y="0" width={PITCH_W} height={PITCH_H} />
                <line x1={PITCH_W / 2} y1="0" x2={PITCH_W / 2} y2={PITCH_H} />
                <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r="9.15" />
                <rect x="0" y="13.84" width="16.5" height="40.32" />
                <rect x="0" y="24.84" width="5.5" height="18.32" />
                <rect x={PITCH_W - 16.5} y="13.84" width="16.5" height="40.32" />
                <rect x={PITCH_W - 5.5} y="24.84" width="5.5" height="18.32" />
                <path d="M16.5 26.7 A9.15 9.15 0 0 1 16.5 41.3" />
                <path d={`M${PITCH_W - 16.5} 26.7 A9.15 9.15 0 0 0 ${PITCH_W - 16.5} 41.3`} />
                <rect x="-1.8" y="30.34" width="1.8" height="7.32" />
                <rect x={PITCH_W} y="30.34" width="1.8" height="7.32" />
              </g>
              <g fill="rgba(255,255,255,0.85)">
                <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r="0.5" />
                <circle cx="11" cy={PITCH_H / 2} r="0.5" />
                <circle cx={PITCH_W - 11} cy={PITCH_H / 2} r="0.5" />
              </g>

              {/* MODO RADAR BETANO (Zona de Ataque + Vector del Balón o Descanso) */}
              {pitchMode === 'betano' && (
                <g className="betano-layer">
                  {(betanoEventData.isHalftime || betanoEventData.team === 'center') ? (
                    <g className="betano-center-halftime-layer">
                      <circle
                        cx="52.5"
                        cy="34"
                        r="9.15"
                        className="betano-center-circle-glow"
                      />
                      <circle
                        cx="52.5"
                        cy="34"
                        r="14"
                        className="betano-center-circle-pulse"
                      />
                    </g>
                  ) : (
                    <>
                      {/* Zona de Ataque sombreada (Chevron estilo Betano) */}
                      {betanoEventData.team === 'home' ? (
                        <polygon
                          className={`betano-attack-zone ${betanoEventData.isDangerous ? 'dangerous' : ''}`}
                          points="56,0 78,0 105,34 78,68 56,68 83,34"
                        />
                      ) : (
                        <polygon
                          className={`betano-attack-zone ${betanoEventData.isDangerous ? 'dangerous' : ''}`}
                          points="49,0 27,0 0,34 27,68 49,68 22,34"
                        />
                      )}

                      {/* Vector y trayectoria hacia el arco rival */}
                      <line
                        x1={betanoEventData.ball.x}
                        y1={betanoEventData.ball.y}
                        x2={betanoEventData.target.x}
                        y2={betanoEventData.target.y}
                        className="betano-vector-line"
                      />
                    </>
                  )}

                  {/* Ondas de radar expansivas del balón */}
                  <circle
                    cx={betanoEventData.ball.x}
                    cy={betanoEventData.ball.y}
                    r="3.8"
                    className="betano-ball-pulse-1"
                  />
                  <circle
                    cx={betanoEventData.ball.x}
                    cy={betanoEventData.ball.y}
                    r="6.8"
                    className="betano-ball-pulse-2"
                  />

                  {/* Balón táctico */}
                  <circle
                    cx={betanoEventData.ball.x}
                    cy={betanoEventData.ball.y}
                    r="2.2"
                    className="betano-ball"
                  />
                  <circle
                    cx={betanoEventData.ball.x}
                    cy={betanoEventData.ball.y}
                    r="0.8"
                    fill="#0f172a"
                  />
                </g>
              )}

              {/* MODO MAPA DE JUGADAS (Todos los eventos) */}
              {pitchMode === 'dots' && visiblePlays.map(p => {
                const pos = toPitch(p.team, p.x, p.y);
                if (!pos || p.id === selectedId) return null;
                return (
                  <circle
                    key={p.id}
                    className="tw-dot"
                    cx={pos.x}
                    cy={pos.y}
                    r={p.category === 'goal' ? 1.9 : 1.3}
                    fill={p.team === 'away' ? AWAY_COLOR : HOME_COLOR}
                    stroke={p.category === 'goal' ? '#fff' : 'rgba(0,0,0,0.45)'}
                    strokeWidth={p.category === 'goal' ? 0.5 : 0.25}
                    opacity={selected ? 0.4 : 0.85}
                    onClick={() => selectPlay(p)}
                  >
                    <title>{`${p.minute} · ${TYPE_ES[p.typeText] || p.typeText}${p.player ? ' · ' + p.player : ''}`}</title>
                  </circle>
                );
              })}

              {pitchMode === 'dots' && selected && selPos && (
                <g>
                  {selPos2 && (
                    <>
                      <line
                        x1={selPos.x} y1={selPos.y} x2={selPos2.x} y2={selPos2.y}
                        stroke="#fff" strokeWidth="0.5" strokeDasharray="1.4 1"
                      />
                      <circle cx={selPos2.x} cy={selPos2.y} r="0.9" fill="#fff" />
                    </>
                  )}
                  <circle className="tw-pulse" cx={selPos.x} cy={selPos.y} r="3.4" fill="none" stroke="#fff" strokeWidth="0.4" />
                  <circle
                    cx={selPos.x} cy={selPos.y} r="2.1"
                    fill={selected.team === 'away' ? AWAY_COLOR : HOME_COLOR}
                    stroke="#fff" strokeWidth="0.5"
                  />
                </g>
              )}
            </svg>

            {/* OVERLAY CENTRAL ESTILO BETANO */}
            {pitchMode === 'betano' && (
              <div className="betano-center-box">
                <div className={`betano-action-label ${betanoEventData.isDangerous ? 'danger' : ''} ${betanoEventData.isHalftime ? 'halftime' : ''}`}>
                  {betanoEventData.isHalftime ? '☕ DESCANSO' : betanoEventData.actionTitle}
                </div>
                <div className="betano-player-name">
                  {betanoEventData.player}
                </div>
                {betanoEventData.minute && (
                  <div className="betano-minute-tag">
                    {betanoEventData.minute}
                  </div>
                )}
              </div>
            )}

            <div className="tw-pitch-legend">
              <span><i style={{ background: HOME_COLOR }} />{homeName} →</span>
              <span>← {awayName}<i style={{ background: AWAY_COLOR }} /></span>
            </div>

            {pitchMode === 'dots' && selected && (
              <div className={`tw-action ${selected.team === 'away' ? 'away' : 'home'}`}>
                <b>{TYPE_ES[selected.typeText] || selected.typeText}</b>
                <span>{selected.team === 'away' ? awayName : homeName}{selected.player ? ` · ${selected.player}` : ''}</span>
                <time>{selected.minute}</time>
                {!selPos && <small>sin posición</small>}
              </div>
            )}
            {plays.length === 0 && <div className="tw-pitch-empty">{noPlaysMsg}</div>}
          </div>

          <div className="tw-players">
            <div className="tw-players-head">
              <Crosshair size={12} />
              <span>Mapa de jugadas · elegí un jugador</span>
              {playerFilter && (
                <button onClick={() => setPlayerFilter(null)}>Limpiar</button>
              )}
            </div>
            <div className="tw-players-cols">
              {[['home', homeName, HOME_COLOR], ['away', awayName, AWAY_COLOR]].map(([side, name, color]) => (
                <div key={side}>
                  <div className="tw-players-team">
                    <i style={{ background: color }} />{name}
                    <small>{playersByTeam[side].length}</small>
                  </div>
                  <div className="tw-chips">
                    {playersByTeam[side].length === 0 && <span className="tw-muted">Sin datos</span>}
                    {playersByTeam[side].map(([player, count]) => (
                      <button
                        key={player}
                        className={`tw-chip ${playerFilter === player ? 'active' : ''}`}
                        onClick={() => {
                          sounds.playClick();
                          setPlayerFilter(playerFilter === player ? null : player);
                          setTeamFilter('all');
                        }}
                      >
                        {player} <small>{count}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel de jugadas / métricas */}
        <div className="tw-panel tw-side">
          <div className="tw-tabs">
            <button className={tab === 'jugadas' ? 'active' : ''} onClick={() => setTab('jugadas')}>
              Jugadas · {visiblePlays.length}
            </button>
            <button className={tab === 'metricas' ? 'active' : ''} onClick={() => setTab('metricas')}>Métricas</button>
            <button className={tab === 'filtros' ? 'active' : ''} onClick={() => setTab('filtros')}>Filtros</button>
          </div>

          {tab === 'jugadas' && (
            <div className="tw-list" ref={listRef}>
              {visiblePlays.length === 0 && (
                <p className="tw-muted tw-list-empty">{plays.length === 0 ? noPlaysMsg : 'Ninguna jugada coincide con los filtros.'}</p>
              )}
              {visiblePlays.map(p => (
                <button
                  key={p.id}
                  data-play={p.id}
                  className={`tw-play ${p.id === selectedId ? 'active' : ''}`}
                  onClick={() => selectPlay(p)}
                >
                  <time>{p.minute}</time>
                  <i style={{ background: p.team === 'away' ? AWAY_COLOR : HOME_COLOR }} />
                  <span>
                    <b style={{ color: CAT_BY_KEY[p.category]?.color }}>{TYPE_ES[p.typeText] || p.typeText}</b>
                    {p.player && <> · {p.player}</>}
                    {p.id === selectedId && p.text && <small>{p.text}</small>}
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab === 'metricas' && (
            <div className="tw-metrics">
              <div className="tw-metric tw-metric-head">
                <b style={{ color: HOME_COLOR }}>{homeName}</b>
                <span />
                <b style={{ color: AWAY_COLOR }}>{awayName}</b>
              </div>
              {metrics.map(m => {
                const total = m.home + m.away || 1;
                return (
                  <div key={m.key} className="tw-metric">
                    <b>{m.home}</b>
                    <span>
                      {m.label}
                      <em>
                        <i style={{ width: `${(m.home / total) * 100}%`, background: HOME_COLOR }} />
                        <i style={{ width: `${(m.away / total) * 100}%`, background: AWAY_COLOR }} />
                      </em>
                    </span>
                    <b>{m.away}</b>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'filtros' && (
            <div className="tw-filters">
              <h5>Equipo</h5>
              <div className="tw-chips">
                {[['all', 'Ambos'], ['home', homeName], ['away', awayName]].map(([k, l]) => (
                  <button key={k} className={`tw-chip ${teamFilter === k ? 'active' : ''}`} onClick={() => setTeamFilter(k)}>{l}</button>
                ))}
              </div>
              <h5>Tipo de jugada</h5>
              <div className="tw-chips">
                {CATEGORIES.map(c => (
                  <button
                    key={c.key}
                    className={`tw-chip ${hiddenCats.has(c.key) ? '' : 'active'}`}
                    onClick={() => toggleCat(c.key)}
                  >
                    <i style={{ background: c.color }} />{c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Línea de tiempo */}
      <div className="tw-panel tw-timeline">
        <div className="tw-timeline-head">
          <span>Jugadas · {visiblePlays.length}</span>
          <small>Clic en una jugada para verla en la cancha</small>
        </div>
        <div className="tw-rows">
          {CATEGORIES.map(c => (
            <div key={c.key} className={`tw-row ${hiddenCats.has(c.key) ? 'off' : ''}`}>
              <button className="tw-row-label" onClick={() => toggleCat(c.key)} title="Mostrar / ocultar">
                <i style={{ background: c.color }} />{c.label}
              </button>
              <div className="tw-track">
                {visiblePlays.filter(p => p.category === c.key).map(p => (
                  <button
                    key={p.id}
                    className={`tw-tick ${p.id === selectedId ? 'active' : ''}`}
                    style={{ left: pct(p.seconds), background: c.color, borderColor: p.team === 'away' ? AWAY_COLOR : HOME_COLOR }}
                    onClick={() => selectPlay(p)}
                    title={`${p.minute} · ${TYPE_ES[p.typeText] || p.typeText}${p.player ? ' · ' + p.player : ''}`}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="tw-playhead-wrap">
            <div className="tw-playhead" style={{ left: pct(playheadSeconds) }} />
          </div>
        </div>
        <div className="tw-axis">
          <span />
          <div>
            <em style={{ left: '0%' }}>0'</em>
            <em style={{ left: pct(45 * 60) }}>45'</em>
            <em style={{ left: pct(90 * 60) }}>90'</em>
          </div>
        </div>
      </div>
    </section>
  );
}

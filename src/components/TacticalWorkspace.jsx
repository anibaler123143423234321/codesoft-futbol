import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Crosshair, Tv, Maximize2, Minimize2, Pin, Activity, Users } from 'lucide-react';
import { sounds } from '../utils/soundEffects';
import { useLiveMatchTimer } from '../hooks/useLiveMatchTimer';
import { fetchEspnLatestVideos } from '../api/espnApi';
import SignalPlayer from './SignalPlayer';
import LineupPitch from './LineupPitch';
import { buildLiveView, isStageKind } from '../utils/livePitch';
import LivePlayScene, { LiveCallout } from './LivePlayScene';
import { PlayIcon } from './SportIcon';
import AiMatchChat from './AiMatchChat';
import { playIconKind } from '../utils/playIconKind';
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

// Colores de camiseta del flujo en vivo, con respaldo si faltan, se confunden entre sí o con el césped
const PITCH_GREEN = '#0f7440';
function hexDist(a, b) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
function kitColors(tc) {
  const ok = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) && hexDist(c, PITCH_GREEN) > 80;
  const home = ok(tc?.home) ? tc.home : HOME_COLOR;
  let away = ok(tc?.away) ? tc.away : AWAY_COLOR;
  if (hexDist(home, away) < 90) away = hexDist(home, AWAY_COLOR) < 90 ? HOME_COLOR : AWAY_COLOR;
  return { home, away };
}

// Coordenadas Opta (0-100 desde el arco propio) → cancha con el local atacando a la derecha
function toPitch(team, x, y) {
  if (x == null || y == null) return null;
  const px = team === 'away' ? 100 - x : x;
  const py = team === 'away' ? y : 100 - y;
  return { x: (px / 100) * PITCH_W, y: (py / 100) * PITCH_H };
}


export default function TacticalWorkspace({ match, aiMatch = null, aiReady = true, aiRefreshKey = 0, liveOddsData = null, livePitch = null, sourceLive = false }) {
  const { formattedTime, seconds, isLive, isFinished, isScheduled, isHalftime } = useLiveMatchTimer(match);

  const isHalf = isHalftime || 
    formattedTime === 'HT' || 
    match?.minute === 'HT' || 
    match?.status === 'halftime' || 
    match?.rawEspnStatus?.detail === 'HT' || 
    match?.rawEspnStatus?.name?.includes('HALFTIME');

  const plays = useMemo(() => match.plays || [], [match.plays]);
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

  // La TV solo se monta con su pestaña abierta: así no gasta la cuota de la API de transmisiones.
  // Arranca en clips de ESPN; la búsqueda de la señal en vivo solo corre cuando se pide.
  const [signalMode, setSignalMode] = useState('clips');

  const [pitchMode, setPitchMode] = useState('lineup'); // 'lineup', 'betano' (jugada en vivo), 'dots' o 'tv'
  const isTv = pitchMode === 'tv';

  const openMode = (next) => {
    sounds.playClick();
    setPitchMode(next);
  };
  const [isPitchExpanded, setIsPitchExpanded] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [follow, setFollow] = useState(true);
  const [teamFilter, setTeamFilter] = useState('all');
  const [playerFilter, setPlayerFilter] = useState(null);
  const [hiddenCats, setHiddenCats] = useState(() => new Set());
  const [tab, setTab] = useState('jugadas');
  // El chat de IA se monta al abrir su pestaña y queda montado para no perder la conversación
  const [aiOpened, setAiOpened] = useState(false);
  const openTab = (next) => {
    sounds.playClick();
    if (next === 'ia') setAiOpened(true);
    setTab(next);
  };
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

  // Jugadas en tiempo real (extensión): balón, estela, jugador y tipo de acción
  const liveView = useMemo(
    () => buildLiveView(livePitch?.events, { teamIds: liveOddsData?.teamIds, players: liveOddsData?.players }),
    [livePitch?.events, liveOddsData?.teamIds, liveOddsData?.players],
  );

  const betanoEventData = useMemo(() => {
    // 1. Tiempo real: manda mientras la fuente siga en vivo, aunque ESPN ya marque descanso o final
    // (el tiempo añadido sigue). Si el usuario eligió una jugada (sin seguir el vivo), se respeta.
    if (liveView && sourceLive && (follow || !selected) && !liveView.isBreak) {
      const team = liveView.side || 'center';
      const teamName = team === 'away' ? awayName : team === 'home' ? homeName : '';
      return {
        actionTitle: liveView.label,
        isDangerous: liveView.dangerous,
        team,
        teamName,
        player: liveView.player ? `${liveView.player} · ${teamName}` : teamName,
        minute: liveView.minute || formattedTime,
        ball: liveView.ball,
        target: liveView.target,
        trail: liveView.trail,
        isRealtime: true,
        scene: liveView,
      };
    }

    // 1. Estado de Descanso / Entretiempo (cuando no se está inspeccionando una jugada pasada específica)
    // Con "seguir el vivo" activo, la última jugada elegida sola no debe tapar el descanso ni el final
    if (isHalf && (follow || !selected)) {
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
    if (isFinished && (follow || !selected)) {
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
    if (isScheduled && (follow || !selected)) {
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
  }, [activePlay, homeName, awayName, isLive, isHalf, isFinished, isScheduled, selected, match, formattedTime, liveView, follow, sourceLive]);

  const kit = useMemo(() => kitColors(liveOddsData?.teamColors), [liveOddsData?.teamColors]);
  const legendColors = pitchMode === 'betano' && betanoEventData.isRealtime ? kit : { home: HOME_COLOR, away: AWAY_COLOR };
  // Cartel del gol: la jugada llega antes que el marcador de la fuente, así que se parte del
  // resultado que había justo antes del gol y se le suma, sin quedar nunca por debajo del real
  const liveHome = Number(liveOddsData?.home?.score);
  const liveAway = Number(liveOddsData?.away?.score);
  const liveScore = Number.isFinite(liveHome) && Number.isFinite(liveAway) ? { home: liveHome, away: liveAway } : null;
  const sceneKind = betanoEventData.isRealtime ? betanoEventData.scene.kind : null;
  const preGoal = useRef(null);
  useEffect(() => {
    if (sceneKind !== 'goal' && liveScore) preGoal.current = liveScore;
  });
  let goalBoard = null;
  if (sceneKind === 'goal' && liveScore) {
    const before = preGoal.current || liveScore;
    const side = betanoEventData.scene.side;
    const expected = {
      home: before.home + (preGoal.current && side === 'home' ? 1 : 0),
      away: before.away + (preGoal.current && side === 'away' ? 1 : 0),
    };
    goalBoard = {
      home: Math.max(expected.home, liveScore.home),
      away: Math.max(expected.away, liveScore.away),
      homeCode: liveOddsData?.home?.code,
      awayCode: liveOddsData?.away?.code,
      homeName,
      awayName,
    };
  }

  // Halo del balón con el color del equipo que tiene la jugada (solo en tiempo real)
  const ballTint = betanoEventData.isRealtime && betanoEventData.team !== 'center'
    ? { stroke: betanoEventData.team === 'away' ? kit.away : kit.home }
    : undefined;

  // Qué está pasando con la jugada en vivo (para no caer en silencio a las jugadas de ESPN)
  const liveChip = useMemo(() => {
    if (pitchMode !== 'betano' || !livePitch) return null;
    if (betanoEventData.isRealtime) return { tone: 'live', text: isFinished ? 'Tiempo real · aún en juego' : 'Tiempo real' };
    if (!isLive) return null;
    const ext = livePitch.extension;
    if (ext === undefined || liveView?.isBreak) return null;
    if (ext === null) return import.meta.env.DEV ? { tone: 'muted', text: 'Sin extensión · jugadas de ESPN' } : null;
    if (!livePitch.supported) return { tone: 'warn', text: 'Actualiza la extensión (chrome://extensions → recargar) para ver la jugada en vivo' };
    if (liveView && !follow) return { tone: 'muted', text: 'Viendo una jugada elegida' };
    if (livePitch.status === 'not-found') return { tone: 'muted', text: 'Este partido no tiene jugada en vivo · jugadas de ESPN' };
    if (livePitch.status === 'opening') return { tone: 'muted', text: 'Abriendo la fuente de datos…' };
    if (livePitch.status === 'error') return { tone: 'warn', text: 'La jugada en vivo no responde · reintentando' };
    if (livePitch.events?.length && !liveOddsData) return { tone: 'muted', text: 'Cargando equipos…' };
    return { tone: 'muted', text: 'Conectando con la jugada en vivo…' };
  }, [pitchMode, isLive, isFinished, livePitch, betanoEventData.isRealtime, liveView, follow, liveOddsData]);


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
      <div className={`tw-grid ${isPitchExpanded ? 'tw-pitch-expanded' : ''}`}>
        {/* Cancha 2D, jugadores y TV en un mismo panel */}
        <div className={`tw-panel tw-pitchcol ${isTv ? 'is-tv' : ''}`}>
          {/* Barra de control superior de la cancha estilo Betano */}
          <div className="betano-controls-bar">
            <div className="betano-mode-tabs">
              <button
                type="button"
                className={`betano-tab ${pitchMode === 'lineup' ? 'active' : ''}`}
                aria-pressed={pitchMode === 'lineup'}
                onClick={() => openMode('lineup')}
              >
                <Users size={12} /> Alineaciones
              </button>
              <button
                type="button"
                className={`betano-tab ${pitchMode === 'betano' ? 'active' : ''}`}
                aria-pressed={pitchMode === 'betano'}
                onClick={() => openMode('betano')}
              >
                <Activity size={12} /> Jugada en vivo
              </button>
              <button
                type="button"
                className={`betano-tab ${pitchMode === 'dots' ? 'active' : ''}`}
                aria-pressed={pitchMode === 'dots'}
                onClick={() => openMode('dots')}
              >
                <Crosshair size={12} /> Jugadas ({visiblePlays.length})
              </button>
              <button
                type="button"
                className={`betano-tab ${isTv ? 'active' : ''}`}
                aria-pressed={isTv}
                onClick={() => openMode('tv')}
                title="Clips y señal del partido"
              >
                <Tv size={12} /> TV
              </button>
            </div>

            {!isTv && (
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
            )}
          </div>

          {isTv ? (
            <div className="tw-tv">
              <SignalPlayer
              match={match}
              externalMode={signalMode}
              onModeChange={setSignalMode}
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
          ) : pitchMode === 'lineup' ? (
            <LineupPitch
              rosters={match.rosters || []}
              homeName={homeName}
              awayName={awayName}
              homeColor={HOME_COLOR}
              awayColor={AWAY_COLOR}
            />
          ) : (
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
                  {betanoEventData.isRealtime ? (
                    <>
                      {betanoEventData.trail?.length > 1 && (
                        <g className="live-trail">
                          <polyline points={betanoEventData.trail.map(p => `${p.x},${p.y}`).join(' ')} />
                          {betanoEventData.trail.slice(0, -1).map((p, i, arr) => (
                            <circle key={i} cx={p.x} cy={p.y} r="0.9" style={{ opacity: 0.25 + (0.6 * (i + 1)) / arr.length }} />
                          ))}
                        </g>
                      )}
                      <LivePlayScene
                        key={betanoEventData.scene.key}
                        view={betanoEventData.scene}
                        homeColor={kit.home}
                        awayColor={kit.away}
                        teamName={betanoEventData.teamName}
                        goal={goalBoard}
                      />
                    </>
                  ) : (betanoEventData.isHalftime || betanoEventData.team === 'center') ? (
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
                    <line
                      x1={betanoEventData.ball.x}
                      y1={betanoEventData.ball.y}
                      x2={betanoEventData.target.x}
                      y2={betanoEventData.target.y}
                      className="betano-vector-line"
                    />
                  )}

                  {/* En las pausas (cambio, lesión, VAR…) el centro lo ocupa la escena: sin balón */}
                  {!(betanoEventData.isRealtime && isStageKind(betanoEventData.scene.kind)) && (
                    <>
                      {/* Ondas de radar expansivas del balón (en tiempo real, con el color del equipo) */}
                      <circle
                        cx={betanoEventData.ball.x}
                        cy={betanoEventData.ball.y}
                        r="3.8"
                        className="betano-ball-pulse-1"
                        style={ballTint}
                      />
                      <circle
                        cx={betanoEventData.ball.x}
                        cy={betanoEventData.ball.y}
                        r="6.8"
                        className="betano-ball-pulse-2"
                        style={ballTint}
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
                    </>
                  )}

                  {/* Rótulo junto al balón (tiempo real); en el gol y el VAR lo reemplaza la escena */}
                  {betanoEventData.isRealtime && betanoEventData.scene.kind !== 'goal' && !isStageKind(betanoEventData.scene.kind) && (
                    <LiveCallout
                      view={betanoEventData.scene}
                      color={betanoEventData.team === 'away' ? kit.away : kit.home}
                      teamName={betanoEventData.teamName}
                    />
                  )}
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
            {liveChip && (
              <div className={`tw-live-chip ${liveChip.tone}`} role="status">
                <i />
                {liveChip.text}
              </div>
            )}

            {pitchMode === 'betano' && !betanoEventData.isRealtime && (
              <div className="betano-center-box">
                <div className={`betano-action-label ${betanoEventData.isDangerous ? 'danger' : ''} ${betanoEventData.isHalftime ? 'halftime' : ''}`}>
                  {betanoEventData.isHalftime ? 'DESCANSO' : betanoEventData.actionTitle}
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
              <span><i style={{ background: legendColors.home }} />{homeName} →</span>
              <span>← {awayName}<i style={{ background: legendColors.away }} /></span>
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
          )}

          {!isTv && (
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
          )}
        </div>

        {/* Panel de jugadas / métricas */}
        <div className={`tw-panel tw-side ${tab === 'ia' ? 'is-ai' : ''}`}>
          <div className="tw-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'jugadas'} className={tab === 'jugadas' ? 'active' : ''} onClick={() => openTab('jugadas')}>
              Jugadas · {visiblePlays.length}
            </button>
            <button role="tab" aria-selected={tab === 'metricas'} className={tab === 'metricas' ? 'active' : ''} onClick={() => openTab('metricas')}>Métricas</button>
            <button role="tab" aria-selected={tab === 'filtros'} className={tab === 'filtros' ? 'active' : ''} onClick={() => openTab('filtros')}>Filtros</button>
            <button role="tab" aria-selected={tab === 'ia'} className={`tw-tab-ai ${tab === 'ia' ? 'active' : ''}`} onClick={() => openTab('ia')}>
              <Sparkles size={12} /> IA
            </button>
          </div>

          {aiOpened && (
            <div className="tw-ai" hidden={tab !== 'ia'}>
              <AiMatchChat match={aiMatch || match} ready={aiReady} refreshKey={aiRefreshKey} />
            </div>
          )}

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
                  <span className="tw-play-icon">
                    <PlayIcon kind={playIconKind(p.category, p.typeText)} size={15} />
                  </span>
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
                    <PlayIcon kind={playIconKind(c.key)} size={12} />{c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Línea de tiempo: una fila por tipo de jugada, un carril por equipo */}
      <div className="tw-panel tw-timeline">
        <div className="tw-timeline-head">
          <span>Jugadas · {visiblePlays.length}</span>
          <div className="tw-tl-legend" aria-label="Colores de cada equipo">
            <span><i style={{ background: HOME_COLOR }} />{homeName} <small>arriba</small></span>
            <span><i style={{ background: AWAY_COLOR }} />{awayName} <small>abajo</small></span>
          </div>
        </div>
        <div className="tw-rows">
          {CATEGORIES.map(c => {
            const m = metrics.find(x => x.key === c.key);
            return (
              <div key={c.key} className={`tw-row ${hiddenCats.has(c.key) ? 'off' : ''}`}>
                <button className="tw-row-label" onClick={() => toggleCat(c.key)} title="Mostrar / ocultar">
                  <PlayIcon kind={playIconKind(c.key)} size={13} />{c.label}
                  <span className="tw-row-count" aria-label={`${homeName} ${m.home}, ${awayName} ${m.away}`}>
                    <b style={{ color: HOME_COLOR }}>{m.home}</b>·<b style={{ color: AWAY_COLOR }}>{m.away}</b>
                  </span>
                </button>
                <div className="tw-track">
                  {visiblePlays.filter(p => p.category === c.key).map(p => {
                    const teamName = p.team === 'away' ? awayName : p.team === 'home' ? homeName : 'Sin equipo';
                    const label = `${p.minute} · ${TYPE_ES[p.typeText] || p.typeText}${p.player ? ' · ' + p.player : ''} · ${teamName}`;
                    return (
                      <button
                        key={p.id}
                        className={`tw-tick ${p.team === 'away' ? 'away' : p.team === 'home' ? 'home' : 'none'} ${p.id === selectedId ? 'active' : ''}`}
                        style={{ left: pct(p.seconds), background: p.team === 'away' ? AWAY_COLOR : p.team === 'home' ? HOME_COLOR : '#94a3b8' }}
                        onClick={() => selectPlay(p)}
                        aria-label={label}
                        data-tip={label}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
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
        {selected ? (
          <div className="tw-tl-detail" aria-live="polite">
            <span className="tw-tl-min">{selected.minute}</span>
            <span className="tw-tl-team" style={{ '--team': selected.team === 'away' ? AWAY_COLOR : HOME_COLOR }}>
              {selected.team === 'away' ? awayName : selected.team === 'home' ? homeName : 'Sin equipo'}
            </span>
            <b>{TYPE_ES[selected.typeText] || selected.typeText}</b>
            {selected.player && <span>{selected.player}{selected.player2 ? ` → ${selected.player2}` : ''}</span>}
            {selected.text && <p>{selected.text}</p>}
          </div>
        ) : (
          <p className="tw-tl-hint">Tocá un punto para ver minuto, equipo y jugador.</p>
        )}
      </div>
    </section>
  );
}

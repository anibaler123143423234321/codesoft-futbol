import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Sparkles, Radio, Crosshair } from 'lucide-react';
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
  const { formattedTime, seconds, isLive, isFinished, isScheduled } = useLiveMatchTimer(match);

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
          {isLive && (
            <button
              className={`tw-pill ${follow ? 'on' : ''}`}
              onClick={() => { sounds.playClick(); setFollow(true); }}
              title="Seguir la última jugada"
            >
              <Radio size={13} /> En vivo
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

      <div className="tw-grid">
        {/* Video / señal */}
        <div className="tw-panel tw-video">
          <SignalPlayer
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

              {visiblePlays.map(p => {
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

              {selected && selPos && (
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

            <div className="tw-pitch-legend">
              <span><i style={{ background: HOME_COLOR }} />{homeName} →</span>
              <span>← {awayName}<i style={{ background: AWAY_COLOR }} /></span>
            </div>

            {selected && (
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Search, X, Check, AlertTriangle, Target, TrendingUp, Play, RotateCw } from 'lucide-react';
import { generateMatchAIPick } from '../api/cerebrasAi';
import { sounds } from '../utils/soundEffects';
import TeamLogo from './TeamLogo';
import '../picks.css';

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'live', label: 'En vivo' },
  { key: 'odds', label: 'Con cuotas' },
];

const fmtOdds = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 1 ? n.toFixed(2) : '—';
};
const clampPct = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

function statusLabel(m) {
  if (m.status === 'live') return { text: `EN VIVO${m.minute ? ` · ${m.minute}` : ''}`, cls: 'live' };
  if (m.status === 'finished') return { text: 'Finalizado', cls: 'done' };
  return { text: m.date || 'Por iniciar', cls: '' };
}

export default function AIPicksView({ matches = [], onSelectMatch, onOpenPickModal }) {
  const [selectedId, setSelectedId] = useState(() => (matches.find(m => m.status === 'live') || matches[0])?.id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  // { matchId, data } cuando hay resultado; el estado de carga guarda el partido en análisis
  const [result, setResult] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const resultRef = useRef(null);

  const selected = matches.find(m => m.id === selectedId) || matches[0];
  const liveCount = matches.filter(m => m.status === 'live').length;
  const oddsCount = matches.filter(m => m.oddsInfo?.hasMoneyline).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matches.filter(m => {
      if (filter === 'live' && m.status !== 'live') return false;
      if (filter === 'odds' && !m.oddsInfo?.hasMoneyline) return false;
      if (!q) return true;
      return [m.homeTeam?.name, m.awayTeam?.name, m.leagueName].some(t => (t || '').toLowerCase().includes(q));
    });
  }, [matches, query, filter]);

  // Cronómetro mientras la IA trabaja
  useEffect(() => {
    if (!loadingId) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [loadingId]);

  const analyze = async (match) => {
    if (!match || loadingId) return;
    sounds.playClick();
    setSelectedId(match.id);
    setLoadingId(match.id);
    setResult(null);
    // En móvil el panel queda arriba de la lista: llevar la vista al resultado
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    try {
      const data = await generateMatchAIPick(match);
      setResult({ matchId: match.id, data });
      if (data?.source === 'ai') sounds.playGoalChime();
    } catch (e) {
      console.error(e);
      setResult({ matchId: match.id, data: null });
    } finally {
      setLoadingId(null);
    }
  };

  const pick = result?.matchId === selected?.id ? result.data : null;
  const isLoading = loadingId === selected?.id;
  const pct = clampPct(pick?.probabilidad);
  const reason = pick?.motivo_principal || pick?.justificacion;
  const detail = pick?.analisis_detallado && pick.analisis_detallado !== reason ? pick.analisis_detallado : null;

  return (
    <div className="ap" id="ai-picks-view">
      {/* Encabezado */}
      <header className="ap-head">
        <div>
          <span className="ap-eyebrow"><Sparkles size={13} /> Análisis con IA</span>
          <h1>Pronósticos con IA</h1>
          <p>
            Elegí un partido y la IA lee marcador, estadísticas oficiales de ESPN, forma reciente y cuotas
            para proponer una selección con su probabilidad y el motivo. Son pronósticos orientativos, no garantías.
          </p>
        </div>
        <dl className="ap-stats">
          <div><dt>Partidos hoy</dt><dd>{matches.length}</dd></div>
          <div><dt>En vivo</dt><dd className={liveCount ? 'live' : ''}>{liveCount}</dd></div>
          <div><dt>Con cuotas</dt><dd>{oddsCount}</dd></div>
        </dl>
      </header>

      <div className="ap-grid">
        {/* Panel de análisis */}
        <section className="ap-panel ap-analyzer" aria-label="Análisis del partido elegido" ref={resultRef}>
          {selected ? (
            <>
              <div className="ap-match">
                <div className="ap-match-top">
                  <span className="ap-league">{selected.leagueName || 'Fútbol'}</span>
                  <span className={`ap-status ${statusLabel(selected).cls}`}>{statusLabel(selected).text}</span>
                </div>
                <div className="ap-teams">
                  <div className="ap-team">
                    <TeamLogo src={selected.homeTeam?.logo} alt={selected.homeTeam?.name} size={40} isHome />
                    <span>{selected.homeTeam?.name}</span>
                  </div>
                  <div className="ap-score">
                    {selected.status === 'scheduled'
                      ? <b className="vs">VS</b>
                      : <b>{selected.homeTeam?.score ?? 0}<i>-</i>{selected.awayTeam?.score ?? 0}</b>}
                  </div>
                  <div className="ap-team away">
                    <span>{selected.awayTeam?.name}</span>
                    <TeamLogo src={selected.awayTeam?.logo} alt={selected.awayTeam?.name} size={40} isHome={false} />
                  </div>
                </div>

                {selected.oddsInfo?.hasMoneyline ? (
                  <div className="ap-odds" aria-label={`Cuotas de ${selected.oddsInfo.provider}`}>
                    <div><small>1</small><b>{fmtOdds(selected.oddsInfo.homeOdds)}</b></div>
                    <div><small>X</small><b>{fmtOdds(selected.oddsInfo.drawOdds)}</b></div>
                    <div><small>2</small><b>{fmtOdds(selected.oddsInfo.awayOdds)}</b></div>
                    <span>{selected.oddsInfo.provider}{selected.oddsInfo.overUnder ? ` · ${selected.oddsInfo.overUnder}` : ''}</span>
                  </div>
                ) : (
                  <p className="ap-no-odds">Sin cuotas publicadas para este partido</p>
                )}

                <div className="ap-actions">
                  <button className="ap-btn primary" onClick={() => analyze(selected)} disabled={!!loadingId}>
                    {isLoading
                      ? <><RotateCw size={15} className="ap-spin" /> Analizando…</>
                      : <><Sparkles size={15} /> {pick ? 'Volver a analizar' : 'Analizar con IA'}</>}
                  </button>
                  <button className="ap-btn" onClick={() => { sounds.playClick(); onSelectMatch(selected); }}>
                    <Play size={14} /> Ver partido
                  </button>
                  <button className="ap-btn ghost" onClick={() => onOpenPickModal(selected)}>
                    Todos los mercados
                  </button>
                </div>
              </div>

              {/* Resultado */}
              <div className="ap-result" aria-live="polite">
                {isLoading && (
                  <div className="ap-loading" role="status">
                    <div className="ap-loader"><i /><i /><i /></div>
                    <b>Analizando el partido…</b>
                    <span>La IA está leyendo marcador, estadísticas y cuotas · {elapsed}s</span>
                  </div>
                )}

                {!isLoading && !pick && result?.matchId === selected.id && (
                  <div className="ap-empty warn" role="alert">
                    <AlertTriangle size={22} />
                    <b>No se pudo generar el análisis</b>
                    <span>Probá de nuevo en unos segundos.</span>
                  </div>
                )}

                {!isLoading && !pick && result?.matchId !== selected.id && (
                  <div className="ap-empty">
                    <Target size={22} />
                    <b>Listo para analizar</b>
                    <span>Tocá “Analizar con IA” para generar el pronóstico de este partido.</span>
                  </div>
                )}

                {!isLoading && pick && (
                  <article className="ap-card">
                    <div className={`ap-source ${pick.source === 'ai' ? 'ok' : 'warn'}`}>
                      {pick.source === 'ai'
                        ? <><Check size={13} /> Generado por IA</>
                        : <><AlertTriangle size={13} /> Estimación estadística: la IA no respondió</>}
                    </div>

                    <div className="ap-card-main">
                      <div className="ap-card-info">
                        <span className="ap-eyebrow"><Target size={12} /> Selección recomendada</span>
                        <h3>{pick.pick}</h3>
                        {reason && <p className="ap-reason">{reason.replace(/^¿Por qué este pick\?:\s*/i, '')}</p>}
                      </div>
                      <div className="ap-card-side">
                        <div className="ap-cuota"><small>Cuota</small><b>{fmtOdds(pick.cuota)}</b></div>
                        <div className="ap-conf">
                          <div><small>Confianza</small><b>{pct}%</b></div>
                          <div className="ap-bar"><i style={{ width: `${pct}%` }} /></div>
                        </div>
                      </div>
                    </div>

                    {detail && (
                      <div className="ap-detail">
                        <span className="ap-eyebrow">Análisis</span>
                        <p>{detail}</p>
                      </div>
                    )}

                    {(pick.claves_metricas?.length > 0 || pick.stake) && (
                      <div className="ap-chips">
                        {(pick.claves_metricas || []).map((m, i) => <span key={i}>{m}</span>)}
                        {pick.stake && <span className="stake"><TrendingUp size={12} /> {pick.stake}</span>}
                      </div>
                    )}
                  </article>
                )}
              </div>
            </>
          ) : (
            <div className="ap-empty"><b>No hay partidos disponibles</b></div>
          )}
        </section>

        {/* Lista de partidos */}
        <aside className="ap-panel ap-list" aria-label="Partidos de hoy">
          <div className="ap-list-head">
            <div className="ap-search">
              <Search size={15} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar equipo o liga"
                aria-label="Buscar equipo o liga"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Borrar búsqueda"><X size={14} /></button>
              )}
            </div>
            <div className="ap-filters" role="tablist" aria-label="Filtrar partidos">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  className={filter === f.key ? 'active' : ''}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="ap-rows">
            {visible.length === 0 && <li className="ap-rows-empty">Ningún partido coincide.</li>}
            {visible.map(m => {
              const st = statusLabel(m);
              const active = m.id === selected?.id;
              return (
                <li key={m.id}>
                  <button
                    className={`ap-row ${active ? 'active' : ''}`}
                    onClick={() => { sounds.playClick(); setSelectedId(m.id); }}
                    aria-current={active ? 'true' : undefined}
                  >
                    <span className="ap-row-teams">
                      <span><TeamLogo src={m.homeTeam?.logo} alt={m.homeTeam?.name} size={18} isHome />{m.homeTeam?.shortName || m.homeTeam?.name}</span>
                      <span><TeamLogo src={m.awayTeam?.logo} alt={m.awayTeam?.name} size={18} isHome={false} />{m.awayTeam?.shortName || m.awayTeam?.name}</span>
                    </span>
                    <span className="ap-row-score">
                      {m.status === 'scheduled' ? null : <><b>{m.homeTeam?.score ?? 0}</b><b>{m.awayTeam?.score ?? 0}</b></>}
                    </span>
                    <span className="ap-row-meta">
                      <small className={st.cls}>{st.text}</small>
                      {m.oddsInfo?.hasMoneyline && (
                        <small className="ap-row-odds">{fmtOdds(m.oddsInfo.homeOdds)} · {fmtOdds(m.oddsInfo.drawOdds)} · {fmtOdds(m.oddsInfo.awayOdds)}</small>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}

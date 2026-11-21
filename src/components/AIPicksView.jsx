import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Search, X, AlertTriangle, Play, RotateCw, ExternalLink, BookOpen, Database, ChevronDown, ShieldAlert, Flag, Square, Hand } from 'lucide-react';
import { explainPrediction } from '../api/cerebrasAi';
import { fetchEspnMatchSummary, fetchTeamRecentStats } from '../api/espnApi';
import { buildPrediction, buildSources, citeNumbers } from '../api/predictionModel';
import { sounds } from '../utils/soundEffects';
import { useMatchSounds } from '../hooks/useMatchSounds';
import { useLiveOdds } from '../hooks/useLiveOdds';
import { shouldWatchSource } from '../utils/liveBridge';
import { withLiveMarket } from '../utils/liveMarket';
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
const fmtPct = (p, d = 0) => `${(p * 100).toFixed(d)}%`;
const fmtEdge = (e) => (e == null ? '—' : `${e > 0 ? '+' : ''}${(e * 100).toFixed(1)}%`);
const slug = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').toLowerCase();
// Cada cuánto se vuelve a pedir el resumen de ESPN de un partido en vivo
const LIVE_REFRESH_MS = 45000;

// Cambio de probabilidad desde la lectura anterior, en puntos porcentuales
function Delta({ d }) {
  if (d == null || Math.abs(d) < 0.005) return null;
  const up = d > 0;
  return (
    <span className={`ap-delta ${up ? 'up' : 'down'}`} title="Cambio desde la actualización anterior">
      {up ? '▲' : '▼'} {Math.abs(d * 100).toFixed(1)}
    </span>
  );
}

function statusLabel(m) {
  if (m.status === 'live') return { text: `EN VIVO${m.minute ? ` · ${m.minute}` : ''}`, cls: 'live' };
  if (m.status === 'finished') return { text: 'Finalizado', cls: 'done' };
  return { text: m.date || 'Por iniciar', cls: '' };
}

// Cita numerada que lleva a su fuente en la lista del final
function Cite({ nums }) {
  if (!nums?.length) return null;
  const go = (e, n) => {
    e.preventDefault();
    const el = document.getElementById(`ap-src-${n}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  };
  return (
    <sup className="ap-cite">
      {nums.map(n => (
        <a key={n} href={`#ap-src-${n}`} onClick={(e) => go(e, n)} aria-label={`Fuente ${n}`}>[{n}]</a>
      ))}
    </sup>
  );
}

// Mezcla el resumen de ESPN (forma, enlace, cuotas completas) sin pisar marcador ni minuto del marcador en vivo
function mergeDetail(m, d, recent) {
  if (!d) return m;
  const team = (t, dt, rs) => ({
    ...t,
    recentGames: dt?.recentGames,
    form: dt?.form,
    yellowCards: dt?.yellowCards ?? t?.yellowCards,
    redCards: dt?.redCards ?? t?.redCards,
    recentStats: rs || undefined,
  });
  const oddsFrom = m.oddsInfo?.hasMoneyline && m.oddsInfo.overOdds ? m.oddsInfo : (d.oddsInfo?.hasMoneyline ? d.oddsInfo : m.oddsInfo);
  return {
    ...m,
    espnLink: d.espnLink || m.espnLink,
    h2hHistory: d.h2hHistory,
    stats: d.stats?.hasData ? d.stats : m.stats,
    oddsInfo: oddsFrom,
    homeTeam: team(m.homeTeam, d.homeTeam, recent?.home),
    awayTeam: team(m.awayTeam, d.awayTeam, recent?.away),
  };
}

export default function AIPicksView({ matches = [], onSelectMatch }) {
  const [selectedId, setSelectedId] = useState(() => (matches.find(m => m.status === 'live') || matches[0])?.id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [details, setDetails] = useState({});
  const [report, setReport] = useState(null); // { key, data }
  const [reportLoading, setReportLoading] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const [recent, setRecent] = useState({});
  const [deltas, setDeltas] = useState({ id: null, map: {} });
  const [updatedAt, setUpdatedAt] = useState(null);
  const panelRef = useRef(null);

  const base = matches.find(m => m.id === selectedId) || matches[0];
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

  // Resumen de ESPN del partido elegido: forma reciente, enlace oficial y cuotas de goles
  // Se pide una vez por partido; el resultado queda guardado por id aunque se cambie de partido
  const requested = useRef(new Set());
  useEffect(() => {
    const id = base?.id;
    if (!id || requested.current.has(id)) return;
    requested.current.add(id);
    setDetails(prev => ({ ...prev, [id]: null }));
    fetchEspnMatchSummary(id, base.league || 'all')
      .then(d => setDetails(prev => ({ ...prev, [id]: d || false })))
      .catch(() => setDetails(prev => ({ ...prev, [id]: false })));
  }, [base?.id, base?.league]);

  // En vivo, el resumen (córners, tarjetas, atajadas) se vuelve a pedir cada 45 s
  const isLive = base?.status === 'live';
  useEffect(() => {
    if (!isLive || !base?.id) return;
    const id = base.id;
    const league = base.league || 'all';
    const t = setInterval(() => {
      if (document.hidden) return;
      fetchEspnMatchSummary(id, league).then(d => { if (d) setDetails(prev => ({ ...prev, [id]: d })); }).catch(() => {});
    }, LIVE_REFRESH_MS);
    return () => clearInterval(t);
  }, [isLive, base?.id, base?.league]);

  const detail = base ? details[base.id] : undefined;

  // Córners, tarjetas y atajadas de los últimos partidos de cada equipo (una vez por partido)
  useEffect(() => {
    const id = base?.id;
    if (!id || !detail || recent[id] !== undefined) return;
    setRecent(prev => ({ ...prev, [id]: null }));
    Promise.all([
      fetchTeamRecentStats(detail.homeTeam?.id, detail.homeTeam?.recentGames),
      fetchTeamRecentStats(detail.awayTeam?.id, detail.awayTeam?.recentGames),
    ])
      .then(([home, away]) => setRecent(prev => ({ ...prev, [id]: { home, away } })))
      .catch(() => setRecent(prev => ({ ...prev, [id]: false })));
  }, [base?.id, detail, recent]);

  const recentStats = base ? recent[base.id] : undefined;
  const match = useMemo(() => mergeDetail(base, detail, recentStats), [base, detail, recentStats]);
  // Cuotas en vivo de la extensión: el modelo se ancla a ellas mientras el partido sigue en la fuente
  const { data: liveData, history: liveHistory } = useLiveOdds(match, shouldWatchSource(match));
  const liveMatch = useMemo(() => withLiveMarket(match, { data: liveData, history: liveHistory }), [match, liveData, liveHistory]);
  const liveOddsNow = liveMatch?.liveMarket?.matchResult || null;
  const pred = useMemo(() => (liveMatch ? buildPrediction(liveMatch) : null), [liveMatch]);
  useMatchSounds(match);

  // Compara cada probabilidad con la lectura anterior del mismo partido para marcar subas y bajas
  const lastProbs = useRef({ id: null, probs: null });
  useEffect(() => {
    if (!pred || !match) return;
    const probs = Object.fromEntries(pred.markets.map(mk => [mk.id, mk.p]));
    probs['1x2-1'] = pred.outcome.p1; probs['1x2-X'] = pred.outcome.px; probs['1x2-2'] = pred.outcome.p2;
    const q = pred.quality;
    const sig = `${match.id}|${q.hasOdds}|${q.hasLiveOdds}|${q.hasTotalOdds}|${q.hasForm}|${q.hasProps}`;
    const before = lastProbs.current;
    lastProbs.current = { id: sig, probs };
    setUpdatedAt(new Date());
    if (before.id !== sig || !before.probs) { setDeltas({ id: match.id, map: {} }); return; }
    const map = {};
    for (const [k, p] of Object.entries(probs)) {
      if (before.probs[k] != null && Math.abs(p - before.probs[k]) >= 0.005) map[k] = p - before.probs[k];
    }
    if (Object.keys(map).length) setDeltas({ id: match.id, map });
  }, [pred, match]);
  const delta = (k) => (deltas.id === match?.id ? deltas.map[k] : undefined);
  const sources = useMemo(() => buildSources(liveMatch, pred), [liveMatch, pred]);

  // El informe vale para este partido y este marcador
  const reportKey = match ? `${match.id}:${match.homeTeam?.score}-${match.awayTeam?.score}:${pred?.quality.hasForm}` : '';
  const currentReport = report?.key === reportKey ? report.data : null;

  const generateReport = async () => {
    if (!pred || reportLoading) return;
    sounds.playClick();
    setReportLoading(true);
    const key = reportKey;
    try {
      const data = await explainPrediction(liveMatch, pred, sources);
      setReport({ key, data });
      if (data.source === 'ai') sounds.playGoalChime();
    } finally {
      setReportLoading(false);
    }
  };

  const select = (m) => {
    sounds.playClick();
    setSelectedId(m.id);
    if (window.matchMedia('(max-width: 1024px)').matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const groups = useMemo(() => {
    const g = new Map();
    for (const mk of pred?.markets || []) {
      if (!g.has(mk.group)) g.set(mk.group, []);
      g.get(mk.group).push(mk);
    }
    return [...g.entries()];
  }, [pred]);

  const cites = (keys) => citeNumbers(sources, keys);
  const loadingDetail = base && (detail === null || recentStats === null);

  return (
    <div className="ap" id="ai-picks-view">
      <header className="ap-head">
        <div>
          <span className="ap-eyebrow"><Sparkles size={13} /> Pronósticos con IA</span>
          <h1>Probabilidades y pronósticos para cada partido de hoy</h1>
          <p>
            Calculamos la probabilidad de cada mercado con las cuotas del proveedor sin su margen y un modelo
            de goles de Poisson. La IA redacta el informe solo con esos números, y cada dato cita su fuente.
          </p>
        </div>
        <dl className="ap-stats">
          <div><dt>Partidos hoy</dt><dd>{matches.length}</dd></div>
          <div><dt>En vivo</dt><dd className={liveCount ? 'live' : ''}>{liveCount}</dd></div>
          <div><dt>Con cuotas</dt><dd>{oddsCount}</dd></div>
        </dl>
      </header>

      <div className="ap-grid">
        <section className="ap-panel ap-analyzer" aria-label="Pronóstico del partido elegido" ref={panelRef}>
          {match && pred ? (
            <>
              {/* Partido */}
              <div className="ap-match">
                <div className="ap-match-top">
                  <span className="ap-league">{match.leagueName || 'Fútbol'}</span>
                  <span className={`ap-status ${statusLabel(match).cls}`}>{statusLabel(match).text}</span>
                </div>
                <div className="ap-teams">
                  <div className="ap-team">
                    <TeamLogo src={match.homeTeam?.logo} alt={match.homeTeam?.name} size={40} isHome />
                    <span>{match.homeTeam?.name}</span>
                  </div>
                  <div className="ap-score">
                    {match.status === 'scheduled'
                      ? <b className="vs">VS</b>
                      : <b>{match.homeTeam?.score ?? 0}<i>-</i>{match.awayTeam?.score ?? 0}</b>}
                  </div>
                  <div className="ap-team away">
                    <span>{match.awayTeam?.name}</span>
                    <TeamLogo src={match.awayTeam?.logo} alt={match.awayTeam?.name} size={40} isHome={false} />
                  </div>
                </div>

                {/* Probabilidad 1X2 del modelo */}
                <div className="ap-prob" aria-label="Probabilidad del resultado final">
                  <div className="ap-prob-bar" aria-hidden="true">
                    <i className="h" style={{ flexGrow: pred.outcome.p1 }} />
                    <i className="d" style={{ flexGrow: pred.outcome.px }} />
                    <i className="a" style={{ flexGrow: pred.outcome.p2 }} />
                  </div>
                  <div className="ap-prob-legend">
                    {[
                      ['1', match.homeTeam?.shortName || match.homeTeam?.name, pred.outcome.p1, liveOddsNow?.home ?? match.oddsInfo?.homeOdds, 'h'],
                      ['X', 'Empate', pred.outcome.px, liveOddsNow?.draw ?? match.oddsInfo?.drawOdds, 'd'],
                      ['2', match.awayTeam?.shortName || match.awayTeam?.name, pred.outcome.p2, liveOddsNow?.away ?? match.oddsInfo?.awayOdds, 'a'],
                    ].map(([k, name, p, mo, cls]) => (
                      <div key={k} className={`ap-prob-item ${cls}`}>
                        <small><b>{k}</b> {name}</small>
                        <strong>{fmtPct(p, 1)} <Delta d={delta(`1x2-${k}`)} /></strong>
                        <span>Justa {fmtOdds(1 / p)}{pred.quality.hasOdds ? ` · ${liveOddsNow ? 'En vivo' : match.oddsInfo.provider} ${fmtOdds(mo)}` : ''}</span>
                      </div>
                    ))}
                  </div>
                  <p className="ap-prob-note">
                    Goles esperados: {pred.home} {pred.expectedHome.toFixed(2)} · {pred.away} {pred.expectedAway.toFixed(2)}
                    <Cite nums={cites([pred.quality.hasOdds ? 'odds' : pred.quality.hasForm ? 'form' : 'espn', 'maher', 'dixonColes', ...(pred.quality.isLive ? ['dixonRobinson'] : [])])} />
                  </p>
                  {pred.props && (
                    <ul className="ap-props" aria-label="Conteos esperados al final">
                      <li><Flag size={13} /> Córners <b>{pred.props.corners[0].toFixed(1)} · {pred.props.corners[1].toFixed(1)}</b></li>
                      <li><Square size={13} className="yc" /> Amarillas <b>{pred.props.yellow[0].toFixed(1)} · {pred.props.yellow[1].toFixed(1)}</b></li>
                      <li><Hand size={13} /> Atajadas <b>{pred.props.saves[0].toFixed(1)} · {pred.props.saves[1].toFixed(1)}</b></li>
                      <Cite nums={cites(['recent', 'greenwoodYule'])} />
                    </ul>
                  )}
                  {updatedAt && (
                    <p className="ap-updated">
                      {pred.quality.isLive && <span className="ap-live-dot" aria-hidden="true" />}
                      {pred.quality.isLive
                        ? `Se recalcula con cada actualización del partido · última ${updatedAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                        : `Calculado a las ${updatedAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} · se recalcula cuando empieza el partido`}
                    </p>
                  )}
                </div>

                <div className="ap-actions">
                  <button className="ap-btn primary" onClick={generateReport} disabled={reportLoading}>
                    {reportLoading
                      ? <><RotateCw size={15} className="ap-spin" /> Redactando informe…</>
                      : <><Sparkles size={15} /> {currentReport ? 'Actualizar informe' : 'Generar informe con IA'}</>}
                  </button>
                  <button className="ap-btn" onClick={() => { sounds.playClick(); onSelectMatch(match); }}>
                    <Play size={14} /> Ver partido
                  </button>
                  <span className={`ap-conf-tag c-${pred.confidence.toLowerCase()}`} title="Según la calidad de los datos disponibles, no según la probabilidad">
                    Confianza {pred.confidence}
                    {loadingDetail && <RotateCw size={12} className="ap-spin" aria-label="Cargando datos de ESPN" />}
                  </span>
                </div>
              </div>

              <div className="ap-body">
                {/* Pronósticos destacados */}
                <section className="ap-block" aria-labelledby="ap-picks-h">
                  <h2 id="ap-picks-h" className="ap-block-h">Pronósticos del modelo</h2>
                  <div className="ap-picks">
                    {pred.picks.map(pk => (
                      <article key={pk.tier + pk.id} className={`ap-pick t-${slug(pk.tier)}`}>
                        <span className="ap-pick-tier">{pk.tier}</span>
                        <h3>{pk.label}<Cite nums={cites(pk.marketOdds ? ['odds', ...pk.refs] : pk.refs)} /></h3>
                        <div className="ap-pick-meter" aria-hidden="true"><i style={{ width: fmtPct(pk.p) }} /></div>
                        <dl>
                          <div><dt>Probabilidad</dt><dd>{fmtPct(pk.p, 1)} <Delta d={delta(pk.id)} /></dd></div>
                          <div><dt>Cuota justa</dt><dd>{fmtOdds(pk.fair)}</dd></div>
                          {pk.marketOdds && <div><dt>{match.oddsInfo.provider}</dt><dd>{fmtOdds(pk.marketOdds)}</dd></div>}
                        </dl>
                      </article>
                    ))}
                  </div>
                  <p className="ap-hint">
                    Cuota justa = 1 ÷ probabilidad. Una cuota de casa por encima de la justa indica valor según el modelo.
                  </p>
                </section>

                {/* Informe */}
                <section className="ap-block" aria-labelledby="ap-report-h" aria-live="polite">
                  <h2 id="ap-report-h" className="ap-block-h">Informe</h2>
                  {reportLoading && (
                    <div className="ap-loading" role="status">
                      <div className="ap-loader"><i /><i /><i /></div>
                      <span>La IA está redactando con los números del modelo</span>
                    </div>
                  )}
                  {!reportLoading && !currentReport && (
                    <div className="ap-report-empty">
                      <p>El informe resume el pronóstico en 3 o 4 puntos, cada uno con su fuente. La IA no puede agregar cifras que no estén en los datos: si lo intenta, ese punto se descarta.</p>
                      <button className="ap-btn primary" onClick={generateReport}><Sparkles size={15} /> Generar informe con IA</button>
                    </div>
                  )}
                  {!reportLoading && currentReport && (
                    <article className="ap-report">
                      <span className={`ap-source ${currentReport.source === 'ai' ? 'ok' : 'warn'}`}>
                        {currentReport.source === 'ai'
                          ? <>Redactado por IA · {currentReport.model}</>
                          : <><AlertTriangle size={13} /> La IA no respondió: informe armado por el modelo</>}
                      </span>
                      <p className="ap-report-head">{currentReport.headline}</p>
                      <ul>
                        {currentReport.points.map((pt, i) => (
                          <li key={i}>{pt.text}<Cite nums={pt.cites} /></li>
                        ))}
                      </ul>
                      {currentReport.risk && (
                        <p className="ap-risk"><ShieldAlert size={15} /> <span><b>Riesgo:</b> {currentReport.risk}</span></p>
                      )}
                    </article>
                  )}
                </section>

                {/* Todos los mercados */}
                <section className="ap-block" aria-labelledby="ap-markets-h">
                  <h2 id="ap-markets-h" className="ap-block-h">Todos los mercados</h2>
                  <div className="ap-markets">
                    <div className="ap-mk-row ap-mk-head" aria-hidden="true">
                      <span>Mercado</span><span>Prob.</span><span>Justa</span><span>Casa</span><span className="edge">Ventaja</span>
                    </div>
                    {groups.map(([name, rows], gi) => {
                      const open = openGroups[name] ?? (gi < 4 || ['Córners', 'Tarjetas', 'Atajadas'].includes(name));
                      return (
                        <div key={name} className="ap-mk-group">
                          <button
                            className="ap-mk-title"
                            aria-expanded={open}
                            onClick={() => setOpenGroups(s => ({ ...s, [name]: !open }))}
                          >
                            {name} <ChevronDown size={14} />
                          </button>
                          {open && rows.map(mk => (
                            <div key={mk.id} className="ap-mk-row">
                              <span className="lbl">{mk.label}<Cite nums={cites(mk.marketOdds ? ['odds', ...mk.refs] : mk.refs)} /></span>
                              <span className="num"><Delta d={delta(mk.id)} /><i className="ap-mk-bar" style={{ width: fmtPct(mk.p) }} />{fmtPct(mk.p, 1)}</span>
                              <span className="num">{fmtOdds(mk.fair)}</span>
                              <span className="num">{fmtOdds(mk.marketOdds)}</span>
                              <span className={`num edge ${mk.edge > 0 ? 'pos' : mk.edge < 0 ? 'neg' : ''}`}>{fmtEdge(mk.edge)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  {!pred.quality.hasProps && match.status !== 'finished' && (
                    <p className="ap-hint">
                      {recentStats === null || detail === null
                        ? 'Cargando córners, tarjetas y atajadas de los últimos partidos…'
                        : 'Sin estadísticas de partidos recientes en ESPN para estos equipos: no se calculan córners, tarjetas ni atajadas.'}
                    </p>
                  )}
                  {pred.quality.hasOdds && (!pred.quality.isLive || pred.quality.hasLiveOdds) && (
                    <p className="ap-hint">Ventaja = probabilidad × cuota de la casa − 1. Cuando es negativa, la diferencia es el margen que cobra la casa.</p>
                  )}
                </section>

                {/* Metodología */}
                <section className="ap-block" aria-labelledby="ap-method-h">
                  <h2 id="ap-method-h" className="ap-block-h"><Database size={14} /> Método y supuestos</h2>
                  <dl className="ap-method">
                    <div><dt>Goles esperados (λ)</dt><dd>{pred.lambdaHome.toFixed(2)} · {pred.lambdaAway.toFixed(2)}</dd></div>
                    {pred.market && <div><dt>Margen de la casa 1X2</dt><dd>{fmtPct(pred.market.margin, 1)}</dd></div>}
                    {pred.market && <div><dt>Parámetro z de Shin</dt><dd>{pred.market.z.toFixed(3)}</dd></div>}
                    {pred.fitError != null && <div><dt>Error de ajuste</dt><dd>{(pred.fitError * 100).toFixed(2)} pts</dd></div>}
                  </dl>
                  <ol className="ap-steps">
                    {pred.quality.hasOdds
                      ? <li>Se quita el margen a las cuotas con el método de Shin<Cite nums={cites(['odds', 'shin', 'strumbelj'])} />.</li>
                      : <li>Sin cuotas: los goles esperados salen de los últimos partidos de cada equipo<Cite nums={cites(['form'])} />.</li>}
                    <li>Se buscan los goles esperados de cada equipo que reproducen esas probabilidades con un modelo de Poisson<Cite nums={cites(['maher'])} /> y la corrección de marcadores bajos de Dixon y Coles<Cite nums={cites(['dixonColes'])} />.</li>
                    {pred.quality.hasLiveOdds
                      ? <li>En vivo, se usan las cuotas en vivo del minuto {Math.round(pred.quality.minute)}: los goles que faltan se ajustan para reproducirlas y se suman al marcador<Cite nums={cites(['odds', 'dixonRobinson'])} />.</li>
                      : pred.quality.isLive && <li>En vivo, los goles que faltan se escalan por el tiempo restante y se suman al marcador<Cite nums={cites(['espn', 'dixonRobinson'])} />.</li>}
                    <li>Cada mercado de goles es la suma de las probabilidades de los marcadores que lo cumplen.</li>
                    {pred.quality.hasProps && <li>Córners, tarjetas y atajadas usan los promedios de los últimos partidos de cada equipo<Cite nums={cites(['recent'])} /> con una distribución binomial negativa, que admite más variación que Poisson<Cite nums={cites(['greenwoodYule'])} />. En vivo se suma lo que ya ocurrió.</li>}
                  </ol>
                  <ul className="ap-assume">
                    {pred.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </section>

                {/* Fuentes */}
                <section className="ap-block" aria-labelledby="ap-src-h">
                  <h2 id="ap-src-h" className="ap-block-h"><BookOpen size={14} /> Fuentes</h2>
                  <ol className="ap-sources">
                    {sources.map(s => (
                      <li key={s.n} id={`ap-src-${s.n}`} className={s.type}>
                        <span className="ap-src-n">[{s.n}]</span>
                        <div>
                          <p className="ap-src-title">
                            {s.ref
                              ? <>{s.ref.authors} ({s.ref.year}). {s.ref.title}. <i>{s.ref.journal}, {s.ref.volume}</i>({s.ref.issue}), {s.ref.pages}.</>
                              : s.title}
                          </p>
                          <p className="ap-src-detail">{s.detail}</p>
                          <p className="ap-src-meta">
                            <a href={s.url} target="_blank" rel="noopener noreferrer">
                              {s.doi ? `doi.org/${s.doi}` : s.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}
                              <ExternalLink size={11} />
                            </a>
                            {s.accessed && <span>Consultado el {s.accessed}</span>}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                <p className="ap-legal">
                  Pronóstico estadístico con fines informativos, no es una recomendación de apuesta. Ningún modelo garantiza resultados. Solo mayores de 18 años; jugá con responsabilidad.
                </p>
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
              const active = m.id === match?.id;
              return (
                <li key={m.id}>
                  <button
                    className={`ap-row ${active ? 'active' : ''}`}
                    onClick={() => select(m)}
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

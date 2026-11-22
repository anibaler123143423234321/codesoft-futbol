import React, { useState } from 'react';
import { PlayIcon } from './SportIcon';
import TeamLogo from './TeamLogo';
import PlayerAvatar from './PlayerAvatar';
import {
  BarChart3,
  Shield,
  Users,
  Info,
  Activity,
  History,
  MapPin,
  Award,
  Clock,
  Trophy
} from 'lucide-react';
import { sounds } from '../utils/soundEffects';

// El valor más alto de cada fila se marca con el color de su equipo
const lead = (item, side) => {
  const h = parseFloat(item.home) || 0;
  const a = parseFloat(item.away) || 0;
  return side === 'home' ? h > a : a > h;
};

export default function LiveStatsBars({ 
  stats, 
  scorers = [], 
  rosters = [], 
  commentary = [], 
  gameInfo = {}, 
  linescores = {},
  h2h = [],
  recentForm = {},
  homeName = 'Local', 
  awayName = 'Visita',
  homeLogo = '',
  awayLogo = '',
  matchStatus = 'live',
  homeScore = 0,
  awayScore = 0,
  leagueName = 'Competición'
}) {
  const isScheduled = matchStatus === 'scheduled';
  const hasStatsData = !isScheduled && stats && stats.hasData && (stats.attack || stats.summary);
  const hasRosters = rosters && rosters.length > 0 && rosters.some(r => r.starters && r.starters.length > 0);
  const hasCommentary = commentary && commentary.length > 0;
  const hasIncidents = scorers && scorers.length > 0;
  const hasH2H = h2h && h2h.length > 0;
  // Nombre completo de cada club (el mismo que usan las alineaciones) para buscar las fotos una sola vez
  const clubName = {
    home: rosters.find((r) => r.homeAway === 'home')?.teamName || homeName,
    away: rosters.find((r) => r.homeAway === 'away')?.teamName || awayName,
  };

  // Solo partidos reales de ESPN; si no hay, la tarjeta lo dice en vez de inventarlos
  const homeRecentGames = Array.isArray(recentForm?.home?.games) ? recentForm.home.games : [];
  const awayRecentGames = Array.isArray(recentForm?.away?.games) ? recentForm.away.games : [];

  // Default to the tab that actually has real data from the API
  const getDefaultTab = () => {
    if (isScheduled) return hasRosters ? 'rosters' : 'info';
    if (hasStatsData) return 'stats';
    if (hasIncidents) return 'incidents';
    if (hasRosters) return 'rosters';
    if (hasCommentary) return 'commentary';
    return 'info';
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab);
  const userSelectedTabRef = React.useRef(false);
  const matchIdentifier = `${homeName}-${awayName}-${matchStatus}`;
  const prevMatchRef = React.useRef(matchIdentifier);

  // Only reset tab when user switches to a completely DIFFERENT match
  React.useEffect(() => {
    if (prevMatchRef.current !== matchIdentifier) {
      prevMatchRef.current = matchIdentifier;
      userSelectedTabRef.current = false;
      setActiveTab(getDefaultTab());
    }
    // Solo al cambiar de partido: si no, se pisaría la pestaña que eligió el usuario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchIdentifier]);

  const handleTabClick = (tab) => {
    sounds.playClick();
    userSelectedTabRef.current = true;
    setActiveTab(tab);
  };

  return (
    <div className="sofa-match-hub" id="sofa-match-hub">
      {/* Top SofaScore-style Navigation Bar */}
      <div className="sofa-nav-tabs">
        <button
          className={`sofa-tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => handleTabClick('stats')}
        >
          <BarChart3 size={16} />
          <span>Estadísticas</span>
        </button>

        <button
          className={`sofa-tab-btn ${activeTab === 'h2h' ? 'active' : ''}`}
          onClick={() => handleTabClick('h2h')}
        >
          <History size={16} />
          <span>H2H</span>
        </button>

        <button
          className={`sofa-tab-btn ${activeTab === 'incidents' ? 'active' : ''}`}
          onClick={() => handleTabClick('incidents')}
        >
          <Activity size={16} />
          <span>Incidencias</span>
        </button>

        <button
          className={`sofa-tab-btn ${activeTab === 'rosters' ? 'active' : ''}`}
          onClick={() => handleTabClick('rosters')}
        >
          <Users size={16} />
          <span>Alineaciones</span>
        </button>

        <button
          className={`sofa-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => handleTabClick('info')}
        >
          <Info size={16} />
          <span>Detalles</span>
        </button>
      </div>

      {/* TAB 1: ESTADÍSTICAS (SofaScore 2-Column Dashboard - Only rendered when API has real data) */}
      {activeTab === 'stats' && (
        hasStatsData ? (
          <div className="sofa-stats-grid">
            {/* Card 1: Resumen del partido / Posesión */}
            {stats.summary && (
              <div className="sofa-card">
                <h4 className="sofa-card-title">Resumen del partido</h4>
                {stats.summary[0]?.isPossession && (
                  <div className="sofa-possession-box">
                    <div className="sofa-poss-header">
                      <span className="sofa-poss-badge home">{stats.summary[0]?.home}%</span>
                      <span className="sofa-poss-label">Posesión de balón</span>
                      <span className="sofa-poss-badge away">{stats.summary[0]?.away}%</span>
                    </div>
                    <div className="sofa-poss-bar-track">
                      <div 
                        className="sofa-poss-bar-fill home" 
                        style={{ width: `${stats.summary[0]?.home}%` }}
                      />
                      <div 
                        className="sofa-poss-bar-fill away" 
                        style={{ width: `${stats.summary[0]?.away}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="sofa-stats-rows">
                  {(stats.summary[0]?.isPossession ? stats.summary.slice(1) : stats.summary).map((item, idx) => {
                    const hVal = parseFloat(item.home) || 0;
                    const aVal = parseFloat(item.away) || 0;
                    const total = (hVal + aVal) === 0 ? 2 : (hVal + aVal);
                    const hPct = Math.round((hVal / total) * 100);
                    const aPct = Math.round((aVal / total) * 100);

                    return (
                      <div key={idx} className="sofa-stat-item">
                        <div className="sofa-stat-nums">
                          <span className={`val-home${lead(item, 'home') ? ' lead' : ''}`}>{item.home}{item.unit || ''}</span>
                          <span className="val-label">{item.label}</span>
                          <span className={`val-away${lead(item, 'away') ? ' lead' : ''}`}>{item.away}{item.unit || ''}</span>
                        </div>
                        <div className="sofa-dual-bar">
                          <div className="bar-half home">
                            <div className="bar-fill" style={{ width: `${hPct}%` }} />
                          </div>
                          <div className="bar-half away">
                            <div className="bar-fill" style={{ width: `${aPct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card 2: Ataque */}
            {stats.attack && stats.attack.length > 0 && (
              <div className="sofa-card">
                <h4 className="sofa-card-title">{stats.type === 'tournament' ? 'Rendimiento en el Torneo' : 'Ataque'}</h4>
                <div className="sofa-stats-rows">
                  {stats.attack.map((item, idx) => {
                    const hVal = parseFloat(item.home) || 0;
                    const aVal = parseFloat(item.away) || 0;
                    const total = (hVal + aVal) === 0 ? 2 : (hVal + aVal);
                    const hPct = Math.round((hVal / total) * 100);
                    const aPct = Math.round((aVal / total) * 100);

                    return (
                      <div key={idx} className="sofa-stat-item">
                        <div className="sofa-stat-nums">
                          <span className={`val-home${lead(item, 'home') ? ' lead' : ''}`}>{item.home}{item.unit || ''}</span>
                          <span className="val-label">{item.label}</span>
                          <span className={`val-away${lead(item, 'away') ? ' lead' : ''}`}>{item.away}{item.unit || ''}</span>
                        </div>
                        <div className="sofa-dual-bar">
                          <div className="bar-half home">
                            <div className="bar-fill" style={{ width: `${hPct}%` }} />
                          </div>
                          <div className="bar-half away">
                            <div className="bar-fill" style={{ width: `${aPct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card 3: Pases */}
            {stats.passing && stats.passing.length > 0 && (
              <div className="sofa-card">
                <h4 className="sofa-card-title">Pases</h4>
                <div className="sofa-stats-rows">
                  {stats.passing.map((item, idx) => {
                    const hVal = parseFloat(item.home) || 0;
                    const aVal = parseFloat(item.away) || 0;
                    const total = (hVal + aVal) === 0 ? 2 : (hVal + aVal);
                    const hPct = Math.round((hVal / total) * 100);
                    const aPct = Math.round((aVal / total) * 100);

                    return (
                      <div key={idx} className="sofa-stat-item">
                        <div className="sofa-stat-nums">
                          <span className={`val-home${lead(item, 'home') ? ' lead' : ''}`}>{item.home}{item.unit || ''}</span>
                          <span className="val-label">{item.label}</span>
                          <span className={`val-away${lead(item, 'away') ? ' lead' : ''}`}>{item.away}{item.unit || ''}</span>
                        </div>
                        <div className="sofa-dual-bar">
                          <div className="bar-half home">
                            <div className="bar-fill" style={{ width: `${hPct}%` }} />
                          </div>
                          <div className="bar-half away">
                            <div className="bar-fill" style={{ width: `${aPct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card 4: Disciplina */}
            {stats.discipline && stats.discipline.length > 0 && (
              <div className="sofa-card">
                <h4 className="sofa-card-title">Disciplina & Faltas</h4>
                <div className="sofa-stats-rows">
                  {stats.discipline.map((item, idx) => {
                    const hVal = parseFloat(item.home) || 0;
                    const aVal = parseFloat(item.away) || 0;
                    const total = (hVal + aVal) === 0 ? 2 : (hVal + aVal);
                    const hPct = Math.round((hVal / total) * 100);
                    const aPct = Math.round((aVal / total) * 100);

                    return (
                      <div key={idx} className="sofa-stat-item">
                        <div className="sofa-stat-nums">
                          <span className={`val-home${lead(item, 'home') ? ' lead' : ''}`}>{item.home}{item.unit || ''}</span>
                          <span className="val-label">{item.label}</span>
                          <span className={`val-away${lead(item, 'away') ? ' lead' : ''}`}>{item.away}{item.unit || ''}</span>
                        </div>
                        <div className="sofa-dual-bar">
                          <div className="bar-half home">
                            <div className="bar-fill" style={{ width: `${hPct}%` }} />
                          </div>
                          <div className="bar-half away">
                            <div className="bar-fill" style={{ width: `${aPct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="sofa-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <Shield size={20} style={{ color: 'var(--cyan-neon)' }} />
              <div>
                <h4 style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>Ficha Técnica Oficial del Encuentro</h4>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Datos verificados transmitidos por ESPN</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>ESTADIO Y SEDE</span>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.84rem' }}>{gameInfo?.venue || 'Estadio Oficial'}</span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>MARCADOR OFICIAL</span>
                <span style={{ color: 'var(--green-neon)', fontWeight: 600, fontSize: '0.84rem' }}>
                  {homeName} {homeScore} - {awayScore} {awayName}
                </span>
              </div>

              {linescores?.home && linescores.home.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>DESGLOSE DE TIEMPOS</span>
                  <span style={{ color: 'var(--gold-neon)', fontWeight: 600, fontSize: '0.84rem' }}>
                    1T: {linescores.home[0] || 0}-{linescores.away?.[0] || 0} {linescores.home[1] ? `· 2T: ${linescores.home[1]}-${linescores.away?.[1] || 0}` : ''}
                  </span>
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(255, 106, 0, 0.05)', border: '1px solid rgba(255, 106, 0, 0.15)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={16} style={{ color: 'var(--cyan-neon)', flexShrink: 0 }} />
              <span>
                {isScheduled
                  ? 'Las métricas y sensores oficiales en vivo se activarán al iniciar el partido.'
                  : 'Este torneo no cuenta con telemetría óptica en cancha para posesión y tiros al arco. Consulta la pestaña Incidencias o la Cartelera para ver partidos de ligas principales con telemetría completa.'}
              </span>
            </div>
          </div>
        )
      )}

      {/* TAB 2: H2H & FORMA RECIENTE (Últimos 5 Partidos de cada equipo) */}
      {activeTab === 'h2h' && (
        <div className="sofa-h2h-view">
          <FormCard name={homeName} logo={homeLogo} games={homeRecentGames} leagueName={leagueName} />
          <FormCard name={awayName} logo={awayLogo} games={awayRecentGames} leagueName={leagueName} />

          {hasH2H && (
            <div className="sofa-card">
              <h4 className="sofa-card-title">Cara a cara</h4>
              <div className="h2h-matches-list">
                {h2h.map((m, idx) => {
                  const hs = Number(m.homeScore);
                  const as = Number(m.awayScore);
                  return (
                    <div key={idx} className="h2h-match-row">
                      <span className="h2h-date">{m.date} · {m.competition || m.comp}</span>
                      <div className="h2h-match-teams">
                        <span className={`h2h-team home ${hs > as ? 'winner' : ''}`}>{m.homeTeam || m.home}</span>
                        <span className="h2h-score-badge">{m.homeScore}<i>–</i>{m.awayScore}</span>
                        <span className={`h2h-team away ${as > hs ? 'winner' : ''}`}>{m.awayTeam || m.away}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INCIDENCIAS (Timeline) */}
      {activeTab === 'incidents' && (
        <div className="sofa-card">
          <h4 className="sofa-card-title">Goles y tarjetas</h4>
          {hasIncidents ? (
            <>
            <div className="sofa-incidents-head" aria-hidden="true">
              <span className="home">{homeName}{homeLogo && <TeamLogo src={homeLogo} alt="" size={18} />}</span>
              <span />
              <span className="away">{awayLogo && <TeamLogo src={awayLogo} alt="" size={18} />}{awayName}</span>
            </div>
            <ol className="sofa-incidents-list">
              {scorers.map((item, idx) => {
                const isHome = item.team === 'home';
                const kind = item.type === 'redCard' ? 'red' : item.type === 'yellowCard' ? 'yellow' : 'goal';
                const body = (
                  <div className="sofa-incident-body">
                    <span className="sofa-incident-photo">
                      <PlayerAvatar name={item.player} team={isHome ? clubName.home : clubName.away} size={34} priority={1} />
                      <span className={`sofa-incident-icon ${kind}`}>
                        <PlayIcon kind={kind} size={12} />
                      </span>
                    </span>
                    <div>
                      <span className="sofa-incident-player">{item.player}</span>
                      <span className="sofa-incident-team">{isHome ? homeName : awayName}</span>
                    </div>
                  </div>
                );
                return (
                  <li key={idx} className={`sofa-incident-item ${isHome ? 'home' : 'away'}`}>
                    <div className="sofa-incident-side">{isHome && body}</div>
                    <span className="sofa-incident-min">{item.minute}</span>
                    <div className="sofa-incident-side">{!isHome && body}</div>
                  </li>
                );
              })}
            </ol>
            </>
          ) : (
            <div className="sofa-empty">
              <Clock size={22} />
              <p>Todavía no hay goles ni tarjetas</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ALINEACIONES */}
      {activeTab === 'rosters' && (
        <div className="sofa-rosters-grid">
          {hasRosters ? (
            rosters.map((r, idx) => (
              <div key={idx} className="sofa-card sofa-roster-card">
                <div className="sofa-roster-head">
                  <TeamLogo src={idx === 0 ? homeLogo : awayLogo} alt="" size={26} />
                  <h4>{r.teamName || (idx === 0 ? homeName : awayName)}</h4>
                  {r.formation && <span className="sofa-formation-pill">{r.formation}</span>}
                </div>

                {r.starters && (
                  <div className="sofa-roster-block">
                    <span className="sofa-roster-section-title">Titulares</span>
                    {r.starters.map((p, pIdx) => (
                      <div key={pIdx} className="sofa-player-row">
                        <span className="sofa-player-num">{p.jersey || '–'}</span>
                        <PlayerAvatar name={p.name} team={r.teamName || (idx === 0 ? homeName : awayName)} headshot={p.headshot} size={28} priority={1} />
                        <span className="sofa-player-name">{p.name}</span>
                        {p.position && <span className="sofa-player-pos">{p.position}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {r.substitutes?.length > 0 && (
                  <div className="sofa-roster-block">
                    <span className="sofa-roster-section-title">Suplentes</span>
                    {r.substitutes.map((p, pIdx) => (
                      <div key={pIdx} className="sofa-player-row sub">
                        <span className="sofa-player-num">{p.jersey || '–'}</span>
                        <PlayerAvatar name={p.name} team={r.teamName || (idx === 0 ? homeName : awayName)} headshot={p.headshot} size={28} priority={0} />
                        <span className="sofa-player-name">{p.name}</span>
                        {p.position && <span className="sofa-player-pos">{p.position}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="sofa-card sofa-empty" style={{ gridColumn: '1 / -1' }}>
              <Users size={22} />
              <p>Alineaciones aún sin confirmar</p>
              <span>Los equipos las publican unos 45 minutos antes del inicio.</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: DETALLES & ACERCA DEL PARTIDO */}
      {activeTab === 'info' && (
        <div className="sofa-card">
          <h4 className="sofa-card-title">Ficha del partido</h4>
          <div className="sofa-info-grid">
            <div className="sofa-info-box">
              <Trophy size={16} />
              <div>
                <span className="info-lbl">Competición</span>
                <span className="info-val">{leagueName}</span>
              </div>
            </div>
            {gameInfo.venue && (
              <div className="sofa-info-box">
                <MapPin size={16} />
                <div>
                  <span className="info-lbl">Estadio</span>
                  <span className="info-val">{gameInfo.venue}</span>
                </div>
              </div>
            )}
            {gameInfo.referee && (
              <div className="sofa-info-box">
                <Award size={16} />
                <div>
                  <span className="info-lbl">Árbitro</span>
                  <span className="info-val">{gameInfo.referee}</span>
                </div>
              </div>
            )}
            {linescores && (linescores.home?.length > 0 || linescores.away?.length > 0) && (
              <div className="sofa-info-box">
                <Clock size={16} />
                <div>
                  <span className="info-lbl">Por tiempos</span>
                  <span className="info-val">1T {linescores.home?.[0] || 0}–{linescores.away?.[0] || 0} · 2T {linescores.home?.[1] || 0}–{linescores.away?.[1] || 0}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const RESULT = {
  W: { label: 'V', cls: 'win', title: 'Victoria' },
  D: { label: 'E', cls: 'draw', title: 'Empate' },
  L: { label: 'D', cls: 'loss', title: 'Derrota' },
};
const resultOf = (r) => {
  const res = String(r || '').toUpperCase();
  if (res === 'W' || res === 'V') return RESULT.W;
  if (res === 'D' || res === 'E' || res === 'T') return RESULT.D;
  return RESULT.L;
};

function FormCard({ name, logo, games, leagueName }) {
  const last = games.slice(-5);
  return (
    <div className="sofa-card">
      <div className="team-form-header">
        <div className="team-form-identity">
          {logo && <TeamLogo src={logo} alt="" size={28} />}
          <div>
            <h4 className="team-form-name">{name}</h4>
            <span className="team-form-sub">Últimos {last.length || 5} partidos</span>
          </div>
        </div>
        {last.length > 0 && (
          <div className="form-pills-badge-track">
            {last.map((g, i) => {
              const r = resultOf(g.result);
              return <span key={i} className={`form-pill-dot ${r.cls}`} title={r.title}>{r.label}</span>;
            })}
          </div>
        )}
      </div>

      {last.length > 0 ? (
        <div className="recent-matches-list">
          {last.map((g, idx) => {
            const r = resultOf(g.result);
            return (
              <div key={idx} className="recent-match-row">
                <div className="recent-match-meta">
                  <span className="recent-date">{g.date}</span>
                  <span className="recent-comp">{g.competition || leagueName}</span>
                </div>
                <div className="recent-match-opponent">
                  <span className="recent-vs">vs</span>
                  <span className="recent-opponent-name">{g.opponent}</span>
                </div>
                <div className="recent-match-result">
                  <span className="recent-score">{g.score}</span>
                  <span className={`recent-status-pill ${r.cls}`}>{r.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="sofa-empty-line">ESPN todavía no publica sus partidos recientes.</p>
      )}
    </div>
  );
}

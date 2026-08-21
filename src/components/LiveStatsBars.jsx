import React, { useState } from 'react';
import { 
  BarChart3, 
  Shield, 
  Zap, 
  Target, 
  Users, 
  Radio, 
  Info, 
  Activity, 
  History, 
  MapPin, 
  Award, 
  Clock,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import { sounds } from '../utils/soundEffects';

export default function LiveStatsBars({ 
  stats, 
  scorers = [], 
  rosters = [], 
  commentary = [], 
  gameInfo = {}, 
  linescores = {},
  h2h = [],
  homeName = 'Local', 
  awayName = 'Visita',
  matchStatus = 'live',
  homeScore = 0,
  awayScore = 0
}) {
  const isScheduled = matchStatus === 'scheduled';
  const hasStatsData = !isScheduled && stats && stats.hasData && (stats.attack || stats.summary);
  const hasRosters = rosters && rosters.length > 0 && rosters.some(r => r.starters && r.starters.length > 0);
  const hasCommentary = commentary && commentary.length > 0;
  const hasIncidents = scorers && scorers.length > 0;
  const hasH2H = h2h && h2h.length > 0;

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
                    const aPct = 100 - hPct;

                    return (
                      <div key={idx} className="sofa-stat-item">
                        <div className="sofa-stat-nums">
                          <span className="val-home">{item.home}{item.unit || ''}</span>
                          <span className="val-label">{item.label}</span>
                          <span className="val-away">{item.away}{item.unit || ''}</span>
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
                    const aPct = 100 - hPct;

                    return (
                      <div key={idx} className="sofa-stat-item">
                        <div className="sofa-stat-nums">
                          <span className="val-home">{item.home}{item.unit || ''}</span>
                          <span className="val-label">{item.label}</span>
                          <span className="val-away">{item.away}{item.unit || ''}</span>
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
                    const aPct = 100 - hPct;

                    return (
                      <div key={idx} className="sofa-stat-item">
                        <div className="sofa-stat-nums">
                          <span className="val-home">{item.home}{item.unit || ''}</span>
                          <span className="val-label">{item.label}</span>
                          <span className="val-away">{item.away}{item.unit || ''}</span>
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
                    const aPct = 100 - hPct;

                    return (
                      <div key={idx} className="sofa-stat-item">
                        <div className="sofa-stat-nums">
                          <span className="val-home">{item.home}{item.unit || ''}</span>
                          <span className="val-label">{item.label}</span>
                          <span className="val-away">{item.away}{item.unit || ''}</span>
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
                <h4 style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem', margin: 0 }}>Ficha Técnica Oficial del Encuentro</h4>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Datos verificados transmitidos por ESPN</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>ESTADIO Y SEDE</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.84rem' }}>{gameInfo?.venue || 'Estadio Oficial'}</span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>MARCADOR OFICIAL</span>
                <span style={{ color: 'var(--green-neon)', fontWeight: 800, fontSize: '0.84rem' }}>
                  {homeName} {homeScore} - {awayScore} {awayName}
                </span>
              </div>

              {linescores?.home && linescores.home.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>DESGLOSE DE TIEMPOS</span>
                  <span style={{ color: 'var(--gold-neon)', fontWeight: 700, fontSize: '0.84rem' }}>
                    1T: {linescores.home[0] || 0}-{linescores.away?.[0] || 0} {linescores.home[1] ? `· 2T: ${linescores.home[1]}-${linescores.away?.[1] || 0}` : ''}
                  </span>
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(0, 210, 255, 0.05)', border: '1px solid rgba(0, 210, 255, 0.15)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
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

      {/* TAB 2: H2H (Cara a Cara - Only rendered when API has real H2H data) */}
      {activeTab === 'h2h' && (
        hasH2H ? (
          <div className="sofa-h2h-view">
            <div className="sofa-card">
              <h4 className="sofa-card-title">Últimos Enfrentamientos Directos</h4>
              <div className="h2h-matches-list">
                {h2h.map((m, idx) => (
                  <div key={idx} className="h2h-match-row">
                    <span className="h2h-date">{m.date} · {m.comp}</span>
                    <div className="h2h-match-teams">
                      <span className={`h2h-team ${m.homeScore > m.awayScore ? 'winner' : ''}`}>{m.home}</span>
                      <span className="h2h-score-badge">{m.homeScore} - {m.awayScore}</span>
                      <span className={`h2h-team ${m.awayScore > m.homeScore ? 'winner' : ''}`}>{m.away}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="sofa-card" style={{ textAlign: 'center', padding: '36px' }}>
            <History size={32} style={{ color: 'var(--cyan-neon)', margin: '0 auto 10px', opacity: 0.7 }} />
            <h4 style={{ color: '#fff', fontWeight: 700, marginBottom: '6px' }}>Historial H2H no registrado</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', maxWidth: '460px', margin: '0 auto' }}>
              No existen registros previos de enfrentamientos directos entre {homeName} y {awayName} en la API oficial.
            </p>
          </div>
        )
      )}

      {/* TAB 3: INCIDENCIAS (Timeline) */}
      {activeTab === 'incidents' && (
        <div className="sofa-card">
          <h4 className="sofa-card-title">Incidencias del Partido</h4>
          {hasIncidents ? (
            <div className="sofa-incidents-list">
              {scorers.map((item, idx) => {
                const isHome = item.team === 'home';
                const isRedCard = item.type === 'redCard';
                const isYellowCard = item.type === 'yellowCard';
                const isPenalty = item.player?.includes('(P)');

                return (
                  <div key={idx} className={`sofa-incident-item ${isHome ? 'home' : 'away'}`}>
                    {isHome && <span className="sofa-incident-min">{item.minute}</span>}
                    <div className="sofa-incident-body">
                      <span className="sofa-incident-icon">
                        {isRedCard ? '🟥' : isYellowCard ? '🟨' : isPenalty ? '🎯' : '⚽'}
                      </span>
                      <div>
                        <span className="sofa-incident-player">{item.player}</span>
                        <span className="sofa-incident-team">{isHome ? homeName : awayName}</span>
                      </div>
                    </div>
                    {!isHome && <span className="sofa-incident-min">{item.minute}</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              <Clock size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p>Sin goles o tarjetas registradas en este encuentro.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ALINEACIONES */}
      {activeTab === 'rosters' && (
        <div className="sofa-rosters-grid">
          {hasRosters ? (
            rosters.map((r, idx) => (
              <div key={idx} className="sofa-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h4 style={{ fontWeight: 800, color: idx === 0 ? 'var(--cyan-neon)' : 'var(--red-live)' }}>
                    {r.teamName || (idx === 0 ? homeName : awayName)}
                  </h4>
                  {r.formation && <span className="sofa-formation-pill">{r.formation}</span>}
                </div>

                {r.starters && (
                  <div style={{ marginBottom: '14px' }}>
                    <span className="sofa-roster-section-title">Titulares</span>
                    {r.starters.map((p, pIdx) => (
                      <div key={pIdx} className="sofa-player-row">
                        <span>{p.name}</span>
                        <span className="sofa-player-num">{p.jersey ? `#${p.jersey}` : p.position}</span>
                      </div>
                    ))}
                  </div>
                )}

                {r.substitutes && (
                  <div>
                    <span className="sofa-roster-section-title">Suplentes</span>
                    {r.substitutes.map((p, pIdx) => (
                      <div key={pIdx} className="sofa-player-row sub">
                        <span>{p.name}</span>
                        <span className="sofa-player-num">{p.jersey ? `#${p.jersey}` : p.position}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="sofa-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '36px' }}>
              <Users size={32} style={{ color: 'var(--cyan-neon)', margin: '0 auto 10px', opacity: 0.7 }} />
              <h4 style={{ color: '#fff', fontWeight: 700, marginBottom: '6px' }}>Alineaciones Oficiales</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                Las alineaciones oficiales se publican 45 minutos antes del inicio del encuentro.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: DETALLES & ACERCA DEL PARTIDO */}
      {activeTab === 'info' && (
        <div className="sofa-card">
          <h4 className="sofa-card-title">Acerca del partido</h4>
          <p style={{ color: '#e5e7eb', fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '16px' }}>
            <strong>{homeName}</strong> jugó contra <strong>{awayName}</strong> en el torneo oficial. 
            Sigue las estadísticas oficiales en vivo, posesión de balón, córners, tiros y el relato minuto a minuto.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {gameInfo.venue && (
              <div className="sofa-info-box">
                <MapPin size={16} style={{ color: 'var(--cyan-neon)' }} />
                <div>
                  <span className="info-lbl">Estadio</span>
                  <span className="info-val">{gameInfo.venue}</span>
                </div>
              </div>
            )}
            {gameInfo.referee && (
              <div className="sofa-info-box">
                <Award size={16} style={{ color: 'var(--gold-neon)' }} />
                <div>
                  <span className="info-lbl">Árbitro Principal</span>
                  <span className="info-val">{gameInfo.referee}</span>
                </div>
              </div>
            )}
            {linescores && (linescores.home?.length > 0 || linescores.away?.length > 0) && (
              <div className="sofa-info-box">
                <Clock size={16} style={{ color: 'var(--green-neon)' }} />
                <div>
                  <span className="info-lbl">Parciales</span>
                  <span className="info-val">1T: {linescores.home?.[0] || 0}-{linescores.away?.[0] || 0} · 2T: {linescores.home?.[1] || 0}-{linescores.away?.[1] || 0}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

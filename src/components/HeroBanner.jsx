import React from 'react';
import {
  Tv,
  Sparkles,
  Users,
  TrendingUp,
  Play
} from 'lucide-react';
import TeamLogo from './TeamLogo';
import { sounds } from '../utils/soundEffects';
import { pressable } from '../utils/a11y';

export default function HeroBanner({ 
  featuredMatch, 
  onSelectMatch, 
  setView, 
  onOpenPickModal,
  liveCount = 6,
  liveMatches = []
}) {
  const match = featuredMatch || {};

  return (
    <section className="hero-section">
      {/* Top Hero Grid */}
      <div className="hero-grid">
        {/* Left Column */}
        <div className="hero-left">
          <div className="hero-tag">Fútbol en vivo</div>

          <h1 className="hero-title">
            Partidos en vivo, análisis y picks para cada jornada.
          </h1>

          <p className="hero-desc">
            Marcador al minuto, jugadas sobre la cancha, cuotas en vivo y picks con IA que citan cada dato. Todo con las estadísticas oficiales de ESPN.
          </p>

          <div className="hero-cta-group">
            <button 
              className="btn-primary"
              id="hero-btn-picks"
              onClick={() => setView('picks')}
            >
              <Sparkles size={18} />
              <span>Ver picks con IA</span>
            </button>

            <button 
              className="btn-secondary"
              id="hero-btn-live-matches"
              onClick={() => {
                sounds.playClick();
                setView('cartelera');
              }}
            >
              <Tv size={18} />
              <span>Ver cartelera en vivo</span>
            </button>
          </div>
        </div>

        {/* Right Column: Spotlight Featured Match Card */}
        <div className="hero-right">
          <div className="spotlight-card">
            {/* Estado real del partido sobre la cancha */}
            <SpotlightPitch match={match} />

            {/* Score & Clubs Body */}
            <div className="spotlight-body">
              {/* Cuotas 1X2 reales (solo si el proveedor las publica) */}
              {match.oddsInfo?.hasMoneyline ? (
                <>
                  <div className="odds-bar">
                    <div className="odd-box">
                      <div className="odd-label">Local</div>
                      <div className="odd-val">{match.oddsInfo.homeOdds.toFixed(2)}</div>
                    </div>
                    <div className="odd-box">
                      <div className="odd-label">Empate</div>
                      <div className="odd-val">{match.oddsInfo.drawOdds.toFixed(2)}</div>
                    </div>
                    <div className="odd-box">
                      <div className="odd-label">Visita</div>
                      <div className="odd-val">{match.oddsInfo.awayOdds.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="odds-source">
                    Cuotas de {match.oddsInfo.provider}{match.oddsInfo.overUnder ? ` · ${match.oddsInfo.overUnder}` : ''}
                  </div>
                </>
              ) : (
                <div className="odds-source">Sin cuotas publicadas para este partido</div>
              )}

              {/* Acceso al análisis con IA */}
              <button
                type="button"
                className="spotlight-ai-banner"
                onClick={() => onOpenPickModal(match)}
              >
                <div className="spotlight-ai-pick-text">
                  <Sparkles size={16} />
                  <span>Ver análisis con IA de este partido</span>
                </div>
              </button>

              {/* Action row to enter live match */}
              <button 
                className="btn-secondary" 
                style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
                onClick={() => {
                  sounds.playWhistle();
                  onSelectMatch(match);
                }}
              >
                <Play size={16} fill="currentColor" />
                <span>Ver transmisión y estadísticas</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Offerings ("Por qué la gente se queda") */}
      <div className="features-section">
        <div className="section-tag">La app</div>
        <h2 className="section-title">Todo el partido en una pantalla</h2>

        <div className="features-grid">
          {/* En vivo: los partidos que se están jugando ahora */}
          <div className="feature-card" {...pressable} onClick={() => { sounds.playClick(); setView('cartelera'); }}>
            <div className="feature-card-header">
              <span className="feature-pill-tag">En vivo</span>
              <h3 className="feature-card-title">Partidos en vivo</h3>
              <p className="feature-card-desc">Marcador, jugadas y alineaciones que se actualizan durante el partido.</p>
            </div>
            <ul className="fc-live">
              {liveMatches.slice(0, 3).map((m) => (
                <li key={m.id}>
                  <TeamLogo src={m.homeTeam?.logo} alt="" size={20} isHome />
                  <span>{m.homeTeam?.shortName}</span>
                  <b>{m.homeTeam?.score ?? 0}-{m.awayTeam?.score ?? 0}</b>
                  <span>{m.awayTeam?.shortName}</span>
                  <TeamLogo src={m.awayTeam?.logo} alt="" size={20} isHome={false} />
                  <small>{m.minute}</small>
                </li>
              ))}
              {liveMatches.length === 0 && <li className="fc-none">Ahora no hay partidos en juego</li>}
            </ul>
            <div className="feature-card-badges">
              <span className="pill-badge-green">
                <span className="live-dot" style={{ background: 'var(--green-neon)' }} />
                {liveCount} en vivo ahora
              </span>
            </div>
          </div>

          {/* Picks: probabilidad del partido destacado según sus cuotas */}
          <div className="feature-card" {...pressable} onClick={() => { sounds.playClick(); setView('picks'); }}>
            <div className="feature-card-header">
              <span className="feature-pill-tag">Picks con IA</span>
              <h3 className="feature-card-title">Probabilidades con fuente</h3>
              <p className="feature-card-desc">Calculadas con las cuotas y las estadísticas de ESPN. Cada dato del informe dice de dónde sale.</p>
            </div>
            <ImpliedBar match={match} />
            <div className="feature-card-badges">
              <span className="pill-badge-blue"><TrendingUp size={14} />Cuotas y estadísticas</span>
            </div>
          </div>

          {/* Comunidad: la encuesta de cada partido */}
          <div className="feature-card" {...pressable} onClick={() => { sounds.playClick(); setView('comunidad'); }}>
            <div className="feature-card-header">
              <span className="feature-pill-tag">Comunidad</span>
              <h3 className="feature-card-title">Chat y encuesta por partido</h3>
              <p className="feature-card-desc">Comenta la jornada y vota quién gana antes del pitazo final.</p>
            </div>
            <div className="fc-poll" aria-hidden="true">
              <span><TeamLogo src={match.homeTeam?.logo} alt="" size={18} isHome />Local</span>
              <span>Empate</span>
              <span><TeamLogo src={match.awayTeam?.logo} alt="" size={18} isHome={false} />Visita</span>
            </div>
            <div className="feature-card-badges">
              <span className="pill-badge-green"><Users size={14} />Chat por partido</span>
            </div>
          </div>
        </div>

        <div className="features-cta">
          <button className="btn-primary" onClick={() => setView('picks')}>
            <Sparkles size={18} />
            <span>Ver todos los picks</span>
          </button>
        </div>
      </div>
    </section>
  );
}

// Cancha de noche con el estado real del partido: escudos, liga y minuto jugado
function SpotlightPitch({ match }) {
  const live = match.status === 'live';
  const done = match.status === 'finished';
  const minute = parseInt(match.minute, 10) || 0;
  const pct = done ? 100 : live ? Math.min(100, (minute / 90) * 100) : 0;
  const status = live ? `En vivo · ${match.minute || ''}`.trim() : done ? 'Finalizado' : (match.timeStr || 'Próximo');
  return (
    <div className="spotlight-screen">
      <svg className="sp-pitch" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="sp-flood" cx="50%" cy="-10%" r="95%">
            <stop offset="0" stopColor="#fff6e8" stopOpacity="0.2" />
            <stop offset="0.6" stopColor="#fff6e8" stopOpacity="0.04" />
            <stop offset="1" stopColor="#000" stopOpacity="0.35" />
          </radialGradient>
        </defs>
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={i * 10.5} y="0" width="10.5" height="68" className={i % 2 ? 'sp-grass-b' : 'sp-grass-a'} />
        ))}
        <g className="sp-lines">
          <rect x="3" y="3" width="99" height="62" />
          <line x1="52.5" y1="3" x2="52.5" y2="65" />
          <circle cx="52.5" cy="34" r="9.15" />
          <rect x="3" y="16.85" width="16.5" height="34.3" />
          <rect x="85.5" y="16.85" width="16.5" height="34.3" />
          <rect x="3" y="26" width="5.5" height="16" />
          <rect x="96.5" y="26" width="5.5" height="16" />
        </g>
        <rect width="105" height="68" fill="url(#sp-flood)" />
      </svg>
      <div className="sp-board">
        <div className="sp-team">
          <TeamLogo src={match.homeTeam?.logo} alt={match.homeTeam?.name} size={64} isHome />
          <span title={match.homeTeam?.name}>{match.homeTeam?.shortName || match.homeTeam?.name || 'Local'}</span>
        </div>
        <div className="sp-score" aria-label={`${match.homeTeam?.score ?? 0} a ${match.awayTeam?.score ?? 0}`}>
          <b>{match.homeTeam?.score ?? 0}</b><i>-</i><b>{match.awayTeam?.score ?? 0}</b>
        </div>
        <div className="sp-team">
          <TeamLogo src={match.awayTeam?.logo} alt={match.awayTeam?.name} size={64} isHome={false} />
          <span title={match.awayTeam?.name}>{match.awayTeam?.shortName || match.awayTeam?.name || 'Visita'}</span>
        </div>
      </div>
      <div className="sp-top">
        <span className={`sp-status ${live ? 'live' : ''}`}>{live && <span className="live-dot" />}{status}</span>
        {match.leagueName && <span className="sp-league">{match.leagueName}</span>}
      </div>
      <div className="sp-clock" aria-label={live ? `Minuto ${minute} de 90` : status}>
        <div className="sp-track">
          <span className="sp-fill" style={{ width: `${pct}%` }} />
          <span className="sp-half" />
          {live && <span className="sp-now" style={{ left: `${pct}%` }} />}
        </div>
        <div className="sp-ticks"><span>0'</span><span>45'</span><span>90'</span></div>
      </div>
    </div>
  );
}

// Probabilidad implícita 1X2 del partido destacado (inversa de cada cuota, sin el margen de la casa)
function ImpliedBar({ match }) {
  const o = match.oddsInfo;
  if (!o?.hasMoneyline) return <p className="fc-none">Sin cuotas publicadas para el partido destacado</p>;
  const inv = [o.homeOdds, o.drawOdds, o.awayOdds].map((x) => 1 / x);
  const total = inv.reduce((a, b) => a + b, 0);
  const [h, d, a] = inv.map((x) => Math.round((x / total) * 100));
  return (
    <div className="fc-prob">
      <div className="fc-prob-bar"><i className="h" style={{ flexGrow: h }} /><i className="d" style={{ flexGrow: d }} /><i className="a" style={{ flexGrow: a }} /></div>
      <div className="fc-prob-legend">
        <span><b>{h}%</b>{match.homeTeam?.shortName}</span>
        <span><b>{d}%</b>Empate</span>
        <span><b>{a}%</b>{match.awayTeam?.shortName}</span>
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from 'react';
import { 
  Tv, 
  Send, 
  Sparkles, 
  Users, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp,
  Activity,
  Play
} from 'lucide-react';
import TeamLogo from './TeamLogo';
import { sounds } from '../utils/soundEffects';

export default function HeroBanner({ 
  featuredMatch, 
  onSelectMatch, 
  setView, 
  onOpenTelegram,
  onOpenPickModal,
  liveCount = 6 
}) {
  const canvasRef = useRef(null);

  // Subtle stadium radar particle effect on the preview screen
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        alpha: Math.random() * 0.5 + 0.2
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw grid lines
      ctx.strokeStyle = 'rgba(0, 210, 255, 0.06)';
      ctx.lineWidth = 1;
      const step = 25;
      for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.fillStyle = `rgba(0, 210, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const match = featuredMatch || {};

  return (
    <section className="hero-section">
      {/* Top Hero Grid */}
      <div className="hero-grid">
        {/* Left Column */}
        <div className="hero-left">
          <div className="hero-tag">
            <span style={{ width: '18px', height: '2px', background: 'var(--cyan-neon)', display: 'inline-block' }} />
            FÚTBOL EN VIVO
          </div>

          <h1 className="hero-title">
            Partidos en vivo, análisis y picks para cada jornada.
          </h1>

          <p className="hero-desc">
            Sigue la jornada deportiva, consulta partidos en vivo y descubre selecciones basadas en estadísticas oficiales de ESPN, análisis táctico y múltiples fuentes predictivas con Inteligencia Artificial.
          </p>

          <div className="hero-cta-group">
            <button 
              className="btn-primary"
              id="hero-btn-picks"
              onClick={() => setView('picks')}
            >
              <Sparkles size={18} style={{ color: '#76b900' }} />
              <span>Picks de NVIDIA IA</span>
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
            {/* Visual Canvas / Player preview */}
            <div className="spotlight-screen">
              <canvas ref={canvasRef} className="spotlight-canvas-bg" />
              <div className="spotlight-badge-center">
                <span className="live-dot" />
                <span>{match.status === 'live' ? `EN VIVO · ${match.minute || "95'"}` : 'PARTIDO DESTACADO'}</span>
              </div>
            </div>

            {/* Score & Clubs Body */}
            <div className="spotlight-body">
              <div className="spotlight-teams">
                {/* Home */}
                <div className="spotlight-team">
                  <TeamLogo
                    src={match.homeTeam?.logo}
                    alt={match.homeTeam?.name}
                    size={60}
                    isHome={true}
                  />
                  <div className="team-name" title={match.homeTeam?.name}>
                    {match.homeTeam?.shortName || match.homeTeam?.name || 'Local'}
                  </div>
                </div>

                {/* Score */}
                <div className="spotlight-score">
                  <span>{match.homeTeam?.score ?? 0}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '2rem' }}>-</span>
                  <span>{match.awayTeam?.score ?? 0}</span>
                </div>

                {/* Away */}
                <div className="spotlight-team">
                  <TeamLogo
                    src={match.awayTeam?.logo}
                    alt={match.awayTeam?.name}
                    size={60}
                    isHome={false}
                  />
                  <div className="team-name" title={match.awayTeam?.name}>
                    {match.awayTeam?.shortName || match.awayTeam?.name || 'Visita'}
                  </div>
                </div>
              </div>

              {/* Odds Bar */}
              <div className="odds-bar">
                <div className="odd-box">
                  <div className="odd-label">LOCAL</div>
                  <div className="odd-val">{match.homeTeam?.odds || '2.75'}</div>
                </div>
                <div className="odd-box">
                  <div className="odd-label">EMPATE</div>
                  <div className="odd-val">{match.drawOdds || '3.10'}</div>
                </div>
                <div className="odd-box">
                  <div className="odd-label">VISITA</div>
                  <div className="odd-val">{match.awayTeam?.odds || '2.90'}</div>
                </div>
              </div>

              {/* AI Pick Highlight Banner */}
              <div 
                className="spotlight-ai-banner" 
                style={{ cursor: 'pointer' }}
                onClick={() => onOpenPickModal(match)}
                title="Haz clic para ver el análisis completo con IA"
              >
                <div className="spotlight-ai-pick-text">
                  <Sparkles size={16} />
                  <span>{match.aiPick?.pick || 'Total goles +2.5 / total tarjetas +3.5'}</span>
                </div>
                <div className="spotlight-ai-cuota">
                  Cuota {match.aiPick?.cuota || '2.45'}
                </div>
              </div>

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
                <span>Ver Transmisión y Estadísticas en Vivo</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Offerings ("Por qué la gente se queda") */}
      <div className="features-section">
        <div className="section-tag">
          <span style={{ width: '14px', height: '2px', background: 'var(--cyan-neon)', display: 'inline-block' }} />
          POR QUÉ LA GENTE SE QUEDA
        </div>
        <h2 className="section-title">Lo que ofrecemos</h2>

        <div className="features-grid">
          {/* Card 1: Partidos en vivo */}
          <div 
            className="feature-card"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              sounds.playClick();
              setView('cartelera');
            }}
          >
            <div className="feature-card-header">
              <span className="feature-pill-tag">TRANSMISIÓN</span>
              <h3 className="feature-card-title">Partidos en vivo</h3>
              <p className="feature-card-desc">
                Sigue los partidos en vivo, consulta sus detalles y disfruta de la jornada deportiva con múltiples servidores en alta calidad.
              </p>
            </div>
            <div className="feature-card-badges">
              <span className="pill-badge-green">
                <span className="live-dot" style={{ background: 'var(--green-neon)' }} />
                {liveCount} en vivo ahora
              </span>
            </div>
          </div>

          {/* Card 2: Picks con IA */}
          <div 
            className="feature-card"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              sounds.playClick();
              setView('picks');
            }}
          >
            <div className="feature-card-header">
              <span className="feature-pill-tag" style={{ color: 'var(--green-neon)' }}>IA PREDICTIVA</span>
              <h3 className="feature-card-title">Picks con IA</h3>
              <p className="feature-card-desc">
                Analizamos cuotas, estadísticas y múltiples fuentes para encontrar las selecciones más interesantes con tecnología NVIDIA NIM (Llama 3.1 70B).
              </p>
            </div>
            <div className="feature-card-badges">
              <span className="pill-badge-blue">
                <TrendingUp size={14} />
                68 % aciertos
              </span>
              <span className="pill-badge-green">
                <Sparkles size={14} />
                +4 maratón
              </span>
            </div>
          </div>

          {/* Card 3: Comunidad activa */}
          <div 
            className="feature-card"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              sounds.playClick();
              setView('comunidad');
            }}
          >
            <div className="feature-card-header">
              <span className="feature-pill-tag" style={{ color: 'var(--gold-neon)' }}>COMUNIDAD</span>
              <h3 className="feature-card-title">Comunidad activa</h3>
              <p className="feature-card-desc">
                Chat en tiempo real durante cada partido, encuestas en vivo y miles de personas compartiendo sus análisis y predicciones.
              </p>
            </div>
            <div className="feature-card-badges">
              <span className="pill-badge-green">
                <Users size={14} />
                281 online
              </span>
              <span className="pill-badge-blue">
                <Sparkles size={14} />
                NVIDIA 70B AI
              </span>
            </div>
          </div>
        </div>

        {/* NVIDIA IA Big Banner Button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
          <button 
            className="btn-primary" 
            style={{ padding: '14px 34px', fontSize: '1rem' }}
            onClick={() => setView('picks')}
          >
            <Sparkles size={18} style={{ color: '#76b900' }} />
            <span>Explorar Todos los Picks de NVIDIA IA</span>
          </button>
        </div>
      </div>
    </section>
  );
}

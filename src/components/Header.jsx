import React, { useState } from 'react';
import {
  Flame,
  Tv,
  Calendar,
  Sparkles,
  BarChart3,
  MessageSquare,
  Volume2,
  VolumeX,
  Zap
} from 'lucide-react';
import { sounds } from '../utils/soundEffects';
import { pressable } from '../utils/a11y';

export default function Header({ currentView, setView, liveMatchesCount = 6 }) {
  const [muted, setMuted] = useState(sounds.muted);

  const handleSoundToggle = () => {
    const isMuted = sounds.toggleMute();
    setMuted(isMuted);
    if (!isMuted) {
      sounds.playWhistle();
    }
  };

  const navItems = [
    { id: 'inicio', label: 'Inicio', icon: Flame },
    { id: 'envivo', label: 'En vivo', icon: Tv, badge: liveMatchesCount > 0 ? liveMatchesCount : null },
    { id: 'cartelera', label: 'Cartelera', icon: Calendar },
    { id: 'picks', label: 'Picks IA', icon: Sparkles, highlight: true },
    { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 },
    { id: 'comunidad', label: 'Comunidad', icon: MessageSquare },
  ];

  return (
    <header className="header-nav">
      <div className="header-content">
        {/* Brand Logo */}
        <div 
          className="logo-brand" {...pressable} onClick={() => {
            sounds.playClick();
            setView('inicio');
          }}
        >
          <div className="logo-icon">
            <Zap size={22} fill="#05060a" />
          </div>
          <div className="logo-text-group">
            <div className="logo-title">
              CodeSoft <span style={{ color: 'var(--cyan-neon)' }}>Fútbol</span>
            </div>
            <div className="logo-subtitle">Fútbol en vivo · datos de ESPN</div>
          </div>
        </div>

        {/* Navigation Pills */}
        <nav className="nav-pills">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-btn-${item.id}`}
                className={`nav-pill-btn ${isActive ? 'active' : ''}`}
                onClick={() => {
                  sounds.playClick();
                  setView(item.id);
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      background: 'var(--red-live)',
                      color: '#fff',
                      fontSize: '0.68rem',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontWeight: 600
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="header-actions">
          {/* Sound Toggle */}
          <button 
            className="icon-btn header-sound-btn" 
            title={muted ? 'Activar sonido de cancha' : 'Silenciar sonido'}
            onClick={handleSoundToggle}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} style={{ color: 'var(--cyan-neon)' }} />}
          </button>

          {/* Acceso a los picks con IA */}
          <button 
            className="btn-primary header-cta-btn" 
            id="btn-nvidia-ia"
            onClick={() => setView('picks')}
          >
            <Sparkles size={14} />
            <span className="btn-cta-full">Picks con IA</span>
            <span className="btn-cta-short">Picks</span>
          </button>
        </div>
      </div>
    </header>
  );
}

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
  Send,
  Zap
} from 'lucide-react';
import { sounds } from '../utils/soundEffects';

export default function Header({ currentView, setView, liveMatchesCount = 6, onOpenTelegram }) {
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
          className="logo-brand" 
          onClick={() => {
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
            <div className="logo-subtitle">Live Sports & AI Analytics</div>
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
                      fontWeight: 800
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
            className="icon-btn" 
            title={muted ? 'Activar sonido de cancha' : 'Silenciar sonido'}
            onClick={handleSoundToggle}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} style={{ color: 'var(--cyan-neon)' }} />}
          </button>

          {/* Betano IA CTA */}
          <button 
            className="btn-primary" 
            id="btn-betano-ia"
            style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            onClick={() => setView('picks')}
          >
            <Sparkles size={14} />
            <span>Betano IA</span>
          </button>
        </div>
      </div>
    </header>
  );
}

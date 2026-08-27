import React from 'react';
import { Users, Send, Trophy, Flame, MessageSquare, Sparkles } from 'lucide-react';
import CommunityChat from './CommunityChat';
import { sounds } from '../utils/soundEffects';

export default function CommunityView({ onOpenTelegram }) {
  const leaderboard = [
    { rank: 1, name: 'Carlos_Picks', aciertos: '92%', streak: '7 en racha', points: '1,420 pts', badge: 'VIP' },
    { rank: 2, name: 'SantiFutbol', aciertos: '88%', streak: '5 en racha', points: '1,280 pts', badge: 'MOD' },
    { rank: 3, name: 'Mateo_Bet99', aciertos: '84%', streak: '4 en racha', points: '1,150 pts', badge: 'PRO' },
    { rank: 4, name: 'DiegoGol', aciertos: '81%', streak: '3 en racha', points: '980 pts', badge: '' },
    { rank: 5, name: 'NicoMadrid', aciertos: '79%', streak: '3 en racha', points: '920 pts', badge: 'VIP' },
  ];

  return (
    <div className="community-view-container" id="community-hub-view">
      {/* Header Banner */}
      <div className="community-header-banner">
        <div>
          <div className="section-tag">
            <Users size={14} />
            <span>COMUNIDAD OFICIAL CODESOFT</span>
          </div>
          <h1 className="community-banner-title">
            Únete a la Mayor Comunidad de Fútbol en Vivo
          </h1>
          <p className="community-banner-subtitle">
            Comparte tus análisis, participa en encuestas durante los partidos, compite en el ranking de tipsters y recibe las alertas de picks de NVIDIA IA antes del pitazo inicial.
          </p>
        </div>

        <div className="pill-badge-green" style={{ padding: '10px 18px', fontSize: '0.88rem' }}>
          <Sparkles size={16} />
          <span>Comunidad IA (+15K Usuarios)</span>
        </div>
      </div>

      {/* Grid: Chat + Leaderboard */}
      <div className="community-grid-layout">
        {/* Chat Room */}
        <div className="community-chat-col">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={18} style={{ color: 'var(--cyan-neon)' }} />
            <span>Chat Global de la Jornada</span>
          </h3>
          <CommunityChat matchTitle="Jornada Global" />
        </div>

        {/* Top Tipsters Leaderboard */}
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18} style={{ color: 'var(--gold-neon)' }} />
            <span>Top Tipsters & Pronosticadores</span>
          </h3>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {leaderboard.map((user) => (
                <div 
                  key={user.rank}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: user.rank === 1 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: user.rank === 1 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span 
                      style={{
                        fontFamily: 'var(--font-score)',
                        fontWeight: 800,
                        fontSize: '1.1rem',
                        color: user.rank === 1 ? 'var(--gold-neon)' : user.rank === 2 ? '#c0c0c0' : user.rank === 3 ? '#cd7f32' : 'var(--text-muted)',
                        width: '24px'
                      }}
                    >
                      #{user.rank}
                    </span>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{user.name}</span>
                        {user.badge && (
                          <span className={`chat-user-badge ${user.badge === 'VIP' ? 'badge-vip' : user.badge === 'MOD' ? 'badge-mod' : 'badge-ai'}`}>
                            {user.badge}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--cyan-neon)' }}>
                        🔥 {user.streak}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-score)', fontWeight: 800, color: 'var(--green-neon)', fontSize: '0.95rem' }}>
                      {user.aciertos}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.points}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Search, Radio, Calendar, Flame, Filter } from 'lucide-react';
import MatchCard from './MatchCard';
import { ESPN_SUPPORTED_LEAGUES } from '../api/espnApi';
import { sounds } from '../utils/soundEffects';

export default function CarteleraGrid({ 
  matches = [], 
  selectedLeague, 
  setSelectedLeague, 
  onSelectMatch, 
  onOpenPickModal 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'live', 'scheduled', 'finished'

  const liveCount = matches.filter(m => m.status === 'live').length;
  const totalCount = matches.length;

  const statusOrder = (status) => {
    if (status === 'live') return 0;
    if (status === 'scheduled') return 1;
    if (status === 'finished') return 2;
    return 3;
  };

  const filteredMatches = matches.filter(m => {
    // League filter
    if (selectedLeague !== 'all' && m.league !== selectedLeague) {
      return false;
    }
    // Status filter
    if (statusFilter === 'live' && m.status !== 'live') return false;
    if (statusFilter === 'scheduled' && m.status !== 'scheduled') return false;
    if (statusFilter === 'finished' && m.status !== 'finished') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const home = (m.homeTeam?.name || '').toLowerCase();
      const away = (m.awayTeam?.name || '').toLowerCase();
      const league = (m.leagueName || '').toLowerCase();
      return home.includes(q) || away.includes(q) || league.includes(q);
    }
    return true;
  }).sort((a, b) => {
    // 1. Prioritize LIVE matches first (0), then SCHEDULED (1), then FINISHED (2)
    const diff = statusOrder(a.status) - statusOrder(b.status);
    if (diff !== 0) return diff;
    
    // 2. Chronological order
    const timeA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
    const timeB = b.rawDate ? new Date(b.rawDate).getTime() : 0;

    if (a.status === 'scheduled') {
      return timeA - timeB; // Earliest upcoming match first (11:00 AM -> 12:00 PM -> 19:00)
    } else if (a.status === 'finished') {
      return timeB - timeA; // Most recently finished first
    }
    return timeA - timeB;
  });

  return (
    <div className="cartelera-container" id="cartelera-section">
      {/* Hero Header for Cartelera */}
      <div className="cartelera-header">
        <div className="cartelera-tag">
          <span className="live-dot" style={{ background: 'var(--gold-neon)' }} />
          ACTUALIZADA AL MINUTO
        </div>

        <h1 className="cartelera-title">LA CARTELERA DE HOY</h1>
        
        <p className="cartelera-subtitle">
          Todos los partidos de hoy, con horarios, estadísticas en tiempo real y opciones para seguir cada encuentro.
        </p>

        <div className="cartelera-stats-row">
          <div className="cartelera-stat-item">
            <Calendar size={16} style={{ color: 'var(--gold-neon)' }} />
            <span>{totalCount} PARTIDOS HOY</span>
          </div>
          <div className="cartelera-stat-item live">
            <span className="live-dot" />
            <span>{liveCount} EN VIVO AHORA</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="cartelera-toolbar">
        {/* Status filter tabs */}
        <div className="nav-pills cartelera-status-pills">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'live', label: `En Vivo (${liveCount})` },
            { id: 'scheduled', label: 'Próximos' },
            { id: 'finished', label: 'Finalizados' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`nav-pill-btn ${statusFilter === tab.id ? 'active' : ''}`}
              onClick={() => {
                sounds.playClick();
                setStatusFilter(tab.id);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="cartelera-search-box">
          <Search size={16} className="cartelera-search-icon" />
          <input
            type="text"
            placeholder="Buscar equipo o torneo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="chat-input cartelera-search-input"
          />
        </div>
      </div>

      {/* League Filter Chips Bar */}
      <div className="leagues-filter-bar">
        {ESPN_SUPPORTED_LEAGUES.map(lg => {
          const isActive = selectedLeague === lg.id;
          return (
            <button
              key={lg.id}
              className={`league-chip ${isActive ? 'active' : ''}`}
              onClick={() => {
                sounds.playClick();
                setSelectedLeague(lg.id);
              }}
            >
              <span>{lg.icon}</span>
              <span>{lg.name}</span>
            </button>
          );
        })}
      </div>

      {/* Grid of Match Cards */}
      {filteredMatches.length > 0 ? (
        <div className="matches-grid">
          {filteredMatches.map(m => (
            <MatchCard
              key={m.id}
              match={m}
              onSelectMatch={onSelectMatch}
              onOpenPickModal={onOpenPickModal}
            />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '12px' }}>
            No se encontraron partidos con los filtros seleccionados.
          </p>
          <button 
            className="btn-secondary"
            onClick={() => {
              setSelectedLeague('all');
              setStatusFilter('all');
              setSearchQuery('');
            }}
          >
            Restablecer filtros
          </button>
        </div>
      )}
    </div>
  );
}

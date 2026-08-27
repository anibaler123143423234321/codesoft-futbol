import React, { useState, useEffect } from 'react';
import TickerMarquee from './components/TickerMarquee';
import Header from './components/Header';
import HeroBanner from './components/HeroBanner';
import CarteleraGrid from './components/CarteleraGrid';
import MatchCenter from './components/MatchCenter';
import AIPicksView from './components/AIPicksView';
import CommunityView from './components/CommunityView';
import StatsView from './components/StatsView';
import ModalPick from './components/ModalPick';
import Footer from './components/Footer';
import { fetchEspnScoreboard, fetchEspnMatchSummary } from './api/espnApi';
// import { fetchFullMatchDetail } from './api/apiFootball'; // Desactivado: reemplazado 100% por ESPN API ilimitada
import { sounds } from './utils/soundEffects';
import { Send, X, CheckCircle2, RotateCw } from 'lucide-react';

export default function App() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('inicio'); // 'inicio', 'envivo', 'cartelera', 'picks', 'estadisticas', 'comunidad'
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedLeague, setSelectedLeague] = useState('all');
  const [modalPickMatch, setModalPickMatch] = useState(null);

  // Initial and Periodic Fetch from real ESPN Live Scoreboard
  useEffect(() => {
    let isMounted = true;

    async function loadScoreboard() {
      try {
        const liveData = await fetchEspnScoreboard(selectedLeague);
        if (isMounted) {
          if (liveData && liveData.length > 0) {
            setMatches(prevMatches => {
              return liveData.map(newItem => {
                const existing = prevMatches.find(p => p.id === newItem.id);
                if (!existing) return { ...newItem, _source: {} };
                const src = existing._source || {};
                return {
                  ...newItem,
                  _source: src,
                  stats: src.stats ? existing.stats : (existing.stats || newItem.stats),
                  scorers: src.scorers ? existing.scorers : (existing.scorers && existing.scorers.length > 0 ? existing.scorers : newItem.scorers),
                  commentary: src.commentary ? existing.commentary : (existing.commentary || newItem.commentary),
                  rosters: src.rosters ? existing.rosters : (existing.rosters || newItem.rosters),
                  gameInfo: src.gameInfo ? existing.gameInfo : (existing.gameInfo || newItem.gameInfo),
                  poll: existing.poll || newItem.poll,
                  homeTeam: {
                    ...newItem.homeTeam,
                    yellowCards: existing.homeTeam?.yellowCards !== undefined ? existing.homeTeam.yellowCards : (newItem.homeTeam?.yellowCards ?? 0),
                    redCards: existing.homeTeam?.redCards !== undefined ? existing.homeTeam.redCards : (newItem.homeTeam?.redCards ?? 0),
                  },
                  awayTeam: {
                    ...newItem.awayTeam,
                    yellowCards: existing.awayTeam?.yellowCards !== undefined ? existing.awayTeam.yellowCards : (newItem.awayTeam?.yellowCards ?? 0),
                    redCards: existing.awayTeam?.redCards !== undefined ? existing.awayTeam.redCards : (newItem.awayTeam?.redCards ?? 0),
                  }
                };
              });
            });

            setSelectedMatch(prev => {
              if (!prev) return { ...liveData[0], _source: {} };
              const updated = liveData.find(m => m.id === prev.id);
              if (!updated) return prev;
              const src = prev._source || {};

              return {
                ...prev,
                ...updated,
                homeTeam: {
                  ...updated.homeTeam,
                  ...prev.homeTeam,
                  score: updated.homeTeam?.score ?? prev.homeTeam?.score,
                  yellowCards: prev.homeTeam?.yellowCards !== undefined ? prev.homeTeam.yellowCards : (updated.homeTeam?.yellowCards ?? 0),
                  redCards: prev.homeTeam?.redCards !== undefined ? prev.homeTeam.redCards : (updated.homeTeam?.redCards ?? 0),
                },
                awayTeam: {
                  ...updated.awayTeam,
                  ...prev.awayTeam,
                  score: updated.awayTeam?.score ?? prev.awayTeam?.score,
                  yellowCards: prev.awayTeam?.yellowCards !== undefined ? prev.awayTeam.yellowCards : (updated.awayTeam?.yellowCards ?? 0),
                  redCards: prev.awayTeam?.redCards !== undefined ? prev.awayTeam.redCards : (updated.awayTeam?.redCards ?? 0),
                },
                status: updated.status || prev.status,
                clock: updated.clock || prev.clock,
                minute: updated.minute || prev.minute,
                timeStr: updated.timeStr || prev.timeStr,
                statusText: updated.statusText || prev.statusText,
                stats: src.stats ? prev.stats : (prev.stats || updated.stats),
                scorers: src.scorers ? prev.scorers : (prev.scorers && prev.scorers.length > 0 ? prev.scorers : updated.scorers),
                commentary: src.commentary ? prev.commentary : (prev.commentary || updated.commentary),
                rosters: src.rosters ? prev.rosters : (prev.rosters || updated.rosters),
                gameInfo: src.gameInfo ? prev.gameInfo : (prev.gameInfo || updated.gameInfo),
                poll: prev.poll || updated.poll,
              };
            });
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('ESPN API fetch error:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadScoreboard();
    const interval = setInterval(loadScoreboard, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedLeague]);

  // Source priority: 'api-football' (3) > 'espn-summary' (2) > 'espn-generated' (1) > none (0)
  const SOURCE_PRIORITY = { 'api-football': 3, 'espn-summary': 2, 'espn-generated': 1 };
  const canOverwrite = (currentSource, newSource) => {
    if (!currentSource) return true;
    return (SOURCE_PRIORITY[newSource] || 0) >= (SOURCE_PRIORITY[currentSource] || 0);
  };
  const normalizeTeamName = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

  // Function to load complete live detail (ESPN Summary + API-Football) for any match
  const loadMatchDetail = async (matchToLoad) => {
    if (!matchToLoad || !matchToLoad.id) return;

    // 1. ESPN Summary (free, unlimited, live Opta stats & clock)
    try {
      const summary = await fetchEspnMatchSummary(matchToLoad.id, matchToLoad.league || 'all');
      if (summary) {
        setSelectedMatch(prev => {
          if (!prev || prev.id !== matchToLoad.id) return prev;
          const src = { ...(prev._source || {}) };
          const merged = { ...prev, ...summary };
          if (summary.homeTeam) {
            merged.homeTeam = {
              ...prev.homeTeam,
              ...summary.homeTeam,
              yellowCards: summary.homeTeam.yellowCards !== undefined ? summary.homeTeam.yellowCards : (prev.homeTeam?.yellowCards ?? 0),
              redCards: summary.homeTeam.redCards !== undefined ? summary.homeTeam.redCards : (prev.homeTeam?.redCards ?? 0),
            };
          }
          if (summary.awayTeam) {
            merged.awayTeam = {
              ...prev.awayTeam,
              ...summary.awayTeam,
              yellowCards: summary.awayTeam.yellowCards !== undefined ? summary.awayTeam.yellowCards : (prev.awayTeam?.yellowCards ?? 0),
              redCards: summary.awayTeam.redCards !== undefined ? summary.awayTeam.redCards : (prev.awayTeam?.redCards ?? 0),
            };
          }
          if (summary.stats?.hasData) {
            merged.stats = summary.stats;
            src.stats = 'espn-summary';
          }
          if (summary.scorers?.length > 0) {
            merged.scorers = summary.scorers;
            src.scorers = 'espn-summary';
          }
          if (summary.commentary?.length > 0) {
            merged.commentary = summary.commentary;
            src.commentary = 'espn-summary';
          }
          if (summary.rosters?.length > 0) {
            merged.rosters = summary.rosters;
            src.rosters = 'espn-summary';
          }
          if (summary.gameInfo) {
            merged.gameInfo = { ...prev.gameInfo, ...summary.gameInfo };
            src.gameInfo = 'espn-summary';
          }
          if (summary.oddsInfo) {
            merged.oddsInfo = summary.oddsInfo;
          }
          merged._source = src;
          return merged;
        });

        // Also sync matches array so the detailed cards and stats are stored globally
        setMatches(prevMatches => {
          return prevMatches.map(m => {
            if (m.id !== matchToLoad.id) return m;
            return {
              ...m,
              ...summary,
              homeTeam: {
                ...m.homeTeam,
                ...summary.homeTeam,
                yellowCards: summary.homeTeam?.yellowCards !== undefined ? summary.homeTeam.yellowCards : (m.homeTeam?.yellowCards ?? 0),
                redCards: summary.homeTeam?.redCards !== undefined ? summary.homeTeam.redCards : (m.homeTeam?.redCards ?? 0),
              },
              awayTeam: {
                ...m.awayTeam,
                ...summary.awayTeam,
                yellowCards: summary.awayTeam?.yellowCards !== undefined ? summary.awayTeam.yellowCards : (m.awayTeam?.yellowCards ?? 0),
                redCards: summary.awayTeam?.redCards !== undefined ? summary.awayTeam.redCards : (m.awayTeam?.redCards ?? 0),
              },
              stats: summary.stats?.hasData ? summary.stats : m.stats,
              scorers: summary.scorers?.length > 0 ? summary.scorers : m.scorers,
              rosters: summary.rosters?.length > 0 ? summary.rosters : m.rosters,
              commentary: summary.commentary?.length > 0 ? summary.commentary : m.commentary
            };
          });
        });
      }
    } catch (e) {
      console.warn('[ESPN Summary Refresh]', e);
    }
  };

  // Automatically fetch detailed summary whenever selectedMatch changes
  useEffect(() => {
    if (selectedMatch?.id) {
      loadMatchDetail(selectedMatch);
    }
  }, [selectedMatch?.id]);

  // Live periodic refresh for active live match every 6 seconds (Ultra-Fast Response)
  useEffect(() => {
    if (selectedMatch && (selectedMatch.status === 'live' || currentView === 'envivo')) {
      const liveInterval = setInterval(() => {
        loadMatchDetail(selectedMatch);
      }, 6000);
      return () => clearInterval(liveInterval);
    }
  }, [selectedMatch?.id, selectedMatch?.status, currentView]);

  const handleSelectMatch = async (match) => {
    sounds.playClick();
    setSelectedMatch(prev => {
      if (prev && prev.id === match.id) {
        return {
          ...match,
          ...prev,
          homeTeam: { ...match.homeTeam, ...prev.homeTeam },
          awayTeam: { ...match.awayTeam, ...prev.awayTeam }
        };
      }
      return { ...match, _source: match._source || {} };
    });
    setCurrentView('envivo');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavChange = (view) => {
    if (view === 'envivo') {
      // Only set default if no match is currently selected
      setSelectedMatch(prev => {
        if (prev && prev.id) return prev; // DO NOT reset or wipe out loaded details of the current match!
        const activeLive = matches.find(m => m.status === 'live');
        return activeLive ? { ...activeLive } : (matches[0] ? { ...matches[0] } : null);
      });
    }
    setCurrentView(view);
  };

  const handleOpenPickModal = (match) => {
    sounds.playGoalChime();
    setModalPickMatch(match);
  };

  const liveMatches = matches.filter(m => m.status === 'live');
  const activeLiveMatch = liveMatches.length > 0 ? liveMatches[0] : null;
  const currentMatchToDisplay = selectedMatch || activeLiveMatch || matches[0];

  if (loading && matches.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <RotateCw className="animate-spin" size={48} style={{ color: 'var(--cyan-neon)', margin: '0 auto 16px' }} />
          <h2 style={{ fontFamily: 'var(--font-score)', fontSize: '1.5rem', fontWeight: 800 }}>
            Conectando con la API en vivo de ESPN...
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
            Obteniendo partidos oficiales, marcadores al minuto y estadísticas en directo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Top Live Scores Ticker Bar with Real ESPN Data */}
      <TickerMarquee 
        matches={matches} 
        onSelectMatch={handleSelectMatch} 
      />

      {/* Main Header */}
      <Header
        currentView={currentView}
        setView={handleNavChange}
        liveMatchesCount={liveMatches.length}
      />

      {/* Main View Router */}
      <main className="main-content">
        {currentView === 'inicio' && (
          <HeroBanner
            featuredMatch={currentMatchToDisplay}
            onSelectMatch={handleSelectMatch}
            setView={handleNavChange}
            onOpenPickModal={handleOpenPickModal}
            liveCount={liveMatches.length}
          />
        )}

        {currentView === 'cartelera' && (
          <CarteleraGrid
            matches={matches}
            selectedLeague={selectedLeague}
            setSelectedLeague={setSelectedLeague}
            onSelectMatch={handleSelectMatch}
            onOpenPickModal={handleOpenPickModal}
          />
        )}

        {currentView === 'envivo' && (
          <MatchCenter
            match={currentMatchToDisplay}
            allMatches={matches}
            liveMatches={liveMatches}
            onSelectMatch={handleSelectMatch}
            onBack={() => handleNavChange('cartelera')}
            onOpenPickModal={handleOpenPickModal}
          />
        )}

        {currentView === 'picks' && (
          <AIPicksView
            matches={matches}
            onSelectMatch={handleSelectMatch}
            onOpenPickModal={handleOpenPickModal}
          />
        )}

        {currentView === 'estadisticas' && (
          <StatsView />
        )}

        {currentView === 'comunidad' && (
          <CommunityView />
        )}
      </main>

      {/* NVIDIA NIM IA Pick Modal */}
      {modalPickMatch && (
        <ModalPick
          match={modalPickMatch}
          onClose={() => setModalPickMatch(null)}
        />
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { BarChart3, Trophy, Target, Shield, RotateCw } from 'lucide-react';
import { ESPN_SUPPORTED_LEAGUES, fetchEspnStandings } from '../api/espnApi';
import TeamLogo from './TeamLogo';
import { sounds } from '../utils/soundEffects';

export default function StatsView() {
  const [selectedLeague, setSelectedLeague] = useState('esp.1');
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function loadRealStandings() {
      try {
        const data = await fetchEspnStandings(selectedLeague);
        if (isMounted) {
          setStandings(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load ESPN standings:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadRealStandings();

    return () => {
      isMounted = false;
    };
  }, [selectedLeague]);

  const activeLeagueObj = ESPN_SUPPORTED_LEAGUES.find(l => l.id === selectedLeague) || ESPN_SUPPORTED_LEAGUES[2];

  return (
    <div className="stats-view-container" id="stats-center-view">
      {/* Title */}
      <div>
        <div className="section-tag">
          <BarChart3 size={14} />
          <span>TABLA DE POSICIONES OFICIAL ESPN</span>
        </div>
        <h1 className="stats-header-title">
          Clasificación Oficial: {activeLeagueObj.name}
        </h1>
      </div>

      {/* League Filter */}
      <div className="leagues-filter-bar">
        {ESPN_SUPPORTED_LEAGUES.filter(l => l.id !== 'all').map(lg => (
          <button
            key={lg.id}
            className={`league-chip ${selectedLeague === lg.id ? 'active' : ''}`}
            onClick={() => {
              sounds.playClick();
              setSelectedLeague(lg.id);
            }}
          >
            <span>{lg.icon}</span>
            <span>{lg.name}</span>
          </button>
        ))}
      </div>

      {/* Standings Table from ESPN */}
      <div className="stats-table-card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={18} style={{ color: 'var(--gold-neon)' }} />
          <span>Tabla General de {activeLeagueObj.name}</span>
        </h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
            <RotateCw className="animate-spin" size={32} style={{ color: 'var(--cyan-neon)', margin: '0 auto 12px' }} />
            <p>Cargando posiciones oficiales de ESPN...</p>
          </div>
        ) : standings.length > 0 ? (
          <div className="stats-table-scroll-container">
            <table className="stats-standings-table">
              <thead>
                <tr>
                  <th className="th-pos">#</th>
                  <th className="th-club">Club</th>
                  <th className="th-center">PJ</th>
                  <th className="th-center col-hide-sm">G</th>
                  <th className="th-center col-hide-sm">E</th>
                  <th className="th-center col-hide-sm">P</th>
                  <th className="th-center col-hide-md">GF</th>
                  <th className="th-center col-hide-md">GC</th>
                  <th className="th-center">DG</th>
                  <th className="th-center th-pts">PTS</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.pos}>
                    <td className={`td-pos ${row.pos <= 4 ? 'top-tier' : ''}`}>
                      {row.pos}
                    </td>
                    <td className="td-club">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TeamLogo src={row.logo} alt={row.team} size={22} />
                        <span className="td-club-name">{row.team}</span>
                      </div>
                    </td>
                    <td className="td-center td-muted">{row.pj}</td>
                    <td className="td-center col-hide-sm">{row.g}</td>
                    <td className="td-center col-hide-sm">{row.e}</td>
                    <td className="td-center col-hide-sm">{row.p}</td>
                    <td className="td-center col-hide-md">{row.gf}</td>
                    <td className="td-center col-hide-md">{row.gc}</td>
                    <td className={`td-center ${row.dg > 0 ? 'dg-pos' : row.dg < 0 ? 'dg-neg' : ''}`}>
                      {row.dg > 0 ? `+${row.dg}` : row.dg}
                    </td>
                    <td className="td-center td-pts">
                      {row.pts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
            <p>No hay datos de clasificación disponibles para esta liga en este momento.</p>
          </div>
        )}
      </div>
    </div>
  );
}

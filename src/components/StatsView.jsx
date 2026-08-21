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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} id="stats-center-view">
      {/* Title */}
      <div>
        <div className="section-tag">
          <BarChart3 size={14} />
          <span>TABLA DE POSICIONES OFICIAL ESPN</span>
        </div>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 900, color: '#fff' }}>
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
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', overflowX: 'auto' }}>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <th style={{ padding: '8px 4px' }}>#</th>
                <th style={{ padding: '8px' }}>Club</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>PJ</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>G</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>E</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>P</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>GF</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>GC</th>
                <th style={{ padding: '8px', textAlign: 'center' }}>DG</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: 800, color: '#fff' }}>PTS</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => (
                <tr key={row.pos} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '12px 4px', fontFamily: 'var(--font-score)', fontWeight: 800, color: row.pos <= 4 ? 'var(--cyan-neon)' : 'inherit' }}>
                    {row.pos}
                  </td>
                  <td style={{ padding: '12px 8px', fontWeight: 700, color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <TeamLogo src={row.logo} alt={row.team} size={24} />
                      <span>{row.team}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>{row.pj}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{row.g}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{row.e}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{row.p}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{row.gf}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{row.gc}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: row.dg > 0 ? 'var(--green-neon)' : row.dg < 0 ? 'var(--red-live)' : 'inherit' }}>
                    {row.dg > 0 ? `+${row.dg}` : row.dg}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'var(--font-score)', fontWeight: 800, color: 'var(--gold-neon)', fontSize: '1rem' }}>
                    {row.pts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
            <p>No hay datos de clasificación disponibles para esta liga en este momento.</p>
          </div>
        )}
      </div>
    </div>
  );
}

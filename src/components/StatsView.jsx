import React, { useState, useEffect } from 'react';
import { BarChart3, Trophy, ChevronUp, ChevronDown } from 'lucide-react';
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

  // Una entrada por zona, en el orden en que aparecen en la tabla
  const zones = standings.reduce((acc, r) => (r.zone && !acc.some((z) => z.key === r.zone.key) ? [...acc, r.zone] : acc), []);

  const activeLeagueObj = ESPN_SUPPORTED_LEAGUES.find(l => l.id === selectedLeague) || ESPN_SUPPORTED_LEAGUES[2];

  return (
    <div className="stats-view-container" id="stats-center-view">
      {/* Title */}
      <div>
        <div className="section-tag">
          <BarChart3 size={14} />
          <span>Tabla de posiciones · ESPN</span>
        </div>
        <h1 className="stats-header-title">
          Clasificación de {activeLeagueObj.name}
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
        <h3 className="stats-table-title">
          <Trophy size={18} />
          <span>Tabla general</span>
          {standings[0]?.pj ? <small>Jornada {Math.max(...standings.map((r) => Number(r.pj) || 0))}</small> : null}
        </h3>

        {loading ? (
          <div className="stats-skeleton" role="status" aria-label="Cargando la tabla de ESPN">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="sk-row">
                <i className="sk-pos" />
                <i className="sk-logo" />
                <i className="sk-name" style={{ width: `${34 + ((i * 17) % 30)}%` }} />
                <i className="sk-num" />
                <i className="sk-num" />
                <i className="sk-num" />
              </div>
            ))}
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
                  <tr key={row.pos} className={row.zone ? `zone-${row.zone.key}` : undefined}>
                    <td className="td-pos" title={row.zone?.label}>
                      <span className="td-pos-num">{row.pos}</span>
                    </td>
                    <td className="td-club">
                      <div className="td-club-row">
                        <TeamLogo src={row.logo} alt={row.team} size={22} />
                        <span className="td-club-name">{row.team}</span>
                        {row.rankChange > 0 && <span className="td-move up" title={`Subió ${row.rankChange}`}><ChevronUp size={13} />{row.rankChange}</span>}
                        {row.rankChange < 0 && <span className="td-move down" title={`Bajó ${-row.rankChange}`}><ChevronDown size={13} />{-row.rankChange}</span>}
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
            {zones.length > 0 && (
              <ul className="stats-zones" aria-label="Zonas de la tabla">
                {zones.map((z) => <li key={z.key} className={`zone-${z.key}`}><i />{z.label}</li>)}
              </ul>
            )}
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

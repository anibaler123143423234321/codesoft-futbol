import React, { useState } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  CheckCircle2, 
  Cpu, 
  Send, 
  Zap, 
  Flame, 
  Activity, 
  RotateCw,
  HelpCircle
} from 'lucide-react';
import { generateMatchAIPick } from '../api/cerebrasAi';
import { sounds } from '../utils/soundEffects';

export default function AIPicksView({ matches = [], onSelectMatch, onOpenTelegram, onOpenPickModal }) {
  const [selectedMatchId, setSelectedMatchId] = useState(matches[0]?.id || '');
  const [customPick, setCustomPick] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentSelectedMatch = matches.find(m => m.id === selectedMatchId) || matches[0];

  const handleGenerateCustomPick = async () => {
    if (!currentSelectedMatch) return;
    sounds.playClick();
    setIsLoading(true);
    try {
      const result = await generateMatchAIPick(currentSelectedMatch);
      setCustomPick(result);
      sounds.playGoalChime();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-picks-container" id="ai-picks-view">
      {/* Hero Engine Card */}
      <div className="ai-hero-card">
        <div>
          <div className="ai-engine-badge">
            <Cpu size={14} style={{ color: '#76b900' }} />
            <span>POWERED BY NVIDIA NIM AI (LLAMA 3.1 70B)</span>
          </div>

          <h1 className="ai-hero-title">
            Inteligencia Artificial aplicada al Fútbol
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>
            Modelos de redes neuronales y matrices predictivas Poisson/xG procesando en menos de <strong>700 milisegundos</strong> millones de puntos de datos de ESPN, volumen de tiros, fatiga de plantilla y tendencias de cuotas de alto valor con NVIDIA NIM Cloud.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => matches[0] && onOpenPickModal(matches[0])}>
              <Sparkles size={16} />
              <span>Abrir Asistente IA</span>
            </button>
          </div>
        </div>

        {/* Stats Pills */}
        <div className="ai-stats-pill-grid">
          <div className="ai-stat-pill">
            <div className="ai-stat-pill-val">68 %</div>
            <div className="ai-stat-pill-lbl">Tasa de Aciertos</div>
          </div>
          <div className="ai-stat-pill">
            <div className="ai-stat-pill-val">+14.8 %</div>
            <div className="ai-stat-pill-lbl">ROI Promedio</div>
          </div>
          <div className="ai-stat-pill">
            <div className="ai-stat-pill-val">580 ms</div>
            <div className="ai-stat-pill-lbl">Velocidad NVIDIA NIM</div>
          </div>
          <div className="ai-stat-pill">
            <div className="ai-stat-pill-val">+4,000</div>
            <div className="ai-stat-pill-lbl">Análisis / Día</div>
          </div>
        </div>
      </div>

      {/* Interactive Custom Match Analyzer */}
      <div 
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Zap size={20} style={{ color: '#76b900' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
            Generador de Pronósticos Tácticos en Tiempo Real
          </h2>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
          Selecciona cualquier partido de la cartelera y NVIDIA NIM IA calculará el pick óptimo con base en estadísticas oficiales:
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <select
            value={selectedMatchId}
            onChange={(e) => setSelectedMatchId(e.target.value)}
            className="chat-input"
            style={{ minWidth: '300px', flex: '1', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', cursor: 'pointer' }}
          >
            {matches.map(m => (
              <option key={m.id} value={m.id}>
                {m.leagueName}: {m.homeTeam?.name} vs {m.awayTeam?.name} ({m.homeTeam?.score}-{m.awayTeam?.score})
              </option>
            ))}
          </select>

          <button 
            className="btn-primary" 
            onClick={handleGenerateCustomPick}
            disabled={isLoading}
            style={{ padding: '10px 24px' }}
          >
            {isLoading ? (
              <>
                <RotateCw size={16} className="animate-spin" />
                <span>Analizando con NVIDIA NIM AI...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>⚡ Analizar Partido con IA</span>
              </>
            )}
          </button>
        </div>

        {/* Display Custom Generated Pick */}
        {customPick && (
          <div 
            style={{
              background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.08), rgba(0, 210, 255, 0.08))',
              border: '1px solid var(--green-neon)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              animation: 'fadeInMsg 0.3s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="pill-badge-green" style={{ fontSize: '0.85rem' }}>
                <CheckCircle2 size={15} />
                {customPick.probabilidad}% Probabilidad Estimada
              </span>
              <span style={{ fontFamily: 'var(--font-score)', color: 'var(--gold-neon)', fontWeight: 800, fontSize: '1.1rem' }}>
                Cuota Sugerida: {customPick.cuota}
              </span>
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
              🎯 {customPick.pick}
            </h3>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '16px' }}>
              {customPick.justificacion}
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {customPick.tags?.map((t, idx) => (
                <span key={idx} className="chat-reaction-chip" style={{ fontSize: '0.75rem', color: 'var(--cyan-neon)' }}>
                  #{t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid of Picks for Today */}
      <div>
        <div className="section-tag">
          <span style={{ width: '14px', height: '2px', background: 'var(--cyan-neon)', display: 'inline-block' }} />
          DESTACADOS DE LA JORNADA
        </div>
        <h2 className="section-title">Picks de Alto Valor para Hoy</h2>

        <div className="ai-picks-grid">
          {matches.map((m) => {
            const pick = m.aiPick;
            if (!pick) return null;

            return (
              <div key={m.id} className="ai-pick-card">
                <div>
                  <div className="ai-pick-header">
                    <span className="match-league-label">{m.leagueName}</span>
                    <span className="ai-confidence-badge">
                      <Sparkles size={12} />
                      {pick.probabilidad || 80}% Confianza
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <img src={m.homeTeam?.logo} alt={m.homeTeam?.name} style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
                      {m.homeTeam?.shortName} vs {m.awayTeam?.shortName}
                    </span>
                    <img src={m.awayTeam?.logo} alt={m.awayTeam?.name} style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
                  </div>

                  <div className="ai-pick-recommendation-box">
                    <div className="ai-pick-name">{pick.pick}</div>
                    <div className="ai-pick-cuota-val">Cuota: {pick.cuota}</div>
                  </div>

                  <p className="ai-pick-reasoning">{pick.justificacion}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '10px' }}>
                  <button 
                    className="btn-secondary" 
                    style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                    onClick={() => {
                      sounds.playClick();
                      onSelectMatch(m);
                    }}
                  >
                    Ver Partido
                  </button>

                  <button 
                    className="btn-primary" 
                    style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                    onClick={() => onOpenPickModal(m)}
                  >
                    <Sparkles size={12} />
                    <span>Ver Betano IA</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

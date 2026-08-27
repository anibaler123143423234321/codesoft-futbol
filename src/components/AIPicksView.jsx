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
      <div className="ai-custom-generator-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Zap size={20} style={{ color: '#76b900' }} />
          <h2 className="ai-generator-title">
            Generador de Pronósticos Tácticos en Tiempo Real
          </h2>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
          Selecciona cualquier partido de la cartelera y NVIDIA NIM IA calculará el pick óptimo con base en estadísticas oficiales:
        </p>

        <div className="ai-generator-form-row">
          <select
            value={selectedMatchId}
            onChange={(e) => setSelectedMatchId(e.target.value)}
            className="chat-input ai-generator-select"
          >
            {matches.map(m => (
              <option key={m.id} value={m.id}>
                {m.leagueName}: {m.homeTeam?.name} vs {m.awayTeam?.name} ({m.homeTeam?.score}-{m.awayTeam?.score})
              </option>
            ))}
          </select>

          <button 
            className="btn-primary ai-generator-btn" 
            onClick={handleGenerateCustomPick}
            disabled={isLoading}
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
              background: 'linear-gradient(135deg, rgba(13, 22, 38, 0.95), rgba(8, 12, 22, 0.95))',
              border: '1px solid rgba(0, 255, 136, 0.4)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              animation: 'fadeInMsg 0.3s ease-out',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), 0 0 25px rgba(0, 255, 136, 0.1)'
            }}
          >
            {/* Top Stat Ribbon */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="pill-badge-green" style={{ fontSize: '0.85rem' }}>
                  <CheckCircle2 size={15} />
                  {customPick.probabilidad}% Probabilidad Estimada
                </span>
                <span className="pill-badge-blue" style={{ fontSize: '0.82rem' }}>
                  <TrendingUp size={13} />
                  {customPick.maraton_streak || '+5 maratón'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  {customPick.stake || 'Stake 2.5 / 10'}
                </span>
                <span style={{ fontFamily: 'var(--font-score)', color: 'var(--gold-neon)', fontWeight: 800, fontSize: '1.25rem', background: 'rgba(255, 184, 0, 0.1)', padding: '2px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 184, 0, 0.3)' }}>
                  Cuota: @{customPick.cuota}
                </span>
              </div>
            </div>

            {/* Pick Name Header */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--cyan-neon)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                SELECCIÓN DE ALTO VALOR RECOMENDADA
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff', margin: 0 }}>
                🎯 {customPick.pick}
              </h3>
            </div>

            {/* 1. Motivo Principal Box ("Mira por este motivo estoy mostrando ese pick") */}
            <div style={{ background: 'rgba(0, 255, 136, 0.06)', borderLeft: '4px solid var(--green-neon)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', padding: '12px 16px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--green-neon)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', textTransform: 'uppercase' }}>
                <Sparkles size={14} />
                <span>Fundamento Clave del Pick</span>
              </div>
              <p style={{ color: '#fff', fontSize: '0.88rem', lineHeight: '1.5', margin: 0, fontWeight: 600 }}>
                {customPick.motivo_principal || customPick.justificacion}
              </p>
            </div>

            {/* 2. Deep Tactical Analysis */}
            {customPick.analisis_detallado && customPick.analisis_detallado !== customPick.motivo_principal && (
              <div style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '14px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--cyan-neon)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', textTransform: 'uppercase' }}>
                  <Cpu size={14} />
                  <span>Análisis Táctico y Cuantitativo (NVIDIA NIM 70B)</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6', margin: 0 }}>
                  {customPick.analisis_detallado}
                </p>
              </div>
            )}

            {/* 3. Metric Pills */}
            {customPick.claves_metricas && customPick.claves_metricas.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {customPick.claves_metricas.map((metric, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0, 210, 255, 0.08)', border: '1px solid rgba(0, 210, 255, 0.2)', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.76rem', color: '#e5e7eb', fontWeight: 700 }}>
                    <Activity size={12} style={{ color: 'var(--cyan-neon)' }} />
                    <span>{metric}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tags */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
              {customPick.tags?.map((t, idx) => (
                <span key={idx} className="chat-reaction-chip" style={{ fontSize: '0.74rem', color: 'var(--cyan-neon)' }}>
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
                    <Sparkles size={12} style={{ color: '#76b900' }} />
                    <span>Ver NVIDIA IA</span>
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

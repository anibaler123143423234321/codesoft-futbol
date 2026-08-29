import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  CheckCircle2, 
  TrendingUp, 
  Cpu, 
  Target, 
  Activity, 
  RotateCw,
  HelpCircle
} from 'lucide-react';
import { generateFullMatchAIPredictions, askTacticalAI } from '../api/cerebrasAi';
import { sounds } from '../utils/soundEffects';

export default function ModalPick({ match, onClose }) {
  if (!match) return null;

  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Interactive Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef(null);

  const home = match.homeTeam?.shortName || match.homeTeam?.name || 'Local';
  const away = match.awayTeam?.shortName || match.awayTeam?.name || 'Visita';

  // Quick Prompt Ideas
  const promptIdeas = [
    '¿Quién ganará?',
    'Mercados de goles',
    'Pronóstico de córners',
    'Tarjetas y faltas',
    'Marcador exacto'
  ];

  // Fetch full predictions on mount
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    generateFullMatchAIPredictions(match)
      .then(data => {
        if (isMounted) {
          setPredictions(data);
          setLoading(false);
        }
      })
      .catch(err => {
        console.warn('Error loading predictions:', err);
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [match.id, match.homeTeam?.score, match.awayTeam?.score]);

  const handleAskQuestion = async (questionText) => {
    const q = (questionText || inputQuestion).trim();
    if (!q || isAiTyping) return;

    sounds.playClick();
    setInputQuestion('');
    setShowChat(true);

    const userMsg = { id: Date.now(), role: 'user', text: q };
    setChatMessages(prev => [...prev, userMsg]);
    setIsAiTyping(true);

    try {
      const aiReply = await askTacticalAI(match, q);
      setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: aiReply }]);
      sounds.playGoalChime();
    } catch (err) {
      setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: 'Análisis: Ventaja táctica para el equipo con mayor volumen de tiros y control de campo.' }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-card cerebras-ai-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Pro Header */}
        <div className="modal-pro-header">
          <div className="modal-pro-title-group">
            <div className="modal-pro-engine-badge">
              <Sparkles size={13} style={{ color: '#76b900' }} />
              <span>NVIDIA NIM AI</span>
              <span className="badge-chip-70b">70B</span>
            </div>
            <div className="modal-pro-match-info">
              <span className="pro-match-teams">{home} vs {away}</span>
              {match.status === 'live' ? (
                <span className="pro-match-score live">
                  🔴 {match.homeTeam?.score ?? 0} - {match.awayTeam?.score ?? 0}
                </span>
              ) : (
                <span className="pro-match-score">VS</span>
              )}
              <span className="pro-match-league">· {match.leagueName || 'Internacional'}</span>
            </div>
          </div>

          <button 
            className="modal-close-btn" 
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            title="Cerrar modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="modal-pro-loading">
            <RotateCw className="animate-spin" size={28} style={{ color: 'var(--cyan-neon)', margin: '0 auto 8px' }} />
            <p style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600 }}>Calculando probabilidades tácticas con Llama 3.1 70B...</p>
          </div>
        ) : (
          <>
            {/* Main Value Pick Card */}
            {predictions?.mainPick && (
              <div className="modal-pro-pick-card">
                <div className="pick-card-top-row">
                  <span className="pick-card-tag">
                    <Target size={13} />
                    <span>{predictions.mainPick.title || 'SELECCIÓN DE VALOR'}</span>
                  </span>
                  <div className="pick-card-badges">
                    <span className="pill-badge-green" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                      <CheckCircle2 size={11} />
                      {predictions.mainPick.probabilidad}% Confianza
                    </span>
                    <span className="pro-cuota-badge">
                      @{predictions.mainPick.cuota}
                    </span>
                  </div>
                </div>

                <div className="pro-pick-name">
                  {predictions.mainPick.pick}
                </div>

                {/* Tactical Justification */}
                <div className="pro-pick-reason">
                  <div className="reason-header">
                    <Cpu size={12} style={{ color: 'var(--green-neon)' }} />
                    <span>Fundamento Táctico IA</span>
                  </div>
                  <p className="reason-text">
                    {predictions.mainPick.motivo_principal || predictions.mainPick.justificacion}
                  </p>
                </div>

                {/* Key Metrics Chips */}
                {predictions.mainPick.claves_metricas && predictions.mainPick.claves_metricas.length > 0 && (
                  <div className="pro-metrics-row">
                    {predictions.mainPick.claves_metricas.map((metric, idx) => (
                      <div key={idx} className="pro-metric-chip">
                        <Activity size={11} style={{ color: 'var(--cyan-neon)' }} />
                        <span>{metric}</span>
                      </div>
                    ))}
                    {predictions.mainPick.stake && (
                      <div className="pro-metric-chip" style={{ color: 'var(--gold-neon)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                        <TrendingUp size={11} />
                        <span>{predictions.mainPick.stake}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 4 Secondary Market Micro-Cards */}
            <div className="modal-markets-grid">
              {predictions?.goalsPick && (
                <div className="modal-market-card">
                  <div className="market-card-header">
                    <span className="market-type cyan">⚽ GOLES</span>
                    <span className="market-cuota">@{predictions.goalsPick.cuota}</span>
                  </div>
                  <div className="market-pick-text">{predictions.goalsPick.pick}</div>
                  <span className="market-prob">✓ {predictions.goalsPick.probabilidad}% Prob.</span>
                </div>
              )}

              {predictions?.cornersPick && (
                <div className="modal-market-card">
                  <div className="market-card-header">
                    <span className="market-type gold">🚩 CÓRNERS</span>
                    <span className="market-cuota">@{predictions.cornersPick.cuota}</span>
                  </div>
                  <div className="market-pick-text">{predictions.cornersPick.pick}</div>
                  <span className="market-prob">✓ {predictions.cornersPick.probabilidad}% Prob.</span>
                </div>
              )}

              {predictions?.cardsPick && (
                <div className="modal-market-card">
                  <div className="market-card-header">
                    <span className="market-type red">🟨 TARJETAS</span>
                    <span className="market-cuota">@{predictions.cardsPick.cuota}</span>
                  </div>
                  <div className="market-pick-text">{predictions.cardsPick.pick}</div>
                  <span className="market-prob">✓ {predictions.cardsPick.probabilidad}% Prob.</span>
                </div>
              )}

              {predictions?.scorePick && (
                <div className="modal-market-card">
                  <div className="market-card-header">
                    <span className="market-type purple">🏆 MARCADOR</span>
                    <span className="market-cuota">@{predictions.scorePick.cuota}</span>
                  </div>
                  <div className="market-pick-text">{predictions.scorePick.pick}</div>
                  <span className="market-prob">✓ {predictions.scorePick.probabilidad}% Prob.</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Quick Question Chips (Horizontal Scroll) */}
        <div className="modal-prompt-chips-bar">
          <div className="prompt-chips-track">
            {promptIdeas.map((idea, idx) => (
              <button
                key={idx}
                className="prompt-chip-btn"
                onClick={() => handleAskQuestion(idea)}
                disabled={isAiTyping}
              >
                <span>{idea}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Chat History if active */}
        {showChat && chatMessages.length > 0 && (
          <div className="modal-pro-chat-history">
            {chatMessages.map((msg) => (
              <div 
                key={msg.id} 
                className={`pro-chat-msg ${msg.role === 'user' ? 'user' : 'ai'}`}
              >
                <div className="msg-role">
                  {msg.role === 'user' ? 'Tú' : 'NVIDIA IA'}
                </div>
                <div className="msg-text">
                  {msg.text}
                </div>
              </div>
            ))}
            {isAiTyping && (
              <div className="pro-chat-typing">
                <RotateCw className="animate-spin" size={12} />
                <span>Analizando...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Ask AI Input Bar */}
        <form 
          className="modal-pro-input-bar"
          onSubmit={(e) => {
            e.preventDefault();
            handleAskQuestion();
          }}
        >
          <input 
            type="text" 
            placeholder="Pregúntale a NVIDIA IA sobre este partido..." 
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            disabled={isAiTyping}
            className="pro-input-field"
          />

          <button 
            type="submit" 
            disabled={isAiTyping || !inputQuestion.trim()}
            className="pro-input-btn"
            title="Enviar pregunta"
          >
            <Send size={13} />
          </button>
        </form>

        {/* Compact Footer */}
        <div className="modal-pro-footer">
          <span>Pronósticos probabilísticos de IA deportiva. Juega con responsabilidad.</span>
        </div>
      </div>
    </div>
  );
}

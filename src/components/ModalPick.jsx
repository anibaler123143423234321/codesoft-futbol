import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  CheckCircle2, 
  ShieldCheck, 
  TrendingUp, 
  Cpu, 
  Search, 
  Flame, 
  Zap, 
  CornerDownRight, 
  Activity, 
  Target, 
  MessageSquare,
  ChevronRight,
  RotateCw
} from 'lucide-react';
import { generateFullMatchAIPredictions, askTacticalAI } from '../api/cerebrasAi';
import { sounds } from '../utils/soundEffects';

export default function ModalPick({ match, onClose }) {
  if (!match) return null;

  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  
  // Interactive Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatEndRef = useRef(null);

  const home = match.homeTeam?.shortName || match.homeTeam?.name || 'Local';
  const away = match.awayTeam?.shortName || match.awayTeam?.name || 'Visita';

  // Quick Prompt Ideas
  const promptIdeas = [
    '¿Quién tiene más posibilidades de ganar?',
    'Muéstrame mercados de goles y valor',
    'Sugiéreme una combinada con Saques de Esquina',
    'Análisis de tarjetas y faltas',
    '¿Cuál es el marcador más probable?'
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

  // Handle user asking question or clicking a prompt bubble
  const handleAskQuestion = async (questionText) => {
    const q = (questionText || inputQuestion).trim();
    if (!q || isAiTyping) return;

    sounds.playClick();
    setInputQuestion('');

    const userMsg = { id: Date.now(), role: 'user', text: q };
    setChatMessages(prev => [...prev, userMsg]);
    setIsAiTyping(true);

    try {
      const aiReply = await askTacticalAI(match, q);
      setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: aiReply }]);
      sounds.playGoalChime();
    } catch (err) {
      setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: 'Análisis: El equipo con mejor ritmo de posesión y volumen de tiros presenta ventaja.' }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-card cerebras-ai-modal" 
        style={{ 
          maxWidth: '860px', 
          width: '94%', 
          maxHeight: '90vh', 
          overflowY: 'auto',
          padding: '24px 28px',
          background: 'linear-gradient(180deg, #0d121f 0%, #080b12 100%)',
          border: '1px solid rgba(0, 210, 255, 0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 35px rgba(0, 210, 255, 0.15)'
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar (Betano IA style) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.04)', padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar mercado o estadística..." 
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.8rem', outline: 'none', width: '180px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))', padding: '6px 16px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(118, 185, 0, 0.5)' }}>
            <Sparkles size={15} style={{ color: '#76b900' }} />
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>Betano IA · NVIDIA NIM</span>
            <span style={{ fontSize: '0.65rem', background: '#76b900', color: '#000', fontWeight: 900, padding: '1px 6px', borderRadius: '4px' }}>70B</span>
          </div>

          <button 
            className="modal-close-btn" 
            style={{ position: 'static' }}
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Hero Greeting Section */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span>Bienvenido a Betano IA</span>
            <span style={{ fontSize: '0.75rem', color: '#76b900', border: '1px solid rgba(118,185,0,0.5)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>NVIDIA NIM</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '560px', margin: '0 auto', lineHeight: 1.5 }}>
            ¡Hola! Soy tu asistente de análisis y apuestas con NVIDIA Llama 3.1 70B. Consulta predicciones probabilísticas, análisis de valor o pregúntame directamente sobre este encuentro.
          </p>

          {/* Match Context Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginTop: '14px', background: 'rgba(0,0,0,0.4)', padding: '6px 16px', borderRadius: 'var(--radius-full)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.85rem' }}>{match.homeTeam?.name}</span>
            <span style={{ color: 'var(--cyan-neon)', fontWeight: 800, fontFamily: 'var(--font-score)' }}>
              {match.status === 'live' ? `${match.homeTeam?.score} - ${match.awayTeam?.score}` : 'VS'}
            </span>
            <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.85rem' }}>{match.awayTeam?.name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>· {match.leagueName || 'Competición'}</span>
          </div>
        </div>

        {/* Loading Spinner or Multi-Market Prediction Cards */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <RotateCw className="animate-spin" size={36} style={{ color: '#76b900', margin: '0 auto 12px' }} />
            <p style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>NVIDIA NIM IA (Llama 3.1 70B) procesando xG y probabilidades en milisegundos...</p>
          </div>
        ) : (
          <>
            {/* Main Value Bet Card */}
            {predictions?.mainPick && (
              <div 
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.12), rgba(0, 210, 255, 0.08))',
                  border: '1px solid rgba(0, 255, 136, 0.4)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px 24px',
                  marginBottom: '20px',
                  boxShadow: '0 8px 30px rgba(0, 255, 136, 0.12)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--green-neon)', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Target size={14} />
                    {predictions.mainPick.title}
                  </span>
                  <span style={{ fontFamily: 'var(--font-score)', color: 'var(--gold-neon)', fontWeight: 800, fontSize: '1.3rem' }}>
                    Cuota {predictions.mainPick.cuota}
                  </span>
                </div>

                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>
                  {predictions.mainPick.pick}
                </div>

                <p style={{ color: '#e5e7eb', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '12px' }}>
                  {predictions.mainPick.justificacion}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="pill-badge-green">
                      <CheckCircle2 size={13} />
                      {predictions.mainPick.probabilidad}% Confianza
                    </span>
                    <span className="pill-badge-blue">
                      <TrendingUp size={13} />
                      {predictions.mainPick.streak || '+4 maratón'}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                    {predictions.mainPick.stake}
                  </span>
                </div>
              </div>
            )}

            {/* 4 Multi-Market Prediction Boxes (Goles, Córners, Tarjetas, Marcador) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {/* Goals Pick */}
              {predictions?.goalsPick && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--cyan-neon)', textTransform: 'uppercase' }}>⚽ GOLES</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--gold-neon)', fontFamily: 'var(--font-score)' }}>@{predictions.goalsPick.cuota}</span>
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>{predictions.goalsPick.pick}</div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--green-neon)', fontWeight: 700 }}>✓ {predictions.goalsPick.probabilidad}% Probabilidad</span>
                </div>
              )}

              {/* Corners Pick */}
              {predictions?.cornersPick && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--gold-neon)', textTransform: 'uppercase' }}>🚩 CÓRNERS</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--gold-neon)', fontFamily: 'var(--font-score)' }}>@{predictions.cornersPick.cuota}</span>
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>{predictions.cornersPick.pick}</div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--green-neon)', fontWeight: 700 }}>✓ {predictions.cornersPick.probabilidad}% Probabilidad</span>
                </div>
              )}

              {/* Cards Pick */}
              {predictions?.cardsPick && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--red-live)', textTransform: 'uppercase' }}>🟨 TARJETAS</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--gold-neon)', fontFamily: 'var(--font-score)' }}>@{predictions.cardsPick.cuota}</span>
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>{predictions.cardsPick.pick}</div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--green-neon)', fontWeight: 700 }}>✓ {predictions.cardsPick.probabilidad}% Probabilidad</span>
                </div>
              )}

              {/* Exact Score Pick */}
              {predictions?.scorePick && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase' }}>🏆 MARCADOR</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--gold-neon)', fontFamily: 'var(--font-score)' }}>@{predictions.scorePick.cuota}</span>
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>{predictions.scorePick.pick}</div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--green-neon)', fontWeight: 700 }}>✓ {predictions.scorePick.probabilidad}% Probabilidad</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Prompts en Tendencia (Quick Idea Chips - Like Betano IA) */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase', marginBottom: '10px' }}>
            <Activity size={14} style={{ color: 'var(--cyan-neon)' }} />
            <span>Prompts en Tendencia</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {promptIdeas.map((idea, idx) => (
              <button
                key={idx}
                onClick={() => handleAskQuestion(idea)}
                disabled={isAiTyping}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#e5e7eb',
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--cyan-neon)';
                  e.currentTarget.style.background = 'rgba(0, 210, 255, 0.1)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.color = '#e5e7eb';
                }}
              >
                <span>{idea}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Chat History */}
        {chatMessages.length > 0 && (
          <div style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '16px', maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {chatMessages.map((msg) => (
              <div 
                key={msg.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '10px',
                  background: msg.role === 'user' ? 'rgba(255,255,255,0.04)' : 'rgba(0, 210, 255, 0.08)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: msg.role === 'ai' ? '3px solid var(--cyan-neon)' : '3px solid var(--gold-neon)'
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '0.75rem', color: msg.role === 'user' ? 'var(--gold-neon)' : 'var(--cyan-neon)', minWidth: '70px' }}>
                  {msg.role === 'user' ? 'Tú:' : 'Betano IA:'}
                </div>
                <div style={{ color: '#fff', fontSize: '0.84rem', lineHeight: 1.5 }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isAiTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#76b900', fontSize: '0.8rem', padding: '4px' }}>
                <RotateCw className="animate-spin" size={14} />
                <span>NVIDIA NIM IA analizando...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Interactive Chat Input Bar (Like Betano IA) */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleAskQuestion();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(0, 210, 255, 0.3)',
            borderRadius: 'var(--radius-full)',
            padding: '6px 14px',
            marginBottom: '14px'
          }}
        >
          <input 
            type="text" 
            placeholder="Pregunta lo que quieras sobre el partido a Betano IA..." 
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            disabled={isAiTyping}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
              padding: '6px'
            }}
          />

          <button 
            type="submit" 
            disabled={isAiTyping || !inputQuestion.trim()}
            style={{
              background: inputQuestion.trim() ? 'var(--cyan-neon)' : 'rgba(255,255,255,0.1)',
              color: '#000',
              border: 'none',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: inputQuestion.trim() ? 'pointer' : 'default',
              transition: 'var(--transition)'
            }}
          >
            <Send size={15} />
          </button>
        </form>

        {/* Footer Disclaimer */}
        <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Información basada en modelos de IA y estadísticas oficiales. Las predicciones tienen carácter orientativo. TyC.
        </div>
      </div>
    </div>
  );
}

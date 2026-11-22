import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, X, Send, Target, TrendingUp, RotateCw, AlertTriangle, Check } from 'lucide-react';
import { generateFullMatchAIPredictions, getLocalMatchPredictions, askTacticalAI } from '../api/cerebrasAi';
import { sounds } from '../utils/soundEffects';
import TeamLogo from './TeamLogo';
import { useLiveOdds } from '../hooks/useLiveOdds';
import { shouldWatchSource } from '../utils/liveBridge';
import { withLiveMarket } from '../utils/liveMarket';
import '../ai-modal.css';

const PROMPT_IDEAS = ['¿Quién ganará?', 'Mercados de goles', 'Pronóstico de córners', 'Tarjetas y faltas', 'Marcador exacto'];

const MARKETS = [
  { key: 'goalsPick', label: 'Goles' },
  { key: 'cornersPick', label: 'Córners' },
  { key: 'cardsPick', label: 'Tarjetas' },
  { key: 'scorePick', label: 'Marcador' },
];

const fmtOdds = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : '—';
};
const clampPct = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

export default function ModalPick({ match, onClose }) {
  const [predictions, setPredictions] = useState(null);
  // 'pending' → la IA está trabajando · 'ai' → respondió · 'failed' → no respondió · 'local' → estimación pedida por el usuario
  const [aiState, setAiState] = useState('pending');
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const [chatMessages, setChatMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatEndRef = useRef(null);
  const closeRef = useRef(null);

  // Cuotas en vivo (extensión): si el partido sigue en la fuente, la IA razona con ellas
  const [watch] = useState(() => shouldWatchSource(match));
  const liveOdds = useLiveOdds(match, watch);
  const { data: liveData, history: liveHistory } = liveOdds;
  const liveMatch = useMemo(() => withLiveMarket(match, { data: liveData, history: liveHistory }), [match, liveData, liveHistory]);
  const liveMatchRef = useRef(liveMatch);
  liveMatchRef.current = liveMatch;
  const lm = liveMatch.liveMarket;
  // Se espera la primera respuesta de la extensión (máx. 5 s) antes de lanzar la IA
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaitedOut(true), 5000);
    return () => clearTimeout(t);
  }, []);
  const liveSettled = !watch || Boolean(liveOdds.data) || !['checking', 'searching', 'opening'].includes(liveOdds.status);
  const ready = liveSettled || waitedOut;

  const home = match.homeTeam?.shortName || match.homeTeam?.name || 'Local';
  const away = match.awayTeam?.shortName || match.awayTeam?.name || 'Visita';
  const isLive = Boolean(lm) || match.status === 'live';
  const isFinished = !lm && match.status === 'finished';
  const scoreHome = lm ? lm.score.home : match.homeTeam?.score ?? 0;
  const scoreAway = lm ? lm.score.away : match.awayTeam?.score ?? 0;
  const clock = lm?.clock || match.minute || '';

  // Hasta que la IA responde solo se muestra la pantalla de carga
  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    setPredictions(null);
    setAiState('pending');
    setElapsed(0);

    generateFullMatchAIPredictions(liveMatchRef.current)
      .then(data => {
        if (!alive) return;
        if (data?.source === 'ai') {
          setPredictions(data);
          setAiState('ai');
          sounds.playGoalChime();
        } else {
          setAiState('failed');
        }
      })
      .catch(() => { if (alive) setAiState('failed'); });

    return () => { alive = false; };
    // Solo se vuelve a pedir al cambiar de partido, al reintentar o cuando llegan las cuotas en vivo;
    // las actualizaciones cada pocos segundos no deben relanzar un análisis de la IA.
  }, [match.id, attempt, ready]);

  useEffect(() => {
    if (aiState !== 'pending') return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [aiState, attempt]);

  // Escape cierra; el foco entra al modal al abrir
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [chatMessages, isAiTyping]);

  const handleAskQuestion = async (questionText) => {
    const q = (questionText || inputQuestion).trim();
    if (!q || isAiTyping) return;

    sounds.playClick();
    setInputQuestion('');
    setChatMessages(prev => [...prev, { id: Date.now(), role: 'user', text: q }]);
    setIsAiTyping(true);

    const meta = {};
    try {
      const reply = await askTacticalAI(liveMatchRef.current, q, meta);
      setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: reply, source: meta.source }]);
    } catch {
      setChatMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: 'No se pudo obtener una respuesta. Prueba de nuevo en unos segundos.', source: 'error' }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const main = predictions?.mainPick;
  const mainPct = clampPct(main?.probabilidad);
  const reason = main?.motivo_principal || main?.justificacion;
  const detail = main?.analisis_detallado && main.analisis_detallado !== reason ? main.analisis_detallado : null;

  return (
    <div className="aim-backdrop" onClick={onClose}>
      <div
        className="aim"
        role="dialog"
        aria-modal="true"
        aria-label={`Análisis con IA: ${home} vs ${away}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <header className="aim-head">
          <div className="aim-head-top">
            <span className="aim-brand"><Sparkles size={13} /> Análisis con IA</span>
            <span className="aim-league">{match.leagueName || 'Fútbol internacional'}</span>
            <button
              ref={closeRef}
              className="aim-close"
              onClick={() => { sounds.playClick(); onClose(); }}
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
          <div className="aim-match">
            <div className="aim-team">
              <TeamLogo src={match.homeTeam?.logo} alt={home} size={34} isHome />
              <span>{home}</span>
            </div>
            <div className="aim-score">
              {isLive || isFinished
                ? <b>{scoreHome}<i>-</i>{scoreAway}</b>
                : <b className="vs">VS</b>}
              <small className={isLive ? 'live' : ''}>
                {isLive ? `En vivo · ${clock}` : isFinished ? 'Finalizado' : (match.timeStr || 'Por iniciar')}
              </small>
            </div>
            <div className="aim-team away">
              <span>{away}</span>
              <TeamLogo src={match.awayTeam?.logo} alt={away} size={34} isHome={false} />
            </div>
          </div>
        </header>

        <div className="aim-body">
          {aiState === 'pending' && (
            <div className="aim-loading" role="status" aria-live="polite">
              <div className="aim-loader"><i /><i /><i /></div>
              <b>Analizando el partido…</b>
              <span>
                {ready
                  ? `La IA está leyendo marcador, estadísticas y ${lm ? 'cuotas en vivo' : 'cuotas'} · ${elapsed}s`
                  : 'Buscando las cuotas en vivo del partido…'}
              </span>
            </div>
          )}

          {aiState === 'failed' && (
            <div className="aim-loading failed" role="alert">
              <AlertTriangle size={26} />
              <b>La IA no respondió</b>
              <span>No se pudo generar el análisis. Puedes reintentar o ver una estimación estadística calculada con los datos del partido.</span>
              <div className="aim-loading-actions">
                <button className="primary" onClick={() => { sounds.playClick(); setAttempt(a => a + 1); }}>Reintentar</button>
                <button onClick={() => { sounds.playClick(); setPredictions(getLocalMatchPredictions(liveMatchRef.current)); setAiState('local'); }}>Ver estimación estadística</button>
              </div>
            </div>
          )}

          {aiState === 'ai' && (
            <div className="aim-status ok" role="status">
              <Check size={14} />
              <span>
                <b>Análisis generado por IA</b>{' '}
                {lm
                  ? `con las cuotas en vivo del minuto ${lm.clock || Math.round(lm.minute || 0)} y las estadísticas del partido.`
                  : 'con los datos reales del partido.'}
              </span>
            </div>
          )}
          {aiState === 'local' && (
            <div className="aim-status warn" role="status">
              <AlertTriangle size={14} />
              <span><b>Estimación estadística, no es de la IA.</b> Calculada con los datos del partido.</span>
              <button onClick={() => { sounds.playClick(); setAttempt(a => a + 1); }}>Reintentar IA</button>
            </div>
          )}

          {predictions && (
            <>
              {/* Selección principal */}
              {main && (
                <section className="aim-main">
                  <div className="aim-main-info">
                    <span className="aim-eyebrow"><Target size={12} /> Selección principal</span>
                    <h3>{main.pick}</h3>
                    {reason && <p>{reason}</p>}
                    {detail && <p className="aim-detail">{detail}</p>}
                    {(main.claves_metricas?.length > 0 || main.stake) && (
                      <div className="aim-chips">
                        {(main.claves_metricas || []).map((m, i) => <span key={i}>{m}</span>)}
                        {main.stake && <span className="stake"><TrendingUp size={11} /> {main.stake}</span>}
                      </div>
                    )}
                  </div>
                  <div className="aim-main-side">
                    <div className="aim-odds">
                      <small>Cuota</small>
                      <b>{fmtOdds(main.cuota)}</b>
                    </div>
                    <div className="aim-conf">
                      <div className="aim-conf-row"><small>Confianza</small><b>{mainPct}%</b></div>
                      <div className="aim-bar"><i style={{ width: `${mainPct}%` }} /></div>
                    </div>
                  </div>
                </section>
              )}
    
              {/* Mercados secundarios */}
              <section className="aim-markets">
                {MARKETS.map(({ key, label }) => {
                  const p = predictions?.[key];
                  if (!p) return null;
                  const pct = clampPct(p.probabilidad);
                  return (
                    <div key={key} className="aim-market">
                      <div className="aim-market-top">
                        <small>{label}</small>
                        <b>{fmtOdds(p.cuota)}</b>
                      </div>
                      <div className="aim-market-pick">{p.pick}</div>
                      <div className="aim-market-prob">
                        <div className="aim-bar"><i style={{ width: `${pct}%` }} /></div>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </section>
            </>
          )}

          {/* Conversación */}
          {aiState !== 'pending' && (
          <section className="aim-chat">
            <span className="aim-eyebrow">Pregúntale a la IA</span>
            <div className="aim-prompts">
              {PROMPT_IDEAS.map(idea => (
                <button key={idea} onClick={() => handleAskQuestion(idea)} disabled={isAiTyping}>{idea}</button>
              ))}
            </div>
            {(chatMessages.length > 0 || isAiTyping) && (
              <div className="aim-msgs">
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`aim-msg ${msg.role}`}>
                    {msg.role === 'ai' && (
                      <small>{msg.source === 'ai' ? 'IA' : msg.source === 'error' ? 'Error' : 'Estimación estadística'}</small>
                    )}
                    <p>{msg.text}</p>
                  </div>
                ))}
                {isAiTyping && (
                  <div className="aim-msg ai typing"><RotateCw size={12} className="aim-spin" /> Analizando… unos segundos</div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </section>
          )}
        </div>

        {/* Barra de pregunta */}
        {aiState !== 'pending' && (
        <form
          className="aim-composer"
          onSubmit={(e) => { e.preventDefault(); handleAskQuestion(); }}
        >
          <input
            type="text"
            placeholder="Escribe tu pregunta sobre este partido…"
            aria-label="Pregunta para la IA"
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            disabled={isAiTyping}
          />
          <button type="submit" disabled={isAiTyping || !inputQuestion.trim()} aria-label="Enviar pregunta">
            <Send size={15} />
          </button>
        </form>
        )}
        <p className="aim-foot">Pronósticos probabilísticos, no garantías. Juega con responsabilidad.</p>
      </div>
    </div>
  );
}

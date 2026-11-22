import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, RotateCw, Target, TrendingUp, TrendingDown, ChevronDown, Sparkles, Lock, BarChart3, HelpCircle } from 'lucide-react';
import AiModelInsights from './AiModelInsights';
import MatchReasons from './MatchReasons';
import { buildPrediction } from '../api/predictionModel';
import { generateFullMatchAIPredictions, getLocalMatchPredictions, askTacticalAI } from '../api/cerebrasAi';
import { sounds } from '../utils/soundEffects';

// Chat de análisis dentro del panel de jugadas: el primer mensaje es el análisis del partido
// y después se le puede preguntar a la IA. Solo pide algo a la IA cuando se abre la pestaña.

const QUESTIONS = ['¿Quién gana?', '¿Habrá más goles?', '¿Cuántos córners?', '¿Cuántas tarjetas?', '¿Marcador final?'];

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
const pct = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

// ---- Citas: cada número es una fuente de los datos que recibió la IA
const factOf = (facts, n) => facts?.find((f) => f.n === n);

function Cite({ n, facts }) {
  const f = factOf(facts, n);
  return (
    <sup className="aic-cite" title={f ? `${f.label}: ${f.text}` : undefined} aria-label={f ? `Fuente ${n}: ${f.label}` : `Fuente ${n}`}>
      {n}
    </sup>
  );
}

function Cites({ ids, facts }) {
  if (!ids?.length || !facts?.length) return null;
  return <span className="aic-cites">{ids.map((n) => <Cite key={n} n={n} facts={facts} />)}</span>;
}

/** Texto con las citas [n] de la IA convertidas en chips. */
function CitedText({ text, facts }) {
  // Sin espacio antes de la cita y sin la misma cita repetida seguida ([3][3])
  const parts = String(text).replace(/\s+(\[\d+\])/g, '$1').replace(/(\[\d+\])(?:\1)+/g, '$1').split(/(\[\d+\])/g);
  return (
    <p>
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        return m ? <Cite key={i} n={Number(m[1])} facts={facts} /> : <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </p>
  );
}

/** Lista desplegable de las fuentes citadas, con el dato exacto de cada una. */
function Sources({ ids, facts }) {
  const [open, setOpen] = useState(false);
  const list = [...new Set(ids)].map((n) => factOf(facts, n)).filter(Boolean).sort((a, b) => a.n - b.n);
  if (!list.length) return null;
  return (
    <div className="aic-sources">
      <button type="button" className="aic-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Fuentes · {list.length} <ChevronDown size={12} />
      </button>
      {open && (
        <ol>
          {list.map((f) => (
            <li key={f.n}>
              <span className="aic-cite">{f.n}</span>
              <div>
                <b>{f.label}</b> <small>{f.origin}</small>
                <p>{f.text}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))}%`;
const stakeOf = (s) => {
  const n = Number(String(s || '').match(/(\d+(?:[.,]\d+)?)\s*\/\s*10/)?.[1]?.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.min(10, Math.round(n)) : null;
};

/** Probabilidad de la IA frente a la que implica la cuota: si la barra pasa la marca, la cuota paga de más. */
function ValueMeter({ p, implied }) {
  return (
    <div className="aic-meter">
      <span className="aic-meter-track" role="img" aria-label={`IA ${Math.round(p * 100)}%${implied ? `, la cuota implica ${Math.round(implied * 100)}%` : ''}`}>
        <i style={{ width: `${p * 100}%` }} />
        {implied && <em style={{ left: `${Math.min(100, implied * 100)}%` }} />}
      </span>
      <span className="aic-meter-legend">
        <small><i className="dot" />IA {Math.round(p * 100)}%</small>
        {implied && <small><i className="tick" />La cuota implica {Math.round(implied * 100)}%</small>}
      </span>
    </div>
  );
}

function StakeBar({ n }) {
  return (
    <div className="aic-stake" title="Cuánto arriesgar, de 1 a 10, según la IA">
      <small>Stake</small>
      <span aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>
      <b>{n}/10</b>
    </div>
  );
}

function Analysis({ data, local, live }) {
  const [open, setOpen] = useState(false);
  const main = data?.mainPick;
  if (!main) return null;
  const facts = data.facts || [];
  const conf = pct(main.probabilidad);
  const p = conf / 100;
  const odds = Number(main.cuota);
  const hasOdds = Number.isFinite(odds) && odds > 1;
  const implied = hasOdds ? 1 / odds : null;
  // El valor solo se calcula contra una cuota publicada, no contra una que estimó la IA
  const edge = hasOdds && !main.cuotaEstimada && p > 0 ? p * odds - 1 : null;
  const stake = stakeOf(main.stake);
  const reason = main.motivo_principal || main.justificacion;
  const detail = main.analisis_detallado && main.analisis_detallado !== reason ? main.analisis_detallado : null;
  const markets = MARKETS.map((m) => ({ ...m, p: data[m.key] })).filter((m) => m.p?.pick);
  const extra = Boolean(detail || main.claves_metricas?.length);
  const cited = [main, ...markets.map((m) => m.p)].flatMap((x) => x.fuentes || []);
  const oddsTag = main.cuotaEstimada == null ? null : main.cuotaEstimada ? 'estimada' : live ? 'en vivo' : 'publicada';
  const edgeState = edge == null ? '' : edge > 0.005 ? 'is-up' : edge < -0.005 ? 'is-down' : '';

  return (
    <>
      <section className="aic-card aic-hero" aria-label="Selección principal">
        <div className="aic-card-top">
          <span className="aic-eyebrow"><Target size={11} /> Selección principal</span>
          <span className="aic-badge" title={data.model ? `Modelo: ${data.model}` : undefined}>{local ? 'Estadística' : 'IA'}</span>
        </div>
        <h4>{main.pick}</h4>
        {main.cerrado && (
          <p className="aic-closed">
            <Lock size={11} />
            {main.cerrado === 'closed'
              ? 'Mercados cerrados: cuotas de antes de la última jugada. Se vuelve a analizar cuando reabran.'
              : 'Cuotas de antes del último gol: la fuente todavía no lo marca. Se vuelve a analizar cuando se actualice.'}
          </p>
        )}

        <div className="aic-stats">
          <div>
            <small>Cuota</small>
            <b>{main.cuotaEstimada ? '≈' : ''}{fmtOdds(main.cuota)}</b>
            <em>
              {oddsTag || (hasOdds ? 'del mercado' : 'sin cuota')}
              {main.cuotaFuente && <Cite n={main.cuotaFuente} facts={facts} />}
            </em>
          </div>
          <div>
            <small>Probabilidad</small>
            <b>{conf}<span>%</span></b>
            <em>{local ? 'estimación' : 'según la IA'}</em>
          </div>
          <div className={edgeState} title={edge == null ? 'Sin cuota publicada contra la cual medir' : 'Probabilidad de la IA × cuota − 1'}>
            <small>Valor</small>
            <b>
              {edge == null ? '—' : signed(edge)}
              {edgeState === 'is-up' && <TrendingUp size={13} aria-hidden="true" />}
              {edgeState === 'is-down' && <TrendingDown size={13} aria-hidden="true" />}
            </b>
            <em>{edge == null ? (main.cuotaEstimada ? 'cuota estimada' : 'sin cuota') : edgeState === 'is-up' ? 'a favor' : edgeState === 'is-down' ? 'en contra' : 'neutro'}</em>
          </div>
        </div>

        <ValueMeter p={p} implied={implied} />
        {stake && <StakeBar n={stake} />}
        {reason && <p className="aic-reason">{reason}<Cites ids={main.fuentes} facts={facts} /></p>}

        {extra && (
          <>
            <button type="button" className="aic-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              {open ? 'Ocultar detalle' : 'Ver detalle'} <ChevronDown size={12} />
            </button>
            {open && (
              <div className="aic-detail">
                {detail && <p>{detail}</p>}
                {main.claves_metricas?.length > 0 && (
                  <div className="aic-chips">
                    {main.claves_metricas.map((m) => <span key={m}>{m}</span>)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <Sources ids={cited} facts={facts} />
      </section>

      {markets.length > 0 && (
        <section className="aic-card aic-mk" aria-label="Otros mercados">
          <div className="aic-card-top">
            <span className="aic-eyebrow"><BarChart3 size={11} /> Otros mercados</span>
          </div>
          <ul>
            {markets.map(({ key, label, p: mk }) => (
              <li key={key}>
                <small>{label}</small>
                <div className="aic-mk-body">
                  <span className="aic-mk-pick" title={mk.pick}>{mk.pick}<Cites ids={mk.fuentes} facts={facts} /></span>
                  <span className="aic-mk-bar"><i style={{ width: `${pct(mk.probabilidad)}%` }} /></span>
                </div>
                <div className="aic-mk-num">
                  <b title={mk.cuotaEstimada ? 'Cuota estimada por la IA: no está publicada' : undefined}>
                    {mk.cuotaEstimada ? '≈' : ''}{fmtOdds(mk.cuota)}
                  </b>
                  <em>{pct(mk.probabilidad)}%</em>
                </div>
              </li>
            ))}
          </ul>
          {[main, ...markets.map((m) => m.p)].some((x) => x.cuotaEstimada) && (
            <p className="aic-note">≈ cuota estimada por la IA: ese mercado no tiene cuota publicada.</p>
          )}
        </section>
      )}
    </>
  );
}

function PendingCard({ text }) {
  return (
    <section className="aic-card aic-hero aic-skel" aria-busy="true">
      <div className="aic-card-top">
        <span className="aic-eyebrow"><Target size={11} /> Selección principal</span>
      </div>
      <span className="aic-skel-line w70" />
      <div className="aic-stats">
        {[0, 1, 2].map((i) => <div key={i}><span className="aic-skel-line w40" /><span className="aic-skel-line w60 tall" /></div>)}
      </div>
      <span className="aic-skel-line" />
      <p className="aic-typing"><span className="aic-dots"><span /><span /><span /></span>{text}</p>
    </section>
  );
}

/**
 * @param match partido con `liveMarket` si hay cuotas en vivo
 * @param ready las cuotas en vivo ya respondieron (o no hay que esperarlas)
 */
export default function AiMatchChat({ match, ready = true, refreshKey = 0 }) {
  const matchRef = useRef(match);
  matchRef.current = match;

  // El análisis espera a las cuotas en vivo, como mucho 5 segundos
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaitedOut(true), 5000);
    return () => clearTimeout(t);
  }, []);
  const canStart = ready || waitedOut;

  // 'pending' · 'ai' · 'failed' · 'local' (estimación pedida por el usuario)
  const [state, setState] = useState('pending');
  const [analysis, setAnalysis] = useState(null);
  const [analysisAt, setAnalysisAt] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!canStart) return undefined;
    let alive = true;
    setState('pending');
    setElapsed(0);
    const m = matchRef.current;
    generateFullMatchAIPredictions(m)
      .then((data) => {
        if (!alive) return;
        if (data?.source === 'ai') {
          setAnalysis(data);
          setAnalysisAt(m.liveMarket?.clock || m.minute || null);
          setState('ai');
        } else {
          setState('failed');
        }
      })
      .catch(() => { if (alive) setState('failed'); });
    return () => { alive = false; };
    // Al cambiar de partido, al pedir otro análisis, cuando llegan las cuotas en vivo
    // o cuando los mercados se reabren después de un gol, penal, VAR o roja (refreshKey)
  }, [match?.id, attempt, canStart, refreshKey]);

  useEffect(() => {
    if (state !== 'pending') return undefined;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state, attempt]);

  // Solo baja al final cuando hay conversación; el informe se lee desde arriba
  useEffect(() => {
    const el = scrollRef.current;
    if (el && (messages.length || typing)) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const ask = async (text) => {
    const q = (text ?? input).trim();
    if (!q || typing) return;
    sounds.playClick();
    setInput('');
    setMessages((prev) => [...prev, { id: `u${Date.now()}`, role: 'user', text: q }]);
    setTyping(true);
    const meta = {};
    try {
      const reply = await askTacticalAI(matchRef.current, q, meta);
      setMessages((prev) => [...prev, { id: `a${Date.now()}`, role: 'ai', text: reply, source: meta.source, facts: meta.facts, cites: meta.cites }]);
    } catch {
      setMessages((prev) => [...prev, { id: `a${Date.now()}`, role: 'ai', text: 'No pude responder ahora. Prueba de nuevo en unos segundos.', source: 'error' }]);
    } finally {
      setTyping(false);
    }
  };

  const refresh = () => {
    sounds.playClick();
    setAttempt((a) => a + 1);
  };

  const pred = useMemo(() => {
    try { return buildPrediction(match); } catch { return null; }
  }, [match]);
  // La pregunta del que menos chances tiene va primero, con su nombre
  const underdog = pred?.matrix ? (pred.outcome.p1 <= pred.outcome.p2 ? pred.home : pred.away) : null;
  const questions = underdog && match?.status !== 'finished' ? [`¿Por qué no gana ${underdog}?`, ...QUESTIONS] : QUESTIONS;

  const lm = match?.liveMarket;
  const basis = lm
    ? `${lm.suspended ? 'Mercados cerrados · ' : ''}Con las cuotas en vivo${analysisAt ? ` del ${analysisAt}` : ''}`
    : 'Con los datos del partido';

  return (
    <div className="aic">
      <div className="aic-head">
        <Sparkles size={13} />
        <span>
          {state === 'pending' ? 'Analizando el partido…' : state === 'local' ? 'Estimación estadística' : basis}
        </span>
        <button
          type="button"
          onClick={refresh}
          disabled={state === 'pending'}
          title="Volver a analizar con los datos de ahora"
          aria-label="Volver a analizar"
        >
          <RotateCw size={13} />
        </button>
      </div>

      <div className="aic-msgs" ref={scrollRef}>
        <div className="aic-report">
          <div className="aic-live" aria-live="polite">
            {state === 'pending' && (
              <PendingCard
                text={canStart
                  ? `La IA lee marcador, estadísticas y ${lm ? 'cuotas en vivo' : 'cuotas'} · ${elapsed}s`
                  : 'Esperando las cuotas en vivo…'}
              />
            )}
            {state === 'failed' && (
              <section className="aic-card aic-hero">
                <span className="aic-eyebrow"><Target size={11} /> Selección principal</span>
                <p className="aic-reason">La IA no respondió. Puedes reintentar o ver una estimación hecha con las estadísticas del partido.</p>
                <div className="aic-actions">
                  <button type="button" className="primary" onClick={refresh}>Reintentar</button>
                  <button
                    type="button"
                    onClick={() => { sounds.playClick(); setAnalysis(getLocalMatchPredictions(matchRef.current)); setState('local'); }}
                  >
                    Ver estimación
                  </button>
                </div>
              </section>
            )}
            {(state === 'ai' || state === 'local') && <Analysis data={analysis} local={state === 'local'} live={Boolean(lm) || match?.status === 'live'} />}
          </div>
          {pred?.matrix && (
            <section className="aic-card aic-why" aria-label="Por qué estas probabilidades">
              <span className="aic-eyebrow"><HelpCircle size={11} /> Por qué</span>
              <MatchReasons key={match.id} match={match} pred={pred} />
            </section>
          )}
          <AiModelInsights match={match} pred={pred} />
        </div>

        {messages.map((m) => (
          <div key={m.id} className={`aic-msg ${m.role}`}>
            {m.role === 'ai' && m.source !== 'ai' && (
              <small>{m.source === 'error' ? 'Error' : 'Estimación estadística'}</small>
            )}
            {m.facts ? <CitedText text={m.text} facts={m.facts} /> : <p>{m.text}</p>}
            {m.facts && <Sources ids={m.cites || []} facts={m.facts} />}
          </div>
        ))}
        {typing && (
          <div className="aic-msg ai">
            <p className="aic-typing"><span className="aic-dots"><span /><span /><span /></span>Pensando…</p>
          </div>
        )}
      </div>

      <div className="aic-prompts">
        {questions.map((q) => (
          <button key={q} type="button" onClick={() => ask(q)} disabled={typing}>{q}</button>
        ))}
      </div>
      <form className="aic-composer" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <input
          type="text"
          placeholder="Pregunta sobre este partido…"
          aria-label="Pregunta para la IA"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={typing}
        />
        <button type="submit" disabled={typing || !input.trim()} aria-label="Enviar">
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

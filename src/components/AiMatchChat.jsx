import React, { useEffect, useRef, useState } from 'react';
import { Send, RotateCw, Target, TrendingUp, ChevronDown, Sparkles, Lock } from 'lucide-react';
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
  const parts = String(text).replace(/\s+(\[\d+\])/g, '$1').split(/(\[\d+\])/g);
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

function Analysis({ data }) {
  const [open, setOpen] = useState(false);
  const main = data?.mainPick;
  if (!main) return null;
  const facts = data.facts || [];
  const conf = pct(main.probabilidad);
  const reason = main.motivo_principal || main.justificacion;
  const detail = main.analisis_detallado && main.analisis_detallado !== reason ? main.analisis_detallado : null;
  const markets = MARKETS.map((m) => ({ ...m, p: data[m.key] })).filter((m) => m.p?.pick);
  const extra = Boolean(detail || main.claves_metricas?.length || main.stake);
  const cited = [main, ...markets.map((m) => m.p)].flatMap((p) => p.fuentes || []);
  const oddsTag = main.cuotaEstimada == null ? null : main.cuotaEstimada ? 'estimada' : 'en vivo';

  return (
    <div className="aic-card">
      <span className="aic-eyebrow"><Target size={11} /> Selección principal</span>
      <h4>{main.pick}</h4>
      {main.cerrado && (
        <p className="aic-closed">
          <Lock size={11} />
          {main.cerrado === 'closed'
            ? 'Mercados cerrados: cuotas de antes de la última jugada. Se vuelve a analizar cuando reabran.'
            : 'Cuotas de antes del último gol: la fuente todavía no lo marca. Se vuelve a analizar cuando se actualice.'}
        </p>
      )}
      <div className="aic-figures">
        <span>
          <small>Cuota{oddsTag && <> · {oddsTag}{main.cuotaFuente && <Cite n={main.cuotaFuente} facts={facts} />}</>}</small>
          <b>{main.cuotaEstimada ? '≈' : ''}{fmtOdds(main.cuota)}</b>
        </span>
        <span className="aic-conf">
          <small>Confianza <b>{conf}%</b></small>
          <span className="aic-bar"><span style={{ width: `${conf}%` }} /></span>
        </span>
      </div>
      {reason && <p>{reason}<Cites ids={main.fuentes} facts={facts} /></p>}

      {extra && (
        <>
          <button type="button" className="aic-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? 'Ocultar detalle' : 'Ver detalle'} <ChevronDown size={12} />
          </button>
          {open && (
            <div className="aic-detail">
              {detail && <p>{detail}</p>}
              {(main.claves_metricas?.length > 0 || main.stake) && (
                <div className="aic-chips">
                  {(main.claves_metricas || []).map((m) => <span key={m}>{m}</span>)}
                  {main.stake && <span className="stake"><TrendingUp size={10} /> {main.stake}</span>}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {markets.length > 0 && (
        <ul className="aic-markets">
          {markets.map(({ key, label, p }) => (
            <li key={key}>
              <small>{label}</small>
              <span>{p.pick}<Cites ids={p.fuentes} facts={facts} /></span>
              <b title={p.cuotaEstimada ? 'Cuota estimada por la IA: no está publicada en vivo' : undefined}>
                {p.cuotaEstimada ? '≈' : ''}{fmtOdds(p.cuota)}
              </b>
              <em>{pct(p.probabilidad)}%</em>
            </li>
          ))}
        </ul>
      )}
      {[main, ...markets.map((m) => m.p)].some((p) => p.cuotaEstimada) && (
        <p className="aic-note">≈ cuota estimada por la IA: ese mercado no está publicado en vivo.</p>
      )}

      <Sources ids={cited} facts={facts} />
    </div>
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

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing, state]);

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
      setMessages((prev) => [...prev, { id: `a${Date.now()}`, role: 'ai', text: 'No pude responder ahora. Probá de nuevo en unos segundos.', source: 'error' }]);
    } finally {
      setTyping(false);
    }
  };

  const refresh = () => {
    sounds.playClick();
    setAttempt((a) => a + 1);
  };

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

      <div className="aic-msgs" ref={scrollRef} aria-live="polite">
        <div className="aic-msg ai">
          {state === 'pending' && (
            <p className="aic-typing">
              <span className="aic-dots"><span /><span /><span /></span>
              {canStart
                ? `Leyendo marcador, estadísticas y ${lm ? 'cuotas en vivo' : 'cuotas'} · ${elapsed}s`
                : 'Esperando las cuotas en vivo…'}
            </p>
          )}
          {state === 'failed' && (
            <>
              <p>La IA no respondió. Podés reintentar o ver una estimación hecha con las estadísticas del partido.</p>
              <div className="aic-actions">
                <button type="button" className="primary" onClick={refresh}>Reintentar</button>
                <button
                  type="button"
                  onClick={() => { sounds.playClick(); setAnalysis(getLocalMatchPredictions(matchRef.current)); setState('local'); }}
                >
                  Ver estimación
                </button>
              </div>
            </>
          )}
          {(state === 'ai' || state === 'local') && <Analysis data={analysis} />}
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
        {QUESTIONS.map((q) => (
          <button key={q} type="button" onClick={() => ask(q)} disabled={typing}>{q}</button>
        ))}
      </div>
      <form className="aic-composer" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <input
          type="text"
          placeholder="Preguntá sobre este partido…"
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

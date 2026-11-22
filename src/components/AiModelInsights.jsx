import React, { useMemo, useState } from 'react';
import { Sigma } from 'lucide-react';
import { buildPrediction } from '../api/predictionModel';
import '../model-charts.css';

// Gráficas del modelo cuantitativo (Dixon-Coles). Las usan el panel de IA del partido
// y la página de Picks IA. Se calculan en el navegador al instante.

const P = (p) => `${Math.round(p * 100)}%`;
const P1 = (p) => `${(p * 100).toFixed(1)}%`;
const DATA_LEVEL = {
  Alta: { label: 'Datos completos', tone: 'good' },
  Media: { label: 'Datos parciales', tone: 'mid' },
  Baja: { label: 'Datos escasos', tone: 'low' },
};
const keyOf = (i, j) => `${i}-${j}`;

function basisOf(q) {
  if (q.hasLiveOdds) return 'Cuotas en vivo sin margen';
  if (q.hasOdds) return 'Cuotas sin margen';
  if (q.hasForm) return 'Últimos 5 partidos de cada equipo';
  return 'Referencia genérica: poco informativo';
}

/** 1X2 como una sola barra partida, con la leyenda como fila de cifras. */
export function OutcomeSplit({ pred }) {
  const { p1, px, p2 } = pred.outcome;
  const segs = [
    { key: 'home', name: pred.home, p: p1 },
    { key: 'draw', name: 'Empate', p: px },
    { key: 'away', name: pred.away, p: p2 },
  ];
  const label = segs.map((s) => `${s.name} ${P(s.p)}`).join(', ');
  return (
    <div className="aiq-block">
      <div className="aiq-label"><span>Resultado</span></div>
      <div className="aiq-split" role="img" aria-label={`Probabilidad del resultado: ${label}`}>
        {segs.map((s) => (
          <span key={s.key} className={`is-${s.key}`} style={{ flexGrow: Math.max(s.p, 0.005) }} title={`${s.name}: ${P1(s.p)}`} />
        ))}
      </div>
      <div className="aiq-legend">
        {segs.map((s) => (
          <span key={s.key}>
            <small><i className={`is-${s.key}`} />{s.name}</small>
            <b>{P(s.p)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barras enfrentadas desde el centro: local a la izquierda, visita a la derecha. */
function Tracks({ home, away, max }) {
  return (
    <>
      <span className="aiq-xg-track is-home"><i style={{ width: `${Math.min(100, (home / max) * 100)}%` }} /></span>
      <span className="aiq-xg-track is-away"><i style={{ width: `${Math.min(100, (away / max) * 100)}%` }} /></span>
    </>
  );
}

/** Goles esperados de cada equipo, con los nombres debajo. */
export function XgDuel({ pred }) {
  const h = pred.expectedHome;
  const a = pred.expectedAway;
  return (
    <div className="aiq-block">
      <div className="aiq-label"><span>Goles esperados</span><small>al final del partido</small></div>
      <div className="aiq-xg" role="img" aria-label={`Goles esperados: ${pred.home} ${h.toFixed(2)}, ${pred.away} ${a.toFixed(2)}`}>
        <b>{h.toFixed(2)}</b>
        <Tracks home={h} away={a} max={Math.max(2.5, h, a)} />
        <b>{a.toFixed(2)}</b>
      </div>
      <div className="aiq-xg-names"><span>{pred.home}</span><span>{pred.away}</span></div>
    </div>
  );
}

/** Un conteo esperado por equipo, con el nombre del dato al centro. */
export function DuelBar({ label, home, away, digits = 1, max, homeName, awayName, children }) {
  const top = max ?? Math.max(home, away) * 1.25;
  return (
    <div className="aiq-duel" role="img" aria-label={`${label}: ${homeName || 'local'} ${home.toFixed(digits)}, ${awayName || 'visita'} ${away.toFixed(digits)}`}>
      <div className="aiq-duel-head">
        <b>{home.toFixed(digits)}</b>
        <span>{label}{children}</span>
        <b>{away.toFixed(digits)}</b>
      </div>
      <div className="aiq-duel-bars"><Tracks home={home} away={away} max={top || 1} /></div>
    </div>
  );
}

function useScoreCells(pred, size) {
  return useMemo(() => {
    const { matrix, base } = pred;
    const rows = Array.from({ length: size }, (_, r) => base.home + r);
    const cols = Array.from({ length: size }, (_, c) => base.away + c);
    const cells = rows.flatMap((i) => cols.map((j) => ({ i, j, key: keyOf(i, j), p: matrix[i]?.[j] || 0 })));
    const all = [];
    matrix.forEach((row, i) => row.forEach((p, j) => all.push({ i, j, key: keyOf(i, j), p })));
    all.sort((x, y) => y.p - x.p);
    return { rows, cols, cells, ranked: all, max: all[0]?.p || 1 };
  }, [pred, size]);
}

/**
 * Mapa de marcadores: filas = goles del local, columnas = goles de la visita.
 * `active`/`onActive` permiten compartir el marcador resaltado con otra vista.
 */
export function ScoreHeatmap({ pred, active: activeProp, onActive, size = 5 }) {
  const { rows, cols, cells, ranked, max } = useScoreCells(pred, size);
  const [own, setOwn] = useState(null);
  const active = onActive ? activeProp : own;
  const setActive = onActive || setOwn;
  const labelled = new Set(ranked.slice(0, 3).map((c) => c.key));
  const shownKey = active || ranked[0]?.key || keyOf(0, 0);
  const [si, sj] = shownKey.split('-').map(Number);
  const shownP = pred.matrix[si]?.[sj] || 0;

  return (
    <div className="aiq-block">
      <div className="aiq-label">
        <span>Marcador final</span>
        <small className="aiq-readout" aria-live="polite">
          {pred.home} <b>{si}-{sj}</b> {pred.away} · <b>{P1(shownP)}</b>
        </small>
      </div>
      <div className="aiq-heat-wrap">
        <span className="aiq-heat-axis is-top"><i className="is-away" />{pred.away}</span>
        <span className="aiq-heat-axis is-side"><i className="is-home" />{pred.home}</span>
        <div className="aiq-heat" onMouseLeave={() => setActive(null)}>
          <span />
          {cols.map((j) => <span key={`c${j}`} className="aiq-heat-tick">{j}</span>)}
          {rows.map((i, r) => (
            <React.Fragment key={`r${i}`}>
              <span className="aiq-heat-tick">{i}</span>
              {cols.map((j, c) => {
                const cell = cells[r * size + c];
                const t = Math.sqrt(cell.p / max);
                return (
                  <button
                    key={cell.key}
                    type="button"
                    className={`aiq-cell${t > 0.62 ? ' is-hot' : ''}${shownKey === cell.key ? ' is-on' : ''}`}
                    style={{ '--t': `${Math.round(8 + t * 92)}%`, '--i': r * size + c }}
                    onMouseEnter={() => setActive(cell.key)}
                    onFocus={() => setActive(cell.key)}
                    onBlur={() => setActive(null)}
                    aria-label={`${pred.home} ${i}, ${pred.away} ${j}: ${P1(cell.p)}`}
                  >
                    {labelled.has(cell.key) && P(cell.p)}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Los marcadores más probables en lista, con barra relativa al primero. */
export function TopScores({ pred, active, onActive, n = 5 }) {
  const { ranked, max } = useScoreCells(pred, 5);
  const shownKey = active || ranked[0]?.key;
  return (
    <ol className="aiq-top" onMouseLeave={() => onActive?.(null)}>
      {ranked.slice(0, n).map((c, idx) => (
        <li key={c.key}>
          <button
            type="button"
            className={shownKey === c.key ? 'is-on' : ''}
            onMouseEnter={() => onActive?.(c.key)}
            onFocus={() => onActive?.(c.key)}
            onBlur={() => onActive?.(null)}
            aria-label={`${pred.home} ${c.i}, ${pred.away} ${c.j}: ${P1(c.p)}`}
          >
            <em>{idx + 1}</em>
            <b>{c.i}<i>-</i>{c.j}</b>
            <span className="aiq-top-bar"><i style={{ width: `${(c.p / max) * 100}%` }} /></span>
            <strong>{P1(c.p)}</strong>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Mapa y lista de marcadores con el resaltado compartido. */
export function ScoreMap({ pred, children }) {
  const [active, setActive] = useState(null);
  return (
    <div className="aiq-scoremap-wrap">
      <div className="aiq-scoremap">
        <ScoreHeatmap pred={pred} active={active} onActive={setActive} />
        <div className="aiq-scoremap-side">
          <div className="aiq-label"><span>Más probables</span></div>
          <TopScores pred={pred} active={active} onActive={setActive} />
          {children}
        </div>
      </div>
    </div>
  );
}

/** Dos mercados de goles como medidores cortos. */
export function GoalMeters({ pred }) {
  const find = (id) => pred.markets.find((m) => m.id === id);
  const items = [
    { m: find('o2.5'), label: 'Más de 2.5 goles' },
    { m: find('btts-y'), label: 'Ambos marcan' },
  ].filter((x) => x.m);
  if (!items.length) return null;
  return (
    <div className="aiq-meters">
      {items.map(({ m, label }) => (
        <div key={m.id} className="aiq-meter">
          <small>{label}</small>
          <b>{P(m.p)}</b>
          <span role="img" aria-label={`${label}: ${P1(m.p)}`}><i style={{ width: P(m.p) }} /></span>
        </div>
      ))}
    </div>
  );
}

/** `pred` es opcional: si no viene, se calcula aquí. */
export default function AiModelInsights({ match, pred: given }) {
  const own = useMemo(() => {
    if (given) return null;
    try { return buildPrediction(match); } catch { return null; }
  }, [match, given]);
  const pred = given || own;
  if (!pred?.matrix) return null;

  return (
    <section className="aic-card aiq" aria-label="Modelo cuantitativo del partido">
      <div className="aic-card-top">
        <span className="aic-eyebrow"><Sigma size={11} /> Modelo cuantitativo</span>
        <span className={`aic-badge is-${DATA_LEVEL[pred.confidence]?.tone || 'low'}`} title="Cuántos datos tiene el modelo: cuotas, línea de goles y forma reciente">
          {DATA_LEVEL[pred.confidence]?.label || 'Datos escasos'}
        </span>
      </div>
      <OutcomeSplit pred={pred} />
      <XgDuel pred={pred} />
      <ScoreHeatmap pred={pred} />
      <GoalMeters pred={pred} />
      <p className="aiq-foot">Dixon-Coles · {basisOf(pred.quality)}{pred.quality.isLive ? ` · minuto ${Math.round(pred.quality.minute)}` : ''}</p>
    </section>
  );
}

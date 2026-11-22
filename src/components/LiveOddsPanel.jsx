import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Plug, Radio } from 'lucide-react';
import { versionAtLeast } from '../utils/liveBridge';
import { PITCH_MIN_VERSION } from '../hooks/useLivePitch';
import { PlayIcon, YellowCard, CornerFlag } from './SportIcon';
import MarketBoard from './MarketBoard';
import '../live-odds.css';

// Paleta validada (modo oscuro, superficie #0a0b0d): local / empate / visita
const SERIES = {
  home: '#e8475d',
  draw: '#22a08c',
  away: '#4d8dff',
};
const STALE_MS = 60_000;
const INCIDENT_ICON = { GOAL: 'goal', YELL: 'yellow', RED: 'red', SUBS: 'sub', SVAR: 'var', EVAR: 'var' };

const STATUS_TEXT = {
  checking: 'Conectando…',
  searching: 'Buscando las cuotas de este partido…',
  opening: 'Conectando con la fuente de datos…',
  'not-found': 'Este partido no tiene cuotas en vivo ahora mismo.',
  error: 'No se pudieron leer las cuotas. Se reintenta en 15 s.',
};

// Motivo del cierre de mercados según la jugada que lo provocó
const LOCK_REASON = {
  goal: (team) => (team ? `Gol de ${team}` : 'Gol'),
  penalty: (team) => (team ? `Penal para ${team}` : 'Penal'),
  var: () => 'Revisión VAR',
  red: (team) => (team ? `Roja en ${team}` : 'Tarjeta roja'),
};

function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `hace ${s} s`;
  return `hace ${Math.round(s / 60)} min`;
}

function ProbabilityBar({ p, names }) {
  const parts = [
    { key: 'home', label: names.home, value: p.home },
    { key: 'draw', label: 'Empate', value: p.draw },
    { key: 'away', label: names.away, value: p.away },
  ];
  return (
    <div className="lo-probbar">
      <div className="lo-probbar-labels">
        {parts.map((x) => (
          <span key={x.key} className={`lo-probbar-label ${x.key}`}>
            <span className="lo-probbar-name"><i style={{ background: SERIES[x.key] }} /><span>{x.label}</span></span>
            <b>{Math.round(x.value)}%</b>
          </span>
        ))}
      </div>
      <div className="lo-probbar-track" role="img" aria-label={parts.map((x) => `${x.label} ${x.value}%`).join(', ')}>
        {parts.map((x) => (
          <span key={x.key} style={{ width: `${x.value}%`, background: SERIES[x.key] }} />
        ))}
      </div>
    </div>
  );
}

const CH_BASE = { h: 165, l: 34, r: 40, t: 10, b: 24 };

function ProbChart({ history, names }) {
  const [hover, setHover] = useState(null);
  const [width, setWidth] = useState(600);
  const boxRef = useRef(null);
  const points = useMemo(() => history.filter((h) => h.p), [history]);
  const drawable = points.length >= 2;

  // El viewBox usa el ancho real en píxeles: el texto no se encoge en móvil
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [drawable]);

  if (!drawable) {
    return (
      <div className="lo-chart-empty">
        La curva de probabilidad se dibuja con cada actualización (cada 15 s) mientras sigues el partido.
      </div>
    );
  }
  const CH = { ...CH_BASE, w: width, h: width < 420 ? 150 : CH_BASE.h };
  const maxMin = Math.max(90, ...points.map((h) => h.minute));
  const minMin = Math.min(...points.map((h) => h.minute));
  const span = Math.max(1, maxMin - minMin);
  const X = (m) => CH.l + ((m - minMin) / span) * (CH.w - CH.l - CH.r);
  const Y = (v) => CH.t + (1 - v / 100) * (CH.h - CH.t - CH.b);
  const series = ['home', 'draw', 'away'];
  const path = (k) => points.map((h, i) => `${i ? 'L' : 'M'}${X(h.minute).toFixed(1)},${Y(h.p[k]).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const labelName = { home: names.home, draw: 'Empate', away: names.away };

  // Etiquetas directas al final de cada línea, sin superponerse
  const ends = series
    .map((k) => ({ k, y: Y(last.p[k]) }))
    .sort((a, b) => a.y - b.y)
    .reduce((acc, e) => {
      const prev = acc[acc.length - 1];
      acc.push({ ...e, y: prev && e.y - prev.y < 13 ? prev.y + 13 : e.y });
      return acc;
    }, []);

  const onMove = (ev) => {
    const box = ev.currentTarget.getBoundingClientRect();
    const x = ((ev.clientX - box.left) / box.width) * CH.w;
    let best = points[0];
    for (const h of points) if (Math.abs(X(h.minute) - x) < Math.abs(X(best.minute) - x)) best = h;
    setHover(best);
  };

  const ticks = [];
  for (let m = Math.ceil(minMin / 15) * 15; m <= maxMin; m += 15) ticks.push(m);

  return (
    <div className="lo-chart">
      <div className="lo-chart-box" ref={boxRef}>
        <svg
          viewBox={`0 0 ${CH.w} ${CH.h}`}
          role="img"
          aria-label={`Probabilidad de victoria por minuto. Ahora: ${labelName.home} ${last.p.home}%, empate ${last.p.draw}%, ${labelName.away} ${last.p.away}%.`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v} className="lo-grid">
              <line x1={CH.l} x2={CH.w - CH.r} y1={Y(v)} y2={Y(v)} />
              <text x={CH.l - 6} y={Y(v) + 3.5}>{v}%</text>
            </g>
          ))}
          {ticks.map((m) => (
            <text key={m} className="lo-axis-x" x={X(m)} y={CH.h - 8}>{m}'</text>
          ))}
          {series.map((k) => (
            <path key={k} d={path(k)} className="lo-line" style={{ stroke: SERIES[k] }} />
          ))}
          {series.map((k) => (
            <circle key={k} cx={X(last.minute)} cy={Y(last.p[k])} r="4" className="lo-dot" style={{ fill: SERIES[k] }} />
          ))}
          {ends.map((e) => (
            <text key={e.k} className="lo-endlabel" x={X(last.minute) + 9} y={e.y + 4}>
              {last.p[e.k]}%
            </text>
          ))}
          {hover && (
            <g className="lo-hover">
              <line x1={X(hover.minute)} x2={X(hover.minute)} y1={CH.t} y2={CH.h - CH.b} />
              {series.map((k) => (
                <circle key={k} cx={X(hover.minute)} cy={Y(hover.p[k])} r="4" style={{ fill: SERIES[k] }} />
              ))}
            </g>
          )}
        </svg>
        {hover && (
          <div className="lo-tooltip" style={{ left: `${(X(hover.minute) / CH.w) * 100}%` }}>
            <b>Minuto {Math.round(hover.minute)}'</b>
            {series.map((k) => (
              <span key={k}><i style={{ background: SERIES[k] }} />{labelName[k]} <b>{hover.p[k]}%</b></span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, icon = null, home, away }) {
  if (home == null && away == null) return null;
  const h = Number(home) || 0;
  const a = Number(away) || 0;
  const hw = h + a ? (h / (h + a)) * 100 : 50;
  return (
    <div className="lo-stat">
      <span className="lo-stat-val">{home ?? '—'}</span>
      <div className="lo-stat-mid">
        <span className="lo-stat-label">{icon}{label}</span>
        <span className="lo-stat-bar">
          <span style={{ width: `${hw}%`, background: SERIES.home }} />
          <span style={{ width: `${100 - hw}%`, background: SERIES.away }} />
        </span>
      </div>
      <span className="lo-stat-val">{away ?? '—'}</span>
    </div>
  );
}

/** Columna lateral: probabilidad siempre a la vista y el detalle en pestañas para no alargar la página. */
function Insights({ data, history, names, incidents }) {
  const [view, setView] = useState('trend');
  // Con los mercados suspendidos la fuente puede dejar el 1X2 sin precio: se mantiene la última lectura
  const p = data.impliedProbabilities || [...history].reverse().find((h) => h.p)?.p || null;
  const views = [
    { id: 'trend', label: 'Evolución' },
    { id: 'stats', label: 'Estadísticas' },
    ...(incidents.length ? [{ id: 'events', label: 'Incidencias' }] : []),
  ];
  const current = views.some((v) => v.id === view) ? view : 'trend';

  return (
    <div className="lo-block lo-insights">
      <h4>Probabilidad de ganar</h4>
      {p && <ProbabilityBar p={p} names={names} />}

      <div className="lo-seg" role="tablist" aria-label="Detalle del partido">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={v.id === current}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="lo-seg-panel" role="tabpanel">
        {current === 'trend' && (
          <>
            <ProbChart history={history} names={names} />
            {p && (
              <p className="lo-footnote">
                Calculada desde las cuotas, sin el margen de la casa{p.bookMargin > 0 ? ` (${p.bookMargin}%)` : ''}.
              </p>
            )}
          </>
        )}

        {current === 'stats' && (
          <div>
            <div className="lo-stat-head">
              <span><i style={{ background: SERIES.home }} />{names.home}</span>
              <span>{names.away}<i style={{ background: SERIES.away }} /></span>
            </div>
            <StatRow label="Goles esperados (xG)" home={data.home.stats.xG} away={data.away.stats.xG} />
            <StatRow label="Tiros" home={data.home.stats.shots} away={data.away.stats.shots} />
            <StatRow label="Córners" icon={<CornerFlag size={12} />} home={data.home.stats.corners} away={data.away.stats.corners} />
            <StatRow label="Amarillas" icon={<YellowCard size={12} />} home={data.home.stats.yellowCards} away={data.away.stats.yellowCards} />
          </div>
        )}

        {current === 'events' && (
          <ul className="lo-incidents">
            {incidents.map((i, idx) => (
              <li key={`${i.type}-${i.minute}-${idx}`}>
                <span className="lo-inc-time">{i.time || ''}</span>
                <span className="lo-inc-icon"><PlayIcon kind={INCIDENT_ICON[i.type]} size={15} /></span>
                <span className="lo-inc-text">{i.type === 'SUBS' ? `${i.playerIn} por ${i.playerOut}` : i.detail || i.title}</span>
                {i.side && <i className="lo-inc-side" style={{ background: SERIES[i.side] }} aria-label={i.side === 'home' ? names.home : names.away} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function LiveOddsPanel({ match, isLive, isFinished = false, odds, lock = null }) {
  const { status, data, history = [], extension } = odds || {};
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // Visitantes sin la extensión (sitio publicado): no se muestra nada
  if (status === 'no-extension' && !import.meta.env.DEV) return null;

  const names = {
    home: match.homeTeam?.shortName || match.homeTeam?.name,
    away: match.awayTeam?.shortName || match.awayTeam?.name,
  };
  const outdated = extension && !versionAtLeast(extension.version, PITCH_MIN_VERSION);

  if (status === 'no-extension') {
    return (
      <section className="lo-panel lo-hint">
        <span className="lo-hint-icon" aria-hidden="true"><Plug size={16} /></span>
        <div>
          <h3>Cuotas en vivo</h3>
          <p>Conecta la extensión <b>CodeSoft Cuotas en Vivo</b> para ver mercados y jugadas al segundo. Cárgala desde <code>extension/</code> en chrome://extensions y recarga.</p>
        </div>
      </section>
    );
  }

  if (!isLive) {
    return (
      <section className="lo-panel">
        <div className="lo-head"><h3>Cuotas en vivo</h3></div>
        <p className="lo-muted">
          {isFinished
            ? 'El partido terminó: ya no hay cuotas en vivo.'
            : 'Las cuotas aparecen cuando el partido empieza. Abre un partido que esté en vivo.'}
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="lo-panel">
        <div className="lo-head"><h3>Cuotas en vivo</h3></div>
        <p className="lo-muted">{STATUS_TEXT[status] || STATUS_TEXT.searching}</p>
      </section>
    );
  }

  const updated = Date.parse(data.capturedAt) || now;
  const stale = now - updated > STALE_MS;
  const incidents = data.incidents.filter((i) => INCIDENT_ICON[i.type]).slice(-6).reverse();
  const locked = Boolean(lock?.locked);
  const reason = locked && lock.kind ? LOCK_REASON[lock.kind]?.(lock.side ? names[lock.side] : null) : null;

  return (
    <section className={`lo-panel ${locked ? 'is-locked' : ''}`} aria-labelledby="lo-title">
      <div className="lo-head">
        <h3 id="lo-title">Cuotas en vivo</h3>
        {locked ? (
          <span className="lo-status locked" role="status">
            <Lock size={11} />
            {reason ? `Suspendido · ${reason}` : 'Mercados suspendidos'}
          </span>
        ) : (
          <span className={`lo-status ${stale ? 'stale' : 'live'}`}>
            <Radio size={11} />
            {stale ? `Sin actualizar · ${ago(now - updated)}` : `Actualizado ${ago(now - updated)}`}
          </span>
        )}
      </div>

      {outdated && (
        <p className="lo-update">Actualiza la extensión para ver la jugada en vivo en la cancha: chrome://extensions → botón de recargar en “CodeSoft Cuotas en Vivo”.</p>
      )}

      <MarketBoard
        data={data}
        homeName={names.home}
        awayName={names.away}
        locked={locked}
        aside={<Insights data={data} history={history} names={names} incidents={incidents} />}
      />
    </section>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Lock, X } from 'lucide-react';
import { buildMarketBoard } from '../utils/marketBoard';
import { sounds } from '../utils/soundEffects';

// Mercados en tarjetas con pestañas. Las cuotas publicadas en vivo van tal cual; las que no
// publica la fuente se estiman con el modelo y llevan "≈". Se pueden elegir para simular una jugada.

const MOVE_MS = 12000;
const keyOf = (m, s) => `${m.title}|${s.label}`;
const fmt = (n) => n.toFixed(2);

/** Cuotas que subieron o bajaron respecto de la lectura anterior (se marcan unos segundos). */
function useMoves(board) {
  const prev = useRef(new Map());
  const [moves, setMoves] = useState({});
  useEffect(() => {
    if (!board) return;
    const next = new Map();
    const changed = {};
    const now = Date.now();
    for (const t of board.tabs) {
      for (const m of t.markets) {
        for (const row of m.rows) {
          for (const s of row) {
            if (s.price == null) continue;
            const k = keyOf(m, s);
            next.set(k, s.price);
            const before = prev.current.get(k);
            if (before != null && before !== s.price) changed[k] = { dir: s.price > before ? 'up' : 'down', at: now };
          }
        }
      }
    }
    prev.current = next;
    if (Object.keys(changed).length) setMoves((m) => ({ ...m, ...changed }));
  }, [board]);
  useEffect(() => {
    const id = setInterval(() => {
      setMoves((m) => {
        const now = Date.now();
        const keep = Object.entries(m).filter(([, v]) => now - v.at < MOVE_MS);
        return keep.length === Object.keys(m).length ? m : Object.fromEntries(keep);
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);
  return moves;
}

function Selection({ market, s, move, on, onPick, locked }) {
  const est = market.estimated || s.estimated;
  const closed = locked || s.price == null;
  return (
    <button
      type="button"
      className={`mb-sel ${on ? 'on' : ''} ${move ? move.dir : ''}`}
      disabled={closed}
      aria-pressed={on}
      onClick={() => onPick(market, s)}
      title={closed ? 'Mercado suspendido' : s.p != null ? `Probabilidad estimada ${Math.round(s.p * 100)}%` : undefined}
    >
      <span className="mb-sel-label">{s.label}</span>
      <span className="mb-sel-price">
        {move && <span className={`mb-move ${move.dir}`} aria-label={move.dir === 'up' ? 'Subió' : 'Bajó'} />}
        {closed ? <Lock className="mb-lock-icon" size={13} aria-label="Suspendido" /> : `${est ? '≈' : ''}${fmt(s.price)}`}
      </span>
    </button>
  );
}

function MarketCard({ market, moves, isPicked, onPick, locked }) {
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  const grid = market.layout === 'grid';
  const items = grid ? market.rows[0].filter((s) => s.price != null) : null;
  const limit = market.visible ?? 99;
  const more = grid ? items.length > limit : market.rows.length > limit;
  const rows = grid ? null : all ? market.rows : market.rows.slice(0, limit);
  const cells = grid ? (all ? items : items.slice(0, limit)) : null;
  const render = (s) => {
    const move = moves[keyOf(market, s)];
    return (
      <Selection
        key={`${s.label}-${move?.at || 0}`}
        market={market}
        s={s}
        move={move}
        on={isPicked(market, s)}
        onPick={onPick}
        locked={locked}
      />
    );
  };

  return (
    <article className="mb-card">
      <button type="button" className="mb-card-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <h4>{market.title}</h4>
        {market.estimated && <span className="mb-est" title="Calculada con el modelo a partir de las cuotas en vivo">Estimada</span>}
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="mb-body">
          {grid ? (
            <div className="mb-grid">{cells.map(render)}</div>
          ) : (
            rows.map((row, i) => (
              <div key={i} className={`mb-row ${row.length >= 3 ? 'is-stack' : ''}`} style={{ '--cols': row.length }}>
                {row.map(render)}
              </div>
            ))
          )}
          {more && (
            <button type="button" className="mb-more" onClick={() => setAll((v) => !v)}>
              {all ? 'Mostrar menos' : 'Mostrar todo'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function Slip({ picks, prices, onRemove, onClear, locked }) {
  const [stake, setStake] = useState(10);
  const lines = picks.map((p) => ({ ...p, ...(prices.get(`${p.title}|${p.label}`) || {}), ...(locked ? { price: null } : {}) }));
  const open = lines.filter((l) => l.price != null);
  const total = open.reduce((acc, l) => acc * l.price, 1);
  const amount = Math.max(0, Number(stake) || 0);
  return (
    <aside className="mb-slip" aria-label="Simulación de jugada">
      <div className="mb-slip-head">
        <b>Simulación</b>
        <span>{picks.length === 1 ? '1 selección' : `${picks.length} selecciones`}</span>
        <button type="button" onClick={onClear}>Vaciar</button>
      </div>
      <ul>
        {lines.map((l) => (
          <li key={`${l.title}|${l.label}`}>
            <span className="mb-slip-pick">
              <b>{l.label}</b>
              <small>{l.title}</small>
            </span>
            <span className="mb-slip-price">{l.price != null ? `${l.estimated ? '≈' : ''}${fmt(l.price)}` : 'Suspendida'}</span>
            <button type="button" aria-label={`Quitar ${l.label}`} onClick={() => onRemove(l)}><X size={13} /></button>
          </li>
        ))}
      </ul>
      <div className="mb-slip-foot">
        <label>
          Monto S/
          <input type="number" min="1" step="1" inputMode="numeric" value={stake} onChange={(e) => setStake(e.target.value)} />
        </label>
        <span>Cuota <b>{open.length ? fmt(total) : '—'}</b></span>
        <span>Retorno <b>{open.length ? `S/ ${(amount * total).toFixed(2)}` : '—'}</b></span>
      </div>
      <p className="mb-slip-note">Solo para seguir el partido: acá no se apuesta dinero.</p>
    </aside>
  );
}

/**
 * Tablero de mercados con su columna lateral: la simulación arriba y, debajo, lo que llegue en `aside`.
 * En un contenedor angosto la columna lateral pasa abajo del tablero.
 */
export default function MarketBoard({ data, homeName, awayName, aside = null, locked = false }) {
  const board = useMemo(() => buildMarketBoard(data, { home: homeName, away: awayName }), [data, homeName, awayName]);
  const moves = useMoves(board);
  const [tab, setTab] = useState('popular');
  const [picks, setPicks] = useState([]);

  // Precio vigente de cada selección (para la simulación, que sigue a las cuotas en vivo)
  const prices = useMemo(() => {
    const map = new Map();
    for (const t of board?.tabs || []) {
      for (const m of t.markets) {
        for (const row of m.rows) {
          for (const s of row) map.set(keyOf(m, s), { price: s.price, estimated: Boolean(m.estimated || s.estimated) });
        }
      }
    }
    return map;
  }, [board]);

  if (!board?.tabs.length) return aside ? <div className="mb"><div className="mb-rail">{aside}</div></div> : null;
  const current = board.tabs.find((t) => t.id === tab) || board.tabs[0];
  const isPicked = (m, s) => picks.some((p) => p.title === m.title && p.label === s.label);
  // Una selección por mercado: elegir otra del mismo mercado la reemplaza
  const onPick = (m, s) => {
    sounds.playClick();
    setPicks((list) => (isPicked(m, s)
      ? list.filter((p) => !(p.title === m.title && p.label === s.label))
      : [...list.filter((p) => p.title !== m.title), { title: m.title, label: s.label }]));
  };

  return (
    <div className={`mb ${locked ? 'is-locked' : ''}`}>
      <div className="mb-main">
        <div className="mb-tabs" role="tablist" aria-label="Mercados">
          {board.tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === current.id}
              className="mb-tab"
              onClick={() => { sounds.playClick(); setTab(t.id); }}
            >
              {t.label}
              <span className="mb-tab-count">{t.markets.length}</span>
            </button>
          ))}
        </div>

        <div className="mb-cards" role="tabpanel">
          {current.markets.map((m) => (
            <MarketCard key={`${current.id}-${m.id}`} market={m} moves={moves} isPicked={isPicked} onPick={onPick} locked={locked} />
          ))}
        </div>

        <p className="mb-legend">≈ cuota estimada con el modelo a partir de las cuotas en vivo. Sin ≈, publicada en vivo.</p>
      </div>

      {(picks.length > 0 || aside) && (
        <div className="mb-rail">
          {picks.length > 0 && (
            <Slip
              picks={picks}
              prices={prices}
              onRemove={(l) => setPicks((list) => list.filter((p) => !(p.title === l.title && p.label === l.label)))}
              onClear={() => setPicks([])}
              locked={locked}
            />
          )}
          {aside}
        </div>
      )}
    </div>
  );
}

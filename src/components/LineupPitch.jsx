import React from 'react';
import '../lineup.css';

const PITCH_W = 105;
const PITCH_H = 68;

// Profundidad aproximada según la posición que entrega ESPN (G, RB, CD-L, CM, AM-R, F...)
function depthOf(pos = '') {
  const p = pos.toUpperCase();
  if (p === 'G' || p === 'GK') return 0;
  if (/WB/.test(p)) return 1.5;
  if (/^(CD|CB|RB|LB|D|SW)/.test(p)) return 1;
  if (/^(DM|CDM)/.test(p)) return 2;
  if (/^(AM|CAM)/.test(p)) return 4;
  if (/^(F|CF|ST|LF|RF|LW|RW|S)/.test(p)) return 5;
  return 3; // CM, LM, RM, M
}

// Lateralidad: negativo = derecha del equipo, positivo = izquierda
function sideOf(pos = '') {
  const p = pos.toUpperCase();
  if (/(^R|-R$)/.test(p)) return -1;
  if (/(^L|-L$)/.test(p)) return 1;
  return 0;
}

/** Agrupa los titulares en líneas según la formación ("4-2-3-1" → [1,4,2,3,1]). */
function buildLines(starters, formation) {
  const sorted = [...starters].sort(
    (a, b) => depthOf(a.position) - depthOf(b.position) || a.formationPlace - b.formationPlace,
  );
  const counts = formation ? [1, ...formation.split('-').map(Number).filter(Boolean)] : null;
  const total = counts?.reduce((a, b) => a + b, 0);
  let lines;
  if (counts && total === sorted.length) {
    let i = 0;
    lines = counts.map((n) => {
      const line = sorted.slice(i, i + n);
      i += n;
      return line;
    });
  } else {
    // Sin formación fiable: agrupar por profundidad
    const byDepth = new Map();
    sorted.forEach((p) => {
      const d = depthOf(p.position);
      byDepth.set(d, [...(byDepth.get(d) || []), p]);
    });
    lines = [...byDepth.values()];
  }
  // Dentro de cada línea: de la derecha a la izquierda del equipo
  return lines.map((line) => [...line].sort((a, b) => sideOf(a.position) - sideOf(b.position)));
}

function place(lines, side) {
  const rows = lines.length;
  const placed = lines.map((row, r) => {
    const depth = rows > 1 ? 4 + (r / (rows - 1)) * 37 : 4;
    const x = side === 'home' ? depth : PITCH_W - depth;
    return row.map((p, i) => {
      const t = (PITCH_H * (i + 1)) / (row.length + 1);
      // El local ataca hacia la derecha: su lado derecho queda abajo
      const y = side === 'home' ? PITCH_H - t : t;
      return { ...p, x, y, labelUp: false };
    });
  });
  placed.forEach((row, r) => {
    if (r === 0) return;
    row.forEach((p) => {
      p.labelUp = placed[r - 1].some((q) => !q.labelUp && Math.abs(q.y - p.y) < 3);
    });
  });
  return placed.flat();
}

const label = (p) => {
  const n = p.shortName || p.name || '';
  return n.length > 11 ? `${n.slice(0, 10)}.` : n;
};

function Bench({ roster, color }) {
  const subs = roster?.substitutes || [];
  const outs = (roster?.starters || []).filter((p) => p.subbedOut);
  return (
    <div className="lp-bench">
      <div className="lp-bench-head">
        <i style={{ background: color }} />
        {roster?.teamName}
        <small>Suplentes · {subs.length}</small>
      </div>
      {subs.length === 0 ? (
        <p className="lp-muted">Sin suplentes confirmados.</p>
      ) : (
        <ul>
          {subs.map((p) => (
            <li key={`${p.jersey}-${p.name}`} className={p.subbedIn ? 'in' : ''}>
              <span className="lp-jersey">{p.jersey}</span>
              <span className="lp-name">{p.name}</span>
              {p.subbedIn && <span className="lp-tag in">Entró</span>}
            </li>
          ))}
        </ul>
      )}
      {outs.length > 0 && (
        <p className="lp-outs">
          Salieron: {outs.map((p) => p.shortName || p.name).join(', ')}
        </p>
      )}
    </div>
  );
}

export default function LineupPitch({ rosters = [], homeName, awayName, homeColor, awayColor }) {
  const home = rosters.find((r) => r.homeAway === 'home') || rosters[0];
  const away = rosters.find((r) => r.homeAway === 'away') || rosters[1];
  const hasLineups = home?.starters?.length && away?.starters?.length;

  if (!hasLineups) {
    return (
      <div className="lp-wrap">
        <div className="lp-empty">Las alineaciones aparecen cuando se confirman, normalmente una hora antes del partido.</div>
      </div>
    );
  }

  const players = [
    ...place(buildLines(home.starters, home.formation), 'home').map((p) => ({ ...p, fill: homeColor, side: 'home' })),
    ...place(buildLines(away.starters, away.formation), 'away').map((p) => ({ ...p, fill: awayColor, side: 'away' })),
  ];

  return (
    <div className="lp-wrap">
      <div className="lp-head">
        <span><i style={{ background: homeColor }} />{homeName || home.teamName} <b>{home.formation}</b></span>
        <span><b>{away.formation}</b> {awayName || away.teamName}<i style={{ background: awayColor }} /></span>
      </div>
      <svg className="lp-pitch" viewBox={`-2 -2 ${PITCH_W + 4} ${PITCH_H + 4}`} role="img"
        aria-label={`Alineaciones: ${home.teamName} ${home.formation || ''} contra ${away.teamName} ${away.formation || ''}`}>
        <rect x="-2" y="-2" width={PITCH_W + 4} height={PITCH_H + 4} className="lp-grass" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={i * 10.5} y="0" width="10.5" height={PITCH_H} className={i % 2 ? 'lp-stripe' : 'lp-grass'} />
        ))}
        <g className="lp-lines">
          <rect x="0" y="0" width={PITCH_W} height={PITCH_H} />
          <line x1={PITCH_W / 2} y1="0" x2={PITCH_W / 2} y2={PITCH_H} />
          <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r="9.15" />
          <rect x="0" y="13.84" width="16.5" height="40.32" />
          <rect x="0" y="24.84" width="5.5" height="18.32" />
          <rect x={PITCH_W - 16.5} y="13.84" width="16.5" height="40.32" />
          <rect x={PITCH_W - 5.5} y="24.84" width="5.5" height="18.32" />
        </g>
        {players.map((p) => (
          <g key={`${p.side}-${p.jersey}-${p.name}`} className="lp-player" transform={`translate(${p.x} ${p.y})`}>
            <title>{`${p.name} · ${p.jersey ?? ''}${p.subbedOut ? ' (salió)' : ''}`}</title>
            <circle r="2.9" fill={p.fill} className={p.subbedOut ? 'out' : ''} />
            <text className="lp-num" dy="0.95">{p.jersey}</text>
            <text className="lp-pname" dy={p.labelUp ? -4.2 : 6.2}>{label(p)}</text>
            {p.subbedOut && <text className="lp-out-mark" x="2.6" y="-2">▼</text>}
          </g>
        ))}
      </svg>
      <div className="lp-benches">
        <Bench roster={home} color={homeColor} />
        <Bench roster={away} color={awayColor} />
      </div>
    </div>
  );
}

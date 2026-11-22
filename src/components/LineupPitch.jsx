import React, { useEffect, useId, useState } from 'react';
import PitchTurf from './PitchTurf';
import PlayerAvatar from './PlayerAvatar';
import usePlayerPhoto from '../hooks/usePlayerPhoto';
import { isCutout, sizedPhoto } from '../api/playerPhotos';
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

const R = 2.9;

/** Jugador en la cancha: su foto dentro del círculo y el dorsal en una insignia; sin foto, el dorsal. */
/** true cuando la imagen ya cargó (así no aparece un recuadro roto dentro del SVG). */
function useImageReady(src) {
  const [state, setState] = useState({ src: null, ok: false });
  useEffect(() => {
    if (!src) return undefined;
    let alive = true;
    const img = new Image();
    img.onload = () => { if (alive) setState({ src, ok: true }); };
    img.onerror = () => { if (alive) setState({ src, ok: false }); };
    img.src = src;
    return () => { alive = false; };
  }, [src]);
  return state.src === src && state.ok;
}

function PitchPlayer({ p, clipId }) {
  const url = usePlayerPhoto(p.name, p.teamName, p.headshot, 2);
  const href = url ? sizedPhoto(url, 200) : null;
  const ok = useImageReady(href);
  // Los recortes de TheSportsDB son de medio cuerpo: se amplían 1,7× hacia la cara
  const box = ok && isCutout(url) ? { x: -4.93, y: -3.23, s: 9.86 } : { x: -R, y: -R, s: R * 2 };

  return (
    <g className={`lp-player${ok ? ' has-photo' : ''}`} transform={`translate(${p.x} ${p.y})`}>
      <title>{`${p.name} · ${p.jersey ?? ''}${p.subbedOut ? ' (salió)' : ''}`}</title>
      <circle r={R} fill={p.fill} className={p.subbedOut ? 'out' : ''} />
      {ok ? (
        <>
          <image
            href={href}
            x={box.x}
            y={box.y}
            width={box.s}
            height={box.s}
            preserveAspectRatio="xMidYMin slice"
            clipPath={`url(#${clipId})`}
            className={p.subbedOut ? 'out' : ''}
          />
          <circle r={R} className="lp-ring" style={{ stroke: p.fill }} />
          <g className="lp-badge" transform="translate(2.3 2.2)">
            <circle r="1.3" fill={p.fill} />
            <text dy="0.46">{p.jersey}</text>
          </g>
        </>
      ) : (
        <text className="lp-num" dy="0.95">{p.jersey}</text>
      )}
      <text className="lp-pname" dy={p.labelUp ? -4.2 : 6.2}>{label(p)}</text>
      {p.subbedOut && <text className="lp-out-mark" x="-3.4" y="-2">▼</text>}
    </g>
  );
}

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
              <PlayerAvatar name={p.name} team={roster?.teamName} headshot={p.headshot} size={24} priority={1} color={color} />
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
  const clipId = `lp-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
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
    ...place(buildLines(home.starters, home.formation), 'home').map((p) => ({ ...p, fill: homeColor, side: 'home', teamName: home.teamName })),
    ...place(buildLines(away.starters, away.formation), 'away').map((p) => ({ ...p, fill: awayColor, side: 'away', teamName: away.teamName })),
  ];

  return (
    <div className="lp-wrap">
      <div className="lp-head">
        <span><i style={{ background: homeColor }} />{homeName || home.teamName} <b>{home.formation}</b></span>
        <span><b>{away.formation}</b> {awayName || away.teamName}<i style={{ background: awayColor }} /></span>
      </div>
      <svg className="lp-pitch" viewBox={`-2 -2 ${PITCH_W + 4} ${PITCH_H + 4}`} role="img"
        aria-label={`Alineaciones: ${home.teamName} ${home.formation || ''} contra ${away.teamName} ${away.formation || ''}`}>
        <PitchTurf w={PITCH_W} h={PITCH_H} pad={2} />
        <defs>
          <clipPath id={clipId}><circle r={R} /></clipPath>
        </defs>
        {players.map((p) => (
          <PitchPlayer key={`${p.side}-${p.jersey}-${p.name}`} p={p} clipId={clipId} />
        ))}
      </svg>
      <div className="lp-benches">
        <Bench roster={home} color={homeColor} />
        <Bench roster={away} color={awayColor} />
      </div>
    </div>
  );
}

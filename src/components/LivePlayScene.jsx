import React from 'react';
import { PlayIcon } from './SportIcon';

// Escenas propias de la cancha en tiempo real (coordenadas 105 x 68, local ataca a la derecha).
// Los datos de cada jugada vienen de la fuente en vivo; los dibujos y animaciones son nuestros.
const W = 105;
const H = 68;
const MID = H / 2;
const BOX = { top: 13.84, bottom: 54.16, depth: 16.5 };

const penaltyBox = (goalX) => ({ x: goalX === W ? W - BOX.depth : 0, y: BOX.top, width: BOX.depth, height: BOX.bottom - BOX.top });
const goalArea = (goalX) => ({ x: goalX === W ? W - 5.5 : 0, y: 24.84, width: 5.5, height: 18.32 });

/** Punto de una curva cuadrática en t (para la pelota en vuelo). */
const quad = (a, c, b, t) => ({
  x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
  y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y,
});

/**
 * Presión del equipo: degradado suave desde el balón hasta la línea de fondo que ataca.
 * En ataque peligroso, además, un brillo recorre la zona hacia el arco.
 */
function Press({ id, ball, goalX, color, level, sweep }) {
  const x = Math.min(ball.x, goalX);
  const width = Math.abs(goalX - ball.x);
  if (width < 1) return null;
  const dir = goalX > ball.x ? 1 : -1;
  const band = Math.min(12, width);
  return (
    <>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={ball.x} y1="0" x2={goalX} y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0" />
          <stop offset="1" stopColor={color} stopOpacity="1" />
        </linearGradient>
        {sweep && (
          <>
            <linearGradient id={`${id}-s`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.22" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${id}-c`}>
              <rect x={x} y="0" width={width} height={H} />
            </clipPath>
          </>
        )}
      </defs>
      <rect x={x} y="0" width={width} height={H} className={`ls-press ${level}`} fill={`url(#${id})`} />
      {sweep && (
        <g clipPath={`url(#${id}-c)`}>
          <rect
            x={dir === 1 ? ball.x - band : ball.x}
            y="0"
            width={band}
            height={H}
            fill={`url(#${id}-s)`}
            className="ls-sweep"
            style={{ '--sweep': `${dir * (width + band)}px` }}
          />
        </g>
      )}
    </>
  );
}

/** Arco con red detrás de la línea; en el gol la red se infla y destella. */
function GoalNet({ goalX, goal }) {
  const right = goalX === W;
  const depth = 2.4;
  const x = right ? W : -depth;
  const y = 30.34;
  const h = 7.32;
  const cols = [1, 2].map((i) => x + (depth / 3) * i);
  const rows = [1, 2, 3, 4, 5].map((i) => y + (h / 6) * i);
  return (
    <g className={`ls-net ${goal ? 'is-goal' : ''} ${right ? 'right' : 'left'}`}>
      <rect x={x} y={y} width={depth} height={h} className="ls-net-box" />
      {cols.map((cx) => <line key={cx} x1={cx} y1={y} x2={cx} y2={y + h} />)}
      {rows.map((ry) => <line key={ry} x1={x} y1={ry} x2={x + depth} y2={ry} />)}
      <line x1={goalX} y1={y} x2={goalX} y2={y + h} className="ls-net-line" />
    </g>
  );
}

/**
 * Pelota en vuelo: recorre los puntos dados (CSS, arranca al montar la escena).
 * `points` son 5 posiciones: 0 %, 25 %, 50 %, 75 % y 100 % del recorrido.
 */
function Flight({ points, delay = 0.15, dur = 0.9 }) {
  const vars = {};
  points.forEach((p, i) => {
    vars[`--p${i}x`] = `${p.x}px`;
    vars[`--p${i}y`] = `${p.y}px`;
  });
  return (
    <circle
      cx="0"
      cy="0"
      r="1"
      className="ls-flight"
      style={{ ...vars, animationDelay: `${delay}s`, animationDuration: `${dur}s` }}
    />
  );
}

const straight = (a, b) => [0, 0.25, 0.5, 0.75, 1].map((t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }));
const curved = (a, c, b) => [0, 0.25, 0.5, 0.75, 1].map((t) => quad(a, c, b, t));

const START = 0.15; // segundos antes de que salga la pelota

function Trajectory({ from, to, ctrl, dashed, flight = true, dur = 0.9 }) {
  const d = ctrl
    ? `M${from.x},${from.y} Q${ctrl.x},${ctrl.y} ${to.x},${to.y}`
    : `M${from.x},${from.y} L${to.x},${to.y}`;
  return (
    <>
      <path
        d={d}
        pathLength="100"
        className={`ls-traj ${dashed ? 'dashed' : ''}`}
        style={dashed ? undefined : { animationDuration: `${dur}s`, animationDelay: `${START}s` }}
      />
      <circle cx={to.x} cy={to.y} r="0.8" className="ls-end" style={{ animationDelay: `${START + dur}s` }} />
      {flight && <Flight points={ctrl ? curved(from, ctrl, to) : straight(from, to)} delay={START} dur={dur} />}
    </>
  );
}

/** Rebote después de pegar en el arquero o en el palo. */
function Rebound({ from, dir }) {
  const to = { x: from.x - dir * 6.5, y: from.y + (from.y < MID ? -5.5 : 5.5) };
  return <path d={`M${from.x},${from.y} L${to.x},${to.y}`} className="ls-rebound" />;
}

function Ring({ at, color = '#fff', r = 3, delay = 0 }) {
  return <circle cx={at.x} cy={at.y} r={r} className="ls-ring" style={{ stroke: color, animationDelay: `${delay}s` }} />;
}

function Miss({ at }) {
  return (
    <g className="ls-miss">
      <line x1={at.x - 1.2} y1={at.y - 1.2} x2={at.x + 1.2} y2={at.y + 1.2} />
      <line x1={at.x - 1.2} y1={at.y + 1.2} x2={at.x + 1.2} y2={at.y - 1.2} />
    </g>
  );
}

/**
 * Marca de CodeSoft: una C gruesa en itálica con el rayo de la app adentro.
 * Dibujada en un cuadro de ~34 unidades centrado en (0, 0).
 */
function BrandMark({ id, cFill, boltFill }) {
  return (
    <g transform="skewX(-12)">
      <path
        d="M7.7 -9.2 A12 12 0 1 0 7.7 9.2"
        fill="none"
        stroke={cFill || `url(#${id})`}
        strokeWidth="8.6"
        strokeLinecap="butt"
      />
      <path d="M3.4 -7.4 L-2.8 1.3 H1.1 L-0.7 7.4 L5.6 -1.5 H1.7 Z" fill={boltFill} />
    </g>
  );
}

const teamCode = (code, name = '') => {
  if (code) return String(code).slice(0, 3).toUpperCase();
  const clean = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z ]/g, '');
  return (clean.replace(/\s+/g, '') || '---').slice(0, 3).toUpperCase();
};

/**
 * Gol: la cancha se tiñe con el color del equipo, aparece la C de CodeSoft
 * y después queda el cartel con el marcador y el goleador.
 */
function Celebration({ uid, color, side, homeColor, awayColor, who, minute, board }) {
  const bw = 62;
  const bh = 9.6;
  const x0 = W / 2 - bw / 2;
  const y0 = MID - bh / 2;
  const cap = (x, dir, fill) => (
    <polygon
      points={`${x},${y0} ${x + dir * 2.6},${y0} ${x + dir * 1.4},${y0 + bh / 2} ${x + dir * 2.6},${y0 + bh} ${x},${y0 + bh}`}
      style={{ fill }}
    />
  );
  return (
    <g className="ls-celebrate">
      <defs>
        <linearGradient id={`${uid}-wash`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={`${uid}-brand`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8a1f" />
          <stop offset="1" stopColor="#ff4a1c" />
        </linearGradient>
        <linearGradient id={`${uid}-badge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7a18" />
          <stop offset="1" stopColor="#f0335f" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} className="ls-wash" fill={`url(#${uid}-wash)`} />

      {/* La C grande en el centro */}
      <g transform={`translate(${W / 2} ${MID}) scale(0.62)`}>
        <g className="ls-brand">
          <BrandMark id={`${uid}-brand`} boltFill="#fff" />
        </g>
      </g>

      {/* Cartel con el marcador */}
      {board && (
        <g className="ls-banner">
          <rect x={x0} y={y0} width={bw} height={bh} rx="1.4" className="ls-banner-bg" />
          {cap(x0, -1, homeColor)}
          {cap(x0 + bw, 1, awayColor)}
          <text x={x0 + 4.5} y={MID + 1.75} className="ls-banner-code">{board.homeCode}</text>
          <text x={W / 2 - 10.5} y={MID + 1.75} className={`ls-banner-score ${side === 'home' ? 'is-new' : ''}`}>{board.home}</text>
          <text x={W / 2 + 10.5} y={MID + 1.75} className={`ls-banner-score ${side === 'away' ? 'is-new' : ''}`}>{board.away}</text>
          <text x={x0 + bw - 4.5} y={MID + 1.75} className="ls-banner-code end">{board.awayCode}</text>
          <g transform={`translate(${W / 2} ${MID})`}>
            <circle r="6.6" fill={`url(#${uid}-badge)`} className="ls-banner-badge" />
            <g transform="translate(0.3 0) scale(0.28)">
              <BrandMark cFill="#fff" boltFill="#fff" />
            </g>
          </g>
          {(who || minute) && (
            <text x={x0 + bw} y={y0 + bh + 4.6} className="ls-banner-who">
              {who}
              {minute && <tspan className="ls-goal-min">{`  ${minute}`}</tspan>}
            </text>
          )}
        </g>
      )}
    </g>
  );
}

// ---------- Escenas de pausa: ícono de línea al centro, rótulo y jugador debajo ----------
// Íconos dibujados a mano en un cuadro de ~12 unidades centrado en (0, 0).

const STAGE_ICON = {
  // Maletín médico
  injury: (
    <>
      <rect x="-5.6" y="-3.4" width="11.2" height="8.2" rx="1.6" />
      <path d="M-2.1 -3.4 V-4.9 a0.9 0.9 0 0 1 0.9 -0.9 H1.2 a0.9 0.9 0 0 1 0.9 0.9 V-3.4" />
      <path d="M0 -1.2 V3 M-2.1 0.9 H2.1" />
    </>
  ),
  // Entra (verde) y sale (rojo)
  sub: (
    <>
      <path d="M-2.6 5 V-4.6 M-5 -2.2 L-2.6 -4.6 L-0.2 -2.2" className="ls-sub-in" style={{ stroke: '#2fbf71' }} />
      <path d="M2.6 -5 V4.6 M0.2 2.2 L2.6 4.6 L5 2.2" className="ls-sub-out" style={{ stroke: '#e5484d' }} />
    </>
  ),
  // Monitor de revisión
  var: (
    <>
      <rect x="-6.2" y="-5.2" width="12.4" height="8.4" rx="1.2" pathLength="100" className="ls-draw-in" />
      <path d="M-2.4 5.4 H2.4 M0 3.2 V5.4" />
      <text x="0" y="0.6" className="ls-stage-glyph">VAR</text>
    </>
  ),
  // Silbato
  kickoff: (
    <>
      <path d="M-6 -2.6 H1.4 A3.8 3.8 0 1 1 -2.05 -0.4 H-6 Z" />
      <circle cx="1.4" cy="1.2" r="1.1" />
      <path d="M4.2 -1.6 L6 -3.6" />
    </>
  ),
  // Cronómetro
  'added-time': (
    <>
      <circle cx="0" cy="0.9" r="4.7" />
      <path d="M0 -3.8 V-5.3 M-1.3 -5.5 H1.3 M3.6 -2.6 L4.5 -3.5 M0 0.9 L2.1 -1.2" />
    </>
  ),
  // Partido detenido
  stopped: (
    <>
      <circle cx="0" cy="0" r="5.2" />
      <path d="M-1.6 -2.2 V2.2 M1.6 -2.2 V2.2" />
    </>
  ),
  // Se reanuda
  resume: (
    <>
      <circle cx="0" cy="0" r="5.2" />
      <path d="M-1.4 -2.6 L2.8 0 L-1.4 2.6 Z" />
    </>
  ),
};

function Stage({ kind, title, who, minute }) {
  const icon = STAGE_ICON[kind];
  if (!icon) return null;
  return (
    <g className="ls-stage">
      <defs>
        <radialGradient id="ls-stage-shade">
          <stop offset="0" stopColor="#04100a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#04100a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={W / 2} cy={MID} r="20" fill="url(#ls-stage-shade)" className="ls-stage-shade" />
      <g transform={`translate(${W / 2} ${MID - 8.2})`}>
        <circle r="8" className="ls-stage-ring" />
        <g className="ls-stage-icon">{icon}</g>
      </g>
      <text x={W / 2} y={MID + 6.8} className="ls-stage-title">{title}</text>
      {(who || minute) && (
        <text x={W / 2} y={MID + 11.6} className="ls-stage-who">
          {who}
          {minute && <tspan className="ls-co-min">{`${who ? '  ' : ''}${minute}`}</tspan>}
        </text>
      )}
    </g>
  );
}

/**
 * @param goal marcador para el cartel del gol: { home, away, homeCode, awayCode, homeName, awayName }
 */
export default function LivePlayScene({ view, homeColor, awayColor, teamName, goal = null }) {
  if (!view) return null;
  const { kind, side, ball, target } = view;
  const color = side === 'away' ? awayColor : homeColor;
  const rival = side === 'away' ? homeColor : awayColor;
  const dir = side === 'away' ? -1 : 1;
  const goalX = dir === 1 ? W : 0;
  const ownGoalX = W - goalX;
  const uid = `ls-${String(view.key).replace(/[^\w-]/g, '')}`;

  let scene = null;
  switch (kind) {
    case 'possession':
      scene = <Press id={uid} ball={ball} goalX={goalX} color={color} level="low" />;
      break;
    case 'attack':
      scene = <Press id={uid} ball={ball} goalX={goalX} color={color} level="mid" />;
      break;
    case 'danger':
      scene = (
        <>
          <Press id={uid} ball={ball} goalX={goalX} color={color} level="high" sweep />
          <rect {...penaltyBox(goalX)} className="ls-box" style={{ fill: color, stroke: color }} />
        </>
      );
      break;
    case 'corner': {
      const top = ball.y < MID;
      const cy = top ? 0 : H;
      const poleTop = top ? -2.6 : H - 2.6;
      const boxX = goalX - dir * BOX.depth;
      // Abanico desde el banderín hasta el borde del área
      const wedge = `${goalX},${cy} ${boxX},${BOX.top} ${boxX},${BOX.bottom}`;
      scene = (
        <>
          <defs>
            <linearGradient id={uid} gradientUnits="userSpaceOnUse" x1={goalX} y1={cy} x2={boxX} y2={MID}>
              <stop offset="0" stopColor={color} stopOpacity="0.6" />
              <stop offset="1" stopColor={color} stopOpacity="0.04" />
            </linearGradient>
          </defs>
          <polygon points={wedge} className="ls-wedge" fill={`url(#${uid})`} />
          <rect {...penaltyBox(goalX)} className="ls-box soft" style={{ stroke: color }} />
          <path
            d={`M${goalX - dir * 1.4},${cy} A1.4 1.4 0 0 ${(dir === 1) === top ? 0 : 1} ${goalX},${top ? 1.4 : H - 1.4}`}
            className="ls-arc"
          />
          <g className="ls-flag">
            <line x1={goalX} y1={cy} x2={goalX} y2={poleTop} />
            <polygon
              points={`${goalX},${poleTop} ${goalX - dir * 2},${poleTop + 0.7} ${goalX},${poleTop + 1.4}`}
              className={dir === 1 ? 'to-left' : 'to-right'}
              style={{ fill: color }}
            />
          </g>
          <Ring at={ball} r={2.6} />
          <Trajectory from={ball} to={target} ctrl={{ x: goalX - dir * 2, y: (ball.y + target.y) / 2 }} dur={1.1} />
        </>
      );
      break;
    }
    case 'shot-on':
    case 'shot-off':
    case 'woodwork':
    case 'goal': {
      const post = { x: goalX, y: target.y };
      scene = (
        <>
          <GoalNet goalX={goalX} goal={kind === 'goal'} />
          <Trajectory from={ball} to={target} dur={0.8} />
          {kind === 'shot-off' && <Miss at={target} />}
          {kind === 'shot-on' && (
            <>
              <Ring at={target} color={rival} r={2.2} delay={0.95} />
              <Rebound from={target} dir={dir} />
            </>
          )}
          {kind === 'woodwork' && (
            <>
              <circle cx={post.x} cy={post.y} r="1.1" className="ls-post" />
              <Ring at={target} color="#ffd23f" r={2.4} delay={0.95} />
              <Rebound from={target} dir={dir} />
            </>
          )}
          {kind === 'goal' && (
            <>
              <Ring at={target} r={4} delay={0.95} />
              <Ring at={target} color={color} r={7} delay={1.15} />
              <Celebration
                uid={uid}
                color={color}
                side={side}
                homeColor={homeColor}
                awayColor={awayColor}
                who={view.player || teamName}
                minute={view.minute}
                board={goal && { ...goal, homeCode: teamCode(goal.homeCode, goal.homeName), awayCode: teamCode(goal.awayCode, goal.awayName) }}
              />
            </>
          )}
        </>
      );
      break;
    }
    case 'penalty':
    case 'penalty-saved':
    case 'penalty-missed':
      scene = (
        <>
          <rect {...penaltyBox(goalX)} className="ls-box" style={{ fill: color, stroke: color }} />
          <GoalNet goalX={goalX} goal={false} />
          <Ring at={ball} r={2.4} />
          {kind !== 'penalty' && <Trajectory from={ball} to={target} dur={0.6} />}
          {kind === 'penalty-saved' && (
            <>
              <Ring at={target} color={rival} r={2.2} delay={0.75} />
              <Rebound from={target} dir={dir} />
            </>
          )}
          {kind === 'penalty-missed' && <Miss at={target} />}
        </>
      );
      break;
    case 'free-kick': {
      const vx = goalX - ball.x;
      const vy = MID - ball.y;
      const len = Math.hypot(vx, vy) || 1;
      const near = len < 38;
      const wall = { x: ball.x + (vx / len) * 9.15, y: ball.y + (vy / len) * 9.15 };
      const px = -vy / len;
      const py = vx / len;
      const bend = ball.y < MID ? -1 : 1;
      scene = (
        <>
          <circle cx={ball.x} cy={ball.y} r="9.15" className="ls-radius" />
          {near && (
            <>
              <GoalNet goalX={goalX} goal={false} />
              <g className="ls-wall" style={{ fill: rival }}>
                {[-1.5, -0.5, 0.5, 1.5].map((k) => (
                  <circle key={k} cx={wall.x + px * k * 1.25} cy={wall.y + py * k * 1.25} r="0.75" />
                ))}
              </g>
              <Trajectory
                from={ball}
                to={{ x: goalX, y: MID + (ball.y < MID ? 2.6 : -2.6) }}
                ctrl={{ x: wall.x + px * 5 * bend, y: wall.y + py * 5 * bend }}
                dashed
                dur={1}
              />
            </>
          )}
        </>
      );
      break;
    }
    case 'offside':
      scene = (
        <g className="ls-offside">
          <line x1={ball.x} y1="0" x2={ball.x} y2={H} />
          <line x1={ball.x} y1="0" x2={ball.x} y2="-2.6" className="pole" />
          <polygon className="ls-offside-flag to-right" points={`${ball.x},-2.6 ${ball.x + 2.2},-1.9 ${ball.x},-1.2`} />
        </g>
      );
      break;
    case 'throw-in':
      scene = (
        <>
          <Ring at={ball} r={2.4} />
          <Trajectory from={ball} to={target} dashed dur={0.7} />
        </>
      );
      break;
    case 'goal-kick': {
      const ctrl = { x: (ball.x + target.x) / 2, y: Math.min(ball.y, target.y) - 14 };
      scene = (
        <>
          <rect {...goalArea(ownGoalX)} className="ls-box" style={{ fill: color, stroke: color }} />
          <Trajectory from={ball} to={target} ctrl={ctrl} dashed dur={1.1} />
        </>
      );
      break;
    }
    case 'yellow':
    case 'red':
    case 'second-yellow': {
      const cx = ball.x + 2.2;
      const cy = Math.max(-2, ball.y - 7);
      scene = (
        <>
          <Ring at={ball} r={2.4} color={kind === 'yellow' ? '#f4cf3a' : '#e5484d'} />
          {kind === 'second-yellow' && (
            <rect x={cx - 1.4} y={cy + 0.4} width="3" height="4.2" rx="0.4" className="ls-card yellow behind" />
          )}
          <rect x={cx} y={cy} width="3" height="4.2" rx="0.4" className={`ls-card ${kind === 'yellow' ? 'yellow' : 'red'}`} />
        </>
      );
      break;
    }
    case 'sub':
    case 'var':
    case 'injury':
    case 'kickoff':
    case 'added-time':
    case 'stopped':
    case 'resume':
      scene = <Stage kind={kind} title={view.label} who={view.player || teamName} minute={view.minute} />;
      break;
    case 'center':
    default:
      scene = (
        <g>
          <circle cx={W / 2} cy={MID} r="9.15" className="betano-center-circle-glow" />
          <circle cx={W / 2} cy={MID} r="14" className="betano-center-circle-pulse" />
        </g>
      );
  }

  // `key` reinicia las animaciones con cada jugada nueva
  return (
    <g className={`ls-scene ls-${kind}`} key={view.key}>
      {scene}
    </g>
  );
}

// Ícono del rótulo según la escena
const CALLOUT_ICON = {
  goal: 'goal',
  yellow: 'yellow',
  red: 'red',
  'second-yellow': 'second-yellow',
  corner: 'corner',
  offside: 'offside',
  sub: 'sub',
  var: 'var',
  'shot-on': 'shot',
  'shot-off': 'shot',
  woodwork: 'shot',
  'free-kick': 'foul',
  penalty: 'goal',
  'penalty-saved': 'goal',
  'penalty-missed': 'goal',
};

/** Rótulo junto al balón: barra con el color del equipo, ícono, jugada, jugador y minuto. */
export function LiveCallout({ view, color, teamName }) {
  if (!view) return null;
  const { ball } = view;
  const who = view.player || teamName || '';
  const icon = CALLOUT_ICON[view.kind] || null;
  const iconW = icon ? 5.4 : 0;
  // Ancho aproximado del texto (unidades de la cancha) para ponerlo del lado donde entra
  const textW = Math.max(view.label.length * 2.5, (who.length + (view.minute?.length || 0) + 2) * 1.8) + 2 + iconW;
  const roomRight = W - (ball.x + 4.8);
  const roomLeft = ball.x - 4.8;
  const flip = roomRight < textW && roomLeft > roomRight;
  const x = ball.x + (flip ? -4.8 : 4.8);
  const y = clamp(ball.y, 7.5, H - 10);
  const tx = flip ? -2 - iconW : 2 + iconW;
  const anchor = flip ? 'end' : 'start';
  const iconX = flip ? -2 - 4.4 : 2;
  return (
    <g className={`ls-callout ${view.kind === 'goal' ? 'is-goal' : ''}`} transform={`translate(${x} ${y})`} key={view.key}>
      <line x1="0" y1="-5.4" x2="0" y2="4.4" style={{ stroke: color }} />
      {icon && (
        <g transform={`translate(${iconX} -5)`} className="ls-co-icon">
          <PlayIcon kind={icon} size={4.4} />
        </g>
      )}
      <text x={tx} y="-1.1" textAnchor={anchor} className="ls-co-title">{view.label}</text>
      <text x={tx} y="3.4" textAnchor={anchor} className="ls-co-name">
        {who}
        {view.minute && <tspan className="ls-co-min">{`  ${view.minute}`}</tspan>}
      </text>
    </g>
  );
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

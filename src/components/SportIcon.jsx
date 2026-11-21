import React, { useId } from 'react';

// Íconos propios de partido: tarjetas, córner, gol, cambio, VAR y fuera de juego.
// Planos y sin trazos finos para que se lean de 12 a 16 px sobre fondo oscuro.

const YELLOW = '#f4cf3a';
const RED = '#e5484d';
const FLAG = '#c9d3e6';
const INK = '#10141b';

function Svg({ size, className, label, children }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={`si ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const YellowCard = ({ size = 14, className = '', label }) => (
  <Svg size={size} className={className} label={label}>
    <rect x="3.5" y="1.5" width="9" height="13" rx="1.6" fill={YELLOW} />
  </Svg>
);

export const RedCard = ({ size = 14, className = '', label }) => (
  <Svg size={size} className={className} label={label}>
    <rect x="3.5" y="1.5" width="9" height="13" rx="1.6" fill={RED} />
  </Svg>
);

/** Doble amarilla: la amarilla atrás y la roja adelante. */
export const SecondYellow = ({ size = 14, className = '', label }) => (
  <Svg size={size} className={className} label={label}>
    <rect x="1.6" y="1.8" width="8" height="11.6" rx="1.4" fill={YELLOW} transform="rotate(-9 5.6 7.6)" />
    <rect x="6.4" y="2.6" width="8" height="11.6" rx="1.4" fill={RED} stroke={INK} strokeOpacity="0.35" strokeWidth="0.6" transform="rotate(7 10.4 8.4)" />
  </Svg>
);

/** Banderín de córner: mástil con base y bandera ondeando. */
export const CornerFlag = ({ size = 14, className = '', label, color = FLAG }) => (
  <Svg size={size} className={className} label={label}>
    <rect x="3.2" y="1.6" width="1.6" height="12.6" rx="0.6" fill={color} />
    <rect x="1.8" y="13.2" width="5.2" height="1.6" rx="0.7" fill={color} />
    <path d="M4.8 2.2C7.2 1.2 9.6 3.4 13.2 2.2V8.4C9.6 9.6 7.2 7.4 4.8 8.4Z" fill={color} />
  </Svg>
);

/** Bandera del asistente: mitades roja y amarilla. */
export const OffsideFlag = ({ size = 14, className = '', label }) => (
  <Svg size={size} className={className} label={label}>
    <rect x="3.2" y="1.6" width="1.6" height="12.8" rx="0.6" fill={FLAG} />
    <path d="M4.8 2H13.4L4.8 8.6Z" fill={YELLOW} />
    <path d="M13.4 2V8.6H4.8Z" fill={RED} />
  </Svg>
);

// Pelota: pentágono central, costuras y cinco parches recortados por el borde.
const C = 8;
const R = 7;
const at = (r, deg) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];
const pts = (list) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
const ANGLES = [0, 1, 2, 3, 4].map((k) => -90 + 72 * k);
const CENTER = pts(ANGLES.map((a) => at(2.5, a)));
const SEAMS = ANGLES.map((a) => [at(2.5, a), at(4.7, a)]);
const PATCHES = ANGLES.map((a) => {
  const [cx, cy] = at(6.95, a);
  return pts([0, 1, 2, 3, 4].map((j) => {
    const t = ((a + 180 + 72 * j) * Math.PI) / 180;
    return [cx + 2.3 * Math.cos(t), cy + 2.3 * Math.sin(t)];
  }));
});

export function Ball({ size = 14, className = '', label }) {
  const clip = `si-ball-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <Svg size={size} className={className} label={label}>
      <defs>
        <clipPath id={clip}>
          <circle cx={C} cy={C} r={R} />
        </clipPath>
      </defs>
      <circle cx={C} cy={C} r={R} fill="#f4f6fa" />
      <g clipPath={`url(#${clip})`} fill={INK}>
        {PATCHES.map((p) => <polygon key={p} points={p} />)}
      </g>
      <polygon points={CENTER} fill={INK} />
      <g stroke={INK} strokeWidth="0.8" strokeLinecap="round">
        {SEAMS.map(([a, b]) => <line key={a.join()} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />)}
      </g>
      <circle cx={C} cy={C} r={R - 0.4} fill="none" stroke={INK} strokeWidth="0.8" />
    </Svg>
  );
}

/** Cambio: entra (verde, arriba) y sale (rojo, abajo). */
export const Substitution = ({ size = 14, className = '', label }) => (
  <Svg size={size} className={className} label={label}>
    <path d="M5 1.6L8.4 5.4H6.2V14.2H3.8V5.4H1.6Z" fill="#2fbf71" />
    <path d="M11 14.4L7.6 10.6H9.8V1.8H12.2V10.6H14.4Z" fill={RED} />
  </Svg>
);

export const VarIcon = ({ size = 14, className = '', label }) => (
  <Svg size={size} className={className} label={label}>
    <rect x="0.9" y="3.2" width="14.2" height="9.6" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <text x="8" y="10.1" textAnchor="middle" fontSize="5.4" fontWeight="800" fill="currentColor" fontFamily="inherit">VAR</text>
  </Svg>
);

/** Tiro: arco con red y pelota entrando. */
export const ShotIcon = ({ size = 14, className = '', label }) => (
  <Svg size={size} className={className} label={label}>
    <g stroke={FLAG} strokeOpacity="0.4" strokeWidth="0.6">
      <line x1="5.5" y1="4" x2="5.5" y2="13.6" />
      <line x1="10.5" y1="4" x2="10.5" y2="13.6" />
      <line x1="2" y1="7.4" x2="14" y2="7.4" />
      <line x1="2" y1="10.6" x2="14" y2="10.6" />
    </g>
    <path d="M1.6 14V3.4H14.4V14" fill="none" stroke={FLAG} strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="10.4" cy="11.6" r="2.1" fill="#f4f6fa" stroke={INK} strokeWidth="0.6" />
  </Svg>
);

/** Falta: silbato. */
export const WhistleIcon = ({ size = 14, className = '', label }) => (
  <Svg size={size} className={className} label={label}>
    <circle cx="3.3" cy="4.1" r="1.3" fill="none" stroke={FLAG} strokeWidth="0.9" />
    <rect x="6.2" y="5.2" width="9" height="3.4" rx="0.9" fill={FLAG} />
    <circle cx="6.4" cy="9.6" r="4.4" fill={FLAG} />
    <circle cx="6.4" cy="9.6" r="1.5" fill={INK} />
  </Svg>
);

/** Ícono por tipo de jugada; `null` si no hay uno propio para ese tipo. */
export function PlayIcon({ kind, size = 14, className = '' }) {
  switch (kind) {
    case 'goal': return <Ball size={size} className={className} />;
    case 'yellow': return <YellowCard size={size} className={className} />;
    case 'red': return <RedCard size={size} className={className} />;
    case 'second-yellow': return <SecondYellow size={size} className={className} />;
    case 'corner': return <CornerFlag size={size} className={className} />;
    case 'offside': return <OffsideFlag size={size} className={className} />;
    case 'sub': return <Substitution size={size} className={className} />;
    case 'var': return <VarIcon size={size} className={className} />;
    case 'shot': return <ShotIcon size={size} className={className} />;
    case 'foul': return <WhistleIcon size={size} className={className} />;
    default: return null;
  }
}

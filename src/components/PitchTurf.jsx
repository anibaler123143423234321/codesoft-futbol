import React, { useId } from 'react';

/**
 * Césped de noche compartido por las canchas: franjas de corte, líneas finas
 * y la luz de los focos cayendo desde arriba. Va dentro de un <svg> con las
 * medidas de la cancha (105 x 68) y se dibuja debajo de los jugadores.
 */
export default function PitchTurf({ w = 105, h = 68, pad = 2 }) {
  const id = useId().replace(/:/g, '');
  return (
    <g className="turf" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-flood`} cx="50%" cy="-15%" r="105%">
          <stop offset="0" stopColor="#fff7e6" stopOpacity="0.16" />
          <stop offset="0.55" stopColor="#fff7e6" stopOpacity="0.03" />
          <stop offset="1" stopColor="#000" stopOpacity="0.32" />
        </radialGradient>
      </defs>
      <rect x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} className="turf-a" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={i * (w / 10)} y="0" width={w / 10} height={h} className={i % 2 ? 'turf-b' : 'turf-a'} />
      ))}
      <g className="turf-lines">
        <rect x="0" y="0" width={w} height={h} />
        <line x1={w / 2} y1="0" x2={w / 2} y2={h} />
        <circle cx={w / 2} cy={h / 2} r="9.15" />
        <rect x="0" y="13.84" width="16.5" height="40.32" />
        <rect x="0" y="24.84" width="5.5" height="18.32" />
        <rect x={w - 16.5} y="13.84" width="16.5" height="40.32" />
        <rect x={w - 5.5} y="24.84" width="5.5" height="18.32" />
        <path d="M16.5 26.7 A9.15 9.15 0 0 1 16.5 41.3" />
        <path d={`M${w - 16.5} 26.7 A9.15 9.15 0 0 0 ${w - 16.5} 41.3`} />
        <rect x="-1.8" y="30.34" width="1.8" height="7.32" />
        <rect x={w} y="30.34" width="1.8" height="7.32" />
      </g>
      <g className="turf-spots">
        <circle cx={w / 2} cy={h / 2} r="0.45" />
        <circle cx="11" cy={h / 2} r="0.45" />
        <circle cx={w - 11} cy={h / 2} r="0.45" />
      </g>
      <rect x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} fill={`url(#${id}-flood)`} />
    </g>
  );
}

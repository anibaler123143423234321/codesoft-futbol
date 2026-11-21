import { scoreMatrix } from '../api/predictionModel';

// Tablero de mercados del panel de cuotas. Las cuotas publicadas en vivo se muestran tal cual;
// el resto se estima con un modelo de Poisson ajustado a esas mismas cuotas (goles que faltan
// según la línea de goles y reparto entre equipos según el 1X2) y se marcan como estimadas.

const PRIOR = { goals: 2.7, corners: 10, cards: 4.4 }; // promedios por 90 minutos
const MIN_P = 0.006;
const MAX_P = 0.994;

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function pmf(lambda, max = 30) {
  const out = [Math.exp(-lambda)];
  for (let k = 1; k <= max; k++) out[k] = (out[k - 1] * lambda) / k;
  return out;
}

/** P(N >= k) con N ~ Poisson(lambda). */
function atLeast(k, lambda) {
  if (k <= 0) return 1;
  const p = pmf(lambda, Math.max(k, 30));
  let below = 0;
  for (let i = 0; i < k; i++) below += p[i];
  return Math.max(0, 1 - below);
}

/** Lambda tal que P(N >= k) = target (búsqueda binaria; la función crece con lambda). */
function solveLambda(target, k) {
  let lo = 0.0005;
  let hi = 14;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (atLeast(k, mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Probabilidad de que el total final supere `line`, con `now` ya ocurridos y lambda por ocurrir. */
const overLine = (line, now, lambda) => atLeast(Math.floor(line - now) + 1, lambda);

/** Saca el margen de un par de cuotas y devuelve la probabilidad del primero. */
function fairPair(a, b) {
  if (!a || !b) return null;
  const ia = 1 / a;
  const ib = 1 / b;
  return ia / (ia + ib);
}

/** Matriz de goles que faltan y resultado final desde el marcador actual. */
function outcome(lh, la, h, a) {
  const m = scoreMatrix(Math.max(lh, 0.0005), Math.max(la, 0.0005));
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let i = 0; i < m.length; i++) {
    for (let j = 0; j < m[i].length; j++) {
      const d = h + i - (a + j);
      if (d > 0) home += m[i][j];
      else if (d < 0) away += m[i][j];
      else draw += m[i][j];
    }
  }
  return { m, home, draw, away };
}

/** Reparto del total de goles entre local y visita que reproduce la diferencia local − visita del 1X2. */
function fitShare(total, h, a, target) {
  let lo = 0.02;
  let hi = 0.98;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const o = outcome(total * mid, total * (1 - mid), h, a);
    if (o.home - o.away < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function minutesLeft(clock) {
  const minute = (num(clock?.seconds) ?? 0) / 60;
  if (minute < 90) return { minute, left: Math.max(2, 93 - minute) };
  return { minute, left: Math.max(1, 90 + (num(clock?.injuryTime) ?? 4) - minute) };
}

const round2 = (v) => Math.round(v * 100) / 100;

/** Cuota con margen a partir de una probabilidad; null si el resultado ya está prácticamente decidido. */
function priceOf(p, margin) {
  if (p == null || p < MIN_P || p > MAX_P) return null;
  return Math.max(1.01, round2(1 / (p * (1 + margin))));
}

const sel = (label, p, margin, extra = {}) => ({ label, p, price: priceOf(p, margin), ...extra });

/** Líneas .5 por encima de lo ya ocurrido, centradas en `center`. */
function linesAround(now, center, count) {
  const first = Math.floor(now) + 0.5;
  const start = Math.max(first, Math.floor(center) + 0.5 - Math.floor(count / 2));
  return Array.from({ length: count }, (_, i) => start + i);
}

function overUnderMarket({ id, title, now, lambda, lines, margin, real, estimated = true, visible = 3 }) {
  const rows = lines.map((line) => {
    if (real && real.line === line) {
      return [
        { label: `Más de ${line}`, price: real.over, p: null },
        { label: `Menos ${line}`, price: real.under, p: null },
      ];
    }
    const p = overLine(line, now, lambda);
    return [sel(`Más de ${line}`, p, margin, { estimated: true }), sel(`Menos ${line}`, 1 - p, margin, { estimated: true })];
  }).filter((row) => row.some((s) => s.price != null));
  if (!rows.length) return null;
  const allEstimated = !real || !lines.includes(real.line);
  return { id, title, layout: 'pairs', rows, visible, estimated: estimated && allEstimated, mixed: Boolean(real) && !allEstimated };
}

const realMarket = (m, title) => ({
  id: `r-${m.type || m.id}`,
  title: title || m.name,
  layout: m.selections.length === 2 ? 'pairs' : 'row',
  rows: [m.selections.map((s) => ({ label: s.name, price: s.price, p: null }))],
  estimated: false,
});

/**
 * @param data  useLiveOdds().data (parseBetanoSnapshot)
 * @param names { home, away } nombres cortos
 * @returns {{ tabs: Array<{ id, label, markets }> } | null}
 */
export function buildMarketBoard(data, names) {
  if (!data) return null;
  const markets = data.markets || [];
  const byType = (t) => markets.find((m) => m.type === t && m.selections?.length);
  const has = (re) => markets.some((m) => re.test(m.name || ''));
  const h = num(data.home?.score) ?? 0;
  const a = num(data.away?.score) ?? 0;
  const goalsNow = h + a;
  const { minute, left } = minutesLeft(data.clock);
  const margin = Math.max(0.03, (num(data.impliedProbabilities?.bookMargin) ?? 6) / 100);

  // --- Goles que faltan: de la línea publicada de goles, si no hay, del promedio
  const mres = byType('MRES');
  const goals = byType('HCTG');
  const goalLine = goals ? num(goals.line) : null;
  const over = goals?.selections.find((s) => /^Más/i.test(s.name))?.price;
  const under = goals?.selections.find((s) => /^Menos/i.test(s.name))?.price;
  const pOver = fairPair(over, under);
  const k = goalLine != null ? Math.floor(goalLine - goalsNow) + 1 : 0;
  const totalLambda = pOver != null && k >= 1 && pOver > 0.01 && pOver < 0.99
    ? solveLambda(pOver, k)
    : (PRIOR.goals * left) / 90;

  // --- Reparto entre equipos con el 1X2 (sin margen)
  const ip = data.impliedProbabilities;
  const share = ip ? fitShare(totalLambda, h, a, (ip.home - ip.away) / 100) : 0.5;
  const lh = totalLambda * share;
  const la = totalLambda * (1 - share);
  const final = outcome(lh, la, h, a);
  const pr = ip ? { home: ip.home / 100, draw: ip.draw / 100, away: ip.away / 100 } : { home: final.home, draw: final.draw, away: final.away };

  const result = mres
    ? realMarket(mres, 'Resultado del partido')
    : {
      id: 'e-1x2',
      title: 'Resultado del partido',
      layout: 'row',
      estimated: true,
      rows: [[sel('1', pr.home, margin), sel('X', pr.draw, margin), sel('2', pr.away, margin)]],
    };

  const center = goalLine ?? goalsNow + totalLambda;
  const goalsMain = overUnderMarket({
    id: 'goals',
    title: 'Goles totales Más/Menos',
    now: goalsNow,
    lambda: totalLambda,
    lines: linesAround(goalsNow, center, 3),
    margin,
    real: goalLine != null ? { line: goalLine, over, under } : null,
    visible: 3,
  });
  const goalsAll = overUnderMarket({
    id: 'goals-all',
    title: 'Goles totales Más/Menos',
    now: goalsNow,
    lambda: totalLambda,
    lines: linesAround(goalsNow, goalsNow + 2, 5),
    margin,
    real: goalLine != null ? { line: goalLine, over, under } : null,
    visible: 5,
  });

  const nextReal = byType('INTS');
  const pNone = Math.exp(-totalLambda);
  const next = nextReal
    ? realMarket(nextReal)
    : {
      id: 'e-next',
      title: `Próximo gol (Gol ${goalsNow + 1})`,
      layout: 'row',
      estimated: true,
      rows: [[
        sel(names.home, (1 - pNone) * share, margin),
        sel('Sin goles', pNone, margin),
        sel(names.away, (1 - pNone) * (1 - share), margin),
      ]],
    };

  const scoredH = h > 0 ? 1 : 1 - Math.exp(-lh);
  const scoredA = a > 0 ? 1 : 1 - Math.exp(-la);
  const pBtts = scoredH * scoredA;
  const btts = !has(/ambos equipos/i) && pBtts < MAX_P
    ? { id: 'e-btts', title: 'Ambos equipos marcan', layout: 'pairs', estimated: true, rows: [[sel('Sí', pBtts, margin), sel('No', 1 - pBtts, margin)]] }
    : null;

  const double = !has(/doble oportunidad/i)
    ? {
      id: 'e-dc',
      title: 'Doble oportunidad',
      layout: 'row',
      estimated: true,
      rows: [[sel('1X', pr.home + pr.draw, margin), sel('12', pr.home + pr.away, margin), sel('X2', pr.draw + pr.away, margin)]],
    }
    : null;

  const noDraw = pr.home + pr.away;
  const dnb = !has(/empate no v[aá]lido|apuesta sin empate/i) && noDraw > 0.02
    ? {
      id: 'e-dnb',
      title: 'Empate no válido',
      layout: 'pairs',
      estimated: true,
      rows: [[sel(names.home, pr.home / noDraw, margin), sel(names.away, pr.away / noDraw, margin)]],
    }
    : null;

  // Marcador final: los más probables desde el marcador actual
  const scores = [];
  final.m.forEach((row, i) => row.forEach((p, j) => scores.push({ label: `${h + i}-${a + j}`, p })));
  scores.sort((x, y) => y.p - x.p);
  const exact = {
    id: 'e-score',
    title: 'Marcador final',
    layout: 'grid',
    estimated: true,
    visible: 6,
    rows: [scores.slice(0, 9).map((s) => sel(s.label, s.p, margin * 2))],
  };

  const teamGoals = (side, now, lambda) => overUnderMarket({
    id: `team-${side}`,
    title: `Goles de ${names[side]}`,
    now,
    lambda,
    lines: linesAround(now, now + 1, 3),
    margin,
    visible: 3,
  });

  // --- Córners: ritmo del partido mezclado con el promedio (pesa como 45 minutos jugados)
  const ch = num(data.home?.stats?.corners);
  const ca = num(data.away?.stats?.corners);
  let corners = null;
  if (ch != null && ca != null && !has(/c[oó]rner/i)) {
    const cNow = ch + ca;
    const rate = (cNow + PRIOR.corners * 0.5) / (minute + 45);
    const cl = rate * left;
    corners = overUnderMarket({
      id: 'corners',
      title: 'Córners totales Más/Menos',
      now: cNow,
      lambda: cl,
      lines: linesAround(cNow, cNow + cl, 5),
      margin,
      visible: 3,
    });
  }

  // --- Tarjetas: de la línea publicada; las líneas vecinas, estimadas
  const cardsReal = byType('TCOU');
  const kNow = (num(data.home?.stats?.yellowCards) ?? 0) + (num(data.away?.stats?.yellowCards) ?? 0)
    + (num(data.home?.stats?.redCards) ?? 0) + (num(data.away?.stats?.redCards) ?? 0);
  const cardLine = cardsReal ? num(cardsReal.line) : null;
  const pCardsOver = cardsReal ? fairPair(cardsReal.selections[0]?.price, cardsReal.selections[1]?.price) : null;
  const kc = cardLine != null ? Math.floor(cardLine - kNow) + 1 : 0;
  const cardLambda = pCardsOver != null && kc >= 1 && pCardsOver > 0.01 && pCardsOver < 0.99
    ? solveLambda(pCardsOver, kc)
    : (PRIOR.cards * left) / 90;
  const cards = overUnderMarket({
    id: 'cards',
    title: 'Tarjetas totales Más/Menos',
    now: kNow,
    lambda: cardLambda,
    lines: linesAround(kNow, cardLine ?? kNow + cardLambda, 3),
    margin,
    real: cardsReal ? { line: cardLine, over: cardsReal.selections[0]?.price, under: cardsReal.selections[1]?.price } : null,
    visible: 3,
  });

  // Mercados publicados que el tablero no conoce: se muestran como vienen
  const known = new Set(['MRES', 'HCTG', 'INTS', 'TCOU']);
  const others = markets.filter((m) => !known.has(m.type) && m.selections?.length).map((m) => realMarket(m));

  const tabs = [
    { id: 'popular', label: 'Populares', markets: [result, goalsMain, next, btts, ...others] },
    { id: 'goals', label: 'Goles', markets: [goalsAll, btts, teamGoals('home', h, lh), teamGoals('away', a, la), next] },
    { id: 'result', label: 'Resultado', markets: [result, double, dnb, exact] },
    { id: 'corners', label: 'Córners', markets: [corners] },
    { id: 'cards', label: 'Tarjetas', markets: [cards] },
  ]
    .map((t) => ({ ...t, markets: t.markets.filter(Boolean) }))
    .filter((t) => t.markets.length);

  return { tabs, model: { lh, la, minute: Math.round(minute) } };
}

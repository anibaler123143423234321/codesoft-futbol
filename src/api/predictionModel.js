// Modelo de pronóstico de partidos de fútbol.
//
// 1. Cuotas 1X2 y over/under del proveedor → probabilidades sin margen (método de Shin).
// 2. Esas probabilidades se ajustan con un modelo de Poisson con corrección de Dixon-Coles para
//    obtener los goles esperados de cada equipo (λ local, λ visita).
// 3. Con la matriz de marcadores se calcula cualquier mercado (1X2, totales, ambos marcan, hándicap…).
// 4. En vivo, los goles que faltan se escalan por el tiempo restante y se suman al marcador actual.
//
// Sin cuotas, los goles esperados salen de los últimos partidos de cada equipo (ESPN), encogidos
// hacia un valor de referencia. Todo supuesto queda listado en `assumptions` para mostrarlo.

const MAX_GOALS = 10;
// Parámetro de dependencia de Dixon-Coles para marcadores bajos (negativo: más 0-0 y 1-1)
const DC_RHO = -0.1;
// Duración efectiva de un partido con descuento típico
const MATCH_MINUTES = 95;
// Referencia sin datos: goles esperados del local y la visita (supuesto del modelo)
const PRIOR_HOME = 1.45;
const PRIOR_AWAY = 1.15;
// Peso de la referencia frente a los partidos recientes (en "partidos equivalentes")
const PRIOR_WEIGHT = 5;
const HOME_BOOST = 1.1;

// ---------------------------------------------------------------- Bibliografía y fuentes

export const REFERENCES = {
  shin: {
    authors: 'Shin, H. S.',
    year: 1993,
    title: 'Measuring the incidence of insider trading in a market for state-contingent claims',
    journal: 'The Economic Journal',
    volume: '103', issue: '420', pages: '1141–1153',
    doi: '10.2307/2234240',
    use: 'Quita el margen de la casa de las cuotas para obtener probabilidades.',
  },
  strumbelj: {
    authors: 'Štrumbelj, E.',
    year: 2014,
    title: 'On determining probability forecasts from betting odds',
    journal: 'International Journal of Forecasting',
    volume: '30', issue: '4', pages: '934–943',
    doi: '10.1016/j.ijforecast.2014.02.008',
    use: 'Compara métodos para pasar de cuotas a probabilidades; el de Shin sale mejor calibrado que la normalización simple.',
  },
  maher: {
    authors: 'Maher, M. J.',
    year: 1982,
    title: 'Modelling association football scores',
    journal: 'Statistica Neerlandica',
    volume: '36', issue: '3', pages: '109–118',
    doi: '10.1111/j.1467-9574.1982.tb00782.x',
    use: 'Modela los goles de cada equipo como procesos de Poisson.',
  },
  dixonColes: {
    authors: 'Dixon, M. J., & Coles, S. G.',
    year: 1997,
    title: 'Modelling association football scores and inefficiencies in the football betting market',
    journal: 'Journal of the Royal Statistical Society: Series C (Applied Statistics)',
    volume: '46', issue: '2', pages: '265–280',
    doi: '10.1111/1467-9876.00065',
    use: 'Corrige la probabilidad de los marcadores bajos (0-0, 1-0, 0-1, 1-1).',
  },
  greenwoodYule: {
    authors: 'Greenwood, M., & Yule, G. U.',
    year: 1920,
    title: 'An inquiry into the nature of frequency distributions representative of multiple happenings with particular reference to the occurrence of multiple attacks of disease or of repeated accidents',
    journal: 'Journal of the Royal Statistical Society',
    volume: '83', issue: '2', pages: '255–279',
    doi: '10.2307/2341080',
    use: 'Distribución binomial negativa: conteos más dispersos que Poisson, como córners y tarjetas.',
  },
  dixonRobinson: {
    authors: 'Dixon, M. J., & Robinson, M. E.',
    year: 1998,
    title: 'A birth process model for association football matches',
    journal: 'Journal of the Royal Statistical Society: Series D (The Statistician)',
    volume: '47', issue: '3', pages: '523–538',
    doi: '10.1111/1467-9884.00152',
    use: 'Modela los goles a lo largo del partido; base para recalcular en vivo con el tiempo restante.',
  },
};

export function formatApa(ref) {
  const issue = ref.issue ? `(${ref.issue})` : '';
  return `${ref.authors} (${ref.year}). ${ref.title}. ${ref.journal}, ${ref.volume}${issue}, ${ref.pages}.`;
}

// ---------------------------------------------------------------- Utilidades numéricas

function poissonPmf(lambda, max = MAX_GOALS) {
  const out = new Array(max + 1);
  out[0] = Math.exp(-lambda);
  for (let k = 1; k <= max; k++) out[k] = (out[k - 1] * lambda) / k;
  return out;
}

function dcTau(i, j, lh, la, rho) {
  if (i === 0 && j === 0) return 1 - lh * la * rho;
  if (i === 0 && j === 1) return 1 + lh * rho;
  if (i === 1 && j === 0) return 1 + la * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

/** Matriz de probabilidades de marcador m[i][j] (local i, visita j), normalizada. */
export function scoreMatrix(lh, la, rho = DC_RHO) {
  const ph = poissonPmf(lh);
  const pa = poissonPmf(la);
  const m = [];
  let sum = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    m[i] = [];
    for (let j = 0; j <= MAX_GOALS; j++) {
      const v = Math.max(0, ph[i] * pa[j] * dcTau(i, j, lh, la, rho));
      m[i][j] = v;
      sum += v;
    }
  }
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) m[i][j] /= sum;
  return m;
}

function sumWhere(m, fn) {
  let s = 0;
  for (let i = 0; i < m.length; i++) for (let j = 0; j < m[i].length; j++) if (fn(i, j)) s += m[i][j];
  return s;
}

// Probabilidad de "más de `line`" goles con la matriz; en líneas enteras se excluye el empate de línea
function overProb(m, line) {
  if (Number.isInteger(line)) {
    const over = sumWhere(m, (i, j) => i + j > line);
    const push = sumWhere(m, (i, j) => i + j === line);
    return push < 1 ? over / (1 - push) : 0;
  }
  if (Math.abs((line * 4) % 2) === 1) {
    // Línea de cuarto (2.25, 2.75): mitad en cada línea vecina
    return (overProb(m, line - 0.25) + overProb(m, line + 0.25)) / 2;
  }
  return sumWhere(m, (i, j) => i + j > line);
}

/**
 * Método de Shin (1993): probabilidades sin margen a partir de cuotas decimales.
 * Devuelve { probs, z, margin } donde z es la proporción estimada de dinero "informado".
 */
export function shinProbabilities(odds) {
  const pi = odds.map(o => 1 / o);
  const B = pi.reduce((a, b) => a + b, 0);
  if (!(B > 1)) return { probs: pi.map(p => p / B), z: 0, margin: B - 1 };
  const probsAt = (z) => pi.map(p => (Math.sqrt(z * z + (4 * (1 - z) * p * p) / B) - z) / (2 * (1 - z)));
  let lo = 0;
  let hi = 0.5;
  for (let it = 0; it < 80; it++) {
    const mid = (lo + hi) / 2;
    const s = probsAt(mid).reduce((a, b) => a + b, 0);
    if (s > 1) lo = mid; else hi = mid;
  }
  const z = (lo + hi) / 2;
  const probs = probsAt(z);
  const s = probs.reduce((a, b) => a + b, 0);
  return { probs: probs.map(p => p / s), z, margin: B - 1 };
}

// Ajusta λ local y λ visita para reproducir las probabilidades del mercado (mínimos cuadrados)
// En vivo (`sh`, `sa` = marcador actual) ajusta los goles que FALTAN para que el resultado final
// reproduzca las probabilidades del mercado en vivo.
function fitLambdas(target) {
  const sh = target.sh || 0;
  const sa = target.sa || 0;
  const evaluate = (lh, la) => {
    const m = scoreMatrix(lh, la);
    const p1 = sumWhere(m, (i, j) => i + sh > j + sa);
    const px = sumWhere(m, (i, j) => i + sh === j + sa);
    const p2 = 1 - p1 - px;
    let err = (p1 - target.p1) ** 2 + (px - target.px) ** 2 + (p2 - target.p2) ** 2;
    if (target.pOver != null) err += target.overWeight * (overProb(m, target.line - sh - sa) - target.pOver) ** 2;
    return err;
  };
  // Búsqueda en rejilla gruesa y luego fina alrededor del mejor punto
  const [lo, hi, coarse, floor] = target.live ? [0.02, 3, 0.04, 0.005] : [0.1, 4.5, 0.1, 0.05];
  let best = { lh: PRIOR_HOME, la: PRIOR_AWAY, err: Infinity };
  for (let lh = lo; lh <= hi; lh += coarse) {
    for (let la = lo; la <= hi; la += coarse) {
      const err = evaluate(lh, la);
      if (err < best.err) best = { lh, la, err };
    }
  }
  for (const step of [0.02, 0.005]) {
    const c = { ...best };
    for (let lh = Math.max(floor, c.lh - 5 * step * 5); lh <= c.lh + 5 * step * 5; lh += step) {
      for (let la = Math.max(floor, c.la - 5 * step * 5); la <= c.la + 5 * step * 5; la += step) {
        const err = evaluate(lh, la);
        if (err < best.err) best = { lh, la, err };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------- Datos del partido

export function parseMinute(minute) {
  if (minute == null) return 0;
  const s = String(minute);
  if (/^HT|ET|desc/i.test(s)) return 45;
  const parts = s.match(/\d+/g);
  if (!parts) return 0;
  return parts.slice(0, 2).reduce((a, b) => a + Number(b), 0);
}

function summarizeForm(games = []) {
  const valid = games.filter(g => Number.isFinite(g.goalsFor) && Number.isFinite(g.goalsAgainst));
  const points = games.reduce((a, g) => a + (g.result === 'W' ? 3 : g.result === 'D' ? 1 : 0), 0);
  return {
    n: valid.length,
    played: games.length,
    gf: valid.length ? valid.reduce((a, g) => a + g.goalsFor, 0) / valid.length : null,
    ga: valid.length ? valid.reduce((a, g) => a + g.goalsAgainst, 0) / valid.length : null,
    ppg: games.length ? points / games.length : null,
    string: games.map(g => g.result).join(''),
  };
}

// ---------------------------------------------------------------- Modelo principal

/**
 * Calcula el pronóstico completo del partido.
 * @returns objeto con λ, matriz final, mercados, pronósticos destacados, fuentes y supuestos.
 */
export function buildPrediction(match) {
  if (!match) return null;
  // Cuotas en vivo de la extensión (utils/liveMarket.js): mandan sobre las previas mientras el partido sigue
  const lm = match.liveMarket?.matchResult ? match.liveMarket : null;
  const odds = match.oddsInfo;
  const hasOdds = !!odds?.hasMoneyline;
  const hasTotalOdds = hasOdds && odds.totalLine != null && odds.overOdds > 1 && odds.underOdds > 1;
  const homeForm = summarizeForm(match.homeTeam?.recentGames);
  const awayForm = summarizeForm(match.awayTeam?.recentGames);
  const hasForm = homeForm.n >= 3 && awayForm.n >= 3;
  const assumptions = [];
  const methods = new Set(['maher', 'dixonColes']);

  let lh;
  let la;
  let market = null;
  let fitError = null;

  // En vivo: lo que falta del partido más el marcador actual (la fuente en vivo manda si está)
  const isLive = Boolean(lm) || match.status === 'live';
  const isFinished = !lm && match.status === 'finished';
  const minute = lm?.minute != null ? Math.min(lm.minute, MATCH_MINUTES) : isLive ? Math.min(parseMinute(match.minute), MATCH_MINUTES) : 0;
  const remaining = isFinished ? 0 : isLive ? Math.max(0, (MATCH_MINUTES - minute) / MATCH_MINUTES) : 1;
  const sh = lm ? lm.score.home : isLive || isFinished ? Number(match.homeTeam?.score || 0) : 0;
  const sa = lm ? lm.score.away : isLive || isFinished ? Number(match.awayTeam?.score || 0) : 0;
  // Goles que faltan; con mercado en vivo salen directo del ajuste a sus cuotas
  let remLh = null;
  let remLa = null;

  if (lm) {
    methods.add('shin').add('strumbelj').add('dixonRobinson');
    const mr = lm.matchResult;
    const oneXTwo = shinProbabilities([mr.home, mr.draw, mr.away]);
    const [p1, px, p2] = oneXTwo.probs;
    market = { p1, px, p2, z: oneXTwo.z, margin: oneXTwo.margin, live: true };
    let pOver = null;
    if (lm.totalGoals) {
      const tot = shinProbabilities([lm.totalGoals.over, lm.totalGoals.under]);
      pOver = tot.probs[0];
      market.pOver = pOver;
      market.totalMargin = tot.margin;
    }
    const fit = fitLambdas({ p1, px, p2, pOver, line: lm.totalGoals?.line, overWeight: 1, sh, sa, live: true });
    remLh = fit.lh;
    remLa = fit.la;
    lh = remaining > 0.02 ? remLh / remaining : remLh;
    la = remaining > 0.02 ? remLa / remaining : remLa;
    fitError = Math.sqrt(fit.err / (3 + (pOver != null ? 1 : 0)));
    assumptions.push(`Cuotas EN VIVO de la casa (minuto ${Math.round(minute)}, ${sh}-${sa}): sin margen con Shin, y los goles que faltan se ajustan para reproducirlas (${remLh.toFixed(2)} local, ${remLa.toFixed(2)} visita).`);
    if (lm.trend) {
      const t = lm.trend;
      assumptions.push(`El 1X2 en vivo se movió entre el minuto ${Math.round(t.fromMinute)} y el ${Math.round(t.toMinute)}: local ${t.from.home}→${t.to.home}, empate ${t.from.draw}→${t.to.draw}, visita ${t.from.away}→${t.to.away}.`);
    }
  } else if (hasOdds) {
    methods.add('shin').add('strumbelj');
    const oneXTwo = shinProbabilities([odds.homeOdds, odds.drawOdds, odds.awayOdds]);
    const [p1, px, p2] = oneXTwo.probs;
    market = { p1, px, p2, z: oneXTwo.z, margin: oneXTwo.margin };
    let pOver = null;
    let overWeight = 0;
    if (hasTotalOdds) {
      const tot = shinProbabilities([odds.overOdds, odds.underOdds]);
      pOver = tot.probs[0];
      overWeight = 1;
      market.pOver = pOver;
      market.totalMargin = tot.margin;
    } else if (odds.totalLine != null) {
      // Solo la línea, sin precio: se asume que el proveedor la fijó donde over y under se equilibran
      pOver = 0.5;
      overWeight = 0.25;
      assumptions.push(`Sin precio para la línea de ${odds.totalLine} goles: se trata como 50/50 con peso reducido.`);
    } else {
      assumptions.push('Sin línea de goles del proveedor: el total sale solo de las cuotas 1X2.');
    }
    const fit = fitLambdas({ p1, px, p2, pOver, line: odds.totalLine, overWeight });
    lh = fit.lh;
    la = fit.la;
    fitError = Math.sqrt(fit.err / (3 + (pOver != null ? 1 : 0)));
  } else if (hasForm) {
    // Ataque propio y defensa del rival en sus últimos partidos, encogidos hacia la referencia
    const shrink = (avg, n, prior) => (avg * n + prior * PRIOR_WEIGHT) / (n + PRIOR_WEIGHT);
    const homeAtk = shrink(homeForm.gf, homeForm.n, PRIOR_HOME);
    const awayDef = shrink(awayForm.ga, awayForm.n, PRIOR_HOME);
    const awayAtk = shrink(awayForm.gf, awayForm.n, PRIOR_AWAY);
    const homeDef = shrink(homeForm.ga, homeForm.n, PRIOR_AWAY);
    lh = Math.sqrt(homeAtk * awayDef) * HOME_BOOST;
    la = Math.sqrt(awayAtk * homeDef) / HOME_BOOST;
    assumptions.push('Sin cuotas publicadas: los goles esperados salen de los últimos 5 partidos de cada equipo.');
    assumptions.push(`Los promedios se mezclan con una referencia de ${PRIOR_HOME} y ${PRIOR_AWAY} goles (local/visita) con peso de ${PRIOR_WEIGHT} partidos, y la localía suma un ${Math.round((HOME_BOOST - 1) * 100)}%.`);
  } else {
    lh = PRIOR_HOME;
    la = PRIOR_AWAY;
    assumptions.push(`Sin cuotas ni partidos recientes: se usa la referencia genérica de ${PRIOR_HOME} y ${PRIOR_AWAY} goles. El resultado es poco informativo.`);
  }
  assumptions.push(`Corrección de marcadores bajos con ρ = ${DC_RHO.toFixed(2)}, valor fijo del orden que reportan Dixon y Coles.`);

  if (isLive && !lm) {
    methods.add('dixonRobinson');
    assumptions.push(`En vivo: los goles esperados que faltan se escalan al ${Math.round(remaining * 100)}% del partido que queda (minuto ${minute} de ${MATCH_MINUTES}), con ritmo de gol constante.`);
    if ((match.homeTeam?.redCards || 0) + (match.awayTeam?.redCards || 0) > 0) {
      assumptions.push('Hay expulsiones: el modelo no corrige por jugadores de menos, así que el pronóstico subestima al equipo con 11.');
    }
    if (hasOdds) assumptions.push('Sin cuotas en vivo (extensión no conectada o partido sin mercado): se usan las previas y no se comparan contra precios del mercado.');
  }
  if (remLh == null) {
    remLh = lh * remaining;
    remLa = la * remaining;
  }

  const rem = scoreMatrix(remLh || 1e-6, remLa || 1e-6);
  // Matriz del resultado final desplazando por el marcador actual
  const N = MAX_GOALS + Math.max(sh, sa);
  const final = Array.from({ length: N + 1 }, () => new Array(N + 1).fill(0));
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) final[i + sh][j + sa] += rem[i][j];

  const home = match.homeTeam?.shortName || match.homeTeam?.name || 'Local';
  const away = match.awayTeam?.shortName || match.awayTeam?.name || 'Visita';
  // Precios contra los que se mide el valor: los en vivo si hay; las previas solo antes del partido
  const liveOdds = lm && {
    homeOdds: lm.matchResult.home,
    drawOdds: lm.matchResult.draw,
    awayOdds: lm.matchResult.away,
    totalLine: lm.totalGoals?.line ?? null,
    overOdds: lm.totalGoals?.over ?? null,
    underOdds: lm.totalGoals?.under ?? null,
  };
  const pricesValid = hasOdds && !isLive && !isFinished;
  const markets = buildMarkets(final, { home, away, odds: liveOdds || (pricesValid ? odds : null), sh, sa });

  // Córners, tarjetas y atajadas: promedios de los últimos partidos de cada equipo
  const props = buildPropMarkets(match, { home, away, isLive, remaining, isFinished });
  if (props.markets.length) {
    markets.push(...props.markets);
    methods.add('greenwoodYule');
    assumptions.push(...props.assumptions);
  }

  const p1 = sumWhere(final, (i, j) => i > j);
  const px = sumWhere(final, (i, j) => i === j);
  const p2 = 1 - p1 - px;

  // Calidad de datos → confianza del pronóstico (no confundir con la probabilidad)
  let quality = 0;
  if (hasOdds || lm) quality += 2;
  if (hasTotalOdds || lm?.totalGoals) quality += 1;
  if (hasForm) quality += 1;
  const confidence = quality >= 3 ? 'Alta' : quality === 2 ? 'Media' : 'Baja';

  return {
    home, away,
    lambdaHome: lh,
    lambdaAway: la,
    expectedHome: sh + remLh,
    expectedAway: sa + remLa,
    outcome: { p1, px, p2 },
    market,
    fitError,
    markets,
    picks: pickHighlights(markets),
    props: props.summary,
    confidence,
    quality: { hasOdds: hasOdds || Boolean(lm), hasTotalOdds: hasTotalOdds || Boolean(lm?.totalGoals), hasLiveOdds: Boolean(lm), hasForm, hasProps: props.markets.length > 0, isLive, minute, remaining },
    liveMarket: lm ? { minute: lm.minute, clock: lm.clock, capturedAt: lm.capturedAt, trend: lm.trend } : null,
    form: { home: homeForm, away: awayForm },
    methods: [...methods],
    assumptions,
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------- Mercados

function buildMarkets(m, { home, away, odds, sh, sa }) {
  const P = (fn) => sumWhere(m, fn);
  const list = [];
  const add = (group, id, label, p, extra = {}) => {
    if (!(p > 0.0005 && p < 0.9995)) return; // mercados ya resueltos no aportan
    const marketOdds = extra.marketOdds > 1 ? extra.marketOdds : null;
    list.push({
      group, id, label, p,
      fair: 1 / p,
      marketOdds,
      edge: marketOdds ? p * marketOdds - 1 : null,
      kind: extra.kind || 'simple',
      refs: extra.refs || ['maher', 'dixonColes'],
    });
  };
  const withShin = ['shin', 'maher', 'dixonColes'];

  const p1 = P((i, j) => i > j);
  const px = P((i, j) => i === j);
  const p2 = P((i, j) => i < j);
  add('Resultado final', '1', `Gana ${home}`, p1, { marketOdds: odds?.homeOdds, refs: withShin });
  add('Resultado final', 'X', 'Empate', px, { marketOdds: odds?.drawOdds, refs: withShin });
  add('Resultado final', '2', `Gana ${away}`, p2, { marketOdds: odds?.awayOdds, refs: withShin });

  add('Doble oportunidad', '1X', `${home} o empate`, p1 + px);
  add('Doble oportunidad', 'X2', `${away} o empate`, p2 + px);
  add('Doble oportunidad', '12', `${home} o ${away}`, p1 + p2);

  if (p1 + p2 > 0) {
    add('Empate no válido', 'dnb1', `${home} (se devuelve si empatan)`, p1 / (p1 + p2));
    add('Empate no válido', 'dnb2', `${away} (se devuelve si empatan)`, p2 / (p1 + p2));
  }

  const current = sh + sa;
  const lines = [...new Set([0.5, 1.5, 2.5, 3.5, 4.5, ...(odds?.totalLine != null ? [odds.totalLine] : [])])].sort((a, b) => a - b);
  for (const line of lines) {
    if (line < current) continue;
    const pOver = P((i, j) => i + j > line);
    const isMain = odds?.totalLine === line;
    add('Total de goles', `o${line}`, `Más de ${line} goles`, pOver, { marketOdds: isMain ? odds.overOdds : null, refs: isMain ? withShin : undefined });
    add('Total de goles', `u${line}`, `Menos de ${line} goles`, 1 - pOver, { marketOdds: isMain ? odds.underOdds : null, refs: isMain ? withShin : undefined });
  }

  const btts = P((i, j) => i > 0 && j > 0);
  add('Ambos marcan', 'btts-y', 'Ambos marcan: sí', btts);
  add('Ambos marcan', 'btts-n', 'Ambos marcan: no', 1 - btts);

  for (const [name, side] of [[home, 'h'], [away, 'a']]) {
    const g = (i, j) => (side === 'h' ? i : j);
    add(`Goles de ${name}`, `${side}o0.5`, `${name}: más de 0.5 goles`, P((i, j) => g(i, j) > 0.5));
    add(`Goles de ${name}`, `${side}o1.5`, `${name}: más de 1.5 goles`, P((i, j) => g(i, j) > 1.5));
  }

  add('Hándicap', 'h-1.5', `${home} −1.5`, P((i, j) => i - j >= 2));
  add('Hándicap', 'a+1.5', `${away} +1.5`, P((i, j) => j - i > -2));
  add('Hándicap', 'a-1.5', `${away} −1.5`, P((i, j) => j - i >= 2));
  add('Hándicap', 'h+1.5', `${home} +1.5`, P((i, j) => i - j > -2));

  add('Valla invicta', 'cs-h', `${home} no recibe goles`, P((i, j) => j === 0));
  add('Valla invicta', 'cs-a', `${away} no recibe goles`, P((i) => i === 0));

  add('Combinadas', 'c1o15', `Gana ${home} y más de 1.5 goles`, P((i, j) => i > j && i + j > 1.5), { kind: 'combo' });
  add('Combinadas', 'c2o15', `Gana ${away} y más de 1.5 goles`, P((i, j) => j > i && i + j > 1.5), { kind: 'combo' });
  add('Combinadas', 'c1btts', `Gana ${home} y ambos marcan`, P((i, j) => i > j && j > 0), { kind: 'combo' });
  add('Combinadas', 'c2btts', `Gana ${away} y ambos marcan`, P((i, j) => j > i && i > 0), { kind: 'combo' });
  add('Combinadas', 'cbtts25', 'Ambos marcan y más de 2.5 goles', P((i, j) => i > 0 && j > 0 && i + j > 2.5), { kind: 'combo' });
  add('Combinadas', 'cxu25', 'Empate y menos de 2.5 goles', P((i, j) => i === j && i + j < 2.5), { kind: 'combo' });

  const scores = [];
  for (let i = 0; i < m.length; i++) for (let j = 0; j < m[i].length; j++) scores.push({ i, j, p: m[i][j] });
  scores.sort((a, b) => b.p - a.p).slice(0, 6).forEach(s => {
    add('Marcador exacto', `cs${s.i}-${s.j}`, `${home} ${s.i} - ${s.j} ${away}`, s.p, { kind: 'score' });
  });

  return list;
}

// ---------------------------------------------------------------- Córners, tarjetas y atajadas

// Referencias por equipo y partido cuando hay pocos datos (supuestos del modelo)
const PROP_PRIOR = { corners: 5, yellow: 2, saves: 3, red: 0.06 };
const PROP_PRIOR_WEIGHT = 3;
// Dispersión de referencia (varianza / media) de cada conteo
const PROP_PHI = { corners: 1.3, yellow: 1.2, saves: 1.1 };

/** Binomial negativa con media mu y varianza phi·mu; phi ≤ 1 → Poisson. */
export function nbPmf(mu, phi, max = 40) {
  if (!(mu > 0)) return [1, ...new Array(max).fill(0)];
  if (phi <= 1.0001) return poissonPmf(mu, max);
  const r = mu / (phi - 1);
  const q = r / (r + mu);
  const out = new Array(max + 1);
  out[0] = Math.pow(q, r);
  for (let k = 1; k <= max; k++) out[k] = (out[k - 1] * (k - 1 + r) / k) * (1 - q);
  return out;
}

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
function dispersion(values, prior) {
  const n = values.length;
  const m = mean(values);
  if (n < 3 || !(m > 0)) return prior;
  const v = values.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1);
  const raw = Math.min(3, Math.max(1, v / m));
  return (raw * n + prior * 5) / (n + 5);
}

// Conteo actual del partido desde las estadísticas de ESPN
function liveCount(match, label) {
  for (const key of ['attack', 'defense', 'discipline']) {
    const row = (match.stats?.[key] || []).find(r => r.label === label);
    if (row) return [Number(row.home) || 0, Number(row.away) || 0];
  }
  return [0, 0];
}

function buildPropMarkets(match, { home, away, isLive, remaining, isFinished }) {
  const hs = match.homeTeam?.recentStats;
  const as = match.awayTeam?.recentStats;
  const out = { markets: [], assumptions: [], summary: null };
  if (isFinished || !(hs?.n >= 2) || !(as?.n >= 2)) return out;

  const n = hs.n + as.n;
  const shrinkTo = (a, b, prior) => ((a + b) / 2 * n + prior * PROP_PRIOR_WEIGHT) / (n + PROP_PRIOR_WEIGHT);
  const avg = (st, k) => mean(st.games.map(g => g[k]));
  const lam = {
    corners: [shrinkTo(avg(hs, 'cornersFor'), avg(as, 'cornersAgainst'), PROP_PRIOR.corners), shrinkTo(avg(as, 'cornersFor'), avg(hs, 'cornersAgainst'), PROP_PRIOR.corners)],
    yellow: [shrinkTo(avg(hs, 'yellowFor'), avg(as, 'yellowAgainst'), PROP_PRIOR.yellow), shrinkTo(avg(as, 'yellowFor'), avg(hs, 'yellowAgainst'), PROP_PRIOR.yellow)],
    // Atajadas del arquero local: las que hace él y las que provoca el ataque rival
    saves: [shrinkTo(avg(hs, 'savesFor'), avg(as, 'savesAgainst'), PROP_PRIOR.saves), shrinkTo(avg(as, 'savesFor'), avg(hs, 'savesAgainst'), PROP_PRIOR.saves)],
  };
  const redRate = ((mean([...hs.games, ...as.games].map(g => g.redFor + g.redAgainst)) || 0) * n + PROP_PRIOR.red * 2 * PROP_PRIOR_WEIGHT) / (n + PROP_PRIOR_WEIGHT);
  const totals = (k1, k2) => [...hs.games, ...as.games].map(g => g[k1] + g[k2]);
  const phi = {
    corners: dispersion(totals('cornersFor', 'cornersAgainst'), PROP_PHI.corners),
    yellow: dispersion(totals('yellowFor', 'yellowAgainst'), PROP_PHI.yellow),
    saves: PROP_PHI.saves,
  };

  const now = {
    corners: isLive ? liveCount(match, 'CÓRNERS GANADOS') : [0, 0],
    yellow: isLive ? [Number(match.homeTeam?.yellowCards) || 0, Number(match.awayTeam?.yellowCards) || 0] : [0, 0],
    red: isLive ? (Number(match.homeTeam?.redCards) || 0) + (Number(match.awayTeam?.redCards) || 0) : 0,
    saves: isLive ? liveCount(match, 'PARADAS DEL ARQUERO') : [0, 0],
  };

  const refs = ['recent', 'greenwoodYule'];
  const push = (group, id, label, p) => {
    if (!(p > 0.0005 && p < 0.9995)) return;
    out.markets.push({ group, id, label, p, fair: 1 / p, marketOdds: null, edge: null, kind: 'prop', refs });
  };
  // Probabilidad de que el conteo final supere `line`, sumando lo que ya pasó
  const overFinal = (pmf, current, line) => {
    let s = 0;
    for (let k = 0; k < pmf.length; k++) if (current + k > line) s += pmf[k];
    return s;
  };
  const lines = (m) => {
    const c = Math.round(m);
    return [c - 2.5, c - 1.5, c - 0.5, c + 0.5, c + 1.5].filter(l => l > 0);
  };

  const expected = {};
  for (const [stat, group, unit] of [['corners', 'Córners', 'córners'], ['yellow', 'Tarjetas', 'amarillas'], ['saves', 'Atajadas', 'atajadas']]) {
    const [lh, la] = lam[stat].map(l => l * remaining);
    const [ch, ca] = now[stat];
    expected[stat] = [ch + lh, ca + la];
    if (stat !== 'saves') {
      const total = nbPmf(lh + la, phi[stat]);
      for (const line of lines(ch + ca + lh + la)) {
        const pOver = overFinal(total, ch + ca, line);
        push(group, `${stat}-o${line}`, `Más de ${line} ${unit}`, pOver);
        push(group, `${stat}-u${line}`, `Menos de ${line} ${unit}`, 1 - pOver);
      }
    }
    const ph = nbPmf(lh, phi[stat]);
    const pa = nbPmf(la, phi[stat]);
    for (const [name, pmf, cur, l] of [[home, ph, ch, lh], [away, pa, ca, la]]) {
      const who = stat === 'saves' ? `Arquero de ${name}` : name;
      const r = Math.round(cur + l);
      for (const line of new Set([r - 1.5, r - 0.5, r + 0.5].map(x => Math.max(0.5, x)))) {
        push(group, `${stat}-${name}-o${line}`, `${who}: más de ${line} ${unit}`, overFinal(pmf, cur, line));
      }
    }
    if (stat === 'corners') {
      // Quién saca más córners: comparación de los dos conteos finales
      let pH = 0; let pA = 0;
      for (let i = 0; i < ph.length; i++) for (let j = 0; j < pa.length; j++) {
        const fh = ch + i; const fa = ca + j;
        if (fh > fa) pH += ph[i] * pa[j]; else if (fa > fh) pA += ph[i] * pa[j];
      }
      push(group, 'corners-more-h', `Más córners: ${home}`, pH);
      push(group, 'corners-more-a', `Más córners: ${away}`, pA);
    }
  }
  if (now.red === 0) push('Tarjetas', 'red-yes', 'Habrá tarjeta roja', 1 - Math.exp(-redRate * remaining));

  out.summary = {
    games: n,
    corners: expected.corners,
    yellow: expected.yellow,
    saves: expected.saves,
    phi,
  };
  out.assumptions.push(`Córners, tarjetas y atajadas: promedio entre lo que hace cada equipo y lo que concede el rival en sus últimos ${hs.n} y ${as.n} partidos, mezclado con una referencia de ${PROP_PRIOR.corners} córners, ${PROP_PRIOR.yellow} amarillas y ${PROP_PRIOR.saves} atajadas por equipo con peso de ${PROP_PRIOR_WEIGHT} partidos.`);
  out.assumptions.push(`Dispersión estimada de esos partidos (varianza/media): córners ${phi.corners.toFixed(2)}, amarillas ${phi.yellow.toFixed(2)}; atajadas con valor fijo ${PROP_PHI.saves}. No se considera al árbitro designado.`);
  return out;
}

// Tres pronósticos al estilo de una casa de apuestas: probable, equilibrado y de cuota alta.
function pickHighlights(markets) {
  // Empate no válido es una probabilidad condicionada: se muestra en la tabla, no como pronóstico destacado
  const simple = markets.filter(mk => mk.kind === 'simple' && !mk.group.startsWith('Empate no'));
  const prop = (group) => byProb(markets.filter(mk => mk.kind === 'prop' && mk.group === group), 0.58, 0.82);
  const best = (arr, lo, hi, exclude = []) => arr
    .filter(mk => mk.p >= lo && mk.p <= hi && !exclude.includes(mk.id))
    // Con precio de mercado se prefiere el de mayor ventaja; si no, el más probable
    .sort((a, b) => (b.edge ?? -1) - (a.edge ?? -1) || b.p - a.p)[0];
  const byProb = (arr, lo, hi, exclude = []) => arr
    .filter(mk => mk.p >= lo && mk.p <= hi && !exclude.includes(mk.id))
    .sort((a, b) => b.p - a.p)[0];

  const safe = byProb(simple, 0.6, 0.86) || byProb(simple, 0.5, 0.95);
  const balanced = best(simple.filter(mk => !mk.group.startsWith('Doble')), 0.42, 0.62, [safe?.id]);
  const combos = markets.filter(mk => mk.kind === 'combo' || mk.kind === 'score');
  const bold = byProb(combos, 0.2, 0.4) || byProb(combos, 0.08, 0.2);
  const value = markets.filter(mk => mk.edge != null && mk.edge > 0.01).sort((a, b) => b.edge - a.edge)[0] || null;

  const corners = prop('Córners');
  const cards = prop('Tarjetas');
  return [
    safe && { tier: 'Más probable', ...safe },
    balanced && { tier: 'Equilibrado', ...balanced },
    bold && { tier: 'Cuota alta', ...bold },
    corners && { tier: 'Córners', ...corners },
    cards && { tier: 'Tarjetas', ...cards },
  ].filter(Boolean).concat(value && ![safe, balanced, bold].some(x => x?.id === value.id) ? [{ tier: 'Con valor', ...value }] : []);
}

// ---------------------------------------------------------------- Fuentes numeradas

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

/**
 * Lista numerada de fuentes del pronóstico: primero los datos usados, después los métodos.
 * Cada entrada: { n, key, type: 'data' | 'method', title, detail, url, accessed }.
 */
export function buildSources(match, pred) {
  if (!match || !pred) return [];
  const espnUrl = match.espnLink || `https://www.espn.com/soccer/match/_/gameId/${match.id}`;
  const out = [];
  const push = (s) => out.push({ n: out.length + 1, ...s });

  push({
    key: 'espn',
    type: 'data',
    title: `ESPN. Ficha del partido ${pred.home} vs ${pred.away}`,
    detail: `${match.leagueName || 'Fútbol'}: estado, marcador${match.stats?.hasData ? ' y estadísticas' : ''}.`,
    url: espnUrl,
    accessed: fmtDate(pred.computedAt),
  });
  if (pred.quality.hasLiveOdds && match.liveMarket) {
    const lm = match.liveMarket;
    const mr = lm.matchResult;
    push({
      key: 'odds',
      type: 'data',
      title: `Cuotas en vivo de la casa de apuestas (minuto ${lm.clock || Math.round(lm.minute || 0)})`,
      detail: `1X2: ${mr.home.toFixed(2)} · ${mr.draw.toFixed(2)} · ${mr.away.toFixed(2)}${lm.totalGoals ? `. Más/menos de ${lm.totalGoals.line}: ${lm.totalGoals.over.toFixed(2)} · ${lm.totalGoals.under.toFixed(2)}` : ''}. Capturadas por la extensión del navegador.`,
      accessed: fmtDate(lm.capturedAt || pred.computedAt),
    });
  } else if (pred.quality.hasOdds) {
    const o = match.oddsInfo;
    push({
      key: 'odds',
      type: 'data',
      title: `${o.provider}. Cuotas publicadas en ESPN`,
      detail: `1X2: ${o.homeOdds?.toFixed(2)} · ${o.drawOdds?.toFixed(2)} · ${o.awayOdds?.toFixed(2)}${pred.quality.hasTotalOdds ? `. Más/menos de ${o.totalLine}: ${o.overOdds.toFixed(2)} · ${o.underOdds.toFixed(2)}` : o.totalLine != null ? `. Línea de goles ${o.totalLine}` : ''}.`,
      url: espnUrl,
      accessed: fmtDate(o.fetchedAt || pred.computedAt),
    });
  }
  if (pred.quality.hasForm) {
    push({
      key: 'form',
      type: 'data',
      title: 'ESPN. Últimos partidos de cada equipo',
      detail: `${pred.home}: ${pred.form.home.string || '—'} · ${pred.away}: ${pred.form.away.string || '—'}.`,
      url: espnUrl,
      accessed: fmtDate(pred.computedAt),
    });
  }
  if (pred.quality.hasProps) {
    const ids = [...(match.homeTeam?.recentStats?.eventIds || []), ...(match.awayTeam?.recentStats?.eventIds || [])];
    push({
      key: 'recent',
      type: 'data',
      title: 'ESPN. Estadísticas de los últimos partidos de cada equipo',
      detail: `Córners, tarjetas y atajadas de ${pred.props.games} partidos terminados (boxscore de ESPN).`,
      url: `https://www.espn.com/soccer/match/_/gameId/${ids[0]}`,
      accessed: fmtDate(pred.computedAt),
    });
  }
  for (const key of ['shin', 'strumbelj', 'maher', 'dixonColes', 'greenwoodYule', 'dixonRobinson']) {
    if (!pred.methods.includes(key)) continue;
    const ref = REFERENCES[key];
    push({ key, type: 'method', title: formatApa(ref), ref, detail: ref.use, url: `https://doi.org/${ref.doi}`, doi: ref.doi });
  }
  return out;
}

/** Números de cita para una lista de claves de fuente. */
export function citeNumbers(sources, keys = []) {
  return keys.map(k => sources.find(s => s.key === k)?.n).filter(Boolean);
}

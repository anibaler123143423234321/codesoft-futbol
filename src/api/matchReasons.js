/**
 * Por qué cada equipo tiene la probabilidad que tiene.
 *
 * Arma razones a favor y en contra con los datos que ya tiene el partido: marcador y minuto,
 * expulsiones, estadísticas en vivo, cuotas sin margen, tabla, forma reciente, cara a cara,
 * localía, altura de la ciudad y goles esperados del modelo. No usa IA: cada frase sale de un
 * dato concreto, así que no puede inventar cifras.
 */

const norm = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const pct = (p) => `${Math.round(p * 100)}%`;
const dec = (n, d = 1) => Number(n).toFixed(d);
const fmtAlt = (m) => String(m);

// Altitud aproximada (metros sobre el nivel del mar, redondeada) de ciudades donde se juega en altura
const ALTITUDE = [
  ['el alto', 4000], ['potosi', 4000], ['juliaca', 3800], ['puno', 3800], ['oruro', 3700],
  ['la paz', 3650], ['cusco', 3400], ['huancayo', 3250], ['tarma', 3050], ['huaraz', 3050],
  ['andahuaylas', 2900], ['quito', 2850], ['sucre', 2800], ['ayacucho', 2750], ['cajamarca', 2750],
  ['bogota', 2650], ['toluca', 2650], ['cochabamba', 2550], ['abancay', 2400], ['pachuca', 2400],
  ['arequipa', 2350], ['mexico city', 2250], ['ciudad de mexico', 2250],
];
// Clubes que juegan de local en altura: para ellos la altura del rival no es una desventaja
const ALTITUDE_CLUBS = [
  'cienciano', 'cusco', 'garcilaso', 'huancayo', 'ayacucho', 'utc', 'binacional', 'chankas', 'melgar', 'adt',
  'bolivar', 'strongest', 'always ready', 'wilstermann', 'aurora', 'potosi', 'ldu', 'liga de quito', 'aucas',
  'independiente del valle', 'deportivo quito', 'toluca', 'pachuca', 'cruz azul', 'pumas', 'millonarios',
];
const hasWord = (text, word) => new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(text);
const altitudeOf = (place) => {
  const t = norm(place);
  return ALTITUDE.find(([city]) => hasWord(t, city))?.[1] || null;
};
const isAltitudeClub = (name) => ALTITUDE_CLUBS.some((k) => hasWord(norm(name), k));

const RESULT_ES = { W: 'G', D: 'E', L: 'P' };

function formOf(games = []) {
  const g = games.filter((x) => RESULT_ES[x.result]);
  const count = (r) => g.filter((x) => x.result === r).length;
  const avg = (key) => {
    const v = g.map((x) => x[key]).filter((n) => Number.isFinite(n));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const w = count('W');
  const d = count('D');
  const l = count('L');
  return { n: g.length, w, d, l, pts: w * 3 + d, gf: avg('goalsFor'), ga: avg('goalsAgainst') };
}
const record = (f) => `${f.w}G ${f.d}E ${f.l}P`;

/** Cruces entre los dos equipos, del más reciente al más viejo, desde el punto de vista de `team`. */
function headToHead(history = [], team, rival, venueOwner) {
  const T = norm(team);
  const R = norm(rival);
  const rows = history
    .filter((r) => {
      const h = norm(r.homeTeam);
      const a = norm(r.awayTeam);
      return (h === T && a === R) || (h === R && a === T);
    })
    .sort((x, y) => String(y.date).localeCompare(String(x.date)))
    .slice(0, 5)
    .map((r) => {
      const home = norm(r.homeTeam) === T;
      const gt = Number(home ? r.homeScore : r.awayScore);
      const gr = Number(home ? r.awayScore : r.homeScore);
      return { gt, gr, score: `${r.homeScore}-${r.awayScore}`, atVenue: norm(r.homeTeam) === norm(venueOwner) };
    })
    .filter((r) => Number.isFinite(r.gt) && Number.isFinite(r.gr));
  const tally = (list) => ({
    n: list.length,
    w: list.filter((r) => r.gt > r.gr).length,
    d: list.filter((r) => r.gt === r.gr).length,
    l: list.filter((r) => r.gt < r.gr).length,
    scores: list.map((r) => r.score),
  });
  return { all: tally(rows), venue: tally(rows.filter((r) => r.atVenue)) };
}

/** Estadio, ciudad y altura aproximada (null si no es una ciudad en altura). */
export function venueOf(match) {
  const venue = match?.gameInfo?.venue || match?.venue || '';
  const name = venue.split(',')[0].trim();
  const city = (match?.gameInfo?.city || venue.split(',')[1] || '').trim();
  return { name, city, alt: altitudeOf(city) || altitudeOf(venue) };
}

const statOf = (stats, label) => (stats?.attack || []).find((s) => s.label === label);
const joinScores = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}` : list[0] || '');

/** Goles y expulsiones del partido, en orden. */
export function matchEvents(match) {
  const homeId = String(match?.homeTeam?.id ?? '');
  const homeName = norm(match?.homeTeam?.name);
  const sideOf = (team) => {
    if (!team) return null;
    if (team.id != null && homeId) return String(team.id) === homeId ? 'home' : 'away';
    return norm(team.displayName) === homeName ? 'home' : 'away';
  };
  const raw = match?.rawKeyEvents || [];
  const out = [];
  for (const k of raw) {
    const type = norm(k.type?.text);
    const red = type.includes('red card');
    const goal = !red && (k.scoringPlay === true || (type.includes('goal') && !type.includes('kick')));
    if (!goal && !red) continue;
    out.push({
      minute: k.clock?.displayValue || '',
      side: sideOf(k.team),
      kind: red ? 'red' : 'goal',
      player: k.participants?.[0]?.athlete?.displayName || '',
      own: type.includes('own goal'),
      penalty: type.includes('penalty'),
    });
  }
  if (!out.length && match?.scorers?.length) {
    match.scorers.forEach((s) => out.push({ minute: String(s.minute || '').replace(/'$/, ''), side: s.team, kind: 'goal', player: s.player }));
  }
  return out;
}

/**
 * Razones para un lado ('home' | 'away').
 * Devuelve { team, rival, p, question, verdict, tone, favor: [], against: [] } con
 * cada razón como { key, icon, text } ordenadas por peso.
 */
export function explainSide(match, pred, side) {
  const isHome = side === 'home';
  const T = (isHome ? match.homeTeam : match.awayTeam) || {};
  const R = (isHome ? match.awayTeam : match.homeTeam) || {};
  const tName = isHome ? pred.home : pred.away;
  const rName = isHome ? pred.away : pred.home;
  const p = isHome ? pred.outcome.p1 : pred.outcome.p2;
  const pr = isHome ? pred.outcome.p2 : pred.outcome.p1;
  const finished = match.status === 'finished';
  const live = !finished && (pred.quality.isLive || match.status === 'live');
  const favor = [];
  const against = [];
  const add = (list, weight, icon, key, text) => list.push({ weight, icon, key, text });

  // 1. Marcador y tiempo
  const gT = Number(T.score || 0);
  const gR = Number(R.score || 0);
  const minute = Math.round(pred.quality.minute || 0);
  const rem = Math.max(1, 90 - minute);
  if (finished) {
    if (gT > gR) add(favor, 10, 'score', 'score', `Ganó ${gT}-${gR}.`);
    else if (gT < gR) add(against, 10, 'score', 'score', `Perdió ${gT}-${gR}.`);
    else add(against, 10, 'score', 'score', `Empató ${gT}-${gR}: no le alcanzó para ganar.`);
  } else if (live) {
    if (gT < gR) {
      const need = gR - gT + 1;
      add(against, 10, 'clock', 'score', `Pierde ${gT}-${gR} en el minuto ${minute}: necesita ${need} goles en unos ${rem} minutos para ganarlo.`);
    } else if (gT > gR) {
      add(favor, 10, 'clock', 'score', `Gana ${gT}-${gR} en el minuto ${minute}; quedan unos ${rem} minutos.`);
    } else if (minute >= 55) {
      add(against, 7, 'clock', 'score', `Va ${gT}-${gR} en el minuto ${minute}: le quedan unos ${rem} minutos para hacer el gol.`);
    }
  }

  // 2. Expulsiones
  if (live || finished) {
    const rT = Number(T.redCards || 0);
    const rR = Number(R.redCards || 0);
    const verb = finished ? 'Jugó' : 'Juega';
    if (rT > rR) add(against, 8, 'red', 'red', rT - rR === 1 ? `${verb} con uno menos por una expulsión.` : `${verb} con ${rT - rR} jugadores menos.`);
    else if (rR > rT) add(favor, 8, 'red', 'red', `${rName} ${finished ? 'jugó' : 'juega'} con ${rR - rT === 1 ? 'uno menos' : `${rR - rT} menos`}.`);
  }

  // 3. Lo que va del partido
  if ((live || finished) && match.stats?.hasData) {
    const sot = statOf(match.stats, 'TIROS AL ARCO');
    const pos = statOf(match.stats, 'POSESIÓN %');
    if (sot) {
      const sT = Number(isHome ? sot.home : sot.away);
      const sR = Number(isHome ? sot.away : sot.home);
      if (sT + sR >= 3 && sT !== sR) {
        const times = (n) => `${n} ${n === 1 ? 'vez' : 'veces'}`;
        const text = sT === 0
          ? `No ${finished ? 'remató' : 'ha rematado'} al arco; ${rName}, ${times(sR)}.`
          : `Remató ${times(sT)} al arco contra ${sR === 0 ? 'ninguna' : sR} de ${rName}.`;
        add(sT > sR ? favor : against, 6, 'shots', 'shots', text);
      }
    }
    if (pos) {
      const pT = Math.round(Number(isHome ? pos.home : pos.away));
      if (Math.abs(pT - 50) >= 8) add(pT > 50 ? favor : against, 4, 'ball', 'ball', `${finished ? 'Tuvo' : 'Tiene'} la pelota el ${pT}% del tiempo.`);
    }
  }

  // 4. Cuotas sin margen
  if (pred.market) {
    const mT = isHome ? pred.market.p1 : pred.market.p2;
    const mR = isHome ? pred.market.p2 : pred.market.p1;
    const lm = match.liveMarket?.matchResult;
    const odds = Number(isHome ? (lm?.home ?? match.oddsInfo?.homeOdds) : (lm?.away ?? match.oddsInfo?.awayOdds));
    // Con el partido en juego y sin cuotas en vivo, las cuotas son de antes del inicio
    const stale = (live || finished) && !pred.quality.hasLiveOdds;
    let lead;
    if (pred.quality.hasLiveOdds) lead = odds > 1 ? `Las cuotas en vivo lo pagan a ${dec(odds, 2)}; sin su margen, le dan` : 'Sin su margen, las cuotas en vivo le dan';
    else if (stale) lead = odds > 1 ? `Antes del partido lo pagaban a ${dec(odds, 2)}; sin su margen, le daban` : 'Antes del partido, sin su margen, las casas le daban';
    else lead = odds > 1 ? `Las casas lo pagan a ${dec(odds, 2)}; sin su margen, le dan` : 'Sin su margen, las casas le dan';
    const w = stale ? 3 : 7;
    if (mT < mR) add(against, w, 'odds', 'odds', `${lead} ${pct(mT)} de ganar y a ${rName}, ${pct(mR)}.`);
    else add(favor, w, 'odds', 'odds', `${lead} ${pct(mT)} de ganar contra ${pct(mR)} de ${rName}.`);
  }

  // 5. Tabla
  const tbT = match.table?.[side];
  const tbR = match.table?.[isHome ? 'away' : 'home'];
  if (tbT?.rank && tbR?.rank && tbT.rank !== tbR.rank) {
    const pts = (tb) => (tb.points != null ? ` con ${tb.points} puntos` : '');
    if (tbT.rank < tbR.rank) {
      add(favor, 6, 'table', 'table', tbT.rank === 1
        ? `Es líder del torneo${pts(tbT)}; ${rName} está ${tbR.rank}.º${pts(tbR)}.`
        : `Está ${tbT.rank}.º${pts(tbT)}, por encima de ${rName} (${tbR.rank}.º).`);
    } else {
      add(against, 6, 'table', 'table', tbR.rank === 1
        ? `Enfrenta al líder: ${rName} suma ${tbR.points ?? '—'} puntos y ${tName} está ${tbT.rank}.º${pts(tbT)}.`
        : `Está ${tbT.rank}.º${pts(tbT)}, debajo de ${rName} (${tbR.rank}.º${pts(tbR)}).`);
    }
  }

  // 6. Localía y altura
  const { name: venueName, city, alt } = venueOf(match);
  if (isHome) {
    if (alt) add(favor, 5, 'altitude', 'home', `Juega en casa${venueName ? ` (${venueName})` : ''}, a unos ${fmtAlt(alt)} m de altura.`);
    else add(favor, 3, 'home', 'home', `Juega en casa${venueName ? ` (${venueName})` : ''}.`);
  } else if (alt && !isAltitudeClub(T.name)) {
    add(against, 5, 'altitude', 'home', `Juega de visita en ${city || venueName}, a unos ${fmtAlt(alt)} m de altura.`);
  } else {
    add(against, 3, 'home', 'home', `Juega de visita${city ? ` en ${city}` : venueName ? ` (${venueName})` : ''}.`);
  }

  // 7. Forma reciente
  const fT = formOf(T.recentGames);
  const fR = formOf(R.recentGames);
  if (fT.n >= 3 && fR.n >= 3) {
    // Solo cuenta como mejor o peor racha con al menos un partido ganado de diferencia
    const gap = fT.pts - fR.pts;
    if (gap >= 3) add(favor, 5, 'form', 'form', `Llega mejor: ${record(fT)} en sus últimos ${fT.n}, contra ${record(fR)} de ${rName}.`);
    else if (gap <= -3) add(against, 5, 'form', 'form', `Llega peor: ${record(fT)} en sus últimos ${fT.n}, contra ${record(fR)} de ${rName}.`);
    if (fT.l === 0 && gap < 3) add(favor, 4, 'form', 'unbeaten', `No pierde hace ${fT.n} partidos (${record(fT)}).`);
    if (fT.w === 0) add(against, 4, 'form', 'winless', `No gana hace ${fT.n} partidos (${record(fT)}).`);
    if (fT.gf != null && fR.ga != null && fT.gf >= 2 && fR.ga >= 1.4) {
      add(favor, 3, 'attack', 'attack', `Hace ${dec(fT.gf)} goles por partido y ${rName} recibe ${dec(fR.ga)}.`);
    } else if (fT.gf != null && fT.gf < 1) {
      add(against, 3, 'attack', 'attack', `Le cuesta el gol: ${dec(fT.gf)} por partido en sus últimos ${fT.n}.`);
    }
  }

  // 8. Cara a cara
  const h2h = headToHead(match.h2hHistory, T.name, R.name, match.homeTeam?.name);
  const h = h2h.all;
  if (h.n >= 2) {
    if (h.l === 0) add(favor, 5, 'h2h', 'h2h', `No pierde con ${rName} en los últimos ${h.n} cruces (${h.w}G ${h.d}E).`);
    else if (h.w === 0) add(against, 5, 'h2h', 'h2h', `No le gana a ${rName} en los últimos ${h.n} cruces (${h.d}E ${h.l}P).`);
    else if (h.w !== h.l) add(h.w > h.l ? favor : against, 3, 'h2h', 'h2h', `Contra ${rName}: ${h.w}G ${h.d}E ${h.l}P en los últimos ${h.n} cruces.`);
  }
  const v = h2h.venue;
  if (v.n >= 2) {
    const where = isHome ? 'En casa' : `En casa de ${rName}`;
    if (v.w === 0) add(against, 5, 'h2h', 'venue', `${where} no ganó ${isHome ? `a ${rName} ` : ''}en los últimos ${v.n} cruces (${joinScores(v.scores)}).`);
    else if (v.w === v.n) add(favor, 5, 'h2h', 'venue', `${where} ganó los últimos ${v.n} cruces (${joinScores(v.scores)}).`);
  }

  // 9. Goles esperados del modelo
  const xT = isHome ? pred.expectedHome : pred.expectedAway;
  const xR = isHome ? pred.expectedAway : pred.expectedHome;
  if (!finished && Math.abs(xT - xR) >= 0.25) {
    add(xT > xR ? favor : against, 4, 'xg', 'xg', `El modelo le calcula ${dec(xT, 2)} goles al final, contra ${dec(xR, 2)} de ${rName}.`);
  }

  const byWeight = (a, b) => b.weight - a.weight;
  favor.sort(byWeight);
  against.sort(byWeight);

  let verdict;
  let tone;
  if (finished) {
    verdict = gT > gR ? 'Ganó' : gT < gR ? 'Perdió' : 'Empató';
    tone = gT > gR ? 'up' : gT < gR ? 'down' : 'flat';
  } else if (p >= 0.55) { verdict = 'Favorito claro'; tone = 'up'; }
  else if (p >= 0.4) { verdict = 'Favorito'; tone = 'up'; }
  else if (p >= 0.28) { verdict = 'Puede ganarlo'; tone = 'flat'; }
  else if (p >= 0.1) { verdict = 'Lo tiene difícil'; tone = 'down'; }
  else if (p >= 0.02 || minute < 80) { verdict = 'Casi imposible'; tone = 'down'; }
  else { verdict = 'Sin opciones'; tone = 'down'; }

  const question = finished
    ? `¿Qué pasó con ${tName}?`
    : p < pr
      ? `¿Por qué a ${tName} le cuesta ganar?`
      : `¿Por qué ${tName} es favorito?`;

  return {
    team: tName,
    rival: rName,
    p,
    question,
    verdict,
    tone,
    favor: favor.slice(0, 4),
    against: against.slice(0, 4),
  };
}

// ========================================================
// SERVICIO DE TRANSMISIÓN DE FÚTBOL EN VIVO (RAPIDAPI)
// Con caché inteligente, control de cuotas y manejo de errores
// ========================================================

const RAPIDAPI_KEY = typeof __RAPIDAPI_KEY__ !== 'undefined' && __RAPIDAPI_KEY__
  ? __RAPIDAPI_KEY__
  : '145cb9d94dmshae1f304d7a5dc56p1bb2b8jsn47474853c5af';

const RAPIDAPI_HOST = 'football-live-stream-api.p.rapidapi.com';

// --------------------------------------------------------
// MEMORY CACHE & RATE LIMIT PROTECTION
// Evita gastar las 50 peticiones diarias gratuitas de golpe
// --------------------------------------------------------
const CACHE = {
  allMatches: null,
  allMatchesTime: 0,
  links: new Map(), // matchId -> { data, timestamp }
};

const MATCHES_CACHE_TTL = 3 * 60 * 1000; // Guardar lista de partidos por 3 minutos
const LINK_CACHE_TTL = 30 * 60 * 1000;   // Guardar enlace del partido por 30 minutos

const apiState = {
  isBlocked: false,
  blockReason: null, // 'QUOTA_EXCEEDED' | 'NOT_SUBSCRIBED' | 'AUTH_ERROR'
  blockedUntil: 0,
  errorMessage: '',
};

/**
 * Extrae la URL directa del stream .m3u8 si viene envuelta en el visor online.
 */
export function extractM3u8Url(url) {
  if (!url) return '';
  if (url.includes('?url=')) {
    const parts = url.split('?url=');
    return decodeURIComponent(parts[1] || '').trim();
  }
  return url.trim();
}

/**
 * Petición genérica con control estricto de códigos HTTP (429 Quota, 403 Subscripción).
 */
async function requestRapidApi(path) {
  const now = Date.now();
  if (apiState.isBlocked && now < apiState.blockedUntil) {
    const err = new Error(apiState.errorMessage);
    err.type = apiState.blockReason;
    err.blocked = true;
    throw err;
  }

  const isLocal = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  let response = null;

  if (isLocal) {
    try {
      response = await fetch(`/api/rapidapi-stream${path}`);
    } catch {
      // Si el proxy local no responde, intentar directo
    }
  }

  if (!response || !response.ok) {
    // Si la respuesta fue 429 o 403 en el proxy, no reintentar directo para no quemar tokens
    if (response && (response.status === 429 || response.status === 403)) {
      handleApiErrorStatus(response.status);
    }

    const directUrl = `https://${RAPIDAPI_HOST}${path}`;
    try {
      response = await fetch(directUrl, {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      });
    } catch (netErr) {
      const err = new Error('No se pudo conectar con el servidor de transmisiones.');
      err.type = 'NETWORK_ERROR';
      throw err;
    }
  }

  if (!response.ok) {
    handleApiErrorStatus(response.status);
  }

  const json = await response.json();

  // A veces RapidAPI devuelve 200 con { message: "You are not subscribed to this API." }
  if (json?.message && typeof json.message === 'string') {
    const msg = json.message.toLowerCase();
    if (msg.includes('not subscribed')) {
      handleApiErrorStatus(403, json.message);
    }
    if (msg.includes('exceeded') || msg.includes('rate limit')) {
      handleApiErrorStatus(429, json.message);
    }
  }

  // Éxito: desbloquear estado
  apiState.isBlocked = false;
  return json;
}

function handleApiErrorStatus(status, customMsg = '') {
  let type = 'API_ERROR';
  let message = customMsg || 'Error al comunicarse con la API de streaming.';

  if (status === 429) {
    type = 'QUOTA_EXCEEDED';
    message = 'Has alcanzado el límite de 50 peticiones gratuitas por día de RapidAPI. Para continuar viendo partidos en vivo, suscríbete al plan Pro o espera la renovación de mañana.';
    apiState.isBlocked = true;
    apiState.blockReason = type;
    apiState.blockedUntil = Date.now() + 5 * 60 * 1000; // Pausar peticiones 5 minutos
    apiState.errorMessage = message;
  } else if (status === 403) {
    type = 'NOT_SUBSCRIBED';
    message = 'Tu cuenta de RapidAPI necesita tener activa la suscripción al plan de Football Live Stream API.';
    apiState.isBlocked = true;
    apiState.blockReason = type;
    apiState.blockedUntil = Date.now() + 5 * 60 * 1000;
    apiState.errorMessage = message;
  } else if (status === 401) {
    type = 'AUTH_ERROR';
    message = 'Clave de RapidAPI no autorizada o inválida.';
  }

  const err = new Error(message);
  err.type = type;
  err.status = status;
  throw err;
}

/**
 * Obtiene todos los partidos en vivo disponibles para streaming (CON CACHÉ de 3 min).
 */
export async function fetchAllLiveStreamMatches(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && CACHE.allMatches && (now - CACHE.allMatchesTime < MATCHES_CACHE_TTL)) {
    return { data: CACHE.allMatches, error: null };
  }

  if (apiState.isBlocked && now < apiState.blockedUntil) {
    return {
      data: CACHE.allMatches || [],
      error: {
        type: apiState.blockReason,
        message: apiState.errorMessage,
      },
    };
  }

  try {
    const data = await requestRapidApi('/all-match');
    const list = Array.isArray(data?.result) ? data.result : [];
    CACHE.allMatches = list;
    CACHE.allMatchesTime = now;
    return { data: list, error: null };
  } catch (err) {
    return {
      data: CACHE.allMatches || [],
      error: {
        type: err.type || 'UNKNOWN_ERROR',
        message: err.message,
      },
    };
  }
}

/**
 * Obtiene el enlace de transmisión (.m3u8 y visor web) para un ID de partido (CON CACHÉ de 30 min).
 */
export async function fetchMatchStreamLink(matchId) {
  if (!matchId) return null;
  const now = Date.now();

  const cached = CACHE.links.get(matchId);
  if (cached && (now - cached.timestamp < LINK_CACHE_TTL)) {
    return cached.data;
  }

  try {
    const data = await requestRapidApi(`/link/${matchId}`);
    const rawUrl = data?.url || data?.links?.[0]?.url || '';
    const m3u8Url = extractM3u8Url(rawUrl);

    const result = {
      rawUrl,
      m3u8Url: m3u8Url || rawUrl,
      iframeUrl: rawUrl.startsWith('http') ? rawUrl : '',
      links: data?.links || [],
    };

    CACHE.links.set(matchId, { data: result, timestamp: now });
    return result;
  } catch (err) {
    throw err;
  }
}

/**
 * Normaliza nombres de equipos eliminando tildes, signos y palabras comunes.
 */
export function normalizeTeamName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|cd|ca|sc|club|deportivo|atletico|real|rayados|saf|rj|sp|women|femenil|de)\b/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Comparación inteligente de equipos.
 */
export function matchTeams(homeA, awayA, homeB, awayB) {
  const normHomeA = normalizeTeamName(homeA);
  const normAwayA = normalizeTeamName(awayA);
  const normHomeB = normalizeTeamName(homeB);
  const normAwayB = normalizeTeamName(awayB);

  const tokensHomeA = normHomeA.split(' ').filter(t => t.length > 2);
  const tokensAwayA = normAwayA.split(' ').filter(t => t.length > 2);
  const tokensHomeB = normHomeB.split(' ').filter(t => t.length > 2);
  const tokensAwayB = normAwayB.split(' ').filter(t => t.length > 2);

  const homeMatch = tokensHomeA.some(t => normHomeB.includes(t)) || tokensHomeB.some(t => normHomeA.includes(t));
  const awayMatch = tokensAwayA.some(t => normAwayB.includes(t)) || tokensAwayB.some(t => normAwayA.includes(t));

  if (homeMatch && awayMatch) return 3;
  if (homeMatch || awayMatch) return 1;
  return 0;
}

/**
 * Busca inteligentemente la transmisión en vivo para el partido actual.
 */
export async function findStreamForMatch(homeTeamName, awayTeamName) {
  const res = await fetchAllLiveStreamMatches();
  const allMatches = res.data || [];

  if (res.error) {
    return {
      found: false,
      matchedMatch: null,
      stream: null,
      allMatches,
      error: res.error,
    };
  }

  if (!allMatches.length) {
    return { found: false, allMatches: [], error: null };
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const item of allMatches) {
    const score = matchTeams(homeTeamName, awayTeamName, item.home_name, item.away_name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
      if (score === 3) break;
    }
  }

  if (bestMatch && bestScore >= 1) {
    try {
      const stream = await fetchMatchStreamLink(bestMatch.id);
      return {
        found: true,
        matchedMatch: bestMatch,
        stream,
        allMatches,
        error: null,
      };
    } catch (err) {
      return {
        found: false,
        matchedMatch: bestMatch,
        stream: null,
        allMatches,
        error: {
          type: err.type || 'STREAM_ERROR',
          message: err.message,
        },
      };
    }
  }

  return {
    found: false,
    matchedMatch: null,
    stream: null,
    allMatches,
    error: null,
  };
}

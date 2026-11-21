// ========================================================
// SERVICIO DE TRANSMISIÓN DE FÚTBOL EN VIVO (RAPIDAPI)
// Con caché inteligente, control de cuotas y manejo de errores
// ========================================================

// La clave de RapidAPI no está en el navegador: todas las peticiones pasan por /api/rapidapi-stream,
// que agrega la clave en el servidor (proxy de Vite en desarrollo, función de Netlify en producción).
const STREAM_PROXY = '/api/rapidapi-stream';

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
 * Verifica si una URL apunta a una lista de reproducción HLS (.m3u8).
 */
export function isM3u8Url(url) {
  if (!url) return false;
  return /\.m3u8($|\?)/i.test(url);
}

/**
 * Retorna la URL procesada a través del proxy CORS local/Netlify para evitar
 * el error "No 'Access-Control-Allow-Origin' header is present on the requested resource".
 */
export function getProxiedHlsUrl(url, referer = '') {
  if (!url) return '';
  const clean = url.trim();
  // Si ya es relativa o ya apunta al proxy, devolver tal cual
  if (clean.startsWith('/api/hls-proxy') || clean.startsWith('/')) {
    return clean;
  }
  // Si es una URL http/https externa, enrutar por el proxy HLS
  if (/^https?:\/\//i.test(clean)) {
    const params = new URLSearchParams({ url: clean });
    if (referer) {
      params.set('referer', referer);
    }
    return `/api/hls-proxy?${params.toString()}`;
  }
  return clean;
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

  let response;
  try {
    response = await fetch(`${STREAM_PROXY}${path}`, { headers: { Accept: 'application/json' } });
  } catch {
    const err = new Error('No se pudo conectar con el servidor de transmisiones.');
    err.type = 'NETWORK_ERROR';
    throw err;
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
    const rawUrl = data?.url || data?.links?.[0]?.url || data?.servers?.[0]?.url || '';

    // Extraer referer si el proveedor lo envía en header.referer o similar
    const findReferer = (item) => {
      if (!item || typeof item !== 'object') return '';
      return item.header?.referer || 
             item.header?.Referer || 
             item.headers?.referer || 
             item.headers?.Referer || 
             item.referer || 
             item.Referer || 
             '';
    };

    let referer = findReferer(data);

    // Parsear servidores si existen
    const rawServers = Array.isArray(data?.servers)
      ? data.servers
      : Array.isArray(data?.links)
        ? data.links
        : [];

    const parsedServers = [];

    for (let i = 0; i < rawServers.length; i++) {
      const s = rawServers[i];
      const link = s?.url || (typeof s === 'string' ? s : '');
      if (!link) continue;

      let sRef = findReferer(s) || referer;
      let sM3u8 = '';
      let sIframe = '';

      if (link.includes('?url=')) {
        sM3u8 = extractM3u8Url(link);
        sIframe = link;
        if (!sRef) {
          try {
            sRef = new URL(link).origin + '/';
          } catch {
            // ignore
          }
        }
      } else if (isM3u8Url(link)) {
        sM3u8 = link;
      } else if (link.startsWith('http')) {
        sIframe = link;
      }

      parsedServers.push({
        id: i,
        name: s?.name || `Servidor ${i + 1}`,
        rawUrl: link,
        m3u8Url: sM3u8,
        iframeUrl: (sIframe && !isM3u8Url(sIframe)) ? sIframe : '',
        referer: sRef,
        type: s?.type || (sM3u8 ? 'hls' : 'iframe'),
      });
    }

    let m3u8Url = '';
    let iframeUrl = '';

    if (rawUrl) {
      if (rawUrl.includes('?url=')) {
        m3u8Url = extractM3u8Url(rawUrl);
        iframeUrl = rawUrl;
      } else if (isM3u8Url(rawUrl)) {
        m3u8Url = rawUrl;
      } else if (rawUrl.startsWith('http')) {
        iframeUrl = rawUrl;
      }
    }

    // Si aún no tenemos m3u8Url o iframeUrl, buscar en parsedServers
    if (!m3u8Url && parsedServers.length > 0) {
      const firstWithM3u8 = parsedServers.find(s => s.m3u8Url);
      if (firstWithM3u8) {
        m3u8Url = firstWithM3u8.m3u8Url;
        if (!referer) referer = firstWithM3u8.referer;
      }
    }

    if (!iframeUrl && parsedServers.length > 0) {
      const firstWithIframe = parsedServers.find(s => s.iframeUrl);
      if (firstWithIframe) {
        iframeUrl = firstWithIframe.iframeUrl;
      }
    }

    // Un enlace directo .m3u8 NUNCA debe ser iframeUrl porque los navegadores no renderizan .m3u8 en <iframe>
    if (iframeUrl && isM3u8Url(iframeUrl)) {
      iframeUrl = '';
    }

    const result = {
      rawUrl,
      m3u8Url: m3u8Url || (isM3u8Url(rawUrl) ? rawUrl : ''),
      iframeUrl,
      referer,
      servers: parsedServers,
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

// Netlify Function v2: Proxy HLS para transmisiones en vivo sin restricciones de CORS.
// Permite reproducir señales .m3u8 y segmentos .ts de cualquier servidor externo en el navegador.

function rewriteM3u8(content, baseUrl, proxyEndpoint) {
  const lines = content.split(/\r?\n/);
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      out.push(rawLine);
      continue;
    }

    if (line.startsWith('#')) {
      // Manejar etiquetas con atributos URI="..." (como #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA)
      if (line.includes('URI="')) {
        const rewrittenTag = line.replace(/URI="([^"]+)"/g, (_, uri) => {
          try {
            const absolute = new URL(uri, baseUrl).href;
            return `URI="${proxyEndpoint}?url=${encodeURIComponent(absolute)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
        out.push(rewrittenTag);
      } else {
        out.push(rawLine);
      }
    } else {
      // Línea de URI directa (segmento de video .ts / .m4s o sub-lista de reproducción .m3u8)
      try {
        const absolute = new URL(line, baseUrl).href;
        out.push(`${proxyEndpoint}?url=${encodeURIComponent(absolute)}`);
      } catch {
        out.push(rawLine);
      }
    }
  }

  return out.join('\n');
}

export default async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const reqUrl = new URL(req.url);
  const target = reqUrl.searchParams.get('url');

  if (!target) {
    return new Response(JSON.stringify({ error: 'Parámetro url requerido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let parsedTarget;
  try {
    parsedTarget = new URL(target);
    if (!/^https?:$/.test(parsedTarget.protocol)) {
      throw new Error('Protocolo no permitido');
    }
  } catch {
    return new Response(JSON.stringify({ error: 'URL inválida o no soportada' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const forwardHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Referer': parsedTarget.origin + '/',
    'Origin': parsedTarget.origin,
  };

  const range = req.headers.get('range');
  if (range) {
    forwardHeaders['Range'] = range;
  }

  try {
    const upstreamRes = await fetch(parsedTarget.toString(), {
      headers: forwardHeaders,
      redirect: 'follow',
    });

    const finalBaseUrl = upstreamRes.url || target;
    const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();
    const isM3u8ByPath = parsedTarget.pathname.toLowerCase().endsWith('.m3u8') || parsedTarget.search.toLowerCase().includes('.m3u8');
    const isM3u8ByType = contentType.includes('mpegurl') || contentType.includes('application/x-mpegurl');

    if (isM3u8ByPath || isM3u8ByType) {
      const text = await upstreamRes.text();
      if (text.startsWith('#EXTM3U') || isM3u8ByPath) {
        const proxyEndpoint = reqUrl.origin ? `${reqUrl.origin}/api/hls-proxy` : '/api/hls-proxy';
        const rewritten = rewriteM3u8(text, finalBaseUrl, proxyEndpoint);

        const resHeaders = new Headers(corsHeaders);
        resHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
        resHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');

        return new Response(rewritten, {
          status: upstreamRes.status,
          headers: resHeaders,
        });
      }
    }

    // Segmento binario (.ts, .m4s, etc.) o stream directo
    const resHeaders = new Headers(corsHeaders);
    if (contentType) resHeaders.set('Content-Type', contentType);
    else if (parsedTarget.pathname.endsWith('.ts')) resHeaders.set('Content-Type', 'video/mp2t');

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) resHeaders.set('Content-Length', contentLength);

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) resHeaders.set('Content-Range', contentRange);

    const acceptRanges = upstreamRes.headers.get('accept-ranges');
    if (acceptRanges) resHeaders.set('Accept-Ranges', acceptRanges);

    resHeaders.set('Cache-Control', 'public, max-age=3600');

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: resHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Error al conectar con la transmisión remota', details: err.message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/hls-proxy' };

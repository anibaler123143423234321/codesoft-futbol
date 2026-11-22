// Netlify Function v2: Proxy con caché para TheSportsDB
// Evita errores de CORS y 429 en el navegador cuando se consultan fotos de jugadores.

const CACHE = new Map();
const TTL = 24 * 60 * 60 * 1000; // 24 horas

export default async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const reqUrl = new URL(req.url);
  const player = reqUrl.searchParams.get('p') || '';
  if (!player.trim()) {
    return new Response(JSON.stringify({ player: null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const cleanPlayer = player.trim();
  const cached = CACHE.get(cleanPlayer);
  if (cached && Date.now() - cached.time < TTL) {
    return new Response(JSON.stringify(cached.data), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    });
  }

  const apiKey = process.env.THESPORTSDB_KEY || process.env.VITE_THESPORTSDB_KEY || '123';
  const targetUrl = `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchplayers.php?p=${encodeURIComponent(cleanPlayer.replace(/\s+/g, '_'))}`;

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
    });

    if (upstreamRes.status === 429) {
      // Si la API pública gratuita está saturada, responder con { player: null, rateLimited: true }
      // y cabeceras CORS para que el navegador no lance un fallo de red / CORS
      return new Response(JSON.stringify({ player: null, rateLimited: true }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    if (!upstreamRes.ok) {
      return new Response(JSON.stringify({ player: null }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await upstreamRes.json();
    CACHE.set(cleanPlayer, { data, time: Date.now() });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    });
  } catch {
    return new Response(JSON.stringify({ player: null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/sportsdb' };

// Proxy de producción hacia Football Live Stream API (RapidAPI): agrega la clave en el servidor.
// Configurá RAPIDAPI_KEY en Netlify (Site settings → Environment variables).
const HOST = 'football-live-stream-api.p.rapidapi.com';

export default async (req) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return Response.json({ error: 'RAPIDAPI_KEY no está configurada' }, { status: 500 });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/(\.netlify\/functions\/rapidapi-stream|api\/rapidapi-stream)/, '') || '/';
  const upstream = await fetch(`https://${HOST}${path}${url.search}`, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': HOST, Accept: 'application/json' },
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
  });
};

export const config = { path: '/api/rapidapi-stream/*' };

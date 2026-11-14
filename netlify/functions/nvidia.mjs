// Proxy de producción hacia NVIDIA NIM: agrega la clave en el servidor.
// Configurá NVIDIA_API_KEY en Netlify (Site settings → Environment variables).
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = process.env.NVIDIA_API_KEY;
  if (!key) return Response.json({ error: 'NVIDIA_API_KEY no está configurada' }, { status: 500 });

  const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: await req.text(),
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
  });
};

export const config = { path: '/api/nvidia/v1/chat/completions' };

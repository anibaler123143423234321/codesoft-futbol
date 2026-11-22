import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { WebSocketServer } from 'ws';

function chatWebSocketPlugin() {
  return {
    name: 'codesoft-chat-websocket',
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });

      server.httpServer?.on('upgrade', (request, socket, head) => {
        if (request.url === '/ws-chat') {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
          });
        }
      });

      wss.on('connection', (ws) => {
        console.log('⚡ [WebSocket Server] Nuevo usuario conectado al chat en vivo.');

        ws.on('message', (rawData) => {
          const str = rawData.toString();
          // Broadcast to ALL connected clients (including sender or others)
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
              client.send(str);
            }
          });
        });

        ws.on('close', () => {
          console.log('🔌 [WebSocket Server] Usuario desconectado.');
        });
      });
    },
  };
}

function rewriteM3u8Content(content, baseUrl, proxyEndpoint, customReferer = '') {
  const lines = content.split(/\r?\n/);
  const out = [];
  const refParam = customReferer ? `&referer=${encodeURIComponent(customReferer)}` : '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      out.push(rawLine);
      continue;
    }

    if (line.startsWith('#')) {
      if (line.includes('URI="')) {
        const rewrittenTag = line.replace(/URI="([^"]+)"/g, (_, uri) => {
          try {
            const absolute = new URL(uri, baseUrl).href;
            return `URI="${proxyEndpoint}?url=${encodeURIComponent(absolute)}${refParam}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
        out.push(rewrittenTag);
      } else {
        out.push(rawLine);
      }
    } else {
      try {
        const absolute = new URL(line, baseUrl).href;
        out.push(`${proxyEndpoint}?url=${encodeURIComponent(absolute)}${refParam}`);
      } catch {
        out.push(rawLine);
      }
    }
  }

  return out.join('\n');
}

function hlsProxyDevPlugin() {
  return {
    name: 'codesoft-hls-proxy-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/hls-proxy')) return next();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        try {
          const reqUrl = new URL(req.url, 'http://localhost:3000');
          const targetUrl = reqUrl.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Parámetro url requerido' }));
          }

          const parsedTarget = new URL(targetUrl);
          const customReferer = reqUrl.searchParams.get('referer') || req.headers['x-proxy-referer'] || '';

          const forwardHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          };

          // Solo enviar Referer / Origin si se solicita explícitamente.
          // Enviar parsedTarget.origin como Referer causa 403 Forbidden ("deny by referer access rule") en servidores como Byte-nginx / ebaclofen.
          if (customReferer) {
            try {
              const parsedRef = new URL(customReferer);
              forwardHeaders['Referer'] = customReferer;
              forwardHeaders['Origin'] = parsedRef.origin;
            } catch {
              forwardHeaders['Referer'] = customReferer;
            }
          }

          if (req.headers.range) {
            forwardHeaders['Range'] = req.headers.range;
          }

          let upstreamRes = await fetch(parsedTarget.toString(), {
            headers: forwardHeaders,
            redirect: 'follow',
          });

          // Si el servidor upstream devuelve 403 y se había enviado un Referer,
          // reintentar de inmediato sin Referer ni Origin. Servidores como Byte-nginx / ebaclofen
          // rechazan el referer ("deny by referer access rule") pero funcionan sin él.
          let effectiveReferer = customReferer;
          if (upstreamRes.status === 403 && forwardHeaders['Referer']) {
            const cleanHeaders = { ...forwardHeaders };
            delete cleanHeaders['Referer'];
            delete cleanHeaders['Origin'];
            const retryRes = await fetch(parsedTarget.toString(), {
              headers: cleanHeaders,
              redirect: 'follow',
            });
            if (retryRes.ok) {
              upstreamRes = retryRes;
              effectiveReferer = '';
            }
          }

          // Reenviar x-block-reason o x-exception-info si el servidor remoto lo envía
          const blockReason = upstreamRes.headers.get('x-block-reason') || upstreamRes.headers.get('x-exception-info');
          if (blockReason) {
            res.setHeader('x-block-reason', blockReason);
          }

          if (!upstreamRes.ok) {
            res.statusCode = upstreamRes.status;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              error: `El servidor de streaming remoto respondió con código ${upstreamRes.status}`,
              status: upstreamRes.status,
              blockReason: blockReason || null,
            }));
          }

          const finalBaseUrl = upstreamRes.url || targetUrl;
          const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();
          const isM3u8ByPath = parsedTarget.pathname.toLowerCase().endsWith('.m3u8') || parsedTarget.search.toLowerCase().includes('.m3u8');
          const isM3u8ByType = contentType.includes('mpegurl') || contentType.includes('application/x-mpegurl');

          if (isM3u8ByPath || isM3u8ByType) {
            const text = await upstreamRes.text();
            if (text.startsWith('#EXTM3U')) {
              const rewritten = rewriteM3u8Content(text, finalBaseUrl, '/api/hls-proxy', effectiveReferer);
              res.statusCode = upstreamRes.status;
              res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              return res.end(rewritten);
            }
          }

          res.statusCode = upstreamRes.status;
          if (contentType) res.setHeader('Content-Type', contentType);
          else if (parsedTarget.pathname.endsWith('.ts')) res.setHeader('Content-Type', 'video/mp2t');

          const contentLength = upstreamRes.headers.get('content-length');
          if (contentLength) res.setHeader('Content-Length', contentLength);
          const contentRange = upstreamRes.headers.get('content-range');
          if (contentRange) res.setHeader('Content-Range', contentRange);
          const acceptRanges = upstreamRes.headers.get('accept-ranges');
          if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

          const buf = await upstreamRes.arrayBuffer();
          return res.end(Buffer.from(buf));
        } catch (err) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const nvidiaKey = env.NVIDIA_API_KEY || env.VITE_NVIDIA_API_KEY || '';
  // La clave de RapidAPI vive solo en .env y la agrega el proxy: nunca llega al navegador
  const rapidApiKey = env.RAPIDAPI_KEY || '';

  return {
    plugins: [react(), chatWebSocketPlugin(), hlsProxyDevPlugin()],
    define: {
      '__NVIDIA_MODEL__': JSON.stringify(env.NVIDIA_MODEL || ''),
      // Señal por defecto del reproductor (SIGNAL_URL en .env); el usuario puede cambiarla en la app
      '__SIGNAL_URL__': JSON.stringify(env.SIGNAL_URL || ''),
    },
    server: {
      port: 3000,
      open: false,
      proxy: {
        '/api/sportsdb': {
          target: 'https://www.thesportsdb.com',
          changeOrigin: true,
          rewrite: (path) => {
            const u = new URL(path, 'http://localhost');
            const p = u.searchParams.get('p') || '';
            const key = env.VITE_THESPORTSDB_KEY || '123';
            return `/api/v1/json/${key}/searchplayers.php?p=${encodeURIComponent(p.replace(/\s+/g, '_'))}`;
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
        },
        '/api/rapidapi-stream': {
          target: 'https://football-live-stream-api.p.rapidapi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/rapidapi-stream/, ''),
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'football-live-stream-api.p.rapidapi.com',
            'Accept': 'application/json',
          },
        },
        '/api/espn': {
          target: 'https://site.api.espn.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/espn/, ''),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          },
        },
        // La clave de NVIDIA se agrega aquí, en el servidor: nunca llega al navegador
        '/api/nvidia': {
          target: 'https://integrate.api.nvidia.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/nvidia/, ''),
          headers: { Authorization: `Bearer ${nvidiaKey}` },
          proxyTimeout: 190000,
          timeout: 190000,
        },
      },
    },
  };
});

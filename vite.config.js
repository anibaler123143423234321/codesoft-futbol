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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const nvidiaKey = env.NVIDIA_API_KEY || env.VITE_NVIDIA_API_KEY || '';
  const apiFootballKey = env.API_FOOTBALL_KEY || env.VITE_API_FOOTBALL_KEY || '0d1b547abd001b381a4e9ae88ce5ef18';

  return {
    plugins: [react(), chatWebSocketPlugin()],
    define: {
      '__NVIDIA_API_KEY__': JSON.stringify(nvidiaKey),
      '__API_FOOTBALL_KEY__': JSON.stringify(apiFootballKey),
    },
    server: {
      port: 3000,
      open: false,
      proxy: {
        '/api/espn': {
          target: 'https://site.api.espn.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/espn/, ''),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          },
        },
        '/api/football': {
          target: 'https://v3.football.api-sports.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/football/, ''),
          headers: {
            'x-apisports-key': apiFootballKey,
            'Accept': 'application/json',
          },
        },
      },
    },
  };
});

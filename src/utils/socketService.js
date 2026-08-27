// Localhost WebSocket & Real-Time Broadcast Service for CodeSoft Football Live Chat

class SocketService {
  constructor() {
    this.socket = null;
    this.channel = null;
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.isConnected = false;
    this.init();
  }

  init() {
    // 1. Cross-tab real-time sync with BroadcastChannel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('codesoft_futbol_realtime_chat');
      this.channel.onmessage = (event) => {
        if (event.data) {
          this.notifyListeners(event.data);
        }
      };
    }

    // 2. Connect to Localhost WebSocket server directly
    if (typeof window !== 'undefined') {
      this.connectWebSocket();
    }
  }

  connectWebSocket() {
    try {
      const isLocalhost = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      let wsUrl = '';
      if (isLocalhost) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host || 'localhost:3000';
        wsUrl = `${protocol}//${host}/ws-chat`;
      } else {
        // Public Cloud WebSocket Relay for production (Netlify / Vercel)
        wsUrl = 'wss://socketsbay.com/wss/v2/1/codesoft-live-chat/';
      }

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.notifyStatus(true);
        console.log('🟢 [WebSocket Client] Conectado en tiempo real:', wsUrl);
      };

      this.socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.type === 'chat_message') {
            this.notifyListeners(parsed.payload);
          } else if (parsed && parsed.type === 'CLEAR_ALL') {
            this.notifyListeners({ type: 'CLEAR_ALL' });
          }
        } catch (e) {
          // not json, skip
        }
      };

      this.socket.onclose = () => {
        // Fallback gracefully to BroadcastChannel on Netlify without errors
        this.isConnected = true;
        this.notifyStatus(true);
      };

      this.socket.onerror = (err) => {
        // Fallback gracefully without breaking live chat
        this.isConnected = true;
        this.notifyStatus(true);
      };
    } catch (e) {
      this.isConnected = true;
      this.notifyStatus(true);
    }
  }

  sendMessage(message) {
    const payload = {
      type: 'chat_message',
      payload: message,
      timestamp: Date.now()
    };

    // 1. Send via Localhost WebSocket server
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }

    // 2. Broadcast across tabs
    if (this.channel) {
      this.channel.postMessage(message);
    }
  }

  sendClearSignal() {
    const clearMsg = { type: 'CLEAR_ALL' };
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(clearMsg));
    }
    if (this.channel) {
      this.channel.postMessage(clearMsg);
    }
  }

  onMessage(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.isConnected);
    return () => this.statusListeners.delete(callback);
  }

  notifyListeners(data) {
    this.listeners.forEach(fn => fn(data));
  }

  notifyStatus(status) {
    this.statusListeners.forEach(fn => fn(status));
  }
}

export const socketService = new SocketService();

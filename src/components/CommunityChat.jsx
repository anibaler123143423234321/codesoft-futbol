import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Eye, 
  Heart, 
  Send, 
  Smile, 
  Image as ImageIcon, 
  Sparkles,
  X,
  Trash2,
  Wifi,
  User
} from 'lucide-react';
import { SOCCER_GIFS } from '../api/mockData';
import { socketService } from '../utils/socketService';
import { sounds } from '../utils/soundEffects';

export default function CommunityChat({ matchTitle = 'Partido' }) {
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('codesoft_username') || `Fan_${Math.floor(100 + Math.random() * 900)}`;
  });
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [viewerCount, setViewerCount] = useState(1248);
  const [wsConnected, setWsConnected] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);

  const chatBoxRef = useRef(null);

  // Clear previous mock localStorage data on mount to ensure it starts at 0
  useEffect(() => {
    localStorage.removeItem('codesoft_chat_history');
    setMessages([]);
  }, []);

  // Connect to WebSocket service
  useEffect(() => {
    const unsubStatus = socketService.onStatusChange((connected) => {
      setWsConnected(connected);
    });

    const unsubMsg = socketService.onMessage((incomingMsg) => {
      if (incomingMsg.type === 'CLEAR_ALL') {
        setMessages([]);
        return;
      }
      setMessages((prev) => [...prev, incomingMsg]);
      sounds.playClick();
    });

    return () => {
      unsubStatus();
      unsubMsg();
    };
  }, []);

  // Safely auto-scroll ONLY the chat internal container (NEVER the whole window/page)
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  // Subtle viewer fluctuation
  useEffect(() => {
    const timer = setInterval(() => {
      setViewerCount(prev => prev + Math.floor(Math.random() * 5) - 2);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (!inputVal.trim()) return;

    sounds.playClick();
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const newMsg = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user: userName,
      badge: 'FAN',
      avatarBg: '#00d2ff',
      text: inputVal.trim(),
      time: timeNow
    };

    // Add locally and broadcast via WebSocket
    setMessages(prev => [...prev, newMsg]);
    socketService.sendMessage(newMsg);

    setInputVal('');
  };

  const handleSendGif = (gifUrl) => {
    sounds.playClick();
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const gifMsg = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user: userName,
      badge: 'FAN',
      avatarBg: '#00d2ff',
      gifUrl: gifUrl,
      time: timeNow
    };

    setMessages(prev => [...prev, gifMsg]);
    socketService.sendMessage(gifMsg);
    setShowGifPicker(false);
  };

  const handleClearChat = () => {
    sounds.playClick();
    setMessages([]);
    localStorage.removeItem('codesoft_chat_history');
    socketService.sendClearSignal();
  };

  const handleSaveUsername = (name) => {
    if (name.trim()) {
      setUserName(name.trim());
      localStorage.setItem('codesoft_username', name.trim());
    }
    setIsEditingUser(false);
  };

  return (
    <div className="chat-container" id="community-live-chat">
      {/* Chat Header */}
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={16} style={{ color: 'var(--cyan-neon)' }} />
          <span className="chat-title">Chat del partido</span>
          
          {/* WebSocket Live Indicator */}
          <span 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '4px', 
              fontSize: '0.65rem', 
              background: 'rgba(0, 255, 136, 0.12)', 
              color: 'var(--green-neon)', 
              padding: '2px 7px', 
              borderRadius: 'var(--radius-full)', 
              border: '1px solid rgba(0, 255, 136, 0.3)',
              fontWeight: 700 
            }}
            title="Conexión WebSocket en tiempo real activa"
          >
            <Wifi size={10} />
            WebSocket Live
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="chat-live-views">
            <Eye size={13} style={{ color: 'var(--red-live)' }} />
            <span>{viewerCount.toLocaleString()}</span>
          </div>

          {/* Clean Chat to 0 Button */}
          <button 
            className="icon-btn" 
            style={{ width: '28px', height: '28px' }}
            title="Limpiar chat (dejar en 0 mensajes)"
            onClick={handleClearChat}
          >
            <Trash2 size={13} style={{ color: 'var(--text-muted)' }} />
          </button>

          <button 
            className="btn-donate" 
            onClick={() => {
              sounds.playGoalChime();
              setShowDonationModal(true);
            }}
          >
            <Heart size={12} fill="var(--gold-neon)" />
            <span>Donar</span>
          </button>
        </div>
      </div>

      {/* User Nickname Banner */}
      <div 
        style={{ 
          background: 'rgba(255, 255, 255, 0.02)', 
          borderBottom: '1px solid var(--border-color)', 
          padding: '6px 16px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)'
        }}
      >
        {isEditingUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
            <input 
              type="text" 
              defaultValue={userName} 
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveUsername(e.target.value)}
              onBlur={(e) => handleSaveUsername(e.target.value)}
              className="chat-input"
              style={{ padding: '3px 8px', fontSize: '0.75rem', height: '24px' }}
            />
            <span style={{ fontSize: '0.68rem', color: 'var(--cyan-neon)' }}>Enter para guardar</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={12} style={{ color: 'var(--cyan-neon)' }} />
              <span>Chateando como: <strong style={{ color: '#fff' }}>{userName}</strong></span>
            </div>
            <button 
              style={{ background: 'none', border: 'none', color: 'var(--cyan-neon)', cursor: 'pointer', fontSize: '0.72rem' }}
              onClick={() => setIsEditingUser(true)}
            >
              Cambiar nombre
            </button>
          </>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="chat-messages-box" ref={chatBoxRef}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', margin: 'auto 0', padding: '16px 8px', color: 'var(--text-muted)' }}>
            <MessageSquare size={24} style={{ margin: '0 auto 6px', opacity: 0.3 }} />
            <p style={{ fontSize: '0.78rem', color: '#fff', fontWeight: 600, marginBottom: '2px' }}>
              El chat está listo y en 0 mensajes
            </p>
            <p style={{ fontSize: '0.7rem' }}>
              Sé el primero en enviar un comentario en vivo vía WebSocket.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="chat-msg-item">
              <div className="chat-user-avatar" style={{ background: msg.avatarBg || '#00d2ff', color: '#000' }}>
                {msg.user.charAt(0).toUpperCase()}
              </div>

              <div className="chat-msg-content">
                <div className="chat-user-row">
                  <span className="chat-username">{msg.user}</span>
                  {msg.isVip && <span className="chat-user-badge badge-vip">VIP</span>}
                  {msg.isMod && <span className="chat-user-badge badge-mod">MOD</span>}
                  {msg.isAi && <span className="chat-user-badge badge-ai" style={{ background: '#76b900', color: '#000' }}>NVIDIA IA</span>}
                  <span className="chat-msg-time" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {msg.time}
                  </span>
                </div>
                
                <p className="chat-text">{msg.text}</p>
                {msg.gif && (
                  <img src={msg.gif} alt="gif" className="chat-gif-img" />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* GIF Picker Overlay */}
      {showGifPicker && (
        <div className="gif-picker-popover" style={{ padding: '8px' }}>
          <div className="gif-picker-header">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>Seleccionar GIF</span>
            <button className="btn-icon" onClick={() => setShowGifPicker(false)}>
              <X size={13} />
            </button>
          </div>

          <div className="gif-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', maxHeight: '120px' }}>
            {SOCCER_GIFS.map((gif) => (
              <img
                key={gif.id}
                src={gif.url}
                alt={gif.title}
                className="gif-thumb"
                onClick={() => handleSendGif(gif.url)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Emoji Reactions Bar */}
      <div className="chat-reactions-row" style={{ padding: '4px 10px', gap: '4px' }}>
        {['🔥', '⚽', '👏', '😂', '🤑', '🎯'].map((emoji) => (
          <button
            key={emoji}
            className="chat-reaction-chip"
            style={{ padding: '1px 6px', fontSize: '0.7rem' }}
            onClick={() => {
              sounds.playClick();
              setInputVal(prev => prev + ' ' + emoji);
            }}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form className="chat-input-bar" onSubmit={handleSendMessage} style={{ padding: '6px 10px', gap: '6px' }}>
        <button
          type="button"
          className="chat-btn-gif"
          style={{ padding: '3px 6px', fontSize: '0.68rem' }}
          onClick={() => setShowGifPicker(prev => !prev)}
        >
          GIF
        </button>

        <input
          type="text"
          placeholder="Escribe en el chat..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          className="chat-input"
          style={{ padding: '4px 10px', fontSize: '0.76rem', height: '28px' }}
        />

        <button type="submit" className="chat-btn-send" style={{ width: '28px', height: '28px' }} title="Enviar mensaje">
          <Send size={13} />
        </button>
      </form>

      {/* Donation Modal */}
      {showDonationModal && (
        <div className="modal-backdrop" onClick={() => setShowDonationModal(false)}>
          <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <Heart size={44} style={{ color: 'var(--gold-neon)', margin: '0 auto 12px' }} fill="var(--gold-neon)" />
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
              Apoyar a CodeSoft Fútbol
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
              Gracias por ser parte de nuestra comunidad. Puedes apoyar el mantenimiento de servidores y modelos IA.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              {['$2 USD', '$5 USD', '$10 USD'].map(amt => (
                <button 
                  key={amt} 
                  className="btn-secondary" 
                  style={{ padding: '10px', fontSize: '0.85rem', justifyContent: 'center' }}
                  onClick={() => {
                    alert(`¡Gracias por tu donación de ${amt}!`);
                    setShowDonationModal(false);
                  }}
                >
                  {amt}
                </button>
              ))}
            </div>
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowDonationModal(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { 
  Film, Link2, Camera, MonitorUp, FileVideo, Tv, 
  Circle, Square, X, Search, RefreshCw, Play, 
  CheckCircle2, AlertCircle, ExternalLink, AlertTriangle 
} from 'lucide-react';
import { sounds } from '../utils/soundEffects';
import { 
  findStreamForMatch, 
  fetchAllLiveStreamMatches, 
  fetchMatchStreamLink, 
  extractM3u8Url 
} from '../api/footballStreamApi';

const STORAGE_KEY = 'codesoft.signalUrl';

const readSavedUrl = () => {
  try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
};
const saveUrl = (url) => {
  try { url ? localStorage.setItem(STORAGE_KEY, url) : localStorage.removeItem(STORAGE_KEY); } catch { /* sin almacenamiento */ }
};

// Decide cómo reproducir un enlace: HLS (.m3u8), YouTube, Twitch o video directo
export function parseSignalUrl(raw) {
  const url = (raw || '').trim();
  if (!url) return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.replace(/^www\./, '');

  if (host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    const id = host === 'youtu.be'
      ? u.pathname.slice(1)
      : u.searchParams.get('v') || (u.pathname.match(/\/(?:live|embed|shorts)\/([\w-]{6,})/) || [])[1];
    if (id) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1` };
  }
  if (host.endsWith('twitch.tv')) {
    const channel = u.pathname.split('/').filter(Boolean)[0];
    if (channel) {
      return { kind: 'iframe', src: `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&muted=true` };
    }
  }
  if (/\.m3u8($|\?)/i.test(u.pathname + u.search)) return { kind: 'hls', src: url };
  return { kind: 'video', src: url };
}

function fmtDuration(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

const MODES = [
  { key: 'livestream', label: 'Ver en vivo', icon: Tv },
  { key: 'clips', label: 'Clips ESPN', icon: Film },
  { key: 'url', label: 'URL', icon: Link2 },
  { key: 'camera', label: 'Cámara', icon: Camera },
  { key: 'screen', label: 'Pantalla', icon: MonitorUp },
  { key: 'file', label: 'Archivo', icon: FileVideo },
];

export default function SignalPlayer({ 
  match,
  externalMode,
  onModeChange,
  searchTrigger,
  clips = [], 
  clipsAreMatch = false, 
  onClipError, 
  scoreOverlay, 
  emptyText 
}) {
  const [mode, setMode] = useState(() => externalMode || 'livestream');
  const [urlInput, setUrlInput] = useState(readSavedUrl);
  const [activeUrl, setActiveUrl] = useState(readSavedUrl);
  const [clipIdx, setClipIdx] = useState(0);
  const [stream, setStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [fileSrc, setFileSrc] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);

  // Estados para la transmisión en vivo (RapidAPI)
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveStreamData, setLiveStreamData] = useState(null);
  const [matchedGame, setMatchedGame] = useState(null);
  const [allLiveGames, setAllLiveGames] = useState([]);
  const [playerType, setPlayerType] = useState('hls'); // 'hls' o 'iframe'
  const [searchQuery, setSearchQuery] = useState('');
  const [quotaError, setQuotaError] = useState(null);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const searchedMatchIdRef = useRef(null);

  // Sincronizar si el padre fuerza un cambio de modo
  useEffect(() => {
    if (externalMode && externalMode !== mode) {
      setMode(externalMode);
    }
  }, [externalMode]);

  const parsed = mode === 'url' ? parseSignalUrl(activeUrl) : null;
  const clip = clips[Math.min(clipIdx, Math.max(0, clips.length - 1))] || null;

  const homeName = match?.homeTeam?.name || match?.homeTeam?.shortName || '';
  const awayName = match?.awayTeam?.name || match?.awayTeam?.shortName || '';

  // Buscar transmisión automáticamente para el partido actual
  const executeSearch = useCallback(async (customQuery = null) => {
    setLiveLoading(true);
    setError('');
    setQuotaError(null);
    try {
      if (customQuery) {
        // Búsqueda manual por texto
        const res = await fetchAllLiveStreamMatches();
        if (res.error) {
          setQuotaError(res.error);
          return;
        }
        const all = res.data || [];
        setAllLiveGames(all);
        const q = customQuery.toLowerCase();
        const found = all.find(m => 
          m.home_name?.toLowerCase().includes(q) || 
          m.away_name?.toLowerCase().includes(q) ||
          m.league?.toLowerCase().includes(q)
        );
        if (found) {
          try {
            const streamInfo = await fetchMatchStreamLink(found.id);
            setMatchedGame(found);
            setLiveStreamData(streamInfo);
          } catch (linkErr) {
            if (linkErr.type === 'QUOTA_EXCEEDED' || linkErr.type === 'NOT_SUBSCRIBED') {
              setQuotaError(linkErr);
            } else {
              setError(linkErr.message || 'Error al obtener la señal.');
            }
          }
        } else {
          setLiveStreamData(null);
          setMatchedGame(null);
          setError(`No encontramos partidos con "${customQuery}". Podés elegir uno de la lista inferior.`);
        }
      } else {
        // Búsqueda inteligente por los equipos del partido actual
        const res = await findStreamForMatch(homeName, awayName);
        if (res.error) {
          setQuotaError(res.error);
          return;
        }
        setAllLiveGames(res.allMatches || []);
        if (res.found && res.stream) {
          setMatchedGame(res.matchedMatch);
          setLiveStreamData(res.stream);
        } else {
          setLiveStreamData(null);
          setMatchedGame(null);
        }
      }
    } catch (err) {
      if (err.type === 'QUOTA_EXCEEDED' || err.type === 'NOT_SUBSCRIBED') {
        setQuotaError(err);
      } else {
        console.error('Error al buscar streaming:', err);
        setError('Ocurrió un error al contactar el servicio de transmisión.');
      }
    } finally {
      setLiveLoading(false);
    }
  }, [homeName, awayName]);

  // Ejecutar búsqueda cuando se entra a modo livestream o cambia el partido
  useEffect(() => {
    if (mode === 'livestream') {
      if (match?.id !== searchedMatchIdRef.current || !liveStreamData) {
        searchedMatchIdRef.current = match?.id;
        executeSearch();
      }
    }
  }, [mode, match?.id, executeSearch]);

  // Si el padre incrementa searchTrigger, forzar re-búsqueda
  useEffect(() => {
    if (searchTrigger > 0) {
      setMode('livestream');
      executeSearch();
    }
  }, [searchTrigger, executeSearch]);

  // Seleccionar directamente un partido de la lista de RapidAPI
  const selectLiveGame = async (game) => {
    sounds.playClick();
    setLiveLoading(true);
    setError('');
    setQuotaError(null);
    try {
      const streamInfo = await fetchMatchStreamLink(game.id);
      setMatchedGame(game);
      setLiveStreamData(streamInfo);
    } catch (err) {
      if (err.type === 'QUOTA_EXCEEDED' || err.type === 'NOT_SUBSCRIBED') {
        setQuotaError(err);
      } else {
        setError('No se pudo cargar la transmisión de este partido.');
      }
    } finally {
      setLiveLoading(false);
    }
  };

  const stopStream = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    setStream(prev => {
      prev?.getTracks().forEach(t => t.stop());
      return null;
    });
  };

  // Liberar recursos al desmontar
  useEffect(() => () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }, []);
  useEffect(() => () => { stream?.getTracks().forEach(t => t.stop()); }, [stream]);
  useEffect(() => () => { if (fileSrc) URL.revokeObjectURL(fileSrc); }, [fileSrc]);

  // Conectar la fuente activa al <video>
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    let hls;

    if (mode === 'camera' || mode === 'screen') {
      el.srcObject = stream || null;
      if (stream) el.play().catch(() => {});
      return () => { el.srcObject = null; };
    }

    el.srcObject = null;

    // Reproducción HLS para modo URL
    if (mode === 'url' && parsed?.kind === 'hls') {
      if (Hls.isSupported()) {
        hls = new Hls({ lowLatencyMode: true });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setError('No se pudo cargar la señal HLS. Revisá el enlace .m3u8.');
        });
        hls.loadSource(parsed.src);
        hls.attachMedia(el);
      } else {
        el.src = parsed.src;
      }
      el.play().catch(() => {});
    }

    // Reproducción HLS para modo LIVESTREAM
    if (mode === 'livestream' && playerType === 'hls' && liveStreamData?.m3u8Url) {
      if (Hls.isSupported()) {
        hls = new Hls({ 
          lowLatencyMode: true,
          backBufferLength: 90
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            console.warn('HLS directo falló, alternando a visor web...', data);
            setPlayerType('iframe');
          }
        });
        hls.loadSource(liveStreamData.m3u8Url);
        hls.attachMedia(el);
      } else {
        el.src = liveStreamData.m3u8Url;
      }
      el.play().catch(() => {});
    }

    return () => { hls?.destroy(); };
  }, [mode, stream, parsed?.kind, parsed?.src, playerType, liveStreamData?.m3u8Url]);

  const switchMode = (next) => {
    sounds.playClick();
    setError('');
    if (next !== mode) stopStream();
    setMode(next);
    onModeChange?.(next);
    if (next === 'file' && !fileSrc) fileInputRef.current?.click();
  };

  const loadUrl = (e) => {
    e?.preventDefault();
    setError('');
    const clean = urlInput.trim();
    if (clean && !parseSignalUrl(clean)) {
      setError('Enlace no válido. Usá una dirección http(s): .m3u8, .mp4, YouTube o Twitch.');
      return;
    }
    setActiveUrl(clean);
    saveUrl(clean);
  };

  const startCamera = async (id = deviceId) => {
    setError('');
    stopStream();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: id ? { deviceId: { exact: id }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      setStream(s);
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter(d => d.kind === 'videoinput'));
      setDeviceId(s.getVideoTracks()[0]?.getSettings().deviceId || id);
    } catch (err) {
      setError(err?.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Habilitalo en el navegador para usar tu cámara o capturadora.'
        : 'No se encontró ninguna cámara o capturadora disponible.');
    }
  };

  const startScreen = async () => {
    setError('');
    stopStream();
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      s.getVideoTracks()[0]?.addEventListener('ended', () => setStream(null));
      setStream(s);
    } catch (err) {
      if (err?.name !== 'NotAllowedError') setError('No se pudo iniciar la captura de pantalla.');
    }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    setFileSrc(URL.createObjectURL(f));
    setFileName(f.name);
    setMode('file');
  };

  const toggleRecording = () => {
    sounds.playClick();
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (!stream || typeof MediaRecorder === 'undefined') return;
    const chunks = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
    rec.onstop = () => {
      setRecording(false);
      if (!chunks.length) return;
      const href = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'video/webm' }));
      const a = document.createElement('a');
      a.href = href;
      a.download = `senal-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 5000);
    };
    recorderRef.current = rec;
    rec.start(1000);
    setRecording(true);
  };

  const isStreamMode = mode === 'camera' || mode === 'screen';
  const showVideoEl =
    (isStreamMode && stream) ||
    (mode === 'url' && parsed && parsed.kind !== 'iframe') ||
    (mode === 'livestream' && playerType === 'hls' && liveStreamData?.m3u8Url) ||
    (mode === 'file' && fileSrc) ||
    (mode === 'clips' && clip);

  const directSrc =
    mode === 'clips' ? clip?.src
      : mode === 'file' ? fileSrc
        : mode === 'url' && parsed?.kind === 'video' ? parsed.src
          : undefined;

  const liveBadge = (mode === 'url' && parsed) || 
                    (isStreamMode && stream) || 
                    (mode === 'livestream' && liveStreamData);

  return (
    <div className="sp">
      {/* Pestañas de origen de señal */}
      <div className="sp-sources" role="tablist" aria-label="Fuente de video">
        <span className="sp-sources-label">Señal</span>
        {MODES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={mode === key}
            className={`sp-source ${mode === key ? 'active' : ''} ${key === 'livestream' ? 'sp-source-live' : ''}`}
            onClick={() => switchMode(key)}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
        {isStreamMode && stream && (
          <button className={`sp-rec ${recording ? 'on' : ''}`} onClick={toggleRecording} title="Grabar esta señal en tu equipo">
            {recording ? <Square size={11} fill="currentColor" /> : <Circle size={11} fill="currentColor" />}
            {recording ? 'Detener' : 'Grabar'}
          </button>
        )}
      </div>

      {/* Barra de control para TRANSMISIÓN EN VIVO */}
      {mode === 'livestream' && (
        <div className="sp-urlbar sp-stream-bar">
          <form 
            className="sp-stream-search-form" 
            onSubmit={(e) => { e.preventDefault(); executeSearch(searchQuery.trim() || null); }}
          >
            <Search size={14} className="sp-search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={homeName ? `Buscar transmisión (${homeName} vs ${awayName})` : "Buscar partido o liga..."}
              aria-label="Buscar partido en vivo"
              spellCheck={false}
            />
            <button type="submit" className="sp-go" disabled={liveLoading}>
              {liveLoading ? <RefreshCw size={13} className="spin" /> : 'Buscar'}
            </button>
          </form>

          {liveStreamData && (
            <div className="sp-player-toggle">
              <button 
                type="button"
                className={`sp-toggle-btn ${playerType === 'hls' ? 'active' : ''}`}
                onClick={() => setPlayerType('hls')}
                title="Reproductor directo de alta fidelidad HLS"
              >
                HLS Directo
              </button>
              <button 
                type="button"
                className={`sp-toggle-btn ${playerType === 'iframe' ? 'active' : ''}`}
                onClick={() => setPlayerType('iframe')}
                title="Visor web integrado"
              >
                Visor Web
              </button>
            </div>
          )}
        </div>
      )}

      {/* Barra de control para URL personalizada */}
      {mode === 'url' && (
        <form className="sp-urlbar" onSubmit={loadUrl}>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Pegá el enlace de tu señal: .m3u8, .mp4, YouTube o Twitch"
            aria-label="Enlace de la señal"
            spellCheck={false}
          />
          <button type="submit" className="sp-go">Cargar</button>
          {activeUrl && (
            <button
              type="button"
              className="sp-clear"
              title="Quitar señal"
              onClick={() => { setUrlInput(''); setActiveUrl(''); saveUrl(''); setError(''); }}
            >
              <X size={14} />
            </button>
          )}
        </form>
      )}

      {/* Selector de cámara si hay múltiples */}
      {mode === 'camera' && devices.length > 1 && (
        <div className="sp-urlbar">
          <select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); startCamera(e.target.value); }} aria-label="Dispositivo de video">
            {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Dispositivo ${i + 1}`}</option>)}
          </select>
        </div>
      )}

      {/* Escenario de video principal */}
      <div className="sp-stage">
        {/* Iframe para URL o Livestream visor web */}
        {((mode === 'url' && parsed?.kind === 'iframe') || 
          (mode === 'livestream' && playerType === 'iframe' && liveStreamData?.iframeUrl)) && (
          <iframe
            key={mode === 'livestream' ? liveStreamData.iframeUrl : parsed.src}
            src={mode === 'livestream' ? liveStreamData.iframeUrl : parsed.src}
            title="Señal en vivo"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        )}

        {/* Video HTML5 / HLS */}
        {showVideoEl && (
          <video
            key={mode === 'clips' ? `clip-${clip?.id}` : `${mode}-${playerType}`}
            ref={videoRef}
            src={directSrc}
            poster={mode === 'clips' ? clip?.thumbnail : undefined}
            controls
            playsInline
            autoPlay={mode !== 'clips'}
            muted={isStreamMode}
            preload="metadata"
            referrerPolicy="no-referrer"
            onError={() => {
              if (mode === 'clips') onClipError?.(clip?.id);
              else if (mode === 'livestream') setPlayerType('iframe');
              else if (directSrc) setError('No se pudo reproducir este video. Probá con un enlace directo o el visor web.');
            }}
          />
        )}

        {/* Estado de carga de transmisión */}
        {mode === 'livestream' && liveLoading && (
          <div className="sp-empty">
            <RefreshCw size={34} className="spin text-accent" />
            <h4>Conectando con la señal en vivo...</h4>
            <p>Buscando canales de transmisión oficiales para <b>{homeName} vs {awayName}</b></p>
          </div>
        )}

        {/* ALERTA DE CUOTA O SUSCRIPCIÓN EN LIVESTREAM */}
        {mode === 'livestream' && quotaError && !liveLoading && (
          <div className="sp-quota-banner">
            <div className="sp-quota-icon">
              <AlertTriangle size={36} color="#f59e0b" />
            </div>
            <h4>
              {quotaError.type === 'QUOTA_EXCEEDED' 
                ? 'Límite de peticiones alcanzado (50 / día)' 
                : 'Suscripción requerida en RapidAPI'}
            </h4>
            <p>{quotaError.message}</p>
            <div className="sp-quota-actions">
              <a
                href="https://rapidapi.com/Thawtarlamin/api/football-live-stream-api/pricing"
                target="_blank"
                rel="noreferrer"
                className="sp-btn-upgrade"
              >
                <ExternalLink size={13} /> Activar o Mejorar Plan (RapidAPI)
              </a>
              <button
                type="button"
                className="sp-btn-fallback"
                onClick={() => switchMode('url')}
              >
                <Link2 size={13} /> Conectar señal propia por URL (.m3u8)
              </button>
            </div>
            <span className="sp-quota-note">
              Tu web está protegida: las peticiones automáticas se han pausado para evitar errores.
            </span>
          </div>
        )}

        {/* Estado vacío cuando no hay video en Livestream */}
        {mode === 'livestream' && !liveLoading && !liveStreamData && !quotaError && (
          <div className="sp-empty">
            <Tv size={34} />
            <h4>Sin transmisión directa activa</h4>
            <p>
              {homeName 
                ? `No encontramos señal abierta de transmisión en este momento para ${homeName} vs ${awayName}.` 
                : 'Seleccioná un partido para ver su señal en vivo.'}
            </p>
            {allLiveGames.length > 0 && (
              <p style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Podés hacer clic en cualquiera de los partidos en vivo disponibles abajo para ver su transmisión:
              </p>
            )}
            <button 
              className="sp-cta" 
              onClick={() => executeSearch()} 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} /> Reintentar búsqueda
            </button>
          </div>
        )}

        {/* Estados vacíos de otros modos */}
        {!showVideoEl && !liveLoading && !(mode === 'url' && parsed?.kind === 'iframe') && mode !== 'livestream' && (
          <div className="sp-empty">
            <Tv size={30} />
            {mode === 'clips' && (<><h4>Sin video disponible</h4><p>{emptyText}</p></>)}
            {mode === 'url' && (
              <>
                <h4>Conectá tu señal en vivo</h4>
                <p>Pegá arriba el enlace de tu transmisión (HLS .m3u8, .mp4, YouTube Live o Twitch). Queda guardado en este navegador.</p>
              </>
            )}
            {mode === 'camera' && (
              <>
                <h4>Cámara o capturadora</h4>
                <p>Usá una webcam o una capturadora HDMI/USB conectada a este equipo como señal del partido.</p>
                <button className="sp-cta" onClick={() => startCamera()}>Activar cámara</button>
              </>
            )}
            {mode === 'screen' && (
              <>
                <h4>Compartir pantalla o ventana</h4>
                <p>Mostrá aquí una ventana, pestaña o pantalla donde ya tengas tu señal abierta.</p>
                <button className="sp-cta" onClick={startScreen}>Elegir pantalla</button>
              </>
            )}
            {mode === 'file' && (
              <>
                <h4>Video grabado</h4>
                <p>Cargá un archivo de video de tu equipo (mp4, webm, mov). No se sube a ningún servidor.</p>
                <button className="sp-cta" onClick={() => fileInputRef.current?.click()}>Elegir archivo</button>
              </>
            )}
          </div>
        )}

        {/* Overlays de estado sobre el video */}
        <div className="sp-overlay">
          {liveBadge && <span className="sp-live"><i />EN VIVO</span>}
          
          {mode === 'livestream' && matchedGame && (
            <span className="sp-tag sp-tag-live">
              <CheckCircle2 size={12} color="#22c55e" />
              <b>{matchedGame.league}</b> · {matchedGame.home_name} {matchedGame.score} {matchedGame.away_name}
            </span>
          )}

          {mode === 'clips' && clip && !clipsAreMatch
            ? <span className="sp-tag">ESPN · últimos videos, no es este partido</span>
            : (mode !== 'livestream' ? scoreOverlay : null)}
            
          {mode === 'file' && fileName && <span className="sp-tag">{fileName}</span>}
        </div>

        {error && <div className="sp-error" role="alert">{error}</div>}
      </div>

      {/* Carrusel de partidos EN VIVO transmitiéndose ahora */}
      {mode === 'livestream' && allLiveGames.length > 0 && (
        <div className="sp-live-feed-bar">
          <span className="sp-live-feed-title">Partidos en streaming:</span>
          <div className="sp-live-feed-list">
            {allLiveGames.map((g) => {
              const isSelected = matchedGame?.id === g.id;
              return (
                <button
                  key={g.id}
                  className={`sp-live-game-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => selectLiveGame(g)}
                  title={`Ver ${g.home_name} vs ${g.away_name} (${g.league})`}
                >
                  <span className="chip-league">{g.league}</span>
                  <span className="chip-teams">{g.home_name} <b>{g.score}</b> {g.away_name}</span>
                  {isSelected && <span className="chip-badge">VIENDO</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra de clips de ESPN */}
      {mode === 'clips' && clips.length > 0 && (
        <div className="sp-clips">
          {clips.map((v, i) => (
            <button
              key={v.id}
              className={`sp-clip ${v.id === clip?.id ? 'active' : ''}`}
              onClick={() => { sounds.playClick(); setClipIdx(i); }}
              title={v.title}
            >
              {v.thumbnail ? <img src={v.thumbnail} alt="" loading="lazy" /> : <Film size={16} />}
              <span>{v.title}</span>
              {v.duration > 0 && <small>{fmtDuration(v.duration)}</small>}
            </button>
          ))}
        </div>
      )}

      {/* Barra de archivo local */}
      {mode === 'file' && fileSrc && (
        <div className="sp-filebar">
          <span>{fileName}</span>
          <button onClick={() => fileInputRef.current?.click()}>Cambiar archivo</button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="video/*" hidden onChange={onFile} />
    </div>
  );
}

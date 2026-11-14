import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Film, Link2, Camera, MonitorUp, FileVideo, Tv, Circle, Square, X } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

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
  { key: 'clips', label: 'Clips ESPN', icon: Film },
  { key: 'url', label: 'URL', icon: Link2 },
  { key: 'camera', label: 'Cámara', icon: Camera },
  { key: 'screen', label: 'Pantalla', icon: MonitorUp },
  { key: 'file', label: 'Archivo', icon: FileVideo },
];

export default function SignalPlayer({ clips = [], clipsAreMatch = false, onClipError, scoreOverlay, emptyText }) {
  const [mode, setMode] = useState(() => (readSavedUrl() ? 'url' : 'clips'));
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

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);

  const parsed = mode === 'url' ? parseSignalUrl(activeUrl) : null;
  const clip = clips[Math.min(clipIdx, Math.max(0, clips.length - 1))] || null;

  const stopStream = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    setStream(prev => {
      prev?.getTracks().forEach(t => t.stop());
      return null;
    });
  };

  // Liberar cámara / captura al desmontar
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
    if (mode === 'url' && parsed?.kind === 'hls') {
      if (Hls.isSupported()) {
        hls = new Hls({ lowLatencyMode: true });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setError('No se pudo cargar la señal HLS. Revisá que el enlace .m3u8 esté activo y permita reproducirse desde esta página (CORS).');
        });
        hls.loadSource(parsed.src);
        hls.attachMedia(el);
      } else {
        el.src = parsed.src; // Safari reproduce HLS de forma nativa
      }
      el.play().catch(() => {});
    }
    return () => { hls?.destroy(); };
  }, [mode, stream, parsed?.kind, parsed?.src]);

  const switchMode = (next) => {
    sounds.playClick();
    setError('');
    if (next !== mode) stopStream();
    setMode(next);
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

  // Grabar la señal de cámara / pantalla a un archivo .webm local
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
    (mode === 'file' && fileSrc) ||
    (mode === 'clips' && clip);

  const directSrc =
    mode === 'clips' ? clip?.src
      : mode === 'file' ? fileSrc
        : mode === 'url' && parsed?.kind === 'video' ? parsed.src
          : undefined;

  const liveBadge = (mode === 'url' && parsed) || (isStreamMode && stream);

  return (
    <div className="sp">
      <div className="sp-sources" role="tablist" aria-label="Fuente de video">
        <span className="sp-sources-label">Señal</span>
        {MODES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={mode === key}
            className={`sp-source ${mode === key ? 'active' : ''}`}
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

      {mode === 'camera' && devices.length > 1 && (
        <div className="sp-urlbar">
          <select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); startCamera(e.target.value); }} aria-label="Dispositivo de video">
            {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Dispositivo ${i + 1}`}</option>)}
          </select>
        </div>
      )}

      <div className="sp-stage">
        {mode === 'url' && parsed?.kind === 'iframe' && (
          <iframe
            key={parsed.src}
            src={parsed.src}
            title="Señal en vivo"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        )}

        {showVideoEl && (
          <video
            key={mode === 'clips' ? `clip-${clip?.id}` : mode}
            ref={videoRef}
            src={directSrc}
            poster={mode === 'clips' ? clip?.thumbnail : undefined}
            controls
            playsInline
            autoPlay={mode !== 'clips'}
            muted={isStreamMode}
            preload="metadata"
            onError={() => {
              if (mode === 'clips') onClipError?.(clip?.id);
              else if (directSrc) setError('No se pudo reproducir este video. Probá con un enlace .m3u8 / .mp4 directo, YouTube o Twitch.');
            }}
          />
        )}

        {!showVideoEl && !(mode === 'url' && parsed?.kind === 'iframe') && (
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

        <div className="sp-overlay">
          {liveBadge && <span className="sp-live"><i />EN VIVO</span>}
          {mode === 'clips' && clip && !clipsAreMatch
            ? <span className="sp-tag">ESPN · últimos videos, no es este partido</span>
            : scoreOverlay}
          {mode === 'file' && fileName && <span className="sp-tag">{fileName}</span>}
        </div>

        {error && <div className="sp-error" role="alert">{error}</div>}
      </div>

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

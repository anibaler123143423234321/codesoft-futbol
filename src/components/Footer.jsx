import React from 'react';
import { Zap } from 'lucide-react';

const SECTIONS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'envivo', label: 'En vivo' },
  { id: 'cartelera', label: 'Cartelera' },
  { id: 'picks', label: 'Picks IA' },
  { id: 'estadisticas', label: 'Estadísticas' },
  { id: 'comunidad', label: 'Comunidad' },
];

export default function Footer({ setView }) {
  const go = (id) => {
    setView?.(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-brand-col">
          <div className="footer-logo">
            <div className="logo-icon" aria-hidden="true">
              <Zap size={16} fill="#05060a" />
            </div>
            <span>CodeSoft <b>Fútbol</b></span>
          </div>
          <p className="footer-tagline">
            Marcadores al minuto, estadísticas oficiales de ESPN y picks con IA que muestran de dónde sale cada dato.
          </p>
        </div>

        <nav className="footer-col" aria-label="Secciones">
          <h4>Secciones</h4>
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}><button type="button" onClick={() => go(s.id)}>{s.label}</button></li>
            ))}
          </ul>
        </nav>

        <div className="footer-col">
          <h4>Datos</h4>
          <ul className="footer-sources">
            <li><span>Estadísticas y alineaciones</span><b>ESPN</b></li>
            <li><span>Fotos de jugadores</span><b>TheSportsDB</b></li>
            <li><span>Modelos de IA</span><b>NVIDIA NIM</b></li>
            <li><span>Cuotas</span><b>Proveedor de cada partido</b></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} CodeSoft Fútbol. Todos los derechos reservados.</span>
        <span className="footer-age">+18 · Los pronósticos son informativos, no garantías. Juega con responsabilidad.</span>
      </div>
      <p className="footer-credit">Sonido de gol: «Goal!» de blaukreuz en Freesound (CC0).</p>
    </footer>
  );
}

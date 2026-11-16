import React from 'react';
import { Zap } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        {/* Brand & Rights */}
        <div className="footer-brand-col">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div className="logo-icon" style={{ width: '28px', height: '28px' }}>
              <Zap size={16} fill="#05060a" />
            </div>
            <span style={{ fontFamily: 'var(--font-score)', fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>
              CodeSoft <span style={{ color: 'var(--cyan-neon)' }}>Fútbol</span>
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} CodeSoft en el Futbol. Todos los derechos reservados.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="footer-disclaimer">
          <p>
            Plataforma de seguimiento en vivo y análisis con datos estadísticos de ESPN y modelos de inteligencia artificial servidos por NVIDIA NIM. Las predicciones son meramente informativas y orientativas, no garantías. Jugá con responsabilidad (+18).
          </p>
        </div>

        {/* Insignia del motor de IA */}
        <div className="footer-badge-col">
          <div className="pill-badge-green" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
            <Zap size={14} style={{ color: '#76b900' }} />
            <span>Análisis con IA · NVIDIA NIM</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

import React from 'react';
import { Send, Zap, Shield, Heart } from 'lucide-react';

export default function Footer({ onOpenTelegram }) {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        {/* Brand & Rights */}
        <div>
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
            Plataforma deportiva de análisis predictivo y seguimiento en vivo basada en datos estadísticos de ESPN y modelos de Inteligencia Artificial con NVIDIA NIM (Llama 3.1 70B). Las predicciones son meramente informativas y orientativas. Juega con responsabilidad (+18).
          </p>
        </div>

        {/* Betano IA Badge */}
        <div>
          <div className="pill-badge-green" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
            <Zap size={14} />
            <span>Motor Predictivo Betano IA Activo</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

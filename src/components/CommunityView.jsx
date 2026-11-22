import React, { useMemo } from 'react';
import { Users, Trophy, MessageSquare, Vote } from 'lucide-react';
import CommunityChat from './CommunityChat';

const VOTE_LABEL = { home: 'Local', draw: 'Empate', away: 'Visita' };

// Pronósticos que dejaste en las encuestas "¿Quién ganará?" (se guardan solo en este navegador)
function readLocalVotes() {
  const votes = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('poll_vote_')) {
        votes.push({ matchId: key.slice('poll_vote_'.length), vote: localStorage.getItem(key) });
      }
    }
  } catch {
    /* almacenamiento no disponible */
  }
  return votes;
}

export default function CommunityView() {
  const votes = useMemo(readLocalVotes, []);
  const tally = votes.reduce((acc, v) => ({ ...acc, [v.vote]: (acc[v.vote] || 0) + 1 }), {});

  return (
    <div className="community-view-container" id="community-hub-view">
      <div className="community-header-banner">
        <div>
          <div className="section-tag">
            <Users size={14} />
            <span>Comunidad</span>
          </div>
          <h1 className="community-banner-title">Habla de fútbol mientras se juega</h1>
          <p className="community-banner-subtitle">
            Comenta la jornada en el chat, vota quién gana cada partido y compara tu lectura con la del análisis con IA.
          </p>
        </div>
      </div>

      <div className="community-grid-layout">
        <div className="community-chat-col">
          <h3 className="community-col-title">
            <MessageSquare size={18} style={{ color: 'var(--cyan-neon)' }} />
            <span>Chat global de la jornada</span>
          </h3>
          <CommunityChat title="Sala general" />
        </div>

        <div>
          <h3 className="community-col-title">
            <Vote size={18} style={{ color: 'var(--gold-neon)' }} />
            <span>Tus pronósticos</span>
          </h3>

          <div className="community-votes-card">
            <div className="community-votes-total">
              <b>{votes.length}</b>
              <span>{votes.length === 1 ? 'pronóstico registrado' : 'pronósticos registrados'}</span>
            </div>
            <div className="community-votes-split">
              {['home', 'draw', 'away'].map(k => (
                <div key={k} className={`v-${k}`}>
                  <b>{tally[k] || 0}</b>
                  <span>{VOTE_LABEL[k]}</span>
                </div>
              ))}
            </div>
            {votes.length === 0 && (
              <p className="community-votes-empty">
                Aún no has votado en ningún partido. Abre un partido en <b>En vivo</b> y responde
                “¿Quién ganará?” para empezar tu historial.
              </p>
            )}

            <div className="community-ranking-note">
              <Trophy size={14} />
              <span>
                El ranking entre usuarios se activa cuando la app tenga cuentas: hoy tus votos se
                guardan solo en este navegador.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

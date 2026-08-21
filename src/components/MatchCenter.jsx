import React from 'react';
import { ArrowLeft, Flag, Clock, Radio, Tv, Sparkles, ChevronRight, Calendar } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import LiveStatsBars from './LiveStatsBars';
import MatchEventsTimeline from './MatchEventsTimeline';
import PredictionPoll from './PredictionPoll';
import CommunityChat from './CommunityChat';
import TeamLogo from './TeamLogo';
import { sounds } from '../utils/soundEffects';
import { useLiveMatchTimer } from '../hooks/useLiveMatchTimer';

export default function MatchCenter({ 
  match, 
  allMatches = [], 
  liveMatches = [], 
  onSelectMatch, 
  onBack, 
  onOpenPickModal 
}) {
  if (!match) return null;

  const { formattedTime, isLive, isHalftime, isFinished, isScheduled } = useLiveMatchTimer(match);

  return (
    <div className="match-center-container" id="match-center-view">
      {/* Unified Compact Top Bar: Navigation + League + Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <button
          className="btn-secondary"
          style={{ padding: '4px 12px', fontSize: '0.76rem' }}
          onClick={() => {
            sounds.playClick();
            onBack();
          }}
        >
          <ArrowLeft size={13} />
          <span>Volver a cartelera</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="match-league-label" style={{ fontSize: '0.7rem' }}>{match.leagueName || 'FÚTBOL INTERNACIONAL'}</span>
          {isScheduled && (
            <span className="pill-badge-gold" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
              🕒 {formattedTime}
            </span>
          )}
          {isLive && (
            <span className="pill-badge-red" style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(255,51,102,0.15)', color: 'var(--red-live)', border: '1px solid rgba(255,51,102,0.3)', borderRadius: 'var(--radius-full)' }}>
              🔴 EN VIVO {formattedTime}
            </span>
          )}
          {isFinished && (
            <span className="pill-badge-green" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
              🏁 FINALIZADO (FT)
            </span>
          )}
        </div>

        {liveMatches.length > 0 && match.id !== liveMatches[0].id && (
          <button 
            className="btn-primary" 
            style={{ padding: '4px 10px', fontSize: '0.72rem' }}
            onClick={() => onSelectMatch(liveMatches[0])}
          >
            <span>Ver {liveMatches[0].homeTeam?.shortName} vs {liveMatches[0].awayTeam?.shortName}</span>
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Main Scoreboard Header */}
      <div className="match-center-header">
        {/* Home Team */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
              {match.homeTeam?.name}
            </h2>
            {(match.homeTeam?.yellowCards > 0 || match.homeTeam?.redCards > 0) && (
              <div className="mc-cards-indicator" style={{ justifyContent: 'flex-end' }}>
                {match.homeTeam?.yellowCards > 0 && <span className="card-pill-yellow">🟨 {match.homeTeam.yellowCards}</span>}
                {match.homeTeam?.redCards > 0 && <span className="card-pill-red">🟥 {match.homeTeam.redCards}</span>}
              </div>
            )}
          </div>
          
          <TeamLogo
            src={match.homeTeam?.logo}
            alt={match.homeTeam?.name}
            size={42}
            isHome={true}
          />
        </div>

        {/* Center Score & Status */}
        <div style={{ textAlign: 'center', padding: '0 20px' }}>
          <div className="mc-live-indicator" style={{ justifyContent: 'center' }}>
            {isLive ? (
              <>
                <span className="live-dot" />
                <span>EN VIVO</span>
              </>
            ) : isFinished ? (
              <span style={{ color: 'var(--cyan-neon)' }}>FINALIZADO</span>
            ) : (
              <span style={{ color: 'var(--gold-neon)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} />
                <span>POR INICIAR</span>
              </span>
            )}
          </div>

          <div className="mc-scoreboard">
            {isScheduled ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '1.7rem', letterSpacing: '3px' }}>VS</span>
            ) : (
              <>
                <span>{match.homeTeam?.score ?? 0}</span>
                <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>-</span>
                <span>{match.awayTeam?.score ?? 0}</span>
              </>
            )}
          </div>

          <div style={{ fontSize: '0.84rem', color: isLive ? 'var(--cyan-neon)' : isFinished ? 'var(--green-neon)' : 'var(--text-muted)', fontFamily: 'var(--font-score)', fontWeight: 800, letterSpacing: '0.5px' }}>
            {formattedTime}
          </div>
        </div>

        {/* Away Team */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-start' }}>
          <TeamLogo
            src={match.awayTeam?.logo}
            alt={match.awayTeam?.name}
            size={42}
            isHome={false}
          />
          
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
              {match.awayTeam?.name}
            </h2>
            {(match.awayTeam?.yellowCards > 0 || match.awayTeam?.redCards > 0) && (
              <div className="mc-cards-indicator" style={{ justifyContent: 'flex-start' }}>
                {match.awayTeam?.yellowCards > 0 && <span className="card-pill-yellow">🟨 {match.awayTeam.yellowCards}</span>}
                {match.awayTeam?.redCards > 0 && <span className="card-pill-red">🟥 {match.awayTeam.redCards}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Left (Player & Stats) / Right (Poll & Chat) */}
      <div className="match-center-layout">
        {/* Left Column */}
        <div className="main-match-col">
          {/* Video Player & Server Selector */}
          <VideoPlayer match={match} onOpenPickModal={onOpenPickModal} />

          {/* Goal Scorers Timeline from real ESPN keyEvents */}
          <MatchEventsTimeline match={match} />

          {/* SofaScore-Style Match Hub: Statistics, H2H, Incidents, Rosters, Info */}
          <LiveStatsBars
            stats={match.stats}
            scorers={match.scorers || []}
            rosters={match.rosters || []}
            commentary={match.commentary || []}
            gameInfo={match.gameInfo || {}}
            linescores={match.linescores || {}}
            homeName={match.homeTeam?.shortName || match.homeTeam?.name}
            awayName={match.awayTeam?.shortName || match.awayTeam?.name}
            homeScore={match.homeTeam?.score || 0}
            awayScore={match.awayTeam?.score || 0}
            matchStatus={match.status}
          />
        </div>

        {/* Right Column: Prediction Poll & Live Chat */}
        <div className="side-panel">
          <PredictionPoll match={match} />
          <CommunityChat matchTitle={`${match.homeTeam?.shortName} vs ${match.awayTeam?.shortName}`} />
        </div>
      </div>
    </div>
  );
}

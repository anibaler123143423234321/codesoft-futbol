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
      <div className="mc-top-bar">
        <button
          className="btn-secondary mc-back-btn"
          onClick={() => {
            sounds.playClick();
            onBack();
          }}
        >
          <ArrowLeft size={13} />
          <span>Volver a cartelera</span>
        </button>

        <div className="mc-top-status-pills">
          <span className="match-league-label">{match.leagueName || 'FÚTBOL INTERNACIONAL'}</span>
          {isScheduled && (
            <span className="pill-badge-gold">
              🕒 {formattedTime}
            </span>
          )}
          {isLive && (
            <span className="pill-badge-red">
              🔴 EN VIVO {formattedTime}
            </span>
          )}
          {isFinished && (
            <span className="pill-badge-green">
              🏁 FINALIZADO (FT)
            </span>
          )}
        </div>

        {liveMatches.length > 0 && match.id !== liveMatches[0].id && (
          <button 
            className="btn-primary mc-switch-match-btn" 
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
        <div className="mc-team-side home">
          <div className="mc-team-info home">
            <h2 className="mc-team-name" title={match.homeTeam?.name}>
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
            size={44}
            isHome={true}
          />
        </div>

        {/* Center Score & Status */}
        <div className="mc-score-center-box">
          <div className="mc-live-indicator">
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
              <span className="mc-score-vs">VS</span>
            ) : (
              <>
                <span>{match.homeTeam?.score ?? 0}</span>
                <span className="mc-score-dash">-</span>
                <span>{match.awayTeam?.score ?? 0}</span>
              </>
            )}
          </div>

          <div className="mc-clock-time">
            {formattedTime}
          </div>
        </div>

        {/* Away Team */}
        <div className="mc-team-side away">
          <TeamLogo
            src={match.awayTeam?.logo}
            alt={match.awayTeam?.name}
            size={44}
            isHome={false}
          />
          
          <div className="mc-team-info away">
            <h2 className="mc-team-name" title={match.awayTeam?.name}>
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
            h2h={match.h2hHistory || []}
            recentForm={match.recentForm || {
              home: { form: match.homeTeam?.form, games: match.homeTeam?.recentGames },
              away: { form: match.awayTeam?.form, games: match.awayTeam?.recentGames }
            }}
            homeName={match.homeTeam?.shortName || match.homeTeam?.name}
            awayName={match.awayTeam?.shortName || match.awayTeam?.name}
            homeLogo={match.homeTeam?.logo}
            awayLogo={match.awayTeam?.logo}
            homeScore={match.homeTeam?.score || 0}
            awayScore={match.awayTeam?.score || 0}
            matchStatus={match.status}
            leagueName={match.leagueName}
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

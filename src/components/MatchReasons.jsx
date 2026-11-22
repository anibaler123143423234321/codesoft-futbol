import React, { useMemo, useState } from 'react';
import {
  Goal, Clock, Square, Crosshair, Activity, Coins, Trophy, Mountain, House,
  TrendingUp, Flame, Swords, Sigma, ArrowDownRight, ArrowUpRight,
} from 'lucide-react';
import { explainSide, matchEvents } from '../api/matchReasons';
import '../model-charts.css';

// Por qué cada equipo tiene la probabilidad que tiene: razones en contra y a favor
// sacadas de los datos del partido, y en vivo lo que pasó (goles y expulsiones).

const ICONS = {
  score: Goal, clock: Clock, red: Square, shots: Crosshair, ball: Activity, odds: Coins, table: Trophy,
  altitude: Mountain, home: House, form: TrendingUp, attack: Flame, h2h: Swords, xg: Sigma,
};
const pct = (p) => `${Math.round(p * 100)}%`;
// Los marcadores (2-1) no se parten al final de la línea
const withScores = (text) => text.split(/(\b\d+-\d+\b)/).map((part, i) => (i % 2 ? <b key={i} className="rsn-score">{part}</b> : part));

function ReasonList({ title, tone, items, empty }) {
  const Arrow = tone === 'down' ? ArrowDownRight : ArrowUpRight;
  return (
    <div className={`rsn-col is-${tone}`}>
      <h4><Arrow size={14} aria-hidden="true" />{title}<em>{items.length}</em></h4>
      {items.length ? (
        <ul>
          {items.map((r) => {
            const Icon = ICONS[r.icon] || Activity;
            return (
              <li key={r.key}>
                <span className="rsn-ic" aria-hidden="true"><Icon size={13} /></span>
                <p>{withScores(r.text)}</p>
              </li>
            );
          })}
        </ul>
      ) : <p className="rsn-empty">{empty}</p>}
    </div>
  );
}

function Events({ match, pred, events }) {
  const finished = match.status === 'finished';
  const minute = Math.round(pred.quality.minute || 0);
  const nameOf = (side) => (side === 'home' ? pred.home : side === 'away' ? pred.away : '');
  // ESPN a veces deja un gol anulado en la lista de eventos sin descontarlo del marcador
  const goals = events.filter((e) => e.kind === 'goal').length;
  const scored = Number(match.homeTeam?.score || 0) + Number(match.awayTeam?.score || 0);
  return (
    <div className="rsn-events">
      <h4><Clock size={13} aria-hidden="true" />Qué pasó</h4>
      {events.length ? (
        <ol>
          {events.map((e, i) => (
            <li key={`${e.minute}-${i}`} className={e.kind === 'red' ? 'is-red' : ''}>
              <b>{e.minute ? `${String(e.minute).replace(/'$/, '')}'` : '—'}</b>
              <i className={`rsn-dot is-${e.side || 'none'}`} aria-hidden="true" />
              <span>
                {e.kind === 'red'
                  ? <Square size={11} className="rsn-red" aria-hidden="true" />
                  : <Goal size={12} aria-hidden="true" />}
                {e.kind === 'red' ? 'Expulsión' : e.own ? 'Gol en contra' : e.penalty ? 'Gol de penal' : 'Gol'}
                {e.player && <em> · {e.player}</em>}
              </span>
              <small>{nameOf(e.side)}</small>
            </li>
          ))}
        </ol>
      ) : null}
      {events.length > 0 && goals !== scored && (
        <p className="rsn-note">
          ESPN lista {goals} {goals === 1 ? 'gol' : 'goles'} pero el marcador va {match.homeTeam?.score ?? 0}-{match.awayTeam?.score ?? 0}: puede haber un gol anulado o que aún no se registra.
        </p>
      )}
      {!events.length && (
        <p className="rsn-empty">
          {finished ? 'Terminó sin goles ni expulsiones.' : `Sin goles ni expulsiones hasta el minuto ${minute}.`}
        </p>
      )}
    </div>
  );
}

/** Usar con key={match.id} para que al cambiar de partido vuelva a mostrar al que menos chances tiene. */
export default function MatchReasons({ match, pred }) {
  const underdog = pred.outcome.p1 <= pred.outcome.p2 ? 'home' : 'away';
  const [picked, setPicked] = useState(null);
  const side = picked || underdog;
  const data = useMemo(() => explainSide(match, pred, side), [match, pred, side]);
  const events = useMemo(() => matchEvents(match), [match]);
  const finished = match.status === 'finished';
  const showEvents = finished || match.status === 'live' || pred.quality.isLive;
  const pOther = side === 'home' ? pred.outcome.p2 : pred.outcome.p1;

  const lists = [
    <ReasonList key="down" title="En contra" tone="down" items={data.against} empty="Nada en contra con estos datos." />,
    <ReasonList key="up" title="A favor" tone="up" items={data.favor} empty="Nada a favor con estos datos." />,
  ];

  return (
    <div className="rsn">
      <div className="rsn-switch" role="tablist" aria-label="Elegir equipo">
        {['home', 'away'].map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={side === s}
            className={`is-${s}${side === s ? ' is-on' : ''}`}
            onClick={() => setPicked(s)}
          >
            <i aria-hidden="true" />
            <span>{s === 'home' ? pred.home : pred.away}</span>
            <b>{pct(s === 'home' ? pred.outcome.p1 : pred.outcome.p2)}</b>
          </button>
        ))}
      </div>

      <div className="rsn-body" key={side}>
        <div className="rsn-head">
          <h3>{data.question}</h3>
          <span className={`rsn-verdict is-${data.tone}`}>{data.verdict}</span>
        </div>
        {!finished && (
          <p className="rsn-sub">
            Según el modelo gana en el {pct(data.p)} de los casos, empata en el {pct(pred.outcome.px)} y pierde en el {pct(pOther)}.
          </p>
        )}
        <div className="rsn-cols">{data.tone === 'up' ? [...lists].reverse() : lists}</div>
      </div>

      {showEvents && <Events match={match} pred={pred} events={events} />}
    </div>
  );
}

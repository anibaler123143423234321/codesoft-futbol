import React, { useState, useEffect, useRef } from 'react';
import { 
  Maximize, 
  RotateCw, 
  Share2, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  Tv, 
  ShieldAlert, 
  Sparkles,
  Play,
  Check,
  Radio,
  Eye,
  Activity,
  Flame,
  Zap
} from 'lucide-react';
import { sounds } from '../utils/soundEffects';
import { useLiveMatchTimer } from '../hooks/useLiveMatchTimer';

export default function VideoPlayer({ match, onOpenPickModal }) {
  const [viewMode, setViewMode] = useState('betano'); // 'betano' (Cancha 2.5D Betano) or 'tv' (Streaming TV)
  const [activeServer, setActiveServer] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState(false);
  const [muted, setMuted] = useState(sounds.muted);

  const { formattedTime, isLive, isHalftime, isFinished, isScheduled } = useLiveMatchTimer(match);

  // Match tracker event state (Betano style)
  const [currentEvent, setCurrentEvent] = useState({
    type: 'attack_dangerous',
    team: 'home',
    title: '¡ATAQUE PELIGROSO!',
    desc: 'Deportivo avanza con superioridad por banda derecha',
    minute: "95'"
  });

  const [momentum, setMomentum] = useState({ home: 65, away: 35 });

  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Cycle realistic Betano-style match tracker events (only for active live games)
  useEffect(() => {
    if (isFinished) {
      setCurrentEvent({
        type: 'match_ended',
        team: 'home',
        title: '🏁 PARTIDO FINALIZADO',
        desc: `Resultado final: ${match.homeTeam?.name} ${match.homeTeam?.score} - ${match.awayTeam?.score} ${match.awayTeam?.name} (FT)`,
        minute: 'FT'
      });
      return;
    }

    if (isScheduled) {
      setCurrentEvent({
        type: 'prematch',
        team: 'home',
        title: '⏰ PARTIDO POR INICIAR',
        desc: `Programado: ${match.timeStr || match.date || 'Hoy'}. Transmisión lista.`,
        minute: 'Previa'
      });
      return;
    }

    const events = [
      { type: 'attack_dangerous', team: 'home', title: '¡ATAQUE PELIGROSO!', desc: `${match.homeTeam?.shortName} avanza con superioridad por banda derecha`, duration: 4000 },
      { type: 'corner', team: 'home', title: 'TIRO DE ESQUINA', desc: `Córner a favor de ${match.homeTeam?.shortName}`, duration: 3500 },
      { type: 'shot_saved', team: 'away', title: '¡REMATE AL ARCO!', desc: `Gran atajada del arquero de ${match.homeTeam?.shortName}`, duration: 3500 },
      { type: 'possession', team: 'away', title: 'POSESIÓN EN MEDIOCAMPO', desc: `${match.awayTeam?.shortName} construye jugada paciente`, duration: 4000 },
      { type: 'attack_dangerous', team: 'away', title: '¡CONTRAATAQUE PELIGROSO!', desc: `${match.awayTeam?.shortName} penetra el área con pase filtrado`, duration: 4000 },
      { type: 'foul', team: 'home', title: 'FALTA COMETIDA', desc: `Falta táctica para frenar el avance rival`, duration: 3000 },
      { type: 'goal_chance', team: 'home', title: '¡OCASIÓN CLARA DE GOL!', desc: `Remate al borde del área chica que roza el poste`, duration: 4000 }
    ];

    let eventIdx = 0;
    const interval = setInterval(() => {
      eventIdx = (eventIdx + 1) % events.length;
      const ev = events[eventIdx];
      setCurrentEvent(ev);

      // Fluctuate momentum bar
      if (ev.team === 'home') {
        setMomentum({ home: 70 + Math.floor(Math.random() * 15), away: 30 - Math.floor(Math.random() * 10) });
      } else {
        setMomentum({ home: 35 - Math.floor(Math.random() * 10), away: 65 + Math.floor(Math.random() * 15) });
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [match, isFinished, isScheduled, isLive]);

  // Real-time 2.5D Match Tracker Canvas Engine (Sportradar / Betano LMT style)
  useEffect(() => {
    if (viewMode !== 'betano') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let frame = 0;

    let ball = { 
      u: 0.5, 
      v: 0.5, 
      targetU: 0.5, 
      targetV: 0.5,
      direction: 1 // 1: attacking right, -1: attacking left
    };

    // Calculate ball target position based on event type & team
    const updateEventTarget = () => {
      const isHome = currentEvent.team === 'home';
      
      if (currentEvent.type === 'corner') {
        ball.targetU = isHome ? 0.88 : 0.12;
        ball.targetV = isHome ? 0.30 : 0.70;
        ball.direction = isHome ? 1 : -1;
      } else if (currentEvent.type === 'foul' || currentEvent.type === 'free_kick') {
        ball.targetU = isHome ? 0.44 : 0.56;
        ball.targetV = 0.50;
        ball.direction = isHome ? 1 : -1;
      } else if (currentEvent.type === 'shot' || currentEvent.type === 'goal_chance') {
        ball.targetU = isHome ? 0.78 : 0.22;
        ball.targetV = 0.50;
        ball.direction = isHome ? 1 : -1;
      } else {
        // General attack / possession
        ball.targetU = isHome ? 0.62 : 0.38;
        ball.targetV = 0.50 + Math.sin(frame * 0.04) * 0.18;
        ball.direction = isHome ? 1 : -1;
      }
    };

    const render = () => {
      frame++;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Smooth lerp ball towards target in normalized (u, v) space
      updateEventTarget();
      ball.u += (ball.targetU - ball.u) * 0.05;
      ball.v += (ball.targetV - ball.v) * 0.05;

      // 1. 3D Stadium Grandstands Backdrop
      const gradStands = ctx.createLinearGradient(0, 0, 0, h * 0.24);
      gradStands.addColorStop(0, '#10141d');
      gradStands.addColorStop(1, '#1b202c');
      ctx.fillStyle = gradStands;
      ctx.fillRect(0, 0, w, h * 0.24);

      // Grandstand seat rows
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let y = 8; y < h * 0.23; y += 6) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 2. Bilinear Isometric Perspective Coordinates
      const pTopL = { x: w * 0.16, y: h * 0.22 };
      const pTopR = { x: w * 0.84, y: h * 0.22 };
      const pBotR = { x: w * 0.95, y: h * 0.86 };
      const pBotL = { x: w * 0.05, y: h * 0.86 };

      // Helper function: converts normalized (u, v) in [0,1]x[0,1] to Canvas (x, y)
      const pt = (u, v) => {
        const topX = pTopL.x + u * (pTopR.x - pTopL.x);
        const botX = pBotL.x + u * (pBotR.x - pBotL.x);
        const x = topX + v * (botX - topX);
        const y = pTopL.y + v * (pBotL.y - pTopL.y);
        return { x, y };
      };

      // 3. Pitch Grass (Alternating Green Stripes in Perspective)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pTopL.x, pTopL.y);
      ctx.lineTo(pTopR.x, pTopR.y);
      ctx.lineTo(pBotR.x, pBotR.y);
      ctx.lineTo(pBotL.x, pBotL.y);
      ctx.closePath();
      ctx.clip();

      const numStripes = 12;
      for (let i = 0; i < numStripes; i++) {
        const u0 = i / numStripes;
        const u1 = (i + 1) / numStripes;
        const tl = pt(u0, 0);
        const tr = pt(u1, 0);
        const br = pt(u1, 1);
        const bl = pt(u0, 1);

        ctx.fillStyle = i % 2 === 0 ? '#4d9e26' : '#418e1e';
        ctx.beginPath();
        ctx.moveTo(tl.x, tl.y);
        ctx.lineTo(tr.x, tr.y);
        ctx.lineTo(br.x, br.y);
        ctx.lineTo(bl.x, bl.y);
        ctx.closePath();
        ctx.fill();
      }

      // Ball screen position
      const ballPos = pt(ball.u, ball.v);

      // 4. Spotlight Vision Cone (Radial light beam from ball)
      const coneLength = 120;
      const coneAngle = Math.PI / 4.2;
      const baseAngle = ball.direction === 1 ? 0 : Math.PI;
      const pCone1X = ballPos.x + Math.cos(baseAngle - coneAngle / 2) * coneLength;
      const pCone1Y = ballPos.y + Math.sin(baseAngle - coneAngle / 2) * coneLength * 0.55;
      const pCone2X = ballPos.x + Math.cos(baseAngle + coneAngle / 2) * coneLength;
      const pCone2Y = ballPos.y + Math.sin(baseAngle + coneAngle / 2) * coneLength * 0.55;

      const coneGrad = ctx.createRadialGradient(ballPos.x, ballPos.y, 8, ballPos.x, ballPos.y, coneLength);
      coneGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      coneGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.20)');
      coneGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(ballPos.x, ballPos.y);
      ctx.lineTo(pCone1X, pCone1Y);
      ctx.lineTo(pCone2X, pCone2Y);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // 5. White Pitch Markings (Mathematically Perfect Perspective)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;

      // Outer Boundary
      ctx.beginPath();
      ctx.moveTo(pTopL.x, pTopL.y);
      ctx.lineTo(pTopR.x, pTopR.y);
      ctx.lineTo(pBotR.x, pBotR.y);
      ctx.lineTo(pBotL.x, pBotL.y);
      ctx.closePath();
      ctx.stroke();

      // Halfway Line
      const midTop = pt(0.5, 0);
      const midBot = pt(0.5, 1);
      ctx.beginPath();
      ctx.moveTo(midTop.x, midTop.y);
      ctx.lineTo(midBot.x, midBot.y);
      ctx.stroke();

      // Center Circle & Spot
      const centerPt = pt(0.5, 0.5);
      ctx.beginPath();
      ctx.ellipse(centerPt.x, centerPt.y, 44, 20, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerPt.x, centerPt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Left Penalty Box
      const lpb1 = pt(0, 0.20);
      const lpb2 = pt(0.18, 0.20);
      const lpb3 = pt(0.18, 0.80);
      const lpb4 = pt(0, 0.80);
      ctx.beginPath();
      ctx.moveTo(lpb1.x, lpb1.y);
      ctx.lineTo(lpb2.x, lpb2.y);
      ctx.lineTo(lpb3.x, lpb3.y);
      ctx.lineTo(lpb4.x, lpb4.y);
      ctx.stroke();

      // Left 6-Yard Box
      const l6b1 = pt(0, 0.35);
      const l6b2 = pt(0.06, 0.35);
      const l6b3 = pt(0.06, 0.65);
      const l6b4 = pt(0, 0.65);
      ctx.beginPath();
      ctx.moveTo(l6b1.x, l6b1.y);
      ctx.lineTo(l6b2.x, l6b2.y);
      ctx.lineTo(l6b3.x, l6b3.y);
      ctx.lineTo(l6b4.x, l6b4.y);
      ctx.stroke();

      // Right Penalty Box
      const rpb1 = pt(1, 0.20);
      const rpb2 = pt(0.82, 0.20);
      const rpb3 = pt(0.82, 0.80);
      const rpb4 = pt(1, 0.80);
      ctx.beginPath();
      ctx.moveTo(rpb1.x, rpb1.y);
      ctx.lineTo(rpb2.x, rpb2.y);
      ctx.lineTo(rpb3.x, rpb3.y);
      ctx.lineTo(rpb4.x, rpb4.y);
      ctx.stroke();

      // Right 6-Yard Box
      const r6b1 = pt(1, 0.35);
      const r6b2 = pt(0.94, 0.35);
      const r6b3 = pt(0.94, 0.65);
      const r6b4 = pt(1, 0.65);
      ctx.beginPath();
      ctx.moveTo(r6b1.x, r6b1.y);
      ctx.lineTo(r6b2.x, r6b2.y);
      ctx.lineTo(r6b3.x, r6b3.y);
      ctx.lineTo(r6b4.x, r6b4.y);
      ctx.stroke();

      // 6. Corner Flags
      const drawFlag = (p) => {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - 11);
        ctx.stroke();

        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 11);
        ctx.lineTo(p.x + 7, p.y - 8);
        ctx.lineTo(p.x, p.y - 5);
        ctx.closePath();
        ctx.fill();
      };

      drawFlag(pt(0, 0));
      drawFlag(pt(1, 0));
      drawFlag(pt(0, 1));
      drawFlag(pt(1, 1));

      // 7. 3D Goals with Realistic Perspective Net Mesh
      // Left Goal
      const lgTop = pt(0, 0.38);
      const lgBot = pt(0, 0.62);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(lgTop.x - 14, lgTop.y, 14, lgBot.y - lgTop.y);
      
      // Left Net Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      for (let gy = lgTop.y; gy <= lgBot.y; gy += 7) {
        ctx.beginPath();
        ctx.moveTo(lgTop.x - 14, gy);
        ctx.lineTo(lgTop.x, gy);
        ctx.stroke();
      }

      // Right Goal
      const rgTop = pt(1, 0.38);
      const rgBot = pt(1, 0.62);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(rgTop.x, rgTop.y, 14, rgBot.y - rgTop.y);
      
      // Right Net Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      for (let gy = rgTop.y; gy <= rgBot.y; gy += 7) {
        ctx.beginPath();
        ctx.moveTo(rgTop.x, gy);
        ctx.lineTo(rgTop.x + 14, gy);
        ctx.stroke();
      }

      // 8. TACTICAL PLAY ANIMATIONS & SIGNALS (Señas de Juego en Vivo)
      const isHome = currentEvent.team === 'home';

      // A) DANGEROUS ATTACK & COUNTERATTACK: Animated 3D Chevrons & Danger Zone
      if (currentEvent.type.includes('attack') || currentEvent.type === 'goal_chance') {
        const dzU1 = isHome ? 0.68 : 0.02;
        const dzU2 = isHome ? 0.98 : 0.32;
        const dz1 = pt(dzU1, 0.16);
        const dz2 = pt(dzU2, 0.16);
        const dz3 = pt(dzU2, 0.84);
        const dz4 = pt(dzU1, 0.84);

        const dangerGrad = ctx.createLinearGradient(dz1.x, dz1.y, dz2.x, dz2.y);
        dangerGrad.addColorStop(0, isHome ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.28)');
        dangerGrad.addColorStop(1, isHome ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.05)');

        ctx.fillStyle = dangerGrad;
        ctx.beginPath();
        ctx.moveTo(dz1.x, dz1.y);
        ctx.lineTo(dz2.x, dz2.y);
        ctx.lineTo(dz3.x, dz3.y);
        ctx.lineTo(dz4.x, dz4.y);
        ctx.closePath();
        ctx.fill();

        // 3 Animated Glowing Chevrons >>>
        const animOffset = (frame * 0.025) % 1;
        for (let c = 0; c < 3; c++) {
          const chevronU = isHome 
            ? (0.52 + ((c * 0.13 + animOffset * 0.13) % 0.38))
            : (0.48 - ((c * 0.13 + animOffset * 0.13) % 0.38));
          
          const cMid = pt(chevronU, 0.50);
          const cTop = pt(chevronU - (isHome ? 0.035 : -0.035), 0.34);
          const cBot = pt(chevronU - (isHome ? 0.035 : -0.035), 0.66);

          ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + c * 0.22})`;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(cTop.x, cTop.y);
          ctx.lineTo(cMid.x, cMid.y);
          ctx.lineTo(cBot.x, cBot.y);
          ctx.stroke();
        }
      }

      // B) CORNER KICK: Curved Trajectory Arc & Pulsating Target Crosshair
      if (currentEvent.type === 'corner') {
        const cornerStart = pt(isHome ? 0.98 : 0.02, 0.05);
        const cornerTarget = pt(isHome ? 0.88 : 0.12, 0.50);
        const arcApex = pt(isHome ? 0.93 : 0.07, 0.18);

        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(cornerStart.x, cornerStart.y);
        ctx.quadraticCurveTo(arcApex.x, arcApex.y - 28, cornerTarget.x, cornerTarget.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated Pulsating Crosshair inside box
        const pulse = (Math.sin(frame * 0.12) + 1) * 4.5;
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cornerTarget.x, cornerTarget.y, 10 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(cornerTarget.x, cornerTarget.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // C) DANGEROUS FREE KICK & FOUL: 4-Player Wall + Curving Shot
      if (currentEvent.type === 'foul' || currentEvent.type === 'free_kick') {
        const wallU = isHome ? 0.82 : 0.18;
        for (let wi = -2; wi <= 1; wi++) {
          const wallPos = pt(wallU, 0.50 + wi * 0.045);
          // Shadow
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.beginPath();
          ctx.ellipse(wallPos.x, wallPos.y + 3, 4.5, 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
          // Jersey Player
          ctx.fillStyle = isHome ? '#e11d48' : '#3b82f6';
          ctx.beginPath();
          ctx.arc(wallPos.x, wallPos.y - 8, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Curved shot path over wall
        const fkStart = pt(isHome ? 0.68 : 0.32, 0.50);
        const fkGoal = pt(isHome ? 0.99 : 0.01, 0.44);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(fkStart.x, fkStart.y);
        ctx.quadraticCurveTo(pt(wallU, 0.32).x, pt(wallU, 0.32).y - 24, fkGoal.x, fkGoal.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // D) SHOT ON GOAL / GOALKEEPER SAVE: Laser Tracer & Shockwave Ring
      if (currentEvent.type === 'shot_saved' || currentEvent.type === 'shot') {
        const shooterPos = pt(isHome ? 0.74 : 0.26, 0.50);
        const targetGoal = pt(isHome ? 0.99 : 0.01, 0.50);

        const laserProg = (frame * 0.06) % 1;
        const curLaserX = shooterPos.x + (targetGoal.x - shooterPos.x) * laserProg;
        const curLaserY = shooterPos.y + (targetGoal.y - shooterPos.y) * laserProg;

        ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(shooterPos.x, shooterPos.y);
        ctx.lineTo(curLaserX, curLaserY);
        ctx.stroke();

        // Expanding Save Shockwave at Net
        const saveRad = (frame * 1.8) % 28;
        ctx.strokeStyle = `rgba(56, 189, 248, ${1 - saveRad / 28})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(targetGoal.x, targetGoal.y, saveRad, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 8. Soccer Ball with 3D Shadow
      // Ball Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(ballPos.x, ballPos.y + 6, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ball White Body
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, 7, 0, Math.PI * 2);
      ctx.fill();

      // Ball Black Pentagons
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(ballPos.x - 2, ballPos.y - 1, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ballPos.x + 3, ballPos.y + 2, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // 9. Floating Event Tooltip Badge (Identical to Betano / SofaScore Reference Image)
      const isHomeTeam = currentEvent.team === 'home';
      const teamDisplayName = isScheduled
        ? `${match.homeTeam?.shortName || match.homeTeam?.name || 'Local'} vs ${match.awayTeam?.shortName || match.awayTeam?.name || 'Visita'}`
        : (isHomeTeam ? (match.homeTeam?.shortName || match.homeTeam?.name || 'Local') : (match.awayTeam?.shortName || match.awayTeam?.name || 'Visita'));
      const actionText = isScheduled
        ? `⏰ PROGRAMADO · ${formattedTime}`
        : `${currentEvent.title || 'Posesión'} · ${formattedTime}`;

      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const teamTextWidth = ctx.measureText(teamDisplayName).width;
      ctx.font = '600 10px system-ui, -apple-system, sans-serif';
      const actionTextWidth = ctx.measureText(actionText).width;
      const boxW = Math.max(teamTextWidth, actionTextWidth) + 24;
      const boxH = 40;
      const boxX = ballPos.x - boxW / 2;
      const boxY = ballPos.y - 54;

      // Tooltip Shadow & Container
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;

      // Dark Navy Background
      ctx.fillStyle = '#0a1024';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 8);
      ctx.fill();

      // Border
      ctx.strokeStyle = isScheduled ? 'rgba(250, 204, 21, 0.4)' : 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Bottom Tail Pointer
      ctx.fillStyle = '#0a1024';
      ctx.beginPath();
      ctx.moveTo(ballPos.x - 6, boxY + boxH);
      ctx.lineTo(ballPos.x, boxY + boxH + 6);
      ctx.lineTo(ballPos.x + 6, boxY + boxH);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Team Header Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(teamDisplayName, ballPos.x, boxY + 15);

      // Event Subtitle Badge
      ctx.fillStyle = isScheduled ? '#facc15' : '#86efac';
      ctx.font = '600 10px system-ui, -apple-system, sans-serif';
      ctx.fillText(actionText, ballPos.x, boxY + 30);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [viewMode, currentEvent, formattedTime]);

  const handleReload = () => {
    sounds.playClick();
    setIsReloading(true);
    setTimeout(() => setIsReloading(false), 800);
  };

  const handleShare = () => {
    sounds.playClick();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReport = () => {
    sounds.playClick();
    setReported(true);
    setTimeout(() => setReported(false), 3000);
  };

  const toggleFullscreen = () => {
    sounds.playClick();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Video Streaming & Match Tracker Feeds with ScoreBat and ESPN TV channels
  const tvChannelName = match.tvChannel || match.broadcasts?.[0] || 'Señal Internacional';
  const tvServers = [
    { id: 1, label: '📺 Cancha 2.5D Tracker (NVIDIA)', mode: 'betano', quality: 'Ultra Real-Time' },
    { id: 2, label: '⚡ Radar SofaScore (Iframe)', mode: 'sofascore', quality: 'Widget Oficial' },
    { id: 3, label: '🎬 ScoreBat HD (Video Oficial)', mode: 'scorebat', quality: '1080p Stream' },
    { id: 4, label: `📡 TV: ${tvChannelName}`, mode: 'tv', quality: 'En Vivo' },
  ];

  return (
    <div className="player-module" ref={containerRef}>
      {/* Single Compact Top Toolbar: Server Switcher + Momentum */}
      <div className="player-top-toolbar">
        <div className="servers-bar">
          {tvServers.map((s) => (
            <button
              key={s.id}
              id={`server-btn-${s.id}`}
              className={`server-btn ${activeServer === s.id ? 'active' : ''}`}
              onClick={() => {
                sounds.playClick();
                setActiveServer(s.id);
                setViewMode(s.mode);
              }}
            >
              <span className="live-dot" style={{ background: activeServer === s.id ? 'var(--red-live)' : 'var(--text-muted)', width: '5px', height: '5px' }} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Momentum Indicator Bar (Betano Style) */}
        <div className="player-momentum-badge">
          <Flame size={12} style={{ color: 'var(--red-live)' }} />
          <span className="momentum-lbl">MOMENTUM:</span>
          <div className="momentum-track">
            <div style={{ width: `${momentum.home}%`, background: 'var(--gold-neon)', transition: 'width 0.5s ease' }} title={`${match.homeTeam?.shortName}: ${momentum.home}%`} />
            <div style={{ width: `${momentum.away}%`, background: 'var(--red-live)', transition: 'width 0.5s ease' }} title={`${match.awayTeam?.shortName}: ${momentum.away}%`} />
          </div>
        </div>
      </div>

      {/* Main Video / Match Tracker Container (Compact 220px Height) */}
      <div className="video-player-container">
        {isReloading ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
            <div style={{ textAlign: 'center' }}>
              <RotateCw className="animate-spin" size={30} style={{ color: 'var(--cyan-neon)', margin: '0 auto 8px' }} />
              <p style={{ color: '#fff', fontSize: '0.82rem' }}>Sincronizando señal en vivo...</p>
            </div>
          </div>
        ) : viewMode === 'betano' ? (
          /* Betano 2.5D Isometric Match Tracker View */
          <>
            <canvas 
              ref={canvasRef} 
              width={640} 
              height={300} 
              style={{ width: '100%', height: '100%', display: 'block' }}
            />

            {/* Clean Scoreboard Overlay (TV Style) */}
            <div className="video-overlay-score">
              <span style={{ color: 'var(--gold-neon)', fontWeight: 800 }}>CODESOFT TV</span>
              {isScheduled ? (
                <span>{match.homeTeam?.shortName} VS {match.awayTeam?.shortName}</span>
              ) : (
                <span>{match.homeTeam?.shortName} {match.homeTeam?.score} - {match.awayTeam?.score} {match.awayTeam?.shortName}</span>
              )}
              <span style={{ color: isLive ? 'var(--cyan-neon)' : isFinished ? 'var(--green-neon)' : 'var(--gold-neon)', fontFamily: 'var(--font-score)', fontWeight: 800 }}>
                {formattedTime}
              </span>
            </div>

            {/* Bottom event commentary */}
            <div className="video-bottom-commentary">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 600 }}>
                <span className="live-dot" style={{ background: currentEvent.team === 'home' ? 'var(--gold-neon)' : 'var(--red-live)' }} />
                <span>{currentEvent.desc}</span>
              </div>
              <span style={{ color: 'var(--cyan-neon)', fontFamily: 'var(--font-score)', fontWeight: 800 }}>
                {formattedTime}
              </span>
            </div>
          </>
        ) : viewMode === 'sofascore' ? (
          /* Live SofaScore Radar Visualizer */
          <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0b101d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', maxWidth: '440px' }}>
              <Zap size={28} style={{ color: 'var(--cyan-neon)', margin: '0 auto 10px' }} />
              <h4 style={{ color: '#fff', fontWeight: 800, fontSize: '0.92rem', marginBottom: '6px' }}>Radar Táctico en Vivo</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '14px', lineHeight: 1.4 }}>
                SofaScore no transmite sensores en vivo para ligas universitarias menores. Utiliza nuestra <strong>Cancha 2.5D Tracker</strong> para seguir los ataques peligrosos, tiros de esquina y jugadas en tiempo real.
              </p>
              <button 
                className="btn-primary" 
                style={{ padding: '6px 14px', fontSize: '0.76rem', margin: '0 auto' }}
                onClick={() => {
                  setActiveServer(1);
                  setViewMode('betano');
                }}
              >
                <span>Ver Cancha 2.5D Tracker</span>
              </button>
            </div>
            <div style={{ position: 'absolute', bottom: '8px', right: '12px', background: 'rgba(0,0,0,0.75)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--cyan-neon)', pointerEvents: 'none' }}>
              ⚡ RADAR EN VIVO
            </div>
          </div>
        ) : viewMode === 'scorebat' ? (
          /* ScoreBat Official Match Video & Stream Feed */
          <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0b101d', overflow: 'hidden' }}>
            <iframe
              src="https://www.scorebat.com/embed/livescore/"
              title="ScoreBat Official Video & Live Feed"
              style={{ width: '100%', height: '100%', border: 'none', background: '#0b101d', filter: 'invert(0.9) hue-rotate(180deg) contrast(1.15)' }}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
            <div style={{ position: 'absolute', bottom: '8px', right: '12px', background: 'rgba(0,0,0,0.85)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--gold-neon)', pointerEvents: 'none' }}>
              🎬 SCOREBAT OFICIAL
            </div>
          </div>
        ) : (
          /* Real TV Video Player Stream Simulation */
          <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
            <iframe
              src="https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?autoplay=1&mute=1&controls=1&loop=1&playlist=aqz-KE-bpKQ"
              title="Transmisión TV en Vivo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
            {/* TV watermark overlay */}
            <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--cyan-neon)', pointerEvents: 'none' }}>
              {tvChannelName.toUpperCase()} · EN VIVO
            </div>
          </div>
        )}
      </div>

      {/* Video Control Bar + Pick Button in ONE Row */}
      <div className="player-bottom-toolbar">
        <div className="video-controls-bar">
          <button className="video-ctrl-btn" onClick={toggleFullscreen}>
            <Maximize size={13} />
            <span>Pantalla completa</span>
          </button>

          <button className="video-ctrl-btn" onClick={handleReload}>
            <RotateCw size={13} className={isReloading ? 'animate-spin' : ''} />
            <span>Recargar</span>
          </button>

          <button className="video-ctrl-btn" onClick={handleShare}>
            {copied ? <Check size={13} style={{ color: 'var(--green-neon)' }} /> : <Share2 size={13} />}
            <span>{copied ? '¡Copiado!' : 'Compartir'}</span>
          </button>

          <button className="video-ctrl-btn" onClick={handleReport}>
            <AlertTriangle size={13} style={{ color: reported ? 'var(--gold-neon)' : 'inherit' }} />
            <span>Reportar</span>
          </button>
        </div>

        <button 
          className="btn-primary player-ai-btn" 
          onClick={() => onOpenPickModal(match)}
        >
          <Sparkles size={14} />
          <span>Análisis con IA</span>
        </button>
      </div>
    </div>
  );
}

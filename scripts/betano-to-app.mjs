#!/usr/bin/env node
// Convierte una captura cruda de Betano (scripts/betano-capture.js) al formato de la app.
// Uso: node scripts/betano-to-app.mjs betano_94991437_....json [salida.json]
// Sin argumentos usa la captura más reciente de ~/Downloads.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseBetanoSnapshot } from '../src/api/betanoParser.js';

function latestDownload() {
  const dir = path.join(os.homedir(), 'Downloads');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /^betano_\d+_.*\.json$/.test(f))
    : [];
  if (!files.length) return null;
  return files
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

const args = process.argv.slice(2);
const input = args[0] || latestDownload();
const output = args[1];
if (!input || !fs.existsSync(input)) {
  console.error(
    input
      ? `No existe el archivo: ${input}`
      : 'No hay capturas betano_*.json en ~/Downloads.',
  );
  console.error(
    '1) Abre el partido en vivo en betano.pe\n' +
      '2) Abre DevTools (Cmd+Option+J) y pega el contenido de scripts/betano-capture.js\n' +
      '3) Vuelve a ejecutar: node scripts/betano-to-app.mjs',
  );
  process.exit(1);
}
console.log(`Leyendo ${input}`);

const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
const match = parseBetanoSnapshot(raw);
const dest = output || path.join('datos_crudos', `betano_${match.eventId}.json`);
fs.writeFileSync(dest, JSON.stringify(match, null, 2));

const { home, away, clock, odds, impliedProbabilities: p } = match;
console.log(`${home.name} ${home.score}-${away.score} ${away.name}  (${clock.display ?? '—'}, ${match.league})`);
console.log(`xG ${home.stats.xG} - ${away.stats.xG} | tiros ${home.stats.shots}-${away.stats.shots} | córners ${home.stats.corners}-${away.stats.corners}`);
if (odds.matchResult) console.log(`1X2: ${odds.matchResult.home} / ${odds.matchResult.draw} / ${odds.matchResult.away}  → ${p.home}% / ${p.draw}% / ${p.away}% (margen ${p.bookMargin}%)`);
console.log(`Incidencias: ${match.incidents.length} | Mercados: ${match.markets.length} → ${dest}`);

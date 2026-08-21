import fs from 'fs';
import path from 'path';

async function generateSpanishDataFolder() {
  const dir = 'e:/Nueva carpeta/proyectos-ia/datos_crudos';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  console.log('1. Descargando Cartelera Oficial de ESPN...');
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard');
  const scoreboard = await res.json();

  fs.writeFileSync(path.join(dir, 'cartelera_completa_partidos_hoy.json'), JSON.stringify(scoreboard, null, 2));
  console.log('Guardado: datos_crudos/cartelera_completa_partidos_hoy.json (Total de partidos:', scoreboard.events?.length, ')');

  const events = scoreboard.events || [];
  
  // 1. Partido en Vivo (Drexel vs Holy Family)
  const liveEv = events.find(e => e.id === '401887604') || events.find(e => e.status?.type?.state === 'in');
  if (liveEv) {
    const liveRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=' + liveEv.id);
    const liveData = await liveRes.json();
    fs.writeFileSync(path.join(dir, 'partido_en_vivo_drexel_vs_holy_family.json'), JSON.stringify(liveData, null, 2));
    console.log('Guardado: datos_crudos/partido_en_vivo_drexel_vs_holy_family.json');
  }

  // 2. Arsenal vs Coventry
  const arsenalEv = events.find(e => e.id === '401879301') || events.find(e => e.name?.includes('Arsenal'));
  if (arsenalEv) {
    const arsRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=' + arsenalEv.id);
    const arsData = await arsRes.json();
    fs.writeFileSync(path.join(dir, 'partido_arsenal_vs_coventry.json'), JSON.stringify(arsData, null, 2));
    console.log('Guardado: datos_crudos/partido_arsenal_vs_coventry.json');
  }

  // 3. Real Betis vs Real Sociedad (LaLiga)
  const betisEv = events.find(e => e.id === '401882914') || events.find(e => e.name?.includes('Betis'));
  if (betisEv) {
    const betisRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=' + betisEv.id);
    const betisData = await betisRes.json();
    fs.writeFileSync(path.join(dir, 'partido_laliga_betis_vs_real_sociedad.json'), JSON.stringify(betisData, null, 2));
    console.log('Guardado: datos_crudos/partido_laliga_betis_vs_real_sociedad.json');
  }

  // 4. Liga MX (León vs Monterrey)
  const mxEv = events.find(e => e.id === '401877005') || events.find(e => e.name?.includes('León'));
  if (mxEv) {
    const mxRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=' + mxEv.id);
    const mxData = await mxRes.json();
    fs.writeFileSync(path.join(dir, 'partido_ligamx_leon_vs_monterrey.json'), JSON.stringify(mxData, null, 2));
    console.log('Guardado: datos_crudos/partido_ligamx_leon_vs_monterrey.json');
  }

  const readme = `# 📊 Datos Oficiales Extraídos de ESPN API

Esta carpeta contiene los archivos JSON descargados directamente del servidor oficial de ESPN sin ninguna modificación.

## 📁 Archivos Disponibles:
1. **[cartelera_completa_partidos_hoy.json](./cartelera_completa_partidos_hoy.json)**:
   - Contiene los 94 partidos oficiales de la jornada de hoy con marcadores, horarios, logos, cuotas y enlaces.
2. **[partido_en_vivo_drexel_vs_holy_family.json](./partido_en_vivo_drexel_vs_holy_family.json)**:
   - Datos del partido en vivo (Fútbol Femenino NCAA Division I).
3. **[partido_arsenal_vs_coventry.json](./partido_arsenal_vs_coventry.json)**:
   - Datos del partido de Premier League con alineaciones, estadio Emirates y cuotas.
4. **[partido_laliga_betis_vs_real_sociedad.json](./partido_laliga_betis_vs_real_sociedad.json)**:
   - Datos del partido de LaLiga EA Sports.
5. **[partido_ligamx_leon_vs_monterrey.json](./partido_ligamx_leon_vs_monterrey.json)**:
   - Datos del partido de Liga MX (Torneo Apertura).

## 🌐 Endpoint Oficial de ESPN Utilizado:
- Scoreboard: https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard
- Resumen y Estadísticas: https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event={EVENT_ID}
`;
  fs.writeFileSync(path.join(dir, 'LEEME_INFORMACION_DATA.md'), readme);
  console.log('Carpeta datos_crudos creada con éxito con nombres en español.');
}

generateSpanishDataFolder();

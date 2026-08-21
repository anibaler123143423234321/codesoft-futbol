# 📊 Datos Oficiales Extraídos de ESPN API

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

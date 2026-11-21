# CodeSoft Cuotas en Vivo (extensión de Chrome)

Envía automáticamente cuotas, xG, tiros, córners, tarjetas e incidencias del partido
que estás viendo en CodeSoft Fútbol. No hay que pegar nada en la consola.

## Instalar (una sola vez)

1. Abre `chrome://extensions` en Chrome.
2. Activa **Modo de desarrollador** (arriba a la derecha).
3. Pulsa **Cargar descomprimida** y elige esta carpeta `extension/`.

## Cómo funciona

- Abre un partido en vivo en CodeSoft (localhost o tu sitio en `*.netlify.app`).
- La app le pide los datos a la extensión cada 15 s.
- La extensión usa una pestaña de la fuente en segundo plano (la abre sola si no hay ninguna),
  busca el partido por el nombre de los equipos y devuelve los datos.
- Esa pestaña tiene que seguir abierta: si la cierras, la extensión abre otra en el siguiente pedido.

Si tu sitio usa un dominio propio, agrégalo en `manifest.json` → `content_scripts[1].matches`
y recarga la extensión.

## Por qué una extensión y no un servidor

La fuente bloquea con Cloudflare (403) las peticiones que no vienen de un navegador real.
La extensión usa tu Chrome con tu sesión normal, sin saltarse esa protección.

# Pocket Tilt

Juego de inclinacion con fisica Matter.js y render 3D Three.js.

## Caracteristicas

- Control por inclinacion en telefonos y tablets.
- Flechas, WASD y puntero en escritorio.
- Entre 1 y 5 pelotas por ronda.
- Entre 1 y 5 troneras distribuidas en zonas aleatorias.
- Pool Club, Terraza y Arcade.
- Las troneras cambian de lugar al completar cada ronda.
- Colisiones, audio, vibracion y efectos 3D.

## Desarrollo local

Requiere Node.js, pero no necesita instalar paquetes.

```bash
node server.mjs
```

Abre `http://127.0.0.1:4173`. En dispositivos moviles, el sensor de orientacion
normalmente requiere HTTPS; usa el despliegue de Netlify para probarlo.

## Despliegue recomendado en Cloudflare Pages

1. Crea un repositorio en GitHub y sube el contenido completo de esta carpeta.
2. En Cloudflare, abre **Workers & Pages**.
3. Selecciona **Create application > Pages > Connect to Git**.
4. Conecta GitHub y selecciona el repositorio.
5. Usa esta configuracion:
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: `exit 0`
   - Build output directory: `.`
   - Root directory: dejar vacio
6. Selecciona **Save and Deploy**.

Cloudflare entregara una direccion `nombre-del-proyecto.pages.dev` y desplegara
automaticamente cada cambio enviado a la rama `main`.

## Despliegue alternativo en Netlify

1. Crea un repositorio en GitHub y sube el contenido completo de esta carpeta.
2. En Netlify, selecciona **Add new project** y despues **Import an existing project**.
3. Conecta GitHub y elige el repositorio.
4. Netlify detectara `netlify.toml`. No agregues un comando de build.
5. Publica el proyecto.

La configuracion usa la raiz como directorio de publicacion. `server.mjs` sirve
solamente para desarrollo local y no se ejecuta en produccion.

## Estructura

- `index.html`: interfaz y carga de dependencias.
- `styles.css`: sistema visual y responsive.
- `js/config.js`: fisica, colores y escenarios.
- `js/audio.js`: audio Web Audio.
- `js/game.js`: escena 3D, controles y ciclo de juego.
- `server.mjs`: servidor web local sin dependencias.
- `netlify.toml`: directorio de publicacion para Netlify.
- `_headers`: permisos y cabeceras compatibles con Cloudflare Pages y Netlify.

## Dependencias en ejecucion

- Matter.js 0.20.0
- Three.js 0.160.0
- Lucide 0.468.0

Las dependencias se cargan desde CDN y no requieren un proceso de compilacion.

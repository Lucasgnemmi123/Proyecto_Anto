# Proyecto Anto

Un espacio personal de juegos y experiencias accesibles.

## Contenido

- **Inicio:** portada principal y acceso a las distintas secciones del proyecto.
- **Juegos:** colección de experiencias jugables.
- **Gyro-ball:** primer juego de la colección, controlado mediante inclinación lateral.

## Estructura

```text
Proyecto_Anto/
├── index.html
├── styles.css
├── assets/
│   └── anto-hero-v2.png
├── juegos/
│   └── Gyro-ball/
│       ├── index.html
│       ├── styles.css
│       └── js/
│           ├── audio.js
│           ├── config.js
│           └── game.js
├── server.mjs
├── netlify.toml
└── _headers
```

Gyro-ball se considera una experiencia terminada. Sus archivos permanecen aislados dentro de `juegos/Gyro-ball/` para evitar cambios accidentales al seguir ampliando el portal.

## Desarrollo local

No requiere instalar paquetes. Con Node.js disponible:

```bash
node server.mjs
```

- Inicio: `http://127.0.0.1:4173/`
- Gyro-ball: `http://127.0.0.1:4173/juegos/Gyro-ball/`

Los sensores móviles normalmente requieren HTTPS, por lo que las pruebas del giroscopio deben realizarse en el despliegue publicado.

## Despliegue

La raíz completa del repositorio es el directorio de publicación. Cloudflare Pages y Netlify pueden desplegarlo sin compilación.

Dependencias de Gyro-ball en ejecución:

- Matter.js 0.20.0
- Three.js 0.160.0
- Lucide 0.468.0

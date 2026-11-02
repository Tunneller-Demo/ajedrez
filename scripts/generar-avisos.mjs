// Genera public/avisos/index.html. Se ejecuta a mano si cambia una dependencia de producción:
// node scripts/generar-avisos.mjs
import { readFileSync, writeFileSync } from 'node:fs'

// Los tonos de src/index.css.
const NOCHE = '#0a0810'
const ORO = '#d8b25c'
const MARFIL = '#f3e8cf'

const FUENTE_DEL_MOTOR = 'https://github.com/nmrugg/stockfish.js/tree/v19.0.1'
const RED_DEL_MOTOR = 'https://tests.stockfishchess.org/api/nn/nn-61e7af4bb97d.nnue'
const REPOSITORIO = 'https://github.com/Tunneller-Demo/ajedrez'

const OBRAS = [
  {
    titulo: 'Fantasy',
    detalle: 'Piezas de Maurizio Monge, recoloreadas para la app.',
    licencia: 'MIT',
    archivo: 'public/piezas/gala/LICENSE-chess-art.txt',
  },
  { titulo: 'chess.js', detalle: 'De Jeff Hlywa.', licencia: 'BSD-2-Clause', paquete: 'chess.js' },
  { titulo: 'Cinzel', detalle: 'De The Cinzel Project Authors.', licencia: 'SIL OFL 1.1', paquete: '@fontsource/cinzel' },
  {
    titulo: 'Cormorant Garamond',
    detalle: 'De The Cormorant Project Authors.',
    licencia: 'SIL OFL 1.1',
    paquete: '@fontsource/cormorant-garamond',
  },
  { titulo: 'React', detalle: 'De Meta Platforms, Inc. y sus colaboradores.', licencia: 'MIT', paquete: 'react' },
  { titulo: 'React DOM', detalle: 'De Meta Platforms, Inc. y sus colaboradores.', licencia: 'MIT', paquete: 'react-dom' },
  { titulo: 'Scheduler', detalle: 'De Meta Platforms, Inc. y sus colaboradores.', licencia: 'MIT', paquete: 'scheduler' },
  {
    titulo: 'Tailwind CSS',
    detalle: 'De Tailwind Labs, Inc. Sus estilos base van en la hoja de estilos de la app.',
    licencia: 'MIT',
    paquete: 'tailwindcss',
  },
]

const escapar = (texto) => texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const leer = (ruta) => readFileSync(ruta, 'utf8').replaceAll('\r\n', '\n').trim()
const version = (paquete) => JSON.parse(leer(`node_modules/${paquete}/package.json`)).version

function seccion({ titulo, detalle, licencia, paquete, archivo }) {
  const origen = paquete ? `<br />${paquete} ${version(paquete)}` : ''
  return `      <section>
        <h2>${titulo}</h2>
        <p>${detalle} Licencia ${licencia}.${origen}</p>
        <pre>${escapar(leer(archivo ?? `node_modules/${paquete}/LICENSE`))}</pre>
      </section>`
}

const PAGINA = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Avisos de terceros · Ajedrez de Gala</title>
    <style>
      body {
        margin: 0;
        background: ${NOCHE};
        color: ${MARFIL};
        font: 1.125rem/1.5 Georgia, serif;
      }
      main {
        max-width: 46rem;
        margin: auto;
        padding: 2rem 1rem;
      }
      h1,
      h2,
      a {
        color: ${ORO};
      }
      h1,
      h2 {
        font-weight: 500;
      }
      section {
        margin-top: 3rem;
      }
      a {
        overflow-wrap: anywhere;
      }
      a:focus-visible {
        outline: 2px solid ${MARFIL};
        outline-offset: 2px;
      }
      pre {
        font-size: 0.8rem;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Avisos de terceros</h1>
      <p>
        Ajedrez de Gala se publica con estas obras de terceros, cada una bajo su licencia. El código propio tiene
        licencia MIT y está en <a href="${REPOSITORIO}">${REPOSITORIO}</a>.
      </p>
      <section>
        <h2>Stockfish.js</h2>
        <p>
          Motor de la Máquina, versión 19.0.1 sin modificar. Stockfish.js es de Chess.com, LLC, y se basa en Stockfish,
          de T. Romstad, M. Costalba, J. Kiiski, G. Linscott y otros colaboradores. Su red neuronal es de Chris Bao
          (sscg13). Licencia GPLv3, en <a href="../motor/Copying.txt">Copying.txt</a>.
        </p>
        <p>Código fuente: <a href="${FUENTE_DEL_MOTOR}">${FUENTE_DEL_MOTOR}</a></p>
        <p>Red neuronal: <a href="${RED_DEL_MOTOR}">${RED_DEL_MOTOR}</a></p>
      </section>
${OBRAS.map(seccion).join('\n')}
    </main>
  </body>
</html>
`

writeFileSync('public/avisos/index.html', PAGINA)

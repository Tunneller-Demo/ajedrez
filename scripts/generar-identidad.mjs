// Genera los PNG de public/identidad/. Se ejecuta a mano si cambia el favicon o la tarjeta:
// node scripts/generar-identidad.mjs
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

// Los tonos de src/index.css.
const NOCHE = '#0a0810'
const ORO = '#d8b25c'
const MARFIL = '#f3e8cf'
const FOCO = '#785caa'

const comoDatos = (ruta, tipo) => `data:${tipo};base64,${readFileSync(ruta).toString('base64')}`

const FAVICON = comoDatos('public/identidad/favicon.svg', 'image/svg+xml')
const REY = comoDatos('public/piezas/gala/wK.svg', 'image/svg+xml')
const CINZEL = comoDatos('node_modules/@fontsource/cinzel/files/cinzel-latin-500-normal.woff2', 'font/woff2')
const CORMORANT = comoDatos(
  'node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2',
  'font/woff2',
)

const TARJETA = `<!doctype html>
<style>
  @font-face { font-family: Cinzel; src: url(${CINZEL}); }
  @font-face { font-family: Cormorant; src: url(${CORMORANT}); }
  * { margin: 0; box-sizing: border-box; }
  body { position: relative; width: 1200px; height: 630px; overflow: hidden; background: ${NOCHE}; }
  .haz {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom, color-mix(in srgb, ${ORO} 34%, transparent), color-mix(in srgb, ${FOCO} 16%, transparent) 70%, transparent);
    clip-path: polygon(800px 0, 950px 0, 1160px 630px, 590px 630px);
    filter: blur(22px);
  }
  .halo {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 430px 300px at 875px 400px, color-mix(in srgb, ${FOCO} 50%, transparent), transparent 72%);
  }
  .suelo {
    position: absolute; left: 655px; top: 472px; width: 440px; height: 56px; border-radius: 50%;
    background: radial-gradient(closest-side, color-mix(in srgb, ${ORO} 38%, transparent), transparent);
  }
  .rey { position: absolute; left: 665px; top: 112px; width: 420px; height: 420px; }
  .texto { position: absolute; left: 76px; top: 212px; width: 580px; }
  h1 { font: 500 66px/1.1 Cinzel; color: ${ORO}; white-space: nowrap; }
  .filo { width: 190px; height: 2px; margin: 26px 0 24px; background: ${ORO}; }
  p { font: italic 400 40px/1.2 Cormorant; color: ${MARFIL}; }
</style>
<div class="halo"></div>
<div class="haz"></div>
<div class="suelo"></div>
<img class="rey" src="${REY}" alt="" />
<div class="texto">
  <h1>Ajedrez de Gala</h1>
  <div class="filo"></div>
  <p>Una partida a la luz del foco</p>
</div>`

const ICONO = `<!doctype html>
<style>
  * { margin: 0; }
  body { background: ${NOCHE}; }
  img { display: block; width: 180px; height: 180px; }
</style>
<img src="${FAVICON}" alt="" />`

async function capturar(navegador, html, viewport, destino) {
  const pagina = await navegador.newPage({ viewport })
  await pagina.setContent(html)
  await pagina.evaluate(() => document.fonts.ready)
  await pagina.screenshot({ path: destino })
  await pagina.close()
}

const navegador = await chromium.launch()
await capturar(navegador, TARJETA, { width: 1200, height: 630 }, 'public/identidad/tarjeta.png')
await capturar(navegador, ICONO, { width: 180, height: 180 }, 'public/identidad/icono-180.png')
await navegador.close()

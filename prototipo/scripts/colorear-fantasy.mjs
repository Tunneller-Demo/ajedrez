// PROTOTIPO: aplica a los SVG base de Fantasy los colores de la dirección Gala,
// igual que el configurador del autor: gradiente, trazo y sombra.
import { readFileSync, writeFileSync } from 'node:fs'

const bandos = {
  w: { claro: '#fff4d8', oscuro: '#c79f58', trazo: '#3b2612', sombra: '#000000' },
  b: { claro: '#7d68a3', oscuro: '#100b1b', trazo: '#d8b25c', sombra: '#000000' },
}

for (const pieza of ['k', 'q', 'r', 'b', 'n', 'p']) {
  const base = readFileSync(`public/piezas/base-fantasy/${pieza}.svg`, 'utf8')
  for (const [bando, c] of Object.entries(bandos)) {
    const svg = base
      .replace('stroke:#ff0000', `stroke:${c.trazo}`)
      .replace('fill:#00ff00', `fill:${c.oscuro}`)
      .replace('stop-color:#ffffff', `stop-color:${c.claro}`)
      .replace('stop-color:#00ffff', `stop-color:${c.oscuro}`)
      .replace('style="fill:#000"', `style="fill:${c.sombra};opacity:.55"`)
    writeFileSync(`public/piezas/gala/${bando}${pieza.toUpperCase()}.svg`, svg)
  }
}

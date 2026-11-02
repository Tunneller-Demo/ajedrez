import { readFileSync, readdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { Chess } from 'chess.js'
import { transformWithEsbuild } from 'vite'
import type { crearMotorDeMaquina } from '../src/maquina/motor'

declare global {
  interface Window {
    crearMotorDeMaquina: typeof crearMotorDeMaquina
  }
}

// La posición del issue #124 de nmrugg/stockfish.js: `go depth 16` no termina nunca sin `stop`.
const POSICION_QUE_SE_CUELGA = '3r3k/pbq1rpp1/1p2pNnp/2p1P2Q/2BP2R1/2P4R/P4PPP/6K1 b - - 3 24'
const CORONACION = '8/P6k/8/8/8/8/8/K7 w - - 0 1'

// El bundle no expone el cliente: se compila aparte y corre en la página, para probarlo aislado de la interfaz.
async function cargarCliente(page: Page, baseURL: string) {
  const fuente = readFileSync('src/maquina/motor.ts', 'utf8')
  const define = { 'import.meta.env.BASE_URL': JSON.stringify(new URL(baseURL).pathname) }
  const { code } = await transformWithEsbuild(fuente, 'motor.ts', { define })
  await page.evaluate(async (codigo) => {
    const modulo = await import(URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' })))
    window.crearMotorDeMaquina = modulo.crearMotorDeMaquina
  }, code)
}

const pedirJugada = (page: Page, fen: string) => page.evaluate((fen) => window.crearMotorDeMaquina().pedirJugada(fen, 'maximo'), fen)

test.describe('Motor de la Máquina bajo la ruta base', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto('.')
    await cargarCliente(page, baseURL!)
  })

  test('carga desde la ruta base y devuelve una Jugada legal', async ({ page }) => {
    const jugada = await pedirJugada(page, POSICION_QUE_SE_CUELGA)

    const legales = new Chess(POSICION_QUE_SE_CUELGA).moves({ verbose: true }).map((legal) => legal.lan)
    expect(legales).toContain(`${jugada!.desde}${jugada!.hasta}`)
  })

  test('devuelve la Coronación como parte de la Jugada', async ({ page }) => {
    expect(await pedirJugada(page, CORONACION)).toEqual({ desde: 'a7', hasta: 'a8', coronacion: 'q' })
  })

  test('cancelar corta una búsqueda colgada y la respuesta tardía se descarta', async ({ page, baseURL }) => {
    const salida = await page.evaluate(
      async ({ fen, url }) => {
        const respuestas: number[] = []
        const motor = window.crearMotorDeMaquina(() => {
          const worker = new Worker(url)
          const enviar = worker.postMessage.bind(worker)
          // La primera búsqueda se cambia por la que se cuelga: solo `stop` puede terminarla.
          let colgada = false
          worker.postMessage = (linea: string) => {
            const colgar = linea.startsWith('go ') && !colgada
            colgada ||= colgar
            enviar(colgar ? 'go depth 16' : linea)
          }
          worker.addEventListener('message', ({ data }) => {
            if (String(data).startsWith('bestmove')) respuestas.push(performance.now())
          })
          return worker
        })
        await motor.preparar()

        const cortada = motor.pedirJugada(fen, 'facil')
        await new Promise((resolver) => setTimeout(resolver, 500))
        const alCancelar = performance.now()
        motor.cancelar()
        const respuestaCortada = await cortada

        const siguiente = await motor.pedirJugada(fen, 'facil')
        return { respuestaCortada, siguiente, respuestas: respuestas.length, cortaEn: respuestas[0] - alCancelar }
      },
      { fen: POSICION_QUE_SE_CUELGA, url: `${new URL(baseURL!).pathname}motor/stockfish-19-lite-single.js` },
    )

    expect(salida.respuestaCortada).toBeNull()
    expect(salida.siguiente).not.toBeNull()
    expect(salida.respuestas).toBe(2)
    expect(salida.cortaEn).toBeLessThan(500)
  })

  test('queda fuera del bundle y publica Copying.txt a su lado', async ({ request }) => {
    const assets = readdirSync('dist/assets')
    expect(assets.filter((asset) => /stockfish|\.wasm$/i.test(asset))).toEqual([])
    for (const asset of assets) expect(readFileSync(`dist/assets/${asset}`, 'latin1')).not.toContain('Stockfish.js')

    const licencia = await request.get('motor/Copying.txt')
    expect(licencia.ok()).toBe(true)
    expect(await licencia.text()).toContain('GNU GENERAL PUBLIC LICENSE')

    const motor = await request.get('motor/stockfish-19-lite-single.js')
    expect(await motor.text()).toContain('License: GPLv3')
    expect((await request.get('motor/stockfish-19-lite-single.wasm')).headers()['content-type']).toBe('application/wasm')
  })
})

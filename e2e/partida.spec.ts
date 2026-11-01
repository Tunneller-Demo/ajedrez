import { expect, test, type Locator, type Page } from '@playwright/test'

const casilla = (page: Page, nombre: string) => page.getByRole('button', { name: new RegExp(`^${nombre}(,|$)`) })

test.describe('Partida a dos bajo la ruta base', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
  })

  function tocador(page: Page, isMobile: boolean) {
    const pulsar = (objetivo: Locator) => (isMobile ? objetivo.tap() : objetivo.click())
    return {
      pulsar,
      async jugar(...jugadas: string[]) {
        for (const jugada of jugadas) {
          const [desde, hasta] = jugada.split(' ')
          await pulsar(casilla(page, desde))
          await pulsar(casilla(page, hasta))
        }
      },
    }
  }

  test('carga sus assets desde la ruta base', async ({ page, baseURL }) => {
    const assets = await page
      .locator('script[src], link[rel="stylesheet"]')
      .evaluateAll((nodos) => nodos.map((nodo) => (nodo as HTMLScriptElement).src || (nodo as HTMLLinkElement).href))

    expect(assets.length).toBeGreaterThan(0)
    for (const asset of assets) expect(asset).toContain(baseURL)
  })

  test('arranca en la posición inicial con el turno de blancas', async ({ page }) => {
    await expect(page.getByText('Turno de las blancas')).toBeVisible()
    await expect(page.getByRole('button', { name: /, (peón|torre|caballo|alfil|dama|rey) / })).toHaveCount(32)
  })

  test('tocar pieza y casilla hace la Jugada', async ({ page, isMobile }) => {
    const { pulsar } = tocador(page, isMobile)

    await pulsar(casilla(page, 'e2'))
    await expect(page.getByRole('button', { name: 'casilla válida' })).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'e4, casilla válida' })).toBeVisible()

    await pulsar(casilla(page, 'e4'))

    await expect(page.getByRole('button', { name: 'e4, peón blanco' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'e2', exact: true })).toBeVisible()
    await expect(page.getByText('Turno de las negras')).toBeVisible()
  })

  test('una casilla no válida quita la selección y no mueve nada', async ({ page, isMobile }) => {
    const { pulsar } = tocador(page, isMobile)

    await pulsar(casilla(page, 'e2'))
    await pulsar(casilla(page, 'e5'))

    await expect(page.getByRole('button', { name: 'casilla válida' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'e2, peón blanco' })).toBeVisible()
    await expect(page.getByText('Turno de las blancas')).toBeVisible()
  })

  test('la Coronación deja elegir la pieza', async ({ page, isMobile }) => {
    const { pulsar, jugar } = tocador(page, isMobile)

    await jugar('a2 a4', 'b7 b5', 'a4 b5', 'a7 a6', 'b5 a6', 'c8 b7', 'a6 b7', 'b8 c6', 'b7 a8')
    await pulsar(page.getByRole('button', { name: 'Caballo', exact: true }))

    await expect(page.getByRole('button', { name: 'a8, caballo blanco' })).toBeVisible()
    await expect(page.getByText('Turno de las negras')).toBeVisible()
  })

  test('el jaque mate termina la Partida y muestra su Resultado en el turno', async ({ page, isMobile }) => {
    await tocador(page, isMobile).jugar('f2 f3', 'e7 e5', 'g2 g4', 'd8 h4')

    await expect(page.getByText('Jaque mate: ganan las negras')).toBeVisible()
  })

  test('la última Jugada queda marcada en su origen y su destino', async ({ page, isMobile }) => {
    const { jugar } = tocador(page, isMobile)
    const marca = 'Última Jugada'

    await jugar('e2 e4')
    await expect(casilla(page, 'e2')).toHaveAccessibleDescription(marca)
    await expect(casilla(page, 'e4')).toHaveAccessibleDescription(marca)

    await jugar('g8 f6')
    await expect(casilla(page, 'g8')).toHaveAccessibleDescription(marca)
    await expect(casilla(page, 'f6')).toHaveAccessibleDescription(marca)
    await expect(casilla(page, 'e2')).toHaveAccessibleDescription('')
    await expect(casilla(page, 'e4')).toHaveAccessibleDescription('')
  })

  // Mide la franja inferior de la pantalla, siempre libre de tablero y de texto.
  async function luzAbajo(page: Page) {
    const captura = (await page.screenshot()).toString('base64')
    return page.evaluate(async (datos) => {
      const imagen = new Image()
      imagen.src = `data:image/png;base64,${datos}`
      await imagen.decode()
      const lienzo = new OffscreenCanvas(imagen.width, imagen.height).getContext('2d')!
      lienzo.drawImage(imagen, 0, 0)
      const { data } = lienzo.getImageData(0, imagen.height - 8, imagen.width, 8)
      return data.reduce((suma, canal) => suma + canal, 0) / data.length
    }, captura)
  }

  test('el foco sigue al Bando en turno', async ({ page, isMobile }) => {
    const { jugar } = tocador(page, isMobile)
    const conBlancas = await luzAbajo(page)

    await jugar('e2 e4')
    await expect.poll(() => luzAbajo(page)).toBeLessThan(conBlancas - 2)

    await jugar('e7 e5')
    await expect.poll(() => luzAbajo(page)).toBeGreaterThan(conBlancas - 1)
  })
})

test('la escena se sirve entera desde la app, sin terceros', async ({ page, baseURL }) => {
  const peticiones: string[] = []
  page.on('request', (peticion) => peticiones.push(peticion.url()))

  await page.goto('.')
  await page.evaluate(() => document.fonts.ready)

  const piezas = page.getByRole('main').locator('img')
  await expect(piezas).toHaveCount(32)
  await expect
    .poll(() => piezas.evaluateAll((nodos) => nodos.every((nodo) => (nodo as HTMLImageElement).naturalWidth > 0)))
    .toBe(true)

  const tipografias = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')),
  )
  expect(tipografias).toEqual(expect.arrayContaining(['Cinzel', 'Cormorant Garamond']))

  for (const peticion of peticiones.filter((url) => !url.startsWith('data:'))) expect(peticion).toContain(baseURL)
})

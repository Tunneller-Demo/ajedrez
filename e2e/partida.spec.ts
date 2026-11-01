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

  const capa = (page: Page) => page.getByRole('dialog')
  const boton = (page: Page, nombre: string) => page.getByRole('button', { name: nombre, exact: true })
  const mateDelLoco = ['f2 f3', 'e7 e5', 'g2 g4', 'd8 h4']
  const AVISO = 'La partida en curso se perderá'

  test('una Partida hasta el jaque mate: pantalla final, «Ver la partida» y «Jugar otra vez»', async ({
    page,
    isMobile,
  }) => {
    const { jugar, pulsar } = tocador(page, isMobile)
    const arriba = async (locator: Locator) => (await locator.boundingBox())!.y

    await pulsar(boton(page, 'Girar'))
    await jugar(...mateDelLoco)

    const final = capa(page)
    await expect(final.getByRole('heading', { name: 'Jaque mate' })).toBeVisible()
    await expect(final.getByText('ganan las negras')).toBeVisible()
    await expect(final).not.toContainText('Partida')
    for (const accion of await final.getByRole('button').all()) await expect(accion).toBeInViewport({ ratio: 1 })

    await pulsar(boton(page, 'Ver la partida'))

    await expect(capa(page)).toHaveCount(0)
    await expect(page.getByText('Jaque mate: ganan las negras')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Historial' }).getByText('♛h4#')).toBeVisible()
    await expect(boton(page, 'Deshacer')).toBeEnabled()
    await expect(boton(page, 'Nueva partida')).toBeEnabled()

    await pulsar(boton(page, 'Deshacer'))
    await jugar('d8 h4')
    await pulsar(boton(page, 'Jugar otra vez'))

    await expect(capa(page)).toHaveCount(0)
    await expect(page.getByText('Turno de las blancas')).toBeVisible()
    await expect(page.getByRole('button', { name: /, (peón|torre|caballo|alfil|dama|rey) / })).toHaveCount(32)
    await expect(page.getByRole('list', { name: 'Historial' }).getByRole('listitem')).toHaveCount(0)
    expect(await arriba(casilla(page, 'a8'))).toBeLessThan(await arriba(casilla(page, 'a1')))
  })

  test('Deshacer desde la pantalla final retira solo la última Jugada', async ({ page, isMobile }) => {
    const { jugar, pulsar } = tocador(page, isMobile)

    await jugar(...mateDelLoco)
    await pulsar(capa(page).getByRole('button', { name: 'Deshacer' }))

    await expect(capa(page)).toHaveCount(0)
    await expect(page.getByText('Turno de las negras')).toBeVisible()
    await expect(casilla(page, 'd8')).toHaveAccessibleName('d8, dama negra')
    await expect(casilla(page, 'g4')).toHaveAccessibleName('g4, peón blanco')
  })

  test('recargar a mitad de Partida conserva la posición y el Historial', async ({ page, isMobile }) => {
    const { jugar } = tocador(page, isMobile)
    const historial = page.getByRole('list', { name: 'Historial' })

    await jugar('e2 e4', 'd7 d5', 'g1 f3')
    await page.reload()

    await expect(page.getByText('Turno de las negras')).toBeVisible()
    await expect(casilla(page, 'f3')).toHaveAccessibleName('f3, caballo blanco')
    await expect(casilla(page, 'g1')).toHaveAccessibleName('g1')
    await expect(historial.getByText('♞f3')).toBeVisible()
    await expect(historial.getByRole('listitem')).toHaveCount(2)
    await expect(boton(page, 'Deshacer')).toBeEnabled()
  })

  test('recargar con la Partida terminada abre la pantalla final', async ({ page, isMobile }) => {
    await tocador(page, isMobile).jugar(...mateDelLoco)
    await page.reload()

    await expect(capa(page).getByRole('heading', { name: 'Jaque mate' })).toBeVisible()
    await expect(capa(page).getByText('ganan las negras')).toBeVisible()
  })

  test('Escape cierra la pantalla final como «Ver la partida»', async ({ page, isMobile }) => {
    await tocador(page, isMobile).jugar(...mateDelLoco)
    await expect(capa(page)).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(capa(page)).toHaveCount(0)
    await expect(page.getByText('Jaque mate: ganan las negras')).toBeVisible()
  })

  test('«Nueva partida» avisa con una Partida en curso y solo la reemplaza al empezar', async ({ page, isMobile }) => {
    const { jugar, pulsar } = tocador(page, isMobile)

    await jugar('e2 e4')
    await pulsar(boton(page, 'Nueva partida'))

    await expect(capa(page).getByText(AVISO)).toBeVisible()
    await expect(capa(page)).not.toContainText('Partida')
    for (const accion of await capa(page).getByRole('button').all()) await expect(accion).toBeInViewport({ ratio: 1 })

    await pulsar(boton(page, 'Volver a la partida'))

    await expect(capa(page)).toHaveCount(0)
    await expect(casilla(page, 'e4')).toHaveAccessibleName('e4, peón blanco')
    await expect(page.getByText('Turno de las negras')).toBeVisible()

    await pulsar(boton(page, 'Nueva partida'))
    await pulsar(boton(page, 'Empezar'))

    await expect(capa(page)).toHaveCount(0)
    await expect(casilla(page, 'e2')).toHaveAccessibleName('e2, peón blanco')
    await expect(page.getByText('Turno de las blancas')).toBeVisible()
  })

  test('Escape cierra la capa de «Nueva partida» como «Volver a la partida»', async ({ page, isMobile }) => {
    const { jugar, pulsar } = tocador(page, isMobile)

    await jugar('e2 e4')
    await pulsar(boton(page, 'Nueva partida'))
    await expect(capa(page)).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(capa(page)).toHaveCount(0)
    await expect(casilla(page, 'e4')).toHaveAccessibleName('e4, peón blanco')
  })

  test('«Nueva partida» no avisa sin Jugadas', async ({ page, isMobile }) => {
    const { pulsar } = tocador(page, isMobile)

    await pulsar(boton(page, 'Nueva partida'))

    await expect(boton(page, 'Empezar')).toBeVisible()
    await expect(page.getByText(AVISO)).toHaveCount(0)
  })

  test('«Nueva partida» no avisa con la Partida terminada', async ({ page, isMobile }) => {
    const { jugar, pulsar } = tocador(page, isMobile)

    await jugar(...mateDelLoco)
    await pulsar(boton(page, 'Ver la partida'))
    await pulsar(boton(page, 'Nueva partida'))

    await expect(boton(page, 'Empezar')).toBeVisible()
    await expect(page.getByText(AVISO)).toHaveCount(0)
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

  // Lee una franja de 8 px de la pantalla: la de abajo está siempre libre de tablero y de texto.
  async function franja(page: Page, lugar: 'arriba' | 'abajo') {
    const captura = (await page.screenshot()).toString('base64')
    return page.evaluate(
      async ({ datos, lugar }) => {
        const imagen = new Image()
        imagen.src = `data:image/png;base64,${datos}`
        await imagen.decode()
        const lienzo = new OffscreenCanvas(imagen.width, imagen.height).getContext('2d')!
        lienzo.drawImage(imagen, 0, 0)
        return [...lienzo.getImageData(0, lugar === 'arriba' ? 0 : imagen.height - 8, imagen.width, 8).data]
      },
      { datos: captura, lugar },
    )
  }

  const media = (canales: number[]) => canales.reduce((suma, canal) => suma + canal, 0) / canales.length

  const luzAbajo = async (page: Page) => media(await franja(page, 'abajo'))

  // Rojo sobre azul en lo alto de la pantalla, donde cae el foco con negras en turno.
  async function rojoArriba(page: Page) {
    const canales = await franja(page, 'arriba')
    return media(canales.filter((_, indice) => indice % 4 === 0)) - media(canales.filter((_, indice) => indice % 4 === 2))
  }

  type Vista = { nombre: string; x: number; y: number }
  type ConVistas = Window & { vistas: Vista[] }

  // Apunta, fotograma a fotograma, cada animación de la página con el centro de lo que anima al aparecer.
  const grabarAnimaciones = (page: Page) =>
    page.evaluate(() => {
      const ventana = window as unknown as ConVistas
      const conocidas = new Set<Animation>()
      ventana.vistas = []
      const mirar = () => {
        for (const animacion of document.getAnimations()) {
          if (conocidas.has(animacion)) continue
          conocidas.add(animacion)
          const caja = (animacion.effect as KeyframeEffect).target!.getBoundingClientRect()
          ventana.vistas.push({
            nombre: (animacion as CSSAnimation).animationName ?? (animacion as CSSTransition).transitionProperty,
            x: caja.x + caja.width / 2,
            y: caja.y + caja.height / 2,
          })
        }
        requestAnimationFrame(mirar)
      }
      mirar()
    })

  const vistas = (page: Page) => page.evaluate(() => (window as unknown as ConVistas).vistas)
  const cuantas = async (page: Page, nombre: string) => (await vistas(page)).filter((v) => v.nombre === nombre).length

  test('la pieza vuela y al posarse queda en su casilla', async ({ page, isMobile }) => {
    await grabarAnimaciones(page)
    await tocador(page, isMobile).jugar('e2 e4')

    await expect.poll(() => cuantas(page, 'vuelo')).toBe(1)
    await expect(casilla(page, 'e4').locator('img')).toBeVisible()
    await expect(page.getByRole('main').locator('img')).toHaveCount(32)
  })

  test('en el enroque vuelan el rey y la torre', async ({ page, isMobile }) => {
    const { jugar } = tocador(page, isMobile)

    await jugar('e2 e4', 'e7 e5', 'g1 f3', 'b8 c6', 'f1 c4', 'f8 c5')
    await page.waitForFunction(() => document.getAnimations().length === 0)
    await grabarAnimaciones(page)
    await jugar('e1 g1')

    await expect.poll(() => cuantas(page, 'vuelo')).toBe(2)
    await expect(casilla(page, 'g1').locator('img')).toBeVisible()
    await expect(casilla(page, 'f1').locator('img')).toBeVisible()
  })

  test('la captura al paso disuelve el peón en su casilla real, con polvo de oro', async ({ page, isMobile }) => {
    const { jugar } = tocador(page, isMobile)

    await jugar('e2 e4', 'a7 a6', 'e4 e5', 'd7 d5')
    await grabarAnimaciones(page)
    await jugar('e5 d6')

    await expect.poll(() => cuantas(page, 'mota')).toBeGreaterThan(0)
    const caja = (await casilla(page, 'd5').boundingBox())!
    const [disolucion] = (await vistas(page)).filter((v) => v.nombre === 'disolucion')
    expect(disolucion.x).toBeCloseTo(caja.x + caja.width / 2, 0)
    expect(disolucion.y).toBeCloseTo(caja.y + caja.height / 2, 0)
  })

  test('en la Coronación el peón se funde con la pieza elegida al posarse', async ({ page, isMobile }) => {
    const { jugar, pulsar } = tocador(page, isMobile)

    await jugar('a2 a4', 'b7 b5', 'a4 b5', 'a7 a6', 'b5 a6', 'c8 b7', 'a6 b7', 'b8 c6', 'b7 a8')
    await grabarAnimaciones(page)
    await pulsar(boton(page, 'Caballo'))

    await expect.poll(() => cuantas(page, 'coronada')).toBe(1)
  })

  test('el jaque traza un rayo y tiñe el foco de rojo', async ({ page, isMobile }) => {
    const { jugar } = tocador(page, isMobile)

    await jugar('e2 e4', 'f7 f5', 'a2 a3')
    await page.waitForFunction(() => document.getAnimations().length === 0)
    const sinJaque = await rojoArriba(page)

    await jugar('a7 a6')
    await grabarAnimaciones(page)
    await jugar('d1 h5')

    await expect.poll(() => cuantas(page, 'rayo')).toBe(1)
    await expect.poll(() => rojoArriba(page)).toBeGreaterThan(sinJaque + 2)
  })

  test('el jaque mate apaga la escena, sube el rey vencedor y muestra el título', async ({ page, isMobile }) => {
    await grabarAnimaciones(page)
    await tocador(page, isMobile).jugar(...mateDelLoco)

    await expect(capa(page).getByRole('heading', { name: 'Jaque mate' })).toBeVisible()
    await expect(capa(page).locator('img')).toHaveAttribute('src', /bK\.svg$/)
    await expect.poll(() => cuantas(page, 'apagon')).toBe(1)
    await expect.poll(() => cuantas(page, 'subir')).toBe(1)
    await expect.poll(() => cuantas(page, 'titulo')).toBe(1)
  })

  test('una Jugada corta la animación de la anterior y solo avisa la última', async ({ page }) => {
    await grabarAnimaciones(page)

    // Toca desde la página, un fotograma por casilla: con Playwright las Jugadas no llegan a pisarse.
    await page.evaluate(async (jugadas) => {
      for (const nombre of jugadas.join(' ').split(' ')) {
        document.querySelector<HTMLElement>(`[aria-label="${nombre}"], [aria-label^="${nombre},"]`)!.click()
        await new Promise(requestAnimationFrame)
      }
    }, mateDelLoco)

    expect(await capa(page).count()).toBe(0)
    await expect(capa(page).getByRole('heading', { name: 'Jaque mate' })).toBeVisible()
    await expect.poll(() => cuantas(page, 'vuelo')).toBe(4)
  })

  test.describe('con prefers-reduced-motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } })

    test('no hay ninguna animación y la Sesión de Partida recibe el aviso', async ({ page, isMobile }) => {
      const { jugar } = tocador(page, isMobile)

      await grabarAnimaciones(page)
      await jugar('e2 e4')
      await expect(casilla(page, 'e4').locator('img')).toBeVisible()

      // Captura, jaque y mate. La pantalla final solo se abre tras el aviso.
      await jugar('f7 f5', 'e4 f5', 'g7 g5', 'd1 h5')
      await expect(capa(page).getByRole('heading', { name: 'Jaque mate' })).toBeVisible()
      await expect(capa(page).locator('img')).toBeVisible()

      expect(await vistas(page)).toEqual([])
    })
  })

  test('el foco sigue al Bando en turno', async ({ page, isMobile }) => {
    const { jugar } = tocador(page, isMobile)
    const conBlancas = await luzAbajo(page)

    await jugar('e2 e4')
    await expect.poll(() => luzAbajo(page)).toBeLessThan(conBlancas - 2)

    await jugar('e7 e5')
    await expect.poll(() => luzAbajo(page)).toBeGreaterThan(conBlancas - 1)
  })

  test('el Historial lleva figuritas y sigue a la última Jugada', async ({ page, isMobile }) => {
    const { jugar } = tocador(page, isMobile)
    const historial = page.getByRole('list', { name: 'Historial' })
    if (!isMobile) await page.setViewportSize({ width: 1000, height: 520 })

    await jugar('g1 f3')
    await expect(historial.getByText('♞f3')).toBeVisible()

    await jugar(
      'a7 a6', 'a2 a3', 'b7 b6', 'b2 b3', 'c7 c6', 'c2 c3', 'd7 d6', 'd2 d3', 'e7 e6', 'e2 e3', 'f7 f6',
      'g2 g3', 'g7 g6', 'h2 h3', 'h7 h6', 'a3 a4', 'a6 a5', 'b3 b4', 'b6 b5', 'c3 c4', 'c6 c5', 'd3 d4',
    )

    await expect(historial.getByText('♞f3')).not.toBeInViewport()
    await expect(historial.getByText('d4', { exact: true })).toBeInViewport()
  })

  test('el Historial se recorre hacia atrás con el teclado', async ({ page, isMobile }, testInfo) => {
    const { jugar } = tocador(page, isMobile)
    const historial = page.getByRole('list', { name: 'Historial' })
    if (!isMobile) await page.setViewportSize({ width: 1000, height: 520 })

    await jugar(
      'g1 f3', 'a7 a6', 'a2 a3', 'b7 b6', 'b2 b3', 'c7 c6', 'c2 c3', 'd7 d6', 'd2 d3', 'e7 e6', 'e2 e3',
      'f7 f6', 'g2 g3', 'g7 g6', 'h2 h3', 'h7 h6', 'a3 a4', 'a6 a5', 'b3 b4', 'b6 b5', 'c3 c4', 'c6 c5',
    )
    await expect(historial.getByText('♞f3')).not.toBeInViewport()

    // En vertical es una tira horizontal, que Home no recorre.
    const tecla = testInfo.project.name === 'movil' ? 'ArrowLeft' : 'Home'
    await historial.focus()

    await expect(async () => {
      await page.keyboard.press(tecla)
      await expect(historial.getByText('♞f3')).toBeInViewport({ timeout: 100 })
    }).toPass()
  })

  test('las capturadas van junto al Bando que capturó, también al paso', async ({ page, isMobile }) => {
    const { jugar } = tocador(page, isMobile)
    const deBlancas = page.getByRole('list', { name: 'Capturadas por las blancas' })
    const deNegras = page.getByRole('list', { name: 'Capturadas por las negras' })

    await jugar('e2 e4', 'd7 d5', 'e4 d5', 'd8 d5', 'b1 c3', 'd5 a2', 'a1 a2')
    await expect(deBlancas.getByRole('img', { name: 'peón negro' })).toHaveCount(1)
    await expect(deBlancas.getByRole('img', { name: 'dama negra' })).toHaveCount(1)
    await expect(deNegras.getByRole('img', { name: 'peón blanco' })).toHaveCount(2)

    await jugar('a7 a6', 'h2 h4', 'a6 a5', 'h4 h5', 'g7 g5', 'h5 g6')
    await expect(casilla(page, 'g5')).toHaveAccessibleName('g5')
    await expect(deBlancas.getByRole('img', { name: 'peón negro' })).toHaveCount(2)
  })

  test('Deshacer retira una Jugada y se desactiva al llegar al inicio', async ({ page, isMobile }) => {
    const { jugar, pulsar } = tocador(page, isMobile)
    const deshacer = page.getByRole('button', { name: 'Deshacer' })

    await expect(deshacer).toBeDisabled()

    await jugar('e2 e4', 'd7 d5', 'e4 d5')
    await pulsar(deshacer)

    await expect(casilla(page, 'd5')).toHaveAccessibleName('d5, peón negro')
    await expect(page.getByText('Turno de las blancas')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Capturadas por las blancas' }).getByRole('img')).toHaveCount(0)

    await pulsar(deshacer)
    await pulsar(deshacer)

    await expect(casilla(page, 'e2')).toHaveAccessibleName('e2, peón blanco')
    await expect(deshacer).toBeDisabled()
  })

  test('Girar da la vuelta al tablero, a sus coordenadas y a las capturadas', async ({ page, isMobile }) => {
    const { jugar, pulsar } = tocador(page, isMobile)
    const deBlancas = page.getByRole('list', { name: 'Capturadas por las blancas' })
    const deNegras = page.getByRole('list', { name: 'Capturadas por las negras' })
    const arriba = async (locator: Locator) => (await locator.boundingBox())!.y

    await jugar('e2 e4', 'd7 d5', 'e4 d5')
    expect(await arriba(casilla(page, 'a8'))).toBeLessThan(await arriba(casilla(page, 'a1')))
    expect(await arriba(deNegras)).toBeLessThan(await arriba(deBlancas))

    await pulsar(page.getByRole('button', { name: 'Girar' }))

    expect(await arriba(casilla(page, 'a1'))).toBeLessThan(await arriba(casilla(page, 'a8')))
    expect(await arriba(deBlancas)).toBeLessThan(await arriba(deNegras))
    await expect(casilla(page, 'h8').getByText('h', { exact: true })).toBeVisible()
    await expect(casilla(page, 'h8').getByText('8', { exact: true })).toBeVisible()
    await expect(deBlancas.getByRole('img', { name: 'peón negro' })).toHaveCount(1)
  })

  test('el tablero no gira solo y el foco sigue al Bando al girar', async ({ page, isMobile }) => {
    const { jugar, pulsar } = tocador(page, isMobile)
    const arriba = async (locator: Locator) => (await locator.boundingBox())!.y
    const conBlancas = await luzAbajo(page)

    await jugar('e2 e4', 'e7 e5', 'g1 f3')
    expect(await arriba(casilla(page, 'a8'))).toBeLessThan(await arriba(casilla(page, 'a1')))

    await pulsar(page.getByRole('button', { name: 'Girar' }))

    await expect.poll(() => luzAbajo(page)).toBeGreaterThan(conBlancas - 1)
  })

  test('las acciones tienen su alto y se reparten el ancho en móvil', async ({ page, isMobile }, testInfo) => {
    const acciones = page.getByRole('button', { name: /^(Deshacer|Girar|Nueva partida)$/ })
    const cajas = await Promise.all((await acciones.all()).map(async (accion) => (await accion.boundingBox())!))

    expect(cajas).toHaveLength(3)
    for (const { height } of cajas) {
      if (isMobile) expect(height).toBe(44)
      else expect(height).toBeGreaterThanOrEqual(32)
    }
    if (testInfo.project.name === 'movil') {
      const ultima = cajas[2]
      expect(cajas[0].x).toBeLessThanOrEqual(8)
      expect(ultima.x + ultima.width).toBeGreaterThanOrEqual(382)
    }
  })

  test('no hay desborde con el Historial lleno', async ({ page, isMobile }) => {
    await tocador(page, isMobile).jugar('g1 f3', 'g8 f6', 'b1 c3', 'b8 c6', 'e2 e4', 'e7 e5', 'd2 d4', 'd7 d5', 'e4 d5', 'e5 d4')

    const medidas = await page.evaluate(() => {
      const { scrollWidth, clientWidth, scrollHeight, clientHeight } = document.documentElement
      return { scrollWidth, clientWidth, scrollHeight, clientHeight }
    })

    expect(medidas.scrollWidth).toBeLessThanOrEqual(medidas.clientWidth)
    expect(medidas.scrollHeight).toBeLessThanOrEqual(medidas.clientHeight)
  })

  test('el tablero no se mueve al aparecer la primera Jugada', async ({ page, isMobile }) => {
    const antes = (await casilla(page, 'a8').boundingBox())!

    await tocador(page, isMobile).jugar('e2 e4')

    expect((await casilla(page, 'a8').boundingBox())!.y).toBe(antes.y)
  })

  test('cada disposición coloca el tablero en su sitio', async ({ page }, testInfo) => {
    const a8 = (await casilla(page, 'a8').boundingBox())!
    const h1 = (await casilla(page, 'h1').boundingBox())!
    const historial = (await page.getByRole('list', { name: 'Historial' }).boundingBox())!
    const titulo = (await page.getByRole('heading', { name: 'Ajedrez de Gala' }).boundingBox())!
    const lado = h1.x + h1.width - a8.x

    if (testInfo.project.name === 'movil') {
      expect(lado).toBeGreaterThan(388)
      expect(titulo.y).toBeLessThan(a8.y)
      expect(historial.y).toBeGreaterThan(h1.y + h1.height)
    } else {
      expect(historial.x).toBeGreaterThanOrEqual(h1.x + h1.width)
    }
    if (testInfo.project.name === 'horizontal') expect(lado).toBeGreaterThan(330)
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

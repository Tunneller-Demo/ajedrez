import { expect, test, type Locator, type Page } from '@playwright/test'

const casilla = (page: Page, nombre: string) => page.getByRole('button', { name: new RegExp(`^${nombre}(,|$)`) })
const boton = (ambito: Page | Locator, nombre: string) => ambito.getByRole('button', { name: nombre, exact: true })
const opcion = (page: Page, nombre: string) => page.getByRole('radio', { name: nombre, exact: true })
const capa = (page: Page) => page.getByRole('dialog')
const turnoDeBlancas = (page: Page) => page.getByText('Turno de las blancas')
// Si el motor tarda en cargar, el turno de la Máquina empieza con «se prepara…».
const piensa = (page: Page) => page.getByText(/^La Máquina (piensa|se prepara)…/)

async function empezarContraLaMaquina(page: Page, bando = 'Blancas', nivel = 'Fácil') {
  await boton(page, 'Contra la Máquina').click()
  await opcion(page, bando).check()
  await opcion(page, nivel).check()
  await boton(page, 'Empezar').click()
  await expect(capa(page)).toHaveCount(0)
}

async function jugar(page: Page, jugada: string) {
  const [desde, hasta] = jugada.split(' ')
  await casilla(page, desde).click()
  await casilla(page, hasta).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('.')
})

test.describe('elección de Partida', () => {
  test('sin Partida guardada arranca en la elección, con el tablero detrás y sin nada a lo que volver', async ({
    page,
  }) => {
    await expect(capa(page)).toBeVisible()
    await expect(boton(page, 'Dos personas')).toBeFocused()
    await expect(boton(page, 'Dos personas')).toHaveAttribute('aria-current', 'true')
    await expect(boton(page, 'Volver a la partida')).toHaveCount(0)
    await expect(page.locator('main img')).toHaveCount(32)
    await expect(page.locator('main img').first()).toBeVisible()
  })

  test('«Contra la Máquina» muestra Bando y Nivel preseleccionados, y «Volver» regresa', async ({ page }) => {
    await boton(page, 'Contra la Máquina').click()

    await expect(boton(page, 'Empezar')).toBeFocused()
    await expect(opcion(page, 'Blancas')).toBeChecked()
    await expect(opcion(page, 'Medio')).toBeChecked()
    for (const nombre of ['Negras', 'Al azar', 'Fácil', 'Difícil', 'Máximo']) await expect(opcion(page, nombre)).not.toBeChecked()

    await boton(page, 'Volver').click()

    await expect(boton(page, 'Contra la Máquina')).toBeFocused()
    await expect(boton(page, 'Contra la Máquina')).toHaveAttribute('aria-current', 'true')
  })

  test('Escape retrocede un paso y sin Partida detrás no cierra la elección', async ({ page }) => {
    await page.keyboard.press('Escape')
    await expect(boton(page, 'Dos personas')).toBeVisible()

    await boton(page, 'Contra la Máquina').click()
    await page.keyboard.press('Escape')
    await expect(boton(page, 'Contra la Máquina')).toBeVisible()
    await expect(boton(page, 'Empezar')).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect(boton(page, 'Dos personas')).toBeVisible()
  })

  test('todo cabe en pantalla en ambos pasos', async ({ page }) => {
    const enPantalla = async () => {
      for (const elemento of await capa(page).locator('button, input').all()) {
        await expect(elemento).toBeInViewport({ ratio: 1 })
      }
    }

    await enPantalla()
    await boton(page, 'Contra la Máquina').click()
    await enPantalla()
  })

  test('recuerda la última elección tras recargar sin Partida', async ({ page }) => {
    await empezarContraLaMaquina(page, 'Al azar', 'Difícil')
    await page.evaluate(() => localStorage.removeItem('ajedrez-de-gala:partida'))
    await page.reload()

    await expect(boton(page, 'Contra la Máquina')).toBeFocused()
    await boton(page, 'Contra la Máquina').click()

    await expect(opcion(page, 'Al azar')).toBeChecked()
    await expect(opcion(page, 'Difícil')).toBeChecked()
  })
})

test.describe('Partida contra la Máquina bajo la ruta base', () => {
  test('una Partida corta en Fácil: la Máquina responde a cada Jugada', async ({ page }) => {
    await empezarContraLaMaquina(page)

    for (const jugada of ['a2 a3', 'h2 h3', 'b2 b3']) {
      await jugar(page, jugada)
      await expect(piensa(page)).toBeVisible()
      await expect(turnoDeBlancas(page)).toBeVisible()
    }

    const pares = page.getByRole('list', { name: 'Historial' }).getByRole('listitem')
    await expect(pares).toHaveCount(3)
    await expect(pares.nth(2).locator('span').nth(2)).not.toBeEmpty()
  })

  test('con negras el tablero gira, la Máquina abre y su Jugada se anuncia', async ({ page }) => {
    await empezarContraLaMaquina(page, 'Negras')
    const arriba = async (nombre: string) => (await casilla(page, nombre).boundingBox())!.y

    expect(await arriba('a1')).toBeLessThan(await arriba('a8'))
    await expect(page.getByText('Turno de las negras')).toBeVisible()
    await expect(page.getByRole('status')).toHaveText(/^La Máquina juega /)
    await expect(page.getByRole('list', { name: 'Historial' }).getByRole('listitem')).toHaveCount(1)
  })

  test('la Jugada de la Máquina no mueve el foco del teclado', async ({ page }) => {
    await empezarContraLaMaquina(page)
    await expect(casilla(page, 'e2')).toBeFocused()

    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('Enter')

    await expect(piensa(page)).toBeVisible()
    await expect(turnoDeBlancas(page)).toBeVisible()
    await expect(casilla(page, 'e4')).toBeFocused()
  })

  test('con la elección abierta, la Jugada de la Máquina se sigue anunciando', async ({ page }) => {
    await empezarContraLaMaquina(page)
    await jugar(page, 'e2 e4')
    await expect(piensa(page)).toBeVisible()

    await boton(page, 'Nueva partida').click()

    await expect(capa(page).getByRole('status')).toHaveText(/^La Máquina juega /)
  })

  test('el lateral nombra al Rival y al Nivel, sin chocar con el silencio', async ({ page }) => {
    await empezarContraLaMaquina(page)

    const rival = page.getByText('Contra la Máquina · Fácil')
    await expect(rival).toBeVisible()

    const silencio = (await boton(page, 'Silencio').boundingBox())!
    const { right, top } = await rival.evaluate((nodo) => {
      const rango = document.createRange()
      rango.selectNodeContents(nodo)
      return rango.getBoundingClientRect()
    })
    expect(right <= silencio.x || top >= silencio.y + silencio.height).toBe(true)
  })

  test('la Partida empieza y se juega sin esperar la descarga del motor', async ({ page }) => {
    let soltar = () => {}
    const descarga = new Promise<void>((pasar) => (soltar = pasar))
    let retenidas = 0
    await page.route('**/motor/*', async (ruta) => {
      retenidas++
      await descarga
      await ruta.continue()
    })

    await empezarContraLaMaquina(page)
    await jugar(page, 'e2 e4')

    await expect(casilla(page, 'e4')).toHaveAccessibleName(/^e4, peón blanco/)
    await expect(page.getByText('La Máquina se prepara…')).toBeVisible()
    await expect(page.getByRole('status')).toHaveText('La Máquina se prepara')
    await expect.poll(() => retenidas).toBeGreaterThan(0)

    soltar()

    await expect(turnoDeBlancas(page)).toBeVisible({ timeout: 15_000 })
  })

  test('Deshacer retira también la Jugada de la persona y le devuelve el turno', async ({ page }) => {
    await empezarContraLaMaquina(page)
    await jugar(page, 'e2 e4')
    await expect(turnoDeBlancas(page)).toBeVisible()

    await boton(page, 'Deshacer').click()

    await expect(casilla(page, 'e2')).toHaveAccessibleName(/^e2, peón blanco/)
    await expect(page.getByRole('list', { name: 'Historial' }).getByRole('listitem')).toHaveCount(0)
    await expect(turnoDeBlancas(page)).toBeVisible()
    await expect(boton(page, 'Deshacer')).toHaveAttribute('aria-disabled', 'true')
  })

  test('mientras piensa, Deshacer la interrumpe y devuelve el turno', async ({ page }) => {
    await empezarContraLaMaquina(page)
    await jugar(page, 'e2 e4')
    await expect(piensa(page)).toBeVisible()

    await boton(page, 'Deshacer').click()

    await expect(turnoDeBlancas(page)).toBeVisible()
    await expect(page.getByRole('list', { name: 'Historial' }).getByRole('listitem')).toHaveCount(0)
  })

  test('con negras, Deshacer está desactivado tras la primera Jugada de la Máquina', async ({ page }) => {
    await empezarContraLaMaquina(page, 'Negras')
    await expect(page.getByText('Turno de las negras')).toBeVisible()

    await expect(boton(page, 'Deshacer')).toHaveAttribute('aria-disabled', 'true')
    await boton(page, 'Deshacer').focus()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('list', { name: 'Historial' }).getByRole('listitem')).toHaveCount(1)
  })

  test('la luz respira mientras piensa y la Jugada de la Máquina vuela', async ({ page }) => {
    await empezarContraLaMaquina(page)
    await jugar(page, 'e2 e4')

    await expect(piensa(page)).toBeVisible()
    await expect(page.locator('.foco')).toHaveCSS('animation-name', 'respirar')

    await expect(turnoDeBlancas(page)).toBeVisible()
    await expect(page.locator('.foco')).toHaveCSS('animation-name', 'none')
    await expect(page.locator('.pieza-de-la-maquina')).toHaveCSS('animation-name', 'none')
  })

  test.describe('al recargar a mitad de Partida', () => {
    const lateral = (page: Page) => page.getByText('Contra la Máquina · Fácil')
    const historial = (page: Page) => page.getByRole('list', { name: 'Historial' }).getByRole('listitem')

    test('con turno de la Máquina, ella juega y la Partida sigue', async ({ page }) => {
      await empezarContraLaMaquina(page)
      await jugar(page, 'e2 e4')
      await expect(piensa(page)).toBeVisible()

      await page.reload()

      await expect(capa(page)).toHaveCount(0)
      await expect(lateral(page)).toBeVisible()
      await expect(page.getByRole('status')).toHaveText(/^La Máquina juega /, { timeout: 15_000 })
      await expect(turnoDeBlancas(page)).toBeVisible()

      await jugar(page, 'a2 a3')
      await expect(turnoDeBlancas(page)).toBeVisible()
      await expect(historial(page)).toHaveCount(2)
      await expect(historial(page).nth(1).locator('span').nth(2)).not.toBeEmpty()
    })

    test('con turno de la persona, el motor se descarga sin pedir Jugada', async ({ page }) => {
      await empezarContraLaMaquina(page)
      await jugar(page, 'e2 e4')
      await expect(turnoDeBlancas(page)).toBeVisible()

      const descarga = page.waitForRequest('**/motor/*.js')
      await page.reload()
      await descarga

      await expect(capa(page)).toHaveCount(0)
      await expect(turnoDeBlancas(page)).toBeVisible()
      await expect(historial(page).first().locator('span').nth(2)).not.toBeEmpty()
      await expect(historial(page)).toHaveCount(1)

      await jugar(page, 'd2 d4')
      await expect(turnoDeBlancas(page)).toBeVisible()
      await expect(historial(page)).toHaveCount(2)
    })

    test('con negras conserva el tablero girado, y anuncia que la Máquina se prepara', async ({ page }) => {
      await empezarContraLaMaquina(page, 'Negras')
      await expect(page.getByText('Turno de las negras')).toBeVisible()
      await jugar(page, 'e7 e5')
      await page.route('**/motor/*', async (ruta) => {
        await new Promise((pasar) => setTimeout(pasar, 1500))
        await ruta.continue()
      })

      await page.reload()

      await expect(page.getByRole('status')).toHaveText('La Máquina se prepara')
      const arriba = async (nombre: string) => (await casilla(page, nombre).boundingBox())!.y
      expect(await arriba('a1')).toBeLessThan(await arriba('a8'))
      await expect(page.getByText('Turno de las negras')).toBeVisible({ timeout: 15_000 })
      await expect(historial(page)).toHaveCount(2)
    })
  })

  test.describe('con prefers-reduced-motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } })

    test('la Jugada de la Máquina se funde y conserva la pausa', async ({ page }) => {
      await empezarContraLaMaquina(page)

      const inicio = Date.now()
      await jugar(page, 'e2 e4')
      await expect(piensa(page)).toBeVisible()
      await expect(page.locator('.foco')).toHaveCSS('animation-name', 'none')
      await expect(turnoDeBlancas(page)).toBeVisible()

      expect(Date.now() - inicio).toBeGreaterThanOrEqual(700)
      await expect(page.locator('.pieza-de-la-maquina')).toHaveCSS('animation-name', 'fundido')
    })
  })
})

test.describe('cuando la Máquina no responde', () => {
  const aviso = (page: Page) => page.getByRole('alert')
  const lateral = (page: Page) => page.getByText('Contra la Máquina · Fácil')
  const historial = (page: Page) => page.getByRole('list', { name: 'Historial' }).getByRole('listitem')
  const casillaConFoco = (page: Page) => page.locator('[data-casilla][tabindex="0"]')

  async function avisoConElFoco(page: Page) {
    await expect(aviso(page)).toHaveText('La Máquina no responde. Tu partida sigue guardada')
    await expect(boton(page, 'Reintentar')).toBeFocused()
  }

  async function conElMotorCaido(page: Page) {
    await page.route('**/motor/*', (ruta) => ruta.abort())
    await empezarContraLaMaquina(page)
    await jugar(page, 'e2 e4')
    await avisoConElFoco(page)
  }

  test('si el motor no descarga, el aviso cabe en pantalla y no deja mover', async ({ page }) => {
    await conElMotorCaido(page)

    await expect(aviso(page)).toBeInViewport({ ratio: 1 })
    await expect(boton(page, 'Reintentar')).toBeInViewport({ ratio: 1 })
    await expect(boton(page, 'Seguir a dos')).toBeInViewport({ ratio: 1 })
    await expect(lateral(page)).toBeVisible()
    await expect(page.getByText('Turno de las negras')).toBeVisible()

    await casilla(page, 'e7').click()

    await expect(casilla(page, 'e7')).toHaveAttribute('aria-pressed', 'false')
    await expect(historial(page)).toHaveCount(1)
  })

  test('«Reintentar» falla otra vez con el motor caído y lo recupera cuando vuelve', async ({ page }) => {
    await conElMotorCaido(page)

    await boton(page, 'Reintentar').click()
    await avisoConElFoco(page)

    await page.unroute('**/motor/*')
    await boton(page, 'Reintentar').click()

    await expect(aviso(page)).toHaveCount(0)
    await expect(casillaConFoco(page)).toBeFocused()
    await expect(page.getByRole('status')).toHaveText(/^La Máquina juega /, { timeout: 15_000 })
    await expect(turnoDeBlancas(page)).toBeVisible()
    await expect(lateral(page)).toBeVisible()
  })

  test('«Seguir a dos» conserva el Historial, deja mover a ambos Bandos y sobrevive a la recarga', async ({ page }) => {
    await conElMotorCaido(page)

    await boton(page, 'Seguir a dos').click()

    await expect(aviso(page)).toHaveCount(0)
    await expect(casillaConFoco(page)).toBeFocused()
    await expect(lateral(page)).toHaveCount(0)
    await expect(historial(page)).toHaveCount(1)

    await jugar(page, 'e7 e5')
    await expect(turnoDeBlancas(page)).toBeVisible()

    await boton(page, 'Deshacer').click()
    await expect(casilla(page, 'e7')).toHaveAccessibleName(/^e7, peón negro/)
    await expect(casilla(page, 'e4')).toHaveAccessibleName(/^e4, peón blanco/)

    await page.reload()

    await expect(capa(page)).toHaveCount(0)
    await expect(aviso(page)).toHaveCount(0)
    await expect(lateral(page)).toHaveCount(0)
    await expect(page.getByText('Turno de las negras')).toBeVisible()
    await jugar(page, 'e7 e5')
    await expect(turnoDeBlancas(page)).toBeVisible()
  })

  test('Deshacer retira la Jugada de la persona, le devuelve el turno y quita el aviso', async ({ page }) => {
    await conElMotorCaido(page)

    await boton(page, 'Deshacer').click()

    await expect(aviso(page)).toHaveCount(0)
    await expect(casilla(page, 'e2')).toHaveAccessibleName(/^e2, peón blanco/)
    await expect(historial(page)).toHaveCount(0)
    await expect(turnoDeBlancas(page)).toBeVisible()
  })

  test('«Nueva partida» sigue disponible: volver recupera el aviso y empezar lo descarta', async ({ page }) => {
    await conElMotorCaido(page)

    await boton(page, 'Nueva partida').click()
    await expect(aviso(page)).toHaveCount(0)
    await boton(page, 'Volver a la partida').click()
    await avisoConElFoco(page)

    await boton(page, 'Nueva partida').click()
    await boton(page, 'Dos personas').click()

    await expect(capa(page)).toHaveCount(0)
    await expect(aviso(page)).toHaveCount(0)
    await expect(historial(page)).toHaveCount(0)
  })

  test('un fallo con la elección abierta espera a que se vuelva a la Partida', async ({ page }) => {
    let soltar = () => {}
    const caida = new Promise<void>((pasar) => (soltar = pasar))
    await page.route('**/motor/*', async (ruta) => {
      await caida
      await ruta.abort()
    })
    await empezarContraLaMaquina(page)
    await jugar(page, 'e2 e4')
    await expect(page.getByText('La Máquina se prepara…')).toBeVisible()
    await boton(page, 'Nueva partida').click()

    soltar()

    await expect(aviso(page)).toHaveCount(0)
    await boton(page, 'Volver a la partida').click()
    await avisoConElFoco(page)
  })

  test('al recargar durante el aviso se vuelve a pedir la Jugada', async ({ page }) => {
    await conElMotorCaido(page)

    await page.reload()

    await avisoConElFoco(page)
    await expect(lateral(page)).toBeVisible()
  })

  test('un .wasm que no llega da el aviso al vencer el tiempo de preparación', async ({ page }) => {
    // Solo se acorta la espera de 30 s: el resto del camino es el real.
    await page.addInitScript(() => {
      const original = window.setTimeout
      window.setTimeout = ((accion: TimerHandler, ms?: number) =>
        original(accion, ms === 30_000 ? 2000 : ms)) as typeof window.setTimeout
    })
    await page.route('**/motor/*.wasm', (ruta) => ruta.abort())
    await page.reload()
    await empezarContraLaMaquina(page)
    await jugar(page, 'e2 e4')

    await expect(page.getByText('La Máquina se prepara…')).toBeVisible()
    await avisoConElFoco(page)
  })

  test('sin SIMD de WebAssembly da el aviso sin descargar el motor', async ({ page }) => {
    let descargas = 0
    await page.route('**/motor/*', (ruta) => {
      descargas++
      return ruta.continue()
    })
    await page.addInitScript(() => {
      WebAssembly.validate = () => false
    })
    await page.reload()

    await empezarContraLaMaquina(page)
    await jugar(page, 'e2 e4')

    await avisoConElFoco(page)
    expect(descargas).toBe(0)
  })
})

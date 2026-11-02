import { expect, test, type Locator, type Page } from '@playwright/test'

const casilla = (page: Page, nombre: string) => page.getByRole('button', { name: new RegExp(`^${nombre}(,|$)`) })
const boton = (ambito: Page | Locator, nombre: string) => ambito.getByRole('button', { name: nombre, exact: true })
const opcion = (page: Page, nombre: string) => page.getByRole('radio', { name: nombre, exact: true })
const capa = (page: Page) => page.getByRole('dialog')
const turnoDeBlancas = (page: Page) => page.getByText('Turno de las blancas')
const piensa = (page: Page) => page.getByText('La Máquina piensa…')

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
    await expect(piensa(page)).toBeVisible()
    await expect.poll(() => retenidas).toBeGreaterThan(0)

    soltar()

    await expect(turnoDeBlancas(page)).toBeVisible({ timeout: 15_000 })
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

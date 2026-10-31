import { expect, test, type Locator, type Page } from '@playwright/test'

const casilla = (page: Page, nombre: string) => page.getByRole('button', { name: new RegExp(`^${nombre}(,|$)`) })

test.describe('Partida a dos bajo /ajedrez/', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ajedrez/')
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
})

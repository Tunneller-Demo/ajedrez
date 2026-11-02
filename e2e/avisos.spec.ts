import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const FUENTE_DEL_MOTOR = 'https://github.com/nmrugg/stockfish.js/tree/v19.0.1'

const creditos = (page: Page) => page.getByRole('link', { name: /^Créditos/ })

// Lo que el lockfile instala para producción: cualquier paquete nuevo debe entrar en los avisos.
function paquetesDeProduccion() {
  const { packages } = JSON.parse(readFileSync('package-lock.json', 'utf8'))
  return Object.entries<{ version: string; dev?: boolean; devOptional?: boolean }>(packages)
    .filter(([ruta, { dev, devOptional }]) => ruta && !dev && !devOptional)
    .map(([ruta, { version }]) => `${ruta.replace('node_modules/', '')} ${version}`)
}

test.describe('Avisos de terceros', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('avisos/')
  })

  test('citan todo lo que se distribuye, con su licencia', async ({ page }) => {
    const texto = await page.locator('main').innerText()

    for (const paquete of paquetesDeProduccion()) expect(texto).toContain(paquete)
    expect(texto).toContain('tailwindcss')
    expect(texto).toContain('Maurizio Monge')
    expect(texto).toContain('Redistribution and use in source and binary forms')
    expect(texto).toContain('SIL OPEN FONT LICENSE')
  })

  test('llevan al texto de la GPL y al código fuente del motor', async ({ page, request }) => {
    const licencia = await page.getByRole('link', { name: 'Copying.txt' }).evaluate((a: HTMLAnchorElement) => a.href)

    expect(await (await request.get(licencia)).text()).toContain('GNU GENERAL PUBLIC LICENSE')
    await expect(page.getByRole('link', { name: FUENTE_DEL_MOTOR })).toHaveAttribute('href', FUENTE_DEL_MOTOR)
  })

  test('sin infracciones de axe-core', async ({ page }) => {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  })
})

test('junto a Copying.txt se publica el enlace al código fuente y a la red del motor', async ({ request }) => {
  const fuente = await (await request.get('motor/CODIGO-FUENTE.txt')).text()

  expect(fuente).toContain(FUENTE_DEL_MOTOR)
  expect(fuente).toContain('nn-61e7af4bb97d.nnue')
})

test('«Créditos» cabe en pantalla junto al aviso de la Partida en curso', async ({ page }) => {
  await page.goto('.')
  await page.getByRole('button', { name: 'Dos personas', exact: true }).click()
  await page.getByRole('button', { name: /^e2/ }).click()
  await page.getByRole('button', { name: /^e4/ }).click()
  await page.getByRole('button', { name: 'Nueva partida', exact: true }).click()

  await expect(page.getByText('La partida en curso se perderá')).toBeVisible()
  await expect(creditos(page)).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('heading', { name: 'Nueva partida' })).toBeInViewport({ ratio: 1 })
})

test('«Créditos» llega a los avisos con el teclado y sin dejar la Partida', async ({ page, context, baseURL }) => {
  await page.goto('.')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(creditos(page)).toBeFocused()

  const [avisos] = await Promise.all([context.waitForEvent('page'), page.keyboard.press('Enter')])

  await expect(avisos).toHaveURL(`${baseURL}avisos/`)
  await expect(avisos.getByRole('heading', { level: 1 })).toHaveText('Avisos de terceros')
  await expect(page.getByRole('dialog')).toBeVisible()
})

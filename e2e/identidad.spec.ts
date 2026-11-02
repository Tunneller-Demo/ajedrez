import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const PRODUCCION = 'https://tunneller-demo.github.io/ajedrez/'
const TITULO = 'Ajedrez de Gala · Juega en tu navegador'
const DESCRIPCION = 'Ajedrez a la luz del foco, con piezas de marfil y oro. Juega con otra persona o contra la Máquina. Gratis y sin registro.'

const meta = (page: Page, selector: string) => page.locator(`meta[${selector}]`).getAttribute('content')
const enlace = (page: Page, rel: string) => page.locator(`link[rel="${rel}"]`).evaluate((link: HTMLLinkElement) => link.href)

// El ancho y el alto de un PNG van en su cabecera IHDR.
const medidasDePng = (png: Buffer) => ({ ancho: png.readUInt32BE(16), alto: png.readUInt32BE(20) })

async function pedirImagen(request: APIRequestContext, url: string, tipo: string) {
  const respuesta = await request.get(url)
  expect(respuesta.ok()).toBe(true)
  expect(respuesta.headers()['content-type']).toContain(tipo)
  return respuesta.body()
}

test.describe('Identidad para compartir', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.')
  })

  test('la pestaña y los buscadores reciben el nombre y la descripción', async ({ page }) => {
    await expect(page).toHaveTitle(TITULO)
    expect(await meta(page, 'name="description"')).toBe(DESCRIPCION)
    expect(await meta(page, 'name="theme-color"')).toBe('#0a0810')
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe(PRODUCCION)
  })

  test('Open Graph y la tarjeta apuntan a producción con URLs absolutas', async ({ page }) => {
    const tarjeta = `${PRODUCCION}identidad/tarjeta.png`

    const esperados = {
      'property="og:type"': 'website',
      'property="og:site_name"': 'Ajedrez de Gala',
      'property="og:locale"': 'es_ES',
      'property="og:url"': PRODUCCION,
      'property="og:title"': TITULO,
      'property="og:description"': DESCRIPCION,
      'property="og:image"': tarjeta,
      'property="og:image:width"': '1200',
      'property="og:image:height"': '630',
      'name="twitter:card"': 'summary_large_image',
      'name="twitter:title"': TITULO,
      'name="twitter:description"': DESCRIPCION,
      'name="twitter:image"': tarjeta,
    }

    for (const [selector, valor] of Object.entries(esperados)) {
      expect(await meta(page, selector), selector).toBe(valor)
    }
    expect(await meta(page, 'property="og:image:alt"')).toContain('Ajedrez de Gala')
  })

  test('el favicon SVG se sirve bajo la ruta base', async ({ page, request, baseURL }) => {
    const href = await enlace(page, 'icon')
    expect(href.startsWith(baseURL!)).toBe(true)

    await pedirImagen(request, href, 'image/svg+xml')
  })

  test('el icono de iOS mide 180 px y se sirve bajo la ruta base', async ({ page, request, baseURL }) => {
    const href = await enlace(page, 'apple-touch-icon')
    expect(href.startsWith(baseURL!)).toBe(true)

    const png = await pedirImagen(request, href, 'image/png')
    expect(medidasDePng(png)).toEqual({ ancho: 180, alto: 180 })
  })

  test('la tarjeta de 1200×630 se publica con la app', async ({ request }) => {
    const png = await pedirImagen(request, 'identidad/tarjeta.png', 'image/png')

    expect(medidasDePng(png)).toEqual({ ancho: 1200, alto: 630 })
  })
})

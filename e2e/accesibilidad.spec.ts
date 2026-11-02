import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

const casilla = (page: Page, nombre: string) => page.getByRole('button', { name: new RegExp(`^${nombre}(,|$)`) })
const boton = (ambito: Page | Locator, nombre: string) => ambito.getByRole('button', { name: nombre, exact: true })
const anuncios = (page: Page) => page.getByRole('status')
const capa = (page: Page) => page.getByRole('dialog')
const coronacion = ['a2 a4', 'b7 b5', 'a4 b5', 'a7 a6', 'b5 a6', 'c8 b7', 'a6 b7', 'b8 c6']
const mateDelLoco = ['f2 f3', 'e7 e5', 'g2 g4', 'd8 h4']

test.use({ contextOptions: { reducedMotion: 'reduce' } })

// Todo arranca en la elección, resuelta con el teclado: empezar deja el foco en el tablero.
test.beforeEach(async ({ page }) => {
  await page.goto('.')
  await expect(boton(page, 'Dos personas')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(casilla(page, 'e2')).toBeFocused()
})

// Lleva el foco con las flechas desde la casilla enfocada hasta el destino, con el tablero sin girar.
async function irA(page: Page, destino: string) {
  const origen = await page.evaluate(() => document.activeElement!.getAttribute('aria-label')!.slice(0, 2))
  const columnas = destino.charCodeAt(0) - origen.charCodeAt(0)
  const filas = Number(destino[1]) - Number(origen[1])
  for (let i = 0; i < Math.abs(columnas); i++) await page.keyboard.press(columnas > 0 ? 'ArrowRight' : 'ArrowLeft')
  for (let i = 0; i < Math.abs(filas); i++) await page.keyboard.press(filas > 0 ? 'ArrowUp' : 'ArrowDown')
  await expect(casilla(page, destino)).toBeFocused()
}

async function jugarConTeclado(page: Page, ...jugadas: string[]) {
  for (const jugada of jugadas) {
    const [desde, hasta] = jugada.split(' ')
    await irA(page, desde)
    await page.keyboard.press('Enter')
    await irA(page, hasta)
    await page.keyboard.press('Enter')
  }
}

// El motor nunca llega a descargarse: la Máquina se queda preparándose lo que dure la prueba.
async function contraLaMaquinaQuePiensa(page: Page) {
  await page.route('**/motor/*', () => {})
  await boton(page, 'Nueva partida').click()
  await boton(page, 'Contra la Máquina').click()
  await boton(page, 'Empezar').click()
  await casilla(page, 'e2').click()
  await casilla(page, 'e4').click()
  await expect(page.getByText('La Máquina se prepara…')).toBeVisible()
}

test.describe('teclado', () => {
  test('una Partida entera con flechas y Enter, anunciada en la región aria-live', async ({ page }) => {
    await jugarConTeclado(page, 'e2 e4')
    await expect(anuncios(page)).toHaveText('peón a e cuatro')
    await expect(casilla(page, 'e4')).toBeFocused()
    await expect(casilla(page, 'e4')).toHaveAccessibleName(/^e4, peón blanco/)

    await jugarConTeclado(page, 'd7 d5', 'e4 d5')
    await expect(anuncios(page)).toHaveText('peón captura peón en de cinco')

    await jugarConTeclado(page, 'd8 d5', 'b1 c3', 'd5 e5', 'f1 e2')
    await expect(anuncios(page)).toHaveText('alfil a e dos')

    await jugarConTeclado(page, 'e5 g5', 'g1 f3', 'g5 a5', 'e1 g1')
    await expect(anuncios(page)).toHaveText('enroque corto')
  })

  test('el jaque mate se anuncia y lleva a la pantalla final', async ({ page }) => {
    await jugarConTeclado(page, ...mateDelLoco)

    await expect(anuncios(page)).toHaveText('dama a hache cuatro, jaque mate, ganan las negras')
    await expect(boton(page, 'Jugar otra vez')).toBeFocused()
  })

  test('un jaque se anuncia como consecuencia de la Jugada', async ({ page }) => {
    await jugarConTeclado(page, 'e2 e4', 'f7 f5', 'd1 h5')

    await expect(anuncios(page)).toHaveText('dama a hache cinco, jaque')
  })

  test('el tablero es una sola parada de Tab, que recuerda la casilla', async ({ page }) => {
    await irA(page, 'f3')

    await page.keyboard.press('Tab')
    await expect(page.getByRole('list', { name: 'Historial' })).toBeFocused()

    await page.keyboard.press('Shift+Tab')
    await expect(casilla(page, 'f3')).toBeFocused()
  })

  test('las flechas no dan la vuelta en los bordes', async ({ page }) => {
    await irA(page, 'a1')

    await page.keyboard.press('ArrowLeft')
    await expect(casilla(page, 'a1')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(casilla(page, 'a1')).toBeFocused()
  })

  test('con el tablero girado las flechas siguen lo que se ve', async ({ page }) => {
    await boton(page, 'Girar').focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(casilla(page, 'e2')).toBeFocused()

    await page.keyboard.press('ArrowUp')
    await expect(casilla(page, 'e1')).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(casilla(page, 'f1')).toBeFocused()
  })

  test('la Coronación se elige con flechas y Enter, y el foco vuelve al tablero', async ({ page }) => {
    await jugarConTeclado(page, ...coronacion, 'b7 a8')

    await expect(boton(page, 'Dama')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(boton(page, 'Torre')).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(boton(page, 'Caballo')).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(anuncios(page)).toHaveText('peón captura torre en a ocho, corona caballo')
    await expect(casilla(page, 'a8')).toBeFocused()
    await expect(casilla(page, 'a8')).toHaveAccessibleName(/^a8, caballo blanco/)
  })

  test('Escape cancela la Coronación y el foco vuelve al tablero', async ({ page }) => {
    await jugarConTeclado(page, ...coronacion, 'b7 a8')
    await expect(boton(page, 'Dama')).toBeFocused()

    await page.keyboard.press('Escape')

    await expect(boton(page, 'Dama')).toHaveCount(0)
    await expect(casilla(page, 'a8')).toBeFocused()
    await expect(casilla(page, 'a8')).toHaveAccessibleName(/^a8, torre negra/)
    await expect(casilla(page, 'b7')).toHaveAccessibleName(/^b7, peón blanco/)
  })

  test('en la Coronación el foco no vuelve al tablero tapado y Ctrl+flecha no se intercepta', async ({ page }) => {
    await jugarConTeclado(page, ...coronacion, 'b7 a8')
    await expect(boton(page, 'Dama')).toBeFocused()

    await page.keyboard.press('Control+ArrowRight')
    await expect(boton(page, 'Dama')).toBeFocused()

    await page.keyboard.press('Shift+Tab')
    await expect(page.locator('[data-casilla]:focus')).toHaveCount(0)
  })

  test('dos Jugadas seguidas con el mismo texto se anuncian las dos', async ({ page }) => {
    await jugarConTeclado(page, 'd2 d4', 'd7 d5', 'c2 c4', 'e7 e6', 'c4 d5')
    await expect(anuncios(page)).toHaveText('peón captura peón en de cinco')
    const cambios = await anuncios(page).evaluateHandle((region) => {
      const vistos: string[] = []
      new MutationObserver(() => vistos.push(region.textContent!)).observe(region, {
        childList: true,
        characterData: true,
        subtree: true,
      })
      return vistos
    })

    await jugarConTeclado(page, 'e6 d5')

    await expect.poll(() => cambios.evaluate((vistos) => vistos.length)).toBeGreaterThan(0)
  })

  test('empezar una Partida lleva el foco al tablero', async ({ page }) => {
    await jugarConTeclado(page, 'e2 e4')
    await boton(page, 'Nueva partida').focus()
    await page.keyboard.press('Enter')
    await expect(boton(page, 'Dos personas')).toBeFocused()

    await page.keyboard.press('Enter')

    await expect(capa(page)).toHaveCount(0)
    await expect(casilla(page, 'e4')).toBeFocused()
  })

  test('la elección de Partida se recorre con el teclado', async ({ page }) => {
    await boton(page, 'Nueva partida').focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    await expect(boton(page, 'Contra la Máquina')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(boton(page, 'Empezar')).toBeFocused()

    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('radio', { name: 'Medio' })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: 'Difícil' })).toBeChecked()

    await page.keyboard.press('Escape')
    await expect(boton(page, 'Contra la Máquina')).toBeFocused()
    await expect(capa(page)).toBeVisible()
  })

  test('el diálogo de la pantalla final dice el Resultado completo', async ({ page }) => {
    await jugarConTeclado(page, ...mateDelLoco)

    await expect(capa(page)).toHaveAccessibleName('Jaque mate')
    await expect(capa(page)).toHaveAccessibleDescription('ganan las negras')
  })

  test('Deshacer conserva el foco al llegar al inicio y se anuncia', async ({ page }) => {
    await jugarConTeclado(page, 'e2 e4')

    const deshacer = boton(page, 'Deshacer')
    await deshacer.focus()
    await page.keyboard.press('Enter')

    await expect(anuncios(page)).toHaveText('Jugada deshecha, juegan las blancas')
    await expect(deshacer).toBeDisabled()
    await expect(deshacer).toBeFocused()
    await expect(casilla(page, 'e2')).toHaveAccessibleName(/^e2, peón blanco/)
  })

  test('cerrar las capas devuelve el foco a donde estaba', async ({ page }) => {
    const nueva = boton(page, 'Nueva partida')
    await nueva.focus()
    await page.keyboard.press('Enter')
    await expect(boton(page, 'Dos personas')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(nueva).toBeFocused()

    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(casilla(page, 'e2')).toBeFocused()
    await jugarConTeclado(page, ...mateDelLoco)
    await expect(boton(page, 'Jugar otra vez')).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(capa(page)).toHaveCount(0)
    await expect(casilla(page, 'h4')).toBeFocused()
  })

  test('cerrar la pantalla final tras recargar deja el foco en el tablero', async ({ page }) => {
    await jugarConTeclado(page, ...mateDelLoco)
    await page.reload()
    await expect(capa(page)).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(capa(page)).toHaveCount(0)
    await expect(casilla(page, 'e2')).toBeFocused()
  })
})

test.describe('axe-core', () => {
  const analizar = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations

  test('sin infracciones en la pantalla de Partida', async ({ page }) => {
    await jugarConTeclado(page, 'e2 e4', 'f7 f5', 'e4 f5', 'g7 g5')
    await irA(page, 'f5')
    await page.keyboard.press('Enter')

    expect(await analizar(page)).toEqual([])
  })

  test('sin infracciones en la pantalla final', async ({ page }) => {
    await jugarConTeclado(page, ...mateDelLoco)
    await expect(capa(page)).toBeVisible()

    expect(await analizar(page)).toEqual([])
  })

  test('sin infracciones en la elección de Partida', async ({ page }) => {
    await jugarConTeclado(page, 'e2 e4')
    await boton(page, 'Nueva partida').click()
    await expect(capa(page)).toBeVisible()

    expect(await analizar(page)).toEqual([])

    await boton(page, 'Contra la Máquina').click()
    await expect(boton(page, 'Empezar')).toBeFocused()

    expect(await analizar(page)).toEqual([])
  })

  test('sin infracciones en la Partida contra la Máquina, mientras piensa', async ({ page }) => {
    await contraLaMaquinaQuePiensa(page)

    expect(await analizar(page)).toEqual([])
  })
})

test.describe('contraste AA', () => {
  const NORMAL = 4.5
  const GRANDE = 3

  // La peor relación entre el color del texto y el fondo real que tiene detrás, leído píxel a píxel de una captura.
  async function contraste(objetivo: Locator) {
    const color = await objetivo.evaluate((nodo) => getComputedStyle(nodo).color)
    // Se oculta todo el texto: la caja de un texto partido en dos líneas abarca también el de al lado.
    const sinTexto = await objetivo.page().addStyleTag({ content: '* { color: transparent !important; }' })
    const captura = (await objetivo.screenshot()).toString('base64')
    await sinTexto.evaluate((estilo) => (estilo as HTMLStyleElement).remove())

    return objetivo.page().evaluate(
      async ({ datos, color }) => {
        const lineal = (canal: number) => {
          const valor = canal / 255
          return valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4
        }
        const luminancia = (r: number, g: number, b: number) =>
          0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b)

        const [r, g, b] = color.match(/\d+/g)!.map(Number)
        const texto = luminancia(r, g, b)
        const imagen = new Image()
        imagen.src = `data:image/png;base64,${datos}`
        await imagen.decode()
        const lienzo = new OffscreenCanvas(imagen.width, imagen.height).getContext('2d')!
        lienzo.drawImage(imagen, 0, 0)
        // La captura se redondea a píxeles CSS enteros: su borde puede ser ya lo que hay alrededor del texto.
        const borde = Math.ceil(devicePixelRatio) + 1
        const ancho = Math.max(imagen.width - 2 * borde, 1)
        const alto = Math.max(imagen.height - 2 * borde, 1)
        const pixeles = lienzo.getImageData(borde, borde, ancho, alto).data

        let peor = Infinity
        for (let i = 0; i < pixeles.length; i += 4) {
          const fondo = luminancia(pixeles[i], pixeles[i + 1], pixeles[i + 2])
          const relacion = (Math.max(texto, fondo) + 0.05) / (Math.min(texto, fondo) + 0.05)
          peor = Math.min(peor, relacion)
        }
        return peor
      },
      { datos: captura, color },
    )
  }

  async function exigir(minimo: number, objetivos: Record<string, Locator>) {
    await objetivos[Object.keys(objetivos)[0]].page().waitForFunction(() => document.getAnimations().length === 0)
    for (const [nombre, objetivo] of Object.entries(objetivos)) {
      expect.soft(await contraste(objetivo), nombre).toBeGreaterThanOrEqual(minimo)
    }
  }

  test('textos y acciones de la pantalla de Partida, con la acción desactivada', async ({ page }) => {
    await expect(boton(page, 'Deshacer')).toBeDisabled()

    await exigir(NORMAL, {
      titulo: page.getByRole('heading', { name: 'Ajedrez de Gala' }),
      deshacer: boton(page, 'Deshacer'),
      girar: boton(page, 'Girar'),
      nueva: boton(page, 'Nueva partida'),
    })
    await exigir(GRANDE, { turno: page.getByText('Turno de las blancas') })
  })

  test('Historial y turno en jaque', async ({ page }) => {
    await jugarConTeclado(page, 'e2 e4', 'f7 f5', 'd1 h5')
    const historial = page.getByRole('list', { name: 'Historial' })

    await exigir(NORMAL, {
      numero: historial.getByText('1', { exact: true }),
      jugada: historial.getByText('e4', { exact: true }),
    })
    await exigir(GRANDE, { jaque: page.getByText('· Jaque') })
  })

  test('coordenadas sobre casillas normales, última Jugada y selección', async ({ page }) => {
    const coordenada = (nombre: string, texto: string) =>
      casilla(page, nombre).locator('..').getByText(texto, { exact: true })

    await jugarConTeclado(page, 'a2 a4', 'h7 h6')
    await irA(page, 'b1')
    await page.keyboard.press('Enter')
    await expect(casilla(page, 'b1')).toHaveAttribute('aria-pressed', 'true')

    await exigir(NORMAL, {
      'normal clara': coordenada('a6', '6'),
      'normal oscura': coordenada('a7', '7'),
      'normal abajo': coordenada('d1', 'd'),
      seleccionada: coordenada('b1', 'b'),
    })

    await irA(page, 'a1')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await jugarConTeclado(page, 'a4 a5')

    await exigir(NORMAL, {
      'última jugada': coordenada('a4', '4'),
    })
  })

  test('pantalla final', async ({ page }) => {
    await jugarConTeclado(page, ...mateDelLoco)
    const final = capa(page)
    await expect(final).toBeVisible()

    await exigir(NORMAL, {
      detalle: final.getByText('ganan las negras'),
      'jugar otra vez': boton(final, 'Jugar otra vez'),
      'elegir otra': boton(final, 'Elegir otra partida'),
      ver: boton(final, 'Ver la partida'),
      deshacer: boton(final, 'Deshacer'),
    })
    await exigir(GRANDE, { titulo: final.getByRole('heading') })
  })

  test('elección de Partida', async ({ page }) => {
    await jugarConTeclado(page, 'e2 e4')
    await boton(page, 'Nueva partida').click()
    const eleccion = capa(page)
    await expect(eleccion).toBeVisible()

    await exigir(NORMAL, {
      dos: boton(eleccion, 'Dos personas'),
      maquina: boton(eleccion, 'Contra la Máquina'),
      volver: boton(eleccion, 'Volver a la partida'),
    })
    await exigir(GRANDE, {
      titulo: eleccion.getByRole('heading'),
      aviso: eleccion.getByText('La partida en curso se perderá'),
    })

    await boton(eleccion, 'Contra la Máquina').click()

    await exigir(NORMAL, {
      bando: eleccion.getByText('Tu Bando'),
      nivel: eleccion.getByText('Nivel'),
      empezar: boton(eleccion, 'Empezar'),
      volver: boton(eleccion, 'Volver'),
    })
    await exigir(GRANDE, {
      blancas: eleccion.getByText('Blancas'),
      'al azar': eleccion.getByText('Al azar'),
      fácil: eleccion.getByText('Fácil'),
      máximo: eleccion.getByText('Máximo'),
    })
  })

  test('Rival y turno de la Partida contra la Máquina', async ({ page }) => {
    await contraLaMaquinaQuePiensa(page)

    await exigir(NORMAL, { rival: page.getByText('Contra la Máquina · Medio') })
    await exigir(GRANDE, { piensa: page.getByText('La Máquina se prepara…') })
  })
})

test('el foco del teclado se ve en el tablero', async ({ page }) => {
  await expect(casilla(page, 'e2')).toHaveCSS('outline-style', 'solid')
  await expect(casilla(page, 'e2')).toHaveCSS('outline-width', '2px')
  await expect(casilla(page, 'e2')).toHaveCSS('outline-color', 'rgb(243, 232, 207)')
})

import { describe, expect, it } from 'vitest'
import type { Square } from 'chess.js'
import {
  crearSesionDePartida,
  type Dependencias,
  type EstadoDePartida,
  type EventoDeJugada,
  type SesionDePartida,
} from './sesionDePartida'

const dobles = (): Dependencias => ({
  almacen: { leer: () => null, escribir: () => {} },
  reloj: { ahora: () => 0 },
})

const nueva = (pgn?: string) => crearSesionDePartida(dobles(), pgn)

const desdeFen = (fen: string) => nueva(`[SetUp "1"]\n[FEN "${fen}"]\n\n*`)

function jugar(sesion: SesionDePartida, ...jugadas: `${Square} ${Square}`[]) {
  for (const jugada of jugadas) {
    const [desde, hasta] = jugada.split(' ') as Square[]
    sesion.tocarCasilla(desde)
    sesion.tocarCasilla(hasta)
  }
}

function eventosDe(sesion: SesionDePartida) {
  const eventos: EventoDeJugada[] = []
  sesion.alJugar((evento) => eventos.push(evento))
  return eventos
}

const piezaEn = (estado: EstadoDePartida, casilla: Square) => estado.piezas.find((p) => p.casilla === casilla)
const destinos = (estado: EstadoDePartida) => estado.destinos.map((d) => d.casilla).sort()

describe('al empezar', () => {
  it('muestra la posición inicial con el turno de blancas', () => {
    const { piezas, turno, jaque, resultado, seleccion } = nueva().obtenerEstado()

    expect(piezas).toHaveLength(32)
    expect(piezaEn(nueva().obtenerEstado(), 'e1')).toEqual({ casilla: 'e1', tipo: 'k', bando: 'w' })
    expect(turno).toBe('w')
    expect(jaque).toBe(false)
    expect(resultado).toBeNull()
    expect(seleccion).toBeNull()
  })
})

describe('al seleccionar', () => {
  it('tocar una pieza del Bando en turno muestra sus casillas válidas', () => {
    const sesion = nueva()

    sesion.tocarCasilla('g1')

    expect(sesion.obtenerEstado().seleccion).toBe('g1')
    expect(destinos(sesion.obtenerEstado())).toEqual(['f3', 'h3'])
  })

  it('tocar otra pieza del Bando cambia la selección', () => {
    const sesion = nueva()

    sesion.tocarCasilla('g1')
    sesion.tocarCasilla('b1')

    expect(sesion.obtenerEstado().seleccion).toBe('b1')
    expect(destinos(sesion.obtenerEstado())).toEqual(['a3', 'c3'])
  })

  it('tocar la misma pieza quita la selección', () => {
    const sesion = nueva()

    sesion.tocarCasilla('g1')
    sesion.tocarCasilla('g1')

    expect(sesion.obtenerEstado().seleccion).toBeNull()
    expect(sesion.obtenerEstado().destinos).toEqual([])
  })

  it('tocar una casilla no válida quita la selección sin mover nada', () => {
    const sesion = nueva()
    const { piezas } = sesion.obtenerEstado()

    sesion.tocarCasilla('g1')
    sesion.tocarCasilla('e5')

    expect(sesion.obtenerEstado().seleccion).toBeNull()
    expect(sesion.obtenerEstado().piezas).toEqual(piezas)
  })

  it('tocar una pieza del Bando contrario no la selecciona', () => {
    const sesion = nueva()

    sesion.tocarCasilla('e7')

    expect(sesion.obtenerEstado().seleccion).toBeNull()
  })

  it('una pieza sin Jugadas queda seleccionada, sin destinos', () => {
    const sesion = nueva()

    sesion.tocarCasilla('a1')

    expect(sesion.obtenerEstado().seleccion).toBe('a1')
    expect(sesion.obtenerEstado().destinos).toEqual([])
  })

  it('marca como captura el destino de una pieza rival, también al paso', () => {
    const sesion = nueva('1. e4 d5 2. e5 f5')

    sesion.tocarCasilla('e5')

    expect(sesion.obtenerEstado().destinos).toEqual(
      expect.arrayContaining([
        { casilla: 'e6', captura: false },
        { casilla: 'f6', captura: true },
      ]),
    )
  })
})

describe('al jugar', () => {
  it('mueve la pieza, pasa el turno y limpia la selección', () => {
    const sesion = nueva()

    jugar(sesion, 'e2 e4')

    const estado = sesion.obtenerEstado()
    expect(piezaEn(estado, 'e4')).toEqual({ casilla: 'e4', tipo: 'p', bando: 'w' })
    expect(piezaEn(estado, 'e2')).toBeUndefined()
    expect(estado.turno).toBe('b')
    expect(estado.seleccion).toBeNull()
    expect(estado.destinos).toEqual([])
  })

  it('emite un evento de la Jugada', () => {
    const sesion = nueva()
    const eventos = eventosDe(sesion)

    jugar(sesion, 'g1 f3')

    expect(eventos).toEqual([
      {
        bando: 'w',
        pieza: 'n',
        desde: 'g1',
        hasta: 'f3',
        san: 'Nf3',
        captura: null,
        torre: null,
        coronacion: null,
        jaque: false,
        resultado: null,
      },
    ])
  })

  it('avisa a quien observa el estado', () => {
    const sesion = nueva()
    let avisos = 0
    const cancelarSuscripcion = sesion.suscribir(() => avisos++)

    sesion.tocarCasilla('e2')
    sesion.tocarCasilla('e4')
    cancelarSuscripcion()
    sesion.tocarCasilla('e7')
    sesion.tocarCasilla('e5')

    expect(avisos).toBe(2)
  })

  it('conserva el mismo estado mientras nada cambia', () => {
    const sesion = nueva()

    expect(sesion.obtenerEstado()).toBe(sesion.obtenerEstado())
  })

  it('el evento de una captura lleva la pieza y su casilla', () => {
    const sesion = nueva('1. e4 d5')
    const eventos = eventosDe(sesion)

    jugar(sesion, 'e4 d5')

    expect(eventos[0].captura).toEqual({ pieza: 'p', casilla: 'd5' })
  })

  it('una Jugada que da jaque lo indica en el estado y en el evento', () => {
    const sesion = nueva('1. e4 f5')
    const eventos = eventosDe(sesion)

    jugar(sesion, 'd1 h5')

    expect(sesion.obtenerEstado().jaque).toBe(true)
    expect(eventos[0].jaque).toBe(true)
  })

  it('una Jugada que deja al rey en jaque no ocurre', () => {
    const sesion = desdeFen('4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1')
    const eventos = eventosDe(sesion)

    jugar(sesion, 'e2 a2')

    expect(piezaEn(sesion.obtenerEstado(), 'e2')?.tipo).toBe('r')
    expect(sesion.obtenerEstado().turno).toBe('w')
    expect(eventos).toEqual([])
  })
})

describe('Jugadas especiales', () => {
  const enroques = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 d6 5. Bd2 Bd7 6. Nc3 Qe7 7. Qe2'

  it('el enroque corto mueve la torre y el evento lo describe', () => {
    const sesion = nueva('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5')
    const eventos = eventosDe(sesion)

    jugar(sesion, 'e1 g1')

    const estado = sesion.obtenerEstado()
    expect(piezaEn(estado, 'g1')?.tipo).toBe('k')
    expect(piezaEn(estado, 'f1')?.tipo).toBe('r')
    expect(piezaEn(estado, 'h1')).toBeUndefined()
    expect(eventos[0].torre).toEqual({ desde: 'h1', hasta: 'f1' })
  })

  it('el enroque largo de negras mueve la torre y el evento lo describe', () => {
    const sesion = nueva(enroques)
    const eventos = eventosDe(sesion)

    jugar(sesion, 'e8 c8')

    const estado = sesion.obtenerEstado()
    expect(piezaEn(estado, 'c8')?.tipo).toBe('k')
    expect(piezaEn(estado, 'd8')?.tipo).toBe('r')
    expect(eventos[0].torre).toEqual({ desde: 'a8', hasta: 'd8' })
  })

  it('la captura al paso retira el peón de su casilla real', () => {
    const sesion = nueva('1. e4 d5 2. e5 f5')
    const eventos = eventosDe(sesion)

    jugar(sesion, 'e5 f6')

    const estado = sesion.obtenerEstado()
    expect(piezaEn(estado, 'f6')).toEqual({ casilla: 'f6', tipo: 'p', bando: 'w' })
    expect(piezaEn(estado, 'f5')).toBeUndefined()
    expect(eventos[0].captura).toEqual({ pieza: 'p', casilla: 'f5' })
  })
})

describe('Coronación', () => {
  const peonEnA7 = '8/P6k/8/8/8/8/6K1/8 w - - 0 1'

  it('llegar a la última fila queda pendiente de elegir pieza, sin mover nada', () => {
    const sesion = desdeFen(peonEnA7)
    const eventos = eventosDe(sesion)

    jugar(sesion, 'a7 a8')

    const estado = sesion.obtenerEstado()
    expect(estado.coronacion).toEqual({ desde: 'a7', hasta: 'a8' })
    expect(piezaEn(estado, 'a7')?.tipo).toBe('p')
    expect(piezaEn(estado, 'a8')).toBeUndefined()
    expect(estado.turno).toBe('w')
    expect(eventos).toEqual([])
  })

  it('elegir la pieza completa la Jugada y el evento la indica', () => {
    const sesion = desdeFen(peonEnA7)
    const eventos = eventosDe(sesion)

    jugar(sesion, 'a7 a8')
    sesion.coronar('n')

    const estado = sesion.obtenerEstado()
    expect(estado.coronacion).toBeNull()
    expect(estado.seleccion).toBeNull()
    expect(piezaEn(estado, 'a8')).toEqual({ casilla: 'a8', tipo: 'n', bando: 'w' })
    expect(estado.turno).toBe('b')
    expect(eventos).toHaveLength(1)
    expect(eventos[0].coronacion).toBe('n')
    expect(eventos[0].pieza).toBe('p')
  })

  it('una Coronación con captura lleva también la pieza capturada', () => {
    const sesion = desdeFen('1r6/P6k/8/8/8/8/6K1/8 w - - 0 1')
    const eventos = eventosDe(sesion)

    jugar(sesion, 'a7 b8')
    sesion.coronar('q')

    expect(eventos[0].captura).toEqual({ pieza: 'r', casilla: 'b8' })
    expect(eventos[0].coronacion).toBe('q')
  })

  it('una pieza que no se puede elegir se ignora y la Coronación sigue pendiente', () => {
    const sesion = desdeFen(peonEnA7)
    const eventos = eventosDe(sesion)

    jugar(sesion, 'a7 a8')

    expect(() => sesion.coronar('k')).not.toThrow()
    expect(sesion.obtenerEstado().coronacion).toEqual({ desde: 'a7', hasta: 'a8' })
    expect(piezaEn(sesion.obtenerEstado(), 'a7')?.tipo).toBe('p')
    expect(eventos).toEqual([])
  })

  it('coronar sin Coronación pendiente no hace nada', () => {
    const sesion = desdeFen(peonEnA7)
    const antes = sesion.obtenerEstado()

    expect(() => sesion.coronar('q')).not.toThrow()
    expect(sesion.obtenerEstado()).toBe(antes)
  })

  it('tocar el tablero con la Coronación pendiente la cancela', () => {
    const sesion = desdeFen(peonEnA7)
    const eventos = eventosDe(sesion)

    jugar(sesion, 'a7 a8')
    sesion.tocarCasilla('e4')

    const estado = sesion.obtenerEstado()
    expect(estado.coronacion).toBeNull()
    expect(estado.seleccion).toBeNull()
    expect(piezaEn(estado, 'a7')?.tipo).toBe('p')
    expect(estado.turno).toBe('w')
    expect(eventos).toEqual([])
  })
})

describe('Resultado', () => {
  it('jaque mate: gana el Bando que lo da', () => {
    const sesion = nueva('1. f3 e5 2. g4')
    const eventos = eventosDe(sesion)

    jugar(sesion, 'd8 h4')

    const resultado = { tipo: 'jaque-mate', ganador: 'b' }
    expect(sesion.obtenerEstado().resultado).toEqual(resultado)
    expect(eventos[0].resultado).toEqual(resultado)
    expect(eventos[0].jaque).toBe(true)
  })

  it('el jaque mate en la media jugada 100 es jaque mate, no tablas', () => {
    const sesion = desdeFen('k7/8/1K6/8/8/8/8/7R w - - 99 80')

    jugar(sesion, 'h1 h8')

    expect(sesion.obtenerEstado().resultado).toEqual({ tipo: 'jaque-mate', ganador: 'w' })
  })

  it('ahogado', () => {
    const sesion = desdeFen('k7/8/1K6/8/8/8/8/2Q5 w - - 0 1')

    jugar(sesion, 'c1 c7')

    expect(sesion.obtenerEstado().resultado).toEqual({ tipo: 'ahogado' })
  })

  it('tablas por 50 jugadas', () => {
    const sesion = desdeFen('k7/8/8/8/8/8/8/K6R w - - 99 80')

    jugar(sesion, 'h1 h2')

    expect(sesion.obtenerEstado().resultado).toEqual({ tipo: 'tablas', motivo: '50-jugadas' })
  })

  it('tablas por triple repetición', () => {
    const sesion = nueva()

    jugar(sesion, 'g1 f3', 'g8 f6', 'f3 g1', 'f6 g8', 'g1 f3', 'g8 f6', 'f3 g1')
    expect(sesion.obtenerEstado().resultado).toBeNull()

    jugar(sesion, 'f6 g8')

    expect(sesion.obtenerEstado().resultado).toEqual({ tipo: 'tablas', motivo: 'triple-repeticion' })
  })

  it('tablas por material insuficiente', () => {
    const sesion = desdeFen('k7/8/8/8/8/8/1p6/K7 w - - 0 1')

    jugar(sesion, 'a1 b2')

    expect(sesion.obtenerEstado().resultado).toEqual({ tipo: 'tablas', motivo: 'material-insuficiente' })
  })

  it('una Partida terminada ignora toda acción', () => {
    const sesion = nueva('1. f3 e5 2. g4 Qh4#')
    const antes = sesion.obtenerEstado()

    sesion.tocarCasilla('e1')
    sesion.tocarCasilla('a2')
    sesion.coronar('q')

    expect(antes.resultado).toEqual({ tipo: 'jaque-mate', ganador: 'b' })
    expect(sesion.obtenerEstado()).toBe(antes)
  })
})

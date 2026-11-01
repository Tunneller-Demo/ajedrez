import { describe, expect, it } from 'vitest'
import type { Square } from 'chess.js'
import {
  crearSesionDePartida,
  type Almacen,
  type EstadoDePartida,
  type EventoDeJugada,
  type SesionDePartida,
} from './sesionDePartida'

const conAlmacen = (almacen: Almacen) => crearSesionDePartida({ almacen, reloj: { ahora: () => 0 } })

const conGuardado = (guardado: string | null) => conAlmacen({ leer: () => guardado, escribir: () => {} })

const nueva = (pgn?: string) => conGuardado(pgn ? JSON.stringify({ pgn }) : null)

function almacenEnMemoria(): Almacen {
  const datos = new Map<string, string>()
  return { leer: (clave) => datos.get(clave) ?? null, escribir: (clave, valor) => void datos.set(clave, valor) }
}

const desdeFen = (fen: string) => nueva(`[SetUp "1"]\n[FEN "${fen}"]\n\n*`)

const mate = '1. f3 e5 2. g4 Qh4#'

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

describe('última Jugada', () => {
  it('no hay ninguna al empezar', () => {
    expect(nueva().obtenerEstado().ultimaJugada).toBeNull()
  })

  it('guarda el origen y el destino de la Jugada más reciente', () => {
    const sesion = nueva()

    jugar(sesion, 'e2 e4', 'g8 f6')

    expect(sesion.obtenerEstado().ultimaJugada).toEqual({ desde: 'g8', hasta: 'f6' })
  })

  it('se mantiene al seleccionar otra pieza', () => {
    const sesion = nueva()

    jugar(sesion, 'e2 e4')
    sesion.tocarCasilla('g8')

    expect(sesion.obtenerEstado().ultimaJugada).toEqual({ desde: 'e2', hasta: 'e4' })
  })

  it('se recupera de una Partida restaurada', () => {
    expect(nueva('1. e4 d5 2. exd5').obtenerEstado().ultimaJugada).toEqual({ desde: 'e4', hasta: 'd5' })
  })

  it('en la Coronación solo cambia al elegir la pieza', () => {
    const sesion = desdeFen('8/P6k/8/8/8/8/6K1/8 w - - 0 1')

    jugar(sesion, 'a7 a8')
    expect(sesion.obtenerEstado().ultimaJugada).toBeNull()

    sesion.coronar('q')
    expect(sesion.obtenerEstado().ultimaJugada).toEqual({ desde: 'a7', hasta: 'a8' })
  })
})

describe('Historial', () => {
  it('está vacío al empezar', () => {
    expect(nueva().obtenerEstado().historial).toEqual([])
  })

  it('escribe las Jugadas en orden, con figuritas de pieza', () => {
    const sesion = nueva()

    jugar(sesion, 'e2 e4', 'e7 e5', 'g1 f3', 'd8 h4', 'f3 e5')

    expect(sesion.obtenerEstado().historial).toEqual(['e4', 'e5', '♞f3', '♛h4', '♞xe5'])
  })

  it('deja el enroque en su notación y marca la Coronación con su figurita', () => {
    expect(nueva('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O').obtenerEstado().historial).toContain('O-O')

    const sesion = desdeFen('8/P6k/8/8/8/8/6K1/8 w - - 0 1')
    jugar(sesion, 'a7 a8')
    sesion.coronar('r')

    expect(sesion.obtenerEstado().historial).toEqual(['a8=♜'])
  })

  it('se recupera de una Partida restaurada', () => {
    expect(nueva('1. e4 d5 2. exd5').obtenerEstado().historial).toEqual(['e4', 'd5', 'exd5'])
  })
})

describe('capturadas', () => {
  it('no hay ninguna al empezar', () => {
    expect(nueva().obtenerEstado().capturadas).toEqual({ w: [], b: [] })
  })

  it('se guardan junto al Bando que capturó, en orden de captura', () => {
    const sesion = nueva()

    jugar(sesion, 'e2 e4', 'd7 d5', 'e4 d5', 'd8 d5', 'b1 c3', 'd5 a2', 'a1 a2')

    expect(sesion.obtenerEstado().capturadas).toEqual({ w: ['p', 'q'], b: ['p', 'p'] })
  })

  it('incluyen la captura al paso', () => {
    const sesion = nueva('1. e4 d5 2. e5 f5')

    jugar(sesion, 'e5 f6')

    expect(sesion.obtenerEstado().capturadas).toEqual({ w: ['p'], b: [] })
  })

  it('una Coronación no cuenta como captura si no captura', () => {
    const sesion = desdeFen('8/P6k/8/8/8/8/6K1/8 w - - 0 1')

    jugar(sesion, 'a7 a8')
    sesion.coronar('q')

    expect(sesion.obtenerEstado().capturadas).toEqual({ w: [], b: [] })
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

describe('Deshacer a dos', () => {
  it('retira una sola Jugada y devuelve el turno', () => {
    const sesion = nueva()

    jugar(sesion, 'e2 e4', 'e7 e5')
    sesion.deshacer()

    const estado = sesion.obtenerEstado()
    expect(estado.historial).toEqual(['e4'])
    expect(estado.turno).toBe('b')
    expect(piezaEn(estado, 'e7')?.tipo).toBe('p')
    expect(piezaEn(estado, 'e5')).toBeUndefined()
    expect(estado.ultimaJugada).toEqual({ desde: 'e2', hasta: 'e4' })
  })

  it('llega hasta el inicio de la Partida, sin límite', () => {
    const sesion = nueva()
    const inicio = sesion.obtenerEstado()

    jugar(sesion, 'e2 e4', 'e7 e5', 'g1 f3', 'b8 c6')
    for (let i = 0; i < 4; i++) sesion.deshacer()

    expect(sesion.obtenerEstado()).toEqual(inicio)
  })

  it('sin Jugadas no hace nada ni avisa', () => {
    const sesion = nueva()
    const antes = sesion.obtenerEstado()
    let avisos = 0
    sesion.suscribir(() => avisos++)

    sesion.deshacer()

    expect(sesion.obtenerEstado()).toBe(antes)
    expect(avisos).toBe(0)
  })

  it('funciona en una Partida restaurada', () => {
    const sesion = nueva('1. e4 d5 2. exd5')

    sesion.deshacer()

    expect(sesion.obtenerEstado().historial).toEqual(['e4', 'd5'])
    expect(piezaEn(sesion.obtenerEstado(), 'd5')).toEqual({ casilla: 'd5', tipo: 'p', bando: 'b' })
  })

  it('devuelve la pieza capturada y la quita de las capturadas', () => {
    const sesion = nueva('1. e4 d5 2. exd5')

    sesion.deshacer()

    expect(sesion.obtenerEstado().capturadas).toEqual({ w: [], b: [] })
  })

  it('devuelve rey y torre tras el enroque, y se puede volver a enrocar', () => {
    const sesion = nueva('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O')

    sesion.deshacer()
    sesion.tocarCasilla('e1')

    const estado = sesion.obtenerEstado()
    expect(piezaEn(estado, 'e1')?.tipo).toBe('k')
    expect(piezaEn(estado, 'h1')?.tipo).toBe('r')
    expect(piezaEn(estado, 'f1')).toBeUndefined()
    expect(destinos(estado)).toContain('g1')
  })

  it('devuelve el peón capturado al paso a su casilla real, y se puede repetir la captura', () => {
    const sesion = nueva('1. e4 d5 2. e5 f5 3. exf6')

    sesion.deshacer()
    sesion.tocarCasilla('e5')

    const estado = sesion.obtenerEstado()
    expect(piezaEn(estado, 'f5')).toEqual({ casilla: 'f5', tipo: 'p', bando: 'b' })
    expect(piezaEn(estado, 'f6')).toBeUndefined()
    expect(estado.capturadas).toEqual({ w: [], b: [] })
    expect(estado.destinos).toContainEqual({ casilla: 'f6', captura: true })
  })

  it('devuelve el peón tras la Coronación', () => {
    const sesion = desdeFen('8/P6k/8/8/8/8/6K1/8 w - - 0 1')

    jugar(sesion, 'a7 a8')
    sesion.coronar('q')
    sesion.deshacer()

    const estado = sesion.obtenerEstado()
    expect(piezaEn(estado, 'a7')).toEqual({ casilla: 'a7', tipo: 'p', bando: 'w' })
    expect(piezaEn(estado, 'a8')).toBeUndefined()
    expect(estado.historial).toEqual([])
  })

  it('quita la selección', () => {
    const sesion = nueva()

    jugar(sesion, 'e2 e4')
    sesion.tocarCasilla('e7')
    sesion.deshacer()

    expect(sesion.obtenerEstado().seleccion).toBeNull()
    expect(sesion.obtenerEstado().destinos).toEqual([])
  })

  it('cancela la Coronación pendiente y retira la Jugada anterior', () => {
    const sesion = nueva('1. a4 b5 2. axb5 a6 3. bxa6 Bb7 4. axb7 Nc6')

    jugar(sesion, 'b7 a8')
    sesion.deshacer()

    const estado = sesion.obtenerEstado()
    expect(estado.coronacion).toBeNull()
    expect(estado.turno).toBe('b')
    expect(estado.historial).toHaveLength(7)
  })

  it('tras un jaque mate quita el Resultado y devuelve el turno', () => {
    const sesion = nueva(mate)

    sesion.deshacer()

    const estado = sesion.obtenerEstado()
    expect(estado.resultado).toBeNull()
    expect(estado.jaque).toBe(false)
    expect(estado.turno).toBe('b')
  })

  it('tras una triple repetición quita las tablas, y repetir la Jugada las devuelve', () => {
    const sesion = nueva()
    const resultado = { tipo: 'tablas', motivo: 'triple-repeticion' }

    jugar(sesion, 'g1 f3', 'g8 f6', 'f3 g1', 'f6 g8', 'g1 f3', 'g8 f6', 'f3 g1', 'f6 g8')
    sesion.deshacer()
    expect(sesion.obtenerEstado().resultado).toBeNull()

    jugar(sesion, 'f6 g8')
    expect(sesion.obtenerEstado().resultado).toEqual(resultado)
  })
})

describe('Girar', () => {
  it('el tablero empieza sin girar', () => {
    expect(nueva().obtenerEstado().girado).toBe(false)
  })

  it('girar cambia la orientación y volver a girar la restaura', () => {
    const sesion = nueva()

    sesion.girar()
    expect(sesion.obtenerEstado().girado).toBe(true)

    sesion.girar()
    expect(sesion.obtenerEstado().girado).toBe(false)
  })

  it('no gira solo al jugar ni al Deshacer', () => {
    const sesion = nueva()

    jugar(sesion, 'e2 e4')
    expect(sesion.obtenerEstado().girado).toBe(false)

    sesion.girar()
    jugar(sesion, 'e7 e5')
    sesion.deshacer()
    expect(sesion.obtenerEstado().girado).toBe(true)
  })

  it('conserva la selección', () => {
    const sesion = nueva()

    sesion.tocarCasilla('g1')
    sesion.girar()

    expect(sesion.obtenerEstado().seleccion).toBe('g1')
    expect(destinos(sesion.obtenerEstado())).toEqual(['f3', 'h3'])
  })

  it('conserva la Coronación pendiente', () => {
    const sesion = desdeFen('8/P6k/8/8/8/8/6K1/8 w - - 0 1')

    jugar(sesion, 'a7 a8')
    sesion.girar()

    expect(sesion.obtenerEstado().coronacion).toEqual({ desde: 'a7', hasta: 'a8' })
  })

  it('se puede girar con la Partida terminada', () => {
    const sesion = nueva(mate)

    sesion.girar()

    expect(sesion.obtenerEstado().girado).toBe(true)
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
    const sesion = nueva(mate)
    const antes = sesion.obtenerEstado()

    sesion.tocarCasilla('e1')
    sesion.tocarCasilla('a2')
    sesion.coronar('q')

    expect(antes.resultado).toEqual({ tipo: 'jaque-mate', ganador: 'b' })
    expect(sesion.obtenerEstado()).toBe(antes)
  })
})

describe('pantalla final', () => {
  it('está cerrada mientras la Partida sigue', () => {
    const sesion = nueva()

    jugar(sesion, 'e2 e4')

    expect(sesion.obtenerEstado().pantallaFinal).toBe(false)
  })

  it('se abre al terminar la Partida', () => {
    const sesion = nueva('1. f3 e5 2. g4')

    jugar(sesion, 'd8 h4')

    expect(sesion.obtenerEstado().pantallaFinal).toBe(true)
  })

  it('«Ver la partida» la cierra y conserva el Resultado y el Historial', () => {
    const sesion = nueva(mate)

    sesion.verLaPartida()

    const estado = sesion.obtenerEstado()
    expect(estado.pantallaFinal).toBe(false)
    expect(estado.resultado).toEqual({ tipo: 'jaque-mate', ganador: 'b' })
    expect(estado.historial).toHaveLength(4)
  })

  it('Deshacer retira solo la última Jugada, devuelve el turno y quita el Resultado', () => {
    const sesion = nueva(mate)

    sesion.deshacer()

    const estado = sesion.obtenerEstado()
    expect(estado.pantallaFinal).toBe(false)
    expect(estado.resultado).toBeNull()
    expect(estado.turno).toBe('b')
    expect(estado.historial).toEqual(['f3', 'e5', 'g4'])
  })

  it('se abre otra vez si tras verla y deshacer la Partida vuelve a terminar', () => {
    const sesion = nueva(mate)

    sesion.verLaPartida()
    sesion.deshacer()
    jugar(sesion, 'd8 h4')

    expect(sesion.obtenerEstado().pantallaFinal).toBe(true)
  })
})

describe('«Nueva partida»', () => {
  it('la capa está cerrada al empezar', () => {
    expect(nueva().obtenerEstado().eleccion).toBeNull()
  })

  it('sin Jugadas abre la capa sin aviso', () => {
    const sesion = nueva()

    sesion.abrirEleccion()

    expect(sesion.obtenerEstado().eleccion).toEqual({ aviso: false })
  })

  it('con la Partida en curso abre la capa con el aviso', () => {
    const sesion = nueva()

    jugar(sesion, 'e2 e4')
    sesion.abrirEleccion()

    expect(sesion.obtenerEstado().eleccion).toEqual({ aviso: true })
  })

  it('con la Partida terminada abre la capa sin aviso', () => {
    const sesion = nueva(mate)

    sesion.verLaPartida()
    sesion.abrirEleccion()

    expect(sesion.obtenerEstado().eleccion).toEqual({ aviso: false })
  })

  it('abrir la capa no reemplaza la Partida', () => {
    const sesion = nueva('1. e4 e5')
    const { piezas, historial, turno } = sesion.obtenerEstado()

    sesion.abrirEleccion()

    expect(sesion.obtenerEstado()).toMatchObject({ piezas, historial, turno })
  })

  it('«Volver a la partida» cierra la capa y deja todo como estaba', () => {
    const sesion = nueva('1. e4 e5')

    sesion.girar()
    sesion.tocarCasilla('g1')
    const antes = sesion.obtenerEstado()

    sesion.abrirEleccion()
    sesion.volverALaPartida()

    expect(sesion.obtenerEstado()).toEqual(antes)
  })

  it('«Volver a la partida» conserva la Coronación pendiente', () => {
    const sesion = desdeFen('8/P6k/8/8/8/8/6K1/8 w - - 0 1')

    jugar(sesion, 'a7 a8')
    sesion.abrirEleccion()
    sesion.volverALaPartida()

    expect(sesion.obtenerEstado().coronacion).toEqual({ desde: 'a7', hasta: 'a8' })
  })

  it('«Volver a la partida» no reabre la pantalla final ya cerrada', () => {
    const sesion = nueva(mate)

    sesion.verLaPartida()
    sesion.abrirEleccion()
    sesion.volverALaPartida()

    expect(sesion.obtenerEstado().pantallaFinal).toBe(false)
  })

  it('«Volver a la partida» muestra la pantalla final si la Partida terminó con la capa abierta', () => {
    const sesion = nueva('1. f3 e5 2. g4')

    sesion.abrirEleccion()
    jugar(sesion, 'd8 h4')
    expect(sesion.obtenerEstado().eleccion).toEqual({ aviso: false })

    sesion.volverALaPartida()

    expect(sesion.obtenerEstado()).toMatchObject({ eleccion: null, pantallaFinal: true })
  })

  it('la Partida solo se reemplaza al empezar la nueva, y eso cierra la capa', () => {
    const sesion = nueva('1. e4 e5')

    sesion.abrirEleccion()
    sesion.empezar()

    expect(sesion.obtenerEstado()).toEqual(nueva().obtenerEstado())
  })
})

describe('Guardado', () => {
  it('recuperar conserva la posición, el turno y el Historial', () => {
    const almacen = almacenEnMemoria()

    jugar(conAlmacen(almacen), 'e2 e4', 'd7 d5', 'e4 d5')

    const estado = conAlmacen(almacen).obtenerEstado()
    expect(estado.historial).toEqual(['e4', 'd5', 'exd5'])
    expect(estado.turno).toBe('b')
    expect(piezaEn(estado, 'd5')).toEqual({ casilla: 'd5', tipo: 'p', bando: 'w' })
    expect(estado.capturadas).toEqual({ w: ['p'], b: [] })
  })

  it('recuperar conserva la triple repetición', () => {
    const almacen = almacenEnMemoria()

    jugar(conAlmacen(almacen), 'g1 f3', 'g8 f6', 'f3 g1', 'f6 g8', 'g1 f3', 'g8 f6', 'f3 g1')

    const sesion = conAlmacen(almacen)
    expect(sesion.obtenerEstado().resultado).toBeNull()

    jugar(sesion, 'f6 g8')

    expect(sesion.obtenerEstado().resultado).toEqual({ tipo: 'tablas', motivo: 'triple-repeticion' })
  })

  it('recuperar permite Deshacer hasta el inicio', () => {
    const almacen = almacenEnMemoria()

    jugar(conAlmacen(almacen), 'e2 e4', 'e7 e5', 'g1 f3', 'b8 c6')

    const sesion = conAlmacen(almacen)
    for (let i = 0; i < 4; i++) sesion.deshacer()

    expect(sesion.obtenerEstado()).toEqual(nueva().obtenerEstado())
  })

  it('Deshacer también se guarda', () => {
    const almacen = almacenEnMemoria()
    const sesion = conAlmacen(almacen)

    jugar(sesion, 'e2 e4', 'e7 e5')
    sesion.deshacer()

    expect(conAlmacen(almacen).obtenerEstado().historial).toEqual(['e4'])
  })

  it('empezar reemplaza la Partida guardada', () => {
    const almacen = almacenEnMemoria()
    const sesion = conAlmacen(almacen)

    jugar(sesion, 'e2 e4')
    sesion.empezar()

    expect(conAlmacen(almacen).obtenerEstado()).toEqual(nueva().obtenerEstado())
  })

  it('una Partida recuperada se sigue guardando', () => {
    const almacen = almacenEnMemoria()

    jugar(conAlmacen(almacen), 'e2 e4')
    jugar(conAlmacen(almacen), 'e7 e5')

    expect(conAlmacen(almacen).obtenerEstado().historial).toEqual(['e4', 'e5'])
  })

  it('recuperar una Partida terminada abre su pantalla final', () => {
    const almacen = almacenEnMemoria()
    const terminada = conAlmacen(almacen)

    jugar(terminada, 'f2 f3', 'e7 e5', 'g2 g4', 'd8 h4')
    terminada.verLaPartida()

    expect(conAlmacen(almacen).obtenerEstado()).toMatchObject({
      pantallaFinal: true,
      resultado: { tipo: 'jaque-mate', ganador: 'b' },
    })
  })

  it('reserva el lugar de Rival, Bando y Nivel', () => {
    const escrituras: string[] = []
    const sesion = conAlmacen({ leer: () => null, escribir: (_clave, valor) => void escrituras.push(valor) })

    jugar(sesion, 'e2 e4')

    expect(JSON.parse(escrituras[0])).toMatchObject({ rival: 'persona', bando: null, nivel: null })
  })

  it.each([
    ['con JSON roto', '{"pgn":'],
    ['sin PGN', '{}'],
    ['que no es un objeto', 'null'],
    ['con un PGN ilegible', JSON.stringify({ pgn: '{' })],
    ['con una Jugada ilegal tras otras válidas', JSON.stringify({ pgn: '1. e4 e5 2. e4' })],
  ])('un guardado %s lleva al arranque normal', (_caso, guardado) => {
    expect(conGuardado(guardado).obtenerEstado()).toEqual(nueva().obtenerEstado())
  })

  it('un almacén que falla no interrumpe la Partida', () => {
    const fallar = () => {
      throw new Error('almacén no disponible')
    }
    const sesion = conAlmacen({ leer: fallar, escribir: fallar })

    jugar(sesion, 'e2 e4')

    expect(sesion.obtenerEstado().historial).toEqual(['e4'])
  })
})

describe('empezar', () => {
  it('devuelve la posición inicial con el tablero sin girar', () => {
    const sesion = nueva(mate)
    const inicio = nueva().obtenerEstado()

    sesion.girar()
    sesion.empezar()

    expect(sesion.obtenerEstado()).toEqual(inicio)
  })

  it('quita la selección y las capturadas', () => {
    const sesion = nueva('1. e4 d5 2. exd5')

    sesion.tocarCasilla('g8')
    sesion.empezar()

    expect(sesion.obtenerEstado()).toEqual(nueva().obtenerEstado())
  })

  it('quita la Coronación pendiente', () => {
    const sesion = desdeFen('8/P6k/8/8/8/8/6K1/8 w - - 0 1')

    jugar(sesion, 'a7 a8')
    sesion.empezar()

    expect(sesion.obtenerEstado()).toEqual(nueva().obtenerEstado())
  })

  it('tras «Ver la partida», la siguiente Partida vuelve a abrir la pantalla final', () => {
    const sesion = nueva(mate)

    sesion.verLaPartida()
    sesion.empezar()
    jugar(sesion, 'f2 f3', 'e7 e5', 'g2 g4', 'd8 h4')

    expect(sesion.obtenerEstado().pantallaFinal).toBe(true)
  })
})

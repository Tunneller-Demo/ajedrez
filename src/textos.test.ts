import { describe, expect, it } from 'vitest'
import { textoDeDeshacer, textoDeEspera, textoDeJugada, textoDelRival } from './textos'
import type { EventoDeJugada } from './sesion/sesionDePartida'

const jugada = (cambios: Partial<EventoDeJugada>): EventoDeJugada => ({
  bando: 'w',
  pieza: 'n',
  desde: 'g1',
  hasta: 'f3',
  san: 'Nf3',
  captura: null,
  torre: null,
  coronacion: null,
  jaque: false,
  rayos: [],
  resultado: null,
  efecto: 'mover',
  deLaMaquina: false,
  ...cambios,
})

describe('texto de una espera de la Máquina', () => {
  it.each([
    ['prepara', 'La Máquina se prepara'],
    ['piensa', 'La Máquina piensa'],
  ] as const)('%s dice «%s»', (espera, texto) => {
    expect(textoDeEspera(espera)).toBe(texto)
  })
})

describe('texto hablado de una Jugada', () => {
  it('dice la pieza y su destino', () => {
    expect(textoDeJugada(jugada({}))).toBe('caballo a efe tres')
  })

  it.each([
    ['a1', 'a uno'],
    ['b2', 'be dos'],
    ['c3', 'ce tres'],
    ['d4', 'de cuatro'],
    ['e5', 'e cinco'],
    ['f6', 'efe seis'],
    ['g7', 'ge siete'],
    ['h8', 'hache ocho'],
  ] as const)('dice %s como «%s»', (hasta, hablada) => {
    expect(textoDeJugada(jugada({ pieza: 'q', hasta }))).toBe(`dama a ${hablada}`)
  })

  it('dice qué pieza captura', () => {
    expect(textoDeJugada(jugada({ pieza: 'b', hasta: 'f6', captura: { pieza: 'n', casilla: 'f6' } }))).toBe(
      'alfil captura caballo en efe seis',
    )
  })

  it('distingue la captura al paso, cuyo peón no está en el destino', () => {
    expect(textoDeJugada(jugada({ pieza: 'p', hasta: 'd6', captura: { pieza: 'p', casilla: 'd5' } }))).toBe(
      'peón captura peón al paso en de seis',
    )
  })

  it('nombra el enroque por su lado', () => {
    const corto = jugada({ pieza: 'k', hasta: 'g1', torre: { desde: 'h1', hasta: 'f1' } })
    const largo = jugada({ pieza: 'k', hasta: 'c8', torre: { desde: 'a8', hasta: 'd8' } })

    expect(textoDeJugada(corto)).toBe('enroque corto')
    expect(textoDeJugada(largo)).toBe('enroque largo')
  })

  it('añade la Coronación', () => {
    expect(textoDeJugada(jugada({ pieza: 'p', hasta: 'a8', coronacion: 'q' }))).toBe('peón a a ocho, corona dama')
  })

  it('añade el jaque', () => {
    expect(textoDeJugada(jugada({ jaque: true }))).toBe('caballo a efe tres, jaque')
  })

  it('añade el Resultado, que en un mate sustituye al jaque', () => {
    const mate = jugada({ pieza: 'q', hasta: 'h4', jaque: true, resultado: { tipo: 'jaque-mate', ganador: 'b' } })

    expect(textoDeJugada(mate)).toBe('dama a hache cuatro, jaque mate, ganan las negras')
    expect(textoDeJugada(jugada({ resultado: { tipo: 'ahogado' } }))).toBe('caballo a efe tres, ahogado, tablas')
    expect(textoDeJugada(jugada({ resultado: { tipo: 'tablas', motivo: 'triple-repeticion' } }))).toBe(
      'caballo a efe tres, tablas por triple repetición',
    )
  })
})

describe('texto hablado de una Jugada de la Máquina', () => {
  it('la nombra y conserva la consecuencia', () => {
    expect(textoDeJugada(jugada({ deLaMaquina: true, jaque: true }))).toBe('La Máquina juega caballo a efe tres, jaque')
  })

  it('une la captura a la frase', () => {
    const captura = jugada({ deLaMaquina: true, pieza: 'b', hasta: 'f6', captura: { pieza: 'n', casilla: 'f6' } })

    expect(textoDeJugada(captura)).toBe('La Máquina juega alfil y captura caballo en efe seis')
  })

  it('nombra el enroque', () => {
    const enroque = jugada({ deLaMaquina: true, pieza: 'k', hasta: 'g1', torre: { desde: 'h1', hasta: 'f1' } })

    expect(textoDeJugada(enroque)).toBe('La Máquina juega enroque corto')
  })
})

describe('texto del Rival', () => {
  it.each([
    ['facil', 'Fácil'],
    ['medio', 'Medio'],
    ['dificil', 'Difícil'],
    ['maximo', 'Máximo'],
  ] as const)('contra la Máquina en %s dice su Nivel', (nivel, etiqueta) => {
    expect(textoDelRival({ rival: 'maquina', bando: 'w', nivel })).toBe(`Contra la Máquina · ${etiqueta}`)
  })

  it('a dos no dice nada', () => {
    expect(textoDelRival({ rival: 'persona', bando: null, nivel: null })).toBeNull()
  })
})

describe('texto hablado de Deshacer', () => {
  it('dice a qué bando le toca', () => {
    expect(textoDeDeshacer('w')).toBe('Jugada deshecha, juegan las blancas')
    expect(textoDeDeshacer('b')).toBe('Jugada deshecha, juegan las negras')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { crearMotorDeMaquina, traducirNotacionLarga, type MotorDeMaquina, type Nivel } from './motor'

const INICIO = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function crearDoble() {
  const enviados: string[] = []
  const creados: { terminate: ReturnType<typeof vi.fn> }[] = []
  let actual: { onmessage: ((evento: { data: string }) => void) | null; onerror: ((evento: { message: string }) => void) | null }

  const crearWorker = () => {
    const worker = {
      onmessage: null,
      onerror: null,
      terminate: vi.fn(),
      postMessage(linea: string) {
        enviados.push(linea)
        if (linea === 'uci') queueMicrotask(() => worker.onmessage?.({ data: 'uciok' }))
        if (linea === 'isready') queueMicrotask(() => worker.onmessage?.({ data: 'readyok' }))
      },
    } as unknown as typeof actual & { terminate: ReturnType<typeof vi.fn>; postMessage(linea: string): void }
    actual = worker
    creados.push(worker)
    return worker as unknown as Worker
  }

  return {
    enviados,
    creados,
    crearWorker,
    responder: (linea: string) => actual.onmessage?.({ data: linea }),
    fallar: (mensaje: string) => actual.onerror?.({ message: mensaje }),
    busquedas: () => enviados.filter((linea) => linea.startsWith('go ')),
  }
}

async function pedir(motor: MotorDeMaquina, fen = INICIO, nivel: Nivel = 'facil') {
  await motor.preparar()
  return motor.pedirJugada(fen, nivel)
}

function iniciar() {
  const doble = crearDoble()
  return { doble, motor: crearMotorDeMaquina(doble.crearWorker) }
}

describe('notación larga', () => {
  it('traduce una Jugada normal', () => {
    expect(traducirNotacionLarga('e2e4')).toEqual({ desde: 'e2', hasta: 'e4', coronacion: null })
  })

  it('traduce el enroque a la Jugada del rey', () => {
    expect(traducirNotacionLarga('e1g1')).toEqual({ desde: 'e1', hasta: 'g1', coronacion: null })
  })

  it.each([
    ['e7e8q', 'e7', 'e8', 'q'],
    ['a2a1n', 'a2', 'a1', 'n'],
    ['h7h8r', 'h7', 'h8', 'r'],
    ['b2b1b', 'b2', 'b1', 'b'],
  ])('traduce %s con su Coronación', (notacion, desde, hasta, coronacion) => {
    expect(traducirNotacionLarga(notacion)).toEqual({ desde, hasta, coronacion })
  })
})

describe('Motor de la Máquina', () => {
  it('no crea el Worker hasta prepararse, y lo crea una sola vez', async () => {
    const { doble, motor } = iniciar()
    expect(doble.creados).toHaveLength(0)

    await motor.preparar()
    await motor.preparar()

    expect(doble.creados).toHaveLength(1)
    expect(doble.enviados).toEqual(['uci', 'isready'])
  })

  it('se prepara solo si se le pide una Jugada', async () => {
    const { doble, motor } = iniciar()

    const respuesta = motor.pedirJugada(INICIO, 'facil')
    await vi.waitFor(() => expect(doble.busquedas()).toHaveLength(1))
    doble.responder('bestmove e2e4')

    await expect(respuesta).resolves.toEqual({ desde: 'e2', hasta: 'e4', coronacion: null })
  })

  it.each<[Nivel, number, string]>([
    ['facil', 0, 'go movetime 100 depth 3'],
    ['medio', 5, 'go movetime 200 depth 5'],
    ['dificil', 12, 'go movetime 500 depth 10'],
    ['maximo', 20, 'go movetime 1000 depth 13'],
  ])('busca en %s con su Skill Level y su límite', async (nivel, skill, go) => {
    const { doble, motor } = iniciar()

    const respuesta = pedir(motor, INICIO, nivel)
    await vi.waitFor(() => expect(doble.busquedas()).toHaveLength(1))
    doble.responder('bestmove e2e4')
    await respuesta

    expect(doble.enviados.slice(2)).toEqual([`setoption name Skill Level value ${skill}`, `position fen ${INICIO}`, go])
  })

  it('ignora las líneas de análisis y traduce la Coronación de la respuesta', async () => {
    const { doble, motor } = iniciar()

    const respuesta = pedir(motor)
    await vi.waitFor(() => expect(doble.busquedas()).toHaveLength(1))
    doble.responder('info depth 1 score cp 900 pv e7e8q')
    doble.responder('bestmove e7e8q ponder h7h6')

    await expect(respuesta).resolves.toEqual({ desde: 'e7', hasta: 'e8', coronacion: 'q' })
  })

  it('cancelar corta la búsqueda y descarta la respuesta tardía', async () => {
    const { doble, motor } = iniciar()

    const respuesta = pedir(motor)
    await vi.waitFor(() => expect(doble.busquedas()).toHaveLength(1))
    motor.cancelar()

    expect(doble.enviados[doble.enviados.length - 1]).toBe('stop')
    await expect(respuesta).resolves.toBeNull()
  })

  it('cancelar sin búsqueda en curso no envía nada', async () => {
    const { doble, motor } = iniciar()
    await motor.preparar()

    motor.cancelar()

    expect(doble.enviados).toEqual(['uci', 'isready'])
  })

  it('tras cancelar, la respuesta tardía no se toma por la del pedido siguiente', async () => {
    const { doble, motor } = iniciar()

    const cortada = pedir(motor, 'fen-cortada')
    await vi.waitFor(() => expect(doble.busquedas()).toHaveLength(1))
    motor.cancelar()
    await cortada

    const siguiente = motor.pedirJugada('fen-siguiente', 'facil')
    await Promise.resolve()
    expect(doble.busquedas()).toHaveLength(1)

    doble.responder('bestmove a2a3')
    await vi.waitFor(() => expect(doble.busquedas()).toHaveLength(2))
    expect(doble.enviados).toContain('position fen fen-siguiente')

    doble.responder('bestmove e2e4')
    await expect(siguiente).resolves.toEqual({ desde: 'e2', hasta: 'e4', coronacion: null })
  })

  it('un pedido nuevo sustituye al anterior', async () => {
    const { doble, motor } = iniciar()

    const anterior = pedir(motor, 'fen-anterior')
    await vi.waitFor(() => expect(doble.busquedas()).toHaveLength(1))
    const nuevo = motor.pedirJugada('fen-nuevo', 'facil')

    await expect(anterior).resolves.toBeNull()
    doble.responder('bestmove a2a3')
    await vi.waitFor(() => expect(doble.busquedas()).toHaveLength(2))
    doble.responder('bestmove e2e4')

    await expect(nuevo).resolves.toEqual({ desde: 'e2', hasta: 'e4', coronacion: null })
    expect(doble.enviados.filter((linea) => linea === 'stop')).toHaveLength(1)
  })

  it('rechaza si el motor no encuentra Jugada', async () => {
    const { doble, motor } = iniciar()

    const respuesta = pedir(motor)
    await vi.waitFor(() => expect(doble.busquedas()).toHaveLength(1))
    doble.responder('bestmove (none)')

    await expect(respuesta).rejects.toThrow('sin Jugada')
  })

  it('un error del Worker rechaza el pedido, y al prepararse de nuevo nace otro Worker', async () => {
    const { doble, motor } = iniciar()

    const respuesta = pedir(motor)
    await vi.waitFor(() => expect(doble.busquedas()).toHaveLength(1))
    doble.fallar('memory access out of bounds')

    await expect(respuesta).rejects.toThrow('memory access out of bounds')
    expect(doble.creados[0].terminate).toHaveBeenCalled()

    await motor.preparar()
    expect(doble.creados).toHaveLength(2)
  })

  it('rechaza preparar si el Worker no llega a cargar', async () => {
    const { doble, motor } = iniciar()

    const preparacion = motor.preparar()
    doble.fallar('')

    await expect(preparacion).rejects.toThrow('El motor no pudo cargar')
  })
})

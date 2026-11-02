import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearMotorDeMaquina, hayWasmSimd, traducirNotacionLarga, type MotorDeMaquina, type Nivel } from './motor'

const INICIO = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const ESPERA: Record<Nivel, number> = { facil: 4100, medio: 4200, dificil: 4500, maximo: 5000 }
const GRACIA = 2000
const PREPARACION = 30_000

function crearDoble() {
  const enviados: string[] = []
  const creados: { terminate: ReturnType<typeof vi.fn> }[] = []
  let actual: { onmessage: ((evento: { data: string }) => void) | null; onerror: ((evento: { message: string }) => void) | null }
  let retenida = false

  const crearWorker = () => {
    const worker = {
      onmessage: null,
      onerror: null,
      terminate: vi.fn(),
      postMessage(linea: string) {
        enviados.push(linea)
        if (retenida) return
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
    // Los Workers que nazcan a partir de aquí no contestan a la preparación hasta soltarla.
    retenerPreparacion: () => void (retenida = true),
    soltarPreparacion() {
      retenida = false
      actual.onmessage?.({ data: 'readyok' })
    },
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

  it('rechaza preparar si el Worker no llega a cargar', async () => {
    const { doble, motor } = iniciar()

    const preparacion = motor.preparar()
    doble.fallar('')

    await expect(preparacion).rejects.toThrow('El motor no pudo cargar')
  })

  it('sin SIMD de WebAssembly rechaza sin crear el Worker', async () => {
    const doble = crearDoble()
    const motor = crearMotorDeMaquina(doble.crearWorker, () => false)

    await expect(motor.preparar()).rejects.toThrow('SIMD')
    await expect(motor.pedirJugada(INICIO, 'facil')).rejects.toThrow('SIMD')
    expect(doble.creados).toHaveLength(0)
  })
})

describe('Motor de la Máquina que falla', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function buscando(nivel: Nivel = 'facil') {
    const { doble, motor } = iniciar()
    const respuesta = motor.pedirJugada(INICIO, nivel)
    await vi.advanceTimersByTimeAsync(0)
    expect(doble.busquedas()).toHaveLength(1)
    return { doble, motor, respuesta }
  }

  const stops = (doble: ReturnType<typeof crearDoble>) => doble.enviados.filter((linea) => linea === 'stop')

  it.each<[Nivel, number]>([
    ['facil', ESPERA.facil],
    ['medio', ESPERA.medio],
    ['dificil', ESPERA.dificil],
    ['maximo', ESPERA.maximo],
  ])('en %s no corta una búsqueda antes de su tiempo', async (nivel, espera) => {
    const { doble, respuesta } = await buscando(nivel)

    await vi.advanceTimersByTimeAsync(espera - 1)
    expect(stops(doble)).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(stops(doble)).toHaveLength(1)

    doble.responder('bestmove e2e4')
    await expect(respuesta).resolves.toEqual({ desde: 'e2', hasta: 'e4', coronacion: null })
  })

  it('una respuesta a tiempo apaga la vigilancia', async () => {
    const { doble, respuesta } = await buscando()

    doble.responder('bestmove e2e4')
    await respuesta
    await vi.advanceTimersByTimeAsync(60_000)

    expect(stops(doble)).toHaveLength(0)
    expect(doble.creados).toHaveLength(1)
  })

  it('si tampoco responde al stop, reinicia el Worker y repite con una búsqueda corta', async () => {
    const { doble, respuesta } = await buscando('maximo')

    await vi.advanceTimersByTimeAsync(ESPERA.maximo + GRACIA - 1)
    expect(doble.creados).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)

    expect(doble.creados[0].terminate).toHaveBeenCalled()
    expect(doble.creados).toHaveLength(2)
    expect(doble.busquedas()).toEqual(['go movetime 1000 depth 13', 'go movetime 500 depth 8'])
    expect(doble.enviados.slice(-3, -1)).toEqual(['setoption name Skill Level value 20', `position fen ${INICIO}`])

    doble.responder('bestmove e2e4')
    await expect(respuesta).resolves.toEqual({ desde: 'e2', hasta: 'e4', coronacion: null })
  })

  it('un error del Worker durante la búsqueda recibe el mismo trato', async () => {
    const { doble, respuesta } = await buscando()

    doble.fallar('memory access out of bounds')
    await vi.advanceTimersByTimeAsync(0)

    expect(doble.creados[0].terminate).toHaveBeenCalled()
    expect(doble.busquedas()).toEqual(['go movetime 100 depth 3', 'go movetime 50 depth 2'])

    doble.responder('bestmove e2e4')
    await expect(respuesta).resolves.toEqual({ desde: 'e2', hasta: 'e4', coronacion: null })
  })

  it('una respuesta sin Jugada recibe el mismo trato', async () => {
    const { doble, respuesta } = await buscando()

    doble.responder('bestmove (none)')
    await vi.advanceTimersByTimeAsync(0)

    expect(doble.creados).toHaveLength(2)
    doble.responder('bestmove e2e4')
    await expect(respuesta).resolves.toEqual({ desde: 'e2', hasta: 'e4', coronacion: null })
  })

  it.each([
    ['un error del Worker', 'memory access out of bounds', (doble: ReturnType<typeof crearDoble>) => doble.fallar('memory access out of bounds')],
    ['una respuesta sin Jugada', 'sin Jugada', (doble: ReturnType<typeof crearDoble>) => doble.responder('bestmove (none)')],
  ])('%s en la búsqueda corta rechaza el pedido', async (_caso, mensaje, fallar) => {
    const { doble, respuesta } = await buscando()
    const rechazo = expect(respuesta).rejects.toThrow(mensaje)

    doble.fallar('primer fallo')
    await vi.advanceTimersByTimeAsync(0)
    fallar(doble)

    await rechazo
    expect(doble.creados).toHaveLength(2)
    expect(doble.creados[1].terminate).toHaveBeenCalled()
  })

  it('si la búsqueda corta se agota, rechaza el pedido', async () => {
    const { doble, respuesta } = await buscando()
    const rechazo = expect(respuesta).rejects.toThrow('no responde')

    await vi.advanceTimersByTimeAsync((ESPERA.facil + GRACIA) * 2)

    await rechazo
    expect(doble.busquedas()).toHaveLength(2)
    expect(doble.creados).toHaveLength(2)
  })

  it('tras un rechazo, el pedido siguiente vuelve a tener su reintento', async () => {
    const { doble, motor, respuesta } = await buscando()
    const rechazo = expect(respuesta).rejects.toThrow()

    doble.fallar('primer fallo')
    await vi.advanceTimersByTimeAsync(0)
    doble.fallar('segundo fallo')
    await rechazo

    const siguiente = motor.pedirJugada(INICIO, 'facil')
    await vi.advanceTimersByTimeAsync(0)
    expect(doble.busquedas()[2]).toBe('go movetime 100 depth 3')

    doble.fallar('tercer fallo')
    await vi.advanceTimersByTimeAsync(0)
    expect(doble.busquedas()[3]).toBe('go movetime 50 depth 2')

    doble.responder('bestmove e2e4')
    await expect(siguiente).resolves.toEqual({ desde: 'e2', hasta: 'e4', coronacion: null })
  })

  it('si el motor no vuelve a cargar en el reintento, rechaza el pedido', async () => {
    const { doble, respuesta } = await buscando()
    const rechazo = expect(respuesta).rejects.toThrow('El motor no pudo cargar')

    doble.retenerPreparacion()
    doble.fallar('primer fallo')
    doble.fallar('')

    await rechazo
    expect(doble.busquedas()).toHaveLength(1)
  })

  it('un pedido cancelado durante el reintento se resuelve vacío y no lanza nada', async () => {
    const { doble, motor, respuesta } = await buscando()

    doble.retenerPreparacion()
    doble.fallar('primer fallo')
    motor.cancelar()
    doble.soltarPreparacion()
    await vi.advanceTimersByTimeAsync(0)

    await expect(respuesta).resolves.toBeNull()
    expect(doble.busquedas()).toHaveLength(1)
  })

  it('si la preparación se agota, rechaza sin reintentar y termina el Worker', async () => {
    const { doble, motor } = iniciar()
    doble.retenerPreparacion()
    const preparacion = expect(motor.preparar()).rejects.toThrow('cargar')
    const respuesta = expect(motor.pedirJugada(INICIO, 'facil')).rejects.toThrow('cargar')

    await vi.advanceTimersByTimeAsync(PREPARACION)

    await preparacion
    await respuesta
    expect(doble.creados).toHaveLength(1)
    expect(doble.creados[0].terminate).toHaveBeenCalled()
  })

  it('una preparación que llega a tiempo apaga su vigilancia', async () => {
    const { doble, motor } = iniciar()

    await motor.preparar()
    await vi.advanceTimersByTimeAsync(PREPARACION)

    expect(doble.creados[0].terminate).not.toHaveBeenCalled()
  })

  it('un stop sin respuesta tras cancelar termina el Worker y no deja parado el Motor', async () => {
    const { doble, motor, respuesta } = await buscando()

    motor.cancelar()
    await expect(respuesta).resolves.toBeNull()
    await vi.advanceTimersByTimeAsync(GRACIA)

    expect(doble.creados[0].terminate).toHaveBeenCalled()

    const siguiente = motor.pedirJugada(INICIO, 'facil')
    await vi.advanceTimersByTimeAsync(0)
    expect(doble.creados).toHaveLength(2)
    expect(doble.busquedas()[1]).toBe('go movetime 100 depth 3')

    doble.responder('bestmove e2e4')
    await expect(siguiente).resolves.toEqual({ desde: 'e2', hasta: 'e4', coronacion: null })
  })

  it('un stop sin respuesta tras sustituir el pedido atiende al que espera', async () => {
    const { doble, motor, respuesta } = await buscando()

    const siguiente = motor.pedirJugada('fen-siguiente', 'facil')
    await expect(respuesta).resolves.toBeNull()
    await vi.advanceTimersByTimeAsync(GRACIA)

    expect(doble.creados).toHaveLength(2)
    expect(doble.enviados).toContain('position fen fen-siguiente')
    expect(doble.busquedas()[1]).toBe('go movetime 100 depth 3')

    doble.responder('bestmove e2e4')
    await expect(siguiente).resolves.toEqual({ desde: 'e2', hasta: 'e4', coronacion: null })
  })

  it('si la búsqueda cortada responde, no se termina el Worker', async () => {
    const { doble, motor, respuesta } = await buscando()

    motor.cancelar()
    await respuesta
    doble.responder('bestmove a2a3')
    await vi.advanceTimersByTimeAsync(GRACIA)

    expect(doble.creados[0].terminate).not.toHaveBeenCalled()
  })
})

describe('SIMD de WebAssembly', () => {
  it('detecta SIMD de WebAssembly en este entorno', () => {
    expect(hayWasmSimd()).toBe(true)
  })

  it('no lo da por bueno si WebAssembly no valida el módulo', () => {
    const validar = vi.spyOn(WebAssembly, 'validate').mockReturnValue(false)

    expect(hayWasmSimd()).toBe(false)

    validar.mockRestore()
  })
})

// Motor de la Máquina: cliente UCI sustituible. El motor vive en un Worker clásico servido desde public/, nunca en el bundle, para mantener la separación del código GPL.
import type { PieceSymbol, Square } from 'chess.js'

export type Nivel = 'facil' | 'medio' | 'dificil' | 'maximo'
export type JugadaDeMaquina = { desde: Square; hasta: Square; coronacion: PieceSymbol | null }

export type MotorDeMaquina = {
  preparar(): Promise<void>
  // Resuelve `null` si la búsqueda se cancela o la sustituye otro pedido.
  // Rechaza si el motor falla también en el reintento: el reinicio y la búsqueda corta quedan aquí dentro.
  pedirJugada(fen: string, nivel: Nivel): Promise<JugadaDeMaquina | null>
  cancelar(): void
}

type Pedido = {
  fen: string
  nivel: Nivel
  corta: boolean
  resolver(jugada: JugadaDeMaquina | null): void
  rechazar(error: Error): void
}

// `espera` es el `movetime` más 4 s: con la CPU limitada, la búsqueda más lenta medida fue de 1,2 s (mediciones en #25).
const BUSQUEDAS: Record<Nivel, { skill: number; limite: string; limiteCorto: string; espera: number }> = {
  facil: { skill: 0, limite: 'movetime 100 depth 3', limiteCorto: 'movetime 50 depth 2', espera: 4100 },
  medio: { skill: 5, limite: 'movetime 200 depth 5', limiteCorto: 'movetime 100 depth 3', espera: 4200 },
  dificil: { skill: 12, limite: 'movetime 500 depth 10', limiteCorto: 'movetime 250 depth 6', espera: 4500 },
  maximo: { skill: 20, limite: 'movetime 1000 depth 13', limiteCorto: 'movetime 500 depth 8', espera: 5000 },
}

// Margen para que el motor conteste a `stop` antes de darlo por colgado.
const GRACIA_DEL_STOP = 2000
// Holgada para la descarga de 1,8 MB del .wasm en una red lenta: un .wasm caído no da error, solo silencio.
const ESPERA_DE_PREPARACION = 30_000

// Módulo mínimo con una instrucción SIMD: `validate` lo rechaza si el navegador no sabe ejecutarla.
const MODULO_SIMD = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
])

export const hayWasmSimd = () => WebAssembly.validate(MODULO_SIMD)

export function traducirNotacionLarga(notacion: string): JugadaDeMaquina {
  return {
    desde: notacion.slice(0, 2) as Square,
    hasta: notacion.slice(2, 4) as Square,
    coronacion: (notacion[4] as PieceSymbol | undefined) ?? null,
  }
}

const crearWorkerDelMotor = () => new Worker(`${import.meta.env.BASE_URL}motor/stockfish-19-lite-single.js`)

export function crearMotorDeMaquina(
  crearWorker: () => Worker = crearWorkerDelMotor,
  puedeEjecutarse: () => boolean = hayWasmSimd,
): MotorDeMaquina {
  let worker: Worker | null = null
  let listo: Promise<void> | null = null
  let pedido: Pedido | null = null
  let buscando = false
  let cortada = false
  // Una sola vigilancia: la preparación y la búsqueda nunca coinciden.
  let vigilancia: ReturnType<typeof setTimeout> | undefined

  const enviar = (linea: string) => worker?.postMessage(linea)

  function vigilar(ms: number, alAgotarse: () => void) {
    clearTimeout(vigilancia)
    vigilancia = setTimeout(alAgotarse, ms)
  }

  function exigirRespuesta() {
    enviar('stop')
    vigilar(GRACIA_DEL_STOP, () => recuperar(new Error('El motor no responde')))
  }

  function lanzar() {
    if (!pedido || buscando) return
    const { skill, limite, limiteCorto, espera } = BUSQUEDAS[pedido.nivel]
    buscando = true
    enviar(`setoption name Skill Level value ${skill}`)
    enviar(`position fen ${pedido.fen}`)
    enviar(`go ${pedido.corta ? limiteCorto : limite}`)
    vigilar(espera, exigirRespuesta)
  }

  function alTerminarBusqueda(notacion: string) {
    clearTimeout(vigilancia)
    buscando = false
    if (cortada) {
      // El bestmove de una búsqueda cortada llega siempre antes de que empiece la siguiente.
      cortada = false
      lanzar()
      return
    }
    if (notacion === '(none)') return recuperar(new Error('El motor respondió sin Jugada'))
    const atendido = pedido
    pedido = null
    atendido?.resolver(traducirNotacionLarga(notacion))
  }

  function derribar() {
    clearTimeout(vigilancia)
    worker?.terminate()
    worker = null
    listo = null
    buscando = false
    cortada = false
  }

  function fallar(error: Error) {
    derribar()
    const atendido = pedido
    pedido = null
    atendido?.rechazar(error)
  }

  // El rechazo del reintento lo hace `fallar`: aquí no queda nada que atender.
  function recuperar(error: Error) {
    if (pedido?.corta) return fallar(error)
    // Tras una búsqueda cortada, el pedido en espera no ha fallado: conserva su búsqueda y su reintento.
    const fallo = !cortada
    derribar()
    if (!pedido) return
    pedido.corta = fallo
    preparar().then(lanzar, () => {})
  }

  function preparar() {
    listo ??= new Promise<void>((resolver, rechazar) => {
      if (!puedeEjecutarse()) return rechazar(new Error('Este navegador no ejecuta SIMD de WebAssembly'))
      const abortar = (error: Error) => {
        rechazar(error)
        fallar(error)
      }
      worker = crearWorker()
      worker.onerror = (evento) => {
        // Si el script no llega a cargar, el evento no trae mensaje.
        const error = new Error(evento.message || 'El motor no pudo cargar')
        if (buscando) recuperar(error)
        else abortar(error)
      }
      worker.onmessage = ({ data }: MessageEvent<string>) => {
        if (data === 'uciok') enviar('isready')
        else if (data === 'readyok') {
          clearTimeout(vigilancia)
          resolver()
        } else if (data.startsWith('bestmove ')) alTerminarBusqueda(data.split(' ')[1])
      }
      vigilar(ESPERA_DE_PREPARACION, () => abortar(new Error('El motor tardó demasiado en cargar')))
      enviar('uci')
    })
    return listo
  }

  function cancelar() {
    if (!pedido) return
    pedido.resolver(null)
    pedido = null
    if (buscando && !cortada) {
      cortada = true
      exigirRespuesta()
    }
  }

  return {
    preparar,
    cancelar,
    pedirJugada(fen, nivel) {
      return new Promise((resolver, rechazar) => {
        cancelar()
        pedido = { fen, nivel, corta: false, resolver, rechazar }
        preparar().then(lanzar, rechazar)
      })
    },
  }
}

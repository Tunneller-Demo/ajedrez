// Motor de la Máquina: cliente UCI sustituible. El motor vive en un Worker clásico servido desde public/, nunca en el bundle, para mantener la separación del código GPL.
import type { PieceSymbol, Square } from 'chess.js'

export type Nivel = 'facil' | 'medio' | 'dificil' | 'maximo'
export type JugadaDeMaquina = { desde: Square; hasta: Square; coronacion: PieceSymbol | null }

export type MotorDeMaquina = {
  preparar(): Promise<void>
  // Resuelve `null` si la búsqueda se cancela o la sustituye otro pedido.
  pedirJugada(fen: string, nivel: Nivel): Promise<JugadaDeMaquina | null>
  cancelar(): void
}

type Pedido = {
  fen: string
  nivel: Nivel
  resolver(jugada: JugadaDeMaquina | null): void
  rechazar(error: Error): void
}

const BUSQUEDAS: Record<Nivel, { skill: number; limite: string }> = {
  facil: { skill: 0, limite: 'movetime 100 depth 3' },
  medio: { skill: 5, limite: 'movetime 200 depth 5' },
  dificil: { skill: 12, limite: 'movetime 500 depth 10' },
  maximo: { skill: 20, limite: 'movetime 1000 depth 13' },
}

export function traducirNotacionLarga(notacion: string): JugadaDeMaquina {
  return {
    desde: notacion.slice(0, 2) as Square,
    hasta: notacion.slice(2, 4) as Square,
    coronacion: (notacion[4] as PieceSymbol | undefined) ?? null,
  }
}

const crearWorkerDelMotor = () => new Worker(`${import.meta.env.BASE_URL}motor/stockfish-19-lite-single.js`)

export function crearMotorDeMaquina(crearWorker: () => Worker = crearWorkerDelMotor): MotorDeMaquina {
  let worker: Worker | null = null
  let listo: Promise<void> | null = null
  let pedido: Pedido | null = null
  let buscando = false
  let cortada = false

  const enviar = (linea: string) => worker?.postMessage(linea)

  function lanzar() {
    if (!pedido || buscando) return
    const { skill, limite } = BUSQUEDAS[pedido.nivel]
    buscando = true
    enviar(`setoption name Skill Level value ${skill}`)
    enviar(`position fen ${pedido.fen}`)
    enviar(`go ${limite}`)
  }

  function alTerminarBusqueda(notacion: string) {
    buscando = false
    if (cortada) {
      // El bestmove de una búsqueda cortada llega siempre antes de que empiece la siguiente.
      cortada = false
      lanzar()
      return
    }
    const atendido = pedido
    pedido = null
    if (notacion === '(none)') atendido?.rechazar(new Error('El motor respondió sin Jugada'))
    else atendido?.resolver(traducirNotacionLarga(notacion))
  }

  function fallar(error: Error) {
    worker?.terminate()
    worker = null
    listo = null
    buscando = false
    cortada = false
    const atendido = pedido
    pedido = null
    atendido?.rechazar(error)
  }

  function preparar() {
    listo ??= new Promise<void>((resolver, rechazar) => {
      worker = crearWorker()
      worker.onerror = (evento) => {
        // Si el script no llega a cargar, el evento no trae mensaje.
        const error = new Error(evento.message || 'El motor no pudo cargar')
        rechazar(error)
        fallar(error)
      }
      worker.onmessage = ({ data }: MessageEvent<string>) => {
        if (data === 'uciok') enviar('isready')
        else if (data === 'readyok') resolver()
        else if (data.startsWith('bestmove ')) alTerminarBusqueda(data.split(' ')[1])
      }
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
      enviar('stop')
    }
  }

  return {
    preparar,
    cancelar,
    pedirJugada(fen, nivel) {
      return new Promise((resolver, rechazar) => {
        cancelar()
        pedido = { fen, nivel, resolver, rechazar }
        preparar().then(lanzar, rechazar)
      })
    },
  }
}

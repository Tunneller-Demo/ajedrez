// Guardado: serializa con pgn() y restaura con loadPgn(), nunca por FEN, para conservar Historial, Deshacer y triple repetición.
import { Chess } from 'chess.js'
import type { Almacen } from './sesionDePartida'

// Rival, Bando y Nivel solo reservan su lugar hasta que llegue la Máquina.
type Guardado = { pgn: string; rival: 'persona'; bando: null; nivel: null }

const CLAVE_DE_PARTIDA = 'ajedrez-de-gala:partida'
const CLAVE_DE_SILENCIO = 'ajedrez-de-gala:silencio'

export function guardarPartida(almacen: Almacen, chess: Chess) {
  const guardado: Guardado = { pgn: chess.pgn(), rival: 'persona', bando: null, nivel: null }
  try {
    almacen.escribir(CLAVE_DE_PARTIDA, JSON.stringify(guardado))
  } catch {
    // Sin almacén se sigue jugando: solo se pierde el guardado.
  }
}

// loadPgn puede fallar tras aplicar parte de las Jugadas: un guardado dañado cuenta como si no existiera.
export function restaurarPartida(almacen: Almacen) {
  const chess = new Chess()
  try {
    const texto = almacen.leer(CLAVE_DE_PARTIDA)
    if (texto) chess.loadPgn((JSON.parse(texto) as Guardado).pgn)
  } catch {
    chess.reset()
  }
  return chess
}

export function guardarSilencio(almacen: Almacen, silencio: boolean) {
  try {
    almacen.escribir(CLAVE_DE_SILENCIO, String(silencio))
  } catch {
    // Sin almacén el silencio dura lo que la página.
  }
}

export function restaurarSilencio(almacen: Almacen) {
  try {
    return almacen.leer(CLAVE_DE_SILENCIO) === 'true'
  } catch {
    return false
  }
}

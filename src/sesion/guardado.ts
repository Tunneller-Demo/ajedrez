// Guardado: serializa con pgn() y restaura con loadPgn(), nunca por FEN, para conservar Historial, Deshacer y triple repetición.
import { Chess } from 'chess.js'
import type { Almacen } from './sesionDePartida'

const CLAVE_DE_PARTIDA = 'ajedrez-de-gala:partida'

// Rival, Bando y Nivel solo reservan su lugar hasta que llegue la Máquina.
export function guardarPartida(almacen: Almacen, chess: Chess) {
  const guardado = { pgn: chess.pgn(), rival: 'dos-personas', bando: null, nivel: null }
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
    const guardado = almacen.leer(CLAVE_DE_PARTIDA)
    if (guardado) chess.loadPgn(JSON.parse(guardado).pgn)
  } catch {
    chess.reset()
  }
  return chess
}

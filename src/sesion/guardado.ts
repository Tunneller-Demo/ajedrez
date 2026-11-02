// Guardado: serializa con pgn() y restaura con loadPgn(), nunca por FEN, para conservar Historial, Deshacer y triple repetición.
import { Chess } from 'chess.js'
import type { Nivel } from '../maquina/motor'
import type { Almacen, DatosDePartida, Eleccion } from './sesionDePartida'

type Guardado = { pgn: string } & DatosDePartida

const CLAVE_DE_PARTIDA = 'ajedrez-de-gala:partida'
const CLAVE_DE_SILENCIO = 'ajedrez-de-gala:silencio'
const CLAVE_DE_ELECCION = 'ajedrez-de-gala:eleccion'

export const A_DOS: DatosDePartida = { rival: 'persona', bando: null, nivel: null }

const ELECCION_POR_DEFECTO: Eleccion = { rival: 'persona', bando: 'w', nivel: 'medio' }
const RIVALES: Eleccion['rival'][] = ['persona', 'maquina']
const BANDOS: Eleccion['bando'][] = ['w', 'b', 'azar']
const NIVELES: Nivel[] = ['facil', 'medio', 'dificil', 'maximo']

export function guardarPartida(almacen: Almacen, chess: Chess, partida: DatosDePartida) {
  const guardado: Guardado = { pgn: chess.pgn(), ...partida }
  try {
    almacen.escribir(CLAVE_DE_PARTIDA, JSON.stringify(guardado))
  } catch {
    // Sin almacén se sigue jugando: solo se pierde el guardado.
  }
}

// loadPgn puede fallar tras aplicar parte de las Jugadas: un guardado dañado cuenta como si no existiera.
export function restaurarPartida(almacen: Almacen): { chess: Chess; partida: DatosDePartida } | null {
  try {
    const texto = almacen.leer(CLAVE_DE_PARTIDA)
    if (!texto) return null
    const { pgn, rival, bando, nivel } = JSON.parse(texto) as Guardado
    const chess = new Chess()
    chess.loadPgn(pgn)
    if (rival && !RIVALES.includes(rival)) return null
    // Los guardados anteriores a la Máquina no llevan Rival: son Partidas a dos.
    if (rival !== 'maquina') return { chess, partida: A_DOS }
    if ((bando !== 'w' && bando !== 'b') || !NIVELES.includes(nivel)) return null
    return { chess, partida: { rival, bando, nivel } }
  } catch {
    return null
  }
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

export function guardarEleccion(almacen: Almacen, eleccion: Eleccion) {
  try {
    almacen.escribir(CLAVE_DE_ELECCION, JSON.stringify(eleccion))
  } catch {
    // Sin almacén la preselección dura lo que la página.
  }
}

export function restaurarEleccion(almacen: Almacen) {
  try {
    const { rival, bando, nivel } = JSON.parse(almacen.leer(CLAVE_DE_ELECCION) ?? 'null') as Eleccion
    if (RIVALES.includes(rival) && BANDOS.includes(bando) && NIVELES.includes(nivel)) return { rival, bando, nivel }
  } catch {
    // Una preselección ilegible, o que no existe, cuenta como la de por defecto.
  }
  return ELECCION_POR_DEFECTO
}

import type { PieceSymbol } from 'chess.js'
import type { Bando } from './sesion/sesionDePartida'

export const urlDePieza = (bando: Bando, tipo: PieceSymbol) =>
  `${import.meta.env.BASE_URL}piezas/gala/${bando}${tipo.toUpperCase()}.svg`

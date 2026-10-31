// PROTOTIPO: estado de la Partida, compartido por las dos direcciones.
import { useRef, useState } from 'react'
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'

export type Resultado = { titulo: string; detalle: string; ganador?: Color }

export type Escena = {
  nombre: string
  pgn?: string
  fen?: string
  from: Square
  to: Square
}

export const ESCENAS: Escena[] = [
  { nombre: 'Captura', pgn: '1. e4 d5', from: 'e4', to: 'd5' },
  { nombre: 'Jaque', pgn: '1. e4 f5', from: 'd1', to: 'h5' },
  { nombre: 'Coronación', fen: '8/P6k/8/8/8/8/6K1/8 w - - 0 1', from: 'a7', to: 'a8' },
  { nombre: 'Jaque mate', pgn: '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6', from: 'h5', to: 'f7' },
  { nombre: 'Ahogado', fen: 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1', from: 'c1', to: 'c7' },
  { nombre: 'Enroque', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5', from: 'e1', to: 'g1' },
]

function calcularResultado(c: Chess): Resultado | null {
  if (c.isCheckmate()) {
    const ganador: Color = c.turn() === 'w' ? 'b' : 'w'
    return { titulo: 'Jaque mate', detalle: `Ganan las ${ganador === 'w' ? 'blancas' : 'negras'}`, ganador }
  }
  if (c.isStalemate()) return { titulo: 'Ahogado', detalle: 'Tablas: no quedan Jugadas legales' }
  if (c.isThreefoldRepetition()) return { titulo: 'Tablas', detalle: 'Por triple repetición' }
  if (c.isInsufficientMaterial()) return { titulo: 'Tablas', detalle: 'Por material insuficiente' }
  if (c.isDrawByFiftyMoves()) return { titulo: 'Tablas', detalle: 'Por la regla de las 50 jugadas' }
  return null
}

export function useGame() {
  const chess = useRef(new Chess()).current
  const [rev, setRev] = useState(0)
  const [selected, setSelected] = useState<Square | null>(null)
  const [coronando, setCoronando] = useState<{ from: Square; to: Square } | null>(null)
  const bump = () => setRev((r) => r + 1)

  const historial = chess.history({ verbose: true }) as Move[]
  const ultima = historial[historial.length - 1] ?? null
  const turno = chess.turn()
  const jaque = chess.isCheck()
  const resultado = calcularResultado(chess)

  const piezas = chess.board().flat().flatMap((p) => (p ? [{ sq: p.square, type: p.type, color: p.color }] : []))
  const rey = piezas.find((p) => p.type === 'k' && p.color === turno)!.sq
  const atacantes = jaque ? chess.attackers(rey, turno === 'w' ? 'b' : 'w') : []
  const destinos = selected ? (chess.moves({ square: selected, verbose: true }) as Move[]) : []

  const capturadas = { w: [] as PieceSymbol[], b: [] as PieceSymbol[] }
  for (const m of historial) if (m.captured) capturadas[m.color].push(m.captured)

  function jugar(from: Square, to: Square, promotion?: PieceSymbol) {
    chess.move({ from, to, promotion })
    setSelected(null)
    setCoronando(null)
    bump()
  }

  function intentar(from: Square, to: Square) {
    const opciones = (chess.moves({ square: from, verbose: true }) as Move[]).filter((m) => m.to === to)
    if (!opciones.length) return false
    if (opciones[0].isPromotion()) setCoronando({ from, to })
    else jugar(from, to)
    return true
  }

  function tocar(sq: Square) {
    if (coronando || resultado) return
    if (selected && destinos.some((m) => m.to === sq)) return void intentar(selected, sq)
    const pieza = chess.get(sq)
    setSelected(pieza && pieza.color === turno && sq !== selected ? sq : null)
  }

  function coronar(p: PieceSymbol) {
    if (coronando) jugar(coronando.from, coronando.to, p)
  }

  function deshacer() {
    chess.undo()
    setSelected(null)
    setCoronando(null)
    bump()
  }

  function reiniciar() {
    chess.reset()
    setSelected(null)
    setCoronando(null)
    bump()
  }

  function cargar(e: Escena) {
    if (e.pgn) chess.loadPgn(e.pgn)
    else chess.load(e.fen!)
    setSelected(null)
    setCoronando(null)
    bump()
  }

  return {
    rev, piezas, historial, ultima, turno, jaque, rey, atacantes, resultado, capturadas,
    selected, destinos, coronando,
    tocar, coronar, deshacer, reiniciar, cargar, intentar,
  }
}

export type Game = ReturnType<typeof useGame>

const FIGURITAS: Record<string, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞' }
export const conFiguritas = (san: string) => san.replace(/[KQRBN]/g, (l) => FIGURITAS[l])

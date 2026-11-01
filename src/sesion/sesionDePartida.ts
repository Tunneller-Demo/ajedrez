// Sesión de Partida: dueña de la lógica, sin React ni navegador. La interfaz solo envía acciones y lee estado y eventos.
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'

export type Bando = Color
export type Pieza = { casilla: Square; tipo: PieceSymbol; bando: Bando }
export type Destino = { casilla: Square; captura: boolean }
export type Coronacion = { desde: Square; hasta: Square }
export type UltimaJugada = { desde: Square; hasta: Square }

export type Resultado =
  | { tipo: 'jaque-mate'; ganador: Bando }
  | { tipo: 'ahogado' }
  | { tipo: 'tablas'; motivo: '50-jugadas' | 'triple-repeticion' | 'material-insuficiente' }

export type EstadoDePartida = {
  piezas: Pieza[]
  turno: Bando
  jaque: boolean
  seleccion: Square | null
  destinos: Destino[]
  coronacion: Coronacion | null
  ultimaJugada: UltimaJugada | null
  resultado: Resultado | null
  historial: string[]
  capturadas: Record<Bando, PieceSymbol[]>
  girado: boolean
  pantallaFinal: boolean
  eleccion: { aviso: boolean } | null
}

export type EventoDeJugada = {
  bando: Bando
  pieza: PieceSymbol
  desde: Square
  hasta: Square
  san: string
  captura: { pieza: PieceSymbol; casilla: Square } | null
  torre: { desde: Square; hasta: Square } | null
  coronacion: PieceSymbol | null
  jaque: boolean
  resultado: Resultado | null
}

export type Almacen = { leer(clave: string): string | null; escribir(clave: string, valor: string): void }
export type Reloj = { ahora(): number }
export type Dependencias = { almacen: Almacen; reloj: Reloj }

export type SesionDePartida = {
  tocarCasilla(casilla: Square): void
  coronar(pieza: PieceSymbol): void
  deshacer(): void
  girar(): void
  empezar(): void
  verLaPartida(): void
  abrirEleccion(): void
  volverALaPartida(): void
  obtenerEstado(): EstadoDePartida
  suscribir(oyente: () => void): () => void
  alJugar(oyente: (evento: EventoDeJugada) => void): () => void
}

const FIGURITAS: Record<string, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞' }

const conFiguritas = (san: string) => san.replace(/[KQRBN]/g, (letra) => FIGURITAS[letra])

// El jaque mate va primero: en la media jugada 100 también cuenta como tablas.
function calcularResultado(chess: Chess): Resultado | null {
  if (chess.isCheckmate()) return { tipo: 'jaque-mate', ganador: chess.turn() === 'w' ? 'b' : 'w' }
  if (chess.isStalemate()) return { tipo: 'ahogado' }
  if (chess.isInsufficientMaterial()) return { tipo: 'tablas', motivo: 'material-insuficiente' }
  if (chess.isThreefoldRepetition()) return { tipo: 'tablas', motivo: 'triple-repeticion' }
  if (chess.isDrawByFiftyMoves()) return { tipo: 'tablas', motivo: '50-jugadas' }
  return null
}

// `to` no es la casilla del peón capturado al paso: queda en la fila de origen.
function casillaCapturada(jugada: Move) {
  return jugada.isEnPassant() ? (`${jugada.to[0]}${jugada.from[1]}` as Square) : jugada.to
}

function torreDelEnroque(jugada: Move) {
  const fila = jugada.from[1]
  if (jugada.isKingsideCastle()) return { desde: `h${fila}` as Square, hasta: `f${fila}` as Square }
  if (jugada.isQueensideCastle()) return { desde: `a${fila}` as Square, hasta: `d${fila}` as Square }
  return null
}

export function crearSesionDePartida(_dependencias: Dependencias, pgn?: string): SesionDePartida {
  const chess = new Chess()
  if (pgn) chess.loadPgn(pgn)

  const oyentes = new Set<() => void>()
  const oyentesDeJugada = new Set<(evento: EventoDeJugada) => void>()
  let girado = false
  let finalCerrado = false
  let eleccionAbierta = false

  const jugadasDesde = (casilla: Square) => chess.moves({ square: casilla, verbose: true })

  function leerEstado(seleccion: Square | null, coronacion: Coronacion | null): EstadoDePartida {
    const destinos = new Map<Square, Destino>()
    if (seleccion) {
      for (const jugada of jugadasDesde(seleccion)) {
        destinos.set(jugada.to, { casilla: jugada.to, captura: Boolean(jugada.captured) })
      }
    }
    const jugadas = chess.history({ verbose: true })
    const ultima = jugadas[jugadas.length - 1]
    const capturadas: Record<Bando, PieceSymbol[]> = { w: [], b: [] }
    for (const { color, captured } of jugadas) if (captured) capturadas[color].push(captured)
    const resultado = calcularResultado(chess)
    return {
      piezas: chess.board().flat().flatMap((p) => (p ? [{ casilla: p.square, tipo: p.type, bando: p.color }] : [])),
      turno: chess.turn(),
      jaque: chess.isCheck(),
      seleccion,
      destinos: [...destinos.values()],
      coronacion,
      ultimaJugada: ultima ? { desde: ultima.from, hasta: ultima.to } : null,
      resultado,
      historial: jugadas.map(({ san }) => conFiguritas(san)),
      capturadas,
      girado,
      pantallaFinal: Boolean(resultado) && !finalCerrado,
      eleccion: eleccionAbierta ? { aviso: jugadas.length > 0 && !resultado } : null,
    }
  }

  let estado = leerEstado(null, null)

  function publicar(seleccion: Square | null, coronacion: Coronacion | null) {
    estado = leerEstado(seleccion, coronacion)
    oyentes.forEach((oyente) => oyente())
  }

  function jugar({ from, to, promotion }: Move) {
    const jugada = chess.move({ from, to, promotion })
    publicar(null, null)
    const evento: EventoDeJugada = {
      bando: jugada.color,
      pieza: jugada.piece,
      desde: jugada.from,
      hasta: jugada.to,
      san: jugada.san,
      captura: jugada.captured ? { pieza: jugada.captured, casilla: casillaCapturada(jugada) } : null,
      torre: torreDelEnroque(jugada),
      coronacion: jugada.promotion ?? null,
      jaque: estado.jaque,
      resultado: estado.resultado,
    }
    oyentesDeJugada.forEach((oyente) => oyente(evento))
  }

  function tocarCasilla(casilla: Square) {
    if (estado.resultado) return
    if (estado.coronacion) return publicar(null, null)

    const { seleccion } = estado
    const opciones = seleccion ? jugadasDesde(seleccion).filter((jugada) => jugada.to === casilla) : []
    if (seleccion && opciones[0]?.isPromotion()) return publicar(seleccion, { desde: seleccion, hasta: casilla })
    if (opciones[0]) return jugar(opciones[0])

    const nuevaSeleccion = chess.get(casilla)?.color === chess.turn() && casilla !== seleccion ? casilla : null
    if (nuevaSeleccion !== seleccion) publicar(nuevaSeleccion, null)
  }

  function coronar(pieza: PieceSymbol) {
    if (!estado.coronacion) return
    const { desde, hasta } = estado.coronacion
    const jugada = jugadasDesde(desde).find((j) => j.to === hasta && j.promotion === pieza)
    if (jugada) jugar(jugada)
  }

  function deshacer() {
    if (!chess.undo()) return
    finalCerrado = false
    publicar(null, null)
  }

  function girar() {
    girado = !girado
    publicar(estado.seleccion, estado.coronacion)
  }

  function empezar() {
    chess.reset()
    girado = false
    finalCerrado = false
    eleccionAbierta = false
    publicar(null, null)
  }

  function verLaPartida() {
    finalCerrado = true
    publicar(estado.seleccion, estado.coronacion)
  }

  function abrirEleccion() {
    eleccionAbierta = true
    publicar(estado.seleccion, estado.coronacion)
  }

  function volverALaPartida() {
    eleccionAbierta = false
    publicar(estado.seleccion, estado.coronacion)
  }

  return {
    tocarCasilla,
    coronar,
    deshacer,
    girar,
    empezar,
    verLaPartida,
    abrirEleccion,
    volverALaPartida,
    obtenerEstado: () => estado,
    suscribir(oyente) {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },
    alJugar(oyente) {
      oyentesDeJugada.add(oyente)
      return () => oyentesDeJugada.delete(oyente)
    },
  }
}

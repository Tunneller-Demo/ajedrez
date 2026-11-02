// Sesión de Partida: dueña de la lógica, sin React ni navegador. La interfaz solo envía acciones y lee estado y eventos.
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'
import type { MotorDeMaquina, Nivel } from '../maquina/motor'
import {
  A_DOS,
  guardarEleccion,
  guardarPartida,
  guardarSilencio,
  restaurarEleccion,
  restaurarPartida,
  restaurarSilencio,
} from './guardado'

export type Bando = Color
export type Pieza = { casilla: Square; tipo: PieceSymbol; bando: Bando }
export type Destino = { casilla: Square; captura: boolean }
export type Coronacion = { desde: Square; hasta: Square }
export type UltimaJugada = { desde: Square; hasta: Square }

export type Resultado =
  | { tipo: 'jaque-mate'; ganador: Bando }
  | { tipo: 'ahogado' }
  | { tipo: 'tablas'; motivo: '50-jugadas' | 'triple-repeticion' | 'material-insuficiente' }

export type Rival = 'persona' | 'maquina'

// `bando` es el de la persona: la Máquina lleva el contrario.
export type DatosDePartida = { rival: 'persona'; bando: null; nivel: null } | { rival: 'maquina'; bando: Bando; nivel: Nivel }

export type Eleccion = { rival: Rival; bando: Bando | 'azar'; nivel: Nivel }

export type EstadoDePartida = {
  partida: DatosDePartida
  maquinaPiensa: boolean
  maquinaSePrepara: boolean
  falloDeMaquina: boolean
  preseleccion: Eleccion
  piezas: Pieza[]
  turno: Bando
  jaque: boolean
  seleccion: Square | null
  destinos: Destino[]
  coronacion: Coronacion | null
  ultimaJugada: UltimaJugada | null
  resultado: Resultado | null
  historial: string[]
  puedeDeshacer: boolean
  capturadas: Record<Bando, PieceSymbol[]>
  girado: boolean
  pantallaFinal: boolean
  eleccion: { aviso: boolean; volver: boolean } | null
  jugadaEnEscena: EventoDeJugada | null
  silencio: boolean
}

export type Efecto = 'fin' | 'jaque' | 'capturar' | 'mover'

export type Espera = 'prepara' | 'piensa'

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
  rayos: { desde: Square; hasta: Square }[]
  resultado: Resultado | null
  // Sin efecto no suena: la Jugada llegó con la elección de Partida abierta.
  efecto: Efecto | null
  deLaMaquina: boolean
}

export type Almacen = { leer(clave: string): string | null; escribir(clave: string, valor: string): void }
export type Reloj = { esperar(ms: number): Promise<void> }
export type Dependencias = { almacen: Almacen; reloj: Reloj; motor: MotorDeMaquina; azar: () => number }

export type SesionDePartida = {
  tocarCasilla(casilla: Square): void
  coronar(pieza: PieceSymbol): void
  deshacer(): void
  girar(): void
  // Sin elección repite la preselección.
  empezar(eleccion?: Eleccion): void
  prepararMaquina(): void
  reintentar(): void
  seguirADos(): void
  // Tras recuperar una Partida, cuando la interfaz ya escucha. Solo actúa la primera vez.
  reanudar(): void
  verLaPartida(): void
  abrirEleccion(): void
  volverALaPartida(): void
  terminarAnimacion(): void
  alternarSilencio(): void
  obtenerEstado(): EstadoDePartida
  suscribir(oyente: () => void): () => void
  alJugar(oyente: (evento: EventoDeJugada) => void): () => void
  alEsperar(oyente: (espera: Espera) => void): () => void
}

export const bandoContrario = (bando: Bando): Bando => (bando === 'w' ? 'b' : 'w')

// Tiempo mínimo que la Máquina se toma antes de jugar, aunque el motor responda enseguida.
const PAUSA_DE_LA_MAQUINA = 900
// Una espera más corta no se anuncia: el lector de pantalla se saturaría en cada turno.
const ESPERA_ANUNCIADA = 2000

const FIGURITAS: Record<string, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞' }

const conFiguritas = (san: string) => san.replace(/[KQRBN]/g, (letra) => FIGURITAS[letra])

// El jaque mate va primero: en la media jugada 100 también cuenta como tablas.
function calcularResultado(chess: Chess): Resultado | null {
  if (chess.isCheckmate()) return { tipo: 'jaque-mate', ganador: bandoContrario(chess.turn()) }
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

// Se pregunta a la posición y no a la Jugada: en un jaque descubierto ataca otra pieza.
function rayosDelJaque(chess: Chess) {
  if (!chess.isCheck()) return []
  const turno = chess.turn()
  const [rey] = chess.findPiece({ type: 'k', color: turno })
  return chess.attackers(rey, bandoContrario(turno)).map((desde) => ({ desde, hasta: rey }))
}

function efectoDeJugada(resultado: Resultado | null, jaque: boolean, captura: boolean): Efecto {
  if (resultado) return 'fin'
  if (jaque) return 'jaque'
  return captura ? 'capturar' : 'mover'
}

export function crearSesionDePartida({ almacen, reloj, motor, azar }: Dependencias): SesionDePartida {
  const restaurada = restaurarPartida(almacen)
  const chess = restaurada?.chess ?? new Chess()

  const oyentes = new Set<() => void>()
  const oyentesDeJugada = new Set<(evento: EventoDeJugada) => void>()
  const oyentesDeEspera = new Set<(espera: Espera) => void>()
  let hayPartida = restaurada !== null
  let porReanudar = restaurada !== null
  let partida = restaurada?.partida ?? A_DOS
  let preseleccion = restaurarEleccion(almacen)
  let girado = partida.bando === 'b'
  let finalCerrado = false
  let eleccionAbierta = !restaurada
  let jugadaEnEscena: EventoDeJugada | null = null
  let silencio = restaurarSilencio(almacen)
  // Cada pedido al motor lleva su número: una respuesta de un turno ya cortado se descarta.
  let vigencia = 0
  let motorListo = false
  let preparaAnunciada = false
  let falloDeMaquina = false

  const jugadasDesde = (casilla: Square) => chess.moves({ square: casilla, verbose: true })
  const juegaLaMaquina = (bando: Bando) => partida.rival === 'maquina' && bando !== partida.bando
  // Si le toca a la persona, la última Jugada es de la Máquina: hay que retirar también la anterior, la suya.
  const jugadasPorDeshacer = () => (chess.turn() === partida.bando ? 2 : 1)
  const puedeDeshacer = () => chess.history().length >= jugadasPorDeshacer()

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
    const maquinaPiensa = juegaLaMaquina(chess.turn()) && !resultado && !falloDeMaquina
    return {
      partida,
      maquinaPiensa,
      maquinaSePrepara: maquinaPiensa && !motorListo,
      falloDeMaquina,
      preseleccion,
      piezas: chess.board().flat().flatMap((p) => (p ? [{ casilla: p.square, tipo: p.type, bando: p.color }] : [])),
      turno: chess.turn(),
      jaque: chess.isCheck(),
      seleccion,
      destinos: [...destinos.values()],
      coronacion,
      ultimaJugada: ultima ? { desde: ultima.from, hasta: ultima.to } : null,
      resultado,
      historial: jugadas.map(({ san }) => conFiguritas(san)),
      puedeDeshacer: puedeDeshacer(),
      capturadas,
      girado,
      pantallaFinal: Boolean(resultado) && !finalCerrado && !jugadaEnEscena,
      eleccion: eleccionAbierta ? { aviso: jugadas.length > 0 && !resultado, volver: hayPartida } : null,
      jugadaEnEscena,
      silencio,
    }
  }

  let estado = leerEstado(null, null)

  function publicar(seleccion: Square | null, coronacion: Coronacion | null) {
    estado = leerEstado(seleccion, coronacion)
    oyentes.forEach((oyente) => oyente())
  }

  function jugar({ from, to, promotion }: Move) {
    const jugada = chess.move({ from, to, promotion })
    guardarPartida(almacen, chess, partida)
    const jaque = chess.isCheck()
    const resultado = calcularResultado(chess)
    const evento: EventoDeJugada = {
      bando: jugada.color,
      pieza: jugada.piece,
      desde: jugada.from,
      hasta: jugada.to,
      san: jugada.san,
      captura: jugada.captured ? { pieza: jugada.captured, casilla: casillaCapturada(jugada) } : null,
      torre: torreDelEnroque(jugada),
      coronacion: jugada.promotion ?? null,
      jaque,
      rayos: rayosDelJaque(chess),
      resultado,
      efecto: eleccionAbierta ? null : efectoDeJugada(resultado, jaque, Boolean(jugada.captured)),
      deLaMaquina: juegaLaMaquina(jugada.color),
    }
    jugadaEnEscena = evento
    publicar(null, null)
    oyentesDeJugada.forEach((oyente) => oyente(evento))
  }

  function cancelarTurno() {
    vigencia++
    motor.cancelar()
  }

  function avisarEsperas(pedido: number) {
    const avisar = (espera: Espera) => oyentesDeEspera.forEach((oyente) => oyente(espera))
    if (!motorListo && !preparaAnunciada) {
      preparaAnunciada = true
      avisar('prepara')
    }
    reloj.esperar(ESPERA_ANUNCIADA).then(() => {
      if (pedido === vigencia && motorListo) avisar('piensa')
    })
  }

  function avisarDelFallo() {
    // Corta el aviso de espera pendiente: la Máquina ya no piensa.
    vigencia++
    falloDeMaquina = true
    publicar(estado.seleccion, estado.coronacion)
  }

  // El motor puede tardar menos que la pausa, o responder algo que no se pueda jugar: su Jugada se valida aquí.
  function turnoDeLaMaquina() {
    if (partida.rival !== 'maquina' || chess.turn() === partida.bando || calcularResultado(chess)) return
    const pedido = ++vigencia
    prepararMaquina()
    avisarEsperas(pedido)
    Promise.all([motor.pedirJugada(chess.fen(), partida.nivel), reloj.esperar(PAUSA_DE_LA_MAQUINA)])
      .then(([respuesta]) => {
        if (pedido !== vigencia || !respuesta) return
        const { desde, hasta, coronacion } = respuesta
        const legal = jugadasDesde(desde).find((j) => j.to === hasta && (j.promotion ?? null) === coronacion)
        if (!legal) return avisarDelFallo()
        // Corta el aviso de espera pendiente: la Máquina ya no piensa.
        vigencia++
        jugar(legal)
      })
      .catch(() => {
        if (pedido === vigencia) avisarDelFallo()
      })
  }

  function tocarCasilla(casilla: Square) {
    if (estado.resultado || estado.maquinaPiensa || estado.falloDeMaquina) return
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
    if (!puedeDeshacer()) return
    cancelarTurno()
    for (let retiradas = jugadasPorDeshacer(); retiradas > 0; retiradas--) chess.undo()
    guardarPartida(almacen, chess, partida)
    finalCerrado = false
    falloDeMaquina = false
    jugadaEnEscena = null
    publicar(null, null)
  }

  function girar() {
    girado = !girado
    publicar(estado.seleccion, estado.coronacion)
  }

  function sortear({ rival, bando, nivel }: Eleccion): DatosDePartida {
    if (rival === 'persona') return A_DOS
    return { rival, nivel, bando: bando === 'azar' ? (azar() < 0.5 ? 'w' : 'b') : bando }
  }

  function empezar(eleccion = preseleccion) {
    cancelarTurno()
    preseleccion = eleccion
    guardarEleccion(almacen, eleccion)
    partida = sortear(eleccion)
    chess.reset()
    guardarPartida(almacen, chess, partida)
    hayPartida = true
    girado = partida.bando === 'b'
    finalCerrado = false
    falloDeMaquina = false
    eleccionAbierta = false
    jugadaEnEscena = null
    publicar(null, null)
    turnoDeLaMaquina()
  }

  function prepararMaquina() {
    if (motorListo) return
    motor
      .preparar()
      .then(() => {
        motorListo = true
        publicar(estado.seleccion, estado.coronacion)
      })
      .catch(() => {
        // El fallo se ve al pedir la primera Jugada.
      })
  }

  // Publica antes de pedir: si el motor vuelve a fallar al instante, el aviso se monta de nuevo y se oye.
  function reintentar() {
    if (!falloDeMaquina) return
    falloDeMaquina = false
    // Tras el fallo, el Motor puede tener que cargarse de nuevo.
    motorListo = false
    preparaAnunciada = false
    publicar(estado.seleccion, estado.coronacion)
    turnoDeLaMaquina()
  }

  function seguirADos() {
    if (!falloDeMaquina) return
    falloDeMaquina = false
    partida = A_DOS
    guardarPartida(almacen, chess, partida)
    publicar(estado.seleccion, estado.coronacion)
  }

  function reanudar() {
    if (!porReanudar) return
    porReanudar = false
    if (estado.maquinaPiensa) turnoDeLaMaquina()
    else if (partida.rival === 'maquina') prepararMaquina()
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
    if (!hayPartida) return
    eleccionAbierta = false
    publicar(estado.seleccion, estado.coronacion)
  }

  // La Máquina no empieza a pensar hasta que la Jugada de la persona se ha posado.
  function terminarAnimacion() {
    if (!jugadaEnEscena) return
    jugadaEnEscena = null
    publicar(estado.seleccion, estado.coronacion)
    turnoDeLaMaquina()
  }

  function alternarSilencio() {
    silencio = !silencio
    guardarSilencio(almacen, silencio)
    publicar(estado.seleccion, estado.coronacion)
  }

  return {
    tocarCasilla,
    coronar,
    deshacer,
    girar,
    empezar,
    prepararMaquina,
    reintentar,
    seguirADos,
    reanudar,
    verLaPartida,
    abrirEleccion,
    volverALaPartida,
    terminarAnimacion,
    alternarSilencio,
    obtenerEstado: () => estado,
    suscribir(oyente) {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },
    alJugar(oyente) {
      oyentesDeJugada.add(oyente)
      return () => oyentesDeJugada.delete(oyente)
    },
    alEsperar(oyente) {
      oyentesDeEspera.add(oyente)
      return () => oyentesDeEspera.delete(oyente)
    },
  }
}

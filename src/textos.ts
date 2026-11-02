// Lo que la interfaz dice de la Partida, en pantalla y al lector de pantalla.
import type { PieceSymbol, Square } from 'chess.js'
import type { Nivel } from './maquina/motor'
import type { Bando, DatosDePartida, Espera, EventoDeJugada, Pieza, Resultado } from './sesion/sesionDePartida'

const NOMBRES: Record<PieceSymbol, { nombre: string; femenino: boolean }> = {
  k: { nombre: 'rey', femenino: false },
  q: { nombre: 'dama', femenino: true },
  r: { nombre: 'torre', femenino: true },
  b: { nombre: 'alfil', femenino: false },
  n: { nombre: 'caballo', femenino: false },
  p: { nombre: 'peón', femenino: false },
}

const COLUMNAS_HABLADAS: Record<string, string> = {
  a: 'a',
  b: 'be',
  c: 'ce',
  d: 'de',
  e: 'e',
  f: 'efe',
  g: 'ge',
  h: 'hache',
}

const FILAS_HABLADAS = ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho']

const casillaHablada = (casilla: Square) => `${COLUMNAS_HABLADAS[casilla[0]]} ${FILAS_HABLADAS[Number(casilla[1]) - 1]}`

export const nombreDelBando = (bando: Bando) => (bando === 'w' ? 'blancas' : 'negras')

export function nombreDePieza({ tipo, bando }: Omit<Pieza, 'casilla'>) {
  const { nombre, femenino } = NOMBRES[tipo]
  const adjetivo = bando === 'w' ? (femenino ? 'blanca' : 'blanco') : femenino ? 'negra' : 'negro'
  return `${nombre} ${adjetivo}`
}

export function textosDelResultado(resultado: Resultado) {
  if (resultado.tipo === 'jaque-mate') return { titulo: 'Jaque mate', detalle: `ganan las ${nombreDelBando(resultado.ganador)}` }
  if (resultado.tipo === 'ahogado') return { titulo: 'Ahogado', detalle: 'tablas' }
  if (resultado.motivo === '50-jugadas') return { titulo: 'Tablas', detalle: 'por la regla de las 50 jugadas' }
  if (resultado.motivo === 'triple-repeticion') return { titulo: 'Tablas', detalle: 'por triple repetición' }
  return { titulo: 'Tablas', detalle: 'por material insuficiente' }
}

function movimientoHablado({ pieza, hasta, captura, torre, deLaMaquina }: EventoDeJugada) {
  if (torre) return torre.hasta[0] === 'f' ? 'enroque corto' : 'enroque largo'
  if (!captura) return `${NOMBRES[pieza].nombre} a ${casillaHablada(hasta)}`
  const alPaso = captura.casilla === hasta ? '' : ' al paso'
  const verbo = deLaMaquina ? 'y captura' : 'captura'
  return `${NOMBRES[pieza].nombre} ${verbo} ${NOMBRES[captura.pieza].nombre}${alPaso} en ${casillaHablada(hasta)}`
}

function consecuenciaHablada({ jaque, resultado }: EventoDeJugada) {
  if (!resultado) return jaque ? 'jaque' : null
  const { titulo, detalle } = textosDelResultado(resultado)
  const texto = resultado.tipo === 'tablas' ? `${titulo} ${detalle}` : `${titulo}, ${detalle}`
  return texto.toLowerCase()
}

export function textoDeJugada(jugada: EventoDeJugada) {
  const corona = jugada.coronacion && `corona ${NOMBRES[jugada.coronacion].nombre}`
  const texto = [movimientoHablado(jugada), corona, consecuenciaHablada(jugada)].filter(Boolean).join(', ')
  return jugada.deLaMaquina ? `La Máquina juega ${texto}` : texto
}

export const NIVELES: { valor: Nivel; etiqueta: string }[] = [
  { valor: 'facil', etiqueta: 'Fácil' },
  { valor: 'medio', etiqueta: 'Medio' },
  { valor: 'dificil', etiqueta: 'Difícil' },
  { valor: 'maximo', etiqueta: 'Máximo' },
]

export function textoDelRival({ rival, nivel }: DatosDePartida) {
  if (rival === 'persona') return null
  return `Contra la Máquina · ${NIVELES.find(({ valor }) => valor === nivel)?.etiqueta}`
}

export const textoDeDeshacer = (turno: Bando) => `Jugada deshecha, juegan las ${nombreDelBando(turno)}`

export const textoDeEspera = (espera: Espera) => (espera === 'prepara' ? 'La Máquina se prepara' : 'La Máquina piensa')

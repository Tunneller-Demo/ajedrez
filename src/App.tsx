import { useSyncExternalStore } from 'react'
import type { PieceSymbol, Square } from 'chess.js'
import type { Bando, EstadoDePartida, Pieza, SesionDePartida } from './sesion/sesionDePartida'

const COLUMNAS = 'abcdefgh'
const CASILLAS = [8, 7, 6, 5, 4, 3, 2, 1].flatMap((fila) => [...COLUMNAS].map((columna) => `${columna}${fila}` as Square))

// El selector de variación evita que el móvil pinte el peón como emoji.
const FIGURAS: Record<PieceSymbol, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟︎' }

const NOMBRES: Record<PieceSymbol, { nombre: string; femenino: boolean }> = {
  k: { nombre: 'rey', femenino: false },
  q: { nombre: 'dama', femenino: true },
  r: { nombre: 'torre', femenino: true },
  b: { nombre: 'alfil', femenino: false },
  n: { nombre: 'caballo', femenino: false },
  p: { nombre: 'peón', femenino: false },
}

const CORONACIONES: { tipo: PieceSymbol; etiqueta: string }[] = [
  { tipo: 'q', etiqueta: 'Dama' },
  { tipo: 'r', etiqueta: 'Torre' },
  { tipo: 'b', etiqueta: 'Alfil' },
  { tipo: 'n', etiqueta: 'Caballo' },
]

const nombreDelBando = (bando: Bando) => (bando === 'w' ? 'blancas' : 'negras')

function nombreDePieza({ tipo, bando }: Pieza) {
  const { nombre, femenino } = NOMBRES[tipo]
  const adjetivo = bando === 'w' ? (femenino ? 'blanca' : 'blanco') : femenino ? 'negra' : 'negro'
  return `${nombre} ${adjetivo}`
}

function textoDelTurno({ resultado, turno, jaque }: EstadoDePartida) {
  if (!resultado) return `Turno de las ${nombreDelBando(turno)}${jaque ? ' · Jaque' : ''}`
  if (resultado.tipo === 'jaque-mate') return `Jaque mate: ganan las ${nombreDelBando(resultado.ganador)}`
  if (resultado.tipo === 'ahogado') return 'Ahogado: tablas'
  if (resultado.motivo === '50-jugadas') return 'Tablas por la regla de las 50 jugadas'
  if (resultado.motivo === 'triple-repeticion') return 'Tablas por triple repetición'
  return 'Tablas por material insuficiente'
}

function Casilla({ casilla, estado, sesion }: { casilla: Square; estado: EstadoDePartida; sesion: SesionDePartida }) {
  const pieza = estado.piezas.find((p) => p.casilla === casilla)
  const destino = estado.destinos.find((d) => d.casilla === casilla)
  const seleccionada = estado.seleccion === casilla
  const clara = (COLUMNAS.indexOf(casilla[0]) + Number(casilla[1])) % 2 === 1
  const etiqueta = [casilla, pieza && nombreDePieza(pieza), destino && 'casilla válida'].filter(Boolean).join(', ')

  return (
    <button
      aria-label={etiqueta}
      aria-pressed={seleccionada}
      onClick={() => sesion.tocarCasilla(casilla)}
      className={[
        'relative flex aspect-square touch-manipulation items-center justify-center text-[min(9vw,6vh)] leading-none',
        seleccionada ? 'bg-yellow-300' : clara ? 'bg-amber-100' : 'bg-amber-700',
      ].join(' ')}
    >
      {pieza && (
        <span
          aria-hidden
          className={pieza.bando === 'w' ? 'text-white [-webkit-text-stroke:1px_black]' : 'text-stone-950'}
        >
          {FIGURAS[pieza.tipo]}
        </span>
      )}
      {destino && (
        <span
          aria-hidden
          className={
            destino.captura
              ? 'absolute inset-1 rounded-full border-4 border-emerald-600'
              : 'absolute size-1/4 rounded-full bg-emerald-600'
          }
        />
      )}
    </button>
  )
}

export function App({ sesion }: { sesion: SesionDePartida }) {
  const estado = useSyncExternalStore(sesion.suscribir, sesion.obtenerEstado)

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[min(100vw,calc(100svh-9rem))] flex-col gap-2 py-2">
      <h1 className="px-2 text-center text-xl font-semibold">Ajedrez de Gala</h1>
      <p className="px-2 text-center">{textoDelTurno(estado)}</p>
      <div className="grid grid-cols-8">
        {CASILLAS.map((casilla) => (
          <Casilla key={casilla} casilla={casilla} estado={estado} sesion={sesion} />
        ))}
      </div>
      {estado.coronacion && (
        <div role="group" aria-label="Elige la pieza de la Coronación" className="grid grid-cols-4 gap-2 px-2">
          {CORONACIONES.map(({ tipo, etiqueta }) => (
            <button
              key={tipo}
              onClick={() => sesion.coronar(tipo)}
              className="min-h-11 touch-manipulation rounded border border-stone-400 bg-stone-100"
            >
              {etiqueta}
            </button>
          ))}
        </div>
      )}
    </main>
  )
}

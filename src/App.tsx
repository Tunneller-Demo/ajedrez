import { useSyncExternalStore, type CSSProperties } from 'react'
import type { PieceSymbol, Square } from 'chess.js'
import type { Bando, EstadoDePartida, Pieza, SesionDePartida } from './sesion/sesionDePartida'

const COLUMNAS = 'abcdefgh'
const CASILLAS = [8, 7, 6, 5, 4, 3, 2, 1].flatMap((fila) => [...COLUMNAS].map((columna) => `${columna}${fila}` as Square))

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

const urlDePieza = (bando: Bando, tipo: PieceSymbol) =>
  `${import.meta.env.BASE_URL}piezas/gala/${bando}${tipo.toUpperCase()}.svg`

function nombreDePieza({ tipo, bando }: Pieza) {
  const { nombre, femenino } = NOMBRES[tipo]
  const adjetivo = bando === 'w' ? (femenino ? 'blanca' : 'blanco') : femenino ? 'negra' : 'negro'
  return `${nombre} ${adjetivo}`
}

function textoDelTurno({ resultado, turno, jaque }: EstadoDePartida) {
  if (!resultado) {
    return (
      <>
        Turno de las {nombreDelBando(turno)}
        {jaque && <em className="text-peligro"> · Jaque</em>}
      </>
    )
  }
  if (resultado.tipo === 'jaque-mate') return `Jaque mate: ganan las ${nombreDelBando(resultado.ganador)}`
  if (resultado.tipo === 'ahogado') return 'Ahogado: tablas'
  if (resultado.motivo === '50-jugadas') return 'Tablas por la regla de las 50 jugadas'
  if (resultado.motivo === 'triple-repeticion') return 'Tablas por triple repetición'
  return 'Tablas por material insuficiente'
}

const COORDENADA = 'absolute font-cinzel text-[clamp(9px,1.6vmin,13px)] leading-none text-oro'

function Casilla({ casilla, estado, sesion }: { casilla: Square; estado: EstadoDePartida; sesion: SesionDePartida }) {
  const pieza = estado.piezas.find((p) => p.casilla === casilla)
  const destino = estado.destinos.find((d) => d.casilla === casilla)
  const seleccionada = estado.seleccion === casilla
  const ultima = casilla === estado.ultimaJugada?.desde || casilla === estado.ultimaJugada?.hasta
  // a1 es oscura: la suma de columna (desde 0) y fila es impar en las oscuras.
  const clara = (COLUMNAS.indexOf(casilla[0]) + Number(casilla[1])) % 2 === 0
  const etiqueta = [casilla, pieza && nombreDePieza(pieza), destino && 'casilla válida'].filter(Boolean).join(', ')

  return (
    <button
      aria-label={etiqueta}
      aria-pressed={seleccionada}
      aria-describedby={ultima ? 'ultima-jugada' : undefined}
      onClick={() => sesion.tocarCasilla(casilla)}
      className={[
        'relative aspect-square touch-manipulation bg-linear-135',
        clara ? 'from-violeta to-violeta-hondo' : 'from-ebano to-ebano-hondo',
      ].join(' ')}
    >
      {(seleccionada || ultima) && (
        <span
          aria-hidden
          className={`absolute inset-0 ring-1 ring-oro/55 ring-inset ${seleccionada ? 'bg-oro/40' : 'bg-oro/20'}`}
        />
      )}
      {pieza && (
        <img
          src={urlDePieza(pieza.bando, pieza.tipo)}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full select-none"
        />
      )}
      {casilla[0] === 'a' && <span aria-hidden className={`${COORDENADA} top-[4%] left-[5%]`}>{casilla[1]}</span>}
      {casilla[1] === '1' && <span aria-hidden className={`${COORDENADA} right-[6%] bottom-[4%]`}>{casilla[0]}</span>}
      {destino && (
        <span
          aria-hidden
          className={
            destino.captura
              ? 'absolute inset-[15%] z-[1] rotate-45 border border-peligro shadow-[0_0_14px_var(--color-peligro),inset_0_0_14px_var(--color-peligro)]'
              : 'absolute inset-[41%] rotate-45 bg-oro shadow-[0_0_12px_var(--color-oro)]'
          }
        />
      )}
    </button>
  )
}

export function App({ sesion }: { sesion: SesionDePartida }) {
  const estado = useSyncExternalStore(sesion.suscribir, sesion.obtenerEstado)

  return (
    <>
      <div aria-hidden className="foco" style={{ '--foco-y': estado.turno === 'w' ? '82%' : '18%' } as CSSProperties} />
      <main className="relative mx-auto flex min-h-svh w-full max-w-[min(100vw,calc(100svh-9rem))] flex-col gap-2 py-2">
        <h1 className="px-2 text-center font-cinzel text-sm font-medium tracking-[0.5em] text-oro uppercase">
          Ajedrez de Gala
        </h1>
        <p className="px-2 text-center text-3xl leading-tight italic">{textoDelTurno(estado)}</p>
        <span id="ultima-jugada" hidden>
          Última Jugada
        </span>
        <div className="relative grid grid-cols-8 shadow-[0_0_70px_rgb(0_0_0/0.8)] ring-1 ring-oro/65">
          {CASILLAS.map((casilla) => (
            <Casilla key={casilla} casilla={casilla} estado={estado} sesion={sesion} />
          ))}
          {estado.coronacion && (
            <div
              role="group"
              aria-label="Elige la pieza de la Coronación"
              className="absolute inset-x-0 inset-y-[37.5%] z-10 flex justify-center border-y border-oro bg-noche/95"
            >
              {CORONACIONES.map(({ tipo, etiqueta }) => (
                <button
                  key={tipo}
                  aria-label={etiqueta}
                  onClick={() => sesion.coronar(tipo)}
                  className="aspect-square h-full cursor-pointer touch-manipulation"
                >
                  <img src={urlDePieza(estado.turno, tipo)} alt="" className="size-full" />
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}

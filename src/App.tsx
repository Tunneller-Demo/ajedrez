import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react'
import type { PieceSymbol, Square } from 'chess.js'
import type { Bando, EstadoDePartida, Pieza, SesionDePartida } from './sesion/sesionDePartida'

const COLUMNAS = 'abcdefgh'
const CASILLAS = [8, 7, 6, 5, 4, 3, 2, 1].flatMap((fila) => [...COLUMNAS].map((columna) => `${columna}${fila}` as Square))
const CASILLAS_GIRADAS = [...CASILLAS].reverse()

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

function nombreDePieza({ tipo, bando }: Omit<Pieza, 'casilla'>) {
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
      {casilla[0] === (estado.girado ? 'h' : 'a') && (
        <span aria-hidden className={`${COORDENADA} top-[4%] left-[5%]`}>{casilla[1]}</span>
      )}
      {casilla[1] === (estado.girado ? '8' : '1') && (
        <span aria-hidden className={`${COORDENADA} right-[6%] bottom-[4%]`}>{casilla[0]}</span>
      )}
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

function Capturadas({ bando, estado }: { bando: Bando; estado: EstadoDePartida }) {
  const rival = bando === 'w' ? 'b' : 'w'

  return (
    <ul
      aria-label={`Capturadas por las ${nombreDelBando(bando)}`}
      className="flex h-(--franja) items-center px-2"
    >
      {estado.capturadas[bando].map((tipo, indice) => (
        <li key={indice} className="-mr-[0.4rem] shrink-0">
          <img src={urlDePieza(rival, tipo)} alt={nombreDePieza({ tipo, bando: rival })} className="size-(--franja)" />
        </li>
      ))}
    </ul>
  )
}

function Historial({ historial }: { historial: string[] }) {
  const lista = useRef<HTMLOListElement>(null)
  const pares = Array.from({ length: Math.ceil(historial.length / 2) }, (_, i) => historial.slice(i * 2, i * 2 + 2))

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, left: lista.current.scrollWidth })
  }, [historial.length])

  return (
    <ol
      ref={lista}
      aria-label="Historial"
      tabIndex={0}
      className="flex min-h-8 w-full gap-3.5 overflow-x-auto px-3 py-0.5 text-lg whitespace-nowrap [grid-area:historial] lateral:block lateral:overflow-x-hidden lateral:overflow-y-auto lateral:px-0 lateral:text-xl lateral:whitespace-normal compacta:text-lg"
    >
      {pares.map(([blancas, negras], indice) => (
        <li
          key={indice}
          className="flex gap-1.5 lateral:grid lateral:grid-cols-[2.1rem_1fr_1fr] lateral:gap-0 lateral:border-b lateral:border-oro/15 lateral:py-0.5"
        >
          <span className="text-oro">{indice + 1}</span>
          <span>{blancas}</span>
          <span>{negras}</span>
        </li>
      ))}
    </ol>
  )
}

const ACCION =
  'h-11 flex-auto cursor-pointer touch-manipulation px-1 font-cinzel text-xs leading-tight tracking-[0.14em] text-oro uppercase enabled:hover:text-marfil disabled:cursor-default disabled:opacity-40 lateral:h-9 compacta:h-11'

export function App({ sesion }: { sesion: SesionDePartida }) {
  const estado = useSyncExternalStore(sesion.suscribir, sesion.obtenerEstado)
  const [arriba, abajo]: Bando[] = estado.girado ? ['w', 'b'] : ['b', 'w']
  const luzAbajo = estado.turno === abajo

  return (
    <>
      <div aria-hidden className="foco" style={{ '--foco-y': luzAbajo ? '82%' : '18%' } as CSSProperties} />
      <main className="pantalla">
        <h1 className="text-center font-cinzel text-sm font-medium tracking-[0.5em] text-oro uppercase [grid-area:titulo] lateral:text-left compacta:sr-only">
          Ajedrez de Gala
        </h1>
        <p className="px-2 text-center text-3xl leading-tight italic [grid-area:turno] lateral:border-b lateral:border-oro/40 lateral:px-0 lateral:pb-4 lateral:text-left lateral:text-5xl compacta:pb-1 compacta:text-2xl">
          {textoDelTurno(estado)}
        </p>
        <span id="ultima-jugada" hidden>
          Última Jugada
        </span>
        <div className="mx-auto w-(--lado) [grid-area:escena]">
          <Capturadas bando={arriba} estado={estado} />
          <div className="relative grid grid-cols-8 shadow-[0_0_70px_rgb(0_0_0/0.8)] ring-1 ring-oro/65">
            {(estado.girado ? CASILLAS_GIRADAS : CASILLAS).map((casilla) => (
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
          <Capturadas bando={abajo} estado={estado} />
        </div>
        <Historial historial={estado.historial} />
        <div className="flex w-full gap-1 px-1 [grid-area:acciones] lateral:px-0">
          <button onClick={sesion.deshacer} disabled={!estado.historial.length} className={ACCION}>
            Deshacer
          </button>
          <button onClick={sesion.girar} className={ACCION}>
            Girar
          </button>
          <button disabled className={ACCION}>
            Nueva partida
          </button>
        </div>
      </main>
    </>
  )
}

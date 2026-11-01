import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import type { PieceSymbol, Square } from 'chess.js'
import { EscenaDeJugada } from './EscenaDeJugada'
import { urlDePieza } from './piezas'
import {
  bandoContrario,
  type Bando,
  type EstadoDePartida,
  type Pieza,
  type Resultado,
  type SesionDePartida,
} from './sesion/sesionDePartida'

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

function nombreDePieza({ tipo, bando }: Omit<Pieza, 'casilla'>) {
  const { nombre, femenino } = NOMBRES[tipo]
  const adjetivo = bando === 'w' ? (femenino ? 'blanca' : 'blanco') : femenino ? 'negra' : 'negro'
  return `${nombre} ${adjetivo}`
}

function textosDelResultado(resultado: Resultado) {
  if (resultado.tipo === 'jaque-mate') return { titulo: 'Jaque mate', detalle: `ganan las ${nombreDelBando(resultado.ganador)}` }
  if (resultado.tipo === 'ahogado') return { titulo: 'Ahogado', detalle: 'tablas' }
  if (resultado.motivo === '50-jugadas') return { titulo: 'Tablas', detalle: 'por la regla de las 50 jugadas' }
  if (resultado.motivo === 'triple-repeticion') return { titulo: 'Tablas', detalle: 'por triple repetición' }
  return { titulo: 'Tablas', detalle: 'por material insuficiente' }
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
  const { titulo, detalle } = textosDelResultado(resultado)
  return resultado.tipo === 'tablas' ? `${titulo} ${detalle}` : `${titulo}: ${detalle}`
}

const COORDENADA = 'absolute font-cinzel text-[clamp(9px,1.6vmin,13px)] leading-none text-oro'

function Casilla({ casilla, estado, sesion }: { casilla: Square; estado: EstadoDePartida; sesion: SesionDePartida }) {
  const pieza = estado.piezas.find((p) => p.casilla === casilla)
  const destino = estado.destinos.find((d) => d.casilla === casilla)
  const seleccionada = estado.seleccion === casilla
  const ultima = casilla === estado.ultimaJugada?.desde || casilla === estado.ultimaJugada?.hasta
  const enVuelo = casilla === estado.jugadaEnEscena?.hasta || casilla === estado.jugadaEnEscena?.torre?.hasta
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
          className={`absolute inset-0 size-full select-none ${enVuelo ? 'invisible' : ''}`}
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
  const rival = bandoContrario(bando)

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

// Va al final del DOM de cada pantalla, para no robar el foco inicial de las capas.
function BotonDeSilencio({ sesion }: { sesion: SesionDePartida }) {
  const { silencio } = useSyncExternalStore(sesion.suscribir, sesion.obtenerEstado)

  return (
    <button
      aria-label="Silencio"
      aria-pressed={silencio}
      onClick={sesion.alternarSilencio}
      className="fixed top-0.5 right-0.5 z-20 grid size-11 cursor-pointer touch-manipulation place-items-center text-oro hover:text-marfil"
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6">
        <path d="M3 9.5v5h3.5l5 4v-13l-5 4z" fill="currentColor" />
        <path d={silencio ? 'm15.5 9.5 5 5m0-5-5 5' : 'M15 9a4.2 4.2 0 0 1 0 6m3-9a8.5 8.5 0 0 1 0 12'} />
      </svg>
    </button>
  )
}

// El efecto de diseño cierra el dialog antes de desmontarlo, para que el foco vuelva a donde estaba.
function Capa({
  titulo,
  alCancelar,
  clase = '',
  children,
}: {
  titulo: string
  alCancelar: () => void
  clase?: string
  children: ReactNode
}) {
  const dialogo = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const abierto = dialogo.current
    abierto?.showModal()
    return () => abierto?.close()
  }, [])

  return (
    <dialog ref={dialogo} aria-label={titulo} onCancel={alCancelar} className={`capa ${clase}`}>
      {children}
    </dialog>
  )
}

const TITULO_DE_CAPA = 'text-5xl leading-none text-marfil italic lateral:text-7xl compacta:text-5xl'
const ACCIONES_DE_CAPA = 'mt-4 flex w-full max-w-md flex-wrap justify-center gap-x-6 gap-y-1 px-4'

function PantallaFinal({ resultado, sesion }: { resultado: Resultado; sesion: SesionDePartida }) {
  const { titulo, detalle } = textosDelResultado(resultado)
  const mate = resultado.tipo === 'jaque-mate'

  return (
    <Capa titulo={titulo} alCancelar={sesion.verLaPartida} clase={mate ? 'escena-de-mate' : ''}>
      {mate && <img src={urlDePieza(resultado.ganador, 'k')} alt="" className="rey-vencedor" />}
      <h2 className={TITULO_DE_CAPA}>{titulo}</h2>
      <p className="mt-2 font-cinzel text-sm tracking-[0.3em] text-oro uppercase">{detalle}</p>
      <div className={ACCIONES_DE_CAPA}>
        <button onClick={sesion.empezar} className={ACCION}>
          Jugar otra vez
        </button>
        <button onClick={sesion.verLaPartida} className={ACCION}>
          Ver la partida
        </button>
        <button onClick={sesion.deshacer} className={ACCION}>
          Deshacer
        </button>
      </div>
      <BotonDeSilencio sesion={sesion} />
    </Capa>
  )
}

function EleccionDePartida({ aviso, sesion }: { aviso: boolean; sesion: SesionDePartida }) {
  return (
    <Capa titulo="Nueva partida" alCancelar={sesion.volverALaPartida}>
      <h2 className={TITULO_DE_CAPA}>Nueva partida</h2>
      {aviso && <p className="mt-3 text-2xl italic">La partida en curso se perderá</p>}
      <div className={ACCIONES_DE_CAPA}>
        <button onClick={sesion.empezar} className={ACCION}>
          Empezar
        </button>
        <button onClick={sesion.volverALaPartida} className={ACCION}>
          Volver a la partida
        </button>
      </div>
      <BotonDeSilencio sesion={sesion} />
    </Capa>
  )
}

export function App({ sesion }: { sesion: SesionDePartida }) {
  const estado = useSyncExternalStore(sesion.suscribir, sesion.obtenerEstado)
  const [arriba, abajo]: Bando[] = estado.girado ? ['w', 'b'] : ['b', 'w']
  const luzAbajo = estado.turno === abajo

  return (
    <>
      <div
        aria-hidden
        className={`foco ${estado.jaque ? 'foco-en-jaque' : ''}`}
        style={{ '--foco-y': luzAbajo ? '82%' : '18%' } as CSSProperties}
      />
      <main className="pantalla">
        <h1 className="text-center font-cinzel text-sm font-medium tracking-[0.5em] text-oro uppercase [grid-area:titulo] lateral:text-left compacta:sr-only">
          Ajedrez de Gala
        </h1>
        <p className="px-2 text-center text-3xl leading-tight italic [grid-area:turno] lateral:border-b lateral:border-oro/40 lateral:px-0 lateral:pb-4 lateral:text-left lateral:text-5xl compacta:pr-12 compacta:pb-1 compacta:text-2xl">
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
            {estado.jugadaEnEscena && (
              <EscenaDeJugada
                key={estado.historial.length}
                jugada={estado.jugadaEnEscena}
                girado={estado.girado}
                sesion={sesion}
              />
            )}
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
          <button onClick={sesion.abrirEleccion} className={ACCION}>
            Nueva partida
          </button>
        </div>
        <BotonDeSilencio sesion={sesion} />
      </main>
      {estado.eleccion ? (
        <EleccionDePartida aviso={estado.eleccion.aviso} sesion={sesion} />
      ) : (
        estado.pantallaFinal && estado.resultado && <PantallaFinal resultado={estado.resultado} sesion={sesion} />
      )}
    </>
  )
}

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react'
import { flushSync } from 'react-dom'
import type { PieceSymbol, Square } from 'chess.js'
import { EscenaDeJugada } from './EscenaDeJugada'
import { urlDePieza } from './piezas'
import {
  bandoContrario,
  type Bando,
  type Eleccion,
  type EstadoDePartida,
  type Resultado,
  type SesionDePartida,
} from './sesion/sesionDePartida'
import {
  NIVELES,
  nombreDePieza,
  nombreDelBando,
  textoDeDeshacer,
  textoDeEspera,
  textoDeJugada,
  textoDelRival,
  textosDelResultado,
} from './textos'

const COLUMNAS = 'abcdefgh'
const CASILLAS = [8, 7, 6, 5, 4, 3, 2, 1].flatMap((fila) => [...COLUMNAS].map((columna) => `${columna}${fila}` as Square))
const CASILLAS_GIRADAS = [...CASILLAS].reverse()

const CORONACIONES: { tipo: PieceSymbol; etiqueta: string }[] = [
  { tipo: 'q', etiqueta: 'Dama' },
  { tipo: 'r', etiqueta: 'Torre' },
  { tipo: 'b', etiqueta: 'Alfil' },
  { tipo: 'n', etiqueta: 'Caballo' },
]

const BANDOS: { valor: Eleccion['bando']; etiqueta: string }[] = [
  { valor: 'w', etiqueta: 'Blancas' },
  { valor: 'b', etiqueta: 'Negras' },
  { valor: 'azar', etiqueta: 'Al azar' },
]

// Filas y columnas de pantalla: el DOM sigue el orden visual, también con el tablero girado.
const PASOS: Record<string, [fila: number, columna: number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

function textoDelTurno({ resultado, turno, jaque, maquinaPiensa, maquinaSePrepara }: EstadoDePartida) {
  if (!resultado) {
    return (
      <>
        {maquinaPiensa
          ? `${textoDeEspera(maquinaSePrepara ? 'prepara' : 'piensa')}…`
          : `Turno de las ${nombreDelBando(turno)}`}
        {jaque && <em className="text-peligro"> · Jaque</em>}
      </>
    )
  }
  const { titulo, detalle } = textosDelResultado(resultado)
  return resultado.tipo === 'tablas' ? `${titulo} ${detalle}` : `${titulo}: ${detalle}`
}

// La placa mantiene el contraste en las casillas resaltadas y cuando la coordenada cae sobre una pieza.
// Los 3px mínimos del borde la dejan fuera del contorno de foco, que se pinta encima.
const COORDENADA =
  'pointer-events-none absolute bg-noche/75 px-px font-cinzel text-[clamp(9px,1.6vmin,13px)] leading-none text-oro'

function Casilla({
  casilla,
  activa,
  estado,
  sesion,
}: {
  casilla: Square
  activa: boolean
  estado: EstadoDePartida
  sesion: SesionDePartida
}) {
  const pieza = estado.piezas.find((p) => p.casilla === casilla)
  const destino = estado.destinos.find((d) => d.casilla === casilla)
  const seleccionada = estado.seleccion === casilla
  const ultima = casilla === estado.ultimaJugada?.desde || casilla === estado.ultimaJugada?.hasta
  const enVuelo = casilla === estado.jugadaEnEscena?.hasta || casilla === estado.jugadaEnEscena?.torre?.hasta
  const deLaMaquina =
    casilla === estado.ultimaJugada?.hasta && estado.partida.rival === 'maquina' && pieza?.bando !== estado.partida.bando
  // a1 es oscura: la suma de columna (desde 0) y fila es impar en las oscuras.
  const clara = (COLUMNAS.indexOf(casilla[0]) + Number(casilla[1])) % 2 === 0
  const etiqueta = [casilla, pieza && nombreDePieza(pieza), destino && 'casilla válida'].filter(Boolean).join(', ')

  return (
    <div className="relative aspect-square">
      <button
        data-casilla={casilla}
        tabIndex={activa ? 0 : -1}
        aria-label={etiqueta}
        aria-pressed={seleccionada}
        aria-describedby={ultima ? 'ultima-jugada' : undefined}
        onClick={() => sesion.tocarCasilla(casilla)}
        className={[
          'relative block size-full touch-manipulation bg-linear-135 focus-visible:-outline-offset-2',
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
            className={`absolute inset-0 size-full select-none ${enVuelo ? 'invisible' : ''} ${deLaMaquina ? 'pieza-de-la-maquina' : ''}`}
          />
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
      {/* Fuera del botón: rotulan la fila y la columna, y el nombre de la casilla ya las dice. */}
      {casilla[1] === (estado.girado ? '8' : '1') && (
        <span aria-hidden className={`${COORDENADA} right-[max(6%,3px)] bottom-[max(4%,3px)]`}>{casilla[0]}</span>
      )}
      {casilla[0] === (estado.girado ? 'h' : 'a') && (
        <span aria-hidden className={`${COORDENADA} top-[max(4%,3px)] left-[max(5%,3px)]`}>{casilla[1]}</span>
      )}
    </div>
  )
}

function EleccionDeCoronacion({ bando, sesion }: { bando: Bando; sesion: SesionDePartida }) {
  function alPulsarTecla(evento: KeyboardEvent<HTMLDivElement>) {
    // Tocar cualquier casilla cancela la Coronación pendiente.
    if (evento.key === 'Escape') return sesion.tocarCasilla('a1')
    const paso = PASOS[evento.key]
    if (!paso || evento.altKey || evento.ctrlKey || evento.metaKey) return
    evento.preventDefault()
    const piezas = [...evento.currentTarget.querySelectorAll('button')]
    const indice = piezas.indexOf(evento.target as HTMLButtonElement)
    piezas[(indice + paso[1] + piezas.length) % piezas.length].focus()
  }

  return (
    <div
      role="group"
      aria-label="Elige la pieza de la Coronación"
      onKeyDown={alPulsarTecla}
      className="absolute inset-x-0 inset-y-[37.5%] z-10 flex justify-center border-y border-oro bg-noche/95"
    >
      {CORONACIONES.map(({ tipo, etiqueta }, indice) => (
        <button
          key={tipo}
          autoFocus={indice === 0}
          aria-label={etiqueta}
          onClick={() => sesion.coronar(tipo)}
          className="aspect-square h-full cursor-pointer touch-manipulation focus-visible:-outline-offset-2"
        >
          <img src={urlDePieza(bando, tipo)} alt="" className="size-full" />
        </button>
      ))}
    </div>
  )
}

function Tablero({
  estado,
  capaAbierta,
  sesion,
}: {
  estado: EstadoDePartida
  capaAbierta: boolean
  sesion: SesionDePartida
}) {
  const [activa, setActiva] = useState<Square>('e2')
  const tablero = useRef<HTMLDivElement>(null)
  const tapado = capaAbierta || Boolean(estado.coronacion)
  const tapadoAntes = useRef(tapado)

  // Lo que se cierra sin un foco al que volver (la Coronación, una capa tras recargar) lo deja en el tablero.
  useEffect(() => {
    if (tapadoAntes.current && !tapado && document.activeElement === document.body) {
      tablero.current?.querySelector<HTMLElement>('[data-casilla][tabindex="0"]')?.focus()
    }
    tapadoAntes.current = tapado
  }, [tapado])

  function alPulsarTecla(evento: KeyboardEvent<HTMLDivElement>) {
    const paso = PASOS[evento.key]
    const casillas = [...evento.currentTarget.querySelectorAll<HTMLElement>('[data-casilla]')]
    const indice = casillas.indexOf(evento.target as HTMLElement)
    if (!paso || indice < 0 || evento.altKey || evento.ctrlKey || evento.metaKey) return
    evento.preventDefault()
    const fila = Math.floor(indice / 8) + paso[0]
    const columna = (indice % 8) + paso[1]
    if (fila >= 0 && fila < 8 && columna >= 0 && columna < 8) casillas[fila * 8 + columna].focus()
  }

  function alEnfocar({ target }: FocusEvent<HTMLDivElement>) {
    if (target.dataset.casilla) setActiva(target.dataset.casilla as Square)
  }

  return (
    <div
      ref={tablero}
      role="group"
      aria-label="Tablero"
      aria-describedby="ayuda-del-tablero"
      onKeyDown={alPulsarTecla}
      onFocus={alEnfocar}
      className="relative grid grid-cols-8 shadow-[0_0_70px_rgb(0_0_0/0.8)] ring-1 ring-oro/65"
    >
      {/* Durante la Coronación ninguna casilla entra en el orden de Tab: quedan tapadas por la elección. */}
      {(estado.girado ? CASILLAS_GIRADAS : CASILLAS).map((casilla) => (
        <Casilla
          key={casilla}
          casilla={casilla}
          activa={!estado.coronacion && casilla === activa}
          estado={estado}
          sesion={sesion}
        />
      ))}
      {estado.jugadaEnEscena && (
        <EscenaDeJugada
          key={estado.historial.length}
          jugada={estado.jugadaEnEscena}
          girado={estado.girado}
          sesion={sesion}
        />
      )}
      {estado.coronacion && <EleccionDeCoronacion bando={estado.turno} sesion={sesion} />}
    </div>
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
  'h-11 flex-auto cursor-pointer touch-manipulation px-1 font-cinzel text-xs leading-tight tracking-[0.14em] text-oro uppercase not-aria-disabled:hover:text-marfil aria-disabled:cursor-default aria-disabled:text-oro-apagado lateral:h-9 compacta:h-11'

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
// Escape se atiende en su tecla porque el navegador puede cerrar el dialog sin avisar con `cancel`,
// y siempre se evita el cierre nativo: la elección de Partida no se puede cerrar sin Partida detrás.
function Capa({
  titulo,
  descripcion,
  alCancelar,
  clase = '',
  children,
}: {
  titulo: string
  descripcion?: string
  alCancelar: () => void
  clase?: string
  children: ReactNode
}) {
  const dialogo = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const abierto = dialogo.current
    abierto?.showModal()
    abierto?.querySelector<HTMLElement>('[data-inicial]')?.focus()
    return () => abierto?.close()
  }, [])

  function cancelar(evento: SyntheticEvent) {
    evento.preventDefault()
    alCancelar()
  }

  return (
    <dialog
      ref={dialogo}
      aria-label={titulo}
      aria-describedby={descripcion}
      onCancel={cancelar}
      onKeyDown={(evento) => evento.key === 'Escape' && cancelar(evento)}
      className={`capa ${clase}`}
    >
      {children}
    </dialog>
  )
}

const TITULO_DE_CAPA = 'text-5xl leading-none text-marfil italic lateral:text-7xl compacta:text-5xl'
const ACCIONES_DE_CAPA = 'mt-4 flex w-full max-w-md flex-wrap justify-center gap-x-6 gap-y-1 px-4'
const ACCION_DE_RIVAL = `${ACCION} underline-offset-4 aria-[current=true]:underline`

function PantallaFinal({
  resultado,
  deshacer,
  sesion,
}: {
  resultado: Resultado
  deshacer: () => void
  sesion: SesionDePartida
}) {
  const { titulo, detalle } = textosDelResultado(resultado)
  const mate = resultado.tipo === 'jaque-mate'

  return (
    <Capa
      titulo={titulo}
      descripcion="detalle-del-resultado"
      alCancelar={sesion.verLaPartida}
      clase={mate ? 'escena-de-mate' : ''}
    >
      {mate && <img src={urlDePieza(resultado.ganador, 'k')} alt="" className="rey-vencedor" />}
      <h2 className={TITULO_DE_CAPA}>{titulo}</h2>
      <p id="detalle-del-resultado" className="mt-2 font-cinzel text-sm tracking-[0.3em] text-oro uppercase">
        {detalle}
      </p>
      <div className={ACCIONES_DE_CAPA}>
        <button onClick={() => sesion.empezar()} className={ACCION}>
          Jugar otra vez
        </button>
        <button onClick={sesion.abrirEleccion} className={ACCION}>
          Elegir otra partida
        </button>
        <button onClick={sesion.verLaPartida} className={ACCION}>
          Ver la partida
        </button>
        <button onClick={deshacer} className={ACCION}>
          Deshacer
        </button>
      </div>
      <BotonDeSilencio sesion={sesion} />
    </Capa>
  )
}

function Opciones<Valor extends string>({
  titulo,
  opciones,
  valor,
  alCambiar,
}: {
  titulo: string
  opciones: { valor: Valor; etiqueta: string }[]
  valor: Valor
  alCambiar: (valor: Valor) => void
}) {
  return (
    <fieldset className="mt-2 flex max-w-md flex-wrap justify-center gap-x-5 px-4">
      <legend className="mx-auto font-cinzel text-xs tracking-[0.14em] text-oro uppercase">{titulo}</legend>
      {opciones.map((opcion) => (
        <label key={opcion.valor} className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-2 text-xl">
          <input
            type="radio"
            name={titulo}
            checked={opcion.valor === valor}
            onChange={() => alCambiar(opcion.valor)}
            className="size-6 accent-oro [color-scheme:dark]"
          />
          <span>{opcion.etiqueta}</span>
        </label>
      ))}
    </fieldset>
  )
}

function EleccionDePartida({
  eleccion,
  preseleccion,
  empezar,
  sesion,
  regionDeAnuncios,
}: {
  eleccion: NonNullable<EstadoDePartida['eleccion']>
  preseleccion: Eleccion
  empezar: (eleccion: Eleccion) => void
  sesion: SesionDePartida
  regionDeAnuncios: ReactNode
}) {
  const [paso, setPaso] = useState<'rival' | 'maquina'>('rival')
  const [rival, setRival] = useState(preseleccion.rival)
  const [bando, setBando] = useState(preseleccion.bando)
  const [nivel, setNivel] = useState(preseleccion.nivel)

  function irAlPaso(siguiente: typeof paso) {
    flushSync(() => setPaso(siguiente))
    document.querySelector<HTMLElement>('dialog [data-inicial]')?.focus()
  }

  function contraLaMaquina() {
    sesion.prepararMaquina()
    setRival('maquina')
    irAlPaso('maquina')
  }

  return (
    <Capa
      titulo="Nueva partida"
      alCancelar={paso === 'maquina' ? () => irAlPaso('rival') : sesion.volverALaPartida}
      clase="capa-eleccion"
    >
      <h2 className={TITULO_DE_CAPA}>Nueva partida</h2>
      {eleccion.aviso && <p className="mt-3 text-2xl italic">La partida en curso se perderá</p>}
      {paso === 'rival' ? (
        <div className={ACCIONES_DE_CAPA}>
          <button
            data-inicial={rival === 'persona' || undefined}
            aria-current={rival === 'persona'}
            onClick={() => empezar({ rival: 'persona', bando, nivel })}
            className={ACCION_DE_RIVAL}
          >
            Dos personas
          </button>
          <button
            data-inicial={rival === 'maquina' || undefined}
            aria-current={rival === 'maquina'}
            onClick={contraLaMaquina}
            className={ACCION_DE_RIVAL}
          >
            Contra la Máquina
          </button>
          {eleccion.volver && (
            <button onClick={sesion.volverALaPartida} className={ACCION}>
              Volver a la partida
            </button>
          )}
        </div>
      ) : (
        <>
          <Opciones titulo="Tu Bando" opciones={BANDOS} valor={bando} alCambiar={setBando} />
          <Opciones titulo="Nivel" opciones={NIVELES} valor={nivel} alCambiar={setNivel} />
          <div className={ACCIONES_DE_CAPA}>
            <button data-inicial onClick={() => empezar({ rival: 'maquina', bando, nivel })} className={ACCION}>
              Empezar
            </button>
            <button onClick={() => irAlPaso('rival')} className={ACCION}>
              Volver
            </button>
          </div>
        </>
      )}
      <BotonDeSilencio sesion={sesion} />
      {regionDeAnuncios}
    </Capa>
  )
}

export function App({ sesion }: { sesion: SesionDePartida }) {
  const estado = useSyncExternalStore(sesion.suscribir, sesion.obtenerEstado)
  const [anuncio, setAnuncio] = useState('')
  const [arriba, abajo]: Bando[] = estado.girado ? ['w', 'b'] : ['b', 'w']
  const luzAbajo = estado.turno === abajo
  const rival = textoDelRival(estado.partida)
  // La elección deja `main` inerte y la Máquina puede jugar detrás: los anuncios van dentro de la capa.
  const regionDeAnuncios = (
    <p role="status" aria-live="polite" className="sr-only">
      {anuncio}
    </p>
  )

  // Un texto idéntico al anterior no cambiaría el DOM, y el lector de pantalla callaría.
  function anunciar(texto: string) {
    setAnuncio((previo) => (previo === texto ? `${texto} ` : texto))
  }

  useEffect(() => sesion.alJugar((jugada) => anunciar(textoDeJugada(jugada))), [sesion])

  // Al empezar con negras, la región de anuncios cambia de nodo a la vez: el texto debe llegar después para oírse.
  useEffect(() => sesion.alEsperar((espera) => setTimeout(() => anunciar(textoDeEspera(espera)))), [sesion])

  // Va tras las suscripciones: la Máquina recuperada anuncia su espera nada más montarse la página.
  useEffect(() => sesion.reanudar(), [sesion])

  // «Deshacer» no lleva `disabled`: el foco se perdería al llegar al inicio de la Partida.
  function deshacer() {
    if (!sesion.obtenerEstado().puedeDeshacer) return
    sesion.deshacer()
    anunciar(textoDeDeshacer(sesion.obtenerEstado().turno))
  }

  // Cerrar la capa devuelve el foco a «Nueva partida»; aquí la Partida empieza y el foco va al tablero.
  function empezar(eleccion: Eleccion) {
    flushSync(() => sesion.empezar(eleccion))
    document.querySelector<HTMLElement>('[data-casilla][tabindex="0"]')?.focus()
  }

  return (
    <>
      <div
        aria-hidden
        className={`foco ${estado.jaque ? 'foco-en-jaque' : ''} ${estado.maquinaPiensa ? 'foco-piensa' : ''}`}
        style={{ '--foco-y': luzAbajo ? '82%' : '18%' } as CSSProperties}
      />
      <main className="pantalla">
        <div className="[grid-area:titulo] compacta:pr-12">
          <h1 className="text-center font-cinzel text-sm font-medium tracking-[0.5em] text-oro uppercase lateral:text-left compacta:sr-only">
            Ajedrez de Gala
          </h1>
          {rival && (
            <p className="text-center font-cinzel text-xs leading-5 tracking-[0.14em] text-oro uppercase lateral:text-left">
              {rival}
            </p>
          )}
        </div>
        <p className="px-2 text-center text-3xl leading-tight italic [grid-area:turno] lateral:border-b lateral:border-oro/40 lateral:px-0 lateral:pb-4 lateral:text-left lateral:text-5xl compacta:pr-12 compacta:pb-1 compacta:text-2xl">
          {textoDelTurno(estado)}
        </p>
        <span id="ultima-jugada" hidden>
          Última Jugada
        </span>
        <span id="ayuda-del-tablero" hidden>
          Muévete con las flechas y selecciona con Enter
        </span>
        {!estado.eleccion && regionDeAnuncios}
        <div className="mx-auto w-(--lado) [grid-area:escena]">
          <Capturadas bando={arriba} estado={estado} />
          <Tablero
            estado={estado}
            capaAbierta={Boolean(estado.eleccion || (estado.pantallaFinal && estado.resultado))}
            sesion={sesion}
          />
          <Capturadas bando={abajo} estado={estado} />
        </div>
        <Historial historial={estado.historial} />
        <div className="flex w-full gap-1 px-1 [grid-area:acciones] lateral:px-0">
          <button onClick={deshacer} aria-disabled={!estado.puedeDeshacer} className={ACCION}>
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
        <EleccionDePartida
          eleccion={estado.eleccion}
          preseleccion={estado.preseleccion}
          empezar={empezar}
          sesion={sesion}
          regionDeAnuncios={regionDeAnuncios}
        />
      ) : (
        estado.pantallaFinal && estado.resultado && <PantallaFinal resultado={estado.resultado} deshacer={deshacer} sesion={sesion} />
      )}
    </>
  )
}

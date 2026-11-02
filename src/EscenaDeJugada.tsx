// Tablero y escena: anima una Jugada sobre las casillas. Las animaciones viven en index.css; aquí solo se espera a que
// acaben para avisar a la Sesión de Partida. Con prefers-reduced-motion no hay ninguna y el aviso sale enseguida.
import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { PieceSymbol, Square } from 'chess.js'
import { urlDePieza } from './piezas'
import { bandoContrario, type Bando, type EventoDeJugada, type SesionDePartida } from './sesion/sesionDePartida'

const MOTAS = 24
// El ángulo áureo reparte las motas sin que se vea un patrón.
const ANGULO_AUREO = 2.39996

type Posicion = { x: number; y: number }
type Vuelo = { desde: Square; hasta: Square; bando: Bando; tipo: PieceSymbol }

function posicion(casilla: Square, girado: boolean): Posicion {
  const x = casilla.charCodeAt(0) - 'a'.charCodeAt(0)
  const y = 8 - Number(casilla[1])
  return girado ? { x: 7 - x, y: 7 - y } : { x, y }
}

const enCasilla = ({ x, y }: Posicion): CSSProperties => ({ left: `${x * 12.5}%`, top: `${y * 12.5}%` })

function PiezaEnVuelo({ vuelo, girado }: { vuelo: Vuelo; girado: boolean }) {
  const origen = posicion(vuelo.desde, girado)
  const destino = posicion(vuelo.hasta, girado)
  const estilo = { ...enCasilla(destino), '--dx': origen.x - destino.x, '--dy': origen.y - destino.y } as CSSProperties

  return <img src={urlDePieza(vuelo.bando, vuelo.tipo)} alt="" className="vuelo" style={estilo} />
}

function Disolucion({
  captura: { casilla, pieza },
  bando,
  girado,
}: {
  captura: NonNullable<EventoDeJugada['captura']>
  bando: Bando
  girado: boolean
}) {
  const lugar = enCasilla(posicion(casilla, girado))
  const motas = Array.from({ length: MOTAS }, (_, i) => {
    // En casillas: el polvo llega algo más allá de la casilla vecina.
    const radio = 0.35 + (i % 5) * 0.2
    const estilo = {
      '--x': Math.cos(i * ANGULO_AUREO) * radio,
      '--y': Math.sin(i * ANGULO_AUREO) * radio,
      animationDelay: `calc(var(--posarse) + ${(i % 4) * 40}ms)`,
    }
    return <i key={i} style={estilo as CSSProperties} />
  })

  return (
    <>
      <img src={urlDePieza(bando, pieza)} alt="" className="disolucion" style={lugar} />
      <div className="polvo" style={lugar}>
        {motas}
      </div>
    </>
  )
}

function Rayos({ rayos, girado }: { rayos: EventoDeJugada['rayos']; girado: boolean }) {
  return (
    <svg className="rayos" viewBox="0 0 8 8">
      {rayos.map(({ desde, hasta }) => {
        const origen = posicion(desde, girado)
        const destino = posicion(hasta, girado)
        return (
          <line
            key={desde}
            x1={origen.x + 0.5}
            y1={origen.y + 0.5}
            x2={destino.x + 0.5}
            y2={destino.y + 0.5}
            pathLength={1}
          />
        )
      })}
    </svg>
  )
}

export function EscenaDeJugada({
  jugada,
  girado,
  sesion,
}: {
  jugada: EventoDeJugada
  girado: boolean
  sesion: SesionDePartida
}) {
  const capa = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    let vigente = true
    // Una animación retirada de la página rechaza su promesa: allSettled la cuenta igual, y `vigente` descarta el aviso.
    Promise.allSettled(capa.current!.getAnimations({ subtree: true }).map((animacion) => animacion.finished)).then(() => {
      if (vigente) sesion.terminarAnimacion()
    })
    return () => {
      vigente = false
    }
  }, [sesion])

  return (
    <div ref={capa} aria-hidden className="escena-de-jugada">
      {jugada.captura && (
        <Disolucion captura={jugada.captura} bando={bandoContrario(jugada.bando)} girado={girado} />
      )}
      <PiezaEnVuelo
        vuelo={{ desde: jugada.desde, hasta: jugada.hasta, bando: jugada.bando, tipo: jugada.pieza }}
        girado={girado}
      />
      {jugada.coronacion && (
        <img
          src={urlDePieza(jugada.bando, jugada.coronacion)}
          alt=""
          className="coronada"
          style={enCasilla(posicion(jugada.hasta, girado))}
        />
      )}
      {jugada.torre && <PiezaEnVuelo vuelo={{ ...jugada.torre, bando: jugada.bando, tipo: 'r' }} girado={girado} />}
      {jugada.rayos.length > 0 && <Rayos rayos={jugada.rayos} girado={girado} />}
    </div>
  )
}

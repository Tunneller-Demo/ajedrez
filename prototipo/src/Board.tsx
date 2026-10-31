// PROTOTIPO: mecánica del tablero. El aspecto y las animaciones salen del CSS de cada dirección.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Color, PieceSymbol, Square } from 'chess.js'
import type { Game } from './useGame'

type Base = { sq: Square; type: PieceSymbol; color: Color }
type Pieza = Base & { id: number }
type Fantasma = Pieza & { clave: number }
export type Pos = { x: number; y: number }

let siguienteId = 1

// Conserva la identidad de cada pieza entre posiciones para que se deslice, también en enroque y Deshacer.
function seguir(prev: Pieza[], ahora: Base[]) {
  const libres = [...prev]
  const tomar = (test: (p: Pieza) => boolean) => {
    const i = libres.findIndex(test)
    return i < 0 ? null : libres.splice(i, 1)[0]
  }
  const asignadas = ahora.map((n) => ({ n, p: tomar((p) => p.sq === n.sq && p.type === n.type && p.color === n.color) }))
  const piezas = asignadas.map(({ n, p }) => {
    const previa =
      p ?? tomar((q) => q.type === n.type && q.color === n.color) ?? tomar((q) => q.type === 'p' && q.color === n.color)
    return { ...n, id: previa?.id ?? siguienteId++ }
  })
  return { piezas, desaparecidas: libres }
}

const FILAS = 'abcdefgh'

type Props = {
  game: Game
  girado: boolean
  url: (color: Color, tipo: PieceSymbol) => string
  impacto?: (pos: Pos, clave: number) => ReactNode
  llegada?: (pos: Pos, clave: number) => ReactNode
  jaque?: (rey: Pos, atacantes: Pos[], clave: number) => ReactNode
  children?: ReactNode
}

export function Board({ game, girado, url, impacto, llegada, jaque, children }: Props) {
  const pos = (sq: Square): Pos => {
    const x = FILAS.indexOf(sq[0])
    const y = 8 - Number(sq[1])
    return girado ? { x: 7 - x, y: 7 - y } : { x, y }
  }

  const visto = useRef({ rev: -1, ply: 0, piezas: [] as Pieza[], nuevas: [] as Fantasma[], avanzo: false })
  if (visto.current.rev !== game.rev) {
    const { piezas, desaparecidas } = seguir(visto.current.piezas, game.piezas)
    const ply = game.historial.length
    const avanzo = ply === visto.current.ply + 1
    const hubo = avanzo && game.ultima?.captured
    visto.current = {
      rev: game.rev,
      ply,
      piezas,
      avanzo,
      nuevas: hubo ? desaparecidas.map((p) => ({ ...p, clave: game.rev })) : [],
    }
  }
  const { piezas, avanzo } = visto.current

  const [fantasmas, setFantasmas] = useState<Fantasma[]>([])
  useEffect(() => {
    const nuevas = visto.current.nuevas
    if (!nuevas.length) return
    setFantasmas(nuevas)
    const t = setTimeout(() => setFantasmas([]), 1400)
    return () => clearTimeout(t)
  }, [game.rev])

  const casillas = Array.from({ length: 64 }, (_, i) => {
    const x = i % 8
    const y = Math.floor(i / 8)
    const r = girado ? { x: 7 - x, y: 7 - y } : { x, y }
    return `${FILAS[r.x]}${8 - r.y}` as Square
  })

  const ultima = game.ultima
  const fijaEnJaque = game.jaque && !!ultima

  return (
    <div className="tablero" data-turno={game.turno}>
      <div className="casillas">
        {casillas.map((sq, i) => {
          const destino = game.destinos.find((m) => m.to === sq)
          const clara = (FILAS.indexOf(sq[0]) + Number(sq[1])) % 2 === 1
          const clases = [
            'casilla',
            clara ? 'clara' : 'oscura',
            game.selected === sq && 'seleccionada',
            (ultima?.from === sq || ultima?.to === sq) && 'ultima',
            destino && (destino.captured ? 'objetivo' : 'destino'),
            game.jaque && sq === game.rey && 'en-jaque',
          ]
          return (
            <button
              key={sq}
              className={clases.filter(Boolean).join(' ')}
              aria-label={sq}
              data-sq={sq}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => game.tocar(sq)}
            >
              {i % 8 === 0 && <span className="coord fila">{sq[1]}</span>}
              {i >= 56 && <span className="coord columna">{sq[0]}</span>}
            </button>
          )
        })}
      </div>

      <div className="capa-piezas">
        {piezas.map((p) => {
          const { x, y } = pos(p.sq)
          const movida = avanzo && ultima?.to === p.sq
          const clases = [
            'pieza-img',
            movida && 'moviendo',
            movida && ultima?.captured && 'capturando',
            game.jaque && p.sq === game.rey && 'rey-en-jaque',
            game.resultado?.ganador && p.sq === game.rey && 'rey-derribado',
          ]
          return (
            <div key={p.id} className="pieza" style={{ transform: `translate(${x * 100}%, ${y * 100}%)` }}>
              <img
                key={movida ? game.rev : 'quieta'}
                src={url(p.color, p.type)}
                className={clases.filter(Boolean).join(' ')}
                draggable={false}
                alt=""
              />
            </div>
          )
        })}
        {fantasmas.map((f) => {
          const { x, y } = pos(f.sq)
          return (
            <div key={`${f.id}-${f.clave}`} className="pieza fantasma solo-movimiento" style={{ transform: `translate(${x * 100}%, ${y * 100}%)` }}>
              <img src={url(f.color, f.type)} className="pieza-img" alt="" />
            </div>
          )
        })}
      </div>

      <div className="capa-efectos solo-movimiento">
        {ultima && avanzo && llegada?.(pos(ultima.to), game.rev)}
        {fantasmas[0] && impacto?.(pos(fantasmas[0].sq), fantasmas[0].clave)}
      </div>
      <div className="capa-efectos">
        {fijaEnJaque && jaque?.(pos(game.rey), game.atacantes.map(pos), game.rev)}
      </div>
      {children}
    </div>
  )
}

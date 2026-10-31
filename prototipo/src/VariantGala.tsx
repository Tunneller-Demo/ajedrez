// PROTOTIPO, dirección B: «Gala». Ornamentada y dramática: un escenario a oscuras con un foco que sigue al Bando en turno.
import { useMemo } from 'react'
import type { Color, PieceSymbol } from 'chess.js'
import { Board, type Pos } from './Board'
import { conFiguritas, type Game } from './useGame'

const url = (c: Color, t: PieceSymbol) => `piezas/gala/${c}${t.toUpperCase()}.svg`
const en = ({ x, y }: Pos) => ({ left: `${x * 12.5}%`, top: `${y * 12.5}%` })
const centro = ({ x, y }: Pos) => ({ x: x + 0.5, y: y + 0.5 })

type Props = { game: Game; girado: boolean; girar: () => void }

function Polvo({ pos }: { pos: Pos }) {
  const motas = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const angulo = (i / 26) * Math.PI * 2 + Math.random()
        const r = 60 + Math.random() * 190
        return {
          '--x': `${Math.cos(angulo) * r}%`,
          '--y': `${Math.sin(angulo) * r}%`,
          animationDelay: `${0.2 + Math.random() * 0.15}s`,
        } as React.CSSProperties
      }),
    [],
  )
  return (
    <div className="g-polvo" style={en(pos)}>
      {motas.map((s, i) => <i key={i} style={s} />)}
    </div>
  )
}

export function VariantGala({ game, girado, girar }: Props) {
  const nueva = () => {
    if (!game.historial.length || confirm('¿Empezar una Partida nueva?')) game.reiniciar()
  }
  const jugadas = game.historial
  const pares = Array.from({ length: Math.ceil(jugadas.length / 2) }, (_, i) => [jugadas[i * 2], jugadas[i * 2 + 1]])
  const luzAbajo = (game.turno === 'w') !== girado

  return (
    <div className={`gala ${game.jaque ? 'en-peligro' : ''}`}>
      <div className="g-foco" style={{ '--foco-y': luzAbajo ? '82%' : '18%' } as React.CSSProperties} />

      <div className="g-escena">
        <div className="g-capturadas">
          {game.capturadas[girado ? 'w' : 'b'].map((t, i) => <img key={i} src={url(girado ? 'b' : 'w', t)} alt="" />)}
        </div>
        <Board
          game={game}
          girado={girado}
          url={url}
          llegada={(p, k) => <div key={`onda-${k}`} className="g-onda" style={en(p)} />}
          impacto={(p, k) => <Polvo key={k} pos={p} />}
          jaque={(rey, atacantes, k) => (
            <svg key={k} className="g-rayos" viewBox="0 0 8 8">
              {atacantes.map((a, i) => {
                const d = centro(a)
                const h = centro(rey)
                return <line key={i} x1={d.x} y1={d.y} x2={h.x} y2={h.y} pathLength={1} />
              })}
            </svg>
          )}
        >
          {game.coronando && (
            <div className="g-coronacion">
              {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((t) => (
                <button key={t} onClick={() => game.coronar(t)} aria-label={`Coronar ${t}`}>
                  <img src={url(game.turno, t)} alt="" />
                </button>
              ))}
            </div>
          )}
        </Board>
        <div className="g-capturadas">
          {game.capturadas[girado ? 'b' : 'w'].map((t, i) => <img key={i} src={url(girado ? 'w' : 'b', t)} alt="" />)}
        </div>
      </div>

      <aside className="g-programa">
        <h1>Ajedrez</h1>
        <p className="g-turno" key={game.turno}>
          {game.jaque ? <em>Jaque</em> : 'Mueven'}
          <br className="g-salto" /> {game.jaque ? 'a las' : 'las'} {game.turno === 'w' ? 'blancas' : 'negras'}
        </p>

        <ol className="g-historial" aria-label="Historial">
          {pares.map(([b, n], i) => (
            <li key={i}>
              <b>{i + 1}</b>
              <span>{conFiguritas(b.san)}</span>
              <span>{n ? conFiguritas(n.san) : ''}</span>
            </li>
          ))}
        </ol>

        <nav className="g-acciones">
          <button onClick={game.deshacer} disabled={!jugadas.length}>Deshacer</button>
          <button onClick={girar}>Girar</button>
          <button onClick={nueva}>Nueva partida</button>
        </nav>
      </aside>

      {game.resultado && (
        <div className="g-fin">
          {game.resultado.ganador && <img className="g-vencedor" src={url(game.resultado.ganador, 'k')} alt="" />}
          <h2>{game.resultado.titulo}</h2>
          <p>{game.resultado.detalle}</p>
          <div>
            <button onClick={game.reiniciar}>Jugar otra vez</button>
            <button onClick={game.deshacer}>Deshacer</button>
          </div>
        </div>
      )}
    </div>
  )
}

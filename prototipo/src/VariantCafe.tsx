// PROTOTIPO, dirección A: «Café». Cálida y desenfadada: un tablero de madera sobre la mesa de un café.
import { useMemo } from 'react'
import type { Color, PieceSymbol } from 'chess.js'
import { Board } from './Board'
import { conFiguritas, type Game } from './useGame'

const url = (c: Color, t: PieceSymbol) => `piezas/cafe/${c}${t.toUpperCase()}.svg`
const en = ({ x, y }: { x: number; y: number }) => ({ left: `${x * 12.5}%`, top: `${y * 12.5}%` })
const COLORES = ['#e4572e', '#f3a712', '#669bbc', '#a8c256', '#fff8ea']

type Props = { game: Game; girado: boolean; girar: () => void }

function Bandeja({ game, bando }: { game: Game; bando: Color }) {
  const rival = bando === 'w' ? 'b' : 'w'
  return (
    <div className="c-bandeja">
      {game.capturadas[bando].map((t, i) => (
        <img key={i} src={url(rival, t)} alt="" />
      ))}
    </div>
  )
}

function Confeti() {
  const trozos = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        background: COLORES[i % COLORES.length],
        animationDelay: `${Math.random() * 0.7}s`,
        animationDuration: `${1.6 + Math.random() * 1.4}s`,
      })),
    [],
  )
  return (
    <div className="c-confeti solo-movimiento">
      {trozos.map((s, i) => <i key={i} style={s} />)}
    </div>
  )
}

export function VariantCafe({ game, girado, girar }: Props) {
  const nueva = () => {
    if (!game.historial.length || confirm('¿Empezar una Partida nueva?')) game.reiniciar()
  }
  const jugadas = game.historial
  const pares = Array.from({ length: Math.ceil(jugadas.length / 2) }, (_, i) => [jugadas[i * 2], jugadas[i * 2 + 1]])

  return (
    <div className="cafe">
      <header className="c-cabecera">
        <h1>Ajedrez</h1>
        <p className={`c-turno ${game.turno}`} key={game.rev}>
          <span />
          {game.turno === 'w' ? 'Mueven las blancas' : 'Mueven las negras'}
        </p>
      </header>

      <div className="c-cuaderno" aria-label="Historial">
        <h2>Historial</h2>
        {!pares.length && <p className="c-vacio">Aún no hay Jugadas</p>}
        <ol>
          {pares.map(([b, n], i) => (
            <li key={i}>
              <b>{i + 1}.</b>
              <span>{conFiguritas(b.san)}</span>
              <span>{n ? conFiguritas(n.san) : ''}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="c-centro">
        <Bandeja game={game} bando={girado ? 'w' : 'b'} />
        <div className="c-marco">
          <Board
            game={game}
            girado={girado}
            url={url}
            impacto={(p, k) => <div key={k} className="c-pum" style={en(p)}>¡Pum!</div>}
            jaque={(p, _, k) => <div key={k} className="c-globo" style={en(p)}>¡Jaque!</div>}
          >
            {game.coronando && (
              <div className="c-coronacion">
                <p>¿En qué se convierte?</p>
                <div>
                  {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((t) => (
                    <button key={t} onClick={() => game.coronar(t)} aria-label={`Coronar ${t}`}>
                      <img src={url(game.turno, t)} alt="" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Board>
        </div>
        <Bandeja game={game} bando={girado ? 'b' : 'w'} />
      </div>

      <nav className="c-acciones">
        <button onClick={game.deshacer} disabled={!jugadas.length}>Deshacer</button>
        <button onClick={girar}>Girar</button>
        <button onClick={nueva}>Nueva partida</button>
      </nav>

      {game.resultado && (
        <div className="c-fin">
          {game.resultado.ganador && <Confeti />}
          <div className="c-cartel">
            <h2>{game.resultado.titulo}</h2>
            <p>{game.resultado.detalle}</p>
            <div>
              <button onClick={game.reiniciar}>Jugar otra vez</button>
              <button onClick={game.deshacer}>Deshacer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

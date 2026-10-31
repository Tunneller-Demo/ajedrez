// PROTOTIPO: dos direcciones visuales del ajedrez en la misma ruta, con ?variant=A y ?variant=B.
import { useEffect, useRef, useState } from 'react'
import { ESCENAS, useGame, type Escena } from './useGame'
import { VariantCafe } from './VariantCafe'
import { VariantGala } from './VariantGala'

const VARIANTES = [
  { clave: 'A', nombre: 'Café', Vista: VariantCafe },
  { clave: 'B', nombre: 'Gala', Vista: VariantGala },
]

const leerVariante = () => {
  const i = VARIANTES.findIndex((v) => v.clave === new URLSearchParams(location.search).get('variant'))
  return i < 0 ? 0 : i
}

export function App() {
  const game = useGame()
  const [indice, setIndice] = useState(leerVariante)
  const [girado, setGirado] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [movil, setMovil] = useState(false)
  const [forzado, setForzado] = useState(false)
  const [delSistema, setDelSistema] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const temporizador = useRef(0)

  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)')
    const cambio = () => setDelSistema(m.matches)
    m.addEventListener('change', cambio)
    return () => m.removeEventListener('change', cambio)
  }, [])

  function cambiar(paso: number) {
    setIndice((i) => {
      const n = (i + paso + VARIANTES.length) % VARIANTES.length
      history.replaceState(null, '', `?variant=${VARIANTES[n].clave}`)
      return n
    })
  }

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('.tablero, input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowLeft') cambiar(-1)
      if (e.key === 'ArrowRight') cambiar(1)
    }
    addEventListener('keydown', tecla)
    return () => removeEventListener('keydown', tecla)
  }, [])

  function verEscena(e: Escena) {
    clearTimeout(temporizador.current)
    game.cargar(e)
    temporizador.current = window.setTimeout(() => game.intentar(e.from, e.to), 800)
  }

  const { clave, nombre, Vista } = VARIANTES[indice]
  const sinMovimiento = forzado || delSistema
  const boton = 'rounded-full px-3 py-1 text-sm hover:bg-white/15'

  return (
    <div className="relative h-full">
      <div className={`marco ${movil ? 'movil' : ''} ${sinMovimiento ? 'sin-movimiento' : ''}`}>
        <Vista game={game} girado={girado} girar={() => setGirado((g) => !g)} />
      </div>

      <div
        data-barra
        className="fixed bottom-2 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 font-mono text-white"
      >
        {abierto && (
          <div className="flex w-72 flex-wrap justify-center gap-1 rounded-2xl bg-black/90 p-2 shadow-xl ring-1 ring-white/20">
            {ESCENAS.map((e) => (
              <button key={e.nombre} className={boton} onClick={() => verEscena(e)}>
                {e.nombre}
              </button>
            ))}
            <span className="w-full border-t border-white/20" />
            <button className={boton} aria-pressed={movil} onClick={() => setMovil((m) => !m)}>
              {movil ? '✓ ' : ''}Vista móvil
            </button>
            <button className={boton} aria-pressed={forzado} onClick={() => setForzado((f) => !f)}>
              {sinMovimiento ? '✓ ' : ''}Sin movimiento
            </button>
          </div>
        )}
        <div className="flex items-center gap-1 rounded-full bg-black/90 px-2 py-1 shadow-xl ring-1 ring-white/20">
          <button className={boton} aria-label="Dirección anterior" onClick={() => cambiar(-1)}>←</button>
          <span className="px-2 text-sm whitespace-nowrap">{clave} · {nombre}</span>
          <button className={boton} aria-label="Dirección siguiente" onClick={() => cambiar(1)}>→</button>
          <button className={boton} aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>Escenas</button>
        </div>
      </div>
    </div>
  )
}

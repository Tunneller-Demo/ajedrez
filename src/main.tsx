import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cinzel/latin-500.css'
import '@fontsource/cormorant-garamond/latin-400.css'
import '@fontsource/cormorant-garamond/latin-400-italic.css'
import { App } from './App'
import { crearSesionDePartida } from './sesion/sesionDePartida'
import { conectarSonido } from './sonido/sonido'
import './index.css'

const sesion = crearSesionDePartida({
  almacen: {
    leer: (clave) => localStorage.getItem(clave),
    escribir: (clave, valor) => localStorage.setItem(clave, valor),
  },
  reloj: { ahora: () => Date.now() },
})

conectarSonido(sesion)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App sesion={sesion} />
  </StrictMode>,
)

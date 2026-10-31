import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { crearSesionDePartida } from './sesion/sesionDePartida'
import './index.css'

const sesion = crearSesionDePartida({
  almacen: {
    leer: (clave) => localStorage.getItem(clave),
    escribir: (clave, valor) => localStorage.setItem(clave, valor),
  },
  reloj: { ahora: () => Date.now() },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App sesion={sesion} />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cinzel/latin-500.css'
import '@fontsource/cormorant-garamond/latin-400.css'
import '@fontsource/cormorant-garamond/latin-400-italic.css'
import { App } from './App'
import { crearMotorDeMaquina } from './maquina/motor'
import { crearSesionDePartida } from './sesion/sesionDePartida'
import { conectarSonido } from './sonido/sonido'
import './index.css'

const sesion = crearSesionDePartida({
  almacen: {
    leer: (clave) => localStorage.getItem(clave),
    escribir: (clave, valor) => localStorage.setItem(clave, valor),
  },
  reloj: { esperar: (ms) => new Promise((pasar) => setTimeout(pasar, ms)) },
  motor: crearMotorDeMaquina(),
  azar: Math.random,
})

conectarSonido(sesion)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App sesion={sesion} />
  </StrictMode>,
)

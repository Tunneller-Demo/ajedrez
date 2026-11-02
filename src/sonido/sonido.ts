// Sonido: síntesis con Web Audio y sala generada en el navegador, sin archivos. Suena con los eventos de la Sesión de
// Partida. El timbre sale de la muestra prototipo/public/sonidos/index.html.
import type { Efecto, SesionDePartida } from '../sesion/sesionDePartida'

// Coincide con --posarse en index.css: el golpe llega cuando la pieza toca la casilla.
const POSARSE = 480
// La muestra roza el pico máximo: la holgura y el limitador dejan sitio a los solapes.
const HOLGURA = 0.4
const REGRESO_DE_SALA = 0.35

function respuestaDeSala(contexto: AudioContext) {
  const largo = Math.floor(contexto.sampleRate * 2.6)
  const respuesta = contexto.createBuffer(2, largo, contexto.sampleRate)
  for (let canal = 0; canal < 2; canal++) {
    const datos = respuesta.getChannelData(canal)
    let filtro = 0
    for (let i = 0; i < largo; i++) {
      filtro += 0.25 * (Math.random() * 2 - 1 - filtro)
      datos[i] = filtro * Math.pow(1 - i / largo, 3.2)
    }
  }
  return respuesta
}

function montarSintetizador(contexto: AudioContext, silencio: boolean) {
  const maestro = contexto.createGain()
  maestro.gain.value = silencio ? 0 : 1
  maestro.connect(contexto.destination)

  const limitador = contexto.createDynamicsCompressor()
  limitador.threshold.value = -12
  limitador.knee.value = 6
  limitador.ratio.value = 20
  limitador.attack.value = 0.002
  limitador.release.value = 0.25
  limitador.connect(maestro)

  const salida = contexto.createGain()
  salida.gain.value = HOLGURA
  salida.connect(limitador)

  const sala = contexto.createConvolver()
  sala.buffer = respuestaDeSala(contexto)
  const regreso = contexto.createGain()
  regreso.gain.value = REGRESO_DE_SALA
  salida.connect(sala).connect(regreso).connect(limitador)

  const chasquido = contexto.createBuffer(1, Math.floor(contexto.sampleRate * 0.03), contexto.sampleRate)
  chasquido.getChannelData(0).forEach((_, i, datos) => {
    datos[i] = Math.random() * 2 - 1
  })

  function golpe(t: number, frecuencia: number, duracion: number, volumen: number) {
    const oscilador = contexto.createOscillator()
    const envolvente = contexto.createGain()
    oscilador.frequency.setValueAtTime(frecuencia * 1.8, t)
    oscilador.frequency.exponentialRampToValueAtTime(frecuencia, t + 0.04)
    envolvente.gain.setValueAtTime(volumen, t)
    envolvente.gain.exponentialRampToValueAtTime(0.001, t + duracion)
    oscilador.connect(envolvente).connect(salida)
    oscilador.start(t)
    oscilador.stop(t + duracion)

    const ruido = contexto.createBufferSource()
    ruido.buffer = chasquido
    const pasoBajo = contexto.createBiquadFilter()
    pasoBajo.type = 'lowpass'
    pasoBajo.frequency.value = 1100
    const envolventeDeRuido = contexto.createGain()
    envolventeDeRuido.gain.setValueAtTime(volumen * 0.6, t)
    envolventeDeRuido.gain.exponentialRampToValueAtTime(0.001, t + 0.03)
    ruido.connect(pasoBajo).connect(envolventeDeRuido).connect(salida)
    ruido.start(t)
  }

  function campana(t: number, frecuencia: number, duracion: number, volumen: number) {
    for (const [parcial, peso] of [[1, 1], [2, 0.5], [2.76, 0.3], [5.4, 0.12]]) {
      const oscilador = contexto.createOscillator()
      const envolvente = contexto.createGain()
      oscilador.frequency.value = frecuencia * parcial
      envolvente.gain.setValueAtTime(0.0001, t)
      envolvente.gain.exponentialRampToValueAtTime(volumen * peso, t + 0.012)
      envolvente.gain.exponentialRampToValueAtTime(0.0001, t + duracion / parcial)
      oscilador.connect(envolvente).connect(salida)
      oscilador.start(t)
      oscilador.stop(t + duracion / parcial)
    }
  }

  const SINTESIS: Record<Efecto, (t: number) => void> = {
    mover(t) {
      golpe(t, 135, 0.22, 0.9)
    },
    capturar(t) {
      golpe(t, 95, 0.32, 1)
      ;[2093, 2794, 3136, 2349, 3520, 2637].forEach((f, i) => campana(t + 0.08 + i * 0.07, f, 0.5, 0.05))
    },
    jaque(t) {
      golpe(t, 80, 0.4, 0.6)
      campana(t, 146.83, 2, 0.28)
      campana(t + 0.02, 207.65, 2, 0.22)
    },
    fin(t) {
      golpe(t, 60, 0.8, 1)
      ;[73.42, 146.83, 220, 293.66, 369.99].forEach((f, i) => campana(t + 0.25 + i * 0.22, f, 3.2, 0.26))
    },
  }

  return {
    sonar(efecto: Efecto) {
      SINTESIS[efecto](contexto.currentTime)
    },
    silenciar(silencio: boolean) {
      maestro.gain.setTargetAtTime(silencio ? 0 : 1, contexto.currentTime, 0.015)
    },
  }
}

export function conectarSonido(sesion: SesionDePartida) {
  let contexto: AudioContext | null = null
  let sintetizador: ReturnType<typeof montarSintetizador> | null = null
  let estado = sesion.obtenerEstado()
  const pendientes = new Set<ReturnType<typeof setTimeout>>()

  // Cada interacción reanuda el contexto: Escape no cuenta como gesto y el móvil lo suspende al cambiar de app.
  function alInteractuar() {
    if (!contexto) {
      contexto = new AudioContext()
      sintetizador = montarSintetizador(contexto, estado.silencio)
    }
    if (contexto.state !== 'running') void contexto.resume()
  }

  window.addEventListener('click', alInteractuar, true)
  window.addEventListener('keydown', alInteractuar, true)

  function sonar(efecto: Efecto) {
    if (!estado.silencio) sintetizador?.sonar(efecto)
  }

  sesion.suscribir(() => {
    const anterior = estado
    estado = sesion.obtenerEstado()
    if (estado.silencio !== anterior.silencio) sintetizador?.silenciar(estado.silencio)
    // Deshacer y empezar quitan la Jugada que iba a sonar.
    if (estado.historial.length < anterior.historial.length) {
      pendientes.forEach((pendiente) => clearTimeout(pendiente))
      pendientes.clear()
    }
  })

  sesion.alJugar(({ efecto }) => {
    if (!efecto) return
    // Sin animaciones no hay vuelo que esperar.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return sonar(efecto)
    const pendiente = setTimeout(() => {
      pendientes.delete(pendiente)
      sonar(efecto)
    }, POSARSE)
    pendientes.add(pendiente)
  })
}

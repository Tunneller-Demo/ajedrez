# Stockfish WASM como rival en el ajedrez web

Fecha: 2026-10-31. Contexto: app estática React + TypeScript + Vite en GitHub Pages, bajo `/ajedrez/`.

## Decisión

**Añadir el rival con `stockfish-19-lite-single` 19.0.1** (1,87 MB en bruto, unos 1,2 MB por la red con gzip), cargado bajo demanda en un Worker clásico desde `public/`. No hace falta COOP/COEP ni service worker. Esfuerzo: **3-4 días-persona**, sobre un juego a dos ya existente.

Dos condiciones:

1. **Antes de fusionar**, probar el cuelgue conocido de las builds lite 19 ([issue #124](https://github.com/nmrugg/stockfish.js/issues/124), abierto) y limitar cada búsqueda con un watchdog.
2. **Publicar junto al motor** el texto de la GPL y un enlace mantenido al código fuente.

Salvedades de método:

- Los motores no se han ejecutado, por indicación del encargo. No hay datos propios de rendimiento ni de comportamiento en navegador.
- `gnu.org` no fue accesible por conexión directa. La GPL se leyó de su copia literal, `Copying.txt`; el FAQ solo a través de un buscador.
- Este análisis no es asesoramiento legal.

## 1. Peso de las builds

Bytes medidos sobre los tarballs de npm (`.js` + `.wasm`): gzip nivel 6 y brotli calidad 11. Las builds completas se midieron con brotli calidad 5.

| Build | Bruto | gzip | brotli | Necesita SAB | Fuente |
|---|---|---|---|---|---|
| **stockfish 19.0.1 lite-single** | **1.874.201** | **1.206.122** | 1.115.237 | No | [npm](https://registry.npmjs.org/stockfish/-/stockfish-19.0.1.tgz) |
| stockfish 19.0.1 lite (hilos) | 1.731.043 | 1.175.332 | 1.097.856 | Sí | idem |
| stockfish 19.0.1 asm.js | 3.155.627 | 1.473.527 | 1.337.162 | No | idem |
| stockfish 19.0.1 completa, un hilo | 99.197.184 | 78.841.773 | 77.722.457 | No | idem |
| stockfish 19.0.1 completa (hilos) | 99.109.431 | no medido | no medido | Sí | idem |
| stockfish 18.0.8 lite-single | 7.316.840 | 5.623.082 | 5.297.349 | No | [npm](https://registry.npmjs.org/stockfish/-/stockfish-18.0.8.tgz) |
| @lichess-org/stockfish-web 0.5.0 `sf_19_smallnet` | 545.314 + red de 1.166.381 | 206.482 + red | 162.242 + red | Sí | [npm](https://registry.npmjs.org/@lichess-org/stockfish-web/-/stockfish-web-0.5.0.tgz) |
| stockfish.wasm 0.10.0 | 377.890 | 140.545 | 113.031 | Sí | [npm](https://registry.npmjs.org/stockfish.wasm/-/stockfish.wasm-0.10.0.tgz) |

- **Por qué comprime poco:** la red neuronal va embebida en las builds de nmrugg, y así la lite baja solo un 36 % con gzip. La completa queda en 79 MB.
- **Fuerza:** la lite es «quite a bit weaker» que la completa, pero «far stronger than any human will ever be» según el [README](https://github.com/nmrugg/stockfish.js/blob/v19.0.1/README.md), que la recomienda para la mayoría de proyectos.
- **`sf_19_smallnet`** usa [la misma red lite](https://github.com/lichess-org/stockfish-web#sources), servida aparte (`nn-61e7af4bb97d`, 1.166.381 bytes medidos). El paquete avisa de que [no es sencillo de cargar y remite a nmrugg](https://github.com/lichess-org/stockfish-web#readme).
- **stockfish.wasm** deriva de [`SF_classical`, sin NNUE](https://github.com/niklasf/stockfish.wasm), figura como «passively maintained» y exige COOP/COEP.
- **Coste de `npm install stockfish`:** el tarball pesa 161.366.858 bytes y [205 MB desempaquetado](https://www.npmjs.com/package/stockfish). Para usar dos archivos conviene copiarlos desde el [release v19.0.1](https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1), cuyos tamaños [coinciden con los del tarball](https://api.github.com/repos/nmrugg/stockfish.js/releases/latest), y no añadir la dependencia.

**Efecto en la carga inicial:** nulo en bytes del motor, porque nada se descarga hasta llamar a `new Worker(...)`. Solo se añade el código del cliente UCI al bundle. La primera Partida contra el rival transfiere unos 1,2 MB: alrededor de 1 s a 10 Mbit/s y de 6 s a 1,6 Mbit/s (cálculo propio, sin latencia ni compilación). Después aplica la caché del navegador.

## 2. GitHub Pages: hilos, SharedArrayBuffer y compresión

- **Sin cabeceras propias:** el personal de GitHub [respondió en 2023](https://github.com/orgs/community/discussions/13309) que soportarían este caso con cabeceras personalizadas, «No ETA». El hilo seguía sin implementación el 25-10-2026.
- **Hilos:** `SharedArrayBuffer` exige [contexto seguro y aislamiento de origen cruzado](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer). Las builds multihilo [necesitan esas cabeceras](https://github.com/nmrugg/stockfish.js/blob/v19.0.1/README.md), así que no funcionan en Pages sin un parche.
- **Un hilo:** sí existe. El README indica que lite-single [funciona en cualquier host estático sin configuración](https://github.com/nmrugg/stockfish.js/blob/v19.0.1/README.md), y `setoption name Threads` no tiene efecto ahí. Comprobado en el código: `stockfish-19-lite-single.js` no contiene `SharedArrayBuffer`.
- **`coi-serviceworker`:** es viable pero no conviene aquí. [Nació para casos como GitHub Pages](https://github.com/gzuidhof/coi-serviceworker), con licencia MIT. A cambio [recarga la página en la primera visita](https://github.com/gzuidhof/coi-serviceworker) y debe ir en archivo propio, sin empaquetar y desde el mismo origen.
  - Un usuario [informó en 2025 de fallos en Firefox](https://github.com/orgs/community/discussions/13309), sin confirmar.
  - El worker [controla lo anidado en su ruta](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), por lo que uno en `/ajedrez/` también alcanzaría `/ajedrez/pr-preview/`.
  - No aporta nada a niveles humanos, y la build multihilo pesa casi lo mismo.
- **Compresión de `.wasm`:** sí, con gzip. No sirve brotli. Medido con `curl` el 2026-10-31:

| Archivo en Pages | Sin comprimir | gzip | Tipo |
|---|---|---|---|
| [openjpeg.wasm](https://mozilla.github.io/pdf.js/web/wasm/openjpeg.wasm) | 220.817 | 71.367 | `application/wasm` |
| [ammo.wasm.wasm](https://kripken.github.io/ammo.js/builds/ammo.wasm.wasm) | 750.028 | 293.048 | `application/wasm` |

  - Con `Accept-Encoding: br` la respuesta llega sin comprimir; con `gzip, br` llega en gzip.
  - La caché observada es `max-age=600`, de modo que los nombres con hash no dan caché larga.
  - No se encontró en Pages un `.wasm` mayor de 1 MB para confirmar que no haya umbral de tamaño. Hay que verificarlo en la primera vista previa.
- **Límites:** [sitio de 1 GB y 100 GB/mes de ancho de banda blando](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), holgados para 1,87 MB. La build completa quedaría al borde del [bloqueo de 100 MiB por archivo](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) y por encima del aviso de 50 MiB.

## 3. Licencia

**Licencias**

- Stockfish es [GPLv3](https://github.com/official-stockfish/Stockfish#terms-of-use).
- stockfish.js es [GPLv3 en el motor y MIT en el resto](https://github.com/nmrugg/stockfish.js/blob/v19.0.1/README.md#license).
- `@lichess-org/stockfish-web` es [AGPL-3.0-or-later](https://www.npmjs.com/package/@lichess-org/stockfish-web).
- El README de Stockfish [no fija licencia específica para los `.nnue`](https://github.com/official-stockfish/Stockfish#terms-of-use).

**Qué obliga a hacer** (cláusulas en [`Copying.txt`](https://raw.githubusercontent.com/nmrugg/stockfish.js/v19.0.1/Copying.txt)). Servir el `.wasm` es «convey», porque permite a otros recibir copias.

1. **Texto de la licencia (§4):** dar copia a los destinatarios. Basta con servir `Copying.txt` junto al motor.
2. **Avisos (§4):** mantenerlos intactos. El banner de copyright está en el `.js`; en `public/` no se minifica.
3. **Código fuente correspondiente (§1, §6d):** con Pages basta ofrecerlo en otro servidor, con «clear directions next to the object code». Incluye los scripts de compilación. Stockfish lo [resume igual](https://github.com/official-stockfish/Stockfish#terms-of-use): licencia y fuente, o un puntero a la fuente.
4. **Disponibilidad (§6d):** sigues obligado «for as long as needed» aunque el fuente lo aloje un tercero. Enlazar solo a nmrugg deja ese riesgo. Recomendado: hacer un fork fijado en el tag [`v19.0.1`](https://github.com/nmrugg/stockfish.js/tree/v19.0.1) (`8d9ca570`) en la propia cuenta y añadir la red.
5. **La red:** el [`build.js` la resuelve desde `evaluate.h`](https://raw.githubusercontent.com/nmrugg/stockfish.js/v19.0.1/build.js) y ofrece una opción para no descargarla ni verificarla. No aparece ningún `.nnue` en `src/` del tag. Por prudencia, conservar [`nn-61e7af4bb97d`](https://tests.stockfishchess.org/api/nn/nn-61e7af4bb97d.nnue) (1,17 MB) con el fuente. El tarball de npm no incluye el código C++, así que no sirve como fuente.
6. **Si se modifica el motor (§5):** marcar los cambios y publicarlos bajo GPLv3. Sin parches, esto no aplica.

**¿Basta con un worker separado?** Es lo más defendible, pero no es una garantía formal.

- La GPL [no se extiende a las otras partes de un «aggregate»](https://raw.githubusercontent.com/nmrugg/stockfish.js/v19.0.1/Copying.txt) (§5), siempre que sean obras independientes no combinadas en un programa mayor.
- El [FAQ de la FSF](https://www.gnu.org/licenses/gpl-faq.html#MereAggregation) (leído por buscador) dice que pipes y sockets normalmente separan programas, pero que cuentan también el mecanismo y la semántica del intercambio.
- Inferencia para este caso: mensajes UCI de texto, a un motor genérico sustituible, en otro hilo y con memoria propia, encajan en programas separados. Empaquetarlo en el bundle o con `?worker&inline` debilitaría esa separación.
- Que el repo sea público no cambia nada: no obliga por sí mismo a licenciar la app bajo GPL. El repo [aún no tiene archivo LICENSE](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository); conviene añadir una licencia compatible (por ejemplo MIT) para que no quede ambigüedad.

Tarea mínima: `public/engine/Copying.txt`, un `README` o créditos en la UI con versión, licencia y enlace al fuente, y el fork fijado.

## 4. Dificultad y rendimiento

Rangos en el tag [`sf_19`](https://github.com/official-stockfish/Stockfish/tree/sf_19):

| Control | Rango / efecto | Fuente |
|---|---|---|
| `Skill Level` | 0-20, por defecto 20 (sin handicap) | [engine.cpp:107](https://github.com/official-stockfish/Stockfish/blob/sf_19/src/engine.cpp#L107) |
| `UCI_LimitStrength` | booleano; activa el uso de `UCI_Elo` | [search.cpp:241](https://github.com/official-stockfish/Stockfish/blob/sf_19/src/search.cpp#L241) |
| `UCI_Elo` | 1320-3190, escala CCRL Blitz aproximada, se convierte a nivel 0-19 | [search.h:247-265](https://github.com/official-stockfish/Stockfish/blob/sf_19/src/search.h#L247) |
| `go movetime` / `go depth` | tope por jugada; se pueden combinar | [fishnet](https://github.com/lichess-org/fishnet/blob/master/src/stockfish.rs) |

- **Mecanismo:** con handicap, el motor [sube MultiPV a un mínimo de 4 y elige una jugada subóptima al azar ponderado](https://github.com/official-stockfish/Stockfish/blob/sf_19/src/search.cpp#L2064). Lo hace al llegar a la [profundidad `1 + level`](https://github.com/official-stockfish/Stockfish/blob/sf_19/src/search.h#L253).
- **Límite inferior:** 1320 es el suelo oficial, y no equivale necesariamente a un principiante (inferencia, y la calibración no es específica de la red lite). Para bajar más hay que recortar tiempo y profundidad.
- **Referencia, Lichess:** sus [8 niveles](https://github.com/lichess-org/fishnet/blob/master/src/api.rs) usan `movetime` de 50 a 1000 ms y profundidad 5, 5, 5, 5, 5, 8, 13 y 22. Sus `Skill Level` negativos están fuera del rango de Stockfish oficial; no se pueden copiar tal cual.

Propuesta inicial, a calibrar jugando (no medida):

| Nivel | Skill Level | `go` |
|---|---|---|
| Fácil | 0 | `movetime 100 depth 3` |
| Medio | 5 | `movetime 200 depth 5` |
| Difícil | 12 | `movetime 500 depth 10` |
| Máximo | 20 | `movetime 1000 depth 13` |

**Cuelgue conocido:** el [issue #124](https://github.com/nmrugg/stockfish.js/issues/124), abierto, describe que las builds lite 19.0.0 y 19.0.1 no terminan `go depth 16` en una posición concreta, mientras que 18.0.8 lo hace en 0,2-0,4 s. Se reprodujo en Linux y macOS con Node.

- El informe no prueba `go movetime` ni `stop`, y aquí no se ha ejecutado. Por eso es la primera tarea.
- Inferencia: los topes de profundidad de la tabla quedan por debajo de los que se bloquean, pero no se puede afirmar que el fallo solo ocurra a esa profundidad.
- Plan: watchdog de `stop` y luego `worker.terminate()`, con reinicio y jugada alternativa legal.
- Si `stop` no responde en esa posición, valorar 18.0.8, que cuesta 4,4 MB más con gzip.
- Otro aviso abierto: [`memory access out of bounds`](https://github.com/nmrugg/stockfish.js/issues/101) con builds de un hilo en análisis rápido, reportado en 2025 en escritorio. Conviene reiniciar el worker ante error.

**Móvil:** no se encontró ninguna medición primaria de nodos por segundo en teléfonos. Datos disponibles:

- El README soporta [iOS 16+ y Android](https://github.com/nmrugg/stockfish.js/blob/v19.0.1/README.md).
- El [Makefile del tag](https://raw.githubusercontent.com/nmrugg/stockfish.js/v19.0.1/src/Makefile) compila con `-msimd128` y memoria inicial de 64 MB (líneas 933-934), por lo que se requiere SIMD de WASM.
- Lichess [limita el hash a 32 MB en iOS y 64 MB en Android](https://raw.githubusercontent.com/lichess-org/lila/master/ui/lib/src/ceval/engines/engines.ts), porque un «budget android» se cuelga con 128. El [hash por defecto](https://github.com/official-stockfish/Stockfish/blob/sf_19/src/engine.cpp#L90) de 16 MB queda por debajo.
- Como referencia de escritorio, lite-single dio [unas 712.000 nps con Node](https://github.com/nmrugg/stockfish.js/issues/124).

Inferencia: al limitar por `movetime`, el móvil solo juega algo más flojo, sin esperar más. La prueba en un Android modesto y un iPhone forma parte del esfuerzo, y debe medir también la compilación inicial.

## 5. Integración con Vite

**Usar `public/`, no `import`.**

- Vite [conserva nombres exactos en `public/`](https://vite.dev/guide/assets), que es lo que el motor necesita.
- El `.js` busca el `.wasm` [a su lado](https://github.com/nmrugg/stockfish.js/blob/v19.0.1/README.md). Comprobado en el código: toma `location.hash` y, si está vacío, cambia `.js` por `.wasm` en su propia URL.
- Con `?url` o `new URL(...)` Vite podría renombrar los archivos, y entonces habría que pasar la ruta en el fragmento. `?worker` reempaquetaría un script que depende de su propia ubicación.

```ts
const base = import.meta.env.BASE_URL;
const worker = new Worker(`${base}engine/stockfish-19-lite-single.js`);
```

- **Cómo resuelve la base:** Vite [sustituye `BASE_URL` estáticamente](https://vite.dev/guide/build#public-base-path). Como el `.wasm` se deriva de la URL real del worker, funciona igual en `/ajedrez/` que en cualquier subruta, siempre que los dos archivos vayan juntos.
- **Vistas previas:** las URL son [`/repo/pr-preview/pr-N/`](https://github.com/rossjrw/pr-preview-action). Dos opciones:
  - Compilar cada PR con [`--base=/ajedrez/pr-preview/pr-N/`](https://vite.dev/guide/build#public-base-path).
  - Usar [`base: './'`](https://vite.dev/guide/build#relative-base), válido si la app no tiene rutas anidadas.
- **Requisito de la acción:** esa acción [exige «Deploy from branch»](https://github.com/rossjrw/pr-preview-action) como fuente de Pages, no «GitHub Actions».
- **Tipo MIME:** Pages sirvió `application/wasm` en las pruebas de arriba, lo que encaja con [lo que pide el motor](https://github.com/nmrugg/stockfish.js/blob/v19.0.1/README.md).
- **Protocolo:** enviar `uci`, `isready`, `ucinewgame`, `position ... moves ...` y `go ...`; leer `bestmove`. La jugada llega en notación larga (`e7e8q`), que hay que traducir a la Coronación.

## 6. Esfuerzo y recomendación

El repo solo contiene `CONTEXT.md` y `README.md`. La estimación supone un juego a dos ya hecho, con reglas y generación de FEN. Es un juicio propio, no una medición.

| Tarea | Días-persona |
|---|---|
| Prueba del issue #124 en navegador, copia del motor, avisos GPL, fork del fuente | 0,5 |
| Cliente UCI en worker: arranque, cancelación, watchdog, errores, doble para tests | 1 |
| Integración: elegir Bando y nivel, turno del rival, Coronación, carga y fallo | 1-1,5 |
| Pruebas en móvil y calibración de niveles | 0,5-1 |
| **Total** | **3-4** |

Opciones descartadas:

| Opción | Por qué no |
|---|---|
| Multihilo + `coi-serviceworker` | Suma 1-2 días (estimación), recarga inicial y riesgo de compatibilidad, sin ganancia en niveles humanos |
| Build completa | 79 MB por la red |
| `stockfish-web` de Lichess | Necesita SAB y es AGPL |
| `stockfish.wasm` | Necesita SAB, sin NNUE y en mantenimiento pasivo |
| asm.js | Lento y débil, [solo como último recurso](https://github.com/nmrugg/stockfish.js/blob/v19.0.1/README.md), salvo como respaldo si falta SIMD |

**Recomendación: hacerlo con lite-single 19.0.1.** Cuesta 1,2 MB solo a quien juegue contra la máquina, no toca la carga inicial y no exige infraestructura. Abandonar o cambiar a 18.0.8 solo si la prueba del issue #124 muestra que el motor no se puede interrumpir.

Afecta al dominio, a decidir antes de implementar:

- [`CONTEXT.md`](../../CONTEXT.md) define el juego para dos personas y necesita un término para el rival.
- Deshacer retira una Jugada; contra la máquina debería retirar dos, o la máquina volvería a responder de inmediato. También debe cancelar una búsqueda en curso.

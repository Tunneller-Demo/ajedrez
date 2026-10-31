# Piezas SVG libres y chess.js para el ajedrez web

Fecha: 2026-10-31. Contexto: app estática React + TypeScript + Vite, en repo público aún sin LICENSE. Hay que preparar 2 direcciones visuales muy distintas.

## Decisión

**Piezas.** Preparar las dos direcciones con:

- **Dirección A, cálida y desenfadada: RhosGFX** (CC0). Sin obligaciones. Trae variantes de madera y tableros.
- **Dirección B, ornamentada y dramática: Fantasy de chess-art** (MIT, citando al autor). Tiene configurador de degradados, trazo y sombra.

**No copiar de `lichess-org/lila/public/piece` a ciegas:** ese directorio mezcla MIT y CC0 con GPL, AGPL, NC y sets sin licencia. De los 41 sets con fila en [`COPYING.md`](https://github.com/lichess-org/lila/blob/master/COPYING.md), 24 son NC-SA (17) o GPL/AGPL (7).

**Motor: chess.js 1.4.0**, versión fijada. Guardar la Partida como `chess.pgn()` y restaurarla con `loadPgn()`. Restaurar por FEN pierde el historial, deshacer y la triple repetición.

Salvedades de método:

- La licencia se comprobó en la fuente del autor siempre que existe. Donde solo hay declaración en lila, se indica.
- Las pruebas de comportamiento se ejecutaron contra `dist/esm/chess.js` del tarball de npm 1.4.0, en Node 24.
- **Tamaño minificado:** la medición local con esbuild fue bloqueada por un hook del entorno. La cifra minificada es de Bundlephobia, un tercero; las de `dist` son propias.
- El zip de RhosGFX no se abrió: el formato SVG consta en su página y en los 12 SVG presentes en lila.
- `gnu.org` rechazó la conexión, así que el FAQ de la GPL no se leyó. El efecto exacto de la GPL sobre un SVG incluido en un bundle queda sin resolver aquí; por eso se evita.
- Este análisis no es asesoramiento legal.

## 1. Sets de piezas

### Recomendados (no obligan a licenciar la app)

| Set | Estilo (vista previa) | Licencia verificada | Qué obliga | Cómo obtenerlo |
|---|---|---|---|---|
| **RhosGFX** | Dibujo amable, contorno grueso, madera ([imagen en PR](https://github.com/lichess-org/lila/pull/17131)) | CC0: "[offered for free under Creative Commons CC0](https://rhosgfx.itch.io/vector-chess-pieces)"; el autor lo repite en el [PR #17131](https://github.com/lichess-org/lila/pull/17131) | Nada. Crédito apreciado, no exigido | [itch.io](https://rhosgfx.itch.io/vector-chess-pieces): SVG y PNG8, 4 juegos de color, 3 tableros |
| **Fantasy** (familia chess-art; hermanos más sobrios: Celtic, Spatial) | Ornamentado, degradado y sombra ([demo](https://raw.githubusercontent.com/maurimo/chess-art/main/demo/fantasy.png)) | [MIT](https://github.com/maurimo/chess-art/blob/main/LICENSE) | Conservar aviso y licencia. El [README](https://github.com/maurimo/chess-art/blob/main/README.md#licensing) pide además citar al autor de forma apropiada | [Configurador](https://maurimo.github.io/chess-art/configure.html); los SVG base no se usan tal cual |
| **Skulls** (chess-art `fancy`) | Macabro: calaveras y parca ([demo](https://raw.githubusercontent.com/maurimo/chess-art/main/demo/skulls.png)) | Igual que Fantasy | Igual que Fantasy | [`fancy/skulls`](https://github.com/maurimo/chess-art/tree/main/fancy/skulls); [no configurable](https://github.com/maurimo/chess-art/blob/main/README.md#themes) |
| **Cburnett, desde Commons** | Clásico plano, el de Wikipedia ([archivo](https://commons.wikimedia.org/wiki/File:Chess_klt45.svg)) | Multilicencia GFDL / CC BY-SA 3.0 / **BSD 3 cláusulas** / GPL2+: "[You may select the license of your choice](https://commons.wikimedia.org/wiki/File:Chess_klt45.svg)". Comprobado en los 12 archivos `Chess_{k,q,r,b,n,p}{l,d}t45.svg` | Eligiendo BSD: reproducir aviso y descargo; no usar al autor para promocionar | Commons, no lila: allí el mismo set [figura como GPLv2+](https://github.com/lichess-org/lila/blob/master/COPYING.md) |
| **Chessnut** | Limpio y clásico ([muestra](https://github.com/LexLuengas/chessnut-pieces/blob/master/sample.png)) | [Apache 2.0](https://github.com/LexLuengas/chessnut-pieces/blob/master/LICENSE.txt), [© 2015 Alexis Luengas](https://github.com/LexLuengas/chessnut-pieces/blob/master/COPYRIGHT.txt) | Incluir licencia, conservar avisos, señalar archivos modificados | [Repo](https://github.com/LexLuengas/chessnut-pieces) |
| **Kiwen Suwi** | Minimalista y simpático, caballo "marioneta" ([preview](https://github.com/neverRare/kiwen-suwi/blob/master/version/latest/kiwen-suwi/preview.png)) | [CC BY 4.0 para los assets](https://github.com/neverRare/kiwen-suwi#download) | Atribuir, enlazar licencia, indicar cambios | [Releases](https://github.com/neverRare/kiwen-suwi/releases). No usar [Commons](https://commons.wikimedia.org/wiki/File:Kiwen_Suwi_klt.svg): allí figura CC BY-SA 4.0 + OFL |
| **Papercut** | Sólido y contrastado, recortado; [pide tablero de bajo contraste](https://github.com/lichess-org/lila/pull/20604) | CC BY 4.0, declarado por el autor en el [PR #20604](https://github.com/lichess-org/lila/pull/20604) | Atribuir, enlazar licencia, indicar cambios | [lila](https://github.com/lichess-org/lila/tree/master/public/piece/papercut). No hay repo propio; el [itch del autor](https://nikoichu.itch.io/) no lo lista |
| **Totoy** | Geométrico y técnico, trazo fino ([imagen en PR](https://github.com/lichess-org/lila/pull/20477)) | CC BY 4.0, declarado en el [PR #20477](https://github.com/lichess-org/lila/pull/20477) | Igual que Papercut | [lila](https://github.com/lichess-org/lila/tree/master/public/piece/totoy) |

Notas:

- Papercut y Totoy aparecen en la sección "non-free" de [`COPYING.md`](https://github.com/lichess-org/lila/blob/master/COPYING.md) aunque su fila dice CC BY 4.0. Su licencia solo consta en lila, no en una fuente propia del autor: menos sólida que las demás.
- **Reserva: Firi** ([CC BY 4.0](https://github.com/jfaure/Firi-pieceset/blob/master/LICENSE.txt)), muy original (torre pagoda). Pero su [README](https://github.com/jfaure/Firi-pieceset/blob/master/README.md) admite que algunas piezas partieron de calcos de otro set de chushogi. Procedencia a revisar antes de usarlo.
- **Iconos monocromos**, para interfaz más que para el tablero: [Tabler](https://github.com/tabler/tabler-icons/blob/main/LICENSE) (MIT), [Material Design Icons](https://github.com/Templarian/MaterialDesign/blob/master/LICENSE) (Apache 2.0), [Font Awesome Free](https://github.com/FortAwesome/Font-Awesome/blob/6.x/LICENSE.txt) (CC BY 4.0).

### Evitar

| Sets | Licencia en [`COPYING.md`](https://github.com/lichess-org/lila/blob/master/COPYING.md) | Motivo |
|---|---|---|
| letter, pirouetti, pixel | AGPLv3+ | Copyleft fuerte: riesgo de arrastrar la licencia de la app |
| cburnett (copia de lila), mono, merida, mpchess | GPLv2+ / GPLv3+ | Copyleft. Merida además es incoherente: [enpassant.dk la llama "freeware"](http://www.enpassant.dk/chess/fonteng.htm) |
| horsey, california, caliente, maestro, fresca, cardinal, icpieces, gioco, tatiana, staunty, dubrovny, anarcandy, disguised, cooke, monarchy, minimal-warmth, xkcd | CC BY-NC-SA | No comercial y share-alike: impide monetizar y condiciona las adaptaciones |
| shapes; derivados coloreados de Commons como [Blue king](https://commons.wikimedia.org/wiki/File:Blue_king.svg) | CC BY-SA 4.0 / 3.0 | [Share-alike §3(b)](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en): recolorear crea material adaptado que debe compartirse igual |
| alpha | "free for personal non commercial use" | No comercial |
| chess7, companion, leipzig | "freeware" | Sin concesión escrita para redistribuir o modificar |
| reillycraig, riohacha | En blanco | Sin licencia: derechos reservados |
| shahi-ivory-brown | [Licencia propia](https://github.com/TamerKaratekin/shahi-chess-shatranj-font/blob/main/LICENSE.txt) | Permite uso comercial pero prohíbe editar: nada de recolorear |
| governor, kosal | Sin fila; [la cláusula general](https://github.com/lichess-org/lila/blob/master/COPYING.md) los deja en AGPLv3+ | Están en [el directorio](https://github.com/lichess-org/lila/tree/master/public/piece), sin autor ni excepción |
| [HollowLeaf1981/ChessPieces](https://github.com/HollowLeaf1981/ChessPieces) | MIT | Licencia válida, pero las 4 carpetas revisadas (Stone, Attack, Clash, Mars) solo contienen PNG: no son SVG |
| [Fantasy en Commons](https://commons.wikimedia.org/wiki/File:Chess_Maurizio_Monge_Fantasy_bk.svg) | [LGPL](https://commons.wikimedia.org/wiki/Template:MMChess) | Usar la versión MIT de GitHub |

### Efecto en el proyecto

- CC BY 4.0 no contagia la licencia. Exige atribuir, y [§3(a)(1)(B)](https://creativecommons.org/licenses/by/4.0/legalcode.en) indicar si se modificó (recolorear cuenta). [§2(a)(5)(B)](https://creativecommons.org/licenses/by/4.0/legalcode.en) impide añadir restricciones a quien reciba esos archivos.
- Sin LICENSE, el código propio queda con [copyright por defecto](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository). Eso no choca con estos sets.
- Recomendación: mantener un `THIRD-PARTY-NOTICES` publicado con la web y una vista de créditos. Cuando se añada LICENSE, excluir de ella las piezas.

## 2. chess.js

**Versión:** [1.4.0](https://registry.npmjs.org/chess.js/latest), `latest` en npm, publicada el [2025-06-14](https://github.com/jhlywa/chess.js/releases/tag/v1.4.0). `master` tiene [commits sin publicar](https://github.com/jhlywa/chess.js/commits/master) hasta 2026-08-11. Fijar la versión.

**Licencia:** [BSD-2-Clause](https://github.com/jhlywa/chess.js/blob/v1.4.0/LICENSE). Conservar el aviso de copyright también en distribución compilada. Incluirlo en los avisos de terceros sin depender del bundler.

**Peso** (sin dependencias en [`package.json`](https://github.com/jhlywa/chess.js/blob/v1.4.0/package.json)):

| Medida | Bruto | gzip | brotli | Fuente |
|---|---|---|---|---|
| `dist/esm/chess.js` sin minificar | 107 052 B | 23 682 B | 19 918 B | Medido sobre el tarball |
| Minificado | 35 422 B | 12 019 B | n/d | [Bundlephobia](https://bundlephobia.com/api/size?package=chess.js@1.4.0) (tercero) |

Usa [literales BigInt](https://github.com/jhlywa/chess.js/blob/v1.4.0/src/chess.ts#L720): `build.target` debe ser ES2020 o superior.

**TypeScript:** tipos incluidos en [`dist/types/chess.d.ts`](https://github.com/jhlywa/chess.js/blob/v1.4.0/package.json); no hace falta `@types`. Exporta `Chess`, `Move`, `Color`, `Piece`, `PieceSymbol`, `Square`, `SQUARES`, `DEFAULT_POSITION` y `validateFen`. `moves({ verbose: true })` devuelve `Move[]`.

### Detección de fin

Nombres exactos, según [el código](https://github.com/jhlywa/chess.js/blob/v1.4.0/src/chess.ts#L1367-L1386):

| Fin | Método | Nota verificada |
|---|---|---|
| Mate | `isCheckmate()` | Consultarlo **primero** |
| Ahogado | `isStalemate()` | Cuenta como `isDraw()` |
| Triple repetición | `isThreefoldRepetition()` | Posición vista 3 o más veces |
| Material insuficiente | `isInsufficientMaterial()` | También K+A vs K+A de mismo color (probado), que el README no cita. K+C+C y K+C vs K+C: `false` |
| Regla de 50 | `isDrawByFiftyMoves()` | `halfMoves >= 100` |
| Tablas (cualquiera) | `isDraw()` | 50, ahogado, material o repetición |
| Fin de partida | `isGameOver()` | `isCheckmate() \|\| isDraw()` |
| Jaque | `isCheck()` / `inCheck()` | No es fin de partida |

Trampas:

- **Orden:** un mate en la media jugada 100 da `isCheckmate()` **y** `isDraw()` a la vez (probado). Comprobar mate antes de clasificar tablas.
- **Tablas automáticas:** repetición y 50 terminan la partida en `isGameOver()`. Si se quisiera "reclamar tablas" hay que implementarlo aparte.
- **README desfasado:** dice que `isDraw()` cubre solo 50 y material. Su ejemplo de `isDrawByFiftyMoves()` indica `true`, pero devuelve `false` (probado): ese FEN tiene contador 0.
- Rendición, tiempo y acuerdo no existen en la librería; se fijan con `setHeader('Result', ...)` y `pgn()` los refleja (probado).

### Restaurar una Partida

| Método | `history()` | Triple repetición | `undo()` |
|---|---|---|---|
| `loadPgn(pgn)` | Completa | Funciona | Hasta el inicio |
| Replay de `move()` | Completa | Funciona | Hasta el inicio |
| `load(fen)` / `new Chess(fen)` | Vacía | **Se pierde** | `null` |

Todo probado con una repetición que se completa tras restaurar. El motivo está en el código: el recuento vive en un [`Map` privado](https://github.com/jhlywa/chess.js/blob/v1.4.0/src/chess.ts#L723) que [`load()` reinicia](https://github.com/jhlywa/chess.js/blob/v1.4.0/src/chess.ts#L752-L814), y [`loadPgn()` lo reconstruye](https://github.com/jhlywa/chess.js/blob/v1.4.0/src/chess.ts#L2204-L2213) jugada a jugada. No es serializable, así que FEN más un contador no sirve.

**Usar `pgn()` + `loadPgn()`.** En 300 medias jugadas tardó 31,5 ms frente a 66,7 ms del replay SAN (una sola ejecución en Node, orientativo). Además:

- Conserva cabeceras y comentarios.
- Una partida con inicio por FEN también se restaura: `pgn()` escribe `SetUp` y `FEN` y `undo()` vuelve a esa posición (probado).
- [`loadPgn()` lanza excepción](https://github.com/jhlywa/chess.js/blob/v1.4.0/README.md#loadpgnpgn-options) si el PGN no parsea: envolverlo en `try/catch` y tratar el guardado como posiblemente corrupto.
- `undo()` tras restaurar actualiza bien la repetición (probado: pasa a `false`, y rehacer la jugada vuelve a `true`).
- No hay `redo()` en la [API](https://github.com/jhlywa/chess.js/blob/v1.4.0/README.md#api): si se quiere rehacer, guardar las jugadas deshechas.

### `moves({ verbose: true })` para animar

Devuelve objetos [`Move`](https://github.com/jhlywa/chess.js/blob/v1.4.0/README.md#move-object-eg-when--verbose-true-): `color`, `from`, `to`, `piece`, `captured?`, `promotion?`, `san`, `lan`, `before`, `after` (FEN) y `flags`. Métodos: `isCapture()`, `isPromotion()`, `isEnPassant()`, `isKingsideCastle()`, `isQueensideCastle()`, `isBigPawn()`.

| Caso | Salida real | Qué hacer |
|---|---|---|
| Enroque corto | `from:'e1', to:'g1', piece:'k', flags:'k', san:'O-O'` | **Solo describe el rey.** Animar la torre h→f en la misma fila |
| Enroque largo | `from:'e1', to:'c1', flags:'q', san:'O-O-O'` | Torre a→d |
| Al paso | `from:'d4', to:'e3', captured:'p', flags:'e'` | `to` no es la casilla del peón capturado: es columna de `to` + fila de `from` (e4). **`isCapture()` da `false`**: usar `captured` o `isEnPassant()` |
| Coronación | Una entrada por pieza: `a7a8q`, `a7a8n`...; `piece:'p', promotion:'q', flags:'np'` (con captura `'cp'`) | Agrupar por `from`+`to` para abrir el selector |

- `move({ from, to })` sin `promotion` en una coronación **lanza excepción** (probado), igual que cualquier jugada ilegal. Usar `try/catch` o validar con `moves()`.
- `flags` está [deprecado y se retirará en 2.0.0](https://github.com/jhlywa/chess.js/blob/v1.4.0/src/chess.ts#L130-L136): usar los métodos. Ese aviso cita `isCastle`, pero no existe en 1.4.0 (probado).
- `Move.isCheck()` [está en `master`](https://github.com/jhlywa/chess.js/commit/d43e6683e), no en 1.4.0. Usar `chess.isCheck()` tras la jugada.
- Alternativa genérica: comparar los FEN `before` y `after` cubre los tres casos especiales sin lógica por tipo de jugada.
- `fen()` omite la casilla al paso si [no hay captura posible](https://github.com/jhlywa/chess.js/blob/v1.4.0/src/chess.ts#L1156-L1170): tras `e4` queda `-` (probado). No usar el FEN para saber si hubo doble avance; usar `isBigPawn()`.

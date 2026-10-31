# Prototipo desechable: dirección visual del ajedrez

Dos direcciones jugables para elegir una. Este código no llega al pull request final.

```
cd prototipo
npm install
npm run dev
```

Se abre en `http://localhost:5199/?variant=A`. La barra inferior cambia entre A y B (también con ← y →) y conserva la Partida en curso. Su botón «Escenas» lleva a una captura, un jaque, una Coronación, un jaque mate, un ahogado y un enroque, y deja activar la vista móvil y el modo sin movimiento.

## Avisos de terceros

- **Piezas de Café:** [RhosGFX](https://rhosgfx.itch.io/vector-chess-pieces), CC0 1.0. Sin modificar.
- **Piezas de Gala:** Fantasy, de [Maurizio Monge (chess-art)](https://github.com/maurimo/chess-art), MIT. Coloreadas con `scripts/colorear-fantasy.mjs`. Licencia en `public/piezas/base-fantasy/LICENSE-chess-art.txt`.
- **chess.js 1.4.0:** BSD-2-Clause.
- **Tipografías:** Baloo 2, Cinzel y Cormorant Garamond, SIL OFL 1.1.

# Ajedrez

Ajedrez web para que dos personas jueguen una Partida en el mismo dispositivo.

## Language

**Partida**:
Una sola contienda de ajedrez, desde la posición inicial hasta su Resultado.
_Avoid_: Juego, match

**Bando**:
Cada una de las dos partes de la Partida: blancas o negras.
_Avoid_: Color, jugador, equipo

**Jugada**:
El movimiento de un solo Bando. Es la unidad del Historial y de Deshacer.
_Avoid_: Medio movimiento, ply, turno

**Historial**:
La lista de las Jugadas de la Partida, en orden y escritas con figuritas de pieza.
_Avoid_: Registro, log

**Deshacer**:
Retirar la última Jugada del Historial y volver a la posición anterior. Se puede repetir hasta el inicio de la Partida, también tras su Resultado.
_Avoid_: Revertir, atrás

**Coronación**:
La elección de la pieza en la que se convierte un peón al llegar a la última fila.
_Avoid_: Promoción

**Resultado**:
La forma en que termina una Partida: jaque mate, ahogado o tablas.
_Avoid_: Final, desenlace

---
version: 1
slug: "web-src-app-tsx"
primary_target: "web/src/App.tsx"
related_targets: ["web/index.html"]
---

# Surface brief · MVP web (shell + Red de carga + Consultas)

Scope: la app completa de `web/` (shell, Red de carga, Consultas; luego Operación y Laboratorio).
Mode: Operate. Audiencia: el grupo opera la laptop proyectada; el docente evalúa a 6–8 m.
Tarea: demostrar en vivo conexión a PostgreSQL, interacción con datos y las 5 consultas.
Riesgos que el grupo nombró: parecer plantilla, ilegible a distancia, lenta o frágil en vivo,
que no se vea el SQL. Escena física: aula con luces encendidas y proyector; pizarra oscura.

## Direction contract

THESIS: La red se lee como un tablero de salidas de terminal: filas por estación, códigos en
ámbar y cifras en celdas de paleta. Rechaza el panel de admin con barra lateral y tarjetas KPI.

OWN-WORLD: Pizarra azul-negra (#0f1720) con barra superior más oscura; tinta hueso (#f2efe6);
ámbar de tablero (#f5b700) para códigos, selección y pestaña activa; verde (#2fbf71) y rojo
(#e5484d) solo para estado. Barlow Condensed para rótulos, códigos y cifras de paleta; Barlow
para texto y tablas; JetBrains Mono solo para SQL. Celdas de paleta partidas por una línea.
Estado como marca de celda fija: llena disponible, hueca ocupada, tachada averiada.

STORY: El docente ve al abrir que hay 20 estaciones con datos reales del escenario elegido; al
cambiar 1k→1M las cifras giran; cada panel dice de qué vista o consulta SQL sale y cuánto tardó
el servidor. En Consultas, Q1–Q5 y C0 son filas de salida; se ejecuta una y se ve su SQL y filas.

FIRST VIEWPORT: Barra 64 px: marca, pestañas, selector de escenario 1k/10k/100k/1M a la derecha
y estado de conexión. Bajo ella, título «Red de carga» con tira de celdas de paleta (lecturas,
sesiones, hora Lima). Izquierda: tablero de 20 estaciones (código ámbar, nombre, sesiones,
energía, facturado, conectores en celdas, estado), pie con fuente SQL y tiempo. Derecha 400 px:
detalle de la estación enfocada (puntos, conectores, tarifa); sin foco, resumen de la red.

FORM: Tablero de Salidas, candidato 7 de 7 de mi lista ordenada; seed:c589215498f0f5b9.
Firma: celdas de paleta que giran carácter a carácter al cambiar el dato (sin movimiento con
prefers-reduced-motion). Raises: fuente SQL al pie de cada panel (marketing monocromo); marca
de celda fija (horario en diapositivas); estado legible sin color (riel espectral); columnas en
celdas enteras (Crouwel); códigos en secuencia estricta (funda de catálogo); foco abre la fila
y atenúa el resto (muro de streaming).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Pantallas Operación y Laboratorio: fases 4 y 5, mismo mundo.
- Despliegue público: abierto (ver PRODUCT.md).

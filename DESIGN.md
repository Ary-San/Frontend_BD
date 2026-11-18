---
name: ElectroRuta
description: Red de carga para vehículos eléctricos leída como un tablero de salidas, sobre PostgreSQL.
colors:
  pizarra: "#0f1720"
  pizarra-barra: "#0b121a"
  pizarra-panel: "#0c141d"
  fila-foco: "#162230"
  celda: "#1b2633"
  celda-raya: "#070c12"
  raya: "#2a3746"
  raya-suave: "#18222e"
  tinta-hueso: "#f2efe6"
  tinta-tenue: "#9aa7b5"
  ambar-tablero: "#f5b700"
  verde-servicio: "#2fbf71"
  verde-servicio-tinta: "#86e6b4"
  verde-servicio-fondo: "#143326"
  rojo-falla: "#e5484d"
  rojo-falla-tinta: "#ffa3a6"
  rojo-falla-fondo: "#3a1719"
  perfil-sin: "#8b7fd4"
  perfil-btree: "#bb8900"
  perfil-hash: "#2f9fd0"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
  title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.12em"
  flap:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  mark: "2px"
  chip: "3px"
  control: "4px"
spacing:
  row: "4px"
  gutter: "10px"
  block: "22px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ambar-tablero}"
    textColor: "#111111"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 22px"
  scenario-segment:
    backgroundColor: "transparent"
    textColor: "{colors.tinta-tenue}"
    rounded: "{rounded.control}"
    padding: "7px 15px"
  scenario-segment-active:
    backgroundColor: "{colors.ambar-tablero}"
    textColor: "#111111"
  chip-servicio:
    backgroundColor: "{colors.verde-servicio-fondo}"
    textColor: "{colors.verde-servicio-tinta}"
    rounded: "{rounded.chip}"
    padding: "4px 9px"
  chip-falla:
    backgroundColor: "{colors.rojo-falla-fondo}"
    textColor: "{colors.rojo-falla-tinta}"
    rounded: "{rounded.chip}"
    padding: "4px 9px"
  input-field:
    backgroundColor: "{colors.celda}"
    textColor: "{colors.tinta-hueso}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  flap-cell:
    backgroundColor: "{colors.celda}"
    textColor: "{colors.tinta-hueso}"
    typography: "{typography.flap}"
    width: "0.74em"
---

# Design System: ElectroRuta

## Overview

**Creative North Star: "El Tablero de Salidas"**

La red de carga se lee como el tablero de vuelos de una terminal: cada estación es una fila,
cada código va en ámbar y las cifras que importan caen en celdas de paleta partidas que giran
carácter a carácter cuando el dato cambia. El tablero existe para leerse desde lejos, y eso es
lo que pide su escena real: una laptop proyectada en un aula con las luces encendidas, y un
docente que mira desde el fondo.

Es una herramienta, no un cartel. El mundo aporta tipografía de señalética condensada, paleta
de pizarra, densidad de tablero y un único gesto propio (la celda que gira); la navegación, las
pestañas, los formularios y las tablas siguen siendo los controles web que cualquiera sabe usar.
Cada panel declara al pie de qué vista o función SQL salen sus datos y cuánto tardó la respuesta.

Se rechaza explícitamente el panel de administración genérico (barra lateral, tarjetas de KPI,
fondo gris con un acento azul): el grupo pidió que no pareciera plantilla.

**Key Characteristics:**
- Pizarra azul-negra mate con tinta hueso; ámbar solo para códigos, selección y la acción principal.
- Celdas de paleta partidas para las cifras clave, alineadas a la derecha en ancho fijo.
- Estado dicho por forma y color a la vez: celda llena, hueca o tachada.
- Fuente SQL al pie de cada panel, en monoespaciada.
- Densidad de tablero: filas de ~33 px, 20 estaciones visibles a 1440×900.

## Colors

Pizarra profunda y fría, tinta hueso cálida, un ámbar de tablero y dos colores de estado que
solo aparecen donde significan algo.

### Primary
- **Ámbar de Tablero** (ambar-tablero): códigos de estación (SIM-001…) y de consulta (Q1…C0), la
  pestaña activa, el escenario elegido, la acción «Ejecutar», la marca de espera y el anillo de foco.

### Secondary
- **Verde de Servicio** (verde-servicio, con su tinta y su fondo): conector disponible, estación
  operativa, conexión viva con PostgreSQL.

### Tertiary
- **Rojo de Falla** (rojo-falla, con su tinta y su fondo): conector averiado, estación fuera de
  servicio, sin conexión, errores de PostgreSQL.

### Neutral
- **Pizarra** (pizarra): fondo de toda la app y de las cabeceras de tabla fijas.
- **Pizarra de Barra** (pizarra-barra): barra superior y bloque de SQL; un paso más oscuro.
- **Pizarra de Panel** (pizarra-panel): panel lateral de detalle.
- **Fila en Foco** (fila-foco): fila o consulta seleccionada.
- **Celda** (celda) y **Raya de Celda** (celda-raya): cara de la paleta y su corte horizontal; la
  celda también es el fondo de los campos de formulario.
- **Raya** (raya) y **Raya Suave** (raya-suave): divisiones estructurales y separadores de fila.
- **Tinta Hueso** (tinta-hueso): texto principal y dígitos de las celdas.
- **Tinta Tenue** (tinta-tenue): rótulos, texto secundario y fuente SQL (7:1 sobre la pizarra).

### Series de datos (perfiles de índices)
- **Violeta Base** (perfil-sin), **Ámbar Profundo** (perfil-btree) y **Azul Hash** (perfil-hash): una
  serie por perfil en el Laboratorio, siempre en ese orden. Paleta categórica validada sobre la
  pizarra (luminosidad 0.48–0.67, separación para daltonismo ΔE ≥ 13). El ámbar de serie es más
  oscuro que el Ámbar de Tablero para no confundirse con los códigos ni con la selección.

### Named Rules
**The Serie Fija Rule.** Cada perfil conserva su color en toda la app; los valores y rótulos van en
tinta, nunca en el color de la serie, y la columna o la leyenda siempre nombran el perfil.

**The Ámbar Escaso Rule.** El ámbar marca identidad (códigos) y la única acción principal de cada
vista. Nunca rellena superficies ni decora.

**The Estado Con Forma Rule.** Ningún estado depende solo del color: disponible es una celda llena,
ocupado una celda hueca con borde ámbar, averiado una celda tachada en rojo. El proyector lava los
colores; la forma sobrevive.

## Typography

**Display Font:** Barlow Condensed (con Arial Narrow)
**Body Font:** Barlow (con system-ui)
**Label/Mono Font:** JetBrains Mono, solo para SQL y la línea de fuente

**Character:** Una grotesca de señalética de carretera en dos anchos: la condensada habla como el
tablero (títulos, códigos, rótulos, dígitos de paleta) y la normal lee como texto y tablas. Las
tres se sirven desde el proyecto, sin depender de internet en el aula.

### Hierarchy
- **Display** (700, 44px, 0.95): el título de cada vista («Red de carga», «Consultas»).
- **Headline** (700, 34px, 1): código de la estación enfocada, títulos del panel lateral, títulos de consulta, códigos Q1…C0.
- **Title** (600, 17px, 1.25): títulos de consulta en la lista.
- **Body** (500, 16–17px, 1.4; 1.2 en tablas): nombres, valores y descripciones.
- **Label** (600, 13px, 0.12em, mayúsculas): cabeceras de columna y rótulos sobre las cifras.
- **Flap** (600, 18 / 22 / 34px, cifras tabulares): dígitos dentro de las celdas de paleta.
- **Code** (400, 13.5px, 1.55, sin ligaduras): SQL de las consultas.

### Named Rules
**The Dígito Tabular Rule.** Toda cifra que se compara va con números tabulares y alineada a la
derecha; las celdas de paleta tienen ancho fijo para que la columna no se mueva al girar.

**The Mono Solo Para SQL Rule.** La monoespaciada aparece solo donde hay código o medición (SQL,
nombre de vista, milisegundos). No es un disfraz de «técnico».

## Layout

Una barra superior de 64 px (marca, pestañas, selector de escenario 1k/10k/100k/1M y estado de
conexión) y debajo el área de trabajo de cada vista. Red de carga: tablero a la izquierda y panel
lateral de 400 px a la derecha. Consultas: lista de salidas de 440 px a la izquierda y detalle a la
derecha. Márgenes de página de 32 px; filas con 4 px de relleno vertical; bloques separados ~22 px.

Responsive, pensado para proyectores: hasta 1400 px el panel lateral baja a 340 px y la lista a
380 px; hasta 1180 px todo pasa a una columna y la lista de consultas se vuelve una fila de seis
códigos; en pantallas de menos de 800 px de alto se compactan títulos y celdas; en celular
(hasta 760 px) la barra se reparte en dos filas y las tablas se desplazan dentro de su contenedor.
Las tablas largas se desplazan dentro del área de trabajo con la cabecera fija; la página no.

## Elevation & Depth

Sin sombras. La profundidad se dice por pasos tonales de la pizarra (barra y panel más oscuros,
fila en foco más clara) y por la raya de 1 px entre zonas. La única dimensión es la de la celda de
paleta: el corte horizontal que la parte en dos, como la paleta física.

### Named Rules
**The Plano Mate Rule.** Nada flota: sin sombras, sin brillos, sin vidrio. Un tablero real es mate.

## Shapes

Esquinas casi rectas: 2 px en marcas de estado, 3 px en chips, 4 px en botones, campos, segmentos y
paneles de aviso; la celda de paleta redondea apenas (0.09em). Los bordes son de 1 px en raya; el
foco es un anillo ámbar de 2 px con 2 px de separación.

## Components

### Buttons
- **Shape:** casi recta (4px).
- **Primary («Ejecutar Q1»):** fondo ámbar, texto casi negro, rótulo condensado 18px en mayúsculas con 0.08em; relleno 10px 22px.
- **Hover / Focus:** brillo levemente mayor; al presionar baja 1 px; anillo ámbar en foco de teclado.
- **Disabled / ocupado:** se desatura y muestra «Ejecutando…».
- **Secundario (paginación):** contorno de 1px en raya, rótulo condensado; deshabilitado en gris pizarra.

### Chips
- **Estado de estación:** relleno verde para operativa, contorno ámbar para mantenimiento, rojo tachado para fuera de servicio; rótulo condensado en mayúsculas.
- **Conector:** el mismo código de estado, en caja normal («CCS2 60 kW»).

### Inputs / Fields
- **Style:** fondo de celda, borde de 1px en raya, 4px de radio, texto Barlow 17px con cifras tabulares; rótulo condensado en mayúsculas encima.
- **Focus:** anillo ámbar de 2px.

### Navigation
- **Pestañas:** rótulo condensado 18px en mayúsculas, tinta tenue; la activa en tinta hueso con subrayado ámbar de 3px.
- **Selector de escenario:** control segmentado con bordes de raya; el escenario activo relleno en ámbar.

### Celda de paleta (componente propio)
Cada carácter de una cifra clave vive en su celda: cara de celda, corte horizontal oscuro al medio,
dígito tabular en tinta hueso, ancho fijo de 0.74em y 0.08em entre celdas. Al cambiar el valor,
solo los caracteres distintos giran por dígitos al azar (45 ms por paso) y se asientan de izquierda
a derecha; con `prefers-reduced-motion` el valor cambia sin girar. Se usa en la tira de cifras de
cada vista (lecturas, sesiones, hora Lima; filas y ms de la consulta) y en la columna de sesiones.

### Matriz de medición y árbol de plan (Laboratorio)
Cada celda de la matriz consulta × perfil es un botón: valor en tinta, referencia del informe en
tinta tenue y una barra de 8 px en el color del perfil, proporcional al máximo de su fila y con
extremo redondeado de 4 px. El árbol de plan indenta los nodos con una raya de 1 px; el nodo que
usa un índice va en ámbar y su barra de tiempo propio también; el resto, en tinta tenue.

### Marca de estado (componente propio)
Rectángulo de 13×18 px: lleno en verde (disponible / conectado), hueco con borde ámbar (ocupado,
reservado, ejecutando), tachado en rojo (averiado, sin conexión, error), gris pizarra (pendiente).

## Do's and Don'ts

### Do:
- **Do** poner al pie de cada panel la vista o función SQL de la que salen los datos y el tiempo de respuesta, en monoespaciada.
- **Do** usar celdas de paleta solo para las cifras que el docente debe leer desde lejos.
- **Do** decir cada estado con forma y texto además del color.
- **Do** mantener 20 filas de estación visibles a 1440×900.
- **Do** descartar los datos de un escenario al cambiar a otro: nunca mostrar una base bajo el nombre de otra.

### Don't:
- **Don't** convertir la app en un panel de administración con barra lateral y tarjetas de KPI.
- **Don't** usar sombras, degradados decorativos o brillos de neón sobre la pizarra.
- **Don't** pasar todo el texto a celdas de paleta: la paleta es para cifras clave, no para nombres ni tablas completas.
- **Don't** mostrar un tiempo que no sea medido: el de Consultas es ida y vuelta desde el navegador y se rotula así.

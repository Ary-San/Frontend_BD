# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript en `web/`, consumiendo PostgREST (esquema `api` de PostgreSQL 18).
Sin backend propio: toda la lógica vive en SQL. Propuesto por Claude y aceptado por el grupo.

## Users

- **Grupo 10 de CS2041 Base de Datos I (UTEC, 2026-2)**: Sebastián Cadillo, Sergio Delgado y
  Ary Sánchez. Operan la app en su laptop, proyectada, mientras exponen el proyecto.
- **Docente (Wilder Nina)**: evalúa desde lejos, en la proyección. Necesita ver que la web
  está conectada a PostgreSQL, que permite interactuar con los datos y que ejecuta las cinco
  consultas del Hito 2.

## Product Purpose

MVP web de **ElectroRuta**, una red de carga para vehículos eléctricos modelada en el Proyecto
Final. Existe para ganar los puntos extra del Hito 2 (+2): una aplicación web funcional
conectada a la base de PostgreSQL, que permita la interacción con los datos y ejecute las
consultas intermedias. Éxito = durante la exposición, cada requisito se demuestra en vivo y sin
tropiezos, y el experimento de índices (sin índice / B+ / hash) se entiende mirando la pantalla.

## Positioning

No es una app comercial de carga: es una ventana a la base de datos. Muestra los datos reales de
los cuatro escenarios (1k, 10k, 100k y 1M lecturas), ejecuta exactamente las consultas medidas en
el informe y deja ver qué hace PostgreSQL por dentro (planes, buffers, índices, triggers).

## Operating Context

- Se usa proyectada en una exposición académica, desde una laptop (Windows, Docker Desktop).
- Cuatro escenarios restaurados de los dumps de la entrega final; un PostgREST por escenario
  (puertos 3001–3004 en local). El grupo cambia de escenario en vivo.
- El informe en LaTeX y el video del Hito 2 son la fuente de verdad de las cifras; la web debe
  coincidir con ellos.

## Capabilities and Constraints

- Pantallas: Estaciones, Consultas (Q1–Q5 + control), Operación (reserva → sesión → lecturas →
  cierre → pago) y Laboratorio de índices.
- Las consultas devuelven filas idénticas a `queries/q*.sql` de la entrega.
- Los errores de triggers y procedimientos se muestran con su mensaje original de PostgreSQL.
- El navegador nunca envía SQL; solo identificadores de consultas y perfiles.
- Idioma: español (Perú). Zona horaria de los datos: America/Lima.
- Datos sintéticos: estaciones `SIM-001`…, placas `SIM000001`…, correos `@example.invalid`.
- **Abierto:** despliegue público. El grupo preguntó si se puede desplegar; no está decidido.
  Un despliegue público exige proteger el laboratorio y la operación (modifican la base).

## Brand Commitments

- Nombre: **ElectroRuta** (confirmado; es el del README y del informe).

## Evidence on Hand

- Dumps: `dumps/ev_{1k,10k,100k,1m}.dump`. Consultas: `db/13_api.sql` (`lab.consulta`).
- Cifras medidas del informe: `Entrega_Final_Grupo_10/informe/main.pdf`.
- No hay logotipo, fotos ni testimonios; no inventarlos.

## Product Principles

1. Cada requisito del enunciado se demuestra con un clic, sin explicar de más.
2. Lo que muestra la web sale de PostgreSQL en ese momento; nada precalculado ni simulado.
3. Legible a distancia: la cifra que importa se ve desde el fondo del aula.
4. Fiel al informe: mismos nombres de consultas, perfiles y escenarios.

## Accessibility & Inclusion

Optimizada para laptop y proyector (pantallas anchas, contraste alto por la proyección).
En celular debe funcionar, sin diseño específico.

# ElectroRuta · MVP web

MVP web del Proyecto Final (CS2041, grupo 10), para los puntos extra del Hito 2. No hay
backend propio: **PostgREST** publica como API REST el esquema `api` de PostgreSQL, y toda la
lógica sigue en SQL (vistas, procedimientos y triggers del Hito 2).

```
navegador ──▶ nginx :8080 (web compilada) ──/api/<esc>/──▶ PostgREST ×4 ──▶ PostgreSQL 18
                                                          :3001 → ev_charge_1k
                                                          :3002 → ev_charge_10k
                                                          :3003 → ev_charge_100k
                                                          :3004 → ev_charge_1m
```

## Levantar

Solo requiere Docker Desktop (no hace falta Node). Desde esta carpeta, con un `.env` copiado de
`.env.example`:

```bash
docker compose up -d --build
```

Abrir **http://localhost:8080**. La primera vez restaura los cuatro dumps de `dumps/` (los de
`Entrega_Final_Grupo_10`), aplica `db/13_api.sql` y compila la web: alrededor de un minuto. Las
veces siguientes arranca en segundos. Para comprobar la API sola: `curl localhost:3004/rpc/info`.

**Versión pública (solo lectura).** Con `BLOQUEAR_ESCRITURA=1` en `.env`, nginx responde 403 a
todo POST: Red de carga y Consultas funcionan; Operación, las reglas y el Laboratorio muestran
«Esta versión pública es de solo lectura». Es el modo para un despliegue en internet.

## Guion para la exposición

1. Antes de empezar: `docker compose up -d`, abrir el escenario **1M**, entrar a Laboratorio y
   pulsar **Medir todo** una vez (calienta la caché; ~12 s). Ejecutar Q1–Q5 una vez en Consultas.
2. **Red de carga**: cambiar 1k → 1M y ver girar las cifras; elegir SIM-019 (sesión activa).
3. **Consultas**: Q1 y Q5 en 1M; mostrar el SQL y el pie con la fuente. Requisito del enunciado.
4. **Operación** en **1k**: reserva → sesión (volver a Red de carga y ver el punto ocupado) →
   lecturas → cierre (costos del trigger) → pago conciliado. Luego **Probar todas** las reglas.
5. **Laboratorio** en 1M: matriz frente al informe; abrir Q1 sin índices (Hash Join + Seq Scan)
   y Q1 hash (Nested Loop + Index Scan sobre `opt_lectura_instante`); estructura B+ de 3 niveles.
6. Después: `docker compose exec db bash /api/restaurar.sh 1k`.

pgAdmin puede conectarse a `localhost:5434`, usuario `postgres` y la contraseña de `.env`.
Los puertos 5432 y 5433 están ocupados por los PostgreSQL nativos de Windows.

Comandos útiles:

| Para | Comando |
|---|---|
| Reaplicar `13_api.sql` tras editarlo | `docker compose exec db bash /api/aplicar_api.sh` (desde PowerShell) |
| Devolver un escenario a su dump | `docker compose exec db bash /api/restaurar.sh 1k` (o `10k`, `100k`, `1m`) |
| Detener sin perder datos | `docker compose stop` |
| Volver a restaurar los dumps desde cero | `docker compose down -v` y luego `docker compose up -d` |

## Web (`web/`)

Para desarrollar con recarga en caliente (requiere Node), con los contenedores arriba:

```bash
cd web
npm install
npm run dev
```

Abre `http://localhost:5180`. La web llama a `/api/<escenario>/…`: en desarrollo Vite reenvía cada
ruta a su PostgREST (`vite.config.ts`) y en `:8080` lo hace nginx (`web/nginx.conf.template`).
Las fuentes se sirven desde el proyecto, así que no depende de internet en el aula.

Pantallas:

- **Red de carga**: las 20 estaciones, sus conectores y tarifas.
- **Consultas**: Q1–Q5 y el control C0, con parámetros, su SQL y las filas paginadas de 50 en 50.
  Ejecuten cada consulta una vez antes de presentar; la primera ejecución en frío tarda más.
- **Operación**: el flujo reserva → inicio de sesión → lecturas → cierre → pago con los
  procedimientos del Hito 2, más ocho **reglas de integridad** que se prueban con un botón.
  - El flujo **escribe de verdad** en la base del escenario elegido (conviene usar 1k). Para
    volver al dump: `docker compose exec db bash /api/restaurar.sh 1k` (tarda unos segundos;
    PostgREST se reconecta solo y la pantalla se limpia al detectar la base nueva).
  - Las reglas corren dentro de un bloque que siempre se revierte: no dejan datos.

- **Laboratorio**: el experimento de índices del Hito 2 en vivo.
  - Botones para cambiar de perfil (sin índices, B-tree, hash), equivalentes a `08` y luego `07` u `11`.
  - **Medir todo** recorre los 3 perfiles × (Q1–Q5, C0 y la escritura de 1 000 lecturas) con el
    protocolo del informe (2 calentamientos + 5 `EXPLAIN (ANALYZE, BUFFERS)`, mediana) y termina en
    hash, como los dumps. En 1M tarda unos 12 s.
  - Cada celda muestra la mediana medida, la del informe y una barra; al elegirla se dibuja el
    árbol del plan con el índice usado y el tiempo propio de cada nodo.
  - Abajo, la estructura física: niveles, páginas internas y hojas del árbol B+ (`pgstatindex`)
    frente a buckets del hash (`pgstathashindex`).
  - Los tiempos no van a coincidir exactamente con el informe (Docker frente a su PostgreSQL 18.6
    nativo); lo que se reproduce son los planes y las proporciones.

El diseño está documentado en `DESIGN.md`.

## API (`db/13_api.sql`)

Todas las rutas existen en los cuatro puertos. Las vistas aceptan los filtros de PostgREST
(`?limit=20`, `?cod_estacion=eq.SIM-001`, `?order=energia_kwh.desc`).

**Lectura (GET)**

| Ruta | Contenido |
|---|---|
| `/v_resumen_estacion`, `/v_disponibilidad_carga`, `/v_sesion_detalle`, `/v_tarifa_actual`, `/v_conciliacion`, `/v_usuario_completo` | Las seis vistas del Hito 2 |
| `/estaciones`, `/conectores`, `/vehiculos` | Catálogos para formularios |
| `/consultas` | Id, título y texto SQL de Q1–Q5 y del control |
| `/rpc/info` | Escenario, versión, perfil activo y conteos |

**Las cinco consultas (GET)**: el resultado es idéntico, fila por fila, al de `queries/q*.sql`
en los cuatro escenarios.

| Ruta | Parámetros (por defecto = informe) |
|---|---|
| `/rpc/q1` | — |
| `/rpc/q2`, `/rpc/q4`, `/rpc/q5` | `desde`, `hasta` (semana del 1 al 8 de marzo de 2026) |
| `/rpc/q3`, `/rpc/control_curva` | `sesion` (10) |

**Operación (POST, cuerpo JSON)**: envuelven los procedimientos; los errores de triggers llegan
como HTTP 400 con su mensaje.

| Ruta | Cuerpo |
|---|---|
| `/rpc/reservar` | `id_usuario, id_estacion, num_punto, desde, hasta` → id de reserva |
| `/rpc/iniciar_sesion` | `id_usuario, id_vehiculo, id_estacion, num_punto, num_conector, inicio, soc_inicial, id_reserva?` → id de sesión |
| `/rpc/registrar_lectura` | `id_sesion, instante, potencia_kw, energia_acumulada_kwh, soc_pct, voltaje_v, corriente_a, temperatura_bateria_c` |
| `/rpc/finalizar_sesion` | `id_sesion, fin, motivo?` → detalle de la sesión con costos |
| `/rpc/registrar_pago` | `id_sesion, monto, medio_pago, cod_autorizacion, fecha_hora` → id de pago |

| `/rpc/proximo_hueco` (GET) | `id_estacion, num_punto, minutos?` → primera hora libre del punto |
| `/rpc/simular_lecturas` | `id_sesion, cantidad?, cada_seg?` → inserta lecturas coherentes (pasan por `tg_lectura`) |

**Reglas de integridad (POST)**: `/reglas` (GET) lista los ocho casos; `/rpc/probar_regla`
`{"regla":"…"}` intenta la operación inválida con ids reales del escenario, devuelve SQLSTATE,
mensaje y SQL intentado, y la revierte siempre.

**Laboratorio de índices (POST)**

| Ruta | Qué hace |
|---|---|
| `/rpc/aplicar_perfil` `{"perfil":"sin"\|"btree"\|"hash"}` | Equivale a `08` y luego `07` u `11`, con `ANALYZE`. Modifica la base. |
| `/rpc/medir` `{"consulta":"q1"…"q5"\|"control"}` | 2 calentamientos y 5 `EXPLAIN (ANALYZE, BUFFERS)`: mediana, buffers y plan JSON |
| `/rpc/medir_escritura` | Lote de 1 000 lecturas de `12_write_overhead.sql`, revertido: no deja datos |
| `/rpc/perfil_actual`, `/rpc/indices` (GET) | Perfil e índices experimentales presentes |
| `/rpc/estructura_indices` (GET) | Niveles/páginas de cada B-tree y buckets de cada hash de `lectura_sesion` |

**Seguridad.** El navegador nunca envía SQL: `medir` solo acepta los identificadores de
`lab.consulta`, y `aplicar_perfil` solo los tres perfiles. El rol `web_anon` puede leer, pero
solo escribe a través de las funciones de `api`, que pasan por los triggers. Pensado para uso
local en la presentación: las funciones de escritura y del laboratorio son `SECURITY DEFINER`
del superusuario.

-- 13_api.sql · Capa SQL que consume el MVP web.
-- PostgREST expone únicamente el esquema api. El esquema lab guarda el texto exacto de las
-- consultas medidas en el informe. No modifica tablas, triggers ni datos de 00–12.
-- Reaplicable: elimina y recrea api y lab.
\set ON_ERROR_STOP on
SET client_min_messages = warning;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_anon') THEN
    CREATE ROLE web_anon NOLOGIN;
  END IF;
END $$;

DROP SCHEMA IF EXISTS api CASCADE;
DROP SCHEMA IF EXISTS lab CASCADE;
CREATE SCHEMA api;
CREATE SCHEMA lab;

-- La web lee directamente (vistas y consultas). Escribe solo por funciones SECURITY DEFINER,
-- así que los triggers del Hito 2 siguen validando cada operación.
GRANT USAGE ON SCHEMA public TO web_anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO web_anon;
GRANT USAGE ON SCHEMA api TO web_anon;

---------------------------------------------------------------------------------------------
-- 1. Lectura: vistas del Hito 2 y catálogos para formularios
---------------------------------------------------------------------------------------------
CREATE VIEW api.v_resumen_estacion     AS SELECT * FROM public.v_resumen_estacion;
CREATE VIEW api.v_disponibilidad_carga AS SELECT * FROM public.v_disponibilidad_carga;
CREATE VIEW api.v_sesion_detalle       AS SELECT * FROM public.v_sesion_detalle;
CREATE VIEW api.v_tarifa_actual        AS SELECT * FROM public.v_tarifa_actual;
CREATE VIEW api.v_conciliacion         AS SELECT * FROM public.v_conciliacion;
CREATE VIEW api.v_usuario_completo     AS SELECT * FROM public.v_usuario_completo;

CREATE VIEW api.estaciones AS
SELECT id_estacion, cod_estacion, nombre, direccion, distrito, ciudad, latitud, longitud,
       potencia_contratada_kw, estado, hora_apertura, hora_cierre
FROM public.estacion;

CREATE VIEW api.conectores AS
SELECT c.id_estacion, e.cod_estacion, c.num_punto, p.etiqueta, p.corriente AS corriente_punto,
       p.estado_operativo, c.num_conector, t.id_tipo_conector, t.nombre AS tipo,
       t.corriente AS corriente_conector, c.potencia_max_kw, c.estado
FROM public.conector c
JOIN public.punto_carga p USING (id_estacion, num_punto)
JOIN public.estacion e USING (id_estacion)
JOIN public.tipo_conector t USING (id_tipo_conector);

CREATE VIEW api.vehiculos AS
SELECT v.id_vehiculo, v.placa, v.id_usuario, u.email, u.estado AS estado_usuario,
       v.id_modelo, m.marca, m.modelo, v.activo
FROM public.vehiculo v
JOIN public.modelo_vehiculo m USING (id_modelo)
JOIN public.usuario u USING (id_usuario);

---------------------------------------------------------------------------------------------
-- 2. Las cinco consultas del Hito 2 (pantalla Consultas), parametrizadas.
--    Los valores por defecto reproducen exactamente queries/q*.sql.
---------------------------------------------------------------------------------------------
CREATE FUNCTION api.q1()
RETURNS TABLE (id_sesion bigint, instante timestamptz, temp_antes numeric, temp_despues numeric)
LANGUAGE sql STABLE AS $$
SELECT a.id_sesion, a.instante,
       a.temperatura_bateria_c AS temp_antes,
       b.temperatura_bateria_c AS temp_despues
FROM lectura_sesion a
JOIN lectura_sesion b
  ON b.instante = a.instante + interval '30 seconds'
 AND b.id_sesion = a.id_sesion
WHERE a.temperatura_bateria_c >= 40
  AND b.temperatura_bateria_c - a.temperatura_bateria_c >= 1
ORDER BY a.id_sesion, a.instante
$$;

CREATE FUNCTION api.q2(desde timestamptz DEFAULT '2026-03-01 00:00-05',
                       hasta timestamptz DEFAULT '2026-03-08 00:00-05')
RETURNS TABLE (id_usuario int, email varchar, placa varchar, marca varchar, modelo varchar,
               sesiones bigint, energia_kwh numeric, facturado_pen numeric)
LANGUAGE sql STABLE AS $$
SELECT u.id_usuario,u.email,v.placa,m.marca,m.modelo,count(*) sesiones,
 sum(s.energia_kwh) energia_kwh,sum(s.costo_total) facturado_pen
FROM sesion_carga s JOIN usuario u ON u.id_usuario=s.id_usuario
JOIN vehiculo v USING(id_vehiculo) JOIN modelo_vehiculo m USING(id_modelo)
WHERE s.estado='FINALIZADA' AND s.inicio>=desde AND s.inicio<hasta
GROUP BY u.id_usuario,v.id_vehiculo,m.id_modelo ORDER BY energia_kwh DESC,u.id_usuario,v.placa LIMIT 10
$$;

CREATE FUNCTION api.q3(sesion bigint DEFAULT 10)
RETURNS TABLE (instante timestamptz, potencia_kw numeric, soc_pct smallint,
               temperatura_bateria_c numeric, id_sesion bigint, cod_estacion varchar,
               placa varchar, modelo varchar, delta_kwh numeric, media_movil_kw numeric,
               subida_c_por_minuto numeric)
LANGUAGE sql STABLE AS $$
WITH curva AS (
 SELECT l.*,
        lag(instante) OVER w AS instante_anterior,
        lag(energia_acumulada_kwh) OVER w AS energia_anterior,
        lag(temperatura_bateria_c) OVER w AS temperatura_anterior,
        avg(potencia_kw) OVER (
          ORDER BY instante ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) AS potencia_media_3
 FROM lectura_sesion l
 WHERE id_sesion = sesion
 WINDOW w AS (ORDER BY instante)
)
SELECT c.instante, c.potencia_kw, c.soc_pct, c.temperatura_bateria_c,
       s.id_sesion, e.cod_estacion, v.placa, m.modelo,
       c.energia_acumulada_kwh - c.energia_anterior AS delta_kwh,
       round(c.potencia_media_3, 2) AS media_movil_kw,
       round(60 * (c.temperatura_bateria_c - c.temperatura_anterior)
         / nullif(extract(epoch FROM c.instante-c.instante_anterior), 0), 3)
         AS subida_c_por_minuto
FROM curva c
JOIN sesion_carga s USING (id_sesion)
JOIN estacion e USING (id_estacion)
JOIN vehiculo v USING (id_vehiculo)
JOIN modelo_vehiculo m USING (id_modelo)
ORDER BY c.instante
$$;

CREATE FUNCTION api.q4(desde timestamptz DEFAULT '2026-03-01 00:00-05',
                       hasta timestamptz DEFAULT '2026-03-08 00:00-05')
RETURNS TABLE (cod_estacion varchar, reservas bigint, consumidas bigint, no_consumidas bigint,
               con_sesion bigint, conversion_pct numeric)
LANGUAGE sql STABLE AS $$
SELECT e.cod_estacion,count(*) reservas,
 count(*) FILTER(WHERE r.estado='CONSUMIDA') consumidas,
 count(*) FILTER(WHERE r.estado IN ('CANCELADA','EXPIRADA')) no_consumidas,
 count(s.id_sesion) con_sesion,round(100.0*count(s.id_sesion)/count(*),2) conversion_pct
FROM reserva r JOIN estacion e USING(id_estacion)
LEFT JOIN sesion_carga s ON s.id_reserva=r.id_reserva
WHERE r.inicio_previsto>=desde AND r.inicio_previsto<hasta
GROUP BY e.id_estacion ORDER BY conversion_pct DESC,e.cod_estacion
$$;

CREATE FUNCTION api.q5(desde timestamptz DEFAULT '2026-03-01 00:00-05',
                       hasta timestamptz DEFAULT '2026-03-08 00:00-05')
RETURNS TABLE (id_sesion bigint, cod_estacion varchar, num_punto smallint, estandar varchar,
               placa varchar, pico_kw numeric, media_kw numeric, temperatura_max_c numeric,
               muestras bigint)
LANGUAGE sql STABLE AS $$
WITH telemetria AS (
 SELECT id_sesion,max(potencia_kw) pico_kw,round(avg(potencia_kw),2) media_kw,
 max(temperatura_bateria_c) temperatura_max_c,count(*) muestras
 FROM lectura_sesion
 WHERE instante>=desde AND instante<hasta
 GROUP BY id_sesion
 HAVING max(potencia_kw)>=45 OR max(temperatura_bateria_c)>=40
)
SELECT s.id_sesion,e.cod_estacion,s.num_punto,t.nombre estandar,v.placa,
 l.pico_kw,l.media_kw,l.temperatura_max_c,l.muestras
FROM telemetria l JOIN sesion_carga s USING(id_sesion)
JOIN estacion e USING(id_estacion) JOIN conector c USING(id_estacion,num_punto,num_conector)
JOIN tipo_conector t USING(id_tipo_conector) JOIN vehiculo v USING(id_vehiculo)
ORDER BY l.pico_kw DESC,s.id_sesion
$$;

CREATE FUNCTION api.control_curva(sesion bigint DEFAULT 10)
RETURNS TABLE (instante timestamptz, potencia_kw numeric, soc_pct smallint,
               temperatura_bateria_c numeric)
LANGUAGE sql STABLE AS $$
SELECT instante, potencia_kw, soc_pct, temperatura_bateria_c
FROM lectura_sesion
WHERE id_sesion = sesion
ORDER BY instante
$$;

---------------------------------------------------------------------------------------------
-- 3. Operación: envoltorios de los cuatro procedimientos (PostgREST no ejecuta CALL).
--    Los errores de triggers y procedimientos llegan a la web con su mensaje original.
---------------------------------------------------------------------------------------------
CREATE FUNCTION api.reservar(id_usuario int, id_estacion int, num_punto smallint,
                             desde timestamptz, hasta timestamptz)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r bigint;
BEGIN
  CALL reservar_punto(id_usuario, id_estacion, num_punto, desde, hasta, r);
  RETURN r;
END $$;

CREATE FUNCTION api.iniciar_sesion(id_usuario int, id_vehiculo int, id_estacion int,
                                   num_punto smallint, num_conector smallint,
                                   inicio timestamptz, soc_inicial smallint,
                                   id_reserva bigint DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s bigint;
BEGIN
  CALL public.iniciar_sesion(id_usuario, id_vehiculo, id_estacion, num_punto, num_conector,
                             inicio, soc_inicial, id_reserva, s);
  RETURN s;
END $$;

CREATE FUNCTION api.registrar_lectura(id_sesion bigint, instante timestamptz, potencia_kw numeric,
                                      energia_acumulada_kwh numeric, soc_pct smallint,
                                      voltaje_v numeric, corriente_a numeric,
                                      temperatura_bateria_c numeric)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
INSERT INTO lectura_sesion(id_sesion, instante, potencia_kw, energia_acumulada_kwh, soc_pct,
                           voltaje_v, corriente_a, temperatura_bateria_c)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
$$;

CREATE FUNCTION api.finalizar_sesion(id_sesion bigint, fin timestamptz,
                                     motivo varchar DEFAULT 'USUARIO')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  CALL public.finalizar_sesion(id_sesion, fin, motivo);
  RETURN (SELECT to_json(d) FROM v_sesion_detalle d WHERE d.id_sesion = finalizar_sesion.id_sesion);
END $$;

CREATE FUNCTION api.registrar_pago(id_sesion bigint, monto numeric, medio_pago varchar,
                                   cod_autorizacion varchar, fecha_hora timestamptz)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE p bigint;
BEGIN
  CALL public.registrar_pago(id_sesion, monto, medio_pago, cod_autorizacion, fecha_hora, p);
  RETURN p;
END $$;

-- Primer horario libre (en horas enteras, desde la próxima hora) para reservar un punto: sin
-- reservas activas ni sesiones que se crucen. Evita que la demo choque consigo misma.
CREATE FUNCTION api.proximo_hueco(id_estacion int, num_punto smallint, minutos int DEFAULT 60)
RETURNS timestamptz LANGUAGE sql STABLE AS $$
SELECT h
FROM generate_series(date_trunc('hour', now()) + interval '1 hour',
                     date_trunc('hour', now()) + interval '14 days', interval '1 hour') h
WHERE NOT EXISTS (SELECT 1 FROM reserva r
                  WHERE r.id_estacion = $1 AND r.num_punto = $2 AND r.estado IN ('PENDIENTE','CONFIRMADA')
                    AND tstzrange(r.inicio_previsto, r.fin_previsto, '[)') && tstzrange(h, h + make_interval(mins => $3), '[)'))
  AND NOT EXISTS (SELECT 1 FROM sesion_carga s
                  WHERE s.id_estacion = $1 AND s.num_punto = $2
                    AND tstzrange(s.inicio, s.fin, '[)') && tstzrange(h, h + make_interval(mins => $3), '[)'))
ORDER BY h
LIMIT 1
$$;

-- Inserta lecturas coherentes después de la última de la sesión: potencia al 85 % del límite
-- conector/vehículo, energía y SOC crecientes. Cada fila pasa por el trigger lectura_integridad.
CREATE FUNCTION api.simular_lecturas(id_sesion bigint, cantidad int DEFAULT 10, cada_seg int DEFAULT 60)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  s sesion_carga; lim numeric; pot numeric;
  t0 timestamptz; e0 numeric; soc0 int; temp0 numeric;
BEGIN
  IF cantidad NOT BETWEEN 1 AND 120 OR cada_seg NOT BETWEEN 10 AND 600 THEN
    RAISE EXCEPTION 'Use entre 1 y 120 lecturas, separadas entre 10 y 600 segundos' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO s FROM sesion_carga sc WHERE sc.id_sesion = simular_lecturas.id_sesion;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesión inexistente' USING ERRCODE = '22023'; END IF;

  SELECT least(c.potencia_max_kw, k.potencia_max_admitida_kw) INTO lim
  FROM conector c
  JOIN vehiculo v ON v.id_vehiculo = s.id_vehiculo
  JOIN compatibilidad k ON k.id_modelo = v.id_modelo AND k.id_tipo_conector = c.id_tipo_conector
  WHERE (c.id_estacion, c.num_punto, c.num_conector) = (s.id_estacion, s.num_punto, s.num_conector);
  pot := round(coalesce(lim, 7) * 0.85, 2);

  SELECT l.instante, l.energia_acumulada_kwh, l.soc_pct, l.temperatura_bateria_c
    INTO t0, e0, soc0, temp0
  FROM lectura_sesion l WHERE l.id_sesion = s.id_sesion ORDER BY l.instante DESC LIMIT 1;
  t0 := coalesce(t0, s.inicio); e0 := coalesce(e0, 0); soc0 := coalesce(soc0, s.soc_inicial); temp0 := coalesce(temp0, 28);

  INSERT INTO lectura_sesion (id_sesion, instante, potencia_kw, energia_acumulada_kwh, soc_pct,
                              voltaje_v, corriente_a, temperatura_bateria_c)
  SELECT s.id_sesion, t0 + make_interval(secs => i * cada_seg), pot,
         round(e0 + pot * i * cada_seg / 3600.0, 3), least(100, soc0 + i), 400,
         round(pot * 1000 / 400, 2), least(60, round(temp0 + i * 0.15, 2))
  FROM generate_series(1, cantidad) i;

  RETURN (SELECT json_build_object(
            'id_sesion', s.id_sesion, 'insertadas', cantidad, 'total', count(*),
            'ultima', max(l.instante), 'energia_kwh', max(l.energia_acumulada_kwh),
            'soc_pct', max(l.soc_pct), 'potencia_kw', pot, 'temperatura_c', max(l.temperatura_bateria_c))
          FROM lectura_sesion l WHERE l.id_sesion = s.id_sesion);
END $$;

---------------------------------------------------------------------------------------------
-- 3b. Reglas de integridad: cada caso intenta una operación inválida dentro de un bloque que
--     siempre se revierte y devuelve lo que respondió PostgreSQL. No deja datos.
---------------------------------------------------------------------------------------------
CREATE TABLE lab.regla (
  id          text PRIMARY KEY,
  orden       smallint NOT NULL,
  titulo      text NOT NULL,
  mecanismo   text NOT NULL
);

INSERT INTO lab.regla VALUES
('reserva_pasada',      1, 'Reservar en un horario que ya pasó',               'Procedimiento reservar_punto'),
('reserva_solapada',    2, 'Dos reservas activas del mismo punto que se cruzan', 'EXCLUDE USING gist en reserva'),
('conector_corriente',  3, 'Conector AC en un punto de carga DC',                'Trigger conector_integridad · tg_conector()'),
('vehiculo_incompatible', 4, 'Cargar un vehículo en un conector incompatible',   'Trigger sesion_integridad · tg_sesion()'),
('lectura_soc',         5, 'Lectura con SOC menor al inicial de la sesión',      'Trigger lectura_integridad · tg_lectura()'),
('lectura_inmutable',   6, 'Modificar una lectura ya registrada',                'Trigger lectura_integridad · tg_lectura()'),
('pago_sobrepago',      7, 'Pagar más que el costo total de la sesión',          'Trigger pago_integridad · tg_pago()'),
('usuario_sin_subclase', 8, 'Usuario sin su subclase particular o flota',        'Constraint trigger diferido usuario_total');

CREATE VIEW api.reglas AS SELECT id, orden, titulo, mecanismo FROM lab.regla ORDER BY orden;

-- Arma las sentencias de cada caso con ids reales del escenario. NULL = no hay datos para armarlo.
CREATE FUNCTION lab.sentencias(regla text)
RETURNS text[] LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE
  u int; v int; e int; p smallint; c smallint; n smallint; t int; x record;
  h timestamptz := date_trunc('hour', now());
BEGIN
  SELECT id_usuario INTO u FROM usuario WHERE estado = 'ACTIVO' ORDER BY id_usuario LIMIT 1;
  SELECT pc.id_estacion, pc.num_punto INTO e, p
  FROM punto_carga pc JOIN estacion es USING (id_estacion)
  WHERE es.estado = 'OPERATIVA' AND pc.estado_operativo = 'DISPONIBLE'
  ORDER BY pc.id_estacion, pc.num_punto LIMIT 1;

  CASE regla
  WHEN 'reserva_pasada' THEN
    RETURN ARRAY[format('CALL reservar_punto(%s, %s, %s::smallint, %L, %L, NULL)',
                        u, e, p, h - interval '2 hours', h - interval '1 hour')];
  WHEN 'reserva_solapada' THEN
    h := api.proximo_hueco(e, p, 90);
    RETURN ARRAY[
      format('CALL reservar_punto(%s, %s, %s::smallint, %L, %L, NULL)', u, e, p, h, h + interval '1 hour'),
      format('CALL reservar_punto(%s, %s, %s::smallint, %L, %L, NULL)', u, e, p, h + interval '30 minutes', h + interval '90 minutes')];
  WHEN 'conector_corriente' THEN
    SELECT pc.id_estacion, pc.num_punto, coalesce(max(co.num_conector), 0) + 1 AS siguiente INTO x
    FROM punto_carga pc LEFT JOIN conector co USING (id_estacion, num_punto)
    WHERE pc.corriente = 'DC' GROUP BY 1, 2 ORDER BY 1, 2 LIMIT 1;
    SELECT id_tipo_conector INTO t FROM tipo_conector WHERE corriente = 'AC' ORDER BY id_tipo_conector LIMIT 1;
    IF x IS NULL OR t IS NULL THEN RETURN NULL; END IF;
    RETURN ARRAY[format('INSERT INTO conector (id_estacion, num_punto, num_conector, id_tipo_conector, potencia_max_kw, longitud_cable_m, estado) VALUES (%s, %s, %s, %s, 22, 5, %L)',
                        x.id_estacion, x.num_punto, x.siguiente, t, 'DISPONIBLE')];
  WHEN 'vehiculo_incompatible' THEN
    SELECT ve.id_vehiculo, ve.id_usuario, co.id_estacion, co.num_punto, co.num_conector INTO x
    FROM vehiculo ve
    JOIN usuario us ON us.id_usuario = ve.id_usuario AND us.estado = 'ACTIVO'
    JOIN conector co ON co.estado = 'DISPONIBLE'
    JOIN punto_carga pc ON pc.id_estacion = co.id_estacion AND pc.num_punto = co.num_punto AND pc.estado_operativo = 'DISPONIBLE'
    WHERE ve.activo
      AND NOT EXISTS (SELECT 1 FROM compatibilidad k WHERE k.id_modelo = ve.id_modelo AND k.id_tipo_conector = co.id_tipo_conector)
      AND EXISTS (SELECT 1 FROM tarifa_vigente tv WHERE tv.id_estacion = co.id_estacion AND tv.id_tipo_conector = co.id_tipo_conector
                  AND tstzrange(tv.vigente_desde, tv.vigente_hasta, '[)') @> (h + interval '1 day'))
    ORDER BY ve.id_vehiculo, co.id_estacion, co.num_punto, co.num_conector LIMIT 1;
    IF x IS NULL THEN RETURN NULL; END IF;
    RETURN ARRAY[format('CALL iniciar_sesion(%s, %s, %s, %s::smallint, %s::smallint, %L, 20::smallint, NULL, NULL)',
                        x.id_usuario, x.id_vehiculo, x.id_estacion, x.num_punto, x.num_conector, h + interval '1 day')];
  WHEN 'lectura_soc' THEN
    SELECT s.id_sesion, s.soc_inicial, greatest(s.inicio, max(l.instante)) + interval '1 minute' AS t,
           coalesce(max(l.energia_acumulada_kwh), 0) AS en INTO x
    FROM sesion_carga s LEFT JOIN lectura_sesion l USING (id_sesion)
    WHERE s.fin IS NULL AND s.soc_inicial > 0 GROUP BY s.id_sesion ORDER BY s.id_sesion DESC LIMIT 1;
    IF x IS NULL THEN RETURN NULL; END IF;
    RETURN ARRAY[format('INSERT INTO lectura_sesion VALUES (%s, %L, 10, %s, %s, 400, 25, 30)',
                        x.id_sesion, x.t, x.en, x.soc_inicial - 1)];
  WHEN 'lectura_inmutable' THEN
    SELECT id_sesion, instante INTO x FROM lectura_sesion ORDER BY id_sesion, instante LIMIT 1;
    IF x IS NULL THEN RETURN NULL; END IF;
    RETURN ARRAY[format('UPDATE lectura_sesion SET potencia_kw = 0 WHERE id_sesion = %s AND instante = %L', x.id_sesion, x.instante)];
  WHEN 'pago_sobrepago' THEN
    SELECT id_sesion, costo_total, fin INTO x FROM sesion_carga
    WHERE estado = 'FINALIZADA' AND costo_total > 0 ORDER BY id_sesion LIMIT 1;
    IF x IS NULL THEN RETURN NULL; END IF;
    RETURN ARRAY[format('CALL registrar_pago(%s, %s, %L, %L, %L, NULL)',
                        x.id_sesion, x.costo_total + 100, 'TARJETA', 'PRUEBA-SOBREPAGO', x.fin + interval '1 hour')];
  WHEN 'usuario_sin_subclase' THEN
    RETURN ARRAY[
      format('INSERT INTO usuario (email, hash_password, tipo_usuario, fecha_registro, estado, saldo_monedero) VALUES (%L, %L, %L, now(), %L, 0)',
             'prueba.web@example.invalid', 'x', 'PART', 'ACTIVO'),
      'SET CONSTRAINTS usuario_total IMMEDIATE'];
  ELSE
    RETURN NULL;
  END CASE;
END $$;

CREATE FUNCTION api.probar_regla(regla text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r lab.regla; q text[]; s text;
  rechazada boolean; estado text; mensaje text; restriccion text;
BEGIN
  SELECT * INTO r FROM lab.regla lr WHERE lr.id = probar_regla.regla;
  IF NOT FOUND THEN RAISE EXCEPTION 'Regla desconocida: %', probar_regla.regla USING ERRCODE = '22023'; END IF;
  q := lab.sentencias(r.id);
  IF q IS NULL THEN
    RETURN json_build_object('regla', r.id, 'titulo', r.titulo, 'mecanismo', r.mecanismo, 'sql', NULL,
      'rechazada', NULL, 'mensaje', 'No hay datos en ' || current_database() || ' para armar este caso.');
  END IF;

  BEGIN
    FOREACH s IN ARRAY q LOOP
      EXECUTE s;
    END LOOP;
    rechazada := false;
    RAISE EXCEPTION USING ERRCODE = 'LB002';   -- también se revierte si PostgreSQL lo aceptó
  EXCEPTION
    WHEN SQLSTATE 'LB002' THEN NULL;
    WHEN OTHERS THEN
      rechazada := true;
      GET STACKED DIAGNOSTICS estado = RETURNED_SQLSTATE, mensaje = MESSAGE_TEXT, restriccion = CONSTRAINT_NAME;
  END;

  RETURN json_build_object(
    'regla', r.id, 'titulo', r.titulo, 'mecanismo', r.mecanismo,
    'sql', array_to_string(q, E';\n') || ';',
    'rechazada', rechazada, 'sqlstate', estado, 'mensaje', mensaje,
    'restriccion', nullif(restriccion, ''), 'escenario', current_database());
END $$;

---------------------------------------------------------------------------------------------
-- 4. Laboratorio de índices
---------------------------------------------------------------------------------------------
-- Texto exacto de queries/q*.sql: lo que se mide es lo mismo que en el informe.
CREATE TABLE lab.consulta (
  id     text PRIMARY KEY,
  orden  smallint NOT NULL,
  titulo text NOT NULL,
  sql    text NOT NULL
);

INSERT INTO lab.consulta VALUES
('q1', 1, 'Saltos térmicos entre lecturas consecutivas', $q$SELECT a.id_sesion, a.instante,
       a.temperatura_bateria_c AS temp_antes,
       b.temperatura_bateria_c AS temp_despues
FROM lectura_sesion a
JOIN lectura_sesion b
  ON b.instante = a.instante + interval '30 seconds'
 AND b.id_sesion = a.id_sesion
WHERE a.temperatura_bateria_c >= 40
  AND b.temperatura_bateria_c - a.temperatura_bateria_c >= 1
ORDER BY a.id_sesion, a.instante$q$),
('q2', 2, 'Usuarios y vehículos de mayor consumo', $q$SELECT u.id_usuario,u.email,v.placa,m.marca,m.modelo,count(*) sesiones,
 sum(s.energia_kwh) energia_kwh,sum(s.costo_total) facturado_pen
FROM sesion_carga s JOIN usuario u ON u.id_usuario=s.id_usuario
JOIN vehiculo v USING(id_vehiculo) JOIN modelo_vehiculo m USING(id_modelo)
WHERE s.estado='FINALIZADA' AND s.inicio>='2026-03-01 00:00-05' AND s.inicio<'2026-03-08 00:00-05'
GROUP BY u.id_usuario,v.id_vehiculo,m.id_modelo ORDER BY energia_kwh DESC,u.id_usuario,v.placa LIMIT 10$q$),
('q3', 3, 'Curva de la sesión 10 con diferencias y media móvil', $q$WITH curva AS (
 SELECT l.*,
        lag(instante) OVER w AS instante_anterior,
        lag(energia_acumulada_kwh) OVER w AS energia_anterior,
        lag(temperatura_bateria_c) OVER w AS temperatura_anterior,
        avg(potencia_kw) OVER (
          ORDER BY instante ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) AS potencia_media_3
 FROM lectura_sesion l
 WHERE id_sesion = 10
 WINDOW w AS (ORDER BY instante)
)
SELECT c.instante, c.potencia_kw, c.soc_pct, c.temperatura_bateria_c,
       s.id_sesion, e.cod_estacion, v.placa, m.modelo,
       c.energia_acumulada_kwh - c.energia_anterior AS delta_kwh,
       round(c.potencia_media_3, 2) AS media_movil_kw,
       round(60 * (c.temperatura_bateria_c - c.temperatura_anterior)
         / nullif(extract(epoch FROM c.instante-c.instante_anterior), 0), 3)
         AS subida_c_por_minuto
FROM curva c
JOIN sesion_carga s USING (id_sesion)
JOIN estacion e USING (id_estacion)
JOIN vehiculo v USING (id_vehiculo)
JOIN modelo_vehiculo m USING (id_modelo)
ORDER BY c.instante$q$),
('q4', 4, 'Conversión de reservas en sesiones', $q$SELECT e.cod_estacion,count(*) reservas,
 count(*) FILTER(WHERE r.estado='CONSUMIDA') consumidas,
 count(*) FILTER(WHERE r.estado IN ('CANCELADA','EXPIRADA')) no_consumidas,
 count(s.id_sesion) con_sesion,round(100.0*count(s.id_sesion)/count(*),2) conversion_pct
FROM reserva r JOIN estacion e USING(id_estacion)
LEFT JOIN sesion_carga s ON s.id_reserva=r.id_reserva
WHERE r.inicio_previsto>='2026-03-01 00:00-05' AND r.inicio_previsto<'2026-03-08 00:00-05'
GROUP BY e.id_estacion ORDER BY conversion_pct DESC,e.cod_estacion$q$),
('q5', 5, 'Picos de telemetría por sesión', $q$WITH telemetria AS (
 SELECT id_sesion,max(potencia_kw) pico_kw,round(avg(potencia_kw),2) media_kw,
 max(temperatura_bateria_c) temperatura_max_c,count(*) muestras
 FROM lectura_sesion
 WHERE instante>='2026-03-01 00:00-05' AND instante<'2026-03-08 00:00-05'
 GROUP BY id_sesion
 HAVING max(potencia_kw)>=45 OR max(temperatura_bateria_c)>=40
)
SELECT s.id_sesion,e.cod_estacion,s.num_punto,t.nombre estandar,v.placa,
 l.pico_kw,l.media_kw,l.temperatura_max_c,l.muestras
FROM telemetria l JOIN sesion_carga s USING(id_sesion)
JOIN estacion e USING(id_estacion) JOIN conector c USING(id_estacion,num_punto,num_conector)
JOIN tipo_conector t USING(id_tipo_conector) JOIN vehiculo v USING(id_vehiculo)
ORDER BY l.pico_kw DESC,s.id_sesion$q$),
('control', 6, 'Control: curva de la sesión 10 (igualdad pura)', $q$SELECT instante, potencia_kw, soc_pct, temperatura_bateria_c
FROM lectura_sesion
WHERE id_sesion = 10
ORDER BY instante$q$);

CREATE VIEW api.consultas AS SELECT id, orden, titulo, sql FROM lab.consulta ORDER BY orden;

-- Perfil activo, según los índices experimentales presentes (mismos nombres que 07/08/11).
CREATE FUNCTION api.perfil_actual()
RETURNS text LANGUAGE sql STABLE AS $$
SELECT CASE
  WHEN NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
                   AND indexname IN ('opt_sesion_periodo','opt_reserva_periodo',
                                     'opt_lectura_instante','opt_lectura_sesion',
                                     'opt_incidencia_periodo','opt_lectura_periodo'))
    THEN 'sin'
  WHEN (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'
        AND indexname IN ('opt_lectura_instante','opt_lectura_sesion')
        AND indexdef LIKE '%USING hash%') = 2
    THEN 'hash'
  WHEN (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'
        AND indexname IN ('opt_lectura_instante','opt_lectura_sesion')
        AND indexdef LIKE '%USING btree%') = 2
    THEN 'btree'
  ELSE 'mixto'
END
$$;

CREATE FUNCTION api.indices()
RETURNS TABLE (indice name, tabla name, metodo name, tamano_bytes bigint, definicion text)
LANGUAGE sql STABLE AS $$
SELECT i.relname, t.relname, am.amname, pg_relation_size(i.oid), pg_get_indexdef(i.oid)
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class t ON t.oid = x.indrelid
JOIN pg_am am ON am.oid = i.relam
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND i.relname LIKE 'opt\_%'
ORDER BY t.relname, i.relname
$$;

-- Estructura física de los índices de lectura_sesion: niveles y páginas del árbol B+ frente a
-- buckets del hash (extensión estándar pgstattuple). Incluye la PK, que existe en todo perfil.
CREATE EXTENSION IF NOT EXISTS pgstattuple;

CREATE FUNCTION api.estructura_indices()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE i record; out json[] := '{}'; b record; h record;
BEGIN
  FOR i IN
    SELECT c.oid, c.relname, am.amname
    FROM pg_index x JOIN pg_class c ON c.oid = x.indexrelid JOIN pg_am am ON am.oid = c.relam
    WHERE x.indrelid = 'public.lectura_sesion'::regclass
    ORDER BY (c.relname = 'lectura_sesion_pkey') DESC, c.relname
  LOOP
    IF i.amname = 'btree' THEN
      SELECT * INTO b FROM pgstatindex(i.oid::regclass);
      out := out || json_build_object('indice', i.relname, 'metodo', 'btree',
        'tamano_bytes', b.index_size, 'niveles', b.tree_level + 1, 'internas', b.internal_pages,
        'hojas', b.leaf_pages, 'densidad_hojas', round(b.avg_leaf_density::numeric, 1));
    ELSIF i.amname = 'hash' THEN
      SELECT * INTO h FROM pgstathashindex(i.oid::regclass);
      out := out || json_build_object('indice', i.relname, 'metodo', 'hash',
        'tamano_bytes', pg_relation_size(i.oid), 'buckets', h.bucket_pages, 'overflow', h.overflow_pages,
        'entradas', h.live_items, 'libre_pct', round(h.free_percent::numeric, 1));
    END IF;
  END LOOP;
  RETURN json_build_object('escenario', current_database(), 'filas', (SELECT count(*) FROM lectura_sesion), 'indices', out);
END $$;

-- Equivale a ejecutar 08_drop_secondary_indexes.sql y luego 07_indexes.sql (btree)
-- u 11_indexes_hash.sql (hash). 'sin' deja solo PK, UNIQUE y EXCLUDE.
CREATE FUNCTION api.aplicar_perfil(perfil text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE t0 timestamptz := clock_timestamp();
BEGIN
  IF perfil NOT IN ('sin', 'btree', 'hash') THEN
    RAISE EXCEPTION 'Perfil desconocido: % (use sin, btree o hash)', perfil USING ERRCODE = '22023';
  END IF;
  -- Un solo cambio de perfil a la vez por base.
  PERFORM pg_advisory_xact_lock(hashtext('lab.perfil'));

  DROP INDEX IF EXISTS opt_sesion_periodo;
  DROP INDEX IF EXISTS opt_reserva_periodo;
  DROP INDEX IF EXISTS opt_incidencia_periodo;
  DROP INDEX IF EXISTS opt_lectura_periodo;
  DROP INDEX IF EXISTS opt_lectura_instante;
  DROP INDEX IF EXISTS opt_lectura_sesion;

  IF perfil <> 'sin' THEN
    CREATE INDEX opt_sesion_periodo ON sesion_carga(inicio, id_estacion) WHERE estado = 'FINALIZADA';
    CREATE INDEX opt_reserva_periodo ON reserva(inicio_previsto, id_estacion);
    IF perfil = 'btree' THEN
      CREATE INDEX opt_lectura_instante ON lectura_sesion USING btree(instante);
      CREATE INDEX opt_lectura_sesion ON lectura_sesion USING btree(id_sesion);
    ELSE
      CREATE INDEX opt_lectura_instante ON lectura_sesion USING hash(instante);
      CREATE INDEX opt_lectura_sesion ON lectura_sesion USING hash(id_sesion);
    END IF;
  END IF;
  ANALYZE;

  RETURN json_build_object(
    'escenario', current_database(),
    'perfil', api.perfil_actual(),
    'segundos', round(extract(epoch FROM clock_timestamp() - t0)::numeric, 3),
    'indices', (SELECT coalesce(json_agg(i), '[]') FROM api.indices() i));
END $$;

-- Protocolo del informe: 2 calentamientos y 5 mediciones con EXPLAIN (ANALYZE, BUFFERS).
-- Devuelve la mediana del Execution Time y el plan completo de esa ejecución.
CREATE FUNCTION api.medir(consulta text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  q text; titulo text; p json;
  tiempos numeric[] := '{}';
  planes json[] := '{}';
  med int;
BEGIN
  SELECT c.sql, c.titulo INTO q, titulo FROM lab.consulta c WHERE c.id = consulta;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consulta desconocida: %', consulta USING ERRCODE = '22023';
  END IF;

  FOR i IN 1..2 LOOP
    EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' || q INTO p;
  END LOOP;
  FOR i IN 1..5 LOOP
    EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' || q INTO p;
    tiempos := tiempos || (p -> 0 ->> 'Execution Time')::numeric;
    planes  := planes || p;
  END LOOP;

  SELECT u.n INTO med FROM unnest(tiempos) WITH ORDINALITY u(v, n) ORDER BY u.v, u.n OFFSET 2 LIMIT 1;
  p := planes[med];

  RETURN json_build_object(
    'consulta', consulta,
    'titulo', titulo,
    'escenario', current_database(),
    'perfil', api.perfil_actual(),
    'tiempos_ms', tiempos,
    'mediana_ms', tiempos[med],
    'planning_ms', (p -> 0 ->> 'Planning Time')::numeric,
    'shared_hit', (p -> 0 -> 'Plan' ->> 'Shared Hit Blocks')::bigint,
    'shared_read', (p -> 0 -> 'Plan' ->> 'Shared Read Blocks')::bigint,
    'plan', p -> 0 -> 'Plan');
END $$;

-- Costo de escritura (12_write_overhead.sql): inserta 1 000 lecturas válidas en la última
-- sesión abierta y las revierte. 1 calentamiento + 5 mediciones; no deja datos.
CREATE FUNCTION api.medir_escritura()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  s sesion_carga; base_t timestamptz; base_soc int; base_e numeric;
  q text; p json; tiempos numeric[] := '{}'; planes json[] := '{}'; med int;
BEGIN
  SELECT * INTO s FROM sesion_carga WHERE fin IS NULL ORDER BY id_sesion DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay una sesión abierta para insertar lecturas' USING ERRCODE = '22023';
  END IF;

  -- En el dump 1M equivale exactamente al lote del informe (sesión 20002, sin lecturas).
  SELECT greatest(timestamptz '2026-05-02 12:00-05', s.inicio, max(l.instante) + interval '1 second'),
         greatest(20, s.soc_inicial, max(l.soc_pct)),
         coalesce(max(l.energia_acumulada_kwh), 0)
    INTO base_t, base_soc, base_e
  FROM lectura_sesion l WHERE l.id_sesion = s.id_sesion;

  q := format($f$EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON)
INSERT INTO lectura_sesion
  (id_sesion, instante, potencia_kw, energia_acumulada_kwh,
   soc_pct, voltaje_v, corriente_a, temperatura_bateria_c)
SELECT %s,
       %L::timestamptz + i * interval '1 second',
       18, %s + round(i * 0.005, 3), %s + floor(i * 0.005)::int, 400, 45, 30
FROM generate_series(1,1000) i$f$, s.id_sesion, base_t, base_e, base_soc);

  FOR i IN 1..6 LOOP
    BEGIN
      EXECUTE q INTO p;
      RAISE EXCEPTION USING ERRCODE = 'LB001';   -- revierte el lote
    EXCEPTION WHEN SQLSTATE 'LB001' THEN NULL;
    END;
    IF i > 1 THEN
      tiempos := tiempos || (p -> 0 ->> 'Execution Time')::numeric;
      planes  := planes || p;
    END IF;
  END LOOP;

  SELECT u.n INTO med FROM unnest(tiempos) WITH ORDINALITY u(v, n) ORDER BY u.v, u.n OFFSET 2 LIMIT 1;
  p := planes[med];

  RETURN json_build_object(
    'escenario', current_database(),
    'perfil', api.perfil_actual(),
    'id_sesion', s.id_sesion,
    'filas', 1000,
    'tiempos_ms', tiempos,
    'mediana_ms', tiempos[med],
    'wal_bytes', (p -> 0 -> 'Plan' ->> 'WAL Bytes')::bigint,
    'plan', p -> 0 -> 'Plan');
END $$;

-- Resumen del escenario para la cabecera de la web.
CREATE FUNCTION api.info()
RETURNS json LANGUAGE sql STABLE AS $$
SELECT json_build_object(
  'escenario', current_database(),
  'version', current_setting('server_version'),
  'perfil', api.perfil_actual(),
  -- Cambia cada vez que restaurar.sh recrea la base: la web descarta flujos que apuntan a datos viejos.
  'huella', (SELECT oid::text FROM pg_database WHERE datname = current_database()),
  'filas', json_build_object(
     'lectura_sesion', (SELECT count(*) FROM lectura_sesion),
     'sesion_carga',   (SELECT count(*) FROM sesion_carga),
     'reserva',        (SELECT count(*) FROM reserva),
     'pago',           (SELECT count(*) FROM pago),
     'usuario',        (SELECT count(*) FROM usuario),
     'estacion',       (SELECT count(*) FROM estacion)))
$$;

---------------------------------------------------------------------------------------------
-- Permisos y recarga del caché de PostgREST
---------------------------------------------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA api TO web_anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA api FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA api TO web_anon;
GRANT USAGE ON SCHEMA lab TO web_anon;
GRANT SELECT ON lab.consulta TO web_anon;

NOTIFY pgrst, 'reload schema';

import { useEffect, useMemo, useState } from 'react'
import { pedir, useRecurso, type ApiError, type Escenario } from './api'
import type { Info } from './App'
import { Paleta } from './Paleta'
import { decimal, entero, horaLima, milis, soles } from './formato'

interface Resumen { id_estacion: number; cod_estacion: string; sesiones: number; energia_kwh: number; facturado: number; sesiones_activas: number }
interface Estacion {
  id_estacion: number; cod_estacion: string; nombre: string; distrito: string; ciudad: string
  potencia_contratada_kw: number; estado: string; hora_apertura: string; hora_cierre: string
}
interface Conector {
  id_estacion: number; num_punto: number; etiqueta: string; corriente_punto: string; estado_operativo: string
  num_conector: number; tipo: string; potencia_max_kw: number; estado: string
}
interface Disponible { cod_estacion: string; num_punto: number; num_conector: number; disponible: boolean }
interface Tarifa { cod_estacion: string; estandar: string; codigo: string; moneda: string; precio_kwh_actual: number }

interface Red { resumen: Resumen[]; estaciones: Estacion[]; conectores: Conector[]; disponibles: Disponible[]; tarifas: Tarifa[] }

type EstadoCelda = 'ok' | 'espera' | 'falla'
const ESTADO_ESTACION: Record<string, { clase: string; texto: string }> = {
  OPERATIVA: { clase: 'ok', texto: 'Operativa' },
  MANTENIMIENTO: { clase: 'espera', texto: 'Mantenimiento' },
  FUERA_SERVICIO: { clase: 'falla', texto: 'Fuera de servicio' },
  PROYECTO: { clase: 'neutro', texto: 'Proyecto' },
}
const TEXTO_CELDA: Record<EstadoCelda, string> = { ok: 'disponible', espera: 'ocupado o reservado', falla: 'averiado' }

async function cargarRed(e: Escenario, signal: AbortSignal) {
  const t0 = performance.now()
  const [resumen, estaciones, conectores, disponibles, tarifas] = await Promise.all([
    pedir<Resumen[]>(e, '/v_resumen_estacion?order=id_estacion', { signal }),
    pedir<Estacion[]>(e, '/estaciones?order=id_estacion', { signal }),
    pedir<Conector[]>(e, '/conectores?order=id_estacion,num_punto,num_conector', { signal }),
    pedir<Disponible[]>(e, '/v_disponibilidad_carga?select=cod_estacion,num_punto,num_conector,disponible', { signal }),
    pedir<Tarifa[]>(e, '/v_tarifa_actual', { signal }),
  ])
  const data: Red = {
    resumen: resumen.data, estaciones: estaciones.data, conectores: conectores.data,
    disponibles: disponibles.data, tarifas: tarifas.data,
  }
  return { data, ms: performance.now() - t0 }
}

function useAhora(cadaMs: number) {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setAhora(new Date()), cadaMs)
    return () => window.clearInterval(id)
  }, [cadaMs])
  return ahora
}

export function RedDeCarga({ escenario, info, recargarInfo }: { escenario: Escenario; info?: Info; recargarInfo: () => void }) {
  const red = useRecurso((signal) => cargarRed(escenario, signal), [escenario])
  const [foco, setFoco] = useState<number | null>(null)
  const ahora = useAhora(10_000)

  useEffect(() => {
    const alTecla = (ev: KeyboardEvent) => ev.key === 'Escape' && setFoco(null)
    window.addEventListener('keydown', alTecla)
    return () => window.removeEventListener('keydown', alTecla)
  }, [])

  const filas = useMemo(() => (red.data ? armarFilas(red.data) : []), [red.data])
  const ancho = Math.max(1, ...filas.map((f) => entero(f.resumen.sesiones).length))
  const enfocada = filas.find((f) => f.estacion.id_estacion === foco)

  return (
    <main className="pagina">
      <section className="tablero" aria-labelledby="titulo-red">
        <div className="cabecera">
          <h1 id="titulo-red">Red de carga</h1>
          <div className="tira">
            <div className="dato">
              <small>Lecturas</small>
              <Paleta tam="g" celdas={9} valor={info ? entero(info.filas.lectura_sesion) : ''} />
            </div>
            <div className="dato">
              <small>Sesiones</small>
              <Paleta tam="g" celdas={6} valor={info ? entero(info.filas.sesion_carga) : ''} />
            </div>
            <div className="dato">
              <small>Hora Lima</small>
              <Paleta tam="g" valor={horaLima(ahora)} />
            </div>
          </div>
        </div>

        {red.error && !red.data ? (
          <ErrorAviso
            error={red.error}
            reintentar={() => {
              red.recargar()
              recargarInfo()
            }}
          />
        ) : (
          <div className="desplaza">
            <table className={`tabla${enfocada ? ' con-foco' : ''}`}>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Estación</th>
                  <th scope="col" className="num">Sesiones</th>
                  <th scope="col" className="num">Energía kWh</th>
                  <th scope="col" className="num">Facturado S/</th>
                  <th scope="col">Conectores</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {!red.data
                  ? Array.from({ length: 12 }, (_, i) => (
                      <tr key={i} className="esqueleto">
                        {Array.from({ length: 7 }, (__, j) => <td key={j}>·</td>)}
                      </tr>
                    ))
                  : filas.map((f) => {
                      const st = ESTADO_ESTACION[f.estacion.estado] ?? ESTADO_ESTACION.PROYECTO
                      const activa = f.estacion.id_estacion === foco
                      return (
                        <tr
                          key={f.estacion.id_estacion}
                          className={`fila-estacion${activa ? ' foco' : ''}`}
                          onClick={() => setFoco(activa ? null : f.estacion.id_estacion)}
                        >
                          <td>
                            <button type="button" className="codigo" aria-pressed={activa} aria-label={`${f.estacion.cod_estacion}: ver puntos y conectores`}>
                              {f.estacion.cod_estacion}
                            </button>
                          </td>
                          <td>{f.estacion.nombre}</td>
                          <td className="num"><Paleta tam="s" celdas={ancho} valor={entero(f.resumen.sesiones)} /></td>
                          <td className="num">{decimal(f.resumen.energia_kwh, 1)}</td>
                          <td className="num">{decimal(f.resumen.facturado, 2)}</td>
                          <td>
                            <span className="celdas" role="img" aria-label={describirCeldas(f.celdas)}>
                              {f.celdas.map((c) => (
                                <i key={c.clave} className={`marca-estado ${c.estado}`} title={`P-${c.punto} · ${c.tipo} · ${TEXTO_CELDA[c.estado]}`} />
                              ))}
                            </span>
                          </td>
                          <td><span className={`chip ${st.clase}`}>{st.texto}</span></td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
        )}

        <p className="fuente">
          <span>
            Fuente <code>api.v_resumen_estacion</code> · <code>api.v_disponibilidad_carga</code> · <code>api.conectores</code>
          </span>
          {red.data && (
            <span>
              {filas.length} estaciones · respuesta en {milis(red.ms ?? 0)} ms
            </span>
          )}
        </p>
      </section>

      <aside className="lateral" aria-live="polite">
        {enfocada ? (
          <DetalleEstacion fila={enfocada} tarifas={red.data!.tarifas} cerrar={() => setFoco(null)} />
        ) : (
          <ResumenRed filas={filas} tarifas={red.data?.tarifas ?? []} cargando={!red.data} sinConexion={!!red.error && !red.data} />
        )}
      </aside>
    </main>
  )
}

interface Celda { clave: string; punto: number; tipo: string; estado: EstadoCelda }
interface Fila { estacion: Estacion; resumen: Resumen; celdas: Celda[]; conectores: Conector[] }

function armarFilas(red: Red): Fila[] {
  const resumen = new Map(red.resumen.map((r) => [r.id_estacion, r]))
  const libre = new Map<string, boolean>()
  for (const d of red.disponibles) libre.set(`${d.cod_estacion}|${d.num_punto}|${d.num_conector}`, d.disponible)

  return red.estaciones.map((estacion) => {
    const conectores = red.conectores.filter((c) => c.id_estacion === estacion.id_estacion)
    const celdas = conectores.map((c): Celda => {
      const averiado = c.estado === 'AVERIADO' || ['AVERIADO', 'FUERA_SERVICIO'].includes(c.estado_operativo)
      const disponible = libre.get(`${estacion.cod_estacion}|${c.num_punto}|${c.num_conector}`) ?? false
      return {
        clave: `${c.num_punto}-${c.num_conector}`,
        punto: c.num_punto,
        tipo: c.tipo,
        estado: averiado ? 'falla' : disponible ? 'ok' : 'espera',
      }
    })
    return {
      estacion,
      resumen: resumen.get(estacion.id_estacion) ?? { id_estacion: estacion.id_estacion, cod_estacion: estacion.cod_estacion, sesiones: 0, energia_kwh: 0, facturado: 0, sesiones_activas: 0 },
      celdas,
      conectores,
    }
  })
}

function describirCeldas(celdas: Celda[]) {
  const n = (e: EstadoCelda) => celdas.filter((c) => c.estado === e).length
  return `${n('ok')} disponibles, ${n('espera')} ocupados o reservados, ${n('falla')} averiados`
}

const precio = (t: Tarifa) => `${t.moneda === 'USD' ? 'US$' : 'S/'} ${decimal(t.precio_kwh_actual, 2)}`

function DetalleEstacion({ fila, tarifas, cerrar }: { fila: Fila; tarifas: Tarifa[]; cerrar: () => void }) {
  const { estacion, resumen, conectores, celdas } = fila
  const puntos = [...new Set(conectores.map((c) => c.num_punto))]
  const suyas = tarifas.filter((t) => t.cod_estacion === estacion.cod_estacion)
  return (
    <>
      <h2>{estacion.cod_estacion}</h2>
      <p className="sub">{estacion.nombre} · {estacion.distrito}, {estacion.ciudad}</p>
      <dl className="pares">
        <dt>Potencia contratada</dt><dd>{entero(estacion.potencia_contratada_kw)} kW</dd>
        <dt>Horario</dt><dd>{estacion.hora_apertura.slice(0, 5)} – {estacion.hora_cierre.slice(0, 5)}</dd>
        <dt>Sesiones activas</dt><dd>{resumen.sesiones_activas}</dd>
        <dt>Energía entregada</dt><dd>{decimal(resumen.energia_kwh, 1)} kWh</dd>
        <dt>Facturado</dt><dd>{soles(resumen.facturado)}</dd>
      </dl>

      <h3>Puntos y conectores</h3>
      {puntos.map((p) => {
        const suyos = conectores.filter((c) => c.num_punto === p)
        return (
          <div className="punto" key={p}>
            <strong>{suyos[0].etiqueta}</strong>
            <span className="corriente">{suyos[0].corriente_punto} · {suyos[0].estado_operativo.toLowerCase().replace('_', ' ')}</span>
            <span className="conectores">
              {suyos.map((c) => {
                const estado = celdas.find((x) => x.clave === `${c.num_punto}-${c.num_conector}`)!.estado
                return (
                  <span key={c.num_conector} className={`chip conector ${estado}`} title={TEXTO_CELDA[estado]}>
                    {c.tipo} {entero(c.potencia_max_kw)} kW
                  </span>
                )
              })}
            </span>
          </div>
        )
      })}

      {suyas.length > 0 && (
        <>
          <h3>Tarifa en este momento</h3>
          <dl className="pares">
            {suyas.map((t) => (
              <FragmentoTarifa key={t.estandar} t={t} />
            ))}
          </dl>
        </>
      )}
      <p className="nota">
        <button type="button" className="boton-texto" onClick={cerrar}>Volver al resumen de la red</button> · o pulsa Esc
      </p>
    </>
  )
}

function FragmentoTarifa({ t }: { t: Tarifa }) {
  return (
    <>
      <dt>{t.estandar} · {t.codigo}</dt>
      <dd>{precio(t)} por kWh</dd>
    </>
  )
}

function ResumenRed({ filas, tarifas, cargando, sinConexion }: { filas: Fila[]; tarifas: Tarifa[]; cargando: boolean; sinConexion: boolean }) {
  if (cargando)
    return (
      <>
        <h2>Resumen de la red</h2>
        <p className="sub">{sinConexion ? 'Sin datos mientras la base no responda.' : 'Leyendo la red desde PostgreSQL…'}</p>
      </>
    )
  const celdas = filas.flatMap((f) => f.celdas)
  const cuenta = (e: EstadoCelda) => celdas.filter((c) => c.estado === e).length
  const operativas = filas.filter((f) => f.estacion.estado === 'OPERATIVA').length
  const energia = filas.reduce((s, f) => s + f.resumen.energia_kwh, 0)
  const facturado = filas.reduce((s, f) => s + f.resumen.facturado, 0)
  const activas = filas.reduce((s, f) => s + f.resumen.sesiones_activas, 0)
  const porEstandar = new Map<string, Tarifa[]>()
  for (const t of tarifas) porEstandar.set(t.estandar, [...(porEstandar.get(t.estandar) ?? []), t])

  return (
    <>
      <h2>Resumen de la red</h2>
      <p className="sub">Elige una estación del tablero para ver sus puntos y conectores.</p>
      <dl className="pares">
        <dt>Estaciones operativas</dt><dd>{operativas} de {filas.length}</dd>
        <dt>Conectores disponibles</dt><dd>{cuenta('ok')} de {celdas.length}</dd>
        <dt>Sesiones activas</dt><dd>{activas}</dd>
        <dt>Energía entregada</dt><dd>{decimal(energia / 1000, 1)} MWh</dd>
        <dt>Facturado</dt><dd>{soles(facturado)}</dd>
      </dl>

      <h3>Conectores</h3>
      <div className="leyenda">
        <div><i className="marca-estado ok" aria-hidden="true" /> Disponible · {cuenta('ok')}</div>
        <div><i className="marca-estado espera" aria-hidden="true" /> Ocupado o reservado · {cuenta('espera')}</div>
        <div><i className="marca-estado falla" aria-hidden="true" /> Averiado · {cuenta('falla')}</div>
      </div>

      {porEstandar.size > 0 && (
        <>
          <h3>Precio por kWh en este momento</h3>
          <dl className="pares">
            {[...porEstandar].map(([estandar, ts]) => {
              const precios = ts.map((t) => t.precio_kwh_actual)
              const min = Math.min(...precios)
              const max = Math.max(...precios)
              return (
                <FragmentoRango key={estandar} etiqueta={estandar} texto={min === max ? `S/ ${decimal(min, 2)}` : `S/ ${decimal(min, 2)} – ${decimal(max, 2)}`} />
              )
            })}
          </dl>
          <p className="nota">Según la franja horaria vigente (<code>api.v_tarifa_actual</code>).</p>
        </>
      )}
    </>
  )
}

function FragmentoRango({ etiqueta, texto }: { etiqueta: string; texto: string }) {
  return (
    <>
      <dt>{etiqueta}</dt>
      <dd>{texto}</dd>
    </>
  )
}

export function ErrorAviso({ error, reintentar }: { error: ApiError; reintentar?: () => void }) {
  return (
    <div className="aviso error" role="alert">
      <h3><i className="marca-estado falla" aria-hidden="true" /> {error.message}</h3>
      {error.hint && <p>{error.hint}</p>}
      {error.code && <p><code>SQLSTATE {error.code}</code></p>}
      {reintentar && (
        <p style={{ marginTop: 10 }}>
          <button type="button" className="boton-texto" onClick={reintentar}>Reintentar</button>
        </p>
      )}
    </div>
  )
}

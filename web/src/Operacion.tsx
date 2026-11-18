import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, baseDeDatos, pedir, useRecurso, type Escenario } from './api'
import { ErrorAviso } from './RedDeCarga'
import { Paleta } from './Paleta'
import { aEntradaLima, decimal, desdeEntradaLima, fechaHora, horaLima, soles, sumarMinutos } from './formato'

interface Vehiculo { id_vehiculo: number; placa: string; id_usuario: number; email: string; marca: string; modelo: string; id_modelo: number }
interface ConectorLibre { cod_estacion: string; num_punto: number; num_conector: number; estandar: string; potencia_max_admitida_kw: number }
interface EstacionId { id_estacion: number; cod_estacion: string }
interface Lecturas { total: number; insertadas: number; ultima: string; energia_kwh: number; soc_pct: number; potencia_kw: number; temperatura_c: number }
interface Cierre { id_sesion: number; estado: string; energia_kwh: number; costo_energia: number; costo_tiempo: number; costo_ocupacion: number; costo_total: number; soc_final: number; fin: string; moneda: string }
interface Conciliacion { costo_total: number; pagado: number; saldo: number; estado_cobro: string }
interface Regla { id: string; orden: number; titulo: string; mecanismo: string }
interface Prueba { rechazada: boolean | null; sqlstate?: string; mensaje: string; restriccion?: string | null; sql: string | null }

/** Lo que el flujo ya escribió en la base. Vive fuera del componente: sobrevive al cambiar de pestaña. */
interface Flujo {
  /** oid de la base cuando empezó el flujo; si cambia, la base fue restaurada. */
  huella?: string
  vehiculo?: Vehiculo
  conector?: ConectorLibre & { id_estacion: number }
  reserva?: { id: number; desde: string; hasta: string }
  sesion?: { id: number; inicio: string }
  lecturas?: Lecturas
  cierre?: Cierre
  pago?: { id: number; monto: number; conciliacion?: Conciliacion }
}
const flujos = new Map<Escenario, Flujo>()
const pruebas = new Map<Escenario, Record<string, Prueba | ApiError>>()
const CLAVE = (e: Escenario) => `electroruta.flujo.${e}`

function leerFlujo(e: Escenario): Flujo {
  if (flujos.has(e)) return flujos.get(e)!
  try {
    const v = sessionStorage.getItem(CLAVE(e))
    if (v) return JSON.parse(v) as Flujo
  } catch {
    /* sin almacenamiento: el flujo empieza vacío */
  }
  return {}
}
function guardarFlujo(e: Escenario, f: Flujo) {
  flujos.set(e, f)
  try {
    sessionStorage.setItem(CLAVE(e), JSON.stringify(f))
  } catch {
    /* sin almacenamiento: vale mientras la pestaña esté abierta */
  }
}

const PASOS = ['Reserva', 'Inicio de sesión', 'Lecturas', 'Cierre', 'Pago'] as const
function pasoActual(f: Flujo) {
  if (!f.reserva) return 0
  if (!f.sesion) return 1
  if (!f.lecturas) return 2
  if (!f.cierre) return 3
  if (!f.pago) return 4
  return 5
}

export function Operacion({ escenario, huella }: { escenario: Escenario; huella?: string }) {
  const [flujo, setFlujoLocal] = useState<Flujo>(() => leerFlujo(escenario))
  useEffect(() => setFlujoLocal(leerFlujo(escenario)), [escenario])
  const setFlujo = (f: Flujo) => {
    const conHuella = f.reserva ? { ...f, huella: f.huella ?? huella } : f
    guardarFlujo(escenario, conHuella)
    setFlujoLocal(conHuella)
  }
  // Tras restaurar.sh la base es otra: lo que el flujo recordaba ya no existe.
  useEffect(() => {
    const actual = leerFlujo(escenario)
    if (huella && actual.huella && actual.huella !== huella) {
      guardarFlujo(escenario, {})
      setFlujoLocal({})
    }
  }, [escenario, huella])
  const paso = pasoActual(flujo)
  const db = baseDeDatos(escenario)

  return (
    <main className="operacion">
      <section className="flujo" aria-labelledby="titulo-operacion">
        <div className="cabecera">
          <h1 id="titulo-operacion">Operación</h1>
          <div className="tira">
            <div className="dato"><small>Reserva</small><Paleta celdas={6} valor={flujo.reserva ? String(flujo.reserva.id) : ''} /></div>
            <div className="dato"><small>Sesión</small><Paleta celdas={6} valor={flujo.sesion ? String(flujo.sesion.id) : ''} /></div>
            <div className="dato"><small>Total S/</small><Paleta celdas={6} valor={flujo.cierre ? decimal(flujo.cierre.costo_total, 2) : ''} /></div>
          </div>
        </div>
        <p className="aviso-escritura">
          Este flujo escribe de verdad en <strong>{db}</strong> con los procedimientos del Hito 2. Para volver al dump:{' '}
          <code>docker compose exec db bash /api/restaurar.sh {escenario}</code>
          {escenario !== '1k' && (
            <span className="aviso-escenario">
              <i className="marca-estado espera" aria-hidden="true" /> Conviene usar 1k: así {db} queda igual que en el informe para Consultas y el Laboratorio.
            </span>
          )}
        </p>

        <ol className="pasos">
          {PASOS.map((titulo, i) => (
            <Paso key={titulo} n={i + 1} titulo={titulo} estado={i < paso ? 'hecho' : i === paso ? 'actual' : 'futuro'}>
              {i === 0 && <PasoReserva escenario={escenario} flujo={flujo} setFlujo={setFlujo} activo={paso === 0} />}
              {i === 1 && <PasoInicio escenario={escenario} flujo={flujo} setFlujo={setFlujo} activo={paso === 1} />}
              {i === 2 && <PasoLecturas escenario={escenario} flujo={flujo} setFlujo={setFlujo} activo={paso === 2 || paso === 3} />}
              {i === 3 && <PasoCierre escenario={escenario} flujo={flujo} setFlujo={setFlujo} activo={paso === 3} />}
              {i === 4 && <PasoPago escenario={escenario} flujo={flujo} setFlujo={setFlujo} activo={paso === 4} />}
            </Paso>
          ))}
        </ol>
        {paso > 0 && (
          <p className="nota-flujo">
            <button type="button" className="boton-sec" onClick={() => setFlujo({})}>
              {paso === 5 ? 'Empezar otro flujo' : 'Descartar y empezar de nuevo'}
            </button>
            {paso < 5 && <span> Lo ya escrito queda en la base; solo se limpia esta pantalla.</span>}
          </p>
        )}
      </section>

      <Reglas escenario={escenario} />
    </main>
  )
}

function Paso({ n, titulo, estado, children }: { n: number; titulo: string; estado: 'hecho' | 'actual' | 'futuro'; children: ReactNode }) {
  const marca = estado === 'hecho' ? 'ok' : estado === 'actual' ? 'espera' : 'pendiente'
  return (
    <li className={`paso ${estado}`} aria-current={estado === 'actual' ? 'step' : undefined}>
      <span className="paso-n">{n}</span>
      <div className="paso-cuerpo">
        <h2><i className={`marca-estado ${marca}`} aria-hidden="true" /> {titulo}</h2>
        {children}
      </div>
    </li>
  )
}

interface PropsPaso { escenario: Escenario; flujo: Flujo; setFlujo: (f: Flujo) => void; activo: boolean }

const Llamada = ({ children }: { children: ReactNode }) => <p className="llamada"><code>{children}</code></p>

/** Ejecuta una llamada y guarda su error para mostrarlo bajo el paso. */
function useAccion() {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<ApiError>()
  async function correr(fn: () => Promise<void>) {
    setOcupado(true)
    setError(undefined)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(String(e), 0))
    } finally {
      setOcupado(false)
    }
  }
  return { ocupado, error, correr }
}

function PasoReserva({ escenario, flujo, setFlujo, activo }: PropsPaso) {
  const vehiculos = useRecurso(
    (signal) => pedir<Vehiculo[]>(escenario, '/vehiculos?activo=is.true&estado_usuario=eq.ACTIVO&order=id_vehiculo&limit=50', { signal }),
    [escenario],
  )
  const estaciones = useRecurso((signal) => pedir<EstacionId[]>(escenario, '/estaciones?select=id_estacion,cod_estacion', { signal }), [escenario])
  const [idVehiculo, setIdVehiculo] = useState<number>()
  const vehiculo = vehiculos.data?.find((v) => v.id_vehiculo === idVehiculo) ?? vehiculos.data?.[0]
  const libres = useRecurso(
    (signal) =>
      vehiculo
        ? pedir<ConectorLibre[]>(
            escenario,
            `/v_disponibilidad_carga?id_modelo=eq.${vehiculo.id_modelo}&disponible=is.true&select=cod_estacion,num_punto,num_conector,estandar,potencia_max_admitida_kw&order=cod_estacion,num_punto,num_conector`,
            { signal },
          )
        : Promise.resolve({ data: [], ms: 0 }),
    [escenario, vehiculo?.id_modelo],
  )
  const [claveConector, setClaveConector] = useState<string>()
  const clave = (c: ConectorLibre) => `${c.cod_estacion}|${c.num_punto}|${c.num_conector}`
  const conector = libres.data?.find((c) => clave(c) === claveConector) ?? libres.data?.[0]
  const idEstacion = estaciones.data?.find((e) => e.cod_estacion === conector?.cod_estacion)?.id_estacion
  const [desde, setDesde] = useState('')
  const [minutos, setMinutos] = useState(60)
  const accion = useAccion()

  // Propone el primer horario libre del punto elegido (api.proximo_hueco).
  useEffect(() => {
    if (!activo || !conector || !idEstacion) return
    let vivo = true
    pedir<string>(escenario, `/rpc/proximo_hueco?id_estacion=${idEstacion}&num_punto=${conector.num_punto}&minutos=${minutos}`)
      .then((r) => vivo && r.data && setDesde(aEntradaLima(r.data)))
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [escenario, activo, idEstacion, conector?.num_punto, minutos])

  if (flujo.reserva && flujo.conector && flujo.vehiculo)
    return (
      <p className="hecho-linea">
        Reserva <b>{flujo.reserva.id}</b> confirmada para <b>{flujo.vehiculo.placa}</b> en {flujo.conector.cod_estacion} · P-{flujo.conector.num_punto} ·{' '}
        {flujo.conector.estandar}, de {fechaHora(flujo.reserva.desde).slice(0, 16)} a {horaLima(new Date(flujo.reserva.hasta))}.
      </p>
    )

  const enviar = (ev: FormEvent) => {
    ev.preventDefault()
    if (!vehiculo || !conector || !idEstacion || !desde) return
    const d = desdeEntradaLima(desde)
    const h = sumarMinutos(d, minutos)
    void accion.correr(async () => {
      const r = await pedir<number>(escenario, '/rpc/reservar', {
        method: 'POST',
        body: { id_usuario: vehiculo.id_usuario, id_estacion: idEstacion, num_punto: conector.num_punto, desde: d, hasta: h },
      })
      setFlujo({ vehiculo, conector: { ...conector, id_estacion: idEstacion }, reserva: { id: r.data, desde: d, hasta: h } })
    })
  }

  return (
    <>
      <Llamada>api.reservar → CALL reservar_punto(…)</Llamada>
      <form className="parametros" onSubmit={enviar}>
        <label>Vehículo
          <select value={vehiculo?.id_vehiculo ?? ''} onChange={(e) => setIdVehiculo(Number(e.target.value))} disabled={!activo}>
            {vehiculos.data?.map((v) => (
              <option key={v.id_vehiculo} value={v.id_vehiculo}>{v.placa} · {v.modelo} · usuario {v.id_usuario}</option>
            ))}
          </select>
        </label>
        <label>Conector compatible y libre
          <select value={conector ? clave(conector) : ''} onChange={(e) => setClaveConector(e.target.value)} disabled={!activo || !libres.data?.length}>
            {libres.data?.map((c) => (
              <option key={clave(c)} value={clave(c)}>{c.cod_estacion} · P-{c.num_punto} · {c.estandar} · hasta {decimal(c.potencia_max_admitida_kw, 0)} kW</option>
            ))}
          </select>
        </label>
        <label>Desde (hora Lima)<input type="datetime-local" value={desde} onChange={(e) => setDesde(e.target.value)} required disabled={!activo} /></label>
        <label>Duración
          <select value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} disabled={!activo}>
            {[30, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </label>
        <button type="submit" className="ejecutar" disabled={!activo || accion.ocupado || !conector}>{accion.ocupado ? 'Reservando…' : 'Reservar'}</button>
      </form>
      {libres.data && libres.data.length === 0 && <p className="sin-parametros">No hay conectores libres compatibles con este vehículo.</p>}
      {(accion.error ?? vehiculos.error) && <ErrorAviso error={(accion.error ?? vehiculos.error)!} />}
    </>
  )
}

function PasoInicio({ escenario, flujo, setFlujo, activo }: PropsPaso) {
  const [inicio, setInicio] = useState('')
  const [soc, setSoc] = useState(20)
  const accion = useAccion()
  useEffect(() => {
    if (flujo.reserva) setInicio(aEntradaLima(flujo.reserva.desde))
  }, [flujo.reserva])

  if (flujo.sesion && flujo.cierre)
    return (
      <p className="hecho-linea">
        Sesión <b>{flujo.sesion.id}</b> de {fechaHora(flujo.sesion.inicio).slice(0, 16)} a {horaLima(new Date(flujo.cierre.fin))}. Al cerrarse, el punto volvió a quedar <b>disponible</b>.
      </p>
    )
  if (flujo.sesion)
    return <p className="hecho-linea">Sesión <b>{flujo.sesion.id}</b> cargando desde {fechaHora(flujo.sesion.inicio).slice(0, 16)}. El punto quedó <b>ocupado</b>: se ve en Red de carga.</p>
  if (!activo) return <Llamada>api.iniciar_sesion → CALL iniciar_sesion(…)</Llamada>

  const enviar = (ev: FormEvent) => {
    ev.preventDefault()
    const { vehiculo, conector, reserva } = flujo
    if (!vehiculo || !conector || !reserva) return
    const t = desdeEntradaLima(inicio)
    void accion.correr(async () => {
      const r = await pedir<number>(escenario, '/rpc/iniciar_sesion', {
        method: 'POST',
        body: {
          id_usuario: vehiculo.id_usuario, id_vehiculo: vehiculo.id_vehiculo, id_estacion: conector.id_estacion,
          num_punto: conector.num_punto, num_conector: conector.num_conector, inicio: t, soc_inicial: soc, id_reserva: reserva.id,
        },
      })
      setFlujo({ ...flujo, sesion: { id: r.data, inicio: t } })
    })
  }
  return (
    <>
      <Llamada>api.iniciar_sesion → CALL iniciar_sesion(…)</Llamada>
      <form className="parametros" onSubmit={enviar}>
        <label>Inicio (hora Lima)<input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} required /></label>
        <label>SOC inicial %<input type="number" min={0} max={100} value={soc} onChange={(e) => setSoc(Number(e.target.value))} required /></label>
        <button type="submit" className="ejecutar" disabled={accion.ocupado}>{accion.ocupado ? 'Iniciando…' : 'Iniciar sesión'}</button>
      </form>
      {accion.error && <ErrorAviso error={accion.error} />}
    </>
  )
}

function PasoLecturas({ escenario, flujo, setFlujo, activo }: PropsPaso) {
  const [cantidad, setCantidad] = useState(10)
  const [cada, setCada] = useState(60)
  const accion = useAccion()
  const l = flujo.lecturas
  const resumen = l && (
    <p className="hecho-linea">
      <b>{l.total}</b> lecturas · {decimal(l.energia_kwh, 3)} kWh · SOC {l.soc_pct} % · {decimal(l.potencia_kw, 2)} kW · batería {decimal(l.temperatura_c, 1)} °C · última a las {horaLima(new Date(l.ultima))}.
    </p>
  )
  const llamada = <Llamada>api.simular_lecturas → INSERT INTO lectura_sesion (cada fila pasa por tg_lectura)</Llamada>
  if (!activo) return resumen ?? llamada

  const enviar = (ev: FormEvent) => {
    ev.preventDefault()
    if (!flujo.sesion) return
    void accion.correr(async () => {
      const r = await pedir<Lecturas>(escenario, '/rpc/simular_lecturas', {
        method: 'POST',
        body: { id_sesion: flujo.sesion!.id, cantidad, cada_seg: cada },
      })
      setFlujo({ ...flujo, lecturas: r.data })
    })
  }
  return (
    <>
      {llamada}
      <form className="parametros" onSubmit={enviar}>
        <label>Cantidad<input type="number" min={1} max={120} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} required /></label>
        <label>Cada (segundos)<input type="number" min={10} max={600} step={10} value={cada} onChange={(e) => setCada(Number(e.target.value))} required /></label>
        <button type="submit" className="ejecutar" disabled={accion.ocupado}>{accion.ocupado ? 'Registrando…' : l ? 'Registrar más' : 'Registrar lecturas'}</button>
      </form>
      {resumen}
      {accion.error && <ErrorAviso error={accion.error} />}
    </>
  )
}

function PasoCierre({ escenario, flujo, setFlujo, activo }: PropsPaso) {
  const [fin, setFin] = useState('')
  const [motivo, setMotivo] = useState('USUARIO')
  const accion = useAccion()
  useEffect(() => {
    if (flujo.lecturas) setFin(aEntradaLima(sumarMinutos(flujo.lecturas.ultima, 1)))
  }, [flujo.lecturas])

  const c = flujo.cierre
  if (c)
    return (
      <dl className="costos">
        <dt>Energía</dt><dd>{decimal(c.energia_kwh, 3)} kWh</dd>
        <dt>Costo de energía</dt><dd>{soles(c.costo_energia)}</dd>
        <dt>Costo de tiempo</dt><dd>{soles(c.costo_tiempo)}</dd>
        <dt>Ocupación</dt><dd>{soles(c.costo_ocupacion)}</dd>
        <dt className="total">Total calculado por tg_sesion</dt><dd className="total">{soles(c.costo_total)}</dd>
      </dl>
    )
  const llamada = <Llamada>api.finalizar_sesion → CALL finalizar_sesion(…); los costos los calcula el trigger</Llamada>
  if (!activo) return llamada

  const enviar = (ev: FormEvent) => {
    ev.preventDefault()
    if (!flujo.sesion) return
    void accion.correr(async () => {
      const r = await pedir<Cierre>(escenario, '/rpc/finalizar_sesion', {
        method: 'POST',
        body: { id_sesion: flujo.sesion!.id, fin: desdeEntradaLima(fin), motivo },
      })
      setFlujo({ ...flujo, cierre: r.data })
    })
  }
  return (
    <>
      {llamada}
      <form className="parametros" onSubmit={enviar}>
        <label>Fin (hora Lima)<input type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} required /></label>
        <label>Motivo
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            <option value="USUARIO">Usuario</option>
            <option value="COMPLETA">Carga completa</option>
          </select>
        </label>
        <button type="submit" className="ejecutar" disabled={accion.ocupado}>{accion.ocupado ? 'Cerrando…' : 'Finalizar'}</button>
      </form>
      {accion.error && <ErrorAviso error={accion.error} />}
    </>
  )
}

function PasoPago({ escenario, flujo, setFlujo, activo }: PropsPaso) {
  const [monto, setMonto] = useState('')
  const [medio, setMedio] = useState('TARJETA')
  const accion = useAccion()
  useEffect(() => {
    if (flujo.cierre) setMonto(flujo.cierre.costo_total.toFixed(2))
  }, [flujo.cierre])

  const p = flujo.pago
  if (p)
    return (
      <p className="hecho-linea">
        Pago <b>{p.id}</b> autorizado por {soles(p.monto)}.{' '}
        {p.conciliacion && (
          <>Conciliación: <span className={`chip ${p.conciliacion.estado_cobro === 'CONCILIADA' ? 'ok' : 'espera'}`}>{p.conciliacion.estado_cobro.replace('_', ' ')}</span> · saldo {soles(p.conciliacion.saldo)}</>
        )}
      </p>
    )
  const llamada = <Llamada>api.registrar_pago → CALL registrar_pago(…); luego api.v_conciliacion</Llamada>
  if (!activo || !flujo.cierre || !flujo.sesion) return llamada

  const enviar = (ev: FormEvent) => {
    ev.preventDefault()
    const s = flujo.sesion!.id
    const importe = Number(monto)
    void accion.correr(async () => {
      const r = await pedir<number>(escenario, '/rpc/registrar_pago', {
        method: 'POST',
        body: { id_sesion: s, monto: importe, medio_pago: medio, cod_autorizacion: `WEB-${s}-${Date.now() % 100000}`, fecha_hora: sumarMinutos(flujo.cierre!.fin, 1) },
      })
      const c = await pedir<Conciliacion[]>(escenario, `/v_conciliacion?id_sesion=eq.${s}`)
      setFlujo({ ...flujo, pago: { id: r.data, monto: importe, conciliacion: c.data[0] } })
    })
  }
  return (
    <>
      {llamada}
      <form className="parametros" onSubmit={enviar}>
        <label>Monto S/<input type="number" min={0.01} step={0.01} value={monto} onChange={(e) => setMonto(e.target.value)} required /></label>
        <label>Medio
          <select value={medio} onChange={(e) => setMedio(e.target.value)}>
            {['TARJETA', 'MONEDERO', 'CREDITO', 'QR'].map((m) => <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>)}
          </select>
        </label>
        <button type="submit" className="ejecutar" disabled={accion.ocupado}>{accion.ocupado ? 'Pagando…' : 'Pagar'}</button>
      </form>
      {accion.error && <ErrorAviso error={accion.error} />}
    </>
  )
}

function Reglas({ escenario }: { escenario: Escenario }) {
  const lista = useRecurso((signal) => pedir<Regla[]>(escenario, '/reglas', { signal }), [escenario])
  const [res, setRes] = useState<Record<string, Prueba | ApiError>>(() => pruebas.get(escenario) ?? {})
  const [corriendo, setCorriendo] = useState<string | null>(null)
  useEffect(() => setRes(pruebas.get(escenario) ?? {}), [escenario])

  async function probar(ids: string[]) {
    for (const id of ids) {
      setCorriendo(id)
      let r: Prueba | ApiError
      try {
        r = (await pedir<Prueba>(escenario, '/rpc/probar_regla', { method: 'POST', body: { regla: id } })).data
      } catch (e) {
        r = e instanceof ApiError ? e : new ApiError(String(e), 0)
      }
      const nuevo = { ...(pruebas.get(escenario) ?? {}), [id]: r }
      pruebas.set(escenario, nuevo)
      setRes(nuevo)
    }
    setCorriendo(null)
  }

  return (
    <aside className="lateral reglas" aria-labelledby="titulo-reglas">
      <div className="reglas-cab">
        <h2 id="titulo-reglas">Reglas de integridad</h2>
        <button type="button" className="boton-sec" disabled={!!corriendo || !lista.data} onClick={() => void probar((lista.data ?? []).map((r) => r.id))}>
          Probar todas
        </button>
      </div>
      <p className="sub">Cada prueba intenta una operación inválida dentro de un bloque que se revierte: PostgreSQL responde y no queda nada escrito.</p>
      {lista.error && <ErrorAviso error={lista.error} reintentar={lista.recargar} />}
      <ol className="lista-reglas">
        {lista.data?.map((r) => {
          const x = res[r.id]
          return (
            <li key={r.id} className="regla">
              <div className="regla-cab">
                <div>
                  <strong>{r.titulo}</strong>
                  <code>{r.mecanismo}</code>
                </div>
                <button type="button" className="boton-sec" disabled={!!corriendo} onClick={() => void probar([r.id])}>
                  {corriendo === r.id ? 'Probando…' : 'Probar'}
                </button>
              </div>
              {x && <ResultadoRegla r={x} />}
            </li>
          )
        })}
      </ol>
    </aside>
  )
}

function ResultadoRegla({ r }: { r: Prueba | ApiError }) {
  if (r instanceof ApiError) return <p className="regla-res"><i className="marca-estado falla" aria-hidden="true" /> La API respondió: {r.message}</p>
  if (r.rechazada === null) return <p className="regla-res"><i className="marca-estado pendiente" aria-hidden="true" /> {r.mensaje}</p>
  return (
    <div className="regla-res">
      {r.rechazada ? (
        <p><i className="marca-estado falla" aria-hidden="true" /> <b>Rechazada</b> · SQLSTATE {r.sqlstate}{r.restriccion ? ` · ${r.restriccion}` : ''}</p>
      ) : (
        <p><i className="marca-estado espera" aria-hidden="true" /> <b>PostgreSQL la aceptó</b> (igual se revirtió)</p>
      )}
      {r.rechazada && <p className="regla-msg">{r.mensaje}</p>}
      {r.sql && (
        <details>
          <summary>SQL intentado</summary>
          <pre className="sql">{r.sql}</pre>
        </details>
      )}
    </div>
  )
}

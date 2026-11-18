import { Fragment, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, baseDeDatos, pedir, useRecurso, type Escenario } from './api'
import { ErrorAviso } from './RedDeCarga'
import { Paleta } from './Paleta'
import { decimal, entero, esFecha, fechaHora, milis } from './formato'

interface Consulta { id: string; orden: number; titulo: string; sql: string }
type Fila = Record<string, unknown>

type Tipo = 'ninguno' | 'fechas' | 'sesion'
const TIPO: Record<string, Tipo> = { q1: 'ninguno', q2: 'fechas', q3: 'sesion', q4: 'fechas', q5: 'fechas', control: 'sesion' }
const FUNCION: Record<string, string> = { control: 'control_curva' }
const funcion = (id: string) => FUNCION[id] ?? id
const codigo = (id: string) => (id === 'control' ? 'C0' : id.toUpperCase())

interface Parametros { desde: string; hasta: string; sesion: number }
const POR_DEFECTO: Parametros = { desde: '2026-03-01', hasta: '2026-03-08', sesion: 10 }
const POR_PAGINA = 50

interface Resultado { filas: Fila[]; total: number; ms: number; pagina: number; llamada: string }
type Registro = { ok: Resultado } | { error: ApiError }

function argumentos(tipo: Tipo, p: Parametros): Record<string, string> {
  if (tipo === 'fechas') return { desde: `${p.desde}T00:00:00-05:00`, hasta: `${p.hasta}T00:00:00-05:00` }
  if (tipo === 'sesion') return { sesion: String(p.sesion) }
  return {}
}

function llamadaSql(id: string, tipo: Tipo, p: Parametros) {
  const args =
    tipo === 'fechas' ? `desde => '${p.desde} 00:00-05', hasta => '${p.hasta} 00:00-05'` : tipo === 'sesion' ? `sesion => ${p.sesion}` : ''
  return `SELECT * FROM api.${funcion(id)}(${args});`
}

export function Consultas({ escenario }: { escenario: Escenario }) {
  const lista = useRecurso((signal) => pedir<Consulta[]>(escenario, '/consultas?order=orden', { signal }), [escenario])
  const [sel, setSel] = useState('q1')
  const [params, setParams] = useState<Record<string, Parametros>>({})
  const [registros, setRegistros] = useState<Record<string, Registro>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const ctl = useRef<AbortController | null>(null)

  const clave = (id: string) => `${escenario}:${id}`
  const p = params[sel] ?? POR_DEFECTO
  const tipo = TIPO[sel] ?? 'ninguno'
  const consulta = lista.data?.find((c) => c.id === sel)
  const registro = registros[clave(sel)]

  async function ejecutar(id: string, pagina: number) {
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    const t = TIPO[id] ?? 'ninguno'
    const pid = params[id] ?? POR_DEFECTO
    const qs = new URLSearchParams({ ...argumentos(t, pid), limit: String(POR_PAGINA), offset: String(pagina * POR_PAGINA) })
    setOcupado(id)
    try {
      const r = await pedir<Fila[]>(escenario, `/rpc/${funcion(id)}?${qs}`, { contar: true, signal: c.signal })
      setRegistros((rs) => ({
        ...rs,
        [clave(id)]: { ok: { filas: r.data, total: r.total ?? r.data.length, ms: r.ms, pagina, llamada: llamadaSql(id, t, pid) } },
      }))
    } catch (err) {
      if (c.signal.aborted) return
      setRegistros((rs) => ({ ...rs, [clave(id)]: { error: err instanceof ApiError ? err : new ApiError(String(err), 0) } }))
    } finally {
      if (ctl.current === c) setOcupado(null)
    }
  }

  const alEnviar = (ev: FormEvent) => {
    ev.preventDefault()
    void ejecutar(sel, 0)
  }
  const cambiar = (campo: keyof Parametros, valor: string) =>
    setParams((ps) => ({ ...ps, [sel]: { ...(ps[sel] ?? POR_DEFECTO), [campo]: campo === 'sesion' ? Number(valor) : valor } }))

  return (
    <main className="consultas">
      <nav className="salidas" aria-labelledby="titulo-consultas">
        <h1 id="titulo-consultas">Consultas</h1>
        {lista.error ? (
          <div style={{ padding: '0 28px' }}><ErrorAviso error={lista.error} reintentar={lista.recargar} /></div>
        ) : (
          <ol>
            {(lista.data ?? []).map((c) => {
              const r = registros[clave(c.id)]
              return (
                <li key={c.id}>
                  <button type="button" className="salida" aria-current={sel === c.id} onClick={() => setSel(c.id)}>
                    <span className="q">{codigo(c.id)}</span>
                    <span className="t">{c.titulo}</span>
                    <span className="ultima">
                      <UltimaEjecucion registro={r} corriendo={ocupado === c.id} escenario={escenario} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </nav>

      <section className="detalle" aria-labelledby="titulo-detalle">
        {consulta && (
          <>
            <div className="detalle-cab">
              <h2 id="titulo-detalle"><span>{codigo(consulta.id)}</span>{consulta.titulo}</h2>
              <div className="tira">
                <div className="dato">
                  <small>Filas</small>
                  <Paleta celdas={6} valor={registro && 'ok' in registro ? entero(registro.ok.total) : ''} />
                </div>
                <div className="dato">
                  <small>Respuesta ms</small>
                  <Paleta celdas={5} valor={registro && 'ok' in registro ? milis(registro.ok.ms) : ''} />
                </div>
              </div>
            </div>

            <form className="parametros" onSubmit={alEnviar}>
              {tipo === 'fechas' && (
                <>
                  <label>Desde<input type="date" value={p.desde} min="2026-01-01" max="2026-12-31" onChange={(e) => cambiar('desde', e.target.value)} required /></label>
                  <label>Hasta<input type="date" value={p.hasta} min="2026-01-01" max="2026-12-31" onChange={(e) => cambiar('hasta', e.target.value)} required /></label>
                </>
              )}
              {tipo === 'sesion' && (
                <label>Sesión<input type="number" min={1} step={1} value={p.sesion} onChange={(e) => cambiar('sesion', e.target.value)} required /></label>
              )}
              {tipo === 'ninguno' && <p className="sin-parametros">Esta consulta no tiene parámetros: recorre todas las lecturas.</p>}
              <button type="submit" className="ejecutar" disabled={ocupado === sel}>
                {ocupado === sel ? 'Ejecutando…' : `Ejecutar ${codigo(sel)}`}
              </button>
            </form>

            <pre className="sql" aria-label={`SQL de ${codigo(sel)}`}>
              <span className="com">-- Llamada que hace la web (PostgREST)</span>{'\n'}
              <span className="llamada">{resaltar(llamadaSql(sel, tipo, p))}</span>{'\n\n'}
              <span className="com">-- Cuerpo de la función, igual a queries/{sel === 'control' ? 'control_curva_sesion' : sel}.sql de la entrega</span>{'\n'}
              {resaltar(consulta.sql)}
            </pre>

            <Resultados
              registro={registro}
              ocupado={ocupado === sel}
              escenario={escenario}
              funcion={funcion(sel)}
              irA={(pagina) => void ejecutar(sel, pagina)}
            />
          </>
        )}
      </section>
    </main>
  )
}

function UltimaEjecucion({ registro, corriendo, escenario }: { registro?: Registro; corriendo: boolean; escenario: Escenario }) {
  if (corriendo) return <><i className="marca-estado espera" aria-hidden="true" /> Ejecutando…</>
  if (!registro) return <><i className="marca-estado pendiente" aria-hidden="true" /> Sin ejecutar en {baseDeDatos(escenario)}</>
  if ('error' in registro) return <><i className="marca-estado falla" aria-hidden="true" /> Error</>
  return (
    <>
      <i className="marca-estado ok" aria-hidden="true" /> {entero(registro.ok.total)} filas · {milis(registro.ok.ms)} ms
    </>
  )
}

function Resultados({ registro, ocupado, escenario, funcion, irA }: {
  registro?: Registro; ocupado: boolean; escenario: Escenario; funcion: string; irA: (pagina: number) => void
}) {
  if (!registro)
    return <p className="vacio">{ocupado ? 'Ejecutando en PostgreSQL…' : `Pulsa «Ejecutar» para correrla sobre ${baseDeDatos(escenario)}.`}</p>
  if ('error' in registro) return <ErrorAviso error={registro.error} />

  const { filas, total, ms, pagina } = registro.ok
  const columnas = filas.length ? Object.keys(filas[0]) : []
  // JSON pierde los ceros finales de numeric(5,2): cada columna usa los decimales de su valor más largo.
  const decimales = Object.fromEntries(
    columnas.map((c) => [
      c,
      Math.min(3, Math.max(0, ...filas.map((f) => (typeof f[c] === 'number' ? (String(f[c]).split('.')[1]?.length ?? 0) : 0)))),
    ]),
  )
  const desde = pagina * POR_PAGINA
  const ultima = Math.max(0, Math.ceil(total / POR_PAGINA) - 1)

  return (
    <div className={`resultado${ocupado ? ' ocupado' : ''}`} aria-busy={ocupado}>
      {filas.length === 0 ? (
        <p className="vacio">La consulta no devolvió filas con estos parámetros.</p>
      ) : (
        <div className="desplaza">
          <table className="tabla">
            <thead>
              <tr>
                {columnas.map((c) => (
                  <th key={c} scope="col" className={typeof filas[0][c] === 'number' ? 'num' : undefined}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={desde + i}>
                  {columnas.map((c) => (
                    <td key={c} className={typeof f[c] === 'number' ? 'num' : undefined}>{celda(c, f[c], decimales[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="fuente">
        <span>Fuente <code>api.{funcion}</code></span>
        <span>{entero(total)} filas · respuesta en {milis(ms)} ms (ida y vuelta)</span>
        {total > POR_PAGINA && (
          <span className="paginas">
            <span>Filas {entero(desde + 1)}–{entero(Math.min(desde + POR_PAGINA, total))} de {entero(total)}</span>
            <button type="button" disabled={ocupado || pagina === 0} onClick={() => irA(pagina - 1)}>Anterior</button>
            <button type="button" disabled={ocupado || pagina >= ultima} onClick={() => irA(pagina + 1)}>Siguiente</button>
          </span>
        )}
      </div>
    </div>
  )
}

function celda(columna: string, v: unknown, decimales: number): ReactNode {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return columna.startsWith('id_') || columna.startsWith('num_') ? String(v) : decimal(v, decimales)
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  if (esFecha(v)) return fechaHora(v)
  return String(v)
}

const PALABRAS =
  /\b(SELECT|FROM|WHERE|JOIN|LEFT|ON|AND|OR|GROUP BY|ORDER BY|HAVING|LIMIT|WITH|AS|OVER|WINDOW|ROWS BETWEEN|PRECEDING|CURRENT ROW|USING|DESC|FILTER|IN|interval)\b/g

/** Resalta palabras clave sin usar innerHTML. */
function resaltar(sql: string): ReactNode[] {
  const partes: ReactNode[] = []
  let ultimo = 0
  for (const m of sql.matchAll(PALABRAS)) {
    const i = m.index ?? 0
    if (i > ultimo) partes.push(sql.slice(ultimo, i))
    partes.push(<span key={i} className="kw">{m[0]}</span>)
    ultimo = i + m[0].length
  }
  partes.push(sql.slice(ultimo))
  return partes.map((x, i) => <Fragment key={`p${i}`}>{x}</Fragment>)
}

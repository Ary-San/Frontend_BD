import { useEffect, useRef, useState } from 'react'
import { ApiError, baseDeDatos, pedir, useRecurso, type Escenario } from './api'
import { ErrorAviso } from './RedDeCarga'
import { Paleta } from './Paleta'
import { INFORME, type Perfil } from './informe'
import { decimal, entero } from './formato'

const PERFILES: { id: Perfil; etiqueta: string }[] = [
  { id: 'sin', etiqueta: 'Sin índices' },
  { id: 'btree', etiqueta: 'B-tree' },
  { id: 'hash', etiqueta: 'Hash' },
]
const FILAS = [
  { id: 'q1', codigo: 'Q1', titulo: 'Saltos térmicos' },
  { id: 'q2', codigo: 'Q2', titulo: 'Mayor consumo' },
  { id: 'q3', codigo: 'Q3', titulo: 'Curva de la sesión 10' },
  { id: 'q4', codigo: 'Q4', titulo: 'Conversión de reservas' },
  { id: 'q5', codigo: 'Q5', titulo: 'Picos de telemetría' },
  { id: 'control', codigo: 'C0', titulo: 'Control: igualdad pura' },
  { id: 'escritura', codigo: 'W', titulo: 'Escritura de 1 000 lecturas' },
]

interface Nodo {
  'Node Type': string
  'Relation Name'?: string
  'Index Name'?: string
  'Join Type'?: string
  Strategy?: string
  'Actual Total Time'?: number
  'Actual Rows'?: number
  'Actual Loops'?: number
  'Shared Hit Blocks'?: number
  'Shared Read Blocks'?: number
  'Workers Launched'?: number
  Plans?: Nodo[]
}
interface Medicion {
  perfil: string
  mediana_ms: number
  tiempos_ms: number[]
  planning_ms?: number
  shared_hit?: number
  shared_read?: number
  wal_bytes?: number
  plan: Nodo
}
type Matriz = Record<string, Partial<Record<Perfil, Medicion>>>
interface Indice { indice: string; tabla: string; metodo: string; tamano_bytes: number }
interface Estructura {
  indices: {
    indice: string; metodo: 'btree' | 'hash'; tamano_bytes: number
    niveles?: number; internas?: number; hojas?: number; densidad_hojas?: number
    buckets?: number; overflow?: number; entradas?: number; libre_pct?: number
  }[]
  filas: number
}

const matrices = new Map<Escenario, Matriz>()
const esPerfil = (p: string): p is Perfil => p === 'sin' || p === 'btree' || p === 'hash'

/** Milisegundos con la precisión que el informe usa para cada magnitud. */
const ms = (v: number) => (v < 1 ? decimal(v, 3) : v < 100 ? decimal(v, 2) : decimal(v, 1))
const mb = (b: number) => (b >= 1048576 ? `${decimal(b / 1048576, 1)} MB` : `${entero(Math.round(b / 1024))} kB`)

export function Laboratorio({ escenario, alCambiarPerfil }: { escenario: Escenario; alCambiarPerfil: () => void }) {
  const [matriz, setMatrizLocal] = useState<Matriz>(() => matrices.get(escenario) ?? {})
  useEffect(() => setMatrizLocal(matrices.get(escenario) ?? {}), [escenario])
  const guardar = (id: string, m: Medicion) => {
    if (!esPerfil(m.perfil)) return
    const actual = matrices.get(escenario) ?? {}
    const nueva = { ...actual, [id]: { ...actual[id], [m.perfil]: m } }
    matrices.set(escenario, nueva)
    setMatrizLocal(nueva)
  }

  const perfil = useRecurso((signal) => pedir<string>(escenario, '/rpc/perfil_actual', { signal }), [escenario])
  const indices = useRecurso((signal) => pedir<Indice[]>(escenario, '/rpc/indices', { signal }), [escenario])
  const estructura = useRecurso((signal) => pedir<Estructura>(escenario, '/rpc/estructura_indices', { signal }), [escenario])
  const [sel, setSel] = useState<{ id: string; perfil: Perfil } | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<ApiError>()
  const cancelar = useRef(false)

  const recargar = () => {
    perfil.recargar()
    indices.recargar()
    estructura.recargar()
    alCambiarPerfil()
  }

  async function aplicar(p: Perfil) {
    await pedir(escenario, '/rpc/aplicar_perfil', { method: 'POST', body: { perfil: p } })
  }
  async function medir(id: string) {
    const r =
      id === 'escritura'
        ? await pedir<Medicion>(escenario, '/rpc/medir_escritura', { method: 'POST', body: {} })
        : await pedir<Medicion>(escenario, '/rpc/medir', { method: 'POST', body: { consulta: id } })
    guardar(id, r.data)
    if (esPerfil(r.data.perfil)) setSel({ id, perfil: r.data.perfil })
  }
  async function correr(etiqueta: string, fn: () => Promise<void>) {
    setOcupado(etiqueta)
    setError(undefined)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(String(e), 0))
    } finally {
      setOcupado(null)
    }
  }

  const cambiarPerfil = (p: Perfil) =>
    void correr(`Aplicando el perfil ${PERFILES.find((x) => x.id === p)!.etiqueta}…`, async () => {
      await aplicar(p)
      recargar()
    })
  const medirFila = (id: string) =>
    void correr(`Midiendo ${FILAS.find((f) => f.id === id)!.codigo}: 2 calentamientos y 5 mediciones…`, () => medir(id))
  const medirTodo = () =>
    void correr('Midiendo…', async () => {
      cancelar.current = false
      const total = PERFILES.length * FILAS.length
      let n = 0
      try {
        for (const p of PERFILES) {
          setOcupado(`Aplicando el perfil ${p.etiqueta}…`)
          await aplicar(p.id)
          recargar()
          for (const f of FILAS) {
            if (cancelar.current) return
            n += 1
            setOcupado(`${p.etiqueta} · ${f.codigo} (${n} de ${total})`)
            await medir(f.id)
          }
        }
      } finally {
        // El recorrido termina en hash, como los dumps; si se detuvo antes, se deja hash igual.
        if (cancelar.current) {
          await aplicar('hash').catch(() => undefined)
          recargar()
        }
      }
    })

  const activo = perfil.data
  const medida = sel ? matriz[sel.id]?.[sel.perfil] : undefined
  const ultima = medida ?? undefined
  const db = baseDeDatos(escenario)

  return (
    <main className="laboratorio">
      <section className="lab-principal" aria-labelledby="titulo-lab">
        <div className="cabecera">
          <h1 id="titulo-lab">Laboratorio de índices</h1>
          <div className="tira">
            <div className="dato"><small>Perfil</small><Paleta celdas={6} valor={activo === 'btree' ? 'B-TREE' : activo === 'hash' ? 'HASH' : activo === 'sin' ? 'SIN' : ''} etiqueta={activo ?? ''} /></div>
            <div className="dato"><small>Mediana ms</small><Paleta celdas={7} valor={ultima ? ms(ultima.mediana_ms) : ''} /></div>
          </div>
        </div>

        <div className="lab-controles">
          <div className="escenarios perfiles" role="group" aria-label="Perfil de índices activo">
            {PERFILES.map((p) => (
              <button key={p.id} type="button" aria-pressed={activo === p.id} disabled={!!ocupado} onClick={() => activo !== p.id && cambiarPerfil(p.id)}>
                <i className="muestra" style={{ background: `var(--perfil-${p.id})` }} aria-hidden="true" /> {p.etiqueta}
              </button>
            ))}
          </div>
          <button type="button" className="ejecutar" disabled={!!ocupado} onClick={medirTodo}>Medir todo</button>
          {ocupado ? (
            <span className="lab-estado" role="status">
              <i className="marca-estado espera" aria-hidden="true" /> {ocupado}
              {ocupado.includes(' de ') && (
                <button type="button" className="boton-texto" onClick={() => (cancelar.current = true)}>Detener</button>
              )}
            </span>
          ) : (
            <span className="lab-estado">Cambiar de perfil ejecuta 08 y luego 07 u 11 sobre {db}.</span>
          )}
        </div>
        {error && <ErrorAviso error={error} />}

        <div className="desplaza">
          <table className="tabla matriz">
            <thead>
              <tr>
                <th scope="col">Consulta</th>
                {PERFILES.map((p) => (
                  <th key={p.id} scope="col" className={activo === p.id ? 'perfil-activo' : undefined}>
                    <i className="muestra" style={{ background: `var(--perfil-${p.id})` }} aria-hidden="true" /> {p.etiqueta}
                  </th>
                ))}
                <th scope="col"><span className="sr">Acción</span></th>
              </tr>
            </thead>
            <tbody>
              {FILAS.map((f) => {
                const fila = matriz[f.id] ?? {}
                const ref = INFORME[escenario][f.id]
                const tope = Math.max(...PERFILES.map((p) => fila[p.id]?.mediana_ms ?? 0))
                return (
                  <tr key={f.id}>
                    <th scope="row">
                      <span className="q">{f.codigo}</span> {f.titulo}
                    </th>
                    {PERFILES.map((p) => {
                      const m = fila[p.id]
                      const elegido = sel?.id === f.id && sel.perfil === p.id
                      return (
                        <td key={p.id} className={activo === p.id ? 'perfil-activo' : undefined}>
                          <button
                            type="button"
                            className={`celda-medida${elegido ? ' elegida' : ''}`}
                            disabled={!m}
                            onClick={() => setSel({ id: f.id, perfil: p.id })}
                            aria-label={m ? `${f.codigo} con ${p.etiqueta}: ${ms(m.mediana_ms)} ms. Ver plan` : `${f.codigo} con ${p.etiqueta}: sin medir`}
                          >
                            <span className="valor">{m ? `${ms(m.mediana_ms)} ms` : '—'}</span>
                            <span className="barra-dato" aria-hidden="true">
                              {m && <span style={{ width: `${Math.max(2, (m.mediana_ms / tope) * 100)}%`, background: `var(--perfil-${p.id})` }} />}
                            </span>
                            <span className="ref">{ref ? `informe ${ms(ref[p.id])}` : 'informe: solo en 1M'}</span>
                          </button>
                        </td>
                      )
                    })}
                    <td>
                      <button type="button" className="boton-sec" disabled={!!ocupado || !esPerfil(activo ?? '')} onClick={() => medirFila(f.id)}>
                        Medir
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <Estructuras estructura={estructura.data} indices={indices.data} />
        </div>

        <p className="fuente">
          <span>Fuente <code>api.medir</code> · <code>api.medir_escritura</code> · <code>api.estructura_indices</code></span>
          <span>Mediana de 5 EXPLAIN (ANALYZE, BUFFERS) tras 2 calentamientos · tiempo del servidor</span>
        </p>
      </section>

      <aside className="lateral plan" aria-live="polite">
        {medida && sel ? (
          <PlanArbol medida={medida} titulo={`${FILAS.find((f) => f.id === sel.id)!.codigo} · ${PERFILES.find((p) => p.id === sel.perfil)!.etiqueta}`} />
        ) : (
          <>
            <h2>Plan de ejecución</h2>
            <p className="sub">Mide una consulta y elige su celda para ver el árbol que ejecutó PostgreSQL, nodo por nodo.</p>
          </>
        )}
      </aside>
    </main>
  )
}

function Estructuras({ estructura, indices }: { estructura?: Estructura; indices?: Indice[] }) {
  const otros = (indices ?? []).filter((i) => i.tabla !== 'lectura_sesion')
  return (
    <section className="estructuras" aria-labelledby="titulo-estructura">
      <h2 id="titulo-estructura">Estructura de los índices de lectura_sesion</h2>
      {!estructura ? (
        <p className="sub">Leyendo pgstatindex y pgstathashindex…</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr><th scope="col">Índice</th><th scope="col">Método</th><th scope="col" className="num">Tamaño</th><th scope="col">Estructura</th></tr>
          </thead>
          <tbody>
            {estructura.indices.map((i) => (
              <tr key={i.indice}>
                <td><code>{i.indice}</code>{i.indice.endsWith('_pkey') && <span className="nota-pk"> PK, en todo perfil</span>}</td>
                <td>{i.metodo === 'btree' ? 'Árbol B+' : 'Hash'}</td>
                <td className="num">{mb(i.tamano_bytes)}</td>
                <td>
                  {i.metodo === 'btree'
                    ? `${i.niveles} niveles: 1 raíz · ${entero(i.internas!)} internas · ${entero(i.hojas!)} hojas (${decimal(i.densidad_hojas!, 0)} % llenas)`
                    : `${entero(i.buckets!)} buckets · ${entero(i.overflow!)} de desborde · ${entero(i.entradas!)} entradas`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {estructura?.indices[0]?.niveles && (
        <p className="nota">
          Buscar una fila por la PK baja {estructura.indices[0].niveles} páginas del árbol entre {entero(estructura.filas)} lecturas.
          El hash calcula el bucket y va directo, pero no sirve para rangos ni para ORDER BY.
          {otros.length > 0 && ` Fuera de lecturas: ${otros.map((i) => `${i.indice} (${i.metodo}, ${mb(i.tamano_bytes)})`).join(', ')}.`}
        </p>
      )}
    </section>
  )
}

/**
 * Bajo un Gather, PostgreSQL suma bucles de todos los procesos (líder + workers): el tiempo de
 * reloj de esos nodos es su acumulado dividido entre los procesos.
 */
const procesosHijos = (n: Nodo, procesos: number) =>
  n['Node Type'].startsWith('Gather') ? (n['Workers Launched'] ?? 0) + 1 : procesos
const reloj = (n: Nodo, procesos: number) => ((n['Actual Total Time'] ?? 0) * (n['Actual Loops'] ?? 1)) / procesos

/** Tiempo propio de un nodo: el suyo menos el de sus hijos, en tiempo de reloj. */
function propio(n: Nodo, procesos: number) {
  const ph = procesosHijos(n, procesos)
  const hijos = (n.Plans ?? []).reduce((s, h) => s + reloj(h, ph), 0)
  return Math.max(0, reloj(n, procesos) - hijos)
}

function PlanArbol({ medida, titulo }: { medida: Medicion; titulo: string }) {
  const raiz = (medida.plan['Actual Total Time'] ?? 0) * (medida.plan['Actual Loops'] ?? 1) || medida.mediana_ms
  return (
    <>
      <h2>Plan · {titulo}</h2>
      <dl className="pares">
        <dt>Mediana</dt><dd>{ms(medida.mediana_ms)} ms</dd>
        {medida.planning_ms !== undefined && <><dt>Planificación</dt><dd>{ms(medida.planning_ms)} ms</dd></>}
        {medida.shared_hit !== undefined && <><dt>Páginas en caché / leídas</dt><dd>{entero(medida.shared_hit)} / {entero(medida.shared_read ?? 0)}</dd></>}
        {medida.wal_bytes !== undefined && <><dt>WAL generado</dt><dd>{mb(medida.wal_bytes)}</dd></>}
        <dt>Las 5 mediciones</dt><dd>{medida.tiempos_ms.map(ms).join(' · ')}</dd>
      </dl>
      <h3>Árbol de nodos (barra = tiempo propio)</h3>
      <ul className="arbol">
        <NodoPlan nodo={medida.plan} raiz={raiz} procesos={1} />
      </ul>
      <p className="nota">
        Tiempos de la ejecución mediana. Bajo un Gather, el tiempo se reparte entre los procesos paralelos; las filas y bucles
        son el total de todos ellos.
      </p>
    </>
  )
}

function NodoPlan({ nodo, raiz, procesos }: { nodo: Nodo; raiz: number; procesos: number }) {
  const indice = nodo['Index Name']
  const ph = procesosHijos(nodo, procesos)
  const detalle = [
    nodo['Join Type'] && `${nodo['Join Type']} join`,
    nodo.Strategy,
    nodo['Relation Name'] && `en ${nodo['Relation Name']}`,
    nodo['Node Type'].startsWith('Gather') && `${ph} procesos`,
  ].filter(Boolean).join(' · ')
  const t = propio(nodo, procesos)
  const pct = raiz > 0 ? (t / raiz) * 100 : 0
  const bucles = nodo['Actual Loops'] ?? 1
  return (
    <li>
      <div className={`nodo${indice ? ' usa-indice' : ''}`}>
        <span className="nodo-tipo">{nodo['Node Type']}</span>
        {indice && <code className="nodo-indice">{indice}</code>}
        {detalle && <span className="nodo-detalle">{detalle}</span>}
        <span className="nodo-cifras">
          {entero(Math.round((nodo['Actual Rows'] ?? 0) * bucles))} filas{bucles > procesos ? ` en ${entero(bucles)} bucles` : ''} · {ms(t)} ms propios
        </span>
        <span className="barra-dato" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(1, pct))}%` }} /></span>
      </div>
      {nodo.Plans && nodo.Plans.length > 0 && (
        <ul>
          {nodo.Plans.map((h, i) => <NodoPlan key={i} nodo={h} raiz={raiz} procesos={ph} />)}
        </ul>
      )}
    </li>
  )
}

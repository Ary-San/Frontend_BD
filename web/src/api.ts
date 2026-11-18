// Cliente mínimo de PostgREST. Cada escenario vive detrás de /api/<escenario>/.
import { useCallback, useEffect, useRef, useState } from 'react'

export type Escenario = '1k' | '10k' | '100k' | '1m'

export const ESCENARIOS: { id: Escenario; etiqueta: string }[] = [
  { id: '1k', etiqueta: '1k' },
  { id: '10k', etiqueta: '10k' },
  { id: '100k', etiqueta: '100k' },
  { id: '1m', etiqueta: '1M' },
]

export const baseDeDatos = (e: Escenario) => `ev_charge_${e}`

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly hint?: string,
    readonly code?: string,
    readonly details?: string,
  ) {
    super(message)
  }
}

export interface Respuesta<T> {
  data: T
  /** Tiempo de ida y vuelta medido en el navegador. */
  ms: number
  /** Total de filas cuando se pide con Prefer: count=exact. */
  total?: number
}

interface Opciones {
  contar?: boolean
  signal?: AbortSignal
  method?: 'GET' | 'POST'
  body?: unknown
}

export async function pedir<T>(e: Escenario, ruta: string, op: Opciones = {}): Promise<Respuesta<T>> {
  const headers: Record<string, string> = {}
  if (op.contar) headers.Prefer = 'count=exact'
  if (op.body !== undefined) headers['Content-Type'] = 'application/json'

  const t0 = performance.now()
  let res: Response
  try {
    res = await fetch(`/api/${e}${ruta}`, {
      method: op.method ?? 'GET',
      headers,
      signal: op.signal,
      body: op.body === undefined ? undefined : JSON.stringify(op.body),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw sinConexion(e, 0)
  }
  const texto = await res.text()
  const ms = performance.now() - t0

  if (!res.ok) {
    let j: { message?: string; hint?: string; code?: string; details?: string } | undefined
    try {
      j = JSON.parse(texto)
    } catch {
      /* respuesta no JSON: el proxy no llegó a PostgREST */
    }
    if (!j?.message) throw sinConexion(e, res.status)
    throw new ApiError(j.message, res.status, j.hint ?? undefined, j.code, j.details ?? undefined)
  }

  const rango = res.headers.get('Content-Range')
  const total = rango?.includes('/') ? Number(rango.split('/')[1]) : undefined
  return { data: JSON.parse(texto) as T, ms, total: Number.isFinite(total) ? total : undefined }
}

function sinConexion(e: Escenario, status: number) {
  return new ApiError(
    `No hay conexión con la base ${baseDeDatos(e)}${status ? ` (HTTP ${status})` : ''}.`,
    status,
    'Levanta los contenedores con «docker compose up -d» en la carpeta mvp-web y vuelve a intentar.',
  )
}

export interface Estado<T> {
  data?: T
  error?: ApiError
  cargando: boolean
  ms?: number
  recargar: () => void
}

/** Pide un recurso cada vez que cambian las dependencias; descarta respuestas viejas. */
export function useRecurso<T>(cargar: (signal: AbortSignal) => Promise<Respuesta<T>>, deps: unknown[]): Estado<T> {
  const [estado, setEstado] = useState<Omit<Estado<T>, 'recargar'>>({ cargando: true })
  const [vuelta, setVuelta] = useState(0)
  const cargarRef = useRef(cargar)
  cargarRef.current = cargar
  const claveDeps = JSON.stringify(deps)
  const ultimaClave = useRef(claveDeps)

  useEffect(() => {
    const ctl = new AbortController()
    // Con otras dependencias (otro escenario) los datos anteriores ya no valen: nunca se
    // muestran datos de una base bajo el nombre de otra. Un reintento sí los conserva.
    const otras = ultimaClave.current !== claveDeps
    ultimaClave.current = claveDeps
    setEstado((s) => (otras ? { cargando: true } : { ...s, cargando: true, error: undefined }))
    cargarRef
      .current(ctl.signal)
      .then((r) => setEstado({ data: r.data, ms: r.ms, cargando: false }))
      .catch((err) => {
        if (ctl.signal.aborted) return
        setEstado((s) => ({ ...s, cargando: false, error: err instanceof ApiError ? err : new ApiError(String(err), 0) }))
      })
    return () => ctl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, vuelta])

  const recargar = useCallback(() => setVuelta((v) => v + 1), [])
  return { ...estado, recargar }
}

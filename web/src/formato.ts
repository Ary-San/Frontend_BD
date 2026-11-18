const cache = new Map<number, Intl.NumberFormat>()
function nf(decimales: number) {
  let f = cache.get(decimales)
  if (!f) {
    f = new Intl.NumberFormat('es-PE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
    cache.set(decimales, f)
  }
  return f
}

export const entero = (n: number) => nf(0).format(n)
export const decimal = (n: number, d = 1) => nf(d).format(n)
export const soles = (n: number) => `S/ ${nf(2).format(n)}`

const fh = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})
export const fechaHora = (iso: string) => fh.format(new Date(iso)).replace(', ', ' ')

const hm = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export const horaLima = (d: Date) => hm.format(d)

// <input type="datetime-local"> trabaja en hora de Lima (UTC-5 todo el año, sin horario de verano).
const partesLima = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
export function aEntradaLima(iso: string) {
  const p = Object.fromEntries(partesLima.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
export const desdeEntradaLima = (v: string) => `${v}:00-05:00`
export const sumarMinutos = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60_000).toISOString()

/** Milisegundos legibles: un decimal por debajo de 10 ms. */
export const milis = (ms: number) => (ms < 10 ? decimal(ms, 1) : entero(Math.round(ms)))

export const esFecha = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)

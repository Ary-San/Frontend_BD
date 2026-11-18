import { useEffect, useState } from 'react'
import { ESCENARIOS, baseDeDatos, pedir, useRecurso, type Escenario } from './api'
import { RedDeCarga } from './RedDeCarga'
import { Consultas } from './Consultas'
import { Operacion } from './Operacion'
import { Laboratorio } from './Laboratorio'

export interface Info {
  escenario: string
  version: string
  perfil: string
  huella: string
  filas: Record<'lectura_sesion' | 'sesion_carga' | 'reserva' | 'pago' | 'usuario' | 'estacion', number>
}

type Ruta = 'red' | 'consultas' | 'operacion' | 'laboratorio'
const RUTAS: { id: Ruta; etiqueta: string }[] = [
  { id: 'red', etiqueta: 'Red de carga' },
  { id: 'consultas', etiqueta: 'Consultas' },
  { id: 'operacion', etiqueta: 'Operación' },
  { id: 'laboratorio', etiqueta: 'Laboratorio' },
]

const leerRuta = (): Ruta => RUTAS.find((r) => location.hash.startsWith(`#/${r.id}`))?.id ?? 'red'

const CLAVE = 'electroruta.escenario'
function leerEscenario(): Escenario {
  try {
    const v = localStorage.getItem(CLAVE)
    if (ESCENARIOS.some((e) => e.id === v)) return v as Escenario
  } catch {
    /* almacenamiento bloqueado: se usa el escenario por defecto */
  }
  return '1m'
}

export function App() {
  const [ruta, setRuta] = useState<Ruta>(leerRuta)
  const [escenario, setEscenario] = useState<Escenario>(leerEscenario)

  useEffect(() => {
    const alCambiar = () => setRuta(leerRuta())
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  const elegir = (e: Escenario) => {
    setEscenario(e)
    try {
      localStorage.setItem(CLAVE, e)
    } catch {
      /* sin almacenamiento: el cambio vale solo para esta visita */
    }
  }

  const info = useRecurso((signal) => pedir<Info>(escenario, '/rpc/info', { signal }), [escenario])
  // Se vuelve a pedir al cambiar de pestaña (conservando lo mostrado): Operación escribe filas y
  // restaurar.sh cambia la huella de la base.
  const recargarInfo = info.recargar
  useEffect(() => recargarInfo(), [ruta, recargarInfo])

  return (
    <div className="app">
      <header className="barra">
        <a className="marca" href="#/red">
          Electro<b>Ruta</b>
        </a>
        <nav className="pestanas" aria-label="Secciones">
          {RUTAS.map((r) => (
            <a key={r.id} href={`#/${r.id}`} aria-current={ruta === r.id ? 'page' : undefined}>
              {r.etiqueta}
            </a>
          ))}
        </nav>
        <div className="barra-der">
          <div className="escenarios" role="group" aria-label="Escenario de datos">
            {ESCENARIOS.map((e) => (
              <button key={e.id} type="button" aria-pressed={escenario === e.id} onClick={() => elegir(e.id)}>
                {e.etiqueta}
              </button>
            ))}
          </div>
          <Conexion escenario={escenario} info={info.data} cargando={info.cargando} error={!!info.error} />
        </div>
      </header>
      {ruta === 'red' && <RedDeCarga escenario={escenario} info={info.data} recargarInfo={info.recargar} />}
      {ruta === 'consultas' && <Consultas escenario={escenario} />}
      {ruta === 'operacion' && <Operacion escenario={escenario} huella={info.data?.huella} />}
      {ruta === 'laboratorio' && <Laboratorio escenario={escenario} alCambiarPerfil={recargarInfo} />}
    </div>
  )
}

function Conexion({ escenario, info, cargando, error }: { escenario: Escenario; info?: Info; cargando: boolean; error: boolean }) {
  const db = baseDeDatos(escenario)
  if (error)
    return (
      <div className="conexion" role="status">
        <i className="marca-estado falla" aria-hidden="true" />
        Sin conexión con <strong>{db}</strong>
      </div>
    )
  if (cargando || !info)
    return (
      <div className="conexion" role="status">
        <i className="marca-estado pendiente" aria-hidden="true" />
        Conectando con <strong>{db}</strong>…
      </div>
    )
  return (
    <div className="conexion" role="status">
      <i className="marca-estado ok" aria-hidden="true" />
      <span className="detalle-conexion">PostgreSQL {info.version.split(' ')[0]} ·</span> <strong>{info.escenario}</strong> · perfil {info.perfil}
    </div>
  )
}

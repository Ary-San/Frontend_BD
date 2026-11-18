// Celdas de paleta partidas (tablero Solari). Al cambiar el valor, cada carácter distinto
// gira por dígitos al azar y se asienta de izquierda a derecha.
import { useEffect, useRef, useState } from 'react'

const GIRO = '0123456789'
const TICK_MS = 45

const sinMovimiento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

interface Props {
  valor: string
  /** Ancho fijo en celdas: el valor se alinea a la derecha y la columna no se mueve. */
  celdas?: number
  tam?: 's' | 'm' | 'g'
  /** Texto para lectores de pantalla, si difiere del valor. */
  etiqueta?: string
}

export function Paleta({ valor, celdas, tam = 'm', etiqueta }: Props) {
  const destino = celdas ? valor.padStart(celdas, ' ') : valor
  const [visible, setVisible] = useState(destino)
  const [tick, setTick] = useState(0)
  const anterior = useRef(destino)

  useEffect(() => {
    const desde = anterior.current.padStart(destino.length, ' ')
    anterior.current = destino
    if (desde === destino || sinMovimiento()) {
      setVisible(destino)
      return
    }
    let paso = 0
    const id = window.setInterval(() => {
      paso += 1
      setTick(paso)
      setVisible(
        destino
          .split('')
          .map((c, i) => {
            if (c === desde[i] || paso >= 4 + i * 2) return c
            return GIRO[(paso * 7 + i * 3) % GIRO.length]
          })
          .join(''),
      )
      if (paso >= 4 + destino.length * 2) window.clearInterval(id)
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [destino])

  return (
    <span className={`paleta paleta-${tam}`} role="img" aria-label={etiqueta ?? valor.trim()}>
      {visible.split('').map((c, i) => (
        <span key={i} className={`celda${c !== destino[i] ? (tick % 2 ? ' gira-a' : ' gira-b') : ''}`} aria-hidden="true">
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </span>
  )
}

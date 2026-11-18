// Medianas del informe del Hito 2 (Entrega_Final_Grupo_10/informe/main.tex, sección «Medición de
// tiempos»): Execution Time en ms, mediana de 5 ejecuciones tras 2 calentamientos, PostgreSQL 18.6.
import type { Escenario } from './api'

export type Perfil = 'sin' | 'btree' | 'hash'
type Fila = Record<Perfil, number>

export const INFORME: Record<Escenario, Record<string, Fila>> = {
  '1k': {
    q1: { sin: 0.273, btree: 0.25, hash: 0.348 },
    q2: { sin: 0.057, btree: 0.05, hash: 0.044 },
    q3: { sin: 0.352, btree: 0.226, hash: 0.198 },
    q4: { sin: 0.045, btree: 0.044, hash: 0.064 },
    q5: { sin: 0.204, btree: 0.155, hash: 0.19 },
    control: { sin: 0.033, btree: 0.022, hash: 0.017 },
  },
  '10k': {
    q1: { sin: 2.603, btree: 2.547, hash: 2.507 },
    q2: { sin: 0.11, btree: 0.099, hash: 0.084 },
    q3: { sin: 0.265, btree: 0.247, hash: 0.25 },
    q4: { sin: 0.147, btree: 0.137, hash: 0.078 },
    q5: { sin: 0.878, btree: 0.408, hash: 0.627 },
    control: { sin: 0.01, btree: 0.016, hash: 0.018 },
  },
  '100k': {
    q1: { sin: 23.531, btree: 23.595, hash: 23.755 },
    q2: { sin: 0.536, btree: 0.396, hash: 0.378 },
    q3: { sin: 0.491, btree: 0.439, hash: 0.451 },
    q4: { sin: 0.357, btree: 0.317, hash: 0.314 },
    q5: { sin: 7.381, btree: 5.426, hash: 7.749 },
    control: { sin: 0.01, btree: 0.025, hash: 0.01 },
  },
  '1m': {
    q1: { sin: 170.729, btree: 165.399, hash: 116.4 },
    q2: { sin: 4.932, btree: 3.551, hash: 3.325 },
    q3: { sin: 0.27, btree: 0.263, hash: 0.278 },
    q4: { sin: 3.635, btree: 3.005, hash: 3.005 },
    q5: { sin: 37.077, btree: 36.676, hash: 37.947 },
    control: { sin: 0.01, btree: 0.016, hash: 0.01 },
    // Costo de escritura: lote de 1 000 lecturas, solo medido en 1M.
    escritura: { sin: 29.685, btree: 31.864, hash: 33.45 },
  },
}

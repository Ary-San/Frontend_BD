import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cada escenario tiene su PostgREST. La web siempre llama a /api/<escenario>/...,
// así funciona igual en local (este proxy) y desplegada (un nginx con las mismas rutas).
const escenarios = { '1k': 3001, '10k': 3002, '100k': 3003, '1m': 3004 }

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: Object.fromEntries(
      Object.entries(escenarios).map(([id, port]) => [
        `/api/${id}/`,
        { target: `http://localhost:${port}`, rewrite: (p: string) => p.replace(`/api/${id}`, '') },
      ]),
    ),
  },
})

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/ajedrez/',
  build: { target: 'es2020' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})

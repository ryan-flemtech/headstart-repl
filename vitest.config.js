import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/shared/pyodide.worker.js',
        'src/shared/scratch.js',
        'src/**/*.worker.js',
        'src/main.jsx',
        'src/builder/main.jsx',
        'node_modules/**',
      ],
      // Thresholds reflect current test scope (pure functions + simple components).
      // Raise these incrementally as StudentView, TeacherView, useSession, and
      // builder components gain test coverage.
      thresholds: {
        lines: 8,
        branches: 6,
        functions: 8,
        statements: 8,
      },
    },
  },
})

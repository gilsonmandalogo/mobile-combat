import path from 'path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@src': path.resolve(root, 'src'),
      '@stores': path.resolve(root, 'src/stores'),
      '@particles': path.resolve(root, 'src/particles'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
})

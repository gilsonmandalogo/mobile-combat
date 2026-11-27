import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, 'src'),
      '@stores': path.resolve(__dirname, 'src/stores'),
      '@levels': path.resolve(__dirname, 'src/levels'),
      '@particles': path.resolve(__dirname, 'src/particles'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
})

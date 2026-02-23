import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/__tests__/',
        'src/types/pidusage.d.ts',
        'benchmarks/',
      ],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: [],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './src/core'),
      '@capture': resolve(__dirname, './src/capture'),
      '@websocket': resolve(__dirname, './src/websocket'),
      '@process': resolve(__dirname, './src/process'),
      '@monitoring': resolve(__dirname, './src/monitoring'),
      '@lifecycle': resolve(__dirname, './src/lifecycle'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@factory': resolve(__dirname, './src/factory'),
      '@interfaces': resolve(__dirname, './src/interfaces'),
      '@types': resolve(__dirname, './src/types'),
    },
  },
});

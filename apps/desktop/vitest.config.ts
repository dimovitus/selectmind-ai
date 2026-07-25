import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/domain', replacement: resolve(__dirname, '../../packages/core/src/domain') },
      { find: '@/shared', replacement: resolve(__dirname, '../../packages/shared/src') },
      { find: '@selectmind/core', replacement: resolve(__dirname, '../../packages/core/src/index.ts') },
      { find: '@selectmind/shared', replacement: resolve(__dirname, '../../packages/shared/src/index.ts') },
      { find: '@tauri-apps/api/core', replacement: resolve(__dirname, '../../tests/mocks/tauri-api-core.ts') },
      { find: '@tauri-apps/api/window', replacement: resolve(__dirname, '../../tests/mocks/tauri-api-window.ts') },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

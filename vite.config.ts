import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: [
      { find: '@/application', replacement: resolve(__dirname, 'packages/core/src/application') },
      { find: '@/domain', replacement: resolve(__dirname, 'packages/core/src/domain') },
      { find: '@/infrastructure/ai', replacement: resolve(__dirname, 'packages/core/src/ai') },
      { find: '@/shared', replacement: resolve(__dirname, 'packages/shared/src') },
      { find: '@', replacement: resolve(__dirname, 'src') },
      { find: '@selectmind/core', replacement: resolve(__dirname, 'packages/core/src/index.ts') },
      { find: '@selectmind/shared', replacement: resolve(__dirname, 'packages/shared/src/index.ts') },
    ],
  },
});

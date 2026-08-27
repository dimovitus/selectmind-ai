import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: 'dist',
  },
  resolve: {
    alias: [
      { find: '@/domain', replacement: resolve(__dirname, '../../packages/core/src/domain') },
      { find: '@/application', replacement: resolve(__dirname, '../../packages/core/src/application') },
      { find: '@/shared', replacement: resolve(__dirname, '../../packages/shared/src') },
      { find: '@/presentation', replacement: resolve(__dirname, '../../src/presentation') },
      { find: '@/options', replacement: resolve(__dirname, '../../src/options') },
      {
        find: '@/infrastructure/messaging/rpc-client',
        replacement: resolve(__dirname, 'src/messaging/desktop-rpc-client.ts'),
      },
      {
        find: '@/infrastructure/messaging/message-types',
        replacement: resolve(__dirname, '../../src/infrastructure/messaging/message-types.ts'),
      },
      { find: '@selectmind/core', replacement: resolve(__dirname, '../../packages/core/src/index.ts') },
      { find: '@selectmind/shared', replacement: resolve(__dirname, '../../packages/shared/src/index.ts') },
    ],
  },
});

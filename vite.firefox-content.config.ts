import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'node:url';
import { srcAliases } from './vite.shared';

const rootDir = dirname(fileURLToPath(import.meta.url));

/** Firefox / Zen content script must be a single classic IIFE (no ES imports). */
export default defineConfig({
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: srcAliases,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist-firefox',
    emptyOutDir: false,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve(rootDir, 'src/content/index.ts'),
      name: 'SelectMindContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: 'assets/content-[name][extname]',
      },
      plugins: [
        {
          name: 'drop-extracted-content-css',
          generateBundle(_options, bundle) {
            for (const [fileName, piece] of Object.entries(bundle)) {
              if (piece.type === 'asset' && fileName.endsWith('.css')) {
                delete bundle[fileName];
              }
            }
          },
        },
      ],
    },
  },
});

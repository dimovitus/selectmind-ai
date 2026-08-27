import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'node:url';
import { srcAliases } from './vite.shared';
import { createFirefoxManifest } from './manifest.firefox';

const rootDir = dirname(fileURLToPath(import.meta.url));

function firefoxManifestPlugin(): Plugin {
  const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8')) as { version: string };
  return {
    name: 'firefox-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: `${JSON.stringify(createFirefoxManifest(pkg.version), null, 2)}\n`,
      });
    },
  };
}

/** Firefox / Zen: options, sidebar, and background as ES modules. Content is a separate IIFE build. */
export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react(), firefoxManifestPlugin()],
  resolve: {
    alias: srcAliases,
  },
  build: {
    outDir: 'dist-firefox',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        background: resolve(rootDir, 'src/background/index.ts'),
        options: resolve(rootDir, 'src/options/index.html'),
        sidepanel: resolve(rootDir, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});

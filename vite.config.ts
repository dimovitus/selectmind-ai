import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
import { srcAliases } from './vite.shared';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: srcAliases,
  },
});

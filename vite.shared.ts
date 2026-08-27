import { dirname, resolve } from 'path';
import { fileURLToPath } from 'node:url';
import type { AliasOptions } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));

export const srcAliases: AliasOptions = [
  { find: '@/application', replacement: resolve(rootDir, 'packages/core/src/application') },
  { find: '@/domain', replacement: resolve(rootDir, 'packages/core/src/domain') },
  { find: '@/infrastructure/ai', replacement: resolve(rootDir, 'packages/core/src/ai') },
  { find: '@/shared', replacement: resolve(rootDir, 'packages/shared/src') },
  { find: '@', replacement: resolve(rootDir, 'src') },
  { find: '@selectmind/core', replacement: resolve(rootDir, 'packages/core/src/index.ts') },
  { find: '@selectmind/shared', replacement: resolve(rootDir, 'packages/shared/src/index.ts') },
];

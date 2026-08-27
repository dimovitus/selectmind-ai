import { chmodSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Restore +x on npm shims after a copy/checkout that dropped execute bits. */
if (process.platform === 'win32') {
  process.exit(0);
}

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dirs = [
  join(root, 'node_modules', '.bin'),
  join(root, 'apps', 'desktop', 'node_modules', '.bin'),
];

for (const dir of dirs) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.cmd') || name.endsWith('.ps1')) continue;
    try {
      chmodSync(join(dir, name), 0o755);
    } catch {
      // ignore files we cannot chmod
    }
  }
}

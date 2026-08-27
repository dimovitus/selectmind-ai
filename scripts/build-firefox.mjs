import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist-firefox');

function run(command) {
  execSync(command, { cwd: rootDir, stdio: 'inherit' });
}

run('npx tsc --noEmit');
run('npx vite build --config vite.firefox.config.ts');
run('npx vite build --config vite.firefox-content.config.ts');

const iconsDest = path.join(distDir, 'assets', 'icons');
mkdirSync(iconsDest, { recursive: true });
cpSync(path.join(rootDir, 'assets', 'icons'), iconsDest, { recursive: true });

console.log(`\nFirefox / Zen build → ${path.relative(rootDir, distDir)}`);
console.log('Load unpacked: about:debugging → This Firefox → Load Temporary Add-on → dist-firefox/manifest.json');

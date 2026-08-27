import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist-firefox');
const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version ?? '0.0.0';
const zipName = `selectmind-ai-firefox-v${version}.zip`;
const zipPath = path.join(rootDir, zipName);

try {
  statSync(path.join(distDir, 'manifest.json'));
} catch {
  throw new Error('dist-firefox/manifest.json not found. Run npm run build:firefox first.');
}

execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force"`,
  { stdio: 'inherit' },
);

console.log(`\nCreated ${zipName}`);
console.log('Sideload in Firefox/Zen: about:addons → gear → Install Add-on From File');
console.log('Or rename the zip to .xpi for AMO / manual install.');

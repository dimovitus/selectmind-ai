import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const tauriDir = path.join(rootDir, 'apps', 'desktop', 'src-tauri');
const cargoTargetDir = path.join(tauriDir, 'target');
const bundleDir = path.join(cargoTargetDir, 'release', 'bundle', 'nsis');

console.log('Building SelectMind desktop installer (NSIS)…\n');

/** Pin Cargo output so the installer path is stable (CI/sandbox may override CARGO_TARGET_DIR). */
const buildEnv = {
  ...process.env,
  CARGO_TARGET_DIR: cargoTargetDir,
};

execSync('npm run build:desktop', {
  cwd: rootDir,
  stdio: 'inherit',
  env: buildEnv,
});

if (!existsSync(bundleDir)) {
  console.error('\nNSIS bundle folder not found:', bundleDir);
  console.error('Ensure tauri build completed and NSIS target is enabled.');
  process.exit(1);
}

if (!existsSync(bundleDir)) {
  console.error('\nNSIS bundle folder not found:', bundleDir);
  console.error('Ensure tauri build completed and NSIS target is enabled.');
  process.exit(1);
}

const installers = readdirSync(bundleDir).filter((name) => name.endsWith('-setup.exe'));

console.log('\nDesktop package complete.');
if (installers.length > 0) {
  for (const name of installers) {
    console.log(`  → ${path.join(bundleDir, name)}`);
  }
} else {
  console.log(`  Bundle dir: ${bundleDir}`);
  console.log('  (No *-setup.exe found — check build logs.)');
}

console.log('\nSee docs/DESKTOP_RELEASE.md for signing and distribution.');

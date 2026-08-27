import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const tauriDir = path.join(rootDir, 'apps', 'desktop', 'src-tauri');
const cargoTargetDir = path.join(tauriDir, 'target');
const releaseDir = path.join(rootDir, 'apps', 'desktop', 'release');
const isWindows = process.platform === 'win32';

console.log(
  isWindows
    ? 'Building SelectMind desktop installer (NSIS)…\n'
    : 'Building SelectMind desktop bundles (deb / AppImage)…\n',
);

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

mkdirSync(releaseDir, { recursive: true });

function copyFromBundle(subdir, predicate) {
  const bundleDir = path.join(cargoTargetDir, 'release', 'bundle', subdir);
  if (!existsSync(bundleDir)) {
    return [];
  }
  const files = readdirSync(bundleDir).filter(predicate);
  for (const name of files) {
    const built = path.join(bundleDir, name);
    const shipped = path.join(releaseDir, name);
    copyFileSync(built, shipped);
    console.log(`  → ${shipped}`);
  }
  return files;
}

console.log('\nDesktop package complete.');

if (isWindows) {
  const nsisDir = path.join(cargoTargetDir, 'release', 'bundle', 'nsis');
  if (!existsSync(nsisDir)) {
    console.error('\nNSIS bundle folder not found:', nsisDir);
    console.error('Ensure tauri build completed and NSIS target is enabled.');
    process.exit(1);
  }
  const installers = copyFromBundle('nsis', (name) => name.endsWith('-setup.exe'));
  if (installers.length === 0) {
    console.log(`  Bundle dir: ${nsisDir}`);
    console.log('  (No *-setup.exe found — check build logs.)');
  }
  const portableExe = path.join(cargoTargetDir, 'release', 'selectmind-desktop.exe');
  if (existsSync(portableExe)) {
    const shippedPortable = path.join(releaseDir, 'selectmind-desktop.exe');
    copyFileSync(portableExe, shippedPortable);
    console.log(`  → ${shippedPortable}`);
  }
} else {
  copyFromBundle('deb', (name) => name.endsWith('.deb'));
  copyFromBundle('appimage', (name) => name.toLowerCase().endsWith('.appimage'));
  const portable = path.join(cargoTargetDir, 'release', 'selectmind-desktop');
  if (existsSync(portable)) {
    const shipped = path.join(releaseDir, 'selectmind-desktop');
    copyFileSync(portable, shipped);
    console.log(`  → ${shipped}`);
  }
}

console.log('\nSee docs/DESKTOP_RELEASE.md and docs/DESKTOP_LINUX.md for distribution.');

import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../assets/icons');
mkdirSync(outDir, { recursive: true });

const SIZES = [16, 32, 48, 128];

/** @param {number} size */
function buildSvg(size) {
  const rx = Math.round(size * 0.22);
  const fontSize = size <= 16 ? 9 : Math.round(size * 0.41);
  const y = Math.round(size * 0.58);
  const letterSpacing = size >= 48 ? -3 : size >= 32 ? -2 : -1;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="8%" y1="6%" x2="92%" y2="94%">
      <stop offset="0%" stop-color="#a855f7"/>
      <stop offset="48%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <linearGradient id="shine" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="textGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${Math.max(1, Math.round(size * 0.02))}" stdDeviation="${Math.max(0.5, size * 0.015)}" flood-color="#312e81" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#shine)"/>
  <text
    x="50%"
    y="${y}"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Segoe UI, system-ui, -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="800"
    fill="#ffffff"
    letter-spacing="${letterSpacing}"
    filter="url(#textGlow)"
  >SM</text>
</svg>`;
}

for (const size of SIZES) {
  const png = await sharp(Buffer.from(buildSvg(size))).png().toBuffer();
  writeFileSync(join(outDir, `icon-${size}.png`), png);
  console.log(`Created icon-${size}.png`);
}

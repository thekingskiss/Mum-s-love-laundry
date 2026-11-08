// Renders the app icons in public/icons from the brand mark below (the white
// "M" and heart on the brand red, the same mark the dashboard sidebar uses).
//
//   cd client
//   npm install --no-save sharp
//   node scripts/generate-pwa-icons.mjs
//
// The PNGs are committed, so this only needs re-running when the mark changes.
// sharp is deliberately not a dependency: nobody needs it to build or run the app.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');
const BRAND = '#eb1c1c';

// The mark, drawn on a 512 grid. `scale` shrinks it toward the centre; maskable
// icons need that, because launchers crop them to a circle or squircle and only
// the middle 80% is guaranteed to be visible.
function mark(scale = 1) {
  const shift = 256 * (1 - scale);
  return `
    <g transform="translate(${shift} ${shift + 8 * scale}) scale(${scale})" fill="#ffffff">
      <path d="M256 168 C196 124 196 76 230 76 C245 76 256 87 256 97 C256 87 267 76 282 76 C316 76 316 124 256 168 Z"/>
      <polygon points="116,410 116,206 174,206 256,314 338,206 396,206 396,410 338,410 338,292 256,400 174,292 174,410"/>
    </g>`;
}

function svg({ size = 512, radius = 0, scale = 1 }) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="${radius}" fill="${BRAND}"/>${mark(scale)}
    </svg>`
  );
}

const icons = [
  // Standard icons: rounded corners over transparency.
  { file: 'icon-192.png', size: 192, radius: 96 },
  { file: 'icon-512.png', size: 512, radius: 112 },
  // Maskable: full-bleed, mark kept inside the safe zone.
  { file: 'icon-maskable-512.png', size: 512, radius: 0, scale: 0.78 },
  // iOS applies its own rounding, so it wants an opaque square.
  { file: 'apple-touch-icon.png', size: 180, radius: 0, scale: 0.88 },
  { file: 'favicon-32.png', size: 32, radius: 8 },
];

await mkdir(OUT, { recursive: true });
for (const { file, ...options } of icons) {
  const png = await sharp(svg(options), { density: 384 }).resize(options.size, options.size).png().toBuffer();
  await writeFile(path.join(OUT, file), png);
  console.log('wrote', file);
}
await writeFile(path.join(OUT, 'icon.svg'), svg({ size: 512, radius: 112 }));
console.log('wrote icon.svg');

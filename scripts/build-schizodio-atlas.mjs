/**
 * build-schizodio-atlas.mjs
 *
 * Stitches all 999 Schizodio NFT images (from public/nft/) into a single
 * WebP texture atlas at public/atlas/schizodio-atlas.webp
 *
 * This pre-built atlas loads as ONE HTTP request instead of 999,
 * making the board render artwork immediately on every visit.
 *
 * Usage: node scripts/build-schizodio-atlas.mjs
 *
 * Grid layout: Math.ceil(sqrt(N)) × Math.ceil(N/cols) — same formula
 * as TextureAtlas.ts so UV coordinates match automatically.
 *
 * Requires: sharp (devDependency)
 */

import { readFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const CELL_SIZE  = 128;                                   // px per cell (matches TextureAtlas default)
const JSON_PATH  = './src/core/data/schizodio.json';
const NFT_DIR    = './public/nft';
const OUT_DIR    = './public/atlas';
const OUT_FILE   = `${OUT_DIR}/schizodio-atlas.webp`;
const MANIFEST   = `${OUT_DIR}/schizodio-manifest.json`;
const CONCURRENCY = 20;                                   // parallel sharp jobs at a time

// ─── Load character list ──────────────────────────────────────────────────────

const data = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
const characters = data.characters;
const count = characters.length;

const cols = Math.ceil(Math.sqrt(count));
const rows = Math.ceil(count / cols);
const atlasW = cols * CELL_SIZE;
const atlasH = rows * CELL_SIZE;

console.log(`\nSchizodio Atlas Builder`);
console.log(`  Characters : ${count}`);
console.log(`  Grid       : ${cols} × ${rows} cells`);
console.log(`  Atlas size : ${atlasW} × ${atlasH} px`);
console.log(`  Output     : ${OUT_FILE}\n`);

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ─── Build manifest (charId → cell index) ────────────────────────────────────

const manifest = {};
characters.forEach((char, i) => {
  manifest[`nft_${char.id}`] = i;
});

// ─── Resize images and build composite array ─────────────────────────────────

const composites = new Array(count).fill(null);
let done = 0;
let missing = 0;

async function processOne(i) {
  const char = characters[i];
  const imgPath = path.join(NFT_DIR, `${char.id}.png`);

  if (!existsSync(imgPath)) {
    console.warn(`  [!] Missing: ${imgPath}`);
    missing++;
    return;
  }

  const col = i % cols;
  const row = Math.floor(i / cols);

  const resized = await sharp(imgPath)
    .resize(CELL_SIZE, CELL_SIZE, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  composites[i] = {
    input: resized.data,
    raw: { width: CELL_SIZE, height: CELL_SIZE, channels: 4 },
    left: col * CELL_SIZE,
    top: row * CELL_SIZE,
  };

  done++;
  if (done % 100 === 0) {
    process.stdout.write(`  Processing... ${done}/${count}\r`);
  }
}

// Process with concurrency limit
for (let batch = 0; batch < count; batch += CONCURRENCY) {
  const end = Math.min(batch + CONCURRENCY, count);
  const jobs = [];
  for (let i = batch; i < end; i++) jobs.push(processOne(i));
  await Promise.all(jobs);
}

console.log(`\n  Processed: ${done} images (${missing} missing)`);

// ─── Composite and write ──────────────────────────────────────────────────────

console.log(`  Compositing ${atlasW}×${atlasH} atlas...`);

await sharp({
  create: {
    width: atlasW,
    height: atlasH,
    channels: 4,
    background: { r: 15, g: 14, b: 23, alpha: 255 }, // #0f0e17
  },
})
  .composite(composites.filter(Boolean))
  .webp({ quality: 88, effort: 4 })
  .toFile(OUT_FILE);

// Write manifest
const manifestStr = JSON.stringify(manifest);
import('fs').then(({ writeFileSync }) => {
  writeFileSync(MANIFEST, manifestStr, 'utf-8');
});

const { size } = (await import('fs')).statSync(OUT_FILE);
console.log(`\n  Done!`);
console.log(`  Atlas  : ${OUT_FILE} (${(size / 1024 / 1024).toFixed(1)} MB)`);
console.log(`  Manifest: ${MANIFEST}`);
console.log(`\n  Load it via: /atlas/schizodio-atlas.webp\n`);

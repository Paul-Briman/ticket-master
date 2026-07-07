// Rasterize client/public/favicon.svg into every browser-required
// size, build a multi-image favicon.ico, then package the whole set
// as ticket-master-favicon.zip for handoff.
//
// This script is the single source of truth for the favicon set.
// Whenever the SVG changes, rerun:
//   node scripts/build-favicon.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require_ = createRequire(import.meta.url)

// Tools live in a shared tmp/ install (see conversation setup).
// On Windows, `/tmp` resolves to %LOCALAPPDATA%\Temp — use the OS path.
const TMP_NM =
  process.platform === 'win32'
    ? `${process.env.LOCALAPPDATA || process.env.TEMP || 'C:\\Windows\\Temp'}\\Temp\\node_modules`
    : '/tmp/node_modules'
// %LOCALAPPDATA% already ends with "\Local", so the double-Temp is wrong.
// Recompute cleanly from process.env.TEMP.
const TMP_NM_FIXED =
  process.platform === 'win32' && process.env.TEMP
    ? `${process.env.TEMP}\\node_modules`
    : TMP_NM
const sharp = require_(`${TMP_NM_FIXED}\\sharp`)
// png-to-ico v3 is native ESM with a default export — require() returns
// a module namespace object; the callable lives on `.default`.
const pngToIcoModule = require_(`${TMP_NM_FIXED}\\png-to-ico`)
const pngToIco = pngToIcoModule.default || pngToIcoModule
// archiver v8 is native ESM with named class exports — use ZipArchive
// directly rather than the legacy factory function shape.
const archiverModule = require_(`${TMP_NM_FIXED}\\archiver`)
const ZipArchive = archiverModule.ZipArchive

const ROOT = resolve(__dirname, '..')
const SRC = resolve(ROOT, 'client/public/favicon.svg')
const PUBLIC_DIR = resolve(ROOT, 'client/public')
const ZIP_DIR = resolve(ROOT, 'dist-favicon')
const ZIP_STAGE = resolve(ZIP_DIR, 'ticket-master-favicon')
const ZIP_OUT = resolve(ZIP_DIR, 'ticket-master-favicon.zip')

console.log('Building favicon set from', SRC)
if (!existsSync(SRC)) {
  console.error('Source SVG not found — nothing to build.')
  process.exit(1)
}

const svg = readFileSync(SRC)

// -------------------------------------------------------------
// 1. Rasterize all PNG sizes.
// -------------------------------------------------------------
// Sharp uses librsvg under the hood — the SVG is rendered at its
// declared viewBox and then resized to the target dimensions with
// Lanczos3 downsampling, which keeps the crisp T sharp even at
// 16×16. density=384 forces a higher internal DPI so the raster
// doesn't quantize the geometry before Sharp resamples.
async function raster(size) {
  return sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

const sizes = [16, 32, 48, 180]
const buffers = {}
for (const s of sizes) {
  buffers[s] = await raster(s)
  console.log(`  · rasterized ${s}×${s} → ${buffers[s].length} bytes`)
}

// -------------------------------------------------------------
// 2. Write PNG outputs into client/public/ so Vite serves them.
// -------------------------------------------------------------
const publicWrites = [
  ['favicon-16x16.png', buffers[16]],
  ['favicon-32x32.png', buffers[32]],
  ['favicon-48x48.png', buffers[48]],
  ['apple-touch-icon.png', buffers[180]],
]
for (const [name, buf] of publicWrites) {
  writeFileSync(resolve(PUBLIC_DIR, name), buf)
}

// -------------------------------------------------------------
// 3. Build multi-image favicon.ico (16 + 32 + 48).
// -------------------------------------------------------------
const icoBuf = await pngToIco([buffers[16], buffers[32], buffers[48]])
writeFileSync(resolve(PUBLIC_DIR, 'favicon.ico'), icoBuf)
console.log(`  · built favicon.ico (16+32+48) → ${icoBuf.length} bytes`)

// -------------------------------------------------------------
// 4. Stage a copy of every artifact into dist-favicon/ticket-master-favicon
//    and zip it as ticket-master-favicon.zip for handoff.
// -------------------------------------------------------------
if (existsSync(ZIP_STAGE)) rmSync(ZIP_STAGE, { recursive: true, force: true })
mkdirSync(ZIP_STAGE, { recursive: true })
writeFileSync(resolve(ZIP_STAGE, 'favicon.ico'), icoBuf)
writeFileSync(resolve(ZIP_STAGE, 'favicon-16x16.png'), buffers[16])
writeFileSync(resolve(ZIP_STAGE, 'favicon-32x32.png'), buffers[32])
writeFileSync(resolve(ZIP_STAGE, 'favicon-48x48.png'), buffers[48])
writeFileSync(resolve(ZIP_STAGE, 'apple-touch-icon.png'), buffers[180])
writeFileSync(resolve(ZIP_STAGE, 'favicon.svg'), svg)
writeFileSync(
  resolve(ZIP_STAGE, 'README.md'),
  [
    '# Ticket Master favicon set',
    '',
    'Blue #2563EB background, white geometric T.',
    '',
    'Files:',
    '- `favicon.ico` — multi-image (16 / 32 / 48). Use as legacy fallback.',
    '- `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png` — modern browsers.',
    '- `apple-touch-icon.png` (180×180) — iOS home-screen bookmark.',
    '- `favicon.svg` — vector source. Serve directly if you want a resolution-independent favicon.',
    '',
    'Recommended `<head>`:',
    '',
    '```html',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />',
    '<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
    '<link rel="shortcut icon" href="/favicon.ico" />',
    '```',
    '',
  ].join('\n'),
)

await new Promise((resolvePromise, rejectPromise) => {
  const output = require_('node:fs').createWriteStream(ZIP_OUT)
  const archive = new ZipArchive({ zlib: { level: 9 } })
  output.on('close', () => {
    console.log(`  · zipped → ${ZIP_OUT} (${archive.pointer()} bytes)`)
    resolvePromise()
  })
  archive.on('error', rejectPromise)
  archive.pipe(output)
  archive.directory(ZIP_STAGE, 'ticket-master-favicon')
  archive.finalize()
})

console.log()
console.log('Done.')
console.log('Public assets:')
console.log('  ', PUBLIC_DIR)
console.log('Zip handoff:')
console.log('  ', ZIP_OUT)

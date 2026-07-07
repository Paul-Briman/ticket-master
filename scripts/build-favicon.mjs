// Rebuild every browser-required favicon size from a single source
// image + package the whole set as ticket-master-favicon.zip.
//
// Source (in order of preference):
//   1. client/public/favicon-source.png  ← preferred: a user-provided
//      raster (the current "italic t on blue circle" design).
//   2. client/public/favicon.svg         ← fallback: vector source.
//
// This gives us one script that regenerates the set either from a
// design PNG the user drops in, or from an SVG we author. Nothing
// else is touched.

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  createWriteStream,
} from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require_ = createRequire(import.meta.url)

const TMP_NM =
  process.platform === 'win32' && process.env.TEMP
    ? `${process.env.TEMP}\\node_modules`
    : '/tmp/node_modules'
const sharp = require_(`${TMP_NM}\\sharp`)
const pngToIcoModule = require_(`${TMP_NM}\\png-to-ico`)
const pngToIco = pngToIcoModule.default || pngToIcoModule
const ZipArchive = require_(`${TMP_NM}\\archiver`).ZipArchive

const ROOT = resolve(__dirname, '..')
const PUBLIC_DIR = resolve(ROOT, 'client/public')
const PNG_SRC = resolve(PUBLIC_DIR, 'favicon-source.png')
const SVG_SRC = resolve(PUBLIC_DIR, 'favicon.svg')
const ZIP_DIR = resolve(ROOT, 'dist-favicon')
const ZIP_STAGE = resolve(ZIP_DIR, 'ticket-master-favicon')
const ZIP_OUT = resolve(ZIP_DIR, 'ticket-master-favicon.zip')

// -------------------------------------------------------------
// 1. Pick a source. Prefer PNG (user-provided) over SVG.
// -------------------------------------------------------------
let sourceBuf
let sourceLabel
if (existsSync(PNG_SRC)) {
  sourceBuf = readFileSync(PNG_SRC)
  sourceLabel = 'favicon-source.png'
} else if (existsSync(SVG_SRC)) {
  sourceBuf = readFileSync(SVG_SRC)
  sourceLabel = 'favicon.svg'
} else {
  console.error(
    'No source found. Provide either client/public/favicon-source.png ' +
      'or client/public/favicon.svg.',
  )
  process.exit(1)
}

const meta = await sharp(sourceBuf).metadata()
console.log(`Building from ${sourceLabel} — ${meta.format} ${meta.width}x${meta.height}`)

// -------------------------------------------------------------
// 2. Rasterize all PNG sizes.
// -------------------------------------------------------------
// density=384 only matters for SVG rasterization (forces high internal
// DPI so the shape is sampled at a large enough resolution before
// Sharp downsamples). It's a no-op for PNG input. Lanczos3 for the
// resize kernel keeps curves crisp at 16x16.
async function raster(size) {
  return sharp(sourceBuf, { density: 384 })
    .resize(size, size, { fit: 'contain', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

const sizes = [16, 32, 48, 180]
const buffers = {}
for (const s of sizes) {
  buffers[s] = await raster(s)
  console.log(`  · rasterized ${s}x${s} → ${buffers[s].length} bytes`)
}

// -------------------------------------------------------------
// 3. Write PNG outputs into client/public/ so Vite serves them.
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
// 4. Build multi-image favicon.ico (16 + 32 + 48).
// -------------------------------------------------------------
const icoBuf = await pngToIco([buffers[16], buffers[32], buffers[48]])
writeFileSync(resolve(PUBLIC_DIR, 'favicon.ico'), icoBuf)
console.log(`  · built favicon.ico (16+32+48) → ${icoBuf.length} bytes`)

// -------------------------------------------------------------
// 5. Stage + zip.
// -------------------------------------------------------------
if (existsSync(ZIP_STAGE)) rmSync(ZIP_STAGE, { recursive: true, force: true })
mkdirSync(ZIP_STAGE, { recursive: true })
writeFileSync(resolve(ZIP_STAGE, 'favicon.ico'), icoBuf)
writeFileSync(resolve(ZIP_STAGE, 'favicon-16x16.png'), buffers[16])
writeFileSync(resolve(ZIP_STAGE, 'favicon-32x32.png'), buffers[32])
writeFileSync(resolve(ZIP_STAGE, 'favicon-48x48.png'), buffers[48])
writeFileSync(resolve(ZIP_STAGE, 'apple-touch-icon.png'), buffers[180])
if (sourceLabel === 'favicon-source.png') {
  writeFileSync(resolve(ZIP_STAGE, 'favicon-source.png'), sourceBuf)
}
if (existsSync(SVG_SRC)) {
  writeFileSync(resolve(ZIP_STAGE, 'favicon.svg'), readFileSync(SVG_SRC))
}
writeFileSync(
  resolve(ZIP_STAGE, 'README.md'),
  [
    '# Ticket Master favicon set',
    '',
    'Blue circle background, white italic lowercase "t".',
    '',
    'Files:',
    '- `favicon.ico` — multi-image (16 / 32 / 48). Legacy fallback.',
    '- `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png` — modern browsers.',
    '- `apple-touch-icon.png` (180x180) — iOS home-screen bookmark.',
    '- `favicon-source.png` — high-res source used to generate every other file.',
    '',
    'Recommended `<head>`:',
    '',
    '```html',
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
  const output = createWriteStream(ZIP_OUT)
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
console.log('Public assets:', PUBLIC_DIR)
console.log('Zip handoff:  ', ZIP_OUT)

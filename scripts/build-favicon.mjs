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
// 1b. If the source has an opaque white background around the
// artwork (i.e. it's a solid design on a white square), auto-mask
// everything outside the detected circular artwork to transparent.
// Cheap heuristic: if all four corner pixels are near-white AND
// the alpha channel is missing or fully opaque, run the mask.
// -------------------------------------------------------------
async function autoMaskCircle(inputBuf) {
  const { data, info } = await sharp(inputBuf).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  })
  const { width, height, channels } = info

  // Corner check — are all four corners near-white + opaque?
  const NEAR_WHITE = 240
  const cornerAt = (x, y) => {
    const i = (y * width + x) * channels
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] }
  }
  const corners = [
    cornerAt(0, 0),
    cornerAt(width - 1, 0),
    cornerAt(0, height - 1),
    cornerAt(width - 1, height - 1),
  ]
  const allWhiteCorners = corners.every(
    (c) => c.r >= NEAR_WHITE && c.g >= NEAR_WHITE && c.b >= NEAR_WHITE && c.a >= 250,
  )
  if (!allWhiteCorners) {
    console.log('  · source already has transparent/non-white background — skipping mask')
    return inputBuf
  }

  // Find bounding box of non-white pixels — this outlines the artwork
  // (the blue circle in our case; anti-aliased edge pixels count too).
  let minX = width, minY = height, maxX = 0, maxY = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const r = data[i], g = data[i + 1], b = data[i + 2]
      if (r < NEAR_WHITE || g < NEAR_WHITE || b < NEAR_WHITE) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  // Radius = larger half-side so a slightly-non-square bounding box
  // (e.g. from anti-aliasing) doesn't clip the artwork.
  const radius = Math.max((maxX - minX) / 2, (maxY - minY) / 2)
  console.log(
    `  · detected circular artwork: center=(${cx.toFixed(0)},${cy.toFixed(
      0,
    )}) radius=${radius.toFixed(0)} — masking to transparent circle`,
  )

  // Build a new RGBA buffer. Soft 2-pixel anti-aliased edge so the
  // circle boundary reads clean at every downsampled size.
  const AA = 2
  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * channels
      const dstIdx = (y * width + x) * 4
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      let alpha
      if (dist <= radius - AA) alpha = 255
      else if (dist >= radius + AA) alpha = 0
      else alpha = Math.round((255 * (radius + AA - dist)) / (2 * AA))
      rgba[dstIdx] = data[srcIdx]
      rgba[dstIdx + 1] = data[srcIdx + 1]
      rgba[dstIdx + 2] = data[srcIdx + 2]
      rgba[dstIdx + 3] = alpha
    }
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

if (sourceLabel === 'favicon-source.png') {
  sourceBuf = await autoMaskCircle(sourceBuf)
}

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

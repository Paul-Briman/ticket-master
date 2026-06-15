// Client-side image compression. Reads a File (JPEG/PNG/WebP/HEIC),
// resizes the longest edge to MAX_DIM, re-encodes as JPEG at the
// configured quality, returns a data: URL ready to drop straight
// into a JSON body and store on the order.
//
// Targets ~300 KB per image for typical phone photos of a gift card —
// well below the backend's 800,000-char hard cap.

const MAX_DIM = 1400
const QUALITY = 0.78

export const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
// HEIC photos straight off iPhone aren't decodable in <canvas>, so we
// reject them up-front rather than producing a corrupt blob. Users get
// a clear "save / share as JPEG" instruction.
export const MAX_INPUT_BYTES = 12 * 1024 * 1024 // 12 MB raw photo input

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not decode the image.'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}

/**
 * @param {File} file
 * @returns {Promise<string>} JPEG data URL
 */
export async function compressImage(file) {
  if (!file) throw new Error('No file selected.')
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('That image is too large. Please pick one under 12 MB.')
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error(
      'Please upload a JPEG, PNG, or WebP image (iPhone HEIC isn\'t supported — share as JPEG).',
    )
  }

  const img = await loadImageFromFile(file)
  const scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Browser does not support canvas image processing.')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not compress image.'))
          return
        }
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Could not read compressed image.'))
        reader.readAsDataURL(blob)
      },
      'image/jpeg',
      QUALITY,
    )
  })
}

/** Convenience for UI hints. */
export function approximateSizeFromDataUrl(dataUrl) {
  if (!dataUrl) return 0
  // base64 expands binary by ~4/3, so multiplying length by 0.75 is
  // a tight estimate of the underlying byte size.
  const i = dataUrl.indexOf(',')
  const payload = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  return Math.round(payload.length * 0.75)
}

import { useRef, useState } from 'react'
import {
  compressImage,
  approximateSizeFromDataUrl,
} from '../lib/imageCompress.js'

/**
 * Apple Gift Card payment instructions + front/back photo upload.
 *
 * The parent (Checkout) owns the image state — when the customer
 * picks files we hand the compressed data: URLs back via
 * onImagesChange so the Checkout submit handler can include them in
 * /api/create-order.
 *
 * Tawk widget integration: the "Contact Support" button calls
 * Tawk_API.showWidget() + .maximize() if the embed has loaded. If
 * Tawk hasn't loaded yet (slow connection, ad-blocker), we fall
 * back to mailto:support so the customer is never stranded.
 */
const SUPPORT_EMAIL = 'support@ticketsmasterr.com'

export default function AppleGiftCardPayment({
  total,
  frontImage,
  backImage,
  onImagesChange,
}) {
  const [error, setError] = useState('')

  function handleSupportClick() {
    setError('')
    const api = window.Tawk_API
    try {
      if (api && typeof api.showWidget === 'function') api.showWidget()
      if (api && typeof api.maximize === 'function') {
        api.maximize()
        return
      }
    } catch {
      // ignore — fall through to mailto
    }
    // Tawk hasn't loaded yet — fall back to email rather than dead-end.
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Gift card payment help`
  }

  function update(field, value) {
    onImagesChange({
      frontImage,
      backImage,
      [field]: value,
    })
  }

  async function handleFile(field, file) {
    setError('')
    if (!file) {
      update(field, null)
      return
    }
    try {
      const dataUrl = await compressImage(file)
      update(field, dataUrl)
    } catch (err) {
      setError(err.message || 'Could not process that image.')
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 md:p-6">
      <header className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 md:text-xl">
          Pay with Apple Gift Card
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Purchase an Apple Gift Card matching your ticket total, then
          upload clear photos of both sides for verification.
        </p>
      </header>

      <ol className="space-y-2.5 rounded-lg border border-blue-100 bg-blue-50/40 p-4 text-sm text-gray-800">
        <li className="flex gap-2">
          <span className="font-semibold text-brand">1.</span>
          Buy an Apple Gift Card from any retailer with a face value of at
          least <strong>{formatTotal(total)}</strong>. Physical or digital both work.
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-brand">2.</span>
          Take a clear, well-lit photo of the <strong>front</strong> of the
          card and another of the <strong>back</strong>. Make sure the gift
          card number and PIN are fully visible — that's what we verify.
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-brand">3.</span>
          Upload both photos below and submit your order. Tickets will be
          confirmed after we verify the card balance.
        </li>
      </ol>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UploadSlot
          label="Front of card"
          hint="Including the card number"
          image={frontImage}
          onFile={(f) => handleFile('frontImage', f)}
          onClear={() => update('frontImage', null)}
        />
        <UploadSlot
          label="Back of card"
          hint="Including the PIN / scratch panel"
          image={backImage}
          onFile={(f) => handleFile('backImage', f)}
          onClear={() => update('backImage', null)}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-700">
          <p className="font-medium">Need help?</p>
          <p className="text-xs text-gray-500">
            Our team can answer questions about which gift card to buy or what
            the upload should look like.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSupportClick}
          className="rounded-lg border border-brand bg-white px-3 py-2 text-sm font-medium text-brand transition-colors hover:bg-blue-50 sm:px-4"
        >
          Contact Support
        </button>
      </div>
    </div>
  )
}

function formatTotal(total) {
  if (!Number.isFinite(total) || total <= 0) return 'your order total'
  return `$${total.toFixed(2)}`
}

function UploadSlot({ label, hint, image, onFile, onClear }) {
  const ref = useRef(null)
  const sizeKb = image ? Math.round(approximateSizeFromDataUrl(image) / 1024) : 0

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <p className="text-[11px] text-gray-400">{hint}</p>
      </div>

      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
        {image ? (
          <>
            <img
              src={image}
              alt={label}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={onClear}
              className="absolute right-2 top-2 rounded-md border border-white/40 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur"
              aria-label={`Remove ${label.toLowerCase()}`}
            >
              Remove
            </button>
            <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
              ~{sizeKb} KB
            </span>
          </>
        ) : (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-1 px-4 text-center text-sm text-gray-500 transition-colors hover:bg-gray-100"
          >
            <span className="text-2xl" aria-hidden>
              📷
            </span>
            <span className="font-medium text-gray-700">Tap to upload</span>
            <span className="text-xs text-gray-400">JPEG / PNG / WebP</span>
          </button>
        )}
      </div>

      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] || null
          onFile(f)
          // Reset the input so re-picking the same file fires onChange again.
          e.target.value = ''
        }}
      />
    </div>
  )
}

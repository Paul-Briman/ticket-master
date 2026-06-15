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

      {/* Three-step instructions with a comfortable vertical rhythm.
          Each step is a 2-column flex row: avatar circle on the left,
          stack of (eyebrow / title / body / amount) on the right. The
          amount in Step 1 lives in its own bordered block so it never
          inline-wraps and remains visually anchored. */}
      <ol className="rounded-xl border border-blue-100 bg-blue-50/40 p-5 md:p-6">
        <li className="flex gap-4">
          <StepBadge>1</StepBadge>
          <div className="min-w-0 flex-1 space-y-2 pb-7 md:pb-8">
            <StepEyebrow>Step 1</StepEyebrow>
            <StepTitle>Purchase an Apple Gift Card</StepTitle>
            <StepBody>
              Buy an Apple Gift Card from any retailer with a face value of
              at least:
            </StepBody>
            <AmountBlock total={total} />
            <StepBody muted>
              Physical and digital gift cards are both accepted.
            </StepBody>
          </div>
        </li>

        <li className="flex gap-4 border-t border-blue-100/70 pt-7 md:pt-8">
          <StepBadge>2</StepBadge>
          <div className="min-w-0 flex-1 space-y-2 pb-7 md:pb-8">
            <StepEyebrow>Step 2</StepEyebrow>
            <StepTitle>Take clear photos</StepTitle>
            <StepBody>
              Take a clear, well-lit photo of the front of the card and
              another of the back.
            </StepBody>
            <StepBody muted>
              Make sure the gift card number and PIN are fully visible — these
              are required for verification.
            </StepBody>
          </div>
        </li>

        <li className="flex gap-4 border-t border-blue-100/70 pt-7 md:pt-8">
          <StepBadge>3</StepBadge>
          <div className="min-w-0 flex-1 space-y-2">
            <StepEyebrow>Step 3</StepEyebrow>
            <StepTitle>Upload and submit</StepTitle>
            <StepBody>
              Upload both photos below and submit your order.
            </StepBody>
            <StepBody muted>
              Your tickets will be issued after the gift card balance has been
              verified.
            </StepBody>
          </div>
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

// ---- Step-row primitives ---------------------------------------
// Single-purpose sub-components so the markup above stays readable
// and any future style tweak only touches one place.

function StepBadge({ children }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-base font-bold leading-none text-white shadow-sm md:h-11 md:w-11 md:text-lg">
      {children}
    </div>
  )
}

function StepEyebrow({ children }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
      {children}
    </p>
  )
}

function StepTitle({ children }) {
  return (
    <h3 className="text-base font-bold leading-snug text-gray-900 md:text-lg">
      {children}
    </h3>
  )
}

function StepBody({ children, muted = false }) {
  return (
    <p
      className={`text-sm leading-relaxed md:text-[15px] md:leading-relaxed ${
        muted ? 'text-gray-500' : 'text-gray-700'
      }`}
    >
      {children}
    </p>
  )
}

// Highlighted amount card — own block so it never inline-wraps in the
// middle of the body copy. If the order total isn't a real number yet
// (during initial seed), we fall back to a softer phrase rather than
// flashing "$0.00".
function AmountBlock({ total }) {
  const isReal = Number.isFinite(total) && total > 0
  return (
    <div className="my-1 inline-flex flex-col rounded-xl border-2 border-brand/30 bg-white px-5 py-3 shadow-sm">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-brand/70">
        Card amount
      </span>
      <span className="mt-0.5 whitespace-nowrap text-2xl font-bold tabular-nums tracking-tight text-brand md:text-3xl">
        {isReal ? `$${total.toFixed(2)}` : 'Your order total'}
      </span>
    </div>
  )
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

import { useEffect, useRef, useState } from 'react'

// Drop-in replacement for a plain <img> that adds:
//   1. Neutral gray background while loading (no white flash / no CLS)
//   2. Smooth 300ms opacity fade-in once decoded
//   3. loading=lazy by default; opt-in priority hint for hero /
//      above-the-fold images (loading=eager + fetchpriority=high +
//      decoding=sync)
//   4. Session-level de-dupe cache — if the URL was already fully
//      loaded once this session, we skip the loading state entirely,
//      so navigating between pages that share an image (e.g. hero,
//      Recently Viewed card, list card) never re-flashes the skeleton
//   5. Cached-image detection at mount — if the browser's HTTP cache
//      already delivered the bytes before React attached its onLoad
//      handler (imgRef.current.complete), we jump straight to loaded
//   6. Graceful error handling — on 404 / network error, fall back to
//      a caller-supplied image or (if none) hide the img element via
//      opacity 0 so the container just shows its gray background
//      instead of a broken-image icon.
//
// The component reserves its own dimensions via width/height (or the
// parent's aspect-ratio wrapper). It does NOT introduce new layout —
// existing callers can migrate by renaming the tag and passing the
// same props.

// Module-level so it survives route changes. Kept as a Set of URL
// strings; a URL is added once its onLoad fires successfully.
const loadedUrls = new Set()

/**
 * @param {object} props
 * @param {string} [props.src]        — image URL
 * @param {string} [props.alt]        — alt text (default '')
 * @param {string} [props.className]  — passed straight through
 * @param {boolean}[props.priority]   — hero / above-the-fold hint
 * @param {string} [props.fallback]   — URL rendered on load error
 * @param {function}[props.onLoad]    — proxied
 * @param {function}[props.onError]   — proxied
 * … every other DOM prop is spread onto the underlying <img>.
 */
export default function Image({
  src,
  alt = '',
  className = '',
  priority = false,
  fallback,
  onLoad,
  onError,
  ...rest
}) {
  const imgRef = useRef(null)
  const [state, setState] = useState(() =>
    !src ? 'loading' : loadedUrls.has(src) ? 'loaded' : 'loading',
  )

  // Reset load state when src changes, and detect when the browser
  // cache handed us a fully-loaded img before React wired onLoad.
  useEffect(() => {
    if (!src) {
      setState('loading')
      return
    }
    if (loadedUrls.has(src)) {
      setState('loaded')
      return
    }
    // If the img was already complete before we mounted (very fast
    // CDN, HTTP cache), we would otherwise miss the onLoad event and
    // stay in the loading state forever.
    const el = imgRef.current
    if (el && el.complete && el.naturalWidth > 0) {
      loadedUrls.add(src)
      setState('loaded')
    } else {
      setState('loading')
    }
  }, [src])

  const isErrored = state === 'error'
  const usingFallback = isErrored && !!fallback
  const isVisible = state === 'loaded' || usingFallback
  const finalSrc = usingFallback ? fallback : src

  // Show a subtle neutral background while loading OR when errored
  // without a fallback. Never animate-pulse: the fade-in is enough
  // motion, and pulsing over card grids looks noisy.
  const backdrop =
    !isVisible ? 'bg-gray-100' : ''

  const priorityProps = priority
    ? {
        loading: 'eager',
        decoding: 'sync',
        // React 18.3+ accepts lowercase HTML fetchpriority.
        fetchpriority: 'high',
      }
    : {
        loading: 'lazy',
        decoding: 'async',
      }

  return (
    <img
      ref={imgRef}
      src={finalSrc}
      alt={alt}
      className={`${className} ${backdrop} transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onLoad={(e) => {
        if (src) loadedUrls.add(src)
        setState('loaded')
        if (typeof onLoad === 'function') onLoad(e)
      }}
      onError={(e) => {
        setState('error')
        if (typeof onError === 'function') onError(e)
      }}
      {...priorityProps}
      {...rest}
    />
  )
}

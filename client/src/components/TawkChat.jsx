import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Tawk.to embed endpoint provided by the customer dashboard. Property
// id and widget id concatenated with a slash. Configure brand color,
// avatar, and operating-hours behavior in the Tawk dashboard — they
// aren't configurable from the embed.
const TAWK_SRC = 'https://embed.tawk.to/6a00f3fe11568a1c347466b6/1jo9ri720'

// Delay before the chat bubble appears so it never competes with the
// hero CTA / first content paint. 6 seconds matches the upper end of
// the requested 5–8s window.
const APPEAR_DELAY_MS = 6000

// Module-level guard so React StrictMode's double-effect, HMR
// re-mounts, and any other accidental re-render of <TawkChat /> can
// never inject the script twice.
let injected = false

/**
 * Headless component — renders nothing. Mount once at the app root.
 *
 * Loads Tawk.to via async script injection inside a useEffect, with a
 * delayed appearance and an onLoad hook that minimizes the widget so
 * it sits as a discreet bottom-right pill instead of opening on every
 * page load.
 *
 * Cleans up the pending timeout on unmount, but does NOT remove the
 * injected <script> or kill the live iframe — Tawk binds globally and
 * takes ownership of its own DOM, so manual teardown causes errors.
 * In practice this component never unmounts (it lives at the App
 * root), so the cleanup only matters for dev StrictMode behavior.
 */
// Routes where the chat bubble overlaps a critical full-width sticky
// CTA (Checkout / mobile event-detail) on small screens. We hide the
// widget on these paths at narrow viewports so it never blocks the
// purchase flow, then re-show it when the user navigates elsewhere.
function pathBlocksCheckoutCTA(pathname) {
  if (!pathname) return false
  if (pathname === '/checkout') return true
  if (pathname.startsWith('/event/')) return true
  return false
}

export default function TawkChat() {
  const location = useLocation()

  useEffect(() => {
    if (typeof window === 'undefined') return

    let timeoutId = null

    timeoutId = setTimeout(() => {
      timeoutId = null
      if (injected) return
      injected = true

      // Initialize the Tawk API hooks BEFORE the script loads so any
      // queued calls (minimize on load, etc.) survive the async fetch.
      window.Tawk_API = window.Tawk_API || {}
      window.Tawk_LoadStart = new Date()

      const prevOnLoad = window.Tawk_API.onLoad
      window.Tawk_API.onLoad = function () {
        try {
          if (typeof window.Tawk_API.minimize === 'function') {
            window.Tawk_API.minimize()
          }
        } catch (err) {
          // Swallow — failing to minimize is cosmetic, never fatal.
          // eslint-disable-next-line no-console
          console.warn('[TawkChat] minimize failed', err?.message)
        }
        if (typeof prevOnLoad === 'function') {
          try {
            prevOnLoad()
          } catch {
            // ignore prior handler errors
          }
        }
      }

      const script = document.createElement('script')
      script.async = true
      script.src = TAWK_SRC
      script.charset = 'UTF-8'
      script.setAttribute('crossorigin', '*')
      script.dataset.tawk = 'ticketmaster'
      script.onerror = () => {
        // Tawk failed to load (network blocker, ad-blocker, etc.).
        // Reset the guard so a future mount can retry, but don't
        // surface anything to the user — chat is non-essential.
        injected = false
        // eslint-disable-next-line no-console
        console.warn('[TawkChat] embed script failed to load')
      }

      const firstScript = document.getElementsByTagName('script')[0]
      if (firstScript?.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript)
      } else {
        document.head.appendChild(script)
      }
    }, APPEAR_DELAY_MS)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      // Intentionally NOT removing the script / iframe here. Tawk
      // attaches its own listeners and DOM nodes to <body>; tearing
      // them down on unmount will throw inside the live widget.
    }
  }, [])

  // Hide the bubble on routes where it would visually conflict with
  // the mobile sticky purchase CTA. Re-show it everywhere else. We
  // poll via requestAnimationFrame in case Tawk hasn't finished
  // loading yet at the moment of route change.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    function applyVisibility() {
      if (cancelled) return
      const api = window.Tawk_API
      if (!api || typeof api.hideWidget !== 'function') {
        // Tawk hasn't loaded yet — keep polling. The 6s appearance
        // delay plus the iframe's own load time means it can take
        // ~7–8s before the API is callable; cap at ~12s so a blocked
        // / failed-to-load script eventually stops us polling.
        if (++attempts < 720) {
          rafId = window.requestAnimationFrame(applyVisibility)
        }
        return
      }
      try {
        const isNarrow =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(max-width: 768px)').matches
        const block =
          isNarrow && pathBlocksCheckoutCTA(location.pathname)
        if (block) api.hideWidget()
        else if (typeof api.showWidget === 'function') api.showWidget()
      } catch {
        // Visibility toggling is cosmetic — never throw.
      }
    }

    let attempts = 0
    let rafId = window.requestAnimationFrame(applyVisibility)

    return () => {
      cancelled = true
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [location.pathname])

  return null
}
